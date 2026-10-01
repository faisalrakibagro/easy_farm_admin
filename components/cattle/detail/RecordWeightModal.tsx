'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import type { Cattle } from '@/types';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { useScrollToError } from '@/lib/hooks/useFormErrors';
import { localDateStr } from '@/lib/dates';
import { fmtPct } from '@/lib/format';

const FORM_ID = 'cattle-weight';

interface WeightForm { weight_date: string; weight: string; notes: string }

interface RecordWeightModalProps {
  open: boolean;
  onClose: () => void;
  cattle: Cattle;
  weightForm: WeightForm;
  setWeightForm: React.Dispatch<React.SetStateAction<WeightForm>>;
  weightError: string;
  /** The server's per-field errors, shown under their fields. */
  serverErrors?: Record<string, string>;
  weightModalFeedRatio: string;
  setWeightModalFeedRatio: (v: string) => void;
  weightSaving: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export default function RecordWeightModal(props: RecordWeightModalProps) {
  if (!props.open) return null;
  return <WeightFormModal {...props} />;
}

function WeightFormModal({
  onClose, cattle, weightForm, setWeightForm, weightError,
  weightModalFeedRatio, setWeightModalFeedRatio, weightSaving, onSubmit,
  serverErrors,
}: RecordWeightModalProps) {
  const { t } = useTranslation('cattle');
  const [localErrors, setErrors] = useState<Record<string, string>>({});
  // Server errors show until their field is edited (an edit sets the local entry to '').
  const errors: Record<string, string> = { ...serverErrors, ...localErrors };
  const [opened] = useState(() => JSON.stringify([weightForm, weightModalFeedRatio]));
  const dirty = JSON.stringify([weightForm, weightModalFeedRatio]) !== opened;
  useScrollToError(errors, weightError);

  const set = <K extends keyof WeightForm>(key: K, value: string) => {
    setWeightForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: '' }));
  };
  const setRatio = (v: string) => {
    setWeightModalFeedRatio(v);
    if (errors.feed_ratio) setErrors(p => ({ ...p, feed_ratio: '' }));
  };

  const submit = (e: React.FormEvent) => {
    const weight = parseFloat(weightForm.weight);
    const ratio = parseFloat(weightModalFeedRatio);
    const errs: Record<string, string> = {};
    if (!weightForm.weight_date) errs.weight_date = t('common:form.v.date_required');
    else if (weightForm.weight_date > localDateStr()) errs.weight_date = t('common:form.v.date_not_future');
    if (isNaN(weight) || weight < 1 || weight > 2000) errs.weight = t('detail.modal.v.weight_range');
    if (weightModalFeedRatio !== '' && (isNaN(ratio) || ratio < 0 || ratio > 100)) errs.feed_ratio = t('detail.modal.v.ratio_range');
    if (Object.keys(errs).length) { e.preventDefault(); setErrors(errs); return; }
    setErrors({});
    onSubmit(e);
  };

  return (
    <Modal onClose={onClose} dirty={dirty} size="md" title={t('detail.btn.record_weight')}
      subtitle={`${cattle.tag_number}${cattle.name ? ` — ${cattle.name}` : ''}`}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>{t('common:btn.cancel')}</button>
        <button type="submit" form={FORM_ID} disabled={weightSaving} className={btnPrimary}>
          <Check size={15} /> {t('common:btn.save')}
        </button>
      </>}>
      <form id={FORM_ID} onSubmit={submit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
        <FormAlert message={weightError} />
        <Field name="weight_date" label={t('detail.col.weight.date')} required error={errors.weight_date}>
          <input id={fieldId('weight_date')} type="date" max={localDateStr()} value={weightForm.weight_date}
            onChange={e => set('weight_date', e.target.value)} className={fieldClass(errors.weight_date)} />
        </Field>
        <Field name="weight" label={t('detail.weight_kg')} required error={errors.weight}>
          <NumberInput id={fieldId('weight')} value={weightForm.weight} error={errors.weight} data-autofocus
            onChange={v => set('weight', v)} />
        </Field>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
          <Field name="feed_ratio" error={errors.feed_ratio} label={<span className="flex items-center justify-between gap-2 text-amber-800">
            <span>{t('detail.modal.weight.ratio_update_label')} <span className="text-amber-500 font-normal">{t('detail.modal.medicine.optional_suffix')}</span></span>
            <span className="text-base font-bold text-amber-700">{fmtPct(parseFloat(weightModalFeedRatio || cattle.feed_ratio || '0') || 0, 1)}</span>
          </span>}>
            <p className="text-xs text-amber-600 mb-3">
              {t('detail.modal.weight.current_ratio_prefix')} <span className="font-bold">{fmtPct(cattle.feed_ratio, 1)}</span>
              {parseFloat(cattle.feed_ratio) === 0 && <span className="ms-1 text-amber-400">{t('detail.modal.weight.auto_suffix')}</span>}
            </p>
            <input type="range" min="0" max="100" step="0.5" value={weightModalFeedRatio || cattle.feed_ratio || '0'} aria-hidden="true" tabIndex={-1}
              onChange={e => setRatio(e.target.value)} className="w-full accent-amber-500 mb-2" />
            <NumberInput id={fieldId('feed_ratio')} value={weightModalFeedRatio} suffix="%" error={errors.feed_ratio}
              onChange={setRatio} placeholder={t('placeholder.feed_ratio_hint')} />
          </Field>
        </div>
        <Field name="notes" label={t('common:field.notes')}>
          <textarea id={fieldId('notes')} rows={2} value={weightForm.notes} dir="auto"
            onChange={e => set('notes', e.target.value)} className={fieldClass()} />
        </Field>
      </form>
    </Modal>
  );
}
