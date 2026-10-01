'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Stethoscope } from 'lucide-react';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';

interface TreatmentTrashItem {
  id: number;
  diagnosis: string | null;
  treatment_date: string | null;
  vet_name: string | null;
  deleted_at: string | null;
  cattle?: {
    tag_number: string;
  } | null;
}

export default function TreatmentsTrashPage() {
  const { t } = useTranslation('common');
  const { t: th } = useTranslation('health');
  const { hasRole } = useAuth();
  const canDelete = hasRole('Super Admin');

  const columns: TrashColumn<TreatmentTrashItem>[] = [
    {
      key: 'cattle',
      header: th('treatments.trash.col.cattle'),
      primary: true,
      render: (item) => <p className="font-bold text-slate-700">{item.cattle?.tag_number ?? '—'}</p>,
    },
    {
      key: 'diagnosis',
      header: th('treatments.trash.col.diagnosis'),
      className: 'text-slate-600',
      render: (item) =>
        item.diagnosis ? (item.diagnosis.length > 40 ? item.diagnosis.slice(0, 40) + '…' : item.diagnosis) : '—',
    },
    {
      key: 'treatment_date',
      header: th('treatments.trash.col.treatment_date'),
      className: 'text-slate-600',
      render: (item) => (item.treatment_date ? new Date(item.treatment_date).toLocaleDateString(localeFor()) : '—'),
    },
    {
      key: 'vet',
      header: th('treatments.trash.col.vet'),
      className: 'text-slate-600',
      render: (item) => item.vet_name ?? '—',
    },
    {
      key: 'deleted_at',
      header: t('deleted_at'),
      className: 'text-xs text-slate-400',
      render: (item) => (item.deleted_at ? new Date(item.deleted_at).toLocaleString(localeFor()) : '—'),
    },
  ];

  return (
    <TrashView<TreatmentTrashItem>
      title={th('treatments.trash.page_title')}
      subtitle={(total) => t('common:trash.deleted_count', { count: total })}
      backHref="/farm/health/treatments"
      backLabel={th('treatments.trash.back_link')}
      headerIcon={Stethoscope}
      warningText={th('treatments.trash.warning')}
      apiBasePath="/farm/health/treatments"
      queryKey="treatments-trash"
      invalidateOnRestore={['treatments', 'cattle-treatments', 'cattle-active']}
      invalidateOnForceDelete={['treatments', 'cattle-treatments', 'cattle-active']}
      money
      columns={columns}
      canRestore
      canForceDelete={canDelete}
      emptyIcon={Stethoscope}
      emptyDescription={th('treatments.trash.empty_desc')}
      labels={{
        searchPlaceholder: th('treatments.trash.search_placeholder'),
      }}
    />
  );
}
