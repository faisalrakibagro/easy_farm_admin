'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Plus, Trash2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import NumberInput from '@/components/ui/NumberInput';
import SearchSelect from '@/components/ui/SearchSelect';
import FileAttachInput from '@/components/ui/FileAttachInput';
import SupplierFields from '@/components/purchases/SupplierFields';
import PaymentFields from '@/components/purchases/PaymentFields';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { useScrollToError, otherErrors } from '@/lib/hooks/useFormErrors';
import FormAlert from '@/components/ui/FormAlert';
import type { Medicine, Supplier, AccountingPaymentAccount } from '@/types';
import { fmtMoney } from '@/lib/format';

const FORM_ID = 'medicine-purchase-create';

interface CreateForm {
  supplier_id: string; supplier_name: string; supplier_phone: string; invoice_no: string;
  purchase_date: string; payment_account_id: string; payment_status: string; paid_amount: string;
}

interface PurchaseItem {
  medicine_id: string; batch_number: string; quantity: string;
  unit_price: string; expiry_date: string; notes: string;
}

interface CreateModalProps {
  open: boolean;
  onClose: () => void;
  onCancel: () => void;
  formError: string;
  errors: Record<string, string>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  form: CreateForm;
  setForm: React.Dispatch<React.SetStateAction<CreateForm>>;
  notes: string;
  setNotes: (v: string) => void;
  items: PurchaseItem[];
  addItem: () => void;
  removeItem: (i: number) => void;
  updateItem: (i: number, key: keyof PurchaseItem, val: string) => void;
  totalCost: number;
  medicines: Medicine[];
  suppliers: Supplier[];
  paymentAccounts: AccountingPaymentAccount[];
  receiptFile: File | null;
  setReceiptFile: (f: File | null) => void;
  receiptRef: React.RefObject<HTMLInputElement | null>;
  isSaving: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export default function CreateModal(props: CreateModalProps) {
  if (!props.open) return null;
  return <CreateForm {...props} />;
}

function CreateForm({
  onClose, onCancel, formError, errors, setErrors, form, setForm, notes, setNotes,
  items, addItem, removeItem, updateItem, totalCost, medicines, suppliers, paymentAccounts,
  receiptFile, setReceiptFile, receiptRef, isSaving, onSubmit,
}: CreateModalProps) {
  const { t } = useTranslation('medicine');
  const { t: tc } = useTranslation('common');
  useScrollToError(errors, formError);

  const [opened] = useState(() => JSON.stringify({ form, items, notes }));
  const dirty = JSON.stringify({ form, items, notes }) !== opened || !!receiptFile;
  const clearErr = (...keys: string[]) => setErrors(p => (keys.some(k => p[k]) ? { ...p, ...Object.fromEntries(keys.map(k => [k, ''])) } : p));

  return (
    <Modal onClose={onClose} dirty={dirty} size="3xl" title={t('purchases.create_title')}
      footer={<>
        <button type="button" onClick={onCancel} className={btnSecondary}>{t('common:btn.cancel')}</button>
        <button type="submit" form={FORM_ID} disabled={isSaving} className={btnPrimary}>
          <Check size={15} /> {t('purchases.btn.record')}
        </button>
      </>}>
      <form id={FORM_ID} onSubmit={onSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-5">
        <FormAlert message={formError} extra={otherErrors(errors, ['supplier_id', 'supplier_name', 'supplier_phone', 'invoice_no', 'supplier_contact', 'purchase_date', 'payment_status', 'paid_amount', 'payment_account_id', 'notes', 'items', 'items.*', 'receipt_file'])} />

        <SupplierFields value={form} suppliers={suppliers}
          onChange={patch => { setForm(f => ({ ...f, ...patch })); clearErr('supplier_contact', ...Object.keys(patch)); }}
          errors={{ supplier_name: errors.supplier_name, supplier_phone: errors.supplier_phone, invoice_no: errors.invoice_no, supplier_contact: errors.supplier_contact }}
          labels={{
            supplier: t('purchases.field.supplier'), manual: t('purchases.field.manual_supplier'), name: t('purchases.field.supplier_name'),
            phone: t('purchases.field.supplier_phone'), phoneHint: t('purchases.label.phone_or_invoice_hint'),
            invoice: t('purchases.field.invoice_no'), autoFilled: t('purchases.label.auto_filled_editable'),
          }}>
          <Field name="purchase_date" label={t('purchases.field.date')} required error={errors.purchase_date}>
            <input id={fieldId('purchase_date')} type="date" value={form.purchase_date}
              onChange={e => { setForm(f => ({ ...f, purchase_date: e.target.value })); clearErr('purchase_date'); }}
              className={fieldClass(errors.purchase_date)} />
          </Field>
        </SupplierFields>

        {/* One card per medicine: which one, its batch and expiry, how much and at what price */}
        <Field name="items" label={t('purchases.field.medicine')} required error={errors.items}>
          <div className="space-y-2">
            {items.map((item, i) => {
              const med = medicines.find(m => String(m.id) === item.medicine_id);
              const line = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
              const set = (key: keyof PurchaseItem, v: string) => { updateItem(i, key, v); clearErr('items'); };
              return (
                <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">{t('purchases.item.label', { num: i + 1 })}</span>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i)}
                        className="inline-flex items-center gap-1 text-sm text-red-600 hover:bg-red-50 rounded-lg px-2 py-1.5">
                        <Trash2 size={14} /> {t('purchases.action.remove_item')}
                      </button>
                    )}
                  </div>
                  <SearchSelect value={item.medicine_id} onChange={v => set('medicine_id', v)} error={errors[`items.${i}.medicine_id`]}
                    placeholder={t('purchases.field.select_medicine')} label={t('purchases.field.medicine')}
                    options={medicines
                      .filter(m => !items.some((it, idx) => idx !== i && it.medicine_id === String(m.id)))
                      .map(m => ({ value: String(m.id), label: m.name, sub: m.unit?.symbol }))} />
                  <FormRow>
                    <Field name={`items.${i}.batch_number`} label={t('purchases.field.batch_no')} required error={errors[`items.${i}.batch_number`]}>
                      <input id={fieldId(`items.${i}.batch_number`)} value={item.batch_number} placeholder="BT-2024-01" autoComplete="off"
                        onChange={e => set('batch_number', e.target.value)} className={fieldClass(null, 'font-mono')} />
                    </Field>
                    <Field name={`items.${i}.expiry_date`} label={t('purchases.field.expiry_date')} error={errors[`items.${i}.expiry_date`]}>
                      <input id={fieldId(`items.${i}.expiry_date`)} type="date" value={item.expiry_date}
                        onChange={e => set('expiry_date', e.target.value)} className={fieldClass()} />
                    </Field>
                  </FormRow>
                  <div className="grid grid-cols-2 gap-2">
                    <Field name={`items.${i}.quantity`} label={t('purchases.field.quantity')} required error={errors[`items.${i}.quantity`]}>
                      <NumberInput value={item.quantity} placeholder="0" suffix={med?.unit?.symbol} onChange={v => set('quantity', v)} />
                    </Field>
                    <Field name={`items.${i}.unit_price`} label={t('purchases.field.unit_price')} required error={errors[`items.${i}.unit_price`]}>
                      <NumberInput value={item.unit_price} placeholder="0.00" prefix="৳" onChange={v => set('unit_price', v)} />
                    </Field>
                  </div>
                  {line > 0 && (
                    <p className="text-xs text-end text-slate-500">{t('purchases.item.subtotal')}: <span className="font-semibold text-slate-700">{fmtMoney(line)}</span></p>
                  )}
                </div>
              );
            })}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button type="button" onClick={addItem} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 py-1.5">
                <Plus size={15} /> {t('purchases.field.add_item')}
              </button>
              {totalCost > 0 && (
                <p className="text-sm text-slate-600">{t('purchases.grand_total')}: <span className="font-bold text-slate-800">{fmtMoney(totalCost)}</span></p>
              )}
            </div>
          </div>
        </Field>

        <PaymentFields value={form} total={totalCost} accounts={paymentAccounts}
          onChange={patch => { setForm(f => ({ ...f, ...patch })); clearErr(...Object.keys(patch)); }}
          errors={{ paid_amount: errors.paid_amount, payment_account_id: errors.payment_account_id }}
          labels={{
            status: t('purchases.label.payment_status'), paid: t('purchases.label.paid_full'), partial: t('purchases.label.partial'),
            unpaid: t('purchases.label.unpaid'), paidAmount: t('purchases.label.paid_amount'),
            paidAmountPlaceholder: t('purchases.label.paid_amount_hint'), due: t('purchases.label.due'),
            account: t('purchases.field.account'), accountPlaceholder: t('purchases.field.select_account'),
          }} />

        <Field name="notes" label={t('common:field.notes')}>
          <textarea id={fieldId('notes')} rows={2} value={notes} dir="auto" onChange={e => setNotes(e.target.value)} className={fieldClass()} />
        </Field>

        <Field name="receipt_file" label={t('purchases.receipt_file_hint')}>
          <FileAttachInput file={receiptFile} onChange={setReceiptFile} inputRef={receiptRef}
            labels={{ upload: t('purchases.action.upload_receipt'), change: t('purchases.action.change_file'), remove: tc('btn.remove_file') }} />
        </Field>
      </form>
    </Modal>
  );
}
