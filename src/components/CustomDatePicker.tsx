import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
} from 'lucide-react';
import { getDaysAgoISO, getTodayISO } from '../utils/format';
import { haptics } from '../utils/haptics';

interface CustomDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  clearable?: boolean;
  className?: string;
  disabled?: boolean;
}

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTHS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseISO(iso: string): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function formatTriggerDate(iso: string): string {
  const dt = parseISO(iso);
  if (!dt) return iso;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(dt);
}

function getEndOfMonthISO(): string {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return toISO(end);
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Choisir une date',
  label = 'Sélectionner une date',
  clearable = false,
  className = '',
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);

  const initialCursor = useMemo(() => {
    const parsed = parseISO(value);
    return parsed || new Date();
  }, [value]);

  const [viewYear, setViewYear] = useState(initialCursor.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialCursor.getMonth());

  useEffect(() => {
    if (!open) return;
    const base = parseISO(value) || new Date();
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, value]);

  const todayIso = getTodayISO();

  const shortcuts = useMemo(() => {
    const in7 = new Date();
    in7.setDate(in7.getDate() + 7);
    return [
      { label: 'Aujourd’hui', iso: todayIso },
      { label: 'Hier', iso: getDaysAgoISO(1) },
      { label: 'Dans 7 jours', iso: toISO(in7) },
      { label: 'Fin du mois', iso: getEndOfMonthISO() },
    ];
  }, [todayIso]);

  const calendarCells = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday = 0
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

    const cells: Array<{ iso: string; day: number; inMonth: boolean }> = [];

    for (let i = startWeekday - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const dt = new Date(viewYear, viewMonth - 1, dayNum);
      cells.push({ iso: toISO(dt), day: dayNum, inMonth: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(viewYear, viewMonth, d);
      cells.push({ iso: toISO(dt), day: d, inMonth: true });
    }

    while (cells.length % 7 !== 0) {
      const nextDay = cells.length - (startWeekday + daysInMonth) + 1;
      const dt = new Date(viewYear, viewMonth + 1, nextDay);
      cells.push({ iso: toISO(dt), day: nextDay, inMonth: false });
    }

    return cells;
  }, [viewYear, viewMonth]);

  const handleSelectIso = (iso: string) => {
    void haptics.tap();
    onChange(iso);
    setOpen(false);
  };

  const goPrevMonth = () => {
    void haptics.tap();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    void haptics.tap();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  return (
    <>
      <div className="relative flex items-center">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            void haptics.tap();
            setOpen(true);
          }}
          aria-label={label}
          className={`flex items-center justify-between gap-2 text-left transition-colors focus:border-[#F5B971] focus:outline-none disabled:opacity-50 ${
            className ||
            'h-11 w-full rounded-xl border border-zinc-800 bg-[#08090C] px-3 text-sm text-zinc-100 hover:border-zinc-700'
          } ${clearable && value ? 'pr-9' : ''}`}
        >
          <span
            className={`truncate font-mono-num ${
              value ? 'text-zinc-100' : 'text-zinc-500 font-sans'
            }`}
          >
            {value ? formatTriggerDate(value) : placeholder}
          </span>
          <Calendar className="h-4 w-4 shrink-0 text-[#F5B971]" />
        </button>

        {clearable && value && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void haptics.tap();
              onChange('');
            }}
            aria-label="Effacer la date"
            className="absolute right-8 flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4 animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-t-3xl border border-zinc-800 bg-[#121318] p-4 pb-6 shadow-2xl sm:rounded-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto h-1 w-10 rounded-full bg-zinc-700 sm:hidden" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#F5B971]" />
                  <h3 className="font-display text-sm font-bold text-zinc-100">
                    {label}
                  </h3>
                </div>
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

              {/* Raccourcis rapides */}
              <div className="grid grid-cols-2 gap-1.5">
                {shortcuts.map((s) => {
                  const active = value === s.iso;
                  return (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => handleSelectIso(s.iso)}
                      className={`min-h-[38px] rounded-xl border px-3 text-xs font-semibold transition-colors ${
                        active
                          ? 'border-[#F5B971] bg-[#F5B971]/15 text-[#F5B971]'
                          : 'border-zinc-800 bg-[#1A1C23] text-zinc-200 hover:border-zinc-700'
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>

              {/* Mini-calendrier tactile */}
              <div className="rounded-2xl border border-zinc-800/80 bg-[#08090C] p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={goPrevMonth}
                    aria-label="Mois précédent"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-[#121318] text-zinc-300 hover:border-[#F5B971]/60"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="font-display text-sm font-bold text-zinc-100">
                    {MONTHS_FR[viewMonth]} {viewYear}
                  </span>
                  <button
                    type="button"
                    onClick={goNextMonth}
                    aria-label="Mois suivant"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-[#121318] text-zinc-300 hover:border-[#F5B971]/60"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center">
                  {WEEKDAYS.map((wd, idx) => (
                    <div
                      key={idx}
                      className="py-1 text-[11px] font-semibold text-zinc-500"
                    >
                      {wd}
                    </div>
                  ))}
                  {calendarCells.map((cell) => {
                    const isSelected = value === cell.iso;
                    const isToday = todayIso === cell.iso;
                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        onClick={() => handleSelectIso(cell.iso)}
                        className={`flex min-h-[38px] items-center justify-center rounded-xl font-mono-num text-xs transition-colors ${
                          isSelected
                            ? 'bg-[#F5B971] font-bold text-[#08090C]'
                            : isToday
                            ? 'border border-[#F5B971]/60 bg-[#F5B971]/10 font-semibold text-[#F5B971]'
                            : cell.inMonth
                            ? 'text-zinc-200 hover:bg-[#1A1C23]'
                            : 'text-zinc-600 hover:bg-[#1A1C23]/60'
                        }`}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {clearable && value && (
                <button
                  type="button"
                  onClick={() => {
                    void haptics.tap();
                    onChange('');
                    setOpen(false);
                  }}
                  className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-[#1A1C23] text-xs font-medium text-zinc-300 hover:text-zinc-100"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Effacer la date</span>
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
