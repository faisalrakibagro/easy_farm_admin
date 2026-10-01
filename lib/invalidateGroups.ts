import type { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Query keys that every money-moving mutation must refresh.
 *
 * Any create/update/delete that touches a payment account (an expense, a
 * salary, a purchase, a sale, a transfer, a customer/supplier payment…)
 * changes balances and writes ledger rows. Those are rendered by the
 * account pickers and the accounting reports, which usually sit on the very
 * page that performed the mutation — so leaving them out shows the operator
 * a stale balance right next to the row they just created.
 */
export const MONEY_KEYS: QueryKey[] = [
  ['accounting-payment-accounts'],
  ['general-ledger'],
  ['accounting-summary'],
  ['balance-sheet'],
  ['profit-loss'],
  ['cash-flow'],
  ['accounting-trial-balance'],
  ['payment-account-ledger'],
  ['farm-dashboard'],
  ['farm-dashboard-charts'],
  ['profit-centers'],
  // Per-party / per-animal ledgers and the list columns derived from them:
  // a sale moves a customer's due, a purchase a supplier's, an expense or a
  // treatment is charged to animals.
  ['customer-ledger'],
  ['supplier-ledger'],
  ['cattle-ledger'],
  ['customers'],
  ['suppliers'],
];

/**
 * Every query that shows medicine stock: the inventory list, the dropdown
 * lookups (all / non-vaccine / vaccine-only — separate roots, so one does not
 * prefix-match another), batches and the stock summary. Anything that moves
 * medicine in or out (purchase, usage, vaccine, adjustment) refreshes these.
 */
export const MEDICINE_STOCK_KEYS: QueryKey[] = [
  ['medicines'],
  ['medicines-all'],
  ['medicines-non-vaccines'],
  ['medicines-vaccines-only'],
  ['medicine-batches'],
  ['medicine-stock-summary'],
];

/** Every query that shows feed stock (see MEDICINE_STOCK_KEYS). */
export const FEED_STOCK_KEYS: QueryKey[] = [
  ['feed-items'],
  ['feed-items-all'],
  ['feed-available-stocks'],
  ['feed-stock-summary'],
  ['feed-lots'],
];

/**
 * Consumption that is charged to animals without moving cash (feed and
 * medicine usage): the per-animal cost ledger and the profit report change.
 */
export const CATTLE_COST_KEYS: QueryKey[] = [
  ['cattle-ledger'],
  ['profit-centers'],
];

/** Invalidates every key in `keys` on `qc`. */
export const invalidateKeys = (qc: QueryClient, keys: QueryKey[]) => {
  keys.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
};

/** Shorthand for the money group plus any caller-specific keys. */
export const invalidateMoney = (qc: QueryClient, extra: QueryKey[] = []) => {
  invalidateKeys(qc, [...MONEY_KEYS, ...extra]);
};
