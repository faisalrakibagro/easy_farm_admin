'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import SettingLabel, { OWN_PAGE_SETTINGS } from '@/components/settings/SettingLabel';
import {
  Save, Check, Globe, Building2, Image, Search,
  Share2, Settings, Mail, ChevronRight,
} from 'lucide-react';

interface SettingItem {
  id: number;
  key: string;
  value: string | boolean | number | null;
  type: 'text' | 'boolean' | 'number' | 'json';
  description: string | null;
}

const GROUPS = [
  { key: 'general',  icon: Globe       },
  { key: 'company',  icon: Building2   },
  { key: 'branding', icon: Image       },
  { key: 'seo',      icon: Search      },
  { key: 'social',   icon: Share2      },
  { key: 'system',   icon: Settings    },
  { key: 'email',    icon: Mail        },
] as const;

type GroupKey = typeof GROUPS[number]['key'];

const TEXTAREA_KEYS = new Set(['site_description', 'company_address', 'meta_description', 'meta_keywords']);
const URL_KEYS       = new Set(['logo_url', 'favicon_url', 'og_image_url', 'facebook_url', 'instagram_url', 'twitter_url', 'linkedin_url', 'youtube_url']);
const EMAIL_KEYS     = new Set(['company_email', 'mail_from_address', 'mail_username']);
const PASSWORD_KEYS  = new Set(['mail_password']);

function fieldType(key: string, type: string): string {
  if (URL_KEYS.has(key))      return 'url';
  if (EMAIL_KEYS.has(key))    return 'email';
  if (PASSWORD_KEYS.has(key)) return 'password';
  if (type === 'number')      return 'number';
  return 'text';
}

export default function WebsiteSettingsPage() {
  const { t } = useTranslation('settings');
  const qc = useQueryClient();
  const [activeGroup, setActiveGroup] = useState<GroupKey>('general');
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery<Record<string, SettingItem[]>>({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await api.get('/settings');
      return res.data.settings as Record<string, SettingItem[]>;
    },
  });

  // Load the saved settings into the form whenever a new copy arrives from the server.
  const [loadedData, setLoadedData] = useState<typeof data>();
  if (data !== loadedData) {
    setLoadedData(data);
    if (data) {
      const flat: Record<string, string> = {};
      Object.values(data).flat().forEach(s => { flat[s.key] = String(s.value ?? ''); });
      setFormValues(flat);
    }
  }

  const updateMutation = useMutation({
    mutationFn: async (values: Record<string, string>) => {
      const settings = Object.entries(values).map(([key, value]) => ({ key, value }));
      await api.put('/settings', { settings });
    },
    onSuccess: () => {
      // Shared ['settings'] cache — the main settings page reads the same key.
      qc.invalidateQueries({ queryKey: ['settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formValues);
  };

  const set = (key: string, value: string) => setFormValues(f => ({ ...f, [key]: value }));

  const groupItems = (key: GroupKey): SettingItem[] => data?.[key] ?? [];

  if (isLoading) {
    return (
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-48 flex-shrink-0 space-y-2">
          {[...Array(7)].map((_, i) => <div key={i} className={`h-10 bg-slate-200 rounded-lg animate-pulse ${i ? 'hidden lg:block' : ''}`} />)}
        </div>
        <div className="flex-1 space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-slate-200 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const activeItems = groupItems(activeGroup).filter(s => !OWN_PAGE_SETTINGS.has(s.key));
  const activeGroupMeta = GROUPS.find(g => g.key === activeGroup)!;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* Sidebar nav */}
      {/* Below lg the groups are one row that scrolls sideways instead of a
          seven-row list above the fields. */}
      <nav className="lg:w-48 flex-shrink-0 min-w-0">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex overflow-x-auto lg:block">
          {GROUPS.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveGroup(key)}
              aria-current={activeGroup === key ? 'true' : undefined}
              className={`shrink-0 lg:w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap lg:whitespace-normal transition-colors border-e lg:border-e-0 lg:border-b border-slate-100 last:border-0 ${
                activeGroup === key
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Icon size={15} />
                {t(`website.groups.${key}`)}
              </span>
              {activeGroup === key && <ChevronRight size={14} className="hidden lg:block rtl:rotate-180" />}
            </button>
          ))}
          </div>
        </div>
      </nav>

      {/* Settings panel */}
      <div className="flex-1 min-w-0 space-y-5">
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <activeGroupMeta.icon size={18} className="text-slate-500" />
            <h2 className="font-semibold text-slate-800">
              {t(`website.groups.${activeGroup}`)} {t('website.group_suffix')}
            </h2>
          </div>

          <div className="p-4 sm:p-6 space-y-5">
            {activeItems.length === 0 && (
              <p className="text-sm text-slate-400">{t('website.no_settings')}</p>
            )}

            {activeItems.map(setting => {
              const value = formValues[setting.key] ?? '';

              return (
                <div key={setting.key}>
                  <SettingLabel settingKey={setting.key} description={setting.description} htmlFor={`setting-${setting.key}`} />

                  {setting.type === 'boolean' ? (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={value === 'true'}
                        id={`setting-${setting.key}`}
                        onClick={() => set(setting.key, value === 'true' ? 'false' : 'true')}
                        className="group p-2 -m-2 rounded-full focus:outline-none"
                      >
                        <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors group-focus-visible:ring-2 group-focus-visible:ring-blue-500 group-focus-visible:ring-offset-1 ${
                          value === 'true' ? 'bg-blue-500' : 'bg-slate-300'
                        }`}>
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            value === 'true' ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-1 rtl:-translate-x-1'
                          }`} />
                        </span>
                      </button>
                      <span className="text-sm text-slate-600">
                        {value === 'true' ? t('website.enabled') : t('website.disabled')}
                      </span>
                    </div>
                  ) : TEXTAREA_KEYS.has(setting.key) ? (
                    <textarea
                      id={`setting-${setting.key}`}
                      value={value}
                      onChange={e => set(setting.key, e.target.value)}
                      rows={3}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  ) : (
                    <input
                      id={`setting-${setting.key}`}
                      type={fieldType(setting.key, setting.type)}
                      value={value}
                      onChange={e => set(setting.key, e.target.value)}
                      className="w-full max-w-md border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Save bar */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg disabled:opacity-60 transition-colors"
          >
            {saved ? <Check size={16} /> : <Save size={16} />}
            {saved ? t('general.saved') : updateMutation.isPending ? t('general.saving') : t('general.save')}
          </button>
          {updateMutation.isError && (
            <p className="text-sm text-red-600">{t('website.failed_save')}</p>
          )}
          {saved && (
            <p className="text-sm text-green-600">{t('website.saved')}</p>
          )}
        </div>
      </div>
    </form>
  );
}
