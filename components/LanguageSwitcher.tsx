'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Languages } from 'lucide-react';
import api from '@/lib/api';
import { LANGUAGES, LANG_CODES, isLangCode, setLanguage, type LangCode } from '@/lib/languages';
import type { FontChoice, FontOptions } from '@/lib/fonts';

export interface LanguageConfig { enabled: LangCode[]; default: LangCode; fonts?: FontChoice; fontOptions?: FontOptions }

/** Which languages the menu offers — Settings → Languages. Public, so the login page has it too. */
export function useLanguageConfig() {
  return useQuery<LanguageConfig>({
    queryKey: ['languages'],
    queryFn: async () => {
      const d = (await api.get('/languages')).data;
      const enabled = (d.enabled as string[]).filter(isLangCode);
      return {
        enabled: enabled.length ? enabled : ['en'],
        default: isLangCode(d.default) ? d.default : enabled[0] ?? 'en',
        fonts: d.fonts,
        fontOptions: d.font_options,
      };
    },
    staleTime: 10 * 60 * 1000,
  });
}

/** The languages on offer, the one in use, and how to switch — for the menu below and the phone account menu. */
export function useLanguageChoice() {
  const { i18n } = useTranslation();
  const qc = useQueryClient();
  const { data } = useLanguageConfig();
  const enabled = data?.enabled ?? LANG_CODES;
  const current: LangCode = isLangCode(i18n.language) ? i18n.language : 'en';
  const choose = (lng: LangCode) => {
    if (lng === current) return;
    setLanguage(lng);
    qc.invalidateQueries();
  };
  return { enabled, current, choose };
}

/**
 * Language menu. One language enabled: nothing to choose, so it is hidden.
 * Two or three: a dropdown with each language in its own script. If the
 * language in use gets switched off in Settings, the UI moves to the default.
 */
export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const qc = useQueryClient();
  const { data } = useLanguageConfig();
  const { enabled, current, choose: switchTo } = useLanguageChoice();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // A first visit starts in the farm's default language; a language that was
  // switched off falls back to it.
  useEffect(() => {
    if (!data) return;
    let stored: string | null = null;
    try { stored = localStorage.getItem('farmLang'); } catch { /* private mode */ }
    const wanted = stored && data.enabled.includes(stored as LangCode) ? (stored as LangCode) : data.default;
    if (wanted !== i18n.language) {
      setLanguage(wanted);
      qc.invalidateQueries();
    }
  }, [data, i18n.language, qc]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (enabled.length < 2) return null;

  const choose = (lng: LangCode) => {
    setOpen(false);
    switchTo(lng);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        suppressHydrationWarning
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 h-9 px-2.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors"
        title={LANGUAGES[current].name}
      >
        <Languages size={14} className="shrink-0" />
        <span suppressHydrationWarning>{LANGUAGES[current].short}</span>
        <ChevronDown size={13} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul role="listbox" className="absolute end-0 mt-2 min-w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-lg z-50">
          {enabled.map(code => (
            <li key={code}>
              <button
                type="button"
                role="option"
                aria-selected={code === current}
                onClick={() => choose(code)}
                dir={LANGUAGES[code].rtl ? 'rtl' : 'ltr'}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${code === current ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                <span>{LANGUAGES[code].name}</span>
                {code === current && <Check size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
