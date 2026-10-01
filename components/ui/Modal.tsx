'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

type ModalSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';

const SIZE: Record<ModalSize, string> = {
  xs: 'sm:max-w-xs', sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-lg', xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl', '3xl': 'sm:max-w-3xl', '4xl': 'sm:max-w-4xl', '5xl': 'sm:max-w-5xl',
};

interface ModalProps {
  /** When false, nothing renders. Lets callers drop their own `{open && (...)}` wrapper. */
  open?: boolean;
  /** Called to close — after asking first when `dirty`. */
  onClose: () => void;
  title?: ReactNode;
  /** A line under the title. */
  subtitle?: ReactNode;
  /** An icon badge before the title. */
  icon?: ReactNode;
  size?: ModalSize;
  /** Extra classes for the white panel. */
  className?: string;
  /**
   * Buttons that stay pinned to the bottom (Cancel / Save), visible however
   * long the form is. A submit button here points at its form with `form="id"`.
   */
  footer?: ReactNode;
  /**
   * Something typed and not saved: closing asks first, and leaving the page
   * warns. A form that passes this (true or false) also closes with Esc; one
   * that doesn't track changes keeps Esc switched off, so nothing is lost.
   */
  dirty?: boolean;
  children: ReactNode;
}

/**
 * Shared modal shell for forms.
 *
 * - Phones: fills the screen, header on top, footer pinned to the bottom.
 * - Larger screens: a centred panel; a tall form scrolls the backdrop.
 * - A click on the backdrop never closes it (a half-filled form is never lost).
 *   ✕ (and Esc, for forms that pass `dirty`) close it — after "discard
 *   changes?" when there are unsaved changes.
 */
export default function Modal({
  open = true, onClose, title, subtitle, icon, size = 'lg', className = '', footer, dirty, children,
}: ModalProps) {
  const tracksChanges = dirty !== undefined;
  const { t } = useTranslation('common');
  const [asking, setAsking] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const requestClose = () => (dirty ? setAsking(true) : onClose());

  // Esc closes (or asks), unless something inside (a dropdown) handled it.
  useEffect(() => {
    if (!open || !tracksChanges) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        if (dirty) setAsking(true); else onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, tracksChanges, dirty, onClose]);

  // The page behind does not scroll while the modal is open.
  useEffect(() => {
    if (!open) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = before; };
  }, [open]);

  // Leaving or reloading the page with unsaved changes asks the browser's question.
  useEffect(() => {
    if (!open || !dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [open, dirty]);

  // With a mouse, start in the field marked data-autofocus; on touch the keyboard would jump up, so not there.
  useEffect(() => {
    if (!open || !window.matchMedia('(pointer: fine)').matches) return;
    bodyRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, [open]);

  if (!open) return null;

  return (
    // The padding sits on the inner box: on the scrolling one it would leave a
    // strip above the pinned header where the form shows through.
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/50">
      <div className="flex min-h-full items-stretch sm:items-start justify-center sm:px-4">
        <div role="dialog" aria-modal="true"
          className={`flex w-full flex-col bg-white shadow-xl min-h-dvh sm:min-h-0 sm:my-8 sm:rounded-2xl ${SIZE[size]} ${className}`}>
          {title !== undefined && (
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-100 bg-white px-4 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 sm:py-4 sm:rounded-t-2xl">
              <div className="flex items-center gap-3 min-w-0">
                {icon}
                <div className="min-w-0">
                  <h2 className="font-semibold text-slate-800">{title}</h2>
                  {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
                </div>
              </div>
              <button type="button" onClick={requestClose} aria-label={t('ui.close')}
                className="shrink-0 -m-2 p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
          )}

          <div ref={bodyRef} className="flex-1">{children}</div>

          {footer && (
            <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-white px-4 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:rounded-b-2xl [&>button]:flex-1 sm:[&>button]:flex-none">
              {footer}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog open={asking}
        title={t('form.discard_title')} message={t('form.discard_message')}
        confirmLabel={t('form.discard')} cancelLabel={t('form.keep_editing')}
        onConfirm={() => { setAsking(false); onClose(); }} onCancel={() => setAsking(false)} />
    </div>
  );
}
