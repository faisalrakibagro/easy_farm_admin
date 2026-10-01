'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CheckCircle, FlaskConical, Wheat } from 'lucide-react';
import api from '@/lib/api';
import DynamicTable from '@/components/ui/DynamicTable';
import { useTableSort } from '@/lib/hooks/useTableSort';
import { BatchSource, BatchStatCards, initialParam } from '@/components/stock/BatchParts';
import type { ColDef } from '@/lib/schemas/types';
import type { FeedItem, FeedLot, FeedLotSummary } from '@/types';
import { fmtDate, fmtMoney, fmtNum } from '@/lib/format';

/**
 * Feed batch stock: every purchase (and every ready mix) is its own batch with
 * its own supplier and price. Feedings take from the oldest batch first, so
 * batches still holding stock are listed first, in that order.
 */
export default function FeedLotsPage() {
  const { t } = useTranslation(['feed', 'common']);
  // The overview links here with ?feed_item_id=… to show one feed's batches.
  const [itemId, setItemId] = useState(() => initialParam('feed_item_id'));
  const [availableOnly, setAvailableOnly] = useState(false);
  const [page, setPage] = useState(1);
  const sorting = useTableSort({ key: '', dir: 'desc' }, setPage);

  const { data, isLoading, isError, refetch } = useQuery<{ lots: FeedLot[]; summary: FeedLotSummary; last_page: number; total: number }>({
    queryKey: ['feed-lots', itemId, availableOnly, page, sorting.params],
    queryFn: async () => (await api.get('/farm/feed/lots', {
      params: { ...sorting.params, feed_item_id: itemId || undefined, available_only: availableOnly ? 1 : undefined, page, per_page: 15 },
    })).data,
  });

  // Same key and shape as the other feed pages, so they share one cache entry.
  const { data: itemsData } = useQuery<{ items: FeedItem[] }>({
    queryKey: ['feed-items-all'],
    queryFn: async () => (await api.get('/farm/feed/items/all')).data,
  });
  const items = itemsData?.items;

  const lots = data?.lots ?? [];
  const summary = data?.summary;
  const unit = (l: FeedLot) => l.feed_item.unit ?? '';
  const empty = (l: FeedLot) => parseFloat(l.remaining_quantity) <= 0;

  const cols: ColDef<FeedLot>[] = [
    {
      key: 'item', labelKey: 'feed:lots.col.item', align: 'left',
      render: l => (
        <div className="flex items-center gap-2">
          {l.source === 'mix' ? <FlaskConical size={13} className="text-violet-400 shrink-0" /> : <Wheat size={13} className="text-lime-500 shrink-0" />}
          <span className="font-medium text-slate-800">{l.feed_item.name}</span>
        </div>
      ),
    },
    {
      key: 'source', labelKey: 'feed:lots.col.source', align: 'left',
      render: l => (
        <BatchSource name={l.supplier_name}
          invoice={l.invoice_no ? t('lots.invoice', { no: l.invoice_no }) : null}
          fallback={l.source === 'mix' ? t('lots.source_mix', { id: l.mix_batch_id }) : t('lots.source_other')} />
      ),
    },
    { key: 'date', labelKey: 'feed:lots.col.date', align: 'left', sortKey: 'date', sortType: 'date', render: l => <span className="text-slate-500">{l.received_on ? fmtDate(l.received_on) : '—'}</span> },
    { key: 'received', labelKey: 'feed:lots.col.received', align: 'right', render: l => <span className="text-slate-600">{fmtNum(l.total_quantity)} {unit(l)}</span> },
    { key: 'used', labelKey: 'feed:lots.col.used', align: 'right', render: l => <span className="text-slate-500">{fmtNum(l.used_quantity)} {unit(l)}</span> },
    {
      key: 'remaining', labelKey: 'feed:lots.col.remaining', align: 'right', sortKey: 'remaining', sortType: 'number',
      render: l => <span className={`font-semibold ${empty(l) ? 'text-slate-400' : 'text-slate-700'}`}>{fmtNum(l.remaining_quantity)} {unit(l)}</span>,
    },
    { key: 'unit_price', labelKey: 'feed:lots.col.unit_price', align: 'right', sortKey: 'unit_price', sortType: 'number', render: l => <span className="text-slate-600">{fmtMoney(l.unit_price)}</span> },
    { key: 'remaining_value', labelKey: 'feed:lots.col.remaining_value', align: 'right', sortKey: 'value', sortType: 'number', render: l => <span className="text-slate-700">{fmtMoney(l.remaining_value)}</span> },
    {
      key: 'status', labelKey: 'feed:lots.col.status', align: 'left',
      render: l => empty(l)
        ? <span className="text-xs text-slate-400">{t('common:ui.empty')}</span>
        : <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle size={11} /> {t('common:ui.available')}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">{t('lots.title')}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{t('lots.hint')}</p>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <select value={itemId} onChange={e => { setItemId(e.target.value); setPage(1); }} aria-label={t('lots.all_items')}
          className="min-w-0 flex-1 sm:flex-none border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">{t('lots.all_items')}</option>
          {(items ?? []).map(i => <option key={i.id} value={String(i.id)}>{i.name}</option>)}
        </select>
        <label className="flex items-center gap-2 min-h-10 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={availableOnly} onChange={e => { setAvailableOnly(e.target.checked); setPage(1); }}
            className="w-4 h-4 rounded border-slate-300" />
          {t('common:ui.available_only')}
        </label>
      </div>

      <BatchStatCards items={[
        { label: t('lots.total'), value: fmtNum(summary?.total ?? 0) },
        { label: t('lots.in_stock'), value: fmtNum(summary?.in_stock ?? 0), tone: 'green' },
        { label: t('lots.remaining_value'), value: fmtMoney(summary?.remaining_value ?? 0), tone: 'blue' },
      ]} />

      <DynamicTable
        cols={cols}
        sorting={sorting}
        serial
        perPage={15}
        data={lots}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        keyExtractor={l => l.id}
        rowClassName={l => (empty(l) ? 'opacity-70' : '')}
        emptyKey="feed:lots.empty"
        currentPage={page}
        lastPage={data?.last_page ?? 1}
        totalCount={data?.total}
        onPageChange={setPage}
      />
    </div>
  );
}
