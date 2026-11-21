import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Calculator,
  Lock,
  Package,
  Plus,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import {
  PaymentMethod,
  PocketTarget,
  ProjectOutflowNature,
  StockPurchaseLine,
  StockSaleLine,
  SupportType,
  TransactionType,
} from '../types/finance';
import {
  convertFromFbu,
  convertToFbu,
  formatMoney,
  getTodayISO,
} from '../utils/format';
import { haptics } from '../utils/haptics';
import { CalculatorModal } from './CalculatorModal';
import { CustomDatePicker } from './CustomDatePicker';
import { CustomSelect } from './CustomSelect';
import { SupportPicker } from './SupportPicker';

interface QuickEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPocket?: PocketTarget;
  defaultProjectId?: string;
  defaultType?: TransactionType;
  defaultOutflowNature?: ProjectOutflowNature;
  defaultStockItemId?: string;
}

interface PurchaseDraftRow {
  key: string;
  itemId?: string;
  itemName: string;
  quantity: string;
  unit: string;
  unitCostFbu: string;
  minStockThreshold: string;
}

interface SaleDraftRow {
  key: string;
  itemId: string;
  quantity: string;
}

const UNIT_OPTIONS = ['pièce', 'carton', 'kg', 'sac', 'litre', 'boîte', 'lot'];

