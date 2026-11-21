import {
  FinanceState,
  InventoryItem,
  Project,
  SupportType,
  TransactionType,
} from '../types/finance';
import { convertToFbu, formatInDisplayCurrency, isDateInPeriod } from './format';

export interface ProductMarginStat {
  item: InventoryItem;
  stockValueFbu: number;
  profitFbu: number;
  marginPercent: number;
}

export interface ProjectMetrics {
  project: Project;
  inflowsFbu: number;
  outflowsFbu: number;
  operatingExpensesFbu: number;
  stockPurchasesFbu: number;
  cogsFbu: number;
  netFlowFbu: number;
  netResultFbu: number;
  totalBalanceFbu: number;
  stockValueFbu: number;
  cashBalanceFbu: number;
  bankMomoBalanceFbu: number;
  activeInternalLoansFbu: number;
  marginPercent: number;
  status: 'growth' | 'redline' | 'surplus' | 'loan_due';
  statusLabel: string;
  revenueBreakdown: { source: string; amountFbu: number; percent: number }[];
  topExpenseCategory: { name: string; amountFbu: number } | null;
  inventoryItems: InventoryItem[];
  lowStockItems: InventoryItem[];
  topProducts: ProductMarginStat[];
}

export interface GlobalMetrics {
  totalManagedFbu: number;
  totalPersonalFbu: number;
  totalProjectsFbu: number;
  totalStockValueFbu: number;
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
  const allInventory = state.inventoryItems ?? [];

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

  let totalStockValueFbu = 0;

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

    const projInventory = allInventory.filter((item) => item.projectId === proj.id);
    const stockValueFbu = Math.round(
      projInventory.reduce(
        (acc, item) => acc + Math.max(0, item.quantity) * Math.max(0, item.averageUnitCostFbu),
        0
      )
    );
    totalStockValueFbu += stockValueFbu;

    const lowStockItems = projInventory.filter(
      (item) => item.quantity <= item.minStockThreshold
    );

    const topProducts: ProductMarginStat[] = projInventory
      .map((item) => {
        const profitFbu = item.totalSalesRevenueFbu - item.totalCogsFbu;
        const marginPercent =
          item.totalSalesRevenueFbu > 0
            ? Math.round((profitFbu / item.totalSalesRevenueFbu) * 100)
            : 0;
        return {
          item,
          stockValueFbu: Math.round(Math.max(0, item.quantity) * Math.max(0, item.averageUnitCostFbu)),
          profitFbu,
          marginPercent,
        };
      })
      .sort((a, b) => b.item.totalSoldQty - a.item.totalSoldQty || b.profitFbu - a.profitFbu);

    const projTxs = periodTransactions.filter(
      (t) => t.pocket === 'project' && t.projectId === proj.id
    );
    const inflowsFbu = projTxs
      .filter((t) => t.type === TransactionType.INFLOW)
      .reduce((acc, t) => acc + t.amountInFbu, 0);

    const outflowTxs = projTxs.filter((t) => t.type === TransactionType.OUTFLOW);
    const outflowsFbu = outflowTxs.reduce((acc, t) => acc + t.amountInFbu, 0);

    const stockPurchasesFbu = outflowTxs
      .filter((t) => t.outflowNature === 'stock_purchase')
      .reduce((acc, t) => acc + t.amountInFbu, 0);

    const operatingExpensesFbu = outflowTxs
      .filter((t) => t.outflowNature !== 'stock_purchase')
      .reduce((acc, t) => acc + t.amountInFbu, 0);

    const cogsFbu = projTxs
      .filter((t) => t.type === TransactionType.INFLOW)
      .reduce((acc, t) => acc + (t.cogsFbu ?? 0), 0);

    // Pure cashflow on period
    const netFlowFbu = inflowsFbu - outflowsFbu;
    // Real accounting net result: does NOT penalize cash converted into inventory stock
    const netResultFbu = inflowsFbu - operatingExpensesFbu - cogsFbu;

    const activeInternalLoansFbu = state.internalLoans
      .filter((l) => l.projectId === proj.id && l.status === 'active')
      .reduce((acc, l) => acc + l.remainingAmountFbu, 0);

    const marginPercent =
      inflowsFbu > 0
        ? Math.round((netResultFbu / inflowsFbu) * 100)
        : operatingExpensesFbu > 0
        ? -100
        : 0;

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

    // Top operating expense post (excluding stock purchases)
    const expMap = new Map<string, number>();
    for (const tx of outflowTxs) {
      if (tx.outflowNature === 'stock_purchase') continue;
      const post = tx.categoryOrSource || 'Dépense diverse';
      expMap.set(post, (expMap.get(post) ?? 0) + tx.amountInFbu);
    }
    const sortedExp = Array.from(expMap.entries()).sort((a, b) => b[1] - a[1]);
    const topExpenseCategory =
      sortedExp.length > 0 ? { name: sortedExp[0][0], amountFbu: sortedExp[0][1] } : null;

