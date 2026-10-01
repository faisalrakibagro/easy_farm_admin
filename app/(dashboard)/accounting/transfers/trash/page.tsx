'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { AccountTransfer } from '@/types';
import { ArrowRightLeft, Trash2 } from 'lucide-react';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';
import { fmtMoney } from '@/lib/format';

type TrashedTransfer = AccountTransfer & { deleted_at?: string };

export default function TransfersTrashPage() {
  const { t } = useTranslation('common');
  const { t: tf } = useTranslation('finance');
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');

  const columns: TrashColumn<TrashedTransfer>[] = [
    {
      key: 'from_to',
      header: tf('transfers_trash.col_from_to'),
      primary: true,
      render: (item) => (
        <p className="font-medium text-slate-700">
          {item.fromAccount?.name ?? '—'} → {item.toAccount?.name ?? '—'}
        </p>
      ),
    },
    {
      key: 'amount',
      header: t('field.amount'),
      className: 'text-slate-700',
      render: (item) => fmtMoney(parseFloat(item.amount)),
    },
    {
      key: 'transfer_date',
      header: tf('transfers_trash.col_transfer_date'),
      className: 'text-slate-500',
      render: (item) => (item.transfer_date ? new Date(item.transfer_date).toLocaleDateString(localeFor()) : '—'),
    },
    {
      key: 'deleted_at',
      header: t('deleted_at'),
      className: 'text-xs text-slate-400',
      render: (item) => (item.deleted_at ? new Date(item.deleted_at).toLocaleString(localeFor()) : '—'),
    },
  ];

  return (
    <TrashView<TrashedTransfer>
      title={
        <span className="flex items-center gap-2">
          <ArrowRightLeft size={16} className="text-slate-500" />
          {tf('transfers_trash.page_title')}
        </span>
      }
      subtitle={(total) => t('common:trash.deleted_count', { count: total })}
      backHref="/accounting/transfers"
      backLabel={tf('transfers_trash.back_link')}
      headerIcon={Trash2}
      warningText={`${tf('transfers_trash.warning')}${isSuperAdmin ? ` ${tf('transfers_trash.warning_superadmin')}` : ''}`}
      apiBasePath="/accounting/transfers"
      queryKey="transfers-trash"
      invalidateOnRestore={['account-transfers']}
      invalidateOnForceDelete={['account-transfers']}
      money
      columns={columns}
      canRestore
      canForceDelete={isSuperAdmin}
      emptyIcon={ArrowRightLeft}
      emptyDescription={tf('transfers_trash.no_deleted')}
      labels={{
        searchPlaceholder: tf('transfers_trash.search_placeholder'),
      }}
    />
  );
}
