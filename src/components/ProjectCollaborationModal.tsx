import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Eye,
  Lock,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  backdropMotionClass,
  sheetMotionClass,
  useAnimatedVisibility,
} from '../hooks/useAnimatedVisibility';
import { useFinance } from '../store/FinanceContext';
import { Project, ProjectRole } from '../types/finance';
import { haptics } from '../utils/haptics';
import { isSupabaseConfigured } from '../utils/supabaseClient';
import { CustomSelect, CustomSelectOption } from './CustomSelect';

interface ProjectCollaborationModalProps {
  isOpen: boolean;
  onClose: () => void;
  project?: Project | null;
  initialMode?: 'manage' | 'join';
  onJoinedProject?: (projectId: string) => void;
}

const ROLE_LABELS: Record<ProjectRole, string> = {
  owner: 'Propriétaire (Admin)',
  manager: 'Associé / Gestionnaire',
  viewer: 'Observateur (Lecture seule)',
};

const INVITE_ROLE_OPTIONS: CustomSelectOption[] = [
  {
    value: 'manager',
    label: 'Associé / Gestionnaire',
    sublabel: 'Ventes, charges et gestion des stocks',
    icon: <UserCheck className="h-4 w-4 text-[#F5B971]" />,
  },
  {
    value: 'viewer',
    label: 'Observateur (Lecture seule)',
    sublabel: 'Consultation en temps réel sans modification',
    icon: <Eye className="h-4 w-4 text-zinc-400" />,
  },
];

