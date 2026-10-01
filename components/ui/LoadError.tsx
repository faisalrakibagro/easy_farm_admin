'use client';

import { RefreshCw, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface LoadErrorProps {
  /** Re-runs the failed request (usually the query's `refetch`). */
  onRetry?: () => void;
  /** A retry is already running. */
  retrying?: boolean;
  /** Overrides the default "couldn't be loaded" line. */
  message?: string;
  className?: string;
}

/**
 * Shown where a list or card would be when its request failed, so a farm on a
 * weak connection sees "couldn't load — try again" instead of an empty list
 * that looks like "no data", or a skeleton that never ends.
 */
export default function LoadError({ onRetry, retrying = false, message, className = '' }: LoadErrorProps) {
  const { t } = useTranslation('common');
  return (
    <div role="alert" className={`flex flex-col items-center justify-center gap-3 px-4 py-8 text-center ${className}`}>
      <span className="grid place-items-center w-11 h-11 rounded-full bg-amber-50 text-amber-600">
        <WifiOff size={20} />
      </span>
      <p className="text-sm text-slate-600 max-w-xs">{message ?? t('error.load_failed_block')}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} disabled={retrying}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 sm:py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          <RefreshCw size={15} className={retrying ? 'animate-spin' : ''} />
          {t('btn.retry')}
        </button>
      )}
    </div>
  );
}
