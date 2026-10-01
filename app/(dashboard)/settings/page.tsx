'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Save, Check } from 'lucide-react';
import SettingLabel, { OWN_PAGE_SETTINGS } from '@/components/settings/SettingLabel';
import { savedMsg, failedMsg } from '@/lib/feedback';
import NumericInput from '@/components/ui/NumericInput';

interface SettingItem {
  id: number;
  key: string;
  value: string | boolean | number | null;
  type: string;
  description: string | null;
}

export default function SettingsPage() {
  const { t } = useTranslation('settings');
  const qc = useQueryClient();
  const toast = useToast();
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
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
      Object.values(data).flat().forEach((s) => {
        flat[s.key] = String(s.value ?? '');
      });
      setFormValues(flat);
    }
  }

  const updateMutation = useMutation({
    mutationFn: (values: Record<string, string>) => {
      const settings = Object.entries(values).map(([key, value]) => ({ key, value }));
      return api.put('/settings', { settings });
    },
    onSuccess: (res) => {
      // Shared ['settings'] cache — other-settings/website reads the same key.
      qc.invalidateQueries({ queryKey: ['settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast.success((res as { data?: { message?: string } })?.data?.message ?? savedMsg());
    },
    onError: (e) => {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? failedMsg());
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formValues);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 h-32 animate-pulse" />)}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {data && Object.entries(data).map(([group, items]) => (
        <div key={group} className="bg-white rounded-xl border border-slate-200">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-700 capitalize">
              {t(`website.groups.${group}`, { defaultValue: t(`general.groups.${group}`, { defaultValue: group }) })} {t('general.group_suffix')}
            </h2>
          </div>
          <div className="p-4 sm:p-6 space-y-5">
            {items.filter(s => !OWN_PAGE_SETTINGS.has(s.key)).map((setting) => (
              <div key={setting.key}>
                <SettingLabel settingKey={setting.key} description={setting.description} />
                {setting.type === 'boolean' ? (
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={setting.key}
                      checked={formValues[setting.key] === 'true'}
                      onChange={(e) => setFormValues(f => ({ ...f, [setting.key]: e.target.checked ? 'true' : 'false' }))}
                      className="w-4 h-4 rounded"
                    />
                    <label htmlFor={setting.key} className="text-sm text-slate-600">
                      {formValues[setting.key] === 'true' ? t('general.enabled') : t('general.disabled')}
                    </label>
                  </div>
                ) : setting.type === 'number' ? (
                  <NumericInput
                    value={formValues[setting.key] ?? ''}
                    onChange={(e) => setFormValues(f => ({ ...f, [setting.key]: e.target.value }))}
                    className="w-full max-w-xs border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <input
                    type="text"
                    value={formValues[setting.key] ?? ''}
                    onChange={(e) => setFormValues(f => ({ ...f, [setting.key]: e.target.value }))}
                    className="w-full max-w-md border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg disabled:opacity-60 transition-colors"
        >
          {saved ? <Check size={16} /> : <Save size={16} />}
          {saved ? t('general.saved') : updateMutation.isPending ? t('general.saving') : t('general.save')}
        </button>
        {updateMutation.isError && <p className="text-sm text-red-600">{t('general.failed_save')}</p>}
      </div>
    </form>
  );
}
