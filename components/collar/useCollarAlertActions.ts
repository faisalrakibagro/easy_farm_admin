import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import type { CollarAlert } from './types';

/** Confirm / dismiss a collar alert, then refresh everything that shows alerts or herd state. */
export function useCollarAlertActions() {
  const { t } = useTranslation('cattle');
  const qc = useQueryClient();
  const toast = useToast();
  const [busyId, setBusyId] = useState<number | null>(null);

  const refresh = () => {
    // Heat records live under ['breeding', 'heats', …] — the old ['heats'] key was never read.
    for (const key of [['collar-alerts'], ['collar-overview'], ['collar-cattle'], ['farm-cattle'], ['cattle-active'], ['breeding'], ['cattle-breeding-history']]) {
      qc.invalidateQueries({ queryKey: key });
    }
  };

  const run = async (alert: CollarAlert, url: string, body: object) => {
    setBusyId(alert.id);
    try {
      const res = await api.post(url, body);
      toast.success(res.data?.message ?? t('collar.toast.done'));
      refresh();
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message ?? t('collar.toast.failed'));
    } finally { setBusyId(null); }
  };

  return {
    busyId,
    confirm: (alert: CollarAlert, markSick: boolean) => run(alert, `/farm/collars/alerts/${alert.id}/confirm`, { mark_sick: markSick }),
    dismiss: (alert: CollarAlert) => run(alert, `/farm/collars/alerts/${alert.id}/dismiss`, {}),
  };
}
