import React from 'react';
import {
  Bell,
  Briefcase,
  Home,
  Landmark,
  Lock,
  Plus,
  Settings,
  Sparkles,
} from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import { NavTab } from '../types/finance';
import { BrandLogo } from './BrandLogo';

interface NavigationProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenQuickEntry: () => void;
  onOpenSettings: () => void;
  onOpenNotifications: () => void;
}

const NAV_ITEMS: { id: NavTab; label: string; shortLabel: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'home', label: 'Accueil', shortLabel: 'Accueil', icon: Home },
  { id: 'projects', label: 'Projets', shortLabel: 'Projets', icon: Briefcase },
  { id: 'debts_savings', label: 'Dettes & Épargne', shortLabel: 'Dettes', icon: Landmark },
  { id: 'ai_coach', label: 'IA Coach', shortLabel: 'IA Coach', icon: Sparkles },
];

export const DesktopSidebar: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  onOpenQuickEntry,
  onOpenSettings,
  onOpenNotifications,
}) => {
  const { state, persistenceStatus, lockApp, unreadNotificationsCount } = useFinance();
  const pinActive = Boolean(state.settings.account?.pinEnabled);
  const statusLabel = !persistenceStatus.isOnline
    ? 'Hors ligne • Sauvegardé localement'
    : persistenceStatus.indexedDbSynced
    ? 'Double sauvegarde locale active'
    : 'Sauvegarde locale active';
  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 border-r border-zinc-800/80 bg-[#111114] px-4 py-6 z-30">
      {/* Brand */}
      <div className="px-2 mb-7">
        <div className="flex items-center gap-2.5">
          <BrandLogo
            customLogoDataUrl={state.settings.customLogoDataUrl}
            sizeClass="h-9 w-9"
            roundedClass="rounded-xl"
          />
          <div className="min-w-0">
            <div className="font-display text-base font-bold tracking-tight text-zinc-100 whitespace-nowrap">
              TOMI <span className="text-[#F5B971] font-medium">BlackSheep</span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Quick Entry */}
      <button
        type="button"
        onClick={onOpenQuickEntry}
        className="mb-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#F5B971] px-4 text-sm font-semibold text-[#0D0D0F] transition-transform active:scale-[0.98] hover:bg-[#f7c587] whitespace-nowrap"
      >
        <Plus className="h-4 w-4 stroke-[2.5]" />
        <span>Saisie rapide</span>
      </button>

      {/* Nav Links */}
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'bg-[#18181B] text-[#F5B971] border border-zinc-800/80'
                  : 'text-zinc-400 hover:bg-zinc-900/70 hover:text-zinc-100 border border-transparent'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Notifications + Settings + Discreet Local Backup Status + Fujistudio signature */}
      <div className="mt-auto pt-4 border-t border-zinc-800/70 space-y-1.5">
        <button
          type="button"
          onClick={onOpenNotifications}
          className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-400 hover:bg-zinc-900/70 hover:text-zinc-100 transition-colors"
        >
          <span className="flex items-center gap-3">
            <Bell className="h-4 w-4 shrink-0" />
            <span>Notifications</span>
          </span>
          {unreadNotificationsCount > 0 && (
            <span className="font-mono-num text-xs font-bold text-[#F5B971]">
              {unreadNotificationsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-400 hover:bg-zinc-900/70 hover:text-zinc-100 transition-colors"
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span>Paramètres & Données</span>
        </button>

        {pinActive && (
          <button
            type="button"
            onClick={lockApp}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-zinc-400 hover:bg-zinc-900/70 hover:text-[#F5B971] transition-colors"
          >
            <Lock className="h-3.5 w-3.5 shrink-0" />
            <span>Verrouiller la session</span>
          </button>
        )}

        <div className="px-3 pt-1 space-y-1">
          <p className="text-[11px] text-zinc-400 truncate" title={statusLabel}>
            {statusLabel}
          </p>
          <p className="text-[11px] text-zinc-600 leading-relaxed">
            TOMI by BlackSheep
            <br />
            Developed by Fujistudio
          </p>
        </div>
      </div>
    </aside>
  );
};

export const MobileTopBar: React.FC<{
  title: string;
  onOpenSettings: () => void;
  onOpenNotifications: () => void;
}> = ({ title, onOpenSettings, onOpenNotifications }) => {
  const {
    state,
    setDisplayCurrency,
    persistenceStatus,
    lockApp,
    unreadNotificationsCount,
  } = useFinance();
  const pinActive = Boolean(state.settings.account?.pinEnabled);
  const mobileStatusText = !persistenceStatus.isOnline
    ? 'Hors ligne · Local'
    : 'Sauvegarde locale';

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-[#0D0D0F]/90 backdrop-blur-md pt-safe">
      <div className="mx-auto flex h-13 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-display text-sm font-bold tracking-tight text-zinc-100 whitespace-nowrap lg:hidden">
            TOMI <span className="text-[#F5B971]">·</span>
          </span>
          <span className="truncate font-display text-sm sm:text-base font-semibold text-zinc-200">
            {title}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline text-[11px] text-zinc-500 whitespace-nowrap">
            {!persistenceStatus.isOnline
              ? 'Hors ligne • Sauvegardé localement'
              : 'Sauvegarde locale active'}
          </span>
          <span className="sm:hidden text-[10px] text-zinc-500 whitespace-nowrap">
            {mobileStatusText}
          </span>

          <label htmlFor="display-currency-select" className="sr-only">
            Devise d’affichage
          </label>
          <select
            id="display-currency-select"
            value={state.settings.displayCurrency}
            onChange={(e) => setDisplayCurrency(e.target.value)}
            className="h-9 rounded-lg border border-zinc-800 bg-[#141417] px-2.5 text-xs font-semibold text-[#F5B971] focus:border-[#F5B971] focus:outline-none"
          >
            {state.settings.currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label="Notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800/80 bg-[#141417] text-zinc-400 hover:text-[#F5B971] transition-colors"
          >
            <Bell className="h-4 w-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#F5B971] px-1 font-mono-num text-[10px] font-bold text-[#0D0D0F]">
                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </span>
            )}
          </button>

          {pinActive && (
            <button
              type="button"
              onClick={lockApp}
              aria-label="Verrouiller"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800/80 bg-[#141417] text-zinc-400 hover:text-[#F5B971] transition-colors lg:hidden"
            >
              <Lock className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Paramètres"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800/80 bg-[#141417] text-zinc-400 hover:text-zinc-100 transition-colors lg:hidden"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

export const MobileBottomNav: React.FC<{
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenQuickEntry: () => void;
}> = ({ activeTab, onSelectTab, onOpenQuickEntry }) => {
  const leftTabs = NAV_ITEMS.slice(0, 2);
  const rightTabs = NAV_ITEMS.slice(2, 4);

  const renderTab = (item: (typeof NAV_ITEMS)[number]) => {
    const Icon = item.icon;
    const active = activeTab === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onSelectTab(item.id)}
        className={`flex min-h-[44px] flex-col items-center justify-center gap-1 px-1 transition-colors ${
          active ? 'text-[#F5B971]' : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        <Icon className={`h-5 w-5 ${active ? 'stroke-[2.2]' : 'stroke-[1.75]'}`} />
        <span className="text-[10px] font-medium tracking-tight whitespace-nowrap">
          {item.shortLabel}
        </span>
      </button>
    );
  };

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800/80 bg-[#111114]/95 backdrop-blur-md pb-safe lg:hidden"
    >
      <div className="mx-auto grid h-16 max-w-lg grid-cols-5 items-center px-2">
        {leftTabs.map(renderTab)}

        {/* Prominent central Quick Entry + button */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={onOpenQuickEntry}
            aria-label="Saisie rapide"
            className="flex h-12 w-12 -translate-y-2 items-center justify-center rounded-2xl bg-[#F5B971] text-[#0D0D0F] shadow-lg shadow-[#F5B971]/25 transition-transform active:scale-95 hover:bg-[#f7c587]"
          >
            <Plus className="h-6 w-6 stroke-[2.5]" />
          </button>
        </div>

        {rightTabs.map(renderTab)}
      </div>
    </nav>
  );
};
