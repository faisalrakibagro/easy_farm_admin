'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

/**
 * For a page with an entry sheet: while something typed is unsaved, leaving or
 * reloading the page asks the browser's question, and `guard(change)` asks
 * "discard?" before a change that would throw the typing away (another date,
 * session, shed…). Pass `onStateChange` to the sheet and render `dialog`.
 */
export function useUnsavedGuard() {
  const { t } = useTranslation('common');
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const onStateChange = useCallback((s: { dirty: boolean }) => setDirty(s.dirty), []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const guard = (change: () => void) => (dirty ? setPending(() => change) : change());

  const dialog = (
    <ConfirmDialog open={!!pending}
      title={t('form.discard_title')} message={t('form.discard_message')}
      confirmLabel={t('form.discard')} cancelLabel={t('form.keep_editing')}
      // The new sheet reports its own state once it loads; until then nothing is unsaved.
      onConfirm={() => { pending?.(); setPending(null); setDirty(false); }}
      onCancel={() => setPending(null)} />
  );

  return { onStateChange, guard, dialog };
}
