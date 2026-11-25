import { HUMAN_APPROVAL_CRITERIA, SOURCE_ACCURACY_CRITERIA } from '../fixtures/assessments';
import { TEMPLATE_IDS } from '../fixtures/lessons';
import { OPTION_DISPLAY_ORDER, REHEARSAL_STEPS, REHEARSAL_STEP_ORDER, SELLER_CRITERIA } from '../fixtures/rehearsal';
import type {
  LearningProgram,
  RehearsalOption,
  RehearsalState,
  RehearsalStepId,
  SellerCriterionId,
  SellerCriterionResult,
  SellerProfileId,
} from '../types';
import { lessonsWithMappedCriteria, listLessons } from './program';

/**
 * Seller practice rubric: five visible criteria, 0 to 2 points each.
 *
 * Deterministic mode scores explicit structured choices and the actual state of the
 * program. It never reads the optional free-text reflection.
 */

export function emptyRehearsal(): RehearsalState {
  return {
    choices: { opening: null, firstQuestion: null, followUp: null, intervention: null, measurement: null },
    reflection: '',
  };
}

export function optionsFor(stepId: RehearsalStepId, profileId: SellerProfileId): RehearsalOption[] {
  const order = OPTION_DISPLAY_ORDER[stepId];
  return REHEARSAL_STEPS[stepId].options
    .filter((o) => !o.onlyFor || o.onlyFor.includes(profileId))
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

/** The chosen option, or null if nothing is chosen or the choice is not offered to this profile. */
export function chosenOption(rehearsal: RehearsalState, stepId: RehearsalStepId, profileId: SellerProfileId): RehearsalOption | null {
  const id = rehearsal.choices[stepId];
  if (!id) return null;
  return optionsFor(stepId, profileId).find((o) => o.id === id) ?? null;
}

export function pointsFor(option: RehearsalOption, profileId: SellerProfileId): 0 | 1 | 2 {
  return typeof option.points === 'number' ? option.points : option.points[profileId];
}

/** The first step with no valid choice yet, or 'done'. */
export function currentStep(rehearsal: RehearsalState, profileId: SellerProfileId): RehearsalStepId | 'done' {
  for (const id of REHEARSAL_STEP_ORDER) if (!chosenOption(rehearsal, id, profileId)) return id;
  return 'done';
}

/** The sponsor shares the constraint once the first question has been asked. */
export function isConstraintRevealedBy(rehearsal: RehearsalState): boolean {
  return rehearsal.choices.firstQuestion !== null;
}

export interface RubricInput {
  profileId: SellerProfileId;
  rehearsal: RehearsalState;
  program: LearningProgram;
  constraintKnown: boolean;
}

function meta(id: SellerCriterionId) {
  return SELLER_CRITERIA.find((c) => c.id === id)!;
}

function notYet(id: SellerCriterionId, note: string): SellerCriterionResult {
  return { id, label: meta(id).label, points: 0, max: 2, status: 'not-yet', evidence: [note] };
}

function titles(ids: string[], program: LearningProgram): string {
  const unique = [...new Set(ids)];
  return unique.map((id) => `“${program.lessons[id]?.title ?? id}”`).join(' and ');
}

export function scoreSellerRubric({ profileId, rehearsal, program, constraintKnown }: RubricInput): SellerCriterionResult[] {
  const pick = (step: RehearsalStepId) => chosenOption(rehearsal, step, profileId);
  const results: SellerCriterionResult[] = [];

  /* 1. Observation versus assumption: the opening choice. */
  const opening = pick('opening');
  results.push(
    opening
      ? {
          id: 'observation-vs-assumption',
          label: meta('observation-vs-assumption').label,
          points: pointsFor(opening, profileId),
          max: 2,
          status: 'scored',
          evidence: [`In your opening you ${opening.short}.`, opening.why],
        }
      : notYet('observation-vs-assumption', 'Not rehearsed yet. Scored from how you open the review.'),
  );

  /* 2. Diagnostic question: the revised question counts once it exists. */
  const first = pick('firstQuestion');
  const follow = pick('followUp');
  if (!first) {
    results.push(notYet('diagnostic-question', 'Not rehearsed yet. Scored from the questions you ask.'));
  } else {
    const scored = follow ?? first;
    const evidence = [`First question: you ${first.short} (${pointsFor(first, profileId)} of 2).`];
    if (follow)
      evidence.push(
        `After the constraint: you ${follow.short} (${pointsFor(follow, profileId)} of 2). The revised question is the one scored.`,
      );
    else evidence.push('No follow-up yet. The score will update when you ask one.');
    evidence.push(scored.why);
    results.push({
      id: 'diagnostic-question',
      label: meta('diagnostic-question').label,
      points: pointsFor(scored, profileId),
      max: 2,
      status: 'scored',
      evidence,
    });
  }

  /* 3. Intervention fit: one point for the decision, one for a program that reflects it. */
  const intervention = pick('intervention');
  const claimLessons = listLessons(program)
    .map((l) => l.lesson)
    .filter((l) => l.assessment.templateId === 'claim-check' && l.assessment.status === 'mapped');
  const skillStillThere = listLessons(program).some((l) => l.lesson.templateId === TEMPLATE_IDS.skill);
  if (!intervention && !constraintKnown) {
    results.push(notYet('intervention-fit', 'Not rehearsed yet. Scored from your revised proposal and the program itself.'));
  } else {
    const decision = intervention ? pointsFor(intervention, profileId) : 0;
    const plan = claimLessons.length > 0 ? 1 : 0;
    const evidence: string[] = [];
    evidence.push(
      intervention
        ? `Decision: you ${intervention.short} (${decision} of 1). ${intervention.why}`
        : 'Decision: no revised proposal chosen yet (0 of 1).',
    );
    evidence.push(
      plan
        ? `Program: it now includes ${titles(
            claimLessons.map((l) => l.id),
            program,
          )} with a scored claim check (1 of 1).`
        : 'Program: no scored claim-check lesson is in the program yet (0 of 1).',
    );
    if (plan && skillStillThere) {
      evidence.push('The generic Skill lesson is still in the program. That is five minutes the sponsor did not ask for.');
    }
    results.push({
      id: 'intervention-fit',
      label: meta('intervention-fit').label,
      points: Math.min(2, decision + plan) as 0 | 1 | 2,
      max: 2,
      status: 'scored',
      evidence,
    });
  }

  /* 4. Source accuracy and human approval: read from the program, capped by what was said. */
  if (!constraintKnown) {
    results.push(notYet('accuracy-and-approval', 'Scored after the sponsor shares the constraint, from the criteria the program records.'));
  } else {
    const accuracy = lessonsWithMappedCriteria(program, SOURCE_ACCURACY_CRITERIA);
    const approval = lessonsWithMappedCriteria(program, HUMAN_APPROVAL_CRITERIA);
    const movedApproval = [pick('followUp'), intervention].some((o) => o?.flags?.includes('removes-approval'));
    const accuracyPoint = accuracy.length > 0 ? 1 : 0;
    const approvalPoint = approval.length > 0 && !movedApproval ? 1 : 0;
    const evidence = [
      accuracyPoint
        ? `Source accuracy: ${titles(
            accuracy.map((c) => c.lessonId),
            program,
          )} records ${[...new Set(accuracy.map((c) => c.criterionId))].join(', ')} (1 of 1).`
        : 'Source accuracy: no lesson in the program records a claim-check criterion yet (0 of 1).',
      approval.length > 0
        ? `Human approval: ${titles(
            approval.map((c) => c.lessonId),
            program,
          )} keeps approval before sharing (${[...new Set(approval.map((c) => c.criterionId))].join(', ')}).`
        : 'Human approval: no lesson in the program records an approval-before-sharing criterion yet (0 of 1).',
    ];
    if (movedApproval) {
      evidence.push(
        'In the conversation you proposed moving the check or the approval to Claude, which the sponsor ruled out. The approval point is withheld.',
      );
    } else if (approval.length > 0) {
      evidence.push('Nothing you said in the conversation moved approval away from the campaign owner (1 of 1).');
    }
    results.push({
      id: 'accuracy-and-approval',
      label: meta('accuracy-and-approval').label,
      points: (accuracyPoint + approvalPoint) as 0 | 1 | 2,
      max: 2,
      status: 'scored',
      evidence,
    });
  }

  /* 5. Next measurement: the measurement choice, read against the seller's profile. */
  const measurement = pick('measurement');
  if (!measurement) {
    results.push(notYet('next-measurement', 'Not rehearsed yet. Scored from the measure you agree with the sponsor.'));
  } else {
    const evidence = [`You ${measurement.short}.`, measurement.why];
    const note = measurement.profileNote?.[profileId];
    if (note) evidence.push(note);
    results.push({
      id: 'next-measurement',
      label: meta('next-measurement').label,
      points: pointsFor(measurement, profileId),
      max: 2,
      status: 'scored',
      evidence,
    });
  }

  return results;
}

export function rubricTotal(results: SellerCriterionResult[]): { points: number; max: number; scored: number } {
  return {
    points: results.reduce((n, r) => n + r.points, 0),
    max: results.reduce((n, r) => n + r.max, 0),
    scored: results.filter((r) => r.status === 'scored').length,
  };
}
