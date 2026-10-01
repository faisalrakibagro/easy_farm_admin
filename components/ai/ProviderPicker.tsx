'use client';

import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';

export interface AiProvider {
  id: string;
  label: string;
  key_url: string | null;
  models: string[];
  defaults: { chat: string; vision: string } | null;
}

/** The AI service to use, as a row of cards; a tick marks the ones with a saved key. */
export default function ProviderPicker({ providers, value, keys, onChange, disabled }: {
  providers: AiProvider[];
  value: string;
  keys: Record<string, string | null>;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation('ai');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5" role="radiogroup" aria-label={t('settings.provider')}>
      {providers.map(p => {
        const on = p.id === value;
        return (
          <button key={p.id} type="button" role="radio" aria-checked={on} disabled={disabled} onClick={() => onChange(p.id)}
            className={`text-start rounded-xl border-2 px-3 py-2.5 transition-colors disabled:opacity-60 ${on ? 'border-violet-500 bg-violet-50/60' : 'border-slate-200 hover:border-slate-300'}`}>
            <span className="flex items-center justify-between gap-2">
              <span className={`text-sm font-semibold ${on ? 'text-violet-800' : 'text-slate-800'}`}>{t(`settings.provider_name.${p.id}`, { defaultValue: p.label })}</span>
              {keys[p.id] && <Check size={14} className="text-emerald-600 shrink-0" aria-label={t('settings.key_saved_short')} />}
            </span>
            <span className="block text-[11px] text-slate-500 leading-snug mt-0.5">{t(`settings.provider_hint.${p.id}`)}</span>
          </button>
        );
      })}
    </div>
  );
}
