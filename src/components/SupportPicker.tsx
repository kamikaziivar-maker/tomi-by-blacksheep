import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X } from 'lucide-react';
import { CurrencyConfig, FundSupport, SupportType } from '../types/finance';
import { formatMoney } from '../utils/format';
import { haptics } from '../utils/haptics';
import { SupportAvatar } from './SupportAvatar';

interface SupportPickerProps {
  supports: FundSupport[];
  selectedId: string;
  onSelect: (id: string) => void;
  currencies: CurrencyConfig[];
  placeholder?: string;
}

const SUPPORT_TYPE_LABEL: Record<SupportType, string> = {
  [SupportType.CASH]: 'Cash',
  [SupportType.BANK]: 'Compte bancaire',
  [SupportType.MOBILE_MONEY]: 'Mobile Money',
};

export const SupportPicker: React.FC<SupportPickerProps> = ({
  supports,
  selectedId,
  onSelect,
  currencies,
  placeholder = 'Sélectionner un support',
}) => {
  const [open, setOpen] = useState(false);
  const selected = supports.find((s) => s.id === selectedId) || supports[0];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void haptics.tap();
          setOpen(true);
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-[#08090C] px-3 text-left text-sm text-zinc-100 hover:border-zinc-700 focus:border-[#F5B971] focus:outline-none"
      >
        {selected ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <SupportAvatar support={selected} size="sm" />
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-zinc-100">
                {selected.name}
              </div>
              <div
                className={`truncate font-mono-num text-[11px] ${
                  selected.balance < 0 ? 'text-[#EF4444]' : 'text-zinc-400'
                }`}
              >
                {formatMoney(selected.balance, selected.currency, currencies)}
              </div>
            </div>
          </div>
        ) : (
          <span className="text-xs text-zinc-500">{placeholder}</span>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4 animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
            aria-label="Choisir un support de fonds"
            onClick={() => setOpen(false)}
          >
            <div
              className="flex w-full max-w-md max-h-[82vh] flex-col rounded-t-3xl border border-zinc-800 bg-[#121318] shadow-2xl sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-zinc-700 sm:hidden" />

              <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3.5">
                <h3 className="font-display text-sm font-bold text-zinc-100">
                  Support / Compte utilisé
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    void haptics.tap();
                    setOpen(false);
                  }}
                  aria-label="Fermer"
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2.5 pb-5 space-y-1.5">
                {supports.length === 0 ? (
                  <p className="py-6 text-center text-xs text-zinc-500">
                    Aucun support disponible.
                  </p>
                ) : (
                  supports.map((s) => {
                    const active = s.id === selected?.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          void haptics.tap();
                          onSelect(s.id);
                          setOpen(false);
                        }}
                        className={`flex min-h-[52px] w-full items-center justify-between gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                          active
                            ? 'border-[#F5B971]/50 bg-[#F5B971]/10'
                            : 'border-transparent bg-[#1A1C23]/60 hover:border-zinc-700/80 hover:bg-[#1A1C23]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <SupportAvatar support={s} size="sm" />
                          <div className="min-w-0">
                            <div
                              className={`truncate text-sm font-semibold ${
                                active ? 'text-[#F5B971]' : 'text-zinc-100'
                              }`}
                            >
                              {s.name}
                            </div>
                            <div className="truncate text-[11px] text-zinc-400">
                              {SUPPORT_TYPE_LABEL[s.type]}
                              {s.reference ? ` · ${s.reference}` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={`font-mono-num text-xs font-semibold ${
                              s.balance < 0 ? 'text-[#EF4444]' : 'text-zinc-200'
                            }`}
                          >
                            {formatMoney(s.balance, s.currency, currencies)}
                          </span>
                          {active && <Check className="h-4 w-4 text-[#F5B971]" />}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
