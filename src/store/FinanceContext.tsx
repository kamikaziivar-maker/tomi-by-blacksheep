import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  createStarterFinanceState,
  DEFAULT_ACCOUNT_SECURITY,
  DEFAULT_NOTIFICATION_SETTINGS,
  EMPTY_FINANCE_STATE,
} from '../data/initialData';
import {
  AccountSecuritySettings,
  ChatMessage,
  CurrencyConfig,
  DebtEntry,
  DebtItem,
  FinanceState,
  FundSupport,
  InternalLoan,
  InventoryItem,
  NotificationItem,
  NotificationSettings,
  PaymentMethod,
  PocketTarget,
  Project,
  ProjectMember,
  ProjectOutflowNature,
  ProjectRole,
  SavingsGoal,
  ShakeSensitivity,
  SharedProjectSyncOp,
  StockPurchaseLine,
  StockSaleLine,
  SupportType,
  TimePeriod,
  Transaction,
  TransactionType,
} from '../types/finance';
import { answerCoachQuestion, computeFinanceMetrics, GlobalMetrics } from '../utils/aiEngine';
import { convertFromFbu, convertToFbu, generateId, getTodayISO } from '../utils/format';
import { haptics } from '../utils/haptics';
import {
  evaluateSmartNotifications,
  getNotificationSettings,
  sendNativeNotificationIfPermitted,
} from '../utils/notificationsEngine';
import {
  cleanupNativePushListeners,
  getPushStatusSnapshot,
  initNativePushNotifications,
  PushStatusSnapshot,
  refreshPushNotifications,
  removeCachedPushTokenFromSupabase,
  subscribePushStatus,
  syncPushTokenWithSupabase,
} from '../utils/pushNotifications';
import {
  clearAccountLocalCache,
  getActiveStorageNamespace,
  getUserNamespace,
  hashPin,
  isIndexedDbSupported,
  migrateLegacyIndexedDbToLocalNamespace,
  migrateLegacyLocalStorageToLocalNamespace,
  PersistenceStatus,
  readFromIndexedDb,
  readFromLocalStorage,
  setActiveStorageNamespace,
  StorageNamespace,
  writeToIndexedDb,
  writeToLocalStorage,
} from '../utils/storage';
import { isSupabaseConfigured, supabase } from '../utils/supabaseClient';

export interface QuickTransactionInput {
  type: TransactionType;
  pocket: PocketTarget;
  projectId?: string;
  savingsGoalId?: string;
  debtId?: string;
  supportId: string;
  targetSupportId?: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  date: string;
  label: string;
  categoryOrSource?: string;
  note?: string;
  reminderDate?: string;
  reminderDelayDays?: number;
  outflowNature?: ProjectOutflowNature;
  stockPurchaseLines?: StockPurchaseLine[];
  stockSaleLines?: StockSaleLine[];
}

export interface ProjectFormInput {
  name: string;
  category: string;
  customCategory?: string;
  description?: string;
  revenueSources: string[];
  expenseCategories: string[];
  initialSupports?: Omit<FundSupport, 'id' | 'ownerType' | 'ownerId'>[];
}

function getInitials(name?: string): string {
  const clean = (name || 'Moi').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase() || 'TM';
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = () => chars[Math.floor(Math.random() * chars.length)];
  return `TOMI-${pick()}${pick()}${pick()}${pick()}-${pick()}${pick()}${pick()}${pick()}`;
}

interface FinanceContextValue {
  state: FinanceState;
  metrics: GlobalMetrics;
  setPeriod: (period: TimePeriod) => void;
  setDisplayCurrency: (code: string) => void;
  upsertCurrency: (currency: CurrencyConfig) => void;
  removeCurrency: (code: string) => void;

  // Supports
  addSupport: (support: Omit<FundSupport, 'id'>) => string;
  updateSupport: (id: string, patch: Partial<Omit<FundSupport, 'id' | 'ownerType' | 'ownerId'>>) => void;
  deleteSupport: (id: string) => void;

  // Projects, Inventory & Isolated Collaboration
  addProject: (input: ProjectFormInput) => string;
  updateProject: (id: string, patch: Partial<Omit<Project, 'id' | 'createdAt'>>) => void;
  deleteProject: (id: string) => void;
  addProjectTag: (projectId: string, kind: 'revenue' | 'expense', value: string) => void;
  getProjectRole: (projectId: string) => ProjectRole;
  upsertInventoryItem: (input: {
    id?: string;
    projectId: string;
    name: string;
    unit: string;
    quantity: number;
    minStockThreshold: number;
    averageUnitCostFbu: number;
  }) => void;
  updateInventoryItem: (
    itemId: string,
    patch: {
      name: string;
      unit: string;
      quantity: number;
      averageUnitCostFbu: number;
      minStockThreshold: number;
    }
  ) => void;
  updateInventoryThreshold: (itemId: string, minStockThreshold: number) => void;
  deleteInventoryItem: (itemId: string) => void;
  enableProjectSharing: (
    projectId: string
  ) => Promise<{ ok: boolean; inviteCode?: string; message?: string }>;
  inviteProjectMember: (params: {
    projectId: string;
    email: string;
    displayName: string;
    role: ProjectRole;
  }) => Promise<{ ok: boolean; message: string }>;
  updateProjectMemberRole: (memberId: string, role: ProjectRole) => Promise<void>;
  removeProjectMember: (memberId: string) => Promise<void>;
  joinSharedProjectByCode: (
    inviteCode: string
  ) => Promise<{ ok: boolean; message: string; projectId?: string }>;
  syncSharedProjectsNow: () => Promise<{ ok: boolean; message: string }>;

  // Transactions & Internal Loans
  addQuickTransaction: (input: QuickTransactionInput) => void;
  updateQuickTransaction: (txId: string, input: QuickTransactionInput) => void;
  deleteTransaction: (id: string) => void;
  createInternalLoan: (params: {
    projectId: string;
    fromSupportId: string;
    toSupportId: string;
    amount: number;
    currency: string;
    date: string;
    reminderDate?: string;
    reminderDelayDays?: number;
    note?: string;
  }) => void;
  updateInternalLoan: (
    loanId: string,
    patch: {
      note?: string;
      reminderDate?: string;
      reminderDelayDays?: number;
      initialAmountFbu?: number;
    }
  ) => void;
  repayInternalLoan: (params: {
    loanId: string;
    amountFbu: number;
    fromSupportId: string;
    toSupportId: string;
    date: string;
  }) => void;

  // Debts & Receivables
  addDebt: (input: {
    direction: 'debt' | 'receivable';
    personName: string;
    initialAmountFbu: number;
    currency: string;
    date: string;
    dueDate?: string;
    note?: string;
    supportId?: string;
  }) => void;
  addDebtEntry: (params: {
    debtId: string;
    amountFbu: number;
    currency?: string;
    date: string;
    note?: string;
    supportId?: string;
  }) => void;
  updateDebt: (
    debtId: string,
    patch: {
      personName?: string;
      direction?: 'debt' | 'receivable';
      dueDate?: string;
      note?: string;
      currency?: string;
    }
  ) => void;
  updateDebtEntry: (
    debtId: string,
    entryId: string,
    patch: {
      amountFbu: number;
      date: string;
      note?: string;
      supportId?: string;
    }
  ) => void;
  deleteDebtEntry: (debtId: string, entryId: string) => void;
  repayDebt: (params: {
    debtId: string;
    amountFbu: number;
    date: string;
    supportId?: string;
    note?: string;
  }) => void;
  updateDebtRepayment: (
    debtId: string,
    repaymentId: string,
    patch: {
      amountFbu: number;
      date: string;
      supportId?: string;
      note?: string;
    }
  ) => void;
  deleteDebtRepayment: (debtId: string, repaymentId: string) => void;
  deleteDebt: (id: string) => void;

  // Savings
  addSavingsGoal: (input: {
    name: string;
    targetAmountFbu: number;
    currentAmountFbu: number;
    linkedSupportId?: string;
    deadline?: string;
    note?: string;
  }) => void;
  updateSavingsGoal: (
    id: string,
    patch: {
      name: string;
      targetAmountFbu: number;
      currentAmountFbu: number;
      note?: string;
      deadline?: string;
    }
  ) => void;
  adjustSavingsGoal: (params: {
    goalId: string;
    deltaFbu: number; // positive = deposit, negative = withdraw
    supportId?: string;
    date: string;
    note?: string;
  }) => void;
  deleteSavingsGoal: (id: string) => void;

  // AI Chat
  sendChatMessage: (content: string) => void;
  clearChatHistory: () => void;

  // Data Management & Dual Backup Status
  persistenceStatus: PersistenceStatus;
  exportJson: () => string;
  importJson: (raw: string) => { ok: boolean; error?: string };
  resetToStarter: () => void;
  resetToEmpty: () => void;

  // Account, Security & Remote Cloud Sync
  activeNamespace: StorageNamespace;
  isLocked: boolean;
  lockApp: () => void;
  unlockApp: () => void;
  verifyPin: (pin: string) => Promise<boolean>;
  enablePinLock: (pin: string) => Promise<void>;
  disablePinLock: () => void;
  updateAccountProfile: (
    patch: Partial<Omit<AccountSecuritySettings, 'pinEnabled' | 'pinHash'>>
  ) => void;
  loginRemoteAccount: (
    email: string,
    password: string
  ) => Promise<{
    ok: boolean;
    message: string;
    needsEmailConfirmation?: boolean;
    errorCode?: string;
  }>;
  registerRemoteAccount: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<{
    ok: boolean;
    message: string;
    needsEmailConfirmation?: boolean;
    errorCode?: string;
  }>;
  resendRemoteConfirmation: (email: string) => Promise<{ ok: boolean; message: string }>;
  logoutRemoteAccount: () => Promise<void>;

  // Privacy / Discret Mode & Shake Detection
  privacyMode: boolean;
  shakeEnabled: boolean;
  shakeSensitivity: ShakeSensitivity;
  privacyToast: string | null;
  togglePrivacyMode: () => void;
  setPrivacyMode: (active: boolean) => void;
  setShakeEnabled: (enabled: boolean) => void;
  setShakeSensitivity: (sensitivity: ShakeSensitivity) => void;

  // Ambient Neon Flows & Custom App Logo
  ambientFlowsEnabled: boolean;
  setAmbientFlowsEnabled: (enabled: boolean) => void;
  customLogoDataUrl?: string;
  setCustomLogoDataUrl: (dataUrl?: string) => void;

  // Smart Notifications & Native Android Push (FCM)
  notifications: NotificationItem[];
  unreadNotificationsCount: number;
  notificationSettings: NotificationSettings;
  notificationToast: {
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'danger';
    projectId?: string;
  } | null;
  pushStatus: PushStatusSnapshot;
  pendingProjectNavigationId: string | null;
  requestOpenProject: (projectId: string) => void;
  clearPendingProjectNavigation: () => void;
  refreshNativePush: () => Promise<PushStatusSnapshot>;
  updateNotificationSettings: (patch: Partial<NotificationSettings>) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  dismissNotification: (id: string) => void;
  clearReadNotifications: () => void;
  triggerTestNotification: () => void;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

function normalizeLoadedState(parsed: Partial<FinanceState>): FinanceState {
  return {
    settings: {
      displayCurrency: parsed.settings?.displayCurrency || 'FBU',
      currencies:
        Array.isArray(parsed.settings?.currencies) && parsed.settings!.currencies.length > 0
          ? parsed.settings!.currencies
          : EMPTY_FINANCE_STATE.settings.currencies,
      period: parsed.settings?.period || 'month',
      account: {
        ...DEFAULT_ACCOUNT_SECURITY,
        ...(parsed.settings?.account ?? {}),
      },
      privacyMode: Boolean(parsed.settings?.privacyMode ?? false),
      shakeEnabled: parsed.settings?.shakeEnabled ?? true,
      shakeSensitivity: parsed.settings?.shakeSensitivity || 'normal',
      ambientFlowsEnabled: parsed.settings?.ambientFlowsEnabled ?? true,
      customLogoDataUrl: parsed.settings?.customLogoDataUrl || undefined,
      notifications: {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...(parsed.settings?.notifications ?? {}),
      },
    },
    supports: Array.isArray(parsed.supports) ? parsed.supports : EMPTY_FINANCE_STATE.supports,
    projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    inventoryItems: Array.isArray(parsed.inventoryItems) ? parsed.inventoryItems : [],
    projectMembers: Array.isArray(parsed.projectMembers) ? parsed.projectMembers : [],
    pendingSyncQueue: Array.isArray(parsed.pendingSyncQueue) ? parsed.pendingSyncQueue : [],
    transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    internalLoans: Array.isArray(parsed.internalLoans) ? parsed.internalLoans : [],
    debts: Array.isArray(parsed.debts) ? parsed.debts : [],
    savingsGoals: Array.isArray(parsed.savingsGoals) ? parsed.savingsGoals : [],
    chatHistory: Array.isArray(parsed.chatHistory) ? parsed.chatHistory : [],
    notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
    dismissedNotificationKeys: Array.isArray(parsed.dismissedNotificationKeys)
      ? parsed.dismissedNotificationKeys
      : [],
  };
}

function createCleanRemoteState(): FinanceState {
  const cloned = JSON.parse(JSON.stringify(EMPTY_FINANCE_STATE)) as Partial<FinanceState>;
  return normalizeLoadedState(cloned);
}

function loadInitialState(): {
  namespace: StorageNamespace;
  state: FinanceState;
  updatedAt: string;
  hadLocal: boolean;
} {
  migrateLegacyLocalStorageToLocalNamespace();
  const namespace = getActiveStorageNamespace();
  const localPayload = readFromLocalStorage(namespace);
  if (localPayload) {
    return {
      namespace,
      state: normalizeLoadedState(localPayload.state),
      updatedAt: localPayload.updatedAt,
      hadLocal: true,
    };
  }
  return {
    namespace,
    state: namespace === 'local' ? createStarterFinanceState() : createCleanRemoteState(),
    updatedAt: new Date(0).toISOString(),
    hadLocal: false,
  };
}

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialBoot = useMemo(() => loadInitialState(), []);
  const [activeNamespace, setActiveNamespace] = useState<StorageNamespace>(initialBoot.namespace);
  const activeNamespaceRef = useRef<StorageNamespace>(initialBoot.namespace);
  const [state, setState] = useState<FinanceState>(initialBoot.state);
  const localUpdatedAtRef = useRef<string>(initialBoot.updatedAt);
  const hadLocalRef = useRef<boolean>(initialBoot.hadLocal);

