'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { MEDICINE_STOCK_KEYS } from '@/lib/invalidateGroups';
import { MedicinePurchase } from '@/types';
import { ShoppingCart } from 'lucide-react';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';
import { fmtMoney } from '@/lib/format';

interface MedicinePurchaseTrash extends MedicinePurchase {
  deleted_at: string | null;
}

const formatDate = (dateStr: string | null) => (dateStr ? new Date(dateStr).toLocaleDateString(localeFor()) : '—');
const formatDateTime = (dateStr: string | null) => (dateStr ? new Date(dateStr).toLocaleString(localeFor()) : '—');

export default function MedicinePurchasesTrashPage() {
  const { t } = useTranslation('common');
  const { t: tm } = useTranslation('medicine');
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');

  const columns: TrashColumn<MedicinePurchaseTrash>[] = [
    {
      key: 'purchase_info',
      header: tm('purchases.trash.col.purchase_info'),
      primary: true,
      render: (item) => (
        <p className="font-medium text-slate-700">{item.invoice_no ? item.invoice_no : `Purchase #${item.id}`}</p>
      ),
    },
    { key: 'supplier', header: tm('purchases.trash.col.supplier'), render: (item) => item.supplier_name || '—' },
    {
      key: 'total_cost',
      header: tm('purchases.trash.col.total_cost'),
      align: 'right',
      className: 'font-medium text-slate-800',
      render: (item) => fmtMoney(item.total_cost),
    },
    { key: 'date', header: t('field.date'), render: (item) => formatDate(item.purchase_date) },
    {
      key: 'deleted_at',
      header: t('deleted_at'),
      className: 'text-xs text-slate-400',
      render: (item) => formatDateTime(item.deleted_at),
    },
  ];

  return (
    <TrashView<MedicinePurchaseTrash>
      title={tm('purchases.trash.page_title')}
      subtitle={(total) => t('common:trash.deleted_count', { count: total })}
      backHref="/farm/medicine/purchases"
      backLabel={tm('purchases.trash.back_link')}
      headerIcon={ShoppingCart}
      warningText={tm('purchases.trash.warning')}
      apiBasePath="/farm/medicine-purchases"
      queryKey="medicine-purchases-trash"
      invalidateOnRestore={[...MEDICINE_STOCK_KEYS, 'medicine-purchases']}
      invalidateOnForceDelete={[...MEDICINE_STOCK_KEYS, 'medicine-purchases']}
      money
      columns={columns}
      canRestore
      canForceDelete={isSuperAdmin}
      emptyIcon={ShoppingCart}
      emptyDescription={tm('purchases.trash.empty_desc')}
      labels={{
        searchPlaceholder: tm('purchases.trash.search_placeholder'),
      }}
    />
  );
}
