import type { Department, MemberRecord } from '../types';

/**
 * Synthetic member records for Meridian Works, one per assigned seat, for the
 * window 2026-11-16 through 2026-11-22 (UTC).
 *
 * Every count shown in the app is derived from these records by the pure
 * functions in src/rules/analytics.ts. No chart label is hardcoded.
 *
 * The three department groups are disjoint in this fixture only. Real groups
 * overlap, so a real adapter must deduplicate members before counting.
 *
 * Simplification: "active" here means at least one chat day in the window.
 * Product documentation counts Claude Code and Cowork sessions too.
 */

type Fields = Omit<MemberRecord, 'id' | 'department'>;

const AVAILABLE = { projects: 'available', skills: 'available' } as const;
const SKILLS_RESTRICTED = { projects: 'available', skills: 'restricted' } as const;

function range(prefix: string, department: Department, from: number, to: number, make: (n: number) => Fields): MemberRecord[] {
  const out: MemberRecord[] = [];
  for (let n = from; n <= to; n += 1) {
    out.push({ id: `${prefix}${String(n).padStart(2, '0')}`, department, ...make(n) });
  }
  return out;
}

/* Marketing: 80 assigned, 64 active. */
const marketing: MemberRecord[] = [
  // M01–M44: at least three active chat days, no observed Project or Skill use.
  ...range('M', 'Marketing', 1, 44, (n) => ({
    activeChatDays: 3 + ((n * 7) % 5),
    projectUse: false,
    skillUse: false,
    capabilities: AVAILABLE,
    telemetry: 'sufficient',
  })),
  // M45–M56: active with Project use.
  ...range('M', 'Marketing', 45, 56, (n) => ({
    activeChatDays: 2 + (n % 5),
    projectUse: true,
    skillUse: false,
    capabilities: AVAILABLE,
    telemetry: 'sufficient',
  })),
  // M57–M64: active with Skill use.
  ...range('M', 'Marketing', 57, 64, (n) => ({
    activeChatDays: 2 + (n % 4),
    projectUse: false,
    skillUse: true,
    capabilities: AVAILABLE,
    telemetry: 'sufficient',
  })),
  // M65–M80: inactive during the window.
  ...range('M', 'Marketing', 65, 80, () => ({
    activeChatDays: 0,
    projectUse: false,
    skillUse: false,
    capabilities: AVAILABLE,
    telemetry: 'sufficient',
  })),
];

/*
 * Finance: 50 assigned, 36 active. The counterexample.
 * Skills are restricted for the whole group, so Skill use is unavailable (null),
 * never zero. Six members also have partial telemetry for Project use.
 */
const finance: MemberRecord[] = [
  // F01–F22: frequent chat, no observed Project use, Skill use unavailable.
  ...range('F', 'Finance', 1, 22, (n) => ({
    activeChatDays: 3 + (n % 4),
    projectUse: false,
    skillUse: null,
    capabilities: SKILLS_RESTRICTED,
    telemetry: 'sufficient',
  })),
  // F23–F30: active with Project use.
  ...range('F', 'Finance', 23, 30, (n) => ({
    activeChatDays: 2 + (n % 4),
    projectUse: true,
    skillUse: null,
    capabilities: SKILLS_RESTRICTED,
    telemetry: 'sufficient',
  })),
  // F31–F36: light chat, Project use unavailable because telemetry is partial.
  ...range('F', 'Finance', 31, 36, (n) => ({
    activeChatDays: 1 + (n % 2),
    projectUse: null,
    skillUse: null,
    capabilities: SKILLS_RESTRICTED,
    telemetry: 'partial',
  })),
  // F37–F50: inactive during the window.
  ...range('F', 'Finance', 37, 50, () => ({
    activeChatDays: 0,
    projectUse: false,
    skillUse: null,
    capabilities: SKILLS_RESTRICTED,
    telemetry: 'sufficient',
  })),
];

/* Revenue: 70 assigned, 56 active. Reuse signals are already present. */
const revenue: MemberRecord[] = [
  ...range('R', 'Revenue', 1, 20, (n) => ({
    activeChatDays: 2 + (n % 5),
    projectUse: true,
    skillUse: false,
    capabilities: AVAILABLE,
    telemetry: 'sufficient',
  })),
  ...range('R', 'Revenue', 21, 34, (n) => ({
    activeChatDays: 2 + (n % 4),
    projectUse: false,
    skillUse: true,
    capabilities: AVAILABLE,
    telemetry: 'sufficient',
  })),
  // R35–R56: one or two chat days, below the frequent-chat threshold.
  ...range('R', 'Revenue', 35, 56, (n) => ({
    activeChatDays: 1 + (n % 2),
    projectUse: false,
    skillUse: false,
    capabilities: AVAILABLE,
    telemetry: 'sufficient',
  })),
  ...range('R', 'Revenue', 57, 70, () => ({
    activeChatDays: 0,
    projectUse: false,
    skillUse: false,
    capabilities: AVAILABLE,
    telemetry: 'sufficient',
  })),
];

export const MEMBERS: MemberRecord[] = [...marketing, ...finance, ...revenue];
