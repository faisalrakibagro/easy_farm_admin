'use client';

import { useCallback, useEffect, useState } from 'react';

type ApiErr = { response?: { data?: { message?: string; errors?: Record<string, string[] | string> } } };

/**
 * Field errors for a form, from its own checks or the API's 422 — shown under
 * each <Field>, with the form scrolled to the first one. What cannot be put
 * under a field goes to `formError` (shown at the top).
 */
export function useFormErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [scrollTick, setScrollTick] = useState(0);

  // After the errors render, bring the first one into view and focus it.
  useEffect(() => {
    if (!scrollTick) return;
    const el = document.querySelector<HTMLElement>('[data-field-error="true"]');
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.querySelector<HTMLElement>('input, select, textarea, button')?.focus({ preventScroll: true });
  }, [scrollTick]);

  /** Clear one field's error as the person corrects it. */
  const clear = useCallback((name: string) => {
    setErrors(e => {
      if (!(name in e)) return e;
      const next = { ...e };
      delete next[name];
      return next;
    });
  }, []);

  /**
   * Client-side checks: pass `{ field: message | false }`. Returns true when
   * nothing is wrong; otherwise shows the messages and scrolls to the first.
   */
  const check = useCallback((rules: Record<string, string | false | null | undefined>) => {
    const found = Object.fromEntries(Object.entries(rules).filter(([, v]) => !!v)) as Record<string, string>;
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) {
      setScrollTick(n => n + 1);
      return false;
    }
    return true;
  }, []);

  /**
   * Show an API failure: field errors under their fields, anything else at the
   * top. `known` lists the fields this form shows; others go to the top.
   * Returns a one-line message (for a toast).
   */
  const fromApi = useCallback((err: unknown, fallback: string, known?: string[]) => {
    const data = (err as ApiErr)?.response?.data;
    const fieldErrors: Record<string, string> = {};
    const other: string[] = [];
    for (const [key, val] of Object.entries(data?.errors ?? {})) {
      const msg = Array.isArray(val) ? val[0] : val;
      if (!msg) continue;
      if (!known || known.includes(key)) fieldErrors[key] = msg;
      else other.push(msg);
    }
    setErrors(fieldErrors);
    const top = other.length ? other.join('\n') : Object.keys(fieldErrors).length ? '' : data?.message ?? fallback;
    setFormError(top);
    setScrollTick(n => n + 1);
    return Object.values(fieldErrors)[0] ?? top ?? fallback;
  }, []);

  const reset = useCallback(() => { setErrors({}); setFormError(''); }, []);

  return { errors, formError, setFormError, clear, check, fromApi, reset };
}

/**
 * Split an API failure into field errors (first message per field) and a
 * message for the top of the form — for forms that keep their own error state.
 */
export function apiFieldErrors(err: unknown, fallback: string): { fields: Record<string, string>; message: string } {
  const data = (err as ApiErr)?.response?.data;
  const fields: Record<string, string> = {};
  for (const [key, val] of Object.entries(data?.errors ?? {})) {
    const msg = Array.isArray(val) ? val[0] : val;
    if (msg) fields[key] = msg;
  }
  return { fields, message: data?.message ?? fallback };
}

/**
 * Scroll to the first field in error whenever a new set of errors appears —
 * for forms whose errors live in their parent's state.
 */
export function useScrollToError(errors: Record<string, string | undefined>, formError?: string) {
  const key = Object.entries(errors).filter(([, v]) => v).map(([k]) => k).join(',') + '|' + (formError ?? '');
  useEffect(() => {
    if (key === '|') return;
    const el = document.querySelector<HTMLElement>('[data-field-error="true"]') ?? document.querySelector<HTMLElement>('[data-form-error="true"]');
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.querySelector<HTMLElement>('input, select, textarea, button')?.focus({ preventScroll: true });
  }, [key]);
}

/**
 * Errors this form has no field for (e.g. from the API), so they can be shown
 * at the top instead of being lost. `shown` lists the field names the form
 * displays; a trailing `*` matches a prefix ("items.*").
 */
export function otherErrors(errors: Record<string, string | string[] | undefined>, shown: string[]): string[] {
  const covered = (k: string) => shown.some(s => (s.endsWith('*') ? k.startsWith(s.slice(0, -1)) : s === k));
  return Object.entries(errors)
    .filter(([k, v]) => v && v.length && !covered(k))
    .map(([, v]) => (Array.isArray(v) ? v[0] : v) as string);
}

/** The first error among keys starting with `prefix` (item rows: "items."). */
export function firstErrorWithPrefix(errors: Record<string, string | string[] | undefined>, prefix: string): string | undefined {
  const hit = Object.entries(errors).find(([k, v]) => k.startsWith(prefix) && v && v.length);
  return hit ? (Array.isArray(hit[1]) ? hit[1][0] : hit[1]) : undefined;
}
