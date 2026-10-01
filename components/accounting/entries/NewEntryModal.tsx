import { useState } from 'react';
import { Check } from 'lucide-react';
import type { AccountingPaymentAccount } from '@/types';
import { ENTRY_DEFAULT, type Account } from './shared';
import { accountName } from '@/lib/accountNames';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import SearchSelect from '@/components/ui/SearchSelect';
import PaymentAccountSelect from '@/components/ui/PaymentAccountSelect';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';
import { fmtNum } from '@/lib/format';

type EntryForm = typeof ENTRY_DEFAULT;

const FORM_ID = 'new-journal-entry';
const KNOWN = ['_global', 'account_id', 'amount', 'entry_date', 'description', 'source_type', 'payment_account_id'];

interface NewEntryModalProps {
  t: (key: string, opts?: Record<string, unknown>) => string;
  entryForm: EntryForm;
  setEntryForm: (updater: (f: EntryForm) => EntryForm) => void;
  entryErrors: Record<string, string>;
  setEntryErrors: (updater: (p: Record<string, string>) => Record<string, string>) => void;
  accounts: Account[];
  paymentAccounts: { payment_accounts: AccountingPaymentAccount[] } | undefined;
  isSavingEntry: boolean;
  /** Kept for the caller; the fields now style themselves. */
  inputCls?: (field: string) => string;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export default function NewEntryModal({
  t, entryForm, setEntryForm, entryErrors, setEntryErrors, accounts, paymentAccounts, isSavingEntry, onSubmit, onClose,
}: NewEntryModalProps) {
  const [opened] = useState(() => JSON.stringify(entryForm));
  const dirty = JSON.stringify(entryForm) !== opened;
  useScrollToError(entryErrors, entryErrors._global);

  const set = <K extends keyof EntryForm>(key: K, value: EntryForm[K]) => {
    setEntryForm(f => ({ ...f, [key]: value }));
    if (entryErrors[key]) setEntryErrors(p => ({ ...p, [key]: '' }));
  };

  const groupLabel = (type: string) => type === 'income' ? t('entries_ext.income_accounts_group') : t('entries_ext.expense_accounts_group');
  const accountOptions = accounts
    .filter(a => a.type === 'income' || a.type === 'expense')
    .sort((a, b) => (a.type === b.type ? 0 : a.type === 'income' ? -1 : 1))
    .map(a => ({ value: String(a.id), label: `${a.code} — ${accountName(a, t)}`, sub: groupLabel(a.type), keywords: a.code }));
  const isExpense = accounts.find(a => String(a.id) === entryForm.account_id)?.type === 'expense';

  return (
    <Modal onClose={onClose} dirty={dirty} size="md" title={t('entries.modal_title')}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>{t('common:btn.cancel')}</button>
        <button type="submit" form={FORM_ID} disabled={isSavingEntry} className={btnPrimary}>
          <Check size={15} /> {t('common:btn.save')}
        </button>
      </>}>
      <form id={FORM_ID} onSubmit={onSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
        <FormAlert message={entryErrors._global} extra={otherErrors(entryErrors, KNOWN)} />

        <Field name="account_id" label={t('entries.account_label')} required error={entryErrors.account_id}>
          <SearchSelect id={fieldId('account_id')} value={entryForm.account_id} onChange={v => set('account_id', v)}
            options={accountOptions} error={entryErrors.account_id}
            placeholder={t('entries_ext.select_account_placeholder')} label={t('entries.account_label')} />
        </Field>

        <FormRow>
          <Field name="amount" label={t('entries.field.amount')} required error={entryErrors.amount}>
            <NumberInput id={fieldId('amount')} value={entryForm.amount} prefix="৳" placeholder="0" error={entryErrors.amount}
              onChange={v => set('amount', v)} />
          </Field>
          <Field name="entry_date" label={t('entries.field.date')} required error={entryErrors.entry_date}>
            <input id={fieldId('entry_date')} type="date" value={entryForm.entry_date}
              onChange={e => set('entry_date', e.target.value)} className={fieldClass(entryErrors.entry_date)} />
          </Field>
        </FormRow>

        <Field name="description" label={t('entries.field.description')} required error={entryErrors.description}
          hint={<span className="block text-end">{fmtNum(entryForm.description.length)}/{fmtNum(500)}</span>}>
          <textarea id={fieldId('description')} rows={2} maxLength={500} dir="auto" value={entryForm.description}
            onChange={e => set('description', e.target.value)}
            placeholder={t('entries_ext.description_placeholder')} className={fieldClass(entryErrors.description)} />
        </Field>

        <Field name="source_type" label={t('entries.source_label')} error={entryErrors.source_type}>
          <select id={fieldId('source_type')} value={entryForm.source_type} onChange={e => set('source_type', e.target.value)}
            className={fieldClass(entryErrors.source_type)}>
            <option value="">{t('entries.source_none')}</option>
            <option value="revenue">{t('entries.source_revenue')}</option>
            <option value="investment">{t('entries.source_investment')}</option>
          </select>
        </Field>

        {/* An expense takes money out of the account, so warn when it would overdraw it */}
        <Field name="payment_account_id" label={t('entries_ext.payment_account_label')} error={entryErrors.payment_account_id}>
          <PaymentAccountSelect id={fieldId('payment_account_id')} accounts={paymentAccounts?.payment_accounts}
            value={entryForm.payment_account_id} onChange={v => set('payment_account_id', v)} error={entryErrors.payment_account_id}
            amount={isExpense ? entryForm.amount : undefined}
            placeholder={t('entries_ext.no_payment_account')} label={t('entries_ext.payment_account_label')} />
          {entryForm.payment_account_id && (
            <button type="button" onClick={() => set('payment_account_id', '')}
              className="mt-1 text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2">
              {t('common:select.clear')}
            </button>
          )}
        </Field>
      </form>
    </Modal>
  );
}
