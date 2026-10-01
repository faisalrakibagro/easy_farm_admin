'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  MessageCircle, Save, Plus, Pencil, Trash2, Send, Copy, RefreshCw, ShieldCheck, Eye,
  Stethoscope, Wheat, Pill, Hourglass, Syringe, Heart, Scale, Wallet, Radio, Play, BookOpen, Check, X, FileText,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import LoadError from '@/components/ui/LoadError';
import { localeFor } from '@/lib/languages';
import Card from '@/components/ui/SettingsCard';
import Toggle from '@/components/ui/Toggle';
import SecretInput from '@/components/ui/SecretInput';
import WhatsAppAutomationCard from '@/components/ai/WhatsAppAutomationCard';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import FormRow from '@/components/ui/FormRow';
import FormAlert from '@/components/ui/FormAlert';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { useFormErrors } from '@/lib/hooks/useFormErrors';

type AlertType = 'sick_alert' | 'low_feed_stock' | 'low_medicine_stock' | 'medicine_expiry' | 'vaccine_due' | 'breeding' | 'weight_check' | 'salary_due' | 'collar_alert' | 'monthly_report';

interface WaSettings {
  enabled: boolean; is_configured: boolean;
  phone_number_id: string | null; business_account_id: string | null;
  has_access_token: boolean; access_token_hint: string | null; has_app_secret: boolean;
  api_version: string; free_only: boolean; template_name: string | null; template_language: string;
  alerts: AlertType[]; webhook_url: string; webhook_verify_token: string | null;
}
interface Recipient {
  id: number; name: string; phone: string; is_active: boolean;
  alerts: AlertType[] | null; last_inbound_at: string | null; window_open: boolean;
}
interface WaLog {
  id: number; recipient_name: string | null; phone: string; trigger_type: string; message: string;
  status: 'queued' | 'sent' | 'failed'; delivery_mode: string | null; delivery_status: string | null;
  error_message: string | null; created_at: string;
}
interface WaResponse {
  settings: WaSettings; recipients: Recipient[]; alert_types: AlertType[]; max_recipients: number;
  stats: { sent_today: number; failed_today: number };
}

const ALERT_ICON: Record<AlertType, React.ElementType> = {
  sick_alert: Stethoscope, low_feed_stock: Wheat, low_medicine_stock: Pill, medicine_expiry: Hourglass,
  vaccine_due: Syringe, breeding: Heart, weight_check: Scale, salary_due: Wallet, collar_alert: Radio, monthly_report: FileText,
};
const ALERT_TONE: Record<AlertType, string> = {
  sick_alert: 'text-rose-600 bg-rose-50', low_feed_stock: 'text-lime-700 bg-lime-50', low_medicine_stock: 'text-pink-600 bg-pink-50',
  medicine_expiry: 'text-amber-600 bg-amber-50', vaccine_due: 'text-sky-600 bg-sky-50', breeding: 'text-violet-600 bg-violet-50',
  weight_check: 'text-teal-600 bg-teal-50', salary_due: 'text-orange-600 bg-orange-50',
  collar_alert: 'text-indigo-600 bg-indigo-50', monthly_report: 'text-fuchsia-600 bg-fuchsia-50',
};

const RECIPIENT_FORM_ID = 'wa-recipient';
const RECIPIENT_FIELDS = ['name', 'phone', 'alerts', 'is_active'];

const input = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';
const label = 'block text-xs font-medium text-slate-600 mb-1';

type ApiError = { response?: { data?: { message?: string; error?: string; errors?: Record<string, string[]> } } };
const errText = (e: unknown, fallback: string) => {
  const d = (e as ApiError).response?.data;
  return d?.errors ? Object.values(d.errors)[0]?.[0] ?? fallback : d?.message ?? fallback;
};

type Form = {
  enabled: boolean; phone_number_id: string; business_account_id: string; access_token: string; clear_access_token: boolean;
  app_secret: string; clear_app_secret: boolean; api_version: string; free_only: boolean;
  template_name: string; template_language: string; alerts: AlertType[];
};
const toForm = (s: WaSettings): Form => ({
  enabled: s.enabled, phone_number_id: s.phone_number_id ?? '', business_account_id: s.business_account_id ?? '',
  access_token: '', clear_access_token: false, app_secret: '', clear_app_secret: false,
  api_version: s.api_version, free_only: s.free_only, template_name: s.template_name ?? '',
  template_language: s.template_language, alerts: s.alerts,
});

