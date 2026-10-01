'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { AccountTransfer, AccountingPaymentAccount } from '@/types';
import { Plus, Check, Trash2, ArrowRight } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import DynamicTable from '@/components/ui/DynamicTable';
import { useTableSort } from '@/lib/hooks/useTableSort';
import type { ColDef } from '@/lib/schemas/types';
import { createCrudService } from '@/lib/services/base';
import { createResourceKeys } from '@/lib/queryKeys';
import { MONEY_KEYS } from '@/lib/invalidateGroups';
import { useCrudResource } from '@/lib/hooks/useCrudResource';
import { useDateRange } from '@/lib/hooks/useDateRange';
import DateRangeFilter from '@/components/ui/DateRangeFilter';
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
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';
import { fmtMoney } from '@/lib/format';

const EMPTY_FORM = {
  from_account_id: '', to_account_id: '',
  amount: '', transfer_date: localDateStr(),
  reference: '', notes: '',
};
const FORM_ID = 'account-transfer';
const KNOWN = ['from_account_id', 'to_account_id', 'amount', 'transfer_date', 'reference', 'notes'];


const transfersApi = createCrudService<AccountTransfer, { data: AccountTransfer[]; last_page: number; total: number }>('/accounting/transfers');
const transfersKeys = createResourceKeys('account-transfers');

