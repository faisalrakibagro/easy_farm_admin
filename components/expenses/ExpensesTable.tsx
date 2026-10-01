import { Pencil, Trash2, Banknote, User, Wrench, CalendarRange } from 'lucide-react';
import type { Expense, PaginatedResponse } from '@/types';
import ExpenseCategoryBadge from '@/components/expenses/ExpenseCategoryBadge';
import { localeFor } from '@/lib/languages';
import { fmtMoney } from '@/lib/format';
import LoadError from '@/components/ui/LoadError';
import { SerialCell, SerialHeader, SortHeader, SortSelect, TablePagination, type Sorting } from '@/components/ui/TableControls';

interface ExpensesTableProps {
  t: (key: string, opts?: Record<string, unknown>) => string;
  expenses: Expense[];
  isLoading: boolean;
  /** The list request failed: show "couldn't load, try again" instead of "no data". */
  isError?: boolean;
  onRetry?: () => void;
  retrying?: boolean;
  isSuperAdmin: boolean;
  openEdit: (exp: Expense) => void;
  setDeleteTarget: (exp: Expense) => void;
  /** Opens the allocate dialog for an expense parked with allocation_method='hold'. */
  onAllocate?: (exp: Expense) => void;
  data: (PaginatedResponse<Expense> & { data: Expense[] }) | undefined;
  page: number;
  setPage: (updater: (p: number) => number) => void;
  /** Rows per page the list was asked for — numbers the rows across pages. */
  perPage: number;
  sorting?: Sorting;
}

