'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ShoppingCart } from 'lucide-react';
import type { Cattle } from '@/types';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import SearchSelect from '@/components/ui/SearchSelect';
import PaymentAccountSelect from '@/components/ui/PaymentAccountSelect';
import PaymentStatusPicker from '@/components/ui/PaymentStatusPicker';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { useScrollToError } from '@/lib/hooks/useFormErrors';
import { localDateStr } from '@/lib/dates';
import { fmtNum } from '@/lib/format';

const FORM_ID = 'cattle-sell';

interface PaymentAccountOption { id: number; name: string; type: string; balance: number; is_default?: boolean }
interface CustomerOption { id: number; name: string; phone?: string }

interface SellModalProps {
  open: boolean;
  onClose: () => void;
  cattle: Cattle;
  totalCost: number;
  sellError: string;
  /** The server's per-field errors, shown under their fields. */
  serverErrors?: Record<string, string>;
  sellSaving: boolean;
  sellDate: string;
  setSellDate: (v: string) => void;
  sellPaymentAccountId: string;
  setSellPaymentAccountId: (v: string) => void;
  sellNotes: string;
  setSellNotes: (v: string) => void;
  sellBuyerMode: 'existing' | 'new';
  setSellBuyerMode: (v: 'existing' | 'new') => void;
  sellCustomerId: string;
  setSellCustomerId: (v: string) => void;
  sellNewName: string;
  setSellNewName: (v: string) => void;
  sellNewPhone: string;
  setSellNewPhone: (v: string) => void;
  sellNewAddress: string;
  setSellNewAddress: (v: string) => void;
  sellPaymentStatus: 'paid' | 'partial' | 'unpaid';
  setSellPaymentStatus: (v: 'paid' | 'partial' | 'unpaid') => void;
  sellPaidAmount: string;
  setSellPaidAmount: (v: string) => void;
  sellPrice: string;
  setSellPrice: (v: string) => void;
  sellWeight: string;
  setSellWeight: (v: string) => void;
  sellCustomers: CustomerOption[];
  paymentAccounts: PaymentAccountOption[];
  onSubmit: (e: React.FormEvent) => void;
}

export default function SellModal(props: SellModalProps) {
  if (!props.open) return null;
  return <SellFormModal {...props} />;
}

