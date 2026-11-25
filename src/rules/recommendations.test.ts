import { describe, expect, it } from 'vitest';
import { MEMBERS } from '../fixtures/members';
import { snapshotOf } from '../test/helpers';
import { summarizeDepartment } from './analytics';
import { buildHypotheses, classifyCohort } from './recommendations';

describe('recommendation rules', () => {
  const hypotheses = buildHypotheses(snapshotOf());
  const byDept = Object.fromEntries(hypotheses.map((h) => [h.department, h]));

  it('Marketing: frequent chat without reuse becomes a hypothesis to investigate, first in priority', () => {
    expect(byDept.Marketing.kind).toBe('investigate-repeatable-work');
    expect(hypotheses[0].department).toBe('Marketing');
    expect(byDept.Marketing.signal).toContain('44 of 64');
    expect(byDept.Marketing.alternativeExplanation).toMatch(/Chat may be the right tool/);
  });

  it('Finance: a restricted capability avoids a false learning diagnosis', () => {
    expect(byDept.Finance.kind).toBe('resolve-access');
    expect(byDept.Finance.statement).toMatch(/No learning-need hypothesis/);
    expect(byDept.Finance.proposedIntervention).toMatch(/No training is proposed/);
    expect(summarizeDepartment(MEMBERS, 'Finance').eligibleMemberIds).toHaveLength(0);
  });

  it('Revenue: reuse already present means monitor, with no intervention', () => {
    expect(byDept.Revenue.kind).toBe('monitor');
  });

  it('the same Marketing pattern with Skills restricted is an access question, never a skills diagnosis', () => {
    const restricted = MEMBERS.map((m) =>
      m.department === 'Marketing'
        ? { ...m, skillUse: null, capabilities: { projects: 'available' as const, skills: 'restricted' as const } }
        : m,
    );
    const marketing = buildHypotheses(snapshotOf(restricted)).find((h) => h.department === 'Marketing')!;
    expect(marketing.kind).toBe('resolve-access');
  });

  it('a missing metric alone blocks the hypothesis', () => {
    const missing = MEMBERS.map((m) => (m.department === 'Marketing' ? { ...m, projectUse: null, telemetry: 'partial' as const } : m));
    expect(classifyCohort(summarizeDepartment(missing, 'Marketing'))).toBe('resolve-access');
  });
});
