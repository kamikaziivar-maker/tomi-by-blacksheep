// src/components/SplashScreen.tsx
import React, { useEffect, useState } from 'react';
import { useFinance } from '../store/FinanceContext';
import { BrandLogo } from './BrandLogo';

interface SplashScreenProps {
  onDone: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onDone }) => {
  const { customLogoDataUrl } = useFinance();
  const [phase, setPhase] = useState<'enter' | 'inhale' | 'exhale' | 'zoom' | 'done'>('enter');

  useEffect(() => {
    const tInhale = window.setTimeout(() => setPhase('inhale'), 250);
    const tExhale = window.setTimeout(() => setPhase('exhale'), 1350);
    const tZoom = window.setTimeout(() => setPhase('zoom'), 2550);
    const tDone = window.setTimeout(() => {
      setPhase('done');
      onDone();
    }, 3150);

    return () => {
      window.clearTimeout(tInhale);
      window.clearTimeout(tExhale);
      window.clearTimeout(tZoom);
      window.clearTimeout(tDone);
    };
  }, [onDone]);

  if (phase === 'done') return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#08090C] select-none pointer-events-none transition-all duration-600 ease-out ${
        phase === 'zoom' ? 'opacity-0 scale-125' : 'opacity-100 scale-100'
      }`}
    >
      <div className="pointer-events-none absolute h-72 w-72 rounded-full bg-[#F5B971]/[0.06] blur-[100px]" />
      <div className="pointer-events-none absolute h-72 w-72 translate-x-12 translate-y-12 rounded-full bg-[#10B981]/[0.05] blur-[105px]" />

      <div
        className={`relative z-10 flex flex-col items-center text-center px-6 transition-all ease-in-out ${
          phase === 'enter'
            ? 'opacity-0 scale-95 duration-300'
            : phase === 'inhale'
            ? 'opacity-100 scale-[1.04] duration-900'
            : phase === 'exhale'
            ? 'opacity-100 scale-100 duration-900'
            : 'opacity-0 scale-150 duration-600'
        }`}
      >
        <BrandLogo
          customLogoDataUrl={customLogoDataUrl}
          frameless={true}
          sizeClass="h-44 w-60 sm:h-52 sm:w-72"
          roundedClass="rounded-none"
          className="mb-2"
        />

        <h1 className="mt-2 text-lg font-semibold tracking-wider text-zinc-100">
          TOMI <span className="text-[#F5B971]">by BlackSheep</span>
        </h1>

        <p className="mt-3 text-[11px] tracking-widest uppercase text-zinc-500">
          Developed by <span className="font-semibold text-zinc-300">Fujistudio</span>
        </p>
      </div>
    </div>
  );
};