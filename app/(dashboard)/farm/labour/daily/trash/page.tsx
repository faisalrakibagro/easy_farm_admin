'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Trash2, Wrench } from 'lucide-react';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';
import { fmtMoney } from '@/lib/format';

interface TrashedDailyLabour {
  id: number;
  name: string;
  mobile: string | null;
  work_date: string;
  work_description: string | null;
  working_hours: string;
  daily_wage: string;
  total_paid: string;
  payment_status: 'unpaid' | 'paid';
  deleted_at: string | null;
}

export default function DailyLabourTrashPage() {
  const { t } = useTranslation('common');
  const { t: tl } = useTranslation('labour');
  const { hasRole } = useAuth();
  const canDelete = hasRole('Super Admin');

  const columns: TrashColumn<TrashedDailyLabour>[] = [
    {
      key: 'worker',
      header: tl('daily.trash.col.worker'),
      primary: true,
      render: (item) => (
        <div>
          <p className="font-medium text-slate-700">{item.name}</p>
          {item.mobile && <p className="text-xs text-slate-400">{item.mobile}</p>}
        </div>
      ),
    },
    {
      key: 'work_date',
      header: tl('daily.trash.col.work_date'),
      className: 'text-slate-500 whitespace-nowrap',
      render: (item) => new Date(item.work_date).toLocaleDateString(localeFor()),
    },
    {
      key: 'description',
      header: tl('daily.trash.col.description'),
      className: 'text-slate-500 max-w-[140px] truncate',
      render: (item) => item.work_description || '—',
    },
    {
      key: 'hours',
      header: tl('daily.trash.col.hours'),
      align: 'right',
      className: 'text-slate-500',
      render: (item) => `${item.working_hours}h`,
    },
    {
      key: 'total',
      header: t('total'),
      align: 'right',
      className: 'font-medium text-slate-700',
      render: (item) => fmtMoney(item.total_paid),
    },
    {
      key: 'status',
      header: t('field.status'),
      render: (item) => (
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.payment_status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}
        >
          {item.payment_status}
        </span>
      ),
    },
    {
      key: 'deleted_at',
      header: t('deleted_at'),
      className: 'text-xs text-slate-400 whitespace-nowrap',
      render: (item) => (item.deleted_at ? new Date(item.deleted_at).toLocaleString(localeFor()) : '—'),
    },
  ];

  return (
    <TrashView<TrashedDailyLabour>
      title={tl('daily.trash.page_title')}
      subtitle={(total) => t('common:trash.deleted_count', { count: total })}
      backHref="/farm/labour/daily"
      backLabel={tl('daily.trash.back_link')}
      headerIcon={Wrench}
      warningText={tl('daily.trash.warning')}
      apiBasePath="/farm/labour/daily"
      queryKey="daily-labour-trash"
      invalidateOnRestore={['daily-labour', 'daily-labour-unpaid', 'expenses', 'expense-summary']}
      invalidateOnForceDelete={['daily-labour', 'daily-labour-unpaid', 'expenses', 'expense-summary']}
      money
      columns={columns}
      canRestore
      canForceDelete={canDelete}
      emptyIcon={Trash2}
      emptyDescription={tl('daily.trash.empty_desc')}
      labels={{
        searchPlaceholder: tl('daily.trash.search_placeholder'),
      }}
    />
  );
}
