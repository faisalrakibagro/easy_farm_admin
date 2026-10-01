'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import { otherErrors } from '@/lib/hooks/useFormErrors';
import { invalidateMoney } from '@/lib/invalidateGroups';
import type { BreedingRecord, PregnancyCheckMethod } from '@/types';
import { AccountSelect, Field, FormActions, ModalShell, animalLabel, apiError, dateOnly, inputCls, todayStr, useBreedingLookups } from './shared';
import { fmtDate } from '@/lib/format';

const SHOWN = ['check_date', 'method', 'result', 'checked_by', 'cost', 'payment_account_id', 'notes'];

export default function PregnancyCheckModal({ service, onClose }: { service: Pick<BreedingRecord, 'id' | 'service_date' | 'female'>; onClose: () => void }) {
  const { t } = useTranslation('breeding');
  const qc = useQueryClient();
  const toast = useToast();
  const { accounts, defaultAccountId } = useBreedingLookups(true);

  const [form, setForm] = useState({
    check_date: todayStr(), method: 'manual' as PregnancyCheckMethod, result: '' as '' | 'positive' | 'negative',
    checked_by: '', cost: '', payment_account_id: '', notes: '',
  });
  const [opened] = useState(() => JSON.stringify({ ...form, payment_account_id: '' }));
  const dirty = JSON.stringify({ ...form, payment_account_id: form.cost ? form.payment_account_id : '' }) !== opened;
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const set = (k: keyof typeof form, v: string) => { setForm(f => ({ ...f, [k]: v })); setFields(p => ({ ...p, [k]: '' })); };
  const paid = parseFloat(form.cost || '0') > 0;

  const mutation = useMutation({
    mutationFn: () => api.post(`/farm/breeding/services/${service.id}/pregnancy-checks`, {
      ...form, cost: form.cost || 0, payment_account_id: paid ? form.payment_account_id : null,
    }),
    onSuccess: res => {
      toast.success(res?.data?.message ?? t('toast.saved'));
      invalidateMoney(qc, [['breeding'], ['farm-cattle'], ['cattle-active'], ['cattle-breeding-history']]);
      onClose();
    },
    onError: e => { const r = apiError(e, t('toast.failed')); setFields(r.fields); setError(Object.keys(r.fields).length ? '' : r.message); },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const f: Record<string, string> = {};
    if (!form.check_date) f.check_date = t('common:form.v.date_required');
    if (!form.result) f.result = t('common:form.v.required');
    if (paid && !form.payment_account_id) f.payment_account_id = t('common:form.v.account_required');
    setFields(f);
    if (!Object.keys(f).length) mutation.mutate();
  };

  return (
    <ModalShell title={t('btn.check')} onClose={onClose} dirty={dirty}>
      <form onSubmit={submit} noValidate className="p-6 space-y-4">
        <FormAlert message={error} extra={otherErrors(fields, SHOWN)} />
        <p className="text-sm text-slate-600">
          {service.female ? animalLabel(service.female) : ''} · {t('field.service_date')}: {fmtDate(service.service_date)}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field name="check_date" label={t('field.check_date')} error={fields.check_date} required>
            <input type="date" value={form.check_date} min={dateOnly(service.service_date)} max={todayStr()}
              onChange={e => set('check_date', e.target.value)} className={inputCls(!!fields.check_date)} />
          </Field>
          <Field name="method" label={t('field.check_method')} error={fields.method} required>
            <select value={form.method} onChange={e => set('method', e.target.value)} className={inputCls(!!fields.method)}>
              {(['manual', 'ultrasound', 'test_kit'] as PregnancyCheckMethod[]).map(m => <option key={m} value={m}>{t('check_method.' + m)}</option>)}
            </select>
          </Field>
        </div>

        <Field name="result" label={t('field.result')} error={fields.result} required>
          <div role="radiogroup" className="grid grid-cols-2 gap-2">
            {(['positive', 'negative'] as const).map(r => (
              <button key={r} type="button" role="radio" aria-checked={form.result === r} onClick={() => set('result', r)}
                className={`px-3 py-2.5 sm:py-2 text-sm rounded-lg border font-medium ${form.result === r
                  ? (r === 'positive' ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-slate-500 bg-slate-100 text-slate-700')
                  : fields.result ? 'border-red-400 text-slate-600' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                {t('result.' + r)}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field name="checked_by" label={t('field.checked_by')} error={fields.checked_by}>
            <input value={form.checked_by} dir="auto" onChange={e => set('checked_by', e.target.value)} className={inputCls(!!fields.checked_by)} />
          </Field>
          <Field name="cost" label={t('field.cost')} error={fields.cost}>
            <NumberInput value={form.cost} prefix="৳" placeholder="0" error={fields.cost}
              onChange={v => { set('cost', v); if (!form.payment_account_id) set('payment_account_id', defaultAccountId); }} />
          </Field>
        </div>
        {paid && (
          <AccountSelect value={form.payment_account_id} onChange={v => set('payment_account_id', v)} accounts={accounts}
            error={fields.payment_account_id} amount={form.cost} required />
        )}
        <Field name="notes" label={t('field.notes')} error={fields.notes}>
          <textarea rows={2} value={form.notes} dir="auto" onChange={e => set('notes', e.target.value)} className={inputCls(!!fields.notes)} />
        </Field>
        <FormActions onCancel={onClose} saving={mutation.isPending} />
      </form>
    </ModalShell>
  );
}
