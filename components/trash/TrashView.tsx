'use client';

import { ReactNode, useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw, Search, Trash2 } from 'lucide-react';
import Link from '@/components/ui/AppLink';
import api from '@/lib/api';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { invalidateMoney } from '@/lib/invalidateGroups';
import type { PaginatedResponse } from '@/types';
import { savedMsg, failedMsg } from '@/lib/feedback';
import { fmtNum } from '@/lib/format';

/**
 * Trash endpoints answer in one of two shapes: a plain Laravel paginator
 * (`last_page`/`total` at the top level) or a Resource collection
 * (`UserResource::collection($paginator)`), which moves them under `meta`.
 */
type TrashResponse<T> = Partial<PaginatedResponse<T>> & {
  data?: T[];
  meta?: { last_page?: number; total?: number };
};

/**
 * Shared soft-delete list/restore/force-delete view — replaces 29 near-
 * duplicate .../trash/page.tsx files (see ROADMAP-TO-9.md §B3). Each page
 * keeps its own route + a thin config object (columns, endpoints, labels,
 * permissions); this component owns the table/card/pagination/dialog
 * plumbing that used to be copy-pasted 29 times.
 *
 * Deliberately NOT translation-aware: every label is passed in already
 * resolved by the caller's own `t()`/`tf()`/etc, since the 29 original
 * pages used inconsistent i18n namespace strategies (single ns, array ns,
 * multiple hook instances) — keeping this component translation-agnostic
 * avoids forcing one of those strategies on every page.
 */

export interface TrashColumn<T> {
  key: string;
  header: string;
  /** Receives the row, its index within the current page, and the current page number (1-based) — e.g. for a manual serial-number column. */
  render: (item: T, index: number, page: number) => ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
  /** Leading avatar/thumbnail column — shown next to `primary` in the mobile card header row instead of the label:value grid. At most one column should set this. */
  avatar?: boolean;
  /** Prominent title column — shown next to `avatar` (if any) in the mobile card header row instead of the label:value grid. Exactly one column should set this. */
  primary?: boolean;
}

export interface TrashMutationMessages {
  success?: string;
  error?: string;
}

export interface TrashBulkConfig {
  /** Endpoint for bulk restore, e.g. `/media/bulk-restore`. Body sent as `{ ids }`. */
  restorePath: string;
  /** Endpoint for bulk force-delete, e.g. `/media/bulk-force-delete`. Body sent as `{ data: { ids } }`. */
  forceDeletePath: string;
  confirmTitle?: string;
  confirmMessage: (count: number) => string;
  confirmLabel?: string;
  messages?: {
    restoreSuccess?: string;
    restoreError?: string;
    forceDeleteSuccess?: string;
    forceDeleteError?: string;
  };
}

export interface TrashViewLabels {
  restore: string;
  forceDelete: string;
  actions: string;
  loading: string;
  prev: string;
  next: string;
  pageOf: (current: number, total: number) => string;
  totalCount?: (count: number) => string;
  confirmTitle: string;
  confirmMessage: string;
  confirmLabel: string;
  searchPlaceholder: string;
}

export interface TrashViewProps<T extends { id: number }> {
  title: ReactNode;
  /** Static string, or a function of the current page's `total` (for e.g. a live "N items" count). */
  subtitle?: string | ((total: number) => string);
  backHref: string;
  /** Optional text next to the back arrow; omit for icon-only. */
  backLabel?: string;
  headerIcon?: LucideIcon;
  /** Warning banner text; omit to hide the banner entirely. */
  warningText?: string;
  apiBasePath: string;
  queryKey: string;
  /**
   * Extra query keys to invalidate (besides `queryKey`) when restore succeeds.
   * A plain string is a root key (`'expenses'` → `['expenses']`); a shared
   * key group such as MEDICINE_STOCK_KEYS can be spread in as-is.
   */
  invalidateOnRestore?: (string | QueryKey)[];
  /** Extra query keys to invalidate (besides `queryKey`) when force-delete succeeds. */
  invalidateOnForceDelete?: (string | QueryKey)[];
  perPage?: number;
  columns: TrashColumn<T>[];
  canRestore?: boolean;
  canForceDelete: boolean;
  restoreMessages?: TrashMutationMessages;
  forceDeleteMessages?: TrashMutationMessages;
  emptyIcon: LucideIcon;
  /** Defaults to the shared "Trash is empty". */
  emptyTitle?: string;
  emptyDescription?: string;
  /** Only what differs from the shared wording; the rest comes from the translations. */
  labels?: Partial<TrashViewLabels>;
  showTotalCount?: boolean;
  /**
   * The trashed record moved money (it has a payment account: expense,
   * purchase, sale, salary…). Restoring or purging it changes balances and
   * ledgers, so every money query is refreshed too (see MONEY_KEYS).
   */
  money?: boolean;
  bulk?: TrashBulkConfig;
}

