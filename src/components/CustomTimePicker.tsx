import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Clock, X } from 'lucide-react';
import {
  backdropMotionClass,
  sheetMotionClass,
  useAnimatedVisibility,
} from '../hooks/useAnimatedVisibility';
import { haptics } from '../utils/haptics';

interface CustomTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

const PRESET_TIMES = ['08:00', '12:00', '18:00', '20:00', '21:00'];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) =>
  String(i * 5).padStart(2, '0')
);

function parseTime(val: string): [string, string] {
  const match = /^(\d{2}):(\d{2})$/.exec(val || '');
  if (!match) return ['20', '00'];
  return [match[1], match[2]];
}

export const CustomTimePicker: React.FC<CustomTimePickerProps> = ({
  value,
  onChange,
  label = 'Heure du rappel',
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const { shouldRender, isVisible } = useAnimatedVisibility(open);
  const [draftHour, setDraftHour] = useState('20');
  const [draftMinute, setDraftMinute] = useState('00');

  useEffect(() => {
    if (!open) return;
    const [h, m] = parseTime(value);
    setDraftHour(h);
    setDraftMinute(m);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, value]);

  const handleConfirm = () => {
    void haptics.tap();
    onChange(`${draftHour}:${draftMinute}`);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void haptics.tap();
          setOpen(true);
        }}
        aria-label={label}
        className={`flex items-center justify-between gap-2 text-left transition-colors focus:border-[#F5B971] focus:outline-none ${
          className ||
          'h-10 w-full rounded-xl border border-zinc-800 bg-[#121318] px-3 text-xs text-zinc-100 hover:border-zinc-700'
        }`}
      >
        <span className="font-mono-num text-sm font-semibold text-zinc-100">
          {value || '20:00'}
        </span>
        <Clock className="h-4 w-4 shrink-0 text-[#F5B971]" />
      </button>

      {shouldRender &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={`fixed inset-0 z-[80] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4 ${backdropMotionClass(
              isVisible
            )}`}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onClick={() => setOpen(false)}
          >
            <div
              className={`w-full max-w-sm rounded-t-3xl border border-zinc-800 bg-[#121318] p-4 pb-6 shadow-2xl sm:rounded-2xl space-y-4 ${sheetMotionClass(
                isVisible
              )}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto h-1 w-10 rounded-full bg-zinc-700 sm:hidden" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#F5B971]" />
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

              <div className="rounded-2xl border border-zinc-800 bg-[#08090C] py-3 text-center">
                <div className="font-mono-num text-3xl font-bold tracking-wider text-[#F5B971]">
                  {draftHour}:{draftMinute}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {PRESET_TIMES.map((preset) => {
                  const active = `${draftHour}:${draftMinute}` === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        void haptics.tap();
                        onChange(preset);
                        setOpen(false);
                      }}
                      className={`flex-1 min-w-[54px] min-h-[36px] rounded-xl border font-mono-num text-xs font-semibold transition-colors ${
                        active
                          ? 'border-[#F5B971] bg-[#F5B971]/15 text-[#F5B971]'
                          : 'border-zinc-800 bg-[#1A1C23] text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-zinc-400">
                  Heure
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {HOURS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                        void haptics.tap();
                        setDraftHour(h);
                      }}
                      className={`min-h-[36px] rounded-lg font-mono-num text-xs font-medium transition-colors ${
                        draftHour === h
                          ? 'bg-[#F5B971] font-bold text-[#08090C]'
                          : 'bg-[#1A1C23] text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-zinc-400">
                  Minutes
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {MINUTES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        void haptics.tap();
                        setDraftMinute(m);
                      }}
                      className={`min-h-[36px] rounded-lg font-mono-num text-xs font-medium transition-colors ${
                        draftMinute === m
                          ? 'bg-[#F5B971] font-bold text-[#08090C]'
                          : 'bg-[#1A1C23] text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      :{m}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleConfirm}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#F5B971] text-sm font-bold text-[#08090C]"
              >
                <Check className="h-4 w-4" />
                <span>Confirmer ({draftHour}:{draftMinute})</span>
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
