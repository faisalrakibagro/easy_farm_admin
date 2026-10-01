'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Check, Users, Search } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import PaymentAccountSelect from '@/components/ui/PaymentAccountSelect';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { useScrollToError, otherErrors } from '@/lib/hooks/useFormErrors';
import type { Cattle, AccountingPaymentAccount, CattleHealthStatus } from '@/types';
import HealthStatusSelect from './HealthStatusSelect';
import { fmtNum } from '@/lib/format';

const FORM_ID = 'treatment-bulk';
const SHOWN = ['cattle_ids', 'cattle_ids.*', 'health_status', 'treatment_date', 'follow_up_date', 'doctor_name', 'doctor_phone',
  'diagnosis', 'treatment', 'medicines_used', 'vet_fee', 'payment_account_id', 'notes'];

interface TreatmentBulkForm {
  treatment_date: string;
  doctor_name: string; doctor_phone: string; medicines_used: string; vet_fee: string; follow_up_date: string;
  diagnosis: string; treatment: string; notes: string;
  payment_account_id: string;
  prescription: string;
  health_status: CattleHealthStatus;
}

interface BulkCreateTreatmentModalProps {
  open: boolean;
  onClose: () => void;
  bulkForm: TreatmentBulkForm;
  setBulkForm: React.Dispatch<React.SetStateAction<TreatmentBulkForm>>;
  bulkError: string;
  bulkErrors: Record<string, string>;
  setBulkErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  isBulkSaving: boolean;
  selectedCattleIds: number[];
  toggleCattle: (id: number) => void;
  selectAllFiltered: () => void;
  cattleSearch: string;
  setCattleSearch: (v: string) => void;
  filteredCattle: Cattle[];
  activeCattle: Cattle[];
  paymentAccounts: AccountingPaymentAccount[];
  healthStatusBadge: Record<CattleHealthStatus, string>;
  healthStatusLabel: Record<CattleHealthStatus, string>;
  bulkVetFee: number;
  onSubmit: (e: React.FormEvent) => void;
}

export default function BulkCreateTreatmentModal(props: BulkCreateTreatmentModalProps) {
  if (!props.open) return null;
  return <BulkTreatmentForm {...props} />;
}

