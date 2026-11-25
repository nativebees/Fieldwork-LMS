import { OBSERVATION_WINDOW } from '../fixtures/account';
import { MEMBERS } from '../fixtures/members';
import { createInitialState, reducer, type Action } from '../state/reducer';
import type { AnalyticsSnapshot, AppState, MemberRecord } from '../types';

export const AT = '2026-11-25T10:00:00.000Z';

export function run(state: AppState, ...actions: Action[]): AppState {
  return actions.reduce((s, a) => reducer(s, a, AT), state);
}

export function fresh(): AppState {
  return createInitialState();
}

export function snapshotOf(members: MemberRecord[] = MEMBERS): AnalyticsSnapshot {
  return { providerId: 'test', providerLabel: 'test', synthetic: true, window: OBSERVATION_WINDOW, members };
}

/** The strongest path through the rehearsal for the default (AE) profile. */
export const BEST_AE_PATH: Action[] = [
  { type: 'rehearsal/choose', stepId: 'opening', optionId: 'o-observe' },
  { type: 'rehearsal/choose', stepId: 'firstQuestion', optionId: 'q-walkthrough' },
  { type: 'rehearsal/choose', stepId: 'followUp', optionId: 'f-evidence' },
  { type: 'rehearsal/choose', stepId: 'intervention', optionId: 'i-replace' },
  { type: 'rehearsal/choose', stepId: 'measurement', optionId: 'm-returned' },
];
