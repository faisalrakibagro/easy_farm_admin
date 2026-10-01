'use client';

import { Menu, LogOut, ChevronDown, KeyRound, Eye, EyeOff, Moon, Sun, Languages } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import LanguageSwitcher, { useLanguageChoice } from '@/components/LanguageSwitcher';
import NotificationBell from '@/components/NotificationBell';
import ThemeToggle from '@/components/ThemeToggle';
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { roleLabel } from '@/lib/permissionLabels';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { localeFor, LANGUAGES } from '@/lib/languages';
import { savedMsg } from '@/lib/feedback';
import Modal from '@/components/ui/Modal';
import Field, { fieldId } from '@/components/ui/Field';
import { fieldClass, btnPrimary, btnSecondary } from '@/lib/formStyles';
import { setTheme, useTheme } from '@/lib/theme';

interface HeaderProps {
  onMenuToggle?: () => void;
  title?: string;
}

const EMPTY_PW = { current_password: '', password: '', password_confirmation: '' };

export default function Header({ onMenuToggle, title }: HeaderProps) {
  const { user, logout } = useAuth();
  const { t } = useTranslation('common');
  const { i18n } = useTranslation();
  const { t: tl } = useTranslation('layout');
  const theme = useTheme();
  const languages = useLanguageChoice();
  const [now] = useState(() => new Date());
  const today = now.toLocaleDateString(localeFor(i18n.language), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const toast = useToast();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwForm, setPwForm] = useState(EMPTY_PW);
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const changePwMutation = useMutation({
    mutationFn: (data: typeof EMPTY_PW) => api.put('/auth/change-password', data),
    onSuccess: (res) => {
      toast.success((res as { data?: { message?: string } }).data?.message ?? savedMsg());
      setShowPwModal(false);
      setPwForm(EMPTY_PW);
      setPwErrors({});
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const apiErrors = err.response?.data?.errors ?? {};
      const mapped: Record<string, string> = {};
      Object.entries(apiErrors).forEach(([k, v]) => { mapped[k] = v[0]; });
      if (err.response?.data?.message) mapped._global = err.response.data.message;
      setPwErrors(mapped);
    },
  });

  const validatePw = () => {
    const e: Record<string, string> = {};
    if (!pwForm.current_password) e.current_password = t('change_password.validation.current_password_required');
    if (!pwForm.password) e.password = t('change_password.validation.new_password_required');
    else if (pwForm.password.length < 8) e.password = t('change_password.validation.min_length');
    if (pwForm.password !== pwForm.password_confirmation) e.password_confirmation = t('change_password.validation.mismatch');
    setPwErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePwSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePw()) return;
    changePwMutation.mutate(pwForm);
  };

  const openPwModal = () => {
    setDropdownOpen(false);
    setPwForm(EMPTY_PW);
    setPwErrors({});
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setShowPwModal(true);
  };

  const pwDirty = Object.values(pwForm).some(v => v !== '');

  // One password box with a show/hide eye; the three fields differ only in these.
  const pwFields = [
    { name: 'current_password' as const, label: t('change_password.current_password_label'), auto: 'current-password', shown: showCurrent, toggle: () => setShowCurrent(v => !v) },
    { name: 'password' as const, label: t('change_password.new_password_label'), auto: 'new-password', shown: showNew, toggle: () => setShowNew(v => !v) },
    { name: 'password_confirmation' as const, label: t('field.confirm_password'), auto: 'new-password', shown: showConfirm, toggle: () => setShowConfirm(v => !v) },
  ];

  return (
    <>
      {/* The top padding keeps the bar clear of the status bar in the installed iOS app. */}
      <header className="sticky top-0 z-30 h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] shrink-0 bg-white/80 backdrop-blur-xl border-b border-slate-200/80 flex items-center justify-between gap-3 px-4 lg:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onMenuToggle} className="lg:hidden shrink-0 grid place-items-center w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label={t('ui.menu')}>
            <Menu size={18} />
          </button>
          <div className="min-w-0">
            {title && <h1 className="text-[1.05rem] font-semibold text-slate-800 leading-tight truncate">{title}</h1>}
            <p className="text-[0.72rem] text-slate-400 leading-tight hidden sm:block" suppressHydrationWarning>{today}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Phones keep the bar for the page title and the alerts: theme and
              language move into the account menu. (The language menu stays
              mounted: it also applies the farm's default language.) */}
          <div className="hidden sm:block"><ThemeToggle /></div>
          <div className="hidden sm:block"><LanguageSwitcher /></div>
          <NotificationBell />
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              aria-label={t('ui.account_menu')}
              aria-haspopup="menu"
              aria-expanded={dropdownOpen}
              className="flex items-center gap-2 rounded-xl ps-1 pe-1 sm:pe-2 py-1 border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <div className="grid place-items-center w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white text-xs font-bold shadow-md shadow-emerald-500/20">
                {user?.name?.[0]?.toUpperCase() ?? 'U'}
              </div>
              <span className="hidden sm:block text-start leading-tight">
                <span className="block text-sm font-medium text-slate-700 max-w-[10rem] truncate">{user?.name}</span>
                <span className="block text-[0.7rem] text-slate-400 max-w-[10rem] truncate">{user?.roles?.[0] ? roleLabel(user.roles[0], t) : ''}</span>
              </span>
              <ChevronDown size={14} className={`text-slate-400 hidden sm:block transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div role="menu" className="absolute end-0 mt-2 w-64 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200 p-1.5 z-50">
                <div className="flex items-center gap-3 px-2.5 py-2.5 mb-1 rounded-xl bg-slate-50">
                  <div className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white text-sm font-bold">
                    {user?.name?.[0]?.toUpperCase() ?? 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{user?.name}</p>
                    <p className="text-xs text-slate-400 truncate">{user?.email ?? (user?.roles?.[0] ? roleLabel(user.roles[0], t) : '')}</p>
                  </div>
                </div>
                {languages.enabled.length > 1 && (
                  <div className="sm:hidden px-2.5 pt-1 pb-2">
                    <p className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5"><Languages size={13} />{tl('mobile_nav.language')}</p>
                    <div className="flex gap-1.5">
                      {languages.enabled.map(code => (
                        <button key={code} type="button" role="menuitemradio" aria-checked={code === languages.current}
                          onClick={() => { languages.choose(code); setDropdownOpen(false); }}
                          dir={LANGUAGES[code].rtl ? 'rtl' : 'ltr'}
                          className={`flex-1 rounded-lg px-2 py-2.5 text-sm ${code === languages.current ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                          {LANGUAGES[code].name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  role="menuitem"
                  onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); setDropdownOpen(false); }}
                  className="sm:hidden w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  {theme === 'dark' ? <Sun size={15} className="text-amber-500" /> : <Moon size={15} />}
                  {theme === 'dark' ? tl('theme.to_light') : tl('theme.to_dark')}
                </button>
                <button
                  role="menuitem"
                  onClick={openPwModal}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2.5 sm:py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <KeyRound size={15} />
                  {t('change_password.title')}
                </button>
                <button
                  role="menuitem"
                  onClick={() => { setDropdownOpen(false); logout(); }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2.5 sm:py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={15} />
                  {t('btn.sign_out')}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Change Password Modal */}
      <Modal
        open={showPwModal}
        onClose={() => setShowPwModal(false)}
        dirty={pwDirty}
        size="md"
        title={t('change_password.title')}
        icon={<KeyRound size={18} className="text-blue-500" />}
        footer={<>
          <button type="button" onClick={() => setShowPwModal(false)} className={btnSecondary}>
            {t('btn.cancel')}
          </button>
          <button type="submit" form="change-password-form" disabled={changePwMutation.isPending} className={btnPrimary}>
            {changePwMutation.isPending ? t('change_password.saving') : t('change_password.submit')}
          </button>
        </>}
      >
        <form id="change-password-form" onSubmit={handlePwSubmit} className="px-4 sm:px-6 py-4 space-y-4">
          {pwErrors._global && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{pwErrors._global}</p>
          )}

          {pwFields.map(f => (
            <Field key={f.name} name={f.name} label={f.label} required error={pwErrors[f.name] || undefined}>
              <div className="relative">
                <input
                  id={fieldId(f.name)}
                  type={f.shown ? 'text' : 'password'} autoComplete={f.auto}
                  value={pwForm[f.name]}
                  onChange={e => { setPwForm(p => ({ ...p, [f.name]: e.target.value })); setPwErrors(p => ({ ...p, [f.name]: '' })); }}
                  className={fieldClass(pwErrors[f.name], 'pe-11')}
                />
                <button type="button" onClick={f.toggle}
                  aria-label={f.shown ? t('ui.hide_password') : t('ui.show_password')}
                  className="absolute end-0 inset-y-0 grid place-items-center w-11 text-slate-400 hover:text-slate-600">
                  {f.shown ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
          ))}
        </form>
      </Modal>
    </>
  );
}
