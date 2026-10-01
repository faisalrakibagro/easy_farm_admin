'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { LabourEmployee } from '@/types';
import { Trash2, Users } from 'lucide-react';
import { TrashView, TrashColumn } from '@/components/trash/TrashView';
import { localeFor } from '@/lib/languages';
import { fmtMoney } from '@/lib/format';

type TrashedEmployee = LabourEmployee & { deleted_at: string | null };

export default function EmployeesTrashPage() {
  const { t } = useTranslation('common');
  const { t: tl } = useTranslation('labour');
  const { hasRole } = useAuth();
  const canDelete = hasRole('Super Admin');

  const columns: TrashColumn<TrashedEmployee>[] = [
    {
      key: 'name',
      header: t('field.name'),
      primary: true,
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-bold">
            {item.name[0].toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-slate-600">{item.name}</p>
            <p className="text-xs text-slate-400">{item.employee_code}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: tl('employees.trash.col.phone'),
      render: (item) => item.mobile || '—',
    },
    {
      key: 'monthly_salary',
      header: tl('employees.trash.col.monthly_salary'),
      render: (item) => fmtMoney(item.monthly_salary),
    },
    {
      key: 'deleted_at',
      header: t('deleted_at'),
      className: 'text-xs text-slate-400',
      render: (item) => (item.deleted_at ? new Date(item.deleted_at).toLocaleString(localeFor()) : '—'),
    },
  ];

  return (
    <TrashView<TrashedEmployee>
      title={tl('employees.trash.page_title')}
      subtitle={(total) => t('common:trash.deleted_count', { count: total })}
      backHref="/farm/labour/employees"
      backLabel={tl('employees.trash.back_link')}
      headerIcon={Trash2}
      warningText={tl('employees.trash.warning')}
      apiBasePath="/farm/labour/employees"
      queryKey="labour-employees-trash"
      invalidateOnRestore={['employees', 'employees-all']}
      invalidateOnForceDelete={['employees', 'employees-all']}
      columns={columns}
      canRestore
      canForceDelete={canDelete}
      emptyIcon={Users}
      emptyDescription={tl('employees.trash.empty_desc')}
      labels={{
        searchPlaceholder: tl('employees.trash.search_placeholder'),
      }}
    />
  );
}
