'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { CATTLE_COST_KEYS, FEED_STOCK_KEYS } from '@/lib/invalidateGroups';
import { Trash2, Utensils } from 'lucide-react';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';
import { fmtMoney } from '@/lib/format';

interface TrashedFeedUsage {
  id: number;
  usage_date: string;
  age_category: string;
  allocation_method: string;
  total_feed_cost: string;
  active_cattle_count: number;
  deleted_at: string | null;
}

const AGE_CATEGORY_COLORS: Record<string, string> = {
  immature: 'bg-cyan-100 text-cyan-700',
  adult: 'bg-amber-100 text-amber-700',
  all: 'bg-slate-100 text-slate-600',
};

export default function DailyFeedingTrashPage() {
  const { t } = useTranslation(['feed', 'common']);
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const canForceDelete = isSuperAdmin;

  const columns: TrashColumn<TrashedFeedUsage>[] = [
    {
      key: 'date',
      header: t('daily.col.date'),
      primary: true,
      render: (item) => <span className="font-medium text-slate-700">{new Date(item.usage_date).toLocaleDateString(localeFor())}</span>,
    },
    {
      key: 'age_category',
      header: t('daily.col.age_category'),
      render: (item) => (
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${AGE_CATEGORY_COLORS[item.age_category ?? 'all'] ?? 'bg-slate-100 text-slate-600'}`}
        >
          {item.age_category ?? 'all'}
        </span>
      ),
    },
    {
      key: 'allocation_method',
      header: t('daily.field.allocation_method'),
      className: 'text-slate-500 capitalize',
      render: (item) => item.allocation_method?.replace('_', ' '),
    },
    {
      key: 'total_cost',
      header: t('daily.col.total_cost'),
      align: 'right',
      className: 'font-medium text-slate-700',
      render: (item) => fmtMoney(item.total_feed_cost),
    },
    {
      key: 'cattle',
      header: t('daily.col.cattle'),
      align: 'center',
      className: 'text-slate-500',
      render: (item) => item.active_cattle_count,
    },
    {
      key: 'deleted_at',
      header: t('daily.trash.col.deleted_at'),
      className: 'text-xs text-slate-400',
      render: (item) => (item.deleted_at ? new Date(item.deleted_at).toLocaleString(localeFor()) : '—'),
    },
  ];

  return (
    <TrashView<TrashedFeedUsage>
      title={t('daily.trash.title')}
      subtitle={(total) => t('daily.trash.count', { count: total })}
      backHref="/farm/feed/daily"
      backLabel={t('daily.trash.back')}
      headerIcon={Utensils}
      warningText={t('daily.trash.warning')}
      apiBasePath="/farm/feed/usages"
      queryKey="feed-usages-trash"
      invalidateOnRestore={[...FEED_STOCK_KEYS, ...CATTLE_COST_KEYS, 'feed-usages', 'farm-cattle']}
      invalidateOnForceDelete={[...FEED_STOCK_KEYS, ...CATTLE_COST_KEYS, 'feed-usages', 'farm-cattle']}
      columns={columns}
      canRestore
      canForceDelete={canForceDelete}
      emptyIcon={Trash2}
      emptyTitle={t('daily.trash.empty')}
      labels={{
        restore: t('daily.trash.btn.restore'),
        forceDelete: t('daily.trash.btn.force_delete'),
        actions: t('common:actions', { defaultValue: 'Actions' }),
        confirmTitle: t('daily.trash.btn.force_delete'),
        confirmMessage: t('daily.trash.warning'),
        confirmLabel: t('daily.trash.btn.force_delete'),
        searchPlaceholder: t('common:btn.search'),
      }}
    />
  );
}
