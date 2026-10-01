'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { useScrollToError } from '@/lib/hooks/useFormErrors';
import { fmtPct } from '@/lib/format';

const FORM_ID = 'cattle-feed-ratio';

interface RatioForm { feed_ratio: string; effective_date: string; notes: string }

interface ChangeFeedRatioModalProps {
  open: boolean;
  onClose: () => void;
  ratioForm: RatioForm;
  setRatioForm: React.Dispatch<React.SetStateAction<RatioForm>>;
  ratioError: string;
  /** The server's per-field errors, shown under their fields. */
  serverErrors?: Record<string, string>;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export default function ChangeFeedRatioModal(props: ChangeFeedRatioModalProps) {
  if (!props.open) return null;
  return <RatioFormModal {...props} />;
}

function RatioFormModal({ onClose, ratioForm, setRatioForm, ratioError, serverErrors, saving, onSubmit }: ChangeFeedRatioModalProps) {
  const { t } = useTranslation('cattle');
  const [localErrors, setErrors] = useState<Record<string, string>>({});
  // Server errors show until their field is edited (an edit sets the local entry to '').
  const errors: Record<string, string> = { ...serverErrors, ...localErrors };
  const [opened] = useState(() => JSON.stringify(ratioForm));
  const dirty = JSON.stringify(ratioForm) !== opened;
  useScrollToError(errors, ratioError);

  const set = <K extends keyof RatioForm>(key: K, value: string) => {
    setRatioForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: '' }));
  };

  const submit = (e: React.FormEvent) => {
    const ratio = parseFloat(ratioForm.feed_ratio);
    const errs: Record<string, string> = {};
    if (ratioForm.feed_ratio === '' || isNaN(ratio) || ratio < 0 || ratio > 100) errs.feed_ratio = t('detail.modal.v.ratio_range');
    if (!ratioForm.effective_date) errs.effective_date = t('common:form.v.date_required');
    if (Object.keys(errs).length) { e.preventDefault(); setErrors(errs); return; }
    setErrors({});
    onSubmit(e);
  };

  return (
    <Modal onClose={onClose} dirty={dirty} size="sm" title={t('detail.update_feed_ratio')}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>{t('common:btn.cancel')}</button>
        <button type="submit" form={FORM_ID} disabled={saving} className={btnPrimary}>
          <Check size={15} /> {t('detail.btn.update_ratio')}
        </button>
      </>}>
      <form id={FORM_ID} onSubmit={submit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
        <FormAlert message={ratioError} />
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
          <Field name="feed_ratio" label={<span className="flex items-center justify-between gap-2 text-amber-800">
            {t('detail.new_feed_ratio')}
            <span className="text-lg font-bold text-amber-700">{fmtPct(parseFloat(ratioForm.feed_ratio) || 0, 1)}</span>
          </span>} required error={errors.feed_ratio}>
            <input type="range" min="0" max="100" step="0.5" value={ratioForm.feed_ratio || '0'} aria-hidden="true" tabIndex={-1}
              onChange={e => set('feed_ratio', e.target.value)} className="w-full accent-amber-500 mb-2" />
            <NumberInput id={fieldId('feed_ratio')} value={ratioForm.feed_ratio} suffix="%" error={errors.feed_ratio} data-autofocus
              onChange={v => set('feed_ratio', v)} />
          </Field>
        </div>
        <Field name="effective_date" label={t('detail.effective_date')} required error={errors.effective_date}>
          <input id={fieldId('effective_date')} type="date" value={ratioForm.effective_date}
            onChange={e => set('effective_date', e.target.value)} className={fieldClass(errors.effective_date)} />
        </Field>
        <Field name="notes" label={t('common:field.notes')}>
          <textarea id={fieldId('notes')} rows={2} value={ratioForm.notes} dir="auto"
            onChange={e => set('notes', e.target.value)} className={fieldClass()} />
        </Field>
      </form>
    </Modal>
  );
}
