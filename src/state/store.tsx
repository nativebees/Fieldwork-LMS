import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import type { AppState } from '../types';
import { createInitialState, reducer, type Action } from './reducer';
import { createStorage, loadState, serializeState, type LoadIssue, type StorageAdapter } from './storage';

export interface SaveStatus {
  /** 'local' saves to this browser. 'memory' lasts until the tab closes. */
  mode: 'local' | 'memory';
  savedAt: string | null;
  issue: LoadIssue;
}

interface StoreValue {
  state: AppState;
  dispatch: (action: Action) => void;
  save: SaveStatus;
  reset: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

interface Stamped {
  action: Action;
  at: string;
}

export function StoreProvider({ children, storage: injected }: { children: ReactNode; storage?: StorageAdapter }) {
  const storageRef = useRef<StorageAdapter | null>(null);
  const issueRef = useRef<LoadIssue>(null);
  if (!storageRef.current) storageRef.current = injected ?? createStorage();

  const [state, rawDispatch] = useReducer(
    (s: AppState, a: Stamped) => reducer(s, a.action, a.at),
    undefined,
    () => {
      const loaded = loadState(storageRef.current!);
      issueRef.current = loaded.issue;
      return loaded.state ?? createInitialState();
    },
  );

  const [save, setSave] = useState<SaveStatus>(() => ({
    mode: storageRef.current!.kind,
    savedAt: null,
    issue: issueRef.current,
  }));

  const dispatch = useCallback((action: Action) => rawDispatch({ action, at: new Date().toISOString() }), []);

  // Persist shortly after every change, and report whether it actually saved.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      const ok = storageRef.current!.write(serializeState(state));
      setSave((prev) => ({
        mode: ok ? storageRef.current!.kind : 'memory',
        savedAt: new Date().toISOString(),
        issue: prev.issue,
      }));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [state]);

  const reset = useCallback(() => {
    storageRef.current!.clear();
    rawDispatch({ action: { type: 'state/reset' }, at: new Date().toISOString() });
    setSave((prev) => ({ ...prev, issue: null }));
  }, []);

  const value = useMemo(() => ({ state, dispatch, save, reset }), [state, dispatch, save, reset]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside StoreProvider');
  return value;
}
