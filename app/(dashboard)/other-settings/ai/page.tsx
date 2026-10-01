'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Sparkles, KeyRound, Cpu, Wallet, ToggleRight, BarChart3, ShieldCheck, Save, PlugZap, ExternalLink, PanelLeft, MessageCircle } from 'lucide-react';
import Link from '@/components/ui/AppLink';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import LoadError from '@/components/ui/LoadError';
import Card from '@/components/ui/SettingsCard';
import Toggle from '@/components/ui/Toggle';
import SecretInput from '@/components/ui/SecretInput';
import LocalizedNumberInput from '@/components/LocalizedNumberInput';
import ProviderPicker, { type AiProvider } from '@/components/ai/ProviderPicker';
import { aiError } from '@/lib/ai';
import { fmtNum } from '@/lib/format';

interface AiSettings {
  enabled: boolean; provider: string; is_configured: boolean; keys: Record<string, string | null>;
  base_url: string | null; chat_model: string | null; vision_model: string | null;
  effective_chat_model: string; effective_vision_model: string;
  price_input: number | null; price_output: number | null; monthly_budget_usd: number;
  assistant_enabled: boolean; receipt_scan_enabled: boolean; monthly_report_enabled: boolean;
  voice_entry_enabled: boolean; show_in_menu: boolean;
}
interface AiResponse {
  settings: AiSettings;
  providers: AiProvider[];
  usage: { month_cost_usd: number; by_feature: { feature: string; calls: number; cost_usd: number }[] };
  /** How the chosen service hears a recording (null: typing or the browser's dictation). */
  voice_audio: 'inline' | 'transcribe' | null;
}
interface Form {
  enabled: boolean; provider: string; api_key: string; clear_api_key: boolean; base_url: string;
  chat_model: string; vision_model: string; price_input: string; price_output: string; monthly_budget_usd: string;
  assistant_enabled: boolean; receipt_scan_enabled: boolean; monthly_report_enabled: boolean;
  voice_entry_enabled: boolean; show_in_menu: boolean;
}

const FEATURES = ['assistant_enabled', 'receipt_scan_enabled', 'monthly_report_enabled', 'voice_entry_enabled'] as const;
const input = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400';
const label = 'block text-xs font-medium text-slate-600 mb-1';
const str = (v: string | number | null) => (v === null ? '' : String(v));

function toForm(s: AiSettings): Form {
  return {
    enabled: s.enabled, provider: s.provider, api_key: '', clear_api_key: false, base_url: str(s.base_url),
    chat_model: str(s.chat_model), vision_model: str(s.vision_model), price_input: str(s.price_input), price_output: str(s.price_output),
    monthly_budget_usd: String(s.monthly_budget_usd),
    assistant_enabled: s.assistant_enabled, receipt_scan_enabled: s.receipt_scan_enabled, monthly_report_enabled: s.monthly_report_enabled,
    voice_entry_enabled: s.voice_entry_enabled, show_in_menu: s.show_in_menu,
  };
}

