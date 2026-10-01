'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import SupplierFields from '@/components/purchases/SupplierFields';
import PaymentFields from '@/components/purchases/PaymentFields';
import PriceCorrectionList from '@/components/purchases/PriceCorrectionList';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { useScrollToError, otherErrors, firstErrorWithPrefix } from '@/lib/hooks/useFormErrors';
import FormAlert from '@/components/ui/FormAlert';
import type { MedicinePurchase, AccountingPaymentAccount, Supplier } from '@/types';

const FORM_ID = 'medicine-purchase-edit';

interface MedicinePurchaseFull extends MedicinePurchase {
  payment_account_id?: number | null;
  payment_account?: AccountingPaymentAccount | null;
  payment_status?: 'paid' | 'partial' | 'unpaid';
  paid_amount?: string | number;
  due_amount?: string | number;
}

interface EditForm {
  supplier_id: string; supplier_name: string; supplier_phone: string; invoice_no: string;
  purchase_date: string; payment_account_id: string; payment_status: string; paid_amount: string; notes: string;
}

interface EditItem {
  id: number; name: string; batch_number: string; quantity: string;
  unit_price: string; unit_symbol: string; expiry_date: string;
}

interface EditModalProps {
  purchase: MedicinePurchaseFull | null;
  onClose: () => void;
  editForm: EditForm;
  setEditForm: React.Dispatch<React.SetStateAction<EditForm>>;
  editError: string;
  setEditError: React.Dispatch<React.SetStateAction<string>>;
  editErrors: Record<string, string>;
  setEditErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  editItems: EditItem[];
  setEditItems: React.Dispatch<React.SetStateAction<EditItem[]>>;
  suppliers: Supplier[];
  paymentAccounts: AccountingPaymentAccount[];
  isPending: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export default function EditModal(props: EditModalProps) {
  if (!props.purchase) return null;
  // Keyed per purchase, so "unsaved changes" starts fresh each time.
  return <EditForm key={props.purchase.id} {...props} />;
}

function EditForm({
  onClose, editForm, setEditForm, editError, editErrors, setEditErrors,
  editItems, setEditItems, suppliers, paymentAccounts, isPending, onSubmit,
}: EditModalProps) {
  const { t } = useTranslation('medicine');
  useScrollToError(editErrors, editError);

  const [opened] = useState(() => JSON.stringify({ editForm, editItems }));
  const dirty = JSON.stringify({ editForm, editItems }) !== opened;
  const total = editItems.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0);
  const clearErr = (...keys: string[]) => setEditErrors(p => (keys.some(k => p[k]) ? { ...p, ...Object.fromEntries(keys.map(k => [k, ''])) } : p));

  return (
    <Modal onClose={onClose} dirty={dirty} size="2xl" title={t('purchases.edit_title')} subtitle={t('purchases.edit_note')}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>{t('common:btn.cancel')}</button>
        <button type="submit" form={FORM_ID} disabled={isPending} className={btnPrimary}>
          <Check size={15} /> {t('purchases.btn.save_changes')}
        </button>
      </>}>
      <form id={FORM_ID} onSubmit={onSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-5">
        <FormAlert message={editError} extra={otherErrors(editErrors, ['supplier_id', 'supplier_name', 'supplier_phone', 'invoice_no', 'supplier_contact', 'purchase_date', 'payment_status', 'paid_amount', 'payment_account_id', 'notes', 'items.*'])} />

        <SupplierFields value={editForm} suppliers={suppliers} keepPhone
          onChange={patch => { setEditForm(f => ({ ...f, ...patch })); clearErr('supplier_contact', ...Object.keys(patch)); }}
          errors={{ supplier_name: editErrors.supplier_name, supplier_phone: editErrors.supplier_phone, invoice_no: editErrors.invoice_no, supplier_contact: editErrors.supplier_contact }}
          labels={{
            supplier: t('purchases.field.supplier'), manual: t('purchases.field.manual_supplier'), name: t('purchases.field.supplier_name'),
            phone: t('purchases.field.supplier_phone'), phoneHint: t('purchases.label.phone_or_invoice_hint'), invoice: t('purchases.field.invoice_no'),
          }}>
          <Field name="purchase_date" label={t('purchases.field.date')} required error={editErrors.purchase_date}>
            <input id={fieldId('purchase_date')} type="date" value={editForm.purchase_date}
              onChange={e => { setEditForm(f => ({ ...f, purchase_date: e.target.value })); clearErr('purchase_date'); }}
              className={fieldClass(editErrors.purchase_date)} />
          </Field>
        </SupplierFields>

        <PaymentFields value={editForm} total={total} accounts={paymentAccounts}
          onChange={patch => { setEditForm(f => ({ ...f, ...patch })); clearErr(...Object.keys(patch)); }}
          errors={{ paid_amount: editErrors.paid_amount, payment_account_id: editErrors.payment_account_id }}
          labels={{
            status: t('purchases.label.payment_status'), paid: t('purchases.label.paid_full'), partial: t('purchases.label.partial'),
            unpaid: t('purchases.label.unpaid'), paidAmount: t('purchases.label.paid_amount'),
            paidAmountPlaceholder: t('purchases.label.paid_amount_hint'), due: t('purchases.label.due'),
            account: t('purchases.field.account'), accountPlaceholder: t('purchases.field.select_account'),
          }} />

        <Field name="notes" label={t('common:field.notes')}>
          <textarea id={fieldId('notes')} rows={2} value={editForm.notes} dir="auto"
            onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} className={fieldClass()} />
        </Field>

        {/* Correct the unit prices of what was bought */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-600">{t('purchases.item.correct_unit_price')}</p>
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{t('purchases.item.recalc_warning')}</p>
          {firstErrorWithPrefix(editErrors, 'items.') && <p role="alert" className="text-xs text-red-600">{firstErrorWithPrefix(editErrors, 'items.')}</p>}
          <PriceCorrectionList
            rows={editItems.map(it => ({ ...it, sub: it.batch_number }))}
            onPrice={(i, v) => setEditItems(prev => prev.map((x, idx) => (idx === i ? { ...x, unit_price: v } : x)))}
            labels={{ item: t('purchases.col.medicine'), qty: t('col.qty'), unitPrice: t('purchases.col.unit_price_bdt'), total: t('purchases.col.total'), newTotal: t('purchases.new_total') }} />
        </div>
      </form>
    </Modal>
  );
}
