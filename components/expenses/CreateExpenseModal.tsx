import { useState } from 'react';
import { Check, User, Wrench, CopyPlus } from 'lucide-react';
import RecurringToggle from './RecurringToggle';
import ReceiptScan from './ReceiptScan';
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
import { normalizeNumber } from '@/lib/normalizeNumbers';
import type { AccountingPaymentAccount } from '@/types';
import { CATEGORIES, type ExpForm, type EmployeeOption, type DailyLabourOption } from './types';
import { localeFor } from '@/lib/languages';
import { fmtMoney } from '@/lib/format';

const FORM_ID = 'create-expense';

interface CreateExpenseModalProps {
  t: (key: string, opts?: Record<string, unknown>) => string;
  form: ExpForm;
  setForm: (updater: (f: ExpForm) => ExpForm) => void;
  formError: string;
  errors: Record<string, string>;
  setErrors: (updater: (p: Record<string, string>) => Record<string, string>) => void;
  isSaving: boolean;
  handleCategoryChange: (cat: string) => void;
  handleEmployeeSelect: (id: string) => void;
  handleDailyLabourSelect: (id: string) => void;
  employeesData: { employees: EmployeeOption[] } | undefined;
  empLoading: boolean;
  unpaidLabourData: { data: DailyLabourOption[] } | undefined;
  labourLoading: boolean;
  paymentAccountsData: { payment_accounts: AccountingPaymentAccount[] } | undefined;
  onClose: () => void;
  /** The pressed button is `e.nativeEvent.submitter`; "save & add another" carries data-again. */
  onSubmit: (e: React.FormEvent) => void;
}

