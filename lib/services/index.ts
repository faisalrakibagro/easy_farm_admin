/**
 * Barrel export for the resource services layer. See ROADMAP-TO-9.md §B1.
 *
 * Only a handful of resources are wired up so far (one per distinct backend
 * quirk: plain CRUD, non-paginated lookup envelope, POST-based update) to
 * prove the `createCrudService` factory against real endpoints. Additional
 * resources get their own one-line file here as each page is migrated in B2
 * — see `base.ts` for the generic factory used by all of them.
 */
export { createCrudService, createLookupService } from './base';
export type { CrudService, CrudServiceOptions, MutationPayload, MutationResponse, QueryParams } from './base';

export { cattleApi } from './cattle';
export { paymentAccountsApi } from './paymentAccounts';
export { suppliersApi } from './suppliers';
export { customersApi } from './customers';
