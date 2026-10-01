'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { HandCoins, Check } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { invalidateMoney } from '@/lib/invalidateGroups';
import type { AccountingPaymentAccount } from '@/types';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import PaymentAccountSelect from '@/components/ui/PaymentAccountSelect';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';
import { fmtNum } from '@/lib/format';

const FORM_ID = 'give-advance';
const KNOWN = ['amount', 'advance_date', 'payment_account_id', 'allocation_method', 'reason'];
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Hand an employee money ahead of salary. It is recorded as an advance (owed
 * back), and a later salary recovers it through "advance deduction" — never
 * the other way round.
 */
export default function GiveAdvanceModal({ employee, onClose }: {
  employee: { id: number; name: string };
  onClose: () => void;
}) {
  const { t } = useTranslation(['labour', 'common']);
  const qc = useQueryClient();
  const toast = useToast();

  const { data: accounts } = useQuery<{ payment_accounts: AccountingPaymentAccount[] }>({
    queryKey: ['accounting-payment-accounts'],
    queryFn: async () => (await api.get('/accounting/payment-accounts')).data,
  });
  const { data: detail } = useQuery<{ pending_advance: number }>({
    queryKey: ['employee-detail', String(employee.id)],
    queryFn: async () => (await api.get(`/farm/labour/employees/${employee.id}`)).data,
  });

  const defaultAccount = accounts?.payment_accounts.find(a => a.is_default)?.id?.toString() ?? '';
  const [form, setForm] = useState({ amount: '', advance_date: localToday(), payment_account_id: '', reason: '', allocation_method: 'equal' });
  const [opened] = useState(() => JSON.stringify(form));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const accountId = form.payment_account_id || defaultAccount;
  useScrollToError(errors, formError);

  const set = (key: keyof typeof form, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: '' }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!(parseFloat(form.amount) > 0)) errs.amount = t('employees.advance.amount_required');
    if (!form.advance_date) errs.advance_date = t('common:form.v.date_required');
    if (!accountId) errs.payment_account_id = t('employees.advance.account_required');
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      const res = await api.post(`/farm/labour/employees/${employee.id}/advance`, { ...form, payment_account_id: accountId, reason: form.reason || null });
      invalidateMoney(qc, [['employees'], ['employee-detail'], ['salary-history']]);
      toast.success(res.data?.message ?? t('employees.advance.saved'));
      onClose();
    } catch (err) {
      const { fields, message } = apiFieldErrors(err, t('employees.advance.failed'));
      setErrors(fields);
      if (!Object.keys(fields).length) setFormError(message);
      toast.error(message);
    } finally { setSaving(false); }
  };

  const pending = detail?.pending_advance ?? 0;

  return (
    <Modal onClose={onClose} dirty={JSON.stringify(form) !== opened} size="md"
      title={t('employees.advance.title', { name: employee.name })} subtitle={t('employees.advance.subtitle')}
      icon={<span className="grid place-items-center w-10 h-10 shrink-0 rounded-xl bg-amber-50 text-amber-600"><HandCoins size={19} /></span>}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>{t('common:btn.cancel')}</button>
        <button type="submit" form={FORM_ID} disabled={saving} className={btnPrimary}>
          <Check size={15} /> {t('employees.advance.submit')}
        </button>
      </>}>
      <form id={FORM_ID} onSubmit={submit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
        <FormAlert message={formError} extra={otherErrors(errors, KNOWN)} />
        <p className={`text-xs rounded-lg px-3 py-2 ${pending > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-500'}`}>
          {pending > 0 ? t('employees.advance.pending', { amount: fmtNum(pending, 2) }) : t('employees.advance.none_pending')}
        </p>
        <FormRow>
          <Field name="amount" label={t('employees.advance.amount')} required error={errors.amount}>
            <NumberInput id={fieldId('amount')} value={form.amount} prefix="৳" placeholder="0" data-autofocus error={errors.amount}
              onChange={v => set('amount', v)} />
          </Field>
          <Field name="advance_date" label={t('employees.advance.date')} required error={errors.advance_date}>
            <input id={fieldId('advance_date')} type="date" value={form.advance_date} max={localToday()}
              onChange={e => set('advance_date', e.target.value)} className={fieldClass(errors.advance_date)} />
          </Field>
        </FormRow>
        <Field name="payment_account_id" label={t('employees.salary_modal.payment_account')} required error={errors.payment_account_id}>
          <PaymentAccountSelect id={fieldId('payment_account_id')} accounts={accounts?.payment_accounts} amount={form.amount}
            value={accountId} onChange={v => set('payment_account_id', v)} error={errors.payment_account_id}
            placeholder={t('employees.salary_modal.select_account')} label={t('employees.salary_modal.payment_account')} />
        </Field>
        <Field name="allocation_method" label={t('allocation.label')} error={errors.allocation_method}>
          <select id={fieldId('allocation_method')} value={form.allocation_method} onChange={e => set('allocation_method', e.target.value)}
            className={fieldClass(errors.allocation_method)}>
            <option value="equal">{t('allocation.equal')}</option>
            <option value="weight_based">{t('allocation.weight_based')}</option>
          </select>
        </Field>
        <Field name="reason" label={t('employees.advance.reason')} error={errors.reason}>
          <textarea id={fieldId('reason')} rows={2} dir="auto" value={form.reason} onChange={e => set('reason', e.target.value)} className={fieldClass(errors.reason)} />
        </Field>
        <p className="text-xs text-slate-500">{t('employees.advance.how_it_works')}</p>
      </form>
    </Modal>
  );
}
