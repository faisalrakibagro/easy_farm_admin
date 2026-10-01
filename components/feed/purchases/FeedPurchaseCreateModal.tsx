'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Plus, Trash2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import NumberInput from '@/components/ui/NumberInput';
import SearchSelect from '@/components/ui/SearchSelect';
import FileAttachInput from '@/components/ui/FileAttachInput';
import SupplierFields from '@/components/purchases/SupplierFields';
import PaymentFields from '@/components/purchases/PaymentFields';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { useScrollToError, otherErrors, firstErrorWithPrefix } from '@/lib/hooks/useFormErrors';
import FormAlert from '@/components/ui/FormAlert';
import type { FeedItem, Supplier, AccountingPaymentAccount } from '@/types';
import { fmtMoney } from '@/lib/format';

const FORM_ID = 'feed-purchase-create';

interface PurchaseForm {
  supplier_id: string; supplier_name: string; supplier_phone: string; invoice_no: string;
  purchase_date: string; payment_account_id: string; payment_status: string; paid_amount: string;
}

interface PurchaseItem { feed_item_id: string; quantity: string; unit_price: string; }

interface FeedPurchaseCreateModalProps {
  onClose: () => void;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
  form: PurchaseForm;
  setForm: React.Dispatch<React.SetStateAction<PurchaseForm>>;
  notes: string;
  setNotes: (v: string) => void;
  items: PurchaseItem[];
  addItem: () => void;
  removeItem: (i: number) => void;
  updateItem: (i: number, key: keyof PurchaseItem, val: string) => void;
  totalCost: number;
  clientErrors: Record<string, string>;
  setClientErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  formErrors: Record<string, string[]>;
  formError: string;
  feedItems: FeedItem[];
  suppliers: Supplier[];
  paymentAccounts: AccountingPaymentAccount[];
  invoiceFile: File | null;
  setInvoiceFile: (f: File | null) => void;
  invoiceRef: React.RefObject<HTMLInputElement | null>;
  isSaving: boolean;
}

