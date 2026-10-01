'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Partner } from '@/types';
import { Handshake } from 'lucide-react';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';

export default function PartnersTrashPage() {
  const { t } = useTranslation('common');
  const { t: tf } = useTranslation('finance');
  const { hasRole } = useAuth();

  const canDelete = hasRole('Super Admin');

  const columns: TrashColumn<Partner>[] = [
    {
      key: 'name',
      header: t('field.name'),
      primary: true,
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-bold">
            {item.name[0].toUpperCase()}
          </div>
          <p className="font-medium text-slate-600">{item.name}</p>
        </div>
      ),
    },
    {
      key: 'phone',
      header: t('field.phone'),
      className: 'text-slate-500 text-xs',
      render: (item) => item.phone || '—',
    },
    {
      key: 'deleted_at',
      header: t('deleted_at'),
      className: 'text-xs text-slate-400',
      render: (item) => (item.deleted_at ? new Date(item.deleted_at).toLocaleString(localeFor()) : '—'),
    },
  ];

  return (
    <TrashView<Partner>
      title={tf('partners_trash.page_title')}
      subtitle={(total) => t('common:trash.deleted_count', { count: total })}
      backHref="/partners"
      backLabel={tf('partners_trash.back_link')}
      headerIcon={Handshake}
      warningText={`${tf('partners_trash.warning')}${canDelete ? ` ${tf('partners_trash.warning_superadmin')}` : ''}`}
      apiBasePath="/partners"
      queryKey="partners-trash"
      invalidateOnRestore={['partners', 'partner-detail']}
      invalidateOnForceDelete={['partners', 'partner-detail']}
      money
      columns={columns}
      canRestore
      canForceDelete={canDelete}
      emptyIcon={Handshake}
      emptyDescription={tf('partners_trash.no_deleted')}
      labels={{
        searchPlaceholder: tf('partners_trash.search_placeholder'),
      }}
    />
  );
}