    let status: ProjectMetrics['status'] = 'growth';
    let statusLabel = 'En croissance';
    if (netResultFbu < 0 || totalBalanceFbu < 0 || (totalBalanceFbu <= 0 && stockValueFbu <= 0)) {
      status = 'redline';
      statusLabel = 'Ligne rouge';
    } else if (activeInternalLoansFbu > 0) {
      status = 'loan_due';
      statusLabel = 'À rembourser';
    } else if (netResultFbu > 0 && marginPercent >= 25) {
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
      operatingExpensesFbu,
      stockPurchasesFbu,
      cogsFbu,
      netFlowFbu,
      netResultFbu,
      totalBalanceFbu,
      stockValueFbu,
      cashBalanceFbu,
      bankMomoBalanceFbu,
      activeInternalLoansFbu,
      marginPercent,
      status,
      statusLabel,
      revenueBreakdown,
      topExpenseCategory,
      inventoryItems: projInventory,
      lowStockItems,
      topProducts,
    };
  });

  return {
    totalManagedFbu,
    totalPersonalFbu,
    totalProjectsFbu,
    totalStockValueFbu,
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
  totalStockValueFbu: number;
  lowStockAlerts: { projectName: string; item: InventoryItem }[];
  topProductInsight: {
    projectName: string;
    itemName: string;
    soldQty: number;
    unit: string;
    profitFbu: number;
    marginPercent: number;
  } | null;
}

