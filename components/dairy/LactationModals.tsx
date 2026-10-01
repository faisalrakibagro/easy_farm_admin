'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import CattleSelect from '@/components/ui/CattleSelect';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import { otherErrors } from '@/lib/hooks/useFormErrors';
import { invalidateKeys } from '@/lib/invalidateGroups';
import type { Lactation } from '@/types';
import { Field, FormActions, ModalShell, animalLabel, apiError, dateOnly, inputCls, todayStr, useBreedingLookups } from '@/components/breeding/shared';
import { fmtDate, fmtNum } from '@/lib/format';

const DAIRY_KEYS = [['dairy'], ['cattle-dairy-history'], ['farm-cattle'], ['cattle-active'], ['cattle-breeding-history']];

/** Start a lactation by hand — for a female bought while already in milk. */
export function StartLactationModal({ onClose, initialCattleId }: { onClose: () => void; initialCattleId?: number }) {
  const { t } = useTranslation('dairy');
  const qc = useQueryClient();
  const toast = useToast();
  const { females } = useBreedingLookups(true);
  const [form, setForm] = useState({ cattle_id: initialCattleId ? String(initialCattleId) : '', start_date: todayStr(), lactation_no: '', notes: '' });
  const [opened] = useState(() => JSON.stringify(form));
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const set = (k: keyof typeof form, v: string) => { setForm(f => ({ ...f, [k]: v })); setFields(p => ({ ...p, [k]: '' })); };

  const mutation = useMutation({
    mutationFn: () => api.post('/farm/dairy/lactations', { ...form, lactation_no: form.lactation_no || null }),
    onSuccess: res => { toast.success(res?.data?.message ?? t('toast.saved')); invalidateKeys(qc, DAIRY_KEYS); onClose(); },
    onError: e => { const r = apiError(e, t('toast.failed')); setFields(r.fields); setError(Object.keys(r.fields).length ? '' : r.message); },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const f: Record<string, string> = {};
    if (!form.cattle_id) f.cattle_id = t('field.select_animal');
    if (!form.start_date) f.start_date = t('common:form.v.date_required');
    setFields(f);
    if (!Object.keys(f).length) mutation.mutate();
  };

  return (
    <ModalShell title={t('btn.start_lactation')} onClose={onClose} dirty={JSON.stringify(form) !== opened}>
      <form onSubmit={submit} noValidate className="p-6 space-y-4">
        <FormAlert message={error} extra={otherErrors(fields, ['cattle_id', 'start_date', 'lactation_no', 'notes'])} />
        <p className="text-xs text-slate-500">{t('hint.manual_lactation')}</p>
        <Field name="cattle_id" label={t('field.animal')} error={fields.cattle_id} required>
          <CattleSelect cattle={females} value={form.cattle_id} onChange={v => set('cattle_id', v)} error={fields.cattle_id}
            placeholder={t('field.select_animal')} label={t('field.animal')} />
        </Field>
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4">
          <Field name="start_date" label={t('field.start_date')} error={fields.start_date} required>
            <input type="date" value={form.start_date} max={todayStr()} onChange={e => set('start_date', e.target.value)} className={inputCls(!!fields.start_date)} />
          </Field>
          <Field name="lactation_no" label={t('field.lactation_no')} error={fields.lactation_no}>
            <NumberInput value={form.lactation_no} allowDecimal={false} error={fields.lactation_no} onChange={v => set('lactation_no', v)} />
          </Field>
        </div>
        <Field name="notes" label={t('field.notes')} error={fields.notes}>
          <textarea rows={2} value={form.notes} dir="auto" onChange={e => set('notes', e.target.value)} className={inputCls(!!fields.notes)} />
        </Field>
        <FormActions onCancel={onClose} saving={mutation.isPending} label={t('btn.save')} />
      </form>
    </ModalShell>
  );
}

/** Close a lactation (dry off). */
export function DryOffModal({ lactation, onClose }: { lactation: Lactation; onClose: () => void }) {
  const { t } = useTranslation('dairy');
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ date: todayStr(), reason: 'dry_off', notes: '' });
  const [opened] = useState(() => JSON.stringify(form));
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const set = (k: keyof typeof form, v: string) => { setForm(f => ({ ...f, [k]: v })); setFields(p => ({ ...p, [k]: '' })); };

  const mutation = useMutation({
    mutationFn: () => api.post(`/farm/dairy/lactations/${lactation.id}/dry-off`, form),
    onSuccess: res => { toast.success(res?.data?.message ?? t('toast.saved')); invalidateKeys(qc, DAIRY_KEYS); onClose(); },
    onError: e => { const r = apiError(e, t('toast.failed')); setFields(r.fields); setError(Object.keys(r.fields).length ? '' : r.message); },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.date) { setFields({ date: t('common:form.v.date_required') }); return; }
    setFields({});
    mutation.mutate();
  };

  return (
    <ModalShell title={t('btn.dry_off')} onClose={onClose} dirty={JSON.stringify(form) !== opened}>
      <form onSubmit={submit} noValidate className="p-6 space-y-4">
        <FormAlert message={error} extra={otherErrors(fields, ['date', 'reason', 'notes'])} />
        {lactation.cattle && <p className="text-sm text-slate-600">{animalLabel(lactation.cattle)} · #{fmtNum(lactation.lactation_no)} · {fmtDate(lactation.start_date)}</p>}
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4">
          <Field name="date" label={t('field.dry_off_date')} error={fields.date} required>
            <input type="date" value={form.date} min={dateOnly(lactation.start_date)} max={todayStr()}
              onChange={e => set('date', e.target.value)} className={inputCls(!!fields.date)} />
          </Field>
          <Field name="reason" label={t('field.end_reason')} error={fields.reason}>
            <select value={form.reason} onChange={e => set('reason', e.target.value)} className={inputCls(!!fields.reason)}>
              {['dry_off', 'sold', 'dead', 'other'].map(r => <option key={r} value={r}>{t('end_reason.' + r)}</option>)}
            </select>
          </Field>
        </div>
        <Field name="notes" label={t('field.notes')} error={fields.notes}>
          <textarea rows={2} value={form.notes} dir="auto" onChange={e => set('notes', e.target.value)} className={inputCls(!!fields.notes)} />
        </Field>
        <FormActions onCancel={onClose} saving={mutation.isPending} label={t('btn.save')} />
      </form>
    </ModalShell>
  );
}
