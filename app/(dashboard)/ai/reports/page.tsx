'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FileText, Sparkles, Copy, MessageCircle } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import PageTitle from '@/components/ui/PageTitle';
import RichText from '@/components/ai/RichText';
import AiOffNotice from '@/components/ai/AiOffNotice';
import { useAiStatus, aiError, type AiReport } from '@/lib/ai';
import { localeFor } from '@/lib/languages';
import { localDateStr } from '@/lib/dates';

function lastMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** The monthly AI reports: read past ones, or write one for a chosen month. */
export default function AiReportsPage() {
  const { t } = useTranslation('ai');
  const toast = useToast();
  const qc = useQueryClient();
  const { data: status, isLoading: statusLoading } = useAiStatus();
  const [month, setMonth] = useState(lastMonth);
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery<{ reports: AiReport[] }>({
    queryKey: ['ai-reports'],
    queryFn: async () => (await api.get('/ai/reports')).data,
  });

  const generate = async () => {
    setBusy(true);
    try {
      const res = await api.post('/ai/reports', { month, send_whatsapp: sendWhatsApp });
      toast.success(res.data.message);
      qc.invalidateQueries({ queryKey: ['ai-reports'] });
    } catch (err) {
      toast.error(aiError(err, t('assistant.error')));
    } finally {
      setBusy(false);
    }
  };

  const monthName = (iso: string) => new Date(iso).toLocaleDateString(localeFor(), { month: 'long', year: 'numeric' });
  const copy = (text: string) => { navigator.clipboard?.writeText(text); toast.success(t('reports.copied')); };
  const reports = data?.reports ?? [];

  return (
    <div className="space-y-5 max-w-4xl">
      <PageTitle title={t('reports.title')} subtitle={t('reports.subtitle')} />

      {statusLoading ? null : !status?.monthly_report ? <AiOffNotice /> : (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('reports.month')}</label>
            <input type="month" value={month} max={localDateStr().slice(0, 7)} onChange={e => setMonth(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 py-2">
            <input type="checkbox" checked={sendWhatsApp} onChange={e => setSendWhatsApp(e.target.checked)} className="rounded border-slate-300" />
            <MessageCircle size={14} className="text-emerald-600" /> {t('reports.send_whatsapp')}
          </label>
          <button onClick={generate} disabled={busy || !month}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg disabled:opacity-60">
            <Sparkles size={15} /> {busy ? t('reports.generating') : t('reports.generate')}
          </button>
          <p className="basis-full text-xs text-slate-400">{t('reports.schedule_hint')}</p>
        </div>
      )}

      {isLoading ? (
        <div className="h-48 rounded-2xl bg-slate-100 animate-pulse" />
      ) : reports.length === 0 ? (
        <p className="text-sm text-slate-500 bg-white rounded-2xl border border-slate-200 p-6 text-center">{t('reports.empty')}</p>
      ) : (
        <div className="space-y-4">
          {reports.map(r => (
            <article key={r.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <header className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="grid place-items-center w-8 h-8 rounded-lg bg-violet-50 text-violet-600"><FileText size={16} /></span>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">{monthName(r.period_start)}</h2>
                    <p className="text-[11px] text-slate-400">
                      {new Date(r.created_at).toLocaleString(localeFor())} · {r.creator ? t('reports.by', { name: r.creator.name }) : t('reports.auto')}
                      {r.whatsapp_queued > 0 && <> · {t('reports.whatsapp_sent', { count: r.whatsapp_queued })}</>}
                    </p>
                  </div>
                </div>
                <button onClick={() => copy(r.content)} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                  <Copy size={13} /> {t('reports.copy')}
                </button>
              </header>
              <RichText text={r.content} className="px-5 py-4 text-sm text-slate-700 leading-relaxed" />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
