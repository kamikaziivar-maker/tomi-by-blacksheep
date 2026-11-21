import React, { useCallback, useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Bell, Eye, EyeOff } from 'lucide-react';
import { AmbientNeonFlows } from './components/AmbientNeonFlows';
import { CalculatorModal } from './components/CalculatorModal';
import {
  FirstLaunchGuide,
  shouldShowFirstLaunchGuide,
} from './components/FirstLaunchGuide';
import {
  DesktopSidebar,
  MobileBottomNav,
  MobileTopBar,
} from './components/Navigation';
import { NotificationsModal } from './components/NotificationsModal';
import { PinLockScreen } from './components/PinLockScreen';
import { ProjectFormModal } from './components/ProjectFormModal';
import { QuickEntryModal } from './components/QuickEntryModal';
import { SplashScreen } from './components/SplashScreen';
import { SupportManagerModal } from './components/SupportManagerModal';
import {
  backdropMotionClass,
  dialogMotionClass,
  useAnimatedVisibility,
} from './hooks/useAnimatedVisibility';
import { useShakeDetector } from './hooks/useShakeDetector';
import { FinanceProvider, useFinance } from './store/FinanceContext';
import {
  NavTab,
  PocketTarget,
  Project,
  ProjectOutflowNature,
  Transaction,
  TransactionType,
} from './types/finance';
import { haptics } from './utils/haptics';
import { AiCoachView } from './views/AiCoachView';
import { DebtsSavingsView } from './views/DebtsSavingsView';
import { HomeView } from './views/HomeView';
import { ProjectsView } from './views/ProjectsView';
import { SettingsModal } from './views/SettingsModal';

const TAB_TITLES: Record<NavTab, string> = {
  home: 'Accueil',
  projects: 'Projets',
  debts_savings: 'Dettes & Épargne',
  ai_coach: 'IA Coach',
};

