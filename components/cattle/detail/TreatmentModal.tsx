'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import PaymentAccountSelect from '@/components/ui/PaymentAccountSelect';
import FileAttachInput from '@/components/ui/FileAttachInput';
import HealthStatusSelect from '@/components/health/treatments/HealthStatusSelect';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { useScrollToError, otherErrors } from '@/lib/hooks/useFormErrors';
import type { Cattle, CattleHealthStatus } from '@/types';

const FORM_ID = 'cattle-treatment';
const SHOWN = ['treatment_date', 'health_status', 'doctor_name', 'doctor_phone', 'diagnosis', 'treatment', 'medicines_used',
  'prescription', 'receipt_file', 'vet_fee', 'payment_account_id', 'follow_up_date', 'notes'];

interface TreatmentForm {
  treatment_date: string; doctor_name: string; doctor_phone: string; medicines_used: string; vet_fee: string;
  follow_up_date: string; diagnosis: string; treatment: string; notes: string; prescription: string;
  payment_account_id: string; health_status: CattleHealthStatus;
}

interface PaymentAccountOption { id: number; name: string; type: string; balance: number; is_default?: boolean }

interface TreatmentModalProps {
  open: boolean;
  onClose: () => void;
  cattle: Cattle;
  treatmentForm: TreatmentForm;
  setTreatmentForm: React.Dispatch<React.SetStateAction<TreatmentForm>>;
  treatmentFormError: string;
  treatmentErrors: Record<string, string>;
  setTreatmentErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  treatmentPrescriptionFile: File | null;
  setTreatmentPrescriptionFile: (f: File | null) => void;
  treatmentSaving: boolean;
  paymentAccounts: PaymentAccountOption[];
  onSubmit: (e: React.FormEvent) => void;
}

export default function TreatmentModal(props: TreatmentModalProps) {
  if (!props.open) return null;
  return <TreatmentFormModal {...props} />;
}

