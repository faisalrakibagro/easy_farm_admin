'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Activity } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import PaymentAccountSelect from '@/components/ui/PaymentAccountSelect';
import FileAttachInput from '@/components/ui/FileAttachInput';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { useScrollToError, otherErrors } from '@/lib/hooks/useFormErrors';
import type { Cattle, AccountingPaymentAccount } from '@/types';
import type { PerCattleData } from './types';
import { fmtMoney } from '@/lib/format';

const FORM_ID = 'bulk-treatment';
const SHOWN = ['treatment_date', 'payment_account_id', 'doctor_name', 'doctor_phone', 'vet_fee', 'notes'];

interface BulkTreatmentModalProps {
  open: boolean;
  onClose: () => void;
  selectedIds: Set<number>;
  selectedCattleList: Cattle[];
  perCattle: Record<number, PerCattleData>;
  perCattleFiles: Record<number, File | null>;
  perCattleErrors: Record<number, string>;
  updatePerCattle: (cattleId: number, field: keyof PerCattleData, value: string) => void;
  setPerCattleFiles: React.Dispatch<React.SetStateAction<Record<number, File | null>>>;
  treatDate: string;
  setTreatDate: (v: string) => void;
  treatPayAccId: string;
  setTreatPayAccId: (v: string) => void;
  treatDoctorName: string;
  setTreatDoctorName: (v: string) => void;
  treatDoctorPhone: string;
  setTreatDoctorPhone: (v: string) => void;
  treatVetFee: string;
  setTreatVetFee: (v: string) => void;
  treatNotes: string;
  setTreatNotes: (v: string) => void;
  treatBulkError: string;
  /** Errors of the shared fields (treatment_date, payment_account_id…), from our checks or the API. */
  treatBulkErrors: Record<string, string>;
  setTreatBulkErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  treatBulkSaving: boolean;
  paymentAccounts: AccountingPaymentAccount[];
  onSubmit: (e: React.FormEvent) => void;
}

const DEFAULT_PC: PerCattleData = { diagnosis: '', treatment: '', health_status: 'sick', follow_up_date: '', prescription: '' };

export default function BulkTreatmentModal(props: BulkTreatmentModalProps) {
  if (!props.open) return null;
  return <BulkTreatmentForm {...props} />;
}

