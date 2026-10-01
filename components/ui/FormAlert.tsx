'use client';

/**
 * The message box at the top of a form: a general failure, plus any error the
 * form has no field for. Marked so the form scrolls to it when nothing else is.
 */
export default function FormAlert({ message, extra = [] }: { message?: string; extra?: string[] }) {
  const lines = [message, ...extra].filter((l): l is string => !!l);
  if (!lines.length) return null;
  return (
    <div role="alert" data-form-error="true" className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 space-y-0.5">
      {lines.map((l, i) => <p key={i} className="whitespace-pre-line">{l}</p>)}
    </div>
  );
}
