'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from '@/components/ui/AppLink';
import api from '@/lib/api';
import { SalaryPayment } from '@/types';
import { ArrowLeft, AlertCircle, TrendingDown, TrendingUp, Banknote, HandCoins, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { invalidateMoney } from '@/lib/invalidateGroups';
import GiveAdvanceModal from '@/components/labour/GiveAdvanceModal';
import { useTranslation } from 'react-i18next';
import { useRouteId } from '@/lib/hooks';
import { fmtDate, fmtNum, fmtMoney } from '@/lib/format';
import LoadError from '@/components/ui/LoadError';

interface EmployeeDetail {
  id: number; name: string; employee_code: string;
  monthly_salary: string; joining_date: string; status: string;
}

interface SalaryHistory {
  payments: (SalaryPayment & { payment_account?: { id: number; name: string } })[];
  total_paid: number;
  months_worked: number;
  expected_total: number;
  salary_due: number;
  monthly_salary: number;
  advances: SalaryAdvanceRow[];
  pending_advance: number;
  latest_payment_id: number | null;
}

interface SalaryAdvanceRow {
  id: number; advance_date: string; amount: string; repaid_amount: string;
  reason: string | null; status: 'pending' | 'partially_repaid' | 'repaid';
}

type UndoTarget = { kind: 'salary' | 'advance'; id: number; label: string };

const ADVANCE_STATUS_CLS: Record<SalaryAdvanceRow['status'], string> = {
  repaid: 'bg-emerald-50 text-emerald-700',
  partially_repaid: 'bg-sky-50 text-sky-700',
  pending: 'bg-amber-50 text-amber-700',
};

export default function SalaryHistoryPage() {
  const { t } = useTranslation('common');
  const { t: tl } = useTranslation('labour');
  const id = useRouteId(2); // /employees/<id>/salary-history

  const { data: empData, isLoading: empLoading } = useQuery<{ employee: EmployeeDetail }>({
    queryKey: ['employee-detail', id],
    queryFn: async () => (await api.get(`/farm/labour/employees/${id}`)).data,
    enabled: !!id && id !== '0',
  });

  const { data: historyData, isLoading: historyLoading, isError: historyError, isFetching: historyFetching, refetch: refetchHistory } = useQuery<SalaryHistory>({
    queryKey: ['salary-history', id],
    queryFn: async () => (await api.get(`/farm/labour/employees/${id}/salary-history`)).data,
    enabled: !!id && id !== '0',
  });

  const emp = empData?.employee;
  const isLoading = empLoading || historyLoading;
  // Failed with nothing to show: say so, instead of "no payments" / "no advances".
  const historyFailed = historyError && !historyData;

  const qc = useQueryClient();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canDelete = hasPermission('farm.labour.delete');
  const [showAdvance, setShowAdvance] = useState(false);
  const [undo, setUndo] = useState<UndoTarget | null>(null);
  const [undoing, setUndoing] = useState(false);

  // Undo a salary / advance entered by mistake. The API puts every side back:
  // the cash, the advance still owed, and the cattle's cost shares.
  const runUndo = async () => {
    if (!undo) return;
    setUndoing(true);
    try {
      const path = undo.kind === 'salary' ? `salary-payments/${undo.id}` : `advances/${undo.id}`;
      const res = await api.delete(`/farm/labour/employees/${id}/${path}`);
      invalidateMoney(qc, [['salary-history'], ['employee-detail'], ['employees']]);
      toast.success(res.data?.message ?? tl('employees.salary_history.undone'));
      setUndo(null);
    } catch (e) {
      const d = (e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response?.data;
      toast.error(d?.errors ? Object.values(d.errors)[0]?.[0] : d?.message ?? tl('employees.salary_history.undo_failed'));
    } finally { setUndoing(false); }
  };

  return (
    <div className="space-y-5">

      {/* Back */}
      <Link href="/farm/labour/employees"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={15} /> {tl('employees.salary_history.back_link')}
      </Link>

      {/* Employee header */}
      {empLoading ? (
        <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
      ) : emp && (
        <div className="bg-white rounded-xl border border-slate-200 px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg flex-shrink-0">
            {emp.name[0].toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-800">{emp.name}</h1>
            <p className="text-sm text-slate-500">{emp.employee_code} &bull; {tl('employees.salary_history.joined_label')} {fmtDate(emp.joining_date)}</p>
          </div>
          <div className="text-end">
            <p className="text-xs text-slate-400">{tl('employees.salary_history.monthly_salary_label')}</p>
            <p className="text-xl font-bold text-slate-800">{fmtMoney(emp.monthly_salary)}</p>
          </div>
          {hasPermission('farm.labour.edit') && (
            <button onClick={() => setShowAdvance(true)}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
              <HandCoins size={16} /> {tl('employees.advance.btn')}
            </button>
          )}
        </div>
      )}

      {/* Summary cards */}
      {historyLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : historyFailed ? (
        <LoadError onRetry={() => refetchHistory()} retrying={historyFetching} className="bg-white rounded-xl border border-slate-200" />
      ) : historyData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="@container min-w-0 bg-white rounded-xl border border-slate-200 px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} className="text-green-500" />
              <span className="text-xs text-slate-500 font-medium">{tl('employees.salary_history.total_paid')}</span>
            </div>
            <p className="amount-fit font-bold text-green-700">{fmtMoney(historyData.total_paid)}</p>
            <p className="text-xs text-slate-400 mt-1">{tl('employees.salary_history.payments_count', { count: historyData.payments.length })}</p>
          </div>

          <div className="@container min-w-0 bg-white rounded-xl border border-slate-200 px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <Banknote size={16} className="text-slate-500" />
              <span className="text-xs text-slate-500 font-medium">{tl('employees.salary_history.expected')}</span>
            </div>
            <p className="amount-fit font-bold text-slate-700">{fmtMoney(historyData.expected_total)}</p>
            <p className="text-xs text-slate-400 mt-1">{tl('employees.salary_history.months_worked', { count: historyData.months_worked })}</p>
          </div>

          <div className={`@container min-w-0 rounded-xl border px-5 py-4 ${historyData.salary_due > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              {historyData.salary_due > 0
                ? <TrendingDown size={16} className="text-red-500" />
                : <TrendingUp size={16} className="text-green-500" />}
              <span className="text-xs text-slate-500 font-medium">{tl('employees.salary_history.due')}</span>
            </div>
            <p className={`amount-fit font-bold ${historyData.salary_due > 0 ? 'text-red-700' : 'text-green-700'}`}>
              {fmtMoney(historyData.salary_due)}
            </p>
            {historyData.salary_due > 0 ? (
              <div className="flex items-center gap-1 mt-1">
                <AlertCircle size={12} className="text-amber-500" />
                <p className="text-xs text-amber-600">{tl('employees.salary_history.due_hint')}</p>
              </div>
            ) : (
              <p className="text-xs text-green-600 mt-1">{tl('employees.salary_history.all_paid')}</p>
            )}
          </div>
        </div>
      )}

      {!historyFailed && (
        <>
          {/* Payments table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">{tl('employees.salary_history.payment_history_title')}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{tl('employees.salary_history.payment_history_subtitle')}</p>
            </div>

            {/* Mobile card view */}
            <div className="sm:hidden divide-y divide-slate-100">
              {isLoading ? (
                [1, 2, 3].map(i => (
                  <div key={i} className="p-4 space-y-2 animate-pulse">
                    <div className="h-4 bg-slate-100 rounded w-1/2" />
                    <div className="h-3 bg-slate-100 rounded w-2/3" />
                  </div>
                ))
              ) : !historyData?.payments.length ? (
                <div className="p-8 text-center">
                  <Banknote size={36} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium text-sm">{tl('employees.salary_history.no_payments')}</p>
                  <p className="text-xs text-slate-400 mt-1">{tl('employees.salary_history.no_payments_hint')}</p>
                </div>
              ) : (
                historyData.payments.map(p => (
                  <div key={p.id} className="p-4 hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-semibold text-sm text-slate-800">
                          {p.payment_year} - {String(p.payment_month ?? 1).padStart(2, '0')} {tl('employees.salary_history.months')}
                        </p>
                        <p className="text-xs text-slate-500">{fmtDate(p.payment_date)}</p>
                      </div>
                      <div className="text-end shrink-0">
                        <p className="font-bold text-sm text-slate-800">
                          {fmtMoney(p.net_paid)}
                          {canDelete && p.id === historyData.latest_payment_id && (
                            <button onClick={() => setUndo({ kind: 'salary', id: p.id, label: `${p.payment_year}-${String(p.payment_month).padStart(2, '0')}` })}
                              className="ms-2 p-1.5 rounded-lg hover:bg-red-50 text-red-400 align-middle" title={tl('employees.salary_history.undo_salary')} aria-label={tl('employees.salary_history.undo_salary')}>
                              <Trash2 size={13} />
                            </button>
                          )}
                        </p>
                        {p.payment_account && (
                          <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full mt-0.5">
                            <Banknote size={10} />{p.payment_account.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
                      <div className="text-slate-500">{tl('employees.salary_history.col.base')}</div>
                      <div className="font-medium text-end text-slate-700">{fmtMoney(p.base_salary)}</div>
                      <div className="text-slate-500">{tl('employees.salary_history.col.deduction')}</div>
                      <div className="font-medium text-end">
                        {parseFloat(p.advance_deduction) > 0
                          ? <span className="text-red-500">-{fmtMoney(p.advance_deduction)}</span>
                          : <span className="text-slate-300">—</span>}
                      </div>
                      <div className="text-slate-500">{tl('employees.salary_history.col.bonus')}</div>
                      <div className="font-medium text-end">
                        {parseFloat(p.bonus) > 0
                          ? <span className="text-green-600">+{fmtMoney(p.bonus)}</span>
                          : <span className="text-slate-300">—</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop table view */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-start px-4 py-3 font-medium text-slate-600">{tl('employees.salary_history.table.period')}</th>
                    <th className="text-end px-4 py-3 font-medium text-slate-600">{tl('employees.salary_history.table.base')}</th>
                    <th className="text-end px-4 py-3 font-medium text-slate-600">{tl('employees.salary_history.col.deduction')}</th>
                    <th className="text-end px-4 py-3 font-medium text-slate-600">{tl('employees.salary_history.col.bonus')}</th>
                    <th className="text-end px-4 py-3 font-medium text-slate-600">{tl('employees.salary_history.table.net')}</th>
                    <th className="text-start px-4 py-3 font-medium text-slate-600">{tl('employees.salary_history.table.account')}</th>
                    <th className="text-start px-4 py-3 font-medium text-slate-600">{tl('employees.salary_history.table.date')}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading
                    ? Array.from({ length: 4 }).map((_, i) => (
                        <tr key={i}>{Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                        ))}</tr>
                      ))
                    : !historyData?.payments.length
                      ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-14 text-center">
                            <Banknote size={36} className="mx-auto text-slate-300 mb-3" />
                            <p className="text-slate-500 font-medium">{tl('employees.salary_history.no_payments')}</p>
                            <p className="text-xs text-slate-400 mt-1">{tl('employees.salary_history.no_payments_hint')}</p>
                          </td>
                        </tr>
                      )
                      : historyData.payments.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-700">
                            {p.payment_year} - {String(p.payment_month ?? 1).padStart(2, '0')} {tl('employees.salary_history.months')}
                          </td>
                          <td className="px-4 py-3 text-end text-slate-600">
                            {fmtMoney(p.base_salary)}
                          </td>
                          <td className="px-4 py-3 text-end">
                            {parseFloat(p.advance_deduction) > 0
                              ? <span className="text-red-500">-{fmtMoney(p.advance_deduction)}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-end">
                            {parseFloat(p.bonus) > 0
                              ? <span className="text-green-600">+{fmtMoney(p.bonus)}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-end font-semibold text-slate-800">
                            {fmtMoney(p.net_paid)}
                          </td>
                          <td className="px-4 py-3">
                            {p.payment_account ? (
                              <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                                <Banknote size={10} />{p.payment_account.name}
                              </span>
                            ) : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {fmtDate(p.payment_date)}
                          </td>
                          <td className="px-4 py-3 text-end">
                            {canDelete && p.id === historyData.latest_payment_id && (
                              <button onClick={() => setUndo({ kind: 'salary', id: p.id, label: `${p.payment_year}-${String(p.payment_month).padStart(2, '0')}` })}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-red-400" title={tl('employees.salary_history.undo_salary')} aria-label={tl('employees.salary_history.undo_salary')}>
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Advances */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold text-slate-800">{tl('employees.salary_history.advances_title')}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{tl('employees.salary_history.advances_subtitle')}</p>
              </div>
              {historyData && (
                <span className={`text-sm font-semibold px-3 py-1 rounded-full ${historyData.pending_advance > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                  {historyData.pending_advance > 0
                    ? tl('employees.salary_history.pending_advance', { amount: fmtNum(historyData.pending_advance, 2) })
                    : tl('employees.salary_modal.no_pending_advance')}
                </span>
              )}
            </div>
            {!historyData?.advances?.length ? (
              <p className="px-6 py-8 text-center text-sm text-slate-400">{tl('employees.salary_history.no_advances')}</p>
            ) : (
              <>
                {/* Mobile card view */}
                <div className="sm:hidden divide-y divide-slate-100">
                  {historyData.advances.map(a => (
                    <div key={a.id} className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-slate-800">{fmtMoney(a.amount)}</p>
                          <p className="text-xs text-slate-500">{fmtDate(a.advance_date)}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ADVANCE_STATUS_CLS[a.status]}`}>
                            {tl(`employees.advance.status.${a.status}`)}
                          </span>
                          {canDelete && parseFloat(a.repaid_amount) === 0 && (
                            <button onClick={() => setUndo({ kind: 'advance', id: a.id, label: fmtMoney(a.amount) })}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-400" title={tl('employees.salary_history.undo_advance')} aria-label={tl('employees.salary_history.undo_advance')}>
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                      {(parseFloat(a.repaid_amount) > 0 || a.reason) && (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2 [&>*]:min-w-0">
                          {parseFloat(a.repaid_amount) > 0 && (
                            <>
                              <div className="text-slate-500">{tl('employees.salary_history.recovered')}</div>
                              <div className="font-medium text-end text-slate-700">{fmtMoney(a.repaid_amount)}</div>
                            </>
                          )}
                          {a.reason && (
                            <>
                              <div className="text-slate-500">{tl('employees.advance.reason')}</div>
                              <div className="text-end text-slate-600 break-words">{a.reason}</div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop table view */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-start px-4 py-3">{tl('employees.salary_history.table.date')}</th>
                        <th className="text-end px-4 py-3">{tl('employees.advance.amount')}</th>
                        <th className="text-end px-4 py-3">{tl('employees.salary_history.recovered')}</th>
                        <th className="text-start px-4 py-3">{tl('employees.advance.reason')}</th>
                        <th className="text-start px-4 py-3">{tl('employees.salary_history.status')}</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historyData.advances.map(a => (
                        <tr key={a.id}>
                          <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(a.advance_date)}</td>
                          <td className="px-4 py-3 text-end font-medium text-slate-800">{fmtMoney(a.amount)}</td>
                          <td className="px-4 py-3 text-end text-slate-600">{parseFloat(a.repaid_amount) > 0 ? fmtMoney(a.repaid_amount) : '—'}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{a.reason || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ADVANCE_STATUS_CLS[a.status]}`}>
                              {tl(`employees.advance.status.${a.status}`)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-end">
                            {canDelete && parseFloat(a.repaid_amount) === 0 && (
                              <button onClick={() => setUndo({ kind: 'advance', id: a.id, label: fmtMoney(a.amount) })}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-red-400" title={tl('employees.salary_history.undo_advance')} aria-label={tl('employees.salary_history.undo_advance')}>
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {showAdvance && emp && <GiveAdvanceModal employee={{ id: emp.id, name: emp.name }} onClose={() => setShowAdvance(false)} />}

      <ConfirmDialog
        open={!!undo}
        title={undo?.kind === 'salary' ? tl('employees.salary_history.undo_salary') : tl('employees.salary_history.undo_advance')}
        message={undo?.kind === 'salary'
          ? tl('employees.salary_history.undo_salary_message', { label: undo?.label ?? '' })
          : tl('employees.salary_history.undo_advance_message', { label: undo?.label ?? '' })}
        confirmLabel={tl('employees.salary_history.undo_confirm')}
        loading={undoing}
        onConfirm={runUndo}
        onCancel={() => setUndo(null)}
      />
    </div>
  );
}
