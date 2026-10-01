'use client';

import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation('common');
  if (!open) return null;

  return (
    <div role="alertdialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto border border-slate-100">
        {/* Header */}
        <div className="flex items-start gap-4 p-6 pb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="font-semibold text-slate-800 text-base">{title ?? t('confirm.title')}</h3>
            <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{message}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            aria-label={t('ui.close')}
            className="flex-shrink-0 -mt-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-40 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm font-medium border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {cancelLabel ?? t('btn.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-xl disabled:opacity-60 transition-colors"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? t('confirm.working') : (confirmLabel ?? t('btn.delete'))}
          </button>
        </div>
      </div>
    </div>
  );
}
