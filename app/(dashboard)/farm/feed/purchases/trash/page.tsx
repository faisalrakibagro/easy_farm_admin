'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { FEED_STOCK_KEYS } from '@/lib/invalidateGroups';
import { FeedPurchase } from '@/types';
import { Trash2 } from 'lucide-react';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';
import { fmtMoney } from '@/lib/format';

interface FeedPurchaseTrashed extends FeedPurchase {
  supplier?: { id: number; name: string } | null;
  payment_account?: { id: number; name: string } | null;
  deleted_at: string;
}

const getSupplierName = (p: FeedPurchaseTrashed) => p.supplier?.name ?? p.supplier_name ?? '—';

export default function FeedPurchasesTrashPage() {
  const { t } = useTranslation(['feed', 'common']);
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');

  const columns: TrashColumn<FeedPurchaseTrashed>[] = [
    { key: 'date', header: t('purchases.col.date'), render: (p) => new Date(p.purchase_date).toLocaleDateString(localeFor()) },
    { key: 'supplier', header: t('purchases.col.supplier'), primary: true, render: (p) => getSupplierName(p) },
    { key: 'invoice', header: t('purchases.col.invoice'), render: (p) => p.invoice_no || '—' },
    {
      key: 'total_cost',
      header: t('purchases.col.total_cost'),
      align: 'right',
      className: 'font-medium text-slate-700',
      render: (p) => fmtMoney(p.total_cost),
    },
    {
      key: 'deleted_at',
      header: t('purchases.trash.col.deleted_at'),
      className: 'text-xs text-slate-400',
      render: (p) => (p.deleted_at ? new Date(p.deleted_at).toLocaleString(localeFor()) : '—'),
    },
  ];

  return (
    <TrashView<FeedPurchaseTrashed>
      title={t('purchases.trash.title')}
      subtitle={(total) => t('purchases.trash.count', { count: total })}
      backHref="/farm/feed/purchases"
      backLabel={t('purchases.trash.back')}
      headerIcon={Trash2}
      warningText={t('purchases.trash.warning')}
      apiBasePath="/farm/feed/purchases"
      queryKey="feed-purchases-trash"
      invalidateOnRestore={[...FEED_STOCK_KEYS, 'feed-purchases']}
      invalidateOnForceDelete={[...FEED_STOCK_KEYS, 'feed-purchases']}
      money
      columns={columns}
      canRestore
      canForceDelete={isSuperAdmin}
      emptyIcon={Trash2}
      emptyTitle={t('purchases.trash.empty')}
      emptyDescription={t('purchases.trash.empty_desc')}
      labels={{
        restore: t('purchases.trash.btn.restore'),
        forceDelete: t('purchases.trash.btn.force_delete'),
        searchPlaceholder: t('purchases.trash.search_placeholder'),
      }}
    />
  );
}
