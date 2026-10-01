import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

/** Which AI features are switched on (GET /ai/status). */
export interface AiStatus {
  assistant: boolean;
  receipt_scan: boolean;
  monthly_report: boolean;
  voice_entry: boolean;
  /** How the AI service hears a recording; null = type, or use the browser's dictation. */
  voice_audio: 'inline' | 'transcribe' | null;
  whatsapp_bot: boolean;
  show_in_menu: boolean;
}

export function useAiStatus() {
  return useQuery<AiStatus>({
    queryKey: ['ai-status'],
    queryFn: async () => (await api.get('/ai/status')).data,
    staleTime: 60_000,
  });
}

/** One turn of the assistant chat; `tools` are the records it looked at. */
export interface ChatTurn { role: 'user' | 'assistant'; content: string; tools?: string[]; error?: boolean }

/** What POST /ai/receipt-scan read from a receipt. */
export interface ExpenseDraft {
  vendor_name: string | null;
  invoice_no: string | null;
  date: string | null;
  total_amount: number | null;
  category: string;
  title: string | null;
  items: { name: string; quantity: string | null; amount: number | null }[];
}
export interface ReceiptScan { draft: ExpenseDraft; receipt_file: string; receipt_url: string }

export interface AiReport {
  id: number;
  period_start: string;
  period_end: string;
  language: string;
  content: string;
  model: string;
  whatsapp_queued: number;
  created_at: string;
  creator: { id: number; name: string } | null;
}

export type VoiceKind = 'milk' | 'weight' | 'health' | 'heat' | 'expense';
export type MilkSession = 'morning' | 'noon' | 'evening';
export type HealthStatus = 'sick' | 'critical' | 'recovering' | 'healthy';

/** One draft entry read from what was said (POST /ai/voice/read), checked by the server. */
export interface VoiceAction {
  kind: VoiceKind;
  /** The tag or name as said; editing it clears cattle_id so the server finds the animal again. */
  animal: string | null;
  cattle_id: number | null;
  cattle: { id: number; tag_number: string; name: string | null; type: string | null } | null;
  date: string;
  session?: MilkSession;
  milk_kg?: number | null;
  weight_kg?: number | null;
  health_status?: HealthStatus;
  note?: string | null;
  category?: string;
  amount?: number | null;
  problems: string[];
  summary: string;
}

export interface VoiceRead {
  intent: 'entry' | 'question' | 'other';
  transcript: string;
  actions: VoiceAction[];
  unclear: string | null;
}

export interface VoiceSaveResult { ok: boolean; summary: string; message: string }

/** The API's message for a failed request, or the fallback. */
export function aiError(err: unknown, fallback: string): string {
  const d = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
  return d?.errors ? Object.values(d.errors)[0]?.[0] ?? fallback : d?.message ?? fallback;
}
