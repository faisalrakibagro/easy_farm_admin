'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Shed } from '@/types';
import { Building2 } from 'lucide-react';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';

type TrashedShed = Shed & { deleted_at: string | null };

export default function ShedsTrashPage() {
  const { t } = useTranslation('common');
  const { hasRole } = useAuth();

  const canDelete = hasRole('Super Admin');

  const columns: TrashColumn<TrashedShed>[] = [
    {
      key: 'name',
      header: t('field.name'),
      primary: true,
      render: (item) => <p className="font-medium text-slate-600">{item.name}</p>,
    },
    {
      key: 'capacity',
      header: t('sheds_trash.col.capacity'),
      render: (item) => item.capacity ?? '—',
    },
    {
      key: 'deleted_at',
      header: t('deleted_at'),
      className: 'text-xs text-slate-400',
      render: (item) => (item.deleted_at ? new Date(item.deleted_at).toLocaleString(localeFor()) : '—'),
    },
  ];

  return (
    <TrashView<TrashedShed>
      title={t('sheds_trash.page_title')}
      subtitle={(total) => `${total} ${t('sheds_trash.deleted_count')}`}
      backHref="/farm/master-data/sheds"
      backLabel={t('sheds_trash.back_link')}
      headerIcon={Building2}
      warningText={`${t('sheds_trash.warning')}${canDelete ? ` ${t('sheds_trash.warning_superadmin')}` : ''}`}
      apiBasePath="/farm/sheds"
      queryKey="sheds-trash"
      invalidateOnRestore={['sheds', 'sheds-all']}
      invalidateOnForceDelete={['sheds', 'sheds-all']}
      columns={columns}
      canRestore
      canForceDelete={canDelete}
      emptyIcon={Building2}
      emptyDescription={t('sheds_trash.no_deleted')}
      labels={{
        searchPlaceholder: t('sheds_trash.search_placeholder'),
      }}
    />
  );
}
