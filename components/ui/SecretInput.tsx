'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
}

/**
 * An API key, token or secret: hidden with a show/hide eye, and kept away from
 * the browser's password manager. A plain password field makes Chrome treat
 * the page as a login form — it fills the saved login password into the key
 * field and the email into the text box before it (the side-menu search).
 */
export default function SecretInput({ value, onChange, className, ...props }: Props) {
  const { t } = useTranslation('common');
  const [shown, setShown] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete="new-password"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        dir="ltr"
        data-1p-ignore
        data-lpignore="true"
        data-form-type="other"
        className={`${className ?? ''} pe-10 font-mono`}
      />
      <button type="button" onClick={() => setShown(s => !s)} tabIndex={-1}
        aria-label={shown ? t('ui.hide') : t('ui.show')}
        className="absolute inset-y-0 end-0 grid place-items-center w-9 text-slate-400 hover:text-slate-600">
        {shown ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}
