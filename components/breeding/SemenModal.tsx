'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import SearchSelect from '@/components/ui/SearchSelect';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import { otherErrors } from '@/lib/hooks/useFormErrors';
import { invalidateMoney } from '@/lib/invalidateGroups';
import type { AnimalType, SemenStraw } from '@/types';
import { AccountSelect, Field, FormActions, ModalShell, apiError, dateOnly, inputCls, money, todayStr, useBreedingLookups } from './shared';

const SHOWN = ['animal_type_id', 'bull_name', 'bull_code', 'breed', 'supplier_id', 'batch_no', 'quantity', 'cost_per_straw',
  'purchase_date', 'expiry_date', 'payment_status', 'paid_amount', 'payment_account_id', 'notes'];

/** Buy (create) or edit a semen batch. Stock/cost fields lock once a straw is used. */
export default function SemenModal({ onClose, semen }: { onClose: () => void; semen?: SemenStraw | null }) {
  const { t } = useTranslation('breeding');
  const qc = useQueryClient();
  const toast = useToast();
  const { accounts, defaultAccountId } = useBreedingLookups(true);
  const locked = !!semen && semen.remaining < semen.quantity;

  const { data: types } = useQuery({
    queryKey: ['animal-types-all'],
    queryFn: async () => (await api.get('/farm/animal-types/all')).data as AnimalType[],
  });
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: async () => ((await api.get('/suppliers/all')).data.suppliers ?? []) as { id: number; name: string }[],
  });

  const [form, setForm] = useState({
    animal_type_id: semen ? String(semen.animal_type_id) : '',
    bull_name: semen?.bull_name ?? '', bull_code: semen?.bull_code ?? '', breed: semen?.breed ?? '',
    supplier_id: semen?.supplier_id ? String(semen.supplier_id) : '', batch_no: semen?.batch_no ?? '',
    quantity: semen ? String(semen.quantity) : '', cost_per_straw: semen ? String(parseFloat(semen.cost_per_straw)) : '',
    purchase_date: semen ? dateOnly(semen.purchase_date) : todayStr(), expiry_date: dateOnly(semen?.expiry_date),
    payment_account_id: semen?.payment_account_id ? String(semen.payment_account_id) : defaultAccountId,
    payment_status: (semen?.payment_status ?? 'paid') as 'paid' | 'partial' | 'unpaid',
    paid_amount: semen && semen.payment_status === 'partial' ? String(parseFloat(semen.paid_amount)) : '',
    notes: semen?.notes ?? '',
  });
  const [opened] = useState(() => JSON.stringify(form));
  const dirty = JSON.stringify(form) !== opened;
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const set = (k: keyof typeof form, v: string) => { setForm(f => ({ ...f, [k]: v })); setFields(p => ({ ...p, [k]: '' })); };
  const total = (parseInt(form.quantity || '0') || 0) * (parseFloat(form.cost_per_straw || '0') || 0);
  const accountId = form.payment_account_id || defaultAccountId;
  const paidNow = form.payment_status === 'paid' ? total : form.payment_status === 'unpaid' ? 0 : (parseFloat(form.paid_amount || '0') || 0);
  const dueNow = Math.max(0, total - paidNow);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        payment_account_id: paidNow > 0 ? accountId : null,
        paid_amount: form.payment_status === 'partial' ? form.paid_amount : null,
        supplier_id: form.supplier_id || null,
        expiry_date: form.expiry_date || null,
      };
      return semen ? api.put(`/farm/breeding/semen/${semen.id}`, payload) : api.post('/farm/breeding/semen', payload);
    },
    onSuccess: res => {
      toast.success(res?.data?.message ?? t('toast.saved'));
      invalidateMoney(qc, [['breeding'], ['breeding-semen-all']]);
      onClose();
    },
    onError: e => { const r = apiError(e, t('toast.failed')); setFields(r.fields); setError(Object.keys(r.fields).length ? '' : r.message); },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const f: Record<string, string> = {};
    if (!form.animal_type_id) f.animal_type_id = t('common:form.v.required');
    if (!form.bull_name.trim()) f.bull_name = t('common:form.v.required');
    if (!form.quantity) f.quantity = t('common:form.v.required');
    if (form.cost_per_straw === '') f.cost_per_straw = t('common:form.v.required');
    if (!form.purchase_date) f.purchase_date = t('common:form.v.date_required');
    if (paidNow > 0 && !accountId) f.payment_account_id = t('common:form.v.account_required');
    if (form.payment_status !== 'paid' && !form.supplier_id) f.supplier_id = t('hint.supplier_required');
    if (form.payment_status === 'partial' && (paidNow <= 0 || paidNow >= total)) f.paid_amount = t('hint.partial_amount');
    setFields(f);
    if (!Object.keys(f).length) mutation.mutate();
  };

  return (
    <ModalShell title={semen ? t('btn.edit') : t('btn.semen')} onClose={onClose} wide dirty={dirty}>
      <form onSubmit={submit} noValidate className="p-6 space-y-4">
        <FormAlert message={error} extra={otherErrors(fields, SHOWN)} />
        {locked && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{t('hint.semen_locked')}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field name="animal_type_id" label={t('field.animal_type')} error={fields.animal_type_id} required>
            <SearchSelect value={form.animal_type_id} disabled={locked} onChange={v => set('animal_type_id', v)} error={fields.animal_type_id}
              placeholder="—" label={t('field.animal_type')}
              options={(types ?? []).map(tp => ({ value: String(tp.id), label: tp.name }))} />
          </Field>
          <Field name="bull_name" label={t('field.bull_name')} error={fields.bull_name} required>
            <input value={form.bull_name} dir="auto" onChange={e => set('bull_name', e.target.value)} className={inputCls(!!fields.bull_name)} />
          </Field>
          <Field name="bull_code" label={t('field.bull_code')} error={fields.bull_code}>
            <input value={form.bull_code} dir="ltr" onChange={e => set('bull_code', e.target.value)} className={inputCls(!!fields.bull_code)} />
          </Field>
          <Field name="breed" label={t('field.breed')} error={fields.breed}>
            <input value={form.breed} dir="auto" onChange={e => set('breed', e.target.value)} className={inputCls(!!fields.breed)} />
          </Field>
          <Field name="supplier_id" label={t('field.supplier')} error={fields.supplier_id} required={form.payment_status !== 'paid'}>
            <SearchSelect value={form.supplier_id} disabled={locked} onChange={v => set('supplier_id', v)} error={fields.supplier_id} clearable
              placeholder="—" label={t('field.supplier')}
              options={(suppliers ?? []).map(s => ({ value: String(s.id), label: s.name }))} />
          </Field>
          <Field name="batch_no" label={t('field.batch_no')} error={fields.batch_no}>
            <input value={form.batch_no} dir="ltr" onChange={e => set('batch_no', e.target.value)} className={inputCls(!!fields.batch_no)} />
          </Field>
          <Field name="quantity" label={t('field.quantity')} error={fields.quantity} required>
            <NumberInput value={form.quantity} allowDecimal={false} disabled={locked} error={fields.quantity} onChange={v => set('quantity', v)} />
          </Field>
          <Field name="cost_per_straw" label={t('field.cost_per_straw')} error={fields.cost_per_straw} required>
            <NumberInput value={form.cost_per_straw} prefix="৳" placeholder="0" disabled={locked} error={fields.cost_per_straw} onChange={v => set('cost_per_straw', v)} />
          </Field>
          <Field name="purchase_date" label={t('field.purchase_date')} error={fields.purchase_date} required>
            <input type="date" value={form.purchase_date} max={todayStr()} disabled={locked} onChange={e => set('purchase_date', e.target.value)} className={inputCls(!!fields.purchase_date)} />
          </Field>
          <Field name="expiry_date" label={t('field.expiry_date')} error={fields.expiry_date}>
            <input type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} className={inputCls(!!fields.expiry_date)} />
          </Field>
        </div>

        {total > 0 && !locked && (
          <div className="rounded-xl border border-slate-200 p-3 sm:p-4 space-y-3">
            <p className="text-sm text-slate-600">{t('field.total')}: <span className="font-semibold text-slate-800">{money(total)}</span></p>
            <Field name="payment_status" label={t('field.payment_status')} error={fields.payment_status}>
              <div role="radiogroup" className="grid grid-cols-3 gap-2">
                {(['paid', 'partial', 'unpaid'] as const).map(st => (
                  <button key={st} type="button" role="radio" aria-checked={form.payment_status === st} onClick={() => set('payment_status', st)}
                    className={`px-2 py-2.5 sm:py-2 text-xs rounded-lg border font-medium ${form.payment_status === st ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                    {t('payment_status.' + st)}
                  </button>
                ))}
              </div>
            </Field>
            {form.payment_status === 'partial' && (
              <Field name="paid_amount" label={t('field.paid_amount')} error={fields.paid_amount} required>
                <NumberInput value={form.paid_amount} prefix="৳" error={fields.paid_amount} onChange={v => set('paid_amount', v)} />
              </Field>
            )}
            {paidNow > 0 && (
              <AccountSelect value={accountId} onChange={v => set('payment_account_id', v)} accounts={accounts}
                error={fields.payment_account_id} amount={paidNow} required />
            )}
            <p className="text-xs text-slate-500">
              {t('field.paid_amount')}: {money(paidNow)} · {t('field.due_amount')}: <span className={dueNow > 0 ? 'text-red-600 font-medium' : ''}>{money(dueNow)}</span>
            </p>
            <p className="text-xs text-slate-500">{dueNow > 0 ? t('hint.semen_credit') : t('hint.semen_payment')}</p>
          </div>
        )}

        <Field name="notes" label={t('field.notes')} error={fields.notes}>
          <textarea rows={2} value={form.notes} dir="auto" onChange={e => set('notes', e.target.value)} className={inputCls(!!fields.notes)} />
        </Field>
        <FormActions onCancel={onClose} saving={mutation.isPending} />
      </form>
    </ModalShell>
  );
}
