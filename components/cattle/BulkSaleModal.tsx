'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ShoppingCart, Printer } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import SearchSelect from '@/components/ui/SearchSelect';
import PaymentAccountSelect from '@/components/ui/PaymentAccountSelect';
import PaymentStatusPicker from '@/components/ui/PaymentStatusPicker';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { useScrollToError, otherErrors } from '@/lib/hooks/useFormErrors';
import type { Cattle, AccountingPaymentAccount } from '@/types';
import type { SaleInvoiceData } from './types';
import { localDateStr } from '@/lib/dates';
import { fmtMoney } from '@/lib/format';

const FORM_ID = 'bulk-sale';

interface CustomerOption { id: number; name: string; phone?: string }

interface BulkSaleModalProps {
  open: boolean;
  onCloseForm: () => void;
  onCloseSuccess: () => void;
  selectedIds: Set<number>;
  selectedCattleList: Cattle[];
  saleDate: string;
  setSaleDate: (v: string) => void;
  salePaymentAccountId: string;
  setSalePaymentAccountId: (v: string) => void;
  saleNotes: string;
  setSaleNotes: (v: string) => void;
  saleBuyerMode: 'existing' | 'new';
  setSaleBuyerMode: (v: 'existing' | 'new') => void;
  saleCustomerId: string;
  setSaleCustomerId: (v: string) => void;
  saleNewName: string;
  setSaleNewName: (v: string) => void;
  saleNewPhone: string;
  setSaleNewPhone: (v: string) => void;
  saleNewAddress: string;
  setSaleNewAddress: (v: string) => void;
  salePaymentStatus: 'paid' | 'partial' | 'unpaid';
  setSalePaymentStatus: (v: 'paid' | 'partial' | 'unpaid') => void;
  salePaidAmount: string;
  setSalePaidAmount: (v: string) => void;
  salePrices: Partial<Record<number, { price: string; weight: string }>>;
  setSalePrices: React.Dispatch<React.SetStateAction<Partial<Record<number, { price: string; weight: string }>>>>;
  saleBulkError: string;
  /** Field errors: sale_date, payment_account_id, customer_id, new_customer.*, paid_amount, notes, items.{n}.sale_price|sale_weight. */
  saleBulkErrors: Record<string, string>;
  setSaleBulkErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  saleBulkSaving: boolean;
  invoiceData: SaleInvoiceData | null;
  customersAll: CustomerOption[];
  paymentAccounts: AccountingPaymentAccount[];
  onSubmit: (e: React.FormEvent) => void;
  onPrintInvoice: () => void;
}

export default function BulkSaleModal(props: BulkSaleModalProps) {
  if (!props.open) return null;
  return props.invoiceData
    ? <SaleInvoice invoiceData={props.invoiceData} onClose={props.onCloseSuccess} onPrint={props.onPrintInvoice} />
    : <BulkSaleForm {...props} />;
}

