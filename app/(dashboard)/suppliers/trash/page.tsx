'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Supplier } from '@/types';
import { Truck } from 'lucide-react';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';

export default function SuppliersTrashPage() {
  const { t } = useTranslation('common');
  const { t: tf } = useTranslation('finance');
  const { hasRole } = useAuth();

  const canForceDelete = hasRole('Super Admin');

  const columns: TrashColumn<Supplier>[] = [
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
    { key: 'phone', header: t('field.phone'), render: (item) => item.phone || '—' },
    { key: 'email', header: tf('suppliers_trash.col_email'), render: (item) => item.email || '—' },
    {
      key: 'deleted_at',
      header: t('deleted_at'),
      className: 'text-xs text-slate-400',
      render: (item) => (item.deleted_at ? new Date(item.deleted_at).toLocaleString(localeFor()) : '—'),
    },
  ];

  return (
    <TrashView<Supplier>
      title={tf('suppliers_trash.page_title')}
      subtitle={(total) => t('common:trash.deleted_count', { count: total })}
      backHref="/suppliers"
      backLabel={tf('suppliers_trash.back_link')}
      headerIcon={Truck}
      warningText={`${tf('suppliers_trash.warning')}${canForceDelete ? ` ${tf('suppliers_trash.warning_superadmin')}` : ''}`}
      apiBasePath="/suppliers"
      queryKey="suppliers-trash"
      invalidateOnRestore={['suppliers', 'suppliers-all']}
      invalidateOnForceDelete={['suppliers', 'suppliers-all']}
      money
      columns={columns}
      canRestore
      canForceDelete={canForceDelete}
      emptyIcon={Truck}
      emptyDescription={tf('suppliers_trash.no_deleted')}
      labels={{
        searchPlaceholder: tf('suppliers_trash.search_placeholder'),
      }}
    />
  );
}
