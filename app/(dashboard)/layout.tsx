'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';
import AuthGuard from '@/components/AuthGuard';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';

// The sidebar is a fixed column from lg up and a drawer below it.
const DESKTOP = '(min-width: 1024px)';
const subscribeDesktop = (cb: () => void) => {
  const mq = window.matchMedia(DESKTOP);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};

/**
 * The header title. A page without its own (a record's detail page, a trash
 * page) takes the nearest parent's: /customers/7 → Customers. On a phone the
 * title is the only sign of where you are.
 */
function pageTitle(pathname: string, lookup: (path: string) => string | null): string | null {
  for (let p = pathname.replace(/\/$/, ''); p; p = p.slice(0, p.lastIndexOf('/'))) {
    const found = lookup(p);
    if (found) return found;
  }
  return null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { t, i18n } = useTranslation('layout');
  const isDesktop = useSyncExternalStore(subscribeDesktop, () => window.matchMedia(DESKTOP).matches, () => true);
  // The drawer hides off the reading side: left in LTR, right in Arabic.
  const hiddenDrawer = i18n.dir() === 'rtl' ? 'translate-x-full' : '-translate-x-full';
  const title = pageTitle(pathname, key => (i18n.exists(`layout:page_titles.${key}`) ? t(`page_titles.${key}`) : null)) ?? t('fallback_title');

  // Esc closes the open drawer.
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sidebarOpen]);

  return (
    <AuthGuard>
      {/* h-dvh, not h-screen: on a phone 100vh reaches under the browser's
          toolbar and hides the bottom of every page. The side padding keeps
          content clear of the notch when the phone is turned sideways
          (safe-area insets are physical, so pl/pr rather than ps/pe). */}
      <div className="app-bg flex h-dvh overflow-hidden pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar. A closed drawer is inert, so its links can't be tabbed to off-screen. */}
        <aside
          inert={!sidebarOpen && !isDesktop}
          className={`fixed lg:static inset-y-0 start-0 z-50 w-[17rem] flex-shrink-0 shadow-2xl shadow-black/30 lg:shadow-none transition-transform duration-300 ease-out lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : hiddenDrawer
          }`}
        >
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header onMenuToggle={() => setSidebarOpen(true)} title={title} />
          {/* Phones: the bottom bar below takes the home-indicator area. */}
          <main className="flex-1 overflow-y-auto p-4 md:pb-[calc(1rem+env(safe-area-inset-bottom))] lg:p-7">
            {children}
          </main>
          <MobileNav onMenu={() => setSidebarOpen(true)} />
        </div>
      </div>
    </AuthGuard>
  );
}
