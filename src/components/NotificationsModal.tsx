import React, { useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  Info,
  Trash2,
  X,
} from 'lucide-react';
import { useFinance } from '../store/FinanceContext';
import { NavTab, NotificationCategory, NotificationItem } from '../types/finance';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: NavTab) => void;
  onOpenQuickEntry: () => void;
}

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  internal_loans: 'Prêt interne',
  debts: 'Dette',
  projects_redline: 'Projet',
  ai_reports: 'IA Coach',
  daily_entry: 'Routine',
};

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onOpenQuickEntry,
}) => {
  const {
    notifications,
    unreadNotificationsCount,
    markNotificationRead,
    markAllNotificationsRead,
    dismissNotification,
    clearReadNotifications,
  } = useFinance();

  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  if (!isOpen) return null;

  const visibleItems =
    filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  const handleQuickAction = (item: NotificationItem) => {
    markNotificationRead(item.id);
    onClose();
    if (item.category === 'daily_entry') {
      onOpenQuickEntry();
      return;
    }
    if (item.targetTab) {
      onNavigateTab(item.targetTab);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Centre de notifications"
    >
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-zinc-800 bg-[#141417] p-5 pb-6 shadow-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-700 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F5B971]/15 text-[#F5B971]">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-zinc-100">
                Notifications &amp; Rappels
              </h2>
              <p className="text-xs text-zinc-400">
                {unreadNotificationsCount > 0
                  ? `${unreadNotificationsCount} non lue${unreadNotificationsCount > 1 ? 's' : ''}`
                  : 'Tout est à jour'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter & Bulk Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div className="inline-flex rounded-xl border border-zinc-800 bg-[#0D0D0F] p-0.5">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-[#18181B] text-[#F5B971]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Toutes ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === 'unread'
                  ? 'bg-[#18181B] text-[#F5B971]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Non lues ({unreadNotificationsCount})
            </button>
          </div>

          <div className="flex items-center gap-2">
            {unreadNotificationsCount > 0 && (
              <button
                type="button"
                onClick={markAllNotificationsRead}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#F5B971] hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Tout lire</span>
              </button>
            )}
            {notifications.some((n) => n.read) && (
              <button
                type="button"
                onClick={clearReadNotifications}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                Effacer lues
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/70">
          {visibleItems.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm font-medium text-zinc-300">
                Aucune notification {filter === 'unread' ? 'non lue' : ''}
              </p>
              <p className="text-xs text-zinc-500">
                Vos rappels de prêts internes, dettes, lignes rouges et rapports apparaîtront ici automatiquement.
              </p>
            </div>
          ) : (
            visibleItems.map((item) => {
              const severityColor =
                item.severity === 'danger'
                  ? 'text-[#EF4444]'
                  : item.severity === 'warning'
                  ? 'text-[#F5B971]'
                  : 'text-[#10B981]';

              return (
                <div
                  key={item.id}
                  className={`py-3.5 space-y-2 transition-opacity ${
                    item.read ? 'opacity-65' : 'opacity-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className={`mt-0.5 shrink-0 ${severityColor}`}>
                        {item.severity === 'danger' || item.severity === 'warning' ? (
                          <AlertTriangle className="h-4 w-4" />
                        ) : (
                          <Info className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                          <span className="font-medium text-zinc-400">
                            {CATEGORY_LABELS[item.category]}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {new Date(item.createdAt).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                            })}
                          </span>
                          {!item.read && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-semibold text-[#F5B971]">Nouveau</span>
                            </>
                          )}
                        </div>
                        <h3 className="mt-0.5 text-sm font-semibold text-zinc-100">
                          {item.title}
                        </h3>
                        <p className="mt-0.5 text-xs text-zinc-400 leading-relaxed">
                          {item.message}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {!item.read && (
                        <button
                          type="button"
                          onClick={() => markNotificationRead(item.id)}
                          aria-label="Marquer comme lu"
                          title="Marquer comme lu"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-[#10B981]"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => dismissNotification(item.id)}
                        aria-label="Supprimer cette notification"
                        title="Supprimer"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-[#EF4444]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {item.actionLabel && (
                    <div className="pl-6">
                      <button
                        type="button"
                        onClick={() => handleQuickAction(item)}
                        className="inline-flex h-8 items-center rounded-lg border border-zinc-700 bg-[#0D0D0F] px-3 text-xs font-semibold text-[#F5B971] hover:border-[#F5B971]"
                      >
                        {item.actionLabel} →
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
