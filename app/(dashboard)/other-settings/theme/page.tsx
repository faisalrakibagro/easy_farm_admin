'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { ThemeSettings } from '@/types';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { failedMsg } from '@/lib/feedback';
import {
  Save, Check, RotateCcw, Sun, Moon, Palette,
  Monitor, Type, Layout, AlertTriangle,
} from 'lucide-react';

const RADIUS_OPTIONS = [
  { value: 'none', preview: 'rounded-none' },
  { value: 'sm',   preview: 'rounded-sm'   },
  { value: 'md',   preview: 'rounded-md'   },
  { value: 'lg',   preview: 'rounded-lg'   },
  { value: 'xl',   preview: 'rounded-xl'   },
  { value: '2xl',  preview: 'rounded-2xl'  },
] as const;

const FONT_SIZES = [
  { value: 'sm'   },
  { value: 'base' },
  { value: 'lg'   },
] as const;

interface ColorFieldProps {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
}

function ColorField({ label, description, value, onChange }: ColorFieldProps) {
  const { t } = useTranslation('common');
  return (
    // The pickers drop under the label when the screen is too narrow for both.
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="flex-1 min-w-[10rem]">
        <p className="block text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div
          className="w-8 h-8 rounded-lg border border-slate-200 shadow-sm"
          style={{ backgroundColor: value }}
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 sm:w-8 sm:h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
          title={t('ui.pick_color', { label })}
          aria-label={t('ui.pick_color', { label })}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#([A-Fa-f0-9]{0,6})$/.test(v)) onChange(v);
          }}
          aria-label={label}
          dir="ltr"
          className="w-24 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}

const DEFAULT_THEME: ThemeSettings = {
  theme_mode:          'light',
  theme_primary:       '#3B82F6',
  theme_secondary:     '#64748B',
  theme_sidebar_bg:    '#1E293B',
  theme_header_bg:     '#FFFFFF',
  theme_border_radius: 'md',
  theme_font_size:     'base',
  theme_compact_mode:  'false',
  theme_sidebar_logo:  '',
};

