'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { MEDICINE_STOCK_KEYS } from '@/lib/invalidateGroups';
import { Trash2 } from 'lucide-react';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';
import { fmtNum, fmtMoney } from '@/lib/format';

type Adjustment = {
  id: number;
  medicine?: { name: string };
  adjustment_type: string;
  quantity: string;
  total_cost: string;
  adjustment_date: string;
  reason?: string | null;
  deleted_at: string;
};

const fmt = (d: string | null | undefined) =>
  d ? new Date(d.split('T')[0] + 'T00:00:00').toLocaleDateString(localeFor()) : '—';

export default function MedicineAdjustmentTrashPage() {
  const { t } = useTranslation(['medicine', 'common']);
  const { hasPermission, hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const canDelete = hasPermission('farm.medicine.delete');

  const columns: TrashColumn<Adjustment>[] = [
    {
      key: 'date',
      header: t('medicine:adjustments.col.date'),
      render: (adj) => fmt(adj.adjustment_date),
    },
    {
      key: 'item',
      header: t('medicine:adjustments.col.item'),
      primary: true,
      className: 'font-medium text-gray-800',
      render: (adj) => adj.medicine?.name ?? '—',
    },
    {
      key: 'type',
      header: t('medicine:adjustments.col.type'),
      render: (adj) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          {t(`medicine:adjustments.type.${adj.adjustment_type}`, adj.adjustment_type)}
        </span>
      ),
    },
    {
      key: 'quantity',
      header: t('medicine:adjustments.col.quantity'),
      align: 'right',
      className: 'tabular-nums',
      render: (adj) => fmtNum(adj.quantity, 3),
    },
    {
      key: 'total_cost',
      header: t('medicine:adjustments.col.total_cost'),
      align: 'right',
      className: 'tabular-nums text-red-600 font-semibold',
      render: (adj) => fmtMoney(adj.total_cost),
    },
    {
      key: 'deleted_at',
      header: t('medicine:adjustments.trash.col_deleted_at'),
      className: 'text-gray-400',
      render: (adj) => fmt(adj.deleted_at),
    },
  ];

  return (
    <TrashView<Adjustment>
      title={t('medicine:adjustments.trash.title')}
      subtitle={t('medicine:adjustments.trash.subtitle')}
      backHref="/farm/medicine/adjustments"
      backLabel={t('medicine:adjustments.trash.back')}
      warningText={t('medicine:adjustments.trash.subtitle')}
      apiBasePath="/farm/medicine/adjustments"
      queryKey="medicine-adjustments-trash"
      invalidateOnRestore={[...MEDICINE_STOCK_KEYS, 'medicine-adjustments']}
      invalidateOnForceDelete={[...MEDICINE_STOCK_KEYS, 'medicine-adjustments']}
      columns={columns}
      canRestore={canDelete}
      canForceDelete={isSuperAdmin}
      restoreMessages={{
        success: t('medicine:adjustments.trash.toast.restored'),
        error: t('medicine:adjustments.trash.toast.restore_error'),
      }}
      forceDeleteMessages={{
        success: t('medicine:adjustments.trash.toast.deleted'),
        error: t('medicine:adjustments.trash.toast.delete_error'),
      }}
      emptyIcon={Trash2}
      emptyTitle={t('medicine:adjustments.trash.empty')}
      labels={{
        restore: t('medicine:adjustments.trash.confirm_restore.label'),
        forceDelete: t('medicine:adjustments.trash.confirm_delete.label'),
        confirmTitle: t('medicine:adjustments.trash.confirm_delete.title'),
        confirmMessage: t('medicine:adjustments.trash.confirm_delete.message'),
        confirmLabel: t('medicine:adjustments.trash.confirm_delete.label'),
        searchPlaceholder: t('common:btn.search'),
      }}
    />
  );
}
