'use client';

import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScanLine, Sparkles, Paperclip, X } from 'lucide-react';
import api from '@/lib/api';
import { useAiStatus, aiError, type ReceiptScan as Scan } from '@/lib/ai';
import { isMonthlyByDefault } from './RecurringToggle';
import type { ExpForm } from './types';

/**
 * "Fill from receipt photo" at the top of the new-expense form: the photo (or
 * PDF) is read by AI and the form is filled in as a draft — the user checks
 * every field and saves it as usual. The receipt is attached to the expense.
 * Hidden while receipt reading is switched off.
 */
export default function ReceiptScan({ setForm }: { setForm: (updater: (f: ExpForm) => ExpForm) => void }) {
  const { t } = useTranslation('ai');
  const { data: status } = useAiStatus();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [scan, setScan] = useState<Scan | null>(null);

  if (!status?.receipt_scan) return null;

  const read = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await api.post<Scan>('/ai/receipt-scan', body, { headers: { 'Content-Type': 'multipart/form-data' } });
      const { draft, receipt_file } = res.data;
      const lines = draft.items.map(i => `${i.name}${i.quantity ? ` (${i.quantity})` : ''}${i.amount != null ? ` — ৳${i.amount}` : ''}`).join('\n');
      setForm(f => ({
        ...f,
        category: draft.category,
        is_recurring: isMonthlyByDefault(draft.category),
        labour_employee_id: '', daily_labour_id: '',
        title: draft.title ?? f.title,
        amount: draft.total_amount != null ? String(draft.total_amount) : f.amount,
        expense_date: draft.date ?? f.expense_date,
        vendor_name: draft.vendor_name ?? '',
        invoice_no: draft.invoice_no ?? '',
        receipt_file,
        description: f.description || lines,
      }));
      setScan(res.data);
    } catch (err) {
      setError(aiError(err, t('assistant.error')));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = () => {
    setScan(null);
    setForm(f => ({ ...f, receipt_file: '', vendor_name: '', invoice_no: '' }));
  };

  return (
    <div className="space-y-2">
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) read(f); }} />
      {!scan && (
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
          className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-violet-300 bg-violet-50/50 px-4 py-3 text-sm font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-60">
          {busy ? <Sparkles size={16} className="animate-pulse" /> : <ScanLine size={16} />}
          {busy ? t('receipt.scanning') : t('receipt.scan')}
          {!busy && <span className="hidden sm:inline text-xs font-normal text-violet-500">· {t('receipt.hint')}</span>}
        </button>
      )}
      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      {scan && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-xs text-slate-700 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <p className="flex items-center gap-1.5 font-medium text-violet-800"><Sparkles size={13} /> {t('receipt.filled')}</p>
            <button type="button" onClick={remove} aria-label={t('receipt.remove')} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
          </div>
          {(scan.draft.vendor_name || scan.draft.invoice_no) && (
            <p className="text-slate-600">
              {scan.draft.vendor_name && <>{t('receipt.vendor')}: <b>{scan.draft.vendor_name}</b></>}
              {scan.draft.vendor_name && scan.draft.invoice_no && ' · '}
              {scan.draft.invoice_no && <>{t('receipt.invoice')}: <b>{scan.draft.invoice_no}</b></>}
            </p>
          )}
          <a href={scan.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-violet-700 hover:underline">
            <Paperclip size={12} /> {t('receipt.view_file')}
          </a>
        </div>
      )}
    </div>
  );
}
