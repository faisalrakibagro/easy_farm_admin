'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Check } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { apiFieldErrors } from '@/lib/hooks/useFormErrors';
import { failedMsg } from '@/lib/feedback';
import { fieldClass } from '@/lib/formStyles';
import { orderSessions, sessionsForTimes } from '@/components/dairy/MilkingSessionsPicker';
import type { MilkSession } from '@/types';

/** The breeding values a preset fills in (form strings, as the form keeps them). */
export interface PresetValues {
  gestation_days: string; heat_cycle_days: string; pregnancy_check_days: string; dry_period_days: string;
  is_milking: boolean; milking_sessions: MilkSession[];
}

interface Preset {
  id: number; slug: string | null; name: string | null;
  gestation_days: number | null; heat_cycle_days: number | null; pregnancy_check_days: number | null; dry_period_days: number | null;
  is_milking: boolean; default_milking_times: number; milking_sessions: MilkSession[] | null;
}

const KEY = ['breeding-presets'];
const str = (n: number | null) => (n === null || n === undefined ? '' : String(n));

/**
 * The farm's own list of breeding presets as chips: one click fills the
 * breeding settings; the current values can be saved as a new preset, and a
 * preset can be removed. Removing one never changes an animal type already saved.
 */
export default function BreedingPresetPicker({ values, onApply }: { values: PresetValues; onApply: (v: PresetValues) => void }) {
  const { t } = useTranslation('settings');
  const { hasPermission } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [removing, setRemoving] = useState<Preset | null>(null);
  const k = 'master_data.animal_types.breeding.preset';

  const { data } = useQuery<{ presets: Preset[] }>({
    queryKey: KEY,
    queryFn: async () => (await api.get('/farm/animal-types/presets')).data,
  });
  const presets = data?.presets ?? [];
  const label = (p: Preset) => (p.slug ? t(`${k}.${p.slug}`, { defaultValue: p.name ?? p.slug }) : p.name ?? '');

  const save = useMutation({
    mutationFn: () => api.post('/farm/animal-types/presets', {
      name: name.trim(),
      gestation_days: values.gestation_days || null, heat_cycle_days: values.heat_cycle_days || null,
      pregnancy_check_days: values.pregnancy_check_days || null, dry_period_days: values.dry_period_days || null,
      is_milking: values.is_milking, milking_sessions: values.milking_sessions,
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: KEY });
      setNaming(false); setName(''); setNameError('');
      toast.success(res?.data?.message);
    },
    onError: (e: unknown) => {
      const { fields, message } = apiFieldErrors(e, failedMsg());
      setNameError(fields.name ?? Object.values(fields)[0] ?? message);
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/farm/animal-types/presets/${id}`),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: KEY }); setRemoving(null); toast.success(res?.data?.message); },
    onError: (e: unknown) => { setRemoving(null); toast.error(apiFieldErrors(e, failedMsg()).message); },
  });

  const submitName = () => {
    if (!name.trim()) { setNameError(t(`${k}.name_required`)); return; }
    save.mutate();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {presets.map(p => (
          <span key={p.id} className="inline-flex items-center rounded-full border border-slate-300 text-slate-600">
            <button type="button" className="text-xs ps-3 pe-2 py-1.5 rounded-s-full hover:bg-slate-50"
              onClick={() => onApply({
                gestation_days: str(p.gestation_days), heat_cycle_days: str(p.heat_cycle_days),
                pregnancy_check_days: str(p.pregnancy_check_days), dry_period_days: str(p.dry_period_days),
                is_milking: p.is_milking,
                milking_sessions: p.milking_sessions?.length ? orderSessions(p.milking_sessions) : sessionsForTimes(p.default_milking_times),
              })}>
              {label(p)}
            </button>
            {hasPermission('animal-type.delete') && (
              <button type="button" onClick={() => setRemoving(p)} aria-label={t(`${k}.remove`, { name: label(p) })}
                className="pe-2 ps-1 py-1.5 rounded-e-full text-slate-400 hover:text-red-500 hover:bg-red-50">
                <X size={12} />
              </button>
            )}
          </span>
        ))}
        {hasPermission('animal-type.create') && !naming && (
          <button type="button" onClick={() => setNaming(true)}
            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-dashed border-blue-300 text-blue-600 hover:bg-blue-50">
            <Plus size={12} /> {t(`${k}.save_current`)}
          </button>
        )}
      </div>

      {naming && (
        <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 space-y-2">
          <p className="text-xs text-slate-600">{t(`${k}.save_hint`)}</p>
          <div className="flex gap-2">
            <input value={name} dir="auto" autoFocus maxLength={50} aria-label={t(`${k}.name`)} placeholder={t(`${k}.name_placeholder`)}
              onChange={e => { setName(e.target.value); setNameError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitName(); } }}
              className={fieldClass(nameError, 'flex-1 min-w-0')} />
            <button type="button" onClick={submitName} disabled={save.isPending} aria-label={t(`${k}.save`)}
              className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 text-sm text-white hover:bg-blue-700 disabled:opacity-60">
              <Check size={14} /> <span className="hidden sm:inline">{t(`${k}.save`)}</span>
            </button>
            <button type="button" onClick={() => { setNaming(false); setName(''); setNameError(''); }} aria-label={t(`${k}.cancel`)}
              className="shrink-0 rounded-lg border border-slate-200 px-3 text-slate-500 hover:bg-white"><X size={14} /></button>
          </div>
          {nameError && <p role="alert" className="text-xs text-red-600">{nameError}</p>}
        </div>
      )}

      <ConfirmDialog
        open={!!removing}
        title={t(`${k}.remove_title`)}
        message={t(`${k}.remove_message`, { name: removing ? label(removing) : '' })}
        confirmLabel={t(`${k}.remove_confirm`)}
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing.id)}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
