import { ACCOUNT, CUSTOMER_CONSTRAINT, SELLER_PROFILES } from '../fixtures/account';
import { SOURCE_ACCURACY_CRITERIA, getAssessment, rulesIdOf } from '../fixtures/assessments';
import { SOURCE_BY_ID } from '../fixtures/knowledge';
import { createDefaultProgram } from '../fixtures/lessons';
import type { AppState, LearningNeedHypothesis, LearningProgram, ObservationWindow, ProgramChange } from '../types';
import type { OrganizationSummary } from './analytics';
import { programProgress } from './learner';
import {
  describeChange,
  diffPrograms,
  lessonsWithMappedCriteria,
  listLessons,
  moduleMinutes,
  programChecklist,
  totalMinutes,
} from './program';
import { chosenOption, rubricTotal, scoreSellerRubric } from './sellerRubric';
import { evaluateSuggestions } from './tailoring';

/**
 * Review derivations and local exports. Both exports are built from the current
 * state, so they always reflect the plan as edited. Export is a local download.
 * Nothing is sent, assigned, published or enrolled.
 */

export interface FollowUpPlan {
  status: 'proposed';
  measure: string;
  baseline: string;
  checkpoints: Array<{ day: 14 | 28; check: string }>;
  owner: string;
  sellerChoice: string | null;
  boundary: string;
}

export function buildFollowUpPlan(state: AppState): FollowUpPlan {
  const claimsMeasured = lessonsWithMappedCriteria(state.program, SOURCE_ACCURACY_CRITERIA).length > 0;
  const measurement = chosenOption(state.rehearsal, 'measurement', state.sellerProfileId);
  const askedVolume = state.rehearsal.choices.followUp === 'f-volume';
  return {
    status: 'proposed',
    measure: claimsMeasured
      ? 'Share of campaign briefs the campaign owner returns for unsupported product claims'
      : 'Share of new campaign briefs that start from the saved context and follow the mapped workflow',
    baseline: claimsMeasured
      ? askedVolume
        ? 'Count returned briefs for the four weeks before launch. The sponsor’s estimate was about a third, and she has not counted.'
        : 'Count returned briefs for the four weeks before launch. No baseline exists yet.'
      : 'Agree with the sponsor how many recent briefs started from scratch. No baseline exists yet.',
    checkpoints: claimsMeasured
      ? [
          {
            day: 14,
            check: 'With the campaign owner, sample recent briefs. Is the claim check used on live work, and are sources attached?',
          },
          {
            day: 28,
            check: 'Compare the returned-brief share with the baseline. Ask the campaign owner about rework and whether to continue.',
          },
        ]
      : [
          { day: 14, check: 'Ask the sponsor for a sample of recent briefs. Did they start from the saved context?' },
          { day: 28, check: 'Compare reuse with day 14. Ask whether review caught problems earlier.' },
        ],
    owner: state.program.reviewOwner,
    sellerChoice: measurement ? measurement.text : null,
    boundary:
      'Proposed plan. It needs real follow-up with the customer. Nothing here has been measured, and finishing this demo does not produce these numbers.',
  };
}

export interface ExplainedChange {
  change: ProgramChange;
  summary: string;
  why: string;
  source: 'customer-constraint' | 'tailoring' | 'review' | 'author';
}

/** The program the comparison starts from: the plan as it stood when the constraint was shared. */
export function baselineProgram(state: AppState): LearningProgram {
  return state.programAtReveal ?? createDefaultProgram();
}

/** Every change since the baseline, each with the reason it was made. */
export function explainChanges(state: AppState): ExplainedChange[] {
  const changes = diffPrograms(baselineProgram(state), state.program);
  const suggestions = evaluateSuggestions(state.program, state.dismissedSuggestions);
  return changes.map((change) => {
    const summary = describeChange(change);
    const lessonId = 'lessonId' in change ? change.lessonId : null;

    // The most recent accepted proposal that touched this lesson (or, for a program
    // field, the most recent constraint proposal that could have changed it).
    const logged = [...state.revisionLog]
      .reverse()
      .find((entry) => (lessonId ? entry.lessonIds.includes(lessonId) : entry.kind === 'constraint' && entry.suggestionId === 's-goal'));
    if (logged) {
      const source = logged.kind === 'constraint' ? 'customer-constraint' : logged.kind === 'review' ? 'review' : 'tailoring';
      return { change, summary, why: logged.reason, source };
    }

    // A change made by hand that satisfies a constraint suggestion still gets its reason.
    if (state.constraint && lessonId) {
      const match = suggestions.find((s) => s.status === 'applied' && s.lessonIds.includes(lessonId));
      if (match) return { change, summary, why: `${match.why} Applied by hand in the studio.`, source: 'customer-constraint' };
    }
    if (state.constraint && change.type === 'lesson-removed') {
      const claims = suggestions.find((s) => s.id === 's-claims');
      if (claims?.status === 'applied')
        return { change, summary, why: `${claims.why} Applied by hand in the studio.`, source: 'customer-constraint' };
    }
    return { change, summary, why: 'Edited by the author in the studio.', source: 'author' };
  });
}