function BulkTreatmentForm({
  onClose, bulkForm, setBulkForm, bulkError, bulkErrors: errors, setBulkErrors: setErrors, isBulkSaving,
  selectedCattleIds, toggleCattle, selectAllFiltered, cattleSearch, setCattleSearch,
  filteredCattle, activeCattle, paymentAccounts, healthStatusBadge, healthStatusLabel, bulkVetFee, onSubmit,
}: BulkCreateTreatmentModalProps) {
  const { t } = useTranslation(['health', 'common']);
  useScrollToError(errors, bulkError);

  const snapshot = JSON.stringify({ bulkForm, selectedCattleIds });
  const [opened] = useState(snapshot);
  const dirty = snapshot !== opened;

  const set = <K extends keyof TreatmentBulkForm>(key: K, value: TreatmentBulkForm[K]) => {
    setBulkForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: '' }));
  };
  const toggle = (id: number) => {
    toggleCattle(id);
    if (errors.cattle_ids) setErrors(p => ({ ...p, cattle_ids: '' }));
  };
  const count = selectedCattleIds.length;

  return (
    <Modal onClose={onClose} dirty={dirty} size="3xl"
      title={t('treatments.bulk_modal_title')} subtitle={t('treatments.bulk_modal_subtitle')}
      icon={<Users size={18} className="text-purple-500 shrink-0" />}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>{t('common:btn.cancel')}</button>
        <button type="submit" form={FORM_ID} disabled={isBulkSaving} className={btnPrimary}>
          <Check size={15} /> {isBulkSaving ? t('treatments.bulk_saving') : t('treatments.bulk_save_records', { count })}
        </button>
      </>}>
      <form id={FORM_ID} onSubmit={onSubmit} noValidate className="px-4 sm:px-6 py-5 space-y-5">
        <FormAlert message={bulkError} extra={otherErrors(errors, SHOWN)} />

        {/* Animals */}
        <Field name="cattle_ids" required error={errors.cattle_ids}
          label={<>
            {t('treatments.bulk_select_cattle_label')}
            {count > 0 && (
              <span className="ms-2 bg-purple-100 text-purple-700 text-xs font-medium px-2 py-0.5 rounded-full">
                {t('treatments.bulk_selected_count', { count })}
              </span>
            )}
          </>}>
          <div className="flex gap-2 items-stretch mb-2">
            <div className="relative flex-1 min-w-0">
              <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input id={fieldId('cattle_ids')} type="search" value={cattleSearch} onChange={e => setCattleSearch(e.target.value)}
                placeholder={t('treatments.bulk_search_placeholder')} className={fieldClass(errors.cattle_ids, 'ps-9')} />
            </div>
            <button type="button" onClick={selectAllFiltered}
              className="shrink-0 px-3 rounded-lg text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 whitespace-nowrap">
              {filteredCattle.every(c => selectedCattleIds.includes(c.id)) ? t('treatments.bulk_deselect_all') : t('treatments.bulk_select_all')}
            </button>
          </div>

          <div className={`border rounded-xl max-h-60 overflow-y-auto ${errors.cattle_ids ? 'border-red-300' : 'border-slate-200'}`}>
            {filteredCattle.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-6">{t('treatments.bulk_no_cattle')}</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredCattle.map(c => (
                  <label key={c.id} className={`flex items-center gap-3 px-3 sm:px-4 py-3 sm:py-2.5 cursor-pointer hover:bg-slate-50 transition-colors ${selectedCattleIds.includes(c.id) ? 'bg-purple-50' : ''}`}>
                    <input type="checkbox" checked={selectedCattleIds.includes(c.id)} onChange={() => toggle(c.id)}
                      className="w-4 h-4 shrink-0 rounded border-slate-300 text-purple-600 focus:ring-purple-500" />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium text-sm text-slate-700">{c.tag_number}</span>
                      {c.name && <span className="ms-2 text-xs text-slate-500">{c.name}</span>}
                    </span>
                    <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${healthStatusBadge[c.health_status]}`}>
                      {healthStatusLabel[c.health_status]}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Picked animals */}
          {count > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {selectedCattleIds.map(id => {
                const c = activeCattle.find(x => x.id === id);
                return c ? (
                  <span key={id} className="inline-flex items-center gap-0.5 max-w-full text-xs bg-purple-100 text-purple-700 font-medium ps-2 rounded-full">
                    <span className="truncate">{c.tag_number}</span>
                    <button type="button" onClick={() => toggle(id)} aria-label={`${t('common:ui.remove_item')}: ${c.tag_number}`}
                      className="shrink-0 p-1 rounded-full hover:bg-purple-200"><X size={12} /></button>
                  </span>
                ) : null;
              })}
            </div>
          )}
        </Field>

        {/* Health status after */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4">
          <Field name="health_status" label={<span className="text-amber-700 font-semibold">{t('treatments.health_status_after_label')}</span>}
            error={errors.health_status} hint={<span className="text-amber-600">{t('treatments.bulk_health_status_after_info', { count })}</span>}>
            <HealthStatusSelect value={bulkForm.health_status} onChange={v => set('health_status', v)} />
          </Field>
        </div>

        <FormRow>
          <Field name="treatment_date" label={t('treatments.bulk_date_label')} required error={errors.treatment_date}>
            <input id={fieldId('treatment_date')} type="date" value={bulkForm.treatment_date}
              onChange={e => set('treatment_date', e.target.value)} className={fieldClass(errors.treatment_date)} />
          </Field>
          <Field name="follow_up_date" label={t('treatments.bulk_follow_up_label')} error={errors.follow_up_date}>
            <input id={fieldId('follow_up_date')} type="date" value={bulkForm.follow_up_date}
              onChange={e => set('follow_up_date', e.target.value)} className={fieldClass(errors.follow_up_date)} />
          </Field>
        </FormRow>

        <FormRow>
          <Field name="doctor_name" label={t('treatments.bulk_doctor_name_label')} error={errors.doctor_name}>
            <input id={fieldId('doctor_name')} value={bulkForm.doctor_name} dir="auto"
              onChange={e => set('doctor_name', e.target.value)} className={fieldClass(errors.doctor_name)} />
          </Field>
          <Field name="doctor_phone" label={t('treatments.bulk_doctor_phone_label')} error={errors.doctor_phone}>
            <input id={fieldId('doctor_phone')} type="tel" inputMode="tel" value={bulkForm.doctor_phone} dir="ltr"
              onChange={e => set('doctor_phone', e.target.value)} className={fieldClass(errors.doctor_phone)} />
          </Field>
        </FormRow>

        <Field name="diagnosis" label={t('treatments.bulk_diagnosis_label')} required error={errors.diagnosis}>
          <input id={fieldId('diagnosis')} value={bulkForm.diagnosis} dir="auto"
            onChange={e => set('diagnosis', e.target.value)} className={fieldClass(errors.diagnosis)} />
        </Field>
        <Field name="treatment" label={t('treatments.bulk_treatment_label')} error={errors.treatment}>
          <textarea id={fieldId('treatment')} rows={2} value={bulkForm.treatment} dir="auto"
            onChange={e => set('treatment', e.target.value)} className={fieldClass(errors.treatment)} />
        </Field>
        <Field name="medicines_used" label={t('treatments.bulk_medicines_label')} error={errors.medicines_used}>
          <textarea id={fieldId('medicines_used')} rows={2} value={bulkForm.medicines_used} dir="auto"
            onChange={e => set('medicines_used', e.target.value)}
            placeholder={t('treatments.bulk_medicines_placeholder')} className={fieldClass(errors.medicines_used)} />
        </Field>

        <FormRow>
          <Field name="vet_fee" label={t('treatments.field.vet_fee_per_cattle')} error={errors.vet_fee}
            hint={bulkVetFee > 0 && count > 0
              ? t('treatments.bulk_total_fee_display', { total: fmtNum(bulkVetFee * count, 2), count })
              : undefined}>
            <NumberInput id={fieldId('vet_fee')} value={bulkForm.vet_fee} prefix="৳" placeholder="0" error={errors.vet_fee}
              onChange={v => set('vet_fee', v)} />
          </Field>
          <Field name="payment_account_id" label={t('treatments.field.payment_account')} required error={errors.payment_account_id}>
            <PaymentAccountSelect id={fieldId('payment_account_id')} accounts={paymentAccounts} value={bulkForm.payment_account_id}
              onChange={v => set('payment_account_id', v)} error={errors.payment_account_id}
              amount={bulkVetFee * Math.max(count, 1)}
              placeholder={t('treatments.field.select_account')} label={t('treatments.field.payment_account')} />
          </Field>
        </FormRow>

        <Field name="notes" label={t('treatments.bulk_notes_label')} error={errors.notes}>
          <textarea id={fieldId('notes')} rows={2} value={bulkForm.notes} dir="auto"
            onChange={e => set('notes', e.target.value)} className={fieldClass(errors.notes)} />
        </Field>

        {count > 0 && (
          <p className="text-xs text-purple-700 bg-purple-50 rounded-lg px-3 py-2">
            {t('treatments.bulk_records_info', { count })}
          </p>
        )}
      </form>
    </Modal>
  );
}