/** Record a treatment for this animal (from its page). */
function TreatmentFormModal({
  onClose, cattle, treatmentForm, setTreatmentForm, treatmentFormError,
  treatmentErrors, setTreatmentErrors, treatmentPrescriptionFile, setTreatmentPrescriptionFile,
  treatmentSaving, paymentAccounts, onSubmit,
}: TreatmentModalProps) {
  const { t } = useTranslation('cattle');
  // The top message repeats only what no field shows.
  const topError = Object.values(treatmentErrors).some(Boolean) ? '' : treatmentFormError;
  useScrollToError(treatmentErrors, topError);

  const [opened] = useState(() => JSON.stringify(treatmentForm));
  const dirty = JSON.stringify(treatmentForm) !== opened || !!treatmentPrescriptionFile;

  const set = <K extends keyof TreatmentForm>(key: K, value: TreatmentForm[K]) => {
    setTreatmentForm(f => ({ ...f, [key]: value }));
    if (treatmentErrors[key]) setTreatmentErrors(p => ({ ...p, [key]: '' }));
  };
  const err = treatmentErrors;

  return (
    <Modal onClose={onClose} dirty={dirty} size="2xl" title={t('detail.modal.treatment.title')}
      subtitle={`${cattle.tag_number}${cattle.name ? ` — ${cattle.name}` : ''}`}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>{t('common:btn.cancel')}</button>
        <button type="submit" form={FORM_ID} disabled={treatmentSaving} className={btnPrimary}>
          <Check size={15} /> {t('detail.modal.save_btn')}
        </button>
      </>}>
      <form id={FORM_ID} onSubmit={onSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
        <FormAlert message={topError} extra={otherErrors(err, SHOWN)} />

        <FormRow>
          <Field name="treatment_date" label={t('detail.modal.treatment.date_label')} required error={err.treatment_date}>
            <input id={fieldId('treatment_date')} type="date" value={treatmentForm.treatment_date}
              onChange={e => set('treatment_date', e.target.value)} className={fieldClass(err.treatment_date)} />
          </Field>
          <Field name="diagnosis" label={t('detail.modal.treatment.diagnosis_label')} required error={err.diagnosis}>
            <input id={fieldId('diagnosis')} value={treatmentForm.diagnosis} dir="auto" data-autofocus
              onChange={e => set('diagnosis', e.target.value)} className={fieldClass(err.diagnosis)} />
          </Field>
        </FormRow>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4">
          <Field name="health_status" label={<span className="text-amber-800">{t('detail.modal.treatment.health_status_label')}</span>}
            hint={<span className="text-amber-700">{t('detail.modal.treatment.health_status_hint')}</span>}>
            <HealthStatusSelect value={treatmentForm.health_status} onChange={v => set('health_status', v)} />
          </Field>
        </div>

        <FormRow>
          <Field name="doctor_name" label={t('detail.modal.treatment.doctor_name_label')}>
            <input id={fieldId('doctor_name')} value={treatmentForm.doctor_name} dir="auto" onChange={e => set('doctor_name', e.target.value)} className={fieldClass()} />
          </Field>
          <Field name="doctor_phone" label={t('detail.modal.treatment.doctor_phone_label')}>
            <input id={fieldId('doctor_phone')} type="tel" inputMode="tel" dir="ltr" value={treatmentForm.doctor_phone}
              onChange={e => set('doctor_phone', e.target.value)} className={fieldClass()} />
          </Field>
        </FormRow>

        <Field name="treatment" label={t('detail.modal.treatment.treatment_desc_label')}>
          <textarea id={fieldId('treatment')} rows={2} value={treatmentForm.treatment} dir="auto" onChange={e => set('treatment', e.target.value)} className={fieldClass()} />
        </Field>
        <Field name="medicines_used" label={t('detail.modal.treatment.medicines_used_label')}>
          <textarea id={fieldId('medicines_used')} rows={2} value={treatmentForm.medicines_used} dir="auto" onChange={e => set('medicines_used', e.target.value)} className={fieldClass()} />
        </Field>

        <div className="border border-slate-200 rounded-xl p-3 sm:p-4 space-y-3 bg-slate-50">
          <p className="text-xs font-semibold text-slate-600">{t('detail.modal.treatment.prescription_section_title')}</p>
          <Field name="prescription" label={t('detail.modal.treatment.written_advice_label')}>
            <textarea id={fieldId('prescription')} rows={3} value={treatmentForm.prescription} dir="auto" onChange={e => set('prescription', e.target.value)} className={fieldClass()} />
          </Field>
          <Field name="receipt_file" label={t('detail.modal.treatment.upload_label')} error={err.receipt_file}>
            <FileAttachInput file={treatmentPrescriptionFile} onChange={setTreatmentPrescriptionFile}
              labels={{ upload: t('detail.modal.treatment.choose_file'), change: t('common:btn.change_file'), remove: t('detail.modal.treatment.remove_file') }} />
          </Field>
        </div>

        <FormRow>
          <Field name="vet_fee" label={t('detail.modal.treatment.vet_fee_label')} error={err.vet_fee}>
            <NumberInput id={fieldId('vet_fee')} value={treatmentForm.vet_fee} prefix="৳" placeholder="0" error={err.vet_fee} onChange={v => set('vet_fee', v)} />
          </Field>
          <Field name="payment_account_id" label={t('detail.modal.treatment.payment_account_label')} required error={err.payment_account_id}>
            <PaymentAccountSelect id={fieldId('payment_account_id')} accounts={paymentAccounts} value={treatmentForm.payment_account_id}
              onChange={v => set('payment_account_id', v)} error={err.payment_account_id} amount={treatmentForm.vet_fee}
              placeholder={t('detail.modal.treatment.select_account_option')} label={t('detail.modal.treatment.payment_account_label')} />
          </Field>
        </FormRow>

        <Field name="follow_up_date" label={t('detail.modal.treatment.follow_up_label')}>
          <input id={fieldId('follow_up_date')} type="date" value={treatmentForm.follow_up_date}
            onChange={e => set('follow_up_date', e.target.value)} className={fieldClass()} />
        </Field>

        <Field name="notes" label={t('cattle:field.notes')}>
          <textarea id={fieldId('notes')} rows={2} value={treatmentForm.notes} dir="auto" onChange={e => set('notes', e.target.value)} className={fieldClass()} />
        </Field>
      </form>
    </Modal>
  );
}
