'use client';

import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SortType } from '@/lib/schemas/types';
import type { TableSort } from '@/lib/hooks/useTableSort';
import { fmtNum } from '@/lib/format';

/**
 * The parts every list table shares — sort headers, the phone sort menu, the
 * serial number and the pager — so DynamicTable and the hand-built tables
 * (custom phone cards, expandable rows) sort and page the same way.
 */

/**
 * A table's sort state and setter: the `useTableSort` result. A `defaultSort`
 * with an empty key is a list's own order that no column gives (stock still
 * on hand first, say); the sort menu and headers can return to it.
 */
export interface Sorting { sort: TableSort; setSort: (next: TableSort) => void; defaultSort?: TableSort }

export interface SortOption { key: string; label: string; type?: SortType }

/** Dates and amounts open newest / largest first — what a farm list is read for; text opens A→Z, coming dates soonest first. */
const firstDir = (type: SortType = 'text'): TableSort['dir'] => (type === 'text' || type === 'due' ? 'asc' : 'desc');

const flip = (dir: TableSort['dir']): TableSort['dir'] => (dir === 'asc' ? 'desc' : 'asc');

/**
 * Clicking the sorted column reverses it; another column starts at its first
 * direction. Where the list's own order is no column's, a third click on a
 * column returns to it.
 */
export function nextSort(current: TableSort, key: string, type?: SortType, ownOrder?: TableSort): TableSort {
  if (current.key !== key) return { key, dir: firstDir(type) };
  if (ownOrder && ownOrder.key === '' && current.dir !== firstDir(type)) return ownOrder;
  return { key, dir: flip(current.dir) };
}

const alignClass = (align?: 'left' | 'right' | 'center') =>
  align === 'right' ? 'text-end' : align === 'center' ? 'text-center' : 'text-start';

/**
 * A column header. Given `sortKey` and `sorting` it holds a sort button —
 * the WAI-ARIA sortable-table pattern: a real button inside the `th`, and
 * `aria-sort` on the sorted header only. A faint ↕ marks every sortable
 * column, since a touch screen has no hover to reveal it; the sorted one
 * shows ↑ or ↓.
 */
export function SortHeader({ label, align, sortKey, sortType, sorting, className = '' }: {
  label: ReactNode;
  align?: 'left' | 'right' | 'center';
  sortKey?: string;
  sortType?: SortType;
  sorting?: Sorting;
  className?: string;
}) {
  const base = `px-4 py-3 font-medium text-slate-600 ${alignClass(align)} ${className}`;
  if (!sorting || !sortKey) return <th className={base}>{label}</th>;

  const active = sorting.sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sorting.sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className={base} aria-sort={active ? (sorting.sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      <button
        type="button"
        onClick={() => sorting.setSort(nextSort(sorting.sort, sortKey, sortType, sorting.defaultSort))}
        // A number column's label stays flush with its figures: the arrow goes before it.
        className={`inline-flex items-center gap-1 -mx-1 px-1 py-0.5 rounded font-medium hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
          ${align === 'right' ? 'flex-row-reverse' : ''} ${active ? 'text-slate-900' : ''}`}
      >
        {label}
        <Icon size={13} aria-hidden className={`shrink-0 ${active ? 'text-blue-600' : 'text-slate-300'}`} />
      </button>
    </th>
  );
}

/**
 * The phone's sort control: card lists have no header row, so each sortable
 * column becomes two choices here ("Date: newest first", "Date: oldest first").
 */
export function SortSelect({ options, sorting, className = '' }: { options: SortOption[]; sorting: Sorting; className?: string }) {
  const { t } = useTranslation('common');
  if (options.length === 0) return null;

  const value = `${sorting.sort.key}:${sorting.sort.dir}`;
  const choices = options.flatMap(o => {
    const first = firstDir(o.type);
    return [first, flip(first)].map(dir => ({
      value: `${o.key}:${dir}`,
      label: `${o.label}: ${t(`table.sort.${o.type ?? 'text'}_${dir}`)}`,
    }));
  });
  // The list's own order, when no column gives it, stays a choice to come back to.
  const own = sorting.defaultSort?.key === '' ? `:${sorting.defaultSort.dir}` : null;
  const fallback = own ?? (choices.some(c => c.value === value) ? null : value);

  return (
    <label className={`flex items-center gap-2 text-sm text-slate-500 ${className}`}>
      <ArrowUpDown size={15} aria-hidden className="shrink-0" />
      <span className="shrink-0">{t('table.sort.label')}</span>
      <select
        value={value}
        onChange={e => {
          const [key, dir] = e.target.value.split(':');
          sorting.setSort({ key, dir: dir === 'asc' ? 'asc' : 'desc' });
        }}
        className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {fallback && <option value={fallback}>{t('table.sort.default')}</option>}
        {choices.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
    </label>
  );
}

/** The serial-number header ("#" / "ক্র."). */
export function SerialHeader({ className = '' }: { className?: string }) {
  const { t } = useTranslation('common');
  return (
    <th scope="col" className={`w-12 px-4 py-3 font-medium text-slate-600 text-start ${className}`}>
      <abbr title={t('table.serial_full')} className="no-underline">{t('table.serial')}</abbr>
    </th>
  );
}

/**
 * A row's place in the whole list — it carries on across pages (page 2 of 15
 * starts at 16) and follows the order on screen. It is not a record number:
 * sorting or filtering renumbers the rows.
 */
export function SerialCell({ index, page = 1, perPage = 15, className = '' }: { index: number; page?: number; perPage?: number; className?: string }) {
  return <td className={`px-4 py-3 text-xs text-slate-400 tabular-nums ${className}`}>{fmtNum((page - 1) * perPage + index + 1)}</td>;
}

/**
 * The pager under a list: which rows are showing ("16–30 of 145"), the page,
 * and previous / next. Without `perPage` it falls back to the page and total.
 */
export function TablePagination({ page, lastPage, total, perPage, onPageChange, className = 'px-4 py-3 border-t border-slate-100' }: {
  page: number;
  lastPage: number;
  total?: number;
  perPage?: number;
  onPageChange: (page: number) => void;
  /** Spacing and border — the default sits at the foot of a table card. */
  className?: string;
}) {
  const { t } = useTranslation('common');
  const range = total !== undefined && perPage
    ? t('pagination.range', { from: total === 0 ? 0 : (page - 1) * perPage + 1, to: Math.min(page * perPage, total), total })
    : total !== undefined ? t('pagination.total_count', { count: total }) : null;

  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 text-sm ${className}`}>
      <span className="text-slate-500">
        {range && <>{range} &bull; </>}
        {t('pagination.page_of', { current: page, total: lastPage })}
      </span>
      <div className="flex gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}
          className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40">
          {t('btn.prev')}
        </button>
        <button type="button" disabled={page >= lastPage} onClick={() => onPageChange(page + 1)}
          className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40">
          {t('btn.next')}
        </button>
      </div>
    </div>
  );
}
