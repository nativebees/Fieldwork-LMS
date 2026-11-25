import { useEffect, useState, type DependencyList } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window === 'undefined' ? false : window.matchMedia(query).matches));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export type AsyncValue<T> = { status: 'loading' } | { status: 'ready'; value: T } | { status: 'error'; error: string };

/**
 * Resolve a provider call with explicit loading and error states. Providers are
 * asynchronous by contract, so the UI is already shaped for a real network call.
 */
export function useAsyncValue<T>(factory: () => Promise<T>, deps: DependencyList, retryKey = 0): AsyncValue<T> {
  const [state, setState] = useState<AsyncValue<T>>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    setState((prev) => (prev.status === 'ready' ? prev : { status: 'loading' }));
    factory().then(
      (value) => {
        if (live) setState({ status: 'ready', value });
      },
      (error: unknown) => {
        if (live) setState({ status: 'error', error: error instanceof Error ? error.message : 'Something went wrong.' });
      },
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, retryKey]);
  return state;
}
