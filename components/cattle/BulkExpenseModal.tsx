'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/ui/Toast';
import { Check, Receipt } from 'lucide-react';
import api from '@/lib/api';
import type { Cattle, AccountingPaymentAccount } from '@/types';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import SearchSelect from '@/components/ui/SearchSelect';
import PaymentAccountSelect from '@/components/ui/PaymentAccountSelect';
import PaymentStatusPicker from '@/components/ui/PaymentStatusPicker';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { useScrollToError, otherErrors, apiFieldErrors } from '@/lib/hooks/useFormErrors';
import { normalizeNumber } from '@/lib/normalizeNumbers';
import { localDateStr } from '@/lib/dates';
import { invalidateMoney } from '@/lib/invalidateGroups';
import { failedMsg } from '@/lib/feedback';
import { fmtMoney } from '@/lib/format';

/**
 * Categories that can be charged to picked animals. Salary and labour have
 * their own pages (and feed/medicine/vaccine are not expenses), so they are
 * left out — the API refuses them too (Expense::PER_CATTLE_CATEGORIES).
 */
export const PER_CATTLE_CATEGORIES = ['transport', 'miscellaneous', 'fuel', 'maintenance', 'electricity', 'water', 'rent'];

/** equal / weight_based split a total; per_animal charges each animal the same amount. */
type SplitMode = 'equal' | 'weight_based' | 'per_animal';
type PaymentStatus = 'paid' | 'partial' | 'unpaid';

const FORM_ID = 'bulk-expense';
const SHOWN = ['category', 'expense_date', 'title', 'split_method', 'amount', 'payment_status', 'paid_amount', 'payment_account_id', 'description'];

interface Props {
  cattle: Cattle[];
  onClose: () => void;
  onSaved: () => void;
}

const num = (v: string) => parseFloat(normalizeNumber(v)) || 0;
const weightOf = (c: Cattle) => parseFloat(c.current_weight ?? '') || 0;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Each animal's share, the way the API divides it (the last one takes the rounding remainder). */
function shares(cattle: Cattle[], total: number, byWeight: boolean): number[] {
  const weights = cattle.map(c => (byWeight ? weightOf(c) : 1));
  const sum = weights.reduce((a, b) => a + b, 0);
  let given = 0;
  return weights.map((w, i) => {
    const amount = i === weights.length - 1 ? round2(total - given) : round2(sum > 0 ? (w / sum) * total : 0);
    given += amount;
    return amount;
  });
}

/**
 * "Add expense" from the cattle list: one expense (transport, a vet visit,
 * market fees…) charged only to the animals picked, so each animal's cost and
 * profit carry it. The money side is an ordinary expense on its category.
 */
