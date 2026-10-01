'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryClientWrapper({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Data is treated as stale immediately, so revisiting a page (or
        // reopening a modal) refetches in the background.
        //
        // Why not the old 5 minutes: dropdowns are populated by page-level
        // lookup queries — feed items, payment accounts, categories — that are
        // created on a *different* page. Nothing on the consuming page
        // invalidates them, so for up to 5 minutes a freshly added category was
        // simply missing until a hard reload. Cached data still paints
        // instantly; react-query just revalidates behind it.
        staleTime: 0,
        gcTime: 10 * 60 * 1000,      // 10 minutes cache retention
        refetchOnWindowFocus: false,  // don't refetch just because user switches tabs
        retry: 1,
      },
    },
  }));

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
