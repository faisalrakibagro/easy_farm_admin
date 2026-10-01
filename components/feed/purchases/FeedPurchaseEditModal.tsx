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
import type { Supplier, AccountingPaymentAccount } from '@/types';

const FORM_ID = 'feed-purchase-edit';

interface EditItem {
  id: number; name: string; quantity: string; unit_price: string; unit_symbol: string;
}

interface EditForm {
  supplier_id: string; supplier_name: string; supplier_phone: string; invoice_no: string;
  purchase_date: string; notes: string; payment_account_id: string; payment_status: string; paid_amount: string;
}

interface FeedPurchaseEditModalProps {
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  editForm: EditForm;
  setEditForm: React.Dispatch<React.SetStateAction<EditForm>>;
  editItems: EditItem[];
  setEditItems: React.Dispatch<React.SetStateAction<EditItem[]>>;
  editError: string;
  editErrors: Record<string, string[]>;
  suppliers: Supplier[];
  paymentAccounts: AccountingPaymentAccount[];
  isSaving: boolean;
}

export default function FeedPurchaseEditModal({
  onClose, onSubmit, editForm, setEditForm, editItems, setEditItems,
  editError, editErrors, suppliers, paymentAccounts, isSaving,
}: FeedPurchaseEditModalProps) {
  const { t } = useTranslation('feed');

  const err = (k: string) => editErrors[k]?.[0];
  useScrollToError(Object.fromEntries(Object.keys(editErrors).map(k => [k, err(k)])), editError);

  const [opened] = useState(() => JSON.stringify({ editForm, editItems }));
  const dirty = JSON.stringify({ editForm, editItems }) !== opened;
  const total = editItems.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0);

  return (
    <Modal onClose={onClose} dirty={dirty} size="2xl" title={t('purchases.edit_title')} subtitle={t('purchases.edit_note')}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>{t('common:btn.cancel')}</button>
        <button type="submit" form={FORM_ID} disabled={isSaving} className={btnPrimary}>
          <Check size={15} /> {t('purchases.btn.save_changes')}
        </button>
      </>}>
      <form id={FORM_ID} onSubmit={onSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-5">
        <FormAlert message={editError} extra={otherErrors(editErrors, ['supplier_id', 'supplier_name', 'supplier_phone', 'invoice_no', 'supplier_contact', 'purchase_date', 'payment_status', 'paid_amount', 'payment_account_id', 'notes', 'items.*'])} />

        <SupplierFields value={editForm} suppliers={suppliers} keepPhone
          onChange={patch => setEditForm(f => ({ ...f, ...patch }))}
          errors={{ supplier_name: err('supplier_name'), supplier_phone: err('supplier_phone'), invoice_no: err('invoice_no') }}
          labels={{
            supplier: t('purchases.field.supplier'), manual: t('purchases.field.manual_supplier'), name: t('purchases.field.supplier_name'),
            phone: t('purchases.field.supplier_phone'), invoice: t('purchases.field.invoice_no'),
          }}>
          <Field name="purchase_date" label={t('purchases.field.date')} required error={err('purchase_date')}>
            <input id={fieldId('purchase_date')} type="date" value={editForm.purchase_date}
              onChange={e => setEditForm(f => ({ ...f, purchase_date: e.target.value }))} className={fieldClass(err('purchase_date'))} />
          </Field>
        </SupplierFields>

        <PaymentFields value={editForm} total={total} accounts={paymentAccounts}
          onChange={patch => setEditForm(f => ({ ...f, ...patch }))}
          errors={{ paid_amount: err('paid_amount'), payment_account_id: err('payment_account_id') }}
          labels={{
            status: t('purchases.payment_status.label'), paid: t('purchases.payment_status.paid'), partial: t('purchases.payment_status.partial'),
            unpaid: t('purchases.payment_status.unpaid'), paidAmount: t('purchases.partial_amount_label'),
            paidAmountPlaceholder: t('purchases.placeholder.amount_now'), due: t('purchases.status.due'),
            account: t('purchases.field.account'), accountPlaceholder: t('purchases.select_account'),
          }} />

        <Field name="notes" label={t('common:field.notes')}>
          <textarea id={fieldId('notes')} rows={2} value={editForm.notes} dir="auto"
            onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} className={fieldClass()} />
        </Field>

        {/* Correct the unit prices of what was bought */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-600">{t('purchases.items')} — {t('purchases.edit_items_warning')}</p>
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{t('purchases.edit_price_hint')}</p>
          {firstErrorWithPrefix(editErrors, 'items.') && <p role="alert" className="text-xs text-red-600">{firstErrorWithPrefix(editErrors, 'items.')}</p>}
          <PriceCorrectionList
            rows={editItems}
            onPrice={(i, v) => setEditItems(prev => prev.map((x, idx) => (idx === i ? { ...x, unit_price: v } : x)))}
            labels={{ item: t('col.feed_item'), qty: t('col.qty'), unitPrice: t('purchases.col.unit_price_bdt'), total: t('purchases.col.total'), newTotal: t('purchases.new_total') }} />
        </div>
      </form>
    </Modal>
  );
}
