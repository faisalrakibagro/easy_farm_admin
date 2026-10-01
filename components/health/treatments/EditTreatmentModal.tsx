'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { useScrollToError, otherErrors } from '@/lib/hooks/useFormErrors';
import type { Treatment, CattleHealthStatus } from '@/types';
import HealthStatusSelect from './HealthStatusSelect';

const FORM_ID = 'treatment-edit';
const SHOWN = ['health_status', 'treatment_date', 'follow_up_date', 'doctor_name', 'doctor_phone', 'diagnosis', 'treatment',
  'medicines_used', 'prescription', 'vet_fee', 'notes'];

interface EditTreatmentForm {
  treatment_date: string; doctor_name: string; doctor_phone: string;
  diagnosis: string; treatment: string; medicines_used: string;
  vet_fee: string; follow_up_date: string; notes: string; prescription: string;
  health_status: CattleHealthStatus;
}

interface EditTreatmentModalProps {
  treatment: Treatment;
  editForm: EditTreatmentForm;
  setEditForm: React.Dispatch<React.SetStateAction<EditTreatmentForm>>;
  editError: string;
  /** Field errors from the API, shown under each field. */
  editErrors?: Record<string, string>;
  isEditSaving: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function EditTreatmentModal({
  treatment, editForm, setEditForm, editError, editErrors = {}, isEditSaving, onClose, onSubmit,
}: EditTreatmentModalProps) {
  const { t } = useTranslation(['health', 'common']);
  useScrollToError(editErrors, editError);

  const [opened] = useState(() => JSON.stringify(editForm));
  const dirty = JSON.stringify(editForm) !== opened;
  const set = <K extends keyof EditTreatmentForm>(key: K, value: EditTreatmentForm[K]) => setEditForm(f => ({ ...f, [key]: value }));

  return (
    <Modal onClose={onClose} dirty={dirty} size="2xl" title={t('treatments.edit_modal_title')}
      subtitle={`${treatment.cattle?.tag_number ?? ''} — ${treatment.diagnosis ?? ''}`}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>{t('common:btn.cancel')}</button>
        <button type="submit" form={FORM_ID} disabled={isEditSaving} className={btnPrimary}>
          <Check size={15} /> {t('treatments.btn.save_record')}
        </button>
      </>}>
      <form id={FORM_ID} onSubmit={onSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
        <FormAlert message={editError} extra={otherErrors(editErrors, SHOWN)} />

        {/* The animal's condition — first, since it is what changes most */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4">
          <Field name="health_status" label={<span className="text-amber-800">{t('treatments.health_status_update_label')}</span>}
            hint={<span className="text-amber-700">{t('treatments.health_status_update_info')}</span>} error={editErrors.health_status}>
            <HealthStatusSelect value={editForm.health_status} onChange={v => set('health_status', v)} />
          </Field>
        </div>

        <FormRow>
          <Field name="treatment_date" label={t('treatments.field.date')} required error={editErrors.treatment_date}>
            <input id={fieldId('treatment_date')} type="date" value={editForm.treatment_date}
              onChange={e => set('treatment_date', e.target.value)} className={fieldClass(editErrors.treatment_date)} />
          </Field>
          <Field name="follow_up_date" label={t('treatments.field.follow_up_date')} error={editErrors.follow_up_date}>
            <input id={fieldId('follow_up_date')} type="date" value={editForm.follow_up_date}
              onChange={e => set('follow_up_date', e.target.value)} className={fieldClass(editErrors.follow_up_date)} />
          </Field>
        </FormRow>

        <FormRow>
          <Field name="doctor_name" label={t('treatments.field.doctor_name')}>
            <input id={fieldId('doctor_name')} value={editForm.doctor_name} dir="auto" onChange={e => set('doctor_name', e.target.value)} className={fieldClass()} />
          </Field>
          <Field name="doctor_phone" label={t('treatments.field.doctor_phone')}>
            <input id={fieldId('doctor_phone')} type="tel" inputMode="tel" dir="ltr" value={editForm.doctor_phone}
              onChange={e => set('doctor_phone', e.target.value)} className={fieldClass()} />
          </Field>
        </FormRow>

        <Field name="diagnosis" label={t('treatments.field.diagnosis')} error={editErrors.diagnosis}>
          <input id={fieldId('diagnosis')} value={editForm.diagnosis} dir="auto" onChange={e => set('diagnosis', e.target.value)} className={fieldClass(editErrors.diagnosis)} />
        </Field>
        <Field name="treatment" label={t('treatments.field.treatment')}>
          <textarea id={fieldId('treatment')} rows={2} value={editForm.treatment} dir="auto" onChange={e => set('treatment', e.target.value)} className={fieldClass()} />
        </Field>
        <Field name="medicines_used" label={t('treatments.field.medicines_used')}>
          <textarea id={fieldId('medicines_used')} rows={2} value={editForm.medicines_used} dir="auto" onChange={e => set('medicines_used', e.target.value)} className={fieldClass()} />
        </Field>
        <Field name="prescription" label={t('treatments.field.prescription')}>
          <textarea id={fieldId('prescription')} rows={2} value={editForm.prescription} dir="auto" onChange={e => set('prescription', e.target.value)} className={fieldClass()} />
        </Field>
        <Field name="vet_fee" label={t('treatments.field.vet_fee')} error={editErrors.vet_fee}>
          <NumberInput id={fieldId('vet_fee')} value={editForm.vet_fee} prefix="৳" placeholder="0" error={editErrors.vet_fee} onChange={v => set('vet_fee', v)} />
        </Field>
        <Field name="notes" label={t('treatments.field.notes')}>
          <textarea id={fieldId('notes')} rows={2} value={editForm.notes} dir="auto" onChange={e => set('notes', e.target.value)} className={fieldClass()} />
        </Field>
      </form>
    </Modal>
  );
}
