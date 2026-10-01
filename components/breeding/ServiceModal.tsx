'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import CattleSelect from '@/components/ui/CattleSelect';
import SearchSelect from '@/components/ui/SearchSelect';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import { otherErrors } from '@/lib/hooks/useFormErrors';
import { invalidateMoney } from '@/lib/invalidateGroups';
import type { AnimalType, BreedingMethod } from '@/types';
import {
  AccountSelect, Field, FormActions, ModalShell, apiError, inputCls, money, todayStr, useBreedingLookups,
} from './shared';
import { fmtDate, fmtNum } from '@/lib/format';

type SemenOption = { id: number; animal_type_id: number; bull_name: string; bull_code: string | null; breed: string | null; remaining: number; cost_per_straw: string };

const SHOWN = ['female_id', 'service_date', 'method', 'sire_id', 'semen_straw_id', 'technician_name', 'service_fee', 'payment_account_id', 'notes'];

interface ServiceModalProps {
  onClose: () => void;
  initialFemaleId?: number;
  heatRecordId?: number;
  initialDate?: string;
}

/** Record a service — natural mating or artificial insemination. */
export default function ServiceModal({ onClose, initialFemaleId, heatRecordId, initialDate }: ServiceModalProps) {
  const { t } = useTranslation('breeding');
  const qc = useQueryClient();
  const toast = useToast();
  const { females, males, accounts, defaultAccountId } = useBreedingLookups(true);

  const [form, setForm] = useState({
    female_id: initialFemaleId ? String(initialFemaleId) : '',
    service_date: initialDate ?? todayStr(),
    method: 'ai' as BreedingMethod,
    sire_id: '', semen_straw_id: '', technician_name: '', service_fee: '',
    payment_account_id: '', notes: '',
  });
  const [opened] = useState(() => JSON.stringify(form));
  // The account is filled in by itself when a fee is typed; only the fee counts.
  const dirty = JSON.stringify({ ...form, payment_account_id: form.service_fee ? form.payment_account_id : '' }) !== opened;
  const [confirmRelated, setConfirmRelated] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const set = (k: keyof typeof form, v: string) => { setForm(f => ({ ...f, [k]: v })); setFields(p => ({ ...p, [k]: '' })); };

  const female = females.find(f => String(f.id) === form.female_id);
  const typeId = female?.animal_type_id ?? null;

  const { data: types } = useQuery({
    queryKey: ['animal-types-all'],
    queryFn: async () => (await api.get('/farm/animal-types/all')).data as AnimalType[],
  });
  const type = types?.find(tp => tp.id === typeId);

  const { data: semen } = useQuery({
    queryKey: ['breeding-semen-all', typeId],
    queryFn: async () => (await api.get('/farm/breeding/semen/all', { params: { animal_type_id: typeId } })).data.semen as SemenOption[],
    enabled: !!typeId && form.method === 'ai',
  });
  const straw = semen?.find(s => String(s.id) === form.semen_straw_id);

  // Warn before mating close relatives.
  const { data: relation } = useQuery({
    queryKey: ['breeding-relation', form.female_id, form.sire_id],
    queryFn: async () => (await api.get('/farm/breeding/relation-check', { params: { female_id: form.female_id, sire_id: form.sire_id } })).data as { relation: string | null; message: string | null },
    enabled: form.method === 'natural' && !!form.female_id && !!form.sire_id,
  });

  const expected = type?.gestation_days && form.service_date
    ? new Date(new Date(form.service_date).getTime() + type.gestation_days * 86400000).toISOString().split('T')[0]
    : null;

  const mutation = useMutation({
    mutationFn: () => api.post('/farm/breeding/services', {
      ...form,
      sire_id: form.method === 'natural' ? form.sire_id : null,
      semen_straw_id: form.method === 'ai' ? form.semen_straw_id : null,
      service_fee: form.service_fee || 0,
      payment_account_id: parseFloat(form.service_fee || '0') > 0 ? form.payment_account_id : null,
      heat_record_id: heatRecordId ?? null,
      confirm_related: confirmRelated,
    }),
    onSuccess: res => {
      toast.success(res?.data?.message ?? t('toast.saved'));
      invalidateMoney(qc, [['breeding'], ['farm-cattle'], ['cattle-active'], ['cattle-breeding-history'], ['breeding-semen-all']]);
      onClose();
    },
    onError: e => {
      const { message, fields } = apiError(e, t('toast.failed'));
      setFields(fields); setError(Object.keys(fields).length ? '' : message);
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const f: Record<string, string> = {};
    if (!form.female_id) f.female_id = t('field.select_female');
    if (!form.service_date) f.service_date = t('common:form.v.date_required');
    if (form.method === 'natural' && !form.sire_id) f.sire_id = t('field.select_sire');
    if (form.method === 'ai' && !form.semen_straw_id) f.semen_straw_id = t('field.select_semen');
    if (parseFloat(form.service_fee || '0') > 0 && !form.payment_account_id) f.payment_account_id = t('common:form.v.account_required');
    setFields(f);
    if (!Object.keys(f).length) mutation.mutate();
  };

  return (
    <ModalShell title={t('btn.service')} onClose={onClose} dirty={dirty}>
      <form onSubmit={submit} noValidate className="p-6 space-y-4">
        <FormAlert message={error} extra={otherErrors(fields, SHOWN)} />

        <Field name="female_id" label={t('field.female')} error={fields.female_id} required>
          <CattleSelect cattle={females} value={form.female_id} error={fields.female_id}
            placeholder={t('field.select_female')} label={t('field.female')}
            onChange={v => { set('female_id', v); set('sire_id', ''); set('semen_straw_id', ''); }} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field name="service_date" label={t('field.service_date')} error={fields.service_date} required
            hint={expected ? t('hint.expected_delivery', { date: fmtDate(expected) }) : (female && type && !type.gestation_days ? t('hint.no_type_settings') : undefined)}>
            <input type="date" value={form.service_date} max={todayStr()} onChange={e => set('service_date', e.target.value)} className={inputCls(!!fields.service_date)} />
          </Field>
          <Field name="method" label={t('field.method')} error={fields.method} required>
            <div role="radiogroup" className="grid grid-cols-2 gap-2">
              {(['ai', 'natural'] as BreedingMethod[]).map(m => (
                <button key={m} type="button" role="radio" aria-checked={form.method === m} onClick={() => set('method', m)}
                  className={`px-2 py-2.5 sm:py-2 text-xs rounded-lg border font-medium ${form.method === m ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                  {m === 'ai' ? t('method.ai') : t('method.natural')}
                </button>
              ))}
            </div>
          </Field>
        </div>

        {form.method === 'natural' ? (
          <Field name="sire_id" label={t('field.sire')} error={fields.sire_id} required>
            <CattleSelect cattle={males.filter(m => !typeId || m.animal_type_id === typeId)} value={form.sire_id} error={fields.sire_id}
              placeholder={t('field.select_sire')} label={t('field.sire')}
              onChange={v => { set('sire_id', v); setConfirmRelated(false); }} />
          </Field>
        ) : (
          <Field name="semen_straw_id" label={t('field.semen')} error={fields.semen_straw_id} required
            hint={straw ? `${t('hint.straw_cost', { cost: fmtNum(straw.cost_per_straw, 2) })} ${t('hint.straws_left', { count: fmtNum(straw.remaining) })}` : undefined}>
            <SearchSelect value={form.semen_straw_id} onChange={v => set('semen_straw_id', v)} error={fields.semen_straw_id} disabled={!typeId}
              placeholder={t('field.select_semen')} label={t('field.semen')}
              options={(semen ?? []).map(s => ({
                value: String(s.id),
                label: `${s.bull_name}${s.bull_code ? ` (${s.bull_code})` : ''}`,
                sub: [s.breed, t('hint.straws_left', { count: fmtNum(s.remaining) })].filter(Boolean).join(' · '),
                keywords: `${s.bull_code ?? ''} ${s.breed ?? ''}`,
              }))} />
          </Field>
        )}

        {relation?.relation && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 space-y-1.5">
            <p className="flex items-start gap-2"><AlertTriangle size={16} className="mt-0.5 flex-shrink-0" /> {relation.message}</p>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={confirmRelated} onChange={e => setConfirmRelated(e.target.checked)} className="accent-amber-600" />
              {t('hint.confirm_related')}
            </label>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field name="technician_name" label={t('field.technician')} error={fields.technician_name}>
            <input value={form.technician_name} dir="auto" onChange={e => set('technician_name', e.target.value)} className={inputCls(!!fields.technician_name)} />
          </Field>
          <Field name="service_fee" label={t('field.service_fee')} error={fields.service_fee}>
            <NumberInput value={form.service_fee} prefix="৳" placeholder="0" error={fields.service_fee}
              onChange={v => { set('service_fee', v); if (!form.payment_account_id) set('payment_account_id', defaultAccountId); }} />
          </Field>
        </div>

        {parseFloat(form.service_fee || '0') > 0 && (
          <AccountSelect value={form.payment_account_id} onChange={v => set('payment_account_id', v)} accounts={accounts}
            error={fields.payment_account_id} amount={form.service_fee} required />
        )}

        {(straw || parseFloat(form.service_fee || '0') > 0) && (
          <p className="text-xs text-slate-500">
            {t('field.total')}: {money((straw ? parseFloat(straw.cost_per_straw) : 0) + parseFloat(form.service_fee || '0'))}
          </p>
        )}

        <Field name="notes" label={t('field.notes')} error={fields.notes}>
          <textarea rows={2} value={form.notes} dir="auto" onChange={e => set('notes', e.target.value)} className={inputCls(!!fields.notes)} />
        </Field>

        <FormActions onCancel={onClose} saving={mutation.isPending} />
      </form>
    </ModalShell>
  );
}