function BulkTreatmentForm({
  onClose, selectedIds, selectedCattleList,
  perCattle, perCattleFiles, perCattleErrors, updatePerCattle, setPerCattleFiles,
  treatDate, setTreatDate, treatPayAccId, setTreatPayAccId,
  treatDoctorName, setTreatDoctorName, treatDoctorPhone, setTreatDoctorPhone,
  treatVetFee, setTreatVetFee, treatNotes, setTreatNotes,
  treatBulkError, treatBulkErrors: errors, setTreatBulkErrors: setErrors, treatBulkSaving, paymentAccounts, onSubmit,
}: BulkTreatmentModalProps) {
  const { t } = useTranslation('cattle');

  const pcErrors = Object.fromEntries(Object.entries(perCattleErrors).map(([id, msg]) => [`pc_${id}`, msg]));
  useScrollToError({ ...errors, ...pcErrors }, treatBulkError);

  const snapshot = JSON.stringify({
    perCattle, treatDate, treatPayAccId, treatDoctorName, treatDoctorPhone, treatVetFee, treatNotes,
    files: Object.values(perCattleFiles).filter(Boolean).length,
  });
  const [opened] = useState(snapshot);
  const dirty = snapshot !== opened;

  const clear = (key: string) => { if (errors[key]) setErrors(p => ({ ...p, [key]: '' })); };
  const vetFee = parseFloat(treatVetFee) || 0;

  return (
    <Modal onClose={onClose} dirty={dirty} size="2xl"
      title={t('bulk.treatment.title')} subtitle={t('bulk.treatment.subtitle', { count: selectedIds.size })}
      icon={<Activity size={18} className="text-orange-500 shrink-0" />}
      footer={<>
        <span className="w-full sm:w-auto sm:me-auto text-xs text-slate-500">{t('bulk.treatment.footer_count', { count: selectedIds.size })}</span>
        <button type="button" onClick={onClose} className={btnSecondary}>{t('common:btn.cancel')}</button>
        <button type="submit" form={FORM_ID} disabled={treatBulkSaving} className={btnPrimary}>
          <Check size={15} /> {treatBulkSaving ? t('bulk.saving') : t('bulk.treatment.submit_btn', { count: selectedIds.size })}
        </button>
      </>}>
      <form id={FORM_ID} onSubmit={onSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-5">
        <FormAlert message={treatBulkError} extra={otherErrors(errors, SHOWN)} />

        {/* Per-animal details */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{t('bulk.treatment.per_animal_section')}</p>
          {selectedCattleList.map(c => {
            const pc = perCattle[c.id] ?? DEFAULT_PC;
            const err = perCattleErrors[c.id];
            const id = (f: string) => fieldId(`pc_${c.id}_${f}`);
            return (
              <div key={c.id} className={`border rounded-xl p-3 sm:p-4 space-y-3 bg-white ${err ? 'border-red-300' : 'border-slate-200'}`}>
                <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 min-w-0">
                  <span className="text-orange-400 text-base" aria-hidden="true">🐄</span>
                  <span className="truncate">{c.tag_number}{c.name ? ` — ${c.name}` : ''}</span>
                </p>

                <Field name={`pc_${c.id}_diagnosis`} label={t('bulk.treatment.diagnosis_label')} required error={err}>
                  <input id={id('diagnosis')} value={pc.diagnosis} dir="auto"
                    onChange={e => updatePerCattle(c.id, 'diagnosis', e.target.value)}
                    placeholder={t('placeholder.diagnosis')} className={fieldClass(err)} />
                </Field>

                <FormRow>
                  <Field name={`pc_${c.id}_health_status`} label={t('bulk.treatment.health_status_after_label')}>
                    <select id={id('health_status')} value={pc.health_status}
                      onChange={e => updatePerCattle(c.id, 'health_status', e.target.value)} className={fieldClass()}>
                      <option value="sick">{t('bulk.treatment.health_status.sick')}</option>
                      <option value="critical">{t('bulk.treatment.health_status.critical')}</option>
                      <option value="recovering">{t('bulk.treatment.health_status.recovering')}</option>
                      <option value="healthy">{t('bulk.treatment.health_status.healthy')}</option>
                    </select>
                  </Field>
                  <Field name={`pc_${c.id}_follow_up_date`} label={t('bulk.treatment.follow_up_date_label')}>
                    <input id={id('follow_up_date')} type="date" value={pc.follow_up_date}
                      onChange={e => updatePerCattle(c.id, 'follow_up_date', e.target.value)} className={fieldClass()} />
                  </Field>
                </FormRow>

                <Field name={`pc_${c.id}_treatment`} label={t('bulk.treatment.treatment_desc_label')}>
                  <textarea id={id('treatment')} rows={2} value={pc.treatment} dir="auto"
                    onChange={e => updatePerCattle(c.id, 'treatment', e.target.value)}
                    placeholder={t('placeholder.treatment_desc')} className={fieldClass()} />
                </Field>

                <Field name={`pc_${c.id}_prescription`} label={t('bulk.treatment.prescription_label')}>
                  <textarea id={id('prescription')} rows={2} value={pc.prescription} dir="auto"
                    onChange={e => updatePerCattle(c.id, 'prescription', e.target.value)}
                    placeholder={t('placeholder.prescription_text')} className={fieldClass()} />
                </Field>

                <Field name={`pc_${c.id}_file`} label={t('bulk.treatment.file_label')}>
                  <FileAttachInput file={perCattleFiles[c.id] ?? null} accept=".pdf,image/*"
                    onChange={f => setPerCattleFiles(prev => ({ ...prev, [c.id]: f }))}
                    labels={{ upload: t('bulk.treatment.choose_file'), change: t('common:btn.change_file'), remove: t('common:btn.remove_file') }} />
                </Field>
              </div>
            );
          })}
        </div>

        {/* Shared by every animal */}
        <div className="bg-slate-50 rounded-xl p-3 sm:p-4 space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('bulk.treatment.shared_section')}</p>

          <FormRow>
            <Field name="treatment_date" label={t('bulk.treatment.date_label')} required error={errors.treatment_date}>
              <input id={fieldId('treatment_date')} type="date" value={treatDate}
                onChange={e => { setTreatDate(e.target.value); clear('treatment_date'); }} className={fieldClass(errors.treatment_date)} />
            </Field>
            <Field name="payment_account_id" label={t('bulk.treatment.payment_account_label')} required error={errors.payment_account_id}>
              <PaymentAccountSelect id={fieldId('payment_account_id')} accounts={paymentAccounts} value={treatPayAccId}
                onChange={v => { setTreatPayAccId(v); clear('payment_account_id'); }} error={errors.payment_account_id}
                amount={vetFee * Math.max(selectedIds.size, 1)}
                placeholder={t('bulk.treatment.select_account_placeholder')} label={t('bulk.treatment.payment_account_label')} />
            </Field>
          </FormRow>

          <FormRow>
            <Field name="doctor_name" label={t('bulk.treatment.doctor_name_label')} error={errors.doctor_name}>
              <input id={fieldId('doctor_name')} value={treatDoctorName} dir="auto"
                onChange={e => { setTreatDoctorName(e.target.value); clear('doctor_name'); }} className={fieldClass(errors.doctor_name)} />
            </Field>
            <Field name="doctor_phone" label={t('bulk.treatment.doctor_phone_label')} error={errors.doctor_phone}>
              <input id={fieldId('doctor_phone')} type="tel" inputMode="tel" value={treatDoctorPhone} dir="ltr"
                onChange={e => { setTreatDoctorPhone(e.target.value); clear('doctor_phone'); }} className={fieldClass(errors.doctor_phone)} />
            </Field>
          </FormRow>

          <Field name="vet_fee" label={t('bulk.treatment.vet_fee_label')} error={errors.vet_fee}
            hint={vetFee > 0 && selectedIds.size > 0 ? `${t('common:total')}: ${fmtMoney(vetFee * selectedIds.size)}` : undefined}>
            <NumberInput id={fieldId('vet_fee')} value={treatVetFee} prefix="৳" placeholder="0.00" error={errors.vet_fee}
              onChange={v => { setTreatVetFee(v); clear('vet_fee'); }} />
          </Field>
        </div>

        <Field name="notes" label={t('bulk.treatment.general_notes_label')} error={errors.notes}>
          <textarea id={fieldId('notes')} rows={2} value={treatNotes} dir="auto"
            onChange={e => { setTreatNotes(e.target.value); clear('notes'); }} className={fieldClass(errors.notes)} />
        </Field>
      </form>
    </Modal>
  );
}
