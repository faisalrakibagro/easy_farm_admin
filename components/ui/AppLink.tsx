'use client';

import NextLink from 'next/link';
import type { ComponentProps } from 'react';

// Wrapper that disables prefetch by default — prevents unnecessary
// HEAD requests to admin.easyfarm.live for every visible link.
export default function AppLink({ prefetch = false, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={prefetch} {...props} />;
}
