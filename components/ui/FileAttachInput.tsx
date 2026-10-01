'use client';

import { useRef } from 'react';
import { Upload, FileText, X } from 'lucide-react';

/**
 * Attach one file (an invoice or receipt photo / PDF): a big button, then the
 * file's name with a way to remove it. Phones offer the camera too.
 */
export default function FileAttachInput({ file, onChange, inputRef, accept = '.pdf,.jpg,.jpeg,.png,.webp', labels }: {
  file: File | null;
  onChange: (file: File | null) => void;
  /** The parent's ref, when it clears the input itself after saving. */
  inputRef?: React.RefObject<HTMLInputElement | null>;
  accept?: string;
  labels: { upload: string; change: string; remove: string };
}) {
  const ownRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? ownRef;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => ref.current?.click()}
        className="inline-flex items-center gap-2 px-4 py-2.5 sm:py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700">
        <Upload size={15} /> {file ? labels.change : labels.upload}
      </button>
      {file && (
        <span className="inline-flex items-center gap-2 min-w-0 max-w-full text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg ps-2.5 pe-1 py-1">
          <FileText size={15} className="text-blue-500 shrink-0" />
          <span className="truncate">{file.name}</span>
          <button type="button" aria-label={labels.remove} onClick={() => { onChange(null); if (ref.current) ref.current.value = ''; }}
            className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"><X size={14} /></button>
        </span>
      )}
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={e => onChange(e.target.files?.[0] ?? null)} />
    </div>
  );
}
