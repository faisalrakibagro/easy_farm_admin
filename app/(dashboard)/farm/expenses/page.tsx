'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Expense, PaginatedResponse, AccountingPaymentAccount } from '@/types';
import { Plus } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { invalidateMoney } from '@/lib/invalidateGroups';
import { apiFieldErrors } from '@/lib/hooks/useFormErrors';
import ExpensesTable from '@/components/expenses/ExpensesTable';
import { useTableSort } from '@/lib/hooks/useTableSort';
import EditExpenseModal from '@/components/expenses/EditExpenseModal';
import CreateExpenseModal from '@/components/expenses/CreateExpenseModal';
import AllocateHoldModal from '@/components/expenses/AllocateHoldModal';
import { isMonthlyByDefault } from '@/components/expenses/RecurringToggle';
import { CATEGORIES, DEFAULT, type ExpForm, type EditExpForm, type EmployeeOption, type DailyLabourOption } from '@/components/expenses/types';
import { useAutoOpen } from '@/lib/hooks/useAutoOpen';
import TrashLink from '@/components/ui/TrashLink';
import ExpenseCategoryBadge from '@/components/expenses/ExpenseCategoryBadge';
import { failedMsg, savedMsg, trashedMsg } from '@/lib/feedback';
import { localeFor } from '@/lib/languages';
import { fmtMoney } from '@/lib/format';