export default function BulkExpenseModal({ cattle, onClose, onSaved }: Props) {
  const { t } = useTranslation('cattle');
  const qc = useQueryClient();
  const toast = useToast();

  const [category, setCategory] = useState(PER_CATTLE_CATEGORIES[0]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(localDateStr());
  const [mode, setMode] = useState<SplitMode>('equal');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<PaymentStatus>('paid');
  const [paid, setPaid] = useState('');
  const [accountId, setAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  useScrollToError(errors, formError);

  const snapshot = JSON.stringify({ category, title, date, mode, amount, status, paid, accountId, notes });
  const [opened] = useState(snapshot);
  const dirty = snapshot !== opened;

  const { data: accountsData } = useQuery<{ payment_accounts: AccountingPaymentAccount[] }>({
    queryKey: ['accounting-payment-accounts'],
    queryFn: async () => (await api.get('/accounting/payment-accounts')).data,
  });
  const accounts = accountsData?.payment_accounts ?? [];
  const account = accountId || accounts.find(a => a.is_default)?.id?.toString() || '';

  const count = cattle.length;
  const entered = num(amount);
  const total = mode === 'per_animal' ? round2(entered * count) : entered;
  const perAnimal = shares(cattle, total, mode === 'weight_based');
  const noWeight = mode === 'weight_based' ? cattle.filter(c => weightOf(c) <= 0) : [];
  // LRM keeps "৳700" in that order inside Arabic (RTL) text.
  const money = (n: number) => `‎${fmtMoney(n)}`;

  const clear = (key: string) => { if (errors[key]) setErrors(p => ({ ...p, [key]: '' })); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!date) e.expense_date = t('bulk.expense.validation.date');
    if (!title.trim()) e.title = t('bulk.expense.validation.title');
    if (entered <= 0) e.amount = t('bulk.expense.validation.amount');
    if (status === 'partial' && (num(paid) <= 0 || num(paid) >= total)) e.paid_amount = t('bulk.expense.validation.paid');
    if (status !== 'unpaid' && !account) e.payment_account_id = t('bulk.expense.validation.account');
    setErrors(e);
    return Object.keys(e).length === 0 && noWeight.length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setFormError('');
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await api.post('/farm/expenses', {
        category, title: title.trim(), amount: total, expense_date: date,
        cattle_ids: cattle.map(c => c.id),
        split_method: mode === 'weight_based' ? 'weight_based' : 'equal',
        payment_status: status,
        paid_amount: status === 'partial' ? num(paid) : undefined,
        payment_account_id: status === 'unpaid' ? undefined : account,
        description: notes || null,
      });
      invalidateMoney(qc, [['expenses'], ['expense-summary'], ['farm-cattle'], ['cattle']]);
      toast.success(res?.data?.message ?? t('bulk.expense.saved', { count }));
      onSaved();
    } catch (err) {
      const { fields, message } = apiFieldErrors(err, failedMsg());
      setErrors(fields);
      setFormError(Object.keys(fields).length ? '' : message);
    } finally {
      setSaving(false);
    }
  };

  const outflow = status === 'paid' ? total : status === 'partial' ? num(paid) : 0;

  return (
    <Modal onClose={onClose} dirty={dirty} size="2xl"
      title={t('bulk.expense.title')} subtitle={t('bulk.expense.subtitle', { count })}
      icon={<Receipt size={18} className="text-violet-500 shrink-0" />}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>{t('common:btn.cancel')}</button>
        <button type="submit" form={FORM_ID} disabled={saving || noWeight.length > 0} className={btnPrimary}>
          <Check size={15} /> {saving ? t('bulk.saving') : t('bulk.expense.submit', { total: money(total) })}
        </button>
      </>}>
      <form id={FORM_ID} onSubmit={submit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
        <FormAlert message={formError} extra={otherErrors(errors, SHOWN)} />

        <FormRow>
          <Field name="category" label={t('bulk.expense.category')} required error={errors.category}>
            <SearchSelect id={fieldId('category')} value={category} error={errors.category} label={t('bulk.expense.category')}
              onChange={v => { setCategory(v); clear('category'); }}
              options={PER_CATTLE_CATEGORIES.map(c => ({ value: c, label: t(`common:expense_category.${c}`) }))} />
          </Field>
          <Field name="expense_date" label={t('bulk.expense.date')} required error={errors.expense_date}>
            <input id={fieldId('expense_date')} type="date" value={date} max={localDateStr()}
              onChange={e => { setDate(e.target.value); clear('expense_date'); }} className={fieldClass(errors.expense_date)} />
          </Field>
        </FormRow>

        <Field name="title" label={t('bulk.expense.expense_title')} required error={errors.title}>
          <input id={fieldId('title')} value={title} dir="auto" data-autofocus
            onChange={e => { setTitle(e.target.value); clear('title'); }}
            placeholder={t('bulk.expense.title_placeholder')} className={fieldClass(errors.title)} />
        </Field>

        {/* How the money is divided */}
        <Field name="split_method" label={t('bulk.expense.split')} error={errors.split_method}>
          <div id={fieldId('split_method')} role="radiogroup" className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(['equal', 'weight_based', 'per_animal'] as SplitMode[]).map(m => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
                className={`text-start rounded-lg border-2 px-3 py-2 text-sm transition-colors ${mode === m ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                <span className="font-medium block">{t(`bulk.expense.split_${m}`)}</span>
                <span className="text-xs text-slate-500">{t(`bulk.expense.split_${m}_hint`)}</span>
              </button>
            ))}
          </div>
        </Field>

        <Field name="amount" required error={errors.amount}
          label={mode === 'per_animal' ? t('bulk.expense.amount_per_animal') : t('bulk.expense.amount_total')}
          hint={mode === 'per_animal' && entered > 0 ? t('bulk.expense.total_for', { count, total: money(total) }) : undefined}>
          <NumberInput id={fieldId('amount')} value={amount} prefix="৳" placeholder="0.00" error={errors.amount}
            onChange={v => { setAmount(v); clear('amount'); }} />
        </Field>

        {noWeight.length > 0 && (
          <p role="alert" className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ⚠ {t('bulk.expense.no_weight', { tags: noWeight.map(c => c.tag_number).join(', ') })}
          </p>
        )}

        {/* Each animal's share */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex justify-between gap-3 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
            <span>{t('bulk.expense.col_animal')}</span>
            <span>{t('bulk.expense.col_share')}</span>
          </div>
          <ul className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
            {cattle.map((c, i) => (
              <li key={c.id} className="flex justify-between gap-3 px-3 py-1.5 text-sm">
                <span className="text-slate-700 min-w-0 break-words">
                  {c.tag_number}{c.name ? ` — ${c.name}` : ''}
                  {mode === 'weight_based' && <span className="text-xs text-slate-400 ms-1.5">({weightOf(c) > 0 ? t('bulk.expense.kg', { kg: weightOf(c) }) : '—'})</span>}
                </span>
                <span className="shrink-0 font-medium text-slate-800 tabular-nums">{total > 0 ? money(perAnimal[i]) : '—'}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between gap-3 border-t border-slate-200 px-3 py-2 text-sm font-semibold">
            <span>{t('bulk.expense.total')}</span>
            <span className="tabular-nums">{money(total)}</span>
          </div>
        </div>

        {/* Payment */}
        <div className="bg-slate-50 rounded-xl p-3 sm:p-4 space-y-3">
          <Field name="payment_status" error={errors.payment_status}>
            <PaymentStatusPicker id={fieldId('payment_status')} value={status}
              onChange={s => { setStatus(s); setPaid(''); clear('paid_amount'); clear('payment_account_id'); }}
              labels={{ paid: t('bulk.expense.status_paid'), partial: t('bulk.expense.status_partial'), unpaid: t('bulk.expense.status_unpaid') }} />
          </Field>
          {status === 'partial' && (
            <Field name="paid_amount" label={t('bulk.expense.paid_now')} required error={errors.paid_amount}>
              <NumberInput id={fieldId('paid_amount')} value={paid} prefix="৳" placeholder="0.00" error={errors.paid_amount}
                onChange={v => { setPaid(v); clear('paid_amount'); }} />
            </Field>
          )}
          {status !== 'unpaid' && (
            <Field name="payment_account_id" label={t('bulk.expense.account')} required error={errors.payment_account_id}>
              <PaymentAccountSelect id={fieldId('payment_account_id')} accounts={accounts} value={account} amount={outflow}
                onChange={v => { setAccountId(v); clear('payment_account_id'); }} error={errors.payment_account_id}
                placeholder={t('bulk.expense.account_placeholder')} label={t('bulk.expense.account')} />
            </Field>
          )}
        </div>

        <Field name="description" label={t('common:field.notes')} error={errors.description}>
          <textarea id={fieldId('description')} rows={2} value={notes} dir="auto"
            onChange={e => { setNotes(e.target.value); clear('description'); }} className={fieldClass(errors.description)} />
        </Field>
      </form>
    </Modal>
  );
}