export interface ExportContext {
  state: AppState;
  hypotheses: LearningNeedHypothesis[];
  /** null when the account evidence could not be loaded. It is exported as unavailable, never as zero. */
  organization: OrganizationSummary | null;
  window: ObservationWindow;
  exportedAt: string;
}

function initialRecommendationText(state: AppState): string {
  const d = state.decisions['hyp-marketing'];
  if (!d) return 'Not captured.';
  if (d.decision === 'accept') return 'Accepted the suggested practice program for the Marketing cohort.';
  if (d.decision === 'adapt') return `Adapted the suggestion${d.choiceId ? ` (${d.choiceId})` : ''}.`;
  return `Dismissed the suggestion${d.choiceId ? ` (${d.choiceId})` : ''}.`;
}

/** The full edited plan as structured data. */
export function buildPlanJson(ctx: ExportContext): Record<string, unknown> {
  const { state } = ctx;
  const rubric = scoreSellerRubric({
    profileId: state.sellerProfileId,
    rehearsal: state.rehearsal,
    program: state.program,
    constraintKnown: state.constraint !== null,
  });
  const progress = programProgress(state.program, state.attempts);
  return {
    schema: 'fieldwork.plan/v1',
    exportedAt: ctx.exportedAt,
    notice: {
      synthetic: true,
      text: 'Demo export. Meridian Works and every figure here are synthetic. This file was downloaded locally. Nothing was sent, assigned, published or enrolled.',
      coaching: 'Scenario coaching. Deterministic rules. No model call was made.',
    },
    account: { name: ACCOUNT.name, industry: ACCOUNT.industry, plan: ACCOUNT.plan, sponsor: ACCOUNT.sponsor, synthetic: true },
    seller: SELLER_PROFILES[state.sellerProfileId],
    snapshot: {
      window: ctx.window,
      organization: ctx.organization ?? 'unavailable',
      note: 'Adoption figures come from the synthetic fixture only. Practice in this demo never changes them.',
      hypotheses: ctx.hypotheses.map((h) => ({ id: h.id, kind: h.kind, signal: h.signal, statement: h.statement })),
    },
    initialRecommendation: {
      summary: initialRecommendationText(state),
      decision: state.decisions['hyp-marketing'] ?? null,
      otherDecisions: Object.values(state.decisions).filter((d) => d.recommendationId !== 'hyp-marketing'),
    },
    customerConstraint: state.constraint
      ? {
          known: true,
          quote: CUSTOMER_CONSTRAINT.quote,
          speaker: CUSTOMER_CONSTRAINT.speaker,
          revealedAt: state.constraint.revealedAt,
          synthetic: true,
        }
      : { known: false },
    program: {
      ...state.program,
      totalMinutes: totalMinutes(state.program),
      sequence: listLessons(state.program).map((l) => ({
        position: l.position,
        module: l.module.title,
        lessonId: l.lesson.id,
        title: l.lesson.title,
        rulesId: rulesIdOf(l.lesson.assessment),
        assessmentStatus: l.lesson.assessment.status,
        criterionIds: getAssessment(l.lesson.assessment).criteria.map((c) => c.id),
      })),
      coverage: programChecklist(state.program),
    },
    revision: {
      comparedWith: state.programAtReveal ? 'The program as it stood when the customer shared the constraint.' : 'The starting program.',
      changes: explainChanges(state).map((c) => ({ summary: c.summary, why: c.why, source: c.source })),
      log: state.revisionLog,
    },
    sellerPractice: {
      boundary: 'Performance on a practice task. Not a hiring or employment assessment.',
      criteria: rubric,
      total: rubricTotal(rubric),
      choices: state.rehearsal.choices,
      reflection: { text: state.rehearsal.reflection, automaticallyAssessed: false },
    },
    learnerPractice: {
      boundary:
        'Attempted practice and demonstrated criteria are separate. Attempts are kept against the rule version they were scored with.',
      lessonsAttempted: progress.attempted,
      lessons: progress.lessons,
      criteriaDemonstrated: progress.criteriaDemonstrated,
      criteriaTotal: progress.criteriaTotal,
      attempts: state.attempts,
    },
    followUp: buildFollowUpPlan(state),
    prototypeEvents: state.events,
  };
}

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

