import { describe, expect, it } from 'vitest';
import { MEMBERS } from '../fixtures/members';
import { snapshotOf } from '../test/helpers';
import type { MemberRecord } from '../types';
import {
  buildObservations,
  countWithCoverage,
  formatObservation,
  formatPercent,
  isEligibleForReuseHypothesis,
  percent,
  summarizeCohorts,
  summarizeDepartment,
  summarizeOrganization,
} from './analytics';

const seg = (members: MemberRecord[], dept: 'Marketing' | 'Finance' | 'Revenue', key: string) =>
  summarizeDepartment(members, dept).segments.find((s) => s.key === key)!.count;

describe('synthetic counts reconcile from the fixture records', () => {
  it('matches the organization totals: 200 assigned, 156 active, 78%', () => {
    expect(summarizeOrganization(MEMBERS)).toEqual({ assigned: 200, active: 156, activePercent: 78 });
  });

  it('matches each department', () => {
    const [marketing, finance, revenue] = summarizeCohorts(MEMBERS);
    expect([marketing.assigned, marketing.active]).toEqual([80, 64]);
    expect([finance.assigned, finance.active]).toEqual([50, 36]);
    expect([revenue.assigned, revenue.active]).toEqual([70, 56]);
  });

  it('builds the Marketing subsets exactly: 44 / 12 / 8 / 16', () => {
    expect(seg(MEMBERS, 'Marketing', 'focus')).toBe(44);
    expect(seg(MEMBERS, 'Marketing', 'project')).toBe(12);
    expect(seg(MEMBERS, 'Marketing', 'skill')).toBe(8);
    expect(seg(MEMBERS, 'Marketing', 'inactive')).toBe(16);
    const ids = summarizeDepartment(MEMBERS, 'Marketing').eligibleMemberIds;
    expect(ids[0]).toBe('M01');
    expect(ids[ids.length - 1]).toBe('M44');
  });

  it('segments are disjoint and sum to assigned seats in every department', () => {
    for (const cohort of summarizeCohorts(MEMBERS)) {
      expect(cohort.segments.reduce((n, s) => n + s.count, 0)).toBe(cohort.assigned);
    }
  });

  it('department actives sum to the organization only because this fixture is disjoint', () => {
    const sum = summarizeCohorts(MEMBERS).reduce((n, c) => n + c.active, 0);
    expect(sum).toBe(summarizeOrganization(MEMBERS).active);
  });
});

describe('denominator and missing-value handling', () => {
  it('never double counts a member who appears in two groups', () => {
    const overlap = [...MEMBERS, { ...MEMBERS[0], department: 'Finance' as const }];
    expect(summarizeOrganization(overlap).assigned).toBe(200);
    expect(summarizeOrganization(overlap).active).toBe(156);
  });

  it('keeps unavailable values out of the numerator and the denominator', () => {
    const finance = MEMBERS.filter((m) => m.department === 'Finance' && m.activeChatDays > 0);
    const projects = countWithCoverage(finance, (m) => m.projectUse);
    expect(projects).toEqual({ value: 8, withData: 30, unavailable: 6, missing: 'partial' });
    const skills = countWithCoverage(finance, (m) => m.skillUse);
    expect(skills).toEqual({ value: null, withData: 0, unavailable: 36, missing: 'unavailable' });
  });

  it('reports a percentage as unavailable, not zero, when it cannot be computed', () => {
    expect(percent(null, 36)).toBeNull();
    expect(percent(5, 0)).toBeNull();
    expect(formatPercent(null, 36)).toBe('Unavailable');
    expect(formatPercent(156, 200)).toBe('78%');
  });

  it('observations keep source, window, denominator, product and coverage', () => {
    const observations = buildObservations(snapshotOf());
    const mkt = observations.find((o) => o.id === 'obs-marketing-frequent-no-reuse')!;
    expect(mkt.value).toBe(44);
    expect(mkt.denominator).toBe(64);
    expect(mkt.sourceId).toBe('src-snapshot');
    expect(mkt.window).toMatchObject({ start: '2026-11-16', end: '2026-11-22', timezone: 'UTC' });
    expect(mkt.missing).toBe('complete');
    expect(formatObservation(mkt)).toBe('44 of 64');

    const finSkill = observations.find((o) => o.id === 'obs-finance-skill')!;
    expect(finSkill.value).toBeNull();
    expect(finSkill.missing).toBe('unavailable');
    expect(formatObservation(finSkill)).toBe('Unavailable');

    const finReuse = observations.find((o) => o.id === 'obs-finance-frequent-no-reuse')!;
    expect(finReuse.value).toBeNull();
    expect(finReuse.missingReason).toMatch(/restricted/);
  });

  it('a restricted capability or a null value is never eligible for the reuse hypothesis', () => {
    const base = MEMBERS[0];
    expect(isEligibleForReuseHypothesis(base)).toBe(true);
    expect(isEligibleForReuseHypothesis({ ...base, skillUse: null })).toBe(false);
    expect(isEligibleForReuseHypothesis({ ...base, capabilities: { projects: 'available', skills: 'restricted' } })).toBe(false);
    expect(isEligibleForReuseHypothesis({ ...base, telemetry: 'partial' })).toBe(false);
    expect(isEligibleForReuseHypothesis({ ...base, activeChatDays: 2 })).toBe(false);
  });
});
