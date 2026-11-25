import { describe, expect, it } from 'vitest';
import { MEMBERS } from '../fixtures/members';
import { TEMPLATE_IDS } from '../fixtures/lessons';
import { summarizeCohorts, summarizeOrganization } from '../rules/analytics';
import { lessonProgress, programProgress } from '../rules/learner';
import { listLessons } from '../rules/program';
import { buildHypotheses } from '../rules/recommendations';
import { proposeVerificationStep } from '../rules/tailoring';
import { ACCOUNT } from '../fixtures/account';
import { BEST_AE_PATH, fresh, run, snapshotOf } from '../test/helpers';
import { createInitialState, PRIMARY_RECOMMENDATION_ID } from './reducer';

const titles = (s: ReturnType<typeof fresh>) => listLessons(s.program).map((l) => l.lesson.title);

describe('state transitions', () => {
  it('captures the initial recommendation and locks it once the constraint is revealed', () => {
    let s = run(fresh(), { type: 'decision/record', recommendationId: PRIMARY_RECOMMENDATION_ID, decision: 'accept', choiceId: null, note: '' });
    expect(s.decisions[PRIMARY_RECOMMENDATION_ID].decision).toBe('accept');
    expect(s.decisions[PRIMARY_RECOMMENDATION_ID].sellerProfileId).toBe('ae-new');

    s = run(
      s,
      { type: 'rehearsal/choose', stepId: 'opening', optionId: 'o-observe' },
      { type: 'rehearsal/choose', stepId: 'firstQuestion', optionId: 'q-time' },
    );
    expect(s.constraint).not.toBeNull();
    expect(s.programAtReveal).toEqual(createInitialState().program);

    const after = run(s, { type: 'decision/record', recommendationId: PRIMARY_RECOMMENDATION_ID, decision: 'dismiss', choiceId: null, note: '' });
    expect(after.decisions[PRIMARY_RECOMMENDATION_ID].decision).toBe('accept');
  });

  it('a recorded rehearsal choice stands until restart, and restart keeps the constraint', () => {
    let s = run(fresh(), { type: 'rehearsal/choose', stepId: 'opening', optionId: 'o-expand' });
    s = run(s, { type: 'rehearsal/choose', stepId: 'opening', optionId: 'o-observe' });
    expect(s.rehearsal.choices.opening).toBe('o-expand');
    s = run(s, { type: 'rehearsal/choose', stepId: 'firstQuestion', optionId: 'q-walkthrough' }, { type: 'rehearsal/restart' });
    expect(s.rehearsal.choices.opening).toBeNull();
    expect(s.constraint).not.toBeNull();
  });

  it('add, reorder, edit, duplicate and remove with undo all change the single program', () => {
    let s = run(fresh(), { type: 'program/add', templateId: TEMPLATE_IDS.claims, moduleId: 'module-2', index: 0 });
    expect(titles(s)[2]).toBe('Check claims before handoff');
    expect(s.selectedLessonId).toBe('lesson-5');

    s = run(s, { type: 'program/step', lessonId: 'lesson-5', direction: 1 });
    expect(titles(s)[3]).toBe('Check claims before handoff');

    s = run(s, { type: 'program/reorder', flat: ['lesson-2', 'lesson-1', 'divider:module-2', 'lesson-3', 'lesson-5', 'lesson-4'] });
    expect(titles(s).slice(0, 2)).toEqual(['Map a reviewable workflow', 'Create a reusable campaign-brief context']);

    s = run(s, { type: 'program/updateLesson', lessonId: 'lesson-1', patch: { title: 'Save the brief context' } });
    expect(s.program.lessons['lesson-1'].title).toBe('Save the brief context');

    s = run(s, { type: 'program/remove', lessonId: 'lesson-3' });
    expect(titles(s)).not.toContain('Package a repeatable instruction');
    expect(s.lastRemoved?.lesson.id).toBe('lesson-3');
    s = run(s, { type: 'program/undoRemove' });
    expect(titles(s)).toContain('Package a repeatable instruction');
    expect(s.lastRemoved).toBeNull();
  });

  it('reset returns to the default demo', () => {
    const s = run(fresh(), ...BEST_AE_PATH, { type: 'program/remove', lessonId: 'lesson-1' }, { type: 'state/reset' });
    expect(s).toEqual(createInitialState());
  });
});

