import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react';
import { EvolutionChart, MultiSegmentBar } from '../components/SegmentedBar';
import { StatusIndicator } from '../components/StatusIndicator';
import { SupportAvatar } from '../components/SupportAvatar';
import { SupportPicker } from '../components/SupportPicker';
import { useFinance } from '../store/FinanceContext';
import { PocketTarget, Project, SupportType, TransactionType } from '../types/finance';
import {
  convertToFbu,
  formatInDisplayCurrency,
  formatMoney,
  formatShortDate,
  getTodayISO,
  isDateInPeriod,
} from '../utils/format';

interface ProjectsViewProps {
  onOpenProjectForm: (project?: Project) => void;
  onOpenQuickEntry: (opts: { pocket: PocketTarget; projectId: string; type: TransactionType }) => void;
  onOpenSupportManager: (ownerType: 'personal' | 'project', ownerId: string, title: string) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  onOpenProjectForm,
  onOpenQuickEntry,
  onOpenSupportManager,
}) => {
  const {
    state,
    metrics,
    createInternalLoan,
    repayInternalLoan,
    deleteProject,
  } = useFinance();

  const { displayCurrency, currencies, period } = state.settings;
  const fmt = (fbu: number, opts?: { compact?: boolean; signed?: boolean }) =>
    formatInDisplayCurrency(fbu, displayCurrency, currencies, opts);

  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    state.projects[0]?.id || ''
  );
  const [txFilter, setTxFilter] = useState<'all' | 'inflow' | 'outflow'>('all');

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

  const personalSupports = state.supports.filter((s) => s.ownerType === 'personal');

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
      reminderDelayDays: !Number.isNaN(delayNum) && delayNum > 0 ? delayNum : undefined,
      note: loanNote || 'Avance Compte Perso → Projet',
    });
    setLoanProjectId(null);
  };

  const handleConfirmRepayLoan = (loanId: string, maxFbu: number, projId: string) => {
    const val = parseFloat(repayAmountFbu) || maxFbu;
    const projSup =
      state.supports.find((s) => s.ownerType === 'project' && s.ownerId === projId)?.id || '';
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

  if (metrics.projectMetrics.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800/80 bg-[#141417] p-8 text-center space-y-4">
        <h2 className="font-display text-lg font-bold text-zinc-100">
          Aucun projet configuré
        </h2>
        <p className="mx-auto max-w-md text-sm text-zinc-400">
          Créez librement vos projets (Restauration, Business, Immobilier, Services...) avec leurs propres comptes bancaires, sources de revenus et postes de dépenses.
        </p>
        <button
          type="button"
          onClick={() => onOpenProjectForm()}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#F5B971] px-5 text-sm font-bold text-[#0D0D0F]"
        >
          <Plus className="h-4 w-4" />
          <span>Nouveau Projet</span>
        </button>
      </div>
    );
  }

  const proj = activeMetric!.project;
  const projSupports = state.supports.filter(
    (s) => s.ownerType === 'project' && s.ownerId === proj.id
  );
  const projLoans = state.internalLoans.filter(
    (l) => l.projectId === proj.id && l.status === 'active'
  );
  const projTransactions = state.transactions
    .filter(
      (t) =>
        t.projectId === proj.id &&
        isDateInPeriod(t.date, period) &&
        (txFilter === 'all' ||
          (txFilter === 'inflow' && t.type === TransactionType.INFLOW) ||
          (txFilter === 'outflow' && t.type === TransactionType.OUTFLOW))
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-5">
      {/* Header row + Project selector tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          {metrics.projectMetrics.map((pm) => {
            const active = pm.project.id === proj.id;
            return (
              <button
                key={pm.project.id}
                type="button"
                onClick={() => setSelectedProjectId(pm.project.id)}
                className={`min-h-[40px] shrink-0 rounded-xl px-3.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#18181B] text-[#F5B971] border border-[#F5B971]/50'
                    : 'bg-[#141417] text-zinc-400 border border-zinc-800/80 hover:text-zinc-100'
                }`}
              >
                {pm.project.name}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onOpenProjectForm()}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#F5B971] px-4 text-xs font-bold text-[#0D0D0F] whitespace-nowrap shrink-0 hover:bg-[#f7c587]"
        >
          <Plus className="h-4 w-4" />
          <span>Nouveau Projet</span>
        </button>
      </div>

      {/* Main Active Project Card */}
      <div className="rounded-2xl border border-zinc-800/80 bg-[#141417] p-4 sm:p-5 space-y-5">
        {/* Top Project Identity & Actions */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-display text-xl font-bold text-zinc-100">{proj.name}</h2>
              <StatusIndicator
                status={activeMetric!.status}
                label={activeMetric!.statusLabel}
              />
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              {proj.customCategory || proj.category}
              {proj.description ? ` · ${proj.description}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenProjectForm(proj)}
              aria-label="Modifier ce projet"
              className="flex h-10 items-center gap-1.5 rounded-xl border border-zinc-800 bg-[#0D0D0F] px-3 text-xs font-medium text-zinc-300 hover:border-zinc-700"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Configurer</span>
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
          </div>
        </div>

        {/* KPIs & Quick Project Actions */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 border-y border-zinc-800/70 py-4">
          <div>
            <div className="text-xs text-zinc-500">Solde cumulé</div>
            <div className="mt-1 font-mono-num text-lg font-bold text-zinc-100">
              {fmt(activeMetric!.totalBalanceFbu)}
            </div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Entrées (période)</div>
            <div className="mt-1 font-mono-num text-lg font-bold text-[#10B981]">
              +{fmt(activeMetric!.inflowsFbu)}
            </div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Sorties (période)</div>
            <div className="mt-1 font-mono-num text-lg font-bold text-[#EF4444]">
              -{fmt(activeMetric!.outflowsFbu)}
            </div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Flux net · Marge</div>
            <div
              className={`mt-1 font-mono-num text-lg font-bold ${
                activeMetric!.netFlowFbu >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
              }`}
            >
              {fmt(activeMetric!.netFlowFbu, { signed: true })} ({activeMetric!.marginPercent}%)
            </div>
          </div>
        </div>

        {/* Action buttons row */}
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
            <span>Entrée projet</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onOpenQuickEntry({
                pocket: 'project',
                projectId: proj.id,
                type: TransactionType.OUTFLOW,
              })
            }
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/30 px-3.5 text-xs font-semibold text-[#EF4444] hover:bg-[#EF4444]/20"
          >
            <span>- Sortie projet</span>
          </button>
          <button
            type="button"
            onClick={() => openBorrowForm(proj.id)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#F5B971]/40 bg-[#F5B971]/10 px-3.5 text-xs font-semibold text-[#F5B971] hover:bg-[#F5B971]/20"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span>Emprunter au Compte Perso</span>
          </button>
        </div>

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
              <select
                value={loanCurrency}
                onChange={(e) => setLoanCurrency(e.target.value)}
                className="h-10 rounded-lg border border-zinc-800 bg-[#141417] px-2 text-xs font-semibold text-[#F5B971]"
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] text-zinc-400">
                  Date de rappel remboursement (optionnel)
                </label>
                <input
                  type="date"
                  value={loanReminderDate}
                  onChange={(e) => setLoanReminderDate(e.target.value)}
                  className="h-10 w-full rounded-lg border border-zinc-800 bg-[#141417] px-2.5 text-xs text-zinc-100"
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
        {projLoans.length > 0 && (
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
                  <span className="text-zinc-500"> · {formatShortDate(loan.date)}</span>
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
              transactions={state.transactions.filter((t) => t.projectId === proj.id)}
              positive={activeMetric!.netFlowFbu >= 0}
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-zinc-300">
              Répartition des revenus par source
            </h3>
            <MultiSegmentBar
              items={activeMetric!.revenueBreakdown.map((r) => ({
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
            <button
              type="button"
              onClick={() => onOpenSupportManager('project', proj.id, proj.name)}
              className="text-xs font-medium text-[#F5B971] hover:underline"
            >
              Ajouter / éditer un compte
            </button>
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
                    <div className="text-sm font-medium text-zinc-200 truncate">{sup.name}</div>
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
                  <div className="text-sm font-semibold text-zinc-100">
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
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-2.5 gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isIn ? (
                        <ArrowDownLeft className="h-4 w-4 shrink-0 text-[#10B981]" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-[#EF4444]" />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-zinc-200 truncate">
                          {tx.label}
                        </div>
                        <div className="text-xs text-zinc-500 truncate">
                          {tx.categoryOrSource || tx.paymentMethod} · {formatShortDate(tx.date)}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`font-mono-num text-sm font-semibold shrink-0 ${
                        isIn ? 'text-[#10B981]' : 'text-zinc-200'
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
    </div>
  );
};
