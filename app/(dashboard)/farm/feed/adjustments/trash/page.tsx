'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { FEED_STOCK_KEYS } from '@/lib/invalidateGroups';
import { Trash2 } from 'lucide-react';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';
import { fmtNum, fmtMoney } from '@/lib/format';

interface TrashedAdjustment {
  id: number;
  feed_item?: { name: string };
  adjustment_type: string;
  quantity: string;
  total_cost: string;
  adjustment_date: string;
  reason?: string | null;
  deleted_at: string;
}

const fmt = (d: string | null | undefined) =>
  d ? new Date(d.split('T')[0] + 'T00:00:00').toLocaleDateString(localeFor()) : '—';

export default function FeedAdjustmentTrashPage() {
  const { t } = useTranslation(['feed', 'common']);
  const { hasPermission, hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');

  const columns: TrashColumn<TrashedAdjustment>[] = [
    { key: 'date', header: t('feed:adjustments.col.date'), render: (a) => fmt(a.adjustment_date) },
    {
      key: 'item',
      header: t('feed:adjustments.col.item'),
      primary: true,
      render: (a) => <span className="font-semibold text-sm text-gray-800">{a.feed_item?.name ?? '—'}</span>,
    },
    {
      key: 'type',
      header: t('feed:adjustments.col.type'),
      render: (a) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          {t(`feed:adjustments.type.${a.adjustment_type}`, a.adjustment_type)}
        </span>
      ),
    },
    {
      key: 'quantity',
      header: t('feed:adjustments.col.quantity'),
      align: 'right',
      className: 'tabular-nums',
      render: (a) => fmtNum(a.quantity, 3),
    },
    {
      key: 'total_cost',
      header: t('feed:adjustments.col.total_cost'),
      align: 'right',
      className: 'tabular-nums text-red-600 font-semibold',
      render: (a) => fmtMoney(a.total_cost),
    },
    {
      key: 'deleted_at',
      header: t('feed:adjustments.trash.col_deleted_at'),
      className: 'text-gray-400',
      render: (a) => fmt(a.deleted_at),
    },
  ];

  return (
    <TrashView<TrashedAdjustment>
      title={t('feed:adjustments.trash.title')}
      subtitle={t('feed:adjustments.trash.subtitle')}
      backHref="/farm/feed/adjustments"
      backLabel={t('feed:adjustments.trash.back')}
      warningText={t('feed:adjustments.trash.subtitle')}
      apiBasePath="/farm/feed/adjustments"
      queryKey="feed-adjustments-trash"
      invalidateOnRestore={[...FEED_STOCK_KEYS, 'feed-adjustments']}
      invalidateOnForceDelete={[...FEED_STOCK_KEYS, 'feed-adjustments']}
      columns={columns}
      canRestore={hasPermission('farm.feed.delete')}
      canForceDelete={isSuperAdmin}
      restoreMessages={{
        success: t('feed:adjustments.trash.toast.restored'),
        error: t('feed:adjustments.trash.toast.restore_error'),
      }}
      forceDeleteMessages={{
        success: t('feed:adjustments.trash.toast.deleted'),
        error: t('feed:adjustments.trash.toast.delete_error'),
      }}
      emptyIcon={Trash2}
      emptyTitle={t('feed:adjustments.trash.empty')}
      labels={{
        restore: t('feed:adjustments.trash.confirm_restore.label'),
        forceDelete: t('feed:adjustments.trash.confirm_delete.label'),
        actions: '',
        confirmTitle: t('feed:adjustments.trash.confirm_delete.title'),
        confirmMessage: t('feed:adjustments.trash.confirm_delete.message'),
        confirmLabel: t('feed:adjustments.trash.confirm_delete.label'),
        searchPlaceholder: t('common:btn.search'),
      }}
    />
  );
}
