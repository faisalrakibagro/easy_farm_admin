import { useState } from 'react';
import { Check } from 'lucide-react';
import RecurringToggle from './RecurringToggle';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import NumberInput from '@/components/ui/NumberInput';
import SearchSelect from '@/components/ui/SearchSelect';
import PaymentAccountSelect from '@/components/ui/PaymentAccountSelect';
import PaymentStatusPicker from '@/components/ui/PaymentStatusPicker';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { useScrollToError, otherErrors } from '@/lib/hooks/useFormErrors';
import FormAlert from '@/components/ui/FormAlert';
import type { AccountingPaymentAccount } from '@/types';
import { CATEGORIES, type EditExpForm } from './types';

const FORM_ID = 'edit-expense';

interface EditExpenseModalProps {
  t: (key: string, opts?: Record<string, unknown>) => string;
  editForm: EditExpForm;
  setEditForm: (updater: (f: EditExpForm) => EditExpForm) => void;
  editFormError: string;
  editErrors: Record<string, string>;
  setEditErrors: (updater: (p: Record<string, string>) => Record<string, string>) => void;
  paymentAccountsData: { payment_accounts: AccountingPaymentAccount[] } | undefined;
  onSubmit: (e: React.FormEvent) => void;
  isSaving: boolean;
  onClose: () => void;
}

export default function EditExpenseModal({
  t, editForm, setEditForm, editFormError, editErrors, setEditErrors, paymentAccountsData, onSubmit, isSaving, onClose,
}: EditExpenseModalProps) {
  const [opened] = useState(() => JSON.stringify(editForm));
  const dirty = JSON.stringify(editForm) !== opened;
  useScrollToError(editErrors, editFormError);

  const set = <K extends keyof EditExpForm>(key: K, value: EditExpForm[K]) => {
    setEditForm(f => ({ ...f, [key]: value }));
    if (editErrors[key]) setEditErrors(p => ({ ...p, [key]: '' }));
  };

  return (
    <Modal onClose={onClose} dirty={dirty} title={t('expenses.modal.edit_title')}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>{t('common:btn.cancel')}</button>
        <button type="submit" form={FORM_ID} disabled={isSaving} className={btnPrimary}>
          <Check size={15} /> {t('expenses.modal.save')}
        </button>
      </>}>
      <form id={FORM_ID} onSubmit={onSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
        <FormAlert message={editFormError} extra={otherErrors(editErrors, ['category', 'expense_date', 'amount', 'title', 'allocation_method', 'payment_status', 'paid_amount', 'payment_account_id', 'description'])} />

        <Field name="category" label={t('expenses.field.category')}>
          <SearchSelect id={fieldId('category')} value={editForm.category} onChange={v => set('category', v)} label={t('expenses.field.category')}
            options={CATEGORIES.map(c => ({ value: c, label: t(`common:expense_category.${c}`, { defaultValue: c }) }))} />
        </Field>

        <FormRow>
          <Field name="expense_date" label={t('expenses.field.date')} required error={editErrors.expense_date}>
            <input id={fieldId('expense_date')} type="date" value={editForm.expense_date}
              onChange={e => set('expense_date', e.target.value)} className={fieldClass(editErrors.expense_date)} />
          </Field>
          <Field name="amount" label={t('expenses.field.amount')} required error={editErrors.amount}>
            <NumberInput id={fieldId('amount')} value={editForm.amount} prefix="৳" error={editErrors.amount}
              onChange={v => set('amount', v)} placeholder="0" />
          </Field>
        </FormRow>

        <Field name="title" label={t('expenses.field.title')} required error={editErrors.title}>
          <input id={fieldId('title')} type="text" value={editForm.title} dir="auto"
            onChange={e => set('title', e.target.value)} className={fieldClass(editErrors.title)} />
        </Field>

        <Field name="allocation_method" label={t('expenses.field.allocation_method')}>
          <SearchSelect id={fieldId('allocation_method')} value={editForm.allocation_method} onChange={v => set('allocation_method', v)}
            label={t('expenses.field.allocation_method')}
            options={[
              { value: 'equal', label: t('expenses.field.allocation_equal') },
              { value: 'weight_based', label: t('expenses.field.allocation_weight') },
              { value: 'hold', label: t('expenses.field.allocation_hold') },
            ]} />
        </Field>

        {/* Monthly or one-day cost — decides which animals share it */}
        <RecurringToggle checked={editForm.is_recurring} onChange={v => set('is_recurring', v)}
          category={editForm.category} date={editForm.expense_date} />

        <Field name="payment_status" label={t('expenses.label.payment_status')} required>
          <PaymentStatusPicker id={fieldId('payment_status')} value={editForm.payment_status}
            onChange={v => setEditForm(f => ({ ...f, payment_status: v, paid_amount: '' }))}
            labels={{ paid: t('expenses.label.payment_status_paid'), partial: t('expenses.label.payment_status_partial'), unpaid: t('expenses.label.payment_status_unpaid') }} />
        </Field>

        {editForm.payment_status === 'partial' && (
          <Field name="paid_amount" label={t('expenses.label.paid_amount')} required error={editErrors.paid_amount}>
            <NumberInput id={fieldId('paid_amount')} value={editForm.paid_amount} prefix="৳" error={editErrors.paid_amount}
              placeholder={t('expenses.placeholder.amount_now')} onChange={v => set('paid_amount', v)} />
          </Field>
        )}

        {editForm.payment_status !== 'unpaid' && (
          <Field name="payment_account_id" label={t('expenses.field.account')} required error={editErrors.payment_account_id}>
            <PaymentAccountSelect id={fieldId('payment_account_id')} accounts={paymentAccountsData?.payment_accounts}
              value={editForm.payment_account_id} onChange={v => set('payment_account_id', v)} error={editErrors.payment_account_id}
              placeholder={t('expenses.placeholder.select_account')} label={t('expenses.field.account')} />
          </Field>
        )}

        <Field name="description" label={t('common:field.notes')}>
          <textarea id={fieldId('description')} rows={2} value={editForm.description} dir="auto"
            onChange={e => set('description', e.target.value)} className={fieldClass()} />
        </Field>
      </form>
    </Modal>
  );
}
