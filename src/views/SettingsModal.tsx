import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Camera,
  Cloud,
  Download,
  EyeOff,
  Lock,
  LogOut,
  Plus,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
  UserCheck,
  Wallet,
  Waves,
  Wifi,
  X,
} from 'lucide-react';
import { UserAvatar } from '../components/UserAvatar';
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
    enablePinLock,
    disablePinLock,
    lockApp,
    updateAccountProfile,
    loginRemoteAccount,
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
    updateNotificationSettings,
    triggerTestNotification,
  } = useFinance();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const profileSectionRef = useRef<HTMLDivElement>(null);

  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newSymbol, setNewSymbol] = useState('');
  const [newRate, setNewRate] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Mon Profil & Sécurité (uniquement Profil Local ou Compte Connecté)
  const account = state.settings.account ?? DEFAULT_ACCOUNT_SECURITY;
  const normalizedMode: AccountMode =
    account.mode === 'cloud_ready' ? 'cloud_ready' : 'local_profile';

  const [profileName, setProfileName] = useState(
    account.displayName === 'Mode Invité (Local)' ? '' : account.displayName
  );
  const [profileEmail, setProfileEmail] = useState(account.email || '');
  const [remotePassword, setRemotePassword] = useState('');
  const [isConnectingRemote, setIsConnectingRemote] = useState(false);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | undefined>(
    account.avatarDataUrl
  );
  const [cloudLabel, setCloudLabel] = useState(
    account.cloudProviderLabel || 'Supabase'
  );
  const [cloudUrl, setCloudUrl] = useState(account.cloudSyncUrl || '');
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const acc = state.settings.account ?? DEFAULT_ACCOUNT_SECURITY;
    setProfileName(
      acc.displayName === 'Mode Invité (Local)' ? '' : acc.displayName
    );
    setProfileEmail(acc.email || '');
    setRemotePassword('');
    setAvatarDataUrl(acc.avatarDataUrl);
    setCloudLabel(acc.cloudProviderLabel || 'Supabase');
    setCloudUrl(acc.cloudSyncUrl || '');
    setFeedback(null);

    if (initialFocusSection === 'profile') {
      window.setTimeout(() => {
        profileSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 60);
    }
  }, [isOpen, initialFocusSection, state.settings.account]);

  if (!isOpen) return null;

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
      setFeedback('Photo de profil compressée et enregistrée localement.');
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
    const nextName = profileName.trim() || 'Profil Local';

    updateAccountProfile({
      mode: normalizedMode,
      displayName: nextName,
      email: profileEmail.trim() || undefined,
      avatarDataUrl,
      cloudProviderLabel:
        normalizedMode === 'cloud_ready'
          ? cloudLabel.trim() || 'Supabase'
          : undefined,
      cloudSyncUrl:
        normalizedMode === 'cloud_ready' ? cloudUrl.trim() || undefined : undefined,
    });
    await haptics.success();
    setFeedback(
      normalizedMode === 'cloud_ready'
        ? 'Profil de Compte Connecté enregistré. La synchronisation se fera automatiquement dès qu’un réseau est détecté.'
        : 'Profil Local enregistré sur cet appareil (données d’exemple modifiables à tout moment).'
    );
  };

  const handleRemoteConnect = async () => {
    const cleanEmail = profileEmail.trim();
    if (!cleanEmail || remotePassword.length < 6) {
      setFeedback(
        'Saisissez votre adresse e-mail et un mot de passe (6 caractères minimum) pour charger votre compte.'
      );
      return;
    }

    setIsConnectingRemote(true);
    setFeedback(null);
    const res = await loginRemoteAccount(cleanEmail, remotePassword);
    setIsConnectingRemote(false);

    if (profileName.trim()) {
      updateAccountProfile({ displayName: profileName.trim() });
    }

    if (res.ok) {
      setRemotePassword('');
      await haptics.success();
    } else {
      await haptics.warning();
    }
    setFeedback(res.message);
  };

  const handleModeChange = async (mode: 'local_profile' | 'cloud_ready') => {
    await haptics.tap();
    const fallbackName =
      profileName.trim() ||
      (mode === 'cloud_ready' ? 'Compte Connecté' : 'Profil Local');

    setProfileName(fallbackName);
    updateAccountProfile({
      mode,
      displayName: fallbackName,
      email: profileEmail.trim() || undefined,
      avatarDataUrl,
      cloudProviderLabel:
        mode === 'cloud_ready' ? cloudLabel.trim() || 'Supabase' : undefined,
      cloudSyncUrl:
        mode === 'cloud_ready' ? cloudUrl.trim() || undefined : undefined,
    });
    setFeedback(
      mode === 'cloud_ready'
        ? 'Mode Compte Connecté sélectionné : saisissez votre e-mail et mot de passe pour charger vos données sur cet appareil.'
        : 'Mode Profil Local sélectionné : 100 % stocké sur ce téléphone et opérationnel hors ligne.'
    );
  };

  const handleDisconnectRemoteSession = async () => {
    await haptics.warning();
    await logoutRemoteAccount();
    setProfileName('');
    setProfileEmail('');
    setRemotePassword('');
    setAvatarDataUrl(undefined);
    setFeedback(
      'Session distante déconnectée et données effacées de cet appareil.'
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Paramètres et données"
    >
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-zinc-800 bg-[#121318] p-5 pb-7 shadow-2xl space-y-6">
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

          {/* Suggestion claire de configuration au démarrage */}
          <div className="rounded-xl border border-zinc-800/90 bg-[#121318] p-3 text-[11px] leading-relaxed text-zinc-400">
            Configurez d’abord votre <strong className="text-zinc-200">Profil Local</strong>{' '}
            pour vos opérations quotidiennes sur ce téléphone : les données déjà
            présentes peuvent être modifiées ou remplacées librement. Utilisez le{' '}
            <strong className="text-zinc-200">Compte Connecté</strong> si vous
            souhaitez charger vos données sur un autre téléphone et les
            synchroniser automatiquement dès qu’un réseau est détecté.
          </div>

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

          {/* 2 modes uniquement : Profil Local vs Compte Connecté */}
          <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-zinc-800/80 bg-[#121318] p-1">
            <button
              type="button"
              onClick={() => void handleModeChange('local_profile')}
              className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                normalizedMode === 'local_profile'
                  ? 'bg-[#18181B] text-[#F5B971] border border-zinc-700 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>Profil Local</span>
            </button>

            <button
              type="button"
              onClick={() => void handleModeChange('cloud_ready')}
              className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                normalizedMode === 'cloud_ready'
                  ? 'bg-[#18181B] text-[#F5B971] border border-zinc-700 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              <Cloud className="h-3.5 w-3.5" />
              <span>Compte Connecté</span>
            </button>
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
                placeholder={
                  normalizedMode === 'cloud_ready'
                    ? 'Email du compte (requis pour sync)'
                    : 'Email (optionnel)'
                }
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                className="h-10 rounded-xl border border-zinc-800 bg-[#121318] px-3 text-xs text-zinc-100 focus:border-[#F5B971] focus:outline-none"
              />
            </div>

            {normalizedMode === 'cloud_ready' && (
              <div className="space-y-2 rounded-xl border border-zinc-800/80 bg-[#121318] p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    type="password"
                    placeholder="Mot de passe du compte (6+ car.)"
                    value={remotePassword}
                    onChange={(e) => setRemotePassword(e.target.value)}
                    className="h-10 rounded-xl border border-zinc-800 bg-[#08090C] px-3 text-xs text-zinc-100 focus:border-[#F5B971] focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={isConnectingRemote}
                    onClick={() => void handleRemoteConnect()}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#F5B971] px-3 text-xs font-bold text-[#08090C] disabled:opacity-60"
                  >
                    <Cloud className="h-3.5 w-3.5" />
                    <span>
                      {isConnectingRemote
                        ? 'Connexion...'
                        : 'Se connecter & charger'}
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    placeholder="Service cloud (ex: Supabase)"
                    value={cloudLabel}
                    onChange={(e) => setCloudLabel(e.target.value)}
                    className="h-10 rounded-xl border border-zinc-800 bg-[#08090C] px-3 text-xs text-zinc-100 focus:border-[#F5B971] focus:outline-none"
                  />
                  <input
                    type="url"
                    placeholder="URL projet Supabase (optionnel)"
                    value={cloudUrl}
                    onChange={(e) => setCloudUrl(e.target.value)}
                    className="h-10 rounded-xl border border-zinc-800 bg-[#08090C] px-3 text-xs text-zinc-100 focus:border-[#F5B971] focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-zinc-400">
                    Sauvegarde auto dès détection d’un réseau mobile/Wi-Fi.
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDisconnectRemoteSession()}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-2.5 text-[11px] font-medium text-[#EF4444] hover:bg-[#EF4444]/20"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Déconnexion &amp; vider l’appareil</span>
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-zinc-500">
                {normalizedMode === 'cloud_ready'
                  ? 'Prêt pour connexion à distance et sync auto sur réseau.'
                  : 'Stocké localement sur ce téléphone, utilisable hors ligne.'}
              </span>
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#F5B971] px-3 text-xs font-bold text-[#08090C] shrink-0"
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span>Enregistrer</span>
              </button>
            </div>
          </form>
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
              <input
                type="time"
                value={notificationSettings.dailyReminderTime}
                onChange={(e) =>
                  updateNotificationSettings({
                    dailyReminderTime: e.target.value,
                  })
                }
                className="h-10 w-full rounded-xl border border-zinc-800 bg-[#121318] px-3 text-xs text-zinc-100 focus:border-[#F5B971] focus:outline-none"
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
                value={notificationSettings.projectLowBalanceThresholdFbu}
                onChange={(e) =>
                  updateNotificationSettings({
                    projectLowBalanceThresholdFbu:
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