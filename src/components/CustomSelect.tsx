import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { haptics } from '../utils/haptics';

export interface CustomSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  title?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  ariaLabel?: string;
  renderSelected?: (option: CustomSelectOption | undefined) => React.ReactNode;
  hideChevron?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Sélectionner...',
  title = 'Sélectionner une option',
  searchable,
  searchPlaceholder = 'Rechercher...',
  disabled = false,
  className = '',
  id,
  ariaLabel,
  renderSelected,
  hideChevron = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  );

  const shouldShowSearch = searchable ?? options.length >= 7;

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(q)) ||
        (o.badge && o.badge.toLowerCase().includes(q))
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open]);

  const handleOpen = () => {
    if (disabled) return;
    void haptics.tap();
    setOpen(true);
  };

  const handleSelect = (opt: CustomSelectOption) => {
    if (opt.disabled) return;
    void haptics.tap();
    onChange(opt.value);
    setOpen(false);
  };

  return (
    <>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || title}
        className={`flex items-center justify-between gap-2 text-left transition-colors focus:border-[#F5B971] focus:outline-none disabled:opacity-50 ${
          className ||
          'h-11 w-full rounded-xl border border-zinc-800 bg-[#08090C] px-3 text-sm text-zinc-100 hover:border-zinc-700'
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {renderSelected ? (
            renderSelected(selected)
          ) : selected ? (
            <>
              {selected.icon && <span className="shrink-0">{selected.icon}</span>}
              <span className="truncate">{selected.label}</span>
            </>
          ) : (
            <span className="truncate text-zinc-500">{placeholder}</span>
          )}
        </div>
        {!hideChevron && (
          <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
        )}
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4 animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={() => setOpen(false)}
          >
            <div
              className="flex w-full max-w-md max-h-[82vh] flex-col rounded-t-3xl border border-zinc-800 bg-[#121318] shadow-2xl sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-zinc-700 sm:hidden" />

              <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3.5">
                <h3 className="font-display text-sm font-bold text-zinc-100 truncate">
                  {title}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    void haptics.tap();
                    setOpen(false);
                  }}
                  aria-label="Fermer"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {shouldShowSearch && (
                <div className="border-b border-zinc-800/70 px-4 py-2.5">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={searchPlaceholder}
                      className="h-10 w-full rounded-xl border border-zinc-800 bg-[#08090C] pl-9 pr-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-[#F5B971] focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div
                className="flex-1 overflow-y-auto p-2.5 pb-5 space-y-1"
                role="listbox"
              >
                {filteredOptions.length === 0 ? (
                  <p className="py-6 text-center text-xs text-zinc-500">
                    Aucune option trouvée.
                  </p>
                ) : (
                  filteredOptions.map((opt) => {
                    const active = opt.value === value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected={active}
                        disabled={opt.disabled}
                        onClick={() => handleSelect(opt)}
                        className={`flex min-h-[46px] w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                          active
                            ? 'border-[#F5B971]/50 bg-[#F5B971]/10 text-[#F5B971]'
                            : 'border-transparent bg-[#1A1C23]/60 text-zinc-200 hover:border-zinc-700/80 hover:bg-[#1A1C23]'
                        } disabled:opacity-40`}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          {opt.icon && (
                            <span className="shrink-0">{opt.icon}</span>
                          )}
                          <div className="min-w-0 flex-1">
                            <div
                              className={`truncate text-sm font-medium ${
                                active ? 'text-[#F5B971] font-semibold' : 'text-zinc-100'
                              }`}
                            >
                              {opt.label}
                            </div>
                            {opt.sublabel && (
                              <div className="truncate text-[11px] text-zinc-400">
                                {opt.sublabel}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {opt.badge && (
                            <span className="font-mono-num text-xs font-medium text-zinc-400">
                              {opt.badge}
                            </span>
                          )}
                          {active && (
                            <Check className="h-4 w-4 text-[#F5B971]" />
                          )}
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
