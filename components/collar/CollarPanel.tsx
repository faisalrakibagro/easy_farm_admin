'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Battery, MapPin, Radio, Thermometer } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { AreaChart, CHART, Sparkline } from '@/components/dashboard/charts';
import CollarAlertCard from './CollarAlertCard';
import { useCollarAlertActions } from './useCollarAlertActions';
import type { CollarCattleData } from './types';
import { localeFor } from '@/lib/languages';
import { localDateStr } from '@/lib/dates';

/** The collar tab on an animal's page: device state, 30-day trends and recent alerts. */
export default function CollarPanel({ cattleId }: { cattleId: number }) {
  const { t, i18n } = useTranslation('cattle');
  const { hasPermission } = useAuth();
  const actions = useCollarAlertActions();

  const { data, isLoading } = useQuery<CollarCattleData>({
    queryKey: ['collar-cattle', cattleId],
    queryFn: async () => (await api.get(`/farm/collars/cattle/${cattleId}`)).data,
  });

  if (isLoading || !data) return <div className="h-64 rounded-xl bg-slate-50 animate-pulse" />;

  const { device, daily, last_reading: last } = data;
  const label = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString(localeFor(i18n.language), { day: 'numeric', month: 'short' });
  const temps = daily.map(d => d.temp_max).filter((v): v is number => v !== null);
  // Today is still running: its totals cover only part of a day and would read
  // as a sudden drop, so the total-based charts stop at yesterday.
  const whole = daily.filter(d => d.date !== localDateStr());

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="flex items-center gap-1.5 text-xs text-slate-500"><Radio size={13} /> {t('collar.panel.device')}</p>
          {device ? (
            <>
              <p className="mt-1 text-sm font-semibold text-slate-800">{device.serial}</p>
              <p className="text-xs mt-0.5">
                <span className={`inline-block w-2 h-2 rounded-full me-1 ${device.offline ? 'bg-slate-400' : 'bg-emerald-500'}`} />
                {device.offline ? t('collar.offline') : t('collar.online')}
                {device.last_seen_at && <span className="text-slate-400"> · {new Date(device.last_seen_at).toLocaleString(localeFor())}</span>}
              </p>
            </>
          ) : <p className="mt-1 text-sm text-slate-400">{t('collar.panel.no_device')}</p>}
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="flex items-center gap-1.5 text-xs text-slate-500"><Battery size={13} /> {t('collar.battery')}</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">{device?.battery_level != null ? `${device.battery_level}%` : '—'}</p>
          {device?.battery_level != null && (
            <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-full rounded-full ${device.battery_level < 20 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${device.battery_level}%` }} />
            </div>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="flex items-center gap-1.5 text-xs text-slate-500"><Thermometer size={13} /> {t('collar.panel.last_temp')}</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">{last?.temperature != null ? `${last.temperature}°C` : '—'}</p>
          {last?.latitude != null && last.longitude != null && (
            <a className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline" target="_blank" rel="noreferrer"
              href={`https://www.google.com/maps?q=${last.latitude},${last.longitude}`}>
              <MapPin size={12} /> {t('collar.panel.location')}
            </a>
          )}
        </div>
      </div>

      {daily.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-10">{t('collar.panel.no_data')}</p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-700 mb-2">{t('collar.panel.activity')}</p>
            <AreaChart data={whole.map(d => ({ label: label(d.date), value: d.activity ?? 0 }))} lang={i18n.language} unit={t('collar.panel.activity')} color={CHART.c4} height={180} />
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-700 mb-2">{t('collar.panel.rumination')}</p>
            <AreaChart data={whole.map(d => ({ label: label(d.date), value: d.rumination ?? 0 }))} lang={i18n.language} unit={t('collar.panel.minutes')} color={CHART.c1} height={180} />
          </div>
          {temps.length > 1 && (
            <div className="rounded-xl border border-slate-200 p-4 lg:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-slate-700">{t('collar.panel.temp_max')}</p>
                <p className="text-xs text-slate-500">{Math.min(...temps)}° – {Math.max(...temps)}°C</p>
              </div>
              <Sparkline values={temps} color={CHART.c5} height={48} />
            </div>
          )}
        </div>
      )}

      {data.alerts.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-sm font-semibold text-slate-700">{t('collar.panel.recent_alerts')}</p>
          {data.alerts.map(a => (
            <CollarAlertCard key={a.id} alert={a} canAct={hasPermission('farm.cattle.edit')} busy={actions.busyId === a.id}
              onConfirm={actions.confirm} onDismiss={actions.dismiss} />
          ))}
        </div>
      )}
    </div>
  );
}