  const [isLocked, setIsLocked] = useState<boolean>(() =>
    Boolean(initialBoot.state.settings.account?.pinEnabled && initialBoot.state.settings.account?.pinHash)
  );

  const [privacyToast, setPrivacyToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const [notificationToast, setNotificationToast] = useState<{
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'danger';
    projectId?: string;
  } | null>(null);
  const notifToastTimerRef = useRef<number | null>(null);

  const [pushStatus, setPushStatus] = useState<PushStatusSnapshot>(() =>
    getPushStatusSnapshot()
  );
  const [pendingProjectNavigationId, setPendingProjectNavigationId] = useState<
    string | null
  >(null);

  const requestOpenProject = (projectId: string) => {
    if (!projectId) return;
    setPendingProjectNavigationId(projectId);
  };

  const clearPendingProjectNavigation = () => {
    setPendingProjectNavigationId(null);
  };

  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>(() => ({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    localStorageOk: true,
    indexedDbAvailable: isIndexedDbSupported(),
    indexedDbSynced: false,
    lastSavedAt: null,
  }));

  // Listen for online/offline changes
  useEffect(() => {
    const handleOnline = () =>
      setPersistenceStatus((prev) => ({ ...prev, isOnline: true }));
    const handleOffline = () =>
      setPersistenceStatus((prev) => ({ ...prev, isOnline: false }));
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Background check of IndexedDB backup on mount (recovers if localStorage was wiped)
  useEffect(() => {
    let active = true;
    const bootNs = initialBoot.namespace;
    void (async () => {
      await migrateLegacyIndexedDbToLocalNamespace();
      const idbPayload = await readFromIndexedDb(bootNs);
      if (!active || !idbPayload || activeNamespaceRef.current !== bootNs) return;
      const shouldRestore =
        !hadLocalRef.current || idbPayload.updatedAt > localUpdatedAtRef.current;
      if (shouldRestore) {
        const restored = normalizeLoadedState(idbPayload.state);
        localUpdatedAtRef.current = idbPayload.updatedAt;
        hadLocalRef.current = true;
        setState(restored);
        if (restored.settings.account?.pinEnabled && restored.settings.account?.pinHash) {
          setIsLocked(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [initialBoot.namespace]);

  // Au démarrage d'une session cloud existante, resynchronise discrètement depuis Supabase si en ligne
  useEffect(() => {
    const bootNs = initialBoot.namespace;
    if (!bootNs.startsWith('user:') || !isSupabaseConfigured || !navigator.onLine) return;
    let active = true;
    const expectedUid = bootNs.slice(5);

    void (async () => {
      try {
        const {
          getCurrentRemoteUser,
          pullFinanceStateFromCloud,
          fetchUserSharedProjectsRemote,
        } = await import('../utils/cloudSync');
        const user = await getCurrentRemoteUser();
        if (!active || !user || user.id !== expectedUid || activeNamespaceRef.current !== bootNs) {
          return;
        }
        const [remotePayload, sharedBundles] = await Promise.all([
          pullFinanceStateFromCloud(),
          fetchUserSharedProjectsRemote(),
        ]);
        if (!active || activeNamespaceRef.current !== bootNs) return;

        setState((prev) => {
          let base = prev;
          if (
            remotePayload?.stateJson &&
            (!hadLocalRef.current || remotePayload.updatedAt > localUpdatedAtRef.current)
          ) {
            base = normalizeLoadedState(remotePayload.stateJson as Partial<FinanceState>);
            localUpdatedAtRef.current = remotePayload.updatedAt;
            hadLocalRef.current = true;
          }

          if (sharedBundles.length > 0) {
            const mergeById = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
              const map = new Map(existing.map((e) => [e.id, e]));
              for (const item of incoming) map.set(item.id, item);
              return Array.from(map.values());
            };
            let nextProjects = base.projects;
            let nextSupports = base.supports;
            let nextInventory = base.inventoryItems ?? [];
            let nextMembers = base.projectMembers ?? [];
            let nextTxs = base.transactions;
            for (const b of sharedBundles) {
              nextProjects = mergeById(nextProjects, [b.project]);
              nextSupports = mergeById(nextSupports, b.supports);
              nextInventory = mergeById(nextInventory, b.inventory);
              nextMembers = mergeById(nextMembers, b.members);
              nextTxs = mergeById(nextTxs, b.transactions);
            }
            base = {
              ...base,
              projects: nextProjects,
              supports: nextSupports,
              inventoryItems: nextInventory,
              projectMembers: nextMembers,
              transactions: nextTxs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
            };
          }

          return {
            ...base,
            settings: {
              ...base.settings,
              account: {
                ...DEFAULT_ACCOUNT_SECURITY,
                ...(base.settings.account ?? {}),
                mode: 'cloud_ready',
                remoteUserId: user.id,
                email: (user.email || base.settings.account?.email || '').trim().toLowerCase(),
                cloudProviderLabel: 'Supabase',
              },
            },
          };
        });
      } catch {
        // Reste fluide sur le cache local isolé du compte si réseau instable
      }
    })();

    return () => {
      active = false;
    };
  }, [initialBoot.namespace]);

  // Dual automatic backup strictement cloisonné par namespace (localStorage sync + IndexedDB async)
  useEffect(() => {
    if (activeNamespace !== activeNamespaceRef.current) return;

    const acc = state.settings.account;
    // Double verrou de sécurité anti-mélange entre profil local et comptes distants
    if (activeNamespace === 'local' && acc?.mode === 'cloud_ready' && acc?.remoteUserId) {
      return;
    }
    if (activeNamespace.startsWith('user:')) {
      const expectedUid = activeNamespace.slice(5);
      if (acc?.remoteUserId !== expectedUid) {
        return;
      }
    }

    const nowIso = new Date().toISOString();
    localUpdatedAtRef.current = nowIso;
    const payload = { updatedAt: nowIso, state };
    const lsOk = writeToLocalStorage(payload, activeNamespace);

    let cancelled = false;
    setPersistenceStatus((prev) => ({
      ...prev,
      localStorageOk: lsOk,
      lastSavedAt: nowIso,
    }));

    writeToIndexedDb(payload, activeNamespace).then((idbOk) => {
      if (cancelled) return;
      setPersistenceStatus((prev) => ({
        ...prev,
        indexedDbSynced: idbOk,
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [state, activeNamespace]);

  // Evaluate smart notifications whenever financial data or notification settings change, plus periodic 60s check for daily reminder time
  const syncNotificationsFromState = () => {
    setState((prev) => {
      const candidates = evaluateSmartNotifications(prev);
      const existing = prev.notifications ?? [];
      const dismissed = new Set(prev.dismissedNotificationKeys ?? []);
      const existingKeys = new Set(existing.map((n) => n.dedupeKey));

      const fresh = candidates.filter(
        (c) => !existingKeys.has(c.dedupeKey) && !dismissed.has(c.dedupeKey)
      );
      if (fresh.length === 0) return prev;

      const merged = [...fresh, ...existing].slice(0, 50);
      return {
        ...prev,
        notifications: merged,
      };
    });
  };

  useEffect(() => {
    syncNotificationsFromState();
  }, [
    state.internalLoans,
    state.debts,
    state.projects,
    state.inventoryItems,
    state.transactions,
    state.supports,
    state.settings.notifications,
    state.settings.displayCurrency,
  ]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      syncNotificationsFromState();
    }, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const metrics = useMemo(() => computeFinanceMetrics(state), [state]);

  const setPeriod = (period: TimePeriod) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, period },
    }));
  };

  const setDisplayCurrency = (displayCurrency: string) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, displayCurrency },
    }));
  };

  const upsertCurrency = (currency: CurrencyConfig) => {
    const code = currency.code.trim().toUpperCase();
    if (!code) return;
    setState((prev) => {
      const exists = prev.settings.currencies.some((c) => c.code === code);
      const nextCurrencies = exists
        ? prev.settings.currencies.map((c) => (c.code === code ? { ...currency, code } : c))
        : [...prev.settings.currencies, { ...currency, code }];
      return {
        ...prev,
        settings: { ...prev.settings, currencies: nextCurrencies },
      };
    });
  };

  const removeCurrency = (code: string) => {
    if (code === 'FBU') return;
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        displayCurrency: prev.settings.displayCurrency === code ? 'FBU' : prev.settings.displayCurrency,
        currencies: prev.settings.currencies.filter((c) => c.code !== code),
      },
    }));
  };

  const addSupport = (support: Omit<FundSupport, 'id'>): string => {
    const id = generateId('sup');
    setState((prev) => ({
      ...prev,
      supports: [...prev.supports, { ...support, id }],
    }));
    return id;
  };

