import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Minus,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { CustomDatePicker } from '../components/CustomDatePicker';
import { CustomSelect } from '../components/CustomSelect';
import { SegmentedProgressBar } from '../components/SegmentedBar';
import { SupportAvatar } from '../components/SupportAvatar';
import { useFinance } from '../store/FinanceContext';
import { DebtEntry, DebtItem, DebtRepayment, SavingsGoal } from '../types/finance';
import {
  convertFromFbu,
  convertToFbu,
  formatInDisplayCurrency,
  formatMoney,
  formatShortDate,
  getTodayISO,
} from '../utils/format';
import { haptics } from '../utils/haptics';

function getNormalizedEntries(item: DebtItem): DebtEntry[] {
  if (Array.isArray(item.entries) && item.entries.length > 0) {
    return item.entries;
  }
  return [
    {
      id: `${item.id}_init`,
      amountFbu: item.initialAmountFbu,
      currency: item.currency,
      date: item.date,
      note: item.note,
    },
  ];
}

export const DebtsSavingsView: React.FC = () => {
  const {
    state,
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
  } = useFinance();

  const { displayCurrency, currencies } = state.settings;
  const fmt = (fbu: number) =>
    formatInDisplayCurrency(fbu, displayCurrency, currencies);

  // Debt / Receivable toggle & top add form
  const [debtDirection, setDebtDirection] = useState<'debt' | 'receivable'>('debt');
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [personName, setPersonName] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [debtCurrency, setDebtCurrency] = useState('FBU');
  const [debtDate, setDebtDate] = useState(getTodayISO());
  const [debtDueDate, setDebtDueDate] = useState('');
  const [debtNote, setDebtNote] = useState('');
  const [debtSupportId, setDebtSupportId] = useState('');

  // Expand history per debt card
  const [expandedDebtIds, setExpandedDebtIds] = useState<Record<string, boolean>>({});

  // Add tranche / new line under an existing person
  const [addingEntryDebtId, setAddingEntryDebtId] = useState<string | null>(null);
  const [entryAmount, setEntryAmount] = useState('');
  const [entryCurrency, setEntryCurrency] = useState('FBU');
  const [entryDate, setEntryDate] = useState(getTodayISO());
  const [entryNote, setEntryNote] = useState('');
  const [entrySupportId, setEntrySupportId] = useState('');

  // Edit debt card header
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [editPersonName, setEditPersonName] = useState('');
  const [editDebtDirection, setEditDebtDirection] = useState<'debt' | 'receivable'>('debt');
  const [editDebtDueDate, setEditDebtDueDate] = useState('');
  const [editDebtNote, setEditDebtNote] = useState('');

  // Edit single entry (tranche)
  const [editingEntryKey, setEditingEntryKey] = useState<{
    debtId: string;
    entryId: string;
  } | null>(null);
  const [editEntryAmount, setEditEntryAmount] = useState('');
  const [editEntryDate, setEditEntryDate] = useState(getTodayISO());
  const [editEntryNote, setEditEntryNote] = useState('');
  const [editEntrySupportId, setEditEntrySupportId] = useState('');

  // Edit single repayment
  const [editingRepayKey, setEditingRepayKey] = useState<{
    debtId: string;
    repaymentId: string;
  } | null>(null);
  const [editRepayAmount, setEditRepayAmount] = useState('');
  const [editRepayDate, setEditRepayDate] = useState(getTodayISO());
  const [editRepayNote, setEditRepayNote] = useState('');
  const [editRepaySupportId, setEditRepaySupportId] = useState('');

  // Inline partial repayment state
  const [repayingId, setRepayingId] = useState<string | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayDate, setRepayDate] = useState(getTodayISO());
  const [repayNote, setRepayNote] = useState('');
  const [repaySupportId, setRepaySupportId] = useState(state.supports[0]?.id || '');

  // Confirm delete keys (2-tap inline confirmation)
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);

  // Savings goal form
  const [showSavingsForm, setShowSavingsForm] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalInitial, setGoalInitial] = useState('');
  const [goalNote, setGoalNote] = useState('');

  // Edit savings goal inline state
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editGoalName, setEditGoalName] = useState('');
  const [editGoalTarget, setEditGoalTarget] = useState('');
  const [editGoalCurrent, setEditGoalCurrent] = useState('');
  const [editGoalNote, setEditGoalNote] = useState('');

  // Adjust savings inline state
  const [adjustingGoalId, setAdjustingGoalId] = useState<string | null>(null);
  const [adjustMode, setAdjustMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustSupportId, setAdjustSupportId] = useState(state.supports[0]?.id || '');

  const filteredDebts = state.debts.filter((d) => d.direction === debtDirection);

  const matchingExistingDebt = useMemo(() => {
    const clean = personName.trim().toLowerCase();
    if (!clean) return null;
    return (
      state.debts.find(
        (d) =>
          d.direction === debtDirection &&
          d.personName.trim().toLowerCase() === clean
      ) || null
    );
  }, [personName, debtDirection, state.debts]);

  const supportOptions = useMemo(
    () => [
      {
        value: '',
        label: 'Sans mouvement de compte',
        sublabel: 'Mettre à jour uniquement le suivi',
      },
      ...state.supports.map((s) => ({
        value: s.id,
        label: s.name,
        badge: formatMoney(s.balance, s.currency, currencies),
        icon: <SupportAvatar support={s} size="sm" />,
      })),
    ],
    [state.supports, currencies]
  );

  const handleCreateDebt = async (
    e: React.FormEvent,
    cumulateOnId?: string
  ) => {
    e.preventDefault();
    const num = parseFloat(debtAmount.replace(',', '.')) || 0;
    if (!personName.trim() || num <= 0) return;
    const fbu = convertToFbu(num, debtCurrency, currencies);

    if (cumulateOnId) {
      addDebtEntry({
        debtId: cumulateOnId,
        amountFbu: fbu,
        currency: debtCurrency,
        date: debtDate,
        note: debtNote,
        supportId: debtSupportId || undefined,
      });
      setExpandedDebtIds((prev) => ({ ...prev, [cumulateOnId]: true }));
    } else {
      addDebt({
        direction: debtDirection,
        personName: personName.trim(),
        initialAmountFbu: fbu,
        currency: debtCurrency,
        date: debtDate,
        dueDate: debtDueDate || undefined,
        note: debtNote,
        supportId: debtSupportId || undefined,
      });
    }

    await haptics.success();
    setPersonName('');
    setDebtAmount('');
    setDebtDueDate('');
    setDebtNote('');
    setDebtSupportId('');
    setShowDebtForm(false);
  };

  const openAddEntryForm = (item: DebtItem) => {
    void haptics.tap();
    setAddingEntryDebtId(item.id);
    setEntryAmount('');
    setEntryCurrency(item.currency || displayCurrency);
    setEntryDate(getTodayISO());
    setEntryNote('');
    setEntrySupportId('');
    setRepayingId(null);
    setEditingDebtId(null);
  };

  const handleConfirmAddEntry = async (
    e: React.FormEvent,
    debtId: string
  ) => {
    e.preventDefault();
    const num = parseFloat(entryAmount.replace(',', '.')) || 0;
    if (num <= 0) return;
    const fbu = convertToFbu(num, entryCurrency, currencies);
    addDebtEntry({
      debtId,
      amountFbu: fbu,
      currency: entryCurrency,
      date: entryDate,
      note: entryNote,
      supportId: entrySupportId || undefined,
    });
    await haptics.success();
    setAddingEntryDebtId(null);
    setEntryAmount('');
    setEntryNote('');
    setExpandedDebtIds((prev) => ({ ...prev, [debtId]: true }));
  };

  const openEditDebtCard = (item: DebtItem) => {
    void haptics.tap();
    setEditingDebtId(item.id);
    setEditPersonName(item.personName);
    setEditDebtDirection(item.direction);
    setEditDebtDueDate(item.dueDate || '');
    setEditDebtNote(item.note || '');
    setAddingEntryDebtId(null);
    setRepayingId(null);
  };

  const handleSaveDebtCard = async (e: React.FormEvent, debtId: string) => {
    e.preventDefault();
    if (!editPersonName.trim()) return;
    updateDebt(debtId, {
      personName: editPersonName.trim(),
      direction: editDebtDirection,
      dueDate: editDebtDueDate || undefined,
      note: editDebtNote,
    });
    await haptics.success();
    setEditingDebtId(null);
  };

  const openEditEntry = (debtId: string, entry: DebtEntry) => {
    void haptics.tap();
    const converted = convertFromFbu(entry.amountFbu, displayCurrency, currencies);
    setEditingEntryKey({ debtId, entryId: entry.id });
    setEditEntryAmount(
      displayCurrency === 'FBU'
        ? String(Math.round(converted))
        : String(converted)
    );
    setEditEntryDate(entry.date);
    setEditEntryNote(entry.note || '');
    setEditEntrySupportId(entry.supportId || '');
    setEditingRepayKey(null);
  };

  const handleSaveEditEntry = async (
    e: React.FormEvent,
    debtId: string,
    entryId: string
  ) => {
    e.preventDefault();
    const num = parseFloat(editEntryAmount.replace(',', '.')) || 0;
    if (num <= 0) return;
    const fbu = convertToFbu(num, displayCurrency, currencies);
    updateDebtEntry(debtId, entryId, {
      amountFbu: fbu,
      date: editEntryDate,
      note: editEntryNote,
      supportId: editEntrySupportId,
    });
    await haptics.success();
    setEditingEntryKey(null);
  };

  const openEditRepayment = (debtId: string, rep: DebtRepayment) => {
    void haptics.tap();
    const converted = convertFromFbu(rep.amountFbu, displayCurrency, currencies);
    setEditingRepayKey({ debtId, repaymentId: rep.id });
    setEditRepayAmount(
      displayCurrency === 'FBU'
        ? String(Math.round(converted))
        : String(converted)
    );
    setEditRepayDate(rep.date);
    setEditRepayNote(rep.note || '');
    setEditRepaySupportId(rep.supportId || '');
    setEditingEntryKey(null);
  };

  const handleSaveEditRepayment = async (
    e: React.FormEvent,
    debtId: string,
    repaymentId: string
  ) => {
    e.preventDefault();
    const num = parseFloat(editRepayAmount.replace(',', '.')) || 0;
    if (num <= 0) return;
    const fbu = convertToFbu(num, displayCurrency, currencies);
    updateDebtRepayment(debtId, repaymentId, {
      amountFbu: fbu,
      date: editRepayDate,
      note: editRepayNote,
      supportId: editRepaySupportId,
    });
    await haptics.success();
    setEditingRepayKey(null);
  };

  const handleConfirmRepay = async (debtId: string) => {
    const num = parseFloat(repayAmount.replace(',', '.')) || 0;
    if (num <= 0) return;
    const fbu = convertToFbu(num, displayCurrency, currencies);
    repayDebt({
      debtId,
      amountFbu: fbu,
      date: repayDate,
      supportId: repaySupportId || undefined,
      note: repayNote,
    });
    await haptics.success();
    setRepayingId(null);
    setRepayAmount('');
    setRepayNote('');
  };

  const handleCreateSavings = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetNum = parseFloat(goalTarget.replace(',', '.')) || 0;
    const initNum = parseFloat(goalInitial.replace(',', '.')) || 0;
    if (!goalName.trim() || targetNum <= 0) return;

    addSavingsGoal({
      name: goalName.trim(),
      targetAmountFbu: convertToFbu(targetNum, displayCurrency, currencies),
      currentAmountFbu: convertToFbu(initNum, displayCurrency, currencies),
      note: goalNote,
    });
    await haptics.success();
    setGoalName('');
    setGoalTarget('');
    setGoalInitial('');
    setGoalNote('');
    setShowSavingsForm(false);
  };

  const openEditGoal = (goal: SavingsGoal) => {
    void haptics.tap();
    const tVal = convertFromFbu(goal.targetAmountFbu, displayCurrency, currencies);
    const cVal = convertFromFbu(goal.currentAmountFbu, displayCurrency, currencies);
    setEditingGoalId(goal.id);
    setEditGoalName(goal.name);
    setEditGoalTarget(
      displayCurrency === 'FBU' ? String(Math.round(tVal)) : String(tVal)
    );
    setEditGoalCurrent(
      displayCurrency === 'FBU' ? String(Math.round(cVal)) : String(cVal)
    );
    setEditGoalNote(goal.note || '');
    setAdjustingGoalId(null);
  };

  const handleSaveEditGoal = async (e: React.FormEvent, goalId: string) => {
    e.preventDefault();
    const targetNum = parseFloat(editGoalTarget.replace(',', '.')) || 0;
    const currentNum = Math.max(0, parseFloat(editGoalCurrent.replace(',', '.')) || 0);
    if (!editGoalName.trim() || targetNum <= 0) return;
    updateSavingsGoal(goalId, {
      name: editGoalName.trim(),
      targetAmountFbu: convertToFbu(targetNum, displayCurrency, currencies),
      currentAmountFbu: convertToFbu(currentNum, displayCurrency, currencies),
      note: editGoalNote,
    });
    await haptics.success();
    setEditingGoalId(null);
  };

  const handleConfirmAdjustSavings = async (goalId: string) => {
    const num = parseFloat(adjustAmount.replace(',', '.')) || 0;
    if (num <= 0) return;
    const fbu = convertToFbu(num, displayCurrency, currencies);
    adjustSavingsGoal({
      goalId,
      deltaFbu: adjustMode === 'deposit' ? fbu : -fbu,
      supportId: adjustSupportId || undefined,
      date: getTodayISO(),
    });
    await haptics.success();
    setAdjustingGoalId(null);
    setAdjustAmount('');
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
      {/* SECTION 1: DETTES & CRÉANCES */}
      <section className="rounded-2xl border border-zinc-800/80 bg-[#141417] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-zinc-100">
              Dettes &amp; Créances
            </h2>
            <p className="text-xs text-zinc-400">
              Cumul par personne, tranches multiples &amp; corrections rapides
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowDebtForm((v) => !v)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#F5B971] px-3.5 text-xs font-bold text-[#0D0D0F]"
          >
            <Plus className="h-4 w-4" />
            <span>Ajouter</span>
          </button>
        </div>

        {/* Toggle Mes Dettes / Ce qu'on me doit */}
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-zinc-800 bg-[#0D0D0F] p-1">
          <button
            type="button"
            onClick={() => setDebtDirection('debt')}
            className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors ${
              debtDirection === 'debt'
                ? 'bg-[#18181B] text-[#EF4444]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Mes dettes (Je dois)
          </button>
          <button
            type="button"
            onClick={() => setDebtDirection('receivable')}
            className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors ${
              debtDirection === 'receivable'
                ? 'bg-[#18181B] text-[#10B981]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Créances (On me doit)
          </button>
        </div>

        {/* Add Debt / Receivable Form */}
        {showDebtForm && (
          <form
            onSubmit={(e) => void handleCreateDebt(e)}
            className="rounded-xl border border-zinc-800 bg-[#0D0D0F] p-3.5 space-y-3"
          >
            <input
              type="text"
              required
              placeholder={
                debtDirection === 'debt'
                  ? 'Nom du créancier / fournisseur'
                  : 'Nom de la personne / client'
              }
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-800 bg-[#141417] px-3 text-sm text-zinc-100"
            />

            {matchingExistingDebt && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#F5B971]/40 bg-[#F5B971]/10 px-3 py-2 text-xs">
                <span className="text-zinc-200">
                  Fiche existante pour{' '}
                  <strong className="text-[#F5B971]">
                    {matchingExistingDebt.personName}
                  </strong>{' '}
                  (reste {fmt(matchingExistingDebt.remainingAmountFbu)})
                </span>
                <button
                  type="button"
                  onClick={(e) =>
                    void handleCreateDebt(e, matchingExistingDebt.id)
                  }
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#F5B971] px-2.5 text-[11px] font-bold text-[#0D0D0F]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Cumuler sur sa fiche</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                required
                min="1"
                step="any"
                placeholder="Montant"
                value={debtAmount}
                onChange={(e) => setDebtAmount(e.target.value)}
                className="col-span-2 h-10 rounded-lg border border-zinc-800 bg-[#141417] px-3 font-mono-num text-sm text-zinc-100"
              />
              <CustomSelect
                value={debtCurrency}
                onChange={(val) => setDebtCurrency(val)}
                title="Devise"
                searchable={false}
                options={currencies.map((c) => ({
                  value: c.code,
                  label: `${c.code} — ${c.name}`,
                  badge: c.symbol,
                }))}
                renderSelected={(opt) => (
                  <span className="font-mono-num text-xs font-semibold text-[#F5B971]">
                    {opt?.value || debtCurrency}
                  </span>
                )}
                className="h-10 w-full rounded-lg border border-zinc-800 bg-[#141417] px-2.5 text-xs font-semibold text-[#F5B971] hover:border-zinc-700"
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] text-zinc-500">
                  Date
                </label>
                <CustomDatePicker
                  value={debtDate}
                  onChange={(val) => setDebtDate(val)}
                  label="Date de l’opération"
                  className="h-10 w-full rounded-lg border border-zinc-800 bg-[#141417] px-3 text-xs text-zinc-100 hover:border-zinc-700"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-zinc-500">
                  Échéance / rappel (optionnel)
                </label>
                <CustomDatePicker
                  value={debtDueDate}
                  onChange={(val) => setDebtDueDate(val)}
                  label="Date d’échéance / rappel"
                  placeholder="Aucune échéance"
                  clearable
                  className="h-10 w-full rounded-lg border border-zinc-800 bg-[#141417] px-3 text-xs text-zinc-100 hover:border-zinc-700"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-zinc-500">
                Impact sur un support / compte (optionnel)
              </label>
              <CustomSelect
                value={debtSupportId}
                onChange={(val) => setDebtSupportId(val)}
                title="Support / compte lié"
                options={supportOptions}
                className="h-10 w-full rounded-lg border border-zinc-800 bg-[#141417] px-3 text-xs text-zinc-200 hover:border-zinc-700"
              />
            </div>

            <input
              type="text"
              placeholder="Note (optionnel)"
              value={debtNote}
              onChange={(e) => setDebtNote(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-800 bg-[#141417] px-3 text-xs text-zinc-100"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDebtForm(false)}
                className="h-9 rounded-lg px-3 text-xs text-zinc-400"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="h-9 rounded-lg bg-[#F5B971] px-4 text-xs font-bold text-[#0D0D0F]"
              >
                {matchingExistingDebt ? 'Créer une nouvelle fiche' : 'Enregistrer'}
              </button>
            </div>
          </form>
        )}

        {/* Debts List */}
        {filteredDebts.length === 0 ? (
          <p className="py-6 text-center text-xs text-zinc-500">
            {debtDirection === 'debt'
              ? 'Aucune dette enregistrée.'
              : 'Aucune créance enregistrée.'}
          </p>
        ) : (
          <div className="divide-y divide-zinc-800/70">
            {filteredDebts.map((item) => {
              const entries = getNormalizedEntries(item);
              const repaidAmount = Math.max(
                0,
                item.initialAmountFbu - item.remainingAmountFbu
              );
              const pct =
                item.initialAmountFbu > 0
                  ? Math.min(
                      100,
                      Math.round((repaidAmount / item.initialAmountFbu) * 100)
                    )
                  : 100;
              const settled = item.remainingAmountFbu <= 0;
              const isExpanded =
                expandedDebtIds[item.id] ?? entries.length > 1;
              const totalMovements = entries.length + item.repayments.length;

              return (
                <div key={item.id} className="py-3.5 space-y-2.5 first:pt-1">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-100">
                          {item.personName}
                        </span>
                        {entries.length > 1 && (
                          <span className="text-[11px] font-medium text-[#F5B971]">
                            · {entries.length} tranches cumulées
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500">
                        Cumul : {fmt(item.initialAmountFbu)} · {formatShortDate(item.date)}
                        {item.dueDate
                          ? ` · Échéance ${formatShortDate(item.dueDate)}`
                          : ''}
                        {item.note ? ` · ${item.note}` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <div className="text-right font-mono-num mr-1">
                        <div
                          className={`text-sm font-bold ${
                            settled
                              ? 'text-[#10B981]'
                              : item.direction === 'debt'
                              ? 'text-[#EF4444]'
                              : 'text-[#F5B971]'
                          }`}
                        >
                          {settled ? 'Soldé' : `Reste ${fmt(item.remainingAmountFbu)}`}
                        </div>
                        <div className="text-[11px] text-zinc-500">{pct}% réglé</div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openEditDebtCard(item)}
                        aria-label={`Modifier ${item.personName}`}
                        title="Modifier la fiche"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-[#F5B971]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>

                      {confirmDeleteKey === `debt:${item.id}` ? (
                        <button
                          type="button"
                          onClick={() => {
                            void haptics.warning();
                            deleteDebt(item.id);
                            setConfirmDeleteKey(null);
                          }}
                          className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#EF4444] px-2 text-[10px] font-bold text-white"
                        >
                          <Check className="h-3 w-3" />
                          <span>Suppr.</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            void haptics.tap();
                            setConfirmDeleteKey(`debt:${item.id}`);
                          }}
                          aria-label={`Supprimer ${item.personName}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-800 hover:text-[#EF4444]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Edit Debt Card Form */}
                  {editingDebtId === item.id && (
                    <form
                      onSubmit={(e) => void handleSaveDebtCard(e, item.id)}
                      className="rounded-xl border border-[#F5B971]/40 bg-[#0D0D0F] p-3 space-y-2.5"
                    >
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input
                          type="text"
                          required
                          placeholder="Nom de la personne"
                          value={editPersonName}
                          onChange={(e) => setEditPersonName(e.target.value)}
                          className="h-9 rounded-lg border border-zinc-800 bg-[#141417] px-2.5 text-xs text-zinc-100"
                        />
                        <CustomSelect
                          value={editDebtDirection}
                          onChange={(val) =>
                            setEditDebtDirection(val as 'debt' | 'receivable')
                          }
                          title="Type de fiche"
                          searchable={false}
                          options={[
                            { value: 'debt', label: 'Ma dette (Je dois)' },
                            { value: 'receivable', label: 'Créance (On me doit)' },
                          ]}
                          className="h-9 w-full rounded-lg border border-zinc-800 bg-[#141417] px-2.5 text-xs text-zinc-100"
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <CustomDatePicker
                          value={editDebtDueDate}
                          onChange={(val) => setEditDebtDueDate(val)}
                          label="Échéance / rappel"
                          placeholder="Aucune échéance"
                          clearable
                          className="h-9 w-full rounded-lg border border-zinc-800 bg-[#141417] px-2.5 text-xs text-zinc-100"
                        />
                        <input
                          type="text"
                          placeholder="Note (optionnel)"
                          value={editDebtNote}
                          onChange={(e) => setEditDebtNote(e.target.value)}
                          className="h-9 rounded-lg border border-zinc-800 bg-[#141417] px-2.5 text-xs text-zinc-100"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingDebtId(null)}
                          className="h-8 px-2.5 text-xs text-zinc-400"
                        >
                          Annuler
                        </button>
                        <button
                          type="submit"
                          className="h-8 rounded-lg bg-[#F5B971] px-3 text-xs font-bold text-[#0D0D0F]"
                        >
                          Enregistrer
                        </button>
                      </div>
                    </form>
                  )}

                  <SegmentedProgressBar
                    percent={pct}
                    tone={
                      settled
                        ? 'emerald'
                        : item.direction === 'debt'
                        ? 'amber'
                        : 'emerald'
                    }
                    segments={18}
                    heightClass="h-1.5"
                  />

                  {/* Quick Actions Row under person */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {!settled && (
                        <button
                          type="button"
                          onClick={() => {
                            void haptics.tap();
                            setRepayingId(repayingId === item.id ? null : item.id);
                            setRepayAmount('');
                            setRepayDate(getTodayISO());
                            setRepayNote('');
                            setAddingEntryDebtId(null);
                          }}
                          className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-700 bg-[#18181B] px-3 text-xs font-semibold text-zinc-100 hover:border-[#F5B971]"
                        >
                          {item.direction === 'debt' ? (
                            <>
                              <Minus className="h-3.5 w-3.5 text-[#EF4444]" />
                              <span>Rembourser</span>
                            </>
                          ) : (
                            <>
                              <Plus className="h-3.5 w-3.5 text-[#10B981]" />
                              <span>Encaisser</span>
                            </>
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          addingEntryDebtId === item.id
                            ? setAddingEntryDebtId(null)
                            : openAddEntryForm(item)
                        }
                        className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#F5B971]/40 bg-[#F5B971]/10 px-3 text-xs font-semibold text-[#F5B971] hover:bg-[#F5B971]/20"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Ajouter un montant</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        void haptics.tap();
                        setExpandedDebtIds((prev) => ({
                          ...prev,
                          [item.id]: !isExpanded,
                        }));
                      }}
                      className="inline-flex h-8 items-center gap-1 text-[11px] font-medium text-zinc-400 hover:text-zinc-200"
                    >
                      <span>
                        {totalMovements} ligne{totalMovements > 1 ? 's' : ''}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Inline Add New Tranche Form under same person */}
                  {addingEntryDebtId === item.id && (
                    <form
                      onSubmit={(e) => void handleConfirmAddEntry(e, item.id)}
                      className="rounded-xl border border-[#F5B971]/40 bg-[#0D0D0F] p-3 space-y-2.5"
                    >
                      <div className="text-[11px] font-semibold text-[#F5B971]">
                        Nouvelle tranche sous {item.personName}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="number"
                          required
                          min="1"
                          step="any"
                          placeholder="Montant"
                          value={entryAmount}
                          onChange={(e) => setEntryAmount(e.target.value)}
                          className="col-span-2 h-9 rounded-lg border border-zinc-700 bg-[#141417] px-2.5 font-mono-num text-xs text-zinc-100"
                        />
                        <CustomSelect
                          value={entryCurrency}
                          onChange={(val) => setEntryCurrency(val)}
                          title="Devise"
                          searchable={false}
                          options={currencies.map((c) => ({
                            value: c.code,
                            label: `${c.code} — ${c.name}`,
                            badge: c.symbol,
                          }))}
                          renderSelected={(opt) => (
                            <span className="font-mono-num text-xs font-semibold text-[#F5B971]">
                              {opt?.value || entryCurrency}
                            </span>
                          )}
                          className="h-9 w-full rounded-lg border border-zinc-700 bg-[#141417] px-2 text-xs text-[#F5B971]"
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <CustomDatePicker
                          value={entryDate}
                          onChange={(val) => setEntryDate(val)}
                          label="Date de la tranche"
                          className="h-9 w-full rounded-lg border border-zinc-700 bg-[#141417] px-2.5 text-xs text-zinc-100"
                        />
                        <CustomSelect
                          value={entrySupportId}
                          onChange={(val) => setEntrySupportId(val)}
                          title="Support / compte (optionnel)"
                          options={supportOptions}
                          className="h-9 w-full rounded-lg border border-zinc-700 bg-[#141417] px-2.5 text-xs text-zinc-200"
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Motif / note de cette tranche (optionnel)"
                        value={entryNote}
                        onChange={(e) => setEntryNote(e.target.value)}
                        className="h-9 w-full rounded-lg border border-zinc-700 bg-[#141417] px-2.5 text-xs text-zinc-100"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setAddingEntryDebtId(null)}
                          className="h-8 px-2.5 text-xs text-zinc-400"
                        >
                          Annuler
                        </button>
                        <button
                          type="submit"
                          className="h-8 rounded-lg bg-[#F5B971] px-3 text-xs font-bold text-[#0D0D0F]"
                        >
                          Ajouter au cumul
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Inline Repayment Form */}
                  {!settled && repayingId === item.id && (
                    <div className="rounded-xl border border-zinc-800 bg-[#0D0D0F] p-2.5 space-y-2">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input
                          type="number"
                          min="1"
                          step="any"
                          placeholder={`Montant en ${displayCurrency}`}
                          value={repayAmount}
                          onChange={(e) => setRepayAmount(e.target.value)}
                          className="h-9 rounded-lg border border-zinc-700 bg-[#141417] px-2.5 font-mono-num text-xs text-zinc-100"
                        />
                        <CustomSelect
                          value={repaySupportId}
                          onChange={(val) => setRepaySupportId(val)}
                          title="Support / compte utilisé"
                          options={supportOptions}
                          className="h-9 w-full rounded-lg border border-zinc-700 bg-[#141417] px-2.5 text-xs text-zinc-200 hover:border-zinc-600"
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <CustomDatePicker
                          value={repayDate}
                          onChange={(val) => setRepayDate(val)}
                          label="Date du versement"
                          className="h-9 w-full rounded-lg border border-zinc-700 bg-[#141417] px-2.5 text-xs text-zinc-100"
                        />
                        <input
                          type="text"
                          placeholder="Note (optionnel)"
                          value={repayNote}
                          onChange={(e) => setRepayNote(e.target.value)}
                          className="h-9 w-full rounded-lg border border-zinc-700 bg-[#141417] px-2.5 text-xs text-zinc-100"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setRepayingId(null)}
                          className="h-8 px-2.5 text-xs text-zinc-400"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleConfirmRepay(item.id)}
                          className="h-8 rounded-lg bg-[#10B981] px-3 text-xs font-bold text-[#0D0D0F]"
                        >
                          Valider
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Expanded Lines History (Entries + Repayments) */}
                  {isExpanded && (
                    <div className="rounded-xl border border-zinc-800/80 bg-[#0D0D0F] p-2.5 space-y-2.5">
                      {/* Tranches / Ajouts */}
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                          {item.direction === 'debt'
                            ? 'Montants empruntés / ajoutés'
                            : 'Montants prêtés / ajoutés'}
                        </div>
                        {entries.map((entry) => {
                          const isEditingThis =
                            editingEntryKey?.debtId === item.id &&
                            editingEntryKey.entryId === entry.id;
                          const sup = entry.supportId
                            ? state.supports.find((s) => s.id === entry.supportId)
                            : undefined;

                          return (
                            <div
                              key={entry.id}
                              className="rounded-lg bg-[#141417]/80 px-2.5 py-2 space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <div className="min-w-0">
                                  <div className="font-mono-num font-semibold text-zinc-100">
                                    +{fmt(entry.amountFbu)}
                                  </div>
                                  <div className="text-[11px] text-zinc-500 truncate">
                                    {formatShortDate(entry.date)}
                                    {sup ? ` · ${sup.name}` : ''}
                                    {entry.note ? ` · ${entry.note}` : ''}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => openEditEntry(item.id, entry)}
                                    aria-label="Modifier cette tranche"
                                    className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-800 hover:text-[#F5B971]"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  {entries.length > 1 &&
                                    (confirmDeleteKey === `ent:${entry.id}` ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          void haptics.warning();
                                          deleteDebtEntry(item.id, entry.id);
                                          setConfirmDeleteKey(null);
                                        }}
                                        className="inline-flex h-7 items-center gap-1 rounded bg-[#EF4444] px-2 text-[10px] font-bold text-white"
                                      >
                                        <Check className="h-3 w-3" />
                                        <span>Suppr.</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          void haptics.tap();
                                          setConfirmDeleteKey(`ent:${entry.id}`);
                                        }}
                                        aria-label="Supprimer cette tranche"
                                        className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-800 hover:text-[#EF4444]"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    ))}
                                </div>
                              </div>

                              {isEditingThis && (
                                <form
                                  onSubmit={(e) =>
                                    void handleSaveEditEntry(
                                      e,
                                      item.id,
                                      entry.id
                                    )
                                  }
                                  className="border-t border-zinc-800 pt-2 space-y-2"
                                >
                                  <div className="grid grid-cols-2 gap-2">
                                    <input
                                      type="number"
                                      required
                                      min="1"
                                      step="any"
                                      placeholder={`Montant (${displayCurrency})`}
                                      value={editEntryAmount}
                                      onChange={(e) =>
                                        setEditEntryAmount(e.target.value)
                                      }
                                      className="h-8 rounded-lg border border-zinc-700 bg-[#0D0D0F] px-2 font-mono-num text-xs text-zinc-100"
                                    />
                                    <CustomDatePicker
                                      value={editEntryDate}
                                      onChange={(val) => setEditEntryDate(val)}
                                      label="Date de la tranche"
                                      className="h-8 w-full rounded-lg border border-zinc-700 bg-[#0D0D0F] px-2 text-xs text-zinc-100"
                                    />
                                  </div>
                                  <CustomSelect
                                    value={editEntrySupportId}
                                    onChange={(val) => setEditEntrySupportId(val)}
                                    title="Support lié"
                                    options={supportOptions}
                                    className="h-8 w-full rounded-lg border border-zinc-700 bg-[#0D0D0F] px-2 text-xs text-zinc-200"
                                  />
                                  <input
                                    type="text"
                                    placeholder="Note (optionnel)"
                                    value={editEntryNote}
                                    onChange={(e) =>
                                      setEditEntryNote(e.target.value)
                                    }
                                    className="h-8 w-full rounded-lg border border-zinc-700 bg-[#0D0D0F] px-2 text-xs text-zinc-100"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setEditingEntryKey(null)}
                                      className="h-7 px-2 text-[11px] text-zinc-400"
                                    >
                                      Annuler
                                    </button>
                                    <button
                                      type="submit"
                                      className="h-7 rounded-md bg-[#F5B971] px-2.5 text-[11px] font-bold text-[#0D0D0F]"
                                    >
                                      Enregistrer
                                    </button>
                                  </div>
                                </form>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Versements / Remboursements */}
                      {item.repayments.length > 0 && (
                        <div className="space-y-1.5 border-t border-zinc-800/70 pt-2">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                            {item.direction === 'debt'
                              ? 'Remboursements effectués'
                              : 'Encaissements reçus'}
                          </div>
                          {item.repayments.map((rep) => {
                            const isEditingRep =
                              editingRepayKey?.debtId === item.id &&
                              editingRepayKey.repaymentId === rep.id;
                            const sup = rep.supportId
                              ? state.supports.find((s) => s.id === rep.supportId)
                              : undefined;

                            return (
                              <div
                                key={rep.id}
                                className="rounded-lg bg-[#141417]/80 px-2.5 py-2 space-y-2"
                              >
                                <div className="flex items-center justify-between gap-2 text-xs">
                                  <div className="min-w-0">
                                    <div className="font-mono-num font-semibold text-[#10B981]">
                                      -{fmt(rep.amountFbu)}
                                    </div>
                                    <div className="text-[11px] text-zinc-500 truncate">
                                      {formatShortDate(rep.date)}
                                      {sup ? ` · ${sup.name}` : ''}
                                      {rep.note ? ` · ${rep.note}` : ''}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => openEditRepayment(item.id, rep)}
                                      aria-label="Modifier ce versement"
                                      className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-800 hover:text-[#F5B971]"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                    {confirmDeleteKey === `rep:${rep.id}` ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          void haptics.warning();
                                          deleteDebtRepayment(item.id, rep.id);
                                          setConfirmDeleteKey(null);
                                        }}
                                        className="inline-flex h-7 items-center gap-1 rounded bg-[#EF4444] px-2 text-[10px] font-bold text-white"
                                      >
                                        <Check className="h-3 w-3" />
                                        <span>Suppr.</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          void haptics.tap();
                                          setConfirmDeleteKey(`rep:${rep.id}`);
                                        }}
                                        aria-label="Supprimer ce versement"
                                        className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-800 hover:text-[#EF4444]"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {isEditingRep && (
                                  <form
                                    onSubmit={(e) =>
                                      void handleSaveEditRepayment(
                                        e,
                                        item.id,
                                        rep.id
                                      )
                                    }
                                    className="border-t border-zinc-800 pt-2 space-y-2"
                                  >
                                    <div className="grid grid-cols-2 gap-2">
                                      <input
                                        type="number"
                                        required
                                        min="1"
                                        step="any"
                                        placeholder={`Montant (${displayCurrency})`}
                                        value={editRepayAmount}
                                        onChange={(e) =>
                                          setEditRepayAmount(e.target.value)
                                        }
                                        className="h-8 rounded-lg border border-zinc-700 bg-[#0D0D0F] px-2 font-mono-num text-xs text-zinc-100"
                                      />
                                      <CustomDatePicker
                                        value={editRepayDate}
                                        onChange={(val) => setEditRepayDate(val)}
                                        label="Date du versement"
                                        className="h-8 w-full rounded-lg border border-zinc-700 bg-[#0D0D0F] px-2 text-xs text-zinc-100"
                                      />
                                    </div>
                                    <CustomSelect
                                      value={editRepaySupportId}
                                      onChange={(val) =>
                                        setEditRepaySupportId(val)
                                      }
                                      title="Support lié"
                                      options={supportOptions}
                                      className="h-8 w-full rounded-lg border border-zinc-700 bg-[#0D0D0F] px-2 text-xs text-zinc-200"
                                    />
                                    <input
                                      type="text"
                                      placeholder="Note (optionnel)"
                                      value={editRepayNote}
                                      onChange={(e) =>
                                        setEditRepayNote(e.target.value)
                                      }
                                      className="h-8 w-full rounded-lg border border-zinc-700 bg-[#0D0D0F] px-2 text-xs text-zinc-100"
                                    />
                                    <div className="flex justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setEditingRepayKey(null)}
                                        className="h-7 px-2 text-[11px] text-zinc-400"
                                      >
                                        Annuler
                                      </button>
                                      <button
                                        type="submit"
                                        className="h-7 rounded-md bg-[#10B981] px-2.5 text-[11px] font-bold text-[#0D0D0F]"
                                      >
                                        Enregistrer
                                      </button>
                                    </div>
                                  </form>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 2: ÉPARGNE */}
      <section className="rounded-2xl border border-zinc-800/80 bg-[#141417] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-zinc-100">
              Poches d’Épargne
            </h2>
            <p className="text-xs text-zinc-400">
              Objectifs cibles &amp; progression segmentée
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSavingsForm((v) => !v)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#18181B] border border-zinc-700 px-3.5 text-xs font-semibold text-[#F5B971] hover:border-[#F5B971]"
          >
            <Plus className="h-4 w-4" />
            <span>Nouvel objectif</span>
          </button>
        </div>

        {showSavingsForm && (
          <form
            onSubmit={(e) => void handleCreateSavings(e)}
            className="rounded-xl border border-zinc-800 bg-[#0D0D0F] p-3.5 space-y-3"
          >
            <input
              type="text"
              required
              placeholder="Nom de la poche (ex: Fonds de sécurité, Matériel...)"
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-800 bg-[#141417] px-3 text-sm text-zinc-100"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                required
                min="1"
                step="any"
                placeholder={`Objectif (${displayCurrency})`}
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
                className="h-10 rounded-lg border border-zinc-800 bg-[#141417] px-3 font-mono-num text-xs text-zinc-100"
              />
              <input
                type="number"
                min="0"
                step="any"
                placeholder={`Déjà épargné (${displayCurrency})`}
                value={goalInitial}
                onChange={(e) => setGoalInitial(e.target.value)}
                className="h-10 rounded-lg border border-zinc-800 bg-[#141417] px-3 font-mono-num text-xs text-zinc-100"
              />
            </div>
            <input
              type="text"
              placeholder="Note (optionnel)"
              value={goalNote}
              onChange={(e) => setGoalNote(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-800 bg-[#141417] px-3 text-xs text-zinc-100"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSavingsForm(false)}
                className="h-9 px-3 text-xs text-zinc-400"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="h-9 rounded-lg bg-[#F5B971] px-4 text-xs font-bold text-[#0D0D0F]"
              >
                Créer
              </button>
            </div>
          </form>
        )}

        {state.savingsGoals.length === 0 ? (
          <p className="py-6 text-center text-xs text-zinc-500">
            Aucun objectif d’épargne créé.
          </p>
        ) : (
          <div className="divide-y divide-zinc-800/70">
            {state.savingsGoals.map((goal) => {
              const pct =
                goal.targetAmountFbu > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (goal.currentAmountFbu / goal.targetAmountFbu) * 100
                      )
                    )
                  : 0;

              return (
                <div key={goal.id} className="py-3.5 space-y-2.5 first:pt-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-100">
                        {goal.name}
                      </div>
                      {goal.note && (
                        <div className="text-xs text-zinc-500 truncate">
                          {goal.note}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="text-right font-mono-num mr-1">
                        <div className="text-sm font-bold text-[#10B981]">
                          {fmt(goal.currentAmountFbu)}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          sur {fmt(goal.targetAmountFbu)} ({pct}%)
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openEditGoal(goal)}
                        aria-label={`Modifier ${goal.name}`}
                        title="Modifier l’objectif"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-[#F5B971]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {confirmDeleteKey === `sav:${goal.id}` ? (
                        <button
                          type="button"
                          onClick={() => {
                            void haptics.warning();
                            deleteSavingsGoal(goal.id);
                            setConfirmDeleteKey(null);
                          }}
                          className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#EF4444] px-2 text-[10px] font-bold text-white"
                        >
                          <Check className="h-3 w-3" />
                          <span>Suppr.</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            void haptics.tap();
                            setConfirmDeleteKey(`sav:${goal.id}`);
                          }}
                          aria-label={`Supprimer ${goal.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-800 hover:text-[#EF4444]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {editingGoalId === goal.id && (
                    <form
                      onSubmit={(e) => void handleSaveEditGoal(e, goal.id)}
                      className="rounded-xl border border-[#F5B971]/40 bg-[#0D0D0F] p-3 space-y-2.5"
                    >
                      <input
                        type="text"
                        required
                        placeholder="Nom de la poche"
                        value={editGoalName}
                        onChange={(e) => setEditGoalName(e.target.value)}
                        className="h-9 w-full rounded-lg border border-zinc-800 bg-[#141417] px-2.5 text-xs text-zinc-100"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="mb-0.5 block text-[10px] text-zinc-400">
                            Objectif ({displayCurrency})
                          </label>
                          <input
                            type="number"
                            required
                            min="1"
                            step="any"
                            value={editGoalTarget}
                            onChange={(e) => setEditGoalTarget(e.target.value)}
                            className="h-9 w-full rounded-lg border border-zinc-800 bg-[#141417] px-2.5 font-mono-num text-xs text-zinc-100"
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[10px] text-zinc-400">
                            Déjà épargné ({displayCurrency})
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={editGoalCurrent}
                            onChange={(e) => setEditGoalCurrent(e.target.value)}
                            className="h-9 w-full rounded-lg border border-zinc-800 bg-[#141417] px-2.5 font-mono-num text-xs text-zinc-100"
                          />
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="Note (optionnel)"
                        value={editGoalNote}
                        onChange={(e) => setEditGoalNote(e.target.value)}
                        className="h-9 w-full rounded-lg border border-zinc-800 bg-[#141417] px-2.5 text-xs text-zinc-100"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingGoalId(null)}
                          className="h-8 px-2.5 text-xs text-zinc-400"
                        >
                          Annuler
                        </button>
                        <button
                          type="submit"
                          className="h-8 rounded-lg bg-[#F5B971] px-3 text-xs font-bold text-[#0D0D0F]"
                        >
                          Enregistrer
                        </button>
                      </div>
                    </form>
                  )}

                  <SegmentedProgressBar
                    percent={pct}
                    tone={pct >= 100 ? 'emerald' : 'amber'}
                    segments={18}
                    heightClass="h-1.5"
                  />

                  {adjustingGoalId === goal.id ? (
                    <div className="rounded-xl border border-zinc-800 bg-[#0D0D0F] p-2.5 space-y-2">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input
                          type="number"
                          min="1"
                          step="any"
                          placeholder={`Montant (${displayCurrency})`}
                          value={adjustAmount}
                          onChange={(e) => setAdjustAmount(e.target.value)}
                          className="h-9 rounded-lg border border-zinc-700 bg-[#141417] px-2.5 font-mono-num text-xs text-zinc-100"
                        />
                        <CustomSelect
                          value={adjustSupportId}
                          onChange={(val) => setAdjustSupportId(val)}
                          title="Support / compte associé"
                          options={supportOptions}
                          className="h-9 w-full rounded-lg border border-zinc-700 bg-[#141417] px-2.5 text-xs text-zinc-200 hover:border-zinc-600"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setAdjustingGoalId(null)}
                          className="h-8 px-2.5 text-xs text-zinc-400"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleConfirmAdjustSavings(goal.id)}
                          className="h-8 rounded-lg bg-[#F5B971] px-3 text-xs font-bold text-[#0D0D0F]"
                        >
                          {adjustMode === 'deposit' ? 'Ajouter' : 'Retirer'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAdjustingGoalId(goal.id);
                          setAdjustMode('deposit');
                          setAdjustAmount('');
                          setEditingGoalId(null);
                        }}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-700 bg-[#18181B] px-3 text-xs font-medium text-[#10B981] hover:border-[#10B981]"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Déposer</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAdjustingGoalId(goal.id);
                          setAdjustMode('withdraw');
                          setAdjustAmount('');
                          setEditingGoalId(null);
                        }}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-700 bg-[#18181B] px-3 text-xs font-medium text-zinc-300 hover:border-zinc-500"
                      >
                        <Minus className="h-3 w-3" />
                        <span>Retirer</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
