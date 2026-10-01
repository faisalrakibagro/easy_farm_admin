'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Radio, Bell, Cpu, Settings2, Plus, Pencil, Trash2, KeyRound, Copy, Upload, Save, Check, AlertTriangle, Battery, Wifi, WifiOff,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import CollarAlertCard from '@/components/collar/CollarAlertCard';
import { useCollarAlertActions } from '@/components/collar/useCollarAlertActions';
import { VENDORS, type CollarAlert, type CollarDevice, type CollarOverview, type CollarSettings } from '@/components/collar/types';
import { localeFor } from '@/lib/languages';
import NumericInput from '@/components/ui/NumericInput';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import SearchSelect from '@/components/ui/SearchSelect';
import CattleSelect from '@/components/ui/CattleSelect';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { useFormErrors } from '@/lib/hooks/useFormErrors';

type Tab = 'alerts' | 'devices' | 'settings';
const DEVICE_FORM_ID = 'collar-device';
const DEVICE_FIELDS = ['serial', 'label', 'vendor', 'cattle_id', 'notes'];

const input = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';
const label = 'block text-xs font-medium text-slate-600 mb-1';

type ApiError = { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
const errText = (e: unknown, fallback: string) => {
  const d = (e as ApiError).response?.data;
  return d?.errors ? Object.values(d.errors)[0]?.[0] ?? fallback : d?.message ?? fallback;
};

function Toggle({ on, onChange, disabled, labelledBy }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; labelledBy?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-labelledby={labelledBy} disabled={disabled} onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'start-[22px]' : 'start-0.5'}`} />
    </button>
  );
}

/** A secret shown once (device token / gateway key), with copy. */
function SecretModal({ title, secret, onClose }: { title: string; secret: string; onClose: () => void }) {
  const { t } = useTranslation('cattle');
  const toast = useToast();
  // No `dirty`: Esc stays off, so the one-time secret is not lost by a stray key.
  return (
    <Modal onClose={onClose} size="lg" title={title} icon={<KeyRound size={17} className="text-amber-500 shrink-0" />}
      footer={<button type="button" onClick={onClose} className={btnPrimary}>{t('collar.saved_it')}</button>}>
      <div className="px-4 sm:px-6 py-5 space-y-3">
        <p className="text-xs rounded-lg px-3 py-2 bg-amber-50 text-amber-700 flex gap-2"><AlertTriangle size={14} className="shrink-0 mt-0.5" />{t('collar.secret_once')}</p>
        <div className="flex gap-2">
          <code dir="ltr" className="flex-1 min-w-0 break-all rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800">{secret}</code>
          <button type="button" onClick={() => { navigator.clipboard?.writeText(secret); toast.success(t('collar.toast.copied')); }}
            className="px-3 min-w-11 border border-slate-300 rounded-lg text-slate-500 hover:bg-slate-50" aria-label={t('common:ui.copy')}><Copy size={14} className="mx-auto" /></button>
        </div>
      </div>
    </Modal>
  );
}

export default function CollarsPage() {
  const { t } = useTranslation(['cattle', 'common']);
  const qc = useQueryClient();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('farm.cattle.edit');
  const [tab, setTab] = useState<Tab>('alerts');
  const [secret, setSecret] = useState<{ title: string; value: string } | null>(null);

  const { data: overview } = useQuery<CollarOverview>({
    queryKey: ['collar-overview'],
    queryFn: async () => (await api.get('/farm/collars')).data,
  });

  // ── Alerts ───────────────────────────────────────────────────
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'dismissed' | ''>('pending');
  const [page, setPage] = useState(1);
  const actions = useCollarAlertActions();
  const { data: alerts, isLoading: alertsLoading } = useQuery<{ data: CollarAlert[]; last_page: number; total: number }>({
    queryKey: ['collar-alerts', status, page],
    queryFn: async () => (await api.get('/farm/collars/alerts', { params: { status: status || undefined, page } })).data,
    enabled: tab === 'alerts',
  });

  // ── Devices ──────────────────────────────────────────────────
  const { data: devicesData, isLoading: devicesLoading } = useQuery<{ devices: CollarDevice[] }>({
    queryKey: ['collar-devices'],
    queryFn: async () => (await api.get('/farm/collars/devices')).data,
    enabled: tab === 'devices',
  });
  const { data: cattleData } = useQuery<{ cattle: { id: number; tag_number: string; name: string | null }[] }>({
    queryKey: ['cattle-active'],
    queryFn: async () => (await api.get('/farm/cattle/all')).data,
    enabled: tab === 'devices',
  });
  const [editing, setEditing] = useState<Partial<CollarDevice> & { cattle_id?: string } | null>(null);
  const [deleting, setDeleting] = useState<CollarDevice | null>(null);
  const [editingOpened, setEditingOpened] = useState('');
  const [deviceSaving, setDeviceSaving] = useState(false);
  // A new device token / gateway key stops the old one: asked first.
  const [renewing, setRenewing] = useState<{ device: CollarDevice } | { gateway: true } | null>(null);
  const [renewBusy, setRenewBusy] = useState(false);
  const devErr = useFormErrors();
  const openDevice = (d: Partial<CollarDevice> & { cattle_id?: string }) => {
    setEditing(d);
    setEditingOpened(JSON.stringify(d));
    devErr.reset();
  };

  const refreshDevices = () => { qc.invalidateQueries({ queryKey: ['collar-devices'] }); qc.invalidateQueries({ queryKey: ['collar-overview'] }); };

  const saveDevice = async () => {
    if (!editing) return;
    if (!devErr.check({ serial: !(editing.serial ?? '').trim() && t('common:form.v.required') })) return;
    setDeviceSaving(true);
    const body = {
      serial: editing.serial ?? '', label: editing.label || null, vendor: editing.vendor || 'generic',
      cattle_id: editing.cattle_id ? Number(editing.cattle_id) : null, is_active: editing.is_active ?? true, notes: editing.notes || null,
    };
    try {
      if (editing.id) {
        await api.put(`/farm/collars/devices/${editing.id}`, body);
      } else {
        const res = await api.post('/farm/collars/devices', body);
        setSecret({ title: t('collar.device_token_title', { serial: body.serial }), value: res.data.token });
      }
      toast.success(t('collar.toast.device_saved'));
      setEditing(null);
      refreshDevices();
    } catch (e) {
      toast.error(devErr.fromApi(e, t('collar.toast.failed'), DEVICE_FIELDS));
    } finally {
      setDeviceSaving(false);
    }
  };

  const newToken = async (d: CollarDevice) => {
    try {
      const res = await api.post(`/farm/collars/devices/${d.id}/token`);
      setSecret({ title: t('collar.device_token_title', { serial: d.serial }), value: res.data.token });
      refreshDevices();
    } catch (e) { toast.error(errText(e, t('collar.toast.failed'))); }
  };

  const removeDevice = async () => {
    if (!deleting) return;
    try {
      await api.delete(`/farm/collars/devices/${deleting.id}`);
      setDeleting(null);
      refreshDevices();
    } catch (e) { toast.error(errText(e, t('collar.toast.failed'))); }
  };

  // ── Settings ─────────────────────────────────────────────────
  const [form, setForm] = useState<CollarSettings | null>(null);
  const [loaded, setLoaded] = useState<CollarSettings>();
  if (overview && overview.settings !== loaded) {
    setLoaded(overview.settings);
    // A refetch (after a device change, a reconnect…) must not wipe settings being edited.
    if (form === null || form === loaded) setForm(overview.settings);
  }
  const setF = <K extends keyof CollarSettings>(k: K, v: CollarSettings[K]) => setForm(f => (f ? { ...f, [k]: v } : f));
  const [saving, setSaving] = useState(false);
  const saveSettings = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await api.put('/farm/collars/settings', form);
      // Saved: the form counts as untouched again, so the refetch below may refresh it.
      setLoaded(form);
      toast.success(t('collar.toast.settings_saved'));
      qc.invalidateQueries({ queryKey: ['collar-overview'] });
    } catch (e) { toast.error(errText(e, t('collar.toast.failed'))); }
    finally { setSaving(false); }
  };
  const gatewayKey = async () => {
    try {
      const res = await api.post('/farm/collars/settings/gateway-key');
      setSecret({ title: t('collar.gateway_key_title'), value: res.data.key });
      qc.invalidateQueries({ queryKey: ['collar-overview'] });
    } catch (e) { toast.error(errText(e, t('collar.toast.failed'))); }
  };

  const renew = async () => {
    if (!renewing) return;
    setRenewBusy(true);
    await ('device' in renewing ? newToken(renewing.device) : gatewayKey());
    setRenewBusy(false);
    setRenewing(null);
  };

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ accepted: number; duplicates: number; rejected: number; alerts: number; errors: string[] } | null>(null);
  const importFile = async (file: File) => {
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/farm/collars/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setImportResult(res.data);
      qc.invalidateQueries({ queryKey: ['collar-alerts'] });
      qc.invalidateQueries({ queryKey: ['collar-overview'] });
    } catch (e) { toast.error(errText(e, t('collar.toast.failed'))); }
    finally { setImporting(false); }
  };

  const c = overview?.counts;
  const enabled = overview?.settings.enabled;
  const devices = devicesData?.devices ?? [];
  const usedCattle = new Set(devices.filter(d => d.cattle && d.id !== editing?.id).map(d => d.cattle!.id));

  const deviceName = (d: CollarDevice) => (
    <>
      <p className="font-medium text-slate-800">{d.serial}</p>
      <p className="text-xs text-slate-400">{[d.label, t(`collar.vendor.${d.vendor}`, { defaultValue: d.vendor })].filter(Boolean).join(' · ')}</p>
    </>
  );
  const deviceAnimal = (d: CollarDevice) => (d.cattle
    ? <span className="font-medium text-slate-700">{d.cattle.tag_number}{d.cattle.name ? ` (${d.cattle.name})` : ''}</span>
    : <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{t('collar.unassigned')}</span>);
  const deviceStatus = (d: CollarDevice) => (
    <>
      {!d.is_active ? <span className="text-slate-400">{t('collar.inactive')}</span> : (
        <span className={d.offline ? 'text-slate-500' : 'text-emerald-700'}>
          <span className={`inline-block w-2 h-2 rounded-full me-1 ${d.offline ? 'bg-slate-400' : 'bg-emerald-500'}`} />
          {d.offline ? t('collar.offline') : t('collar.online')}
        </span>
      )}
      {d.last_seen_at && <p className="text-[11px] text-slate-400">{new Date(d.last_seen_at).toLocaleString(localeFor())}</p>}
    </>
  );
  const deviceBattery = (d: CollarDevice) => (d.battery_level != null ? (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${d.battery_level < 20 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${d.battery_level}%` }} />
      </div>
      {d.battery_level}%
    </div>
  ) : '—');
  const deviceToken = (d: CollarDevice) => (d.has_token ? `••••${d.token_hint}` : '—');
  const deviceActions = (d: CollarDevice) => canEdit && (
    <div className="flex justify-end gap-1">
      <button onClick={() => setRenewing({ device: d })} title={t('collar.new_token')}
        className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 min-h-10 sm:min-h-0 rounded-lg"><KeyRound size={13} /> {t('collar.new_token')}</button>
      <button onClick={() => openDevice({ ...d, cattle_id: d.cattle ? String(d.cattle.id) : '' })} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400"
        aria-label={t('collar.edit_device')} title={t('collar.edit_device')}><Pencil size={14} /></button>
      <button onClick={() => setDeleting(d)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400" aria-label={t('collar.delete')} title={t('collar.delete')}><Trash2 size={14} /></button>
    </div>
  );

  const example = `curl -X POST ${overview?.ingest_url ?? ''} \\
  -H "Authorization: Bearer <device token>" \\
  -H "Content-Type: application/json" \\
  -d '{"readings":[{"recorded_at":"2026-09-24T10:15:00+06:00","activity":52,"rumination_min":7.5,"eating_min":4,"temperature":38.6,"battery":87}]}'`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl p-5 text-white bg-gradient-to-br from-[#6366f1] to-[#0f766e] shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-12 h-12 rounded-2xl bg-white/15"><Radio size={24} /></span>
          <div>
            <h1 className="text-lg font-bold">{t('collar.title')}</h1>
            <p className="text-sm text-white/80">{t('collar.subtitle')}</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${enabled ? 'bg-white text-emerald-700' : 'bg-white/15'}`}>
          {enabled ? t('collar.on') : t('collar.off')}
        </span>
      </div>

      {!enabled && overview && (
        <p className="text-sm rounded-xl px-4 py-3 bg-amber-50 text-amber-800 border border-amber-200 flex gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {t('collar.off_note')}
        </p>
      )}

      {/* KPIs */}
      {c && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            [t('collar.kpi.pending'), c.pending_alerts, Bell, 'text-amber-600 bg-amber-50'],
            [t('collar.kpi.devices'), `${c.assigned}/${c.devices}`, Cpu, 'text-indigo-600 bg-indigo-50'],
            [t('collar.kpi.online'), c.online, Wifi, 'text-emerald-600 bg-emerald-50'],
            [t('collar.kpi.offline'), c.offline, WifiOff, 'text-slate-600 bg-slate-100'],
            [t('collar.kpi.low_battery'), c.low_battery, Battery, 'text-rose-600 bg-rose-50'],
          ].map(([k, v, Icon, tone], i, all) => {
            const I = Icon as React.ElementType;
            return (
              <div key={k as string} className={`bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3 ${i === all.length - 1 ? 'col-span-2 lg:col-span-1' : ''}`}>
                <span className={`grid place-items-center w-10 h-10 rounded-xl ${tone as string}`}><I size={18} /></span>
                <div>
                  <p className="text-xs text-slate-500">{k as string}</p>
                  <p className="text-lg font-bold text-slate-800">{v as string | number}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {([['alerts', Bell], ['devices', Cpu], ['settings', Settings2]] as [Tab, React.ElementType][]).map(([k, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap shrink-0 ${tab === k ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <Icon size={15} /> {t(`collar.tab.${k}`)}
            {k === 'alerts' && !!c?.pending_alerts && <span className="ms-1 text-[11px] px-1.5 rounded-full bg-amber-100 text-amber-700">{c.pending_alerts}</span>}
          </button>
        ))}
      </div>

      {/* ── Alerts ── */}
      {tab === 'alerts' && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {(['pending', 'confirmed', 'dismissed', ''] as const).map(s => (
              <button key={s || 'all'} onClick={() => { setStatus(s); setPage(1); }}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border ${status === s ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                {s ? t(`collar.status.${s}`) : t('collar.all')}
              </button>
            ))}
          </div>
          {alertsLoading ? (
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />)
          ) : (alerts?.data ?? []).length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 py-12 text-center text-sm text-slate-400">{t('collar.no_alerts')}</div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-3">
              {alerts!.data.map(a => (
                <CollarAlertCard key={a.id} alert={a} canAct={canEdit} busy={actions.busyId === a.id} onConfirm={actions.confirm} onDismiss={actions.dismiss} />
              ))}
            </div>
          )}
          {(alerts?.total ?? 0) > 0 && (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-500">{t('common:pagination.page_of', { current: page, total: alerts?.last_page ?? 1 })} &bull; {t('common:pagination.total_count', { count: alerts?.total ?? 0 })}</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40">{t('common:btn.prev')}</button>
                <button disabled={page >= (alerts?.last_page ?? 1)} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40">{t('common:btn.next')}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Devices ── */}
      {tab === 'devices' && (
        <div className="space-y-3">
          {canEdit && (
            <div className="flex justify-end">
              <button onClick={() => openDevice({ is_active: true, vendor: 'generic' })}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
                <Plus size={16} /> {t('collar.add_device')}
              </button>
            </div>
          )}
          {/* Phones: one card per device */}
          <div className="sm:hidden bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {devicesLoading ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 m-3 bg-slate-50 rounded animate-pulse" />)
              : devices.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-400">{t('collar.no_devices')}</p>
              : devices.map(d => (
                <div key={d.id} className="p-4 space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 break-words">{deviceName(d)}</div>
                    <div className="shrink-0 text-xs text-end">{deviceStatus(d)}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
                    {deviceAnimal(d)}
                    <span className="flex items-center gap-1.5">{t('collar.battery')}: {deviceBattery(d)}</span>
                    <span>{t('collar.col.token')}: {deviceToken(d)}</span>
                  </div>
                  {deviceActions(d)}
                </div>
              ))}
          </div>

          <div className="hidden sm:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-start px-4 py-3">{t('collar.col.device')}</th>
                    <th className="text-start px-4 py-3">{t('collar.col.animal')}</th>
                    <th className="text-start px-4 py-3">{t('collar.col.status')}</th>
                    <th className="text-start px-4 py-3">{t('collar.battery')}</th>
                    <th className="text-start px-4 py-3">{t('collar.col.token')}</th>
                    <th className="text-end px-4 py-3">{t('common:actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {devicesLoading ? (
                    <tr><td colSpan={6} className="px-4 py-6"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td></tr>
                  ) : devices.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">{t('collar.no_devices')}</td></tr>
                  ) : devices.map(d => (
                    <tr key={d.id}>
                      <td className="px-4 py-3">{deviceName(d)}</td>
                      <td className="px-4 py-3">{deviceAnimal(d)}</td>
                      <td className="px-4 py-3 text-xs">{deviceStatus(d)}</td>
                      <td className="px-4 py-3 text-xs">{deviceBattery(d)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{deviceToken(d)}</td>
                      <td className="px-4 py-3">{deviceActions(d)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings & connection ── */}
      {tab === 'settings' && form && (
        <div className="grid lg:grid-cols-2 gap-5 [&>*]:min-w-0">
          <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">{t('collar.settings.enable')}</h2>
                <p className="text-xs text-slate-500">{t('collar.settings.enable_hint')}</p>
              </div>
              <Toggle on={form.enabled} onChange={v => setF('enabled', v)} disabled={!canEdit} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([
                ['heat_activity_rise_pct', '%'], ['activity_drop_pct', '%'], ['rumination_drop_pct', '%'], ['fever_temp', '°C'],
                ['baseline_days', t('collar.settings.days')], ['min_baseline_days', t('collar.settings.days')],
                ['offline_hours', t('collar.settings.hours')], ['raw_retention_days', t('collar.settings.days')],
              ] as [keyof CollarSettings, string][]).map(([k, unit]) => (
                <div key={k}>
                  <label className={label}>{t(`collar.settings.${k}`)} <span className="text-slate-400">({unit})</span></label>
                  <NumericInput step={k === 'fever_temp' ? '0.1' : '1'} className={input} disabled={!canEdit}
                    value={String(form[k] ?? '')} onChange={e => setF(k, Number(e.target.value) as never)} />
                </div>
              ))}
            </div>
            <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
              <span>{t('collar.settings.notify_whatsapp')}<span className="block text-xs text-slate-500">{t('collar.settings.notify_whatsapp_hint')}</span></span>
              <Toggle on={form.notify_whatsapp} onChange={v => setF('notify_whatsapp', v)} disabled={!canEdit} />
            </label>
            {canEdit && (
              <div className="flex justify-end">
                <button onClick={saveSettings} disabled={saving} className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60">
                  <Save size={15} /> {t('collar.save')}
                </button>
              </div>
            )}
          </section>

          <div className="space-y-5">
            <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-800">{t('collar.connect.title')}</h2>
              <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside">
                {(t('collar.connect.steps', { returnObjects: true }) as string[]).map((s, i) => <li key={i}>{s}</li>)}
              </ol>
              <div>
                <label className={label}>{t('collar.connect.url')}</label>
                <code className="block rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700 break-all">{overview?.ingest_url}</code>
              </div>
              <div>
                <label className={label}>{t('collar.connect.example')}</label>
                <pre className="rounded-lg bg-[#0f172a] text-[#e2e8f0] p-3 text-[11px] overflow-x-auto whitespace-pre">{example}</pre>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <p className="text-xs text-slate-500">
                  {t('collar.connect.gateway')}{' '}
                  {overview?.settings.has_gateway_key ? <span className="font-medium">••••{overview.settings.gateway_key_hint}</span> : t('collar.connect.none')}
                </p>
                {canEdit && (
                  <button onClick={() => (overview?.settings.has_gateway_key ? setRenewing({ gateway: true }) : gatewayKey())}
                    className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 min-h-10 sm:min-h-0 rounded-lg">
                    <KeyRound size={13} /> {overview?.settings.has_gateway_key ? t('collar.connect.regenerate') : t('collar.connect.generate')}
                  </button>
                )}
              </div>
            </section>

            {canEdit && (
              <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                <h2 className="text-sm font-semibold text-slate-800">{t('collar.import.title')}</h2>
                <p className="text-xs text-slate-600">{t('collar.import.hint')}</p>
                <code className="block rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] text-slate-700 break-all">tag_number,recorded_at,activity,rumination_min,eating_min,temperature</code>
                <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl py-4 text-sm cursor-pointer ${importing ? 'opacity-50' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                  <Upload size={16} /> {importing ? t('collar.import.working') : t('collar.import.choose')}
                  <input type="file" accept=".csv,text/csv" className="hidden" disabled={importing}
                    onChange={e => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ''; }} />
                </label>
                {importResult && (
                  <div className="text-xs rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1">
                    <p>{t('collar.import.result', importResult)}</p>
                    {importResult.errors.map((er, i) => <p key={i} className="text-rose-600">{er}</p>)}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      )}

      {/* Device modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} dirty={!!editing && JSON.stringify(editing) !== editingOpened} size="lg"
        title={editing?.id ? t('collar.edit_device') : t('collar.add_device')}
        footer={<>
          <button type="button" onClick={() => setEditing(null)} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={DEVICE_FORM_ID} disabled={deviceSaving} className={btnPrimary}>
            <Check size={15} /> {t('collar.save')}
          </button>
        </>}>
        {editing && (
          <form id={DEVICE_FORM_ID} noValidate onSubmit={e => { e.preventDefault(); saveDevice(); }} className="px-4 sm:px-6 py-5 space-y-4">
            <FormAlert message={devErr.formError} />
            <FormRow>
              <Field name="serial" label={t('collar.field.serial')} required error={devErr.errors.serial}>
                <input id={fieldId('serial')} className={fieldClass(devErr.errors.serial)} value={editing.serial ?? ''} dir="ltr" data-autofocus
                  onChange={e => { setEditing(d => ({ ...d!, serial: e.target.value })); devErr.clear('serial'); }} />
              </Field>
              <Field name="label" label={t('collar.field.label')} error={devErr.errors.label}>
                <input id={fieldId('label')} className={fieldClass(devErr.errors.label)} value={editing.label ?? ''} dir="auto"
                  onChange={e => { setEditing(d => ({ ...d!, label: e.target.value })); devErr.clear('label'); }} />
              </Field>
            </FormRow>
            <FormRow>
              <Field name="vendor" label={t('collar.field.vendor')} error={devErr.errors.vendor}>
                <SearchSelect id={fieldId('vendor')} value={editing.vendor ?? 'generic'} label={t('collar.field.vendor')} error={devErr.errors.vendor}
                  onChange={v => { setEditing(d => ({ ...d!, vendor: v })); devErr.clear('vendor'); }}
                  options={VENDORS.map(v => ({ value: v, label: t(`collar.vendor.${v}`) }))} />
              </Field>
              <Field name="cattle_id" label={t('collar.field.animal')} error={devErr.errors.cattle_id}>
                <CattleSelect id={fieldId('cattle_id')} value={editing.cattle_id ?? ''} clearable error={devErr.errors.cattle_id}
                  placeholder={t('collar.unassigned')} label={t('collar.field.animal')}
                  cattle={(cattleData?.cattle ?? []).filter(a => !usedCattle.has(a.id))}
                  onChange={v => { setEditing(d => ({ ...d!, cattle_id: v })); devErr.clear('cattle_id'); }} />
              </Field>
            </FormRow>
            <Field name="notes" label={t('collar.field.notes')} error={devErr.errors.notes}>
              <textarea id={fieldId('notes')} rows={2} className={fieldClass(devErr.errors.notes)} value={editing.notes ?? ''} dir="auto"
                onChange={e => { setEditing(d => ({ ...d!, notes: e.target.value })); devErr.clear('notes'); }} />
            </Field>
            <div className="flex items-center justify-between gap-3 min-h-11 text-sm text-slate-700">
              <span id="collar-active-label">{t('collar.field.active')}</span>
              <Toggle on={editing.is_active ?? true} onChange={v => setEditing(d => ({ ...d!, is_active: v }))} labelledBy="collar-active-label" />
            </div>
            {!editing.id && <p className="text-xs text-slate-500">{t('collar.token_after_save')}</p>}
          </form>
        )}
      </Modal>

      {secret && <SecretModal title={secret.title} secret={secret.value} onClose={() => setSecret(null)} />}

      <ConfirmDialog
        open={!!deleting}
        title={t('collar.delete_title')}
        message={t('collar.delete_message', { serial: deleting?.serial ?? '' })}
        confirmLabel={t('collar.delete')}
        onConfirm={removeDevice}
        onCancel={() => setDeleting(null)}
      />

      <ConfirmDialog
        open={!!renewing}
        title={renewing && 'device' in renewing ? t('collar.renew_token_title') : t('collar.connect.regenerate_title')}
        message={renewing && 'device' in renewing
          ? t('collar.renew_token_message', { serial: renewing.device.serial })
          : t('collar.connect.regenerate_message')}
        confirmLabel={renewing && 'device' in renewing ? t('collar.new_token') : t('collar.connect.regenerate')}
        loading={renewBusy}
        onConfirm={renew}
        onCancel={() => setRenewing(null)}
      />
    </div>
  );
}
