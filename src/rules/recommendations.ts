import type { AnalyticsSnapshot, Cohort, Department, HypothesisKind, LearningNeedHypothesis, UsageObservation } from '../types';
import { FREQUENT_CHAT_DAYS, buildObservations, summarizeCohorts } from './analytics';

/**
 * Deterministic eligibility rules that turn observations into a hypothesis.
 *
 * The rules never produce a skill diagnosis. The strongest output is "investigate
 * repeatable work", and it is only reachable when both reuse signals can be read.
 */

/** Minimum share of active members that must match before the pattern is worth a conversation. */
export const MIN_ELIGIBLE_SHARE = 0.25;
export const MIN_ELIGIBLE_COUNT = 10;

export function classifyCohort(cohort: Cohort): HypothesisKind {
  const eligible = cohort.eligibleMemberIds.length;
  const blocked = cohort.blockedMemberIds.length;
  // A restricted capability or missing metric wins over any pattern match.
  if (blocked > 0 && eligible === 0) return 'resolve-access';
  if (eligible >= MIN_ELIGIBLE_COUNT && cohort.active > 0 && eligible / cohort.active >= MIN_ELIGIBLE_SHARE) {
    return 'investigate-repeatable-work';
  }
  if (blocked > 0) return 'resolve-access';
  return 'monitor';
}

function segment(cohort: Cohort, key: Cohort['segments'][number]['key']): number {
  return cohort.segments.find((s) => s.key === key)?.count ?? 0;
}

function obsIds(observations: UsageObservation[], cohortId: string): string[] {
  return observations.filter((o) => o.cohortId === cohortId).map((o) => o.id);
}

function build(cohort: Cohort, observations: UsageObservation[]): LearningNeedHypothesis {
  const kind = classifyCohort(cohort);
  const dept: Department = cohort.department;
  const common = {
    id: `hyp-${dept.toLowerCase()}`,
    cohortId: cohort.id,
    department: dept,
    kind,
    observationIds: obsIds(observations, cohort.id),
  };
  const eligible = cohort.eligibleMemberIds.length;

  if (kind === 'investigate-repeatable-work') {
    return {
      ...common,
      priority: 1,
      title: `${dept}: frequent chat without reuse`,
      signal: `${eligible} of ${cohort.active} active ${dept} members chatted on ${FREQUENT_CHAT_DAYS} or more days with no observed Project or Skill use.`,
      statement: 'Some recurring work may be getting rebuilt in chat each time. That makes it worth asking about repeatable work.',
      reason: 'Frequent chat with no reuse feature in the same week is consistent with people retyping a similar request.',
      alternativeExplanation:
        'Chat may be the right tool for this work. One week is a short window, and this says nothing about what anyone knows or can do.',
      missingContext: 'Which tasks repeat, where they slow down or get sent back, and who reviews the result.',
      validationQuestion: 'Can you walk me through a recent piece of recurring work, from first draft to sign-off?',
      proposedArtifact: 'A reusable, reviewable campaign-brief workflow',
      proposedIntervention:
        'A short practice program in two modules: save the context, map the workflow, package the instruction, then apply it to a new brief.',
      sourceIds: ['src-snapshot', 'src-sponsor-note', 'src-field-note'],
    };
  }

  if (kind === 'resolve-access') {
    const blocked = cohort.blockedMemberIds.length;
    return {
      ...common,
      priority: 2,
      title: `${dept}: check access before anything else`,
      signal: `${blocked} of ${cohort.active} active ${dept} members cannot be assessed for reuse. Skill use is unavailable because Skills are restricted for this group.`,
      statement: 'No learning-need hypothesis. The reuse signal cannot be read while the capability is restricted.',
      reason: 'An unavailable value is not a zero. People cannot use a feature they have not been given.',
      alternativeExplanation:
        'The restriction may be a deliberate policy. If it is, the useful step is to respect it and learn what this team uses Claude for.',
      missingContext: 'Whether the restriction is a standing policy, who owns it and what this team’s recurring work is.',
      validationQuestion: 'Is the Skills restriction for this group a deliberate policy, and who owns that decision?',
      proposedArtifact: 'A confirmed picture of capabilities and permissions for this group',
      proposedIntervention: 'Resolve access or collect context first. No training is proposed.',
      sourceIds: ['src-snapshot', 'src-analytics-api'],
    };
  }

  const reuse = segment(cohort, 'project') + segment(cohort, 'skill');
  return {
    ...common,
    priority: 3,
    title: `${dept}: reuse signals already present`,
    signal: `${reuse} of ${cohort.active} active ${dept} members show Project or Skill use. ${segment(cohort, 'other')} chatted on fewer than ${FREQUENT_CHAT_DAYS} days.`,
    statement: 'No intervention suggested. Nothing here points to a learning need.',
    reason: 'Reuse features are in use and no group meets the frequent-chat pattern.',
    alternativeExplanation: 'A feature being opened is not the same as useful work. Ask before using this team as a reference story.',
    missingContext: 'What the Projects and Skills are used for, and whether the output is trusted.',
    validationQuestion: 'What are the two or three things this team has set up that they would not want to lose?',
    proposedArtifact: 'One or two peer examples, with the team’s permission',
    proposedIntervention: 'Keep watching. Consider peer examples after the first pilot has a result.',
    sourceIds: ['src-snapshot'],
  };
}

export function buildHypotheses(snapshot: AnalyticsSnapshot): LearningNeedHypothesis[] {
  const cohorts = summarizeCohorts(snapshot.members);
  const observations = buildObservations(snapshot);
  return cohorts.map((c) => build(c, observations)).sort((a, b) => a.priority - b.priority);
}
