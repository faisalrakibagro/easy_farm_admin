'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { MEDICINE_STOCK_KEYS } from '@/lib/invalidateGroups';
import { Medicine } from '@/types';
import { Trash2, Pill } from 'lucide-react';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';

type MedicineWithDeleted = Medicine & { deleted_at: string | null };

export default function MedicineTrashPage() {
  const { t } = useTranslation('common');
  const { t: tm } = useTranslation('medicine');
  const { hasPermission, hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const canDelete = hasPermission('farm.medicine.delete');

  const columns: TrashColumn<MedicineWithDeleted>[] = [
    { key: 'name', header: t('field.name'), primary: true, render: (item) => <p className="font-bold text-slate-700">{item.name}</p> },
    {
      key: 'category',
      header: tm('inventory.trash.col.category'),
      render: (item) =>
        item.category ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
            {item.category.name}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: 'unit',
      header: tm('inventory.trash.col.unit'),
      render: (item) =>
        item.unit ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded font-mono text-xs bg-slate-100 text-slate-600">
            {item.unit.symbol}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: 'deleted_at',
      header: t('deleted_at'),
      className: 'text-xs text-slate-400',
      render: (item) => (item.deleted_at ? new Date(item.deleted_at).toLocaleString(localeFor()) : '—'),
    },
  ];

  return (
    <TrashView<MedicineWithDeleted>
      title={tm('inventory.trash.page_title')}
      subtitle={(total) => t('common:trash.deleted_count', { count: total })}
      backHref="/farm/medicine/inventory"
      backLabel={tm('inventory.trash.back_link')}
      headerIcon={Trash2}
      warningText={tm('inventory.trash.warning')}
      apiBasePath="/farm/medicine"
      queryKey="medicine-trash"
      invalidateOnRestore={[...MEDICINE_STOCK_KEYS]}
      invalidateOnForceDelete={[...MEDICINE_STOCK_KEYS]}
      money
      columns={columns}
      canRestore={canDelete}
      canForceDelete={isSuperAdmin}
      emptyIcon={Pill}
      emptyDescription={tm('inventory.trash.empty_desc')}
      labels={{
        searchPlaceholder: tm('inventory.trash.search_placeholder'),
      }}
    />
  );
}
