import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Boxes,
  Clock,
  Lock,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Share2,
  Trash2,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { CustomDatePicker } from '../components/CustomDatePicker';
import { CustomSelect } from '../components/CustomSelect';
import { ProjectCollaborationModal } from '../components/ProjectCollaborationModal';
import { EvolutionChart, MultiSegmentBar } from '../components/SegmentedBar';
import { StatusIndicator } from '../components/StatusIndicator';
import { SupportAvatar } from '../components/SupportAvatar';
import { SupportPicker } from '../components/SupportPicker';
import { useFinance } from '../store/FinanceContext';
import {
  PocketTarget,
  Project,
  ProjectOutflowNature,
  ProjectRole,
  SupportType,
  TransactionType,
} from '../types/finance';
import {
  convertToFbu,
  formatInDisplayCurrency,
  formatMoney,
  formatShortDate,
  getTodayISO,
  isDateInPeriod,
} from '../utils/format';
import { haptics } from '../utils/haptics';

interface ProjectsViewProps {
  onOpenProjectForm: (project?: Project) => void;
  onOpenQuickEntry: (opts: {
    pocket: PocketTarget;
    projectId: string;
    type: TransactionType;
    outflowNature?: ProjectOutflowNature;
    stockItemId?: string;
  }) => void;
  onOpenSupportManager: (
    ownerType: 'personal' | 'project',
    ownerId: string,
    title: string
  ) => void;
}

const ROLE_DISPLAY: Record<ProjectRole, string> = {
  owner: 'Propriétaire',
  manager: 'Associé',
  viewer: 'Observateur',
};

