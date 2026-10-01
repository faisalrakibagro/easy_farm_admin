'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { DailyLabour, AccountingPaymentAccount } from '@/types';
import { Plus, Check, Trash2, CheckCircle, CopyPlus } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import DynamicTable from '@/components/ui/DynamicTable';
import { useTableSort } from '@/lib/hooks/useTableSort';
import LoadError from '@/components/ui/LoadError';
import type { ColDef } from '@/lib/schemas/types';
import { createCrudService } from '@/lib/services/base';
import { createResourceKeys } from '@/lib/queryKeys';
import { MONEY_KEYS, invalidateMoney } from '@/lib/invalidateGroups';
import { useCrudResource } from '@/lib/hooks/useCrudResource';
import { useDateRange } from '@/lib/hooks/useDateRange';
import DateRangeFilter from '@/components/ui/DateRangeFilter';
import { useAutoOpen } from '@/lib/hooks/useAutoOpen';
import TrashLink from '@/components/ui/TrashLink';
import { failedMsg, savedMsg, trashedMsg } from '@/lib/feedback';
import { localeFor } from '@/lib/languages';
import { localDateStr } from '@/lib/dates';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import PaymentAccountSelect from '@/components/ui/PaymentAccountSelect';
import PaymentStatusPicker from '@/components/ui/PaymentStatusPicker';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';
import { fmtMoney } from '@/lib/format';

type WageMode = 'daily_total' | 'hourly_rate';

const EMPTY_FORM = {
  name: '', mobile: '', work_date: localDateStr(),
  working_hours: '8', daily_wage: '0', payment_status: 'unpaid',
  payment_date: '', payment_account_id: '', work_description: '', notes: '',
  paid_amount: '', allocation_method: 'equal',
};

const FORM_ID = 'daily-labour';
const MARK_FORM = 'daily-labour-mark-paid';
const KNOWN = ['name', 'mobile', 'work_date', 'work_description', 'working_hours', 'daily_wage', 'payment_status', 'paid_amount', 'payment_date', 'payment_account_id', 'allocation_method', 'notes'];

const dailyLabourApi = createCrudService<DailyLabour, { data: DailyLabour[]; last_page: number; total: number }>('/farm/labour/daily');
const dailyLabourKeys = createResourceKeys('daily-labour');