/** After the sale: what was sold, with a print button. */
function SaleInvoice({ invoiceData, onClose, onPrint }: { invoiceData: SaleInvoiceData; onClose: () => void; onPrint: () => void }) {
  const { t } = useTranslation('cattle');
  const th = 'px-3 sm:px-4 py-2.5 text-xs font-semibold text-slate-600 whitespace-nowrap';
  const td = 'px-3 sm:px-4 py-2.5 whitespace-nowrap';

  return (
    <Modal onClose={onClose} dirty={false} size="2xl" title={t('bulk.sale.success_title')}
      icon={<Check size={18} className="text-green-500 shrink-0" />}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>{t('common:btn.close')}</button>
        <button type="button" onClick={onPrint} className={btnPrimary}>
          <Printer size={15} /> {t('bulk.sale.print_invoice_btn')}
        </button>
      </>}>
      <div className="px-4 sm:px-6 py-5 space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-green-700">{t('bulk.sale.success_count', { count: invoiceData.sold_count })}</p>
          <p className="text-xs text-green-600 mt-0.5">
            {t('bulk.sale.buyer_label')} {invoiceData.customer.name}{invoiceData.customer.phone ? ` (${invoiceData.customer.phone})` : ''}
            {invoiceData.customer.is_new && <span className="ms-2 bg-blue-100 text-blue-600 text-xs px-1.5 py-0.5 rounded-full">{t('bulk.sale.new_addition_badge')}</span>}
          </p>
        </div>
        <div className="border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className={`text-start ${th}`}>{t('bulk.sale.col_cattle')}</th>
                <th className={`text-end ${th}`}>{t('bulk.sale.col_sale_price')}</th>
                <th className={`text-end ${th}`}>{t('bulk.sale.col_paid')}</th>
                <th className={`text-end ${th}`}>{t('bulk.sale.col_due')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoiceData.sales.map(s => (
                <tr key={s.id}>
                  <td className={`${td} font-medium text-slate-800`}>{s.cattle.tag_number}{s.cattle.name ? ` (${s.cattle.name})` : ''}</td>
                  <td className={`${td} text-end text-slate-700`}>{fmtMoney(s.sale_price)}</td>
                  <td className={`${td} text-end text-green-600`}>{fmtMoney(s.paid_amount)}</td>
                  <td className={`${td} text-end text-red-500`}>{fmtMoney(s.due_amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200">
              <tr>
                <td className={`${td} text-xs font-bold text-slate-700`}>{t('common:total')}</td>
                <td className={`${td} text-end font-bold text-slate-800`}>{fmtMoney(invoiceData.total_revenue)}</td>
                <td className={`${td} text-end font-bold text-green-600`}>{fmtMoney(invoiceData.total_paid)}</td>
                <td className={`${td} text-end font-bold text-red-500`}>{fmtMoney(invoiceData.total_due)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </Modal>
  );
}

function BulkSaleForm({
  onCloseForm, selectedIds, selectedCattleList,
  saleDate, setSaleDate, salePaymentAccountId, setSalePaymentAccountId, saleNotes, setSaleNotes,
  saleBuyerMode, setSaleBuyerMode, saleCustomerId, setSaleCustomerId,
  saleNewName, setSaleNewName, saleNewPhone, setSaleNewPhone, saleNewAddress, setSaleNewAddress,
  salePaymentStatus, setSalePaymentStatus, salePaidAmount, setSalePaidAmount,
  salePrices, setSalePrices, saleBulkError, saleBulkErrors: errors, setSaleBulkErrors: setErrors, saleBulkSaving,
  customersAll, paymentAccounts, onSubmit,
}: BulkSaleModalProps) {
  const { t } = useTranslation('cattle');
  useScrollToError(errors, saleBulkError);

  const snapshot = JSON.stringify({
    saleDate, salePaymentAccountId, saleNotes, saleBuyerMode, saleCustomerId, saleNewName, saleNewPhone, saleNewAddress,
    salePaymentStatus, salePaidAmount, salePrices,
  });
  const [opened] = useState(snapshot);
  const dirty = snapshot !== opened;

  const clear = (...keys: string[]) => {
    if (keys.some(k => errors[k])) setErrors(p => { const n = { ...p }; keys.forEach(k => delete n[k]); return n; });
  };

  const totalAmt = selectedCattleList.reduce((s, c) => s + (parseFloat(salePrices[c.id]?.price || '0') || 0), 0);
  const paidAmt  = salePaymentStatus === 'paid' ? totalAmt : salePaymentStatus === 'unpaid' ? 0 : Math.min(parseFloat(salePaidAmount || '0') || 0, totalAmt);
  const dueAmt   = Math.max(0, totalAmt - paidAmt);

  const shown = ['sale_date', 'payment_account_id', 'customer_id', 'new_customer.name', 'new_customer.phone', 'new_customer.address',
    'payment_status', 'paid_amount', 'notes', ...selectedCattleList.flatMap((_, i) => [`items.${i}.sale_price`, `items.${i}.sale_weight`])];

  const pickMode = (mode: 'existing' | 'new') => {
    setSaleBuyerMode(mode); setSaleCustomerId(''); setSaleNewName(''); setSaleNewPhone(''); setSaleNewAddress('');
    if (mode === 'new') { setSalePaymentStatus('paid'); setSalePaidAmount(''); }
    clear('customer_id', 'new_customer.name', 'paid_amount');
  };

  return (
    <Modal onClose={onCloseForm} dirty={dirty} size="2xl"
      title={t('bulk.sale.title')} subtitle={t('bulk.sale.subtitle', { count: selectedIds.size })}
      icon={<ShoppingCart size={18} className="text-orange-500 shrink-0" />}
      footer={<>
        <span className="w-full sm:w-auto sm:me-auto text-xs text-slate-500">{t('bulk.sale.footer_count', { count: selectedIds.size })}</span>
        <button type="button" onClick={onCloseForm} className={btnSecondary}>{t('common:btn.cancel')}</button>
        <button type="submit" form={FORM_ID} disabled={saleBulkSaving} className={btnPrimary}>
          <Check size={15} /> {saleBulkSaving ? t('bulk.saving') : t('bulk.sale.submit_btn')}
        </button>
      </>}>
      <form id={FORM_ID} onSubmit={onSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
        <FormAlert message={saleBulkError} extra={otherErrors(errors, shown)} />

        {/* Selected animals */}
        <div className="bg-slate-50 rounded-xl px-3 sm:px-4 py-3">
          <p className="text-xs font-semibold text-slate-600 mb-2">{t('bulk.selected_animals_count', { count: selectedIds.size })}</p>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {selectedCattleList.map(c => (
              <span key={c.id} className="max-w-full truncate text-xs bg-orange-100 text-orange-700 font-medium px-2 py-0.5 rounded-full">
                {c.tag_number}{c.name ? ` (${c.name})` : ''}
              </span>
            ))}
          </div>
        </div>

        {/* Buyer */}
        <div className="border border-slate-200 rounded-xl p-3 sm:p-4 space-y-3">
          <div role="radiogroup" className="grid grid-cols-2 gap-2">
            {(['existing', 'new'] as const).map(mode => (
              <button key={mode} type="button" role="radio" aria-checked={saleBuyerMode === mode} onClick={() => pickMode(mode)}
                className={`px-2 py-2.5 sm:py-2 rounded-lg border-2 text-sm font-medium transition-colors ${saleBuyerMode === mode ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                {t(mode === 'existing' ? 'bulk.sale.buyer_mode.existing' : 'bulk.sale.buyer_mode.new')}
              </button>
            ))}
          </div>
          {saleBuyerMode === 'existing' ? (
            <Field name="customer_id" label={t('detail.modal.sell.f.buyer')} required error={errors.customer_id}>
              <SearchSelect id={fieldId('customer_id')} value={saleCustomerId} error={errors.customer_id}
                onChange={v => { setSaleCustomerId(v); clear('customer_id'); }}
                placeholder={t('bulk.sale.select_customer_placeholder')} label={t('bulk.sale.buyer_mode.existing')}
                options={customersAll.map(c => ({ value: String(c.id), label: c.name, sub: c.phone, keywords: c.phone }))} />
            </Field>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">{t('bulk.sale.new_customer_hint')}</p>
              <Field name="new_customer.name" label={t('detail.modal.sell.f.new_name')} required error={errors['new_customer.name']}>
                <input id={fieldId('new_customer.name')} value={saleNewName} dir="auto" aria-label={t('placeholder.buyer_name')}
                  onChange={e => { setSaleNewName(e.target.value); clear('new_customer.name'); }}
                  placeholder={t('placeholder.buyer_name')} className={fieldClass(errors['new_customer.name'])} />
              </Field>
              <FormRow>
                <Field name="new_customer.phone" error={errors['new_customer.phone']}>
                  <input id={fieldId('new_customer.phone')} type="tel" inputMode="tel" value={saleNewPhone} dir="ltr" aria-label={t('placeholder.buyer_phone')}
                    onChange={e => { setSaleNewPhone(e.target.value); clear('new_customer.phone'); }}
                    placeholder={t('placeholder.buyer_phone')} className={fieldClass(errors['new_customer.phone'])} />
                </Field>
                <Field name="new_customer.address" error={errors['new_customer.address']}>
                  <input id={fieldId('new_customer.address')} value={saleNewAddress} dir="auto" aria-label={t('placeholder.buyer_address')}
                    onChange={e => { setSaleNewAddress(e.target.value); clear('new_customer.address'); }}
                    placeholder={t('placeholder.buyer_address')} className={fieldClass(errors['new_customer.address'])} />
                </Field>
              </FormRow>
            </div>
          )}
        </div>

        <FormRow>
          <Field name="sale_date" label={t('bulk.sale.date_label')} required error={errors.sale_date}>
            <input id={fieldId('sale_date')} type="date" max={localDateStr()} value={saleDate}
              onChange={e => { setSaleDate(e.target.value); clear('sale_date'); }} className={fieldClass(errors.sale_date)} />
          </Field>
          <Field name="payment_account_id" label={t('bulk.sale.payment_account_label')} required error={errors.payment_account_id}>
            <PaymentAccountSelect id={fieldId('payment_account_id')} accounts={paymentAccounts} value={salePaymentAccountId}
              onChange={v => { setSalePaymentAccountId(v); clear('payment_account_id'); }} error={errors.payment_account_id}
              placeholder={t('bulk.sale.select_placeholder')} label={t('bulk.sale.payment_account_label')} />
          </Field>
        </FormRow>

        {/* Payment status */}
        <div className="border border-slate-200 rounded-xl p-3 sm:p-4 space-y-3">
          <Field name="payment_status" label={t('bulk.sale.payment_status_label')} required error={errors.payment_status}>
            {saleBuyerMode === 'new' ? (
              <p className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700 font-medium">
                <Check size={14} className="shrink-0" /> {t('bulk.sale.new_customer_paid_only_note')}
              </p>
            ) : (
              <PaymentStatusPicker id={fieldId('payment_status')} value={salePaymentStatus}
                onChange={v => { setSalePaymentStatus(v); setSalePaidAmount(''); clear('payment_status', 'paid_amount'); }}
                labels={{ paid: t('bulk.sale.payment_status.paid'), partial: t('bulk.sale.payment_status.partial'), unpaid: t('bulk.sale.payment_status.unpaid') }} />
            )}
          </Field>
          {saleBuyerMode !== 'new' && salePaymentStatus === 'partial' && (
            <Field name="paid_amount" label={t('bulk.sale.total_paid_label')} required error={errors.paid_amount}>
              <NumberInput id={fieldId('paid_amount')} value={salePaidAmount} prefix="৳" error={errors.paid_amount}
                onChange={v => { setSalePaidAmount(v); clear('paid_amount'); }} placeholder={t('placeholder.amount_paid')} />
            </Field>
          )}
        </div>

        {/* Price and weight of each animal — a card per animal, two boxes side by side */}
        <div className="space-y-2">
          {selectedCattleList.map((c, i) => {
            const pe = errors[`items.${i}.sale_price`];
            const we = errors[`items.${i}.sale_weight`];
            return (
              <div key={c.id} className={`border rounded-xl p-3 ${pe || we ? 'border-red-300' : 'border-slate-200'}`}>
                <p className="text-sm font-medium text-slate-800 truncate mb-2">
                  {c.tag_number}{c.name && <span className="text-xs font-normal text-slate-500"> · {c.name}</span>}
                </p>
                <div className="grid grid-cols-2 gap-2 [&>*]:min-w-0">
                  <Field name={`items.${i}.sale_price`} label={t('bulk.sale.col_sale_price')} required error={pe}>
                    <NumberInput id={fieldId(`items.${i}.sale_price`)} value={salePrices[c.id]?.price ?? ''} prefix="৳" error={pe} placeholder="0"
                      onChange={v => { setSalePrices(prev => ({ ...prev, [c.id]: { price: v, weight: prev[c.id]?.weight ?? '' } })); clear(`items.${i}.sale_price`); }} />
                  </Field>
                  <Field name={`items.${i}.sale_weight`} label={t('bulk.sale.col_weight')} error={we}>
                    <NumberInput id={fieldId(`items.${i}.sale_weight`)} value={salePrices[c.id]?.weight ?? ''} error={we}
                      placeholder={String(c.current_weight ?? c.purchase_weight ?? '')}
                      onChange={v => { setSalePrices(prev => ({ ...prev, [c.id]: { price: prev[c.id]?.price ?? '', weight: v } })); clear(`items.${i}.sale_weight`); }} />
                  </Field>
                </div>
              </div>
            );
          })}
        </div>

        {/* Totals */}
        {selectedCattleList.length > 0 && (
          <div className="bg-orange-50 rounded-xl px-4 py-3 space-y-1.5">
            <div className="flex justify-between gap-3 text-sm text-orange-700">
              <span>{t('bulk.sale.summary_total_label')}</span><span className="font-bold">{fmtMoney(totalAmt)}</span>
            </div>
            {salePaymentStatus !== 'paid' && (
              <>
                <div className="flex justify-between gap-3 text-sm text-green-600">
                  <span>{t('bulk.sale.col_paid')}</span><span className="font-semibold">{fmtMoney(paidAmt)}</span>
                </div>
                <div className="flex justify-between gap-3 text-sm text-red-500">
                  <span>{t('bulk.sale.col_due')}</span><span className="font-semibold">{fmtMoney(dueAmt)}</span>
                </div>
              </>
            )}
          </div>
        )}

        <Field name="notes" label={t('cattle:field.notes')} error={errors.notes}>
          <textarea id={fieldId('notes')} rows={2} value={saleNotes} dir="auto"
            onChange={e => { setSaleNotes(e.target.value); clear('notes'); }} className={fieldClass(errors.notes)} />
        </Field>
      </form>
    </Modal>
  );
}