describe('learner attempts', () => {
  it('a failed attempt is kept, explains the criterion and a retry can succeed', () => {
    let s = run(fresh(), { type: 'program/add', templateId: TEMPLATE_IDS.claims, moduleId: 'module-2', index: 0 });
    s = run(s, { type: 'attempt/record', lessonId: 'lesson-5', response: { claim: 'c4', evidence: 'e4' } });
    let progress = lessonProgress(s.program.lessons['lesson-5'], s.attempts);
    expect(progress.status).toBe('attempted');
    expect(progress.demonstrated).toBe(0);
    expect(s.attempts[0].results[0].explanation).toMatch(/pricing sheet/);

    s = run(s, { type: 'attempt/record', lessonId: 'lesson-5', response: { claim: 'c2', evidence: 'e1' } });
    progress = lessonProgress(s.program.lessons['lesson-5'], s.attempts);
    expect(s.attempts.map((a) => a.n)).toEqual([1, 2]);
    expect(progress.status).toBe('demonstrated');
    expect(progress.demonstrated).toBe(2);
  });

  it('attempts stay recorded against their rule version when the assessment changes', () => {
    let s = run(fresh(), { type: 'attempt/record', lessonId: 'lesson-2', response: { steps: ['context', 'draft', 'review', 'share'] } });
    expect(lessonProgress(s.program.lessons['lesson-2'], s.attempts).status).toBe('demonstrated');

    const result = proposeVerificationStep(s.program, 'lesson-2', { account: ACCOUNT, constraintKnown: true });
    if (!result.ok) throw new Error(result.reason);
    s = run(s, { type: 'program/applyProposal', proposal: result.proposal });

    const progress = lessonProgress(s.program.lessons['lesson-2'], s.attempts);
    expect(progress.rulesId).toBe('workflow-sequence@2');
    expect(progress.demonstrated).toBe(0);
    expect(progress.status).toBe('attempted');
    expect(progress.earlier).toHaveLength(1);
    expect(progress.earlier[0].rulesId).toBe('workflow-sequence@1');
  });

  it('typed rules never run against custom content', () => {
    let s = run(fresh(), { type: 'program/updateLesson', lessonId: 'lesson-1', patch: { practice: 'Write a limerick.' } });
    expect(s.program.lessons['lesson-1'].assessment.status).toBe('custom-needs-review');
    s = run(s, { type: 'attempt/record', lessonId: 'lesson-1', response: { sort: ['audience', 'descriptions', 'template'] } });
    expect(s.attempts).toHaveLength(0);
    s = run(s, { type: 'attempt/unscored', lessonId: 'lesson-1' });
    expect(s.attempts[0]).toMatchObject({ scored: false, rulesId: null, results: [] });
    const progress = lessonProgress(s.program.lessons['lesson-1'], s.attempts);
    expect(progress).toMatchObject({ status: 'needs-review', attempted: true, demonstrated: 0 });

    s = run(s, { type: 'assessment/resolve', lessonId: 'lesson-1', mode: 'restore' });
    expect(s.program.lessons['lesson-1'].assessment.status).toBe('mapped');
    expect(s.revisionLog[s.revisionLog.length - 1].kind).toBe('review');
  });

  it('completion and demonstrated criteria are separate numbers', () => {
    const s = run(fresh(), { type: 'attempt/record', lessonId: 'lesson-1', response: { sort: ['date'] } });
    const p = programProgress(s.program, s.attempts);
    expect(p.attempted).toBe(1);
    expect(p.criteriaDemonstrated).toBe(0);
    expect(p.criteriaTotal).toBe(9);
  });
});

describe('practice never changes customer metrics', () => {
  it('adoption figures and hypotheses are identical before and after a full journey', () => {
    const before = {
      org: summarizeOrganization(MEMBERS),
      cohorts: summarizeCohorts(MEMBERS),
      hypotheses: buildHypotheses(snapshotOf()),
      members: JSON.stringify(MEMBERS),
    };
    run(
      fresh(),
      ...BEST_AE_PATH,
      { type: 'attempt/record', lessonId: 'lesson-1', response: { sort: ['audience', 'descriptions', 'template'] } },
      { type: 'attempt/record', lessonId: 'lesson-2', response: { steps: ['context', 'draft', 'review', 'share'] } },
    );
    expect(summarizeOrganization(MEMBERS)).toEqual(before.org);
    expect(summarizeCohorts(MEMBERS)).toEqual(before.cohorts);
    expect(buildHypotheses(snapshotOf())).toEqual(before.hypotheses);
    expect(JSON.stringify(MEMBERS)).toBe(before.members);
  });
});
