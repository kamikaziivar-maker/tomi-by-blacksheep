import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { CurrencyConfig, FundSupport } from '../types/finance';
import { formatMoney } from '../utils/format';
import { SupportAvatar } from './SupportAvatar';

interface SupportPickerProps {
  supports: FundSupport[];
  selectedId: string;
  onSelect: (id: string) => void;
  currencies: CurrencyConfig[];
  placeholder?: string;
}

export const SupportPicker: React.FC<SupportPickerProps> = ({
  supports,
  selectedId,
  onSelect,
  currencies,
  placeholder = 'Sélectionner un support',
}) => {
  const [open, setOpen] = useState(false);
  const selected = supports.find((s) => s.id === selectedId) || supports[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-[#0D0D0F] px-3 text-left text-sm text-zinc-100 hover:border-zinc-700 focus:border-[#F5B971] focus:outline-none"
      >
        {selected ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <SupportAvatar support={selected} size="sm" />
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-zinc-100">
                {selected.name}
              </div>
              <div className="truncate font-mono-num text-[11px] text-zinc-400">
                {formatMoney(selected.balance, selected.currency, currencies)}
              </div>
            </div>
          </div>
        ) : (
          <span className="text-xs text-zinc-500">{placeholder}</span>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && supports.length > 0 && (
        <div className="mt-1.5 max-h-48 overflow-y-auto rounded-xl border border-zinc-800 bg-[#0D0D0F] divide-y divide-zinc-800/70 shadow-xl">
          {supports.map((s) => {
            const active = s.id === selected?.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onSelect(s.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2.5 px-3 py-2.5 text-left transition-colors ${
                  active ? 'bg-[#18181B]' : 'hover:bg-[#141417]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <SupportAvatar support={s} size="sm" />
                  <div className="min-w-0">
                    <div
                      className={`truncate text-xs font-semibold ${
                        active ? 'text-[#F5B971]' : 'text-zinc-200'
                      }`}
                    >
                      {s.name}
                    </div>
                    {s.reference && (
                      <div className="truncate text-[10px] text-zinc-500">
                        {s.reference}
                      </div>
                    )}
                  </div>
                </div>
                <span className="shrink-0 font-mono-num text-xs font-medium text-zinc-300">
                  {formatMoney(s.balance, s.currency, currencies)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
