import api from '@/lib/api';
import type { PaginatedResponse } from '@/types';

export type QueryParams = Record<string, unknown> | undefined;
export type MutationPayload = FormData | Record<string, unknown>;

/** Every mutation endpoint in this API returns at least `{ message: string }`. */
export interface MutationResponse {
  message: string;
  [key: string]: unknown;
}

export interface CrudServiceOptions {
  /**
   * HTTP verb used for `update()`. Nearly all resources accept `PUT /{resource}/{id}`
   * (the default). Override only for a genuinely non-standard endpoint.
   */
  updateMethod?: 'put' | 'patch' | 'post';
  /** Override the update URL. Defaults to `${basePath}/${id}`. */
  updatePath?: (id: number | string) => string;
}

export interface CrudService<T, ListResponse = PaginatedResponse<T>> {
  list: (params?: QueryParams) => Promise<ListResponse>;
  show: (id: number | string) => Promise<Record<string, unknown>>;
  create: (payload: MutationPayload) => Promise<MutationResponse>;
  update: (id: number | string, payload: MutationPayload) => Promise<MutationResponse>;
  remove: (id: number | string) => Promise<MutationResponse>;
  toggleStatus: (id: number | string) => Promise<MutationResponse>;
  trash: (params?: QueryParams) => Promise<PaginatedResponse<T>>;
  restore: (id: number | string) => Promise<MutationResponse>;
  forceDelete: (id: number | string) => Promise<MutationResponse>;
}

/**
 * Thin, uniform CRUD API wrapper matching this backend's REST conventions:
 *   GET    /{resource}                 → list (paginated)
 *   GET    /{resource}/{id}            → show
 *   POST   /{resource}                 → create
 *   PUT    /{resource}/{id}            → update (overridable, see CrudServiceOptions)
 *   DELETE /{resource}/{id}            → remove (soft-delete)
 *   PATCH  /{resource}/{id}/toggle-status → toggleStatus
 *   GET    /{resource}/trash           → trash (paginated)
 *   POST   /{resource}/{id}/restore    → restore
 *   DELETE /{resource}/{id}/force-delete → forceDelete
 *
 * `ListResponse` defaults to the standard Laravel paginator shape
 * (`PaginatedResponse<T>`) but can be overridden for resources whose main
 * list endpoint returns a non-paginated custom envelope instead
 * (e.g. `{ payment_accounts: T[] }`).
 */
export function createCrudService<T, ListResponse = PaginatedResponse<T>>(
  basePath: string,
  opts: CrudServiceOptions = {}
): CrudService<T, ListResponse> {
  const updateMethod = opts.updateMethod ?? 'put';
  const updatePath = opts.updatePath ?? ((id: number | string) => `${basePath}/${id}`);

  return {
    list: (params) => api.get<ListResponse>(basePath, { params }).then((r) => r.data),

    show: (id) => api.get<Record<string, unknown>>(`${basePath}/${id}`).then((r) => r.data),

    create: (payload) => api.post<MutationResponse>(basePath, payload).then((r) => r.data),

    update: (id, payload) =>
      api
        .request<MutationResponse>({ method: updateMethod, url: updatePath(id), data: payload })
        .then((r) => r.data),

    remove: (id) => api.delete<MutationResponse>(`${basePath}/${id}`).then((r) => r.data),

    toggleStatus: (id) => api.patch<MutationResponse>(`${basePath}/${id}/toggle-status`).then((r) => r.data),

    trash: (params) => api.get<PaginatedResponse<T>>(`${basePath}/trash`, { params }).then((r) => r.data),

    restore: (id) => api.post<MutationResponse>(`${basePath}/${id}/restore`).then((r) => r.data),

    forceDelete: (id) => api.delete<MutationResponse>(`${basePath}/${id}/force-delete`).then((r) => r.data),
  };
}

/**
 * For non-paginated "all"/dropdown lookup endpoints whose envelope key
 * varies per resource (e.g. `{ payment_accounts: [...] }`, `{ sheds: [...] }`).
 * Usage: `listAll: createLookupService<{ sheds: Shed[] }>('/farm/sheds/all')`.
 */
export function createLookupService<R>(path: string) {
  return (params?: QueryParams) => api.get<R>(path, { params }).then((r) => r.data);
}
