'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastApi {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const CONFIG: Record<
  ToastType,
  { Icon: typeof CheckCircle2; border: string; iconColor: string; bar: string; bg: string }
> = {
  success: {
    Icon: CheckCircle2,
    border: 'border-s-green-500',
    iconColor: 'text-green-500',
    bar: 'bg-green-500',
    bg: 'bg-green-50',
  },
  error: {
    Icon: XCircle,
    border: 'border-s-red-500',
    iconColor: 'text-red-500',
    bar: 'bg-red-500',
    bg: 'bg-red-50',
  },
  warning: {
    Icon: AlertTriangle,
    border: 'border-s-amber-500',
    iconColor: 'text-amber-500',
    bar: 'bg-amber-500',
    bg: 'bg-amber-50',
  },
  info: {
    Icon: Info,
    border: 'border-s-blue-500',
    iconColor: 'text-blue-500',
    bar: 'bg-blue-500',
    bg: 'bg-blue-50',
  },
};

let _counter = 0;

function ToastCard({
  toast,
  onRemove,
}: {
  toast: ToastItem;
  onRemove: (id: number) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const { Icon, border, iconColor, bar } = CONFIG[toast.type];
  const { t } = useTranslation('common');

  useEffect(() => {
    const enterTimer = setTimeout(() => setVisible(true), 10);

    const startTime = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const pct = Math.max(0, 100 - ((now - startTime) / toast.duration) * 100);
      setProgress(pct);
      if (pct > 0) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const dismissTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(toast.id), 300);
    }, toast.duration);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(dismissTimer);
      cancelAnimationFrame(raf);
    };
  }, [toast.id, toast.duration, onRemove]);

  const dismiss = () => {
    setVisible(false);
    setTimeout(() => onRemove(toast.id), 300);
  };

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      className={`transform transition-all duration-300 ease-out ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-10 rtl:-translate-x-10 opacity-0'
      }`}
    >
      <div
        className={`relative flex items-start gap-3 bg-white shadow-lg rounded-xl border border-slate-100 border-s-4 ${border} ps-4 pe-2 pt-3.5 pb-5 w-full sm:w-[320px]`}
      >
        <Icon size={18} className={`mt-0.5 flex-shrink-0 ${iconColor}`} />
        <p className="flex-1 text-sm text-slate-700 leading-snug font-medium">
          {toast.message}
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('ui.dismiss')}
          className="flex-shrink-0 -my-2 grid place-items-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={15} />
        </button>
        {/* Progress bar */}
        <div className="absolute bottom-0 start-0 end-0 h-[3px] rounded-b-xl overflow-hidden bg-slate-100">
          <div
            className={`h-full ${bar} transition-none`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const add = useCallback(
    (type: ToastType, message: string, duration = 4000) => {
      const id = ++_counter;
      setToasts(prev => [...prev, { id, type, message, duration }]);
    },
    [],
  );

  // Stable, so effects that depend on the toast API don't re-run on every toast.
  const api = useMemo<ToastApi>(() => ({
    success: (msg, dur) => add('success', msg, dur),
    error: (msg, dur) => add('error', msg, dur),
    warning: (msg, dur) => add('warning', msg, dur),
    info: (msg, dur) => add('info', msg, dur),
  }), [add]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Phones: full width under the status bar; larger screens: top corner. */}
      <div aria-live="polite" className="fixed top-[max(1rem,env(safe-area-inset-top))] inset-x-3 sm:inset-x-auto sm:end-4 z-[9999] flex flex-col gap-2">
        {toasts.map(t => (
          <ToastCard key={t.id} toast={t} onRemove={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
