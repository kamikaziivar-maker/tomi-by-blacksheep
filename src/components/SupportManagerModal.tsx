import React, { useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import { FundSupport, SupportType } from '../types/finance';
import { formatMoney } from '../utils/format';
import { haptics } from '../utils/haptics';
import { SupportAvatar } from './SupportAvatar';

interface SupportManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  ownerType: 'personal' | 'project';
  ownerId: string;
  ownerTitle: string;
}

export const SupportManagerModal: React.FC<SupportManagerModalProps> = ({
  isOpen,
  onClose,
  ownerType,
  ownerId,
  ownerTitle,
}) => {
  const { state, addSupport, updateSupport, deleteSupport } = useFinance();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<SupportType>(SupportType.BANK);
  const [name, setName] = useState('');
  const [reference, setReference] = useState('');
  const [currency, setCurrency] = useState('FBU');
  const [balance, setBalance] = useState('');

  if (!isOpen) return null;

  const supports = state.supports.filter(
    (s) => s.ownerType === ownerType && s.ownerId === ownerId
  );

  const startEdit = (sup: FundSupport) => {
    void haptics.tap();
    setEditingId(sup.id);
    setType(sup.type);
    setName(sup.name);
    setReference(sup.reference || '');
    setCurrency(sup.currency);
    setBalance(String(sup.balance));
  };

  const resetForm = () => {
    setEditingId(null);
    setType(SupportType.BANK);
    setName('');
    setReference('');
    setCurrency('FBU');
    setBalance('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const numBal = parseFloat(balance) || 0;

    if (editingId) {
      updateSupport(editingId, {
        type,
        name: name.trim(),
        reference: reference.trim() || undefined,
        currency,
        balance: numBal,
      });
    } else {
      addSupport({
        ownerType,
        ownerId,
        type,
        name: name.trim(),
        reference: reference.trim() || undefined,
        currency,
        balance: numBal,
      });
    }

    await haptics.success();
    resetForm();
  };

  const handleDelete = async (id: string) => {
    await haptics.warning();
    deleteSupport(id);
  };

  const typeLabel = (t: SupportType) =>
    t === SupportType.CASH
      ? 'Cash'
      : t === SupportType.BANK
      ? 'Compte bancaire'
      : 'Mobile Money';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Supports de fonds — ${ownerTitle}`}
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-zinc-800 bg-[#121318] p-5 pb-7 shadow-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-700 sm:hidden" />
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-zinc-100">
              Supports de fonds
            </h2>
            <p className="text-xs text-zinc-400">{ownerTitle}</p>
          </div>
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

        {/* Existing supports list */}
        <div className="divide-y divide-zinc-800/70 border-y border-zinc-800/70 mb-5">
          {supports.length === 0 ? (
            <p className="py-4 text-xs text-zinc-500">Aucun support configuré.</p>
          ) : (
            supports.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-3 gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <SupportAvatar support={s} size="md" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-100 truncate">
                      {s.name}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {typeLabel(s.type)}
                      {s.reference ? ` · ${s.reference}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono-num text-sm font-semibold text-zinc-100">
                    {formatMoney(s.balance, s.currency, state.settings.currencies)}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(s)}
                    aria-label={`Modifier ${s.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-[#F5B971]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {supports.length > 1 && (
                    <button
                      type="button"
                      onClick={() => void handleDelete(s.id)}
                      aria-label={`Supprimer ${s.name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-[#EF4444]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add / Edit Form */}
        <form onSubmit={handleSave} className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-300">
              {editingId ? 'Modifier le support' : 'Ajouter un support / compte bancaire'}
            </h3>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  void haptics.tap();
                  resetForm();
                }}
                className="text-xs text-zinc-400 hover:text-zinc-200"
              >
                Annuler édition
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as SupportType)}
              className="h-11 rounded-xl border border-zinc-800 bg-[#08090C] px-3 text-xs font-medium text-zinc-100 focus:border-[#F5B971] focus:outline-none"
            >
              <option value={SupportType.CASH}>Cash (Liquide)</option>
              <option value={SupportType.BANK}>Compte bancaire</option>
              <option value={SupportType.MOBILE_MONEY}>Mobile Money</option>
            </select>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="h-11 rounded-xl border border-zinc-800 bg-[#08090C] px-3 text-xs font-semibold text-[#F5B971] focus:border-[#F5B971] focus:outline-none"
            >
              {state.settings.currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <input
              type="text"
              required
              placeholder="Nom (ex: Bancobu, Lumicash, Cash)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-xl border border-zinc-800 bg-[#08090C] px-3 text-sm text-zinc-100 focus:border-[#F5B971] focus:outline-none"
            />
            <input
              type="text"
              placeholder="Réf / N° compte (optionnel)"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="h-11 rounded-xl border border-zinc-800 bg-[#08090C] px-3 text-sm text-zinc-100 focus:border-[#F5B971] focus:outline-none"
            />
          </div>

          <div className="flex gap-2.5">
            <input
              type="number"
              step="any"
              placeholder="Solde actuel"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className="h-11 flex-1 rounded-xl border border-zinc-800 bg-[#08090C] px-3 font-mono-num text-sm text-zinc-100 focus:border-[#F5B971] focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#F5B971] px-4 text-xs font-bold text-[#08090C] hover:bg-[#f7c587]"
            >
              <Plus className="h-4 w-4" />
              <span>{editingId ? 'Mettre à jour' : 'Ajouter'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};