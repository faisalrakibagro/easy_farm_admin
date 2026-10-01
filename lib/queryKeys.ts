/**
 * Centralized react-query key factory.
 *
 * Problem this solves: existing pages hand-roll query keys inline (e.g.
 * `['accounting-payment-accounts']` in most files but `['payment-accounts']`
 * in customers/suppliers/partners detail pages) — two different cache
 * entries for the *same* backend resource, so a mutation that invalidates
 * one leaves the other stale. See ROADMAP-TO-9.md §B1.
 *
 * Every resource gets ONE canonical key namespace here. Pages migrating to
 * `useCrudResource` (see lib/hooks/useCrudResource.ts) import `qk.<resource>`
 * instead of writing key arrays by hand.
 */

export type QueryParams = Record<string, unknown> | undefined;

export interface ResourceKeys {
  /** Root key — pass to `invalidateQueries` to clear every cache entry for this resource. */
  all: readonly [string];
  list: (params?: QueryParams) => readonly [string, 'list', QueryParams];
  detail: (id: number | string) => readonly [string, 'detail', number | string];
  trash: (params?: QueryParams) => readonly [string, 'trash', QueryParams];
  /** Non-paginated "all"/dropdown lookup endpoints (e.g. `/suppliers/all`). */
  lookup: (suffix?: string) => readonly [string, 'lookup', string | undefined];
}

export function createResourceKeys(name: string): ResourceKeys {
  return {
    all: [name] as const,
    list: (params) => [name, 'list', params] as const,
    detail: (id) => [name, 'detail', id] as const,
    trash: (params) => [name, 'trash', params] as const,
    lookup: (suffix) => [name, 'lookup', suffix] as const,
  };
}

/**
 * Canonical resource → key-namespace registry. One entry per backend
 * resource that has (or will have, once migrated in B2) a `useCrudResource`
 * call. Where an old inline key already existed, the canonical name below
 * matches whichever variant was used in *more* places, so migrating pages
 * one at a time keeps sharing the same cache instead of splitting it further.
 */
export const qk = {
  // ── Farm master-data ──────────────────────────────────────────────────
  animalTypes: createResourceKeys('farm-animal-types'),
  animalAgeCategories: createResourceKeys('farm-animal-age-categories'),
  animalAgeStages: createResourceKeys('farm-animal-age-stages'),
  breeds: createResourceKeys('farm-breeds'),
  sheds: createResourceKeys('farm-sheds'),
  units: createResourceKeys('farm-units'),

  // ── Cattle ─────────────────────────────────────────────────────────────
  cattle: createResourceKeys('farm-cattle'),
  cattleWeights: createResourceKeys('farm-cattle-weights'),

  // ── Feed ───────────────────────────────────────────────────────────────
  feedCategories: createResourceKeys('farm-feed-categories'),
  feedItems: createResourceKeys('farm-feed-items'),
  feedPurchases: createResourceKeys('farm-feed-purchases'),
  feedFormulations: createResourceKeys('farm-feed-formulations'),
  feedAdjustments: createResourceKeys('farm-feed-adjustments'),
  feedUsages: createResourceKeys('farm-feed-daily'),

  // ── Medicine ───────────────────────────────────────────────────────────
  medicineCategories: createResourceKeys('farm-medicine-categories'),
  medicines: createResourceKeys('farm-medicines'),
  medicinePurchases: createResourceKeys('farm-medicine-purchases'),
  medicineAdjustments: createResourceKeys('farm-medicine-adjustments'),
  medicineUsages: createResourceKeys('farm-medicine-usages'),

  // ── Health / Labour ────────────────────────────────────────────────────
  vaccineSchedules: createResourceKeys('farm-health-vaccines'),
  treatments: createResourceKeys('farm-health-treatments'),
  labourEmployees: createResourceKeys('farm-labour-employees'),
  dailyLabour: createResourceKeys('farm-labour-daily'),

  // ── Expenses / Assets / Sales ──────────────────────────────────────────
  expenses: createResourceKeys('farm-expenses'),
  fixedAssets: createResourceKeys('farm-assets'),
  cattleSales: createResourceKeys('farm-sales'),
  attachments: createResourceKeys('farm-attachments'),

  // ── Accounting ─────────────────────────────────────────────────────────
  accountingAccounts: createResourceKeys('accounting-accounts'),
  // Canonical: 12 files already used 'accounting-payment-accounts' vs 4
  // using 'payment-accounts' for the same /accounting/payment-accounts
  // endpoint — this name wins so both groups converge on migration.
  paymentAccounts: createResourceKeys('accounting-payment-accounts'),
  accountingEntries: createResourceKeys('accounting-entries'),
  accountTransfers: createResourceKeys('accounting-transfers'),
  generalLedger: createResourceKeys('general-ledger'),

  // ── Parties ────────────────────────────────────────────────────────────
  supplierTypes: createResourceKeys('supplier-types'),
  suppliers: createResourceKeys('suppliers'),
  customers: createResourceKeys('customers'),
  partners: createResourceKeys('partners'),

  // ── Admin ──────────────────────────────────────────────────────────────
  users: createResourceKeys('users'),
  roles: createResourceKeys('roles'),
  permissions: createResourceKeys('permissions'),
  mediaAssets: createResourceKeys('media-assets'),
  mediaCategories: createResourceKeys('media-categories'),
} as const;

export type ResourceName = keyof typeof qk;
