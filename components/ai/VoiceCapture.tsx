'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, Square, Loader2 } from 'lucide-react';
import { toWav16k } from '@/lib/wav';

/** Longest recording; the API refuses bigger files anyway. */
const MAX_SECONDS = 120;

const SPEECH_LANG: Record<string, string> = { bn: 'bn-BD', en: 'en-US', ar: 'ar-SA' };

interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Whether the mic can be offered: the AI hears recordings, or the browser can dictate. */
export function voiceMode(audio: 'inline' | 'transcribe' | null): 'record' | 'dictate' | null {
  if (audio && typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof MediaRecorder !== 'undefined') return 'record';
  return recognitionCtor() ? 'dictate' : null;
}

/**
 * The big mic button. "record" sends the recording to the AI service (Gemini,
 * OpenAI); "dictate" lets the browser write down the words (for Claude, which
 * cannot hear audio) and hands back the text.
 */
export default function VoiceCapture({ mode, disabled, onRecorded, onText, onError }: {
  mode: 'record' | 'dictate';
  disabled?: boolean;
  onRecorded: (wav: Blob) => void;
  onText: (text: string) => void;
  onError: (message: string) => void;
}) {
  const { t, i18n } = useTranslation('ai');
  const [state, setState] = useState<'idle' | 'listening' | 'processing'>('idle');
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };
  useEffect(() => () => { stopTimer(); recorder.current?.stream.getTracks().forEach(tr => tr.stop()); recognition.current?.stop(); }, []);

  const startRecording = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      onError(t('voice.mic_blocked'));
      return;
    }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = async () => {
      stream.getTracks().forEach(tr => tr.stop());
      stopTimer();
      setState('processing');
      try {
        onRecorded(await toWav16k(new Blob(chunks, { type: rec.mimeType })));
      } catch {
        onError(t('voice.record_failed'));
      } finally {
        setState('idle');
      }
    };
    recorder.current = rec;
    rec.start();
    setSeconds(0);
    setState('listening');
    timer.current = setInterval(() => setSeconds(s => {
      if (s + 1 >= MAX_SECONDS && rec.state === 'recording') rec.stop();
      return s + 1;
    }), 1000);
  };

  const startDictation = () => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = SPEECH_LANG[i18n.language] ?? 'bn-BD';
    r.continuous = true;
    r.interimResults = false;
    r.onresult = e => {
      let said = '';
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) said += e.results[i][0].transcript;
      if (said.trim()) onText(said.trim());
    };
    r.onerror = e => { if (e.error !== 'no-speech' && e.error !== 'aborted') onError(e.error === 'not-allowed' ? t('voice.mic_blocked') : t('voice.dictation_failed')); };
    r.onend = () => { stopTimer(); setState('idle'); };
    recognition.current = r;
    r.start();
    setSeconds(0);
    setState('listening');
    timer.current = setInterval(() => setSeconds(s => s + 1), 1000);
  };

  const toggle = () => {
    if (state === 'listening') {
      if (mode === 'record') { if (recorder.current?.state === 'recording') recorder.current.stop(); }
      else recognition.current?.stop();
      return;
    }
    if (mode === 'record') startRecording(); else startDictation();
  };

  const listening = state === 'listening';
  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <button type="button" onClick={toggle} disabled={disabled || state === 'processing'}
        aria-label={listening ? t('voice.stop') : t('voice.start')} aria-pressed={listening}
        className={`relative grid place-items-center w-20 h-20 rounded-full text-white shadow-lg transition-colors disabled:opacity-50 ${listening ? 'bg-rose-500 hover:bg-rose-600' : 'bg-violet-600 hover:bg-violet-700'}`}>
        {listening && <span className="absolute inset-0 rounded-full bg-rose-400/60 animate-ping" aria-hidden />}
        <span className="relative">
          {state === 'processing' ? <Loader2 size={30} className="animate-spin" /> : listening ? <Square size={26} fill="currentColor" /> : <Mic size={32} />}
        </span>
      </button>
      <p className="text-xs text-slate-500 h-4" aria-live="polite">
        {listening ? `${t(mode === 'record' ? 'voice.recording' : 'voice.dictating')} ${mmss}` : state === 'processing' ? t('voice.processing') : t('voice.tap_to_speak')}
      </p>
    </div>
  );
}
