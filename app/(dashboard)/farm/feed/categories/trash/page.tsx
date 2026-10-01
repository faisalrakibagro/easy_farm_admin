'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { FeedCategory } from '@/types';
import { Trash2, Tag } from 'lucide-react';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';

type TrashedFeedCategory = FeedCategory & { deleted_at: string | null };

export default function FeedCategoriesTrashPage() {
  const { t } = useTranslation('common');
  const { t: tf } = useTranslation('feed');
  const { hasRole } = useAuth();
  const canDelete = hasRole('Super Admin');

  const columns: TrashColumn<TrashedFeedCategory>[] = [
    {
      key: 'name',
      header: t('field.name'),
      primary: true,
      render: (item) => (
        <div className="flex items-center gap-2">
          <Tag size={14} className="text-slate-400 flex-shrink-0" />
          <span className="font-medium text-slate-600">{item.name}</span>
        </div>
      ),
    },
    {
      key: 'deleted_at',
      header: t('deleted_at'),
      className: 'text-xs text-slate-400',
      render: (item) => (item.deleted_at ? new Date(item.deleted_at).toLocaleString(localeFor()) : '—'),
    },
  ];

  return (
    <TrashView<TrashedFeedCategory>
      title={tf('categories.trash.page_title')}
      subtitle={(total) => t('common:trash.deleted_count', { count: total })}
      backHref="/farm/feed/categories"
      backLabel={tf('categories.trash.back_link')}
      headerIcon={Trash2}
      warningText={tf('categories.trash.warning')}
      apiBasePath="/farm/feed/categories"
      queryKey="feed-categories-trash"
      invalidateOnRestore={['feed-categories', 'feed-categories-all']}
      invalidateOnForceDelete={['feed-categories', 'feed-categories-all']}
      columns={columns}
      canRestore
      canForceDelete={canDelete}
      emptyIcon={Tag}
      emptyDescription={tf('categories.trash.empty_desc')}
      labels={{
        searchPlaceholder: tf('categories.trash.search_placeholder'),
      }}
    />
  );
}
