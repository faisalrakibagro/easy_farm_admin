'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Send, RotateCcw } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useAiStatus, aiError, type ChatTurn } from '@/lib/ai';
import ChatBubble from '@/components/ai/ChatBubble';
import AiOffNotice from '@/components/ai/AiOffNotice';

const SUGGESTIONS = ['s1', 's2', 's3', 's4', 's5', 's6'];
/** Turns sent back with each question: enough context, bounded cost. */
const HISTORY = 12;

function loadChat(key: string): ChatTurn[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { return []; }
}

/**
 * Farm assistant: questions in plain words, answered by Claude from the farm's
 * records (read-only, the user's own permissions). The chat is kept in this
 * browser only.
 */
export default function AssistantPage() {
  const { t } = useTranslation('ai');
  const { user } = useAuth();
  const { data: status, isLoading: statusLoading } = useAiStatus();
  const storageKey = `farmAiChat:${user?.id ?? 'me'}`;

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [loadedKey, setLoadedKey] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Restore this user's chat once they are known.
  if (user && loadedKey !== storageKey) {
    setLoadedKey(storageKey);
    setTurns(loadChat(storageKey));
  }
  useEffect(() => {
    if (!loadedKey) return;
    try { localStorage.setItem(loadedKey, JSON.stringify(turns.slice(-40))); } catch { /* storage blocked */ }
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, loadedKey]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const next: ChatTurn[] = [...turns, { role: 'user', content: q }];
    setTurns(next);
    setText('');
    setBusy(true);
    try {
      const messages = next.filter(m => !m.error).slice(-HISTORY).map(({ role, content }) => ({ role, content }));
      // The history must start with a question.
      while (messages.length && messages[0].role !== 'user') messages.shift();
      const res = await api.post('/ai/assistant', { messages });
      setTurns(cur => [...cur, { role: 'assistant', content: res.data.reply, tools: res.data.tools }]);
    } catch (err) {
      setTurns(cur => [...cur, { role: 'assistant', content: aiError(err, t('assistant.error')), error: true }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  if (statusLoading) return <div className="h-96 rounded-2xl bg-slate-100 animate-pulse" />;
  if (!status?.assistant) return <AiOffNotice />;

  return (
    <div className="flex flex-col h-[calc(100dvh-8.5rem)] max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="grid place-items-center w-10 h-10 rounded-xl text-white bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] shrink-0"><Sparkles size={19} /></span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-800">{t('assistant.title')}</h1>
            <p className="text-xs text-slate-500 truncate">{t('assistant.subtitle')}</p>
          </div>
        </div>
        {turns.length > 0 && (
          <button type="button" onClick={() => setTurns([])} disabled={busy}
            aria-label={t('assistant.clear')} title={t('assistant.clear')}
            className="flex items-center justify-center gap-1.5 min-w-10 min-h-10 sm:min-h-0 text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 shrink-0">
            <RotateCcw size={14} /> <span className="hidden sm:inline">{t('assistant.clear')}</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-4" aria-live="polite">
        {turns.length === 0 ? (
          <div className="min-h-full flex flex-col items-center justify-center text-center gap-4 py-6">
            <div>
              <h2 className="font-semibold text-slate-800">{t('assistant.empty_title')}</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-md">{t('assistant.empty_hint')}</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 w-full max-w-2xl">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => ask(t(`assistant.suggestions.${s}`))}
                  className="text-start text-sm px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:border-violet-300 hover:bg-violet-50/50 transition-colors">
                  {t(`assistant.suggestions.${s}`)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((turn, i) => <ChatBubble key={i} turn={turn} />)
        )}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-slate-500 ps-10">
            <span className="flex gap-1">
              {[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />)}
            </span>
            {t('assistant.thinking')}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={e => { e.preventDefault(); ask(text); }} className="pt-3">
        <div className="flex items-end gap-2 bg-white border border-slate-300 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-violet-400">
          <textarea ref={inputRef} rows={1} value={text} maxLength={4000}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); ask(text); } }}
            placeholder={t('assistant.placeholder')} aria-label={t('assistant.placeholder')}
            className="flex-1 resize-none max-h-40 px-2 py-1.5 text-sm bg-transparent focus:outline-none field-sizing-content" />
          <button type="submit" disabled={busy || !text.trim()} aria-label={t('assistant.send')}
            className="grid place-items-center w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-40 shrink-0">
            <Send size={16} className="rtl:-scale-x-100" />
          </button>
        </div>
        <p className="text-[11px] text-slate-400 text-center mt-1.5">{t('assistant.disclaimer')}</p>
      </form>
    </div>
  );
}
