import {
  FinanceState,
  Project,
  SupportType,
  TransactionType,
} from '../types/finance';
import { convertToFbu, formatInDisplayCurrency, isDateInPeriod } from './format';

export interface ProjectMetrics {
  project: Project;
  inflowsFbu: number;
  outflowsFbu: number;
  netFlowFbu: number;
  totalBalanceFbu: number;
  cashBalanceFbu: number;
  bankMomoBalanceFbu: number;
  activeInternalLoansFbu: number;
  marginPercent: number;
  status: 'growth' | 'redline' | 'surplus' | 'loan_due';
  statusLabel: string;
  revenueBreakdown: { source: string; amountFbu: number; percent: number }[];
  topExpenseCategory: { name: string; amountFbu: number } | null;
}

export interface GlobalMetrics {
  totalManagedFbu: number;
  totalPersonalFbu: number;
  totalProjectsFbu: number;
  totalSavingsFbu: number;
  totalCashFbu: number;
  totalBankMomoFbu: number;
  totalDebtsFbu: number;
  totalReceivablesFbu: number;
  totalInternalLoansDueFbu: number;
  periodInflowsFbu: number;
  periodOutflowsFbu: number;
  periodNetFbu: number;
  projectMetrics: ProjectMetrics[];
}

export function computeFinanceMetrics(
  state: FinanceState,
  periodOverride?: 'week' | 'month' | 'all'
): GlobalMetrics {
  const period = periodOverride ?? state.settings.period;
  const { currencies } = state.settings;

  let totalPersonalFbu = 0;
  let totalProjectsFbu = 0;
  let totalCashFbu = 0;
  let totalBankMomoFbu = 0;

  for (const sup of state.supports) {
    const valFbu = convertToFbu(sup.balance, sup.currency, currencies);
    if (sup.ownerType === 'personal') {
      totalPersonalFbu += valFbu;
    } else {
      totalProjectsFbu += valFbu;
    }
    if (sup.type === SupportType.CASH) {
      totalCashFbu += valFbu;
    } else {
      totalBankMomoFbu += valFbu;
    }
  }

  const totalSavingsFbu = state.savingsGoals.reduce((acc, g) => acc + g.currentAmountFbu, 0);
  // Note: supports already hold real liquid balances across Personal + Projects.
  // Savings envelopes represent earmarked funds tracked against goals, or dedicated reserves.
  // Total managed cash + bank across personal & projects + unlinked savings if any,
  // or cleanly: Personal + Projects (and display Savings clearly alongside).
  const totalManagedFbu = totalPersonalFbu + totalProjectsFbu;

  const totalDebtsFbu = state.debts
    .filter((d) => d.direction === 'debt')
    .reduce((acc, d) => acc + d.remainingAmountFbu, 0);

  const totalReceivablesFbu = state.debts
    .filter((d) => d.direction === 'receivable')
    .reduce((acc, d) => acc + d.remainingAmountFbu, 0);

  const totalInternalLoansDueFbu = state.internalLoans
    .filter((l) => l.status === 'active')
    .reduce((acc, l) => acc + l.remainingAmountFbu, 0);

  const periodTransactions = state.transactions.filter((t) => isDateInPeriod(t.date, period));
  const periodInflowsFbu = periodTransactions
    .filter((t) => t.type === TransactionType.INFLOW)
    .reduce((acc, t) => acc + t.amountInFbu, 0);
  const periodOutflowsFbu = periodTransactions
    .filter((t) => t.type === TransactionType.OUTFLOW)
    .reduce((acc, t) => acc + t.amountInFbu, 0);

  const projectMetrics: ProjectMetrics[] = state.projects.map((proj) => {
    const projSupports = state.supports.filter(
      (s) => s.ownerType === 'project' && s.ownerId === proj.id
    );
    let totalBalanceFbu = 0;
    let cashBalanceFbu = 0;
    let bankMomoBalanceFbu = 0;

    for (const s of projSupports) {
      const fbu = convertToFbu(s.balance, s.currency, currencies);
      totalBalanceFbu += fbu;
      if (s.type === SupportType.CASH) cashBalanceFbu += fbu;
      else bankMomoBalanceFbu += fbu;
    }

    const projTxs = periodTransactions.filter(
      (t) => t.pocket === 'project' && t.projectId === proj.id
    );
    const inflowsFbu = projTxs
      .filter((t) => t.type === TransactionType.INFLOW)
      .reduce((acc, t) => acc + t.amountInFbu, 0);
    const outflowsFbu = projTxs
      .filter((t) => t.type === TransactionType.OUTFLOW)
      .reduce((acc, t) => acc + t.amountInFbu, 0);
    const netFlowFbu = inflowsFbu - outflowsFbu;

    const activeInternalLoansFbu = state.internalLoans
      .filter((l) => l.projectId === proj.id && l.status === 'active')
      .reduce((acc, l) => acc + l.remainingAmountFbu, 0);

    const marginPercent =
      inflowsFbu > 0 ? Math.round(((inflowsFbu - outflowsFbu) / inflowsFbu) * 100) : outflowsFbu > 0 ? -100 : 0;

    // Breakdown by revenue source
    const sourceMap = new Map<string, number>();
    for (const tx of projTxs) {
      if (tx.type === TransactionType.INFLOW) {
        const src = tx.categoryOrSource || 'Autre source';
        sourceMap.set(src, (sourceMap.get(src) ?? 0) + tx.amountInFbu);
      }
    }
    const revenueBreakdown = Array.from(sourceMap.entries())
      .map(([source, amountFbu]) => ({
        source,
        amountFbu,
        percent: inflowsFbu > 0 ? Math.round((amountFbu / inflowsFbu) * 100) : 0,
      }))
      .sort((a, b) => b.amountFbu - a.amountFbu);

    // Top expense post
    const expMap = new Map<string, number>();
    for (const tx of projTxs) {
      if (tx.type === TransactionType.OUTFLOW) {
        const post = tx.categoryOrSource || 'Dépense diverse';
        expMap.set(post, (expMap.get(post) ?? 0) + tx.amountInFbu);
      }
    }
    const sortedExp = Array.from(expMap.entries()).sort((a, b) => b[1] - a[1]);
    const topExpenseCategory =
      sortedExp.length > 0 ? { name: sortedExp[0][0], amountFbu: sortedExp[0][1] } : null;

    let status: ProjectMetrics['status'] = 'growth';
    let statusLabel = 'En croissance';
    if (netFlowFbu < 0 || totalBalanceFbu <= 0) {
      status = 'redline';
      statusLabel = 'Ligne rouge';
    } else if (activeInternalLoansFbu > 0) {
      status = 'loan_due';
      statusLabel = 'À rembourser';
    } else if (netFlowFbu > 0 && marginPercent >= 25) {
      status = 'surplus';
      statusLabel = 'Excédentaire';
    } else {
      status = 'growth';
      statusLabel = 'En croissance';
    }

    return {
      project: proj,
      inflowsFbu,
      outflowsFbu,
      netFlowFbu,
      totalBalanceFbu,
      cashBalanceFbu,
      bankMomoBalanceFbu,
      activeInternalLoansFbu,
      marginPercent,
      status,
      statusLabel,
      revenueBreakdown,
      topExpenseCategory,
    };
  });

  return {
    totalManagedFbu,
    totalPersonalFbu,
    totalProjectsFbu,
    totalSavingsFbu,
    totalCashFbu,
    totalBankMomoFbu,
    totalDebtsFbu,
    totalReceivablesFbu,
    totalInternalLoansDueFbu,
    periodInflowsFbu,
    periodOutflowsFbu,
    periodNetFbu: periodInflowsFbu - periodOutflowsFbu,
    projectMetrics,
  };
}