export default function WhatsAppSettingsPage() {
  const { t } = useTranslation('settings');
  const qc = useQueryClient();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('settings.edit');

  const { data, isLoading, isFetching, refetch } = useQuery<WaResponse>({
    queryKey: ['whatsapp'],
    queryFn: async () => (await api.get('/whatsapp')).data,
  });

  // Load the saved settings into the form whenever a new copy arrives.
  const [form, setForm] = useState<Form | null>(null);
  const [loaded, setLoaded] = useState<WaSettings>();
  if (data && data.settings !== loaded) {
    setLoaded(data.settings);
    setForm(toForm(data.settings));
  }
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => (f ? { ...f, [k]: v } : f));
  const toggleAlert = (a: AlertType) => setForm(f => (f ? { ...f, alerts: f.alerts.includes(a) ? f.alerts.filter(x => x !== a) : [...f.alerts, a] } : f));

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await api.put('/whatsapp/settings', {
        ...form,
        phone_number_id: form.phone_number_id.trim() || null,
        business_account_id: form.business_account_id.trim() || null,
        template_name: form.template_name.trim() || null,
      });
      toast.success(t('whatsapp.toast.saved'));
      qc.invalidateQueries({ queryKey: ['whatsapp'] });
    } catch (e) {
      toast.error(errText(e, t('whatsapp.toast.save_failed')));
    } finally { setSaving(false); }
  };

  // ── Recipients ───────────────────────────────────────────────
  const [editing, setEditing] = useState<Partial<Recipient> | null>(null);
  const [deleting, setDeleting] = useState<Recipient | null>(null);
  const [testing, setTesting] = useState<number | null>(null);
  const [editingOpened, setEditingOpened] = useState('');
  const [recipientSaving, setRecipientSaving] = useState(false);
  const recErr = useFormErrors();
  const openRecipient = (r: Partial<Recipient>) => {
    setEditing(r);
    setEditingOpened(JSON.stringify(r));
    recErr.reset();
  };

  const saveRecipient = async () => {
    if (!editing) return;
    if (!recErr.check({
      name: !(editing.name ?? '').trim() && t('common:form.v.required'),
      phone: !(editing.phone ?? '').trim() && t('common:form.v.required'),
    })) return;
    setRecipientSaving(true);
    try {
      const body = { name: editing.name ?? '', phone: editing.phone ?? '', is_active: editing.is_active ?? true, alerts: editing.alerts ?? null };
      if (editing.id) await api.put(`/whatsapp/recipients/${editing.id}`, body);
      else await api.post('/whatsapp/recipients', body);
      toast.success(t('whatsapp.toast.recipient_saved'));
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['whatsapp'] });
    } catch (e) {
      toast.error(recErr.fromApi(e, t('whatsapp.toast.save_failed'), RECIPIENT_FIELDS));
    } finally {
      setRecipientSaving(false);
    }
  };

  const removeRecipient = async () => {
    if (!deleting) return;
    try {
      await api.delete(`/whatsapp/recipients/${deleting.id}`);
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ['whatsapp'] });
    } catch (e) { toast.error(errText(e, t('whatsapp.toast.save_failed'))); }
  };

  const test = async (r: Recipient) => {
    setTesting(r.id);
    try {
      await api.post(`/whatsapp/recipients/${r.id}/test`);
      toast.success(t('whatsapp.toast.test_sent', { name: r.name }));
    } catch (e) {
      const d = (e as ApiError).response?.data;
      toast.error(d?.error ? `${t('whatsapp.toast.test_failed')} ${d.error}` : errText(e, t('whatsapp.toast.test_failed')));
    } finally {
      setTesting(null);
      qc.invalidateQueries({ queryKey: ['whatsapp-logs'] });
    }
  };

  // ── Manual run ───────────────────────────────────────────────
  const [runOutput, setRunOutput] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const run = async (dry: boolean) => {
    setRunning(true);
    try {
      const res = await api.post('/whatsapp/run', { dry_run: dry });
      setRunOutput(res.data.output || t('whatsapp.run.nothing'));
      if (!dry) qc.invalidateQueries({ queryKey: ['whatsapp-logs'] });
    } catch (e) { toast.error(errText(e, t('whatsapp.toast.save_failed'))); }
    finally { setRunning(false); }
  };

  // ── Log ──────────────────────────────────────────────────────
  const [logPage, setLogPage] = useState(1);
  const { data: logs } = useQuery<{ data: WaLog[]; last_page: number; total: number }>({
    queryKey: ['whatsapp-logs', logPage],
    queryFn: async () => (await api.get('/whatsapp/logs', { params: { page: logPage } })).data,
  });

  const copy = (text: string) => { navigator.clipboard?.writeText(text); toast.success(t('whatsapp.toast.copied')); };

  // A new verify token breaks the webhook until it is pasted into Meta again, so it is confirmed.
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const regenerateToken = async () => {
    setRegenerating(true);
    try {
      await api.post('/whatsapp/settings/verify-token');
      toast.success(t('whatsapp.webhook.regenerated'));
      qc.invalidateQueries({ queryKey: ['whatsapp'] });
    } catch (e) {
      toast.error(errText(e, t('whatsapp.toast.save_failed')));
    } finally {
      setRegenerating(false);
      setConfirmRegen(false);
    }
  };

  if (!isLoading && !data) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 max-w-5xl">
        <LoadError onRetry={() => refetch()} retrying={isFetching} />
      </div>
    );
  }
  if (!data || !form) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 rounded-2xl bg-slate-100 animate-pulse" />)}</div>;
  }

  const s = data.settings;
  const full = data.recipients.length >= data.max_recipients;
  const status = !s.is_configured ? 'setup' : s.enabled ? 'on' : 'off';

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="rounded-2xl p-5 text-white bg-gradient-to-br from-[#10b981] to-[#0f766e] shadow-lg shadow-emerald-900/10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-12 h-12 rounded-2xl bg-white/15"><MessageCircle size={24} /></span>
          <div>
            <h1 className="text-lg font-bold">{t('whatsapp.title')}</h1>
            <p className="text-sm text-white/80">{t('whatsapp.subtitle')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`px-3 py-1 rounded-full font-medium ${status === 'on' ? 'bg-white text-emerald-700' : 'bg-white/15'}`}>{t(`whatsapp.status.${status}`)}</span>
          <span className="px-3 py-1 rounded-full bg-white/15">{t('whatsapp.stats.sent_today', { count: data.stats.sent_today })}</span>
          {data.stats.failed_today > 0 && <span className="px-3 py-1 rounded-full bg-[#be123c]/80">{t('whatsapp.stats.failed_today', { count: data.stats.failed_today })}</span>}
        </div>
      </div>

      {/* Setup guide */}
      <details className="group bg-white rounded-2xl border border-slate-200 shadow-sm" open={!s.is_configured}>
        <summary className="flex items-center gap-2.5 px-5 py-4 cursor-pointer select-none text-sm font-semibold text-slate-800">
          <span className="grid place-items-center w-8 h-8 rounded-lg bg-sky-50 text-sky-600"><BookOpen size={16} /></span>
          {t('whatsapp.guide.title')}
        </summary>
        <ol className="px-5 pb-5 space-y-2 text-sm text-slate-600 list-decimal list-inside">
          {(t('whatsapp.guide.steps', { returnObjects: true }) as string[]).map((step, i) => <li key={i}>{step}</li>)}
        </ol>
      </details>

      <div className="grid lg:grid-cols-2 gap-5 [&>*]:min-w-0">
        {/* Connection */}
        <Card title={t('whatsapp.connection.title')} icon={ShieldCheck} hint={t('whatsapp.connection.hint')}
          action={<div className="flex items-center gap-2 text-xs text-slate-600">{t('whatsapp.connection.enabled')}<Toggle on={form.enabled} onChange={v => set('enabled', v)} disabled={!canEdit} /></div>}>
          <div className="space-y-3">
            <div>
              <label className={label}>{t('whatsapp.connection.phone_number_id')}<span className="text-red-500 ms-0.5" aria-hidden="true">*</span></label>
              <input className={input} value={form.phone_number_id} onChange={e => set('phone_number_id', e.target.value)} placeholder="123456789012345" inputMode="numeric" disabled={!canEdit} />
            </div>
            <div>
              <label className={label}>{t('whatsapp.connection.access_token')}<span className="text-red-500 ms-0.5" aria-hidden="true">*</span></label>
              <SecretInput className={input} name="whatsapp-access-token" value={form.access_token} onChange={v => set('access_token', v)}
                placeholder={s.has_access_token && !form.clear_access_token ? `${t('whatsapp.connection.token_saved')} ${s.access_token_hint}` : 'EAAG…'} disabled={!canEdit} />
              {s.has_access_token && canEdit && (
                <label className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                  <input type="checkbox" checked={form.clear_access_token} onChange={e => set('clear_access_token', e.target.checked)} className="accent-rose-500" />
                  {t('whatsapp.connection.clear_token')}
                </label>
              )}
              <p className="text-[11px] text-slate-400 mt-1">{t('whatsapp.connection.token_note')}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>{t('whatsapp.connection.business_account_id')}</label>
                <input className={input} value={form.business_account_id} onChange={e => set('business_account_id', e.target.value)} placeholder={t('whatsapp.optional')} inputMode="numeric" disabled={!canEdit} />
              </div>
              <div>
                <label className={label}>{t('whatsapp.connection.api_version')}</label>
                <input className={input} value={form.api_version} onChange={e => set('api_version', e.target.value)} placeholder="v23.0" disabled={!canEdit} />
              </div>
            </div>
            <div>
              <label className={label}>{t('whatsapp.connection.app_secret')} <span className="text-slate-400">({t('whatsapp.optional')})</span></label>
              <SecretInput className={input} name="whatsapp-app-secret" value={form.app_secret} onChange={v => set('app_secret', v)}
                placeholder={s.has_app_secret && !form.clear_app_secret ? t('whatsapp.connection.token_saved') : ''} disabled={!canEdit} />
              {s.has_app_secret && canEdit && (
                <label className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                  <input type="checkbox" checked={form.clear_app_secret} onChange={e => set('clear_app_secret', e.target.checked)} className="accent-rose-500" />
                  {t('whatsapp.connection.clear_secret')}
                </label>
              )}
              <p className="text-[11px] text-slate-400 mt-1">{t('whatsapp.connection.secret_note')}</p>
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          {/* Cost */}
          <Card title={t('whatsapp.cost.title')} icon={Wallet}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-800">{t('whatsapp.cost.free_only')}</p>
                <p className="text-xs text-slate-500 mt-1">{t('whatsapp.cost.free_only_hint')}</p>
              </div>
              <Toggle on={form.free_only} onChange={v => set('free_only', v)} disabled={!canEdit} />
            </div>
            {form.free_only ? (
              <p className="mt-3 text-xs rounded-lg px-3 py-2 bg-emerald-50 text-emerald-700">{t('whatsapp.cost.free_tip')}</p>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-xs rounded-lg px-3 py-2 bg-amber-50 text-amber-700">{t('whatsapp.cost.paid_warning')}</p>
                <div className="grid grid-cols-3 items-end gap-3">
                  <div className="col-span-2">
                    <label className={label}>{t('whatsapp.cost.template_name')}</label>
                    <input className={input} value={form.template_name} onChange={e => set('template_name', e.target.value)} placeholder="farm_alert" disabled={!canEdit} />
                  </div>
                  <div>
                    <label className={label}>{t('whatsapp.cost.language')}</label>
                    <input className={input} value={form.template_language} onChange={e => set('template_language', e.target.value)} placeholder="bn" disabled={!canEdit} />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">{t('whatsapp.cost.template_hint')}</p>
              </div>
            )}
          </Card>

          {/* Webhook */}
          <Card title={t('whatsapp.webhook.title')} icon={RefreshCw} hint={t('whatsapp.webhook.hint')}>
            <div className="space-y-3">
              {[['callback_url', s.webhook_url], ['verify_token', s.webhook_verify_token ?? '']].map(([k, v]) => (
                <div key={k}>
                  <p className={label}>{t(`whatsapp.webhook.${k}`)}</p>
                  <div className="flex gap-2">
                    <code className="flex-1 min-w-0 truncate rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700" dir="ltr">{v}</code>
                    <button type="button" onClick={() => copy(v)} className="grid place-items-center min-w-10 min-h-10 sm:min-h-0 px-3 border border-slate-300 rounded-lg text-slate-500 hover:bg-slate-50" aria-label={t('common:ui.copy')} title={t('common:ui.copy')}><Copy size={14} /></button>
                  </div>
                </div>
              ))}
              {canEdit && (
                <button type="button" className="min-h-10 sm:min-h-0 text-xs text-emerald-700 hover:underline disabled:opacity-60"
                  disabled={regenerating} onClick={() => setConfirmRegen(true)}>
                  {t('whatsapp.webhook.regenerate')}
                </button>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Alerts */}
      <Card title={t('whatsapp.alerts.title')} icon={MessageCircle} hint={t('whatsapp.alerts.hint')}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {data.alert_types.map(a => {
            const Icon = ALERT_ICON[a] ?? MessageCircle;
            const on = form.alerts.includes(a);
            return (
              <button key={a} type="button" disabled={!canEdit} onClick={() => toggleAlert(a)}
                className={`flex items-start gap-2.5 text-start rounded-xl border px-3 py-2.5 transition-colors ${on ? 'border-emerald-400 bg-emerald-50/60' : 'border-slate-200 hover:bg-slate-50'}`}>
                <span className={`grid place-items-center w-8 h-8 rounded-lg shrink-0 ${ALERT_TONE[a] ?? 'text-slate-600 bg-slate-100'}`}><Icon size={15} /></span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800">{t(`whatsapp.alert.${a}`)}{on && <Check size={13} className="text-emerald-600" />}</span>
                  <span className="block text-[11px] text-slate-500 leading-snug">{t(`whatsapp.alert_hint.${a}`)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {canEdit && (
        <div className="flex justify-end">
          <button type="button" onClick={save} disabled={saving}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg disabled:opacity-60">
            <Save size={16} /> {saving ? t('whatsapp.saving') : t('whatsapp.save')}
          </button>
        </div>
      )}

      {/* Recipients */}
      <Card title={t('whatsapp.recipients.title', { count: data.recipients.length, max: data.max_recipients })} icon={Send} hint={t('whatsapp.recipients.hint')}
        action={canEdit && !full ? (
          <button type="button" onClick={() => openRecipient({ is_active: true, alerts: null })}
            className="flex items-center gap-1.5 min-h-10 sm:min-h-0 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium px-3 py-2 rounded-lg">
            <Plus size={14} /> {t('whatsapp.recipients.add')}
          </button>
        ) : undefined}>
        {data.recipients.length === 0 && !editing ? (
          <p className="text-sm text-slate-400 text-center py-6">{t('whatsapp.recipients.empty')}</p>
        ) : (
          <div className="space-y-2.5">
            {data.recipients.map(r => (
              <div key={r.id} className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${r.is_active ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-70'}`}>
                <span className="grid place-items-center w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-white text-sm font-bold">{r.name[0]?.toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">{r.name} <span className="font-normal text-slate-500">+{r.phone}</span></p>
                  <p className="text-xs text-slate-500">
                    {r.alerts === null ? t('whatsapp.recipients.all_alerts') : r.alerts.map(a => t(`whatsapp.alert.${a}`)).join(', ') || t('whatsapp.recipients.no_alerts')}
                  </p>
                </div>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${r.window_open ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                  title={r.last_inbound_at ? new Date(r.last_inbound_at).toLocaleString(localeFor()) : ''}>
                  {r.window_open ? t('whatsapp.recipients.window_open') : t('whatsapp.recipients.window_closed')}
                </span>
                {canEdit && (
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => test(r)} disabled={testing === r.id}
                      className="flex items-center gap-1.5 min-h-10 sm:min-h-0 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg disabled:opacity-50">
                      <Send size={13} /> {testing === r.id ? t('whatsapp.recipients.sending') : t('whatsapp.recipients.test')}
                    </button>
                    <button type="button" onClick={() => openRecipient(r)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400"
                      aria-label={t('whatsapp.recipients.edit')} title={t('whatsapp.recipients.edit')}><Pencil size={14} /></button>
                    <button type="button" onClick={() => setDeleting(r)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400" aria-label={t('whatsapp.recipients.delete')} title={t('whatsapp.recipients.delete')}><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-[11px] text-slate-500">{t('whatsapp.recipients.window_note')}</p>
      </Card>

      {/* WhatsApp automation: entries and questions from staff */}
      <WhatsAppAutomationCard />

      {/* Run now */}
      {canEdit && (
        <Card title={t('whatsapp.run.title')} icon={Play} hint={t('whatsapp.run.hint')}
          action={
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={running} onClick={() => run(true)} className="flex items-center gap-1.5 min-h-10 sm:min-h-0 border border-slate-300 hover:bg-slate-50 text-slate-600 text-xs font-medium px-3 py-2 rounded-lg disabled:opacity-50">
                <Eye size={14} /> {t('whatsapp.run.preview')}
              </button>
              <button type="button" disabled={running || !s.enabled} onClick={() => run(false)} className="flex items-center gap-1.5 min-h-10 sm:min-h-0 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-3 py-2 rounded-lg disabled:opacity-50">
                <Send size={14} /> {t('whatsapp.run.send')}
              </button>
            </div>
          }>
          {runOutput
            ? <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-700 font-[inherit]">{runOutput}</pre>
            : <p className="text-xs text-slate-400">{t('whatsapp.run.empty')}</p>}
        </Card>
      )}

      {/* Log */}
      <Card title={t('whatsapp.log.title')} icon={BookOpen}>
        <div className="overflow-hidden border border-slate-200 rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-start px-4 py-2.5">{t('whatsapp.log.time')}</th>
                  <th className="text-start px-4 py-2.5">{t('whatsapp.log.to')}</th>
                  <th className="text-start px-4 py-2.5">{t('whatsapp.log.type')}</th>
                  <th className="text-start px-4 py-2.5">{t('whatsapp.log.message')}</th>
                  <th className="text-start px-4 py-2.5">{t('whatsapp.log.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(logs?.data ?? []).length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">{t('whatsapp.log.empty')}</td></tr>
                ) : logs!.data.map(l => (
                  <tr key={l.id}>
                    <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">{new Date(l.created_at).toLocaleString(localeFor())}</td>
                    <td className="px-4 py-2.5 text-xs"><span className="font-medium text-slate-700">{l.recipient_name}</span><br /><span className="text-slate-400">+{l.phone}</span></td>
                    <td className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap">{t(`whatsapp.alert.${l.trigger_type}`, { defaultValue: l.trigger_type })}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-600 max-w-[22rem]"><p className="line-clamp-2 whitespace-pre-line" title={l.message}>{l.message}</p></td>
                    <td className="px-4 py-2.5 text-xs">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${l.status === 'failed' ? 'bg-rose-50 text-rose-600' : l.status === 'sent' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {l.status === 'failed' ? <X size={11} /> : <Check size={11} />}
                        {t(`whatsapp.log.state.${l.status === 'sent' ? (l.delivery_status ?? 'sent') : l.status}`)}
                      </span>
                      {l.delivery_mode && <span className="ms-1 text-[10px] text-slate-400">{l.delivery_mode === 'template' ? t('whatsapp.log.template') : t('whatsapp.log.text')}</span>}
                      {l.error_message && <p className="mt-1 text-[11px] text-rose-600 max-w-[16rem] break-words">{l.error_message}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(logs?.total ?? 0) > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-500">{t('common:pagination.page_of', { current: logPage, total: logs?.last_page ?? 1 })} &bull; {t('common:pagination.total_count', { count: logs?.total ?? 0 })}</span>
              <div className="flex gap-2">
                <button disabled={logPage <= 1} onClick={() => setLogPage(p => p - 1)} className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40">{t('common:btn.prev')}</button>
                <button disabled={logPage >= (logs?.last_page ?? 1)} onClick={() => setLogPage(p => p + 1)} className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40">{t('common:btn.next')}</button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Recipient modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} dirty={!!editing && JSON.stringify(editing) !== editingOpened} size="lg"
        title={editing?.id ? t('whatsapp.recipients.edit') : t('whatsapp.recipients.add')}
        footer={<>
          <button type="button" onClick={() => setEditing(null)} className={btnSecondary}>{t('common:btn.cancel')}</button>
          <button type="submit" form={RECIPIENT_FORM_ID} disabled={recipientSaving} className={btnPrimary}>
            <Check size={15} /> {t('whatsapp.save')}
          </button>
        </>}>
        {editing && (
          <form id={RECIPIENT_FORM_ID} noValidate onSubmit={e => { e.preventDefault(); saveRecipient(); }} className="px-4 sm:px-6 py-5 space-y-4">
            <FormAlert message={recErr.formError} />
            <FormRow>
              <Field name="name" label={t('whatsapp.recipients.name')} required error={recErr.errors.name}>
                <input id={fieldId('name')} className={fieldClass(recErr.errors.name)} value={editing.name ?? ''} dir="auto" data-autofocus
                  onChange={e => { setEditing(r => ({ ...r!, name: e.target.value })); recErr.clear('name'); }} />
              </Field>
              <Field name="phone" label={t('whatsapp.recipients.phone')} required error={recErr.errors.phone}>
                <input id={fieldId('phone')} className={fieldClass(recErr.errors.phone)} value={editing.phone ?? ''} placeholder="01712345678"
                  type="tel" inputMode="tel" dir="ltr" autoComplete="off"
                  onChange={e => { setEditing(r => ({ ...r!, phone: e.target.value })); recErr.clear('phone'); }} />
              </Field>
            </FormRow>
            <div data-field="alerts" data-field-error={recErr.errors.alerts ? 'true' : undefined}>
              <label className="flex items-center gap-2 min-h-10 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" className="accent-emerald-600 w-4 h-4" checked={editing.alerts === null || editing.alerts === undefined}
                  onChange={e => setEditing(r => ({ ...r!, alerts: e.target.checked ? null : [...(form.alerts)] }))} />
                {t('whatsapp.recipients.all_alerts')}
              </label>
              {editing.alerts && (
                <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-1.5 mt-1">
                  {data.alert_types.map(a => (
                    <label key={a} className="flex items-center gap-2 min-h-10 text-xs text-slate-600 rounded-lg border border-slate-200 px-2.5 py-2 cursor-pointer">
                      <input type="checkbox" className="accent-emerald-600 w-4 h-4 shrink-0" checked={editing.alerts!.includes(a)}
                        onChange={() => setEditing(r => ({ ...r!, alerts: r!.alerts!.includes(a) ? r!.alerts!.filter(x => x !== a) : [...r!.alerts!, a] }))} />
                      {t(`whatsapp.alert.${a}`)}
                    </label>
                  ))}
                </div>
              )}
              {recErr.errors.alerts && <p role="alert" className="text-xs text-red-600 mt-1">{recErr.errors.alerts}</p>}
            </div>
            <div className="flex items-center justify-between gap-3 min-h-11 text-sm text-slate-700">
              <span>{t('whatsapp.recipients.active')}</span>
              <Toggle on={editing.is_active ?? true} onChange={v => setEditing(r => ({ ...r!, is_active: v }))} label={t('whatsapp.recipients.active')} />
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title={t('whatsapp.recipients.delete_title')}
        message={t('whatsapp.recipients.delete_message', { name: deleting?.name ?? '' })}
        confirmLabel={t('whatsapp.recipients.delete')}
        onConfirm={removeRecipient}
        onCancel={() => setDeleting(null)}
      />

      <ConfirmDialog
        open={confirmRegen}
        title={t('whatsapp.webhook.regenerate_title')}
        message={t('whatsapp.webhook.regenerate_message')}
        confirmLabel={t('whatsapp.webhook.regenerate_confirm')}
        loading={regenerating}
        onConfirm={regenerateToken}
        onCancel={() => setConfirmRegen(false)}
      />
    </div>
  );
}
