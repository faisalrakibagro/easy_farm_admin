'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Modal from '@/components/ui/Modal';
import FormRow, { FormRowFull } from '@/components/ui/FormRow';
import Field, { fieldId } from '@/components/ui/Field';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import SearchSelect from '@/components/ui/SearchSelect';
import PaymentAccountSelect from '@/components/ui/PaymentAccountSelect';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';
import { localeFor } from '@/lib/languages';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { LabourEmployee, AccountingPaymentAccount } from '@/types';
import { Plus, Search, Pencil, Trash2, Check, DollarSign, Eye, HandCoins } from 'lucide-react';
import GiveAdvanceModal from '@/components/labour/GiveAdvanceModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { invalidateMoney } from '@/lib/invalidateGroups';
import Link from '@/components/ui/AppLink';
import DynamicTable from '@/components/ui/DynamicTable';
import { useTableSort } from '@/lib/hooks/useTableSort';
import type { ColDef } from '@/lib/schemas/types';
import { createCrudService } from '@/lib/services/base';
import { createResourceKeys } from '@/lib/queryKeys';
import { useCrudResource } from '@/lib/hooks/useCrudResource';
import TrashLink from '@/components/ui/TrashLink';
import { failedMsg, savedMsg, trashedMsg } from '@/lib/feedback';
import { localDateStr } from '@/lib/dates';
import { fmtDate, fmtNum, fmtMoney } from '@/lib/format';

interface EmpShared {
  employee_code: string; mobile: string; nid_number: string;
  address: string; joining_date: string; monthly_salary: string; status: string;
}

const DEFAULT_SHARED: EmpShared = {
  employee_code: '', mobile: '', nid_number: '',
  address: '', joining_date: '', monthly_salary: '', status: 'active',
};

const EMP_FORM = 'employee-form';
const SALARY_FORM = 'pay-salary';
const EMP_KNOWN = ['name', 'employee_code', 'mobile', 'nid_number', 'joining_date', 'monthly_salary', 'status', 'address'];
const SALARY_KNOWN = ['payment_month', 'payment_year', 'base_salary', 'advance_deduction', 'bonus', 'allocation_method', 'payment_date', 'payment_account_id', 'notes'];

const employeesApi = createCrudService<LabourEmployee, { data: LabourEmployee[]; last_page: number; total: number }>('/farm/labour/employees');
const employeesKeys = createResourceKeys('employees');

