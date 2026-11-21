import React, { useState } from 'react';
import { Delete, Lock } from 'lucide-react';

interface PinLockScreenProps {
  profileName?: string;
  onVerify: (pin: string) => Promise<boolean>;
  onUnlocked: () => void;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({
  profileName,
  onVerify,
  onUnlocked,
}) => {
  const [digits, setDigits] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [checking, setChecking] = useState<boolean>(false);

  const handleDigit = async (digit: string) => {
    if (checking || digits.length >= 4) return;
    const next = digits + digit;
    setDigits(next);
    setError('');

    if (next.length === 4) {
      setChecking(true);
      const ok = await onVerify(next);
      setChecking(false);
      if (ok) {
        onUnlocked();
      } else {
        setError('Code PIN incorrect');
        setDigits('');
      }
    }
  };

  const handleBackspace = () => {
    if (checking) return;
    setDigits((prev) => prev.slice(0, -1));
    setError('');
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0D0D0F] px-6 py-8"
      role="dialog"
      aria-modal="true"
      aria-label="Verrouillage PIN"
    >
      <div className="w-full max-w-xs space-y-7 text-center">
        <div className="flex flex-col items-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-[#141417] text-[#F5B971]">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="font-display text-lg font-bold text-zinc-100">
            TOMI <span className="text-[#F5B971] font-medium">by BlackSheep</span>
          </h1>
          <p className="text-xs text-zinc-400">
            {profileName ? `Session : ${profileName} · ` : ''}Entrez votre code PIN
          </p>
        </div>

        {/* 4 PIN dots */}
        <div className="flex items-center justify-center gap-4">
          {[0, 1, 2, 3].map((idx) => (
            <span
              key={idx}
              className={`h-3.5 w-3.5 rounded-full border transition-all ${
                idx < digits.length
                  ? 'border-[#F5B971] bg-[#F5B971] scale-110'
                  : 'border-zinc-700 bg-transparent'
              }`}
            />
          ))}
        </div>

        {error ? (
          <p className="text-xs font-medium text-[#EF4444] min-h-[16px]">{error}</p>
        ) : (
          <p className="text-xs text-zinc-600 min-h-[16px]">
            Accès hors ligne sécurisé localement
          </p>
        )}

        {/* Numeric keypad */}
        <div className="grid grid-cols-3 gap-3">
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => handleDigit(k)}
              className="flex h-14 items-center justify-center rounded-2xl border border-zinc-800/80 bg-[#141417] font-mono-num text-xl font-semibold text-zinc-100 transition-transform active:scale-95 hover:border-zinc-700"
            >
              {k}
            </button>
          ))}
          <div />
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="flex h-14 items-center justify-center rounded-2xl border border-zinc-800/80 bg-[#141417] font-mono-num text-xl font-semibold text-zinc-100 transition-transform active:scale-95 hover:border-zinc-700"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            aria-label="Effacer un chiffre"
            className="flex h-14 items-center justify-center rounded-2xl border border-zinc-800/80 bg-[#141417] text-zinc-400 transition-transform active:scale-95 hover:text-zinc-100"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
