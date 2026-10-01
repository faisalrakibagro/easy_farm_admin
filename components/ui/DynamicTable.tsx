'use client';

import { useTranslation } from 'react-i18next';
import type { ColDef } from '@/lib/schemas/types';
import LoadError from '@/components/ui/LoadError';
import { SerialCell, SerialHeader, SortHeader, SortSelect, TablePagination, type Sorting } from '@/components/ui/TableControls';

interface DynamicTableProps<T> {
  cols: ColDef<T>[];
  data: T[];
  isLoading?: boolean;
  /** The request failed: show "couldn't load" with a retry instead of "no data". */
  isError?: boolean;
  onRetry?: () => void;
  skeletonRows?: number;
  keyExtractor: (item: T) => string | number;
  rowClassName?: (item: T) => string;
  emptyKey?: string;
  currentPage?: number;
  lastPage?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  /** Rows per page — numbers the rows across pages and shows "16–30 of 145". */
  perPage?: number;
  /** Sort state from `useTableSort`; columns with a `sortKey` become sortable. */
  sorting?: Sorting;
  /** A "#" column numbering the rows (desktop table only; phone cards stay compact). */
  serial?: boolean;
}

const tdClass = (align?: string) =>
  `px-4 py-3 ${align === 'right' ? 'text-end' : align === 'center' ? 'text-center' : ''}`;

export default function DynamicTable<T>({
  cols,
  data,
  isLoading = false,
  isError = false,
  onRetry,
  skeletonRows = 6,
  keyExtractor,
  rowClassName,
  emptyKey = 'common:table.no_data',
  currentPage,
  lastPage,
  totalCount,
  onPageChange,
  perPage,
  sorting,
  serial = false,
}: DynamicTableProps<T>) {
  const { t } = useTranslation();
  const sortOptions = sorting
    ? cols.filter(c => c.sortKey).map(c => ({ key: c.sortKey!, label: t(c.labelKey), type: c.sortType }))
    : [];
  const colCount = cols.length + (serial ? 1 : 0);

  const showPagination =
    currentPage !== undefined &&
    lastPage !== undefined &&
    onPageChange !== undefined &&
    data.length > 0;

  // A failed load with nothing to show replaces both views; stale rows that
  // are already on screen stay (a background refetch failed).
  if (isError && !isLoading && data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200">
        <LoadError onRetry={onRetry} />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">

      {sorting && sortOptions.length > 0 && (
        <SortSelect options={sortOptions} sorting={sorting} className="sm:hidden px-4 py-2.5 border-b border-slate-100" />
      )}

      {/* ── Mobile: Card View (hidden on sm+) ── */}
      <div className="block sm:hidden divide-y divide-slate-100">
        {isLoading ? (
          Array.from({ length: skeletonRows }).map((_, i) => (
            <div key={i} className="p-4 space-y-2">
              <div className="h-4 bg-slate-100 rounded animate-pulse w-1/2" />
              <div className="h-3 bg-slate-100 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-slate-100 rounded animate-pulse w-2/3" />
            </div>
          ))
        ) : data.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-400 text-sm">
            {t(emptyKey)}
          </div>
        ) : (
          data.map(item => (
            <div
              key={keyExtractor(item)}
              className={`p-4 hover:bg-slate-50 ${rowClassName?.(item) ?? ''}`}
            >
              {cols.map((col, idx) => {
                const value = col.render
                  ? col.render(item)
                  : String((item as Record<string, unknown>)[col.key] ?? '');
                const isLast = idx === cols.length - 1;
                return (
                  <div
                    key={col.key}
                    className={`flex items-start justify-between gap-2 text-sm ${isLast ? '' : 'mb-2'}`}
                  >
                    {!isLast && (
                      <span className="text-xs font-medium text-slate-500 shrink-0 mt-0.5 min-w-[80px]">
                        {t(col.labelKey)}
                      </span>
                    )}
                    <span className={`${col.align === 'right' || isLast ? 'ms-auto' : ''} min-w-0 text-end break-words`}>
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* ── Desktop: Table View (hidden on mobile) ── */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {serial && <SerialHeader />}
              {cols.map(col => (
                <SortHeader key={col.key} label={col.labelKey ? t(col.labelKey) : ''} align={col.align}
                  sortKey={col.sortKey} sortType={col.sortType} sorting={sorting} />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: colCount }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-slate-400 text-sm">
                  {t(emptyKey)}
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <tr
                  key={keyExtractor(item)}
                  className={`hover:bg-slate-50 ${rowClassName?.(item) ?? ''}`}
                >
                  {serial && <SerialCell index={index} page={currentPage} perPage={perPage} />}
                  {cols.map(col => (
                    <td key={col.key} className={tdClass(col.align)}>
                      {col.render
                        ? col.render(item)
                        : String((item as Record<string, unknown>)[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showPagination && (
        <TablePagination page={currentPage} lastPage={lastPage} total={totalCount} perPage={perPage} onPageChange={onPageChange} />
      )}
    </div>
  );
}