export default function FeedPurchaseCreateModal({
  onClose, onCancel, onSubmit, form, setForm, notes, setNotes, items, addItem, removeItem, updateItem,
  totalCost, clientErrors, setClientErrors, formErrors, formError, feedItems, suppliers, paymentAccounts,
  invoiceFile, setInvoiceFile, invoiceRef, isSaving,
}: FeedPurchaseCreateModalProps) {
  const { t } = useTranslation('feed');
  const { t: tc } = useTranslation('common');

  // Our own checks first, then the API's.
  const err = (k: string) => clientErrors[k] || formErrors[k]?.[0] || undefined;
  const allErrors = Object.fromEntries([...Object.keys(clientErrors), ...Object.keys(formErrors)].map(k => [k, err(k)]));
  useScrollToError(allErrors, formError);

  const [opened] = useState(() => JSON.stringify({ form, items, notes }));
  const dirty = JSON.stringify({ form, items, notes }) !== opened || !!invoiceFile;

  const clearErr = (k: string) => setClientErrors(p => (p[k] ? { ...p, [k]: '' } : p));

  return (
    <Modal onClose={onClose} dirty={dirty} title={t('purchases.create_title')} size="2xl"
      footer={<>
        <button type="button" onClick={onCancel} className={btnSecondary}>{t('common:btn.cancel')}</button>
        <button type="submit" form={FORM_ID} disabled={isSaving} className={btnPrimary}>
          <Check size={15} /> {t('purchases.btn.record')}
        </button>
      </>}>
      <form id={FORM_ID} onSubmit={onSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-5">
        <FormAlert message={formError} extra={otherErrors(formErrors, ['supplier_id', 'supplier_name', 'supplier_phone', 'invoice_no', 'supplier_contact', 'purchase_date', 'payment_status', 'paid_amount', 'payment_account_id', 'notes', 'items', 'items.*', 'receipt_file'])} />

        <SupplierFields value={form} suppliers={suppliers} nameRequired
          onChange={patch => { setForm(f => ({ ...f, ...patch })); Object.keys(patch).forEach(clearErr); }}
          errors={{ supplier_name: err('supplier_name'), supplier_phone: err('supplier_phone'), invoice_no: err('invoice_no') }}
          labels={{
            supplier: t('purchases.field.supplier'), manual: t('purchases.field.manual_supplier'), name: t('purchases.field.supplier_name'),
            phone: t('purchases.field.supplier_phone'), invoice: t('purchases.field.invoice_no'), autoFilled: tc('ui.auto_filled_editable'),
          }}>
          <Field name="purchase_date" label={t('purchases.field.date')} required error={err('purchase_date')}>
            <input id={fieldId('purchase_date')} type="date" value={form.purchase_date}
              onChange={e => { setForm(f => ({ ...f, purchase_date: e.target.value })); clearErr('purchase_date'); }}
              className={fieldClass(err('purchase_date'))} />
          </Field>
        </SupplierFields>

        {/* Items: a card each — the feed, then quantity and price side by side */}
        <Field name="items" label={t('purchases.field.item')} required error={err('items') ?? firstErrorWithPrefix(formErrors, 'items.')}>
          <div className="space-y-2">
            {items.map((item, i) => {
              const picked = feedItems.find(fi => String(fi.id) === item.feed_item_id);
              const line = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
              return (
                <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <SearchSelect className="flex-1 min-w-0" value={item.feed_item_id} label={t('purchases.field.item')}
                      placeholder={t('purchases.select_item')}
                      onChange={v => { updateItem(i, 'feed_item_id', v); clearErr('items'); }}
                      options={feedItems
                        .filter(fi => !items.some((it, idx) => idx !== i && String(it.feed_item_id) === String(fi.id)))
                        .map(fi => ({ value: String(fi.id), label: fi.name, sub: [fi.category?.name, fi.unit?.symbol].filter(Boolean).join(' · ') }))} />
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i)} aria-label={tc('ui.remove_item')}
                        className="shrink-0 p-2.5 sm:p-2 rounded-lg text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <NumberInput value={item.quantity} placeholder={tc('field.quantity')} suffix={picked?.unit?.symbol}
                      aria-label={tc('field.quantity')} onChange={v => { updateItem(i, 'quantity', v); clearErr('items'); }} />
                    <NumberInput value={item.unit_price} placeholder={t('purchases.placeholder.unit_price')} prefix="৳"
                      aria-label={t('purchases.placeholder.unit_price')} onChange={v => updateItem(i, 'unit_price', v)} />
                  </div>
                  {line > 0 && (
                    <p className="text-xs text-end text-slate-500">{t('purchases.item.subtotal')}: <span className="font-semibold text-slate-700">{fmtMoney(line)}</span></p>
                  )}
                </div>
              );
            })}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button type="button" onClick={addItem} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 py-1.5">
                <Plus size={15} /> {t('purchases.add_item')}
              </button>
              {totalCost > 0 && (
                <p className="text-sm text-slate-600">{t('purchases.col.total')}: <span className="font-bold text-slate-800">{fmtMoney(totalCost)}</span></p>
              )}
            </div>
          </div>
        </Field>

        <PaymentFields value={form} total={totalCost} accounts={paymentAccounts}
          onChange={patch => { setForm(f => ({ ...f, ...patch })); Object.keys(patch).forEach(clearErr); }}
          errors={{ paid_amount: err('paid_amount'), payment_account_id: err('payment_account_id') }}
          labels={{
            status: t('purchases.payment_status.label'), paid: t('purchases.payment_status.paid'), partial: t('purchases.payment_status.partial'),
            unpaid: t('purchases.payment_status.unpaid'), paidAmount: t('purchases.partial_amount_label'),
            paidAmountPlaceholder: t('purchases.placeholder.amount_now'), due: t('purchases.status.due'),
            account: t('purchases.field.account'), accountPlaceholder: t('purchases.select_account'),
          }} />

        <Field name="notes" label={t('common:field.notes')}>
          <textarea id={fieldId('notes')} rows={2} value={notes} dir="auto" onChange={e => setNotes(e.target.value)} className={fieldClass()} />
        </Field>

        <Field name="invoice_file" label={t('purchases.invoice_file_hint')}>
          <FileAttachInput file={invoiceFile} onChange={setInvoiceFile} inputRef={invoiceRef}
            labels={{ upload: t('common:btn.upload_invoice'), change: t('common:btn.change_file'), remove: tc('btn.remove_file') }} />
        </Field>
      </form>
    </Modal>
  );
}
