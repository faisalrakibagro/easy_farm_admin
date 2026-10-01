'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { invalidateKeys } from '@/lib/invalidateGroups';
import { localDateStr } from '@/lib/dates';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormAlert from '@/components/ui/FormAlert';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { apiFieldErrors, otherErrors, useScrollToError } from '@/lib/hooks/useFormErrors';

const FORM_ID = 'cattle-exit';
const SHOWN = ['status', 'exit_date', 'reason'];

type Exit = 'dead' | 'transferred' | 'active';

interface CattleExitModalProps {
  open: boolean;
  onClose: () => void;
  cattleId: number;
  status: string;
  arrivedOn: string | null;
}

/**
 * An animal leaves the farm without a sale: it died, or was transferred away.
 * The day is kept — the profit & loss takes its loss in that month. A mistaken
 * entry can be undone (back on the farm). Animals are never deleted.
 */
export default function CattleExitModal(props: CattleExitModalProps) {
  if (!props.open) return null;
  return <ExitFormModal {...props} />;
}

function ExitFormModal({ onClose, cattleId, status, arrivedOn }: CattleExitModalProps) {
  const { t } = useTranslation('cattle');
  const qc = useQueryClient();
  const toast = useToast();

  const today = localDateStr();
  const gone = status === 'dead' || status === 'transferred';
  const choices: Exit[] = gone ? ['active'] : ['dead', 'transferred'];
  const [next, setNext] = useState<Exit | ''>(gone ? 'active' : '');
  const [date, setDate] = useState(today);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = (!gone && next !== '') || date !== today || reason !== '';
  useScrollToError(errors, error);
  const clear = (k: string) => { if (errors[k]) setErrors(p => ({ ...p, [k]: '' })); };

  const mutation = useMutation({
    mutationFn: () => api.patch(`/farm/cattle/${cattleId}/status`, {
      status: next, reason: reason || null, exit_date: next === 'active' ? null : date,
    }),
    onSuccess: res => {
      toast.success(res?.data?.message ?? t('exit.toast_saved'));
      invalidateKeys(qc, [['cattle', cattleId], ['cattle-ledger', cattleId], ['farm-cattle'], ['cattle-active']]);
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
    if (!next) errs.status = t('common:form.v.required');
    if (next && next !== 'active' && !date) errs.exit_date = t('common:form.v.date_required');
    setErrors(errs);
    if (!Object.keys(errs).length) mutation.mutate();
  };

  return (
    <Modal onClose={onClose} dirty={dirty} size="sm" title={t(gone ? 'exit.title_back' : 'exit.title')}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>{t('common:btn.cancel')}</button>
        <button type="submit" form={FORM_ID} disabled={mutation.isPending} className={btnPrimary}>
          <Check size={15} /> {t('exit.save')}
        </button>
      </>}>
      <form id={FORM_ID} onSubmit={submit} noValidate className="px-4 sm:px-6 py-5 space-y-4">
        <FormAlert message={error} extra={otherErrors(errors, SHOWN)} />
        <Field name="status" label={t('exit.what')} required error={errors.status}>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {choices.map(c => (
              <label key={c} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer ${next === c ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-700'}`}>
                <input type="radio" name="exit-status" value={c} checked={next === c} data-autofocus={c === choices[0] ? true : undefined}
                  onChange={() => { setNext(c); clear('status'); }} />
                {t('exit.choice.' + c)}
              </label>
            ))}
          </div>
        </Field>
        {next !== 'active' && (
          <Field name="exit_date" label={t('exit.date')} required error={errors.exit_date}>
            <input id={fieldId('exit_date')} type="date" value={date} max={today} min={arrivedOn ?? undefined}
              onChange={e => { setDate(e.target.value); clear('exit_date'); }} className={fieldClass(errors.exit_date)} />
          </Field>
        )}
        <Field name="reason" label={t('exit.reason')} error={errors.reason}>
          <textarea id={fieldId('reason')} rows={2} value={reason} dir="auto"
            onChange={e => { setReason(e.target.value); clear('reason'); }} className={fieldClass(errors.reason)} />
        </Field>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{t(gone ? 'exit.note_back' : 'exit.note')}</p>
      </form>
    </Modal>
  );
}
