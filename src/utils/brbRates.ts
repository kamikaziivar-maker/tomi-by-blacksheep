import { CurrencyConfig } from '../types/finance';

export interface BrbSyncResult {
  ok: boolean;
  source: 'remote' | 'cache' | 'manual';
  updatedAt: string;
  rates: Record<string, number>; // code devise -> valeur en FBU pour 1 unité
  message: string;
}

const BRB_CACHE_KEY = 'tomi_brb_rates_cache_v1';

// URL optionnelle d'un endpoint JSON retournant { rates: { USD: 2950, EUR: 3200, ... }, updatedAt?: string }
const BRB_RATES_ENDPOINT =
  (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_BRB_RATES_URL || '';

export function readCachedBrbRates(): {
  updatedAt: string | null;
  rates: Record<string, number>;
} {
  try {
    const raw = localStorage.getItem(BRB_CACHE_KEY);
    if (!raw) return { updatedAt: null, rates: {} };
    const parsed = JSON.parse(raw) as {
      updatedAt?: string;
      rates?: Record<string, number>;
    };
    return {
      updatedAt: parsed.updatedAt || null,
      rates: parsed.rates || {},
    };
  } catch {
    return { updatedAt: null, rates: {} };
  }
}

export function writeCachedBrbRates(rates: Record<string, number>, updatedAt: string) {
  try {
    localStorage.setItem(
      BRB_CACHE_KEY,
      JSON.stringify({ rates, updatedAt })
    );
  } catch {
    // Ignore si quota dépassé
  }
}

export function hasSyncedBrbToday(lastSyncIso?: string | null): boolean {
  if (!lastSyncIso) return false;
  const todayKey = new Date().toISOString().slice(0, 10);
  return lastSyncIso.slice(0, 10) === todayKey;
}

/**
 * Tente de synchroniser les taux vers FBU depuis l'endpoint configuré (BRB),
 * avec repli automatique sur le cache local en mode hors ligne.
 */
export async function syncBrbExchangeRates(
  currentCurrencies: CurrencyConfig[]
): Promise<BrbSyncResult> {
  const nowIso = new Date().toISOString();
  const cached = readCachedBrbRates();

  if (!BRB_RATES_ENDPOINT) {
    return {
      ok: false,
      source: 'manual',
      updatedAt: cached.updatedAt || nowIso,
      rates: cached.rates,
      message:
        'Aucun flux BRB en ligne configuré (VITE_BRB_RATES_URL). Utilisez la mise à jour manuelle ou connectez un flux BRB.',
    };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      ok: false,
      source: 'cache',
      updatedAt: cached.updatedAt || nowIso,
      rates: cached.rates,
      message:
        'Hors ligne : conservation des taux enregistrés localement.',
    };
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(BRB_RATES_ENDPOINT, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    window.clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = (await res.json()) as {
      rates?: Record<string, number>;
      updatedAt?: string;
    };

    const incomingRates: Record<string, number> = {};
    if (data.rates && typeof data.rates === 'object') {
      for (const [k, v] of Object.entries(data.rates)) {
        const code = k.trim().toUpperCase();
        const num = Number(v);
        if (code && Number.isFinite(num) && num > 0) {
          incomingRates[code] = num;
        }
      }
    }

    const trackedCodes = new Set(
      currentCurrencies.map((c) => c.code.toUpperCase()).filter((c) => c !== 'FBU')
    );
    const hasRelevantRates = Object.keys(incomingRates).some((c) =>
      trackedCodes.has(c)
    );

    if (!hasRelevantRates && Object.keys(incomingRates).length === 0) {
      throw new Error('Réponse BRB vide');
    }

    const mergedRates = { ...cached.rates, ...incomingRates, FBU: 1 };
    const syncStamp = data.updatedAt || nowIso;
    writeCachedBrbRates(mergedRates, syncStamp);

    return {
      ok: true,
      source: 'remote',
      updatedAt: syncStamp,
      rates: mergedRates,
      message: `Taux BRB synchronisés (${new Date(syncStamp).toLocaleDateString('fr-FR')}).`,
    };
  } catch {
    window.clearTimeout(timer);
    return {
      ok: false,
      source: 'cache',
      updatedAt: cached.updatedAt || nowIso,
      rates: cached.rates,
      message:
        'Synchronisation BRB indisponible pour le moment : les taux locaux restent actifs.',
    };
  }
}