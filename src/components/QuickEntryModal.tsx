import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Plus, X } from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import {
  PaymentMethod,
  PocketTarget,
  SupportType,
  TransactionType,
} from '../types/finance';
import { convertToFbu, formatMoney, getTodayISO } from '../utils/format';
import { haptics } from '../utils/haptics';
import { SupportPicker } from './SupportPicker';

interface QuickEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPocket?: PocketTarget;
  defaultProjectId?: string;
  defaultType?: TransactionType;
}

export const QuickEntryModal: React.FC<QuickEntryModalProps> = ({
  isOpen,
  onClose,
  defaultPocket = 'personal',
  defaultProjectId,
  defaultType = TransactionType.INFLOW,
}) => {
  const { state, addQuickTransaction, addProjectTag } = useFinance();

  const [txType, setTxType] = useState<TransactionType>(defaultType);
  const [pocket, setPocket] = useState<PocketTarget>(defaultPocket);
  const [projectId, setProjectId] = useState<string>(
    defaultProjectId || state.projects[0]?.id || ''
  );
  const [savingsGoalId, setSavingsGoalId] = useState<string>(
    state.savingsGoals[0]?.id || ''
  );
  const [debtId, setDebtId] = useState<string>(
    state.debts.find((d) => d.remainingAmountFbu > 0)?.id || ''
  );

  const [supportId, setSupportId] = useState<string>('');
  const [targetSupportId, setTargetSupportId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>(
    state.settings.displayCurrency || 'FBU'
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    PaymentMethod.CASH
  );
  const [date, setDate] = useState<string>(getTodayISO());
  const [label, setLabel] = useState<string>('');
  const [categoryOrSource, setCategoryOrSource] = useState<string>('');
  const [newTagInput, setNewTagInput] = useState<string>('');
  const [showNewTag, setShowNewTag] = useState<boolean>(false);

  const personalSupports = useMemo(
    () => state.supports.filter((s) => s.ownerType === 'personal'),
    [state.supports]
  );

  const activeProject = useMemo(
    () => state.projects.find((p) => p.id === projectId),
    [state.projects, projectId]
  );

  const availableSupports = useMemo(() => {
    if (txType === TransactionType.INTERNAL_LOAN) {
      return personalSupports;
    }
    if (txType === TransactionType.TRANSFER) {
      return state.supports;
    }
    if (pocket === 'project' && projectId) {
      const projSups = state.supports.filter(
        (s) => s.ownerType === 'project' && s.ownerId === projectId
      );
      return projSups.length > 0 ? projSups : state.supports;
    }
    return personalSupports.length > 0 ? personalSupports : state.supports;
  }, [txType, pocket, projectId, personalSupports, state.supports]);

  const targetSupports = useMemo(() => {
    if (txType === TransactionType.INTERNAL_LOAN && projectId) {
      return state.supports.filter(
        (s) => s.ownerType === 'project' && s.ownerId === projectId
      );
    }
    return state.supports.filter((s) => s.id !== supportId);
  }, [txType, projectId, state.supports, supportId]);

  useEffect(() => {
    if (!isOpen) return;
    setTxType(defaultType);
    setPocket(defaultPocket);
    setProjectId(defaultProjectId || state.projects[0]?.id || '');
    setCurrency(state.settings.displayCurrency || 'FBU');
    setDate(getTodayISO());
    setAmount('');
    setLabel('');
    setNewTagInput('');
    setShowNewTag(false);
  }, [
    isOpen,
    defaultType,
    defaultPocket,
    defaultProjectId,
    state.projects,
    state.settings.displayCurrency,
  ]);

  useEffect(() => {
    if (
      availableSupports.length > 0 &&
      !availableSupports.some((s) => s.id === supportId)
    ) {
      setSupportId(availableSupports[0].id);
    }
  }, [availableSupports, supportId]);

  useEffect(() => {
    if (
      targetSupports.length > 0 &&
      !targetSupports.some((s) => s.id === targetSupportId)
    ) {
      setTargetSupportId(targetSupports[0].id);
    }
  }, [targetSupports, targetSupportId]);

  useEffect(() => {
    const selectedSup = state.supports.find((s) => s.id === supportId);
    if (selectedSup) {
      if (selectedSup.type === SupportType.CASH) setPaymentMethod(PaymentMethod.CASH);
      else if (selectedSup.type === SupportType.BANK)
        setPaymentMethod(PaymentMethod.BANQUE);
      else if (selectedSup.name.toLowerCase().includes('eco'))
        setPaymentMethod(PaymentMethod.ECOCASH);
      else setPaymentMethod(PaymentMethod.LUMICASH);
    }
  }, [supportId, state.supports]);

  useEffect(() => {
    if (pocket === 'project' && activeProject) {
      const list =
        txType === TransactionType.INFLOW
          ? activeProject.revenueSources
          : activeProject.expenseCategories;
      setCategoryOrSource(list[0] || '');
    } else {
      setCategoryOrSource('');
    }
  }, [pocket, activeProject, txType]);

  if (!isOpen) return null;

  const numericAmount =
    parseFloat(amount.replace(/\s+/g, '').replace(',', '.')) || 0;
  const previewFbu = convertToFbu(
    numericAmount,
    currency,
    state.settings.currencies
  );

  const projectTags =
    activeProject && txType === TransactionType.INFLOW
      ? activeProject.revenueSources
      : activeProject
      ? activeProject.expenseCategories
      : [];

  const handleAddInlineTag = async () => {
    if (!projectId || !newTagInput.trim()) return;
    await haptics.tap();
    addProjectTag(
      projectId,
      txType === TransactionType.INFLOW ? 'revenue' : 'expense',
      newTagInput.trim()
    );
    setCategoryOrSource(newTagInput.trim());
    setNewTagInput('');
    setShowNewTag(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numericAmount <= 0 || !supportId) return;
    if (
      (txType === TransactionType.TRANSFER ||
        txType === TransactionType.INTERNAL_LOAN) &&
      !targetSupportId
    ) {
      return;
    }

    addQuickTransaction({
      type: txType,
      pocket: txType === TransactionType.INTERNAL_LOAN ? 'project' : pocket,
      projectId:
        pocket === 'project' || txType === TransactionType.INTERNAL_LOAN
          ? projectId
          : undefined,
      savingsGoalId: pocket === 'savings' ? savingsGoalId : undefined,
      debtId: pocket === 'debt' ? debtId : undefined,
      supportId,
      targetSupportId:
        txType === TransactionType.TRANSFER ||
        txType === TransactionType.INTERNAL_LOAN
          ? targetSupportId
          : undefined,
      amount: numericAmount,
      currency,
      paymentMethod,
      date,
      label:
        label.trim() ||
        (txType === TransactionType.TRANSFER
          ? 'Transfert entre supports'
          : 'Opération'),
      categoryOrSource: pocket === 'project' ? categoryOrSource : undefined,
    });

    await haptics.success();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Saisie rapide"
    >
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-zinc-800 bg-[#121318] p-5 pb-7 shadow-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-700 sm:hidden" />

        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-zinc-100">
            Saisie rapide
          </h2>
          <button
            type="button"
            onClick={() => {
              void haptics.tap();
              onClose();
            }}
            aria-label="Fermer"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-[#08090C] p-1 border border-zinc-800/80 sm:grid-cols-4">
            {[
              { id: TransactionType.INFLOW, label: 'Entrée (+)' },
              { id: TransactionType.OUTFLOW, label: 'Sortie (-)' },
              { id: TransactionType.INTERNAL_LOAN, label: 'Prêt interne' },
              { id: TransactionType.TRANSFER, label: 'Transfert' },
            ].map((item) => {
              const active = txType === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    void haptics.tap();
                    setTxType(item.id);
                  }}
                  className={`min-h-[40px] rounded-lg px-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? item.id === TransactionType.OUTFLOW
                        ? 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/40'
                        : item.id === TransactionType.INFLOW
                        ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/40'
                        : 'bg-[#F5B971] text-[#08090C]'
                      : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Montant
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                required
                placeholder="Ex: 50000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-12 w-full rounded-xl border border-zinc-800 bg-[#08090C] px-3.5 font-mono-num text-lg font-semibold text-zinc-100 placeholder:text-zinc-600 focus:border-[#F5B971] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Devise
              </label>
              <select
                value={currency}
                onChange={(e) => {
                  void haptics.tap();
                  setCurrency(e.target.value);
                }}
                className="h-12 w-full rounded-xl border border-zinc-800 bg-[#08090C] px-3 text-sm font-semibold text-[#F5B971] focus:border-[#F5B971] focus:outline-none"
              >
                {state.settings.currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {currency !== 'FBU' && numericAmount > 0 && (
            <p className="text-xs text-zinc-400 font-mono-num -mt-2">
              Équivalent consolidé :{' '}
              {formatMoney(previewFbu, 'FBU', state.settings.currencies)}
            </p>
          )}

          {(txType === TransactionType.INFLOW ||
            txType === TransactionType.OUTFLOW) && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Poche concernée
              </label>
              <div className="grid grid-cols-4 gap-1.5 rounded-xl bg-[#08090C] p-1 border border-zinc-800/80">
                {[
                  { id: 'personal' as PocketTarget, label: 'Perso' },
                  { id: 'project' as PocketTarget, label: 'Projet' },
                  { id: 'savings' as PocketTarget, label: 'Épargne' },
                  { id: 'debt' as PocketTarget, label: 'Dette' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      void haptics.tap();
                      setPocket(p.id);
                    }}
                    className={`min-h-[38px] rounded-lg px-2 text-xs font-medium transition-colors whitespace-nowrap ${
                      pocket === p.id
                        ? 'bg-[#18181B] text-[#F5B971] border border-zinc-700'
                        : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(pocket === 'project' || txType === TransactionType.INTERNAL_LOAN) &&
            txType !== TransactionType.TRANSFER && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Projet
                </label>
                {state.projects.length === 0 ? (
                  <p className="rounded-xl border border-zinc-800 bg-[#08090C] p-3 text-xs text-zinc-400">
                    Aucun projet créé pour le moment. Créez d’abord un projet dans
                    l’onglet Projets.
                  </p>
                ) : (
                  <select
                    value={projectId}
                    onChange={(e) => {
                      void haptics.tap();
                      setProjectId(e.target.value);
                    }}
                    className="h-11 w-full rounded-xl border border-zinc-800 bg-[#08090C] px-3 text-sm text-zinc-100 focus:border-[#F5B971] focus:outline-none"
                  >
                    {state.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.customCategory || p.category})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

          {pocket === 'savings' &&
            (txType === TransactionType.INFLOW ||
              txType === TransactionType.OUTFLOW) && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Objectif d’épargne
                </label>
                <select
                  value={savingsGoalId}
                  onChange={(e) => {
                    void haptics.tap();
                    setSavingsGoalId(e.target.value);
                  }}
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-[#08090C] px-3 text-sm text-zinc-100 focus:border-[#F5B971] focus:outline-none"
                >
                  {state.savingsGoals.length === 0 && (
                    <option value="">Aucun objectif</option>
                  )}
                  {state.savingsGoals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

          {pocket === 'debt' &&
            (txType === TransactionType.INFLOW ||
              txType === TransactionType.OUTFLOW) && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Dette / Créance concernée
                </label>
                <select
                  value={debtId}
                  onChange={(e) => {
                    void haptics.tap();
                    setDebtId(e.target.value);
                  }}
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-[#08090C] px-3 text-sm text-zinc-100 focus:border-[#F5B971] focus:outline-none"
                >
                  {state.debts.length === 0 && (
                    <option value="">Aucune dette active</option>
                  )}
                  {state.debts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.personName} (
                      {d.direction === 'debt' ? 'Dette' : 'Créance'} · reste{' '}
                      {formatMoney(
                        d.remainingAmountFbu,
                        'FBU',
                        state.settings.currencies
                      )}
                      )
                    </option>
                  ))}
                </select>
              </div>
            )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div
              className={
                txType === TransactionType.TRANSFER ||
                txType === TransactionType.INTERNAL_LOAN
                  ? ''
                  : 'sm:col-span-2'
              }
            >
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                {txType === TransactionType.TRANSFER
                  ? 'Support d’origine (Débit)'
                  : txType === TransactionType.INTERNAL_LOAN
                  ? 'Support Compte Perso (Débit)'
                  : 'Support / Compte utilisé'}
              </label>
              <SupportPicker
                supports={availableSupports}
                selectedId={supportId}
                onSelect={(id) => {
                  void haptics.tap();
                  setSupportId(id);
                }}
                currencies={state.settings.currencies}
              />
            </div>

            {(txType === TransactionType.TRANSFER ||
              txType === TransactionType.INTERNAL_LOAN) && (
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                  <ArrowRightLeft className="h-3.5 w-3.5 text-[#F5B971]" />
                  <span>
                    {txType === TransactionType.INTERNAL_LOAN
                      ? 'Support Projet (Crédit)'
                      : 'Support de destination (Crédit)'}
                  </span>
                </label>
                <SupportPicker
                  supports={targetSupports}
                  selectedId={targetSupportId}
                  onSelect={(id) => {
                    void haptics.tap();
                    setTargetSupportId(id);
                  }}
                  currencies={state.settings.currencies}
                />
              </div>
            )}
          </div>

          {pocket === 'project' &&
            activeProject &&
            (txType === TransactionType.INFLOW ||
              txType === TransactionType.OUTFLOW) && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-400">
                    {txType === TransactionType.INFLOW
                      ? 'Source de revenu du projet'
                      : 'Poste de dépense du projet'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      void haptics.tap();
                      setShowNewTag((v) => !v);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#F5B971] hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Ajouter à la volée</span>
                  </button>
                </div>

                {showNewTag ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ex: Commande événement..."
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      className="h-11 flex-1 rounded-xl border border-zinc-800 bg-[#08090C] px-3 text-sm text-zinc-100 focus:border-[#F5B971] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void handleAddInlineTag()}
                      className="h-11 rounded-xl bg-[#F5B971] px-4 text-xs font-semibold text-[#08090C]"
                    >
                      OK
                    </button>
                  </div>
                ) : (
                  <select
                    value={categoryOrSource}
                    onChange={(e) => {
                      void haptics.tap();
                      setCategoryOrSource(e.target.value);
                    }}
                    className="h-11 w-full rounded-xl border border-zinc-800 bg-[#08090C] px-3 text-sm text-zinc-100 focus:border-[#F5B971] focus:outline-none"
                  >
                    {projectTags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                    <option value="Autre">Autre</option>
                  </select>
                )}
              </div>
            )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Libellé / Nom (client, fournisseur, créancier)
            </label>
            <input
              type="text"
              placeholder="Ex: Vente client, Fournisseur marché, Remboursement..."
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="h-11 w-full rounded-xl border border-zinc-800 bg-[#08090C] px-3.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#F5B971] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Moyen de paiement
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => {
                  void haptics.tap();
                  setPaymentMethod(e.target.value as PaymentMethod);
                }}
                className="h-11 w-full rounded-xl border border-zinc-800 bg-[#08090C] px-3 text-sm text-zinc-100 focus:border-[#F5B971] focus:outline-none"
              >
                {Object.values(PaymentMethod).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-800 bg-[#08090C] px-3 text-sm text-zinc-100 focus:border-[#F5B971] focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={numericAmount <= 0}
            className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-[#F5B971] text-sm font-bold text-[#08090C] transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            Enregistrer l’opération
          </button>
        </form>
      </div>
    </div>
  );
};