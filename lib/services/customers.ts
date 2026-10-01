import type { Customer } from '@/types';
import { createCrudService, createLookupService } from './base';

/**
 * `update` uses the standard `PUT /customers/{id}` convention (ROADMAP-TO-9.md §A9 —
 * fixed in lockstep with the live `customers/[id]/_client.tsx` call site).
 * `listAll` is the non-paginated dropdown endpoint used by cattle-sale forms.
 */
export const customersApi = {
  ...createCrudService<Customer>('/customers'),
  listAll: createLookupService<{ customers: Pick<Customer, 'id' | 'name' | 'phone'>[] }>('/customers/all'),
};
