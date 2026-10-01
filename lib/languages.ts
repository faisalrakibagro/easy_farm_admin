import i18n from '@/lib/i18n';

/**
 * Interface languages. All three are fully translated; Settings → Languages
 * decides which of them the language menu offers (the API's /languages).
 */
export type LangCode = 'en' | 'bn' | 'ar';

export const LANGUAGES: Record<LangCode, { name: string; short: string; rtl: boolean; locale: string }> = {
  en: { name: 'English', short: 'EN', rtl: false, locale: 'en-GB' },
  bn: { name: 'বাংলা', short: 'বাং', rtl: false, locale: 'bn-BD' },
  ar: { name: 'العربية', short: 'ع', rtl: true, locale: 'ar-EG' },
};

export const LANG_CODES = Object.keys(LANGUAGES) as LangCode[];

export const isLangCode = (v: unknown): v is LangCode => typeof v === 'string' && v in LANGUAGES;

/** Locale for dates and numbers in the given (or current) UI language. */
export function localeFor(lng?: string): string {
  const code = lng ?? i18n.language;
  return isLangCode(code) ? LANGUAGES[code].locale : LANGUAGES.en.locale;
}

/** <html lang dir> follow the UI language (Arabic reads right to left). */
export function applyDocumentLanguage(lng: string): void {
  if (typeof document === 'undefined') return;
  const code = isLangCode(lng) ? lng : 'en';
  document.documentElement.lang = code;
  document.documentElement.dir = LANGUAGES[code].rtl ? 'rtl' : 'ltr';
}

/** Switch the whole UI (and the API's messages) to another language. */
export function setLanguage(lng: LangCode): void {
  try { localStorage.setItem('farmLang', lng); } catch { /* private mode */ }
  i18n.changeLanguage(lng);
}
