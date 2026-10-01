'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/ui/Toast';

/** At most one "couldn't load" toast in this window, however many queries fail together. */
const QUIET_MS = 10_000;

/**
 * Tells the user when data could not be loaded because of the connection or
 * the server — otherwise a failed list just looks empty. Permission (403),
 * not-found and validation errors are the page's own business and stay quiet;
 * 401 already sends the user to the login page.
 */
export default function QueryErrorNotifier() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation('common');

  const last = useRef(0);

  useEffect(() => {
    return qc.getQueryCache().subscribe(event => {
      if (event.type !== 'updated' || event.action.type !== 'error') return;
      const status = (event.action.error as { response?: { status?: number } } | null)?.response?.status;
      if (status !== undefined && status < 500) return;
      const now = Date.now();
      if (now - last.current < QUIET_MS) return;
      last.current = now;
      toast.error(t('error.load_failed_network'), 6000);
    });
  }, [qc, toast, t]);

  return null;
}
