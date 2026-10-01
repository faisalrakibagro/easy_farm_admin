'use client';

import { useEffect, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';
import { applyDocumentLanguage } from '@/lib/languages';

export default function I18nProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Sync html[lang] and html[dir] whenever the language changes. Also runs
    // after hydration, which rebuilds <html> from its props and drops dir.
    const sync = (lng: string) => applyDocumentLanguage(lng);
    sync(i18n.language);
    i18n.on('languageChanged', sync);
    return () => { i18n.off('languageChanged', sync); };
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
