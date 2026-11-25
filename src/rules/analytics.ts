import type {
  AnalyticsSnapshot,
  Cohort,
  CohortSegment,
  Department,
  MemberRecord,
  MissingState,
  SegmentKey,
  UsageObservation,
} from '../types';

/** A member counts as a frequent chatter at or above this many active chat days. */
export const FREQUENT_CHAT_DAYS = 3;

export const DEPARTMENTS: Department[] = ['Marketing', 'Finance', 'Revenue'];

export const SEGMENT_LABEL: Record<SegmentKey, string> = {
  focus: 'Frequent chat, no observed Project or Skill use',
  project: 'Project use observed',
  skill: 'Skill use observed',
  other: 'Other active',
  unassessable: 'Active, reuse cannot be assessed',
  inactive: 'Inactive in window',
};

export const SEGMENT_ORDER: SegmentKey[] = ['focus', 'project', 'skill', 'other', 'unassessable', 'inactive'];

export function isActive(m: MemberRecord): boolean {
  return m.activeChatDays >= 1;
}

export function isFrequentChatter(m: MemberRecord): boolean {
  return m.activeChatDays >= FREQUENT_CHAT_DAYS;
}

/** True only when both reuse signals can actually be read for this member. */
export function isAssessable(m: MemberRecord): boolean {
  return (
    m.capabilities.projects === 'available' &&
    m.capabilities.skills === 'available' &&
    m.telemetry === 'sufficient' &&
    m.projectUse !== null &&
    m.skillUse !== null
  );
}

/**
 * Eligibility for the "investigate repeatable work" hypothesis.
 * A restricted capability or an unavailable value always fails this test, so a
 * missing value can never be read as "no use".
 */
export function isEligibleForReuseHypothesis(m: MemberRecord): boolean {
  return isFrequentChatter(m) && isAssessable(m) && m.projectUse === false && m.skillUse === false;
}

/** Looks like the pattern on the surface, but one of the signals cannot be read. */
export function isBlockedFromAssessment(m: MemberRecord): boolean {
  return isActive(m) && !isAssessable(m) && m.projectUse !== true && m.skillUse !== true;
}

export function segmentOf(m: MemberRecord): SegmentKey {
  if (!isActive(m)) return 'inactive';
  if (m.projectUse === true) return 'project';
  if (m.skillUse === true) return 'skill';
  if (!isAssessable(m)) return 'unassessable';
  if (isEligibleForReuseHypothesis(m)) return 'focus';
  return 'other';
}

/** Deduplicate by member id. Groups can overlap in real data, so never sum group counts. */
export function uniqueMembers(members: MemberRecord[]): MemberRecord[] {
  const seen = new Map<string, MemberRecord>();
  for (const m of members) if (!seen.has(m.id)) seen.set(m.id, m);
  return [...seen.values()];
}