function AppShell() {
  const {
    state,
    persistenceStatus,
    isLocked,
    verifyPin,
    unlockApp,
    privacyMode,
    shakeEnabled,
    shakeSensitivity,
    privacyToast,
    notificationToast,
    pendingProjectNavigationId,
    requestOpenProject,
    togglePrivacyMode,
    ambientFlowsEnabled,
  } = useFinance();

  const [showSplash, setShowSplash] = useState(true);
  const [showFirstGuide, setShowFirstGuide] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const exitModalAnim = useAnimatedVisibility(exitConfirmOpen);
  const [activeTab, setActiveTab] = useState<NavTab>('home');

  // Quick Entry modal state
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickDefaults, setQuickDefaults] = useState<{
    pocket?: PocketTarget;
    projectId?: string;
    type?: TransactionType;
    outflowNature?: ProjectOutflowNature;
    stockItemId?: string;
    editingTransaction?: Transaction;
  }>({});

  // Project Form modal state
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Support Manager modal state
  const [supportMgr, setSupportMgr] = useState<{
    isOpen: boolean;
    ownerType: 'personal' | 'project';
    ownerId: string;
    title: string;
  }>({
    isOpen: false,
    ownerType: 'personal',
    ownerId: 'personal',
    title: 'Compte Personnel',
  });

  // Settings, Notifications & Calculator modals
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<'profile' | 'general'>('general');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);

  // Affiche le guide de première utilisation une seule fois après splash & déverrouillage
  useEffect(() => {
    if (!showSplash && !isLocked && shouldShowFirstLaunchGuide()) {
      setShowFirstGuide(true);
    }
  }, [showSplash, isLocked]);

  // Ouvre automatiquement l'onglet Projets lorsqu'une notification push cible un projet partagé
  useEffect(() => {
    if (!pendingProjectNavigationId) return;
    setActiveTab('projects');
    setQuickOpen(false);
    setProjectFormOpen(false);
    setNotificationsOpen(false);
    setSettingsOpen(false);
    setCalculatorOpen(false);
    setSupportMgr((prev) => ({ ...prev, isOpen: false }));
  }, [pendingProjectNavigationId]);

  const handleTogglePrivacy = useCallback(() => {
    void haptics.heavy();
    togglePrivacyMode();
  }, [togglePrivacyMode]);

  // Activate wrist-shake detection on Home screen when unlocked
  useShakeDetector({
    enabled:
      shakeEnabled &&
      activeTab === 'home' &&
      !showSplash &&
      !isLocked &&
      !quickOpen &&
      !calculatorOpen &&
      !settingsOpen &&
      !notificationsOpen &&
      !exitConfirmOpen &&
      !showFirstGuide,
    sensitivity: shakeSensitivity,
    cooldownMs: 950,
    onShake: handleTogglePrivacy,
  });

  // Gestion du bouton Retour Android (vibration + retour accueil + confirmation de sortie)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listenerPromise = CapacitorApp.addListener('backButton', async () => {
      await haptics.tap();

      if (showSplash || isLocked) {
        return;
      }

      if (exitConfirmOpen) {
        setExitConfirmOpen(false);
        return;
      }

      if (showFirstGuide) {
        setShowFirstGuide(false);
        return;
      }

      if (calculatorOpen) {
        setCalculatorOpen(false);
        return;
      }

      if (quickOpen) {
        setQuickOpen(false);
        return;
      }

      if (projectFormOpen) {
        setProjectFormOpen(false);
        return;
      }

      if (supportMgr.isOpen) {
        setSupportMgr((prev) => ({ ...prev, isOpen: false }));
        return;
      }

      if (notificationsOpen) {
        setNotificationsOpen(false);
        return;
      }

      if (settingsOpen) {
        setSettingsOpen(false);
        return;
      }

      if (activeTab !== 'home') {
        setActiveTab('home');
        return;
      }

      await haptics.warning();
      setExitConfirmOpen(true);
    });

    return () => {
      void listenerPromise.then((handle) => handle.remove());
    };
  }, [
    showSplash,
    isLocked,
    exitConfirmOpen,
    showFirstGuide,
    calculatorOpen,
    quickOpen,
    projectFormOpen,
    supportMgr.isOpen,
    notificationsOpen,
    settingsOpen,
    activeTab,
  ]);

  const handleSelectTab = (tab: NavTab) => {
    void haptics.tap();
    setActiveTab(tab);
  };

  const openQuickEntry = (opts?: {
    pocket?: PocketTarget;
    projectId?: string;
    type?: TransactionType;
    outflowNature?: ProjectOutflowNature;
    stockItemId?: string;
    editingTransaction?: Transaction;
  }) => {
    void haptics.tap();
    setQuickDefaults(opts ?? {});
    setQuickOpen(true);
  };

  const openProjectForm = (project?: Project) => {
    void haptics.tap();
    setEditingProject(project ?? null);
    setProjectFormOpen(true);
  };

  const openSupportManager = (
    ownerType: 'personal' | 'project',
    ownerId: string,
    title: string
  ) => {
    void haptics.tap();
    setSupportMgr({ isOpen: true, ownerType, ownerId, title });
  };

  const handleConfirmExit = async () => {
    await haptics.heavy();
    setExitConfirmOpen(false);
    await CapacitorApp.exitApp();
  };

  const statusText = !persistenceStatus.isOnline
    ? 'Hors ligne • Sauvegardé localement'
    : persistenceStatus.indexedDbSynced
    ? 'Double sauvegarde locale active'
    : 'Sauvegarde locale active';

  return (
    <div className="relative min-h-screen bg-[#08090C] text-zinc-100">
      <AmbientNeonFlows enabled={ambientFlowsEnabled} />
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

      {!showSplash && isLocked && (
        <PinLockScreen
          profileName={state.settings.account?.displayName}
          onVerify={verifyPin}
          onUnlocked={unlockApp}
        />
      )}

      <FirstLaunchGuide
        isOpen={!showSplash && !isLocked && showFirstGuide}
        onFinish={() => setShowFirstGuide(false)}
      />

      {/* Discreet Toast for Privacy / Discret Mode */}
      {privacyToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-16 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-xl border border-[#F5B971]/40 bg-[#141417]/95 px-4 py-2 text-xs font-semibold text-[#F5B971] shadow-xl backdrop-blur-md whitespace-nowrap tomi-toast-enter"
        >
          {privacyMode ? (
            <EyeOff className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Eye className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>{privacyToast}</span>
        </div>
      )}

      {/* Discreet In-App Notification / Foreground Push Banner */}
      {notificationToast && !privacyToast && (
        <button
          type="button"
          onClick={() => {
            void haptics.tap();
            if (notificationToast.projectId) {
              requestOpenProject(notificationToast.projectId);
            } else {
              setNotificationsOpen(true);
            }
          }}
          role="status"
          aria-live="polite"
          className="fixed top-16 left-1/2 z-50 -translate-x-1/2 w-[92%] max-w-sm flex items-start gap-2.5 rounded-2xl border border-[#F5B971]/50 bg-[#121318]/95 px-4 py-3 text-left shadow-2xl backdrop-blur-md transition-all tomi-toast-enter"
        >
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F5B971]/15 text-[#F5B971]">
            <Bell className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-100 truncate">
                {notificationToast.title}
              </span>
              {notificationToast.projectId && (
                <span className="shrink-0 text-[10px] font-semibold text-[#F5B971]">
                  Ouvrir →
                </span>
              )}
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-400 line-clamp-2">
              {notificationToast.message}
            </div>
          </div>
        </button>
      )}

      <DesktopSidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onOpenQuickEntry={() => openQuickEntry()}
        onOpenCalculator={() => {
          void haptics.tap();
          setCalculatorOpen(true);
        }}
        onOpenSettings={() => {
          void haptics.tap();
          setSettingsSection('general');
          setSettingsOpen(true);
        }}
        onOpenNotifications={() => {
          void haptics.tap();
          setNotificationsOpen(true);
        }}
      />

      <div className="relative z-10 lg:pl-64 flex min-h-screen flex-col bg-transparent">
        <MobileTopBar
          title={TAB_TITLES[activeTab]}
          onOpenCalculator={() => {
            void haptics.tap();
            setCalculatorOpen(true);
          }}
          onOpenSettings={() => {
            void haptics.tap();
            setSettingsSection('general');
            setSettingsOpen(true);
          }}
          onOpenNotifications={() => {
            void haptics.tap();
            setNotificationsOpen(true);
          }}
        />

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-24 sm:px-6 lg:pb-10">
          {activeTab === 'home' && (
            <HomeView
              onNavigate={handleSelectTab}
              onOpenQuickEntry={openQuickEntry}
              onOpenNewProject={() => openProjectForm()}
              onOpenSupportManager={openSupportManager}
              onOpenProfile={() => {
                void haptics.tap();
                setSettingsSection('profile');
                setSettingsOpen(true);
              }}
            />
          )}
          {activeTab === 'projects' && (
            <ProjectsView
              onOpenProjectForm={openProjectForm}
              onOpenQuickEntry={openQuickEntry}
              onOpenSupportManager={openSupportManager}
            />
          )}
          {activeTab === 'debts_savings' && <DebtsSavingsView />}
          {activeTab === 'ai_coach' && <AiCoachView />}

          {/* Discreet footer attribution & offline persistence status on mobile */}
          <footer className="mt-10 border-t border-zinc-900 pt-4 text-center space-y-1 lg:hidden">
            <p className="text-[11px] text-zinc-500">{statusText}</p>
            <p className="text-[11px] text-zinc-600">
              TOMI by BlackSheep • Developed by Fujistudio
            </p>
          </footer>
        </main>
      </div>

      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onOpenQuickEntry={() => openQuickEntry()}
      />

      {/* Modale sombre custom de confirmation de sortie */}
      {exitModalAnim.shouldRender && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setExitConfirmOpen(false)}
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 ${backdropMotionClass(
            exitModalAnim.isVisible
          )}`}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-2xl border border-zinc-800 bg-[#121318] p-5 text-zinc-100 shadow-2xl ${dialogMotionClass(
              exitModalAnim.isVisible
            )}`}
          >
            <h2 className="text-base font-semibold text-white">
              Quitter TOMI by BlackSheep ?
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              Êtes-vous sûr de vouloir fermer l&apos;application ? Vos données enregistrées restent sauvegardées localement.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  void haptics.tap();
                  setExitConfirmOpen(false);
                }}
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
              >
                Rester
              </button>
              <button
                type="button"
                onClick={handleConfirmExit}
                className="rounded-xl bg-[#F5B971] px-4 py-2 text-xs font-semibold text-black hover:opacity-95"
              >
                Oui, quitter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <QuickEntryModal
        isOpen={quickOpen}
        onClose={() => {
          setQuickOpen(false);
          setQuickDefaults({});
        }}
        defaultPocket={quickDefaults.pocket}
        defaultProjectId={quickDefaults.projectId}
        defaultType={quickDefaults.type}
        defaultOutflowNature={quickDefaults.outflowNature}
        defaultStockItemId={quickDefaults.stockItemId}
        editingTransaction={quickDefaults.editingTransaction ?? null}
      />

      <ProjectFormModal
        isOpen={projectFormOpen}
        onClose={() => setProjectFormOpen(false)}
        editingProject={editingProject}
      />

      <SupportManagerModal
        isOpen={supportMgr.isOpen}
        onClose={() => setSupportMgr((prev) => ({ ...prev, isOpen: false }))}
        ownerType={supportMgr.ownerType}
        ownerId={supportMgr.ownerId}
        ownerTitle={supportMgr.title}
      />

      <NotificationsModal
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onNavigateTab={handleSelectTab}
        onOpenQuickEntry={() => openQuickEntry()}
      />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenSupportManager={openSupportManager}
        initialFocusSection={settingsSection}
        onReplaySplash={() => {
          setSettingsOpen(false);
          setShowSplash(true);
        }}
      />

      <CalculatorModal
        isOpen={calculatorOpen}
        onClose={() => setCalculatorOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <FinanceProvider>
      <AppShell />
    </FinanceProvider>
  );
}