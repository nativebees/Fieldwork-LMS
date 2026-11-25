import { describe, expect, it } from 'vitest';
import { BEST_AE_PATH, fresh, run } from '../test/helpers';
import { createMemoryStorage, createStorage, isValidState, loadState, serializeState } from './storage';

describe('persistence', () => {
  it('round-trips state and drops the transient undo buffer', () => {
    const storage = createMemoryStorage();
    const state = run(fresh(), ...BEST_AE_PATH, { type: 'program/remove', lessonId: 'lesson-4' });
    expect(state.lastRemoved).not.toBeNull();
    storage.write(serializeState(state));
    const loaded = loadState(storage);
    expect(loaded.issue).toBeNull();
    expect(loaded.state).toEqual({ ...state, lastRemoved: null });
  });

  it('discards corrupt or outdated state instead of patching it', () => {
    const storage = createMemoryStorage();
    storage.write('{not json');
    expect(loadState(storage)).toEqual({ state: null, issue: 'corrupt' });
    expect(storage.read()).toBeNull();
    storage.write(JSON.stringify({ ...fresh(), version: 0 }));
    expect(loadState(storage).issue).toBe('corrupt');
    expect(isValidState({ ...fresh(), program: { modules: [] } })).toBe(false);
  });

  it('falls back to memory when browser storage is blocked or missing', () => {
    // The unit-test environment has no usable localStorage, which is the blocked case.
    const storage = createStorage();
    expect(storage.kind).toBe('memory');
    expect(storage.write('x')).toBe(true);
    expect(storage.read()).toBe('x');
  });
});
