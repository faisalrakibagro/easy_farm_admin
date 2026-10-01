'use client';

import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronRight, Layers } from 'lucide-react';
import Link from '@/components/ui/AppLink';
import LoadError from '@/components/ui/LoadError';
import { fmtNum } from '@/lib/format';

export interface StockSummaryRow {
  id: number;
  name: string;
  category: string;
  unit: string;
  total_purchased: number;
  total_used: number;
  total_remaining: number;
  low_stock_alert: number;
  is_low: boolean;
}

interface Props {
  /** Locale namespace with the `col.*` labels ('feed' or 'medicine'). */
  ns: 'feed' | 'medicine';
  /** Key of the name column's label in `ns` (col.feed_item / col.medicine). */
  nameKey: string;
  title: string;
  emptyText: string;
  rows?: StockSummaryRow[];
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  /** Each row links to its batch stock, filtered to that item. */
  batchesHref: (row: StockSummaryRow) => string;
  batchesLabel: string;
  page?: number;
  lastPage?: number;
  onPageChange?: (page: number) => void;
}

/**
 * "Current stock" on the feed and medicine overviews: one row per item with
 * bought / used / left and the low-stock alert. Each row opens that item's
 * batch stock, where the stock is split by purchase, supplier and price.
 */
export default function StockSummaryList({
  ns, nameKey, title, emptyText, rows, isLoading, isError, onRetry, batchesHref, batchesLabel, page, lastPage, onPageChange,
}: Props) {
  const { t } = useTranslation([ns, 'common']);
  const status = (low: boolean) => (low ? (
    <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded-full">
      <AlertTriangle size={11} /> {t('common:status.low')}
    </span>
  ) : (
    <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">{t('common:status.ok')}</span>
  ));
  const qty = (n: number, unit: string) => `${fmtNum(n)} ${unit}`;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 sm:px-5 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-700">{title}</h2>
      </div>

      {isError && !rows?.length ? (
        <LoadError onRetry={onRetry} />
      ) : (
        <>
          {/* Phones: one card per item */}
          <div className="sm:hidden divide-y divide-slate-100">
            {isLoading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="p-4 space-y-2 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-1/2" />
                  <div className="h-3 bg-slate-100 rounded w-2/3" />
                </div>
              ))
            ) : !rows?.length ? (
              <div className="p-8 text-center text-slate-400 text-sm">{emptyText}</div>
            ) : rows.map(s => (
              <div key={s.id} className={`p-4 ${s.is_low ? 'bg-red-50/30' : ''}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-800 break-words">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.category}</p>
                  </div>
                  <div className="shrink-0">{status(s.is_low)}</div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div><span className="text-slate-400">{t('col.remaining')}: </span><span className="text-slate-800 font-semibold">{qty(s.total_remaining, s.unit)}</span></div>
                  <div><span className="text-slate-400">{t('col.purchased')}: </span><span className="text-slate-600">{qty(s.total_purchased, s.unit)}</span></div>
                  <div><span className="text-slate-400">{t('col.used')}: </span><span className="text-slate-600">{qty(s.total_used, s.unit)}</span></div>
                  <div><span className="text-slate-400">{t('col.alert')}: </span><span className="text-slate-500">{qty(s.low_stock_alert, s.unit)}</span></div>
                </div>
                <Link href={batchesHref(s)}
                  className="mt-2 -mb-1 inline-flex items-center gap-1 min-h-10 text-sm font-medium text-blue-600">
                  <Layers size={14} /> {batchesLabel} <ChevronRight size={14} className="rtl:rotate-180" />
                </Link>
              </div>
            ))}
          </div>

          {/* Larger screens: a table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-start px-4 py-3 font-medium text-slate-600">{t(nameKey)}</th>
                  <th className="text-start px-4 py-3 font-medium text-slate-600">{t('col.category')}</th>
                  <th className="text-end px-4 py-3 font-medium text-slate-600">{t('col.purchased')}</th>
                  <th className="text-end px-4 py-3 font-medium text-slate-600">{t('col.used')}</th>
                  <th className="text-end px-4 py-3 font-medium text-slate-600">{t('col.remaining')}</th>
                  <th className="text-end px-4 py-3 font-medium text-slate-600">{t('col.alert')}</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">{t('col.status')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                    ))}</tr>
                  ))
                ) : !rows?.length ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">{emptyText}</td></tr>
                ) : rows.map(s => (
                  <tr key={s.id} className={s.is_low ? 'bg-red-50/30' : ''}>
                    <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                    <td className="px-4 py-3 text-slate-500">{s.category}</td>
                    <td className="px-4 py-3 text-end text-slate-600">{qty(s.total_purchased, s.unit)}</td>
                    <td className="px-4 py-3 text-end text-slate-600">{qty(s.total_used, s.unit)}</td>
                    <td className="px-4 py-3 text-end font-semibold text-slate-800">{qty(s.total_remaining, s.unit)}</td>
                    <td className="px-4 py-3 text-end text-slate-500">{qty(s.low_stock_alert, s.unit)}</td>
                    <td className="px-4 py-3 text-center">{status(s.is_low)}</td>
                    <td className="px-4 py-3 text-end">
                      <Link href={batchesHref(s)} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline whitespace-nowrap">
                        <Layers size={13} /> {batchesLabel}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {page !== undefined && lastPage !== undefined && onPageChange && lastPage > 1 && (
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-2 text-sm">
          <span className="text-slate-500">{t('common:pagination.page_of', { current: page, total: lastPage })}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40">{t('common:btn.prev')}</button>
            <button disabled={page >= lastPage} onClick={() => onPageChange(page + 1)} className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40">{t('common:btn.next')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
