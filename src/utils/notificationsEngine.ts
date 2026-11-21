import { DEFAULT_NOTIFICATION_SETTINGS } from '../data/initialData';
import {
  FinanceState,
  NotificationItem,
  NotificationSettings,
} from '../types/finance';
import { computeFinanceMetrics } from './aiEngine';
import { formatInDisplayCurrency, generateId, getTodayISO } from './format';

function addDaysToIso(dateIso: string, days: number): string {
  const base = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(base.getTime())) return dateIso;
  base.setDate(base.getDate() + days);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getIsoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getNotificationSettings(state: FinanceState): NotificationSettings {
  return {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...(state.settings.notifications ?? {}),
  };
}

export function evaluateSmartNotifications(state: FinanceState): NotificationItem[] {
  const cfg = getNotificationSettings(state);
  const { displayCurrency, currencies } = state.settings;
  const fmt = (fbu: number) => formatInDisplayCurrency(fbu, displayCurrency, currencies);
  const today = getTodayISO();
  const now = new Date();
  const nowIso = now.toISOString();

  const candidates: NotificationItem[] = [];

  // 1. Prêts internes ouverts & rappels
  if (cfg.internalLoansEnabled) {
    for (const loan of state.internalLoans) {
      if (loan.status !== 'active' || loan.remainingAmountFbu <= 0) continue;
      const project = state.projects.find((p) => p.id === loan.projectId);
      const projName = project?.name ?? 'Projet';

      const computedReminderDate =
        loan.reminderDate ||
        (loan.reminderDelayDays && loan.reminderDelayDays > 0
          ? addDaysToIso(loan.date, loan.reminderDelayDays)
          : undefined);

      const isDue = computedReminderDate ? computedReminderDate <= today : false;

      candidates.push({
        id: generateId('notif'),
        dedupeKey: `loan_${loan.id}_${isDue ? 'due' : 'open'}_${loan.remainingAmountFbu}`,
        category: 'internal_loans',
        title: isDue
          ? `Rappel prêt interne à rembourser (${projName})`
          : `Prêt interne ouvert — ${projName}`,
        message: isDue
          ? `Échéance atteinte (${computedReminderDate}). Restant dû au Compte Perso : ${fmt(loan.remainingAmountFbu)}.`
          : `${fmt(loan.remainingAmountFbu)} avancés depuis le Compte Perso restent à restituer.`,
        severity: isDue ? 'warning' : 'info',
        createdAt: nowIso,
        read: false,
        targetTab: 'projects',
        targetProjectId: loan.projectId,
        actionLabel: 'Voir le projet',
      });
    }
  }

  // 2. Dettes & échéances
  if (cfg.debtsEnabled) {
    const threeDaysAhead = addDaysToIso(today, 3);
    for (const debt of state.debts) {
      if (debt.direction !== 'debt' || debt.remainingAmountFbu <= 0) continue;

      if (debt.dueDate && debt.dueDate <= today) {
        candidates.push({
          id: generateId('notif'),
          dedupeKey: `debt_overdue_${debt.id}_${debt.dueDate}_${debt.remainingAmountFbu}`,
          category: 'debts',
          title: `Échéance dette atteinte — ${debt.personName}`,
          message: `Remboursement prévu le ${debt.dueDate}. Restant dû : ${fmt(debt.remainingAmountFbu)}.`,
          severity: 'danger',
          createdAt: nowIso,
          read: false,
          targetTab: 'debts_savings',
          actionLabel: 'Rembourser',
        });
      } else if (debt.dueDate && debt.dueDate <= threeDaysAhead) {
        candidates.push({
          id: generateId('notif'),
          dedupeKey: `debt_soon_${debt.id}_${debt.dueDate}_${debt.remainingAmountFbu}`,
          category: 'debts',
          title: `Échéance dette proche — ${debt.personName}`,
          message: `Prévu pour le ${debt.dueDate}. Reste ${fmt(debt.remainingAmountFbu)} à régler.`,
          severity: 'warning',
          createdAt: nowIso,
          read: false,
          targetTab: 'debts_savings',
          actionLabel: 'Voir la dette',
        });
      } else if (!debt.dueDate) {
        candidates.push({
          id: generateId('notif'),
          dedupeKey: `debt_open_${debt.id}_${debt.remainingAmountFbu}`,
          category: 'debts',
          title: `Dette active — ${debt.personName}`,
          message: `Solde restant dû : ${fmt(debt.remainingAmountFbu)}.`,
          severity: 'info',
          createdAt: nowIso,
          read: false,
          targetTab: 'debts_savings',
          actionLabel: 'Gérer',
        });
      }
    }
  }

  // 3. Projets / Ligne rouge & seuil bas de trésorerie
  if (cfg.projectsRedlineEnabled) {
    const metrics = computeFinanceMetrics(state);
    for (const pm of metrics.projectMetrics) {
      if (pm.netFlowFbu < 0) {
        candidates.push({
          id: generateId('notif'),
          dedupeKey: `proj_redline_${pm.project.id}_${pm.netFlowFbu}`,
          category: 'projects_redline',
          title: `Alerte Ligne rouge — ${pm.project.name}`,
          message: `Flux net négatif de ${fmt(pm.netFlowFbu)} sur la période. Vérifiez les postes de dépenses.`,
          severity: 'danger',
          createdAt: nowIso,
          read: false,
          targetTab: 'projects',
          targetProjectId: pm.project.id,
          actionLabel: 'Inspecter',
        });
      } else if (pm.totalBalanceFbu <= cfg.lowTreasuryThresholdFbu) {
        candidates.push({
          id: generateId('notif'),
          dedupeKey: `proj_low_${pm.project.id}_${pm.totalBalanceFbu}`,
          category: 'projects_redline',
          title: `Trésorerie basse — ${pm.project.name}`,
          message: `Le solde cumulé (${fmt(pm.totalBalanceFbu)}) est sous votre seuil d’alerte (${fmt(cfg.lowTreasuryThresholdFbu)}).`,
          severity: 'warning',
          createdAt: nowIso,
          read: false,
          targetTab: 'projects',
          targetProjectId: pm.project.id,
          actionLabel: 'Voir le projet',
        });
      }
    }
  }

  // 4. IA Coach — Rapport Hebdomadaire & Mensuel disponible
  if (cfg.aiReportsEnabled && state.transactions.length > 0) {
    const weekKey = getIsoWeekKey(now);
    const monthKey = today.slice(0, 7);

    candidates.push({
      id: generateId('notif'),
      dedupeKey: `ai_weekly_${weekKey}`,
      category: 'ai_reports',
      title: 'Rapport hebdomadaire IA Coach prêt',
      message: 'Consultez l’analyse de vos flux des 7 derniers jours et les recommandations d’investissement.',
      severity: 'info',
      createdAt: nowIso,
      read: false,
      targetTab: 'ai_coach',
      actionLabel: 'Ouvrir IA Coach',
    });

    candidates.push({
      id: generateId('notif'),
      dedupeKey: `ai_monthly_${monthKey}`,
      category: 'ai_reports',
      title: 'Rapport mensuel IA Coach disponible',
      message: 'Votre bilan consolidé sur 30 jours et la répartition Cash / Banque sont prêts.',
      severity: 'info',
      createdAt: nowIso,
      read: false,
      targetTab: 'ai_coach',
      actionLabel: 'Voir le bilan',
    });
  }

  // 5. Rappel quotidien de saisie (après l'heure choisie)
  if (cfg.dailyReminderEnabled) {
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const currentHm = `${hh}:${mm}`;
    if (currentHm >= (cfg.dailyReminderTime || '20:00')) {
      candidates.push({
        id: generateId('notif'),
        dedupeKey: `daily_entry_${today}`,
        category: 'daily_entry',
        title: 'Rappel de saisie quotidienne',
        message: 'Prenez 10 secondes pour enregistrer vos entrées et sorties du jour dans TOMI.',
        severity: 'info',
        createdAt: nowIso,
        read: false,
        actionLabel: 'Saisie rapide',
      });
    }
  }

  return candidates;
}

export async function requestNativeNotificationPermission(): Promise<
  'granted' | 'denied' | 'unsupported'
> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (window.Notification.permission === 'granted') return 'granted';
  try {
    const res = await window.Notification.requestPermission();
    return res === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export function sendNativeNotificationIfPermitted(title: string, body: string): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (window.Notification.permission !== 'granted') {
    return false;
  }
  try {
    new window.Notification(title, { body });
    return true;
  } catch {
    // In some Android WebViews, window.Notification constructor requires ServiceWorkerRegistration
    return false;
  }
}
