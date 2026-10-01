'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, Wand2, Save, RotateCcw, Loader2, Info, CheckCircle2, XCircle, MessageCircleQuestion } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import Link from '@/components/ui/AppLink';
import { useAuth } from '@/contexts/AuthContext';
import { useAiStatus, aiError, type VoiceAction, type VoiceRead, type VoiceSaveResult } from '@/lib/ai';
import AiOffNotice from '@/components/ai/AiOffNotice';
import VoiceCapture, { voiceMode } from '@/components/ai/VoiceCapture';
import DraftCard from '@/components/ai/DraftCard';

const EXAMPLES = ['e1', 'e2', 'e3', 'e4'];

/**
 * Voice entry: say (or type) what happened on the farm, check what the AI
 * understood, then save. Nothing is saved until the person presses Save, and
 * each entry goes through its own form's rules and permissions.
 */
export default function VoiceEntryPage() {
  const { t } = useTranslation('ai');
  const { hasPermission } = useAuth();
  const toast = useToast();
  const { data: status, isLoading } = useAiStatus();

  const [text, setText] = useState('');
  const [reading, setReading] = useState(false);
  const [read, setRead] = useState<VoiceRead | null>(null);
  const [actions, setActions] = useState<VoiceAction[]>([]);
  const [dirty, setDirty] = useState(false);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<VoiceSaveResult[]>([]);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The mic depends on the browser; status only arrives in the browser, so this never runs on the server.
  const mode = status ? voiceMode(status.voice_audio) : null;
  useEffect(() => () => { if (checkTimer.current) clearTimeout(checkTimer.current); }, []);

  const understand = async (payload: { text?: string; audio?: Blob }) => {
    setReading(true);
    setResults([]);
    try {
      let res;
      if (payload.audio) {
        const form = new FormData();
        form.append('audio', payload.audio, 'voice.wav');
        res = await api.post<VoiceRead>('/ai/voice/read', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        res = await api.post<VoiceRead>('/ai/voice/read', { text: payload.text });
      }
      setRead(res.data);
      setActions(res.data.actions);
      setDirty(false);
      if (payload.audio && res.data.transcript) setText(res.data.transcript);
    } catch (err) {
      toast.error(aiError(err, t('assistant.error')));
    } finally {
      setReading(false);
    }
  };

  /** Check edited drafts again (no AI call). */
  const recheck = async (list: VoiceAction[]): Promise<VoiceAction[] | null> => {
    if (!list.length) return list;
    setChecking(true);
    try {
      const res = await api.post<{ actions: VoiceAction[] }>('/ai/voice/check', { actions: list });
      setActions(res.data.actions);
      setDirty(false);
      return res.data.actions;
    } catch (err) {
      toast.error(aiError(err, t('assistant.error')));
      return null;
    } finally {
      setChecking(false);
    }
  };

  const edit = (i: number, next: VoiceAction) => {
    const list = actions.map((a, j) => (j === i ? next : a));
    setActions(list);
    setDirty(true);
    if (checkTimer.current) clearTimeout(checkTimer.current);
    checkTimer.current = setTimeout(() => recheck(list), 700);
  };

  const remove = (i: number) => {
    const list = actions.filter((_, j) => j !== i);
    setActions(list);
    if (dirty) recheck(list);
  };

  const save = async () => {
    if (checkTimer.current) clearTimeout(checkTimer.current);
    const list = dirty ? await recheck(actions) : actions;
    if (!list) return;
    if (list.some(a => a.problems.length)) {
      toast.error(t('voice.fix_first'));
      return;
    }
    setSaving(true);
    try {
      const res = await api.post<{ message: string; results: VoiceSaveResult[] }>('/ai/voice/save', { actions: list });
      done(res.data.results, res.data.message, list);
    } catch (err) {
      const data = (err as { response?: { data?: { message?: string; results?: VoiceSaveResult[] } } }).response?.data;
      if (data?.results) done(data.results, data.message ?? '', list);
      else toast.error(aiError(err, t('assistant.error')));
    } finally {
      setSaving(false);
    }
  };

  /** Saved cards leave the list; the ones that failed stay to be fixed. */
  const done = (res: VoiceSaveResult[], message: string, list: VoiceAction[]) => {
    setResults(res);
    const left = list.filter((_, i) => !res[i]?.ok);
    setActions(left);
    if (!left.length) { setText(''); setRead(null); }
    if (res.every(r => r.ok)) toast.success(message); else toast.error(message);
  };

  const reset = () => { setText(''); setRead(null); setActions([]); setResults([]); setDirty(false); };

  if (isLoading) return <div className="h-96 rounded-2xl bg-slate-100 animate-pulse" />;
  if (!status?.voice_entry) return <AiOffNotice />;

  const busy = reading || saving;
  const blocked = actions.some(a => a.problems.length) && !dirty;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="grid place-items-center w-10 h-10 rounded-xl text-white bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] shrink-0"><Mic size={19} /></span>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-slate-800">{t('voice.title')}</h1>
          <p className="text-xs text-slate-500">{t('voice.subtitle')}</p>
        </div>
      </div>

      {/* Say or type */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        {mode && (
          <VoiceCapture mode={mode} disabled={busy}
            onRecorded={wav => understand({ audio: wav })}
            onText={said => setText(cur => (cur ? `${cur} ${said}` : said))}
            onError={msg => toast.error(msg)} />
        )}
        {!mode && <p className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2"><Info size={14} className="mt-0.5 shrink-0" /> {t('voice.no_mic')}</p>}
        {mode === 'dictate' && <p className="text-[11px] text-slate-400 text-center">{t('voice.dictate_hint')}</p>}

        <form onSubmit={e => { e.preventDefault(); if (text.trim()) understand({ text }); }} className="space-y-2">
          <label htmlFor="voice-text" className="block text-xs font-medium text-slate-600">{t('voice.text_label')}</label>
          <textarea id="voice-text" rows={3} value={text} maxLength={2000} dir="auto" disabled={busy}
            onChange={e => setText(e.target.value)} placeholder={t('voice.placeholder')}
            className="w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={busy || !text.trim()}
              className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-40">
              {reading ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />} {reading ? t('voice.reading') : t('voice.understand')}
            </button>
            {(read || text) && (
              <button type="button" onClick={reset} disabled={busy}
                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                <RotateCcw size={14} /> {t('voice.start_over')}
              </button>
            )}
          </div>
        </form>

        {!read && (
          <div className="border-t border-slate-100 pt-3">
            <p className="text-[11px] font-medium text-slate-500 mb-2">{t('voice.examples_title')}</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map(e => (
                <button key={e} type="button" onClick={() => setText(t(`voice.examples.${e}`))} disabled={busy}
                  className="text-xs px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600 hover:border-violet-300 hover:bg-violet-50/50">
                  {t(`voice.examples.${e}`)}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* What was understood */}
      {read && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800">{t('voice.understood', { count: actions.length })}</h2>
            {checking && <span className="flex items-center gap-1 text-xs text-slate-500"><Loader2 size={12} className="animate-spin" /> {t('voice.checking')}</span>}
          </div>

          {read.unclear && (
            <p className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2"><Info size={14} className="mt-0.5 shrink-0" /> {read.unclear}</p>
          )}
          {read.intent === 'question' && !actions.length && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
              <MessageCircleQuestion size={16} className="text-violet-600" /> {t('voice.is_question')}
              {status.assistant && hasPermission('ai.assistant.use') && (
                <Link href="/ai/assistant" className="font-medium text-violet-700 hover:underline">{t('voice.open_assistant')}</Link>
              )}
            </div>
          )}
          {read.intent === 'other' && !actions.length && !read.unclear && <p className="text-sm text-slate-500">{t('voice.nothing')}</p>}

          <div className="space-y-2.5">
            {actions.map((a, i) => (
              <DraftCard key={i} action={a} disabled={saving} onChange={next => edit(i, next)} onRemove={() => remove(i)} />
            ))}
          </div>

          {actions.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className={`text-xs ${blocked ? 'text-rose-600' : 'text-slate-500'}`}>{blocked ? t('voice.fix_first') : t('voice.save_hint')}</p>
              <button type="button" onClick={save} disabled={saving || checking || blocked}
                className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} {t('voice.save', { count: actions.length })}
              </button>
            </div>
          )}
        </section>
      )}

      {results.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-2">{t('voice.results')}</h2>
          <ul className="space-y-1.5">
            {results.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                {r.ok ? <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" /> : <XCircle size={16} className="text-rose-600 mt-0.5 shrink-0" />}
                <span className="min-w-0">
                  <span className="text-slate-800">{r.summary}</span>
                  {!r.ok && <span className="block text-xs text-rose-700">{r.message}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