export default function ExpensesTable({ t, expenses, isLoading, isError = false, onRetry, retrying, isSuperAdmin, openEdit, setDeleteTarget, onAllocate, data, page, setPage, perPage, sorting }: ExpensesTableProps) {
  if (isError && !isLoading && expenses.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200">
        <LoadError onRetry={onRetry} retrying={retrying} />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Mobile card view */}
      <div className="block sm:hidden divide-y divide-slate-100">
        {sorting && (
          <SortSelect options={[
            { key: 'date', label: t('expenses.col.date'), type: 'date' },
            { key: 'amount', label: t('expenses.col.amount'), type: 'number' },
          ]} sorting={sorting} className="px-4 py-2.5" />
        )}
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 space-y-3 animate-pulse">
                <div className="flex justify-between items-center">
                  <div className="h-4 bg-slate-200 rounded w-1/2" />
                  <div className="h-7 w-7 bg-slate-200 rounded-lg" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-3 bg-slate-100 rounded w-3/4" />
                  <div className="h-5 bg-slate-100 rounded w-1/2" />
                  <div className="h-4 bg-slate-100 rounded w-2/3" />
                  <div className="h-5 bg-slate-100 rounded w-1/2" />
                </div>
              </div>
            ))
          : expenses.length === 0
            ? (
              <div className="px-4 py-12 text-center">
                <p className="text-slate-400 text-sm">{t('common:table.no_data')}</p>
              </div>
            )
            : expenses.map(exp => (
                <div key={exp.id} className="p-4 space-y-3">
                  {/* Top row: title + action */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                      <span className="font-semibold text-slate-800 text-sm truncate">{exp.title}</span>
                      {exp.is_recurring && (
                        <span className="inline-flex items-center gap-1 text-xs bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded font-normal">
                          <CalendarRange size={10} />{t('expenses.recurring.badge')}
                        </span>
                      )}
                      {exp.labour_employee && (
                        <span className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-normal">
                          <User size={10} />{exp.labour_employee.name}
                        </span>
                      )}
                      {exp.daily_labour && (
                        <span className="inline-flex items-center gap-1 text-xs bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded font-normal">
                          <Wrench size={10} />{exp.daily_labour.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {onAllocate && exp.allocation_method === 'hold' && !exp.is_allocated && (
                        <button onClick={() => onAllocate(exp)}
                          className="px-2 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 whitespace-nowrap">
                          {t('expenses.field.hold_allocate_btn')}
                        </button>
                      )}
                      {isSuperAdmin && (
                        <button onClick={() => openEdit(exp)} aria-label={t('common:btn.edit')} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600">
                          <Pencil size={14} />
                        </button>
                      )}
                      {isSuperAdmin && (
                        <button onClick={() => setDeleteTarget(exp)} aria-label={t('common:btn.move_to_trash')} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Detail grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs [&>*]:min-w-0">
                    <div>
                      <span className="text-slate-400 uppercase tracking-wide">{t('expenses.col.date')}</span>
                      <p className="text-slate-600 mt-0.5">{new Date(exp.expense_date).toLocaleDateString(localeFor())}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 uppercase tracking-wide">{t('expenses.col.category')}</span>
                      <p className="mt-0.5">
                        <ExpenseCategoryBadge category={exp.category} />
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 uppercase tracking-wide">{t('expenses.col.amount')}</span>
                      <p className="font-semibold text-slate-800 mt-0.5">{fmtMoney(exp.amount)}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 uppercase tracking-wide">{t('expenses.col.paid_from')}</span>
                      <p className="mt-0.5">
                        {exp.payment_account ? (
                          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                            <Banknote size={10} />{exp.payment_account.name}
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 uppercase tracking-wide">{t('expenses.col.allocated')}</span>
                      {exp.allocation_method === 'hold' && !exp.is_allocated ? (
                        <p className="mt-0.5">
                          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                            ⏸ {t('expenses.field.hold_badge')}
                          </span>
                        </p>
                      ) : (
                        <p className={`font-medium mt-0.5 ${exp.is_allocated ? 'text-green-600' : 'text-amber-600'}`}>
                          {exp.is_allocated ? t('common:yes') : t('common:no')}
                        </p>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-400 uppercase tracking-wide">{t('expenses.label.payment_status')}</span>
                      <p className="mt-0.5">
                        {(exp as unknown as { payment_status?: string }).payment_status === 'partial' && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{t('expenses.label.payment_status_partial')} ⚠️</span>}
                        {(exp as unknown as { payment_status?: string }).payment_status === 'unpaid' && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{t('expenses.label.payment_status_unpaid')} ❌</span>}
                        {(!((exp as unknown as { payment_status?: string }).payment_status) || (exp as unknown as { payment_status?: string }).payment_status === 'paid') && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{t('expenses.label.payment_status_paid')} ✅</span>}
                      </p>
                    </div>
                  </div>
                </div>
              ))
        }
      </div>
      {/* Desktop table view */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <SerialHeader />
              <SortHeader label={t('expenses.col.date')} sortKey="date" sortType="date" sorting={sorting} />
              <th className="text-start px-4 py-3 font-medium text-slate-600">{t('expenses.col.title')}</th>
              <th className="text-start px-4 py-3 font-medium text-slate-600">{t('expenses.col.category')}</th>
              <SortHeader label={t('expenses.col.amount')} align="right" sortKey="amount" sortType="number" sorting={sorting} />
              <th className="text-start px-4 py-3 font-medium text-slate-600">{t('expenses.col.paid_from')}</th>
              <th className="text-start px-4 py-3 font-medium text-slate-600">{t('expenses.label.payment_status')}</th>
              <th className="text-start px-4 py-3 font-medium text-slate-600">{t('expenses.col.allocated')}</th>
              <th className="text-end px-4 py-3 font-medium text-slate-600">{t('common:actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                  ))}</tr>
                ))
              : expenses.length === 0
                ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">{t('common:table.no_data')}</td>
                  </tr>
                )
              : expenses.map((exp, i) => (
                  <tr key={exp.id} className="hover:bg-slate-50">
                    <SerialCell index={i} page={page} perPage={perPage} />
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(exp.expense_date).toLocaleDateString(localeFor())}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      <span>{exp.title}</span>
                      {exp.is_recurring && (
                        <span className="ms-2 inline-flex items-center gap-1 text-xs bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded font-normal">
                          <CalendarRange size={10} />{t('expenses.recurring.badge')}
                        </span>
                      )}
                      {exp.labour_employee && (
                        <span className="ms-2 inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-normal">
                          <User size={10} />{exp.labour_employee.name}
                        </span>
                      )}
                      {exp.daily_labour && (
                        <span className="ms-2 inline-flex items-center gap-1 text-xs bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded font-normal">
                          <Wrench size={10} />{exp.daily_labour.name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ExpenseCategoryBadge category={exp.category} />
                    </td>
                    <td className="px-4 py-3 text-end font-medium text-slate-800">
                      {fmtMoney(exp.amount)}
                    </td>
                    <td className="px-4 py-3">
                      {exp.payment_account ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                          <Banknote size={10} />{exp.payment_account.name}
                        </span>
                      ) : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {(exp as unknown as { payment_status?: string }).payment_status === 'partial' && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{t('expenses.label.payment_status_partial')} ⚠️</span>}
                      {(exp as unknown as { payment_status?: string }).payment_status === 'unpaid' && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{t('expenses.label.payment_status_unpaid')} ❌</span>}
                      {(!((exp as unknown as { payment_status?: string }).payment_status) || (exp as unknown as { payment_status?: string }).payment_status === 'paid') && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{t('expenses.label.payment_status_paid')} ✅</span>}
                    </td>
                    <td className="px-4 py-3">
                      {exp.allocation_method === 'hold' && !exp.is_allocated ? (
                        <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                          ⏸ {t('expenses.field.hold_badge')}
                        </span>
                      ) : (
                        <span className={`text-xs font-medium ${exp.is_allocated ? 'text-green-600' : 'text-amber-600'}`}>
                          {exp.is_allocated ? t('common:yes') : t('common:no')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {onAllocate && exp.allocation_method === 'hold' && !exp.is_allocated && (
                          <button onClick={() => onAllocate(exp)}
                            className="px-2 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 whitespace-nowrap">
                            {t('expenses.field.hold_allocate_btn')}
                          </button>
                        )}
                        {isSuperAdmin && (
                          <button onClick={() => openEdit(exp)} aria-label={t('common:btn.edit')} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors">
                            <Pencil size={14} />
                          </button>
                        )}
                        {isSuperAdmin && (
                          <button onClick={() => setDeleteTarget(exp)} aria-label={t('common:btn.move_to_trash')} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {(data?.total ?? 0) > 0 && (
        <TablePagination page={page} lastPage={data?.last_page ?? 1} total={data?.total} perPage={perPage} onPageChange={p => setPage(() => p)} />
      )}
    </div>
  );
}
