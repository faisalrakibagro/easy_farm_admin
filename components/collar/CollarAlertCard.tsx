'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Flame, Thermometer, TrendingDown, Activity, X } from 'lucide-react';
import Link from '@/components/ui/AppLink';
import type { CollarAlert, CollarAlertType } from './types';
import { localeFor } from '@/lib/languages';

export const ALERT_STYLE: Record<CollarAlertType, { icon: React.ElementType; tone: string }> = {
  heat:           { icon: Flame,        tone: 'bg-pink-50 text-pink-600 border-pink-200' },
  low_rumination: { icon: TrendingDown, tone: 'bg-amber-50 text-amber-600 border-amber-200' },
  low_activity:   { icon: Activity,     tone: 'bg-sky-50 text-sky-600 border-sky-200' },
  fever:          { icon: Thermometer,  tone: 'bg-rose-50 text-rose-600 border-rose-200' },
};

/** One collar alert with its confirm / dismiss actions (when pending and allowed). */
export default function CollarAlertCard({ alert, canAct, onConfirm, onDismiss, busy }: {
  alert: CollarAlert;
  canAct: boolean;
  busy?: boolean;
  onConfirm: (alert: CollarAlert, markSick: boolean) => void;
  onDismiss: (alert: CollarAlert) => void;
}) {
  const { t } = useTranslation('cattle');
  const [markSick, setMarkSick] = useState(true);
  const { icon: Icon, tone } = ALERT_STYLE[alert.type];
  const isHealth = alert.type !== 'heat';

  return (
    <div className={`rounded-xl border bg-white p-4 ${alert.status === 'pending' ? 'border-slate-200 shadow-sm' : 'border-slate-100 opacity-80'}`}>
      <div className="flex items-start gap-3">
        <span className={`grid place-items-center w-10 h-10 rounded-xl border shrink-0 ${tone}`}><Icon size={18} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-slate-800">{t(`collar.alert.${alert.type}`)}</span>
            {alert.cattle && (
              <Link href={`/farm/cattle/${alert.cattle.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                {alert.cattle.tag_number}{alert.cattle.name ? ` (${alert.cattle.name})` : ''}
              </Link>
            )}
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
              alert.status === 'pending' ? 'bg-amber-100 text-amber-700' : alert.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {t(`collar.status.${alert.status}`)}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">{alert.summary}</p>
          <p className="text-[11px] text-slate-400 mt-1">
            {new Date(alert.detected_at).toLocaleString(localeFor())}
            {alert.baseline !== null && alert.type !== 'fever' && (
              <> · {t('collar.value_vs_baseline', { value: Math.round(alert.value ?? 0), baseline: Math.round(alert.baseline) })}</>
            )}
            {alert.resolved_by && <> · {t('collar.resolved_by', { name: alert.resolved_by })}</>}
          </p>
          {alert.notes && <p className="text-xs text-slate-500 mt-1 italic">{alert.notes}</p>}
        </div>
      </div>

      {alert.status === 'pending' && canAct && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          {isHealth ? (
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" className="accent-rose-500" checked={markSick} onChange={e => setMarkSick(e.target.checked)} />
              {t('collar.mark_sick')}
            </label>
          ) : <span className="text-xs text-slate-500">{t('collar.heat_confirm_hint')}</span>}
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => onDismiss(alert)}
              className="flex items-center gap-1.5 text-xs font-medium border border-slate-300 hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg disabled:opacity-50">
              <X size={13} /> {t('collar.dismiss')}
            </button>
            <button type="button" disabled={busy} onClick={() => onConfirm(alert, isHealth && markSick)}
              className="flex items-center gap-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
              <Check size={13} /> {alert.type === 'heat' ? t('collar.confirm_heat') : t('collar.confirm')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
