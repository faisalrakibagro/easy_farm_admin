/**
 * The look of every form control, in one place.
 *
 * Phones get a taller box and 16px text: fingers need ~44px targets, and iOS
 * zooms the whole page into any input whose text is smaller than 16px.
 */
export const controlBase =
  'w-full rounded-lg border bg-white px-3 py-2.5 sm:py-2 text-base sm:text-sm text-slate-800 placeholder:text-slate-400 ' +
  'focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed';

export function fieldClass(error?: string | boolean | null, extra = ''): string {
  return `${controlBase} ${error ? 'border-red-400 focus:ring-red-300' : 'border-slate-300 focus:ring-blue-500'} ${extra}`.trim();
}

/** The same frame for a box that holds its own input (number with unit, search select). */
export function frameClass(error?: string | boolean | null, extra = ''): string {
  return `flex items-stretch rounded-lg border bg-white focus-within:ring-2 ${
    error ? 'border-red-400 focus-within:ring-red-300' : 'border-slate-300 focus-within:ring-blue-500'
  } ${extra}`.trim();
}

/** Primary / secondary buttons — one colour for "save" everywhere. */
export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium ' +
  'px-5 py-3 sm:py-2.5 disabled:opacity-60 disabled:cursor-not-allowed';
export const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium ' +
  'px-4 py-3 sm:py-2.5 disabled:opacity-60';
