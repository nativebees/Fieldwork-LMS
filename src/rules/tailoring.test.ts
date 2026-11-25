import { describe, expect, it } from 'vitest';
import { ACCOUNT } from '../fixtures/account';
import { rulesIdOf } from '../fixtures/assessments';
import { PROGRAM_META, TEMPLATE_IDS, createDefaultProgram } from '../fixtures/lessons';
import { addLessonFromTemplate, diffPrograms, listLessons, programCriteria, removeLesson, totalMinutes } from './program';
import {
  SUGGESTION_ORDER,
  evaluateSuggestions,
  proposeAdaptToWorkflow,
  proposeSuggestions,
  proposeTenMinuteVersion,
  proposeVerificationStep,
} from './tailoring';

const known = { account: ACCOUNT, constraintKnown: true };
const unknown = { account: ACCOUNT, constraintKnown: false };

describe('the customer changes the brief', () => {
  it('all four suggestions start pending', () => {
    expect(evaluateSuggestions(createDefaultProgram(), []).map((s) => s.status)).toEqual(['pending', 'pending', 'pending', 'pending']);
  });

  it('produces an inspectable program and assessment revision', () => {
    const before = createDefaultProgram();
    const result = proposeSuggestions(before, SUGGESTION_ORDER, [], 5);
    if (!result.ok) throw new Error(result.reason);
    const after = result.proposal.nextProgram;

    // The proposal does not touch the current program.
    expect(before).toEqual(createDefaultProgram());

    const sequence = listLessons(after).map((l) => [l.lesson.title, rulesIdOf(l.lesson.assessment)]);
    expect(sequence).toEqual([
      ['Create a reusable campaign-brief context', 'context-pack@1'],
      ['Map a reviewable workflow', 'workflow-sequence@2'],
      ['Check claims before handoff', 'claim-check@1'],
      ['Apply the workflow to a new brief', 'transfer-brief@2'],
    ]);
    expect(after.title).toBe(PROGRAM_META.revised.title);
    expect(after.reviewOwner).toMatch(/Campaign owner/);

    const ids = programCriteria(after).map((c) => c.criterionId);
    expect(ids).toEqual(expect.arrayContaining(['cl.identify', 'cl.evidence', 'wf.approval-before-share', 'tr.identify-claim']));
    expect(ids).not.toContain('ip.inputs-format');

    const changes = diffPrograms(before, after);
    expect(changes.some((c) => c.type === 'lesson-replaced')).toBe(true);
    expect(changes.filter((c) => c.type === 'assessment-changed')).toHaveLength(3);
    expect(evaluateSuggestions(after, []).every((s) => s.status === 'applied')).toBe(true);
  });

  it('a manual swap in the studio counts as applied', () => {
    let p = removeLesson(createDefaultProgram(), 'lesson-3')!.program;
    p = addLessonFromTemplate(p, TEMPLATE_IDS.claims, 'module-2', 0, 'lesson-9');
    expect(evaluateSuggestions(p, []).find((s) => s.id === 's-claims')!.status).toBe('applied');
  });

  it('dismissed suggestions are reported as dismissed and can still be proposed', () => {
    const p = createDefaultProgram();
    expect(evaluateSuggestions(p, ['s-goal']).find((s) => s.id === 's-goal')!.status).toBe('dismissed');
    expect(proposeSuggestions(p, ['s-goal'], ['s-goal'], 5).ok).toBe(true);
  });
});

describe('tailoring actions', () => {
  it('add a verification step moves the workflow lesson to a new assessment version', () => {
    const p = createDefaultProgram();
    const result = proposeVerificationStep(p, 'lesson-2', known);
    if (!result.ok) throw new Error(result.reason);
    const lesson = result.proposal.nextProgram.lessons['lesson-2'];
    expect(rulesIdOf(lesson.assessment)).toBe('workflow-sequence@2');
    expect(lesson.practice).toMatch(/campaign owner approves/);
    // Applying it twice is refused with a reason.
    expect(proposeVerificationStep(result.proposal.nextProgram, 'lesson-2', known)).toMatchObject({ ok: false });
  });

  it('add a verification step on a lesson with no typed variant adds unscored practice only', () => {
    const p = createDefaultProgram();
    const result = proposeVerificationStep(p, 'lesson-1', known);
    if (!result.ok) throw new Error(result.reason);
    const lesson = result.proposal.nextProgram.lessons['lesson-1'];
    expect(rulesIdOf(lesson.assessment)).toBe('context-pack@1');
    expect(lesson.blocks.length).toBe(p.lessons['lesson-1'].blocks.length + 2);
    expect(result.proposal.reason).toMatch(/No new criterion/);
  });

  it('adapt to the workflow depends on the account and on what the customer has said', () => {
    const p = createDefaultProgram();
    const a = proposeAdaptToWorkflow(p, 'lesson-2', unknown);
    const b = proposeAdaptToWorkflow(p, 'lesson-2', known);
    if (!a.ok || !b.ok) throw new Error('expected proposals');
    const example = (r: typeof a) => r.proposal.nextProgram.lessons['lesson-2'].blocks.find((x) => x.kind === 'worked-example')!.body;
    expect(example(a)).toContain('Meridian Works');
    expect(example(a)).not.toEqual(example(b));
    expect(example(b)).toMatch(/campaign owner approves/);
    expect(proposeAdaptToWorkflow(a.proposal.nextProgram, 'lesson-2', unknown)).toMatchObject({ ok: false });
  });

  it('the ten-minute version totals ten minutes and keeps every criterion', () => {
    const p = createDefaultProgram();
    const result = proposeTenMinuteVersion(p);
    if (!result.ok) throw new Error(result.reason);
    const next = result.proposal.nextProgram;
    expect(totalMinutes(next)).toBe(10);
    expect(programCriteria(next).map((c) => c.criterionId)).toEqual(programCriteria(p).map((c) => c.criterionId));
    expect(listLessons(next).every((l) => !l.lesson.blocks.some((b) => b.kind === 'worked-example'))).toBe(true);
    expect(proposeTenMinuteVersion(next)).toMatchObject({ ok: false });
  });
});
