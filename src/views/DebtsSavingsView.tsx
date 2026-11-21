import React, { useState } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { SegmentedProgressBar } from '../components/SegmentedBar';
import { useFinance } from '../store/FinanceContext';
import {
  convertToFbu,
  formatInDisplayCurrency,
  formatShortDate,
  getTodayISO,
} from '../utils/format';

export const DebtsSavingsView: React.FC = () => {
  const {
    state,
    addDebt,
    repayDebt,
    deleteDebt,
    addSavingsGoal,
    adjustSavingsGoal,
    deleteSavingsGoal,
  } = useFinance();

  const { displayCurrency, currencies } = state.settings;
  const fmt = (fbu: number) => formatInDisplayCurrency(fbu, displayCurrency, currencies);

  // Debt / Receivable toggle & add form
  const [debtDirection, setDebtDirection] = useState<'debt' | 'receivable'>('debt');
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [personName, setPersonName] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [debtCurrency, setDebtCurrency] = useState('FBU');
  const [debtDate, setDebtDate] = useState(getTodayISO());
  const [debtDueDate, setDebtDueDate] = useState('');
  const [debtNote, setDebtNote] = useState('');

  // Inline partial repayment state
  const [repayingId, setRepayingId] = useState<string | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [repaySupportId, setRepaySupportId] = useState(state.supports[0]?.id || '');

  // Savings goal form
  const [showSavingsForm, setShowSavingsForm] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalInitial, setGoalInitial] = useState('');
  const [goalNote, setGoalNote] = useState('');

  // Adjust savings inline state
  const [adjustingGoalId, setAdjustingGoalId] = useState<string | null>(null);
  const [adjustMode, setAdjustMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustSupportId, setAdjustSupportId] = useState(state.supports[0]?.id || '');

  const filteredDebts = state.debts.filter((d) => d.direction === debtDirection);

  const handleCreateDebt = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(debtAmount) || 0;
    if (!personName.trim() || num <= 0) return;
    const fbu = convertToFbu(num, debtCurrency, currencies);

    addDebt({
      direction: debtDirection,
      personName: personName.trim(),
      initialAmountFbu: fbu,
      currency: debtCurrency,
      date: debtDate,
      dueDate: debtDueDate || undefined,
      note: debtNote,
    });
    setPersonName('');
    setDebtAmount('');
    setDebtDueDate('');
    setDebtNote('');
    setShowDebtForm(false);
  };

  const handleConfirmRepay = (debtId: string) => {
    const num = parseFloat(repayAmount) || 0;
    if (num <= 0) return;
    const fbu = convertToFbu(num, displayCurrency, currencies);
    repayDebt({
      debtId,
      amountFbu: fbu,
      date: getTodayISO(),
      supportId: repaySupportId || undefined,
    });
    setRepayingId(null);
    setRepayAmount('');
  };

  const handleCreateSavings = (e: React.FormEvent) => {
    e.preventDefault();
    const targetNum = parseFloat(goalTarget) || 0;
    const initNum = parseFloat(goalInitial) || 0;
    if (!goalName.trim() || targetNum <= 0) return;

    addSavingsGoal({
      name: goalName.trim(),
      targetAmountFbu: convertToFbu(targetNum, displayCurrency, currencies),
      currentAmountFbu: convertToFbu(initNum, displayCurrency, currencies),
      note: goalNote,
    });
    setGoalName('');
    setGoalTarget('');
    setGoalInitial('');
    setGoalNote('');
    setShowSavingsForm(false);
  };

  const handleConfirmAdjustSavings = (goalId: string) => {
    const num = parseFloat(adjustAmount) || 0;
    if (num <= 0) return;
    const fbu = convertToFbu(num, displayCurrency, currencies);
    adjustSavingsGoal({
      goalId,
      deltaFbu: adjustMode === 'deposit' ? fbu : -fbu,
      supportId: adjustSupportId || undefined,
      date: getTodayISO(),
    });
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
              Suivi des remboursements partiels vers 0
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
            onSubmit={handleCreateDebt}
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
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                required
                min="1"
                placeholder="Montant initial"
                value={debtAmount}
                onChange={(e) => setDebtAmount(e.target.value)}
                className="col-span-2 h-10 rounded-lg border border-zinc-800 bg-[#141417] px-3 font-mono-num text-sm text-zinc-100"
              />
              <select
                value={debtCurrency}
                onChange={(e) => setDebtCurrency(e.target.value)}
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
                <label className="mb-1 block text-[11px] text-zinc-500">Date</label>
                <input
                  type="date"
                  value={debtDate}
                  onChange={(e) => setDebtDate(e.target.value)}
                  className="h-10 w-full rounded-lg border border-zinc-800 bg-[#141417] px-3 text-xs text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-zinc-500">
                  Échéance / rappel (optionnel)
                </label>
                <input
                  type="date"
                  value={debtDueDate}
                  onChange={(e) => setDebtDueDate(e.target.value)}
                  className="h-10 w-full rounded-lg border border-zinc-800 bg-[#141417] px-3 text-xs text-zinc-100"
                />
              </div>
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
                Enregistrer
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
              const repaidAmount = item.initialAmountFbu - item.remainingAmountFbu;
              const pct =
                item.initialAmountFbu > 0
                  ? Math.round((repaidAmount / item.initialAmountFbu) * 100)
                  : 100;
              const settled = item.remainingAmountFbu <= 0;

              return (
                <div key={item.id} className="py-3.5 space-y-2.5 first:pt-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-100">
                        {item.personName}
                      </div>
                      <div className="text-xs text-zinc-500">
                        Initial : {fmt(item.initialAmountFbu)} · {formatShortDate(item.date)}
                        {item.note ? ` · ${item.note}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right font-mono-num">
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
                        onClick={() => deleteDebt(item.id)}
                        aria-label={`Supprimer ${item.personName}`}
                        className="p-1.5 text-zinc-600 hover:text-[#EF4444]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <SegmentedProgressBar
                    percent={pct}
                    tone={settled ? 'emerald' : item.direction === 'debt' ? 'amber' : 'emerald'}
                    segments={18}
                    heightClass="h-1.5"
                  />

                  {!settled && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      {repayingId === item.id ? (
                        <div className="w-full rounded-xl border border-zinc-800 bg-[#0D0D0F] p-2.5 space-y-2">
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <input
                              type="number"
                              min="1"
                              placeholder={`Montant en ${displayCurrency}`}
                              value={repayAmount}
                              onChange={(e) => setRepayAmount(e.target.value)}
                              className="h-9 rounded-lg border border-zinc-700 bg-[#141417] px-2.5 font-mono-num text-xs text-zinc-100"
                            />
                            <select
                              value={repaySupportId}
                              onChange={(e) => setRepaySupportId(e.target.value)}
                              className="h-9 rounded-lg border border-zinc-700 bg-[#141417] px-2 text-xs text-zinc-200"
                            >
                              <option value="">Sans mouvement de compte</option>
                              {state.supports.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
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
                              onClick={() => handleConfirmRepay(item.id)}
                              className="h-8 rounded-lg bg-[#10B981] px-3 text-xs font-bold text-[#0D0D0F]"
                            >
                              Valider
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setRepayingId(item.id);
                            setRepayAmount('');
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

                      {item.repayments.length > 0 && (
                        <span className="text-[11px] text-zinc-500">
                          {item.repayments.length} versement{item.repayments.length > 1 ? 's' : ''} enregistré{item.repayments.length > 1 ? 's' : ''}
                        </span>
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
            onSubmit={handleCreateSavings}
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
                placeholder={`Objectif (${displayCurrency})`}
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
                className="h-10 rounded-lg border border-zinc-800 bg-[#141417] px-3 font-mono-num text-xs text-zinc-100"
              />
              <input
                type="number"
                min="0"
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
                  ? Math.min(100, Math.round((goal.currentAmountFbu / goal.targetAmountFbu) * 100))
                  : 0;

              return (
                <div key={goal.id} className="py-3.5 space-y-2.5 first:pt-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-100">{goal.name}</div>
                      {goal.note && (
                        <div className="text-xs text-zinc-500 truncate">{goal.note}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right font-mono-num">
                        <div className="text-sm font-bold text-[#10B981]">
                          {fmt(goal.currentAmountFbu)}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          sur {fmt(goal.targetAmountFbu)} ({pct}%)
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteSavingsGoal(goal.id)}
                        aria-label={`Supprimer ${goal.name}`}
                        className="p-1.5 text-zinc-600 hover:text-[#EF4444]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

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
                          placeholder={`Montant (${displayCurrency})`}
                          value={adjustAmount}
                          onChange={(e) => setAdjustAmount(e.target.value)}
                          className="h-9 rounded-lg border border-zinc-700 bg-[#141417] px-2.5 font-mono-num text-xs text-zinc-100"
                        />
                        <select
                          value={adjustSupportId}
                          onChange={(e) => setAdjustSupportId(e.target.value)}
                          className="h-9 rounded-lg border border-zinc-700 bg-[#141417] px-2 text-xs text-zinc-200"
                        >
                          <option value="">Suivi objectif seul</option>
                          {state.supports.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
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
                          onClick={() => handleConfirmAdjustSavings(goal.id)}
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
