'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { FeedFormulation } from '@/types';
import { Trash2, FlaskConical } from 'lucide-react';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';

export default function FeedFormulationsTrashPage() {
  const { t } = useTranslation('common');
  const { t: tf } = useTranslation('feed');
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const canForceDelete = isSuperAdmin;

  const columns: TrashColumn<FeedFormulation>[] = [
    {
      key: 'name',
      header: t('field.name'),
      primary: true,
      render: (item) => (
        <div className="flex items-center gap-2">
          <FlaskConical size={15} className="text-slate-400 flex-shrink-0" />
          <span className="font-medium text-slate-600">{item.name}</span>
        </div>
      ),
    },
    {
      key: 'description',
      header: tf('formulations.trash.col.description'),
      className: 'text-slate-500',
      render: (item) =>
        item.notes ? (
          item.notes.length > 40 ? item.notes.slice(0, 40) + '…' : item.notes
        ) : (
          <span className="text-slate-300">—</span>
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
    <TrashView<FeedFormulation>
      title={tf('formulations.trash.page_title')}
      subtitle={(total) => t('common:trash.deleted_count', { count: total })}
      backHref="/farm/feed/formulations"
      backLabel={tf('formulations.trash.back_link')}
      headerIcon={Trash2}
      warningText={tf('formulations.trash.warning')}
      apiBasePath="/farm/feed/formulations"
      queryKey="feed-formulations-trash"
      invalidateOnRestore={['feed-formulations', 'feed-formulations-list']}
      invalidateOnForceDelete={['feed-formulations', 'feed-formulations-list']}
      columns={columns}
      canRestore
      canForceDelete={canForceDelete}
      emptyIcon={FlaskConical}
      emptyDescription={tf('formulations.trash.empty_desc')}
      labels={{
        searchPlaceholder: tf('formulations.trash.search_placeholder'),
      }}
    />
  );
}
