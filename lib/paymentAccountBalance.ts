import type { AccountingPaymentAccount } from '@/types';
import { fmtMoney } from '@/lib/format';

/** Minimal shape needed to render a balance — some modals declare their own option type. */
interface BalanceBearing {
  name: string;
  balance?: number;
}

/**
 * Format a payment-account balance for display: `৳12,500.00` (৳১২,৫০০.০০ in
 * Bengali) — fmtMoney, so it follows the interface language.
 *
 * The app had three competing formats before this (bare `toLocaleString()`,
 * two-decimal, and one hardcoded English `— Balance: ৳` that bypassed i18n).
 * New call sites should use these helpers so the money reads the same everywhere.
 */
export function formatBalance(balance: number): string {
  return fmtMoney(balance);
}

/**
 * Suffix for a `<select>` option label, e.g. ` — ৳12,500.00` or
 * ` — ⚠ -৳5,000.00` when overdrawn.
 *
 * `balance` is optional on `AccountingPaymentAccount` because only the list
 * endpoint attaches it (`includeBalance: true`), so an account that arrived from
 * a create/update response renders as a plain name rather than crashing.
 *
 * A `<option>` cannot carry colour in most browsers, so a negative balance is
 * marked with a warning sign; colour is applied by `balanceToneClass` on text
 * outside the option.
 */
export function balanceSuffix(account: BalanceBearing): string {
  if (account.balance === undefined) return '';
  const warn = account.balance < 0 ? '⚠ ' : '';
  return ` — ${warn}${formatBalance(account.balance)}`;
}

/** Tailwind text colour for a balance figure: red when overdrawn. */
export function balanceToneClass(balance: number): string {
  return balance < 0 ? 'text-red-600' : 'text-emerald-600';
}

/** Look up the selected account from a list, given the form's string id. */
export function findAccount<T extends { id: number }>(
  accounts: T[] | undefined,
  selectedId: string
): T | undefined {
  if (!selectedId) return undefined;
  return accounts?.find(a => String(a.id) === selectedId);
}

/**
 * Whether an outflow of `amount` would overdraw `account`.
 *
 * Returns false when the balance is unknown or the amount is not yet a valid
 * number, so a half-typed field does not flash a warning. Deliberately advisory
 * only — nothing blocks submission, because backdated entries and genuine
 * overdrafts are legitimate here and the API enforces no balance rule.
 */
export function exceedsBalance(
  account: BalanceBearing | undefined,
  amount: number | string
): boolean {
  if (!account || account.balance === undefined) return false;
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (!Number.isFinite(n) || n <= 0) return false;
  return n > account.balance;
}

export type { AccountingPaymentAccount };
