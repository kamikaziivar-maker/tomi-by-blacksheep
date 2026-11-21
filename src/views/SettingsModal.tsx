import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Camera,
  CheckCircle2,
  Cloud,
  Download,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  MailCheck,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Wallet,
  Waves,
  Wifi,
  X,
} from 'lucide-react';
import { CustomTimePicker } from '../components/CustomTimePicker';
import { UserAvatar } from '../components/UserAvatar';
import {
  backdropMotionClass,
  sheetMotionClass,
  useAnimatedVisibility,
} from '../hooks/useAnimatedVisibility';
import { DEFAULT_ACCOUNT_SECURITY } from '../data/initialData';
import { requestMotionPermissionIfNeeded } from '../hooks/useShakeDetector';
import { useFinance } from '../store/FinanceContext';
import { AccountMode, ShakeSensitivity } from '../types/finance';
import { compressImageFile } from '../utils/imageUtils';
import { haptics } from '../utils/haptics';
import { requestNativeNotificationPermission } from '../utils/notificationsEngine';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSupportManager: (
    ownerType: 'personal' | 'project',
    ownerId: string,
    title: string
  ) => void;
  initialFocusSection?: 'profile' | 'general';
  onReplaySplash?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenSupportManager,
  initialFocusSection = 'general',
}) => {
  const {
    state,
    upsertCurrency,
    removeCurrency,
    persistenceStatus,
    exportJson,
    importJson,
    resetToStarter,
    resetToEmpty,
    activeNamespace,
    enablePinLock,
    disablePinLock,
    lockApp,
    updateAccountProfile,
    loginRemoteAccount,
    registerRemoteAccount,
    resendRemoteConfirmation,
    logoutRemoteAccount,
    privacyMode,
    shakeEnabled,
    shakeSensitivity,
    togglePrivacyMode,
    setShakeEnabled,
    setShakeSensitivity,
    ambientFlowsEnabled,
    setAmbientFlowsEnabled,
    notificationSettings,
    pushStatus,
    refreshNativePush,
    updateNotificationSettings,
    triggerTestNotification,
  } = useFinance();

  const [refreshingPush, setRefreshingPush] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const profileSectionRef = useRef<HTMLDivElement>(null);

  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newSymbol, setNewSymbol] = useState('');
  const [newRate, setNewRate] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Mon Profil & Sécurité (Profil Local isolé vs Compte Connecté)
  const account = state.settings.account ?? DEFAULT_ACCOUNT_SECURITY;
  const isRemoteSessionActive =
    account.mode === 'cloud_ready' &&
    (Boolean(account.remoteUserId) || activeNamespace.startsWith('user:'));
  const normalizedMode: AccountMode = isRemoteSessionActive
    ? 'cloud_ready'
    : 'local_profile';

  const [activeProfileTab, setActiveProfileTab] = useState<'local_profile' | 'cloud_ready'>(
    isRemoteSessionActive ? 'cloud_ready' : 'local_profile'
  );
  const [profileName, setProfileName] = useState(
    account.displayName === 'Mode Invité (Local)' ? '' : account.displayName
  );
  const [profileEmail, setProfileEmail] = useState(account.email || '');

  // Champs dédiés à l'authentification Cloud (séparés du Profil Local pour éviter tout mélange)
  const [remoteAuthAction, setRemoteAuthAction] = useState<'signin' | 'signup'>('signin');
  const [remoteDisplayName, setRemoteDisplayName] = useState('');
  const [remoteEmail, setRemoteEmail] = useState(
    isRemoteSessionActive ? account.email || '' : ''
  );
  const [remotePassword, setRemotePassword] = useState('');
  const [showRemotePassword, setShowRemotePassword] = useState(false);
  const [isConnectingRemote, setIsConnectingRemote] = useState(false);
  const [remoteAuthError, setRemoteAuthError] = useState<string | null>(null);
  const [needsConfirmationEmail, setNeedsConfirmationEmail] = useState<string | null>(null);
  const [isResendingConfirmation, setIsResendingConfirmation] = useState(false);

  const [avatarDataUrl, setAvatarDataUrl] = useState<string | undefined>(
    account.avatarDataUrl
  );
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [localProfileJustSaved, setLocalProfileJustSaved] = useState(false);
  const wasOpenRef = useRef(false);
  const { shouldRender, isVisible } = useAnimatedVisibility(isOpen);

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      const acc = state.settings.account ?? DEFAULT_ACCOUNT_SECURITY;
      const remoteActive =
        acc.mode === 'cloud_ready' &&
        (Boolean(acc.remoteUserId) || activeNamespace.startsWith('user:'));
      setActiveProfileTab(remoteActive ? 'cloud_ready' : 'local_profile');
      setProfileName(
        acc.displayName === 'Mode Invité (Local)' ? '' : acc.displayName
      );
      setProfileEmail(acc.email || '');
      if (remoteActive) {
        setRemoteEmail(acc.email || '');
      }
      setRemotePassword('');
      setShowRemotePassword(false);
      setRemoteAuthError(null);
      setNeedsConfirmationEmail(null);
      setAvatarDataUrl(acc.avatarDataUrl);
      setFeedback(null);
      setLocalProfileJustSaved(false);

      if (initialFocusSection === 'profile') {
        window.setTimeout(() => {
          profileSectionRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }, 60);
      }
    }
  }, [isOpen, initialFocusSection, state.settings.account, activeNamespace]);

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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, {
        size: 160,
        squareCrop: true,
        quality: 0.82,
      });
      setAvatarDataUrl(compressed);
      updateAccountProfile({ avatarDataUrl: compressed });
      await haptics.success();
      setFeedback('Photo de profil compressée et enregistrée.');
    } catch (err) {
      setFeedback(
        err instanceof Error
          ? err.message
          : 'Erreur lors du chargement de la photo.'
      );
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeProfileTab === 'local_profile' && isRemoteSessionActive) {
      setFeedback(
        'Déconnectez d’abord le compte Cloud actif pour modifier votre Profil Local.'
      );
      return;
    }

    const nextName =
      profileName.trim() ||
      (normalizedMode === 'cloud_ready' ? 'Compte Connecté' : 'Profil Local');
    const confirmedIso = new Date().toISOString();

    setProfileName(nextName);
    updateAccountProfile({
      mode: normalizedMode,
      displayName: nextName,
      email: profileEmail.trim() || undefined,
      avatarDataUrl,
      cloudProviderLabel: normalizedMode === 'cloud_ready' ? 'Supabase' : undefined,
      localProfileConfirmedAt:
        normalizedMode === 'local_profile'
          ? confirmedIso
          : account.localProfileConfirmedAt,
    });
    await haptics.success();
    if (normalizedMode === 'local_profile') {
      setLocalProfileJustSaved(true);
    }
    setFeedback(
      normalizedMode === 'cloud_ready'
        ? 'Profil du Compte Connecté mis à jour et synchronisé dans son espace isolé.'
        : `Profil local « ${nextName} » configuré et enregistré sur cet appareil.`
    );
  };

  const handleRemoteAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = remoteEmail.trim().toLowerCase();
    setRemoteAuthError(null);
    setNeedsConfirmationEmail(null);

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setRemoteAuthError('Veuillez saisir une adresse e-mail valide.');
      return;
    }
    if (remotePassword.length < 6) {
      setRemoteAuthError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setIsConnectingRemote(true);
    setFeedback(null);

    const res =
      remoteAuthAction === 'signup'
        ? await registerRemoteAccount(cleanEmail, remotePassword, remoteDisplayName)
        : await loginRemoteAccount(cleanEmail, remotePassword);

    setIsConnectingRemote(false);

    if (res.ok) {
      setRemotePassword('');
      setRemoteDisplayName('');
      setRemoteAuthError(null);
      setNeedsConfirmationEmail(null);
      setProfileEmail(cleanEmail);
      await haptics.success();
      setFeedback(res.message);
    } else {
      await haptics.warning();
      setRemoteAuthError(res.message);
      if (res.needsEmailConfirmation) {
        setNeedsConfirmationEmail(cleanEmail);
      }
    }
  };

  const handleResendConfirmation = async () => {
    const targetEmail = (needsConfirmationEmail || remoteEmail).trim().toLowerCase();
    if (!targetEmail) return;
    setIsResendingConfirmation(true);
    const res = await resendRemoteConfirmation(targetEmail);
    setIsResendingConfirmation(false);
    if (res.ok) {
      await haptics.success();
      setRemoteAuthError(null);
      setFeedback(res.message);
    } else {
      await haptics.warning();
      setRemoteAuthError(res.message);
    }
  };

  const handleProfileTabSelect = async (tab: 'local_profile' | 'cloud_ready') => {
    await haptics.tap();
    setActiveProfileTab(tab);
    setRemoteAuthError(null);
  };

  const handleDisconnectRemoteSession = async () => {
    await haptics.warning();
    await logoutRemoteAccount();
    setActiveProfileTab('local_profile');
    setRemotePassword('');
    setRemoteAuthError(null);
    setNeedsConfirmationEmail(null);
    setFeedback(
      'Compte Cloud déconnecté et son cache local purgé. Votre Profil Local de l’appareil a été restauré intact.'
    );
  };

  const handleEnablePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(pinInput)) {
      setFeedback('Le code PIN doit contenir exactement 4 chiffres.');
      return;
    }
    if (pinInput !== pinConfirm) {
      setFeedback('Les deux codes PIN ne correspondent pas.');
      return;
    }
    await enablePinLock(pinInput);
    setPinInput('');
    setPinConfirm('');
    setShowPinSetup(false);
    await haptics.success();
    setFeedback('Verrouillage par code PIN activé localement.');
  };

  const handleAddCurrency = async (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(newRate) || 0;
    if (!newCode.trim() || rate <= 0) return;
    upsertCurrency({
      code: newCode.trim().toUpperCase(),
      name: newName.trim() || newCode.trim().toUpperCase(),
      symbol: newSymbol.trim() || newCode.trim().toUpperCase(),
      rateToFbu: rate,
    });
    setNewCode('');
    setNewName('');
    setNewSymbol('');
    setNewRate('');
    await haptics.success();
    setFeedback('Devise enregistrée.');
  };

  const handleExport = async () => {
    const json = exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tomi-blacksheep-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    await haptics.success();
    setFeedback('Sauvegarde JSON exportée.');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const res = importJson(String(reader.result || ''));
      await haptics.success();
      setFeedback(
        res.ok
          ? 'Données importées avec succès.'
          : res.error || 'Erreur d’import.'
      );
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const formattedLastSave = persistenceStatus.lastSavedAt
    ? new Date(persistenceStatus.lastSavedAt).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'Instant';

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4 ${backdropMotionClass(
        isVisible
      )}`}
      role="dialog"
      aria-modal="true"
      aria-label="Paramètres et données"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-zinc-800 bg-[#121318] p-5 pb-7 shadow-2xl space-y-6 ${sheetMotionClass(
          isVisible
        )}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto -mt-1 h-1 w-10 rounded-full bg-zinc-700 sm:hidden" />

        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-zinc-100">
              Paramètres &amp; Données
            </h2>
            <p className="text-xs text-zinc-400">
              Profils, sécurité, supports, devises FBU, sauvegarde hors ligne
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void haptics.tap();
              onClose();
            }}
            aria-label="Fermer"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {feedback && (
          <div className="rounded-xl border border-[#F5B971]/40 bg-[#F5B971]/10 px-3.5 py-2.5 text-xs text-[#F5B971]">
            {feedback}
          </div>
        )}

        {/* Section 0: Profils (Profil Local vs Compte Connecté) & Sécurité */}
        <div
          id="section-mon-profil"
          ref={profileSectionRef}
          className="rounded-xl border border-zinc-800 bg-[#08090C] p-4 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#F5B971]" />
              <h3 className="text-xs font-semibold text-zinc-200">
                Profil &amp; Mode d’accès
              </h3>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] text-[#10B981]">
              <Wifi className="h-3 w-3" />
              <span>
                {persistenceStatus.isOnline
                  ? 'Réseau détecté • Sync auto prête'
                  : 'Hors ligne • Local actif'}
              </span>
            </span>
          </div>

          {/* Explication du cloisonnement strict */}
          <div className="rounded-xl border border-zinc-800/90 bg-[#121318] p-3 text-[11px] leading-relaxed text-zinc-400">
            Votre <strong className="text-zinc-200">Profil Local</strong> reste
            strictement isolé et conservé sur cet appareil. Lorsque vous connectez un{' '}
            <strong className="text-zinc-200">Compte Connecté</strong> (même sur le
            téléphone d’un ami), ses données s’ouvrent dans un espace séparé sans jamais
            écraser ni mélanger le Profil Local.
          </div>

          {/* Sélecteur 2 espaces : Profil Local vs Compte Connecté */}
          <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-zinc-800/80 bg-[#121318] p-1">
            <button
              type="button"
              onClick={() => void handleProfileTabSelect('local_profile')}
              className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                activeProfileTab === 'local_profile'
                  ? 'bg-[#18181B] text-[#F5B971] border border-zinc-700 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>Profil Local</span>
            </button>

            <button
              type="button"
              onClick={() => void handleProfileTabSelect('cloud_ready')}
              className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                activeProfileTab === 'cloud_ready'
                  ? 'bg-[#18181B] text-[#F5B971] border border-zinc-700 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              <Cloud className="h-3.5 w-3.5" />
              <span>Compte Connecté</span>
              {isRemoteSessionActive && (
                <span className="h-2 w-2 rounded-full bg-[#10B981]" aria-hidden="true" />
              )}
            </button>
          </div>

          {activeProfileTab === 'local_profile' ? (
            isRemoteSessionActive ? (
              <div className="space-y-3 rounded-xl border border-zinc-800 bg-[#121318] p-4">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#10B981]" />
                  <div className="space-y-1 text-xs">
                    <div className="font-semibold text-zinc-100">
                      Profil Local protégé en arrière-plan
                    </div>
                    <p className="text-[11px] leading-relaxed text-zinc-400">
                      Le compte Cloud{' '}
                      <strong className="text-zinc-200">{account.email}</strong> est
                      actuellement ouvert sur cet appareil. Le Profil Local de ce
                      téléphone est conservé intact dans son espace séparé.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDisconnectRemoteSession()}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#EF4444]/35 bg-[#EF4444]/10 px-3 text-xs font-semibold text-[#EF4444] hover:bg-[#EF4444]/20"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Se déconnecter du Cloud &amp; revenir au Profil Local</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Photo de profil + Nom */}
                <div className="flex flex-wrap items-center gap-3.5 rounded-xl border border-zinc-800/80 bg-[#121318] p-3">
                  <UserAvatar
                    name={profileName || 'Profil Local'}
                    avatarDataUrl={avatarDataUrl}
                    size="lg"
                  />
                  <div className="flex-1 min-w-[180px] space-y-1.5">
                    <div className="text-xs font-semibold text-zinc-100">
                      Photo de profil
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Compressée automatiquement en miniature légère stockée localement.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-700 bg-[#08090C] px-2.5 text-xs font-medium text-[#F5B971] hover:border-[#F5B971]"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        <span>
                          {avatarDataUrl ? 'Changer la photo' : 'Importer une photo'}
                        </span>
                      </button>
                      {avatarDataUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setAvatarDataUrl(undefined);
                            updateAccountProfile({ avatarDataUrl: undefined });
                            setFeedback('Photo de profil retirée.');
                          }}
                          className="h-8 rounded-lg px-2 text-xs text-zinc-400 hover:text-[#EF4444]"
                        >
                          Retirer
                        </button>
                      )}
                    </div>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </div>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-2.5">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      placeholder="Votre nom (ex: Guy Bertrand)"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="h-10 rounded-xl border border-zinc-800 bg-[#121318] px-3 text-xs text-zinc-100 focus:border-[#F5B971] focus:outline-none"
                    />
                    <input
                      type="email"
                      placeholder="Email de contact (optionnel)"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      className="h-10 rounded-xl border border-zinc-800 bg-[#121318] px-3 text-xs text-zinc-100 focus:border-[#F5B971] focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-zinc-500">
                      100 % stocké sur ce téléphone, utilisable hors ligne.
                    </span>
                    <button
                      type="submit"
                      className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#F5B971] px-3.5 text-xs font-bold text-[#08090C] shrink-0 hover:bg-[#f7c587]"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>Enregistrer &amp; confirmer le profil local</span>
                    </button>
                  </div>
                </form>

                {(localProfileJustSaved || Boolean(account.localProfileConfirmedAt)) && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="flex items-start gap-2.5 rounded-xl border border-[#10B981]/40 bg-[#10B981]/10 px-3.5 py-2.5 text-xs"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#10B981]" />
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-semibold text-[#10B981]">
                        Profil local configuré et enregistré sur cet appareil
                      </div>
                      <div className="text-[11px] text-zinc-300">
                        Profil :{' '}
                        <strong className="text-zinc-100">{account.displayName}</strong>
                        {account.localProfileConfirmedAt && (
                          <>
                            {' · '}
                            Sauvegardé le{' '}
                            {new Date(account.localProfileConfirmedAt).toLocaleString(
                              'fr-FR',
                              {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              }
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          ) : isRemoteSessionActive ? (
            /* Session Cloud active et isolée */
            <div className="space-y-3 rounded-xl border border-[#10B981]/35 bg-[#121318] p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <UserAvatar
                    name={account.displayName || 'Compte Connecté'}
                    avatarDataUrl={avatarDataUrl}
                    size="md"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#10B981]">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>Session Cloud connectée</span>
                    </div>
                    <div className="truncate text-xs font-medium text-zinc-100">
                      {account.email}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDisconnectRemoteSession()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#EF4444]/35 bg-[#EF4444]/10 px-3 text-xs font-semibold text-[#EF4444] hover:bg-[#EF4444]/20"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Déconnexion</span>
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-2 border-t border-zinc-800/80 pt-3">
                <label className="block text-[11px] font-medium text-zinc-400">
                  Nom affiché sur ce compte
                </label>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    placeholder="Votre nom"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="h-10 flex-1 min-w-[160px] rounded-xl border border-zinc-800 bg-[#08090C] px-3 text-xs text-zinc-100 focus:border-[#F5B971] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#F5B971] px-3.5 text-xs font-bold text-[#08090C] hover:bg-[#f7c587]"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>Enregistrer le nom</span>
                  </button>
                </div>
              </form>

              <p className="text-[11px] leading-relaxed text-zinc-400">
                Synchronisation automatique active dès qu’un réseau est détecté. La
                déconnexion efface uniquement les caches locaux de ce compte et restaure
                intact le Profil Local de cet appareil.
              </p>
            </div>
          ) : (
            /* Formulaire Connexion / Création de compte Cloud (E-mail + Mot de passe) */
            <div className="space-y-3 rounded-xl border border-zinc-800/80 bg-[#121318] p-3.5">
              <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-zinc-800 bg-[#08090C] p-1">
                <button
                  type="button"
                  onClick={() => {
                    setRemoteAuthAction('signin');
                    setRemoteAuthError(null);
                  }}
                  className={`flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors ${
                    remoteAuthAction === 'signin'
                      ? 'bg-[#1A1C23] text-[#F5B971] border border-zinc-700 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  <Cloud className="h-3.5 w-3.5" />
                  <span>Se connecter</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRemoteAuthAction('signup');
                    setRemoteAuthError(null);
                  }}
                  className={`flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors ${
                    remoteAuthAction === 'signup'
                      ? 'bg-[#1A1C23] text-[#F5B971] border border-zinc-700 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Créer un compte</span>
                </button>
              </div>

              <form onSubmit={handleRemoteAuthSubmit} className="space-y-2.5">
                {remoteAuthAction === 'signup' && (
                  <input
                    type="text"
                    placeholder="Votre nom / pseudo (ex: Guy Bertrand)"
                    value={remoteDisplayName}
                    onChange={(e) => setRemoteDisplayName(e.target.value)}
                    autoComplete="name"
                    className="h-10 w-full rounded-xl border border-zinc-800 bg-[#08090C] px-3 text-xs text-zinc-100 focus:border-[#F5B971] focus:outline-none"
                  />
                )}

                <input
                  type="email"
                  placeholder="Adresse e-mail du compte"
                  value={remoteEmail}
                  onChange={(e) => setRemoteEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="h-10 w-full rounded-xl border border-zinc-800 bg-[#08090C] px-3 text-xs text-zinc-100 focus:border-[#F5B971] focus:outline-none"
                />

                <div className="relative">
                  <input
                    type={showRemotePassword ? 'text' : 'password'}
                    placeholder="Mot de passe (6 caractères minimum)"
                    value={remotePassword}
                    onChange={(e) => setRemotePassword(e.target.value)}
                    autoComplete={
                      remoteAuthAction === 'signup' ? 'new-password' : 'current-password'
                    }
                    required
                    className="h-10 w-full rounded-xl border border-zinc-800 bg-[#08090C] pl-3 pr-10 text-xs text-zinc-100 focus:border-[#F5B971] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRemotePassword((v) => !v)}
                    aria-label={
                      showRemotePassword
                        ? 'Masquer le mot de passe'
                        : 'Afficher le mot de passe'
                    }
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  >
                    {showRemotePassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {remoteAuthError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-[#EF4444]/40 bg-[#EF4444]/10 px-3 py-2.5 text-[11px] leading-relaxed text-[#FCA5A5]"
                  >
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#EF4444]" />
                    <div className="space-y-2 flex-1">
                      <div>{remoteAuthError}</div>
                      {needsConfirmationEmail && (
                        <button
                          type="button"
                          disabled={isResendingConfirmation}
                          onClick={() => void handleResendConfirmation()}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#F5B971]/40 bg-[#F5B971]/15 px-2.5 text-[11px] font-semibold text-[#F5B971] hover:bg-[#F5B971]/25 disabled:opacity-60"
                        >
                          <MailCheck className="h-3.5 w-3.5" />
                          <span>
                            {isResendingConfirmation
                              ? 'Envoi en cours...'
                              : 'Renvoyer l’e-mail de confirmation'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isConnectingRemote}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#F5B971] px-4 text-xs font-bold text-[#08090C] hover:bg-[#f7c587] disabled:opacity-60"
                >
                  {remoteAuthAction === 'signup' ? (
                    <UserPlus className="h-4 w-4" />
                  ) : (
                    <Cloud className="h-4 w-4" />
                  )}
                  <span>
                    {isConnectingRemote
                      ? remoteAuthAction === 'signup'
                        ? 'Création du compte...'
                        : 'Connexion & chargement...'
                      : remoteAuthAction === 'signup'
                      ? 'Créer mon compte & synchroniser'
                      : 'Se connecter & charger mes données'}
                  </span>
                </button>
              </form>

              <p className="text-[11px] leading-relaxed text-zinc-500">
                Espace strictement isolé : vos données Cloud s’ouvrent séparément et ne
                modifient jamais le Profil Local enregistré sur ce téléphone.
              </p>
            </div>
          )}
          {/* Code PIN local optionnel */}
          <div className="border-t border-zinc-800/80 pt-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-zinc-200">
                  Verrouillage rapide par code PIN local
                </div>
                <div className="text-[11px] text-zinc-500">
                  {account.pinEnabled
                    ? 'Code PIN à 4 chiffres actif au lancement.'
                    : 'Désactivé par défaut pour un accès direct.'}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {account.pinEnabled ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        void haptics.tap();
                        onClose();
                        lockApp();
                      }}
                      className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-700 bg-[#121318] px-3 text-xs font-medium text-zinc-200 hover:border-[#F5B971]"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      <span>Verrouiller</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        disablePinLock();
                        await haptics.tap();
                        setFeedback('Verrouillage PIN désactivé.');
                      }}
                      className="h-9 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 text-xs font-medium text-[#EF4444]"
                    >
                      Désactiver
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      void haptics.tap();
                      setShowPinSetup((v) => !v);
                    }}
                    className="h-9 rounded-lg border border-zinc-700 bg-[#121318] px-3 text-xs font-semibold text-[#F5B971] hover:border-[#F5B971]"
                  >
                    {showPinSetup ? 'Annuler' : 'Activer un PIN'}
                  </button>
                )}
              </div>
            </div>

            {showPinSetup && !account.pinEnabled && (
              <form
                onSubmit={handleEnablePin}
                className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-3"
              >
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  pattern="\d{4}"
                  required
                  placeholder="Code (4 chiffres)"
                  value={pinInput}
                  onChange={(e) =>
                    setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))
                  }
                  className="h-10 rounded-xl border border-zinc-800 bg-[#121318] px-3 font-mono-num text-xs text-zinc-100"
                />
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  pattern="\d{4}"
                  required
                  placeholder="Confirmer PIN"
                  value={pinConfirm}
                  onChange={(e) =>
                    setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))
                  }
                  className="h-10 rounded-xl border border-zinc-800 bg-[#121318] px-3 font-mono-num text-xs text-zinc-100"
                />
                <button
                  type="submit"
                  className="col-span-2 sm:col-span-1 h-10 rounded-xl bg-[#F5B971] text-xs font-bold text-[#08090C]"
                >
                  Activer PIN
                </button>
              </form>
            )}
          </div>

          {/* Shake pour mode discret */}
          <div className="border-t border-zinc-800/80 pt-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <EyeOff className="h-3.5 w-3.5 text-[#F5B971]" />
                  <span>Shake pour mode discret</span>
                </div>
                <div className="text-[11px] text-zinc-500">
                  Secouez le poignet sur l’accueil pour masquer/afficher vos montants
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void haptics.heavy();
                    togglePrivacyMode();
                  }}
                  className={`h-9 rounded-lg border px-3 text-xs font-medium transition-colors ${
                    privacyMode
                      ? 'border-[#F5B971]/60 bg-[#F5B971]/15 text-[#F5B971]'
                      : 'border-zinc-700 bg-[#121318] text-zinc-300'
                  }`}
                >
                  {privacyMode ? 'Masqué' : 'Visible'}
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const next = !shakeEnabled;
                    if (next) {
                      const perm = await requestMotionPermissionIfNeeded();
                      if (perm === 'denied') {
                        setFeedback(
                          'Permission capteur de mouvement refusée par l’appareil.'
                        );
                        return;
                      }
                    }
                    setShakeEnabled(next);
                    await haptics.tap();
                    setFeedback(
                      next
                        ? 'Détection de secousse activée sur l’accueil.'
                        : 'Détection de secousse désactivée.'
                    );
                  }}
                  className={`h-9 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                    shakeEnabled
                      ? 'border-[#10B981]/50 bg-[#10B981]/15 text-[#10B981]'
                      : 'border-zinc-700 bg-[#121318] text-zinc-400'
                  }`}
                >
                  {shakeEnabled ? 'Actif' : 'Inactif'}
                </button>
              </div>
            </div>

            {shakeEnabled && (
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-zinc-400">
                  Sensibilité de secousse
                </span>
                <div className="inline-flex rounded-lg border border-zinc-800 bg-[#121318] p-0.5">
                  {(
                    [
                      { id: 'soft', label: 'Douce' },
                      { id: 'normal', label: 'Normale' },
                      { id: 'strong', label: 'Forte' },
                    ] as { id: ShakeSensitivity; label: string }[]
                  ).map((lvl) => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => {
                        void haptics.tap();
                        setShakeSensitivity(lvl.id);
                      }}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        shakeSensitivity === lvl.id
                          ? 'bg-[#F5B971] text-[#08090C] font-semibold'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 0b: Flux lumineux en arrière-plan */}
        <div className="rounded-xl border border-zinc-800 bg-[#08090C] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <Waves className="h-4 w-4 text-[#F5B971] shrink-0" />
                <span>Flux lumineux en arrière-plan</span>
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                Lueurs et courbes discrètes sur fond sombre verrouillé
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={ambientFlowsEnabled}
              onClick={async () => {
                const next = !ambientFlowsEnabled;
                setAmbientFlowsEnabled(next);
                await haptics.tap();
                setFeedback(
                  next
                    ? 'Flux lumineux discrets activés.'
                    : 'Flux lumineux en arrière-plan désactivés.'
                );
              }}
              className={`h-8 min-w-[68px] shrink-0 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
                ambientFlowsEnabled
                  ? 'border-[#10B981]/50 bg-[#10B981]/15 text-[#10B981]'
                  : 'border-zinc-700 bg-[#121318] text-zinc-400'
              }`}
            >
              {ambientFlowsEnabled ? 'Actif' : 'Inactif'}
            </button>
          </div>
        </div>

        {/* Section 1: Notifications & Rappels intelligents */}
        <div className="rounded-xl border border-zinc-800 bg-[#08090C] p-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-[#F5B971]" />
              <h3 className="text-xs font-semibold text-zinc-200">
                Notifications &amp; Rappels intelligents
              </h3>
            </div>
            <button
              type="button"
              onClick={async () => {
                await requestNativeNotificationPermission();
                triggerTestNotification();
                await haptics.success();
                setFeedback(
                  'Notification test envoyée dans le centre et à l’écran.'
                );
              }}
              className="h-8 rounded-lg bg-[#F5B971] px-3 text-xs font-bold text-[#08090C] hover:bg-[#f7c587]"
            >
              Tester une notification
            </button>
          </div>

          {/* État des Notifications Push Natives Android (FCM) */}
          <div
            className={`flex flex-wrap items-center justify-between gap-2.5 rounded-xl border p-3 ${
              pushStatus.isNative && pushStatus.permission === 'granted'
                ? 'border-[#10B981]/35 bg-[#10B981]/10'
                : pushStatus.isNative &&
                  (pushStatus.permission === 'denied' ||
                    pushStatus.permission === 'error')
                ? 'border-[#EF4444]/35 bg-[#EF4444]/10'
                : 'border-zinc-800 bg-[#121318]'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <Smartphone
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  pushStatus.isNative && pushStatus.permission === 'granted'
                    ? 'text-[#10B981]'
                    : pushStatus.isNative &&
                      (pushStatus.permission === 'denied' ||
                        pushStatus.permission === 'error')
                    ? 'text-[#EF4444]'
                    : 'text-[#F5B971]'
                }`}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-100">
                  {pushStatus.isNative && pushStatus.permission === 'granted' && (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#10B981]" />
                  )}
                  <span>
                    {!pushStatus.isNative
                      ? 'Push natives Android (FCM) · Mode navigateur'
                      : pushStatus.permission === 'granted'
                      ? 'Notifications Push Android actives'
                      : pushStatus.permission === 'denied'
                      ? 'Notifications Push Android refusées'
                      : 'Notifications Push Android en attente'}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-zinc-400 leading-relaxed">
                  {!pushStatus.isNative
                    ? 'Les alertes push FCM s’activent automatiquement sur l’application Android installée.'
                    : pushStatus.permission === 'granted'
                    ? pushStatus.syncedToCloud
                      ? 'Appareil enregistré sur Supabase. Vous recevrez les alertes d’équipe même application fermée.'
                      : pushStatus.token
                      ? 'Jeton FCM prêt. Connectez votre compte Cloud pour recevoir les alertes de projets partagés.'
                      : 'Permission accordée. Récupération du jeton FCM en cours...'
                    : pushStatus.lastError ||
                      'Autorisez les notifications système Android pour recevoir les opérations d’équipe en temps réel.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={refreshingPush}
              onClick={async () => {
                setRefreshingPush(true);
                void haptics.tap();
                if (!pushStatus.isNative) {
                  const webRes = await requestNativeNotificationPermission();
                  setRefreshingPush(false);
                  if (webRes === 'granted') {
                    await haptics.success();
                    setFeedback('Notifications navigateur autorisées.');
                  } else {
                    setFeedback(
                      'Sur navigateur, les notifications Push FCM restent réservées à l’app Android.'
                    );
                  }
                  return;
                }
                const next = await refreshNativePush();
                setRefreshingPush(false);
                if (next.permission === 'granted') {
                  await haptics.success();
                  setFeedback(
                    next.syncedToCloud
                      ? 'Notifications Push Android actives et synchronisées.'
                      : 'Autorisation Push Android activée.'
                  );
                } else {
                  await haptics.warning();
                  setFeedback(
                    next.lastError ||
                      'Autorisation refusée. Activez les notifications dans les réglages Android de TOMI.'
                  );
                }
              }}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-700 bg-[#18181B] px-2.5 text-[11px] font-semibold text-zinc-200 hover:border-[#F5B971] disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3 w-3 text-[#F5B971] ${
                  refreshingPush ? 'animate-spin' : ''
                }`}
              />
              <span>
                {!pushStatus.isNative
                  ? 'Vérifier'
                  : pushStatus.permission === 'granted'
                  ? 'Actualiser'
                  : 'Réactiver l’autorisation'}
              </span>
            </button>
          </div>

          <div className="divide-y divide-zinc-800/70">
            {[
              {
                key: 'internalLoansEnabled' as const,
                label: 'Prêts internes à rembourser',
                desc: 'Rappels vers le Compte Personnel et échéances',
              },
              {
                key: 'debtsEnabled' as const,
                label: 'Échéances des dettes',
                desc: 'Alertes sur les dates prévues par créancier',
              },
              {
                key: 'projectsRedlineEnabled' as const,
                label: 'Projets / Ligne rouge',
                desc: 'Flux négatif ou seuil bas de trésorerie',
              },
              {
                key: 'aiReportsEnabled' as const,
                label: 'Rapports IA Coach',
                desc: 'Disponibilité du bilan hebdo et mensuel',
              },
              {
                key: 'dailyReminderEnabled' as const,
                label: 'Rappel de saisie quotidienne',
                desc: 'Rappel en fin de journée pour saisir vos mouvements',
              },
            ].map((item) => {
              const active = notificationSettings[item.key];
              return (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-1 last:pb-1"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-zinc-200">
                      {item.label}
                    </div>
                    <div className="text-[11px] text-zinc-500">{item.desc}</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={active}
                    onClick={() => {
                      void haptics.tap();
                      updateNotificationSettings({ [item.key]: !active });
                    }}
                    className={`h-8 min-w-[68px] shrink-0 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'border-[#10B981]/50 bg-[#10B981]/15 text-[#10B981]'
                        : 'border-zinc-700 bg-[#121318] text-zinc-400'
                    }`}
                  >
                    {active ? 'Actif' : 'Inactif'}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-2.5 border-t border-zinc-800/80 pt-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] text-zinc-400">
                Heure du rappel quotidien
              </label>
              <CustomTimePicker
                value={notificationSettings.dailyReminderTime}
                onChange={(val) =>
                  updateNotificationSettings({
                    dailyReminderTime: val,
                  })
                }
                label="Heure du rappel quotidien"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-zinc-400">
                Seuil alerte projet / ligne rouge (FBU)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={notificationSettings.lowTreasuryThresholdFbu}
                onChange={(e) =>
                  updateNotificationSettings({
                    lowTreasuryThresholdFbu:
                      parseFloat(e.target.value) || 0,
                  })
                }
                className="h-10 w-full rounded-xl border border-zinc-800 bg-[#121318] px-3 font-mono-num text-xs text-zinc-100 focus:border-[#F5B971] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Supports de fonds */}
        <div className="rounded-xl border border-zinc-800 bg-[#08090C] p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Wallet className="h-4 w-4 text-[#F5B971] shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-zinc-200">
                Supports de fonds personnels
              </div>
              <div className="text-[11px] text-zinc-500">
                Cash, comptes bancaires et Mobile Money
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void haptics.tap();
              onClose();
              onOpenSupportManager('personal', 'personal', 'Compte Personnel');
            }}
            className="h-9 shrink-0 rounded-xl border border-zinc-700 bg-[#121318] px-3 text-xs font-semibold text-[#F5B971] hover:border-[#F5B971]"
          >
            Gérer
          </button>
        </div>

        {/* Section 3: Devises & Taux vers FBU */}
        <div className="rounded-xl border border-zinc-800 bg-[#08090C] p-4 space-y-3">
          <h3 className="text-xs font-semibold text-zinc-200">
            Devises &amp; taux vers FBU (Devise principale : FBU)
          </h3>
          <div className="divide-y divide-zinc-800/70">
            {state.settings.currencies.map((c) => (
              <div
                key={c.code}
                className="flex items-center justify-between py-2 text-xs"
              >
                <div>
                  <span className="font-semibold text-[#F5B971]">{c.code}</span>{' '}
                  <span className="text-zinc-400">({c.name})</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono-num text-zinc-200">
                    1 {c.code} = {c.rateToFbu.toLocaleString('fr-FR')} FBU
                  </span>
                  {c.code !== 'FBU' && (
                    <button
                      type="button"
                      onClick={async () => {
                        removeCurrency(c.code);
                        await haptics.tap();
                      }}
                      className="text-zinc-500 hover:text-[#EF4444]"
                      aria-label={`Supprimer ${c.code}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleAddCurrency}
            className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-5"
          >
            <input
              type="text"
              placeholder="Code (USD)"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              className="h-10 rounded-xl border border-zinc-800 bg-[#121318] px-2.5 text-xs text-zinc-100"
            />
            <input
              type="text"
              placeholder="Nom"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-10 rounded-xl border border-zinc-800 bg-[#121318] px-2.5 text-xs text-zinc-100"
            />
            <input
              type="text"
              placeholder="Symbole ($)"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              className="h-10 rounded-xl border border-zinc-800 bg-[#121318] px-2.5 text-xs text-zinc-100"
            />
            <input
              type="number"
              step="any"
              placeholder="Taux FBU"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              className="h-10 rounded-xl border border-zinc-800 bg-[#121318] px-2.5 font-mono-num text-xs text-zinc-100"
            />
            <button
              type="submit"
              className="col-span-2 sm:col-span-1 inline-flex h-10 items-center justify-center gap-1 rounded-xl bg-[#F5B971] text-xs font-bold text-[#08090C]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Ajouter</span>
            </button>
          </form>
        </div>

        {/* Section 4: Persistance locale & Sauvegarde JSON */}
        <div className="rounded-xl border border-zinc-800 bg-[#08090C] p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-200">
              Persistance locale &amp; Sauvegarde
            </span>
            <span className="text-[11px] text-zinc-400">
              Dernière maj : {formattedLastSave}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500">
            {persistenceStatus.indexedDbSynced
              ? 'Sauvegarde locale et IndexedDB synchronisées.'
              : 'Sauvegarde locale active.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleExport()}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-700 bg-[#121318] px-3 text-xs font-medium text-zinc-200 hover:border-[#F5B971]"
            >
              <Download className="h-3.5 w-3.5 text-[#F5B971]" />
              <span>Exporter JSON</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-700 bg-[#121318] px-3 text-xs font-medium text-zinc-200 hover:border-[#F5B971]"
            >
              <Upload className="h-3.5 w-3.5 text-[#10B981]" />
              <span>Importer JSON</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>
        </div>

        {/* Section 5: Réinitialisation des données */}
        <div className="rounded-xl border border-zinc-800 bg-[#08090C] p-4 space-y-2.5">
          <h3 className="text-xs font-semibold text-zinc-200">
            Réinitialisation des données
          </h3>
          <p className="text-[11px] text-zinc-500">
            Vous pouvez recharger les exemples modifiables ou repartir sur une
            base vide.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={async () => {
                resetToStarter();
                await haptics.tap();
                setFeedback('Données de démarrage rechargées.');
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-700 bg-[#121318] px-3 text-xs font-medium text-zinc-200 hover:border-[#F5B971]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Exemples modifiables</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                resetToEmpty();
                await haptics.warning();
                setFeedback('Toutes les données locales ont été vidées.');
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 text-xs font-medium text-[#EF4444] hover:bg-[#EF4444]/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Base vierge</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};