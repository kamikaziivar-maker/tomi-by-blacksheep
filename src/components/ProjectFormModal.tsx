import React, { useEffect, useRef, useState } from 'react';
import { Banknote, Landmark, Plus, Smartphone, Trash2, X } from 'lucide-react';
import {
  backdropMotionClass,
  sheetMotionClass,
  useAnimatedVisibility,
} from '../hooks/useAnimatedVisibility';
import { useFinance } from '../store/FinanceContext';
import { Project, ProjectCategory, SupportType } from '../types/finance';
import {
  parseSignedAmount,
  sanitizeSignedNumberInput,
  toggleSignedInput,
} from '../utils/format';
import { CustomSelect, CustomSelectOption } from './CustomSelect';

interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingProject?: Project | null;
}

const CATEGORIES = Object.values(ProjectCategory);

const DRAFT_SUPPORT_TYPE_OPTIONS: CustomSelectOption[] = [
  {
    value: SupportType.CASH,
    label: 'Cash',
    icon: <Banknote className="h-4 w-4 text-zinc-300" />,
  },
  {
    value: SupportType.BANK,
    label: 'Banque',
    icon: <Landmark className="h-4 w-4 text-[#F5B971]" />,
  },
  {
    value: SupportType.MOBILE_MONEY,
    label: 'Mobile Money',
    icon: <Smartphone className="h-4 w-4 text-[#10B981]" />,
  },
];

