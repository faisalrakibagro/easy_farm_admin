'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Banknote, Trash2 } from 'lucide-react';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import ExpenseCategoryBadge from '@/components/expenses/ExpenseCategoryBadge';
import { localeFor } from '@/lib/languages';
import { fmtMoney } from '@/lib/format';

interface TrashedExpense {
  id: number;
  title: string;
  category: string;
  amount: string;
  expense_date: string | null;
  deleted_at: string | null;
}

export default function ExpensesTrashPage() {
  const { t } = useTranslation('common');
  const { t: tf } = useTranslation('finance');
  const { hasRole } = useAuth();
  const canForceDelete = hasRole('Super Admin');

  const columns: TrashColumn<TrashedExpense>[] = [
    { key: 'title', header: tf('expenses_trash.col.title'), primary: true, render: (item) => item.title },
    {
      key: 'category',
      header: tf('expenses_trash.col.category'),
      render: (item) => (
        <ExpenseCategoryBadge category={item.category} />
      ),
    },
    {
      key: 'amount',
      header: t('field.amount'),
      render: (item) => fmtMoney(item.amount),
    },
    {
      key: 'expense_date',
      header: t('field.date'),
      className: 'text-xs text-slate-500',
      render: (item) => (item.expense_date ? new Date(item.expense_date).toLocaleDateString(localeFor()) : '—'),
    },
    {
      key: 'deleted_at',
      header: t('deleted_at'),
      className: 'text-xs text-slate-400',
      render: (item) => (item.deleted_at ? new Date(item.deleted_at).toLocaleString(localeFor()) : '—'),
    },
  ];

  return (
    <TrashView<TrashedExpense>
      title={tf('expenses_trash.page_title')}
      subtitle={(total) => t('common:trash.deleted_count', { count: total })}
      backHref="/farm/expenses"
      backLabel={tf('expenses_trash.back_link')}
      headerIcon={Banknote}
      warningText={tf('expenses_trash.warning')}
      apiBasePath="/farm/expenses"
      queryKey="expenses-trash"
      invalidateOnRestore={['expenses', 'expense-summary']}
      invalidateOnForceDelete={['expenses', 'expense-summary']}
      money
      columns={columns}
      canRestore
      canForceDelete={canForceDelete}
      emptyIcon={Trash2}
      emptyDescription={tf('expenses_trash.empty_desc')}
      labels={{
        searchPlaceholder: tf('expenses_trash.search_placeholder'),
      }}
    />
  );
}
