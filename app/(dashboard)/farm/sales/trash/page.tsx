'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Banknote, Trash2 } from 'lucide-react';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';
import { fmtMoney } from '@/lib/format';

interface TrashedSale {
  id: number;
  cattle_id: number;
  cattle?: { tag_number: string; name?: string };
  buyer_name: string;
  sale_price: string;
  sale_date: string | null;
  deleted_at: string | null;
}

export default function SalesTrashPage() {
  const { t } = useTranslation('common');
  const { hasRole } = useAuth();
  const canForceDelete = hasRole('Super Admin');

  const columns: TrashColumn<TrashedSale>[] = [
    {
      key: 'cattle',
      header: t('sales_trash.col.cattle'),
      primary: true,
      render: (item) => (
        <>
          {item.cattle?.tag_number ?? item.cattle_id}
          {item.cattle?.name ? ` (${item.cattle.name})` : ''}
        </>
      ),
    },
    { key: 'buyer', header: t('sales_trash.col.buyer'), render: (item) => item.buyer_name },
    {
      key: 'sale_price',
      header: t('sales_trash.col.sale_price'),
      render: (item) => fmtMoney(item.sale_price),
    },
    {
      key: 'sale_date',
      header: t('sales_trash.col.sale_date'),
      className: 'text-xs text-slate-500',
      render: (item) => (item.sale_date ? new Date(item.sale_date).toLocaleDateString(localeFor()) : '—'),
    },
    {
      key: 'deleted_at',
      header: t('deleted_at'),
      className: 'text-xs text-slate-400',
      render: (item) => (item.deleted_at ? new Date(item.deleted_at).toLocaleString(localeFor()) : '—'),
    },
  ];

  return (
    <TrashView<TrashedSale>
      title={t('sales_trash.page_title')}
      subtitle={(total) => `${total} ${t('sales_trash.deleted_count')}`}
      backHref="/farm/sales"
      backLabel={t('sales_trash.back_link')}
      headerIcon={Banknote}
      warningText={`${t('sales_trash.warning')}${canForceDelete ? ` ${t('sales_trash.warning_superadmin')}` : ''}`}
      apiBasePath="/farm/sales"
      queryKey="sales-trash"
      invalidateOnRestore={['cattle-sales', 'sales-summary', 'farm-cattle', 'cattle-active']}
      invalidateOnForceDelete={['cattle-sales', 'sales-summary', 'farm-cattle', 'cattle-active']}
      money
      columns={columns}
      canRestore
      canForceDelete={canForceDelete}
      emptyIcon={Trash2}
      emptyDescription={t('sales_trash.no_deleted')}
      labels={{
        searchPlaceholder: t('sales_trash.search_placeholder'),
      }}
    />
  );
}