/** Whole-number percentage, or null when the denominator is zero or unknown. */
export function percent(numerator: number | null, denominator: number): number | null {
  if (numerator === null || denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

export function formatPercent(numerator: number | null, denominator: number): string {
  const p = percent(numerator, denominator);
  return p === null ? 'Unavailable' : `${p}%`;
}

export interface CoverageCount {
  /** null when no record has a readable value. */
  value: number | null;
  withData: number;
  unavailable: number;
  missing: MissingState;
}

/**
 * Count members for whom `pick` is true, keeping unavailable values (null) out of
 * both the numerator and the denominator.
 */
export function countWithCoverage(members: MemberRecord[], pick: (m: MemberRecord) => boolean | null): CoverageCount {
  let value = 0;
  let withData = 0;
  let unavailable = 0;
  for (const m of members) {
    const v = pick(m);
    if (v === null) unavailable += 1;
    else {
      withData += 1;
      if (v) value += 1;
    }
  }
  const missing: MissingState = unavailable === 0 ? 'complete' : withData === 0 ? 'unavailable' : 'partial';
  return { value: withData === 0 ? null : value, withData, unavailable, missing };
}

export interface OrganizationSummary {
  assigned: number;
  active: number;
  activePercent: number | null;
}

export function summarizeOrganization(members: MemberRecord[]): OrganizationSummary {
  const unique = uniqueMembers(members);
  const active = unique.filter(isActive).length;
  return { assigned: unique.length, active, activePercent: percent(active, unique.length) };
}

export function summarizeDepartment(members: MemberRecord[], department: Department): Cohort {
  const group = uniqueMembers(members.filter((m) => m.department === department));
  const counts = new Map<SegmentKey, number>();
  for (const m of group) counts.set(segmentOf(m), (counts.get(segmentOf(m)) ?? 0) + 1);
  const segments: CohortSegment[] = SEGMENT_ORDER.map((key) => ({
    key,
    label: SEGMENT_LABEL[key],
    count: counts.get(key) ?? 0,
  }));
  return {
    id: `cohort-${department.toLowerCase()}`,
    department,
    label: department,
    assigned: group.length,
    active: group.filter(isActive).length,
    eligibleMemberIds: group.filter(isEligibleForReuseHypothesis).map((m) => m.id),
    blockedMemberIds: group.filter(isBlockedFromAssessment).map((m) => m.id),
    segments,
  };
}

export function summarizeCohorts(members: MemberRecord[]): Cohort[] {
  return DEPARTMENTS.map((d) => summarizeDepartment(members, d));
}

function skillValue(m: MemberRecord): boolean | null {
  return m.capabilities.skills === 'restricted' ? null : m.skillUse;
}

function projectValue(m: MemberRecord): boolean | null {
  return m.capabilities.projects === 'restricted' ? null : m.projectUse;
}

/** Build the observations for one department. Each keeps its own provenance. */
export function buildDepartmentObservations(snapshot: AnalyticsSnapshot, department: Department): UsageObservation[] {
  const group = uniqueMembers(snapshot.members.filter((m) => m.department === department));
  const active = group.filter(isActive);
  const key = department.toLowerCase();
  const base = { cohortId: `cohort-${key}`, window: snapshot.window, sourceId: 'src-snapshot' };

  const projects = countWithCoverage(active, projectValue);
  const skills = countWithCoverage(active, skillValue);

  const frequent = active.filter(isFrequentChatter);
  const frequentNoPositiveReuse = frequent.filter((m) => m.projectUse !== true && m.skillUse !== true);
  const eligible = frequentNoPositiveReuse.filter(isEligibleForReuseHypothesis);
  const blocked = frequentNoPositiveReuse.length - eligible.length;
  const skillsRestricted = group.some((m) => m.capabilities.skills === 'restricted');

  const reuseMissing: MissingState = blocked === 0 ? 'complete' : eligible.length === 0 ? 'unavailable' : 'partial';

  return [
    {
      ...base,
      id: `obs-${key}-active`,
      label: 'Active members',
      product: 'chat',
      value: active.length,
      denominator: group.length,
      denominatorLabel: 'assigned seats',
      coverage: { withData: group.length, unavailable: 0 },
      missing: 'complete',
    },
    {
      ...base,
      id: `obs-${key}-frequent-no-reuse`,
      label: `Chat on ${FREQUENT_CHAT_DAYS} or more days with no observed Project or Skill use`,
      product: 'chat',
      value: reuseMissing === 'unavailable' ? null : eligible.length,
      denominator: active.length,
      denominatorLabel: 'active members',
      coverage: { withData: active.length - blocked, unavailable: blocked },
      missing: reuseMissing,
      missingReason:
        blocked === 0
          ? undefined
          : skillsRestricted
            ? 'Skills are restricted for this group, so "no Skill use" cannot be observed. The value is unavailable, not zero.'
            : 'One or more reuse signals could not be read for some members.',
    },
    {
      ...base,
      id: `obs-${key}-project`,
      label: 'Members with Project use',
      product: 'projects',
      value: projects.value,
      denominator: projects.withData,
      denominatorLabel: 'active members with Project data',
      coverage: { withData: projects.withData, unavailable: projects.unavailable },
      missing: projects.missing,
      missingReason: projects.unavailable > 0 ? 'Project telemetry is partial for some members in this fixture.' : undefined,
    },
    {
      ...base,
      id: `obs-${key}-skill`,
      label: 'Members with Skill use',
      product: 'skills',
      value: skills.value,
      denominator: skills.withData,
      denominatorLabel: 'active members with Skill data',
      coverage: { withData: skills.withData, unavailable: skills.unavailable },
      missing: skills.missing,
      missingReason: skills.unavailable > 0 ? 'Skills are restricted for this group in this fixture.' : undefined,
    },
  ];
}

export function buildObservations(snapshot: AnalyticsSnapshot): UsageObservation[] {
  return DEPARTMENTS.flatMap((d) => buildDepartmentObservations(snapshot, d));
}

/** "44 of 64" or "Unavailable". Never renders a missing value as zero. */
export function formatObservation(o: UsageObservation): string {
  if (o.value === null) return 'Unavailable';
  return `${o.value} of ${o.denominator}`;
}
