import { useEffect, useRef } from 'react';

/**
 * Open a page's form when it is reached with `?new=…` (the dashboard's quick
 * actions link this way), then drop the param so a reload doesn't reopen it.
 * `ready` holds the call back until the data the opener needs has loaded.
 */
export function useAutoOpen(open: (value: string) => void, ready = true) {
  const openRef = useRef(open);
  useEffect(() => { openRef.current = open; });

  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams(window.location.search);
    const value = params.get('new');
    if (!value) return;
    params.delete('new');
    const rest = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : ''));
    openRef.current(value);
  }, [ready]);
}