  const updateSupport = (
    id: string,
    patch: Partial<Omit<FundSupport, 'id' | 'ownerType' | 'ownerId'>>
  ) => {
    setState((prev) => ({
      ...prev,
      supports: prev.supports.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  };

  const deleteSupport = (id: string) => {
    setState((prev) => ({
      ...prev,
      supports: prev.supports.filter((s) => s.id !== id),
    }));
  };

  const addProject = (input: ProjectFormInput): string => {
    const id = generateId('proj');
    const createdAt = getTodayISO();
    const newProject: Project = {
      id,
      name: input.name.trim(),
      category: input.category,
      customCategory: input.customCategory?.trim() || undefined,
      description: input.description?.trim() || undefined,
      revenueSources: input.revenueSources.filter(Boolean),
      expenseCategories: input.expenseCategories.filter(Boolean),
      createdAt,
      colorAccent: '#F5B971',
    };

    const initialSupports: FundSupport[] =
      input.initialSupports && input.initialSupports.length > 0
        ? input.initialSupports.map((s) => ({
            ...s,
            id: generateId('sup'),
            ownerType: 'project',
            ownerId: id,
          }))
        : [
            {
              id: generateId('sup'),
              ownerType: 'project',
              ownerId: id,
              type: SupportType.CASH,
              name: `Cash ${newProject.name}`,
              currency: 'FBU',
              balance: 0,
            },
          ];

    setState((prev) => ({
      ...prev,
      projects: [...prev.projects, newProject],
      supports: [...prev.supports, ...initialSupports],
    }));

    return id;
  };

  const getProjectRole = (projectId: string): ProjectRole => {
    const proj = state.projects.find((p) => p.id === projectId);
    return proj?.sharedAccessRole ?? 'owner';
  };

  const updateProject = (id: string, patch: Partial<Omit<Project, 'id' | 'createdAt'>>) => {
    setState((prev) => {
      const target = prev.projects.find((p) => p.id === id);
      if (target?.sharedAccessRole && target.sharedAccessRole !== 'owner') return prev;
      return {
        ...prev,
        projects: prev.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      };
    });
  };

  const deleteProject = (id: string) => {
    setState((prev) => {
      const target = prev.projects.find((p) => p.id === id);
      if (target?.sharedAccessRole && target.sharedAccessRole !== 'owner') return prev;
      return {
        ...prev,
        projects: prev.projects.filter((p) => p.id !== id),
        supports: prev.supports.filter((s) => !(s.ownerType === 'project' && s.ownerId === id)),
        inventoryItems: (prev.inventoryItems ?? []).filter((i) => i.projectId !== id),
        projectMembers: (prev.projectMembers ?? []).filter((m) => m.projectId !== id),
        internalLoans: prev.internalLoans.filter((l) => l.projectId !== id),
      };
    });
  };

  const addProjectTag = (projectId: string, kind: 'revenue' | 'expense', value: string) => {
    const clean = value.trim();
    if (!clean) return;
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => {
        if (p.id !== projectId) return p;
        if (p.sharedAccessRole === 'viewer') return p;
        if (kind === 'revenue') {
          if (p.revenueSources.includes(clean)) return p;
          return { ...p, revenueSources: [...p.revenueSources, clean] };
        }
        if (p.expenseCategories.includes(clean)) return p;
        return { ...p, expenseCategories: [...p.expenseCategories, clean] };
      }),
    }));
  };

  const upsertInventoryItem: FinanceContextValue['upsertInventoryItem'] = (input) => {
    const nowIso = new Date().toISOString();
    let savedItem: InventoryItem | null = null;
    let projectIsShared = false;

    setState((prev) => {
      const proj = prev.projects.find((p) => p.id === input.projectId);
      if (proj?.sharedAccessRole === 'viewer') return prev;
      projectIsShared = Boolean(proj?.isShared);

      const list = [...(prev.inventoryItems ?? [])];
      const cleanName = input.name.trim();
      if (!cleanName) return prev;

      const existingIdx = list.findIndex(
        (i) =>
          (input.id && i.id === input.id) ||
          (i.projectId === input.projectId &&
            i.name.trim().toLowerCase() === cleanName.toLowerCase())
      );

      if (existingIdx >= 0) {
        const current = list[existingIdx];
        const nextQty = Math.max(0, input.quantity);
        const deltaPurchased = Math.max(0, nextQty - current.quantity);
        const updated: InventoryItem = {
          ...current,
          name: cleanName,
          unit: input.unit.trim() || current.unit,
          quantity: nextQty,
          minStockThreshold: Math.max(0, input.minStockThreshold),
          averageUnitCostFbu: Math.max(0, Math.round(input.averageUnitCostFbu)),
          totalPurchasedQty: current.totalPurchasedQty + deltaPurchased,
          updatedAt: nowIso,
        };
        list[existingIdx] = updated;
        savedItem = updated;
      } else {
        const created: InventoryItem = {
          id: input.id || generateId('inv'),
          projectId: input.projectId,
          name: cleanName,
          unit: input.unit.trim() || 'pièce',
          quantity: Math.max(0, input.quantity),
          minStockThreshold: Math.max(0, input.minStockThreshold),
          averageUnitCostFbu: Math.max(0, Math.round(input.averageUnitCostFbu)),
          totalPurchasedQty: Math.max(0, input.quantity),
          totalSoldQty: 0,
          totalSalesRevenueFbu: 0,
          totalCogsFbu: 0,
          updatedAt: nowIso,
        };
        list.unshift(created);
        savedItem = created;
      }

      const nextQueue: SharedProjectSyncOp[] =
        projectIsShared && savedItem
          ? [
              ...(prev.pendingSyncQueue ?? []),
              {
                id: generateId('sync'),
                projectId: input.projectId,
                kind: 'upsert_inventory',
                payload: savedItem,
                createdAt: nowIso,
              },
            ]
          : prev.pendingSyncQueue ?? [];

      return {
        ...prev,
        inventoryItems: list,
        pendingSyncQueue: nextQueue,
      };
    });
  };

  const updateInventoryItem: FinanceContextValue['updateInventoryItem'] = (itemId, patch) => {
    const nowIso = new Date().toISOString();
    setState((prev) => {
      const list = prev.inventoryItems ?? [];
      const target = list.find((i) => i.id === itemId);
      if (!target) return prev;
      const proj = prev.projects.find((p) => p.id === target.projectId);
      if (proj?.sharedAccessRole === 'viewer') return prev;

      const cleanName = patch.name.trim() || target.name;
      const updated: InventoryItem = {
        ...target,
        name: cleanName,
        unit: patch.unit.trim() || target.unit,
        quantity: Math.max(0, patch.quantity),
        averageUnitCostFbu: Math.max(0, Math.round(patch.averageUnitCostFbu)),
        minStockThreshold: Math.max(0, patch.minStockThreshold),
        updatedAt: nowIso,
      };

      const nextQueue: SharedProjectSyncOp[] = proj?.isShared
        ? [
            ...(prev.pendingSyncQueue ?? []),
            {
              id: generateId('sync'),
              projectId: target.projectId,
              kind: 'upsert_inventory',
              payload: updated,
              createdAt: nowIso,
            },
          ]
        : prev.pendingSyncQueue ?? [];

      return {
        ...prev,
        inventoryItems: list.map((i) => (i.id === itemId ? updated : i)),
        pendingSyncQueue: nextQueue,
      };
    });
  };

  const updateInventoryThreshold = (itemId: string, minStockThreshold: number) => {
    const nowIso = new Date().toISOString();
    setState((prev) => {
      const list = prev.inventoryItems ?? [];
      const target = list.find((i) => i.id === itemId);
      if (!target) return prev;
      const proj = prev.projects.find((p) => p.id === target.projectId);
      if (proj?.sharedAccessRole === 'viewer') return prev;

      const updated: InventoryItem = {
        ...target,
        minStockThreshold: Math.max(0, minStockThreshold),
        updatedAt: nowIso,
      };

      const nextQueue: SharedProjectSyncOp[] = proj?.isShared
        ? [
            ...(prev.pendingSyncQueue ?? []),
            {
              id: generateId('sync'),
              projectId: target.projectId,
              kind: 'upsert_inventory',
              payload: updated,
              createdAt: nowIso,
            },
          ]
        : prev.pendingSyncQueue ?? [];

      return {
        ...prev,
        inventoryItems: list.map((i) => (i.id === itemId ? updated : i)),
        pendingSyncQueue: nextQueue,
      };
    });
  };

  const deleteInventoryItem = (itemId: string) => {
    setState((prev) => {
      const target = (prev.inventoryItems ?? []).find((i) => i.id === itemId);
      if (!target) return prev;
      const proj = prev.projects.find((p) => p.id === target.projectId);
      if (proj?.sharedAccessRole === 'viewer') return prev;
      return {
        ...prev,
        inventoryItems: (prev.inventoryItems ?? []).filter((i) => i.id !== itemId),
      };
    });
  };

  const normalizeDebtEntries = (item: DebtItem): DebtEntry[] => {
    if (Array.isArray(item.entries) && item.entries.length > 0) {
      return item.entries;
    }
    return [
      {
        id: `${item.id}_init`,
        amountFbu: Math.max(0, item.initialAmountFbu),
        currency: item.currency,
        date: item.date,
        note: item.note,
      },
    ];
  };

  const recomputeDebt = (item: DebtItem, nextEntries?: DebtEntry[]): DebtItem => {
    const entries = nextEntries ?? normalizeDebtEntries(item);
    const totalInitial = entries.reduce((sum, e) => sum + Math.max(0, e.amountFbu), 0);
    const totalRepaid = item.repayments.reduce((sum, r) => sum + Math.max(0, r.amountFbu), 0);
    const earliestDate = entries.reduce(
      (min, e) => (!min || (e.date && e.date < min) ? e.date : min),
      item.date
    );
    return {
      ...item,
      entries,
      date: earliestDate || item.date,
      initialAmountFbu: totalInitial,
      remainingAmountFbu: Math.max(0, totalInitial - totalRepaid),
    };
  };

  const adjustSupportBalanceList = (
    supports: FundSupport[],
    supportId: string | undefined,
    deltaFbu: number,
    currencies: CurrencyConfig[]
  ): FundSupport[] => {
    if (!supportId || deltaFbu === 0) return supports;
    return supports.map((s) => {
      if (s.id !== supportId) return s;
      const deltaInSupportCurr = convertFromFbu(deltaFbu, s.currency, currencies);
      const nextBal = Math.round((s.balance + deltaInSupportCurr) * 100) / 100;
      return { ...s, balance: nextBal };
    });
  };

  const reverseTransactionEffects = (prev: FinanceState, oldTx: Transaction): FinanceState => {
    const { currencies } = prev.settings;
    const nowIso = new Date().toISOString();
    let nextSupports = [...prev.supports];
    let nextSavings = [...prev.savingsGoals];
    let nextDebts = [...prev.debts];
    let nextLoans = [...prev.internalLoans];
    let nextInventory = [...(prev.inventoryItems ?? [])];

    const adjustSupport = (supportId: string | undefined, deltaFbu: number) => {
      nextSupports = adjustSupportBalanceList(nextSupports, supportId, deltaFbu, currencies);
    };

    if (oldTx.type === TransactionType.INFLOW) {
      adjustSupport(oldTx.supportId, -oldTx.amountInFbu);
    } else if (oldTx.type === TransactionType.OUTFLOW) {
      adjustSupport(oldTx.supportId, oldTx.amountInFbu);
    } else if (
      oldTx.type === TransactionType.TRANSFER ||
      oldTx.type === TransactionType.INTERNAL_LOAN ||
      oldTx.type === TransactionType.LOAN_REPAYMENT
    ) {
      adjustSupport(oldTx.supportId, oldTx.amountInFbu);
      if (oldTx.targetSupportId) {
        adjustSupport(oldTx.targetSupportId, -oldTx.amountInFbu);
      }
    }

    // Reverse stock purchases
    if (oldTx.stockPurchaseLines && oldTx.stockPurchaseLines.length > 0) {
      for (const line of oldTx.stockPurchaseLines) {
        nextInventory = nextInventory.map((item) => {
          const matches =
            (line.itemId && item.id === line.itemId) ||
            (oldTx.projectId &&
              item.projectId === oldTx.projectId &&
              item.name.trim().toLowerCase() === line.itemName.trim().toLowerCase());
          if (!matches) return item;
          const prevQty = Math.max(0, item.quantity - line.quantity);
          const currentValue = Math.max(0, item.quantity) * item.averageUnitCostFbu;
          const revertedValue = Math.max(0, currentValue - line.totalCostFbu);
          const prevAvg =
            prevQty > 0 ? Math.round(revertedValue / prevQty) : item.averageUnitCostFbu;
          return {
            ...item,
            quantity: prevQty,
            averageUnitCostFbu: prevAvg,
            totalPurchasedQty: Math.max(0, item.totalPurchasedQty - line.quantity),
            updatedAt: nowIso,
          };
        });
      }
    }

    // Reverse stock-linked sales
    if (oldTx.stockSaleLines && oldTx.stockSaleLines.length > 0) {
      const totalCogs = oldTx.stockSaleLines.reduce((acc, l) => acc + l.totalCostFbu, 0);
      const totalWeight = totalCogs > 0 ? totalCogs : oldTx.stockSaleLines.length;
      nextInventory = nextInventory.map((item) => {
        const matched = oldTx.stockSaleLines!.find((l) => l.itemId === item.id);
        if (!matched) return item;
        const revenueShare =
          oldTx.stockSaleLines!.length === 1
            ? oldTx.amountInFbu
            : totalCogs > 0
            ? Math.round((matched.totalCostFbu / totalWeight) * oldTx.amountInFbu)
            : Math.round(oldTx.amountInFbu / oldTx.stockSaleLines!.length);
        return {
          ...item,
          quantity: item.quantity + matched.quantity,
          totalSoldQty: Math.max(0, item.totalSoldQty - matched.quantity),
          totalCogsFbu: Math.max(0, item.totalCogsFbu - matched.totalCostFbu),
          totalSalesRevenueFbu: Math.max(0, item.totalSalesRevenueFbu - revenueShare),
          updatedAt: nowIso,
        };
      });
    }

    // Reverse savings pocket
    if (oldTx.pocket === 'savings' && oldTx.savingsGoalId) {
      const origDelta =
        oldTx.type === TransactionType.OUTFLOW ? -oldTx.amountInFbu : oldTx.amountInFbu;
      nextSavings = nextSavings.map((g) =>
        g.id === oldTx.savingsGoalId
          ? { ...g, currentAmountFbu: Math.max(0, g.currentAmountFbu - origDelta) }
          : g
      );
    }

    // Reverse debt repayment if recorded via QuickEntry
    if (oldTx.pocket === 'debt' && oldTx.debtId) {
      nextDebts = nextDebts.map((d) => {
        if (d.id !== oldTx.debtId) return d;
        const idx = d.repayments.findIndex(
          (r) =>
            r.date === oldTx.date &&
            Math.abs(r.amountFbu - oldTx.amountInFbu) <= 1 &&
            (r.supportId || '') === (oldTx.supportId || '')
        );
        if (idx < 0) return d;
        const nextRepayments = d.repayments.filter((_, i) => i !== idx);
        return recomputeDebt({ ...d, repayments: nextRepayments });
      });
    }

    // Reverse internal loan created by INTERNAL_LOAN tx
    if (oldTx.type === TransactionType.INTERNAL_LOAN) {
      const idx = nextLoans.findIndex(
        (l) =>
          l.projectId === oldTx.projectId &&
          l.fromSupportId === oldTx.supportId &&
          l.toSupportId === oldTx.targetSupportId &&
          l.date === oldTx.date &&
          Math.abs(l.initialAmountFbu - oldTx.amountInFbu) <= 1
      );
      if (idx >= 0) {
        nextLoans = nextLoans.filter((_, i) => i !== idx);
      }
    }

    return {
      ...prev,
      supports: nextSupports,
      savingsGoals: nextSavings,
      debts: nextDebts,
      internalLoans: nextLoans,
      inventoryItems: nextInventory,
    };
  };

  const applyQuickTransactionInput = (
    prev: FinanceState,
    input: QuickTransactionInput,
    existingMeta?: { id: string; createdAt: string }
  ): { nextState: FinanceState; tx: Transaction } => {
    const { currencies } = prev.settings;
    const targetProject =
      input.pocket === 'project' && input.projectId
        ? prev.projects.find((p) => p.id === input.projectId)
        : undefined;

    const amountInFbu = convertToFbu(input.amount, input.currency, currencies);
    const nowIso = new Date().toISOString();

    let nextSupports = [...prev.supports];
    let nextProjects = [...prev.projects];
    let nextSavings = [...prev.savingsGoals];
    let nextDebts = [...prev.debts];
    let nextLoans = [...prev.internalLoans];
    let nextInventory = [...(prev.inventoryItems ?? [])];

    const adjustSupport = (supportId: string, deltaFbu: number) => {
      nextSupports = adjustSupportBalanceList(nextSupports, supportId, deltaFbu, currencies);
    };

    if (input.type === TransactionType.INFLOW) {
      adjustSupport(input.supportId, amountInFbu);
    } else if (input.type === TransactionType.OUTFLOW) {
      adjustSupport(input.supportId, -amountInFbu);
    } else if (input.type === TransactionType.TRANSFER && input.targetSupportId) {
      adjustSupport(input.supportId, -amountInFbu);
      adjustSupport(input.targetSupportId, amountInFbu);
    } else if (
      input.type === TransactionType.INTERNAL_LOAN &&
      input.targetSupportId &&
      input.projectId
    ) {
      adjustSupport(input.supportId, -amountInFbu);
      adjustSupport(input.targetSupportId, amountInFbu);
      const loan: InternalLoan = {
        id: generateId('loan'),
        projectId: input.projectId,
        fromSupportId: input.supportId,
        toSupportId: input.targetSupportId,
        initialAmountFbu: amountInFbu,
        remainingAmountFbu: amountInFbu,
        date: input.date,
        reminderDate: input.reminderDate || undefined,
        reminderDelayDays: input.reminderDelayDays || undefined,
        note: input.label || input.note,
        status: 'active',
        repayments: [],
      };
      nextLoans = [loan, ...nextLoans];
    }

    // Sync project tag if new
    if (input.pocket === 'project' && input.projectId && input.categoryOrSource) {
      const tag = input.categoryOrSource.trim();
      nextProjects = nextProjects.map((p) => {
        if (p.id !== input.projectId) return p;
        if (input.type === TransactionType.INFLOW && !p.revenueSources.includes(tag)) {
          return { ...p, revenueSources: [...p.revenueSources, tag] };
        }
        if (input.type === TransactionType.OUTFLOW && !p.expenseCategories.includes(tag)) {
          return { ...p, expenseCategories: [...p.expenseCategories, tag] };
        }
        return p;
      });
    }

    // Handle project inventory updates for stock purchase or stock-linked sale
    let resolvedPurchaseLines: StockPurchaseLine[] | undefined;
    let resolvedSaleLines: StockSaleLine[] | undefined;
    let cogsFbu = 0;
    let grossMarginFbu: number | undefined;

    if (
      input.pocket === 'project' &&
      input.projectId &&
      input.type === TransactionType.OUTFLOW &&
      input.outflowNature === 'stock_purchase' &&
      input.stockPurchaseLines &&
      input.stockPurchaseLines.length > 0
    ) {
      resolvedPurchaseLines = input.stockPurchaseLines
        .filter((line) => line.itemName.trim() && line.quantity > 0)
        .map((line) => {
          const cleanName = line.itemName.trim();
          const lineTotalFbu = Math.max(
            0,
            Math.round(line.totalCostFbu || line.quantity * line.unitCostFbu)
          );
          const lineUnitFbu =
            line.quantity > 0
              ? Math.round(lineTotalFbu / line.quantity)
              : Math.round(line.unitCostFbu);

          const idx = nextInventory.findIndex(
            (item) =>
              (line.itemId && item.id === line.itemId) ||
              (item.projectId === input.projectId &&
                item.name.trim().toLowerCase() === cleanName.toLowerCase())
          );

          let resolvedId: string;
          if (idx >= 0) {
            const existing = nextInventory[idx];
            const newQty = existing.quantity + line.quantity;
            const newAvgCost =
              newQty > 0
                ? Math.round(
                    (Math.max(0, existing.quantity) * existing.averageUnitCostFbu +
                      lineTotalFbu) /
                      newQty
                  )
                : lineUnitFbu;
            nextInventory[idx] = {
              ...existing,
              unit: line.unit.trim() || existing.unit,
              quantity: newQty,
              averageUnitCostFbu: newAvgCost,
              totalPurchasedQty: existing.totalPurchasedQty + line.quantity,
              minStockThreshold:
                line.minStockThreshold !== undefined
                  ? line.minStockThreshold
                  : existing.minStockThreshold,
              updatedAt: nowIso,
            };
            resolvedId = existing.id;
          } else {
            resolvedId = generateId('inv');
            nextInventory = [
              {
                id: resolvedId,
                projectId: input.projectId!,
                name: cleanName,
                unit: line.unit.trim() || 'pièce',
                quantity: line.quantity,
                minStockThreshold: line.minStockThreshold ?? 5,
                averageUnitCostFbu: lineUnitFbu,
                totalPurchasedQty: line.quantity,
                totalSoldQty: 0,
                totalSalesRevenueFbu: 0,
                totalCogsFbu: 0,
                updatedAt: nowIso,
              },
              ...nextInventory,
            ];
          }

          return {
            ...line,
            itemId: resolvedId,
            itemName: cleanName,
            unit: line.unit.trim() || 'pièce',
            unitCostFbu: lineUnitFbu,
            totalCostFbu: lineTotalFbu,
          };
        });
    }

    if (
      input.pocket === 'project' &&
      input.projectId &&
      input.type === TransactionType.INFLOW &&
      input.stockSaleLines &&
      input.stockSaleLines.length > 0
    ) {
      const preparedLines = input.stockSaleLines
        .filter((l) => l.itemId && l.quantity > 0)
        .map((l) => {
          const inv = nextInventory.find((item) => item.id === l.itemId);
          const unitCostFbu = inv ? inv.averageUnitCostFbu : l.unitCostFbu;
          const totalCostFbu = Math.round(l.quantity * unitCostFbu);
          return {
            ...l,
            itemName: inv?.name || l.itemName,
            unit: inv?.unit || l.unit,
            unitCostFbu,
            totalCostFbu,
          };
        });

      if (preparedLines.length > 0) {
        resolvedSaleLines = preparedLines;
        cogsFbu = preparedLines.reduce((acc, l) => acc + l.totalCostFbu, 0);
        grossMarginFbu = amountInFbu - cogsFbu;

        const totalWeight = cogsFbu > 0 ? cogsFbu : preparedLines.length;
        nextInventory = nextInventory.map((item) => {
          const matched = preparedLines.find((l) => l.itemId === item.id);
          if (!matched) return item;
          const revenueShare =
            preparedLines.length === 1
              ? amountInFbu
              : cogsFbu > 0
              ? Math.round((matched.totalCostFbu / totalWeight) * amountInFbu)
              : Math.round(amountInFbu / preparedLines.length);
          return {
            ...item,
            quantity: Math.max(0, item.quantity - matched.quantity),
            totalSoldQty: item.totalSoldQty + matched.quantity,
            totalCogsFbu: item.totalCogsFbu + matched.totalCostFbu,
            totalSalesRevenueFbu: item.totalSalesRevenueFbu + revenueShare,
            updatedAt: nowIso,
          };
        });
      }
    }

    // Sync savings goal if selected
    if (input.pocket === 'savings' && input.savingsGoalId) {
      const delta = input.type === TransactionType.OUTFLOW ? -amountInFbu : amountInFbu;
      nextSavings = nextSavings.map((g) =>
        g.id === input.savingsGoalId
          ? { ...g, currentAmountFbu: Math.max(0, g.currentAmountFbu + delta) }
          : g
      );
    }

    // Sync debt repayment if selected
    if (input.pocket === 'debt' && input.debtId) {
      nextDebts = nextDebts.map((d) => {
        if (d.id !== input.debtId) return d;
        const paid = Math.min(d.remainingAmountFbu, amountInFbu);
        return recomputeDebt({
          ...d,
          repayments: [
            {
              id: generateId('drep'),
              amountFbu: paid,
              date: input.date,
              supportId: input.supportId,
              note: input.label || input.note,
            },
            ...d.repayments,
          ],
        });
      });
    }

    const account = prev.settings.account;
    const authorName = account?.displayName?.trim() || 'Moi';
    const authorRole: ProjectRole = targetProject?.sharedAccessRole ?? 'owner';

    const tx: Transaction = {
      id: existingMeta?.id || generateId('tx'),
      type: input.type,
      pocket: input.pocket,
      projectId: input.projectId,
      savingsGoalId: input.savingsGoalId,
      debtId: input.debtId,
      supportId: input.supportId,
      targetSupportId: input.targetSupportId,
      amount: input.amount,
      currency: input.currency,
      amountInFbu,
      paymentMethod: input.paymentMethod,
      date: input.date,
      label: input.label.trim() || 'Opération',
      categoryOrSource: input.categoryOrSource,
      note: input.note?.trim() || undefined,
      outflowNature:
        input.pocket === 'project' && input.type === TransactionType.OUTFLOW
          ? input.outflowNature || 'operating_expense'
          : undefined,
      stockPurchaseLines: resolvedPurchaseLines,
      stockSaleLines: resolvedSaleLines,
      cogsFbu: resolvedSaleLines ? cogsFbu : undefined,
      grossMarginFbu,
      authorName,
      authorInitials: getInitials(authorName),
      authorRole,
      createdAt: existingMeta?.createdAt || nowIso,
    };

    const nextQueue: SharedProjectSyncOp[] =
      targetProject?.isShared && targetProject.id
        ? [
            ...(prev.pendingSyncQueue ?? []),
            {
              id: generateId('sync'),
              projectId: targetProject.id,
              kind: 'insert_transaction',
              payload: tx,
              createdAt: nowIso,
            },
          ]
        : prev.pendingSyncQueue ?? [];

    return {
      tx,
      nextState: {
        ...prev,
        supports: nextSupports,
        projects: nextProjects,
        inventoryItems: nextInventory,
        pendingSyncQueue: nextQueue,
        savingsGoals: nextSavings,
        debts: nextDebts,
        internalLoans: nextLoans,
      },
    };
  };

  const addQuickTransaction = (input: QuickTransactionInput) => {
    setState((prev) => {
      const targetProject =
        input.pocket === 'project' && input.projectId
          ? prev.projects.find((p) => p.id === input.projectId)
          : undefined;
      if (targetProject?.sharedAccessRole === 'viewer') return prev;

      const { nextState, tx } = applyQuickTransactionInput(prev, input);
      return {
        ...nextState,
        transactions: [tx, ...prev.transactions],
      };
    });
  };

  const updateQuickTransaction: FinanceContextValue['updateQuickTransaction'] = (
    txId,
    input
  ) => {
    setState((prev) => {
      const oldTx = prev.transactions.find((t) => t.id === txId);
      if (!oldTx) return prev;

      if (oldTx.projectId) {
        const oldProj = prev.projects.find((p) => p.id === oldTx.projectId);
        if (oldProj?.sharedAccessRole === 'viewer') return prev;
      }
      if (input.pocket === 'project' && input.projectId) {
        const newProj = prev.projects.find((p) => p.id === input.projectId);
        if (newProj?.sharedAccessRole === 'viewer') return prev;
      }

      const reverted = reverseTransactionEffects(prev, oldTx);
      const { nextState, tx: updatedTx } = applyQuickTransactionInput(reverted, input, {
        id: oldTx.id,
        createdAt: oldTx.createdAt,
      });

      const mergedTx: Transaction = {
        ...updatedTx,
        authorUserId: oldTx.authorUserId ?? updatedTx.authorUserId,
        authorName: oldTx.authorName || updatedTx.authorName,
        authorInitials: oldTx.authorInitials || updatedTx.authorInitials,
        authorRole: oldTx.authorRole ?? updatedTx.authorRole,
      };

      return {
        ...nextState,
        transactions: prev.transactions.map((t) => (t.id === txId ? mergedTx : t)),
      };
    });
  };

  const deleteTransaction = (id: string) => {
    setState((prev) => {
      const target = prev.transactions.find((t) => t.id === id);
      if (!target) return prev;
      if (target.projectId) {
        const proj = prev.projects.find((p) => p.id === target.projectId);
        if (proj?.sharedAccessRole && proj.sharedAccessRole !== 'owner') {
          return prev;
        }
      }
      const reverted = reverseTransactionEffects(prev, target);
      return {
        ...reverted,
        transactions: prev.transactions.filter((t) => t.id !== id),
      };
    });
  };

  const createInternalLoan: FinanceContextValue['createInternalLoan'] = ({
    projectId,
    fromSupportId,
    toSupportId,
    amount,
    currency,
    date,
    reminderDate,
    reminderDelayDays,
    note,
  }) => {
    const project = state.projects.find((p) => p.id === projectId);
    addQuickTransaction({
      type: TransactionType.INTERNAL_LOAN,
      pocket: 'project',
      projectId,
      supportId: fromSupportId,
      targetSupportId: toSupportId,
      amount,
      currency,
      paymentMethod: PaymentMethod.BANQUE,
      date,
      reminderDate,
      reminderDelayDays,
      label: note?.trim() || `Prêt interne vers ${project?.name ?? 'Projet'}`,
      note,
    });
  };

  const updateInternalLoan: FinanceContextValue['updateInternalLoan'] = (loanId, patch) => {
    setState((prev) => {
      const { currencies } = prev.settings;
      const loan = prev.internalLoans.find((l) => l.id === loanId);
      if (!loan) return prev;
      const proj = prev.projects.find((p) => p.id === loan.projectId);
      if (proj?.sharedAccessRole && proj.sharedAccessRole !== 'owner') return prev;

      const nextInitial =
        patch.initialAmountFbu !== undefined && patch.initialAmountFbu > 0
          ? Math.round(patch.initialAmountFbu)
          : loan.initialAmountFbu;
      const deltaInitial = nextInitial - loan.initialAmountFbu;
      const repaidTotal = loan.repayments.reduce((s, r) => s + r.amountFbu, 0);
      const nextRemaining = Math.max(0, nextInitial - repaidTotal);

      let nextSupports = prev.supports;
      if (deltaInitial !== 0) {
        nextSupports = adjustSupportBalanceList(
          nextSupports,
          loan.fromSupportId,
          -deltaInitial,
          currencies
        );
        nextSupports = adjustSupportBalanceList(
          nextSupports,
          loan.toSupportId,
          deltaInitial,
          currencies
        );
      }

      const nextLoans = prev.internalLoans.map((l) =>
        l.id === loanId
          ? {
              ...l,
              initialAmountFbu: nextInitial,
              remainingAmountFbu: nextRemaining,
              status: (nextRemaining <= 0 ? 'repaid' : 'active') as 'active' | 'repaid',
              note: patch.note !== undefined ? patch.note.trim() || undefined : l.note,
              reminderDate:
                patch.reminderDate !== undefined
                  ? patch.reminderDate || undefined
                  : l.reminderDate,
              reminderDelayDays:
                patch.reminderDelayDays !== undefined
                  ? patch.reminderDelayDays || undefined
                  : l.reminderDelayDays,
            }
          : l
      );

      return {
        ...prev,
        supports: nextSupports,
        internalLoans: nextLoans,
      };
    });
  };

  const repayInternalLoan: FinanceContextValue['repayInternalLoan'] = ({
    loanId,
    amountFbu,
    fromSupportId,
    toSupportId,
    date,
  }) => {
    if (amountFbu <= 0) return;
    setState((prev) => {
      const { currencies } = prev.settings;
      const loan = prev.internalLoans.find((l) => l.id === loanId);
      if (!loan) return prev;

      const appliedFbu = Math.min(loan.remainingAmountFbu, amountFbu);
      const nextRemaining = Math.max(0, loan.remainingAmountFbu - appliedFbu);

      const nextSupports = prev.supports.map((s) => {
        if (s.id === fromSupportId) {
          const delta = convertFromFbu(appliedFbu, s.currency, currencies);
          return { ...s, balance: Math.round((s.balance - delta) * 100) / 100 };
        }
        if (s.id === toSupportId) {
          const delta = convertFromFbu(appliedFbu, s.currency, currencies);
          return { ...s, balance: Math.round((s.balance + delta) * 100) / 100 };
        }
        return s;
      });

      const nextLoans = prev.internalLoans.map((l) =>
        l.id === loanId
          ? {
              ...l,
              remainingAmountFbu: nextRemaining,
              status: (nextRemaining <= 0 ? 'repaid' : 'active') as 'active' | 'repaid',
              repayments: [
                {
                  id: generateId('lrep'),
                  amountFbu: appliedFbu,
                  date,
                  fromSupportId,
                  toSupportId,
                },
                ...l.repayments,
              ],
            }
          : l
      );

      const project = prev.projects.find((p) => p.id === loan.projectId);
      const tx: Transaction = {
        id: generateId('tx'),
        type: TransactionType.LOAN_REPAYMENT,
        pocket: 'project',
        projectId: loan.projectId,
        supportId: fromSupportId,
        targetSupportId: toSupportId,
        amount: appliedFbu,
        currency: 'FBU',
        amountInFbu: appliedFbu,
        paymentMethod: PaymentMethod.BANQUE,
        date,
        label: `Remboursement prêt interne (${project?.name ?? 'Projet'} → Perso)`,
        createdAt: new Date().toISOString(),
      };

      return {
        ...prev,
        supports: nextSupports,
        internalLoans: nextLoans,
        transactions: [tx, ...prev.transactions],
      };
    });
  };

  const addDebt: FinanceContextValue['addDebt'] = (input) => {
    const firstEntry: DebtEntry = {
      id: generateId('dent'),
      amountFbu: input.initialAmountFbu,
      currency: input.currency,
      date: input.date,
      supportId: input.supportId || undefined,
      note: input.note?.trim() || undefined,
    };
    const debt: DebtItem = {
      id: generateId(input.direction === 'debt' ? 'debt' : 'rec'),
      direction: input.direction,
      personName: input.personName.trim(),
      initialAmountFbu: input.initialAmountFbu,
      remainingAmountFbu: input.initialAmountFbu,
      currency: input.currency,
      date: input.date,
      dueDate: input.dueDate || undefined,
      note: input.note?.trim() || undefined,
      entries: [firstEntry],
      repayments: [],
    };
    setState((prev) => {
      const { currencies } = prev.settings;
      let nextSupports = prev.supports;
      if (input.supportId) {
        const deltaFbu =
          input.direction === 'debt' ? input.initialAmountFbu : -input.initialAmountFbu;
        nextSupports = adjustSupportBalanceList(
          nextSupports,
          input.supportId,
          deltaFbu,
          currencies
        );
      }
      return {
        ...prev,
        supports: nextSupports,
        debts: [debt, ...prev.debts],
      };
    });
  };

  const addDebtEntry: FinanceContextValue['addDebtEntry'] = ({
    debtId,
    amountFbu,
    currency,
    date,
    note,
    supportId,
  }) => {
    if (amountFbu <= 0) return;
    setState((prev) => {
      const { currencies } = prev.settings;
      const target = prev.debts.find((d) => d.id === debtId);
      if (!target) return prev;

      const newEntry: DebtEntry = {
        id: generateId('dent'),
        amountFbu: Math.round(amountFbu),
        currency: currency || target.currency,
        date,
        supportId: supportId || undefined,
        note: note?.trim() || undefined,
      };

      const nextDebts = prev.debts.map((d) => {
        if (d.id !== debtId) return d;
        const existingEntries = normalizeDebtEntries(d);
        return recomputeDebt(d, [newEntry, ...existingEntries]);
      });

      let nextSupports = prev.supports;
      if (supportId) {
        const deltaFbu = target.direction === 'debt' ? amountFbu : -amountFbu;
        nextSupports = adjustSupportBalanceList(
          nextSupports,
          supportId,
          deltaFbu,
          currencies
        );
      }

      return {
        ...prev,
        supports: nextSupports,
        debts: nextDebts,
      };
    });
  };

  const updateDebt: FinanceContextValue['updateDebt'] = (debtId, patch) => {
    setState((prev) => ({
      ...prev,
      debts: prev.debts.map((d) => {
        if (d.id !== debtId) return d;
        const updated: DebtItem = {
          ...d,
          personName:
            patch.personName !== undefined
              ? patch.personName.trim() || d.personName
              : d.personName,
          direction: patch.direction ?? d.direction,
          dueDate:
            patch.dueDate !== undefined ? patch.dueDate || undefined : d.dueDate,
          note: patch.note !== undefined ? patch.note.trim() || undefined : d.note,
          currency: patch.currency || d.currency,
        };
        return recomputeDebt(updated);
      }),
    }));
  };

  const updateDebtEntry: FinanceContextValue['updateDebtEntry'] = (
    debtId,
    entryId,
    patch
  ) => {
    if (patch.amountFbu <= 0) return;
    setState((prev) => {
      const { currencies } = prev.settings;
      const target = prev.debts.find((d) => d.id === debtId);
      if (!target) return prev;

      const entries = normalizeDebtEntries(target);
      const oldEntry = entries.find((e) => e.id === entryId);
      if (!oldEntry) return prev;

      let nextSupports = prev.supports;
      // Reverse old entry support impact
      if (oldEntry.supportId) {
        const reverseDelta =
          target.direction === 'debt' ? -oldEntry.amountFbu : oldEntry.amountFbu;
        nextSupports = adjustSupportBalanceList(
          nextSupports,
          oldEntry.supportId,
          reverseDelta,
          currencies
        );
      }
      // Apply new entry support impact
      const nextSupportId =
        patch.supportId !== undefined ? patch.supportId || undefined : oldEntry.supportId;
      const cleanAmt = Math.round(patch.amountFbu);
      if (nextSupportId) {
        const applyDelta = target.direction === 'debt' ? cleanAmt : -cleanAmt;
        nextSupports = adjustSupportBalanceList(
          nextSupports,
          nextSupportId,
          applyDelta,
          currencies
        );
      }

      const nextEntries = entries.map((e) =>
        e.id === entryId
          ? {
              ...e,
              amountFbu: cleanAmt,
              date: patch.date || e.date,
              note: patch.note !== undefined ? patch.note.trim() || undefined : e.note,
              supportId: nextSupportId,
            }
          : e
      );

      return {
        ...prev,
        supports: nextSupports,
        debts: prev.debts.map((d) => (d.id === debtId ? recomputeDebt(d, nextEntries) : d)),
      };
    });
  };

  const deleteDebtEntry: FinanceContextValue['deleteDebtEntry'] = (debtId, entryId) => {
    setState((prev) => {
      const { currencies } = prev.settings;
      const target = prev.debts.find((d) => d.id === debtId);
      if (!target) return prev;

      const entries = normalizeDebtEntries(target);
      const oldEntry = entries.find((e) => e.id === entryId);
      if (!oldEntry) return prev;

      let nextSupports = prev.supports;
      if (oldEntry.supportId) {
        const reverseDelta =
          target.direction === 'debt' ? -oldEntry.amountFbu : oldEntry.amountFbu;
        nextSupports = adjustSupportBalanceList(
          nextSupports,
          oldEntry.supportId,
          reverseDelta,
          currencies
        );
      }

      const nextEntries = entries.filter((e) => e.id !== entryId);
      if (nextEntries.length === 0) {
        return {
          ...prev,
          supports: nextSupports,
          debts: prev.debts.filter((d) => d.id !== debtId),
        };
      }

      return {
        ...prev,
        supports: nextSupports,
        debts: prev.debts.map((d) => (d.id === debtId ? recomputeDebt(d, nextEntries) : d)),
      };
    });
  };

  const repayDebt: FinanceContextValue['repayDebt'] = ({
    debtId,
    amountFbu,
    date,
    supportId,
    note,
  }) => {
    if (amountFbu <= 0) return;
    setState((prev) => {
      const { currencies } = prev.settings;
      const targetDebt = prev.debts.find((d) => d.id === debtId);
      if (!targetDebt) return prev;

      const applied = Math.min(targetDebt.remainingAmountFbu, Math.round(amountFbu));
      if (applied <= 0) return prev;

      const nextDebts = prev.debts.map((d) => {
        if (d.id !== debtId) return d;
        return recomputeDebt({
          ...d,
          repayments: [
            {
              id: generateId('drep'),
              amountFbu: applied,
              date,
              supportId: supportId || undefined,
              note: note?.trim() || undefined,
            },
            ...d.repayments,
          ],
        });
      });

      let nextSupports = prev.supports;
      let nextTransactions = prev.transactions;

      if (supportId) {
        const deltaFbu = targetDebt.direction === 'debt' ? -applied : applied;
        nextSupports = adjustSupportBalanceList(
          nextSupports,
          supportId,
          deltaFbu,
          currencies
        );

        const tx: Transaction = {
          id: generateId('tx'),
          type:
            targetDebt.direction === 'debt'
              ? TransactionType.OUTFLOW
              : TransactionType.INFLOW,
          pocket: 'debt',
          debtId,
          supportId,
          amount: applied,
          currency: 'FBU',
          amountInFbu: applied,
          paymentMethod: PaymentMethod.CASH,
          date,
          label:
            targetDebt.direction === 'debt'
              ? `Remboursement dette — ${targetDebt.personName}`
              : `Encaissement créance — ${targetDebt.personName}`,
          note: note?.trim() || undefined,
          createdAt: new Date().toISOString(),
        };
        nextTransactions = [tx, ...prev.transactions];
      }

      return {
        ...prev,
        debts: nextDebts,
        supports: nextSupports,
        transactions: nextTransactions,
      };
    });
  };

  const updateDebtRepayment: FinanceContextValue['updateDebtRepayment'] = (
    debtId,
    repaymentId,
    patch
  ) => {
    if (patch.amountFbu <= 0) return;
    setState((prev) => {
      const { currencies } = prev.settings;
      const targetDebt = prev.debts.find((d) => d.id === debtId);
      if (!targetDebt) return prev;
      const oldRep = targetDebt.repayments.find((r) => r.id === repaymentId);
      if (!oldRep) return prev;

      const cleanAmt = Math.round(patch.amountFbu);
      let nextSupports = prev.supports;

      if (oldRep.supportId) {
        const revDelta =
          targetDebt.direction === 'debt' ? oldRep.amountFbu : -oldRep.amountFbu;
        nextSupports = adjustSupportBalanceList(
          nextSupports,
          oldRep.supportId,
          revDelta,
          currencies
        );
      }

      const nextSupportId =
        patch.supportId !== undefined ? patch.supportId || undefined : oldRep.supportId;
      if (nextSupportId) {
        const applyDelta = targetDebt.direction === 'debt' ? -cleanAmt : cleanAmt;
        nextSupports = adjustSupportBalanceList(
          nextSupports,
          nextSupportId,
          applyDelta,
          currencies
        );
      }

      const nextRepayments = targetDebt.repayments.map((r) =>
        r.id === repaymentId
          ? {
              ...r,
              amountFbu: cleanAmt,
              date: patch.date || r.date,
              supportId: nextSupportId,
              note: patch.note !== undefined ? patch.note.trim() || undefined : r.note,
            }
          : r
      );

      return {
        ...prev,
        supports: nextSupports,
        debts: prev.debts.map((d) =>
          d.id === debtId ? recomputeDebt({ ...d, repayments: nextRepayments }) : d
        ),
      };
    });
  };

  const deleteDebtRepayment: FinanceContextValue['deleteDebtRepayment'] = (
    debtId,
    repaymentId
  ) => {
    setState((prev) => {
      const { currencies } = prev.settings;
      const targetDebt = prev.debts.find((d) => d.id === debtId);
      if (!targetDebt) return prev;
      const oldRep = targetDebt.repayments.find((r) => r.id === repaymentId);
      if (!oldRep) return prev;

      let nextSupports = prev.supports;
      if (oldRep.supportId) {
        const revDelta =
          targetDebt.direction === 'debt' ? oldRep.amountFbu : -oldRep.amountFbu;
        nextSupports = adjustSupportBalanceList(
          nextSupports,
          oldRep.supportId,
          revDelta,
          currencies
        );
      }

      const nextRepayments = targetDebt.repayments.filter((r) => r.id !== repaymentId);
      return {
        ...prev,
        supports: nextSupports,
        debts: prev.debts.map((d) =>
          d.id === debtId ? recomputeDebt({ ...d, repayments: nextRepayments }) : d
        ),
      };
    });
  };

  const deleteDebt = (id: string) => {
    setState((prev) => ({
      ...prev,
      debts: prev.debts.filter((d) => d.id !== id),
    }));
  };

  const addSavingsGoal: FinanceContextValue['addSavingsGoal'] = (input) => {
    const goal: SavingsGoal = {
      id: generateId('sav'),
      name: input.name.trim(),
      targetAmountFbu: input.targetAmountFbu,
      currentAmountFbu: input.currentAmountFbu,
      linkedSupportId: input.linkedSupportId || undefined,
      deadline: input.deadline || undefined,
      note: input.note?.trim() || undefined,
      createdAt: getTodayISO(),
    };
    setState((prev) => ({
      ...prev,
      savingsGoals: [goal, ...prev.savingsGoals],
    }));
  };

  const updateSavingsGoal: FinanceContextValue['updateSavingsGoal'] = (id, patch) => {
    setState((prev) => ({
      ...prev,
      savingsGoals: prev.savingsGoals.map((g) =>
        g.id === id
          ? {
              ...g,
              name: patch.name.trim() || g.name,
              targetAmountFbu: Math.max(1, Math.round(patch.targetAmountFbu)),
              currentAmountFbu: Math.max(0, Math.round(patch.currentAmountFbu)),
              note: patch.note !== undefined ? patch.note.trim() || undefined : g.note,
              deadline:
                patch.deadline !== undefined ? patch.deadline || undefined : g.deadline,
            }
          : g
      ),
    }));
  };

  const adjustSavingsGoal: FinanceContextValue['adjustSavingsGoal'] = ({
    goalId,
    deltaFbu,
    supportId,
    date,
    note,
  }) => {
    if (deltaFbu === 0) return;
    setState((prev) => {
      const { currencies } = prev.settings;
      const goal = prev.savingsGoals.find((g) => g.id === goalId);
      if (!goal) return prev;

      const nextGoals = prev.savingsGoals.map((g) =>
        g.id === goalId
          ? { ...g, currentAmountFbu: Math.max(0, g.currentAmountFbu + deltaFbu) }
          : g
      );

      let nextSupports = prev.supports;
      let nextTransactions = prev.transactions;

      if (supportId) {
        nextSupports = prev.supports.map((s) => {
          if (s.id !== supportId) return s;
          const delta = convertFromFbu(deltaFbu, s.currency, currencies);
          return { ...s, balance: Math.round((s.balance + delta) * 100) / 100 };
        });

        const tx: Transaction = {
          id: generateId('tx'),
          type: deltaFbu > 0 ? TransactionType.INFLOW : TransactionType.OUTFLOW,
          pocket: 'savings',
          savingsGoalId: goalId,
          supportId,
          amount: Math.abs(deltaFbu),
          currency: 'FBU',
          amountInFbu: Math.abs(deltaFbu),
          paymentMethod: PaymentMethod.BANQUE,
          date,
          label: `${deltaFbu > 0 ? 'Dépôt' : 'Retrait'} épargne — ${goal.name}`,
          note: note?.trim() || undefined,
          createdAt: new Date().toISOString(),
        };
        nextTransactions = [tx, ...prev.transactions];
      }

      return {
        ...prev,
        savingsGoals: nextGoals,
        supports: nextSupports,
        transactions: nextTransactions,
      };
    });
  };

  const deleteSavingsGoal = (id: string) => {
    setState((prev) => ({
      ...prev,
      savingsGoals: prev.savingsGoals.filter((g) => g.id !== id),
    }));
  };

  const sendChatMessage = (content: string) => {
    const clean = content.trim();
    if (!clean) return;
    setState((prev) => {
      const userMsg: ChatMessage = {
        id: generateId('msg'),
        role: 'user',
        content: clean,
        timestamp: new Date().toISOString(),
      };
      const replyText = answerCoachQuestion(clean, prev);
      const assistantMsg: ChatMessage = {
        id: generateId('msg'),
        role: 'assistant',
        content: replyText,
        timestamp: new Date().toISOString(),
      };
      return {
        ...prev,
        chatHistory: [...prev.chatHistory, userMsg, assistantMsg],
      };
    });
  };

  const clearChatHistory = () => {
    setState((prev) => ({ ...prev, chatHistory: [] }));
  };

  const exportJson = (): string => JSON.stringify(state, null, 2);

  const importJson = (raw: string): { ok: boolean; error?: string } => {
    try {
      const parsed = JSON.parse(raw) as FinanceState;
      if (!parsed || !parsed.settings || !Array.isArray(parsed.supports)) {
        return { ok: false, error: 'Format JSON TOMI invalide.' };
      }
      const normalized = normalizeLoadedState(parsed);
      setState((prev) => {
        const currentNs = activeNamespaceRef.current;
        if (currentNs.startsWith('user:') && prev.settings.account?.remoteUserId) {
          return {
            ...normalized,
            settings: {
              ...normalized.settings,
              account: {
                ...DEFAULT_ACCOUNT_SECURITY,
                ...(normalized.settings.account ?? {}),
                mode: 'cloud_ready',
                remoteUserId: prev.settings.account.remoteUserId,
                email: prev.settings.account.email,
                displayName:
                  normalized.settings.account?.displayName ||
                  prev.settings.account.displayName ||
                  DEFAULT_ACCOUNT_SECURITY.displayName,
                cloudProviderLabel: 'Supabase',
              },
            },
          };
        }
        return {
          ...normalized,
          settings: {
            ...normalized.settings,
            account: {
              ...DEFAULT_ACCOUNT_SECURITY,
              ...(normalized.settings.account ?? {}),
              mode:
                normalized.settings.account?.mode === 'cloud_ready'
                  ? 'local_profile'
                  : normalized.settings.account?.mode || 'local_profile',
              displayName:
                normalized.settings.account?.displayName ||
                DEFAULT_ACCOUNT_SECURITY.displayName,
              remoteUserId: undefined,
            },
          },
        };
      });
      return { ok: true };
    } catch {
      return { ok: false, error: 'Impossible de lire ce fichier JSON.' };
    }
  };

  const resetToStarter = () => {
    setState((prev) => {
      const starter = createStarterFinanceState();
      const currentNs = activeNamespaceRef.current;
      if (currentNs.startsWith('user:') && prev.settings.account?.remoteUserId) {
        return {
          ...starter,
          settings: {
            ...starter.settings,
            account: prev.settings.account,
          },
        };
      }
      return {
        ...starter,
        settings: {
          ...starter.settings,
          account: {
            ...(prev.settings.account ?? DEFAULT_ACCOUNT_SECURITY),
            mode:
              prev.settings.account?.mode === 'cloud_ready'
                ? 'local_profile'
                : prev.settings.account?.mode || 'local_profile',
            remoteUserId: undefined,
          },
        },
      };
    });
  };

  const resetToEmpty = () => {
    setState((prev) => {
      const empty = createCleanRemoteState();
      const currentNs = activeNamespaceRef.current;
      if (currentNs.startsWith('user:') && prev.settings.account?.remoteUserId) {
        return {
          ...empty,
          settings: {
            ...empty.settings,
            account: prev.settings.account,
          },
        };
      }
      return {
        ...empty,
        settings: {
          ...empty.settings,
          account: {
            ...(prev.settings.account ?? DEFAULT_ACCOUNT_SECURITY),
            mode:
              prev.settings.account?.mode === 'cloud_ready'
                ? 'local_profile'
                : prev.settings.account?.mode || 'local_profile',
            remoteUserId: undefined,
          },
        },
      };
    });
  };

  const lockApp = () => {
    if (state.settings.account?.pinEnabled && state.settings.account?.pinHash) {
      setIsLocked(true);
    }
  };

  const unlockApp = () => {
    setIsLocked(false);
  };

  const verifyPin = async (pin: string): Promise<boolean> => {
    const savedHash = state.settings.account?.pinHash;
    if (!savedHash) return true;
    const candidate = await hashPin(pin);
    return candidate === savedHash;
  };

  const enablePinLock = async (pin: string) => {
    const hashed = await hashPin(pin);
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        account: {
          ...DEFAULT_ACCOUNT_SECURITY,
          ...(prev.settings.account ?? {}),
          pinEnabled: true,
          pinHash: hashed,
        },
      },
    }));
  };

  const disablePinLock = () => {
    setIsLocked(false);
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        account: {
          ...DEFAULT_ACCOUNT_SECURITY,
          ...(prev.settings.account ?? {}),
          pinEnabled: false,
          pinHash: undefined,
        },
      },
    }));
  };

  const updateAccountProfile: FinanceContextValue['updateAccountProfile'] = (patch) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        account: {
          ...DEFAULT_ACCOUNT_SECURITY,
          ...(prev.settings.account ?? {}),
          ...patch,
        },
      },
    }));
  };

  // Helper commun pour basculer atomiquement vers l'espace isolé du compte authentifié
  const completeRemoteSessionSwitch = async (
    user: { id: string; email?: string; user_metadata?: Record<string, unknown> },
    fallbackEmail: string,
    displayNameOverride?: string
  ): Promise<void> => {
    const {
      pullFinanceStateFromCloud,
      pushFinanceStateToCloud,
      fetchUserSharedProjectsRemote,
    } = await import('../utils/cloudSync');

    // 1. Sauvegarde immédiate de l'espace actuel avant bascule pour protéger le Profil Local
    const prevNs = activeNamespaceRef.current;
    const flushPayload = {
      updatedAt: localUpdatedAtRef.current || new Date().toISOString(),
      state,
    };
    writeToLocalStorage(flushPayload, prevNs);
    await writeToIndexedDb(flushPayload, prevNs);

    // 2. Lecture de l'éventuel cache déjà présent pour CE même user_id + récupération Cloud
    const targetNs = getUserNamespace(user.id);
    const cachedLs = readFromLocalStorage(targetNs);
    const cachedIdb = await readFromIndexedDb(targetNs);
    const bestUserCache =
      cachedLs && cachedIdb
        ? cachedLs.updatedAt >= cachedIdb.updatedAt
          ? cachedLs
          : cachedIdb
        : cachedLs || cachedIdb;

    const [remotePayload, sharedBundles] = await Promise.all([
      pullFinanceStateFromCloud(),
      fetchUserSharedProjectsRemote().catch(() => []),
    ]);

    let baseState: FinanceState;
    let resolvedUpdatedAt = new Date().toISOString();
    const hasRemoteData = Boolean(remotePayload && remotePayload.stateJson);

    if (hasRemoteData && remotePayload) {
      const remoteNormalized = normalizeLoadedState(
        remotePayload.stateJson as Partial<FinanceState>
      );
      if (bestUserCache && bestUserCache.updatedAt > remotePayload.updatedAt) {
        baseState = normalizeLoadedState(bestUserCache.state);
        resolvedUpdatedAt = bestUserCache.updatedAt;
      } else {
        baseState = remoteNormalized;
        resolvedUpdatedAt = remotePayload.updatedAt || resolvedUpdatedAt;
      }
    } else if (bestUserCache) {
      baseState = normalizeLoadedState(bestUserCache.state);
      resolvedUpdatedAt = bestUserCache.updatedAt;
    } else {
      // Nouveau compte vierge : jamais d'importation automatique des données du Profil Local de l'appareil hôte
      baseState = createCleanRemoteState();
    }

    // Fusionne les projets partagés appartenant à ce user_id
    if (sharedBundles.length > 0) {
      const mergeById = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
        const map = new Map(existing.map((e) => [e.id, e]));
        for (const item of incoming) map.set(item.id, item);
        return Array.from(map.values());
      };
      let nextProjects = baseState.projects;
      let nextSupports = baseState.supports;
      let nextInventory = baseState.inventoryItems ?? [];
      let nextMembers = baseState.projectMembers ?? [];
      let nextTxs = baseState.transactions;

      for (const b of sharedBundles) {
        nextProjects = mergeById(nextProjects, [b.project]);
        nextSupports = mergeById(nextSupports, b.supports);
        nextInventory = mergeById(nextInventory, b.inventory);
        nextMembers = mergeById(nextMembers, b.members);
        nextTxs = mergeById(nextTxs, b.transactions);
      }

      baseState = {
        ...baseState,
        projects: nextProjects,
        supports: nextSupports,
        inventoryItems: nextInventory,
        projectMembers: nextMembers,
        transactions: nextTxs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      };
    }

    const metadataName =
      typeof user.user_metadata?.display_name === 'string'
        ? user.user_metadata.display_name.trim()
        : '';
    const existingName =
      baseState.settings.account?.displayName &&
      baseState.settings.account.displayName !== 'Mode Invité (Local)'
        ? baseState.settings.account.displayName.trim()
        : '';
    const cleanEmail = (user.email || fallbackEmail).trim().toLowerCase();
    const resolvedDisplayName =
      displayNameOverride?.trim() ||
      existingName ||
      metadataName ||
      cleanEmail.split('@')[0] ||
      'Compte Connecté';

    const nextState: FinanceState = {
      ...baseState,
      settings: {
        ...baseState.settings,
        account: {
          ...DEFAULT_ACCOUNT_SECURITY,
          ...(baseState.settings.account ?? {}),
          mode: 'cloud_ready',
          remoteUserId: user.id,
          displayName: resolvedDisplayName,
          email: cleanEmail,
          cloudProviderLabel: 'Supabase',
          localProfileConfirmedAt: undefined,
        },
      },
    };

    // 3. Bascule atomique vers le namespace isolé du compte
    setActiveStorageNamespace(targetNs);
    activeNamespaceRef.current = targetNs;
    localUpdatedAtRef.current = resolvedUpdatedAt;
    hadLocalRef.current = true;
    setActiveNamespace(targetNs);
    setState(nextState);
    setIsLocked(false);

    const payloadToSave = { updatedAt: resolvedUpdatedAt, state: nextState };
    writeToLocalStorage(payloadToSave, targetNs);
    await writeToIndexedDb(payloadToSave, targetNs);

    if (!hasRemoteData && navigator.onLine) {
      try {
        await pushFinanceStateToCloud(nextState);
      } catch {
        // Auto-sync reprendra dès que possible
      }
    }

    void refreshPushNotifications();
    void syncPushTokenWithSupabase();
  };

  // Connexion par e-mail + mot de passe dans un espace isolé dédié (sans toucher au Profil Local)
  const loginRemoteAccount: FinanceContextValue['loginRemoteAccount'] = async (
    email,
    password
  ) => {
    try {
      const { signInRemote, RemoteAuthError } = await import('../utils/cloudSync');
      try {
        const authRes = await signInRemote(email, password);
        if (!authRes.hasSession || authRes.needsEmailConfirmation) {
          return {
            ok: false,
            needsEmailConfirmation: true,
            errorCode: 'email_not_confirmed',
            message:
              'Votre adresse e-mail doit être confirmée avant de charger vos données. Consultez votre boîte mail ou renvoyez l’e-mail de confirmation.',
          };
        }

        await completeRemoteSessionSwitch(authRes.user, email);
        return {
          ok: true,
          message:
            'Compte connecté et données chargées dans votre espace privé (le profil local de cet appareil reste intact).',
        };
      } catch (err) {
        if (err instanceof RemoteAuthError) {
          return {
            ok: false,
            errorCode: err.code,
            needsEmailConfirmation: err.code === 'email_not_confirmed',
            message: err.message,
          };
        }
        throw err;
      }
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'Erreur lors de la connexion au compte.',
      };
    }
  };

  // Création d'un nouveau compte Cloud isolé
  const registerRemoteAccount: FinanceContextValue['registerRemoteAccount'] = async (
    email,
    password,
    displayName
  ) => {
    try {
      const { signUpRemote, RemoteAuthError } = await import('../utils/cloudSync');
      try {
        const authRes = await signUpRemote(email, password, displayName);
        if (!authRes.hasSession || authRes.needsEmailConfirmation) {
          return {
            ok: false,
            needsEmailConfirmation: true,
            errorCode: 'email_not_confirmed',
            message:
              'Compte créé ! Un e-mail de confirmation vient d’être envoyé. Validez le lien dans votre boîte mail (et vérifiez vos spams) puis connectez-vous.',
          };
        }

        await completeRemoteSessionSwitch(authRes.user, email, displayName);
        return {
          ok: true,
          message:
            'Compte créé et activé dans son propre espace isolé sur cet appareil.',
        };
      } catch (err) {
        if (err instanceof RemoteAuthError) {
          return {
            ok: false,
            errorCode: err.code,
            needsEmailConfirmation: err.code === 'email_not_confirmed',
            message: err.message,
          };
        }
        throw err;
      }
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'Impossible de créer le compte pour le moment.',
      };
    }
  };

  const resendRemoteConfirmation: FinanceContextValue['resendRemoteConfirmation'] = async (
    email
  ) => {
    try {
      const { resendConfirmationEmailRemote } = await import('../utils/cloudSync');
      await resendConfirmationEmailRemote(email);
      return {
        ok: true,
        message:
          'E-mail de confirmation renvoyé ! Vérifiez votre boîte de réception et vos spams.',
      };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'Impossible de renvoyer l’e-mail de confirmation.',
      };
    }
  };

  // Déconnexion propre : purge uniquement les caches locaux du compte connecté et restaure le Profil Local intact
  const logoutRemoteAccount = async (): Promise<void> => {
    const currentNs = activeNamespaceRef.current;
    const remoteUserId =
      state.settings.account?.remoteUserId ||
      (currentNs.startsWith('user:') ? currentNs.slice(5) : null);

    // Sauvegarde finale best-effort vers le cloud avant suppression du cache local de ce compte
    if (
      remoteUserId &&
      currentNs === getUserNamespace(remoteUserId) &&
      navigator.onLine &&
      isSupabaseConfigured
    ) {
      try {
        const { getCurrentRemoteUser, pushFinanceStateToCloud } = await import(
          '../utils/cloudSync'
        );
        const currentUser = await getCurrentRemoteUser();
        if (currentUser && currentUser.id === remoteUserId) {
          await pushFinanceStateToCloud(state);
        }
      } catch {
        // Ignore si réseau indisponible
      }
    }

    await removeCachedPushTokenFromSupabase();
    try {
      const { signOutRemote } = await import('../utils/cloudSync');
      await signOutRemote();
    } catch {
      // Ignore si hors ligne lors de la déconnexion
    }

    // Supprime uniquement les données locales du compte qui vient de se déconnecter
    if (remoteUserId) {
      await clearAccountLocalCache(remoteUserId);
    }

    // Restaure intact l'espace 'local' de l'appareil
    const localLs = readFromLocalStorage('local');
    const localIdb = await readFromIndexedDb('local');
    const bestLocal =
      localLs && localIdb
        ? localLs.updatedAt >= localIdb.updatedAt
          ? localLs
          : localIdb
        : localLs || localIdb;

    let restoredLocalState: FinanceState;
    if (bestLocal) {
      const normalized = normalizeLoadedState(bestLocal.state);
      const localMode =
        normalized.settings.account?.mode === 'cloud_ready'
          ? 'local_profile'
          : normalized.settings.account?.mode || 'local_profile';
      restoredLocalState = {
        ...normalized,
        settings: {
          ...normalized.settings,
          account: {
            ...DEFAULT_ACCOUNT_SECURITY,
            ...(normalized.settings.account ?? {}),
            mode: localMode,
            remoteUserId: undefined,
          },
        },
      };
    } else {
      restoredLocalState = {
        ...createStarterFinanceState(),
        settings: {
          ...createStarterFinanceState().settings,
          account: {
            ...DEFAULT_ACCOUNT_SECURITY,
            mode: 'local_profile',
            remoteUserId: undefined,
          },
        },
      };
    }

    setActiveStorageNamespace('local');
    activeNamespaceRef.current = 'local';
    localUpdatedAtRef.current = bestLocal?.updatedAt || new Date(0).toISOString();
    hadLocalRef.current = Boolean(bestLocal);
    setActiveNamespace('local');
    setState(restoredLocalState);
    setIsLocked(
      Boolean(
        restoredLocalState.settings.account?.pinEnabled &&
          restoredLocalState.settings.account?.pinHash
      )
    );
  };

  // Synchronisation automatique Cloud strictement limitée à l'utilisateur authentifié correspondant
  useEffect(() => {
    const remoteUid = state.settings.account?.remoteUserId;
    const isCloudMode =
      state.settings.account?.mode === 'cloud_ready' &&
      Boolean(remoteUid) &&
      activeNamespace.startsWith('user:') &&
      activeNamespace === getUserNamespace(remoteUid!);
    if (!isCloudMode || !remoteUid) return;

    const expectedNs = activeNamespace;
    let cancelled = false;
    let unsubscribeReconnect: (() => void) | undefined;

    void (async () => {
      const { onNetworkReconnect, pushFinanceStateToCloud, getCurrentRemoteUser } =
        await import('../utils/cloudSync');

      const attemptSync = async () => {
        if (
          cancelled ||
          !navigator.onLine ||
          activeNamespaceRef.current !== expectedNs
        ) {
          return;
        }
        try {
          const authUser = await getCurrentRemoteUser();
          if (
            cancelled ||
            !authUser ||
            authUser.id !== remoteUid ||
            activeNamespaceRef.current !== expectedNs
          ) {
            return;
          }
          await pushFinanceStateToCloud(state);
        } catch {
          // Reste sécurisé en local si échec réseau temporaire
        }
      };

      if (navigator.onLine) {
        void attemptSync();
      }

      unsubscribeReconnect = onNetworkReconnect(() => {
        void attemptSync();
      });
    })();

    return () => {
      cancelled = true;
      if (unsubscribeReconnect) unsubscribeReconnect();
    };
  }, [state, activeNamespace]);

  // Ref pour garder la trace idempotente des transactions déjà reçues
  const knownTxIdsRef = useRef<Set<string>>(new Set(state.transactions.map((t) => t.id)));
  useEffect(() => {
    knownTxIdsRef.current = new Set(state.transactions.map((t) => t.id));
  }, [state.transactions]);

  // Collaboration isolée : activation partage, gestion membres, rejoindre par code & sync queue
  const enableProjectSharing: FinanceContextValue['enableProjectSharing'] = async (
    projectId
  ) => {
    const target = state.projects.find((p) => p.id === projectId);
    if (!target) return { ok: false, message: 'Projet introuvable.' };

    const code = target.inviteCode || generateInviteCode();
    const ownerName = state.settings.account?.displayName?.trim() || 'Propriétaire';
    const ownerEmail = state.settings.account?.email?.trim().toLowerCase() || 'owner@tomi.local';
    const nowIso = new Date().toISOString();

    const updatedProject: Project = {
      ...target,
      isShared: true,
      sharedAccessRole: 'owner',
      ownerName,
      inviteCode: code,
      lastSyncedAt: nowIso,
    };

    const existingOwnerMember = (state.projectMembers ?? []).find(
      (m) => m.projectId === projectId && m.role === 'owner'
    );
    const ownerMember: ProjectMember = existingOwnerMember || {
      id: generateId('mem'),
      projectId,
      email: ownerEmail,
      displayName: ownerName,
      initials: getInitials(ownerName),
      role: 'owner',
      status: 'active',
      inviteCode: code,
      invitedAt: nowIso,
      joinedAt: nowIso,
    };

    const nextMembers = existingOwnerMember
      ? state.projectMembers ?? []
      : [ownerMember, ...(state.projectMembers ?? [])];

    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === projectId ? updatedProject : p)),
      projectMembers: nextMembers,
    }));

    if (isSupabaseConfigured && navigator.onLine) {
      try {
        const { publishSharedProjectRemote } = await import('../utils/cloudSync');
        const projSupports = state.supports.filter(
          (s) => s.ownerType === 'project' && s.ownerId === projectId
        );
        const projInventory = (state.inventoryItems ?? []).filter(
          (i) => i.projectId === projectId
        );
        const projMembers = nextMembers.filter((m) => m.projectId === projectId);
        const pushed = await publishSharedProjectRemote(
          updatedProject,
          projSupports,
          projInventory,
          projMembers
        );
        if (pushed) {
          void refreshPushNotifications();
          void syncPushTokenWithSupabase();
          return {
            ok: true,
            inviteCode: code,
            message: 'Partage activé et synchronisé sur Supabase (cloisonnement strict).',
          };
        }
      } catch (err) {
        return {
          ok: true,
          inviteCode: code,
          message:
            err instanceof Error
              ? `Partage activé localement (sync cloud en attente : ${err.message})`
              : 'Partage activé localement.',
        };
      }
    }

    return {
      ok: true,
      inviteCode: code,
      message: isSupabaseConfigured
        ? 'Partage activé localement. Connectez votre compte Cloud pour inviter à distance.'
        : 'Partage activé en mode local/aperçu (code généré). Configurez Supabase pour la synchro temps réel.',
    };
  };

  const inviteProjectMember: FinanceContextValue['inviteProjectMember'] = async ({
    projectId,
    email,
    displayName,
    role,
  }) => {
    const proj = state.projects.find((p) => p.id === projectId);
    if (!proj) return { ok: false, message: 'Projet introuvable.' };
    if (proj.sharedAccessRole && proj.sharedAccessRole !== 'owner') {
      return { ok: false, message: 'Seul le propriétaire peut inviter des associés.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { ok: false, message: 'Veuillez saisir une adresse e-mail valide.' };
    }

    const cleanName = displayName.trim() || cleanEmail.split('@')[0];
    const nowIso = new Date().toISOString();
    const code = proj.inviteCode || generateInviteCode();

    const member: ProjectMember = {
      id: generateId('mem'),
      projectId,
      email: cleanEmail,
      displayName: cleanName,
      initials: getInitials(cleanName),
      role: role === 'owner' ? 'manager' : role,
      status: 'invited',
      inviteCode: code,
      invitedAt: nowIso,
    };

    setState((prev) => {
      const existing = (prev.projectMembers ?? []).some(
        (m) => m.projectId === projectId && m.email.toLowerCase() === cleanEmail
      );
      const nextMembers = existing
        ? (prev.projectMembers ?? []).map((m) =>
            m.projectId === projectId && m.email.toLowerCase() === cleanEmail
              ? { ...m, displayName: cleanName, role: member.role }
              : m
          )
        : [...(prev.projectMembers ?? []), member];

      return {
        ...prev,
        projects: prev.projects.map((p) =>
          p.id === projectId ? { ...p, isShared: true, inviteCode: code } : p
        ),
        projectMembers: nextMembers,
        pendingSyncQueue: [
          ...(prev.pendingSyncQueue ?? []),
          {
            id: generateId('sync'),
            projectId,
            kind: 'upsert_member',
            payload: member,
            createdAt: nowIso,
          },
        ],
      };
    });

    if (isSupabaseConfigured && navigator.onLine) {
      try {
        const { inviteProjectMemberRemote } = await import('../utils/cloudSync');
        await inviteProjectMemberRemote(member);
      } catch {
        // Reste dans la file pendingSyncQueue pour retry automatique
      }
    }

    return {
      ok: true,
      message: `Invitation enregistrée pour ${cleanName} (${role === 'viewer' ? 'Observateur' : 'Associé'}). Partagez le code ${code}.`,
    };
  };

  const updateProjectMemberRole: FinanceContextValue['updateProjectMemberRole'] = async (
    memberId,
    role
  ) => {
    let updatedMember: ProjectMember | null = null;
    setState((prev) => {
      const target = (prev.projectMembers ?? []).find((m) => m.id === memberId);
      if (!target || target.role === 'owner') return prev;
      const proj = prev.projects.find((p) => p.id === target.projectId);
      if (proj?.sharedAccessRole && proj.sharedAccessRole !== 'owner') return prev;

      updatedMember = { ...target, role };
      return {
        ...prev,
        projectMembers: (prev.projectMembers ?? []).map((m) =>
          m.id === memberId ? updatedMember! : m
        ),
      };
    });

    if (updatedMember && isSupabaseConfigured && navigator.onLine) {
      try {
        const { inviteProjectMemberRemote } = await import('../utils/cloudSync');
        await inviteProjectMemberRemote(updatedMember);
      } catch {
        // Ignoré si hors-ligne
      }
    }
  };

  const removeProjectMember: FinanceContextValue['removeProjectMember'] = async (memberId) => {
    const target = (state.projectMembers ?? []).find((m) => m.id === memberId);
    if (!target || target.role === 'owner') return;
    const proj = state.projects.find((p) => p.id === target.projectId);
    if (proj?.sharedAccessRole && proj.sharedAccessRole !== 'owner') return;

    setState((prev) => ({
      ...prev,
      projectMembers: (prev.projectMembers ?? []).filter((m) => m.id !== memberId),
    }));

    if (isSupabaseConfigured && navigator.onLine) {
      try {
        const { removeProjectMemberRemote } = await import('../utils/cloudSync');
        await removeProjectMemberRemote(target.projectId, memberId);
      } catch {
        // Ignoré si hors-ligne
      }
    }
  };

  const joinSharedProjectByCode: FinanceContextValue['joinSharedProjectByCode'] = async (
    inviteCode
  ) => {
    const cleanCode = inviteCode.trim().toUpperCase();
    if (!cleanCode) {
      return { ok: false, message: 'Veuillez saisir un code d’invitation valide.' };
    }

    // Vérifie d'abord si le projet existe déjà localement
    const localMatch = state.projects.find(
      (p) => p.inviteCode?.toUpperCase() === cleanCode
    );
    if (localMatch) {
      return {
        ok: true,
        projectId: localMatch.id,
        message: `Le projet « ${localMatch.name} » est déjà ouvert sur cet appareil.`,
      };
    }

    if (!isSupabaseConfigured) {
      return {
        ok: false,
        message:
          'Supabase non configuré sur cet appareil. Exécutez le script SQL dans Supabase et configurez .env.local pour rejoindre un projet distant.',
      };
    }

    try {
      const displayName = state.settings.account?.displayName?.trim() || 'Associé';
      const { joinSharedProjectByCodeRemote } = await import('../utils/cloudSync');
      const bundle = await joinSharedProjectByCodeRemote(
        cleanCode,
        displayName,
        getInitials(displayName)
      );

      setState((prev) => {
        const mergeById = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
          const map = new Map(existing.map((e) => [e.id, e]));
          for (const item of incoming) map.set(item.id, item);
          return Array.from(map.values());
        };

        return {
          ...prev,
          projects: mergeById(prev.projects, [bundle.project]),
          supports: mergeById(prev.supports, bundle.supports),
          inventoryItems: mergeById(prev.inventoryItems ?? [], bundle.inventory),
          projectMembers: mergeById(prev.projectMembers ?? [], bundle.members),
          transactions: mergeById(prev.transactions, bundle.transactions).sort((a, b) =>
            b.createdAt.localeCompare(a.createdAt)
          ),
        };
      });

      void refreshPushNotifications();
      void syncPushTokenWithSupabase();

      return {
        ok: true,
        projectId: bundle.project.id,
        message: `Projet « ${bundle.project.name} » rejoint avec succès (accès isolé uniquement à ce projet).`,
      };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'Impossible de rejoindre ce projet avec ce code.',
      };
    }
  };

  const syncSharedProjectsNow: FinanceContextValue['syncSharedProjectsNow'] = async () => {
    if (!isSupabaseConfigured) {
      return {
        ok: false,
        message: 'Mode local actif : Supabase non configuré.',
      };
    }
    if (!navigator.onLine) {
      return {
        ok: false,
        message: 'Appareil hors-ligne : les opérations en attente seront envoyées dès reconnexion.',
      };
    }

    try {
      const {
        fetchUserSharedProjectsRemote,
        inviteProjectMemberRemote,
        publishSharedProjectRemote,
        pushProjectTransactionRemote,
        upsertInventoryItemRemote,
      } = await import('../utils/cloudSync');

      const queue = state.pendingSyncQueue ?? [];
      const failedOps: SharedProjectSyncOp[] = [];

      for (const op of queue) {
        try {
          if (op.kind === 'insert_transaction') {
            const tx = op.payload as Transaction;
            const projSups = state.supports.filter(
              (s) => s.ownerType === 'project' && s.ownerId === op.projectId
            );
            const projInv = (state.inventoryItems ?? []).filter(
              (i) => i.projectId === op.projectId
            );
            await pushProjectTransactionRemote(tx, projSups, projInv);
          } else if (op.kind === 'upsert_inventory') {
            await upsertInventoryItemRemote(op.payload as InventoryItem);
          } else if (op.kind === 'upsert_member') {
            await inviteProjectMemberRemote(op.payload as ProjectMember);
          } else if (op.kind === 'upsert_project') {
            const proj = state.projects.find((p) => p.id === op.projectId);
            if (proj) {
              await publishSharedProjectRemote(
                proj,
                state.supports.filter((s) => s.ownerId === proj.id),
                (state.inventoryItems ?? []).filter((i) => i.projectId === proj.id),
                (state.projectMembers ?? []).filter((m) => m.projectId === proj.id)
              );
            }
          }
        } catch {
          failedOps.push(op);
        }
      }

      const bundles = await fetchUserSharedProjectsRemote();
      setState((prev) => {
        const mergeById = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
          const map = new Map(existing.map((e) => [e.id, e]));
          for (const item of incoming) map.set(item.id, item);
          return Array.from(map.values());
        };

        let nextProjects = prev.projects;
        let nextSupports = prev.supports;
        let nextInventory = prev.inventoryItems ?? [];
        let nextMembers = prev.projectMembers ?? [];
        let nextTxs = prev.transactions;

        for (const b of bundles) {
          nextProjects = mergeById(nextProjects, [b.project]);
          nextSupports = mergeById(nextSupports, b.supports);
          nextInventory = mergeById(nextInventory, b.inventory);
          nextMembers = mergeById(nextMembers, b.members);
          nextTxs = mergeById(nextTxs, b.transactions);
        }

        return {
          ...prev,
          projects: nextProjects,
          supports: nextSupports,
          inventoryItems: nextInventory,
          projectMembers: nextMembers,
          transactions: nextTxs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
          pendingSyncQueue: failedOps,
        };
      });

      return {
        ok: true,
        message: 'Projets partagés synchronisés.',
      };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof Error ? err.message : 'Erreur lors de la synchronisation partagée.',
      };
    }
  };

  // Flush automatique de la file d'attente hors-ligne des projets partagés dès retour réseau
  useEffect(() => {
    const pendingCount = state.pendingSyncQueue?.length ?? 0;
    if (pendingCount === 0 || !isSupabaseConfigured) return;

    if (navigator.onLine) {
      void syncSharedProjectsNow();
    }

    let cleanup: (() => void) | undefined;
    void (async () => {
      const { onNetworkReconnect } = await import('../utils/cloudSync');
      cleanup = onNetworkReconnect(() => {
        void syncSharedProjectsNow();
      });
    })();

    return () => {
      if (cleanup) cleanup();
    };
  }, [state.pendingSyncQueue?.length, persistenceStatus.isOnline]);

  // Abonnement Supabase Realtime sur les projets partagés (transactions, stocks, membres)
  const sharedProjectIdsKey = useMemo(
    () =>
      state.projects
        .filter((p) => p.isShared)
        .map((p) => p.id)
        .sort()
        .join(','),
    [state.projects]
  );

  useEffect(() => {
    if (!sharedProjectIdsKey || !isSupabaseConfigured || !persistenceStatus.isOnline) {
      return;
    }
    const ids = sharedProjectIdsKey.split(',').filter(Boolean);
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const { subscribeToSharedProjectsRealtime } = await import('../utils/cloudSync');
      if (cancelled) return;

      unsubscribe = subscribeToSharedProjectsRealtime(ids, {
        onRemoteTransaction: (remoteTx) => {
          if (knownTxIdsRef.current.has(remoteTx.id)) return;
          knownTxIdsRef.current.add(remoteTx.id);

          setState((prev) => {
            if (prev.transactions.some((t) => t.id === remoteTx.id)) return prev;
            const { currencies } = prev.settings;
            const deltaFbu =
              remoteTx.type === TransactionType.INFLOW
                ? remoteTx.amountInFbu
                : remoteTx.type === TransactionType.OUTFLOW
                ? -remoteTx.amountInFbu
                : 0;

            const nextSupports = prev.supports.map((s) => {
              if (s.id !== remoteTx.supportId || deltaFbu === 0) return s;
              const deltaCurr = convertFromFbu(deltaFbu, s.currency, currencies);
              return { ...s, balance: Math.round((s.balance + deltaCurr) * 100) / 100 };
            });

            const proj = prev.projects.find((p) => p.id === remoteTx.projectId);
            const roleLabel =
              remoteTx.authorRole === 'owner' ? 'Propriétaire' : 'Associé';
            const sign = remoteTx.type === TransactionType.INFLOW ? '+' : '-';
            const notifTitle = `${proj?.name || 'Projet partagé'} · ${remoteTx.authorName || roleLabel}`;
            const notifMsg = `${roleLabel} (${remoteTx.authorInitials || 'AS'}) : ${sign}${remoteTx.amountInFbu.toLocaleString('fr-FR')} FBU — ${remoteTx.label}`;

            const notif: NotificationItem = {
              id: generateId('notif'),
              dedupeKey: `shared_tx_${remoteTx.id}`,
              category: 'shared_activity',
              title: notifTitle,
              message: notifMsg,
              severity: 'info',
              createdAt: new Date().toISOString(),
              read: false,
              targetTab: 'projects',
              targetProjectId: remoteTx.projectId,
              actionLabel: 'Voir projet',
            };

            return {
              ...prev,
              supports: nextSupports,
              transactions: [remoteTx, ...prev.transactions],
              notifications: [notif, ...(prev.notifications ?? [])].slice(0, 50),
            };
          });

          const roleLabel = remoteTx.authorRole === 'owner' ? 'Propriétaire' : 'Associé';
          const sign = remoteTx.type === TransactionType.INFLOW ? '+' : '-';
          showNotifToast(
            `Nouvelle écriture · ${remoteTx.authorName || roleLabel}`,
            `${sign}${remoteTx.amountInFbu.toLocaleString('fr-FR')} FBU — ${remoteTx.label}`,
            'info'
          );
          void haptics.tap();
        },
        onRemoteInventory: (remoteItem) => {
          setState((prev) => {
            const list = prev.inventoryItems ?? [];
            const exists = list.some((i) => i.id === remoteItem.id);
            return {
              ...prev,
              inventoryItems: exists
                ? list.map((i) => (i.id === remoteItem.id ? remoteItem : i))
                : [remoteItem, ...list],
            };
          });
        },
        onRemoteMember: (remoteMember) => {
          setState((prev) => {
            const list = prev.projectMembers ?? [];
            const exists = list.some((m) => m.id === remoteMember.id);
            return {
              ...prev,
              projectMembers: exists
                ? list.map((m) => (m.id === remoteMember.id ? remoteMember : m))
                : [...list, remoteMember],
            };
          });
        },
      });
    })();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [sharedProjectIdsKey, persistenceStatus.isOnline]);

  // Initialisation Push Notifications natives Android (FCM) + synchro token Supabase
  useEffect(() => {
    const unsubStatus = subscribePushStatus(setPushStatus);

    void initNativePushNotifications({
      onForegroundPush: (payload) => {
        void haptics.success();
        showNotifToast(payload.title, payload.body, 'info', payload.projectId);

        const dedupeKey = payload.transactionId
          ? `shared_tx_${payload.transactionId}`
          : `fcm_${payload.projectId || 'global'}_${Date.now()}`;

        setState((prev) => {
          const exists = (prev.notifications ?? []).some(
            (n) => n.dedupeKey === dedupeKey
          );
          if (exists) return prev;
          const item: NotificationItem = {
            id: generateId('notif'),
            dedupeKey,
            category: 'shared_activity',
            title: payload.title,
            message: payload.body,
            severity: 'info',
            createdAt: new Date().toISOString(),
            read: false,
            targetTab: payload.projectId ? 'projects' : 'home',
            targetProjectId: payload.projectId,
            actionLabel: payload.projectId ? 'Voir le projet' : undefined,
          };
          return {
            ...prev,
            notifications: [item, ...(prev.notifications ?? [])].slice(0, 50),
          };
        });

        if (navigator.onLine && isSupabaseConfigured) {
          void syncSharedProjectsNow();
        }
      },
      onNotificationTap: (payload) => {
        void haptics.tap();
        if (payload.projectId) {
          setPendingProjectNavigationId(payload.projectId);
        }
        if (navigator.onLine && isSupabaseConfigured) {
          void syncSharedProjectsNow();
        }
      },
    });

    const authSub = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        void syncPushTokenWithSupabase();
      }
    });

    return () => {
      unsubStatus();
      authSub?.data?.subscription?.unsubscribe();
      void cleanupNativePushListeners();
    };
  }, []);

  useEffect(() => {
    if (persistenceStatus.isOnline && isSupabaseConfigured) {
      void syncPushTokenWithSupabase();
    }
  }, [persistenceStatus.isOnline, sharedProjectIdsKey, state.settings.account?.mode]);

  const showPrivacyToast = (msg: string) => {
    setPrivacyToast(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setPrivacyToast(null);
      toastTimerRef.current = null;
    }, 2200);
  };

  const privacyMode = Boolean(state.settings.privacyMode);
  const shakeEnabled = state.settings.shakeEnabled ?? true;
  const shakeSensitivity: ShakeSensitivity = state.settings.shakeSensitivity || 'normal';

  const setPrivacyMode = (active: boolean) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, privacyMode: active },
    }));
    showPrivacyToast(active ? 'Mode discret activé' : 'Mode discret désactivé');
  };

  const togglePrivacyMode = () => {
    setState((prev) => {
      const next = !prev.settings.privacyMode;
      showPrivacyToast(next ? 'Mode discret activé' : 'Mode discret désactivé');
      return {
        ...prev,
        settings: { ...prev.settings, privacyMode: next },
      };
    });
  };

  const setShakeEnabled = (enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, shakeEnabled: enabled },
    }));
  };

  const setShakeSensitivity = (sensitivity: ShakeSensitivity) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, shakeSensitivity: sensitivity },
    }));
  };

  const ambientFlowsEnabled = state.settings.ambientFlowsEnabled ?? true;

  const setAmbientFlowsEnabled = (enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ambientFlowsEnabled: enabled },
    }));
  };

  const customLogoDataUrl = state.settings.customLogoDataUrl;

  const setCustomLogoDataUrl = (dataUrl?: string) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        customLogoDataUrl: dataUrl || undefined,
      },
    }));
  };

  const notifications = state.notifications ?? [];
  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );
  const notificationSettings = useMemo(() => getNotificationSettings(state), [state]);

  const showNotifToast = (
    title: string,
    message: string,
    severity: 'info' | 'warning' | 'danger' = 'info',
    projectId?: string
  ) => {
    setNotificationToast({ title, message, severity, projectId });
    if (notifToastTimerRef.current !== null) {
      window.clearTimeout(notifToastTimerRef.current);
    }
    notifToastTimerRef.current = window.setTimeout(() => {
      setNotificationToast(null);
      notifToastTimerRef.current = null;
    }, 4200);
  };

  const updateNotificationSettings = (patch: Partial<NotificationSettings>) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        notifications: {
          ...DEFAULT_NOTIFICATION_SETTINGS,
          ...(prev.settings.notifications ?? {}),
          ...patch,
        },
      },
    }));
  };

  const markNotificationRead = (id: string) => {
    setState((prev) => ({
      ...prev,
      notifications: (prev.notifications ?? []).map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
  };

  const markAllNotificationsRead = () => {
    setState((prev) => ({
      ...prev,
      notifications: (prev.notifications ?? []).map((n) => ({ ...n, read: true })),
    }));
  };

  const dismissNotification = (id: string) => {
    setState((prev) => {
      const target = (prev.notifications ?? []).find((n) => n.id === id);
      const nextDismissed = target
        ? Array.from(new Set([...(prev.dismissedNotificationKeys ?? []), target.dedupeKey])).slice(-100)
        : prev.dismissedNotificationKeys ?? [];
      return {
        ...prev,
        notifications: (prev.notifications ?? []).filter((n) => n.id !== id),
        dismissedNotificationKeys: nextDismissed,
      };
    });
  };

  const clearReadNotifications = () => {
    setState((prev) => {
      const readKeys = (prev.notifications ?? []).filter((n) => n.read).map((n) => n.dedupeKey);
      return {
        ...prev,
        notifications: (prev.notifications ?? []).filter((n) => !n.read),
        dismissedNotificationKeys: Array.from(
          new Set([...(prev.dismissedNotificationKeys ?? []), ...readKeys])
        ).slice(-100),
      };
    });
  };

  const triggerTestNotification = () => {
    const testItem: NotificationItem = {
      id: generateId('notif'),
      dedupeKey: `test_${Date.now()}`,
      category: 'ai_reports',
      title: 'Notification test — TOMI by BlackSheep',
      message:
        'Les alertes locales (prêts internes, dettes, ligne rouge et rappels quotidiens) fonctionnent correctement.',
      severity: 'info',
      createdAt: new Date().toISOString(),
      read: false,
      targetTab: 'home',
      actionLabel: 'Accueil',
    };
    setState((prev) => ({
      ...prev,
      notifications: [testItem, ...(prev.notifications ?? [])].slice(0, 50),
    }));
    showNotifToast(testItem.title, testItem.message, 'info');
    sendNativeNotificationIfPermitted(testItem.title, testItem.message);
  };

  const value: FinanceContextValue = {
    state,
    metrics,
    setPeriod,
    setDisplayCurrency,
    upsertCurrency,
    removeCurrency,
    addSupport,
    updateSupport,
    deleteSupport,
    addProject,
    updateProject,
    deleteProject,
    addProjectTag,
    getProjectRole,
    upsertInventoryItem,
    updateInventoryItem,
    updateInventoryThreshold,
    deleteInventoryItem,
    enableProjectSharing,
    inviteProjectMember,
    updateProjectMemberRole,
    removeProjectMember,
    joinSharedProjectByCode,
    syncSharedProjectsNow,
    addQuickTransaction,
    updateQuickTransaction,
    deleteTransaction,
    createInternalLoan,
    updateInternalLoan,
    repayInternalLoan,
    addDebt,
    addDebtEntry,
    updateDebt,
    updateDebtEntry,
    deleteDebtEntry,
    repayDebt,
    updateDebtRepayment,
    deleteDebtRepayment,
    deleteDebt,
    addSavingsGoal,
    updateSavingsGoal,
    adjustSavingsGoal,
    deleteSavingsGoal,
    sendChatMessage,
    clearChatHistory,
    persistenceStatus,
    exportJson,
    importJson,
    resetToStarter,
    resetToEmpty,
    activeNamespace,
    isLocked,
    lockApp,
    unlockApp,
    verifyPin,
    enablePinLock,
    disablePinLock,
    updateAccountProfile,
    loginRemoteAccount,
    registerRemoteAccount,
    resendRemoteConfirmation,
    logoutRemoteAccount,
    privacyMode,
    shakeEnabled,
    shakeSensitivity,
    privacyToast,
    togglePrivacyMode,
    setPrivacyMode,
    setShakeEnabled,
    setShakeSensitivity,
    ambientFlowsEnabled,
    setAmbientFlowsEnabled,
    customLogoDataUrl,
    setCustomLogoDataUrl,
    notifications,
    unreadNotificationsCount,
    notificationSettings,
    notificationToast,
    pushStatus,
    pendingProjectNavigationId,
    requestOpenProject,
    clearPendingProjectNavigation,
    refreshNativePush: refreshPushNotifications,
    updateNotificationSettings,
    markNotificationRead,
    markAllNotificationsRead,
    dismissNotification,
    clearReadNotifications,
    triggerTestNotification,
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
};

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext);
  if (!ctx) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return ctx;
}