export default function ThemeSettingsPage() {
  const { t } = useTranslation('settings');
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<ThemeSettings>(DEFAULT_THEME);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const { data, isLoading } = useQuery<{ theme: ThemeSettings }>({
    queryKey: ['theme'],
    queryFn: async () => (await api.get('/theme')).data,
  });

  // Load the saved theme into the form whenever a new copy arrives from the server.
  const [loadedData, setLoadedData] = useState<typeof data>();
  if (data !== loadedData) {
    setLoadedData(data);
    if (data?.theme) setForm({ ...DEFAULT_THEME, ...data.theme });
  }

  const updateMutation = useMutation({
    mutationFn: (values: ThemeSettings) => api.put('/theme', values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['theme'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => api.post('/theme/reset'),
    onSuccess: (res) => {
      setForm({ ...DEFAULT_THEME, ...res.data.theme });
      qc.invalidateQueries({ queryKey: ['theme'] });
      setConfirmReset(false);
    },
    onError: (e: unknown) => {
      setConfirmReset(false);
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? failedMsg());
    },
  });

  const set = <K extends keyof ThemeSettings>(key: K, value: ThemeSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(form);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-slate-200 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
            <Palette size={18} className="text-purple-500" />
          </div>
          <div>
            <h1 className="font-semibold text-slate-800">{t('theme.title')}</h1>
            <p className="text-xs text-slate-500">{t('theme.subtitle')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          disabled={resetMutation.isPending}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 disabled:opacity-50 flex-1 sm:flex-none justify-center"
        >
          <RotateCcw size={14} className={resetMutation.isPending ? 'animate-spin' : ''} />
          {t('theme.reset')}
        </button>
      </div>

      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
        <AlertTriangle size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <p>{t('theme.info')}</p>
      </div>

      {/* Color Mode */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
        <div className="flex items-center gap-2 text-slate-700 font-medium">
          <Monitor size={16} />
          {t('theme.sections.color_mode')}
        </div>
        <div className="flex gap-3">
          {(['light', 'dark'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => set('theme_mode', mode)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                form.theme_mode === mode
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              {mode === 'light' ? <Sun size={16} /> : <Moon size={16} />}
              {t(`theme.mode.${mode}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Colors */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
        <div className="flex items-center gap-2 text-slate-700 font-medium">
          <Palette size={16} />
          {t('theme.sections.colors')}
        </div>
        <ColorField
          label={t('theme.fields.primary_color')}
          description={t('theme.fields.primary_color_desc')}
          value={form.theme_primary}
          onChange={(v) => set('theme_primary', v)}
        />
        <ColorField
          label={t('theme.fields.secondary_color')}
          description={t('theme.fields.secondary_color_desc')}
          value={form.theme_secondary}
          onChange={(v) => set('theme_secondary', v)}
        />
        <ColorField
          label={t('theme.fields.sidebar_bg')}
          description={t('theme.fields.sidebar_bg_desc')}
          value={form.theme_sidebar_bg}
          onChange={(v) => set('theme_sidebar_bg', v)}
        />
        <ColorField
          label={t('theme.fields.header_bg')}
          description={t('theme.fields.header_bg_desc')}
          value={form.theme_header_bg}
          onChange={(v) => set('theme_header_bg', v)}
        />
      </div>

      {/* Layout */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
        <div className="flex items-center gap-2 text-slate-700 font-medium">
          <Layout size={16} />
          {t('theme.sections.layout')}
        </div>

        {/* Border Radius */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">{t('theme.fields.border_radius')}</label>
          <div className="flex flex-wrap gap-2">
            {RADIUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set('theme_border_radius', opt.value)}
                className={`px-3 py-1.5 text-xs font-medium border-2 transition-colors ${opt.preview} ${
                  form.theme_border_radius === opt.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {t(`theme.radius.${opt.value}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Compact Mode */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <label className="text-sm font-medium text-slate-700">{t('theme.fields.compact_mode')}</label>
            <p className="text-xs text-slate-400 mt-0.5">{t('theme.fields.compact_mode_desc')}</p>
          </div>
          {/* Padding around the switch gives a finger-sized target. */}
          <button
            type="button"
            role="switch"
            aria-checked={form.theme_compact_mode === 'true'}
            aria-label={t('theme.fields.compact_mode')}
            onClick={() => set('theme_compact_mode', form.theme_compact_mode === 'true' ? 'false' : 'true')}
            className="group p-2 -m-2 rounded-full focus:outline-none"
          >
            <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors group-focus-visible:ring-2 group-focus-visible:ring-blue-500 group-focus-visible:ring-offset-1 ${
              form.theme_compact_mode === 'true' ? 'bg-blue-500' : 'bg-slate-300'
            }`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                form.theme_compact_mode === 'true' ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-1 rtl:-translate-x-1'
              }`} />
            </span>
          </button>
        </div>
      </div>

      {/* Typography */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center gap-2 text-slate-700 font-medium">
          <Type size={16} />
          {t('theme.sections.typography')}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">{t('theme.fields.font_size')}</label>
          <div className="flex gap-2">
            {FONT_SIZES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set('theme_font_size', opt.value)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg border-2 transition-colors ${
                  form.theme_font_size === opt.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {t(`theme.font.${opt.value}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Branding */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center gap-2 text-slate-700 font-medium">
          <Palette size={16} />
          {t('theme.sections.branding')}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('theme.fields.sidebar_logo')}</label>
          <p className="text-xs text-slate-400 mb-2">{t('theme.fields.sidebar_logo_desc')}</p>
          <input
            type="url"
            value={form.theme_sidebar_logo}
            onChange={(e) => set('theme_sidebar_logo', e.target.value)}
            placeholder="https://example.com/logo.png"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {form.theme_sidebar_logo && (
            <div className="mt-3 p-3 bg-ink rounded-lg inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.theme_sidebar_logo}
                alt={t('theme.fields.sidebar_logo_preview')}
                className="h-8 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Save Bar */}
      <div className="flex items-center gap-3 sticky bottom-4">
        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg disabled:opacity-60 transition-colors shadow-sm"
        >
          {saved ? <Check size={16} /> : <Save size={16} />}
          {saved ? t('theme.saved_btn') : updateMutation.isPending ? t('theme.saving') : t('theme.save')}
        </button>
        {updateMutation.isError && (
          <p className="text-sm text-red-600">{t('theme.failed_save')}</p>
        )}
        {saved && <p className="text-sm text-green-600">{t('theme.saved')}</p>}
      </div>

      <ConfirmDialog
        open={confirmReset}
        title={t('theme.reset')}
        message={t('theme.reset_confirm')}
        confirmLabel={t('theme.reset')}
        loading={resetMutation.isPending}
        onConfirm={() => resetMutation.mutate()}
        onCancel={() => setConfirmReset(false)}
      />
    </form>
  );
}
