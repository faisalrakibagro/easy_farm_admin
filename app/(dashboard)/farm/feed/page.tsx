'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Layers, ShoppingCart, Utensils, Wheat } from 'lucide-react';
import api from '@/lib/api';
import StockOverview from '@/components/stock/StockOverview';
import type { StockSummaryRow } from '@/components/stock/StockSummaryList';
import type { FeedLotSummary } from '@/types';

/** Feed overview — the same page as the medicine overview, with feed's data. */
export default function FeedOverviewPage() {
  const { t } = useTranslation(['feed', 'layout']);
  // Every item at once (the list is searched here, not paged).
  const { data: rows, isLoading, isError, refetch } = useQuery({
    queryKey: ['feed-stock-summary', 'all'],
    queryFn: async () => (await api.get('/farm/feed/items/stock-summary', { params: { per_page: 1000 } })).data.stocks as StockSummaryRow[],
  });
  const { data: lots } = useQuery({
    queryKey: ['feed-lots', 'summary'],
    queryFn: async () => (await api.get('/farm/feed/lots', { params: { per_page: 1 } })).data.summary as FeedLotSummary,
  });

  return (
    <StockOverview
      ns="feed" nameKey="col.feed_item"
      title={t('overview.title')} hint={t('overview.hint')}
      listTitle={t('overview.current_stock')} emptyText={t('overview.no_stock')}
      rows={rows} isLoading={isLoading} isError={isError} onRetry={() => refetch()}
      batches={lots}
      shortcuts={[
        { href: '/farm/feed/items', label: t('layout:menu.feed-items'), icon: Wheat, tone: 'bg-lime-50 text-lime-600' },
        { href: '/farm/feed/purchases', label: t('layout:menu.feed-purchases'), icon: ShoppingCart, tone: 'bg-amber-50 text-amber-600' },
        { href: '/farm/feed/lots', label: t('layout:menu.feed-lots'), icon: Layers, tone: 'bg-sky-50 text-sky-600' },
        { href: '/farm/feed/daily', label: t('layout:menu.feed-daily'), icon: Utensils, tone: 'bg-emerald-50 text-emerald-600' },
      ]}
      batchesHref={row => `/farm/feed/lots?feed_item_id=${row.id}`} batchesLabel={t('lots.view_batches')}
    />
  );
}
