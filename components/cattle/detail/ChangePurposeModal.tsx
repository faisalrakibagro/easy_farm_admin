'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { invalidateKeys } from '@/lib/invalidateGroups';
import { PURPOSES_BY_GENDER } from '@/types';
import type { CattleGender, CattlePurpose } from '@/types';
import { localDateStr } from '@/lib/dates';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormAlert from '@/components/ui/FormAlert';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';

const FORM_ID = 'cattle-purpose';
const SHOWN = ['purpose', 'changed_on', 'reason'];

interface ChangePurposeModalProps {
  open: boolean;
  onClose: () => void;
  cattleId: number;
  gender: CattleGender;
  currentPurpose: CattlePurpose;
}

/**
 * Change an animal's purpose (calf → dairy, dairy → fattening …). Costs booked
 * from now on go to the new profit center; earlier costs stay where they are.
 */
export default function ChangePurposeModal(props: ChangePurposeModalProps) {
  if (!props.open) return null;
  return <PurposeFormModal {...props} />;
}

function PurposeFormModal({ onClose, cattleId, gender, currentPurpose }: ChangePurposeModalProps) {
  const { t } = useTranslation('cattle');
  const qc = useQueryClient();
  const toast = useToast();

  const today = localDateStr();
  const options = PURPOSES_BY_GENDER[gender].filter(p => p !== currentPurpose);
  const [purpose, setPurpose] = useState<CattlePurpose | ''>('');
  const [changedOn, setChangedOn] = useState(today);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = purpose !== '' || changedOn !== today || reason !== '';
  useScrollToError(errors, error);
  const clear = (k: string) => { if (errors[k]) setErrors(p => ({ ...p, [k]: '' })); };

  const mutation = useMutation({
    mutationFn: () => api.patch(`/farm/cattle/${cattleId}/purpose`, {
      purpose, changed_on: changedOn, reason: reason || null,
    }),
    onSuccess: res => {
      toast.success(res?.data?.message ?? t('breeding.purpose_change.toast_saved'));
      invalidateKeys(qc, [['cattle', cattleId], ['cattle-purpose-history', cattleId], ['cattle-pedigree', cattleId], ['farm-cattle']]);
      onClose();
    },
    onError: (e: unknown) => {
      const { fields, message } = apiFieldErrors(e, t('common:error.generic'));
      setErrors(fields);
      setError(Object.keys(fields).length ? '' : message);
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const errs: Record<string, string> = {};
    if (!purpose) errs.purpose = t('common:form.v.required');
    if (!changedOn) errs.changed_on = t('common:form.v.date_required');
    setErrors(errs);
    if (!Object.keys(errs).length) mutation.mutate();
  };

  return (
    <Modal onClose={onClose} dirty={dirty} size="sm" title={t('breeding.purpose_change.title')}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>{t('common:btn.cancel')}</button>
        <button type="submit" form={FORM_ID} disabled={mutation.isPending} className={btnPrimary}>
          <Check size={15} /> {t('breeding.purpose_change.save')}
        </button>
      </>}>
      <form id={FORM_ID} onSubmit={submit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
        <FormAlert message={error} extra={otherErrors(errors, SHOWN)} />
        <div>
          <p className="text-xs text-slate-500 mb-0.5">{t('breeding.purpose_change.current')}</p>
          <p className="text-sm font-medium text-slate-800">{t('breeding.purpose.' + currentPurpose)}</p>
        </div>
        <Field name="purpose" label={t('breeding.purpose_change.new')} required error={errors.purpose}>
          <select id={fieldId('purpose')} value={purpose} data-autofocus
            onChange={e => { setPurpose(e.target.value as CattlePurpose | ''); clear('purpose'); }} className={fieldClass(errors.purpose)}>
            <option value="">—</option>
            {options.map(p => <option key={p} value={p}>{t('breeding.purpose.' + p)}</option>)}
          </select>
        </Field>
        <Field name="changed_on" label={t('breeding.purpose_change.date')} required error={errors.changed_on}>
          <input id={fieldId('changed_on')} type="date" value={changedOn} max={today}
            onChange={e => { setChangedOn(e.target.value); clear('changed_on'); }} className={fieldClass(errors.changed_on)} />
        </Field>
        <Field name="reason" label={t('breeding.purpose_change.reason')} error={errors.reason}>
          <textarea id={fieldId('reason')} rows={2} value={reason} dir="auto"
            onChange={e => { setReason(e.target.value); clear('reason'); }} className={fieldClass(errors.reason)} />
        </Field>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{t('breeding.purpose_change.note')}</p>
      </form>
    </Modal>
  );
}
