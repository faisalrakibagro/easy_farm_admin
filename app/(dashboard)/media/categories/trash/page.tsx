'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { MediaCategory } from '@/types';
import { Tag, Trash2 } from 'lucide-react';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';
import { fmtNum } from '@/lib/format';

export default function MediaCategoriesTrashPage() {
  const { t } = useTranslation(['media', 'common']);
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');

  const canForceDelete = isSuperAdmin;

  const columns: TrashColumn<MediaCategory>[] = [
    {
      key: 'category',
      header: t('categories.trash.col.category'),
      primary: true,
      render: (cat) => (
        <div>
          <p className="font-medium text-slate-600">{cat.name}</p>
          {cat.description && (
            <p className="text-xs text-slate-400 truncate max-w-xs">{cat.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'media',
      header: t('categories.trash.col.media'),
      className: 'text-xs text-slate-500',
      render: (cat) => t('categories.trash.files_count', { count: cat.media_count ?? 0, n: fmtNum(cat.media_count ?? 0) }),
    },
    {
      key: 'deleted_at',
      header: t('categories.trash.col.deleted_at'),
      className: 'text-xs text-slate-400',
      render: (cat) => (cat.deleted_at ? new Date(cat.deleted_at).toLocaleString(localeFor()) : '—'),
    },
  ];

  return (
    <TrashView<MediaCategory>
      title={t('common:ui.category_trash')}
      subtitle={(total) => t('common:trash.deleted_count', { count: total })}
      backHref="/media/categories"
      backLabel={t('categories.trash.back_link')}
      headerIcon={Trash2}
      warningText={t('common:ui.media_category_trash_warning') + (canForceDelete ? t('common:ui.media_category_force_warning') : '')}
      apiBasePath="/media/categories"
      queryKey="media-categories-trash"
      invalidateOnRestore={['media-categories']}
      invalidateOnForceDelete={['media-categories']}
      columns={columns}
      canRestore
      canForceDelete={canForceDelete}
      emptyIcon={Tag}
      labels={{
        searchPlaceholder: t('common:ui.search_categories'),
      }}
    />
  );
}
