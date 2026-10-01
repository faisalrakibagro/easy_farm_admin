'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Languages, Save, Check, Info } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { useLanguageConfig, type LanguageConfig } from '@/components/LanguageSwitcher';
import { LANGUAGES, LANG_CODES, type LangCode } from '@/lib/languages';
import { loadFont, type FontChoice } from '@/lib/fonts';

/** A line in each language to preview its font. */
const SAMPLE: Record<LangCode, string> = {
  en: 'Easy Farm — 24 cattle, milk 120 kg, ৳45,000',
  bn: 'ইজি ফার্ম — ২৪টি পশু, দুধ ১২০ কেজি, ৳৪৫,০০০',
  ar: 'إيزي فارم — ٢٤ رأس ماشية، حليب ١٢٠ كجم',
};

/**
 * Settings → Languages: which languages the header menu offers (one, two or
 * all three) and which one a new visitor starts in.
 */
export default function LanguageSettingsPage() {
  const { t } = useTranslation('settings');
  const qc = useQueryClient();
  const toast = useToast();
  const { hasPermission, hasRole } = useAuth();
  const canEdit = hasRole('Super Admin') || hasPermission('settings.edit');
  const { data, isLoading } = useLanguageConfig();

  // Edits start from the saved config; `null` = untouched.
  const [draft, setDraft] = useState<LanguageConfig | null>(null);
  const form = draft ?? data ?? { enabled: LANG_CODES, default: 'bn' as LangCode };
  const options = data?.fontOptions;
  const fonts: FontChoice | undefined = form.fonts ?? data?.fonts;

  // Load every offered font so each dropdown's preview is true to it.
  useEffect(() => {
    if (options) LANG_CODES.forEach(c => options[c]?.forEach(loadFont));
  }, [options]);

  const setFont = (code: LangCode, family: string) =>
    fonts && setDraft({ ...form, fonts: { ...fonts, [code]: family } });

  const toggle = (code: LangCode) => {
    const on = form.enabled.includes(code);
    if (on && form.enabled.length === 1) return; // at least one language
    const enabled = on ? form.enabled.filter(c => c !== code) : LANG_CODES.filter(c => c === code || form.enabled.includes(c));
    setDraft({ ...form, enabled, default: enabled.includes(form.default) ? form.default : enabled[0] });
  };

  const save = useMutation({
    mutationFn: () => api.put('/settings/languages', { enabled: form.enabled, default: form.default, fonts }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['languages'] });
      setDraft(null);
      toast.success(res.data?.message ?? t('languages.saved'));
    },
    onError: (e: unknown) => {
      const d = (e as { response?: { data?: { message?: string } } }).response?.data;
      toast.error(d?.message ?? t('languages.save_failed'));
    },
  });

  const menuNote = form.enabled.length === 1 ? t('languages.note_one') : t('languages.note_many', { count: form.enabled.length });

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800"><Languages size={20} className="text-indigo-500" />{t('languages.title')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('languages.subtitle')}</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 sm:gap-4 px-4 sm:px-5 py-3 text-xs font-medium text-slate-500">
          <span>{t('languages.col_language')} · {t('languages.col_font')}</span>
          <span className="w-14 sm:w-20 text-center">{t('languages.col_in_menu')}</span>
          <span className="w-14 sm:w-20 text-center">{t('languages.col_default')}</span>
        </div>
        {isLoading ? (
          <div className="p-5 space-y-3">{LANG_CODES.map(c => <div key={c} className="h-8 rounded-lg bg-slate-100 animate-pulse" />)}</div>
        ) : LANG_CODES.map(code => {
          const on = form.enabled.includes(code);
          return (
            <div key={code} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5">
              <div className="min-w-0 space-y-1.5">
                <p className="font-medium text-slate-800"><bdi>{LANGUAGES[code].name}</bdi></p>
                <p className="text-xs text-slate-400">{t(`languages.name.${code}`)}{LANGUAGES[code].rtl ? ` · ${t('languages.rtl')}` : ''}</p>
                {options && fonts && (
                  <>
                    <select value={fonts[code]} onChange={e => setFont(code, e.target.value)} disabled={!canEdit}
                      aria-label={t('languages.col_font')}
                      className="w-full max-w-xs border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      {options[code].map(o => <option key={o.family} value={o.family} style={{ fontFamily: o.stack }}>{o.family}</option>)}
                    </select>
                    <p dir={LANGUAGES[code].rtl ? 'rtl' : 'ltr'} className="text-base text-slate-700 truncate" style={{ fontFamily: options[code].find(o => o.family === fonts[code])?.stack }}>{SAMPLE[code]}</p>
                  </>
                )}
              </div>
              <label className="w-14 sm:w-20 min-h-10 flex items-center justify-center cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-emerald-600" checked={on} disabled={!canEdit || (on && form.enabled.length === 1)}
                  onChange={() => toggle(code)} aria-label={t('languages.col_in_menu')} />
              </label>
              <label className="w-14 sm:w-20 min-h-10 flex items-center justify-center cursor-pointer">
                <input type="radio" name="default-language" className="w-4 h-4 accent-emerald-600" checked={form.default === code} disabled={!canEdit || !on}
                  onChange={() => setDraft({ ...form, default: code })} aria-label={t('languages.col_default')} />
              </label>
            </div>
          );
        })}
      </div>

      <p className="flex items-start gap-2 text-sm text-slate-600 bg-sky-50 border border-sky-100 rounded-xl px-4 py-3">
        <Info size={16} className="text-sky-500 shrink-0 mt-0.5" />{menuNote}
      </p>

      {canEdit && (
        <div className="flex justify-end">
          <button type="button" onClick={() => save.mutate()} disabled={!draft || save.isPending}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
            {save.isPending ? <Check size={16} className="animate-pulse" /> : <Save size={16} />}{t('languages.save')}
          </button>
        </div>
      )}
    </div>
  );
}
