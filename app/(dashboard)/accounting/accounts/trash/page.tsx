'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen } from 'lucide-react';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';

interface TrashedAccount {
  id: number;
  name: string;
  type: string;
  code: string | null;
  deleted_at: string | null;
}

export default function AccountsTrashPage() {
  const { t } = useTranslation('common');
  const { t: tf } = useTranslation('finance');
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');

  const columns: TrashColumn<TrashedAccount>[] = [
    { key: 'name', header: t('field.name'), primary: true, render: (item) => item.name },
    {
      key: 'type',
      header: tf('accounts_trash.col_type'),
      render: (item) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
          {item.type}
        </span>
      ),
    },
    {
      key: 'code',
      header: tf('accounts_trash.col_code'),
      className: 'font-mono text-xs text-slate-500',
      render: (item) => item.code ?? '—',
    },
    {
      key: 'deleted_at',
      header: t('deleted_at'),
      className: 'text-xs text-slate-400',
      render: (item) => (item.deleted_at ? new Date(item.deleted_at).toLocaleString(localeFor()) : '—'),
    },
  ];

  return (
    <TrashView<TrashedAccount>
      title={tf('accounts_trash.page_title')}
      subtitle={(total) => t('common:trash.deleted_count', { count: total })}
      backHref="/accounting/accounts"
      backLabel={tf('accounts_trash.back_link')}
      headerIcon={BookOpen}
      warningText={`${tf('accounts_trash.warning')}${isSuperAdmin ? ` ${tf('accounts_trash.warning_superadmin')}` : ''}`}
      apiBasePath="/accounting/accounts"
      queryKey="accounting-accounts-trash"
      invalidateOnRestore={['accounting-accounts']}
      invalidateOnForceDelete={['accounting-accounts']}
      money
      columns={columns}
      canRestore
      canForceDelete={isSuperAdmin}
      emptyIcon={BookOpen}
      emptyDescription={tf('accounts_trash.no_deleted')}
      labels={{
        searchPlaceholder: tf('accounts_trash.search_placeholder'),
      }}
    />
  );
}
