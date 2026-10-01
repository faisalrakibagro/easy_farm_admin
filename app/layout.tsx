import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { QueryClientWrapper } from '@/components/QueryClientWrapper';
import I18nProvider from '@/components/I18nProvider';
import { ToastProvider } from '@/components/ui/Toast';
import QueryErrorNotifier from '@/components/QueryErrorNotifier';
import ErrorBoundary from '@/components/ErrorBoundary';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';
import ThemeSync from '@/components/ThemeSync';
import { THEME_INIT_SCRIPT } from '@/lib/theme-script';
import { FONTS_INIT_SCRIPT } from '@/lib/fonts';
import FontSync from '@/components/FontSync';

export const metadata: Metadata = {
  title: 'Easy Farm Admin Panel',
  description: 'Easy Farm management admin panel',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Easy Farm',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#0F1729',
  width: 'device-width',
  initialScale: 1,
  // The installed iOS app draws under the translucent status bar; the header,
  // drawer and modals pad themselves with env(safe-area-inset-*) to stay clear.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        {/* Applies the saved light / dark theme before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Re-applies the fonts chosen in Settings → Languages before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: FONTS_INIT_SCRIPT }} />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/config.js" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* No Hind Siliguri 500: its ১ glyph is broken (renders as a sliver), so
            medium Bengali text falls back to 400. Inter keeps 500. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" />
      </head>
      <body className="h-full" suppressHydrationWarning>
        <ServiceWorkerRegistrar />
        <ThemeSync />
        <I18nProvider>
          <ErrorBoundary>
            <QueryClientWrapper>
              <FontSync />
              <AuthProvider>
                <ToastProvider>
                  <QueryErrorNotifier />
                  {children}
                </ToastProvider>
              </AuthProvider>
            </QueryClientWrapper>
          </ErrorBoundary>
        </I18nProvider>
      </body>
    </html>
  );
}
