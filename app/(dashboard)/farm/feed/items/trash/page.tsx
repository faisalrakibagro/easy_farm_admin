'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { FEED_STOCK_KEYS } from '@/lib/invalidateGroups';
import { Package } from 'lucide-react';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';

interface TrashedFeedItem {
  id: number;
  name: string;
  category_id: number;
  unit_id: number;
  low_stock_alert: string;
  description: string | null;
  category?: { id: number; name: string } | null;
  unit?: { id: number; name: string; symbol: string } | null;
  created_at: string;
  deleted_at: string;
}

export default function FeedItemsTrashPage() {
  const { t } = useTranslation('common');
  const { t: tf } = useTranslation('feed');
  const { hasRole } = useAuth();
  const canForceDelete = hasRole('Super Admin');

  const columns: TrashColumn<TrashedFeedItem>[] = [
    {
      key: 'item_name',
      header: tf('items.trash.col.item_name'),
      primary: true,
      className: 'font-medium text-slate-700',
      render: (item) => item.name,
    },
    {
      key: 'category',
      header: tf('items.trash.col.category'),
      render: (item) =>
        item.category ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            {item.category.name}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: 'unit',
      header: tf('items.trash.col.unit'),
      render: (item) =>
        item.unit ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono bg-slate-100 text-slate-600">
            {item.unit.symbol}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: 'deleted_at',
      header: t('deleted_at'),
      className: 'text-xs text-slate-400',
      render: (item) => new Date(item.deleted_at).toLocaleString(localeFor()),
    },
  ];

  return (
    <TrashView<TrashedFeedItem>
      title={tf('items.trash.page_title')}
      subtitle={(total) => t('common:trash.deleted_count', { count: total })}
      backHref="/farm/feed/items"
      backLabel={tf('items.trash.back_link')}
      headerIcon={Package}
      warningText={tf('items.trash.warning')}
      apiBasePath="/farm/feed/items"
      queryKey="feed-items-trash"
      invalidateOnRestore={[...FEED_STOCK_KEYS]}
      invalidateOnForceDelete={[...FEED_STOCK_KEYS]}
      columns={columns}
      canRestore
      canForceDelete={canForceDelete}
      emptyIcon={Package}
      emptyDescription={tf('items.trash.empty_desc')}
      labels={{
        searchPlaceholder: tf('items.trash.search_placeholder'),
      }}
    />
  );
}
