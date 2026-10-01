'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Cattle } from '@/types';
import { animalTypeName } from '@/lib/animalType';
import { Trash2, ImageIcon } from 'lucide-react';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';

export default function CattleTrashPage() {
  const { t } = useTranslation(['cattle', 'common']);
  const { hasPermission } = useAuth();

  const columns: TrashColumn<Cattle>[] = [
    {
      key: 'photo',
      header: t('col.photo'),
      avatar: true,
      render: (c) =>
        c.profile_image_url ? (
          <img
            src={c.profile_image_url}
            alt={c.tag_number}
            loading="lazy"
            className="w-9 h-9 rounded-lg object-cover border border-slate-200 grayscale"
          />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300">
            <ImageIcon size={14} />
          </div>
        ),
    },
    {
      key: 'tag_name',
      header: t('col.tag_name'),
      primary: true,
      render: (c) => (
        <div>
          <p className="font-medium text-slate-600">{c.tag_number}</p>
          {c.name && <p className="text-xs text-slate-400">{c.name}</p>}
        </div>
      ),
    },
    { key: 'type', header: t('col.type'), className: 'text-xs', render: (c) => animalTypeName(c.animal_type) ?? '—' },
    { key: 'breed', header: t('col.breed'), render: (c) => c.breed || '—' },
    {
      key: 'gender',
      header: t('col.gender'),
      render: (c) => (
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.gender === 'male' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}
        >
          {t('gender.' + c.gender)}
        </span>
      ),
    },
    { key: 'shed', header: t('col.shed'), className: 'text-xs', render: (c) => c.shed?.name ?? '—' },
    {
      key: 'deleted_at',
      header: t('trash.col.deleted_at'),
      className: 'text-xs text-slate-400',
      render: (c) => (c.deleted_at ? new Date(c.deleted_at).toLocaleString(localeFor()) : '—'),
    },
  ];

  return (
    <TrashView<Cattle>
      title={t('trash.title')}
      subtitle={(total) => t('trash.count', { count: total })}
      backHref="/farm/cattle"
      backLabel={t('trash.back')}
      headerIcon={Trash2}
      warningText={t('trash.warning')}
      apiBasePath="/farm/cattle"
      queryKey="farm-cattle-trash"
      invalidateOnRestore={['farm-cattle', 'cattle-active']}
      money
      columns={columns}
      canRestore={hasPermission('farm.cattle.delete')}
      canForceDelete={false}
      emptyIcon={Trash2}
      emptyTitle={t('trash.empty_title')}
      emptyDescription={t('trash.empty_desc')}
      labels={{
        restore: t('trash.btn.restore'),
        searchPlaceholder: t('trash.search_placeholder'),
      }}
    />
  );
}