export function generateStrategicReport(
  state: FinanceState,
  reportPeriod: 'week' | 'month'
): StrategicReport {
  const metrics = computeFinanceMetrics(state, reportPeriod);
  const { displayCurrency, currencies } = state.settings;
  const fmt = (v: number) => formatInDisplayCurrency(v, displayCurrency, currencies);

  const periodLabel =
    reportPeriod === 'week'
      ? 'Rapport Hebdomadaire (7 derniers jours)'
      : 'Rapport Mensuel (30 derniers jours)';

  const hasNegativePocket = metrics.totalCashFbu < 0 || metrics.totalBankMomoFbu < 0;
  const positiveLiquidityTotal =
    Math.max(0, metrics.totalCashFbu) + Math.max(0, metrics.totalBankMomoFbu);

  const cashRatioPercent = hasNegativePocket
    ? positiveLiquidityTotal > 0
      ? Math.round((Math.max(0, metrics.totalCashFbu) / positiveLiquidityTotal) * 100)
      : 0
    : metrics.totalManagedFbu > 0
    ? Math.round((metrics.totalCashFbu / metrics.totalManagedFbu) * 100)
    : 0;

  const redlineProjects = metrics.projectMetrics.filter((p) => p.status === 'redline');

  const lowStockAlerts = metrics.projectMetrics.flatMap((pm) =>
    pm.lowStockItems.map((item) => ({ projectName: pm.project.name, item }))
  );

  let topProductInsight: StrategicReport['topProductInsight'] = null;
  for (const pm of metrics.projectMetrics) {
    for (const stat of pm.topProducts) {
      if (stat.item.totalSoldQty <= 0 && stat.profitFbu <= 0) continue;
      if (
        !topProductInsight ||
        stat.profitFbu > topProductInsight.profitFbu ||
        stat.item.totalSoldQty > topProductInsight.soldQty
      ) {
        topProductInsight = {
          projectName: pm.project.name,
          itemName: stat.item.name,
          soldQty: stat.item.totalSoldQty,
          unit: stat.item.unit,
          profitFbu: stat.profitFbu,
          marginPercent: stat.marginPercent,
        };
      }
    }
  }

  let globalHealth: StrategicReport['globalHealth'] = 'positive';
  if (metrics.totalManagedFbu < 0 || metrics.periodNetFbu < 0 || redlineProjects.length > 0) {
    globalHealth =
      metrics.totalManagedFbu < 0 || metrics.periodNetFbu < 0 ? 'redline' : 'warning';
  } else if (lowStockAlerts.length > 0) {
    globalHealth = 'warning';
  }

  const headline =
    metrics.totalManagedFbu < 0
      ? `Alerte découvert : trésorerie consolidée à ${fmt(metrics.totalManagedFbu)}`
      : metrics.periodNetFbu >= 0
      ? `Flux net positif de ${fmt(metrics.periodNetFbu)} sur la période`
      : `Alerte ligne rouge : déficit net de ${fmt(Math.abs(metrics.periodNetFbu))}`;

  const stockSummaryClause =
    metrics.totalStockValueFbu > 0
      ? ` Valeur immobilisée en stock : ${fmt(metrics.totalStockValueFbu)}.`
      : '';

  const summaryText =
    state.transactions.length === 0 && metrics.totalManagedFbu === 0
      ? 'Aucune transaction enregistrée pour le moment. Ajoutez vos premières entrées et sorties via le bouton + pour activer les diagnostics en temps réel.'
      : hasNegativePocket
      ? `Entrées cumulées : ${fmt(metrics.periodInflowsFbu)} contre ${fmt(metrics.periodOutflowsFbu)} de sorties. Trésorerie consolidée : ${fmt(metrics.totalManagedFbu)} (Cash : ${fmt(metrics.totalCashFbu)} · Banque / Mobile Money : ${fmt(metrics.totalBankMomoFbu)}).${stockSummaryClause}`
      : `Entrées cumulées : ${fmt(metrics.periodInflowsFbu)} contre ${fmt(metrics.periodOutflowsFbu)} de sorties. Trésorerie consolidée : ${fmt(metrics.totalManagedFbu)} (${cashRatioPercent}% Cash · ${100 - cashRatioPercent}% Banque/MM).${stockSummaryClause}`;

  // Best project to invest in (based on real netResultFbu & marginPercent)
  const sortedByPerf = [...metrics.projectMetrics].sort((a, b) => {
    const scoreA = a.netResultFbu + a.marginPercent * 10000 - a.activeInternalLoansFbu;
    const scoreB = b.netResultFbu + b.marginPercent * 10000 - b.activeInternalLoansFbu;
    return scoreB - scoreA;
  });

  const bestProj = sortedByPerf.find((p) => p.netResultFbu > 0) ?? null;
  const recommendedProject = bestProj
    ? {
        name: bestProj.project.name,
        marginPercent: bestProj.marginPercent,
        reason: bestProj.revenueBreakdown[0]
          ? `Marge nette réelle de ${bestProj.marginPercent}% (${fmt(bestProj.netResultFbu)}) tirée par « ${bestProj.revenueBreakdown[0].source} » (${bestProj.revenueBreakdown[0].percent}% des revenus)${bestProj.stockValueFbu > 0 ? ` avec ${fmt(bestProj.stockValueFbu)} de stock actif` : ''}.`
          : `Résultat net de ${fmt(bestProj.netResultFbu)} (${bestProj.marginPercent}% de marge) et ${fmt(bestProj.totalBalanceFbu)} de trésorerie.`,
      }
    : null;

  const improvementAxes: StrategicReport['improvementAxes'] = [];

  if (redlineProjects.length > 0) {
    for (const rp of redlineProjects) {
      improvementAxes.push({
        title: `Redresser « ${rp.project.name} » (Ligne rouge)`,
        detail: rp.topExpenseCategory
          ? `Résultat net négatif (${fmt(rp.netResultFbu)}). Le poste de charge le plus lourd est « ${rp.topExpenseCategory.name} » (${fmt(rp.topExpenseCategory.amountFbu)}).`
          : `La trésorerie (${fmt(rp.totalBalanceFbu)}) ou le résultat net (${fmt(rp.netResultFbu)}) est en zone rouge. Ralentissez les décaissements non essentiels.`,
        priority: 'high',
      });
    }
  }

  if (lowStockAlerts.length > 0) {
    const preview = lowStockAlerts
      .slice(0, 3)
      .map((a) => `${a.item.name} (${a.item.quantity} ${a.item.unit}, ${a.projectName})`)
      .join(', ');
    improvementAxes.push({
      title: `Réapprovisionner ${lowStockAlerts.length} produit${lowStockAlerts.length > 1 ? 's' : ''} en stock faible`,
      detail: `Seuil d'alerte atteint sur : ${preview}. Enregistrez un approvisionnement pour éviter les ruptures de vente.`,
      priority: 'high',
    });
  }

  if (metrics.totalInternalLoansDueFbu > 0) {
    improvementAxes.push({
      title: `Rembourser les prêts internes au Compte Personnel`,
      detail: `${fmt(metrics.totalInternalLoansDueFbu)} avancés depuis le Compte Perso restent à restituer par vos projets.`,
      priority: 'high',
    });
  }

  if (metrics.totalStockValueFbu > metrics.totalProjectsFbu && metrics.totalStockValueFbu > 0) {
    improvementAxes.push({
      title: `Accélérer la rotation du capital immobilisé en stock (${fmt(metrics.totalStockValueFbu)})`,
      detail: `Votre stock dépasse la trésorerie liquide des projets (${fmt(metrics.totalProjectsFbu)}). Priorisez l'écoulement des articles déjà achetés avant de nouveaux achats massifs.`,
      priority: 'medium',
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
      detail: 'Aucun point de friction critique détecté. Continuez à tracer chaque vente liée au stock et vos charges d’exploitation.',
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
    totalStockValueFbu: metrics.totalStockValueFbu,
    lowStockAlerts,
    topProductInsight,
  };
}

export function answerCoachQuestion(question: string, state: FinanceState): string {
  const q = question.toLowerCase().trim();
  const metrics = computeFinanceMetrics(state, 'month');
  const report = generateStrategicReport(state, 'month');
  const { displayCurrency, currencies } = state.settings;
  const fmt = (v: number) => formatInDisplayCurrency(v, displayCurrency, currencies);

  if (
    q.includes('stock') ||
    q.includes('inventaire') ||
    q.includes('approvision') ||
    q.includes('rupture') ||
    q.includes('produit') ||
    q.includes('rotation') ||
    q.includes('marge')
  ) {
    const projectStockLines = metrics.projectMetrics
      .filter((pm) => pm.inventoryItems.length > 0 || pm.stockPurchasesFbu > 0)
      .map((pm) => {
        const lowCount = pm.lowStockItems.length;
        const bestProd = pm.topProducts[0];
        return `• ${pm.project.name} : stock de ${fmt(pm.stockValueFbu)} (${pm.inventoryItems.length} article${pm.inventoryItems.length > 1 ? 's' : ''})${lowCount > 0 ? ` · ⚠ ${lowCount} en stock faible` : ''}${bestProd && bestProd.item.totalSoldQty > 0 ? ` · Top produit : ${bestProd.item.name} (${bestProd.item.totalSoldQty} ${bestProd.item.unit} vendus, marge ${bestProd.marginPercent}%)` : ''}`;
      });

    if (projectStockLines.length === 0) {
      return `Aucun article n'est encore enregistré dans vos stocks projets. Lors d'une sortie sur un projet, choisissez « Approvisionnement / Achat de stock » pour créer automatiquement votre inventaire.`;
    }

    const alertsText =
      report.lowStockAlerts.length > 0
        ? `\n\nAlertes réapprovisionnement : ${report.lowStockAlerts
            .map((a) => `${a.item.name} (${a.item.quantity} ${a.item.unit})`)
            .join(', ')}.`
        : '';

    return `État des stocks & marges produits (Total immobilisé : ${fmt(metrics.totalStockValueFbu)}) :\n${projectStockLines.join('\n')}${alertsText}`;
  }

  if (q.includes('investir') || q.includes('projet') || q.includes('rentable') || q.includes('priorit')) {
    if (!report.recommendedProject) {
      return `Aucun projet n'affiche encore un résultat net positif sur les 30 derniers jours. Priorisez la maîtrise des charges d'exploitation avant d'investir davantage.`;
    }
    const redlineNote =
      report.redlineProjects.length > 0
        ? ` À l'inverse, évitez de réinjecter du cash dans ${report.redlineProjects.map((p) => p.project.name).join(', ')} tant que la rentabilité reste négative.`
        : '';
    return `Projet prioritaire pour investir : ${report.recommendedProject.name} (${report.recommendedProject.marginPercent}% de marge nette). ${report.recommendedProject.reason}${redlineNote}`;
  }

  if (q.includes('cash') || q.includes('liquide') || q.includes('banque') || q.includes('lumicash') || q.includes('support')) {
    return `Répartition actuelle de vos fonds (${fmt(metrics.totalManagedFbu)} au total) : ${fmt(metrics.totalCashFbu)} en Cash liquide (${report.cashRatioPercent}%) et ${fmt(metrics.totalBankMomoFbu)} en Banque & Mobile Money (${100 - report.cashRatioPercent}%). Capital immobilisé en stock : ${fmt(metrics.totalStockValueFbu)}.`;
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
• Valeur immobilisée en stock : ${fmt(metrics.totalStockValueFbu)}${report.lowStockAlerts.length > 0 ? ` (${report.lowStockAlerts.length} alerte(s) stock faible)` : ''}
• Flux net mensuel : ${fmt(metrics.periodNetFbu)} (${fmt(metrics.periodInflowsFbu)} d'entrées / ${fmt(metrics.periodOutflowsFbu)} de sorties)
• ${report.recommendedProject ? `Meilleur levier d'investissement : ${report.recommendedProject.name} (${report.recommendedProject.marginPercent}% de marge nette)` : 'Ajoutez des revenus projets pour identifier le meilleur levier.'}
• Dettes : ${fmt(metrics.totalDebtsFbu)} · Prêts internes à rembourser : ${fmt(metrics.totalInternalLoansDueFbu)}`;
}

