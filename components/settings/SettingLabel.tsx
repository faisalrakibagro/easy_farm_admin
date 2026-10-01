'use client';

import { useTranslation } from 'react-i18next';

/** Settings managed on their own page — never edited as raw text in the generic forms. */
export const OWN_PAGE_SETTINGS = new Set(['enabled_languages', 'default_language', 'language_fonts']);

/**
 * A setting's name and help text in the current language. The database only
 * holds English descriptions, so they are looked up by key and fall back to it.
 */
export default function SettingLabel({ settingKey, description, htmlFor }: { settingKey: string; description?: string | null; htmlFor?: string }) {
  const { t } = useTranslation('settings');
  const hint = t(`website.field_hints.${settingKey}`, { defaultValue: description ?? '' });
  return (
    <>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700 mb-1">
        {t(`website.field_labels.${settingKey}`, { defaultValue: settingKey.replace(/_/g, ' ') })}
      </label>
      {hint && <p className="text-xs text-slate-400 mb-2">{hint}</p>}
    </>
  );
}
