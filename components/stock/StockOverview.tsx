'use client';

import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Link from '@/components/ui/AppLink';
import StockSummaryList, { type StockSummaryRow } from '@/components/stock/StockSummaryList';
import { BatchStatCards } from '@/components/stock/BatchParts';
import { fmtMoney, fmtNum } from '@/lib/format';

export interface StockShortcut { href: string; label: string; icon: LucideIcon; tone: string }

interface Props {
  /** Locale namespace with the list's `col.*` labels. */
  ns: 'feed' | 'medicine';
  /** Label key of the list's name column (col.feed_item / col.medicine). */
  nameKey: string;
  title: string;
  hint: string;
  listTitle: string;
  emptyText: string;
  rows?: StockSummaryRow[];
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  /** From the batch stock list: batches still holding stock, and what is left is worth. */
  batches?: { in_stock: number; remaining_value: number };
  shortcuts: StockShortcut[];
  batchesHref: (row: StockSummaryRow) => string;
  batchesLabel: string;
}

/**
 * The feed and medicine overviews, built once so both look and work the same:
 * totals, shortcuts to the section's pages, then every item's current stock
 * (searchable), each opening its batch stock.
 */
export default function StockOverview({
  ns, nameKey, title, hint, listTitle, emptyText, rows, isLoading, isError, onRetry, batches, shortcuts, batchesHref, batchesLabel,
}: Props) {
  const { t } = useTranslation('common');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = q ? rows?.filter(r => r.name.toLowerCase().includes(q)) : rows;
  const loaded = !isLoading && !!rows;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">{title}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{hint}</p>
      </div>

      <BatchStatCards items={[
        { label: t('stock.total_items'), value: loaded ? fmtNum(rows.length) : '…' },
        { label: t('stock.low_items'), value: loaded ? fmtNum(rows.filter(r => r.is_low).length) : '…', tone: 'red' },
        { label: t('stock.batches_in_stock'), value: batches ? fmtNum(batches.in_stock) : '…', tone: 'green' },
        { label: t('stock.remaining_value'), value: batches ? fmtMoney(batches.remaining_value) : '…', tone: 'blue' },
      ]} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {shortcuts.map(({ href, label, icon: Icon, tone }) => (
          <Link key={href} href={href}
            className="flex items-center gap-2.5 min-w-0 rounded-xl border border-slate-200 bg-white p-3 hover:border-blue-300 hover:shadow-sm transition-all">
            <span className={`grid place-items-center w-9 h-9 shrink-0 rounded-lg ${tone}`}><Icon size={18} /></span>
            <span className="text-sm font-semibold text-slate-700 break-words">{label}</span>
          </Link>
        ))}
      </div>

      <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:ring-2 focus-within:ring-blue-500">
        <Search size={16} className="shrink-0 text-slate-400" />
        <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('stock.search')}
          aria-label={t('stock.search')}
          className="w-full min-w-0 bg-transparent py-2.5 text-base sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none" />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label={t('ui.close')}
            className="grid place-items-center w-8 h-8 -me-1 shrink-0 rounded-lg text-slate-400 hover:text-slate-600">
            <X size={15} />
          </button>
        )}
      </label>

      <StockSummaryList
        ns={ns} nameKey={nameKey} title={listTitle}
        emptyText={q ? t('stock.no_match') : emptyText}
        rows={shown} isLoading={isLoading} isError={isError} onRetry={onRetry}
        batchesHref={batchesHref} batchesLabel={batchesLabel}
      />
    </div>
  );
}
