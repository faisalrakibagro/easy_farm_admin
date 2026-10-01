'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { CATTLE_COST_KEYS, MEDICINE_STOCK_KEYS } from '@/lib/invalidateGroups';
import { Trash2 } from 'lucide-react';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';
import { fmtNum, fmtMoney } from '@/lib/format';

type Usage = {
  id: number;
  medicine?: { name: string };
  cattle?: { tag_number: string };
  usage_date: string;
  quantity_used: string;
  unit?: string | null;
  total_cost: string;
  deleted_at: string;
};

const fmt = (d: string | null | undefined) =>
  d ? new Date(d.split('T')[0] + 'T00:00:00').toLocaleDateString(localeFor()) : '—';

export default function MedicineUsageTrashPage() {
  const { t } = useTranslation(['medicine', 'common']);
  const { hasPermission, hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const canDelete = hasPermission('farm.medicine.delete');

  const columns: TrashColumn<Usage>[] = [
    {
      key: 'date',
      header: t('medicine:usage.col.date'),
      render: (u) => fmt(u.usage_date),
    },
    {
      key: 'medicine',
      header: t('medicine:usage.col.medicine'),
      primary: true,
      className: 'font-medium text-gray-800',
      render: (u) => u.medicine?.name ?? '—',
    },
    {
      key: 'cattle',
      header: t('medicine:usage.col.cattle'),
      render: (u) => u.cattle?.tag_number ?? '—',
    },
    {
      key: 'quantity',
      header: t('medicine:usage.col.quantity'),
      align: 'right',
      className: 'tabular-nums',
      render: (u) =>
        `${fmtNum(u.quantity_used, 3)}${u.unit ? ` ${u.unit}` : ''}`,
    },
    {
      key: 'total_cost',
      header: t('medicine:usage.col.cost'),
      align: 'right',
      className: 'tabular-nums text-red-600 font-semibold',
      render: (u) => fmtMoney(u.total_cost),
    },
    {
      key: 'deleted_at',
      header: t('medicine:usage.trash.col_deleted_at'),
      className: 'text-gray-400',
      render: (u) => fmt(u.deleted_at),
    },
  ];

  return (
    <TrashView<Usage>
      title={t('medicine:usage.trash.title')}
      subtitle={t('medicine:usage.trash.subtitle')}
      backHref="/farm/medicine/usage"
      backLabel={t('medicine:usage.trash.back')}
      warningText={t('medicine:usage.trash.subtitle')}
      // API prefix is `usages` (plural) while the page route is `usage`.
      apiBasePath="/farm/medicine/usages"
      queryKey="medicine-usages-trash"
      invalidateOnRestore={[...MEDICINE_STOCK_KEYS, ...CATTLE_COST_KEYS, 'medicine-usages', 'cattle-medicine', 'farm-cattle']}
      invalidateOnForceDelete={[...MEDICINE_STOCK_KEYS, ...CATTLE_COST_KEYS, 'medicine-usages', 'cattle-medicine', 'farm-cattle']}
      columns={columns}
      canRestore={canDelete}
      canForceDelete={isSuperAdmin}
      restoreMessages={{
        success: t('medicine:usage.trash.toast.restored'),
        error: t('medicine:usage.trash.toast.restore_error'),
      }}
      forceDeleteMessages={{
        success: t('medicine:usage.trash.toast.deleted'),
        error: t('medicine:usage.trash.toast.delete_error'),
      }}
      emptyIcon={Trash2}
      emptyTitle={t('medicine:usage.trash.empty')}
      labels={{
        restore: t('medicine:usage.trash.confirm_restore.label'),
        forceDelete: t('medicine:usage.trash.confirm_delete.label'),
        confirmTitle: t('medicine:usage.trash.confirm_delete.title'),
        confirmMessage: t('medicine:usage.trash.confirm_delete.message'),
        confirmLabel: t('medicine:usage.trash.confirm_delete.label'),
        searchPlaceholder: t('common:btn.search'),
      }}
    />
  );
}
