import { ASSESSMENT_BY_RULES_ID, rulesIdOf } from '../fixtures/assessments';
import { STATE_VERSION, type AppState } from '../types';

/**
 * Versioned browser-local persistence with a safe in-memory fallback.
 * Nothing leaves the browser. There is no account, database or analytics call.
 */

export const STORAGE_KEY = `fieldwork.state.v${STATE_VERSION}`;

export interface StorageAdapter {
  kind: 'local' | 'memory';
  read(): string | null;
  /** Returns false when the write did not persist. */
  write(value: string): boolean;
  clear(): void;
}

export function createMemoryStorage(): StorageAdapter {
  let value: string | null = null;
  return {
    kind: 'memory',
    read: () => value,
    write: (v) => {
      value = v;
      return true;
    },
    clear: () => {
      value = null;
    },
  };
}

/** Use localStorage when it works. Private modes and blocked storage fall back to memory. */
export function createStorage(): StorageAdapter {
  try {
    const store = globalThis.localStorage;
    const probe = `${STORAGE_KEY}.probe`;
    store.setItem(probe, '1');
    store.removeItem(probe);
    return {
      kind: 'local',
      read: () => {
        try {
          return store.getItem(STORAGE_KEY);
        } catch {
          return null;
        }
      },
      write: (v) => {
        try {
          store.setItem(STORAGE_KEY, v);
          return true;
        } catch {
          return false;
        }
      },
      clear: () => {
        try {
          store.removeItem(STORAGE_KEY);
        } catch {
          /* nothing to clear */
        }
      },
    };
  } catch {
    return createMemoryStorage();
  }
}

/** The undo buffer is transient, so it is not saved. */
export function serializeState(state: AppState): string {
  return JSON.stringify({ ...state, lastRemoved: null });
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Structural check. A saved state that fails it is discarded, never patched up. */
export function isValidState(x: unknown): x is AppState {
  if (!isRecord(x) || x.version !== STATE_VERSION) return false;
  if (x.sellerProfileId !== 'ae-new' && x.sellerProfileId !== 'csm-experienced') return false;
  if (!isRecord(x.decisions) || !isRecord(x.rehearsal) || !isRecord((x.rehearsal as Record<string, unknown>).choices)) return false;
  if (!Array.isArray(x.attempts) || !Array.isArray(x.events) || !Array.isArray(x.revisionLog)) return false;
  if (!Array.isArray(x.dismissedSuggestions) || typeof x.counter !== 'number') return false;
  const program = x.program;
  if (!isRecord(program) || !Array.isArray(program.modules) || !isRecord(program.lessons)) return false;
  const lessons = program.lessons as Record<string, unknown>;
  for (const module of program.modules as unknown[]) {
    if (!isRecord(module) || !Array.isArray(module.lessonIds)) return false;
    for (const id of module.lessonIds as unknown[]) {
      const lesson = typeof id === 'string' ? lessons[id] : undefined;
      if (!isRecord(lesson) || !Array.isArray(lesson.blocks) || !isRecord(lesson.assessment) || !isRecord(lesson.aligned)) return false;
      const binding = lesson.assessment as { templateId: never; version: never };
      if (!ASSESSMENT_BY_RULES_ID[rulesIdOf(binding)]) return false;
    }
  }
  return true;
}

export type LoadIssue = 'corrupt' | null;

export function loadState(storage: StorageAdapter): { state: AppState | null; issue: LoadIssue } {
  const raw = storage.read();
  if (raw === null) return { state: null, issue: null };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isValidState(parsed)) return { state: { ...parsed, lastRemoved: null }, issue: null };
  } catch {
    /* fall through */
  }
  storage.clear();
  return { state: null, issue: 'corrupt' };
}
