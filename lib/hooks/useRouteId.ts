'use client';

import { usePathname, useParams } from 'next/navigation';

/**
 * Resolve a dynamic route id that survives the detail-page rewrite.
 *
 * Detail pages are prebuilt as a single `/0` shell (`dynamicParams = false`),
 * and both Apache (public/.htaccess, production) and the dev rewrites in
 * next.config.ts map `/partners/<id>` onto that shell. Inside the shell
 * `useParams()` reports the shell's own id — `'0'` — not the id in the address
 * bar, so reading it directly would query the wrong record.
 *
 * The URL itself is always correct, so take the id from the pathname and fall
 * back to useParams only when the pathname yields nothing usable.
 *
 * @param segmentFromEnd 1-based position of the id counting from the end of the
 *   path. Defaults to 1 (`/partners/5`); pass 2 for a trailing sub-route such as
 *   `/farm/labour/employees/5/salary-history`.
 */
export function useRouteId(segmentFromEnd = 1): string {
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();

  const segments = (pathname ?? '').split('/').filter(Boolean);
  const fromPath = segments[segments.length - segmentFromEnd];

  // The shell's placeholder is a real '0' segment, so only reject a missing or
  // non-id-looking segment here — never treat '0' from the URL as invalid.
  if (fromPath && /^[^/]+$/.test(fromPath)) {
    return fromPath;
  }

  const fromParams = params?.id;
  return Array.isArray(fromParams) ? fromParams[0] : (fromParams ?? '');
}
