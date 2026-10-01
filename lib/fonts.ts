import type { LangCode } from '@/lib/languages';

/**
 * A font a language may use (Settings → Languages; the list comes from the
 * API). It is loaded from Google Fonts or from the panel's own public/fonts;
 * `stack` is the CSS font-family, e.g. "'Times New Roman', 'Tinos'".
 */
export interface FontOption {
  family: string;
  google: { family: string; weights: string } | null;
  css: string | null;
  stack: string;
}
export type FontChoice = Record<LangCode, string>;
export type FontOptions = Record<LangCode, FontOption[]>;

/** CSS variable each language's font goes into (see --app-font in globals.css). */
const FONT_VAR: Record<LangCode, string> = { en: '--font-latin', bn: '--font-bengali', ar: '--font-arabic' };
export const FONTS_STORAGE_KEY = 'farmFonts';

/** The stylesheet that provides the font, if it needs one. */
export function fontHref(opt: FontOption): string | null {
  if (opt.css) return opt.css;
  if (opt.google) return `https://fonts.googleapis.com/css2?family=${opt.google.family.replace(/ /g, '+')}:wght@${opt.google.weights}&display=swap`;
  return null;
}

function addStylesheet(href: string): void {
  const id = 'font-' + href.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(-60);
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

/** Adds the font's stylesheet once. One <link> per font, so a bad one can't block the rest. */
export function loadFont(opt: FontOption): void {
  if (typeof document === 'undefined') return;
  const href = fontHref(opt);
  if (href) addStylesheet(href);
}

/** Loads and switches to the chosen fonts, and remembers them for the next first paint. */
export function applyFonts(fonts: FontChoice, options: FontOptions): void {
  if (typeof document === 'undefined') return;
  const used: { v: string; stack: string; href: string | null }[] = [];
  for (const code of Object.keys(FONT_VAR) as LangCode[]) {
    const opt = options[code]?.find(o => o.family === fonts[code]);
    if (!opt) continue;
    loadFont(opt);
    document.documentElement.style.setProperty(FONT_VAR[code], opt.stack);
    used.push({ v: FONT_VAR[code], stack: opt.stack, href: fontHref(opt) });
  }
  try { localStorage.setItem(FONTS_STORAGE_KEY, JSON.stringify(used)); } catch { /* storage blocked */ }
}

/**
 * Runs in <head> before the first paint: re-applies the fonts remembered by
 * applyFonts(), so a page doesn't flash in the default font first. Only
 * Google Fonts or the panel's own /fonts/ stylesheets are accepted.
 */
export const FONTS_INIT_SCRIPT = `(function(){try{var f=JSON.parse(localStorage.getItem('${FONTS_STORAGE_KEY}')||'[]');var r=document.documentElement;f.forEach(function(o){if(!/^--font-[a-z]+$/.test(o.v)||!/^[\\w ',-]+$/.test(o.stack))return;r.style.setProperty(o.v,o.stack);if(o.href&&/^(https:\\/\\/fonts\\.googleapis\\.com\\/css2\\?|\\/fonts\\/)[\\w\\/.:;=?&@+-]+$/.test(o.href)){var l=document.createElement('link');l.id='font-'+o.href.replace(/[^a-z0-9]+/gi,'-').toLowerCase().slice(-60);l.rel='stylesheet';l.href=o.href;document.head.appendChild(l)}})}catch(e){}})();`;