export default function ExpensesPage() {
  const { t } = useTranslation(['finance', 'common']);
  const qc = useQueryClient();
  const { hasPermission, hasRole } = useAuth();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const sorting = useTableSort({ key: 'date', dir: 'desc' }, setPage);
  const [catFilter, setCatFilter] = useState('');
  const [showModal, setShowModal] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingExp, setEditingExp] = useState<Expense | null>(null);
  const [editForm, setEditForm] = useState<EditExpForm>({ category: '', title: '', amount: '', expense_date: '', payment_account_id: '', description: '', allocation_method: 'equal', is_recurring: false, payment_status: 'paid', paid_amount: '' });
  const [editFormError, setEditFormError] = useState('');
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<ExpForm>(DEFAULT);
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data, isLoading, isError, isFetching, refetch } = useQuery<PaginatedResponse<Expense> & { data: Expense[] }>({
    queryKey: ['expenses', page, catFilter, sorting.params],
    queryFn: async () => (await api.get('/farm/expenses', { params: { page, category: catFilter || undefined, per_page: 15, ...sorting.params } })).data,
  });

  const { data: summaryData } = useQuery({
    queryKey: ['expense-summary'],
    queryFn: async () => (await api.get('/farm/expenses/summary')).data as { summary: Record<string, number>; total: number },
  });

  const { data: paymentAccountsData } = useQuery<{ payment_accounts: AccountingPaymentAccount[] }>({
    queryKey: ['accounting-payment-accounts'],
    queryFn: async () => (await api.get('/accounting/payment-accounts')).data,
  });

  const { data: employeesData, isLoading: empLoading } = useQuery<{ employees: EmployeeOption[] }>({
    queryKey: ['employees-all'],
    queryFn: async () => (await api.get('/farm/labour/employees/all')).data,
    enabled: showModal && form.category === 'salary',
  });

  const { data: unpaidLabourData, isLoading: labourLoading } = useQuery<{ data: DailyLabourOption[] }>({
    queryKey: ['daily-labour-unpaid'],
    queryFn: async () => (await api.get('/farm/labour/daily/unpaid')).data,
    enabled: showModal && form.category === 'labour',
  });

  const defaultAccountId = paymentAccountsData?.payment_accounts.find(p => p.is_default)?.id?.toString() ?? '';

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCategoryChange = (cat: string) => {
    // Changing the category resets "monthly" to that category's usual kind; the user can still change it.
    setForm(f => ({ ...f, category: cat, is_recurring: isMonthlyByDefault(cat), labour_employee_id: '', daily_labour_id: '', title: '', amount: '' }));
    setErrors(p => ({ ...p, labour_employee_id: '', daily_labour_id: '' }));
  };

  const handleEmployeeSelect = (id: string) => {
    const emp = employeesData?.employees.find(e => String(e.id) === id);
    setForm(f => ({
      ...f,
      labour_employee_id: id,
      amount: id && emp ? emp.monthly_salary : '',
      title: id && emp ? t('finance:expenses.modal.title_salary', { name: emp.name }) : '',
    }));
  };

  const handleDailyLabourSelect = (id: string) => {
    const dl = unpaidLabourData?.data.find(d => String(d.id) === id);
    const total = dl ? (parseFloat(dl.daily_wage) * (parseFloat(String(dl.working_hours)) || 1)).toFixed(2) : '';
    setForm(f => ({
      ...f,
      daily_labour_id: id,
      amount: id && dl ? total : '',
      title: id && dl ? t('finance:expenses.modal.title_daily_labour', { name: dl.name, date: new Date(dl.work_date).toLocaleDateString(localeFor()) }) : '',
    }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = t('expenses.validation.title_required');
    if (!form.amount || parseFloat(form.amount) <= 0) e.amount = t('expenses.validation.amount_required');
    if (!form.expense_date) e.expense_date = t('expenses.validation.date_required');
    const isAlwaysPaid = (form.category === 'salary' && form.labour_employee_id) || (form.category === 'labour' && form.daily_labour_id);
    if (!isAlwaysPaid && form.payment_status !== 'unpaid' && !form.payment_account_id) e.payment_account_id = t('expenses.validation.account_required');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const openCreate = () => {
    setForm({ ...DEFAULT, payment_account_id: defaultAccountId });
    setFormError('');
    setErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setForm(DEFAULT);
    setFormError('');
    setErrors({});
  };

  // ── Held-expense allocation ───────────────────────────────────────────
  // A 'hold' expense already left the payment account but was never charged to
  // any animal; this releases it onto cattle the user picks.
  const [allocateTarget, setAllocateTarget] = useState<Expense | null>(null);
  const [allocateError, setAllocateError] = useState('');

  const { data: allCattleData, isLoading: cattleLoading } = useQuery<{ cattle: { id: number; tag_number: string; name?: string | null; current_weight?: string | null }[] }>({
    queryKey: ['cattle-active'],   // same /farm/cattle/all cache the rest of the app refreshes
    queryFn: async () => (await api.get('/farm/cattle/all')).data,
    enabled: !!allocateTarget,
  });

  const allocateMutation = useMutation({
    mutationFn: (vars: { id: number; cattle_ids: number[]; allocation_method: string }) =>
      api.post(`/farm/expenses/${vars.id}/allocate`, {
        cattle_ids: vars.cattle_ids,
        allocation_method: vars.allocation_method,
      }),
    onSuccess: (res) => {
      invalidateMoney(qc, [['expenses'], ['expense-summary'], ['expenses-trash']]);
      setAllocateTarget(null);
      setAllocateError('');
      toast.success((res as { data?: { message?: string } })?.data?.message ?? savedMsg());
    },
    onError: (e) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? failedMsg();
      setAllocateError(msg);
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/farm/expenses/${id}`),
    onSuccess: (res) => { invalidateMoney(qc, [['expenses'], ['expense-summary'], ['expenses-trash']]); setDeleteTarget(null); toast.success((res as { data?: { message?: string } })?.data?.message ?? trashedMsg()); },
    onError: (e) => { toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? failedMsg()); },
  });

  const editMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => {
      const payload = { ...d };
      if (d.payment_status === 'unpaid') delete payload.payment_account_id;
      if (d.payment_status !== 'partial') delete payload.paid_amount;
      return api.put(`/farm/expenses/${editingExp?.id}`, payload);
    },
    onSuccess: (res) => {
      invalidateMoney(qc, [['expenses'], ['expense-summary'], ['expenses-trash']]);
      setShowEditModal(false);
      toast.success((res as { data?: { message?: string } })?.data?.message ?? t('expenses.msg.updated'));
    },
    onError: (e: unknown) => {
      // Field errors under their fields; anything else at the top.
      const { fields, message } = apiFieldErrors(e, t('expenses.msg.update_failed'));
      setEditErrors(fields);
      setEditFormError(Object.keys(fields).length ? '' : message);
      toast.error(Object.values(fields)[0] ?? message);
    },
  });

  const openEdit = (exp: Expense) => {
    setEditingExp(exp);
    setEditForm({
      category:           exp.category,
      title:              exp.title,
      amount:             String(parseFloat(exp.amount)),
      expense_date:       exp.expense_date.split('T')[0],
      payment_account_id: exp.payment_account ? String((exp.payment_account as unknown as { id: number }).id) : String(exp.payment_account_id ?? ''),
      description:        exp.description ?? '',
      allocation_method:  exp.allocation_method ?? 'equal',
      is_recurring:       !!(exp as unknown as { is_recurring?: boolean }).is_recurring,
      payment_status:     (exp as unknown as { payment_status?: string }).payment_status ?? 'paid',
      paid_amount:        (exp as unknown as { paid_amount?: string | number }).paid_amount ? String((exp as unknown as { paid_amount?: string | number }).paid_amount) : '',
    });
    setEditFormError('');
    setEditErrors({});
    setShowEditModal(true);
  };

  const validateEdit = () => {
    const e: Record<string, string> = {};
    if (!editForm.title.trim()) e.title = t('expenses.validation.title_required');
    if (!editForm.amount || parseFloat(editForm.amount) <= 0) e.amount = t('expenses.validation.amount_required');
    if (!editForm.expense_date) e.expense_date = t('expenses.validation.date_required');
    if (editForm.payment_status !== 'unpaid' && !editForm.payment_account_id) e.payment_account_id = t('expenses.validation.account_required');
    setEditErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditFormError('');
    if (!validateEdit()) return;
    editMutation.mutate(editForm as unknown as Record<string, unknown>);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // "Save & add another" keeps the form open for the next bill.
    const again = !!((e.nativeEvent as SubmitEvent).submitter as HTMLElement | null)?.dataset.again;
    setFormError('');
    if (!validate()) return;
    setIsSaving(true);
    try {
      const isAlwaysPaid = (form.category === 'salary' && form.labour_employee_id) || (form.category === 'labour' && form.daily_labour_id);
      const payload: Record<string, unknown> = { ...form };
      if (isAlwaysPaid) {
        payload.payment_status = 'paid';
        delete payload.paid_amount;
      } else {
        if (form.payment_status !== 'partial') delete payload.paid_amount;
        if (form.payment_status === 'unpaid') delete payload.payment_account_id;
      }
      const res = await api.post('/farm/expenses', payload);
      invalidateMoney(qc, [['expenses'], ['expense-summary'], ['expenses-trash']]);
      if (form.daily_labour_id) {
        qc.invalidateQueries({ queryKey: ['daily-labour'] });
        qc.invalidateQueries({ queryKey: ['daily-labour-unpaid'] });
      }
      toast.success((res as { data?: { message?: string } })?.data?.message ?? savedMsg());
      if (again) {
        // Same category, date and account; the rest is cleared for the next one.
        setForm(f => ({ ...DEFAULT, category: f.category, expense_date: f.expense_date, payment_account_id: f.payment_account_id,
          payment_status: f.payment_status, allocation_method: f.allocation_method, is_recurring: f.is_recurring }));
        setErrors({});
      } else {
        closeModal();
      }
    } catch (err) {
      // Field errors go under their fields; anything else to the top.
      const { fields, message } = apiFieldErrors(err, failedMsg());
      setErrors(fields);
      if (!Object.keys(fields).length) setFormError(message);
      toast.error(Object.values(fields)[0] ?? message);
    } finally {
      setIsSaving(false);
    }
  };

  const isSuperAdmin = hasRole('Super Admin');

  const expenses = data?.data ?? [];

  // Reached from a dashboard quick action (?new=1): open the form straight away.
  useAutoOpen(openCreate, !!paymentAccountsData);

  return (
    <div className="space-y-4">

      {/* ── Summary Cards — clickable to filter ──────────────────────────── */}
      {/* Phones get one swipeable row instead of five rows pushing the list down. */}
      {summaryData && (
        <div className="-mx-4 px-4 py-1 flex gap-2 overflow-x-auto snap-x snap-mandatory scroll-px-4 sm:mx-0 sm:px-0 sm:py-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:snap-none md:grid-cols-5 lg:grid-cols-9">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => { setCatFilter(catFilter === cat ? '' : cat); setPage(1); }} aria-pressed={catFilter === cat}
              className={`shrink-0 w-32 snap-start sm:w-auto min-w-0 bg-white rounded-lg border p-3 text-start transition-all ${catFilter === cat ? 'border-blue-400 ring-1 ring-blue-400' : 'border-slate-200 hover:border-slate-300'}`}>
              <ExpenseCategoryBadge category={cat} />
              <p className="text-sm font-bold text-slate-800 mt-1.5 wrap-anywhere">{fmtMoney(summaryData.summary[cat] ?? 0)}</p>
            </button>
          ))}
        </div>
      )}

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <select value={catFilter} onChange={e => { setCatFilter(e.target.value); setPage(1); }}
          className="w-full sm:w-auto border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">{t('common:filter.all_categories')}</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{t(`common:expense_category.${c}`, { defaultValue: c })}</option>)}
        </select>
        <div className="hidden sm:block flex-1" />
        <div className="flex gap-2">
          {isSuperAdmin && (
            <TrashLink href="/farm/expenses/trash" />
          )}
          {hasPermission('farm.expenses.create') && (
            <button onClick={openCreate}
              className="flex flex-1 sm:flex-none items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
              <Plus size={16} /> {t('expenses.add')}
            </button>
          )}
        </div>
      </div>

      <ExpensesTable
        t={t}
        expenses={expenses}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        retrying={isFetching}
        isSuperAdmin={isSuperAdmin}
        openEdit={openEdit}
        setDeleteTarget={setDeleteTarget}
        onAllocate={(exp) => { setAllocateError(''); setAllocateTarget(exp); }}
        data={data}
        page={page}
        setPage={setPage}
        perPage={15}
        sorting={sorting}
      />

      {/* ── Edit Expense Modal ────────────────────────────────────────────── */}
      {showEditModal && (
        <EditExpenseModal
          t={t}
          editForm={editForm}
          setEditForm={setEditForm}
          editFormError={editFormError}
          editErrors={editErrors}
          setEditErrors={setEditErrors}
          paymentAccountsData={paymentAccountsData}
          onSubmit={handleEditSubmit}
          isSaving={editMutation.isPending}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {/* ── Delete Confirm ─────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={t('common:confirm.move_trash')}
        message={deleteTarget?.title ? t('ui.confirm_trash_named', { name: deleteTarget.title }) : t('common:confirm.trash_restorable')}
        confirmLabel={t('common:confirm.move_trash')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* ── Allocate Held Expense ──────────────────────────────────────────── */}
      {allocateTarget && (
        <AllocateHoldModal
          t={t}
          expense={allocateTarget}
          cattle={allCattleData?.cattle ?? []}
          isLoading={cattleLoading}
          isSaving={allocateMutation.isPending}
          error={allocateError}
          onClose={() => { setAllocateTarget(null); setAllocateError(''); }}
          onSubmit={(cattle_ids, allocation_method) =>
            allocateMutation.mutate({ id: allocateTarget.id, cattle_ids, allocation_method })}
        />
      )}

      {/* ── Add Expense Modal ──────────────────────────────────────────────── */}
      {showModal && (
        <CreateExpenseModal
          t={t}
          form={form}
          setForm={setForm}
          formError={formError}
          errors={errors}
          setErrors={setErrors}
          isSaving={isSaving}
          handleCategoryChange={handleCategoryChange}
          handleEmployeeSelect={handleEmployeeSelect}
          handleDailyLabourSelect={handleDailyLabourSelect}
          employeesData={employeesData}
          empLoading={empLoading}
          unpaidLabourData={unpaidLabourData}
          labourLoading={labourLoading}
          paymentAccountsData={paymentAccountsData}
          onClose={closeModal}
          onSubmit={handleCreateSubmit}
        />
      )}
    </div>
  );
}
