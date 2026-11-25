import { useCallback, useEffect, useState } from 'react';

/**
 * Hash navigation. Direct links such as #/studio survive a reload on any static
 * host with no server configuration. The URL identifies a view, not a visitor's
 * local edits.
 */

export type ViewId = 'account' | 'rehearsal' | 'studio' | 'preview' | 'review';

export const VIEWS: Array<{ id: ViewId; label: string; step: number }> = [
  { id: 'account', label: 'Account', step: 1 },
  { id: 'rehearsal', label: 'Rehearsal', step: 2 },
  { id: 'studio', label: 'Studio', step: 3 },
  { id: 'preview', label: 'Preview', step: 4 },
  { id: 'review', label: 'Review', step: 5 },
];

export interface Route {
  view: ViewId;
  param: string | null;
}

export function parseHash(hash: string): Route {
  const [, view, param] = hash.replace(/^#/, '').split('/');
  const known = VIEWS.find((v) => v.id === view);
  return { view: known ? known.id : 'account', param: known && param ? decodeURIComponent(param) : null };
}

export function hrefFor(view: ViewId, param?: string | null): string {
  return `#/${view}${param ? `/${encodeURIComponent(param)}` : ''}`;
}

export function useHashRoute(): { route: Route; navigate: (view: ViewId, param?: string | null) => void } {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((view: ViewId, param?: string | null) => {
    const next = hrefFor(view, param);
    if (window.location.hash === next) return;
    window.location.hash = next;
  }, []);

  return { route, navigate };
}
