import i18n, { type FormatterModule } from 'i18next';
import { initReactI18next } from 'react-i18next';

/** Digits for numbers inside sentences (kept here: lib/languages imports this file). */
const NUMBER_LOCALES: Record<string, string> = { en: 'en-US', bn: 'bn-BD', ar: 'ar-EG' };

/**
 * A number put into a sentence ({{count}}, {{n}} …) reads in that language's
 * digits — ১২ in Bengali, ١٢ in Arabic. Four-digit numbers such as years stay
 * ungrouped; money and dates arrive already formatted as text.
 */
const sentenceNumbers: FormatterModule = {
  type: 'formatter',
  init: () => {},
  add: () => {},
  addCached: () => {},
  format: (value, _format, lng) =>
    typeof value === 'number' && Number.isFinite(value)
      ? new Intl.NumberFormat(NUMBER_LOCALES[lng ?? ''] ?? 'en-US', { maximumFractionDigits: 3, useGrouping: Math.abs(value) >= 10000 }).format(value)
      : value,
};

import enCommon from '@/locales/en/common.json';
import enAuth from '@/locales/en/auth.json';
import enLayout from '@/locales/en/layout.json';
import enDashboard from '@/locales/en/dashboard.json';
import enCattle from '@/locales/en/cattle.json';
import enFeed from '@/locales/en/feed.json';
import enMedicine from '@/locales/en/medicine.json';
import enHealth from '@/locales/en/health.json';
import enLabour from '@/locales/en/labour.json';
import enFinance from '@/locales/en/finance.json';
import enUsers from '@/locales/en/users.json';
import enMedia from '@/locales/en/media.json';
import enSettings from '@/locales/en/settings.json';
import enUnits from '@/locales/en/units.json';
import enAssets from '@/locales/en/assets.json';
import enBreeding from '@/locales/en/breeding.json';
import enDairy from '@/locales/en/dairy.json';
import enByproducts from '@/locales/en/byproducts.json';
import enReports from '@/locales/en/reports.json';
import enAi from '@/locales/en/ai.json';
import enActivity from '@/locales/en/activity.json';

import bnCommon from '@/locales/bn/common.json';
import bnAuth from '@/locales/bn/auth.json';
import bnLayout from '@/locales/bn/layout.json';
import bnDashboard from '@/locales/bn/dashboard.json';
import bnCattle from '@/locales/bn/cattle.json';
import bnFeed from '@/locales/bn/feed.json';
import bnMedicine from '@/locales/bn/medicine.json';
import bnHealth from '@/locales/bn/health.json';
import bnLabour from '@/locales/bn/labour.json';
import bnFinance from '@/locales/bn/finance.json';
import bnUsers from '@/locales/bn/users.json';
import bnMedia from '@/locales/bn/media.json';
import bnSettings from '@/locales/bn/settings.json';
import bnUnits from '@/locales/bn/units.json';
import bnAssets from '@/locales/bn/assets.json';
import bnBreeding from '@/locales/bn/breeding.json';
import bnDairy from '@/locales/bn/dairy.json';
import bnByproducts from '@/locales/bn/byproducts.json';
import bnReports from '@/locales/bn/reports.json';
import bnAi from '@/locales/bn/ai.json';
import bnActivity from '@/locales/bn/activity.json';
import arCommon from '@/locales/ar/common.json';
import arAuth from '@/locales/ar/auth.json';
import arLayout from '@/locales/ar/layout.json';
import arDashboard from '@/locales/ar/dashboard.json';
import arCattle from '@/locales/ar/cattle.json';
import arFeed from '@/locales/ar/feed.json';
import arMedicine from '@/locales/ar/medicine.json';
import arHealth from '@/locales/ar/health.json';
import arLabour from '@/locales/ar/labour.json';
import arFinance from '@/locales/ar/finance.json';
import arUsers from '@/locales/ar/users.json';
import arMedia from '@/locales/ar/media.json';
import arSettings from '@/locales/ar/settings.json';
import arUnits from '@/locales/ar/units.json';
import arAssets from '@/locales/ar/assets.json';
import arBreeding from '@/locales/ar/breeding.json';
import arDairy from '@/locales/ar/dairy.json';
import arByproducts from '@/locales/ar/byproducts.json';
import arReports from '@/locales/ar/reports.json';
import arAi from '@/locales/ar/ai.json';
import arActivity from '@/locales/ar/activity.json';

// Pre-detect language synchronously to avoid async flash of raw keys
const storedLang =
  (typeof window !== 'undefined' ? localStorage.getItem('farmLang') : null) ?? 'en';
const initialLang = storedLang === 'bn' || storedLang === 'ar' ? storedLang : 'en';

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .use(sentenceNumbers)
    .init({
      resources: {
        en: {
          common: enCommon,
          auth: enAuth,
          layout: enLayout,
          dashboard: enDashboard,
          cattle: enCattle,
          feed: enFeed,
          medicine: enMedicine,
          health: enHealth,
          labour: enLabour,
          finance: enFinance,
          users: enUsers,
          media: enMedia,
          settings: enSettings,
          units: enUnits,
          assets: enAssets,
          breeding: enBreeding,
          dairy: enDairy,
          byproducts: enByproducts,
          reports: enReports,
          ai: enAi,
          activity: enActivity,
        },
        bn: {
          common: bnCommon,
          auth: bnAuth,
          layout: bnLayout,
          dashboard: bnDashboard,
          cattle: bnCattle,
          feed: bnFeed,
          medicine: bnMedicine,
          health: bnHealth,
          labour: bnLabour,
          finance: bnFinance,
          users: bnUsers,
          media: bnMedia,
          settings: bnSettings,
          units: bnUnits,
          assets: bnAssets,
          breeding: bnBreeding,
          dairy: bnDairy,
          byproducts: bnByproducts,
          reports: bnReports,
          ai: bnAi,
          activity: bnActivity,
        },
        ar: {
          common: arCommon,
          auth: arAuth,
          layout: arLayout,
          dashboard: arDashboard,
          cattle: arCattle,
          feed: arFeed,
          medicine: arMedicine,
          health: arHealth,
          labour: arLabour,
          finance: arFinance,
          users: arUsers,
          media: arMedia,
          settings: arSettings,
          units: arUnits,
          assets: arAssets,
          breeding: arBreeding,
          dairy: arDairy,
          byproducts: arByproducts,
          reports: arReports,
          ai: arAi,
          activity: arActivity,
        },
      },
      lng: initialLang,
      defaultNS: 'common',
      fallbackLng: 'en',
      supportedLngs: ['en', 'bn', 'ar'],
      interpolation: {
        escapeValue: false,
        // Every value goes through sentenceNumbers below.
        alwaysFormat: true,
      },
      // Never show a raw key such as "ui.max_value": a key missing from every
      // language reads as its last part in plain words ("Max value").
      parseMissingKeyHandler: (key: string, defaultValue?: string) => {
        if (defaultValue !== undefined) return defaultValue;
        const last = key.split(/[.:]/).pop() ?? key;
        const words = last.replace(/[_-]+/g, ' ').trim();
        return words.charAt(0).toUpperCase() + words.slice(1);
      },
    });
}

// Keep <html lang> in step with the UI language — screen readers use it, and
// the Bengali number styling in globals.css keys off it.
if (typeof document !== 'undefined') {
  const syncLang = (lng: string) => {
    const code = lng === 'bn' || lng === 'ar' ? lng : 'en';
    document.documentElement.lang = code;
    document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr'; // Arabic reads right to left
  };
  syncLang(i18n.language ?? initialLang);
  i18n.on('languageChanged', syncLang);
}

export default i18n;
