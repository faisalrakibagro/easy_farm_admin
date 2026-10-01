'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Layers, Pill, ShoppingCart, Syringe } from 'lucide-react';
import api from '@/lib/api';
import StockOverview from '@/components/stock/StockOverview';
import type { StockSummaryRow } from '@/components/stock/StockSummaryList';
import type { MedicineBatchSummary } from '@/types';

/** Medicine overview — the same page as the feed overview, with medicine's data. */
export default function MedicineOverviewPage() {
  const { t } = useTranslation(['medicine', 'layout']);
  const { data: rows, isLoading, isError, refetch } = useQuery({
    queryKey: ['medicine-stock-summary'],
    queryFn: async () => (await api.get('/farm/medicine/stock-summary')).data.stocks as StockSummaryRow[],
  });
  const { data: batches } = useQuery({
    queryKey: ['medicine-batches', 'summary'],
    queryFn: async () => (await api.get('/farm/medicine-purchases/batches', { params: { per_page: 1 } })).data.summary as MedicineBatchSummary,
  });

  return (
    <StockOverview
      ns="medicine" nameKey="col.medicine"
      title={t('overview.title')} hint={t('overview.hint')}
      listTitle={t('overview.current_stock')} emptyText={t('overview.no_stock')}
      rows={rows} isLoading={isLoading} isError={isError} onRetry={() => refetch()}
      batches={batches}
      shortcuts={[
        { href: '/farm/medicine/inventory', label: t('layout:menu.medicine-inventory'), icon: Pill, tone: 'bg-blue-50 text-blue-600' },
        { href: '/farm/medicine/purchases', label: t('layout:menu.medicine-purchases'), icon: ShoppingCart, tone: 'bg-amber-50 text-amber-600' },
        { href: '/farm/medicine/batches', label: t('layout:menu.medicine-batches'), icon: Layers, tone: 'bg-sky-50 text-sky-600' },
        { href: '/farm/medicine/usage', label: t('layout:menu.medicine-usage'), icon: Syringe, tone: 'bg-rose-50 text-rose-600' },
      ]}
      batchesHref={row => `/farm/medicine/batches?medicine_id=${row.id}`} batchesLabel={t('batches.view_batches')}
    />
  );
}