export const ProjectCollaborationModal: React.FC<ProjectCollaborationModalProps> = ({
  isOpen,
  onClose,
  project,
  initialMode = 'manage',
  onJoinedProject,
}) => {
  const {
    state,
    enableProjectSharing,
    inviteProjectMember,
    updateProjectMemberRole,
    removeProjectMember,
    joinSharedProjectByCode,
    syncSharedProjectsNow,
  } = useFinance();

  const [tab, setTab] = useState<'manage' | 'join'>(
    project ? initialMode : 'join'
  );
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<ProjectRole>('manager');
  const [joinCode, setJoinCode] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const { shouldRender, isVisible } = useAnimatedVisibility(isOpen);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      setTab(project ? initialMode : 'join');
      setFeedback(null);
      setCopiedCode(false);
    }
  }, [isOpen, project, initialMode]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!shouldRender) return null;

  const currentProject = project
    ? state.projects.find((p) => p.id === project.id) || project
    : null;
  const userRole: ProjectRole = currentProject?.sharedAccessRole ?? 'owner';
  const isOwner = userRole === 'owner';

  const members = currentProject
    ? (state.projectMembers ?? []).filter(
        (m) => m.projectId === currentProject.id
      )
    : [];

  const handleEnableSharing = async () => {
    if (!currentProject) return;
    setBusy(true);
    setFeedback(null);
    const res = await enableProjectSharing(currentProject.id);
    setBusy(false);
    setFeedback({ ok: res.ok, text: res.message || '' });
    if (res.ok) await haptics.success();
  };

  const handleCopyCode = async () => {
    if (!currentProject?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(currentProject.inviteCode);
      setCopiedCode(true);
      await haptics.tap();
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setFeedback({
        ok: false,
        text: `Code d'invitation : ${currentProject.inviteCode}`,
      });
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject) return;
    setBusy(true);
    setFeedback(null);
    const res = await inviteProjectMember({
      projectId: currentProject.id,
      email: inviteEmail,
      displayName: inviteName,
      role: inviteRole,
    });
    setBusy(false);
    setFeedback({ ok: res.ok, text: res.message });
    if (res.ok) {
      await haptics.success();
      setInviteEmail('');
      setInviteName('');
    }
  };

  const handleJoinProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    const res = await joinSharedProjectByCode(joinCode);
    setBusy(false);
    setFeedback({ ok: res.ok, text: res.message });
    if (res.ok) {
      await haptics.success();
      setJoinCode('');
      if (res.projectId && onJoinedProject) {
        onJoinedProject(res.projectId);
      }
    }
  };

  const handleSyncNow = async () => {
    setBusy(true);
    const res = await syncSharedProjectsNow();
    setBusy(false);
    setFeedback({ ok: res.ok, text: res.message });
    if (res.ok) await haptics.tap();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4 ${backdropMotionClass(
        isVisible
      )}`}
      role="dialog"
      aria-modal="true"
      aria-label="Collaboration isolée par projet"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-zinc-800 bg-[#121318] p-5 pb-7 shadow-2xl space-y-4 ${sheetMotionClass(
          isVisible
        )}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-zinc-700 sm:hidden" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F5B971]/15 text-[#F5B971]">
              <Users className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold text-zinc-100 truncate">
                {currentProject
                  ? `Équipe & Partage · ${currentProject.name}`
                  : 'Rejoindre un projet partagé'}
              </h2>
              <p className="text-[11px] text-zinc-400">
                Cloisonnement strict par projet · Temps réel Supabase
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              void haptics.tap();
              onClose();
            }}
            aria-label="Fermer"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation modale */}
        {currentProject && (
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-zinc-800/80 bg-[#08090C] p-1">
            <button
              type="button"
              onClick={() => {
                void haptics.tap();
                setTab('manage');
                setFeedback(null);
              }}
              className={`min-h-[40px] rounded-lg px-2 text-xs font-semibold transition-colors ${
                tab === 'manage'
                  ? 'bg-[#18181B] text-[#F5B971]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Équipe projet
            </button>
            <button
              type="button"
              onClick={() => {
                void haptics.tap();
                setTab('join');
                setFeedback(null);
              }}
              className={`min-h-[40px] rounded-lg px-2 text-xs font-semibold transition-colors ${
                tab === 'join'
                  ? 'bg-[#18181B] text-[#F5B971]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Rejoindre (Code)
            </button>
          </div>
        )}

        {/* Rappel sécurité cloisonnement */}
        <div className="flex items-start gap-2.5 rounded-xl border border-[#10B981]/30 bg-[#10B981]/5 p-3 text-xs text-zinc-300">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#10B981]" />
          <div>
            <span className="font-semibold text-[#10B981]">
              Périmètre strictement isolé :
            </span>{' '}
            un collaborateur invité n’accède qu’aux écritures et stocks de ce projet spécifique. Vos comptes personnels, dettes privées, épargne et autres projets restent invisibles.
          </div>
        </div>

        {feedback && (
          <div
            className={`rounded-xl border px-3.5 py-2.5 text-xs ${
              feedback.ok
                ? 'border-[#10B981]/40 bg-[#10B981]/10 text-[#10B981]'
                : 'border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF4444]'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* TAB 1 : Gérer l'équipe du projet */}
        {tab === 'manage' && currentProject && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-[#08090C] p-3.5">
              <div>
                <div className="text-xs text-zinc-400">Votre rôle sur ce projet</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-[#F5B971]">
                  {!isOwner && <Lock className="h-3.5 w-3.5" />}
                  <span>{ROLE_LABELS[userRole]}</span>
                </div>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSyncNow()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-700 bg-[#121318] px-3 text-xs font-medium text-zinc-200 hover:border-[#F5B971]/60 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`}
                />
                <span>Synchroniser</span>
              </button>
            </div>

            {!currentProject.isShared || !currentProject.inviteCode ? (
              <div className="rounded-xl border border-zinc-800 bg-[#08090C] p-4 text-center space-y-3">
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Ce projet est actuellement privé sur votre appareil. Activez le partage isolé pour générer un code d’invitation unique et co-gérer l’activité avec un associé.
                </p>
                <button
                  type="button"
                  disabled={busy || !isOwner}
                  onClick={() => void handleEnableSharing()}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#F5B971] px-4 text-xs font-bold text-[#08090C] disabled:opacity-40"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Activer le partage &amp; générer un code</span>
                </button>
              </div>
            ) : (
              <>
                {/* Invite Code Card */}
                <div className="rounded-xl border border-[#F5B971]/40 bg-[#F5B971]/5 p-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] text-zinc-400">
                      Code d’invitation unique du projet
                    </div>
                    <div className="mt-0.5 font-mono-num text-base font-bold tracking-wider text-[#F5B971]">
                      {currentProject.inviteCode}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopyCode()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#F5B971] px-3 text-xs font-bold text-[#08090C]"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Copié</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copier le code</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Invite form (Owner only) */}
                {isOwner && (
                  <form
                    onSubmit={handleInviteMember}
                    className="rounded-xl border border-zinc-800 bg-[#08090C] p-3.5 space-y-3"
                  >
                    <div className="text-xs font-semibold text-zinc-200">
                      Inviter un associé ou observateur
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        type="email"
                        required
                        placeholder="Email du compte TOMI"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="h-10 rounded-lg border border-zinc-800 bg-[#121318] px-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-[#F5B971] focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Nom / Prénom affiché"
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        className="h-10 rounded-lg border border-zinc-800 bg-[#121318] px-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-[#F5B971] focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="min-w-[200px] flex-1">
                        <CustomSelect
                          value={inviteRole}
                          onChange={(val) => setInviteRole(val as ProjectRole)}
                          options={INVITE_ROLE_OPTIONS}
                          title="Rôle du collaborateur"
                          searchable={false}
                          className="h-10 w-full rounded-lg border border-zinc-800 bg-[#121318] px-3 text-xs text-zinc-100"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={busy}
                        className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#F5B971] px-4 text-xs font-bold text-[#08090C] disabled:opacity-40"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        <span>Inviter</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* Members List */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-zinc-300">
                    Membres autorisés ({members.length})
                  </div>
                  <div className="divide-y divide-zinc-800/70 rounded-xl border border-zinc-800 bg-[#08090C]">
                    {members.map((m) => (
                      <div
                        key={m.id}
                        className="flex flex-wrap items-center justify-between gap-2 p-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F5B971]/15 text-xs font-bold text-[#F5B971]">
                            {m.initials}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-zinc-100 truncate">
                                {m.displayName}
                              </span>
                              <span
                                className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                                  m.status === 'active'
                                    ? 'bg-[#10B981]/15 text-[#10B981]'
                                    : 'bg-zinc-800 text-zinc-400'
                                }`}
                              >
                                {m.status === 'active' ? 'Actif' : 'Invité'}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-500 truncate">
                              {m.email}
                            </div>
                          </div>
                        </div>

                        {m.role === 'owner' ? (
                          <span className="text-[11px] font-semibold text-[#F5B971]">
                            Propriétaire
                          </span>
                        ) : isOwner ? (
                          <div className="flex items-center gap-1.5">
                            <CustomSelect
                              value={m.role}
                              onChange={(val) =>
                                void updateProjectMemberRole(
                                  m.id,
                                  val as ProjectRole
                                )
                              }
                              options={INVITE_ROLE_OPTIONS}
                              title={`Rôle de ${m.displayName}`}
                              searchable={false}
                              className="h-9 min-w-[140px] rounded-lg border border-zinc-800 bg-[#121318] px-2.5 text-[11px] text-zinc-200"
                            />
                            <button
                              type="button"
                              onClick={() => void removeProjectMember(m.id)}
                              aria-label="Retirer ce membre"
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:text-[#EF4444]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-zinc-400">
                            {ROLE_LABELS[m.role]}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 2 : Rejoindre un projet par code */}
        {tab === 'join' && (
          <form onSubmit={handleJoinProject} className="space-y-4">
            <div className="rounded-xl border border-zinc-800 bg-[#08090C] p-4 space-y-3">
              <label className="block text-xs font-semibold text-zinc-200">
                Code d’invitation fourni par le propriétaire
              </label>
              <input
                type="text"
                required
                placeholder="Ex: TOMI-A7K2-9P4M"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="h-11 w-full rounded-xl border border-zinc-800 bg-[#121318] px-3.5 font-mono-num text-sm font-semibold tracking-wider text-[#F5B971] placeholder:text-zinc-600 focus:border-[#F5B971] focus:outline-none"
              />
              {!isSupabaseConfigured && (
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Remarque : la synchronisation Cloud Supabase n’est pas encore active dans cet environnement. Connectez votre compte Cloud dans Paramètres pour synchroniser à distance.
                </p>
              )}
              <button
                type="submit"
                disabled={busy || !joinCode.trim()}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#F5B971] text-xs font-bold text-[#08090C] disabled:opacity-40"
              >
                <Users className="h-4 w-4" />
                <span>Rejoindre le projet partagé</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
