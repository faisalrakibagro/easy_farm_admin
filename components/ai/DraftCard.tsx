'use client';

import { useTranslation } from 'react-i18next';
import { Milk, Scale, Stethoscope, Heart, Receipt, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { VoiceAction, VoiceKind } from '@/lib/ai';
import { inputClass } from '@/components/expenses/types';
import { PER_CATTLE_CATEGORIES } from '@/components/cattle/BulkExpenseModal';
import { localDateStr } from '@/lib/dates';
import NumericInput from '@/components/ui/NumericInput';

const KIND: Record<VoiceKind, { icon: React.ElementType; tone: string }> = {
  milk:    { icon: Milk,        tone: 'bg-sky-50 text-sky-600' },
  weight:  { icon: Scale,       tone: 'bg-amber-50 text-amber-600' },
  health:  { icon: Stethoscope, tone: 'bg-rose-50 text-rose-600' },
  heat:    { icon: Heart,       tone: 'bg-pink-50 text-pink-600' },
  expense: { icon: Receipt,     tone: 'bg-violet-50 text-violet-600' },
};

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block min-w-0 ${wide ? 'col-span-2' : ''}`}>
      <span className="block text-[11px] font-medium text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

/**
 * One entry read from what was said. Every field can be corrected before
 * saving; a card with a problem blocks saving until it is fixed or removed.
 */
export default function DraftCard({ action, onChange, onRemove, disabled }: {
  action: VoiceAction;
  onChange: (next: VoiceAction) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation('ai');
  const { icon: Icon, tone } = KIND[action.kind];
  const bad = action.problems.length > 0;
  const set = (patch: Partial<VoiceAction>) => onChange({ ...action, ...patch });
  const num = (v: string) => (v === '' ? null : Number(v));
  const animalText = action.cattle?.tag_number ?? action.animal ?? '';

  return (
    <div className={`rounded-xl border p-3.5 space-y-3 ${bad ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start gap-2.5">
        <span className={`grid place-items-center w-8 h-8 rounded-lg shrink-0 ${tone}`}><Icon size={16} /></span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-500">{t(`voice.kind.${action.kind}`)}</p>
          {/* The kind already has its icon here, so the summary's leading emoji is left out. */}
          <p className="text-sm text-slate-800 break-words">{action.summary.replace(/^\p{Extended_Pictographic}️?\s*/u, '')}</p>
          {action.cattle && (
            <p className="text-[11px] text-slate-500 mt-0.5">
              {[action.cattle.tag_number, action.cattle.name, action.cattle.type].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <button type="button" onClick={onRemove} disabled={disabled} aria-label={t('voice.remove')}
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40">
          <Trash2 size={15} />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {(action.kind !== 'expense' || animalText) && (
          <Field label={t('voice.field.animal')}>
            <input value={animalText} disabled={disabled} dir="auto"
              onChange={e => set({ animal: e.target.value, cattle_id: null, cattle: null })}
              className={inputClass()} />
          </Field>
        )}
        <Field label={t('voice.field.date')}>
          <input type="date" value={action.date} max={localDateStr()} disabled={disabled}
            onChange={e => set({ date: e.target.value })} className={inputClass()} />
        </Field>

        {action.kind === 'milk' && (
          <>
            <Field label={t('voice.field.session')}>
              <select value={action.session} disabled={disabled} onChange={e => set({ session: e.target.value as VoiceAction['session'] })} className={inputClass()}>
                {(['morning', 'noon', 'evening'] as const).map(s => <option key={s} value={s}>{t(`voice.session.${s}`)}</option>)}
              </select>
            </Field>
            <Field label={t('voice.field.milk_kg')}>
              <NumericInput inputMode="decimal" min={0} step="0.01" value={action.milk_kg ?? ''} disabled={disabled}
                onChange={e => set({ milk_kg: num(e.target.value) })} className={inputClass()} />
            </Field>
          </>
        )}

        {action.kind === 'weight' && (
          <Field label={t('voice.field.weight_kg')}>
            <NumericInput inputMode="decimal" min={1} step="0.1" value={action.weight_kg ?? ''} disabled={disabled}
              onChange={e => set({ weight_kg: num(e.target.value) })} className={inputClass()} />
          </Field>
        )}

        {action.kind === 'health' && (
          <>
            <Field label={t('voice.field.health_status')}>
              <select value={action.health_status} disabled={disabled} onChange={e => set({ health_status: e.target.value as VoiceAction['health_status'] })} className={inputClass()}>
                {(['sick', 'critical', 'recovering', 'healthy'] as const).map(s => <option key={s} value={s}>{t(`voice.health.${s}`)}</option>)}
              </select>
            </Field>
            <Field label={t('voice.field.problem')} wide>
              <input value={action.note ?? ''} disabled={disabled} dir="auto" onChange={e => set({ note: e.target.value })} className={inputClass()} />
            </Field>
          </>
        )}

        {action.kind === 'heat' && (
          <Field label={t('voice.field.signs')} wide>
            <input value={action.note ?? ''} disabled={disabled} dir="auto" onChange={e => set({ note: e.target.value })} className={inputClass()} />
          </Field>
        )}

        {action.kind === 'expense' && (
          <>
            <Field label={t('voice.field.category')}>
              <select value={action.category} disabled={disabled} onChange={e => set({ category: e.target.value })} className={inputClass()}>
                {PER_CATTLE_CATEGORIES.map(c => <option key={c} value={c}>{t(`common:expense_category.${c}`)}</option>)}
              </select>
            </Field>
            <Field label={t('voice.field.amount')}>
              <NumericInput inputMode="decimal" min={0} step="1" value={action.amount ?? ''} disabled={disabled}
                onChange={e => set({ amount: num(e.target.value) })} className={inputClass()} />
            </Field>
            <Field label={t('voice.field.expense_title')} wide>
              <input value={action.note ?? ''} disabled={disabled} dir="auto" onChange={e => set({ note: e.target.value })} className={inputClass()} />
            </Field>
          </>
        )}
      </div>

      {bad ? (
        <ul className="space-y-1">
          {action.problems.map((p, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-rose-700"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {p}</li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-emerald-700"><CheckCircle2 size={13} /> {t('voice.ready')}</p>
      )}
    </div>
  );
}
