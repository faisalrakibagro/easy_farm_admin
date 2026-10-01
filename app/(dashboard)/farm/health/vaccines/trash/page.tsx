'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { MEDICINE_STOCK_KEYS } from '@/lib/invalidateGroups';
import { Syringe } from 'lucide-react';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';

interface VaccineTrashItem {
  id: number;
  vaccine_name: string | null;
  scheduled_date: string | null;
  deleted_at: string | null;
  cattle?: {
    tag_number: string;
  } | null;
}

export default function VaccinesTrashPage() {
  const { t } = useTranslation('common');
  const { t: th } = useTranslation('health');
  const { hasRole } = useAuth();
  const canDelete = hasRole('Super Admin');

  const columns: TrashColumn<VaccineTrashItem>[] = [
    {
      key: 'cattle',
      header: th('vaccines.trash.col.cattle'),
      render: (item) =>
        item.cattle?.tag_number ? (
          <span className="font-bold text-slate-700">{item.cattle.tag_number}</span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: 'vaccine',
      header: th('vaccines.trash.col.vaccine'),
      primary: true,
      render: (item) => item.vaccine_name ?? <span className="text-slate-400">—</span>,
    },
    {
      key: 'scheduled_date',
      header: th('vaccines.trash.col.scheduled_date'),
      render: (item) =>
        item.scheduled_date ? (
          new Date(item.scheduled_date).toLocaleDateString(localeFor())
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
    <TrashView<VaccineTrashItem>
      title={th('vaccines.trash.page_title')}
      subtitle={(total) => t('common:trash.deleted_count', { count: total })}
      backHref="/farm/health/vaccines"
      backLabel={th('vaccines.trash.back_link')}
      headerIcon={Syringe}
      warningText={th('vaccines.trash.warning')}
      apiBasePath="/farm/health/vaccines"
      queryKey="vaccines-trash"
      invalidateOnRestore={[...MEDICINE_STOCK_KEYS, 'vaccine-schedules', 'cattle-vaccines']}
      invalidateOnForceDelete={[...MEDICINE_STOCK_KEYS, 'vaccine-schedules', 'cattle-vaccines']}
      money
      columns={columns}
      canRestore={canDelete}
      canForceDelete={canDelete}
      emptyIcon={Syringe}
      emptyDescription={th('vaccines.trash.empty_desc')}
      labels={{
        searchPlaceholder: th('vaccines.trash.search_placeholder'),
      }}
    />
  );
}