export default function DailyLabourPage() {
  const { t } = useTranslation('labour');
  const { t: tc } = useTranslation('common');
  const qc = useQueryClient();
  const toast = useToast();
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const [page, setPage] = useState(1);
  const sorting = useTableSort({ key: 'date', dir: 'desc' }, setPage);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [wageMode, setWageMode] = useState<WageMode>('daily_total');
  const [dailyTotalInput, setDailyTotalInput] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DailyLabour | null>(null);
  const [snap, setSnap] = useState('');
  useScrollToError(errors, formError);

  const set = (key: keyof typeof EMPTY_FORM, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: '' }));
  };
  const statusLabels = {
    paid: t('daily.label.payment_status_paid'),
    partial: t('daily.label.payment_status_partial'),
    unpaid: t('daily.label.payment_status_unpaid'),
  };

  const resource = useCrudResource(dailyLabourApi, dailyLabourKeys, {
    extraInvalidateKeys: [...MONEY_KEYS, ['daily-labour-trash'], ['daily-labour-unpaid'], ['expenses'], ['expense-summary']],
  });
  const dateRange = useDateRange(setPage);
  const { data, isLoading, isError, refetch } = resource.useList({ ...sorting.params, page, per_page: 15, payment_status: filterStatus || undefined, ...dateRange.params });

  const { data: paymentAccountsData } = useQuery<{ payment_accounts: AccountingPaymentAccount[] }>({
    queryKey: ['accounting-payment-accounts'],
    queryFn: async () => (await api.get('/accounting/payment-accounts')).data,
  });

  const defaultAccountId = paymentAccountsData?.payment_accounts.find(p => p.is_default)?.id?.toString() ?? '';

  const [markPaidTarget, setMarkPaidTarget] = useState<DailyLabour | null>(null);
  const [chosenMarkPaidAccountId, setMarkPaidAccountId] = useState('');
  // Until the user picks one, the default account is preselected.
  const markPaidAccountId = chosenMarkPaidAccountId || defaultAccountId;
  const [markPaidError, setMarkPaidError] = useState('');
  const [markPaidStatus, setMarkPaidStatus] = useState<'paid' | 'partial'>('paid');
  const [markPaidAmount, setMarkPaidAmount] = useState('');
  const [markPaidErrors, setMarkPaidErrors] = useState<Record<string, string>>({});
  const [markPaidSnap, setMarkPaidSnap] = useState('');
  useScrollToError(markPaidErrors, markPaidError);
  const markPaidTotal = markPaidTarget
    ? (parseFloat(markPaidTarget.daily_wage) || 0) * (parseFloat(String(markPaidTarget.working_hours)) || 1)
    : 0;

  const markPaidMutation = useMutation({
    mutationFn: ({ id, paymentAccountId, status, paidAmount }: { id: number; paymentAccountId: string; status: 'paid' | 'partial'; paidAmount: string }) => {
      const payload: Record<string, unknown> = { payment_account_id: paymentAccountId || undefined, payment_status: status };
      if (status === 'partial' && paidAmount) payload.paid_amount = paidAmount;
      return api.patch(`/farm/labour/daily/${id}/mark-paid`, payload);
    },
    onSuccess: () => {
      invalidateMoney(qc, [['daily-labour'], ['daily-labour-unpaid'], ['expenses'], ['expense-summary']]);
      setMarkPaidTarget(null); setMarkPaidError(''); setMarkPaidStatus('paid'); setMarkPaidAmount('');
      toast.success(savedMsg());
    },
    onError: (e) => {
      const { fields, message } = apiFieldErrors(e, failedMsg());
      setMarkPaidErrors(fields);
      if (!Object.keys(fields).length) setMarkPaidError(message);
      toast.error(Object.values(fields)[0] ?? message);
    },
  });

  const openMarkPaid = (labour: DailyLabour) => {
    setMarkPaidTarget(labour);
    // The rest of a part-paid wage has to come from the account used before.
    const acc = parseFloat(String(labour.total_paid)) > 0 && labour.payment_account_id ? String(labour.payment_account_id) : defaultAccountId;
    setMarkPaidAccountId(acc);
    setMarkPaidSnap(JSON.stringify({ s: 'paid', a: '', acc: acc || defaultAccountId }));
    setMarkPaidError('');
    setMarkPaidErrors({});
    setMarkPaidStatus('paid');
    setMarkPaidAmount('');
  };

  const createMutation = resource.useCreate();
  const deleteMutation = resource.useRemove({
    onSuccess: (res) => { setDeleteTarget(null); toast.success(res.message ?? trashedMsg()); },
    onError: (e) => { toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? failedMsg()); },
  });

  // Auto-calculate derived values
  const hours = parseFloat(form.working_hours) || 0;
  const hourlyRate = parseFloat(form.daily_wage) || 0;
  const dailyTotal = parseFloat(dailyTotalInput) || 0;

  // Derived calculations for display
  const calculatedHourlyFromTotal = (hours > 0 && dailyTotal > 0) ? (dailyTotal / hours) : 0;
  const calculatedTotalFromHourly = (hours > 0 && hourlyRate > 0) ? (hours * hourlyRate) : 0;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = tc('form.v.required');
    if (!form.work_date) e.work_date = tc('form.v.date_required');
    if (wageMode === 'daily_total') {
      if (!dailyTotalInput || parseFloat(dailyTotalInput) <= 0) e.daily_wage = tc('form.v.amount_positive');
    } else {
      if (!form.daily_wage || parseFloat(form.daily_wage) <= 0) e.daily_wage = tc('form.v.amount_positive');
    }
    const wageTotal = wageMode === 'daily_total' ? dailyTotal : calculatedTotalFromHourly;
    if (form.payment_status === 'partial' && !(parseFloat(form.paid_amount) > 0)) e.paid_amount = tc('form.v.paid_amount_required');
    else if (form.payment_status === 'partial' && wageTotal > 0 && parseFloat(form.paid_amount) >= wageTotal) e.paid_amount = tc('form.v.partial_range');
    // Wages handed over leave an account, so it has to be named.
    if (form.payment_status !== 'unpaid' && !form.payment_account_id) e.payment_account_id = tc('form.v.account_required');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const again = !!((e.nativeEvent as SubmitEvent).submitter as HTMLElement | null)?.dataset.again;
    setFormError('');
    if (!validate()) return;
    setIsSaving(true);
    // Always send daily_wage (hourly rate) to backend
    const payload: Record<string, string> = { ...form };
    if (wageMode === 'daily_total' && hours > 0 && dailyTotal > 0) {
      payload.daily_wage = (dailyTotal / hours).toFixed(2);
    }
    if (form.payment_status !== 'partial') delete payload.paid_amount;
    if (form.payment_status === 'unpaid') delete payload.payment_account_id;
    try {
      const res = await createMutation.mutateAsync(payload);
      toast.success(res.message ?? savedMsg());
      if (again) {
        // Same day, job, wage and payment; the next worker's own details are cleared.
        const next = { ...form, name: '', mobile: '', notes: '', paid_amount: '' };
        setForm(next);
        setSnap(JSON.stringify({ form: next, dailyTotalInput, wageMode }));
        setErrors({});
        document.getElementById(fieldId('name'))?.focus();
      } else {
        setShowModal(false);
        setForm({ ...EMPTY_FORM });
        setDailyTotalInput('');
      }
    } catch (err) {
      const { fields, message } = apiFieldErrors(err, failedMsg());
      setErrors(fields);
      if (!Object.keys(fields).length) setFormError(message);
      toast.error(Object.values(fields)[0] ?? message);
    } finally {
      setIsSaving(false);
    }
  };

  const openModal = () => {
    const next = { ...EMPTY_FORM, payment_account_id: defaultAccountId };
    setForm(next);
    setDailyTotalInput('');
    setWageMode('daily_total');
    setSnap(JSON.stringify({ form: next, dailyTotalInput: '', wageMode: 'daily_total' }));
    setFormError('');
    setErrors({});
    setShowModal(true);
  };

  const labours = data?.data ?? [];
  const lastPage = data?.last_page ?? 1;
  const workDate = (l: DailyLabour) => new Date(l.work_date).toLocaleDateString(localeFor());
  const hoursText = (l: DailyLabour) => tc('ui.hours_n', { n: parseFloat(l.working_hours) || 0 });

  const statusBadge = (l: DailyLabour) => (
    <>
      {l.payment_status === 'paid' && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">{t('daily.status.paid')}</span>}
      {l.payment_status === 'partial' && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{t('daily.label.partial_badge')} ⚠️</span>}
      {l.payment_status === 'unpaid' && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700">{t('daily.status.unpaid')}</span>}
    </>
  );

  const paidFromBadge = (l: DailyLabour) => l.payment_account ? (
    <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
      {l.payment_account.name}
    </span>
  ) : null;

  const rowActions = (l: DailyLabour) => (
    <div className="flex justify-end gap-1">
      {(l.payment_status === 'unpaid' || l.payment_status === 'partial') && (
        <button onClick={() => openMarkPaid(l)} className="p-1.5 pointer-coarse:size-10 rounded-lg hover:bg-green-50 text-green-500" title={t('daily.label.mark_paid')} aria-label={t('daily.label.mark_paid')}>
          <CheckCircle size={14} />
        </button>
      )}
      {isSuperAdmin && (
        <button onClick={() => setDeleteTarget(l)} aria-label={tc('confirm.move_trash')} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
      )}
    </div>
  );

  const cols: ColDef<DailyLabour>[] = [
    { key: 'date', labelKey: 'labour:daily.col.date', align: 'left', sortKey: 'date', sortType: 'date', render: l => <span className="text-slate-500">{workDate(l)}</span> },
    { key: 'name', labelKey: 'labour:daily.col.name', align: 'left', sortKey: 'name', sortType: 'text', render: l => <span className="font-medium text-slate-700">{l.name}</span> },
    { key: 'work', labelKey: 'labour:daily.col.work', align: 'left', render: l => <span className="text-slate-500 max-w-[160px] truncate block">{l.work_description || '—'}</span> },
    { key: 'hours', labelKey: 'labour:daily.col.hours', align: 'right', sortKey: 'hours', sortType: 'number', render: l => <span className="text-slate-600">{hoursText(l)}</span> },
    { key: 'wage_hr', labelKey: 'labour:daily.col.wage_hr', align: 'right', sortKey: 'wage', sortType: 'number', render: l => <span className="text-slate-600">{fmtMoney(l.daily_wage)}</span> },
    { key: 'total', labelKey: 'labour:daily.col.total', align: 'right', sortKey: 'total', sortType: 'number', render: l => <span className="font-medium text-slate-800">{fmtMoney(l.total_paid)}</span> },
    { key: 'status', labelKey: 'labour:daily.col.status', align: 'left', render: statusBadge },
    {
      key: 'paid_from', labelKey: 'labour:daily.col.paid_from', align: 'left',
      render: l => paidFromBadge(l) ?? <span className="text-xs text-slate-300">—</span>,
    },
    { key: '_actions', labelKey: '', align: 'right', render: rowActions },
  ];

  // Reached from a dashboard quick action (?new=1): open the form straight away.
  useAutoOpen(openModal, !!paymentAccountsData);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800">{t('daily.title')}</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <TrashLink href="/farm/labour/daily/trash" />
          <button onClick={openModal}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg flex-1 sm:flex-none justify-center">
            <Plus size={16} /> {t('daily.btn.add')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-1">
        {['', 'unpaid', 'partial', 'paid'].map(s => (
          <button key={s} onClick={() => { setFilterStatus(s); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${filterStatus === s ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}>
            {s === '' ? t('daily.filter.all') : s === 'partial' ? t('daily.label.partial_badge') : t(`daily.filter.${s}`)}
          </button>
        ))}
      </div>

      <DateRangeFilter value={dateRange.range} onChange={dateRange.setRange} />

      {/* Phones: one compact card per record (name and total, then date · hours · rate)
          instead of nine labelled lines. */}
      <div className="sm:hidden">
        {isError && !isLoading && labours.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200">
            <LoadError onRetry={() => refetch()} />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="divide-y divide-slate-100">
              {isLoading ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-4 space-y-2">
                  <div className="h-4 bg-slate-100 rounded animate-pulse w-1/2" />
                  <div className="h-3 bg-slate-100 rounded animate-pulse w-3/4" />
                </div>
              )) : labours.length === 0 ? (
                <div className="px-4 py-8 text-center text-slate-400 text-sm">{t('daily.empty')}</div>
              ) : labours.map(l => (
                <div key={l.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-words font-medium text-slate-800">{l.name}</p>
                    <p className="shrink-0 font-semibold text-slate-800">{fmtMoney(l.total_paid)}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {workDate(l)} · {hoursText(l)} · {fmtMoney(l.daily_wage)}{tc('ui.per_hour')}
                  </p>
                  {l.work_description && <p className="mt-1 text-xs text-slate-500 break-words">{l.work_description}</p>}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      {statusBadge(l)}
                      {paidFromBadge(l)}
                    </div>
                    {rowActions(l)}
                  </div>
                </div>
              ))}
            </div>
            {labours.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-slate-500">
                  {tc('pagination.page_of', { current: page, total: lastPage })} &bull; {tc('pagination.total_count', { count: data?.total ?? 0 })}
                </span>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                    className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40">{tc('btn.prev')}</button>
                  <button disabled={page >= lastPage} onClick={() => setPage(page + 1)}
                    className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40">{tc('btn.next')}</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="hidden sm:block">
        <DynamicTable
          cols={cols}
          sorting={sorting}
          serial
          perPage={15}
          data={labours}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
          keyExtractor={l => l.id}
          emptyKey="labour:daily.empty"
          currentPage={page}
          lastPage={lastPage}
          totalCount={data?.total}
          onPageChange={setPage}
        />
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title={tc('confirm.move_trash')}
        message={deleteTarget?.name ? t('daily.confirm_trash', { name: deleteTarget.name }) : tc('confirm.trash_restorable')}
        confirmLabel={tc('confirm.move_trash')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Mark-Paid Confirmation Modal */}
      <Modal open={!!markPaidTarget} onClose={() => setMarkPaidTarget(null)} size="sm" title={t('daily.mark_paid_modal.title')}
        dirty={JSON.stringify({ s: markPaidStatus, a: markPaidAmount, acc: markPaidAccountId }) !== markPaidSnap}
        footer={<>
          <button type="button" onClick={() => setMarkPaidTarget(null)} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={MARK_FORM} disabled={markPaidMutation.isPending} className={btnPrimary}>
            <CheckCircle size={15} /> {t('daily.mark_paid_modal.confirm')}
          </button>
        </>}>
        {markPaidTarget && (
          <form id={MARK_FORM} noValidate className="px-4 sm:px-6 py-5 space-y-4"
            onSubmit={e => {
              e.preventDefault();
              const errs: Record<string, string> = {};
              if (markPaidStatus === 'partial' && !(parseFloat(markPaidAmount) > 0)) errs.paid_amount = tc('form.v.paid_amount_required');
              if (!markPaidAccountId) errs.payment_account_id = tc('form.v.account_required');
              setMarkPaidErrors(errs);
              setMarkPaidError('');
              if (Object.keys(errs).length) return;
              markPaidMutation.mutate({ id: markPaidTarget.id, paymentAccountId: markPaidAccountId, status: markPaidStatus, paidAmount: markPaidAmount });
            }}>
            <div className="bg-slate-50 rounded-xl p-4 text-sm">
              <p className="text-slate-600 font-medium">{markPaidTarget.name}</p>
              <p className="text-xs text-slate-400 mt-1">{new Date(markPaidTarget.work_date).toLocaleDateString(localeFor())} &bull; {fmtMoney(markPaidTarget.daily_wage)}{tc('ui.per_hour')} &bull; {tc('ui.hours_n', { n: markPaidTarget.working_hours })}</p>
              <p className="text-base font-bold text-slate-800 mt-2">{t('daily.mark_paid_modal.total')}: {fmtMoney(markPaidTotal)}</p>
            </div>
            <FormAlert message={markPaidError} extra={otherErrors(markPaidErrors, ['payment_status', 'paid_amount', 'payment_account_id'])} />
            <Field name="payment_status" label={t('daily.label.payment_type')}>
              <PaymentStatusPicker id={fieldId('payment_status')} value={markPaidStatus} options={['paid', 'partial']}
                onChange={v => { setMarkPaidStatus(v as 'paid' | 'partial'); setMarkPaidAmount(''); setMarkPaidErrors({}); }}
                labels={statusLabels} />
            </Field>
            {markPaidStatus === 'partial' && (
              <Field name="paid_amount" label={t('daily.label.paid_amount')} required error={markPaidErrors.paid_amount}
                hint={markPaidAmount ? `${t('daily.label.remaining')}: ${fmtMoney(Math.max(0, markPaidTotal - (parseFloat(markPaidAmount) || 0)))}` : undefined}>
                <NumberInput id={fieldId('paid_amount')} value={markPaidAmount} prefix="৳" placeholder={t('daily.placeholder.amount_now')} error={markPaidErrors.paid_amount}
                  onChange={v => { setMarkPaidAmount(v); setMarkPaidErrors(p => ({ ...p, paid_amount: '' })); }} />
              </Field>
            )}
            <Field name="payment_account_id" label={t('daily.mark_paid_modal.account')} required error={markPaidErrors.payment_account_id}>
              <PaymentAccountSelect id={fieldId('payment_account_id')} accounts={paymentAccountsData?.payment_accounts}
                amount={markPaidStatus === 'partial' ? markPaidAmount : markPaidTotal}
                value={markPaidAccountId} onChange={v => { setMarkPaidAccountId(v); setMarkPaidErrors(p => ({ ...p, payment_account_id: '' })); }}
                error={markPaidErrors.payment_account_id}
                placeholder={t('daily.mark_paid_modal.select_account')} label={t('daily.mark_paid_modal.account')} />
            </Field>
          </form>
        )}
      </Modal>

      <Modal open={showModal} onClose={() => setShowModal(false)} dirty={JSON.stringify({ form, dailyTotalInput, wageMode }) !== snap}
        title={t('daily.modal_title')}
        footer={<>
          <button type="button" onClick={() => setShowModal(false)} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={FORM_ID} data-again="1" disabled={isSaving} className={btnSecondary}>
            <CopyPlus size={15} /> {tc('form.save_add_another')}
          </button>
          <button type="submit" form={FORM_ID} disabled={isSaving} className={btnPrimary}>
            <Check size={15} /> {t('daily.btn.add')}
          </button>
        </>}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
          <FormAlert message={formError} extra={otherErrors(errors, KNOWN)} />
          <FormRow>
            <Field name="name" label={t('common:field.name')} required error={errors.name}>
              <input id={fieldId('name')} value={form.name} dir="auto" data-autofocus onChange={e => set('name', e.target.value)} className={fieldClass(errors.name)} />
            </Field>
            <Field name="mobile" label={t('employees.field.mobile')} error={errors.mobile}>
              <input id={fieldId('mobile')} type="tel" inputMode="tel" dir="ltr" value={form.mobile} onChange={e => set('mobile', e.target.value)} className={fieldClass(errors.mobile)} />
            </Field>
            <Field name="work_date" label={t('common:field.date')} required error={errors.work_date}>
              <input id={fieldId('work_date')} type="date" value={form.work_date} onChange={e => set('work_date', e.target.value)} className={fieldClass(errors.work_date)} />
            </Field>
          </FormRow>
          <Field name="work_description" label={t('daily.field.work_description')} error={errors.work_description}>
            <input id={fieldId('work_description')} value={form.work_description} dir="auto" onChange={e => set('work_description', e.target.value)} className={fieldClass(errors.work_description)} />
          </Field>

          {/* Wage Mode Toggle */}
          <Field name="wage_mode" label={t('daily.field.wage_mode')}>
            <div id={fieldId('wage_mode')} role="radiogroup" className="grid grid-cols-2 gap-2">
              {(['daily_total', 'hourly_rate'] as const).map(m => (
                <button key={m} type="button" role="radio" aria-checked={wageMode === m} onClick={() => setWageMode(m)}
                  className={`px-3 py-2.5 sm:py-2 rounded-lg border text-sm font-medium transition-colors ${wageMode === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                  {m === 'daily_total' ? t('daily.field.by_total') : t('daily.field.by_hourly')}
                </button>
              ))}
            </div>
          </Field>

          <FormRow>
            <Field name="working_hours" label={t('daily.field.working_hours')} required error={errors.working_hours}>
              <NumberInput id={fieldId('working_hours')} value={form.working_hours} error={errors.working_hours}
                onChange={v => set('working_hours', v)} />
            </Field>
            {wageMode === 'daily_total' ? (
              <Field name="daily_wage" label={t('daily.field.wage_total')} required error={errors.daily_wage}>
                <NumberInput id={fieldId('daily_wage')} value={dailyTotalInput} prefix="৳" placeholder="500" error={errors.daily_wage}
                  onChange={v => { setDailyTotalInput(v); if (errors.daily_wage) setErrors(p => ({ ...p, daily_wage: '' })); }} />
              </Field>
            ) : (
              <Field name="daily_wage" label={t('daily.field.wage_hourly')} required error={errors.daily_wage}>
                <NumberInput id={fieldId('daily_wage')} value={form.daily_wage} prefix="৳" placeholder="62.50" error={errors.daily_wage}
                  onChange={v => set('daily_wage', v)} />
              </Field>
            )}
          </FormRow>

          <Field name="payment_status" label={t('daily.field.payment_status')} error={errors.payment_status}>
            <PaymentStatusPicker id={fieldId('payment_status')} value={form.payment_status} labels={statusLabels}
              options={['unpaid', 'partial', 'paid']}
              onChange={v => setForm(f => ({ ...f, payment_status: v, paid_amount: '' }))} />
          </Field>
          {form.payment_status === 'partial' && (
            <Field name="paid_amount" label={t('daily.label.paid_amount')} required error={errors.paid_amount}>
              <NumberInput id={fieldId('paid_amount')} value={form.paid_amount} prefix="৳" placeholder={t('daily.placeholder.amount_now')} error={errors.paid_amount}
                onChange={v => set('paid_amount', v)} />
            </Field>
          )}
          {form.payment_status === 'paid' && (
            <Field name="payment_date" label={t('daily.field.payment_date')} error={errors.payment_date}>
              <input id={fieldId('payment_date')} type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} className={fieldClass(errors.payment_date)} />
            </Field>
          )}

          {/* Summary / Auto-calculated info */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <p className="text-xs font-semibold text-slate-700 mb-2">{t('daily.summary.title')}</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">{t('daily.summary.working_hours')}</span>
                <span className="font-medium text-slate-700">{tc('ui.hours_n', { n: hours })}</span>
              </div>
              {wageMode === 'daily_total' ? (
                <>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">{t('daily.summary.daily_total')}</span>
                    <span className="font-medium text-slate-700">{fmtMoney(dailyTotal)}</span>
                  </div>
                  <div className="flex justify-between gap-2 col-span-full pt-1 border-t border-slate-200">
                    <span className="text-slate-500">{t('daily.summary.hourly_auto')}</span>
                    <span className="font-semibold text-blue-700">{fmtMoney(calculatedHourlyFromTotal)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">{t('daily.summary.hourly_rate')}</span>
                    <span className="font-medium text-slate-700">{fmtMoney(hourlyRate)}</span>
                  </div>
                  <div className="flex justify-between gap-2 col-span-full pt-1 border-t border-slate-200">
                    <span className="text-slate-500">{t('daily.summary.daily_auto')}</span>
                    <span className="font-semibold text-blue-700">{fmtMoney(calculatedTotalFromHourly)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {(form.payment_status === 'paid' || form.payment_status === 'partial') && (
            <Field name="payment_account_id" label={t('daily.field.payment_account')} required error={errors.payment_account_id}>
              <PaymentAccountSelect id={fieldId('payment_account_id')} accounts={paymentAccountsData?.payment_accounts}
                amount={form.payment_status === 'partial' ? form.paid_amount : (wageMode === 'daily_total' ? dailyTotal : calculatedTotalFromHourly)}
                value={form.payment_account_id} onChange={v => set('payment_account_id', v)} error={errors.payment_account_id}
                placeholder={tc('select.account_placeholder')} label={t('daily.field.payment_account')} />
            </Field>
          )}
          <Field name="allocation_method" label={t('allocation.label')} error={errors.allocation_method}>
            <select id={fieldId('allocation_method')} value={form.allocation_method} onChange={e => set('allocation_method', e.target.value)}
              className={fieldClass(errors.allocation_method)}>
              <option value="equal">{t('allocation.equal')}</option>
              <option value="weight_based">{t('allocation.weight_based')}</option>
            </select>
          </Field>
          <Field name="notes" label={t('common:field.notes')} error={errors.notes}>
            <textarea id={fieldId('notes')} rows={2} dir="auto" value={form.notes} onChange={e => set('notes', e.target.value)} className={fieldClass(errors.notes)} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