const toKey = (k: string | QueryKey): QueryKey => (typeof k === 'string' ? [k] : k);

function extractMessage(res: unknown, fallback: string): string {
  const data = (res as { data?: { message?: string } } | undefined)?.data;
  return data?.message ?? fallback;
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { message?: string } } } | undefined)?.response?.data;
  return data?.message ?? fallback;
}

export function TrashView<T extends { id: number }>({
  title,
  subtitle,
  backHref,
  backLabel,
  headerIcon: HeaderIcon,
  warningText,
  apiBasePath,
  queryKey,
  invalidateOnRestore = [],
  invalidateOnForceDelete = [],
  perPage = 15,
  columns,
  canRestore = true,
  canForceDelete,
  restoreMessages,
  forceDeleteMessages,
  emptyIcon: EmptyIcon,
  emptyTitle: emptyTitleProp,
  emptyDescription,
  labels: labelsProp,
  showTotalCount = true,
  money = false,
  bulk,
}: TrashViewProps<T>) {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation('common');
  const labels: TrashViewLabels = {
    restore: t('btn.restore'),
    forceDelete: t('btn.force_delete'),
    actions: t('actions'),
    loading: t('status.loading'),
    prev: t('btn.prev'),
    next: t('btn.next'),
    pageOf: (current, total) => t('pagination.page_of', { current: fmtNum(current), total: fmtNum(total) }),
    confirmTitle: t('confirm.force_delete_title'),
    confirmMessage: t('confirm.force_delete_message'),
    confirmLabel: t('confirm.force_delete_label'),
    searchPlaceholder: t('ui.search'),
    ...labelsProp,
  };
  const emptyTitle = emptyTitleProp ?? t('trash.empty');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [forceDeleteTarget, setForceDeleteTarget] = useState<number | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState<'restore' | 'force-delete' | null>(null);
  // Row checkboxes are named by the row's title cell (aria-labelledby).
  const uid = useId();

  const { data, isLoading } = useQuery<TrashResponse<T>>({
    queryKey: [queryKey, page, search],
    queryFn: async () =>
      (await api.get(`${apiBasePath}/trash`, { params: { page, search, per_page: perPage } })).data,
  });

  const invalidateAfterRestore = () => {
    qc.invalidateQueries({ queryKey: [queryKey] });
    invalidateOnRestore.forEach((k) => qc.invalidateQueries({ queryKey: toKey(k) }));
    if (money) invalidateMoney(qc);
  };
  const invalidateAfterForceDelete = () => {
    qc.invalidateQueries({ queryKey: [queryKey] });
    invalidateOnForceDelete.forEach((k) => qc.invalidateQueries({ queryKey: toKey(k) }));
    if (money) invalidateMoney(qc);
  };

  const restoreMutation = useMutation({
    mutationFn: (id: number) => api.post(`${apiBasePath}/${id}/restore`),
    onSuccess: (res) => {
      invalidateAfterRestore();
      toast.success(extractMessage(res, restoreMessages?.success ?? t('ui.restored')));
    },
    onError: (e) => toast.error(extractErrorMessage(e, restoreMessages?.error ?? t('ui.restore_failed'))),
  });

  const forceDeleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`${apiBasePath}/${id}/force-delete`),
    onSuccess: (res) => {
      invalidateAfterForceDelete();
      setForceDeleteTarget(null);
      toast.success(extractMessage(res, forceDeleteMessages?.success ?? t('ui.deleted_permanently')));
    },
    onError: (e) => {
      toast.error(extractErrorMessage(e, forceDeleteMessages?.error ?? t('ui.delete_permanently_failed')));
      setForceDeleteTarget(null);
    },
  });

  const bulkRestoreMutation = useMutation({
    mutationFn: (ids: number[]) => api.post(bulk?.restorePath ?? '', { ids }),
    onSuccess: (res) => {
      invalidateAfterRestore();
      setSelected([]);
      toast.success(extractMessage(res, bulk?.messages?.restoreSuccess ?? t('ui.restored')));
    },
    onError: (e) => toast.error(extractErrorMessage(e, bulk?.messages?.restoreError ?? failedMsg())),
  });

  const bulkForceDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => api.delete(bulk?.forceDeletePath ?? '', { data: { ids } }),
    onSuccess: (res) => {
      invalidateAfterForceDelete();
      setSelected([]);
      setBulkAction(null);
      toast.success(extractMessage(res, bulk?.messages?.forceDeleteSuccess ?? savedMsg()));
    },
    onError: (e) => {
      toast.error(extractErrorMessage(e, bulk?.messages?.forceDeleteError ?? failedMsg()));
      setBulkAction(null);
    },
  });

  const items = data?.data ?? [];
  const totalPages = data?.last_page ?? data?.meta?.last_page ?? 1;
  const total = data?.total ?? data?.meta?.total ?? 0;

  const avatarCol = columns.find((c) => c.avatar);
  const primaryCol = columns.find((c) => c.primary) ?? columns[0];
  const gridCols = columns.filter((c) => c !== avatarCol && c !== primaryCol);

  const allSelected = items.length > 0 && selected.length === items.length;
  const toggleAll = () => setSelected(allSelected ? [] : items.map((i) => i.id));
  const toggleOne = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const alignClass = (align?: 'left' | 'right' | 'center') =>
    align === 'right' ? 'text-end' : align === 'center' ? 'text-center' : 'text-start';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href={backHref} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={15} className="rtl:rotate-180" /> {backLabel}
        </Link>
      </div>

      <div className="flex items-center gap-3">
        {HeaderIcon && (
          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
            <HeaderIcon size={18} className="text-red-500" />
          </div>
        )}
        <div>
          <h1 className="font-semibold text-slate-800">{title}</h1>
          {subtitle && (
            <p className="text-xs text-slate-500">{typeof subtitle === 'function' ? subtitle(total) : subtitle}</p>
          )}
        </div>
      </div>

      {warningText && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <Trash2 size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p>{warningText}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={labels.searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full ps-9 pe-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {bulk && selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">{fmtNum(selected.length)}</span>
            <button
              type="button"
              onClick={() => bulkRestoreMutation.mutate(selected)}
              disabled={bulkRestoreMutation.isPending}
              className="flex items-center gap-1.5 min-h-10 sm:min-h-0 px-3 py-1.5 text-xs font-medium bg-green-50 hover:bg-green-100 text-green-700 rounded-lg disabled:opacity-50"
            >
              <RotateCcw size={12} /> {labels.restore}
            </button>
            {canForceDelete && (
              <button
                type="button"
                onClick={() => setBulkAction('force-delete')}
                className="flex items-center gap-1.5 min-h-10 sm:min-h-0 px-3 py-1.5 text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 rounded-lg"
              >
                <Trash2 size={12} /> {labels.forceDelete}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Mobile card view */}
        <div className="block sm:hidden divide-y divide-slate-100">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 space-y-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-200 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 bg-slate-200 rounded w-1/3" />
                    <div className="h-3 bg-slate-100 rounded w-1/4" />
                  </div>
                </div>
              </div>
            ))
          ) : items.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <EmptyIcon size={36} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">{emptyTitle}</p>
              {emptyDescription && <p className="text-xs text-slate-400 mt-1">{emptyDescription}</p>}
            </div>
          ) : (
            <>
              {bulk && (
                <label className="flex items-center gap-2.5 min-h-11 px-4 py-2 text-sm text-slate-600 cursor-pointer select-none">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4" />
                  {allSelected ? t('btn.deselect_all') : t('btn.select_all')}
                </label>
              )}
              {items.map((item, index) => (
                // Only the record is faded (it is in the trash); the buttons keep full strength
                // and sit on their own row so they are easy to hit on a phone.
                <div key={item.id} className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    {bulk && (
                      <label className="shrink-0 -m-3 p-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selected.includes(item.id)}
                          onChange={() => toggleOne(item.id)}
                          aria-labelledby={`${uid}-m-${item.id}`}
                          className="block w-4 h-4 mt-0.5"
                        />
                      </label>
                    )}
                    <div className="flex items-start gap-3 flex-1 min-w-0 opacity-70">
                      {avatarCol && <div className="flex-shrink-0">{avatarCol.render(item, index, page)}</div>}
                      <div id={`${uid}-m-${item.id}`} className="flex-1 min-w-0">{primaryCol.render(item, index, page)}</div>
                    </div>
                  </div>
                  {gridCols.length > 0 && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs opacity-70">
                      {gridCols.map((col) => (
                        <div key={col.key} className={`min-w-0 ${col.className ?? ''}`}>
                          <span className="text-slate-400 uppercase tracking-wide">{col.header}</span>
                          <p className="text-slate-500 mt-0.5 [overflow-wrap:anywhere]">{col.render(item, index, page)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {(canRestore || canForceDelete) && (
                    <div className="flex flex-wrap gap-2">
                      {canRestore && (
                        <button
                          type="button"
                          onClick={() => restoreMutation.mutate(item.id)}
                          disabled={restoreMutation.isPending}
                          className="flex-1 flex items-center justify-center gap-1.5 min-h-10 px-3 py-2 text-xs font-medium bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <RotateCcw size={13} /> {labels.restore}
                        </button>
                      )}
                      {canForceDelete && (
                        <button
                          type="button"
                          onClick={() => setForceDeleteTarget(item.id)}
                          disabled={forceDeleteMutation.isPending}
                          className="flex-1 flex items-center justify-center gap-1.5 min-h-10 px-3 py-2 text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Trash2 size={13} /> {labels.forceDelete}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Desktop table view */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {bulk && (
                  <th className="px-4 py-3 w-8">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll}
                      aria-label={allSelected ? t('btn.deselect_all') : t('btn.select_all')} />
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 font-medium text-slate-600 ${alignClass(col.align)}`}
                  >
                    {col.header}
                  </th>
                ))}
                <th className="text-end px-4 py-3 font-medium text-slate-600">{labels.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: columns.length + 1 + (bulk ? 1 : 0) }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1 + (bulk ? 1 : 0)} className="px-4 py-12 text-center">
                    <EmptyIcon size={36} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500 font-medium">{emptyTitle}</p>
                    {emptyDescription && <p className="text-xs text-slate-400 mt-1">{emptyDescription}</p>}
                  </td>
                </tr>
              ) : (
                items.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    {bulk && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.includes(item.id)}
                          onChange={() => toggleOne(item.id)}
                          aria-labelledby={`${uid}-d-${item.id}`}
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} id={col === primaryCol ? `${uid}-d-${item.id}` : undefined}
                        className={`px-4 py-3 opacity-70 ${alignClass(col.align)} ${col.className ?? ''}`}>
                        {col.render(item, index, page)}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {canRestore && (
                          <button
                            onClick={() => restoreMutation.mutate(item.id)}
                            disabled={restoreMutation.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <RotateCcw size={12} /> {labels.restore}
                          </button>
                        )}
                        {canForceDelete && (
                          <button
                            onClick={() => setForceDeleteTarget(item.id)}
                            disabled={forceDeleteMutation.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Trash2 size={12} /> {labels.forceDelete}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-500">
              {labels.pageOf(page, totalPages)}
              {showTotalCount
                ? ` • ${labels.totalCount ? labels.totalCount(total) : t('pagination.total_count', { count: fmtNum(total) })}`
                : ''}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="grid place-items-center min-w-10 min-h-10 sm:min-w-0 sm:min-h-0 p-1.5 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                aria-label={labels.prev}
              >
                <ChevronLeft size={14} className="rtl:rotate-180" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="grid place-items-center min-w-10 min-h-10 sm:min-w-0 sm:min-h-0 p-1.5 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                aria-label={labels.next}
              >
                <ChevronRight size={14} className="rtl:rotate-180" />
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!forceDeleteTarget}
        title={labels.confirmTitle}
        message={labels.confirmMessage}
        confirmLabel={labels.confirmLabel}
        loading={forceDeleteMutation.isPending}
        onConfirm={() => forceDeleteTarget && forceDeleteMutation.mutate(forceDeleteTarget)}
        onCancel={() => setForceDeleteTarget(null)}
      />

      {bulk && (
        <ConfirmDialog
          open={bulkAction === 'force-delete'}
          title={bulk.confirmTitle ?? labels.confirmTitle}
          message={bulk.confirmMessage(selected.length)}
          confirmLabel={bulk.confirmLabel ?? labels.confirmLabel}
          loading={bulkForceDeleteMutation.isPending}
          onConfirm={() => bulkForceDeleteMutation.mutate(selected)}
          onCancel={() => setBulkAction(null)}
        />
      )}
    </div>
  );
}
