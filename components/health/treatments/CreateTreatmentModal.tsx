'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import CattleSelect from '@/components/ui/CattleSelect';
import PaymentAccountSelect from '@/components/ui/PaymentAccountSelect';
import FileAttachInput from '@/components/ui/FileAttachInput';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { useScrollToError, otherErrors } from '@/lib/hooks/useFormErrors';
import type { Cattle, AccountingPaymentAccount, CattleHealthStatus } from '@/types';
import HealthStatusSelect from './HealthStatusSelect';

const FORM_ID = 'treatment-create';
const SHOWN = ['cattle_id', 'treatment_date', 'health_status', 'doctor_name', 'doctor_phone', 'diagnosis', 'treatment', 'medicines_used',
  'prescription', 'receipt_file', 'vet_fee', 'payment_account_id', 'follow_up_date', 'notes'];

interface TreatmentCreateForm {
  cattle_id: string; treatment_date: string;
  doctor_name: string; doctor_phone: string; medicines_used: string; vet_fee: string; follow_up_date: string;
  diagnosis: string; treatment: string; notes: string;
  payment_account_id: string;
  prescription: string;
  health_status: CattleHealthStatus;
}

interface CreateTreatmentModalProps {
  open: boolean;
  onClose: () => void;
  form: TreatmentCreateForm;
  setForm: React.Dispatch<React.SetStateAction<TreatmentCreateForm>>;
  formError: string;
  errors: Record<string, string>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  prescriptionFile: File | null;
  setPrescriptionFile: (f: File | null) => void;
  isSaving: boolean;
  activeCattle: Cattle[];
  paymentAccounts: AccountingPaymentAccount[];
  vetFee: number;
  onSubmit: (e: React.FormEvent) => void;
}

export default function CreateTreatmentModal(props: CreateTreatmentModalProps) {
  if (!props.open) return null;
  return <TreatmentForm {...props} />;
}

