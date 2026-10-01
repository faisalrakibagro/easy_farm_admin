'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import CattleSelect from '@/components/ui/CattleSelect';
import FormAlert from '@/components/ui/FormAlert';
import { otherErrors } from '@/lib/hooks/useFormErrors';
import { invalidateKeys } from '@/lib/invalidateGroups';
import { Field, FormActions, ModalShell, apiError, inputCls, todayStr, useBreedingLookups } from './shared';

const SHOWN = ['cattle_id', 'detected_on', 'signs', 'notes'];

export default function HeatModal({ onClose, initialFemaleId }: { onClose: () => void; initialFemaleId?: number }) {
  const { t } = useTranslation('breeding');
  const qc = useQueryClient();
  const toast = useToast();
  const { females } = useBreedingLookups(true);

  const [form, setForm] = useState({
    cattle_id: initialFemaleId ? String(initialFemaleId) : '', detected_on: todayStr(), signs: '', notes: '',
  });
  const [opened] = useState(() => JSON.stringify(form));
  const dirty = JSON.stringify(form) !== opened;
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const set = (k: keyof typeof form, v: string) => { setForm(f => ({ ...f, [k]: v })); setFields(p => ({ ...p, [k]: '' })); };

  const mutation = useMutation({
    mutationFn: () => api.post('/farm/breeding/heats', form),
    onSuccess: res => {
      toast.success(res?.data?.message ?? t('toast.saved'));
      invalidateKeys(qc, [['breeding'], ['cattle-breeding-history']]);
      onClose();
    },
    onError: e => { const r = apiError(e, t('toast.failed')); setFields(r.fields); setError(Object.keys(r.fields).length ? '' : r.message); },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const f: Record<string, string> = {};
    if (!form.cattle_id) f.cattle_id = t('field.select_female');
    if (!form.detected_on) f.detected_on = t('common:form.v.date_required');
    setFields(f);
    if (!Object.keys(f).length) mutation.mutate();
  };

  return (
    <ModalShell title={t('btn.heat')} onClose={onClose} dirty={dirty}>
      <form onSubmit={submit} noValidate className="p-6 space-y-4">
        <FormAlert message={error} extra={otherErrors(fields, SHOWN)} />
        <Field name="cattle_id" label={t('field.female')} error={fields.cattle_id} required>
          <CattleSelect cattle={females} value={form.cattle_id} onChange={v => set('cattle_id', v)} error={fields.cattle_id}
            placeholder={t('field.select_female')} label={t('field.female')} />
        </Field>
        <Field name="detected_on" label={t('field.detected_on')} error={fields.detected_on} required>
          <input type="date" value={form.detected_on} max={todayStr()} onChange={e => set('detected_on', e.target.value)} className={inputCls(!!fields.detected_on)} />
        </Field>
        <Field name="signs" label={t('field.signs')} error={fields.signs}>
          <textarea rows={2} value={form.signs} dir="auto" onChange={e => set('signs', e.target.value)} className={inputCls(!!fields.signs)} />
        </Field>
        <Field name="notes" label={t('field.notes')} error={fields.notes}>
          <textarea rows={2} value={form.notes} dir="auto" onChange={e => set('notes', e.target.value)} className={inputCls(!!fields.notes)} />
        </Field>
        <FormActions onCancel={onClose} saving={mutation.isPending} />
      </form>
    </ModalShell>
  );
}
