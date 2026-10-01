'use client';

import { useEffect } from 'react';
import { useLanguageConfig } from '@/components/LanguageSwitcher';
import { applyFonts } from '@/lib/fonts';

/** Applies the fonts chosen in Settings → Languages, for everyone (login page included). */
export default function FontSync() {
  const { data } = useLanguageConfig();
  useEffect(() => {
    if (data?.fonts && data.fontOptions) applyFonts(data.fonts, data.fontOptions);
  }, [data]);
  return null;
}
