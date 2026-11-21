import React, { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Landmark,
  Plus,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { SegmentedProgressBar } from '../components/SegmentedBar';
import { StatusIndicator } from '../components/StatusIndicator';
import { SupportAvatar } from '../components/SupportAvatar';
import { UserAvatar } from '../components/UserAvatar';
import { DEFAULT_ACCOUNT_SECURITY } from '../data/initialData';
import { useFinance } from '../store/FinanceContext';
import {
  NavTab,
  PocketTarget,
  SupportType,
  TimePeriod,
  TransactionType,
} from '../types/finance';
import { generateStrategicReport } from '../utils/aiEngine';
import {
  convertToFbu,
  formatInDisplayCurrency,
  formatMoney,
  formatShortDate,
  isDateInPeriod,
} from '../utils/format';

interface HomeViewProps {
  onNavigate: (tab: NavTab) => void;
  onOpenQuickEntry: (opts?: { pocket?: PocketTarget; projectId?: string; type?: TransactionType }) => void;
  onOpenNewProject: () => void;
  onOpenSupportManager: (ownerType: 'personal' | 'project', ownerId: string, title: string) => void;
  onOpenProfile: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onNavigate,
  onOpenQuickEntry,
  onOpenNewProject,
  onOpenSupportManager,
  onOpenProfile,
}) => {
  const { state, metrics, setPeriod, setDisplayCurrency, privacyMode, togglePrivacyMode } =
    useFinance();
  const { displayCurrency, currencies, period } = state.settings;
  const account = state.settings.account ?? DEFAULT_ACCOUNT_SECURITY;

  const [expanded, setExpanded] = useState<{
    personal: boolean;
    projects: boolean;
    savings: boolean;
    debts: boolean;
  }>({
    personal: true,
    projects: true,
    savings: false,
    debts: false,
  });

  const toggleSection = (key: keyof typeof expanded) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getCurrencySymbol = (code: string) => {
    const found = currencies.find((c) => c.code === code);
    return found?.symbol ?? code;
  };

  const fmt = (fbu: number, opts?: { compact?: boolean; signed?: boolean }) => {
    if (privacyMode) {
      return `•••••• ${getCurrencySymbol(displayCurrency)}`;
    }
    return formatInDisplayCurrency(fbu, displayCurrency, currencies, opts);
  };

  const fmtSupport = (balance: number, currencyCode: string) => {
    if (privacyMode) {
      return `•••••• ${getCurrencySymbol(currencyCode)}`;
    }
    return formatMoney(balance, currencyCode, currencies);
  };

  const report = generateStrategicReport(state, period === 'week' ? 'week' : 'month');

  const personalSupports = state.supports.filter((s) => s.ownerType === 'personal');
  const personalTxs = state.transactions.filter(
    (t) => t.pocket === 'personal' && isDateInPeriod(t.date, period)
  );
  const personalInflows = personalTxs
    .filter((t) => t.type === TransactionType.INFLOW)
    .reduce((acc, t) => acc + t.amountInFbu, 0);
  const personalOutflows = personalTxs
    .filter((t) => t.type === TransactionType.OUTFLOW)
    .reduce((acc, t) => acc + t.amountInFbu, 0);
  const personalNet = personalInflows - personalOutflows;

  const activeDebts = state.debts.filter((d) => d.direction === 'debt' && d.remainingAmountFbu > 0);

  return (
    <div className="space-y-5">
      {/* Clickable User Profile Header */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onOpenProfile}
          className="group flex items-center gap-3 rounded-2xl border border-zinc-800/80 bg-[#141417] px-3.5 py-2.5 text-left transition-colors hover:border-[#F5B971]/60 min-w-0"
        >
          <UserAvatar
            name={account.displayName}
            avatarDataUrl={account.avatarDataUrl}
            size="md"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-display text-sm font-bold text-zinc-100 group-hover:text-[#F5B971] transition-colors">
                {account.displayName}
              </span>
            </div>
            <p className="truncate text-[11px] text-zinc-400">
              {account.mode === 'cloud_ready'
                ? account.email
                  ? `Connecté · ${account.email}`
                  : 'Profil synchronisé'
                : account.mode === 'local_profile'
                ? 'Profil local · Hors ligne'
                : 'Mode Invité · Toucher pour configurer'}
            </p>
          </div>
        </button>
      </div>

      {/* Toolbar: Period filter + Discreet Privacy Toggle + Desktop currency selector */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div
            className="inline-flex items-center rounded-xl border border-zinc-800/80 bg-[#141417] p-1"
            role="group"
            aria-label="Filtre de période"
          >
            {(
              [
                { id: 'week', label: 'Semaine' },
                { id: 'month', label: 'Mois' },
                { id: 'all', label: 'Tout' },
              ] as { id: TimePeriod; label: string }[]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriod(item.id)}
                className={`min-h-[36px] rounded-lg px-3.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  period === item.id
                    ? 'bg-[#18181B] text-[#F5B971] border border-zinc-700/80'
                    : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={togglePrivacyMode}
            aria-label={privacyMode ? 'Désactiver le mode discret' : 'Activer le mode discret'}
            aria-pressed={privacyMode}
            title={privacyMode ? 'Afficher les montants' : 'Mode discret (ou secouez le téléphone)'}
            className={`flex h-11 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors whitespace-nowrap ${
              privacyMode
                ? 'border-[#F5B971]/60 bg-[#F5B971]/15 text-[#F5B971]'
                : 'border-zinc-800/80 bg-[#141417] text-zinc-400 hover:text-zinc-100'
            }`}
          >
            {privacyMode ? (
              <EyeOff className="h-4 w-4 shrink-0" />
            ) : (
              <Eye className="h-4 w-4 shrink-0" />
            )}
            <span className="hidden sm:inline">{privacyMode ? 'Discret' : 'Masquer'}</span>
          </button>
        </div>

        <div className="hidden lg:flex items-center gap-2">
          <span className="text-xs text-zinc-500">Devise :</span>
          <div className="inline-flex items-center rounded-xl border border-zinc-800/80 bg-[#141417] p-1">
            {currencies.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => setDisplayCurrency(c.code)}
                className={`min-h-[34px] rounded-lg px-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  displayCurrency === c.code
                    ? 'bg-[#F5B971] text-[#0D0D0F]'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {c.code}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top 4 KPI Summary Cards */}
      <section aria-label="Synthèse financière" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* KPI 1: Solde Total Géré */}
        <div className="col-span-2 sm:col-span-1 rounded-2xl border border-zinc-800/80 bg-[#141417] p-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Solde total géré</span>
            <Wallet className="h-4 w-4 text-[#F5B971]" />
          </div>
          <div className="mt-2 font-mono-num text-2xl font-bold tracking-tight text-zinc-100">
            {fmt(metrics.totalManagedFbu)}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-xs">
            <span className={metrics.periodNetFbu >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}>
              Flux net : {fmt(metrics.periodNetFbu, { signed: true })}
            </span>
          </div>
        </div>

        {/* KPI 2: Cash Dispo */}
        <div className="rounded-2xl border border-zinc-800/80 bg-[#141417] p-4">
          <div className="text-xs text-zinc-400">Dispo en liquide (Cash)</div>
          <div className="mt-2 font-mono-num text-xl font-bold text-zinc-100 sm:text-2xl">
            {fmt(metrics.totalCashFbu)}
          </div>
          <div className="mt-1.5 text-xs text-zinc-500">
            {privacyMode
              ? '••% du solde total'
              : metrics.totalManagedFbu > 0
              ? `${Math.round((metrics.totalCashFbu / metrics.totalManagedFbu) * 100)}% du solde total`
              : 'Perso + Projets'}
          </div>
        </div>

        {/* KPI 3: Banque & Mobile Money */}
        <div className="rounded-2xl border border-zinc-800/80 bg-[#141417] p-4">
          <div className="text-xs text-zinc-400">Banque &amp; Mobile Money</div>
          <div className="mt-2 font-mono-num text-xl font-bold text-[#10B981] sm:text-2xl">
            {fmt(metrics.totalBankMomoFbu)}
          </div>
          <div className="mt-1.5 text-xs text-zinc-500">
            {state.supports.filter((s) => s.type !== SupportType.CASH).length} comptes actifs
          </div>
        </div>

        {/* KPI 4: Total Dettes */}
        <div className="col-span-2 sm:col-span-1 rounded-2xl border border-zinc-800/80 bg-[#141417] p-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Total des dettes</span>
            <Landmark className="h-4 w-4 text-zinc-500" />
          </div>
          <div
            className={`mt-2 font-mono-num text-xl font-bold sm:text-2xl ${
              metrics.totalDebtsFbu > 0 ? 'text-[#EF4444]' : 'text-zinc-100'
            }`}
          >
            {fmt(metrics.totalDebtsFbu)}
          </div>
          <div className="mt-1.5 text-xs text-zinc-500">
            {metrics.totalInternalLoansDueFbu > 0
              ? `Prêts internes dus : ${fmt(metrics.totalInternalLoansDueFbu)}`
              : metrics.totalReceivablesFbu > 0
              ? `Créances : ${fmt(metrics.totalReceivablesFbu)}`
              : 'Aucune dette critique'}
          </div>
        </div>
      </section>

      {/* Quick AI Strategic Alert Banner */}
      <button
        type="button"
        onClick={() => onNavigate('ai_coach')}
        className="flex w-full items-start justify-between gap-3 rounded-2xl border border-zinc-800/80 bg-[#18181B] p-4 text-left transition-colors hover:border-[#F5B971]/50"
      >
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              report.globalHealth === 'redline'
                ? 'bg-[#EF4444]/15 text-[#EF4444]'
                : 'bg-[#F5B971]/15 text-[#F5B971]'
            }`}
          >
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span className="font-semibold text-[#F5B971]">Synthèse IA Coach</span>
              <span aria-hidden="true">·</span>
              <span>{report.periodLabel}</span>
            </div>
            <p className="mt-1 text-sm font-medium text-zinc-100">
              {privacyMode
                ? 'Synthèse financière masquée (Mode discret actif)'
                : report.headline}
            </p>
            <p className="mt-0.5 text-xs text-zinc-400 line-clamp-2">
              {privacyMode
                ? 'Secouez le poignet ou touchez l’icône œil pour réafficher vos montants.'
                : report.recommendedProject
                ? `Priorité d’investissement : ${report.recommendedProject.name} (${report.recommendedProject.marginPercent}% de marge).`
                : report.summaryText}
            </p>
          </div>
        </div>
        <span className="shrink-0 text-xs font-medium text-[#F5B971] self-center whitespace-nowrap">
          Analyser →
        </span>
      </button>

      {/* Collapsible Category Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        {/* 1. COMPTE PERSONNEL */}
        <section className="rounded-2xl border border-zinc-800/80 bg-[#141417]">
          <button
            type="button"
            onClick={() => toggleSection('personal')}
            className="flex w-full items-center justify-between gap-3 p-4 text-left"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-bold text-zinc-100">
                  Compte Personnel
                </h2>
                <span className="text-xs text-zinc-500">· {personalSupports.length} supports</span>
              </div>
              <p className="mt-0.5 text-xs text-zinc-400">
                Entrées {fmt(personalInflows)} · Sorties {fmt(personalOutflows)}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <div className="font-mono-num text-base font-bold text-zinc-100">
                  {fmt(metrics.totalPersonalFbu)}
                </div>
                <div
                  className={`font-mono-num text-xs ${
                    personalNet >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                  }`}
                >
                  {fmt(personalNet, { signed: true })}
                </div>
              </div>
              {expanded.personal ? (
                <ChevronUp className="h-4 w-4 text-zinc-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-zinc-500" />
              )}
            </div>
          </button>

          {expanded.personal && (
            <div className="border-t border-zinc-800/70 px-4 pb-4 pt-3 space-y-4">
              {/* Supports breakdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-400">
                    Localisation des fonds (Cash &amp; Comptes)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenSupportManager('personal', 'personal', 'Compte Personnel')
                    }
                    className="text-xs font-medium text-[#F5B971] hover:underline"
                  >
                    Gérer les comptes
                  </button>
                </div>

                <div className="divide-y divide-zinc-800/60">
                  {personalSupports.map((sup) => {
                    const fbuVal = convertToFbu(sup.balance, sup.currency, currencies);
                    return (
                      <div
                        key={sup.id}
                        className="flex items-center justify-between py-2.5 text-sm"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <SupportAvatar support={sup} size="md" />
                          <div className="min-w-0">
                            <div className="font-medium text-zinc-200 truncate">{sup.name}</div>
                            <div className="text-xs text-zinc-500">
                              {sup.type === SupportType.CASH
                                ? 'Cash liquide'
                                : sup.type === SupportType.BANK
                                ? 'Compte bancaire'
                                : 'Mobile Money'}
                              {sup.reference ? ` · ${sup.reference}` : ''}
                            </div>
                          </div>
                        </div>
                        <div className="text-right font-mono-num shrink-0 ml-3">
                          <div className="font-semibold text-zinc-100">
                            {fmtSupport(sup.balance, sup.currency)}
                          </div>
                          {sup.currency !== displayCurrency && (
                            <div className="text-[11px] text-zinc-500">{fmt(fbuVal)}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent personal transactions */}
              <div className="border-t border-zinc-800/70 pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-400">
                    Derniers mouvements perso
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenQuickEntry({ pocket: 'personal', type: TransactionType.OUTFLOW })
                    }
                    className="text-xs font-medium text-zinc-300 hover:text-[#F5B971]"
                  >
                    + Mouvement
                  </button>
                </div>
                {personalTxs.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-2">
                    Aucun mouvement personnel sur cette période.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {personalTxs.slice(0, 4).map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between text-xs py-1"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {tx.type === TransactionType.INFLOW ? (
                            <ArrowDownLeft className="h-3.5 w-3.5 shrink-0 text-[#10B981]" />
                          ) : (
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#EF4444]" />
                          )}
                          <span className="truncate text-zinc-200">{tx.label}</span>
                          <span className="text-zinc-500 shrink-0">
                            · {formatShortDate(tx.date)}
                          </span>
                        </div>
                        <span
                          className={`font-mono-num font-semibold shrink-0 ml-2 ${
                            privacyMode
                              ? 'text-zinc-400'
                              : tx.type === TransactionType.INFLOW
                              ? 'text-[#10B981]'
                              : 'text-zinc-200'
                          }`}
                        >
                          {privacyMode
                            ? fmt(tx.amountInFbu)
                            : `${tx.type === TransactionType.INFLOW ? '+' : '-'}${fmt(tx.amountInFbu)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* 2. PROJETS */}
        <section className="rounded-2xl border border-zinc-800/80 bg-[#141417]">
          <button
            type="button"
            onClick={() => toggleSection('projects')}
            className="flex w-full items-center justify-between gap-3 p-4 text-left"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-bold text-zinc-100">Projets</h2>
                <span className="text-xs text-zinc-500">
                  · {metrics.projectMetrics.length} actif{metrics.projectMetrics.length > 1 ? 's' : ''}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-zinc-400">
                Trésorerie multi-projets &amp; traçabilité
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right font-mono-num text-base font-bold text-zinc-100">
                {fmt(metrics.totalProjectsFbu)}
              </div>
              {expanded.projects ? (
                <ChevronUp className="h-4 w-4 text-zinc-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-zinc-500" />
              )}
            </div>
          </button>

          {expanded.projects && (
            <div className="border-t border-zinc-800/70 px-4 pb-4 pt-3 space-y-3">
              {metrics.projectMetrics.length === 0 ? (
                <div className="py-4 text-center space-y-2">
                  <p className="text-xs text-zinc-400">
                    Aucun projet configuré. Créez votre premier projet librement.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/60">
                  {metrics.projectMetrics.map((pm) => (
                    <div
                      key={pm.project.id}
                      onClick={() => onNavigate('projects')}
                      className="cursor-pointer py-3 first:pt-1 transition-colors hover:bg-zinc-900/40 rounded-lg px-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-zinc-100">
                              {pm.project.name}
                            </span>
                            <StatusIndicator status={pm.status} label={pm.statusLabel} />
                          </div>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {pm.project.customCategory || pm.project.category} · Cash{' '}
                            {fmt(pm.cashBalanceFbu, { compact: true })} · Banque/MM{' '}
                            {fmt(pm.bankMomoBalanceFbu, { compact: true })}
                          </p>
                        </div>
                        <div className="text-right font-mono-num shrink-0">
                          <div className="text-sm font-bold text-zinc-100">
                            {fmt(pm.totalBalanceFbu)}
                          </div>
                          <div
                            className={`text-xs ${
                              pm.netFlowFbu >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                            }`}
                          >
                            Net : {fmt(pm.netFlowFbu, { signed: true })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={onOpenNewProject}
                className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-700 bg-[#0D0D0F] text-xs font-semibold text-[#F5B971] hover:border-[#F5B971] transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Ajouter un projet</span>
              </button>
            </div>
          )}
        </section>

        {/* 3. ÉPARGNE */}
        <section className="rounded-2xl border border-zinc-800/80 bg-[#141417]">
          <button
            type="button"
            onClick={() => toggleSection('savings')}
            className="flex w-full items-center justify-between gap-3 p-4 text-left"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-bold text-zinc-100">Épargne</h2>
                <span className="text-xs text-zinc-500">
                  · {state.savingsGoals.length} poche{state.savingsGoals.length > 1 ? 's' : ''}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-zinc-400">
                Objectifs &amp; réserves sécurisées
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right font-mono-num text-base font-bold text-[#10B981]">
                {fmt(metrics.totalSavingsFbu)}
              </div>
              {expanded.savings ? (
                <ChevronUp className="h-4 w-4 text-zinc-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-zinc-500" />
              )}
            </div>
          </button>

          {expanded.savings && (
            <div className="border-t border-zinc-800/70 px-4 pb-4 pt-3 space-y-3">
              {state.savingsGoals.length === 0 ? (
                <p className="text-xs text-zinc-500 py-2">
                  Aucune poche d’épargne créée.
                </p>
              ) : (
                state.savingsGoals.map((goal) => {
                  const pct =
                    goal.targetAmountFbu > 0
                      ? Math.min(100, Math.round((goal.currentAmountFbu / goal.targetAmountFbu) * 100))
                      : 0;
                  return (
                    <div key={goal.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-zinc-200">{goal.name}</span>
                        <span className="font-mono-num text-zinc-400">
                          {fmt(goal.currentAmountFbu)} / {fmt(goal.targetAmountFbu)} ({pct}%)
                        </span>
                      </div>
                      <SegmentedProgressBar
                        percent={pct}
                        tone={pct >= 100 ? 'emerald' : 'amber'}
                        segments={16}
                        heightClass="h-1.5"
                      />
                    </div>
                  );
                })
              )}
              <button
                type="button"
                onClick={() => onNavigate('debts_savings')}
                className="text-xs font-medium text-[#F5B971] hover:underline"
              >
                Gérer les objectifs d’épargne →
              </button>
            </div>
          )}
        </section>

        {/* 4. DETTES */}
        <section className="rounded-2xl border border-zinc-800/80 bg-[#141417]">
          <button
            type="button"
            onClick={() => toggleSection('debts')}
            className="flex w-full items-center justify-between gap-3 p-4 text-left"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-bold text-zinc-100">Dettes</h2>
                <span className="text-xs text-zinc-500">
                  · {activeDebts.length} active{activeDebts.length > 1 ? 's' : ''}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-zinc-400">
                Restant dû &amp; remboursements rapides
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div
                className={`text-right font-mono-num text-base font-bold ${
                  metrics.totalDebtsFbu > 0 ? 'text-[#EF4444]' : 'text-zinc-100'
                }`}
              >
                {fmt(metrics.totalDebtsFbu)}
              </div>
              {expanded.debts ? (
                <ChevronUp className="h-4 w-4 text-zinc-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-zinc-500" />
              )}
            </div>
          </button>

          {expanded.debts && (
            <div className="border-t border-zinc-800/70 px-4 pb-4 pt-3 space-y-3">
              {activeDebts.length === 0 ? (
                <p className="text-xs text-zinc-500 py-2">
                  Aucune dette en cours.
                </p>
              ) : (
                activeDebts.map((debt) => {
                  const repaidPct =
                    debt.initialAmountFbu > 0
                      ? Math.round(
                          ((debt.initialAmountFbu - debt.remainingAmountFbu) /
                            debt.initialAmountFbu) *
                            100
                        )
                      : 0;
                  return (
                    <div key={debt.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-zinc-200">{debt.personName}</span>
                        <span className="font-mono-num text-[#EF4444]">
                          Reste {fmt(debt.remainingAmountFbu)}
                        </span>
                      </div>
                      <SegmentedProgressBar
                        percent={repaidPct}
                        tone="emerald"
                        segments={16}
                        heightClass="h-1.5"
                      />
                    </div>
                  );
                })
              )}
              <button
                type="button"
                onClick={() => onNavigate('debts_savings')}
                className="text-xs font-medium text-[#F5B971] hover:underline"
              >
                Rembourser ou ajouter une dette →
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
