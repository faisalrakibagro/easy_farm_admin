'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Dna, Trash2 } from 'lucide-react';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';

interface TrashedBreed {
  id: number;
  name: string;
  is_active: boolean;
  deleted_at: string;
}

export default function BreedsTrashPage() {
  const { t } = useTranslation('common');
  const { hasRole } = useAuth();

  const canDelete = hasRole('Super Admin');

  const columns: TrashColumn<TrashedBreed>[] = [
    {
      key: 'no',
      header: '#',
      className: 'text-xs',
      render: (_breed, index, page) => ((page - 1) * 15 + index + 1),
    },
    {
      key: 'name',
      header: t('breeds_trash.col.name'),
      primary: true,
      render: (breed) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
            <Dna size={14} className="text-red-400" />
          </div>
          <span className="font-medium text-slate-600">{breed.name}</span>
        </div>
      ),
    },
    {
      key: 'deleted_at',
      header: t('breeds_trash.col.deleted_at'),
      className: 'text-xs text-slate-400',
      render: (breed) => new Date(breed.deleted_at).toLocaleString(localeFor()),
    },
  ];

  return (
    <TrashView<TrashedBreed>
      title={t('breeds_trash.page_title')}
      subtitle={(total) => `${total} ${t('breeds_trash.deleted_count')}`}
      backHref="/farm/master-data/breeds"
      backLabel={t('breeds_trash.back_link')}
      warningText={`${t('breeds_trash.warning')}${canDelete ? ` ${t('breeds_trash.warning_superadmin')}` : ''}`}
      apiBasePath="/farm/breeds"
      queryKey="breeds-trash"
      invalidateOnRestore={['breeds-page', 'farm-breeds']}
      invalidateOnForceDelete={['breeds-page', 'farm-breeds']}
      columns={columns}
      canRestore
      canForceDelete={canDelete}
      emptyIcon={Trash2}
      emptyDescription={t('breeds_trash.no_deleted')}
      showTotalCount
      labels={{
        totalCount: (count) => t('pagination.total_count', { count }),
        searchPlaceholder: t('breeds_trash.search_placeholder'),
      }}
    />
  );
}
