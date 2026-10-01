'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import CattleSelect from '@/components/ui/CattleSelect';
import SearchSelect from '@/components/ui/SearchSelect';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import { otherErrors } from '@/lib/hooks/useFormErrors';
import { invalidateMoney } from '@/lib/invalidateGroups';
import type { AnimalType, BreedingRecord, CattleGender, DeliveryType, PaginatedResponse } from '@/types';
import {
  AccountSelect, Field, FormActions, ModalShell, apiError, inputCls, todayStr, useBreedingLookups,
} from './shared';
import { fmtDate, fmtNum } from '@/lib/format';

type CalfRow = { alive: boolean; gender: CattleGender | ''; birth_weight: string; birth_value: string; tag_number: string; name: string };
const newCalf = (): CalfRow => ({ alive: true, gender: '', birth_weight: '', birth_value: '', tag_number: '', name: '' });

const SHOWN = ['dam_id', 'breeding_record_id', 'sire_id', 'birth_date', 'delivery_type', 'cost', 'payment_account_id', 'notes', 'calves*'];

interface BirthModalProps {
  onClose: () => void;
  initialDamId?: number;
  initialServiceId?: number;
}

/** Record a delivery. Every live calf becomes a new animal with its parents set. */
export default function BirthModal({ onClose, initialDamId, initialServiceId }: BirthModalProps) {
  const { t } = useTranslation('breeding');
  const { t: tc } = useTranslation('cattle');
  const qc = useQueryClient();
  const toast = useToast();
  const { females, males, accounts, defaultAccountId } = useBreedingLookups(true);

  const [form, setForm] = useState({
    dam_id: initialDamId ? String(initialDamId) : '',
    sire_id: '', birth_date: todayStr(), delivery_type: 'normal' as DeliveryType,
    cost: '', payment_account_id: '', notes: '',
  });
  // null = not chosen yet: fall back to the mother's pregnant (or only open) service.
  const [serviceChoice, setServiceChoice] = useState<string | null>(initialServiceId ? String(initialServiceId) : null);
  const [calves, setCalves] = useState<CalfRow[]>([newCalf()]);
  const snapshot = () => JSON.stringify([{ ...form, payment_account_id: form.cost ? form.payment_account_id : '' }, serviceChoice, calves]);
  const [opened] = useState(snapshot);
  const dirty = snapshot() !== opened;
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const set = (k: keyof typeof form, v: string) => { setForm(f => ({ ...f, [k]: v })); setFields(p => ({ ...p, [k]: '' })); };
  const setCalf = (i: number, patch: Partial<CalfRow>) => {
    setCalves(cs => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
    setFields(p => {
      const next = { ...p };
      Object.keys(patch).forEach(k => { delete next[`calves.${i}.${k}`]; });
      return next;
    });
  };

  const dam = females.find(f => String(f.id) === form.dam_id);

  // The species' default calf value fills an empty value field (plan 5.1).
  const { data: animalTypes } = useQuery({
    queryKey: ['animal-types-all'],
    queryFn: async () => (await api.get('/farm/animal-types/all')).data as AnimalType[],
  });
  const damType = animalTypes?.find(tp => tp.id === dam?.animal_type_id);
  const defaultValue = (gender: CattleGender | '') => {
    const v = gender === 'male' ? damType?.calf_value_male : gender === 'female' ? damType?.calf_value_female : null;
    return v != null ? String(parseFloat(String(v))) : '';
  };

  // The mother's open services (awaiting result or pregnant) to link the delivery to.
  const { data: openServices } = useQuery({
    queryKey: ['breeding', 'open-services', form.dam_id],
    queryFn: async () => (await api.get('/farm/breeding/services', { params: { female_id: form.dam_id, status: 'open', per_page: 20 } })).data as PaginatedResponse<BreedingRecord>,
    enabled: !!form.dam_id,
  });

  const openList = openServices?.data ?? [];
  const autoPick = openList.find(s => s.status === 'pregnant') ?? (openList.length === 1 ? openList[0] : undefined);
  const serviceId = serviceChoice ?? (autoPick ? String(autoPick.id) : '');

  const paid = parseFloat(form.cost || '0') > 0;

  const mutation = useMutation({
    mutationFn: () => api.post('/farm/breeding/births', {
      ...form,
      breeding_record_id: serviceId || null,
      sire_id: serviceId ? null : (form.sire_id || null),
      cost: form.cost || 0,
      payment_account_id: paid ? form.payment_account_id : null,
      calves: calves.map(c => c.alive
        ? { alive: true, gender: c.gender, birth_weight: c.birth_weight || null, birth_value: c.birth_value || null, tag_number: c.tag_number || null, name: c.name || null }
        : { alive: false }),
    }),
    onSuccess: res => {
      toast.success(res?.data?.message ?? t('toast.saved'));
      invalidateMoney(qc, [['breeding'], ['farm-cattle'], ['cattle-active'], ['cattle-breeding-history'], ['cattle-pedigree']]);
      onClose();
    },
    onError: e => { const r = apiError(e, t('toast.failed')); setFields(r.fields); setError(Object.keys(r.fields).length ? '' : r.message); },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const f: Record<string, string> = {};
    if (!form.dam_id) f.dam_id = t('field.select_female');
    if (!form.birth_date) f.birth_date = t('common:form.v.date_required');
    calves.forEach((c, i) => { if (c.alive && !c.gender) f[`calves.${i}.gender`] = t('common:form.v.required'); });
    if (paid && !form.payment_account_id) f.payment_account_id = t('common:form.v.account_required');
    setFields(f);
    if (!Object.keys(f).length) mutation.mutate();
  };

  // Calf errors the rows do not show (e.g. calves.0 or calves.2.alive).
  const calfShown = calves.flatMap((_, i) => ['gender', 'birth_weight', 'birth_value', 'tag_number', 'name'].map(k => `calves.${i}.${k}`));
  const extra = [
    ...otherErrors(fields, SHOWN),
    ...otherErrors(Object.fromEntries(Object.entries(fields).filter(([k]) => k.startsWith('calves'))), calfShown),
  ];

  return (
    <ModalShell title={t('btn.birth')} onClose={onClose} wide dirty={dirty}>
      <form onSubmit={submit} noValidate className="p-6 space-y-4">
        <FormAlert message={error} extra={extra} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field name="dam_id" label={t('field.dam')} error={fields.dam_id} required>
            <CattleSelect cattle={females} value={form.dam_id} error={fields.dam_id}
              placeholder={t('field.select_female')} label={t('field.dam')}
              onChange={v => { set('dam_id', v); setServiceChoice(null); }} />
          </Field>
          <Field name="breeding_record_id" label={t('field.service')} error={fields.breeding_record_id}>
            <SearchSelect value={serviceId} onChange={v => { setServiceChoice(v); setFields(p => ({ ...p, breeding_record_id: '' })); }}
              error={fields.breeding_record_id} disabled={!form.dam_id} label={t('field.service')}
              options={[
                { value: '', label: t('field.no_service') },
                ...openList.map(s => ({
                  value: String(s.id),
                  label: `${fmtDate(s.service_date)} · ${s.method === 'ai' ? `${t('method.ai')} ${s.semen_straw?.bull_name ?? ''}` : (s.sire?.tag_number ?? '')}`,
                  sub: t('status.' + s.status),
                })),
              ]} />
          </Field>
          {!serviceId && (
            <Field name="sire_id" label={t('field.sire')} error={fields.sire_id}>
              <CattleSelect cattle={males.filter(m => !dam?.animal_type_id || m.animal_type_id === dam.animal_type_id)}
                value={form.sire_id} onChange={v => set('sire_id', v)} error={fields.sire_id} clearable
                placeholder={t('field.none')} label={t('field.sire')} />
            </Field>
          )}
          <Field name="birth_date" label={t('field.birth_date')} error={fields.birth_date} required>
            <input type="date" value={form.birth_date} max={todayStr()} onChange={e => set('birth_date', e.target.value)} className={inputCls(!!fields.birth_date)} />
          </Field>
          <Field name="delivery_type" label={t('field.delivery_type')} error={fields.delivery_type}>
            <select value={form.delivery_type} onChange={e => set('delivery_type', e.target.value)} className={inputCls(!!fields.delivery_type)}>
              {(['normal', 'assisted', 'caesarean'] as DeliveryType[]).map(d => <option key={d} value={d}>{t('delivery_type.' + d)}</option>)}
            </select>
          </Field>
        </div>

        {/* Calves */}
        <div className="rounded-xl border border-slate-200 p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-700">{t('field.calves')} ({fmtNum(calves.length)})</p>
            {calves.length < 6 && (
              <button type="button" onClick={() => setCalves(cs => [...cs, newCalf()])}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium py-1">
                <Plus size={14} /> {t('btn.add_calf')}
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500">{t('hint.calf_register')}</p>
          {calves.map((c, i) => (
            <div key={i} className="rounded-lg bg-slate-50 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div role="radiogroup" className="grid grid-cols-2 gap-1.5 w-52 max-w-full">
                  {[true, false].map(alive => (
                    <button key={String(alive)} type="button" role="radio" aria-checked={c.alive === alive} onClick={() => setCalf(i, { alive })}
                      className={`px-2 py-2 sm:py-1 text-xs rounded-md border font-medium ${c.alive === alive
                        ? (alive ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-400 bg-red-50 text-red-700')
                        : 'border-slate-300 text-slate-500 bg-white'}`}>
                      {alive ? t('field.alive') : t('field.dead')}
                    </button>
                  ))}
                </div>
                {calves.length > 1 && (
                  <button type="button" onClick={() => setCalves(cs => cs.filter((_, j) => j !== i))} title={t('btn.remove')} aria-label={t('btn.remove')}
                    className="p-2 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={16} /></button>
                )}
              </div>
              {c.alive && (
                <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field name={`calves.${i}.gender`} label={t('field.gender')} error={fields[`calves.${i}.gender`]} required>
                    <select value={c.gender} onChange={e => setCalf(i, { gender: e.target.value as CattleGender })}
                      className={inputCls(!!fields[`calves.${i}.gender`])}>
                      <option value="">—</option>
                      <option value="female">{tc('gender.female')}</option>
                      <option value="male">{tc('gender.male')}</option>
                    </select>
                  </Field>
                  <Field name={`calves.${i}.birth_weight`} label={t('field.birth_weight')} error={fields[`calves.${i}.birth_weight`]}>
                    <NumberInput value={c.birth_weight} error={fields[`calves.${i}.birth_weight`]} onChange={v => setCalf(i, { birth_weight: v })} />
                  </Field>
                  <Field name={`calves.${i}.birth_value`} label={t('field.birth_value')} error={fields[`calves.${i}.birth_value`]} hint={t('hint.birth_value')}>
                    <NumberInput value={c.birth_value} prefix="৳" placeholder={defaultValue(c.gender)} error={fields[`calves.${i}.birth_value`]}
                      onChange={v => setCalf(i, { birth_value: v })} />
                  </Field>
                  <Field name={`calves.${i}.tag_number`} label={t('field.tag')} error={fields[`calves.${i}.tag_number`]}>
                    <input value={c.tag_number} dir="ltr" onChange={e => setCalf(i, { tag_number: e.target.value })} className={inputCls(!!fields[`calves.${i}.tag_number`])} />
                  </Field>
                  <Field name={`calves.${i}.name`} label={t('field.name')} error={fields[`calves.${i}.name`]}>
                    <input value={c.name} dir="auto" onChange={e => setCalf(i, { name: e.target.value })} className={inputCls(!!fields[`calves.${i}.name`])} />
                  </Field>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field name="cost" label={t('field.cost')} error={fields.cost}>
            <NumberInput value={form.cost} prefix="৳" placeholder="0" error={fields.cost}
              onChange={v => { set('cost', v); if (!form.payment_account_id) set('payment_account_id', defaultAccountId); }} />
          </Field>
          {paid && (
            <AccountSelect value={form.payment_account_id} onChange={v => set('payment_account_id', v)} accounts={accounts}
              error={fields.payment_account_id} amount={form.cost} required />
          )}
        </div>
        <Field name="notes" label={t('field.notes')} error={fields.notes}>
          <textarea rows={2} value={form.notes} dir="auto" onChange={e => set('notes', e.target.value)} className={inputCls(!!fields.notes)} />
        </Field>
        <FormActions onCancel={onClose} saving={mutation.isPending} />
      </form>
    </ModalShell>
  );
}
