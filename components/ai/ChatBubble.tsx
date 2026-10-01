'use client';

import { useTranslation } from 'react-i18next';
import { Sparkles, User, AlertTriangle } from 'lucide-react';
import RichText from './RichText';
import type { ChatTurn } from '@/lib/ai';

/** One message in the assistant chat, with the records it looked at. */
export default function ChatBubble({ turn }: { turn: ChatTurn }) {
  const { t } = useTranslation('ai');
  const mine = turn.role === 'user';

  return (
    <div className={`flex gap-2.5 ${mine ? 'flex-row-reverse' : ''}`}>
      <span className={`grid place-items-center w-8 h-8 rounded-full shrink-0 ${mine ? 'bg-emerald-100 text-emerald-700' : turn.error ? 'bg-red-100 text-red-600' : 'bg-violet-100 text-violet-700'}`}
        aria-label={mine ? t('assistant.you') : t('assistant.bot')}>
        {mine ? <User size={15} /> : turn.error ? <AlertTriangle size={15} /> : <Sparkles size={15} />}
      </span>
      <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
        mine ? 'bg-emerald-600 text-white rounded-se-sm whitespace-pre-wrap'
          : turn.error ? 'bg-red-50 text-red-700 border border-red-100 rounded-ss-sm'
            : 'bg-white border border-slate-200 text-slate-700 rounded-ss-sm'}`}>
        {mine ? turn.content : <RichText text={turn.content} />}
        {!mine && turn.tools && turn.tools.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
            <span>{t('assistant.looked_at')}</span>
            {turn.tools.map(name => (
              <span key={name} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{t(`tools.${name}`, { defaultValue: name })}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