export interface StrategicReport {
  periodLabel: string;
  globalHealth: 'positive' | 'warning' | 'redline';
  headline: string;
  summaryText: string;
  recommendedProject: {
    name: string;
    reason: string;
    marginPercent: number;
  } | null;
  redlineProjects: ProjectMetrics[];
  improvementAxes: { title: string; detail: string; priority: 'high' | 'medium' }[];
  cashRatioPercent: number;
}

export function generateStrategicReport(
  state: FinanceState,
  reportPeriod: 'week' | 'month'
): StrategicReport {
  const metrics = computeFinanceMetrics(state, reportPeriod);
  const { displayCurrency, currencies } = state.settings;
  const fmt = (v: number) => formatInDisplayCurrency(v, displayCurrency, currencies);

  const periodLabel = reportPeriod === 'week' ? 'Rapport Hebdomadaire (7 derniers jours)' : 'Rapport Mensuel (30 derniers jours)';

  const cashRatioPercent =
    metrics.totalManagedFbu > 0
      ? Math.round((metrics.totalCashFbu / metrics.totalManagedFbu) * 100)
      : 0;

  const redlineProjects = metrics.projectMetrics.filter((p) => p.status === 'redline');

  let globalHealth: StrategicReport['globalHealth'] = 'positive';
  if (metrics.periodNetFbu < 0 || redlineProjects.length > 0) {
    globalHealth = metrics.periodNetFbu < 0 ? 'redline' : 'warning';
  }

  const headline =
    metrics.periodNetFbu >= 0
      ? `Flux net positif de ${fmt(metrics.periodNetFbu)} sur la période`
      : `Alerte ligne rouge : déficit net de ${fmt(Math.abs(metrics.periodNetFbu))}`;

  const summaryText =
    state.transactions.length === 0
      ? 'Aucune transaction enregistrée pour le moment. Ajoutez vos premières entrées et sorties via le bouton + pour activer les diagnostics en temps réel.'
      : `Entrées cumulées : ${fmt(metrics.periodInflowsFbu)} contre ${fmt(metrics.periodOutflowsFbu)} de sorties. Votre trésorerie consolidée atteint ${fmt(metrics.totalManagedFbu)}, répartie entre ${cashRatioPercent}% en liquide (Cash) et ${100 - cashRatioPercent}% en banque / mobile money.`;

  // Best project to invest in
  const sortedByPerf = [...metrics.projectMetrics].sort((a, b) => {
    const scoreA = a.netFlowFbu + a.marginPercent * 10000 - a.activeInternalLoansFbu;
    const scoreB = b.netFlowFbu + b.marginPercent * 10000 - b.activeInternalLoansFbu;
    return scoreB - scoreA;
  });

  const bestProj = sortedByPerf.find((p) => p.netFlowFbu > 0) ?? null;
  const recommendedProject = bestProj
    ? {
        name: bestProj.project.name,
        marginPercent: bestProj.marginPercent,
        reason: bestProj.revenueBreakdown[0]
          ? `Marge nette de ${bestProj.marginPercent}% tirée par « ${bestProj.revenueBreakdown[0].source} » (${bestProj.revenueBreakdown[0].percent}% des revenus) avec un flux net de ${fmt(bestProj.netFlowFbu)}.`
          : `Solde de ${fmt(bestProj.totalBalanceFbu)} et flux net positif de ${fmt(bestProj.netFlowFbu)}.`,
      }
    : null;

  const improvementAxes: StrategicReport['improvementAxes'] = [];

  if (redlineProjects.length > 0) {
    for (const rp of redlineProjects) {
      improvementAxes.push({
        title: `Redresser « ${rp.project.name} » (Ligne rouge)`,
        detail: rp.topExpenseCategory
          ? `Les sorties dépassent les entrées (${fmt(rp.netFlowFbu)}). Le poste le plus lourd est « ${rp.topExpenseCategory.name} » (${fmt(rp.topExpenseCategory.amountFbu)}).`
          : `Le flux net est négatif (${fmt(rp.netFlowFbu)}). Ralentissez les décaissements avant d'injecter de nouveaux capitaux.`,
        priority: 'high',
      });
    }
  }

  if (metrics.totalInternalLoansDueFbu > 0) {
    improvementAxes.push({
      title: `Rembourser les prêts internes au Compte Personnel`,
      detail: `${fmt(metrics.totalInternalLoansDueFbu)} avancés depuis le Compte Perso restent à restituer par vos projets.`,
      priority: 'high',
    });
  }

  if (cashRatioPercent > 45 && metrics.totalCashFbu > 0) {
    improvementAxes.push({
      title: `Sécuriser l'excédent Cash (${cashRatioPercent}% en liquide)`,
      detail: `${fmt(metrics.totalCashFbu)} dorment en liquide. Transférez une partie vers un compte bancaire ou une poche d'épargne pour limiter le risque de dépenses impulsives.`,
      priority: 'medium',
    });
  }

  if (metrics.totalDebtsFbu > 0) {
    improvementAxes.push({
      title: `Alléger les dettes externes (${fmt(metrics.totalDebtsFbu)})`,
      detail:
        metrics.totalReceivablesFbu > 0
          ? `Vous avez ${fmt(metrics.totalReceivablesFbu)} de créances à encaisser : utilisez ces rentrées pour solder prioritairement vos dettes.`
          : `Planifiez des versements partiels réguliers via « - Rembourser » pour réduire la charge.`,
      priority: 'medium',
    });
  }

  if (improvementAxes.length === 0 && state.projects.length > 0) {
    improvementAxes.push({
      title: 'Maintenir la discipline d’épargne et de réinvestissement',
      detail: 'Aucun point de friction critique détecté. Continuez à tracer chaque source de revenus et à alimenter vos objectifs d’épargne.',
      priority: 'medium',
    });
  }

  return {
    periodLabel,
    globalHealth,
    headline,
    summaryText,
    recommendedProject,
    redlineProjects,
    improvementAxes,
    cashRatioPercent,
  };
}

