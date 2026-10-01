'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';

import type { CrudService, MutationPayload, MutationResponse, QueryParams } from '@/lib/services/base';
import type { ResourceKeys } from '@/lib/queryKeys';
import type { PaginatedResponse } from '@/types';

export interface UseCrudResourceOptions {
  /**
   * Extra query keys to invalidate on every successful mutation, for
   * resources whose changes affect another cache too (e.g. creating a
   * cattle sale should also invalidate the payment-account balances shown
   * elsewhere). Prefer this over each page re-deriving related keys by hand.
   */
  extraInvalidateKeys?: QueryKey[];
}

type ListQueryOptions<R> = Omit<UseQueryOptions<R>, 'queryKey' | 'queryFn'>;
type IdMutationOptions = Omit<UseMutationOptions<MutationResponse, unknown, number | string>, 'mutationFn'>;

/**
 * Wraps a mutation's `onSuccess` so cache invalidation always runs first,
 * then forwards to the caller's own `onSuccess` (if any) with whatever
 * arguments react-query passed — avoids hardcoding the callback's arity,
 * which has changed across major react-query versions.
 */
function withInvalidate<TOptions extends { onSuccess?: (...args: never[]) => unknown }>(
  invalidate: () => void,
  onSuccess: TOptions['onSuccess']
): TOptions['onSuccess'] {
  return ((...args: Parameters<NonNullable<TOptions['onSuccess']>>) => {
    invalidate();
    return onSuccess?.(...args);
  }) as TOptions['onSuccess'];
}

/**
 * Generic CRUD hook built on `@tanstack/react-query`, wrapping a
 * `CrudService` (see lib/services/base.ts) with the resource's canonical
 * query keys (see lib/queryKeys.ts). Every mutation invalidates the
 * resource's whole key namespace on success, so `list`/`trash` queries
 * anywhere in the app refetch together — no more manually listing every
 * cache key to invalidate per mutation.
 *
 * Usage (once a page migrates in B2):
 *   const cattle = useCrudResource(cattleApi, qk.cattle);
 *   const { data } = cattle.useList({ page, search });
 *   const create = cattle.useCreate();
 *   create.mutate(formData);
 *
 * No existing page depends on this yet — it is pure addition (ROADMAP-TO-9.md §B1).
 */
export function useCrudResource<T, ListResponse = unknown>(
  service: CrudService<T, ListResponse>,
  keys: ResourceKeys,
  opts: UseCrudResourceOptions = {}
) {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: keys.all });
    opts.extraInvalidateKeys?.forEach((key) => qc.invalidateQueries({ queryKey: key }));
  };

  function useList(params?: QueryParams, queryOpts?: ListQueryOptions<ListResponse>) {
    return useQuery({
      ...queryOpts,
      queryKey: keys.list(params),
      queryFn: () => service.list(params),
    });
  }

  function useTrash(params?: QueryParams, queryOpts?: ListQueryOptions<PaginatedResponse<T>>) {
    return useQuery({
      ...queryOpts,
      queryKey: keys.trash(params),
      queryFn: () => service.trash(params),
    });
  }

  function useCreate(
    mutOpts?: Omit<UseMutationOptions<MutationResponse, unknown, MutationPayload>, 'mutationFn'>
  ) {
    return useMutation({
      ...mutOpts,
      mutationFn: (payload: MutationPayload) => service.create(payload),
      onSuccess: withInvalidate<NonNullable<typeof mutOpts>>(invalidate, mutOpts?.onSuccess),
    });
  }

  function useUpdate(
    mutOpts?: Omit<
      UseMutationOptions<MutationResponse, unknown, { id: number | string; payload: MutationPayload }>,
      'mutationFn'
    >
  ) {
    return useMutation({
      ...mutOpts,
      mutationFn: ({ id, payload }: { id: number | string; payload: MutationPayload }) =>
        service.update(id, payload),
      onSuccess: withInvalidate<NonNullable<typeof mutOpts>>(invalidate, mutOpts?.onSuccess),
    });
  }

  function useRemove(mutOpts?: IdMutationOptions) {
    return useMutation({
      ...mutOpts,
      mutationFn: (id: number | string) => service.remove(id),
      onSuccess: withInvalidate<NonNullable<typeof mutOpts>>(invalidate, mutOpts?.onSuccess),
    });
  }

  function useToggleStatus(mutOpts?: IdMutationOptions) {
    return useMutation({
      ...mutOpts,
      mutationFn: (id: number | string) => service.toggleStatus(id),
      onSuccess: withInvalidate<NonNullable<typeof mutOpts>>(invalidate, mutOpts?.onSuccess),
    });
  }

  function useRestore(mutOpts?: IdMutationOptions) {
    return useMutation({
      ...mutOpts,
      mutationFn: (id: number | string) => service.restore(id),
      onSuccess: withInvalidate<NonNullable<typeof mutOpts>>(invalidate, mutOpts?.onSuccess),
    });
  }

  function useForceDelete(mutOpts?: IdMutationOptions) {
    return useMutation({
      ...mutOpts,
      mutationFn: (id: number | string) => service.forceDelete(id),
      onSuccess: withInvalidate<NonNullable<typeof mutOpts>>(invalidate, mutOpts?.onSuccess),
    });
  }

  return { useList, useTrash, useCreate, useUpdate, useRemove, useToggleStatus, useRestore, useForceDelete };
}
