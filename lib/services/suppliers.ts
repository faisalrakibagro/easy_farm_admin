import type { Supplier } from '@/types';
import { createCrudService, createLookupService } from './base';

/**
 * `listAll` is the non-paginated dropdown endpoint used by cattle-sale/purchase forms.
 * `update` uses the standard `PUT /suppliers/{id}` convention (ROADMAP-TO-9.md §A9 —
 * fixed in lockstep with the live `suppliers/[id]/_client.tsx` call site, which sends
 * a `_method=PUT`-spoofed POST so multipart photo uploads keep working over PHP).
 */
export const suppliersApi = {
  ...createCrudService<Supplier>('/suppliers'),
  listAll: createLookupService<{ suppliers: Pick<Supplier, 'id' | 'name' | 'supplier_type_id' | 'phone'>[] }>(
    '/suppliers/all'
  ),
};