export function answerCoachQuestion(question: string, state: FinanceState): string {
  const q = question.toLowerCase().trim();
  const metrics = computeFinanceMetrics(state, 'month');
  const report = generateStrategicReport(state, 'month');
  const { displayCurrency, currencies } = state.settings;
  const fmt = (v: number) => formatInDisplayCurrency(v, displayCurrency, currencies);

  if (q.includes('investir') || q.includes('projet') || q.includes('rentable') || q.includes('priorit')) {
    if (!report.recommendedProject) {
      return `Aucun projet n'affiche encore un flux net positif sur les 30 derniers jours. Priorisez la maîtrise des coûts sur vos projets existants avant d'investir davantage.`;
    }
    const redlineNote =
      report.redlineProjects.length > 0
        ? ` À l'inverse, évitez de réinjecter du cash dans ${report.redlineProjects.map((p) => p.project.name).join(', ')} tant que le flux net reste négatif.`
        : '';
    return `Projet prioritaire pour investir : ${report.recommendedProject.name} (${report.recommendedProject.marginPercent}% de marge). ${report.recommendedProject.reason}${redlineNote}`;
  }

  if (q.includes('cash') || q.includes('liquide') || q.includes('banque') || q.includes('lumicash') || q.includes('support')) {
    return `Répartition actuelle de vos fonds (${fmt(metrics.totalManagedFbu)} au total) : ${fmt(metrics.totalCashFbu)} en Cash liquide (${report.cashRatioPercent}%) et ${fmt(metrics.totalBankMomoFbu)} en Banque & Mobile Money (${100 - report.cashRatioPercent}%).`;
  }

  if (q.includes('dette') || q.includes('rembourser') || q.includes('prêt') || q.includes('pret') || q.includes('créance')) {
    return `Dettes externes restantes : ${fmt(metrics.totalDebtsFbu)}. Prêts internes dus au Compte Personnel : ${fmt(metrics.totalInternalLoansDueFbu)}. Créances qu'on vous doit : ${fmt(metrics.totalReceivablesFbu)}.`;
  }

  if (q.includes('ligne rouge') || q.includes('alerte') || q.includes('problème') || q.includes('risque') || q.includes('améliorer')) {
    if (report.improvementAxes.length === 0) {
      return 'Votre situation ne présente aucune alerte ligne rouge actuellement. Tous vos flux suivis sont équilibrés.';
    }
    return report.improvementAxes
      .map((a, idx) => `${idx + 1}. ${a.title} — ${a.detail}`)
      .join('\n\n');
  }

  if (q.includes('épargne') || q.includes('epargne') || q.includes('objectif')) {
    const goalsSummary = state.savingsGoals
      .map((g) => `${g.name}: ${fmt(g.currentAmountFbu)} / ${fmt(g.targetAmountFbu)}`)
      .join(' · ');
    return state.savingsGoals.length > 0
      ? `Total épargné : ${fmt(metrics.totalSavingsFbu)}. Détail des poches : ${goalsSummary}.`
      : `Vous n'avez pas encore créé d'objectif d'épargne. Rendez-vous dans l'onglet Dettes & Épargne pour en ouvrir un.`;
  }

  // Default comprehensive snapshot
  return `Synthèse sur 30 jours :
• Trésorerie consolidée : ${fmt(metrics.totalManagedFbu)} (Perso : ${fmt(metrics.totalPersonalFbu)} · Projets : ${fmt(metrics.totalProjectsFbu)})
• Flux net mensuel : ${fmt(metrics.periodNetFbu)} (${fmt(metrics.periodInflowsFbu)} d'entrées / ${fmt(metrics.periodOutflowsFbu)} de sorties)
• ${report.recommendedProject ? `Meilleur levier d'investissement : ${report.recommendedProject.name} (${report.recommendedProject.marginPercent}% de marge)` : 'Ajoutez des revenus projets pour identifier le meilleur levier.'}
• Dettes : ${fmt(metrics.totalDebtsFbu)} · Prêts internes à rembourser : ${fmt(metrics.totalInternalLoansDueFbu)}`;
}