export default function EmployeesPage() {
  const { t } = useTranslation('labour');
  const { t: tc } = useTranslation('common');
  const qc = useQueryClient();
  const { hasPermission, hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const sorting = useTableSort({ key: '', dir: 'desc' }, setPage);
  const [showModal, setShowModal] = useState(false);
  const [showSalaryModal, setShowSalaryModal] = useState<LabourEmployee | null>(null);
  const [editEmp, setEditEmp] = useState<LabourEmployee | null>(null);
  const [name, setName] = useState('');
  const [shared, setShared] = useState<EmpShared>({ ...DEFAULT_SHARED });
  const [salaryForm, setSalaryForm] = useState({
    payment_month: new Date().getMonth() + 1,
    payment_year: new Date().getFullYear(),
    base_salary: '', advance_deduction: '0', bonus: '0',
    payment_date: localDateStr(),
    payment_account_id: '', notes: '', allocation_method: 'equal',
  });
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [salaryErrors, setSalaryErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LabourEmployee | null>(null);
  const [advanceFor, setAdvanceFor] = useState<LabourEmployee | null>(null);
  const [empSnap, setEmpSnap] = useState('');
  const [salarySnap, setSalarySnap] = useState('');
  useScrollToError(errors, showModal ? formError : undefined);
  useScrollToError(salaryErrors, showSalaryModal ? formError : undefined);

  const setSh = (key: keyof EmpShared, value: string) => {
    setShared(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: '' }));
  };
  const setSal = <K extends keyof typeof salaryForm>(key: K, value: (typeof salaryForm)[K]) => {
    setSalaryForm(f => ({ ...f, [key]: value }));
    if (salaryErrors[key]) setSalaryErrors(p => ({ ...p, [key]: '' }));
  };

  const resource = useCrudResource(employeesApi, employeesKeys, {
    extraInvalidateKeys: [['labour-employees-trash'], ['employees-all']],
  });
  const { data, isLoading, isError, refetch } = resource.useList({ ...sorting.params, page, search, per_page: 15 });

  const { data: paymentAccountsData } = useQuery<{ payment_accounts: AccountingPaymentAccount[] }>({
    queryKey: ['accounting-payment-accounts'],
    queryFn: async () => (await api.get('/accounting/payment-accounts')).data,
  });

  const defaultAccountId = paymentAccountsData?.payment_accounts.find(p => p.is_default)?.id?.toString() ?? '';

  // What the employee still owes from advances — the most a salary may deduct.
  const { data: salaryEmpDetail } = useQuery<{ pending_advance: number }>({
    queryKey: ['employee-detail', String(showSalaryModal?.id ?? '')],
    queryFn: async () => (await api.get(`/farm/labour/employees/${showSalaryModal!.id}`)).data,
    enabled: !!showSalaryModal,
  });
  const pendingAdvance = salaryEmpDetail?.pending_advance ?? 0;

  // An advance already taken comes off this salary by default, so the net
  // shown is what is still owed. An empty deduction field means "automatic";
  // typing a number (0 included) overrides it.
  const salaryGross = (+salaryForm.base_salary || 0) + (+salaryForm.bonus || 0);
  const advanceDeduction = salaryForm.advance_deduction === ''
    ? String(Math.min(pendingAdvance, salaryGross))
    : salaryForm.advance_deduction;

  const salaryMutation = useMutation({
    mutationFn: ({ id, d }: { id: number; d: object }) =>
      api.post(`/farm/labour/employees/${id}/pay-salary`, d),
    onSuccess: (res) => {
      invalidateMoney(qc, [['employees'], ['employees-all'], ['expenses'], ['expense-summary'], ['employee-detail'], ['salary-history']]);
      setShowSalaryModal(null);
      toast.success((res as { data?: { message?: string } })?.data?.message ?? savedMsg());
    },
    onError: (e: unknown) => {
      const { fields, message } = apiFieldErrors(e, failedMsg());
      setSalaryErrors(fields);
      if (!Object.keys(fields).length) setFormError(message);
      toast.error(Object.values(fields)[0] ?? message);
    },
  });

  const createMutation = resource.useCreate();
  const updateMutation = resource.useUpdate();
  const deleteMutation = resource.useRemove({
    onSuccess: (res) => { setDeleteTarget(null); toast.success(res.message ?? trashedMsg()); },
    onError: (e: unknown) => { toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? failedMsg()); },
  });

  const openCreate = () => {
    setEditEmp(null); setName(''); setShared({ ...DEFAULT_SHARED });
    setEmpSnap(JSON.stringify({ name: '', shared: DEFAULT_SHARED }));
    setFormError(''); setErrors({}); setShowModal(true);
  };

  const openEdit = (emp: LabourEmployee) => {
    setEditEmp(emp); setName(emp.name ?? '');
    const next: EmpShared = {
      employee_code: emp.employee_code, mobile: emp.mobile ?? '',
      nid_number: emp.nid_number ?? '', address: emp.address ?? '',
      joining_date: emp.joining_date.split('T')[0],
      monthly_salary: emp.monthly_salary, status: emp.status,
    };
    setShared(next);
    setEmpSnap(JSON.stringify({ name: emp.name ?? '', shared: next }));
    setFormError(''); setErrors({}); setShowModal(true);
  };

  const openSalaryModal = (emp: LabourEmployee) => {
    const next = {
      payment_month: new Date().getMonth() + 1,
      payment_year: new Date().getFullYear(),
      base_salary: emp.monthly_salary,
      advance_deduction: '', bonus: '0',
      payment_date: localDateStr(),
      payment_account_id: defaultAccountId,
      notes: '', allocation_method: 'equal',
    };
    setSalaryForm(next);
    setSalarySnap(JSON.stringify(next));
    setFormError(''); setSalaryErrors({});
    setShowSalaryModal(emp);
  };

  const validateEmp = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = tc('form.v.required');
    if (!shared.employee_code.trim()) e.employee_code = tc('form.v.required');
    if (!shared.joining_date) e.joining_date = tc('form.v.date_required');
    if (!shared.monthly_salary || parseFloat(shared.monthly_salary) < 0) e.monthly_salary = tc('form.v.required');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateSalary = () => {
    const e: Record<string, string> = {};
    if (!salaryForm.base_salary || parseFloat(salaryForm.base_salary) < 0) e.base_salary = tc('form.v.required');
    if (!salaryForm.payment_account_id) e.payment_account_id = tc('form.v.account_required');
    if (!salaryForm.payment_date) e.payment_date = tc('form.v.date_required');
    if ((+advanceDeduction || 0) > pendingAdvance + 0.005) {
      e.advance_deduction = pendingAdvance > 0
        ? t('employees.salary_modal.deduction_too_big', { amount: fmtNum(pendingAdvance, 2) })
        : t('employees.salary_modal.deduction_no_advance');
    }
    setSalaryErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!validateEmp()) return;
    setIsSaving(true);
    try {
      if (editEmp) {
        await updateMutation.mutateAsync({ id: editEmp.id, payload: { name, ...shared } });
      } else {
        await createMutation.mutateAsync({ name, ...shared });
      }
      setShowModal(false);
      toast.success(savedMsg());
    } catch (err) {
      const { fields, message } = apiFieldErrors(err, failedMsg());
      setErrors(fields);
      if (!Object.keys(fields).length) setFormError(message);
      toast.error(Object.values(fields)[0] ?? message);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePaySalary = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!validateSalary()) return;
    salaryMutation.mutate({ id: showSalaryModal!.id, d: { ...salaryForm, advance_deduction: advanceDeduction } });
  };

  const employees = data?.data ?? [];
  const STATUS_COLORS: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-slate-100 text-slate-600',
    terminated: 'bg-red-100 text-red-700',
  };
  const netPayable = Math.max(0, salaryGross - (+advanceDeduction || 0));

  const cols: ColDef<LabourEmployee>[] = [
    {
      key: 'employee', labelKey: 'labour:employees.col.employee', align: 'left', sortKey: 'name', sortType: 'text',
      render: emp => (
        <div>
          <p className="font-medium text-slate-800">{emp.name}</p>
          <p className="text-xs text-slate-400 font-mono">{emp.employee_code}</p>
        </div>
      ),
    },
    { key: 'mobile', labelKey: 'labour:employees.col.mobile', align: 'left', render: emp => <span className="text-slate-500">{emp.mobile ?? '—'}</span> },
    { key: 'salary', labelKey: 'labour:employees.col.salary', align: 'right', sortKey: 'salary', sortType: 'number', render: emp => <span className="font-medium text-slate-700">{fmtMoney(emp.monthly_salary)}</span> },
    {
      key: 'status', labelKey: 'labour:employees.col.status', align: 'left',
      render: emp => <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[emp.status]}`}>{t(`employees.status.${emp.status}`)}</span>,
    },
    { key: 'joined', labelKey: 'labour:employees.col.joined', align: 'left', sortKey: 'joined', sortType: 'date', render: emp => <span className="text-xs text-slate-500">{fmtDate(emp.joining_date)}</span> },
    {
      key: '_actions', labelKey: '', align: 'right',
      render: emp => (
        <div className="flex flex-wrap justify-end gap-1">
          {hasPermission('farm.labour.edit') && (
            <>
              <button onClick={() => openSalaryModal(emp)}
                className="p-1.5 rounded-lg hover:bg-green-50 text-green-500"
                title={t('employees.salary_modal.btn')} aria-label={t('employees.salary_modal.btn')}>
                <DollarSign size={14} />
              </button>
              <button onClick={() => setAdvanceFor(emp)}
                className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-500"
                title={t('employees.advance.btn')} aria-label={t('employees.advance.btn')}>
                <HandCoins size={14} />
              </button>
              <Link href={`/farm/labour/employees/${emp.id}/salary-history`}
                className="inline-flex items-center justify-center pointer-coarse:size-10 p-1.5 rounded-lg hover:bg-blue-50 text-blue-500"
                title={t('employees.salary_history.title')} aria-label={t('employees.salary_history.title')}>
                <Eye size={14} />
              </Link>
              <button onClick={() => openEdit(emp)} aria-label={tc('btn.edit')}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                <Pencil size={14} />
              </button>
            </>
          )}
          {isSuperAdmin && (
            <button onClick={() => setDeleteTarget(emp)} aria-label={tc('confirm.move_trash')}
              className="p-1.5 rounded-lg hover:bg-red-50 text-red-400">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder={t('employees.search_placeholder')} value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full ps-9 pe-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {isSuperAdmin && (
          <TrashLink href="/farm/labour/employees/trash" grow={false} />
        )}
        {hasPermission('farm.labour.create') && (
          <button onClick={openCreate}
            className="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
            <Plus size={16} /> {t('employees.modal.create_title')}
          </button>
        )}
      </div>

      <DynamicTable
        cols={cols}
        sorting={sorting}
        serial
        perPage={15}
        data={employees}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        keyExtractor={emp => emp.id}
        emptyKey="labour:employees.empty"
        currentPage={page}
        lastPage={data?.last_page ?? 1}
        totalCount={data?.total}
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={tc('confirm.move_trash')}
        message={tc('confirm.trash_restorable')}
        confirmLabel={tc('confirm.move_trash')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* ── Employee Create/Edit Modal ────────────────────────────────────── */}
      <Modal open={showModal} onClose={() => setShowModal(false)} size="lg" dirty={JSON.stringify({ name, shared }) !== empSnap}
        title={editEmp ? t('employees.modal.edit_title') : t('employees.modal.create_title')}
        footer={<>
          <button type="button" onClick={() => setShowModal(false)} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={EMP_FORM} disabled={isSaving} className={btnPrimary}>
            <Check size={15} /> {editEmp ? t('common:btn.update') : t('common:btn.add')}
          </button>
        </>}>
        <form id={EMP_FORM} onSubmit={handleSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
          <FormAlert message={formError} extra={otherErrors(errors, EMP_KNOWN)} />
          <Field name="name" label={t('employees.field.name')} required error={errors.name}>
            <input id={fieldId('name')} value={name} dir="auto" data-autofocus
              onChange={e => { setName(e.target.value); if (errors.name) setErrors(p => ({ ...p, name: '' })); }}
              className={fieldClass(errors.name)} />
          </Field>
          <FormRow>
            <Field name="employee_code" label={t('employees.field.employee_code')} required error={errors.employee_code}>
              <input id={fieldId('employee_code')} value={shared.employee_code} dir="ltr"
                onChange={e => setSh('employee_code', e.target.value)} className={fieldClass(errors.employee_code)} />
            </Field>
            <Field name="mobile" label={t('employees.field.mobile')} error={errors.mobile}>
              <input id={fieldId('mobile')} type="tel" inputMode="tel" dir="ltr" value={shared.mobile}
                onChange={e => setSh('mobile', e.target.value)} className={fieldClass(errors.mobile)} />
            </Field>
            <Field name="nid_number" label={t('employees.field.nid_number')} error={errors.nid_number}>
              <input id={fieldId('nid_number')} inputMode="numeric" dir="ltr" value={shared.nid_number}
                onChange={e => setSh('nid_number', e.target.value)} className={fieldClass(errors.nid_number)} />
            </Field>
            <Field name="joining_date" label={t('employees.field.joining_date')} required error={errors.joining_date}>
              <input id={fieldId('joining_date')} type="date" value={shared.joining_date}
                onChange={e => setSh('joining_date', e.target.value)} className={fieldClass(errors.joining_date)} />
            </Field>
            <Field name="monthly_salary" label={t('employees.field.monthly_salary')} required error={errors.monthly_salary}>
              <NumberInput id={fieldId('monthly_salary')} value={shared.monthly_salary} prefix="৳" error={errors.monthly_salary}
                onChange={v => setSh('monthly_salary', v)} />
            </Field>
            <Field name="status" label={t('employees.field.status')} error={errors.status}>
              <select id={fieldId('status')} value={shared.status} onChange={e => setSh('status', e.target.value)} className={fieldClass(errors.status)}>
                <option value="active">{t('employees.status.active')}</option>
                <option value="inactive">{t('employees.status.inactive')}</option>
                <option value="terminated">{t('employees.status.terminated')}</option>
              </select>
            </Field>
            <FormRowFull>
              <Field name="address" label={t('employees.field.address')} error={errors.address}>
                <textarea id={fieldId('address')} rows={2} dir="auto" value={shared.address}
                  onChange={e => setSh('address', e.target.value)} className={fieldClass(errors.address)} />
              </Field>
            </FormRowFull>
          </FormRow>
        </form>
      </Modal>

      {/* ── Pay Salary Modal ──────────────────────────────────────────────── */}
      <Modal open={!!showSalaryModal} onClose={() => setShowSalaryModal(null)} size="md"
        dirty={JSON.stringify(salaryForm) !== salarySnap}
        title={showSalaryModal ? t('employees.salary_modal.title', { name: showSalaryModal.name }) : ''}
        subtitle={showSalaryModal ? `${fmtMoney(showSalaryModal.monthly_salary)}${t('daily.label.per_month')}` : undefined}
        footer={<>
          <button type="button" onClick={() => setShowSalaryModal(null)} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={SALARY_FORM} disabled={salaryMutation.isPending} className={btnPrimary}>
            <Check size={15} /> {t('employees.salary_modal.btn')}
          </button>
        </>}>
        <form id={SALARY_FORM} onSubmit={handlePaySalary} noValidate className="px-4 sm:px-6 py-5 space-y-4">
          <FormAlert message={formError} extra={otherErrors(salaryErrors, SALARY_KNOWN)} />

          {/* Month + Year */}
          <FormRow>
            <Field name="payment_month" label={t('employees.salary_modal.month')} error={salaryErrors.payment_month}>
              <SearchSelect id={fieldId('payment_month')} value={String(salaryForm.payment_month)} label={t('employees.salary_modal.month')}
                onChange={v => setSal('payment_month', +v)} error={salaryErrors.payment_month}
                options={Array.from({ length: 12 }, (_, i) => ({
                  value: String(i + 1),
                  label: new Date(2000, i, 1).toLocaleString(localeFor(), { month: 'long' }),
                }))} />
            </Field>
            <Field name="payment_year" label={t('employees.salary_modal.year')} error={salaryErrors.payment_year}>
              <NumberInput id={fieldId('payment_year')} value={salaryForm.payment_year} allowDecimal={false} error={salaryErrors.payment_year}
                onChange={v => setSalaryForm(f => ({ ...f, payment_year: parseInt(v) || f.payment_year }))} />
            </Field>
          </FormRow>

          {/* Base + Deduction + Bonus */}
          <FormRow cols={3}>
            <Field name="base_salary" label={t('employees.salary_modal.base_salary')} required error={salaryErrors.base_salary}>
              <NumberInput id={fieldId('base_salary')} value={salaryForm.base_salary} prefix="৳" error={salaryErrors.base_salary}
                onChange={v => setSal('base_salary', v)} />
            </Field>
            <Field name="advance_deduction" label={t('employees.salary_modal.advance_deduction')} error={salaryErrors.advance_deduction}>
              <NumberInput id={fieldId('advance_deduction')} value={advanceDeduction} prefix="৳" error={salaryErrors.advance_deduction}
                onChange={v => setSal('advance_deduction', v)} />
              {/* Only an advance already given can be deducted — show how much is owed. */}
              {pendingAdvance > 0 ? (
                <p className="text-xs text-amber-700 mt-1">
                  {t('employees.salary_modal.pending_advance', { amount: fmtNum(pendingAdvance, 2) })}{' '}
                  <button type="button" className="underline" onClick={() => setSal('advance_deduction', String(pendingAdvance))}>
                    {t('employees.salary_modal.deduct_all')}
                  </button>
                </p>
              ) : (
                <p className="text-xs text-slate-400 mt-1">{t('employees.salary_modal.no_pending_advance')}</p>
              )}
            </Field>
            <Field name="bonus" label={t('employees.salary_modal.bonus')} error={salaryErrors.bonus}>
              <NumberInput id={fieldId('bonus')} value={salaryForm.bonus} prefix="৳" error={salaryErrors.bonus}
                onChange={v => setSal('bonus', v)} />
            </Field>
          </FormRow>

          {/* Net payable summary */}
          <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-sm text-slate-600">{t('employees.salary_modal.net_payable')}</span>
            <div className="text-end">
              <strong className="text-xl text-green-700">{fmtMoney(netPayable)}</strong>
              {(+advanceDeduction || 0) > 0 && (
                <p className="text-xs text-slate-500">
                  {t('employees.salary_modal.net_breakdown', {
                    gross: fmtNum(salaryGross, 2),
                    advance: fmtNum(+advanceDeduction, 2),
                  })}
                </p>
              )}
            </div>
          </div>

          {/* How the salary is shared over the cattle */}
          <Field name="allocation_method" label={t('allocation.label')} error={salaryErrors.allocation_method}>
            <select id={fieldId('allocation_method')} value={salaryForm.allocation_method} onChange={e => setSal('allocation_method', e.target.value)}
              className={fieldClass(salaryErrors.allocation_method)}>
              <option value="equal">{t('allocation.equal')}</option>
              <option value="weight_based">{t('allocation.weight_based')}</option>
            </select>
          </Field>

          <Field name="payment_date" label={t('employees.salary_modal.payment_date')} required error={salaryErrors.payment_date}>
            <input id={fieldId('payment_date')} type="date" value={salaryForm.payment_date}
              onChange={e => setSal('payment_date', e.target.value)} className={fieldClass(salaryErrors.payment_date)} />
          </Field>

          <Field name="payment_account_id" label={t('employees.salary_modal.payment_account')} required error={salaryErrors.payment_account_id}>
            <PaymentAccountSelect id={fieldId('payment_account_id')} accounts={paymentAccountsData?.payment_accounts} amount={netPayable}
              value={salaryForm.payment_account_id} onChange={v => setSal('payment_account_id', v)} error={salaryErrors.payment_account_id}
              placeholder={t('employees.salary_modal.select_account')} label={t('employees.salary_modal.payment_account')} />
          </Field>

          <Field name="notes" label={t('common:field.notes')} error={salaryErrors.notes}>
            <textarea id={fieldId('notes')} rows={2} dir="auto" value={salaryForm.notes}
              onChange={e => setSal('notes', e.target.value)} className={fieldClass(salaryErrors.notes)} />
          </Field>
        </form>
      </Modal>

      {advanceFor && <GiveAdvanceModal employee={advanceFor} onClose={() => setAdvanceFor(null)} />}
    </div>
  );
}