export default function AccountTransfersPage() {
  const { t } = useTranslation('finance');
  const { t: tc } = useTranslation('common');
  const typeLabel = (type: string) => t(`payment_accounts.types.${type}`, { defaultValue: type });
  const { hasPermission, hasRole } = useAuth();
  const toast = useToast();
  const isSuperAdmin = hasRole('Super Admin');
  const [page, setPage] = useState(1);
  const sorting = useTableSort({ key: 'date', dir: 'desc' }, setPage);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<AccountTransfer | null>(null);
  const [snap, setSnap] = useState('');
  useScrollToError(errors, formError);

  const set = (key: keyof typeof EMPTY_FORM, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: '' }));
  };
  const openModal = () => {
    const next = { ...EMPTY_FORM };
    setForm(next); setSnap(JSON.stringify(next)); setFormError(''); setErrors({}); setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setErrors({}); };

  const resource = useCrudResource(transfersApi, transfersKeys, {
    extraInvalidateKeys: [...MONEY_KEYS, ['transfers-trash']],
  });
  const dateRange = useDateRange(setPage);
  const { data, isLoading, isError, refetch } = resource.useList({ ...sorting.params, page, per_page: 20, ...dateRange.params });

  const { data: accountsData } = useQuery<{ payment_accounts: AccountingPaymentAccount[] }>({
    queryKey: ['accounting-payment-accounts'],
    queryFn: async () => (await api.get('/accounting/payment-accounts')).data,
  });

  const createMutation = resource.useCreate({
    onSuccess: (res) => {
      setShowModal(false);
      setForm({ ...EMPTY_FORM });
      toast.success(res.message ?? savedMsg());
    },
    onError: (e: unknown) => {
      const { fields, message } = apiFieldErrors(e, failedMsg());
      setErrors(fields);
      if (!Object.keys(fields).length) setFormError(message);
      toast.error(Object.values(fields)[0] ?? message);
    },
  });

  const deleteMutation = resource.useRemove({
    onSuccess: (res) => {
      setDeleteTarget(null);
      toast.success(res.message ?? trashedMsg());
    },
    onError: (e: unknown) => {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? failedMsg());
    },
  });

  function validate() {
    const e: Record<string, string> = {};
    if (!form.from_account_id) e.from_account_id = tc('form.v.required');
    if (!form.to_account_id) e.to_account_id = tc('form.v.required');
    if (form.from_account_id && form.to_account_id && form.from_account_id === form.to_account_id) e.to_account_id = t('transfers.v_same_account');
    const amt = parseFloat(form.amount);
    if (!form.amount || isNaN(amt) || amt <= 0) e.amount = tc('form.v.amount_positive');
    if (!form.transfer_date) e.transfer_date = tc('form.v.date_required');
    setErrors(e);
    setFormError('');
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate({ ...form });
  }

  const transfers = data?.data ?? [];
  const accounts = accountsData?.payment_accounts ?? [];
  const activeAccounts = accounts.filter(a => a.is_active);

  const accountLabel = (id: number) => {
    const a = accounts.find(x => x.id === id);
    return a ? `${a.name} (${typeLabel(a.type)})` : t('transfers.account_number', { id, defaultValue: `#${id}` });
  };

  const cols: ColDef<AccountTransfer>[] = [
    { key: 'date', labelKey: 'finance:transfers.col.date', align: 'left', sortKey: 'date', sortType: 'date', render: tr => <span className="whitespace-nowrap">{new Date(tr.transfer_date).toLocaleDateString(localeFor())}</span> },
    { key: 'from', labelKey: 'finance:transfers.col.from', align: 'left', render: tr => <span className="font-medium text-slate-700">{tr.fromAccount ? tr.fromAccount.name : accountLabel(tr.from_account_id)}</span> },
    { key: 'arrow', labelKey: '', align: 'center', render: () => <ArrowRight size={14} className="text-slate-400 inline" /> },
    { key: 'to', labelKey: 'finance:transfers.col.to', align: 'left', render: tr => <span className="font-medium text-slate-700">{tr.toAccount ? tr.toAccount.name : accountLabel(tr.to_account_id)}</span> },
    { key: 'amount', labelKey: 'finance:transfers.col.amount', align: 'right', sortKey: 'amount', sortType: 'number', render: tr => <span className="font-semibold text-blue-600">{fmtMoney(parseFloat(tr.amount))}</span> },
    { key: 'reference', labelKey: 'finance:transfers.col.reference', align: 'left', render: tr => <span className="text-slate-500 text-xs">{tr.reference || '—'}</span> },
    { key: 'notes', labelKey: 'finance:transfers.col.notes', align: 'left', render: tr => <span className="text-slate-500 text-xs max-w-[200px] truncate block">{tr.notes || '—'}</span> },
    {
      key: '_actions', labelKey: '', align: 'right',
      render: tr => isSuperAdmin ? (
        <div className="flex justify-end">
          <button onClick={() => setDeleteTarget(tr)} aria-label={tc('btn.move_to_trash')} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
        </div>
      ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t('transfers.title')}</h1>
          <p className="text-xs text-slate-400 mt-0.5">{t('transfers.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isSuperAdmin && (
            <TrashLink href="/accounting/transfers/trash" />
          )}
          <button onClick={openModal}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg flex-1 sm:flex-none justify-center">
            <Plus size={16} /> {tc('btn.new_transfer')}
          </button>
        </div>
      </div>

      {/* Account Balances */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {accounts.filter(a => a.is_active).map(a => (
            <div key={a.id} className="min-w-0 bg-white rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-400 truncate">{a.name}</p>
              <p className="text-xs text-slate-400">{typeLabel(a.type)}</p>
              <p className="text-base font-bold text-slate-700 mt-1 wrap-anywhere">{fmtMoney((a as AccountingPaymentAccount & { balance?: number }).balance ?? 0)}</p>
            </div>
          ))}
        </div>
      )}

      <DateRangeFilter value={dateRange.range} onChange={dateRange.setRange} />

      <DynamicTable
        cols={cols}
        sorting={sorting}
        serial
        perPage={20}
        data={transfers}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        keyExtractor={tr => tr.id}
        emptyKey="finance:transfers.empty"
        currentPage={page}
        lastPage={data?.last_page ?? 1}
        totalCount={data?.total}
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={tc('btn.move_to_trash')}
        message={deleteTarget?.reference ? t('ui.confirm_trash_named', { name: deleteTarget.reference }) : tc('confirm.trash_restorable')}
        confirmLabel={tc('btn.move_to_trash')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <Modal open={showModal} onClose={closeModal} dirty={JSON.stringify(form) !== snap} size="md" title={t('transfers.modal_title')}
        footer={<>
          <button type="button" onClick={closeModal} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={FORM_ID} disabled={createMutation.isPending} className={btnPrimary}>
            <Check size={15} /> {t('transfers.btn.record')}
          </button>
        </>}>
        <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
          <FormAlert message={formError} extra={otherErrors(errors, KNOWN)} />
          {/* The money leaves the "from" account, so that one warns about an overdraft */}
          <Field name="from_account_id" label={t('transfers.field.from_account')} required error={errors.from_account_id}>
            <PaymentAccountSelect id={fieldId('from_account_id')} accounts={activeAccounts} amount={form.amount}
              value={form.from_account_id} onChange={v => set('from_account_id', v)} error={errors.from_account_id}
              placeholder={t('transfers.field.select_from')} label={t('transfers.field.from_account')} />
          </Field>
          <Field name="to_account_id" label={t('transfers.field.to_account')} required error={errors.to_account_id}>
            <PaymentAccountSelect id={fieldId('to_account_id')} accounts={activeAccounts}
              value={form.to_account_id} onChange={v => set('to_account_id', v)} error={errors.to_account_id}
              placeholder={t('transfers.field.select_to')} label={t('transfers.field.to_account')} />
          </Field>
          <FormRow>
            <Field name="amount" label={t('transfers.field.amount')} required error={errors.amount}>
              <NumberInput id={fieldId('amount')} value={form.amount} prefix="৳" placeholder="0" error={errors.amount}
                onChange={v => set('amount', v)} />
            </Field>
            <Field name="transfer_date" label={t('transfers.field.date')} required error={errors.transfer_date}>
              <input id={fieldId('transfer_date')} type="date" value={form.transfer_date}
                onChange={e => set('transfer_date', e.target.value)} className={fieldClass(errors.transfer_date)} />
            </Field>
          </FormRow>
          <Field name="reference" label={t('transfers.field.reference')} error={errors.reference}>
            <input id={fieldId('reference')} value={form.reference} dir="auto" placeholder="TXN-12345"
              onChange={e => set('reference', e.target.value)} className={fieldClass(errors.reference)} />
          </Field>
          <Field name="notes" label={t('common:field.notes')} error={errors.notes}>
            <textarea id={fieldId('notes')} rows={2} dir="auto" value={form.notes}
              onChange={e => set('notes', e.target.value)} className={fieldClass(errors.notes)} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
