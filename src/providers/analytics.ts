import { OBSERVATION_WINDOW } from '../fixtures/account';
import { MEMBERS } from '../fixtures/members';
import type { AnalyticsSnapshot } from '../types';

/**
 * Analytics boundary.
 *
 * The first version ships one working provider: SyntheticAnalyticsProvider. It
 * needs no credentials and makes no network request.
 *
 * A customer-authorized Enterprise analytics provider is described below as a
 * proposal only. It is not implemented, and nothing in this app asks a visitor
 * for an organization key.
 */

export interface AnalyticsProvider {
  readonly id: string;
  readonly label: string;
  load(): Promise<AnalyticsSnapshot>;
}

export class AnalyticsUnavailableError extends Error {
  constructor(message = 'The analytics snapshot could not be loaded.') {
    super(message);
    this.name = 'AnalyticsUnavailableError';
  }
}

export class SyntheticAnalyticsProvider implements AnalyticsProvider {
  readonly id = 'synthetic-analytics';
  readonly label = 'Synthetic analytics provider';

  constructor(private readonly options: { simulateUnavailable?: boolean } = {}) {}

  load(): Promise<AnalyticsSnapshot> {
    if (this.options.simulateUnavailable) {
      return Promise.reject(new AnalyticsUnavailableError('Simulated outage. The synthetic snapshot was not loaded.'));
    }
    return Promise.resolve({
      providerId: this.id,
      providerLabel: this.label,
      synthetic: true,
      window: OBSERVATION_WINDOW,
      members: MEMBERS,
    });
  }
}

/**
 * `?simulate=analytics-unavailable` in the URL exercises the unavailable-data state.
 * It is a demo switch for reviewers, not a feature.
 */
export function createAnalyticsProvider(search: string = globalThis.location?.search ?? ''): AnalyticsProvider {
  const simulate = new URLSearchParams(search).get('simulate');
  return new SyntheticAnalyticsProvider({ simulateUnavailable: simulate === 'analytics-unavailable' });
}

export type IntegrationStatus = 'working' | 'proposed' | 'unavailable';

export interface IntegrationDescriptor {
  id: string;
  name: string;
  status: IntegrationStatus;
  statusLabel: string;
  summary: string;
  points: string[];
}

/** Shown in the About drawer. Describes the architecture and which parts exist. */
export const INTEGRATIONS: IntegrationDescriptor[] = [
  {
    id: 'synthetic-analytics',
    name: 'Synthetic analytics provider',
    status: 'working',
    statusLabel: 'Working',
    summary: 'Loads 200 invented member records from a fixture bundled with the app.',
    points: [
      'No credentials, no network request, no customer data.',
      'Every count on screen is derived from the records. Unavailable values stay unavailable.',
    ],
  },
  {
    id: 'enterprise-analytics',
    name: 'Customer-authorized Enterprise analytics',
    status: 'proposed',
    statusLabel: 'Proposed, not built',
    summary: 'A later adapter that would read analytics the customer chooses to share.',
    points: [
      'The customer’s primary owner enables API access and creates a key with the read:analytics scope.',
      'A tenant-isolated backend holds that key. It never reaches the browser, and it is not a general Claude API key.',
      'The adapter normalizes permitted observations into Fieldwork’s own schema and keeps null values as unavailable.',
      'It handles the one-day data lag, later revisions and Chat and Cowork unified activity reported under its own product value.',
      'It deduplicates members across overlapping groups and never sums daily distinct counts into a period total.',
      'It confirms a capability is enabled before any recommendation mentions that feature.',
      'Sharing employee-level data with an account team needs the customer’s explicit approval.',
    ],
  },
  {
    id: 'claude-coaching',
    name: 'Live Claude coaching provider',
    status: 'unavailable',
    statusLabel: 'Optional, off in this build',
    summary: 'A replaceable provider interface exists. No model call is made anywhere in this app.',
    points: [
      'A real call would run from a server-side route with the official SDK and a server-held credential.',
      'It would receive only the approved synthetic account context, allowed source ids, the visible rubric and the attempt.',
      'It would return structured feedback validated against a schema, with source ids checked against the supplied pack.',
      'With no credential or authorization, live mode shows as unavailable. It is never simulated under a live label.',
    ],
  },
];
