import React, { useState } from 'react';
import { haptics } from '../utils/haptics';

const STORAGE_KEY = 'tomi_onboarding_completed_v1';

const STEPS = [
  {
    title: 'Vue globale & supports',
    desc: 'Retrouvez ici la répartition de votre argent entre Cash, Banque et Mobile Money, ainsi que votre solde global.',
  },
  {
    title: 'Projets, dettes & épargne',
    desc: 'Suivez chaque projet avec ses sources de revenus et charges, gérez vos dettes et objectifs d’épargne, et tracez les prêts internes.',
  },
  {
    title: 'Saisie rapide & discrétion',
    desc: 'Utilisez l’ajout rapide pour enregistrer une opération en quelques secondes, et activez le mode discrétion pour masquer vos montants.',
  },
];

interface FirstLaunchGuideProps {
  onFinish: () => void;
}

export const FirstLaunchGuide: React.FC<FirstLaunchGuideProps> = ({ onFinish }) => {
  const [stepIndex, setStepIndex] = useState(0);

  const completeGuide = async () => {
    await haptics.success();
    localStorage.setItem(STORAGE_KEY, 'true');
    onFinish();
  };

  const handleNext = async () => {
    await haptics.tap();
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      await completeGuide();
    }
  };

  const current = STEPS[stepIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#121318] p-5 text-zinc-100 shadow-2xl">
        <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
          <span>GUIDE DE DÉMARRAGE</span>
          <span>
            {stepIndex + 1} / {STEPS.length}
          </span>
        </div>

        <h2 className="text-lg font-semibold text-white">{current.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">{current.desc}</p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={completeGuide}
            className="px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200"
          >
            Passer
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="rounded-xl bg-[#F5B971] px-4 py-2 text-sm font-semibold text-black hover:opacity-95"
          >
            {stepIndex < STEPS.length - 1 ? 'Suivant' : 'Compris'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const shouldShowFirstLaunchGuide = (): boolean => {
  return localStorage.getItem(STORAGE_KEY) !== 'true';
};