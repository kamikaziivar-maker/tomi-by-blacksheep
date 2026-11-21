import { CurrencyConfig, TimePeriod } from '../types/finance';

export function generateId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDaysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function convertToFbu(
  amount: number,
  currencyCode: string,
  currencies: CurrencyConfig[]
): number {
  if (currencyCode === 'FBU') return amount;
  const found = currencies.find((c) => c.code === currencyCode);
  if (!found || found.rateToFbu <= 0) return amount;
  return Math.round(amount * found.rateToFbu);
}

export function convertFromFbu(
  amountInFbu: number,
  targetCurrencyCode: string,
  currencies: CurrencyConfig[]
): number {
  if (targetCurrencyCode === 'FBU') return amountInFbu;
  const found = currencies.find((c) => c.code === targetCurrencyCode);
  if (!found || found.rateToFbu <= 0) return amountInFbu;
  return amountInFbu / found.rateToFbu;
}

export function formatMoney(
  amount: number,
  currencyCode: string,
  currencies: CurrencyConfig[],
  options?: { compact?: boolean; signed?: boolean }
): string {
  const curr = currencies.find((c) => c.code === currencyCode);
  const symbol = curr?.symbol ?? currencyCode;
  const isFbu = currencyCode === 'FBU' || currencyCode === 'TZS' || currencyCode === 'KES';
  const absVal = Math.abs(amount);

  let formattedNum: string;
  if (options?.compact && absVal >= 1_000_000) {
    formattedNum = `${(absVal / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
  } else if (options?.compact && absVal >= 100_000) {
    formattedNum = `${Math.round(absVal / 1_000)}k`;
  } else {
    formattedNum = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: isFbu ? 0 : Number.isInteger(absVal) ? 0 : 2,
      maximumFractionDigits: isFbu ? 0 : 2,
    })
      .format(absVal)
      .replace(/\u202f|\u00a0/g, ' ');
  }

  const sign = amount < 0 ? '-' : options?.signed && amount > 0 ? '+' : '';

  if (currencyCode === 'USD') return `${sign}$${formattedNum}`;
  if (currencyCode === 'EUR') return `${sign}${formattedNum} €`;
  return `${sign}${formattedNum} ${symbol}`;
}

export function formatInDisplayCurrency(
  amountInFbu: number,
  displayCurrency: string,
  currencies: CurrencyConfig[],
  options?: { compact?: boolean; signed?: boolean }
): string {
  const converted = convertFromFbu(amountInFbu, displayCurrency, currencies);
  return formatMoney(converted, displayCurrency, currencies, options);
}

export function isDateInPeriod(dateStr: string, period: TimePeriod): boolean {
  if (period === 'all') return true;
  const target = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(target.getTime())) return true;
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  if (period === 'week') {
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);
    return target >= startOfWeek && target <= now;
  }

  if (period === 'month') {
    const startOfMonth = new Date(now);
    startOfMonth.setDate(now.getDate() - 30);
    startOfMonth.setHours(0, 0, 0, 0);
    return target >= startOfMonth && target <= now;
  }

  return true;
}

export function formatShortDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
  }).format(d);
}

export function sanitizeSignedNumberInput(raw: string): string {
  const replaced = raw.replace(/\u2212/g, '-').replace(/,/g, '.');
  let result = '';
  let hasSign = false;
  let hasDot = false;
  for (let i = 0; i < replaced.length; i++) {
    const ch = replaced[i];
    if ((ch === '-' || ch === '+') && i === 0 && !hasSign) {
      if (ch === '-') result += '-';
      hasSign = true;
    } else if (ch >= '0' && ch <= '9') {
      result += ch;
    } else if (ch === '.' && !hasDot) {
      result += '.';
      hasDot = true;
    }
  }
  return result;
}

export function toggleSignedInput(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('-')) {
    return trimmed.slice(1);
  }
  if (trimmed.startsWith('+')) {
    return `-${trimmed.slice(1)}`;
  }
  return `-${trimmed}`;
}

export function parseSignedAmount(raw: string): number {
  const normalized = raw
    .replace(/\u2212/g, '-')
    .replace(/\s+/g, '')
    .replace(',', '.');
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

