'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { MilkSession, Shed } from '@/types';
import { todayStr } from '@/components/breeding/shared';
import MilkSheetTable, { type SheetResponse } from '@/components/dairy/MilkSheetTable';
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard';

export default function DailyMilkPage() {
  const { t } = useTranslation('dairy');
  const { hasPermission } = useAuth();
  const [date, setDate] = useState(todayStr());
  const [session, setSession] = useState<MilkSession>('morning');
  const [shedId, setShedId] = useState('');
  // Typed kg survive refetches; another date/session/shed asks before dropping them.
  const { onStateChange, guard, dialog } = useUnsavedGuard();

  const { data: sheds } = useQuery({
    queryKey: ['sheds-all'],
    queryFn: async () => (await api.get('/farm/sheds/all')).data.sheds as Shed[],
  });

  const { data: sheet, isLoading } = useQuery<SheetResponse>({
    queryKey: ['dairy', 'milk-sheet', date, session, shedId],
    queryFn: async () => (await api.get('/farm/dairy/milk-sheet', { params: { date, session, shed_id: shedId || undefined } })).data,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">{t('field.date')}</label>
          <input type="date" value={date} max={todayStr()} onChange={e => { const v = e.target.value; guard(() => setDate(v)); }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">{t('field.session')}</label>
          <div className="flex rounded-lg border border-slate-300 overflow-hidden">
            {(['morning', 'noon', 'evening'] as MilkSession[]).map(s => (
              <button key={s} type="button" onClick={() => s !== session && guard(() => setSession(s))}
                className={`px-3 py-2 text-sm font-medium ${session === s ? 'bg-blue-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                {t('session.' + s)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">{t('field.shed')}</label>
          <select value={shedId} onChange={e => { const v = e.target.value; guard(() => setShedId(v)); }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">{t('field.all_sheds')}</option>
            {(sheds ?? []).map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {isLoading || !sheet
        ? <div className="h-48 bg-white rounded-xl border border-slate-200 animate-pulse" />
        : <MilkSheetTable key={`${date}-${session}-${shedId}`} sheet={sheet} canEdit={hasPermission('farm.dairy.create')} onStateChange={onStateChange} />}
      {dialog}
    </div>
  );
}