export default function CreateExpenseModal({
  t, form, setForm, formError, errors, setErrors, isSaving,
  handleCategoryChange, handleEmployeeSelect, handleDailyLabourSelect,
  employeesData, empLoading, unpaidLabourData, labourLoading,
  paymentAccountsData, onClose, onSubmit,
}: CreateExpenseModalProps) {
  const salaryBlocked = form.category === 'salary' && !empLoading && !employeesData?.employees.length;
  const labourBlocked = form.category === 'labour' && !labourLoading && !unpaidLabourData?.data.length;
  const loadingPicker = (form.category === 'salary' && empLoading) || (form.category === 'labour' && labourLoading);
  const blocked = salaryBlocked || labourBlocked;
  const linked = (form.category === 'salary' && !!form.labour_employee_id) || (form.category === 'labour' && !!form.daily_labour_id);

  // What the form looked like when it opened — anything else is unsaved work.
  const [opened] = useState(() => JSON.stringify(form));
  const dirty = JSON.stringify(form) !== opened;

  useScrollToError(errors, formError);
  const set = <K extends keyof ExpForm>(key: K, value: ExpForm[K]) => {
    setForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: '' }));
  };

  return (
    <Modal onClose={onClose} dirty={dirty} title={t('expenses.modal_title')}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>{t('common:btn.cancel')}</button>
        {!blocked && !loadingPicker && (
          <>
            <button type="submit" form={FORM_ID} data-again="1" disabled={isSaving} className={btnSecondary}>
              <CopyPlus size={15} /> {t('common:form.save_add_another')}
            </button>
            <button type="submit" form={FORM_ID} disabled={isSaving} className={btnPrimary}>
              <Check size={15} /> {t('expenses.btn.record_allocate')}
            </button>
          </>
        )}
      </>}>
      <form id={FORM_ID} onSubmit={onSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
        <FormAlert message={formError} extra={otherErrors(errors, ['category', 'labour_employee_id', 'daily_labour_id', 'expense_date', 'amount', 'title', 'allocation_method', 'payment_status', 'paid_amount', 'payment_account_id', 'description'])} />

        {/* AI: fill the form from a receipt photo (hidden while switched off) */}
        <ReceiptScan setForm={setForm} />

        <Field name="category" label={t('expenses.field.category')}>
          <SearchSelect id={fieldId('category')} value={form.category} onChange={handleCategoryChange} label={t('expenses.field.category')}
            options={CATEGORIES.map(c => ({ value: c, label: t(`common:expense_category.${c}`, { defaultValue: c }) }))} />
        </Field>

        {/* SALARY blocked — no active employees */}
        {salaryBlocked && (
          <div className="rounded-xl p-5 bg-red-50 border border-red-200 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-red-700 font-semibold">{t('expenses.label.no_active_employees')}</p>
            <p className="text-xs text-red-500">{t('expenses.error.add_employee_first')}</p>
            <a href="/farm/labour/employees" className="text-sm px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
              {t('expenses.labour_picker.go_to_employees')}
            </a>
          </div>
        )}

        {/* LABOUR blocked — no unpaid daily labour */}
        {labourBlocked && (
          <div className="rounded-xl p-5 bg-red-50 border border-red-200 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-red-700 font-semibold">{t('expenses.error.no_unpaid_labour')}</p>
            <p className="text-xs text-red-500">{t('expenses.error.add_unpaid_labour_first')}</p>
            <a href="/farm/labour/daily" className="text-sm px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
              {t('expenses.labour_picker.go_to_daily')}
            </a>
          </div>
        )}

        {loadingPicker && <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />}

        {!blocked && !loadingPicker && (
          <>
            {/* SALARY → Employee picker */}
            {form.category === 'salary' && (
              <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                <Field name="labour_employee_id" required error={errors.labour_employee_id} hint={t('expenses.salary_picker.hint')}
                  label={<span className="inline-flex items-center gap-1.5 text-indigo-700"><User size={12} /> {t('expenses.salary_picker.label')}</span>}>
                  <SearchSelect id={fieldId('labour_employee_id')} value={form.labour_employee_id} onChange={handleEmployeeSelect}
                    placeholder={t('expenses.salary_picker.placeholder')} label={t('expenses.salary_picker.label')} error={errors.labour_employee_id}
                    options={(employeesData?.employees ?? []).map(emp => ({
                      value: String(emp.id), label: `${emp.name} (${emp.employee_code})`, keywords: emp.employee_code,
                      sub: `${fmtMoney(emp.monthly_salary)}${t('expenses.salary_picker.per_month')}`,
                    }))} />
                </Field>
              </div>
            )}

            {/* LABOUR → Unpaid daily labour picker */}
            {form.category === 'labour' && (
              <div className="bg-teal-50 rounded-xl p-4 border border-teal-100">
                <Field name="daily_labour_id" required error={errors.daily_labour_id}
                  hint={form.daily_labour_id ? t('expenses.labour_picker.auto_paid_hint') : undefined}
                  label={<span className="inline-flex items-center gap-1.5 text-teal-700"><Wrench size={12} /> {t('expenses.labour_picker.label')}</span>}>
                  <SearchSelect id={fieldId('daily_labour_id')} value={form.daily_labour_id} onChange={handleDailyLabourSelect}
                    placeholder={t('expenses.labour_picker.placeholder')} label={t('expenses.labour_picker.label')} error={errors.daily_labour_id}
                    options={(unpaidLabourData?.data ?? []).map(dl => {
                      const total = parseFloat(dl.daily_wage) * (parseFloat(String(dl.working_hours)) || 1);
                      return {
                        value: String(dl.id), label: dl.name,
                        sub: `${new Date(dl.work_date + 'T00:00:00').toLocaleDateString(localeFor())} · ${fmtMoney(total)}`,
                      };
                    })} />
                </Field>
              </div>
            )}

            <FormRow>
              <Field name="expense_date" label={t('expenses.field.date')} required error={errors.expense_date}>
                <input id={fieldId('expense_date')} type="date" value={form.expense_date}
                  onChange={e => set('expense_date', e.target.value)} className={fieldClass(errors.expense_date)} />
              </Field>
              <Field name="amount" label={t('expenses.field.amount')} required error={errors.amount}>
                <NumberInput id={fieldId('amount')} value={form.amount} prefix="৳" error={errors.amount} data-autofocus
                  onChange={v => set('amount', v)} placeholder="0" />
              </Field>
            </FormRow>

            <Field name="title" label={t('expenses.field.title')} required error={errors.title}>
              <input id={fieldId('title')} type="text" value={form.title} dir="auto"
                onChange={e => set('title', e.target.value)}
                placeholder={t('expenses.placeholder.salary_example')} className={fieldClass(errors.title)} />
            </Field>

            <Field name="allocation_method" label={t('expenses.field.allocation_method')} hint={t('expenses.allocation_hint')}>
              <SearchSelect id={fieldId('allocation_method')} value={form.allocation_method} onChange={v => set('allocation_method', v)}
                label={t('expenses.field.allocation_method')}
                options={[
                  { value: 'equal', label: t('expenses.field.allocation_equal') },
                  { value: 'weight_based', label: t('expenses.field.allocation_weight') },
                  { value: 'hold', label: t('expenses.field.allocation_hold') },
                ]} />
            </Field>

            {/* Monthly or one-day cost — decides which animals share it */}
            <RecurringToggle checked={form.is_recurring} onChange={v => set('is_recurring', v)}
              category={form.category} date={form.expense_date} />

            {/* Payment status — not for salary/labour linked records (always paid) */}
            {!linked && (
              <Field name="payment_status" label={t('expenses.label.payment_status')} required>
                <PaymentStatusPicker id={fieldId('payment_status')} value={form.payment_status}
                  onChange={v => setForm(f => ({ ...f, payment_status: v, paid_amount: '' }))}
                  labels={{ paid: t('expenses.label.payment_status_paid'), partial: t('expenses.label.payment_status_partial'), unpaid: t('expenses.label.payment_status_unpaid') }} />
              </Field>
            )}

            {!linked && form.payment_status === 'partial' && (
              <Field name="paid_amount" label={t('expenses.label.paid_amount')} required error={errors.paid_amount}
                hint={form.amount && form.paid_amount
                  ? `${t('expenses.label.remaining')}: ${fmtMoney(Math.max(0, (parseFloat(form.amount) || 0) - (parseFloat(normalizeNumber(form.paid_amount)) || 0)))}`
                  : undefined}>
                <NumberInput id={fieldId('paid_amount')} value={form.paid_amount} prefix="৳" error={errors.paid_amount}
                  placeholder={t('expenses.placeholder.amount_now')} onChange={v => set('paid_amount', v)} />
              </Field>
            )}

            {(linked || form.payment_status !== 'unpaid') && (
              <Field name="payment_account_id" label={t('expenses.field.account')} required error={errors.payment_account_id}>
                <PaymentAccountSelect id={fieldId('payment_account_id')} accounts={paymentAccountsData?.payment_accounts}
                  value={form.payment_account_id} onChange={v => set('payment_account_id', v)} error={errors.payment_account_id}
                  placeholder={t('expenses.placeholder.select_account')} label={t('expenses.field.account')} />
              </Field>
            )}

            <Field name="description" label={t('common:field.notes')}>
              <textarea id={fieldId('description')} rows={2} value={form.description} dir="auto"
                onChange={e => set('description', e.target.value)} className={fieldClass()} />
            </Field>
          </>
        )}
      </form>
    </Modal>
  );
}
