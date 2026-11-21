import React, { useEffect, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import {
  backdropMotionClass,
  sheetMotionClass,
  useAnimatedVisibility,
} from '../hooks/useAnimatedVisibility';
import { haptics } from '../utils/haptics';

export type GuideSectionId =
  | 'home'
  | 'quick_entry'
  | 'projects'
  | 'project_form'
  | 'debts_savings'
  | 'supports'
  | 'settings'
  | 'ai_coach';

interface GuideStep {
  title: string;
  body: string;
}

const SECTION_GUIDES: Record<GuideSectionId, { sectionTitle: string; steps: GuideStep[] }> = {
  home: {
    sectionTitle: 'Bienvenue sur TOMI',
    steps: [
      {
        title: '1. Votre profil & données modifiables',
        body: 'Vous démarrez en Profil Local sur cet appareil. Les montants et exemples affichés sont entièrement modifiables ou supprimables selon votre situation réelle.',
      },
      {
        title: '2. Solde global & supports',
        body: 'Visualisez en un coup d’œil le total consolidé en FBU et sa répartition entre votre Cash, vos comptes bancaires et votre Mobile Money.',
      },
      {
        title: '3. Mode discrétion & sauvegarde',
        body: 'Secouez le poignet ou touchez l’icône œil pour masquer vos montants en public. Vos données sont sauvegardées hors ligne, et synchronisées si vous activez un Compte Connecté.',
      },
    ],
  },
  quick_entry: {
    sectionTitle: 'Aide — Saisie rapide',
    steps: [
      {
        title: '1. Choisir le type d’opération',
        body: 'Entrée (+) pour un encaissement, Sortie (-) pour une dépense, Prêt interne pour financer un projet depuis votre poche perso, et Transfert pour déplacer de l’argent entre deux supports.',
      },
      {
        title: '2. Poche & Support exact',
        body: 'Sélectionnez la poche concernée (Perso, Projet ou Épargne) puis le support réel débité ou crédité (Cash, Banque, Lumicash, Ecocash...).',
      },
    ],
  },
  projects: {
    sectionTitle: 'Aide — Gestion des Projets',
    steps: [
      {
        title: '1. Suivi par activité',
        body: 'Chaque projet possède sa propre trésorerie, ses recettes et ses charges pour mesurer sa rentabilité réelle indépendamment de vos dépenses personnelles.',
      },
      {
        title: '2. Prêts internes',
        body: 'Si vous injectez de l’argent personnel dans un projet, enregistrez un Prêt interne afin de suivre ce que le projet doit vous rembourser.',
      },
    ],
  },
  project_form: {
    sectionTitle: 'Aide — Créer / Configurer un Projet',
    steps: [
      {
        title: '1. Nom & Catégorie',
        body: 'Donnez un nom clair à votre activité (ex. Boutique, Agro, Import...) et choisissez sa catégorie.',
      },
      {
        title: '2. Sources de revenus & Postes de dépenses',
        body: 'Listez vos types de ventes (sources de revenus) et vos charges habituelles (postes de dépenses) : ils apparaîtront automatiquement lors de vos saisies rapides.',
      },
    ],
  },
  debts_savings: {
    sectionTitle: 'Aide — Dettes & Épargne',
    steps: [
      {
        title: '1. Dettes vs Créances',
        body: 'Une Dette est une somme que vous devez rembourser. Une Créance est une somme qu’un tiers doit vous payer. Vous pouvez enregistrer des paiements partiels.',
      },
      {
        title: '2. Objectifs d’épargne',
        body: 'Créez des enveloppes d’épargne avec un montant cible et suivez votre progression à chaque versement.',
      },
    ],
  },
  supports: {
    sectionTitle: 'Aide — Supports de fonds',
    steps: [
      {
        title: '1. Vos emplacements d’argent',
        body: 'Configurez ici chaque endroit où se trouve réellement votre argent : Cash liquide, compte bancaire (avec référence) ou portefeuille Mobile Money.',
      },
      {
        title: '2. Solde initial & devise',
        body: 'Indiquez le solde actuel et la devise du compte : chaque opération mettra ce solde à jour automatiquement.',
      },
    ],
  },
  settings: {
    sectionTitle: 'Aide — Paramètres & Profils',
    steps: [
      {
        title: '1. Profil Local vs Compte Connecté',
        body: 'En Profil Local, tout reste uniquement sur ce téléphone. Avec un Compte Connecté, vos données se sauvegardent automatiquement dès qu’il y a du réseau pour être accessibles sur un autre téléphone.',
      },
      {
        title: '2. Devises, sécurité & gestes',
        body: 'Configurez votre devise principale (FBU), activez le verrouillage par code PIN et réglez la sensibilité du mode discrétion.',
      },
    ],
  },
  ai_coach: {
    sectionTitle: 'Aide — IA Coach Financier',
    steps: [
      {
        title: '1. Analyse personnalisée',
        body: 'L’IA Coach analyse vos soldes, vos dettes, votre épargne et la rentabilité de vos projets pour vous proposer des conseils concrets.',
      },
    ],
  },
};

export function openSectionGuide(section: GuideSectionId) {
  window.dispatchEvent(new CustomEvent('tomi:open-guide', { detail: section }));
}

interface SectionHelperProps {
  section: GuideSectionId;
  /** Déclenche automatiquement la modale à la 1re visite de cette section */
  autoOpenOnFirstVisit?: boolean;
  /** Affiche le bouton pour rouvrir l'aide manuellement à tout moment */
  showTriggerButton?: boolean;
  /** Texte optionnel à côté de l'icône (ex: "Guide") */
  triggerLabel?: string;
}

export const SectionHelper: React.FC<SectionHelperProps> = ({
  section,
  autoOpenOnFirstVisit = true,
  showTriggerButton = true,
  triggerLabel,
}) => {
  const storageKey = `tomi_guide_seen_${section}_v1`;
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const { shouldRender, isVisible } = useAnimatedVisibility(isOpen);

  const guide = SECTION_GUIDES[section];

  useEffect(() => {
    if (!autoOpenOnFirstVisit) return;
    const alreadySeen = localStorage.getItem(storageKey) === 'true';
    if (!alreadySeen) {
      setStepIndex(0);
      setIsOpen(true);
    }
  }, [autoOpenOnFirstVisit, storageKey]);

  useEffect(() => {
    const handleOpenEvent = (ev: Event) => {
      const customEv = ev as CustomEvent<GuideSectionId>;
      if (customEv.detail === section) {
        setStepIndex(0);
        setIsOpen(true);
      }
    };
    window.addEventListener('tomi:open-guide', handleOpenEvent);
    return () => window.removeEventListener('tomi:open-guide', handleOpenEvent);
  }, [section]);

  const openGuideManually = async () => {
    await haptics.tap();
    setStepIndex(0);
    setIsOpen(true);
  };

  const handleClose = async () => {
    await haptics.tap();
    localStorage.setItem(storageKey, 'true');
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        localStorage.setItem(storageKey, 'true');
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, storageKey]);

  const handleNext = async () => {
    await haptics.tap();
    if (stepIndex < guide.steps.length - 1) {
      setStepIndex((prev) => prev + 1);
    } else {
      await haptics.success();
      localStorage.setItem(storageKey, 'true');
      setIsOpen(false);
    }
  };

  const currentStep = guide.steps[stepIndex];

  return (
    <>
      {showTriggerButton && (
        <button
          type="button"
          onClick={() => void openGuideManually()}
          aria-label={`Aide : ${guide.sectionTitle}`}
          title="Afficher le guide de cette section"
          className={
            triggerLabel
              ? 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-800 bg-[#121318] px-2.5 text-[11px] font-medium text-zinc-300 hover:border-[#F5B971]/50 hover:text-[#F5B971]'
              : 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-[#121318] text-zinc-400 hover:border-[#F5B971]/50 hover:text-[#F5B971]'
          }
        >
          <HelpCircle className="h-3.5 w-3.5 text-[#F5B971]" />
          {triggerLabel && <span>{triggerLabel}</span>}
        </button>
      )}

      {shouldRender && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => void handleClose()}
          className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-4 ${backdropMotionClass(
            isVisible
          )}`}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-2xl border border-zinc-800 bg-[#121318] p-5 text-zinc-100 shadow-2xl ${sheetMotionClass(
              isVisible
            )}`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#F5B971]">
                {guide.sectionTitle}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">
                  {stepIndex + 1} / {guide.steps.length}
                </span>
                <button
                  type="button"
                  onClick={() => void handleClose()}
                  aria-label="Fermer l'aide"
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <h3 className="text-base font-semibold text-white">{currentStep.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              {currentStep.body}
            </p>

            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => void handleClose()}
                className="px-2 py-2 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Fermer
              </button>

              <div className="flex items-center gap-2">
                {stepIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      void haptics.tap();
                      setStepIndex((prev) => prev - 1);
                    }}
                    className="rounded-xl border border-zinc-700 px-3.5 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                  >
                    Précédent
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleNext()}
                  className="rounded-xl bg-[#F5B971] px-4 py-2 text-xs font-bold text-[#08090C] hover:opacity-95"
                >
                  {stepIndex < guide.steps.length - 1 ? 'Suivant' : 'Compris'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};