/** Settings → AI: which service (Claude, Gemini, OpenAI or any OpenAI-compatible server), its key and models, the budget and switches. */
export default function AiSettingsPage() {
  const { t } = useTranslation('ai');
  const { hasPermission, hasRole } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const canEdit = hasPermission('settings.edit');
  const isSuperAdmin = hasRole('Super Admin');

  const { data, isLoading, isFetching, refetch } = useQuery<AiResponse>({
    queryKey: ['ai-settings'],
    queryFn: async () => (await api.get('/ai/settings')).data,
  });
  const [form, setForm] = useState<Form | null>(null);
  const [loadedFrom, setLoadedFrom] = useState<AiResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [menuSaving, setMenuSaving] = useState(false);

  // Take the saved values into the form whenever fresh settings arrive.
  if (data && data !== loadedFrom) { setLoadedFrom(data); setForm(toForm(data.settings)); }

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm(f => (f ? { ...f, [key]: value } : f));
  // Another service has its own models and key: start from its defaults.
  const pickProvider = (id: string) => setForm(f => (f && f.provider !== id
    ? { ...f, provider: id, api_key: '', clear_api_key: false, chat_model: '', vision_model: '', price_input: '', price_output: '' }
    : f));

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const num = (v: string) => (v.trim() === '' ? null : parseFloat(v));
      const rest: Partial<Form> = { ...form };
      delete rest.show_in_menu;  // saved by its own switch
      const res = await api.put('/ai/settings', {
        ...rest,
        base_url: form.base_url.trim() || null, chat_model: form.chat_model.trim() || null, vision_model: form.vision_model.trim() || null,
        price_input: num(form.price_input), price_output: num(form.price_output), monthly_budget_usd: num(form.monthly_budget_usd) ?? 0,
      });
      toast.success(res.data.message);
      qc.setQueryData(['ai-settings'], { settings: res.data.settings, providers: res.data.providers, usage: res.data.usage, voice_audio: res.data.voice_audio });
      qc.invalidateQueries({ queryKey: ['ai-status'] });
    } catch (err) {
      toast.error(aiError(err, t('assistant.error')));
    } finally { setSaving(false); }
  };

  // The menu switch is saved the moment it is flipped (not with the Save button).
  const toggleMenu = async (on: boolean) => {
    set('show_in_menu', on);
    setMenuSaving(true);
    try {
      const res = await api.put('/ai/settings/menu', { show_in_menu: on });
      toast.success(res.data.message);
      qc.setQueryData<AiResponse>(['ai-settings'], old => (old ? { ...old, settings: { ...old.settings, show_in_menu: on } } : old));
      qc.invalidateQueries({ queryKey: ['ai-status'] });
    } catch (err) {
      set('show_in_menu', !on);
      toast.error(aiError(err, t('assistant.error')));
    } finally { setMenuSaving(false); }
  };

  const test = async () => {
    setTesting(true);
    try {
      const res = await api.post('/ai/settings/test');
      toast.success(res.data.message);
      qc.invalidateQueries({ queryKey: ['ai-settings'] });
    } catch (err) {
      toast.error(aiError(err, t('assistant.error')));
    } finally { setTesting(false); }
  };

  if (!isLoading && !data) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 max-w-4xl">
        <LoadError onRetry={() => refetch()} retrying={isFetching} />
      </div>
    );
  }
  if (!data || !form) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 rounded-2xl bg-slate-100 animate-pulse" />)}</div>;
  }

  const s = data.settings;
  const provider = data.providers.find(p => p.id === form.provider) ?? data.providers[0];
  const compatible = provider.id === 'openai_compatible';
  const savedKey = s.keys[provider.id];
  const unsaved = form.provider !== s.provider;
  const status = !s.is_configured ? 'setup' : s.enabled ? 'on' : 'off';
  const budget = parseFloat(form.monthly_budget_usd) || 0;
  const usedPct = budget > 0 ? Math.min(100, (data.usage.month_cost_usd / budget) * 100) : 0;
  // A model we have no price for (any model on a compatible server) takes the typed-in prices.
  const unpriced = [form.chat_model, form.vision_model].some(m => m.trim() !== '' && !provider.models.includes(m.trim())) || compatible;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header — always-dark surface, so literal colours */}
      <div className="rounded-2xl p-5 text-white bg-gradient-to-br from-[#8b5cf6] to-[#5b21b6] shadow-lg shadow-violet-900/10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-12 h-12 rounded-2xl bg-white/15"><Sparkles size={24} /></span>
          <div>
            <h1 className="text-lg font-bold">{t('settings.title')}</h1>
            <p className="text-sm text-white/80">{t('settings.subtitle')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {s.is_configured && <span className="px-3 py-1 rounded-full bg-white/15">{t(`settings.provider_name.${s.provider}`)} · {s.effective_chat_model}</span>}
          <span className={`px-3 py-1 rounded-full font-medium ${status === 'on' ? 'bg-white text-[#6d28d9]' : 'bg-white/15'}`}>{t(`settings.status.${status}`)}</span>
        </div>
      </div>

      <Card title={t('settings.connection')} icon={KeyRound} hint={t('settings.connection_hint')}
        action={<div className="flex items-center gap-2 text-xs text-slate-600">{t('settings.enabled')}<Toggle on={form.enabled} onChange={v => set('enabled', v)} disabled={!canEdit} label={t('settings.enabled')} /></div>}>
        <div className="space-y-4">
          <ProviderPicker providers={data.providers} value={form.provider} keys={s.keys} onChange={pickProvider} disabled={!canEdit} />

          {compatible && (
            <div>
              <label className={label} htmlFor="ai-base">{t('settings.base_url')}</label>
              <input id="ai-base" type="url" dir="ltr" value={form.base_url} disabled={!canEdit} onChange={e => set('base_url', e.target.value)}
                placeholder="https://openrouter.ai/api/v1" className={`${input} font-mono`} />
              <p className="text-xs text-slate-500 mt-1">{t('settings.base_url_hint')}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono" dir="ltr">OpenRouter: https://openrouter.ai/api/v1 · DeepSeek: https://api.deepseek.com/v1 · Groq: https://api.groq.com/openai/v1 · Ollama: http://localhost:11434/v1</p>
            </div>
          )}

          <div>
            <label className={label} htmlFor="ai-key">{t('settings.api_key')}{compatible && <span className="text-slate-400 font-normal"> · {t('settings.optional')}</span>}</label>
            <SecretInput id="ai-key" name="ai-api-key" value={form.api_key} disabled={!canEdit || form.clear_api_key}
              onChange={v => set('api_key', v)} placeholder={t('settings.api_key_placeholder')} className={input} />
            {savedKey && <p className="text-xs text-emerald-700 mt-1">{t('settings.api_key_saved', { hint: savedKey })}</p>}
            <p className="text-xs text-slate-500 mt-1">
              {t('settings.api_key_help')}
              {provider.key_url && <> <a href={provider.key_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-violet-700 hover:underline">{t('settings.get_key')} <ExternalLink size={11} /></a></>}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {savedKey && canEdit && (
                <label className="flex items-center gap-1.5 text-xs text-red-600">
                  <input type="checkbox" checked={form.clear_api_key} onChange={e => set('clear_api_key', e.target.checked)} className="rounded border-slate-300" />
                  {t('settings.clear_key')}
                </label>
              )}
              {s.is_configured && canEdit && (
                <button type="button" onClick={test} disabled={testing || unsaved}
                  title={unsaved ? t('settings.save_first') : undefined}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-violet-300 text-violet-700 hover:bg-violet-50 disabled:opacity-60">
                  <PlugZap size={13} /> {testing ? t('settings.testing') : t('settings.test')}
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card title={t('settings.features')} icon={ToggleRight}>
        <div className="divide-y divide-slate-100">
          {FEATURES.map(key => {
            const name = key.replace('_enabled', '');
            return (
              <div key={key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-slate-800">{t(`settings.feature.${name}`)}</p>
                  <p className="text-xs text-slate-500">{t(`settings.feature_hint.${name}`)}</p>
                  {key === 'voice_entry_enabled' && s.is_configured && (
                    <p className="text-[11px] text-violet-700 mt-0.5">{t(`settings.voice_audio.${data.voice_audio ?? 'none'}`)}</p>
                  )}
                </div>
                <Toggle on={form[key]} onChange={v => set(key, v)} disabled={!canEdit} label={t(`settings.feature.${name}`)} />
              </div>
            );
          })}
          {/* The WhatsApp automation lives with the rest of WhatsApp. */}
          <Link href="/other-settings/whatsapp" className="flex items-center justify-between gap-4 pt-3 group">
            <span>
              <span className="block text-sm font-medium text-slate-800">{t('settings.feature.whatsapp_bot')}</span>
              <span className="block text-xs text-slate-500">{t('settings.whatsapp_elsewhere')}</span>
            </span>
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 group-hover:underline shrink-0">
              <MessageCircle size={14} /> {t('settings.open_whatsapp')}
            </span>
          </Link>
        </div>
      </Card>

      {/* Whether AI is in the side menu is the Super Admin's call alone — others don't see this. */}
      {isSuperAdmin && (
        <Card title={t('settings.menu')} icon={PanelLeft} hint={t('settings.super_admin_only')}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-800">{t('settings.show_in_menu')}</p>
              <p className="text-xs text-slate-500">{t('settings.show_in_menu_hint')}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{t('settings.show_in_menu_instant')}</p>
            </div>
            <Toggle on={form.show_in_menu} onChange={toggleMenu} disabled={menuSaving} label={t('settings.show_in_menu')} />
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        <Card title={t('settings.models')} icon={Cpu}>
          <div className="space-y-4">
            <datalist id="ai-models">{provider.models.map(m => <option key={m} value={m} />)}</datalist>
            {(['chat_model', 'vision_model'] as const).map(key => {
              const fallback = provider.defaults?.[key === 'chat_model' ? 'chat' : 'vision'];
              return (
                <div key={key}>
                  <label className={label} htmlFor={key}>{t(`settings.${key}`)}</label>
                  <input id={key} list="ai-models" dir="ltr" value={form[key]} disabled={!canEdit} onChange={e => set(key, e.target.value)}
                    placeholder={fallback ?? (key === 'vision_model' ? t('settings.same_as_chat') : 'model-name')} className={`${input} font-mono`} />
                  <p className="text-xs text-slate-500 mt-1">
                    {t(`settings.${key}_hint`)}{fallback && <> {t('settings.model_default', { model: fallback })}</>}
                  </p>
                </div>
              );
            })}
            {unpriced && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2">
                <p className="text-xs text-amber-800">{t('settings.custom_price_hint')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['price_input', 'price_output'] as const).map(key => (
                    <div key={key}>
                      <label className={label}>{t(`settings.${key}`)}</label>
                      <LocalizedNumberInput value={form[key]} disabled={!canEdit} onChange={v => set(key, v)} placeholder="0" className={input} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card title={t('settings.budget')} icon={Wallet} hint={t('settings.budget_hint')}>
          <LocalizedNumberInput value={form.monthly_budget_usd} disabled={!canEdit} onChange={v => set('monthly_budget_usd', v)} className={input} />
          <div className="mt-4">
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-full rounded-full ${usedPct >= 90 ? 'bg-red-500' : usedPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${usedPct}%` }} />
            </div>
            <p className="text-xs text-slate-600 mt-1.5">{t('settings.used', { used: fmtNum(data.usage.month_cost_usd, 2), budget: fmtNum(budget, 2) })}</p>
          </div>
        </Card>
      </div>

      <Card title={t('settings.usage')} icon={BarChart3}>
        {data.usage.by_feature.length === 0 ? (
          <p className="text-sm text-slate-500">{t('settings.no_usage')}</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {data.usage.by_feature.map(f => (
              <li key={f.feature} className="flex justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <span className="text-slate-700">{t(`settings.usage_feature.${f.feature}`, { defaultValue: f.feature })}</span>
                <span className="text-slate-500 tabular-nums">{t('settings.calls', { count: f.calls })} · ${fmtNum(f.cost_usd, 4)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t('settings.privacy')} icon={ShieldCheck}>
        <p className="text-sm text-slate-600">{t('settings.privacy_text')}</p>
      </Card>

      {canEdit && (
        <div className="flex justify-end">
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg disabled:opacity-60">
            <Save size={15} /> {saving ? t('settings.saving') : t('settings.save')}
          </button>
        </div>
      )}
    </div>
  );
}
