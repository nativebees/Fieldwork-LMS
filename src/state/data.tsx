import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useAsyncValue, type AsyncValue } from '../lib/hooks';
import { createAnalyticsProvider } from '../providers/analytics';
import { buildObservations, summarizeCohorts, summarizeOrganization, type OrganizationSummary } from '../rules/analytics';
import { buildHypotheses } from '../rules/recommendations';
import type { AnalyticsSnapshot, Cohort, LearningNeedHypothesis, UsageObservation } from '../types';

/**
 * Account evidence, loaded once from the analytics provider and derived with pure
 * rules. It depends on the snapshot only. No practice or program state feeds into
 * it, so nothing a visitor does can change the customer's adoption figures.
 */
export interface AccountData {
  snapshot: AnalyticsSnapshot;
  organization: OrganizationSummary;
  cohorts: Cohort[];
  observations: UsageObservation[];
  hypotheses: LearningNeedHypothesis[];
}

interface DataValue {
  data: AsyncValue<AccountData>;
  retry: () => void;
}

const DataContext = createContext<DataValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  const provider = useMemo(() => createAnalyticsProvider(), []);

  const data = useAsyncValue<AccountData>(
    async () => {
      const snapshot = await provider.load();
      return {
        snapshot,
        organization: summarizeOrganization(snapshot.members),
        cohorts: summarizeCohorts(snapshot.members),
        observations: buildObservations(snapshot),
        hypotheses: buildHypotheses(snapshot),
      };
    },
    [provider],
    attempt,
  );

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const value = useMemo(() => ({ data, retry }), [data, retry]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useAccountData(): DataValue {
  const value = useContext(DataContext);
  if (!value) throw new Error('useAccountData must be used inside DataProvider');
  return value;
}
