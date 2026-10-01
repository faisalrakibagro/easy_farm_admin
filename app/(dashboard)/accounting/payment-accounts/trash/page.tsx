'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { CreditCard } from 'lucide-react';
import type { AccountingPaymentAccount } from '@/types';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';
import { fmtMoney } from '@/lib/format';

type PaymentAccount = AccountingPaymentAccount & { deleted_at: string | null };

export default function PaymentAccountsTrashPage() {
  const { t } = useTranslation('common');
  const { t: tf } = useTranslation('finance');
  const { hasPermission, hasRole } = useAuth();
  const canManage = hasPermission('accounting.manage');
  const isSuperAdmin = hasRole('Super Admin');

  const columns: TrashColumn<PaymentAccount>[] = [
    { key: 'name', header: t('field.name'), primary: true, render: (item) => item.name },
    {
      key: 'type',
      header: tf('payment_accounts_trash.col_type'),
      render: (item) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
          {item.type}
        </span>
      ),
    },
    {
      key: 'balance',
      header: tf('payment_accounts_trash.col_balance'),
      render: (item) => fmtMoney(item.balance ?? 0),
    },
    {
      key: 'deleted_at',
      header: t('deleted_at'),
      className: 'text-xs text-slate-400',
      render: (item) => (item.deleted_at ? new Date(item.deleted_at).toLocaleString(localeFor()) : '—'),
    },
  ];

  return (
    <TrashView<PaymentAccount>
      title={tf('payment_accounts_trash.page_title')}
      subtitle={(total) => t('common:trash.deleted_count', { count: total })}
      backHref="/accounting/payment-accounts"
      backLabel={tf('payment_accounts_trash.back_link')}
      headerIcon={CreditCard}
      warningText={`${tf('payment_accounts_trash.warning')}${canManage ? ` ${tf('payment_accounts_trash.warning_manage')}` : ''}`}
      apiBasePath="/accounting/payment-accounts"
      queryKey="payment-accounts-trash"
      invalidateOnRestore={['accounting-payment-accounts']}
      invalidateOnForceDelete={['accounting-payment-accounts']}
      money
      columns={columns}
      canRestore={canManage}
      canForceDelete={isSuperAdmin}
      emptyIcon={CreditCard}
      emptyDescription={tf('payment_accounts_trash.no_deleted')}
      labels={{
        searchPlaceholder: tf('payment_accounts_trash.search_placeholder'),
      }}
    />
  );
}