interface DraftSupport {
  type: SupportType;
  name: string;
  reference: string;
  currency: string;
  balance: string;
}

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
  isOpen,
  onClose,
  editingProject,
}) => {
  const { state, addProject, updateProject } = useFinance();
  const { shouldRender, isVisible } = useAnimatedVisibility(isOpen);
  const prevSessionKeyRef = useRef<string | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>(ProjectCategory.BUSINESS);
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [revenueSources, setRevenueSources] = useState<string[]>([
    'Ventes directes',
    'Prestations',
  ]);
  const [expenseCategories, setExpenseCategories] = useState<string[]>([
    'Stock & Achats',
    'Logistique',
    'Charges',
  ]);
  const [newSource, setNewSource] = useState('');
  const [newExpense, setNewExpense] = useState('');

  const [draftSupports, setDraftSupports] = useState<DraftSupport[]>([
    { type: SupportType.CASH, name: 'Caisse Projet', reference: '', currency: 'FBU', balance: '0' },
    { type: SupportType.BANK, name: 'Compte Bancaire Projet', reference: '', currency: 'FBU', balance: '0' },
  ]);

  useEffect(() => {
    if (!isOpen) {
      prevSessionKeyRef.current = null;
      return;
    }
    const sessionKey = editingProject ? `edit:${editingProject.id}` : 'new';
    if (prevSessionKeyRef.current === sessionKey) return;
    prevSessionKeyRef.current = sessionKey;

    if (editingProject) {
      setName(editingProject.name);
      setCategory(editingProject.category);
      setCustomCategory(editingProject.customCategory || '');
      setDescription(editingProject.description || '');
      setRevenueSources(editingProject.revenueSources);
      setExpenseCategories(editingProject.expenseCategories);
    } else {
      setName('');
      setCategory(ProjectCategory.RESTAURATION);
      setCustomCategory('');
      setDescription('');
      setRevenueSources(['Ventes principales', 'Commandes spéciales']);
      setExpenseCategories(['Stock & Matières', 'Personnel', 'Logistique']);
      setDraftSupports([
        { type: SupportType.CASH, name: 'Cash Projet', reference: '', currency: 'FBU', balance: '0' },
      ]);
    }
    setNewSource('');
    setNewExpense('');
  }, [isOpen, editingProject]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!shouldRender) return null;

  const handleAddSource = () => {
    const clean = newSource.trim();
    if (!clean || revenueSources.includes(clean)) return;
    setRevenueSources([...revenueSources, clean]);
    setNewSource('');
  };

  const handleAddExpense = () => {
    const clean = newExpense.trim();
    if (!clean || expenseCategories.includes(clean)) return;
    setExpenseCategories([...expenseCategories, clean]);
    setNewExpense('');
  };

  const handleAddDraftSupport = () => {
    setDraftSupports([
      ...draftSupports,
      {
        type: SupportType.BANK,
        name: 'Nouveau Compte Bancaire',
        reference: '',
        currency: 'FBU',
        balance: '0',
      },
    ]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingProject) {
      updateProject(editingProject.id, {
        name: name.trim(),
        category,
        customCategory:
          category === ProjectCategory.AUTRE ? customCategory.trim() || 'Personnalisé' : undefined,
        description: description.trim() || undefined,
        revenueSources,
        expenseCategories,
      });
    } else {
      addProject({
        name: name.trim(),
        category,
        customCategory:
          category === ProjectCategory.AUTRE ? customCategory.trim() || 'Personnalisé' : undefined,
        description: description.trim() || undefined,
        revenueSources,
        expenseCategories,
        initialSupports: draftSupports
          .filter((s) => s.name.trim())
          .map((s) => ({
            type: s.type,
            name: s.name.trim(),
            reference: s.reference.trim() || undefined,
            currency: s.currency,
            balance: parseSignedAmount(s.balance),
          })),
      });
    }
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4 ${backdropMotionClass(
        isVisible
      )}`}
      role="dialog"
      aria-modal="true"
      aria-label={editingProject ? 'Modifier le projet' : 'Nouveau projet'}
      onClick={onClose}
    >
      <div
        className={`w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-zinc-800 bg-[#141417] p-5 pb-7 shadow-2xl ${sheetMotionClass(
          isVisible
        )}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-700 sm:hidden" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-zinc-100">
            {editingProject ? 'Configurer le projet' : 'Nouveau projet'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Nom du projet
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Restaurant Le Phare, Boutique Kivu..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 w-full rounded-xl border border-zinc-800 bg-[#0D0D0F] px-3.5 text-sm text-zinc-100 focus:border-[#F5B971] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Catégorie
              </label>
              <CustomSelect
                value={category}
                onChange={(val) => setCategory(val)}
                title="Catégorie du projet"
                searchable={false}
                options={CATEGORIES.map((cat) => ({
                  value: cat,
                  label: cat,
                }))}
                className="h-11 w-full rounded-xl border border-zinc-800 bg-[#0D0D0F] px-3 text-sm text-zinc-100 hover:border-zinc-700"
              />
            </div>

            {category === ProjectCategory.AUTRE && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Catégorie personnalisée
                </label>
                <input
                  type="text"
                  placeholder="Ex: Agriculture, Transport..."
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-[#0D0D0F] px-3 text-sm text-zinc-100 focus:border-[#F5B971] focus:outline-none"
                />
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Description (optionnel)
            </label>
            <input
              type="text"
              placeholder="Activité ou objectif principal du projet"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-11 w-full rounded-xl border border-zinc-800 bg-[#0D0D0F] px-3.5 text-sm text-zinc-100 focus:border-[#F5B971] focus:outline-none"
            />
          </div>

          {/* Initial supports on create */}
          {!editingProject && (
            <div className="border-t border-zinc-800/80 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300">
                  Supports de détention des fonds
                </span>
                <button
                  type="button"
                  onClick={handleAddDraftSupport}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#F5B971] hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Ajouter un compte</span>
                </button>
              </div>
              <div className="space-y-2.5">
                {draftSupports.map((sup, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 gap-2 rounded-xl border border-zinc-800/80 bg-[#0D0D0F] p-3 sm:grid-cols-12"
                  >
                    <div className="sm:col-span-3">
                      <CustomSelect
                        value={sup.type}
                        onChange={(val) => {
                          const next = [...draftSupports];
                          next[idx].type = val as SupportType;
                          setDraftSupports(next);
                        }}
                        options={DRAFT_SUPPORT_TYPE_OPTIONS}
                        title="Type de support"
                        searchable={false}
                        className="h-9 w-full rounded-lg border border-zinc-800 bg-[#141417] px-2 text-xs text-zinc-200 hover:border-zinc-700"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Nom du compte / caisse"
                      value={sup.name}
                      onChange={(e) => {
                        const next = [...draftSupports];
                        next[idx].name = e.target.value;
                        setDraftSupports(next);
                      }}
                      className="h-9 rounded-lg border border-zinc-800 bg-[#141417] px-2.5 text-xs text-zinc-100 sm:col-span-4"
                    />
                    <div className="flex items-center gap-1 sm:col-span-3">
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...draftSupports];
                          next[idx].balance = toggleSignedInput(next[idx].balance);
                          setDraftSupports(next);
                        }}
                        aria-label="Basculer positif / négatif"
                        title="Positif / Négatif"
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border font-mono-num text-xs font-bold ${
                          sup.balance.trim().startsWith('-')
                            ? 'border-[#EF4444]/60 bg-[#EF4444]/15 text-[#EF4444]'
                            : 'border-zinc-800 bg-[#141417] text-zinc-300'
                        }`}
                      >
                        +/−
                      </button>
                      <input
                        type="text"
                        inputMode="text"
                        placeholder="Solde initial"
                        value={sup.balance}
                        onChange={(e) => {
                          const next = [...draftSupports];
                          next[idx].balance = sanitizeSignedNumberInput(e.target.value);
                          setDraftSupports(next);
                        }}
                        className={`h-9 min-w-0 flex-1 rounded-lg border bg-[#141417] px-2.5 font-mono-num text-xs focus:border-[#F5B971] focus:outline-none ${
                          sup.balance.trim().startsWith('-')
                            ? 'border-[#EF4444]/50 text-[#EF4444]'
                            : 'border-zinc-800 text-zinc-100'
                        }`}
                      />
                    </div>
                    <div className="flex items-center gap-1 sm:col-span-2">
                      <div className="flex-1 min-w-0">
                        <CustomSelect
                          value={sup.currency}
                          onChange={(val) => {
                            const next = [...draftSupports];
                            next[idx].currency = val;
                            setDraftSupports(next);
                          }}
                          title="Devise"
                          searchable={false}
                          options={state.settings.currencies.map((c) => ({
                            value: c.code,
                            label: `${c.code} — ${c.name}`,
                            badge: c.symbol,
                          }))}
                          renderSelected={(opt) => (
                            <span className="truncate font-mono-num text-xs font-semibold text-[#F5B971]">
                              {opt?.value || sup.currency}
                            </span>
                          )}
                          className="h-9 w-full rounded-lg border border-zinc-800 bg-[#141417] px-2 text-xs text-[#F5B971] hover:border-zinc-700"
                        />
                      </div>
                      {draftSupports.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setDraftSupports(draftSupports.filter((_, i) => i !== idx))
                          }
                          aria-label="Retirer ce support"
                          className="p-1.5 text-zinc-500 hover:text-[#EF4444]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Revenue sources */}
          <div className="border-t border-zinc-800/80 pt-4 space-y-2">
            <label className="block text-xs font-semibold text-zinc-300">
              Sources de revenus (traçabilité)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ex: Ventes comptoir, Livraison..."
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSource();
                  }
                }}
                className="h-10 flex-1 rounded-xl border border-zinc-800 bg-[#0D0D0F] px-3 text-xs text-zinc-100 focus:border-[#F5B971] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddSource}
                className="h-10 rounded-xl border border-zinc-700 bg-[#18181B] px-3.5 text-xs font-medium text-zinc-200 hover:border-[#F5B971]"
              >
                Ajouter
              </button>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-1">
              {revenueSources.map((src) => (
                <span
                  key={src}
                  className="inline-flex items-center gap-1.5 text-xs text-[#10B981]"
                >
                  <span>{src}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setRevenueSources(revenueSources.filter((s) => s !== src))
                    }
                    className="text-zinc-500 hover:text-[#EF4444]"
                    aria-label={`Supprimer ${src}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Expense categories */}
          <div className="border-t border-zinc-800/80 pt-4 space-y-2">
            <label className="block text-xs font-semibold text-zinc-300">
              Postes de dépenses
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ex: Matières premières, Loyer..."
                value={newExpense}
                onChange={(e) => setNewExpense(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddExpense();
                  }
                }}
                className="h-10 flex-1 rounded-xl border border-zinc-800 bg-[#0D0D0F] px-3 text-xs text-zinc-100 focus:border-[#F5B971] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddExpense}
                className="h-10 rounded-xl border border-zinc-700 bg-[#18181B] px-3.5 text-xs font-medium text-zinc-200 hover:border-[#F5B971]"
              >
                Ajouter
              </button>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-1">
              {expenseCategories.map((exp) => (
                <span
                  key={exp}
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-300"
                >
                  <span>{exp}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setExpenseCategories(expenseCategories.filter((c) => c !== exp))
                    }
                    className="text-zinc-500 hover:text-[#EF4444]"
                    aria-label={`Supprimer ${exp}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center rounded-xl bg-[#F5B971] text-sm font-bold text-[#0D0D0F] transition-transform active:scale-[0.98]"
          >
            {editingProject ? 'Enregistrer les modifications' : 'Créer le projet'}
          </button>
        </form>
      </div>
    </div>
  );
};
