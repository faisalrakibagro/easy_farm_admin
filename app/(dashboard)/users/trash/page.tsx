'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { User } from '@/types';
import { Trash2, Users } from 'lucide-react';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';

export default function UsersTrashPage() {
  const { t } = useTranslation('users');
  const { hasRole } = useAuth();
  const canForceDelete = hasRole('Super Admin');

  const columns: TrashColumn<User>[] = [
    {
      key: 'avatar',
      header: '',
      avatar: true,
      render: (u) => (
        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-bold">
          {u.name[0].toUpperCase()}
        </div>
      ),
    },
    {
      key: 'user',
      header: t('users.trash.col.user'),
      primary: true,
      render: (u) => (
        <div>
          <p className="font-medium text-slate-600">{u.name}</p>
          <p className="text-xs text-slate-400">{u.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: t('users.trash.col.role'),
      render: (u) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
          {u.roles[0] ?? t('common:no_role')}
        </span>
      ),
    },
    {
      key: 'deleted_at',
      header: t('users.trash.col.deleted_at'),
      className: 'text-xs text-slate-400',
      render: (u) => (u.deleted_at ? new Date(u.deleted_at).toLocaleString(localeFor()) : '—'),
    },
  ];

  return (
    <TrashView<User>
      title={t('users.trash.page_title')}
      subtitle={(total) => t('common:trash.deleted_count', { count: total })}
      backHref="/users"
      backLabel={t('users.trash.back_link')}
      headerIcon={Trash2}
      warningText={t('users.trash.warning')}
      apiBasePath="/users"
      queryKey="users-trash"
      invalidateOnRestore={['users']}
      invalidateOnForceDelete={['users']}
      columns={columns}
      canRestore
      canForceDelete={canForceDelete}
      emptyIcon={Users}
      emptyDescription={t('users.trash.empty_desc')}
      labels={{
        searchPlaceholder: t('users.trash.search_placeholder'),
      }}
    />
  );
}
