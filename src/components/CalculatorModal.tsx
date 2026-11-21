import React, { useEffect, useState } from 'react';
import { Calculator, Check, Copy, Delete, X } from 'lucide-react';
import {
  backdropMotionClass,
  sheetMotionClass,
  useAnimatedVisibility,
} from '../hooks/useAnimatedVisibility';
import { haptics } from '../utils/haptics';

interface CalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyValue?: (value: number) => void;
  allowNegative?: boolean;
}

function evaluateSafeExpression(expr: string): number | null {
  const sanitized = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '.');
  if (!/^[0-9+\-*/.%()\s]+$/.test(sanitized.trim())) return null;
  try {
    // Évalue uniquement des opérateurs arithmétiques simples
    const withPercent = sanitized.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
    const result = Function(`"use strict"; return (${withPercent});`)();
    if (typeof result === 'number' && Number.isFinite(result)) {
      return Math.round(result * 100) / 100;
    }
    return null;
  } catch {
    return null;
  }
}

export const CalculatorModal: React.FC<CalculatorModalProps> = ({
  isOpen,
  onClose,
  onApplyValue,
  allowNegative = false,
}) => {
  const [expr, setExpr] = useState('');
  const [copied, setCopied] = useState(false);
  const { shouldRender, isVisible } = useAnimatedVisibility(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!shouldRender) return null;

  const liveResult = evaluateSafeExpression(expr);

  const appendToken = async (token: string) => {
    await haptics.tap();
    setCopied(false);
    setExpr((prev) => `${prev}${token}`);
  };

  const handleClear = async () => {
    await haptics.tap();
    setExpr('');
    setCopied(false);
  };

  const handleBackspace = async () => {
    await haptics.tap();
    setExpr((prev) => prev.slice(0, -1));
  };

  const handleEquals = async () => {
    await haptics.tap();
    if (liveResult !== null) {
      setExpr(String(liveResult));
    }
  };

  const handleCopy = async () => {
    if (liveResult === null) return;
    try {
      await navigator.clipboard?.writeText(String(liveResult));
      setCopied(true);
      await haptics.success();
    } catch {
      // Ignore si clipboard non autorisé
    }
  };

  const handleApply = async () => {
    if (liveResult === null || !onApplyValue) return;
    await haptics.success();
    onApplyValue(liveResult);
    onClose();
  };

  const buttons: { label: string; onClick: () => void; variant?: 'op' | 'accent' | 'muted' }[] = [
    { label: 'C', onClick: () => void handleClear(), variant: 'muted' },
    { label: '÷', onClick: () => void appendToken('÷'), variant: 'op' },
    { label: '×', onClick: () => void appendToken('×'), variant: 'op' },
    { label: '⌫', onClick: () => void handleBackspace(), variant: 'muted' },
    { label: '7', onClick: () => void appendToken('7') },
    { label: '8', onClick: () => void appendToken('8') },
    { label: '9', onClick: () => void appendToken('9') },
    { label: '-', onClick: () => void appendToken('-'), variant: 'op' },
    { label: '4', onClick: () => void appendToken('4') },
    { label: '5', onClick: () => void appendToken('5') },
    { label: '6', onClick: () => void appendToken('6') },
    { label: '+', onClick: () => void appendToken('+'), variant: 'op' },
    { label: '1', onClick: () => void appendToken('1') },
    { label: '2', onClick: () => void appendToken('2') },
    { label: '3', onClick: () => void appendToken('3') },
    { label: '%', onClick: () => void appendToken('%'), variant: 'op' },
    { label: '0', onClick: () => void appendToken('0') },
    { label: '00', onClick: () => void appendToken('00') },
    { label: '.', onClick: () => void appendToken('.') },
    { label: '=', onClick: () => void handleEquals(), variant: 'accent' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Calculatrice rapide"
      onClick={onClose}
      className={`fixed inset-0 z-[60] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4 ${backdropMotionClass(
        isVisible
      )}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-t-3xl sm:rounded-2xl border border-zinc-800 bg-[#121318] p-4 text-zinc-100 shadow-2xl space-y-3 ${sheetMotionClass(
          isVisible
        )}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-[#F5B971]" />
            <span className="text-xs font-semibold text-zinc-200">
              Calculatrice rapide
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              void haptics.tap();
              onClose();
            }}
            aria-label="Fermer la calculatrice"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-[#08090C] p-3 text-right">
          <div className="min-h-[20px] font-mono text-xs text-zinc-400 break-all">
            {expr || '0'}
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-[#F5B971]">
            {liveResult !== null ? liveResult.toLocaleString('fr-FR') : '—'}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {buttons.map((b) => (
            <button
              key={b.label}
              type="button"
              onClick={b.onClick}
              className={`flex h-12 items-center justify-center rounded-xl font-mono text-sm font-semibold transition-colors ${
                b.variant === 'accent'
                  ? 'bg-[#F5B971] text-[#08090C] font-bold'
                  : b.variant === 'op'
                  ? 'border border-[#F5B971]/30 bg-[#F5B971]/10 text-[#F5B971]'
                  : b.variant === 'muted'
                  ? 'border border-zinc-800 bg-[#18181B] text-zinc-300'
                  : 'border border-zinc-800/90 bg-[#08090C] text-zinc-100 hover:border-zinc-700'
              }`}
            >
              {b.label === '⌫' ? <Delete className="h-4 w-4" /> : b.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            disabled={liveResult === null}
            onClick={() => void handleCopy()}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-700 bg-[#08090C] px-3 text-xs font-medium text-zinc-200 disabled:opacity-40"
          >
            <Copy className="h-3.5 w-3.5 text-[#F5B971]" />
            <span>{copied ? 'Copié !' : 'Copier'}</span>
          </button>

          {onApplyValue && (
            <button
              type="button"
              disabled={liveResult === null || (!allowNegative && liveResult <= 0)}
              onClick={() => void handleApply()}
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#10B981] px-3 text-xs font-bold text-[#08090C] disabled:opacity-40"
            >
              <Check className="h-4 w-4" />
              <span>Appliquer</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};