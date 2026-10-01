'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Customer } from '@/types';
import { Trash2, User } from 'lucide-react';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';

export default function CustomersTrashPage() {
  const { t } = useTranslation('common');
  const { t: tf } = useTranslation('finance');
  const { hasRole } = useAuth();

  const canForceDelete = hasRole('Super Admin');

  const columns: TrashColumn<Customer>[] = [
    {
      key: 'customer',
      header: tf('customers_trash.col_customer'),
      primary: true,
      render: (c) => (
        <div className="flex items-center gap-3">
          {c.photo_url ? (
            <img src={c.photo_url} alt={c.name} loading="lazy" className="w-8 h-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <User size={14} className="text-blue-400" />
            </div>
          )}
          <span className="font-medium text-slate-700">{c.name}</span>
        </div>
      ),
    },
    { key: 'phone', header: t('field.phone'), render: (c) => c.phone ?? '—' },
    {
      key: 'deleted_at',
      header: t('deleted_at'),
      render: (c) => (c.deleted_at ? new Date(c.deleted_at).toLocaleDateString(localeFor()) : '—'),
    },
  ];

  return (
    <TrashView<Customer>
      title={tf('customers_trash.page_title')}
      subtitle={tf('customers_trash.page_subtitle')}
      backHref="/customers"
      apiBasePath="/customers"
      queryKey="customers-trash"
      invalidateOnRestore={['customers', 'customers-all']}
      invalidateOnForceDelete={['customers', 'customers-all']}
      money
      columns={columns}
      canRestore
      canForceDelete={canForceDelete}
      emptyIcon={Trash2}
      emptyTitle={tf('customers_trash.no_deleted')}
      labels={{
        searchPlaceholder: tf('customers_trash.search_placeholder'),
      }}
    />
  );
}
