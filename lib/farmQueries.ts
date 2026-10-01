import api from '@/lib/api';
import type { BreedingSummary, FarmDashboard } from '@/types';

/**
 * Queries read by more than one screen. Declared once so every reader shares
 * the same cache entry and refresh rhythm instead of fetching twice.
 */

/** The dashboard figures and alerts — the dashboard page and the header's alert bell. */
export const farmDashboardQuery = {
  queryKey: ['farm-dashboard'],
  queryFn: async (): Promise<FarmDashboard> => (await api.get('/farm/dashboard')).data,
  staleTime: 10 * 60 * 1000,
  refetchInterval: 10 * 60 * 1000,
  refetchIntervalInBackground: false,
};

/** The breeding overview for one animal type ('' = all) — the breeding page and the alert bell. */
export const breedingSummaryQuery = (typeId = '') => ({
  queryKey: ['breeding', 'summary', typeId],
  queryFn: async (): Promise<BreedingSummary> =>
    (await api.get('/farm/breeding/summary', { params: typeId ? { animal_type_id: typeId } : {} })).data,
});
