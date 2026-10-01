'use client';

import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeToggle from '@/components/ThemeToggle';
import { ArrowRight, Beef, Lock, Mail, Milk, PieChart } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const { t } = useTranslation('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // The language lives in this browser's storage, which the server cannot see:
  // drawn on the server the page would be English and then switch, and React
  // would throw the whole page away (hydration mismatch). Draw it in the browser only.
  const inBrowser = useSyncExternalStore(() => () => {}, () => true, () => false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string; errors?: { email?: string[] } } } };
      setError(
        axiosErr.response?.data?.errors?.email?.[0] ||
        axiosErr.response?.data?.message ||
        t('error_fallback')
      );
    } finally {
      setLoading(false);
    }
  };

  if (!inBrowser) return <div className="min-h-dvh app-bg" />;

  return (
    <div className="min-h-dvh app-bg grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 text-white bg-gradient-to-br from-[#0b2a26] via-[#0f1b30] to-[#0a1020]">
        <div className="pointer-events-none absolute -top-32 -start-24 w-[28rem] h-[28rem] rounded-full bg-emerald-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -end-20 w-[30rem] h-[30rem] rounded-full bg-sky-500/15 blur-3xl" />
        <div className="relative flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="w-11 h-11 rounded-xl ring-1 ring-white/20" />
          <span className="text-sm font-semibold tracking-wide text-[#a7f3d0]">{t('hero_badge')}</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-tight">{t('hero_title')}</h2>
          <p className="mt-4 text-[0.95rem] leading-relaxed text-[#cbd5e1]">{t('hero_text')}</p>
          <ul className="mt-8 space-y-3">
            {[
              { icon: <Beef size={17} />, text: t('feature_animals') },
              { icon: <Milk size={17} />, text: t('feature_dairy') },
              { icon: <PieChart size={17} />, text: t('feature_accounts') },
            ].map(f => (
              <li key={f.text} className="flex items-center gap-3 text-sm text-[#e2e8f0]">
                <span className="grid place-items-center w-9 h-9 rounded-xl bg-white/10 ring-1 ring-white/10 text-[#6ee7b7]">{f.icon}</span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-[#94a3b8]">© {t('hero_badge')}</p>
      </div>

      {/* Sign-in form */}
      <div className="relative flex items-center justify-center p-4 pt-20 sm:p-8 sm:pt-20 lg:pt-8">
        <div className="absolute top-[max(1rem,env(safe-area-inset-top))] end-4 flex items-center gap-2">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-slate-900/5 border border-slate-200/80 p-6 sm:p-9">
          <div className="mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="lg:hidden w-14 h-14 rounded-2xl mb-5" />
            <p className="text-sm font-medium text-emerald-600">{t('welcome')}</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-800">{t('title')}</h1>
            <p className="text-slate-500 text-sm mt-1">{t('subtitle')}</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1.5">{t('email_label')}</label>
              <div className="relative">
                <Mail size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded-xl ps-10 pe-3 py-3 sm:py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder={t('email_placeholder')}
                />
              </div>
            </div>
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-1.5">{t('password_label')}</label>
              <div className="relative">
                <Lock size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded-xl ps-10 pe-3 py-3 sm:py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-60 text-white font-semibold py-3 sm:py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-600/20 transition-all text-sm"
            >
              {loading ? t('btn_signing_in') : t('btn_sign_in')}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
