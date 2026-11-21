import React, { useCallback, useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Bell, Eye, EyeOff } from 'lucide-react';
import { AmbientNeonFlows } from './components/AmbientNeonFlows';
import {
  FirstLaunchGuide,
  shouldShowFirstLaunchGuide,
} from './components/FirstLaunchGuide';
import {
  DesktopSidebar,
  MobileBottomNav,
  MobileTopBar,
} from './components/Navigation';
import { NotificationsModal } from './components/NotificationsModal';
import { PinLockScreen } from './components/PinLockScreen';
import { ProjectFormModal } from './components/ProjectFormModal';
import { QuickEntryModal } from './components/QuickEntryModal';
import { SplashScreen } from './components/SplashScreen';
import { SupportManagerModal } from './components/SupportManagerModal';
import { useShakeDetector } from './hooks/useShakeDetector';
import { FinanceProvider, useFinance } from './store/FinanceContext';
import { NavTab, PocketTarget, Project, TransactionType } from './types/finance';
import { haptics } from './utils/haptics';
import { AiCoachView } from './views/AiCoachView';
import { DebtsSavingsView } from './views/DebtsSavingsView';
import { HomeView } from './views/HomeView';
import { ProjectsView } from './views/ProjectsView';
import { SettingsModal } from './views/SettingsModal';

const TAB_TITLES: Record<NavTab, string> = {
  home: 'Accueil',
  projects: 'Projets',
  debts_savings: 'Dettes & Épargne',
  ai_coach: 'IA Coach',
};