function TreatmentForm({
  onClose, form, setForm, formError, errors, setErrors,
  prescriptionFile, setPrescriptionFile, isSaving, activeCattle, paymentAccounts, onSubmit,
}: CreateTreatmentModalProps) {
  const { t } = useTranslation(['health', 'common']);
  useScrollToError(errors, formError);

  const [opened] = useState(() => JSON.stringify(form));
  const dirty = JSON.stringify(form) !== opened || !!prescriptionFile;

  const set = <K extends keyof TreatmentCreateForm>(key: K, value: TreatmentCreateForm[K]) => {
    setForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: '' }));
  };

  return (
    <Modal onClose={onClose} dirty={dirty} size="2xl" title={t('treatments.modal_title')}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>{t('common:btn.cancel')}</button>
        <button type="submit" form={FORM_ID} disabled={isSaving} className={btnPrimary}>
          <Check size={15} /> {t('treatments.btn.save')}
        </button>
      </>}>
      <form id={FORM_ID} onSubmit={onSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
        <FormAlert message={formError} extra={otherErrors(errors, SHOWN)} />

        <FormRow>
          <Field name="cattle_id" label={t('treatments.field.cattle')} required error={errors.cattle_id}>
            <CattleSelect id={fieldId('cattle_id')} cattle={activeCattle} value={form.cattle_id} onChange={v => set('cattle_id', v)}
              placeholder={t('treatments.field.select_cattle')} label={t('treatments.field.cattle')} error={errors.cattle_id} />
          </Field>
          <Field name="treatment_date" label={t('treatments.field.date')} required error={errors.treatment_date}>
            <input id={fieldId('treatment_date')} type="date" value={form.treatment_date}
              onChange={e => set('treatment_date', e.target.value)} className={fieldClass(errors.treatment_date)} />
          </Field>
        </FormRow>

        {/* How the animal is after this treatment */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4">
          <Field name="health_status" label={<span className="text-amber-800">{t('treatments.health_status_after_label')}</span>}
            hint={<span className="text-amber-700">{t('treatments.health_status_after_info')}</span>}>
            <HealthStatusSelect value={form.health_status} onChange={v => set('health_status', v)} />
          </Field>
        </div>

        <Field name="diagnosis" label={t('treatments.field.diagnosis')} required error={errors.diagnosis}>
          <input id={fieldId('diagnosis')} value={form.diagnosis} dir="auto" data-autofocus
            onChange={e => set('diagnosis', e.target.value)} className={fieldClass(errors.diagnosis)} />
        </Field>

        <FormRow>
          <Field name="doctor_name" label={t('treatments.field.doctor_name')}>
            <input id={fieldId('doctor_name')} value={form.doctor_name} dir="auto" onChange={e => set('doctor_name', e.target.value)} className={fieldClass()} />
          </Field>
          <Field name="doctor_phone" label={t('treatments.field.doctor_phone')}>
            <input id={fieldId('doctor_phone')} type="tel" inputMode="tel" dir="ltr" value={form.doctor_phone}
              onChange={e => set('doctor_phone', e.target.value)} className={fieldClass()} />
          </Field>
        </FormRow>

        <Field name="treatment" label={t('treatments.field.treatment')}>
          <textarea id={fieldId('treatment')} rows={2} value={form.treatment} dir="auto" onChange={e => set('treatment', e.target.value)} className={fieldClass()} />
        </Field>
        <Field name="medicines_used" label={t('treatments.field.medicines_used')}>
          <textarea id={fieldId('medicines_used')} rows={2} value={form.medicines_used} dir="auto"
            placeholder={t('treatments.placeholder.medicines_used')} onChange={e => set('medicines_used', e.target.value)} className={fieldClass()} />
        </Field>

        {/* Prescription: typed and/or a photo */}
        <div className="border border-slate-200 rounded-xl p-3 sm:p-4 space-y-3 bg-slate-50">
          <p className="text-xs font-semibold text-slate-600">{t('treatments.field.prescription_section')}</p>
          <Field name="prescription" label={t('treatments.field.prescription')}>
            <textarea id={fieldId('prescription')} rows={3} value={form.prescription} dir="auto"
              placeholder={t('treatments.placeholder.prescription')} onChange={e => set('prescription', e.target.value)} className={fieldClass()} />
          </Field>
          <Field name="receipt_file" label={t('treatments.field.prescription_upload')} error={errors.receipt_file}>
            <FileAttachInput file={prescriptionFile} onChange={setPrescriptionFile}
              labels={{ upload: t('treatments.field.file_choose'), change: t('common:btn.change_file'), remove: t('treatments.btn.remove_file') }} />
          </Field>
        </div>

        {/* Fee and where it was paid from */}
        <FormRow>
          <Field name="vet_fee" label={t('treatments.field.vet_fee')} error={errors.vet_fee}>
            <NumberInput id={fieldId('vet_fee')} value={form.vet_fee} prefix="৳" placeholder="0" error={errors.vet_fee}
              onChange={v => set('vet_fee', v)} />
          </Field>
          <Field name="payment_account_id" label={t('treatments.field.payment_account')} required error={errors.payment_account_id}>
            <PaymentAccountSelect id={fieldId('payment_account_id')} accounts={paymentAccounts} value={form.payment_account_id}
              onChange={v => set('payment_account_id', v)} error={errors.payment_account_id} amount={form.vet_fee}
              placeholder={t('treatments.field.select_account')} label={t('treatments.field.payment_account')} />
          </Field>
        </FormRow>

        <Field name="follow_up_date" label={t('treatments.field.follow_up_date')}>
          <input id={fieldId('follow_up_date')} type="date" value={form.follow_up_date}
            onChange={e => set('follow_up_date', e.target.value)} className={fieldClass()} />
        </Field>

        <Field name="notes" label={t('treatments.field.notes')}>
          <textarea id={fieldId('notes')} rows={2} value={form.notes} dir="auto" onChange={e => set('notes', e.target.value)} className={fieldClass()} />
        </Field>
      </form>
    </Modal>
  );
}
