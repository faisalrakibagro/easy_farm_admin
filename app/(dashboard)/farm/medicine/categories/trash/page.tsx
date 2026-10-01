'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Tag, Trash2 } from 'lucide-react';
import type { MedicineCategory } from '@/types';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';

type MedicineCategoryTrashed = MedicineCategory & { deleted_at: string | null };

export default function MedicineCategoriesTrashPage() {
  const { t } = useTranslation('common');
  const { t: tm } = useTranslation('medicine');
  const { hasRole } = useAuth();

  const canDelete = hasRole('Super Admin');

  const columns: TrashColumn<MedicineCategoryTrashed>[] = [
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
    <TrashView<MedicineCategoryTrashed>
      title={tm('categories.trash.page_title')}
      subtitle={(total) => t('common:trash.deleted_count', { count: total })}
      backHref="/farm/medicine/categories"
      backLabel={tm('categories.trash.back_link')}
      headerIcon={Tag}
      warningText={tm('categories.trash.warning')}
      apiBasePath="/farm/medicine/categories"
      queryKey="medicine-categories-trash"
      invalidateOnRestore={['medicine-categories']}
      invalidateOnForceDelete={['medicine-categories']}
      columns={columns}
      canRestore={canDelete}
      canForceDelete={canDelete}
      emptyIcon={Trash2}
      emptyDescription={tm('categories.trash.empty_desc')}
      labels={{
        searchPlaceholder: tm('categories.trash.search_placeholder'),
      }}
    />
  );
}