function SellFormModal({
  onClose, cattle, totalCost, sellError, sellSaving,
  sellDate, setSellDate, sellPaymentAccountId, setSellPaymentAccountId, sellNotes, setSellNotes,
  sellBuyerMode, setSellBuyerMode, sellCustomerId, setSellCustomerId,
  sellNewName, setSellNewName, sellNewPhone, setSellNewPhone, sellNewAddress, setSellNewAddress,
  sellPaymentStatus, setSellPaymentStatus, sellPaidAmount, setSellPaidAmount,
  sellPrice, setSellPrice, sellWeight, setSellWeight,
  sellCustomers, paymentAccounts, onSubmit,
  serverErrors,
}: SellModalProps) {
  const { t } = useTranslation('cattle');
  const [localErrors, setErrors] = useState<Record<string, string>>({});
  // Server errors show until their field is edited (an edit sets the local entry to '').
  const errors: Record<string, string> = { ...serverErrors, ...localErrors };
  const snapshot = () => JSON.stringify([sellDate, sellPaymentAccountId, sellNotes, sellBuyerMode, sellCustomerId, sellNewName,
    sellNewPhone, sellNewAddress, sellPaymentStatus, sellPaidAmount, sellPrice, sellWeight]);
  const [opened] = useState(snapshot);
  const dirty = snapshot() !== opened;
  useScrollToError(errors, sellError);

  /** Set a value and drop its field's error. */
  const edit = (field: string, setter: (v: string) => void) => (v: string) => {
    setter(v);
    if (errors[field]) setErrors(p => ({ ...p, [field]: '' }));
  };

  // The same checks the page makes, each under its own field.
  const submit = (e: React.FormEvent) => {
    const errs: Record<string, string> = {};
    if (sellBuyerMode === 'existing' && !sellCustomerId) errs.customer_id = t('detail.modal.sell.validation.buyer_required');
    if (sellBuyerMode === 'new' && !sellNewName.trim()) errs['new_customer.name'] = t('detail.modal.sell.validation.new_buyer_name_required');
    if (!sellDate) errs.sale_date = t('detail.modal.sell.validation.date_required');
    else if (sellDate > localDateStr()) errs.sale_date = t('common:form.v.date_not_future');
    if (!sellPaymentAccountId) errs.payment_account_id = t('detail.modal.sell.validation.account_required');
    if (!sellPrice || parseFloat(sellPrice) <= 0) errs.sale_price = t('detail.modal.sell.validation.price_required');
    if (sellPaymentStatus === 'partial' && (!sellPaidAmount || parseFloat(sellPaidAmount) <= 0)) {
      errs.paid_amount = t('detail.modal.sell.validation.partial_amount_required');
    } else if (sellPaymentStatus === 'partial' && parseFloat(sellPaidAmount) >= parseFloat(sellPrice)) {
      errs.paid_amount = t('common:form.v.partial_range');
    }
    if (Object.keys(errs).length) { e.preventDefault(); setErrors(errs); return; }
    setErrors({});
    onSubmit(e);
  };

  const price = parseFloat(sellPrice);

  return (
    <Modal onClose={onClose} dirty={dirty} size="lg" title={t('detail.modal.sell.title', { tag: cattle.tag_number })}
      icon={<ShoppingCart size={18} className="text-orange-500 shrink-0" />}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>{t('common:btn.cancel')}</button>
        <button type="submit" form={FORM_ID} disabled={sellSaving} className={btnPrimary}>
          <Check size={15} /> {t('detail.modal.sell.confirm_btn')}
        </button>
      </>}>
      <form id={FORM_ID} onSubmit={submit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
        <FormAlert message={sellError} />

        {/* Buyer */}
        <div className="border border-slate-200 rounded-xl p-3 sm:p-4 space-y-3">
          <div role="radiogroup" className="grid grid-cols-2 gap-2">
            {(['existing', 'new'] as const).map(mode => (
              <button key={mode} type="button" role="radio" aria-checked={sellBuyerMode === mode}
                onClick={() => {
                  setSellBuyerMode(mode); setSellCustomerId(''); setSellNewName(''); setSellNewPhone(''); setSellNewAddress('');
                  setErrors(p => ({ ...p, customer_id: '', 'new_customer.name': '' }));
                }}
                className={`px-3 py-2.5 sm:py-2 rounded-lg border-2 text-sm font-medium transition-colors ${sellBuyerMode === mode ? 'bg-orange-50 border-orange-400 text-orange-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                {mode === 'existing' ? t('detail.modal.sell.buyer_existing') : t('detail.modal.sell.buyer_new')}
              </button>
            ))}
          </div>
          {sellBuyerMode === 'existing' ? (
            <Field name="customer_id" label={t('detail.modal.sell.f.buyer')} required error={errors.customer_id}>
              <SearchSelect id={fieldId('customer_id')} value={sellCustomerId} onChange={edit('customer_id', setSellCustomerId)}
                placeholder={t('detail.modal.sell.select_buyer_option')} label={t('detail.modal.sell.f.buyer')} error={errors.customer_id}
                options={sellCustomers.map(c => ({ value: String(c.id), label: c.name, sub: c.phone, keywords: c.phone }))} />
            </Field>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">{t('detail.modal.sell.new_buyer_hint')}</p>
              <Field name="new_customer.name" label={t('detail.modal.sell.f.new_name')} required error={errors['new_customer.name']}>
                <input id={fieldId('new_customer.name')} value={sellNewName} dir="auto"
                  onChange={e => edit('new_customer.name', setSellNewName)(e.target.value)} className={fieldClass(errors['new_customer.name'])} />
              </Field>
              <FormRow>
                <Field name="new_customer.phone" label={t('detail.modal.sell.f.new_phone')} error={errors['new_customer.phone']}>
                  <input id={fieldId('new_customer.phone')} type="tel" inputMode="tel" dir="ltr" value={sellNewPhone}
                    onChange={e => edit('new_customer.phone', setSellNewPhone)(e.target.value)} className={fieldClass(errors['new_customer.phone'])} />
                </Field>
                <Field name="new_customer.address" label={t('detail.modal.sell.f.new_address')}>
                  <input id={fieldId('new_customer.address')} value={sellNewAddress} dir="auto"
                    onChange={e => setSellNewAddress(e.target.value)} className={fieldClass()} />
                </Field>
              </FormRow>
            </div>
          )}
        </div>

        <FormRow>
          <Field name="sale_date" label={t('detail.modal.sell.f.sale_date')} required error={errors.sale_date}>
            <input id={fieldId('sale_date')} type="date" max={localDateStr()} value={sellDate}
              onChange={e => edit('sale_date', setSellDate)(e.target.value)} className={fieldClass(errors.sale_date)} />
          </Field>
          <Field name="payment_account_id" label={t('detail.modal.sell.f.payment_account')} required error={errors.payment_account_id}>
            <PaymentAccountSelect id={fieldId('payment_account_id')} accounts={paymentAccounts} value={sellPaymentAccountId}
              onChange={edit('payment_account_id', setSellPaymentAccountId)} error={errors.payment_account_id}
              placeholder={t('detail.modal.sell.select_option')} label={t('detail.modal.sell.f.payment_account')} />
          </Field>
          <Field name="sale_price" label={t('detail.modal.sell.f.sale_price')} required error={errors.sale_price}>
            <NumberInput id={fieldId('sale_price')} value={sellPrice} prefix="৳" placeholder="0" error={errors.sale_price}
              onChange={edit('sale_price', setSellPrice)} />
          </Field>
          <Field name="sale_weight" label={t('detail.modal.sell.sale_weight_label')} error={errors.sale_weight}>
            <NumberInput id={fieldId('sale_weight')} value={sellWeight} error={errors.sale_weight}
              placeholder={String(cattle.current_weight ?? cattle.purchase_weight ?? '')} onChange={edit('sale_weight', setSellWeight)} />
          </Field>
        </FormRow>

        <div className="border border-slate-200 rounded-xl p-3 sm:p-4 space-y-3">
          <Field name="payment_status" label={t('detail.modal.sell.f.payment_status')} required>
            <PaymentStatusPicker id={fieldId('payment_status')} value={sellPaymentStatus}
              onChange={v => { setSellPaymentStatus(v); setSellPaidAmount(''); setErrors(p => ({ ...p, paid_amount: '' })); }}
              labels={{ paid: t('detail.modal.sell.status_paid'), partial: t('detail.modal.sell.status_partial'), unpaid: t('detail.modal.sell.status_unpaid') }} />
          </Field>
          {sellPaymentStatus === 'partial' && (
            <Field name="paid_amount" label={t('detail.modal.sell.f.paid_amount')} required error={errors.paid_amount}>
              <NumberInput id={fieldId('paid_amount')} value={sellPaidAmount} prefix="৳" error={errors.paid_amount}
                placeholder={t('placeholder.amount_paid')} onChange={edit('paid_amount', setSellPaidAmount)} />
            </Field>
          )}
        </div>

        {/* Profit preview */}
        {price > 0 && (
          <div className={`rounded-xl px-4 py-3 text-sm font-medium ${price >= Number(totalCost) ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {price >= Number(totalCost)
              ? t('detail.modal.sell.est_profit', { amount: fmtNum(price - Number(totalCost), 2) })
              : t('detail.modal.sell.est_loss', { amount: fmtNum(Number(totalCost) - price, 2) })}
            <span className="ms-2 font-normal text-xs opacity-70">{t('detail.modal.sell.total_cost_paren', { cost: fmtNum(totalCost, 2) })}</span>
          </div>
        )}

        <Field name="notes" label={t('cattle:field.notes')}>
          <textarea id={fieldId('notes')} rows={2} value={sellNotes} dir="auto"
            onChange={e => setSellNotes(e.target.value)} className={fieldClass()} />
        </Field>
      </form>
    </Modal>
  );
}
