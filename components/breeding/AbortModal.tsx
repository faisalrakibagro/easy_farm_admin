'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import FormAlert from '@/components/ui/FormAlert';
import { otherErrors } from '@/lib/hooks/useFormErrors';
import { invalidateKeys } from '@/lib/invalidateGroups';
import type { BreedingRecord } from '@/types';
import { Field, FormActions, ModalShell, animalLabel, apiError, dateOnly, inputCls, todayStr } from './shared';

export default function AbortModal({ service, onClose }: { service: Pick<BreedingRecord, 'id' | 'service_date' | 'female'>; onClose: () => void }) {
  const { t } = useTranslation('breeding');
  const qc = useQueryClient();
  const toast = useToast();
  const [opened] = useState(todayStr);
  const [date, setDate] = useState(opened);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const dirty = date !== opened || notes !== '';

  const mutation = useMutation({
    mutationFn: () => api.post(`/farm/breeding/services/${service.id}/abort`, { date, notes: notes || null }),
    onSuccess: res => {
      toast.success(res?.data?.message ?? t('toast.saved'));
      invalidateKeys(qc, [['breeding'], ['farm-cattle'], ['cattle-active'], ['cattle-breeding-history']]);
      onClose();
    },
    onError: e => { const r = apiError(e, t('toast.failed')); setFields(r.fields); setError(Object.keys(r.fields).length ? '' : r.message); },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!date) { setFields({ date: t('common:form.v.date_required') }); return; }
    setFields({});
    mutation.mutate();
  };

  return (
    <ModalShell title={t('btn.abort')} onClose={onClose} dirty={dirty}>
      <form onSubmit={submit} noValidate className="p-6 space-y-4">
        <FormAlert message={error} extra={otherErrors(fields, ['date', 'notes'])} />
        <p className="text-sm text-slate-600">{service.female ? animalLabel(service.female) : ''}</p>
        <Field name="date" label={t('field.abort_date')} error={fields.date} required>
          <input type="date" value={date} min={dateOnly(service.service_date)} max={todayStr()}
            onChange={e => { setDate(e.target.value); setFields(p => ({ ...p, date: '' })); }} className={inputCls(!!fields.date)} />
        </Field>
        <Field name="notes" label={t('field.notes')} error={fields.notes}>
          <textarea rows={2} value={notes} dir="auto" onChange={e => setNotes(e.target.value)} className={inputCls(!!fields.notes)} />
        </Field>
        <FormActions onCancel={onClose} saving={mutation.isPending} />
      </form>
    </ModalShell>
  );
}