const UNIT_OPTIONS = ['pièce', 'carton', 'kg', 'sac', 'litre', 'boîte', 'lot'];

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  onOpenProjectForm,
  onOpenQuickEntry,
  onOpenSupportManager,
}) => {
  const {
    state,
    metrics,
    persistenceStatus,
    createInternalLoan,
    repayInternalLoan,
    deleteProject,
    upsertInventoryItem,
    updateInventoryThreshold,
    deleteInventoryItem,
    syncSharedProjectsNow,
    pendingProjectNavigationId,
    clearPendingProjectNavigation,
  } = useFinance();

  const { displayCurrency, currencies, period } = state.settings;
  const fmt = (fbu: number, opts?: { compact?: boolean; signed?: boolean }) =>
    formatInDisplayCurrency(fbu, displayCurrency, currencies, opts);

  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    pendingProjectNavigationId || state.projects[0]?.id || ''
  );

  useEffect(() => {
    if (!pendingProjectNavigationId) return;
    setSelectedProjectId(pendingProjectNavigationId);
    setSubTab('overview');
    clearPendingProjectNavigation();
  }, [pendingProjectNavigationId, clearPendingProjectNavigation]);

  const [subTab, setSubTab] = useState<'overview' | 'inventory' | 'team'>(
    'overview'
  );
  const [txFilter, setTxFilter] = useState<'all' | 'inflow' | 'outflow'>('all');

  // Collaboration modal state
  const [collabOpen, setCollabOpen] = useState(false);
  const [collabMode, setCollabMode] = useState<'manage' | 'join'>('manage');
  const [syncing, setSyncing] = useState(false);

  // Add / edit inventory item inline form state
  const [showAddStock, setShowAddStock] = useState(false);
  const [stockName, setStockName] = useState('');
  const [stockUnit, setStockUnit] = useState('pièce');
  const [stockQty, setStockQty] = useState('');
  const [stockUnitCost, setStockUnitCost] = useState('');
  const [stockMinThreshold, setStockMinThreshold] = useState('5');
  const [editingThresholdId, setEditingThresholdId] = useState<string | null>(
    null
  );
  const [thresholdInput, setThresholdInput] = useState('');

  // Internal Loan modal/inline panel state
  const [loanProjectId, setLoanProjectId] = useState<string | null>(null);
  const [loanAmount, setLoanAmount] = useState('');
  const [loanCurrency, setLoanCurrency] = useState('FBU');
  const [loanFromSupportId, setLoanFromSupportId] = useState('');
  const [loanToSupportId, setLoanToSupportId] = useState('');
  const [loanNote, setLoanNote] = useState('');
  const [loanReminderDate, setLoanReminderDate] = useState('');
  const [loanReminderDelayDays, setLoanReminderDelayDays] = useState('');

  // Repay internal loan inline state
  const [repayLoanId, setRepayLoanId] = useState<string | null>(null);
  const [repayAmountFbu, setRepayAmountFbu] = useState('');

  const activeMetric = useMemo(() => {
    return (
      metrics.projectMetrics.find((m) => m.project.id === selectedProjectId) ||
      metrics.projectMetrics[0] ||
      null
    );
  }, [metrics.projectMetrics, selectedProjectId]);

  const personalSupports = state.supports.filter(
    (s) => s.ownerType === 'personal'
  );

  const openBorrowForm = (projectId: string) => {
    const projSups = state.supports.filter(
      (s) => s.ownerType === 'project' && s.ownerId === projectId
    );
    setLoanProjectId(projectId);
    setLoanAmount('');
    setLoanCurrency(displayCurrency);
    setLoanFromSupportId(personalSupports[0]?.id || '');
    setLoanToSupportId(projSups[0]?.id || '');
    setLoanNote('');
    setLoanReminderDate('');
    setLoanReminderDelayDays('');
  };

  const handleCreateLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanProjectId || !loanFromSupportId || !loanToSupportId) return;
    const amt = parseFloat(loanAmount) || 0;
    if (amt <= 0) return;
    const delayNum = parseInt(loanReminderDelayDays, 10);

    createInternalLoan({
      projectId: loanProjectId,
      fromSupportId: loanFromSupportId,
      toSupportId: loanToSupportId,
      amount: amt,
      currency: loanCurrency,
      date: getTodayISO(),
      reminderDate: loanReminderDate || undefined,
      reminderDelayDays:
        !Number.isNaN(delayNum) && delayNum > 0 ? delayNum : undefined,
      note: loanNote || 'Avance Compte Perso → Projet',
    });
    setLoanProjectId(null);
  };

  const handleConfirmRepayLoan = (
    loanId: string,
    maxFbu: number,
    projId: string
  ) => {
    const val = parseFloat(repayAmountFbu) || maxFbu;
    const projSup =
      state.supports.find(
        (s) => s.ownerType === 'project' && s.ownerId === projId
      )?.id || '';
    const persoSup = personalSupports[0]?.id || '';
    if (!projSup || !persoSup || val <= 0) return;

    repayInternalLoan({
      loanId,
      amountFbu: Math.min(maxFbu, val),
      fromSupportId: projSup,
      toSupportId: persoSup,
      date: getTodayISO(),
    });
    setRepayLoanId(null);
    setRepayAmountFbu('');
  };

  const handleAddInventorySubmit = async (
    e: React.FormEvent,
    projectId: string
  ) => {
    e.preventDefault();
    const qty = parseFloat(stockQty.replace(',', '.')) || 0;
    const cost = parseFloat(stockUnitCost.replace(',', '.')) || 0;
    const minThr = parseFloat(stockMinThreshold.replace(',', '.'));
    if (!stockName.trim() || qty < 0) return;

    upsertInventoryItem({
      projectId,
      name: stockName.trim(),
      unit: stockUnit,
      quantity: qty,
      minStockThreshold: Number.isNaN(minThr) ? 5 : minThr,
      averageUnitCostFbu: cost,
    });
    await haptics.success();
    setStockName('');
    setStockQty('');
    setStockUnitCost('');
    setStockMinThreshold('5');
    setShowAddStock(false);
  };

  const handleManualSync = async () => {
    setSyncing(true);
    await syncSharedProjectsNow();
    setSyncing(false);
    await haptics.tap();
  };

  if (metrics.projectMetrics.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-zinc-800/80 bg-[#141417] p-8 text-center space-y-4">
          <h2 className="font-display text-lg font-bold text-zinc-100">
            Aucun projet configuré
          </h2>
          <p className="mx-auto max-w-md text-sm text-zinc-400">
            Créez vos activités (Commerce, Restauration, Services...) avec leurs propres comptes, gestion des stocks et partage isolé avec vos associés.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onOpenProjectForm()}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#F5B971] px-5 text-sm font-bold text-[#0D0D0F]"
            >
              <Plus className="h-4 w-4" />
              <span>Nouveau Projet</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCollabMode('join');
                setCollabOpen(true);
              }}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-zinc-700 bg-[#0D0D0F] px-5 text-sm font-semibold text-zinc-200 hover:border-[#F5B971]"
            >
              <UserPlus className="h-4 w-4 text-[#F5B971]" />
              <span>Rejoindre un projet</span>
            </button>
          </div>
        </div>

        <ProjectCollaborationModal
          isOpen={collabOpen}
          onClose={() => setCollabOpen(false)}
          project={null}
          initialMode="join"
          onJoinedProject={(pid) => {
            setSelectedProjectId(pid);
            setCollabOpen(false);
          }}
        />
      </div>
    );
  }

  const metric = activeMetric!;
  const proj = metric.project;
  const userRole: ProjectRole = proj.sharedAccessRole ?? 'owner';
  const isOwner = userRole === 'owner';
  const canWrite = userRole !== 'viewer';

  const projSupports = state.supports.filter(
    (s) => s.ownerType === 'project' && s.ownerId === proj.id
  );
  const projLoans = state.internalLoans.filter(
    (l) => l.projectId === proj.id && l.status === 'active'
  );
  const allProjTransactions = state.transactions
    .filter((t) => t.projectId === proj.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const projTransactions = allProjTransactions.filter(
    (t) =>
      isDateInPeriod(t.date, period) &&
      (txFilter === 'all' ||
        (txFilter === 'inflow' && t.type === TransactionType.INFLOW) ||
        (txFilter === 'outflow' && t.type === TransactionType.OUTFLOW))
  );

  const projMembers = (state.projectMembers ?? []).filter(
    (m) => m.projectId === proj.id
  );
  const projPendingSyncCount = (state.pendingSyncQueue ?? []).filter(
    (op) => op.projectId === proj.id
  ).length;

  return (
    <div className="space-y-5">
      {/* Header row + Project selector tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          {metrics.projectMetrics.map((pm) => {
            const active = pm.project.id === proj.id;
            const lowCount = pm.lowStockItems.length;
            return (
              <button
                key={pm.project.id}
                type="button"
                onClick={() => setSelectedProjectId(pm.project.id)}
                className={`inline-flex items-center gap-1.5 min-h-[40px] shrink-0 rounded-xl px-3.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#18181B] text-[#F5B971] border border-[#F5B971]/50'
                    : 'bg-[#141417] text-zinc-400 border border-zinc-800/80 hover:text-zinc-100'
                }`}
              >
                {pm.project.isShared && (
                  <Users className="h-3.5 w-3.5 text-[#10B981]" />
                )}
                <span>{pm.project.name}</span>
                {lowCount > 0 && (
                  <span className="h-2 w-2 rounded-full bg-[#EF4444]" />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              void haptics.tap();
              setCollabMode('join');
              setCollabOpen(true);
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-zinc-800 bg-[#141417] px-3.5 text-xs font-semibold text-zinc-200 whitespace-nowrap hover:border-[#F5B971]/60"
          >
            <UserPlus className="h-3.5 w-3.5 text-[#F5B971]" />
            <span>Rejoindre</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenProjectForm()}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#F5B971] px-4 text-xs font-bold text-[#0D0D0F] whitespace-nowrap hover:bg-[#f7c587]"
          >
            <Plus className="h-4 w-4" />
            <span>Nouveau Projet</span>
          </button>
        </div>
      </div>

      {/* Main Active Project Card */}
      <div className="rounded-2xl border border-zinc-800/80 bg-[#141417] p-4 sm:p-5 space-y-5">
        {/* Top Project Identity & Actions */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-display text-xl font-bold text-zinc-100">
                {proj.name}
              </h2>
              <StatusIndicator
                status={metric.status}
                label={metric.statusLabel}
              />
              {proj.isShared && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-2 py-0.5 text-[11px] font-semibold text-[#10B981]">
                  {userRole === 'viewer' ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    <Users className="h-3 w-3" />
                  )}
                  <span>
                    Partagé · {ROLE_DISPLAY[userRole]}
                  </span>
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              {proj.customCategory || proj.category}
              {proj.description ? ` · ${proj.description}` : ''}
              {proj.ownerName && !isOwner ? ` · Propriétaire : ${proj.ownerName}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                void haptics.tap();
                setCollabMode('manage');
                setCollabOpen(true);
              }}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-[#F5B971]/40 bg-[#F5B971]/10 px-3 text-xs font-semibold text-[#F5B971] hover:bg-[#F5B971]/20"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Équipe / Partager</span>
            </button>

            {isOwner && (
              <>
                <button
                  type="button"
                  onClick={() => onOpenProjectForm(proj)}
                  aria-label="Modifier ce projet"
                  className="flex h-10 items-center gap-1.5 rounded-xl border border-zinc-800 bg-[#0D0D0F] px-3 text-xs font-medium text-zinc-300 hover:border-zinc-700"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Configurer</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteProject(proj.id);
                    setSelectedProjectId('');
                  }}
                  aria-label="Supprimer ce projet"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-[#0D0D0F] text-zinc-500 hover:text-[#EF4444]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* 4 Indicateurs Comptables & Financiers Distincts */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 border-y border-zinc-800/70 py-4">
          <div className="rounded-xl border border-zinc-800/60 bg-[#0D0D0F]/70 p-3">
            <div className="text-[11px] font-medium text-zinc-400">
              1. Trésorerie disponible
            </div>
            <div
              className={`mt-1 font-mono-num text-lg font-bold ${
                metric.totalBalanceFbu < 0 ? 'text-[#EF4444]' : 'text-zinc-100'
              }`}
            >
              {fmt(metric.totalBalanceFbu)}
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-500">
              Cash, Banque &amp; Mobile Money
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/60 bg-[#0D0D0F]/70 p-3">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-medium text-zinc-400">
                2. Valeur du stock
              </span>
              {metric.lowStockItems.length > 0 && (
                <span className="text-[10px] font-bold text-[#EF4444]">
                  {metric.lowStockItems.length} alerte{metric.lowStockItems.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="mt-1 font-mono-num text-lg font-bold text-[#F5B971]">
              {fmt(metric.stockValueFbu)}
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-500">
              {metric.inventoryItems.length} référence
              {metric.inventoryItems.length > 1 ? 's' : ''} en stock
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/60 bg-[#0D0D0F]/70 p-3">
            <div className="text-[11px] font-medium text-zinc-400">
              3. Charges d’exploitation
            </div>
            <div className="mt-1 font-mono-num text-lg font-bold text-[#EF4444]">
              -{fmt(metric.operatingExpensesFbu)}
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-500 truncate">
              {metric.stockPurchasesFbu > 0
                ? `Hors ${fmt(metric.stockPurchasesFbu)} d’achats stock`
                : 'Dépenses consommées (période)'}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/60 bg-[#0D0D0F]/70 p-3">
            <div className="text-[11px] font-medium text-zinc-400">
              4. Résultat / Marge nette
            </div>
            <div
              className={`mt-1 font-mono-num text-lg font-bold ${
                metric.netResultFbu >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
              }`}
            >
              {fmt(metric.netResultFbu, { signed: true })} ({metric.marginPercent}
              %)
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-500 truncate">
              Entrées : +{fmt(metric.inflowsFbu)}
              {metric.cogsFbu > 0 ? ` · Coût stock : ${fmt(metric.cogsFbu)}` : ''}
            </div>
          </div>
        </div>

        {/* Sub-navigation inside Project Sheet */}
        <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-zinc-800/80 bg-[#08090C] p-1">
          <button
            type="button"
            onClick={() => {
              void haptics.tap();
              setSubTab('overview');
            }}
            className={`min-h-[38px] rounded-lg px-2 text-xs font-semibold transition-colors ${
              subTab === 'overview'
                ? 'bg-[#18181B] text-[#F5B971]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Vue d’ensemble
          </button>
          <button
            type="button"
            onClick={() => {
              void haptics.tap();
              setSubTab('inventory');
            }}
            className={`inline-flex items-center justify-center gap-1.5 min-h-[38px] rounded-lg px-2 text-xs font-semibold transition-colors ${
              subTab === 'inventory'
                ? 'bg-[#18181B] text-[#F5B971]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Boxes className="h-3.5 w-3.5" />
            <span>Stock &amp; Inventaire</span>
            {metric.lowStockItems.length > 0 && (
              <span className="rounded bg-[#EF4444]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#EF4444]">
                {metric.lowStockItems.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              void haptics.tap();
              setSubTab('team');
            }}
            className={`inline-flex items-center justify-center gap-1.5 min-h-[38px] rounded-lg px-2 text-xs font-semibold transition-colors ${
              subTab === 'team'
                ? 'bg-[#18181B] text-[#F5B971]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Activité &amp; Équipe</span>
          </button>
        </div>

        {/* ==================== SUBTAB 1: OVERVIEW ==================== */}
        {subTab === 'overview' && (
          <div className="space-y-5">
            {/* Action buttons row */}
            {canWrite ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onOpenQuickEntry({
                      pocket: 'project',
                      projectId: proj.id,
                      type: TransactionType.INFLOW,
                    })
                  }
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30 px-3.5 text-xs font-semibold text-[#10B981] hover:bg-[#10B981]/20"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Entrée / Vente</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onOpenQuickEntry({
                      pocket: 'project',
                      projectId: proj.id,
                      type: TransactionType.OUTFLOW,
                      outflowNature: 'operating_expense',
                    })
                  }
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/30 px-3.5 text-xs font-semibold text-[#EF4444] hover:bg-[#EF4444]/20"
                >
                  <span>- Charge</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onOpenQuickEntry({
                      pocket: 'project',
                      projectId: proj.id,
                      type: TransactionType.OUTFLOW,
                      outflowNature: 'stock_purchase',
                    })
                  }
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#F5B971]/40 bg-[#F5B971]/15 px-3.5 text-xs font-semibold text-[#F5B971] hover:bg-[#F5B971]/25"
                >
                  <Package className="h-3.5 w-3.5" />
                  <span>Approvisionner Stock</span>
                </button>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => openBorrowForm(proj.id)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-zinc-700 bg-[#0D0D0F] px-3.5 text-xs font-semibold text-zinc-200 hover:border-[#F5B971]/50"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5 text-[#F5B971]" />
                    <span>Emprunter au Perso</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-[#0D0D0F] px-3.5 py-2.5 text-xs text-zinc-400">
                <Lock className="h-3.5 w-3.5 text-[#F5B971]" />
                <span>
                  Accès Observateur (lecture seule) : vous consultez les résultats et stocks en temps réel sans modification possible.
                </span>
              </div>
            )}

            {/* Inline Borrow from Personal Modal/Panel */}
            {loanProjectId === proj.id && (
              <form
                onSubmit={handleCreateLoan}
                className="rounded-xl border border-[#F5B971]/40 bg-[#0D0D0F] p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-[#F5B971]">
                    Nouveau prêt interne (Compte Perso → {proj.name})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setLoanProjectId(null)}
                    className="text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    Annuler
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-zinc-400">
                      Depuis Compte Perso
                    </label>
                    <SupportPicker
                      supports={personalSupports}
                      selectedId={loanFromSupportId}
                      onSelect={setLoanFromSupportId}
                      currencies={currencies}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-zinc-400">
                      Vers Support Projet
                    </label>
                    <SupportPicker
                      supports={projSupports}
                      selectedId={loanToSupportId}
                      onSelect={setLoanToSupportId}
                      currencies={currencies}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Montant"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    className="col-span-2 h-10 rounded-lg border border-zinc-800 bg-[#141417] px-3 font-mono-num text-xs text-zinc-100"
                  />
                  <CustomSelect
                    value={loanCurrency}
                    onChange={(val) => setLoanCurrency(val)}
                    title="Devise du prêt interne"
                    searchable={false}
                    options={currencies.map((c) => ({
                      value: c.code,
                      label: `${c.code} — ${c.name}`,
                      badge: c.symbol,
                    }))}
                    renderSelected={(opt) => (
                      <span className="font-mono-num text-xs font-semibold text-[#F5B971]">
                        {opt?.value || loanCurrency}
                      </span>
                    )}
                    className="h-10 w-full rounded-lg border border-zinc-800 bg-[#141417] px-2.5 text-xs font-semibold text-[#F5B971] hover:border-zinc-700"
                  />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-zinc-400">
                      Date de rappel remboursement (optionnel)
                    </label>
                    <CustomDatePicker
                      value={loanReminderDate}
                      onChange={(val) => setLoanReminderDate(val)}
                      label="Date de rappel remboursement"
                      placeholder="Aucun rappel"
                      clearable
                      className="h-10 w-full rounded-lg border border-zinc-800 bg-[#141417] px-2.5 text-xs text-zinc-100 hover:border-zinc-700"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-zinc-400">
                      Ou délai en jours (ex: 7, 15, 30)
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Ex: 14 jours"
                      value={loanReminderDelayDays}
                      onChange={(e) => setLoanReminderDelayDays(e.target.value)}
                      className="h-10 w-full rounded-lg border border-zinc-800 bg-[#141417] px-2.5 font-mono-num text-xs text-zinc-100"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Motif du prêt interne (optionnel)"
                    value={loanNote}
                    onChange={(e) => setLoanNote(e.target.value)}
                    className="h-10 flex-1 rounded-lg border border-zinc-800 bg-[#141417] px-3 text-xs text-zinc-100"
                  />
                  <button
                    type="submit"
                    className="h-10 rounded-lg bg-[#F5B971] px-4 text-xs font-bold text-[#0D0D0F]"
                  >
                    Transférer
                  </button>
                </div>
              </form>
            )}

            {/* Active Internal Loans alert */}
            {projLoans.length > 0 && isOwner && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-2.5">
                <div className="text-xs font-semibold text-[#F5B971]">
                  Prêts internes à rembourser au Compte Personnel
                </div>
                {projLoans.map((loan) => (
                  <div
                    key={loan.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="text-zinc-200 font-medium">
                        {loan.note || 'Avance Compte Perso'}
                      </span>
                      <span className="text-zinc-500">
                        {' '}
                        · {formatShortDate(loan.date)}
                      </span>
                      <div className="font-mono-num text-[#F5B971] mt-0.5">
                        Restant à rembourser : {fmt(loan.remainingAmountFbu)} /{' '}
                        {fmt(loan.initialAmountFbu)}
                      </div>
                    </div>

                    {repayLoanId === loan.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          placeholder={String(loan.remainingAmountFbu)}
                          value={repayAmountFbu}
                          onChange={(e) => setRepayAmountFbu(e.target.value)}
                          className="h-9 w-28 rounded-lg border border-zinc-700 bg-[#0D0D0F] px-2 font-mono-num text-xs text-zinc-100"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            handleConfirmRepayLoan(
                              loan.id,
                              loan.remainingAmountFbu,
                              proj.id
                            )
                          }
                          className="h-9 rounded-lg bg-[#10B981] px-3 text-xs font-bold text-[#0D0D0F]"
                        >
                          Valider
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setRepayLoanId(loan.id);
                          setRepayAmountFbu(String(loan.remainingAmountFbu));
                        }}
                        className="h-9 rounded-lg border border-zinc-700 bg-[#18181B] px-3 text-xs font-semibold text-zinc-100 hover:border-[#10B981]"
                      >
                        Rembourser le Perso
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Evolution chart + Revenue sources */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-zinc-300">
                  Évolution du flux cumulé
                </h3>
                <EvolutionChart
                  transactions={state.transactions.filter(
                    (t) => t.projectId === proj.id
                  )}
                  positive={metric.netResultFbu >= 0}
                />
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-zinc-300">
                  Répartition des revenus par source
                </h3>
                <MultiSegmentBar
                  items={metric.revenueBreakdown.map((r) => ({
                    label: r.source,
                    amountFbu: r.amountFbu,
                    percent: r.percent,
                  }))}
                  formatValue={(val) => fmt(val)}
                />
              </div>
            </div>

            {/* Fund Supports on this project */}
            <div className="border-t border-zinc-800/70 pt-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-[#F5B971]" />
                  <h3 className="text-xs font-semibold text-zinc-300">
                    Supports de détention du projet
                  </h3>
                </div>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenSupportManager('project', proj.id, proj.name)
                    }
                    className="text-xs font-medium text-[#F5B971] hover:underline"
                  >
                    Ajouter / éditer un compte
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {projSupports.map((sup) => (
                  <div
                    key={sup.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-[#0D0D0F] px-3.5 py-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <SupportAvatar support={sup} size="md" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-zinc-200 truncate">
                          {sup.name}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {sup.type === SupportType.CASH
                            ? 'Cash'
                            : sup.type === SupportType.BANK
                            ? 'Banque'
                            : 'Mobile Money'}
                          {sup.reference ? ` · ${sup.reference}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono-num shrink-0 ml-2">
                      <div
                        className={`text-sm font-semibold ${
                          sup.balance < 0 ? 'text-[#EF4444]' : 'text-zinc-100'
                        }`}
                      >
                        {formatMoney(sup.balance, sup.currency, currencies)}
                      </div>
                      {sup.currency !== displayCurrency && (
                        <div className="text-[11px] text-zinc-500">
                          {fmt(convertToFbu(sup.balance, sup.currency, currencies))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Filterable Project Transactions */}
            <div className="border-t border-zinc-800/70 pt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-zinc-300">
                  Historique du projet ({projTransactions.length})
                </h3>
                <div className="inline-flex rounded-lg border border-zinc-800 bg-[#0D0D0F] p-0.5">
                  {(
                    [
                      { id: 'all', label: 'Tout' },
                      { id: 'inflow', label: 'Entrées' },
                      { id: 'outflow', label: 'Sorties' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setTxFilter(f.id)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        txFilter === f.id
                          ? 'bg-[#18181B] text-[#F5B971]'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {projTransactions.length === 0 ? (
                <p className="py-3 text-xs text-zinc-500">
                  Aucune transaction correspondante sur cette période.
                </p>
              ) : (
                <div className="divide-y divide-zinc-800/60">
                  {projTransactions.map((tx) => {
                    const isIn = tx.type === TransactionType.INFLOW;
                    const isStockPurchase = tx.outflowNature === 'stock_purchase';
                    return (
                      <div
                        key={tx.id}
                        className="flex items-start justify-between py-2.5 gap-3"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          {isIn ? (
                            <ArrowDownLeft className="mt-0.5 h-4 w-4 shrink-0 text-[#10B981]" />
                          ) : (
                            <ArrowUpRight
                              className={`mt-0.5 h-4 w-4 shrink-0 ${
                                isStockPurchase
                                  ? 'text-[#F5B971]'
                                  : 'text-[#EF4444]'
                              }`}
                            />
                          )}
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-medium text-zinc-200 truncate">
                                {tx.label}
                              </span>
                              {tx.type === TransactionType.OUTFLOW && (
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                    isStockPurchase
                                      ? 'bg-[#F5B971]/15 text-[#F5B971]'
                                      : 'bg-zinc-800 text-zinc-400'
                                  }`}
                                >
                                  {isStockPurchase
                                    ? 'Approvisionnement Stock'
                                    : 'Charge'}
                                </span>
                              )}
                              {tx.grossMarginFbu !== undefined && (
                                <span
                                  className={`rounded px-1.5 py-0.5 font-mono-num text-[10px] font-semibold ${
                                    tx.grossMarginFbu >= 0
                                      ? 'bg-[#10B981]/15 text-[#10B981]'
                                      : 'bg-[#EF4444]/15 text-[#EF4444]'
                                  }`}
                                >
                                  Marge : {fmt(tx.grossMarginFbu, { signed: true })}
                                </span>
                              )}
                            </div>

                            {tx.stockPurchaseLines &&
                              tx.stockPurchaseLines.length > 0 && (
                                <div className="text-[11px] text-zinc-400">
                                  Articles :{' '}
                                  {tx.stockPurchaseLines
                                    .map(
                                      (l) =>
                                        `${l.quantity} ${l.unit} ${l.itemName}`
                                    )
                                    .join(', ')}
                                </div>
                              )}

                            {tx.stockSaleLines && tx.stockSaleLines.length > 0 && (
                              <div className="text-[11px] text-zinc-400">
                                Stock vendu :{' '}
                                {tx.stockSaleLines
                                  .map(
                                    (l) =>
                                      `${l.quantity} ${l.unit} ${l.itemName}`
                                  )
                                  .join(', ')}
                              </div>
                            )}

                            <div className="text-xs text-zinc-500 truncate">
                              {tx.categoryOrSource || tx.paymentMethod} ·{' '}
                              {formatShortDate(tx.date)}
                              {tx.authorName ? ` · Par ${tx.authorName}` : ''}
                            </div>
                          </div>
                        </div>
                        <div
                          className={`font-mono-num text-sm font-semibold shrink-0 ${
                            isIn
                              ? 'text-[#10B981]'
                              : isStockPurchase
                              ? 'text-[#F5B971]'
                              : 'text-zinc-200'
                          }`}
                        >
                          {isIn ? '+' : '-'}
                          {fmt(tx.amountInFbu)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== SUBTAB 2: STOCK & INVENTAIRE ==================== */}
        {subTab === 'inventory' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-[#0D0D0F] p-3.5">
              <div>
                <div className="text-xs text-zinc-400">
                  Capital immobilisé en marchandises
                </div>
                <div className="mt-0.5 font-mono-num text-lg font-bold text-[#F5B971]">
                  {fmt(metric.stockValueFbu)}
                </div>
              </div>

              {canWrite && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddStock((v) => !v)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-700 bg-[#141417] px-3 text-xs font-semibold text-zinc-200 hover:border-[#F5B971]"
                  >
                    <Plus className="h-3.5 w-3.5 text-[#F5B971]" />
                    <span>Ajouter un produit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenQuickEntry({
                        pocket: 'project',
                        projectId: proj.id,
                        type: TransactionType.OUTFLOW,
                        outflowNature: 'stock_purchase',
                      })
                    }
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#F5B971] px-3 text-xs font-bold text-[#0D0D0F]"
                  >
                    <Package className="h-3.5 w-3.5" />
                    <span>Approvisionner</span>
                  </button>
                </div>
              )}
            </div>

            {showAddStock && canWrite && (
              <form
                onSubmit={(e) => void handleAddInventorySubmit(e, proj.id)}
                className="rounded-xl border border-[#F5B971]/40 bg-[#0D0D0F] p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#F5B971]">
                    Nouveau produit en inventaire (initialisation directe)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddStock(false)}
                    className="text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    Fermer
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    required
                    placeholder="Nom du produit (ex: Farine 25kg)"
                    value={stockName}
                    onChange={(e) => setStockName(e.target.value)}
                    className="h-10 rounded-lg border border-zinc-800 bg-[#141417] px-3 text-xs text-zinc-100"
                  />
                  <CustomSelect
                    value={stockUnit}
                    onChange={(val) => setStockUnit(val)}
                    title="Unité de stock"
                    searchable={false}
                    options={UNIT_OPTIONS.map((u) => ({
                      value: u,
                      label: `Unité : ${u}`,
                    }))}
                    className="h-10 w-full rounded-lg border border-zinc-800 bg-[#141417] px-3 text-xs text-zinc-100 hover:border-zinc-700"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-zinc-400">
                      Quantité actuelle
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      value={stockQty}
                      onChange={(e) => setStockQty(e.target.value)}
                      className="h-10 w-full rounded-lg border border-zinc-800 bg-[#141417] px-2.5 font-mono-num text-xs text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-zinc-400">
                      Coût unitaire (FBU)
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      value={stockUnitCost}
                      onChange={(e) => setStockUnitCost(e.target.value)}
                      className="h-10 w-full rounded-lg border border-zinc-800 bg-[#141417] px-2.5 font-mono-num text-xs text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-zinc-400">
                      Seuil d’alerte
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={stockMinThreshold}
                      onChange={(e) => setStockMinThreshold(e.target.value)}
                      className="h-10 w-full rounded-lg border border-zinc-800 bg-[#141417] px-2.5 font-mono-num text-xs text-zinc-100"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="h-10 w-full rounded-lg bg-[#F5B971] text-xs font-bold text-[#0D0D0F]"
                >
                  Ajouter au catalogue
                </button>
              </form>
            )}

            {metric.lowStockItems.length > 0 && (
              <div className="flex items-start gap-2.5 rounded-xl border border-[#EF4444]/40 bg-[#EF4444]/10 p-3 text-xs text-red-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#EF4444]" />
                <div>
                  <span className="font-semibold text-[#EF4444]">
                    Alerte stock faible :
                  </span>{' '}
                  {metric.lowStockItems
                    .map((i) => `${i.name} (${i.quantity} ${i.unit})`)
                    .join(', ')}
                  . Pensez à réapprovisionner avant rupture.
                </div>
              </div>
            )}

            {metric.inventoryItems.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-[#0D0D0F] p-6 text-center space-y-2">
                <Boxes className="mx-auto h-7 w-7 text-zinc-600" />
                <p className="text-xs text-zinc-400">
                  Aucun produit en inventaire pour ce projet. Enregistrez une sortie « Approvisionnement / Stock » pour alimenter automatiquement vos stocks et coûts moyens.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {metric.inventoryItems.map((item) => {
                  const isLow = item.quantity <= item.minStockThreshold;
                  const isOut = item.quantity <= 0;
                  const itemValueFbu = Math.round(
                    Math.max(0, item.quantity) * item.averageUnitCostFbu
                  );
                  const profitFbu =
                    item.totalSalesRevenueFbu - item.totalCogsFbu;
                  const prodMarginPct =
                    item.totalSalesRevenueFbu > 0
                      ? Math.round(
                          (profitFbu / item.totalSalesRevenueFbu) * 100
                        )
                      : null;

                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-3.5 space-y-2.5 ${
                        isLow
                          ? 'border-[#EF4444]/40 bg-[#EF4444]/5'
                          : 'border-zinc-800/80 bg-[#0D0D0F]'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-zinc-100">
                              {item.name}
                            </span>
                            {isOut ? (
                              <span className="rounded bg-[#EF4444]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#EF4444]">
                                Rupture de stock
                              </span>
                            ) : isLow ? (
                              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-[#F5B971]">
                                Stock faible (≤ {item.minStockThreshold})
                              </span>
                            ) : (
                              <span className="rounded bg-[#10B981]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#10B981]">
                                Disponible
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-zinc-400 font-mono-num">
                            Coût moyen :{' '}
                            {formatMoney(
                              item.averageUnitCostFbu,
                              'FBU',
                              currencies
                            )}{' '}
                            / {item.unit}
                          </div>
                        </div>

                        <div className="text-right font-mono-num">
                          <div className="text-sm font-bold text-zinc-100">
                            {item.quantity} {item.unit}
                          </div>
                          <div className="text-xs text-[#F5B971]">
                            Valeur : {fmt(itemValueFbu)}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/70 pt-2 text-[11px]">
                        <div className="text-zinc-400">
                          {item.totalSoldQty > 0 ? (
                            <span>
                              Vendu :{' '}
                              <strong className="text-zinc-200">
                                {item.totalSoldQty} {item.unit}
                              </strong>{' '}
                              · Marge générée :{' '}
                              <strong
                                className={
                                  profitFbu >= 0
                                    ? 'text-[#10B981]'
                                    : 'text-[#EF4444]'
                                }
                              >
                                {fmt(profitFbu, { signed: true })}
                                {prodMarginPct !== null
                                  ? ` (${prodMarginPct}%)`
                                  : ''}
                              </strong>
                            </span>
                          ) : (
                            <span>Aucune vente liée enregistrée</span>
                          )}
                        </div>

                        {canWrite && (
                          <div className="flex items-center gap-2">
                            {editingThresholdId === item.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  value={thresholdInput}
                                  onChange={(e) =>
                                    setThresholdInput(e.target.value)
                                  }
                                  className="h-7 w-14 rounded border border-zinc-700 bg-[#141417] px-1.5 text-center font-mono-num text-xs text-zinc-100"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const v = parseFloat(thresholdInput);
                                    if (!Number.isNaN(v)) {
                                      updateInventoryThreshold(item.id, v);
                                    }
                                    setEditingThresholdId(null);
                                  }}
                                  className="h-7 rounded bg-[#10B981] px-2 text-[10px] font-bold text-[#0D0D0F]"
                                >
                                  OK
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingThresholdId(item.id);
                                  setThresholdInput(
                                    String(item.minStockThreshold)
                                  );
                                }}
                                className="text-zinc-400 hover:text-zinc-200 underline"
                              >
                                Seuil ({item.minStockThreshold})
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                onOpenQuickEntry({
                                  pocket: 'project',
                                  projectId: proj.id,
                                  type: TransactionType.OUTFLOW,
                                  outflowNature: 'stock_purchase',
                                  stockItemId: item.id,
                                })
                              }
                              className="rounded-lg border border-[#F5B971]/40 bg-[#F5B971]/10 px-2.5 py-1 text-[11px] font-semibold text-[#F5B971] hover:bg-[#F5B971]/20"
                            >
                              + Réappro
                            </button>

                            {isOwner && (
                              <button
                                type="button"
                                onClick={() => deleteInventoryItem(item.id)}
                                aria-label="Supprimer l'article"
                                className="text-zinc-500 hover:text-[#EF4444]"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================== SUBTAB 3: ACTIVITÉ & ÉQUIPE ==================== */}
        {subTab === 'team' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-[#0D0D0F] p-3.5">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-zinc-200">
                  Collaboration isolée &amp; Synchronisation hybride
                </div>
                <div className="text-[11px] text-zinc-400">
                  {persistenceStatus.isOnline
                    ? 'Appareil en ligne'
                    : 'Mode hors-ligne (sauvegarde locale active)'}
                  {projPendingSyncCount > 0
                    ? ` · ${projPendingSyncCount} opération(s) en file d’attente`
                    : ''}
                  {proj.isShared && proj.inviteCode
                    ? ` · Code : ${proj.inviteCode}`
                    : ''}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={syncing}
                  onClick={() => void handleManualSync()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-700 bg-[#141417] px-3 text-xs font-medium text-zinc-200 hover:border-[#F5B971] disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`}
                  />
                  <span>Sync</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void haptics.tap();
                    setCollabMode('manage');
                    setCollabOpen(true);
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#F5B971] px-3 text-xs font-bold text-[#0D0D0F]"
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Gérer l’équipe ({projMembers.length || 1})</span>
                </button>
              </div>
            </div>

            {/* Timestamped Multi-User Activity Feed */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                <Clock className="h-3.5 w-3.5 text-[#F5B971]" />
                <span>Fil d’activité horodaté du projet</span>
              </div>

              {allProjTransactions.length === 0 ? (
                <p className="rounded-xl border border-zinc-800 bg-[#0D0D0F] p-4 text-xs text-zinc-500">
                  Aucune écriture collaborative enregistrée sur ce projet.
                </p>
              ) : (
                <div className="divide-y divide-zinc-800/70 rounded-xl border border-zinc-800 bg-[#0D0D0F]">
                  {allProjTransactions.slice(0, 30).map((tx) => {
                    const isIn = tx.type === TransactionType.INFLOW;
                    const roleText =
                      ROLE_DISPLAY[tx.authorRole ?? 'owner'] || 'Membre';
                    const timeStr = tx.createdAt
                      ? new Date(tx.createdAt).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '';
                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between gap-3 p-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F5B971]/15 text-[11px] font-bold text-[#F5B971]">
                            {tx.authorInitials || 'TM'}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs text-zinc-200 truncate">
                              <span className="font-semibold text-[#F5B971]">
                                {tx.authorName || roleText} ({roleText})
                              </span>{' '}
                              :{' '}
                              <span
                                className={`font-mono-num font-bold ${
                                  isIn ? 'text-[#10B981]' : 'text-zinc-100'
                                }`}
                              >
                                {isIn ? '+' : '-'}
                                {fmt(tx.amountInFbu)}
                              </span>{' '}
                              — {tx.label}
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              {formatShortDate(tx.date)}
                              {timeStr ? ` à ${timeStr}` : ''}
                              {tx.outflowNature === 'stock_purchase'
                                ? ' · Approvisionnement stock'
                                : tx.stockSaleLines?.length
                                ? ' · Vente liée au stock'
                                : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <ProjectCollaborationModal
        isOpen={collabOpen}
        onClose={() => setCollabOpen(false)}
        project={collabMode === 'join' ? null : proj}
        initialMode={collabMode}
        onJoinedProject={(pid) => {
          setSelectedProjectId(pid);
          setCollabOpen(false);
        }}
      />
    </div>
  );
};

