'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import SearchSelect from '@/components/ui/SearchSelect';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import { otherErrors } from '@/lib/hooks/useFormErrors';
import { invalidateMoney } from '@/lib/invalidateGroups';
import type { ByproductSale, CustomerType } from '@/types';
import { AccountSelect, Field, FormActions, ModalShell, apiError, dateOnly, inputCls, money, todayStr, useBreedingLookups } from '@/components/breeding/shared';
import { useByproducts } from './shared';

type CustomerOption = { id: number; name: string; company_name: string | null; customer_type_id: number | null };

const SHOWN = ['byproduct_id', 'sale_date', 'customer_id', 'buyer_name', 'unit_id', 'quantity', 'rate', 'period_from', 'period_to',
  'payment_status', 'paid_amount', 'payment_account_id', 'notes'];

/**
 * Record or edit a by-product sale. A per-animal product (wool) is shared out
 * to the animals by what they gave in the period; a farm product (dung) is
 * general farm income. Anything left unpaid is owed by the buyer.
 */
export default function ByproductSaleModal({ onClose, sale, productId }: {
  onClose: () => void; sale?: ByproductSale | null; productId?: number;
}) {
  const { t } = useTranslation('byproducts');
  const qc = useQueryClient();
  const toast = useToast();
  const { accounts, defaultAccountId } = useBreedingLookups(true);
  const { active, products, units } = useByproducts();

  const { data: customers } = useQuery({
    queryKey: ['customers-all', 'byproducts'],
    queryFn: async () => (await api.get('/customers/all')).data.customers as CustomerOption[],
  });
  const { data: types } = useQuery({
    queryKey: ['customer-types'],
    queryFn: async () => (await api.get('/customer-types')).data.customer_types as CustomerType[],
  });

  const [form, setForm] = useState({
    byproduct_id: sale ? String(sale.byproduct_id) : productId ? String(productId) : '',
    sale_date: sale ? dateOnly(sale.sale_date) : todayStr(),
    customer_id: sale?.customer_id ? String(sale.customer_id) : '',
    buyer_name: sale?.buyer_name ?? '',
    unit_id: sale ? String(sale.unit_id) : '',
    quantity: sale ? String(parseFloat(sale.quantity)) : '',
    rate: sale ? String(parseFloat(sale.rate)) : '',
    period_from: sale ? dateOnly(sale.period_from) : '',
    period_to: sale ? dateOnly(sale.period_to) : '',
    payment_status: (sale?.payment_status ?? 'paid') as 'paid' | 'partial' | 'unpaid',
    paid_amount: sale && sale.payment_status === 'partial' ? String(parseFloat(sale.paid_amount)) : '',
    payment_account_id: sale?.payment_account_id ? String(sale.payment_account_id) : '',
    notes: sale?.notes ?? '',
  });
  const [opened] = useState(() => JSON.stringify(form));
  const [newCustomer, setNewCustomer] = useState<{ company_name: string; name: string; phone: string } | null>(null);
  const dirty = JSON.stringify(form) !== opened || !!newCustomer;
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const set = (k: keyof typeof form, v: string) => { setForm(f => ({ ...f, [k]: v })); setFields(p => ({ ...p, [k]: '' })); };

  // Pick the first active product once the list arrives (no effect: derived).
  const productIdValue = form.byproduct_id || (active[0] ? String(active[0].id) : '');
  const product = products.find(p => String(p.id) === productIdValue);
  const perAnimal = product?.tracking === 'per_animal';
  const unitId = form.unit_id || (product ? String(product.unit_id) : '');
  const unit = units.find(u => String(u.id) === unitId);

  const amount = Math.round((parseFloat(form.quantity || '0') || 0) * (parseFloat(form.rate || '0') || 0) * 100) / 100;
  const paid = form.payment_status === 'paid' ? amount : form.payment_status === 'unpaid' ? 0 : (parseFloat(form.paid_amount || '0') || 0);
  const due = Math.max(0, Math.round((amount - paid) * 100) / 100);
  const accountId = form.payment_account_id || defaultAccountId;

  // Quick-add a buyer without leaving the form (typed as a dung / wool buyer).
  const addCustomer = useMutation({
    mutationFn: async () => {
      const slug = product?.slug === 'wool' ? 'wool-buyer' : 'dung-buyer';
      const buyerType = types?.find(tp => tp.slug === slug);
      const fd = new FormData();
      fd.append('name', newCustomer!.name.trim() || newCustomer!.company_name.trim());
      if (newCustomer!.company_name.trim()) fd.append('company_name', newCustomer!.company_name.trim());
      if (newCustomer!.phone.trim()) fd.append('phone', newCustomer!.phone.trim());
      if (buyerType) fd.append('customer_type_id', String(buyerType.id));
      return api.post('/customers', fd);
    },
    onSuccess: res => {
      const id = res.data.customer?.id;
      qc.invalidateQueries({ queryKey: ['customers-all'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      if (id) set('customer_id', String(id));
      setNewCustomer(null);
    },
    onError: e => setError(apiError(e, t('toast.failed')).message),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        byproduct_id: productIdValue,
        unit_id: unitId || null,
        customer_id: form.customer_id || null,
        period_from: perAnimal ? form.period_from || null : null,
        period_to: perAnimal ? form.period_to || null : null,
        paid_amount: form.payment_status === 'partial' ? form.paid_amount : null,
        payment_account_id: paid > 0 ? accountId : null,
      };
      return sale ? api.put(`/farm/byproducts/sales/${sale.id}`, payload) : api.post('/farm/byproducts/sales', payload);
    },
    onSuccess: res => {
      toast.success(res?.data?.message ?? t('toast.saved'));
      invalidateMoney(qc, [['byproducts'], ['customers'], ['cattle-byproduct-history'], ['cattle-ledger']]);
      onClose();
    },
    onError: e => { const r = apiError(e, t('toast.failed')); setFields(r.fields); setError(Object.keys(r.fields).length ? '' : r.message); },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const f: Record<string, string> = {};
    if (!productIdValue) f.byproduct_id = t('field.select_product');
    if (!form.sale_date) f.sale_date = t('common:form.v.date_required');
    if (due > 0 && !form.customer_id) f.customer_id = t('hint.credit_customer');
    if (!form.quantity) f.quantity = t('common:form.v.required');
    if (form.rate === '') f.rate = t('common:form.v.required');
    if (form.payment_status === 'partial' && (paid <= 0 || paid >= amount)) f.paid_amount = t('hint.partial_amount');
    if (paid > 0 && !accountId) f.payment_account_id = t('common:form.v.account_required');
    setFields(f);
    if (!Object.keys(f).length) mutation.mutate();
  };

  return (
    <ModalShell title={sale ? t('btn.edit') : t('btn.add_sale')} onClose={onClose} wide dirty={dirty}>
      <form onSubmit={submit} noValidate className="p-6 space-y-4">
        <FormAlert message={error} extra={otherErrors(fields, SHOWN)} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field name="byproduct_id" label={t('field.product')} error={fields.byproduct_id} required>
            <SearchSelect value={productIdValue} disabled={!!sale} error={fields.byproduct_id}
              onChange={v => { set('byproduct_id', v); set('unit_id', ''); }}
              placeholder={t('field.select_product')} label={t('field.product')}
              options={(sale ? products : active).map(p => ({ value: String(p.id), label: p.name }))} />
          </Field>
          <Field name="sale_date" label={t('field.sale_date')} error={fields.sale_date} required>
            <input type="date" value={form.sale_date} max={todayStr()} onChange={e => set('sale_date', e.target.value)} className={inputCls(!!fields.sale_date)} />
          </Field>
        </div>

        {/* Buyer */}
        <div className="space-y-2">
          <Field name="customer_id" label={t('field.customer')} error={fields.customer_id} required={due > 0}>
            <div className="flex gap-2">
              <SearchSelect value={form.customer_id} onChange={v => set('customer_id', v)} error={fields.customer_id} clearable
                placeholder={t('field.select_customer')} label={t('field.customer')} className="flex-1 min-w-0"
                options={(customers ?? []).map(c => ({
                  value: String(c.id),
                  label: c.company_name ? `${c.company_name} (${c.name})` : c.name,
                  keywords: `${c.name} ${c.company_name ?? ''}`,
                }))} />
              <button type="button" onClick={() => setNewCustomer({ company_name: '', name: '', phone: '' })}
                title={t('btn.new_customer')} aria-label={t('btn.new_customer')}
                className="flex-shrink-0 px-3 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"><Plus size={16} /></button>
            </div>
          </Field>
          {newCustomer && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input placeholder={t('field.company_name')} aria-label={t('field.company_name')} value={newCustomer.company_name} dir="auto"
                onChange={e => setNewCustomer(n => n && ({ ...n, company_name: e.target.value }))} className={inputCls()} />
              <input placeholder={t('field.buyer_name')} aria-label={t('field.buyer_name')} value={newCustomer.name} dir="auto"
                onChange={e => setNewCustomer(n => n && ({ ...n, name: e.target.value }))} className={inputCls()} />
              <div className="flex gap-2">
                <input placeholder={t('field.phone')} aria-label={t('field.phone')} value={newCustomer.phone} type="tel" inputMode="tel" dir="ltr"
                  onChange={e => setNewCustomer(n => n && ({ ...n, phone: e.target.value }))} className={inputCls()} />
                <button type="button" disabled={addCustomer.isPending || !(newCustomer.company_name.trim() || newCustomer.name.trim())}
                  onClick={() => addCustomer.mutate()}
                  className="flex-shrink-0 px-3 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">{t('btn.save')}</button>
              </div>
            </div>
          )}
          {!form.customer_id && (
            <Field name="buyer_name" label={t('field.buyer_name')} error={fields.buyer_name}>
              <input value={form.buyer_name} dir="auto" onChange={e => set('buyer_name', e.target.value)} className={inputCls(!!fields.buyer_name)} />
            </Field>
          )}
        </div>

        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4">
          <Field name="quantity" label={t('field.quantity')} error={fields.quantity} required>
            <NumberInput value={form.quantity} suffix={unit?.symbol} error={fields.quantity} onChange={v => set('quantity', v)} />
          </Field>
          <Field name="unit_id" label={t('field.unit')} error={fields.unit_id}>
            <SearchSelect value={unitId} onChange={v => set('unit_id', v)} error={fields.unit_id}
              placeholder={t('field.select_unit')} label={t('field.unit')}
              options={units.map(u => ({ value: String(u.id), label: u.symbol !== u.name ? `${u.name} (${u.symbol})` : u.name }))} />
          </Field>
          <Field name="rate" label={t('field.rate')} error={fields.rate} required>
            <NumberInput value={form.rate} prefix="৳" placeholder="0" error={fields.rate} onChange={v => set('rate', v)} />
          </Field>
          <div>
            <p className="block text-xs font-medium text-slate-600 mb-1">{t('field.amount')}</p>
            <p className="px-3 py-2.5 sm:py-2 text-sm font-semibold text-slate-800 bg-slate-50 rounded-lg">{money(amount)}</p>
          </div>
        </div>
        {unit && <p className="-mt-2 text-xs text-slate-500">{form.quantity || 0} {unit.symbol} × {money(form.rate || 0)}</p>}

        {perAnimal ? (
          <div className="rounded-xl border border-slate-200 p-3 sm:p-4 space-y-2">
            <p className="text-xs font-medium text-slate-600">{t('field.period')}</p>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
              <Field name="period_from" label={t('field.period_from')} error={fields.period_from}>
                <input type="date" value={form.period_from} max={todayStr()} onChange={e => set('period_from', e.target.value)} className={inputCls(!!fields.period_from)} />
              </Field>
              <Field name="period_to" label={t('field.period_to')} error={fields.period_to}>
                <input type="date" value={form.period_to} max={todayStr()} onChange={e => set('period_to', e.target.value)} className={inputCls(!!fields.period_to)} />
              </Field>
            </div>
            <p className="text-xs text-slate-500">{t('hint.period')}</p>
            <p className="text-xs text-sky-700">{t('hint.share')}</p>
          </div>
        ) : product ? (
          <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">{t('hint.farm_income')}</p>
        ) : null}

        <div className="rounded-xl border border-slate-200 p-3 sm:p-4 space-y-3">
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
          {paid > 0 && (
            <AccountSelect label={t('field.payment_account')} value={accountId} onChange={v => set('payment_account_id', v)} accounts={accounts} error={fields.payment_account_id} required />
          )}
          <p className="text-xs text-slate-500">
            {t('field.paid_amount')}: {money(paid)} · {t('field.due_amount')}: <span className={due > 0 ? 'text-red-600 font-medium' : ''}>{money(due)}</span>
          </p>
          {due > 0 && <p className="text-xs text-slate-500">{t('hint.credit')}</p>}
        </div>

        <Field name="notes" label={t('field.notes')} error={fields.notes}>
          <textarea rows={2} value={form.notes} dir="auto" onChange={e => set('notes', e.target.value)} className={inputCls(!!fields.notes)} />
        </Field>
        <FormActions onCancel={onClose} saving={mutation.isPending} label={t('btn.save')} />
      </form>
    </ModalShell>
  );
}
