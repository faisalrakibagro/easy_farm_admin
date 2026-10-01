import { localeFor } from '@/lib/languages';

/**
 * Numbers and money as the reader sees them, in the interface language
 * (Bengali digits in Bengali, Arabic-Indic in Arabic). Only for display:
 * values sent to the API and typed into inputs stay plain English digits.
 */

type Numeric = number | string | null | undefined;

const toNumber = (v: Numeric): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

/**
 * A number with grouping. `decimals` fixes the digits after the point
 * (like toFixed); without it, up to 3 are shown (stock is kept to the gram
 * or millilitre) and trailing zeros dropped. Money goes through fmtMoney.
 */
export function fmtNum(value: Numeric, decimals?: number): string {
  return new Intl.NumberFormat(localeFor(), decimals === undefined
    ? { maximumFractionDigits: 3 }
    : { minimumFractionDigits: decimals, maximumFractionDigits: decimals },
  ).format(toNumber(value));
}

/** Money: the taka sign and always two decimals (৳২,২৯,৫৮৪.০০). */
export function fmtMoney(value: Numeric): string {
  const n = toNumber(value);
  const body = new Intl.NumberFormat(localeFor(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));
  return `${n < 0 ? '-' : ''}৳${body}`;
}

/** A percentage from a value already in percent (12.5 → ১২.৫%). */
export function fmtPct(value: Numeric, decimals = 1): string {
  return `${fmtNum(value, decimals)}%`;
}

/**
 * A calendar date in the interface language (২৪/০৯/২০২৬). The API's
 * "2026-09-24" (or that day as a midnight-UTC timestamp) shows as written,
 * never shifted a day by the timezone. Empty → ''.
 */
export function fmtDate(value: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return '';
  const day = /^(\d{4})-(\d{2})-(\d{2})(?:$|T00:00:00(?:\.0+)?Z$)/.exec(value);
  const d = day ? new Date(+day[1], +day[2] - 1, +day[3]) : new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(localeFor(), options);
}