function makeEmptyPurchaseRow(): PurchaseDraftRow {
  return {
    key: `pr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    itemName: '',
    quantity: '1',
    unit: 'pièce',
    unitCostFbu: '',
    minStockThreshold: '5',
  };
}

export const QuickEntryModal: React.FC<QuickEntryModalProps> = ({
  isOpen,
  onClose,
  defaultPocket = 'personal',
  defaultProjectId,
  defaultType = TransactionType.INFLOW,
  defaultOutflowNature = 'operating_expense',
  defaultStockItemId,
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
  const [calcOpen, setCalcOpen] = useState<boolean>(false);

  // Comptabilité & Stock Projet
  const [outflowNature, setOutflowNature] =
    useState<ProjectOutflowNature>('operating_expense');
  const [purchaseRows, setPurchaseRows] = useState<PurchaseDraftRow[]>([
    makeEmptyPurchaseRow(),
  ]);
  const [linkStockOnSale, setLinkStockOnSale] = useState<boolean>(false);
  const [saleRows, setSaleRows] = useState<SaleDraftRow[]>([]);

  const personalSupports = useMemo(
    () => state.supports.filter((s) => s.ownerType === 'personal'),
    [state.supports]
  );

  const activeProject = useMemo(
    () => state.projects.find((p) => p.id === projectId),
    [state.projects, projectId]
  );

  const isViewerOnProject =
    (pocket === 'project' || txType === TransactionType.INTERNAL_LOAN) &&
    activeProject?.sharedAccessRole === 'viewer';

  const projectInventory = useMemo(
    () => (state.inventoryItems ?? []).filter((i) => i.projectId === projectId),
    [state.inventoryItems, projectId]
  );

  const availableProjectStock = useMemo(
    () => projectInventory.filter((i) => i.quantity > 0),
    [projectInventory]
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
    const nextProjId = defaultProjectId || state.projects[0]?.id || '';
    setTxType(defaultType);
    setPocket(defaultPocket);
    setProjectId(nextProjId);
    setCurrency(state.settings.displayCurrency || 'FBU');
    setDate(getTodayISO());
    setAmount('');
    setLabel('');
    setNewTagInput('');
    setShowNewTag(false);
    setOutflowNature(defaultOutflowNature || 'operating_expense');
    setLinkStockOnSale(false);
    setSaleRows([]);

    if (defaultStockItemId) {
      const targetItem = (state.inventoryItems ?? []).find(
        (i) => i.id === defaultStockItemId
      );
      if (targetItem) {
        setPurchaseRows([
          {
            key: `pr_${Date.now()}`,
            itemId: targetItem.id,
            itemName: targetItem.name,
            quantity: '1',
            unit: targetItem.unit,
            unitCostFbu: String(targetItem.averageUnitCostFbu || ''),
            minStockThreshold: String(targetItem.minStockThreshold ?? 5),
          },
        ]);
        setOutflowNature('stock_purchase');
        setLabel(`Approvisionnement ${targetItem.name}`);
        return;
      }
    }
    setPurchaseRows([makeEmptyPurchaseRow()]);
  }, [
    isOpen,
    defaultType,
    defaultPocket,
    defaultProjectId,
    defaultOutflowNature,
    defaultStockItemId,
    state.projects,
    state.inventoryItems,
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

  // Synchronise le montant total lorsque des lignes d'approvisionnement sont saisies
  const purchaseLinesComputed: StockPurchaseLine[] = useMemo(() => {
    return purchaseRows
      .filter((r) => r.itemName.trim().length > 0)
      .map((r) => {
        const qty = Math.max(0, parseFloat(r.quantity.replace(',', '.')) || 0);
        const unitCost = Math.max(0, parseFloat(r.unitCostFbu.replace(',', '.')) || 0);
        const totalCostFbu = Math.round(qty * unitCost);
        const minThr = parseFloat(r.minStockThreshold.replace(',', '.'));
        return {
          itemId: r.itemId,
          itemName: r.itemName.trim(),
          unit: r.unit.trim() || 'pièce',
          quantity: qty,
          unitCostFbu: Math.round(unitCost),
          totalCostFbu,
          minStockThreshold: Number.isNaN(minThr) ? 5 : Math.max(0, minThr),
        };
      });
  }, [purchaseRows]);

  const totalPurchaseFbu = useMemo(
    () => purchaseLinesComputed.reduce((acc, l) => acc + l.totalCostFbu, 0),
    [purchaseLinesComputed]
  );

  useEffect(() => {
    if (
      pocket === 'project' &&
      txType === TransactionType.OUTFLOW &&
      outflowNature === 'stock_purchase' &&
      totalPurchaseFbu > 0
    ) {
      const converted = convertFromFbu(
        totalPurchaseFbu,
        currency,
        state.settings.currencies
      );
      setAmount(
        currency === 'FBU' ? String(Math.round(converted)) : String(converted)
      );
    }
  }, [
    totalPurchaseFbu,
    pocket,
    txType,
    outflowNature,
    currency,
    state.settings.currencies,
  ]);

  const saleLinesComputed: StockSaleLine[] = useMemo(() => {
    if (!linkStockOnSale) return [];
    return saleRows
      .map((r) => {
        const item = projectInventory.find((i) => i.id === r.itemId);
        const qty = Math.max(0, parseFloat(r.quantity.replace(',', '.')) || 0);
        if (!item || qty <= 0) return null;
        return {
          itemId: item.id,
          itemName: item.name,
          unit: item.unit,
          quantity: qty,
          unitCostFbu: item.averageUnitCostFbu,
          totalCostFbu: Math.round(qty * item.averageUnitCostFbu),
        };
      })
      .filter((x): x is StockSaleLine => x !== null);
  }, [linkStockOnSale, saleRows, projectInventory]);

  const estimatedSaleCogsFbu = useMemo(
    () => saleLinesComputed.reduce((acc, l) => acc + l.totalCostFbu, 0),
    [saleLinesComputed]
  );

  if (!isOpen) return null;

  const numericAmount =
    parseFloat(amount.replace(/\s+/g, '').replace(',', '.')) || 0;
  const previewFbu = convertToFbu(
    numericAmount,
    currency,
    state.settings.currencies
  );
  const estimatedGrossMarginFbu = previewFbu - estimatedSaleCogsFbu;

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

  const handlePurchaseRowNameChange = (key: string, val: string) => {
    const matched = projectInventory.find(
      (i) => i.name.trim().toLowerCase() === val.trim().toLowerCase()
    );
    setPurchaseRows((prev) =>
      prev.map((r) =>
        r.key === key
          ? {
              ...r,
              itemName: val,
              itemId: matched?.id,
              unit: matched ? matched.unit : r.unit,
              unitCostFbu:
                matched && !r.unitCostFbu
                  ? String(matched.averageUnitCostFbu)
                  : r.unitCostFbu,
              minStockThreshold: matched
                ? String(matched.minStockThreshold)
                : r.minStockThreshold,
            }
          : r
      )
    );
  };

  const handleToggleLinkSale = () => {
    void haptics.tap();
    setLinkStockOnSale((prev) => {
      const next = !prev;
      if (next && saleRows.length === 0 && availableProjectStock.length > 0) {
        setSaleRows([
          {
            key: `sr_${Date.now()}`,
            itemId: availableProjectStock[0].id,
            quantity: '1',
          },
        ]);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewerOnProject) return;
    if (numericAmount <= 0 || !supportId) return;
    if (
      (txType === TransactionType.TRANSFER ||
        txType === TransactionType.INTERNAL_LOAN) &&
      !targetSupportId
    ) {
      return;
    }

    const isProjectStockOutflow =
      pocket === 'project' &&
      txType === TransactionType.OUTFLOW &&
      outflowNature === 'stock_purchase';

    const validPurchaseLines = isProjectStockOutflow
      ? purchaseLinesComputed.filter((l) => l.quantity > 0 && l.itemName)
      : undefined;

    const validSaleLines =
      pocket === 'project' &&
      txType === TransactionType.INFLOW &&
      linkStockOnSale &&
      saleLinesComputed.length > 0
        ? saleLinesComputed
        : undefined;

    const defaultLabel =
      txType === TransactionType.TRANSFER
        ? 'Transfert entre supports'
        : isProjectStockOutflow && validPurchaseLines?.length
        ? `Approvisionnement : ${validPurchaseLines.map((l) => l.itemName).slice(0, 2).join(', ')}`
        : validSaleLines?.length
        ? `Vente : ${validSaleLines.map((l) => `${l.quantity} ${l.unit} ${l.itemName}`).slice(0, 2).join(', ')}`
        : 'Opération';

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
      label: label.trim() || defaultLabel,
      categoryOrSource:
        pocket === 'project'
          ? isProjectStockOutflow
            ? 'Approvisionnement Stock'
            : categoryOrSource
          : undefined,
      outflowNature:
        pocket === 'project' && txType === TransactionType.OUTFLOW
          ? outflowNature
          : undefined,
      stockPurchaseLines: validPurchaseLines,
      stockSaleLines: validSaleLines,
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
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  required
                  placeholder="Ex: 50000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-12 min-w-0 flex-1 rounded-xl border border-zinc-800 bg-[#08090C] px-3.5 font-mono-num text-lg font-semibold text-zinc-100 placeholder:text-zinc-600 focus:border-[#F5B971] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    void haptics.tap();
                    setCalcOpen(true);
                  }}
                  aria-label="Ouvrir la calculatrice"
                  title="Calculer le montant"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#F5B971]/40 bg-[#08090C] text-[#F5B971] transition-colors hover:bg-[#F5B971]/15"
                >
                  <Calculator className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Devise
              </label>
              <CustomSelect
                value={currency}
                onChange={(val) => setCurrency(val)}
                title="Devise de l’opération"
                searchable={false}
                options={state.settings.currencies.map((c) => ({
                  value: c.code,
                  label: `${c.code} — ${c.name}`,
                  badge: c.symbol,
                }))}
                renderSelected={(opt) => (
                  <span className="font-mono-num text-sm font-semibold text-[#F5B971]">
                    {opt?.value || currency}
                  </span>
                )}
                className="h-12 w-full rounded-xl border border-zinc-800 bg-[#08090C] px-3 text-sm font-semibold text-[#F5B971] hover:border-zinc-700"
              />
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
                  <CustomSelect
                    value={projectId}
                    onChange={(val) => setProjectId(val)}
                    title="Sélectionner un projet"
                    options={state.projects.map((p) => ({
                      value: p.id,
                      label: p.name,
                      sublabel: `${p.customCategory || p.category}${
                        p.sharedAccessRole === 'viewer' ? ' · Lecture seule' : ''
                      }`,
                    }))}
                    className="h-11 w-full rounded-xl border border-zinc-800 bg-[#08090C] px-3 text-sm text-zinc-100 hover:border-zinc-700"
                  />
                )}
              </div>
            )}

          {isViewerOnProject && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#F5B971]" />
              <span>
                Votre rôle sur ce projet partagé est <strong>Observateur (lecture seule)</strong>. Demandez au propriétaire de vous passer en <strong>Associé</strong> pour enregistrer des opérations.
              </span>
            </div>
          )}

          {/* Typologie comptable des sorties projet */}
          {pocket === 'project' &&
            activeProject &&
            txType === TransactionType.OUTFLOW &&
            !isViewerOnProject && (
              <div className="space-y-2.5 rounded-xl border border-zinc-800/80 bg-[#08090C] p-3">
                <label className="block text-xs font-semibold text-zinc-300">
                  Nature comptable de la sortie
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      void haptics.tap();
                      setOutflowNature('operating_expense');
                    }}
                    className={`rounded-xl border p-2.5 text-left transition-colors ${
                      outflowNature === 'operating_expense'
                        ? 'border-[#EF4444]/60 bg-[#EF4444]/10 text-zinc-100'
                        : 'border-zinc-800 bg-[#121318] text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <div className="text-xs font-semibold">
                      Charge d’exploitation
                    </div>
                    <div className="mt-0.5 text-[11px] text-zinc-400">
                      Loyer, salaires, transport, frais consommés
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void haptics.tap();
                      setOutflowNature('stock_purchase');
                    }}
                    className={`rounded-xl border p-2.5 text-left transition-colors ${
                      outflowNature === 'stock_purchase'
                        ? 'border-[#F5B971]/70 bg-[#F5B971]/10 text-zinc-100'
                        : 'border-zinc-800 bg-[#121318] text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#F5B971]">
                      <Package className="h-3.5 w-3.5" />
                      <span>Approvisionnement / Stock</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-zinc-400">
                      Marchandise immobilisée destinée à la revente
                    </div>
                  </button>
                </div>

                {outflowNature === 'stock_purchase' && (
                  <div className="mt-2 space-y-2.5 border-t border-zinc-800/80 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#F5B971]">
                        Détail des articles achetés
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          void haptics.tap();
                          setPurchaseRows((prev) => [
                            ...prev,
                            makeEmptyPurchaseRow(),
                          ]);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#F5B971]/40 bg-[#F5B971]/10 px-2.5 py-1 text-[11px] font-semibold text-[#F5B971]"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Ajouter un article</span>
                      </button>
                    </div>

                    <datalist id={`inv_suggest_${projectId}`}>
                      {projectInventory.map((item) => (
                        <option key={item.id} value={item.name} />
                      ))}
                    </datalist>

                    <div className="space-y-2">
                      {purchaseRows.map((row) => {
                        const qty = parseFloat(row.quantity.replace(',', '.')) || 0;
                        const unitCost =
                          parseFloat(row.unitCostFbu.replace(',', '.')) || 0;
                        const rowTotal = Math.round(qty * unitCost);
                        return (
                          <div
                            key={row.key}
                            className="rounded-xl border border-zinc-800 bg-[#121318] p-2.5 space-y-2"
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                list={`inv_suggest_${projectId}`}
                                placeholder="Nom du produit (ex: Riz Basmati)"
                                value={row.itemName}
                                onChange={(e) =>
                                  handlePurchaseRowNameChange(
                                    row.key,
                                    e.target.value
                                  )
                                }
                                className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-800 bg-[#08090C] px-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-[#F5B971] focus:outline-none"
                              />
                              {purchaseRows.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPurchaseRows((prev) =>
                                      prev.filter((x) => x.key !== row.key)
                                    )
                                  }
                                  aria-label="Retirer cette ligne"
                                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:text-[#EF4444]"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="mb-0.5 block text-[10px] text-zinc-500">
                                  Quantité
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={row.quantity}
                                  onChange={(e) =>
                                    setPurchaseRows((prev) =>
                                      prev.map((x) =>
                                        x.key === row.key
                                          ? { ...x, quantity: e.target.value }
                                          : x
                                      )
                                    )
                                  }
                                  className="h-9 w-full rounded-lg border border-zinc-800 bg-[#08090C] px-2 font-mono-num text-xs text-zinc-100"
                                />
                              </div>
                              <div>
                                <label className="mb-0.5 block text-[10px] text-zinc-500">
                                  Unité
                                </label>
                                <CustomSelect
                                  value={row.unit}
                                  onChange={(val) =>
                                    setPurchaseRows((prev) =>
                                      prev.map((x) =>
                                        x.key === row.key
                                          ? { ...x, unit: val }
                                          : x
                                      )
                                    )
                                  }
                                  title="Unité de stock"
                                  searchable={false}
                                  options={UNIT_OPTIONS.map((u) => ({
                                    value: u,
                                    label: u,
                                  }))}
                                  className="h-9 w-full rounded-lg border border-zinc-800 bg-[#08090C] px-2 text-xs text-zinc-100 hover:border-zinc-700"
                                />
                              </div>
                              <div>
                                <label className="mb-0.5 block text-[10px] text-zinc-500">
                                  Prix achat / u (FBU)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  placeholder="0"
                                  value={row.unitCostFbu}
                                  onChange={(e) =>
                                    setPurchaseRows((prev) =>
                                      prev.map((x) =>
                                        x.key === row.key
                                          ? { ...x, unitCostFbu: e.target.value }
                                          : x
                                      )
                                    )
                                  }
                                  className="h-9 w-full rounded-lg border border-zinc-800 bg-[#08090C] px-2 font-mono-num text-xs text-zinc-100"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-zinc-400">
                              <span>
                                Seuil alerte :{' '}
                                <input
                                  type="number"
                                  min="0"
                                  value={row.minStockThreshold}
                                  onChange={(e) =>
                                    setPurchaseRows((prev) =>
                                      prev.map((x) =>
                                        x.key === row.key
                                          ? {
                                              ...x,
                                              minStockThreshold: e.target.value,
                                            }
                                          : x
                                      )
                                    )
                                  }
                                  className="inline-block w-12 rounded border border-zinc-800 bg-[#08090C] px-1.5 py-0.5 text-center font-mono-num text-zinc-200"
                                />{' '}
                                {row.unit}
                              </span>
                              <span className="font-mono-num font-semibold text-[#F5B971]">
                                Sous-total :{' '}
                                {formatMoney(
                                  rowTotal,
                                  'FBU',
                                  state.settings.currencies
                                )}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {totalPurchaseFbu > 0 && (
                      <div className="flex items-center justify-between rounded-lg bg-[#F5B971]/10 px-3 py-2 text-xs font-semibold text-[#F5B971]">
                        <span>Total ajouté au stock</span>
                        <span className="font-mono-num">
                          {formatMoney(
                            totalPurchaseFbu,
                            'FBU',
                            state.settings.currencies
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          {/* Liaison optionnelle des ventes projet au stock */}
          {pocket === 'project' &&
            activeProject &&
            txType === TransactionType.INFLOW &&
            !isViewerOnProject && (
              <div className="rounded-xl border border-zinc-800/80 bg-[#08090C] p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <ShoppingCart className="h-4 w-4 shrink-0 text-[#10B981]" />
                    <span className="text-xs font-semibold text-zinc-200 truncate">
                      Lier des produits du stock vendus
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleLinkSale}
                    disabled={availableProjectStock.length === 0}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                      linkStockOnSale
                        ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40'
                        : 'border border-zinc-700 bg-[#121318] text-zinc-300 disabled:opacity-40'
                    }`}
                  >
                    {availableProjectStock.length === 0
                      ? 'Stock vide'
                      : linkStockOnSale
                      ? 'Activé'
                      : 'Optionnel · Activer'}
                  </button>
                </div>

                {linkStockOnSale && availableProjectStock.length > 0 && (
                  <div className="space-y-2 border-t border-zinc-800/80 pt-2.5">
                    {saleRows.map((row) => {
                      const selectedItem = projectInventory.find(
                        (i) => i.id === row.itemId
                      );
                      const qty =
                        parseFloat(row.quantity.replace(',', '.')) || 0;
                      const exceeds =
                        selectedItem && qty > selectedItem.quantity;
                      return (
                        <div key={row.key} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="min-w-0 flex-1">
                              <CustomSelect
                                value={row.itemId}
                                onChange={(val) =>
                                  setSaleRows((prev) =>
                                    prev.map((x) =>
                                      x.key === row.key
                                        ? { ...x, itemId: val }
                                        : x
                                    )
                                  )
                                }
                                title="Produit vendu du stock"
                                options={availableProjectStock.map((item) => ({
                                  value: item.id,
                                  label: item.name,
                                  sublabel: `Dispo : ${item.quantity} ${item.unit}`,
                                  badge: `${item.averageUnitCostFbu} FBU`,
                                }))}
                                className="h-9 w-full rounded-lg border border-zinc-800 bg-[#121318] px-2.5 text-xs text-zinc-100 hover:border-zinc-700"
                              />
                            </div>
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              value={row.quantity}
                              onChange={(e) =>
                                setSaleRows((prev) =>
                                  prev.map((x) =>
                                    x.key === row.key
                                      ? { ...x, quantity: e.target.value }
                                      : x
                                  )
                                )
                              }
                              className="h-9 w-20 rounded-lg border border-zinc-800 bg-[#121318] px-2 font-mono-num text-xs text-zinc-100"
                            />
                            {saleRows.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setSaleRows((prev) =>
                                    prev.filter((x) => x.key !== row.key)
                                  )
                                }
                                className="text-zinc-500 hover:text-[#EF4444]"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          {exceeds && (
                            <p className="text-[11px] text-[#F5B971]">
                              Attention : quantité vendue supérieure au stock disponible ({selectedItem.quantity} {selectedItem.unit}).
                            </p>
                          )}
                        </div>
                      );
                    })}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setSaleRows((prev) => [
                            ...prev,
                            {
                              key: `sr_${Date.now()}`,
                              itemId: availableProjectStock[0].id,
                              quantity: '1',
                            },
                          ])
                        }
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#F5B971] hover:underline"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Autre article vendu</span>
                      </button>

                      <div className="text-right font-mono-num text-[11px]">
                        <span className="text-zinc-400">
                          Coût stock :{' '}
                          {formatMoney(
                            estimatedSaleCogsFbu,
                            'FBU',
                            state.settings.currencies
                          )}{' '}
                          ·{' '}
                        </span>
                        <span
                          className={`font-semibold ${
                            estimatedGrossMarginFbu >= 0
                              ? 'text-[#10B981]'
                              : 'text-[#EF4444]'
                          }`}
                        >
                          Marge brute :{' '}
                          {formatMoney(
                            estimatedGrossMarginFbu,
                            'FBU',
                            state.settings.currencies,
                            { signed: true }
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
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
                {state.savingsGoals.length === 0 ? (
                  <p className="rounded-xl border border-zinc-800 bg-[#08090C] p-3 text-xs text-zinc-400">
                    Aucun objectif d’épargne créé.
                  </p>
                ) : (
                  <CustomSelect
                    value={savingsGoalId}
                    onChange={(val) => setSavingsGoalId(val)}
                    title="Objectif d’épargne"
                    options={state.savingsGoals.map((g) => ({
                      value: g.id,
                      label: g.name,
                      badge: formatMoney(
                        g.currentAmountFbu,
                        'FBU',
                        state.settings.currencies,
                        { compact: true }
                      ),
                    }))}
                    className="h-11 w-full rounded-xl border border-zinc-800 bg-[#08090C] px-3 text-sm text-zinc-100 hover:border-zinc-700"
                  />
                )}
              </div>
            )}

          {pocket === 'debt' &&
            (txType === TransactionType.INFLOW ||
              txType === TransactionType.OUTFLOW) && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Dette / Créance concernée
                </label>
                {state.debts.length === 0 ? (
                  <p className="rounded-xl border border-zinc-800 bg-[#08090C] p-3 text-xs text-zinc-400">
                    Aucune dette ou créance active.
                  </p>
                ) : (
                  <CustomSelect
                    value={debtId}
                    onChange={(val) => setDebtId(val)}
                    title="Dette / Créance concernée"
                    options={state.debts.map((d) => ({
                      value: d.id,
                      label: d.personName,
                      sublabel: d.direction === 'debt' ? 'Dette à payer' : 'Créance à encaisser',
                      badge: `Reste ${formatMoney(
                        d.remainingAmountFbu,
                        'FBU',
                        state.settings.currencies,
                        { compact: true }
                      )}`,
                    }))}
                    className="h-11 w-full rounded-xl border border-zinc-800 bg-[#08090C] px-3 text-sm text-zinc-100 hover:border-zinc-700"
                  />
                )}
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
              (txType === TransactionType.OUTFLOW &&
                outflowNature === 'operating_expense')) && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-400">
                    {txType === TransactionType.INFLOW
                      ? 'Source de revenu du projet'
                      : 'Poste de charge du projet'}
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
                  <CustomSelect
                    value={categoryOrSource}
                    onChange={(val) => setCategoryOrSource(val)}
                    title={
                      txType === TransactionType.INFLOW
                        ? 'Source de revenu du projet'
                        : 'Poste de charge du projet'
                    }
                    options={[
                      ...projectTags.map((tag) => ({
                        value: tag,
                        label: tag,
                      })),
                      { value: 'Autre', label: 'Autre' },
                    ]}
                    className="h-11 w-full rounded-xl border border-zinc-800 bg-[#08090C] px-3 text-sm text-zinc-100 hover:border-zinc-700"
                  />
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
              <CustomSelect
                value={paymentMethod}
                onChange={(val) => setPaymentMethod(val as PaymentMethod)}
                title="Moyen de paiement"
                searchable={false}
                options={Object.values(PaymentMethod).map((m) => ({
                  value: m,
                  label: m,
                }))}
                className="h-11 w-full rounded-xl border border-zinc-800 bg-[#08090C] px-3 text-sm text-zinc-100 hover:border-zinc-700"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Date
              </label>
              <CustomDatePicker
                value={date}
                onChange={(val) => setDate(val)}
                label="Date de l’opération"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={numericAmount <= 0 || isViewerOnProject}
            className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-[#F5B971] text-sm font-bold text-[#08090C] transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            Enregistrer l’opération
          </button>
        </form>
      </div>

      <CalculatorModal
        isOpen={calcOpen}
        onClose={() => setCalcOpen(false)}
        onApplyValue={(val) => {
          setAmount(String(val));
        }}
      />
    </div>
  );
};