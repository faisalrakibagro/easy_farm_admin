'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker that makes the panel installable.
 *
 * Skipped in development: Next's dev server serves uncached, constantly
 * changing bundles, and a worker sitting in front of them causes stale-asset
 * confusion during hot reloads.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Registration failures are non-fatal — the app works without it,
        // it just cannot be installed.
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