/** A readable customer brief. It leaves out seller coaching notes and CRM context. */
export function buildMarkdownBrief(ctx: ExportContext): string {
  const { state } = ctx;
  const program = state.program;
  const lines: string[] = [];
  const push = (...l: string[]) => lines.push(...l);

  push(`# ${program.title}`, '');
  push(`Customer brief for ${ACCOUNT.name} · prepared ${formatDate(ctx.exportedAt)}`, '');
  push(
    '> Demo document. Meridian Works and every figure here are synthetic. This file was downloaded locally. Nothing has been sent, assigned or enrolled.',
    '',
  );

  push('## Audience', '', program.audience, '');
  push('## Goal', '', program.goal, '');

  push('## Sequence', '', `${listLessons(program).length} lessons, about ${totalMinutes(program)} minutes in total.`, '');
  let n = 0;
  for (const module of program.modules) {
    push(`### ${module.title} (${moduleMinutes(program, module.id)} min)`, '');
    if (module.lessonIds.length === 0) push('_No lessons in this module._', '');
    for (const id of module.lessonIds) {
      const lesson = program.lessons[id];
      if (!lesson) continue;
      n += 1;
      const assessment = getAssessment(lesson.assessment);
      push(`${n}. **${lesson.title}** (${lesson.durationMin} min)`);
      push(`   - Objective: ${lesson.objective || 'Not written yet.'}`);
      push(`   - Practice: ${lesson.practice || 'Not described yet.'}`);
      push(`   - Evidence of success: ${lesson.evidence || 'Not described yet.'}`);
      if (lesson.assessment.status === 'mapped') {
        push(`   - Scored criteria (${assessment.rulesId}): ${assessment.criteria.map((c) => c.label).join('. ')}.`);
      } else {
        push('   - Scoring: custom content. The assessment needs review before any criterion is recorded.');
      }
      if (lesson.objectiveReview === 'needs-review') push('   - Note: the objective changed and is waiting for an alignment check.');
      push('');
    }
  }

  push('## Source notes', '');
  const sourceIds = [...new Set(listLessons(program).flatMap((l) => l.lesson.sourceIds))];
  if (sourceIds.length === 0) push('No sources are cited by the lessons in this program.', '');
  else {
    for (const id of sourceIds) {
      const s = SOURCE_BY_ID[id];
      if (!s) continue;
      const status =
        s.review === 'review-required' ? 'Needs review. No review date recorded.' : `Checked ${s.checkedOn ?? 'date not recorded'}.`;
      push(`- ${s.title} (${s.publisher}). ${status}${s.reviewNote ? ` ${s.reviewNote}` : ''}`);
    }
    push('');
  }

  const mapped = listLessons(program).filter((l) => l.lesson.assessment.status === 'mapped');
  const criteria = mapped.reduce((count, l) => count + getAssessment(l.lesson.assessment).criteria.length, 0);
  push('## Practice', '');
  push(
    `${mapped.length} of ${listLessons(program).length} lessons include scored practice, covering ${criteria} criteria. Each criterion gets specific feedback, and a missed criterion can be retried. Completing a lesson and demonstrating its criteria are recorded separately.`,
    '',
  );

  push('## Review owner', '', program.reviewOwner, '');

  const plan = buildFollowUpPlan(state);
  push('## Follow-up (proposed)', '');
  push(`- Measure: ${plan.measure}.`);
  push(`- Baseline: ${plan.baseline}`);
  for (const c of plan.checkpoints) push(`- Day ${c.day}: ${c.check}`);
  push(`- Owner: ${plan.owner}`);
  push('', plan.boundary, '');

  if (state.constraint) {
    const changes = explainChanges(state);
    push('## What changed after the adoption review', '');
    push(`What we heard: “${CUSTOMER_CONSTRAINT.quote}”`, '');
    if (changes.length === 0) push('The program has not been changed since that conversation.', '');
    else {
      for (const c of changes) push(`- ${c.summary} Why: ${c.why}`);
      push('');
    }
  }

  push('---', '', 'Fieldwork is an independent portfolio concept by Sean Gillespie. It is not an Anthropic product.');
  return lines.join('\n');
}

export function exportFileBase(program: LearningProgram, exportedAt: string): string {
  const slug = program.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `fieldwork-${slug || 'plan'}-${formatDate(exportedAt)}`;
}
