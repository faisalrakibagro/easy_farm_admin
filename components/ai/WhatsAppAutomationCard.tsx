'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bot, AlertTriangle, UserPlus, CheckCircle2, MinusCircle, Mic } from 'lucide-react';
import api from '@/lib/api';
import { aiError } from '@/lib/ai';
import Link from '@/components/ui/AppLink';
import Card from '@/components/ui/SettingsCard';
import Toggle from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';

interface Automation {
  enabled: boolean;
  ai_ready: boolean;
  whatsapp_ready: boolean;
  hears_voice: boolean;
  users: { id: number; name: string; phone: string; can_enter: boolean; can_ask: boolean }[];
}

function Can({ yes, label }: { yes: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${yes ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400 line-through'}`}>
      {yes ? <CheckCircle2 size={11} /> : <MinusCircle size={11} />} {label}
    </span>
  );
}

/**
 * The WhatsApp automation, on the WhatsApp page next to the alerts: people
 * with their WhatsApp number on their user profile write or send a voice
 * note; entries are read back and saved after "yes", questions answered.
 * The switch saves at once.
 */
export default function WhatsAppAutomationCard() {
  const { t } = useTranslation('ai');
  const toast = useToast();
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('settings.edit');
  const [saving, setSaving] = useState(false);

  const { data } = useQuery<Automation>({
    queryKey: ['ai-automation'],
    queryFn: async () => (await api.get('/ai/automation')).data,
  });

  const toggle = async (on: boolean) => {
    setSaving(true);
    try {
      const res = await api.put('/ai/automation', { enabled: on });
      toast.success(res.data.message);
      qc.setQueryData(['ai-automation'], res.data);
      qc.invalidateQueries({ queryKey: ['ai-status'] });
    } catch (err) {
      toast.error(aiError(err, t('assistant.error')));
    } finally { setSaving(false); }
  };

  if (!data) return <div className="h-40 rounded-2xl bg-slate-100 animate-pulse" />;

  return (
    <Card title={t('automation.title')} icon={Bot} hint={t('automation.hint')}
      action={<div className="flex items-center gap-2 text-xs text-slate-600">{t(data.enabled ? 'automation.on' : 'automation.off_short')}
        <Toggle on={data.enabled} onChange={toggle} disabled={!canEdit || saving} label={t('automation.title')} /></div>}>
      <div className="space-y-4">
        {!data.ai_ready && (
          <p className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{t('automation.ai_missing')} <Link href="/other-settings/ai" className="font-medium underline">{t('off.go_settings')}</Link></span>
          </p>
        )}
        {!data.whatsapp_ready && (
          <p className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {t('automation.whatsapp_missing')}
          </p>
        )}

        <ol className="list-decimal ps-5 space-y-1.5 text-xs text-slate-600">
          <li>{t('automation.step1')}</li>
          <li>{t('automation.step2')}</li>
          <li>{t('automation.step3')}</li>
        </ol>

        <p className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${data.hears_voice ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-600'}`}>
          <Mic size={14} className="mt-0.5 shrink-0" /> {t(data.hears_voice ? 'automation.voice_yes' : 'automation.voice_no')}
        </p>

        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-semibold text-slate-700">{t('automation.users', { count: data.users.length })}</p>
            <Link href="/users" className="flex items-center gap-1 text-xs text-emerald-700 hover:underline"><UserPlus size={13} /> {t('automation.add_number')}</Link>
          </div>
          {data.users.length === 0 ? (
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">{t('automation.no_users')}</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {data.users.map(u => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block text-sm text-slate-800">{u.name}</span>
                    <span className="block text-[11px] text-slate-500" dir="ltr">+{u.phone}</span>
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    <Can yes={u.can_enter} label={t('automation.can_enter')} />
                    <Can yes={u.can_ask} label={t('automation.can_ask')} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-[11px] text-slate-400">{t('automation.free_note')}</p>
      </div>
    </Card>
  );
}