function AppShell() {
  const {
    state,
    persistenceStatus,
    isLocked,
    verifyPin,
    unlockApp,
    privacyMode,
    shakeEnabled,
    shakeSensitivity,
    privacyToast,
    notificationToast,
    togglePrivacyMode,
    ambientFlowsEnabled,
  } = useFinance();

  const [showSplash, setShowSplash] = useState(true);
  const [showFirstGuide, setShowFirstGuide] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>('home');

  // Quick Entry modal state
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickDefaults, setQuickDefaults] = useState<{
    pocket?: PocketTarget;
    projectId?: string;
    type?: TransactionType;
  }>({});

  // Project Form modal state
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Support Manager modal state
  const [supportMgr, setSupportMgr] = useState<{
    isOpen: boolean;
    ownerType: 'personal' | 'project';
    ownerId: string;
    title: string;
  }>({
    isOpen: false,
    ownerType: 'personal',
    ownerId: 'personal',
    title: 'Compte Personnel',
  });

  // Settings & Notifications modals
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<'profile' | 'general'>('general');
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Affiche le guide de première utilisation une seule fois après splash & déverrouillage
  useEffect(() => {
    if (!showSplash && !isLocked && shouldShowFirstLaunchGuide()) {
      setShowFirstGuide(true);
    }
  }, [showSplash, isLocked]);

  const handleTogglePrivacy = useCallback(() => {
    void haptics.heavy();
    togglePrivacyMode();
  }, [togglePrivacyMode]);

  // Activate wrist-shake detection on Home screen when unlocked
  useShakeDetector({
    enabled:
      shakeEnabled &&
      activeTab === 'home' &&
      !showSplash &&
      !isLocked &&
      !quickOpen &&
      !settingsOpen &&
      !notificationsOpen &&
      !exitConfirmOpen &&
      !showFirstGuide,
    sensitivity: shakeSensitivity,
    cooldownMs: 950,
    onShake: handleTogglePrivacy,
  });

  // Gestion du bouton Retour Android (vibration + retour accueil + confirmation de sortie)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listenerPromise = CapacitorApp.addListener('backButton', async () => {
      await haptics.tap();

      if (showSplash || isLocked) {
        return;
      }

      if (exitConfirmOpen) {
        setExitConfirmOpen(false);
        return;
      }

      if (showFirstGuide) {
        setShowFirstGuide(false);
        return;
      }

      if (quickOpen) {
        setQuickOpen(false);
        return;
      }

      if (projectFormOpen) {
        setProjectFormOpen(false);
        return;
      }

      if (supportMgr.isOpen) {
        setSupportMgr((prev) => ({ ...prev, isOpen: false }));
        return;
      }

      if (notificationsOpen) {
        setNotificationsOpen(false);
        return;
      }

      if (settingsOpen) {
        setSettingsOpen(false);
        return;
      }

      if (activeTab !== 'home') {
        setActiveTab('home');
        return;
      }

      await haptics.warning();
      setExitConfirmOpen(true);
    });

    return () => {
      void listenerPromise.then((handle) => handle.remove());
    };
  }, [
    showSplash,
    isLocked,
    exitConfirmOpen,
    showFirstGuide,
    quickOpen,
    projectFormOpen,
    supportMgr.isOpen,
    notificationsOpen,
    settingsOpen,
    activeTab,
  ]);

  const handleSelectTab = (tab: NavTab) => {
    void haptics.tap();
    setActiveTab(tab);
  };

  const openQuickEntry = (opts?: {
    pocket?: PocketTarget;
    projectId?: string;
    type?: TransactionType;
  }) => {
    void haptics.tap();
    setQuickDefaults(opts ?? {});
    setQuickOpen(true);
  };

  const openProjectForm = (project?: Project) => {
    void haptics.tap();
    setEditingProject(project ?? null);
    setProjectFormOpen(true);
  };

  const openSupportManager = (
    ownerType: 'personal' | 'project',
    ownerId: string,
    title: string
  ) => {
    void haptics.tap();
    setSupportMgr({ isOpen: true, ownerType, ownerId, title });
  };

  const handleConfirmExit = async () => {
    await haptics.heavy();
    setExitConfirmOpen(false);
    await CapacitorApp.exitApp();
  };

  const statusText = !persistenceStatus.isOnline
    ? 'Hors ligne • Sauvegardé localement'
    : persistenceStatus.indexedDbSynced
    ? 'Double sauvegarde locale active'
    : 'Sauvegarde locale active';

  return (
    <div className="relative min-h-screen bg-[#08090C] text-zinc-100">
      <AmbientNeonFlows enabled={ambientFlowsEnabled} />
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

      {!showSplash && isLocked && (
        <PinLockScreen
          profileName={state.settings.account?.displayName}
          onVerify={verifyPin}
          onUnlocked={unlockApp}
        />
      )}

      {!showSplash && !isLocked && showFirstGuide && (
        <FirstLaunchGuide onFinish={() => setShowFirstGuide(false)} />
      )}

      {/* Discreet Toast for Privacy / Discret Mode */}
      {privacyToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-16 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-xl border border-[#F5B971]/40 bg-[#141417]/95 px-4 py-2 text-xs font-semibold text-[#F5B971] shadow-xl backdrop-blur-md whitespace-nowrap"
        >
          {privacyMode ? (
            <EyeOff className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Eye className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>{privacyToast}</span>
        </div>
      )}

      {/* Discreet In-App Notification Toast */}
      {notificationToast && !privacyToast && (
        <button
          type="button"
          onClick={() => {
            void haptics.tap();
            setNotificationsOpen(true);
          }}
          role="status"
          aria-live="polite"
          className="fixed top-16 left-1/2 z-50 -translate-x-1/2 w-[90%] max-w-sm flex items-start gap-2.5 rounded-2xl border border-[#F5B971]/40 bg-[#141417]/95 px-4 py-3 text-left shadow-2xl backdrop-blur-md"
        >
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-[#F5B971]" />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-zinc-100 truncate">
              {notificationToast.title}
            </div>
            <div className="text-[11px] text-zinc-400 line-clamp-2">
              {notificationToast.message}
            </div>
          </div>
        </button>
      )}

      <DesktopSidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onOpenQuickEntry={() => openQuickEntry()}
        onOpenSettings={() => {
          void haptics.tap();
          setSettingsSection('general');
          setSettingsOpen(true);
        }}
        onOpenNotifications={() => {
          void haptics.tap();
          setNotificationsOpen(true);
        }}
      />

      <div className="relative z-10 lg:pl-64 flex min-h-screen flex-col bg-transparent">
        <MobileTopBar
          title={TAB_TITLES[activeTab]}
          onOpenSettings={() => {
            void haptics.tap();
            setSettingsSection('general');
            setSettingsOpen(true);
          }}
          onOpenNotifications={() => {
            void haptics.tap();
            setNotificationsOpen(true);
          }}
        />

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-24 sm:px-6 lg:pb-10">
          {activeTab === 'home' && (
            <HomeView
              onNavigate={handleSelectTab}
              onOpenQuickEntry={openQuickEntry}
              onOpenNewProject={() => openProjectForm()}
              onOpenSupportManager={openSupportManager}
              onOpenProfile={() => {
                void haptics.tap();
                setSettingsSection('profile');
                setSettingsOpen(true);
              }}
            />
          )}
          {activeTab === 'projects' && (
            <ProjectsView
              onOpenProjectForm={openProjectForm}
              onOpenQuickEntry={openQuickEntry}
              onOpenSupportManager={openSupportManager}
            />
          )}
          {activeTab === 'debts_savings' && <DebtsSavingsView />}
          {activeTab === 'ai_coach' && <AiCoachView />}

          {/* Discreet footer attribution & offline persistence status on mobile */}
          <footer className="mt-10 border-t border-zinc-900 pt-4 text-center space-y-1 lg:hidden">
            <p className="text-[11px] text-zinc-500">{statusText}</p>
            <p className="text-[11px] text-zinc-600">
              TOMI by BlackSheep • Developed by Fujistudio
            </p>
          </footer>
        </main>
      </div>

      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onOpenQuickEntry={() => openQuickEntry()}
      />

      {/* Modale sombre custom de confirmation de sortie */}
      {exitConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-[#121318] p-5 text-zinc-100 shadow-2xl">
            <h2 className="text-base font-semibold text-white">
              Quitter TOMI by BlackSheep ?
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              Êtes-vous sûr de vouloir fermer l&apos;application ? Vos données enregistrées restent sauvegardées localement.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  void haptics.tap();
                  setExitConfirmOpen(false);
                }}
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
              >
                Rester
              </button>
              <button
                type="button"
                onClick={handleConfirmExit}
                className="rounded-xl bg-[#F5B971] px-4 py-2 text-xs font-semibold text-black hover:opacity-95"
              >
                Oui, quitter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <QuickEntryModal
        isOpen={quickOpen}
        onClose={() => setQuickOpen(false)}
        defaultPocket={quickDefaults.pocket}
        defaultProjectId={quickDefaults.projectId}
        defaultType={quickDefaults.type}
      />

      <ProjectFormModal
        isOpen={projectFormOpen}
        onClose={() => setProjectFormOpen(false)}
        editingProject={editingProject}
      />

      <SupportManagerModal
        isOpen={supportMgr.isOpen}
        onClose={() => setSupportMgr((prev) => ({ ...prev, isOpen: false }))}
        ownerType={supportMgr.ownerType}
        ownerId={supportMgr.ownerId}
        ownerTitle={supportMgr.title}
      />

      <NotificationsModal
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onNavigateTab={handleSelectTab}
        onOpenQuickEntry={() => openQuickEntry()}
      />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenSupportManager={openSupportManager}
        initialFocusSection={settingsSection}
        onReplaySplash={() => {
          setSettingsOpen(false);
          setShowSplash(true);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <FinanceProvider>
      <AppShell />
    </FinanceProvider>
  );
}