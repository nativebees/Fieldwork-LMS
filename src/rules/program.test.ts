import { describe, expect, it } from 'vitest';
import { TEMPLATE_IDS, createDefaultProgram } from '../fixtures/lessons';
import {
  addLessonFromTemplate,
  applyLessonPatch,
  diffPrograms,
  duplicateLesson,
  flatIndexToLocation,
  flattenProgram,
  isMaterialObjectiveChange,
  lessonChecklist,
  listLessons,
  moveLesson,
  moveLessonByStep,
  programChecklist,
  removeLesson,
  reorderFlat,
  resolveAssessmentReview,
  restoreLesson,
  totalMinutes,
} from './program';

const order = (p: ReturnType<typeof createDefaultProgram>) => listLessons(p).map((l) => l.lesson.id);

describe('program sequence', () => {
  it('starts as two modules, four lessons, 22 minutes', () => {
    const p = createDefaultProgram();
    expect(p.modules.map((m) => m.lessonIds)).toEqual([
      ['lesson-1', 'lesson-2'],
      ['lesson-3', 'lesson-4'],
    ]);
    expect(totalMinutes(p)).toBe(22);
  });

  it('moves a lesson within and across modules', () => {
    const p = createDefaultProgram();
    expect(order(moveLesson(p, 'lesson-4', 'module-1', 0))).toEqual(['lesson-4', 'lesson-1', 'lesson-2', 'lesson-3']);
    const stepped = moveLessonByStep(p, 'lesson-2', 1);
    expect(stepped.modules[1].lessonIds).toEqual(['lesson-2', 'lesson-3', 'lesson-4']);
    expect(moveLessonByStep(p, 'lesson-1', -1)).toBe(p);
  });

  it('reorders from a flat list, the way drag and drop reports it', () => {
    const p = createDefaultProgram();
    expect(flattenProgram(p)).toEqual(['lesson-1', 'lesson-2', 'divider:module-2', 'lesson-3', 'lesson-4']);
    const next = reorderFlat(p, ['lesson-2', 'divider:module-2', 'lesson-1', 'lesson-3', 'lesson-4']);
    expect(next.modules.map((m) => m.lessonIds)).toEqual([['lesson-2'], ['lesson-1', 'lesson-3', 'lesson-4']]);
    expect(flatIndexToLocation(p, 3)).toEqual({ moduleId: 'module-2', index: 0 });
    expect(flatIndexToLocation(p, 2)).toEqual({ moduleId: 'module-1', index: 2 });
  });

  it('adds from a template, duplicates, removes and restores', () => {
    let p = addLessonFromTemplate(createDefaultProgram(), TEMPLATE_IDS.claims, 'module-2', 0, 'lesson-9');
    expect(p.modules[1].lessonIds[0]).toBe('lesson-9');
    p = duplicateLesson(p, 'lesson-9', 'lesson-10');
    expect(p.lessons['lesson-10'].title).toBe('Check claims before handoff (copy)');
    expect(p.modules[1].lessonIds.slice(0, 2)).toEqual(['lesson-9', 'lesson-10']);
    const removed = removeLesson(p, 'lesson-9')!;
    expect(removed.program.lessons['lesson-9']).toBeUndefined();
    expect(order(restoreLesson(removed.program, removed.removed))).toEqual(order(p));
  });
});

describe('edits and review flags', () => {
  const lesson = createDefaultProgram().lessons['lesson-2'];

  it('title and small objective edits keep the assessment mapped', () => {
    const edited = applyLessonPatch(lesson, { title: 'Map the brief workflow', objective: `${lesson.objective} ` });
    expect(edited.assessment.status).toBe('mapped');
    expect(edited.objectiveReview).toBe('aligned');
  });

  it('a material objective change is flagged for alignment review', () => {
    expect(isMaterialObjectiveChange(lesson.objective, 'Write a press release for the launch.')).toBe(true);
    const edited = applyLessonPatch(lesson, { objective: 'Write a press release for the launch.' });
    expect(edited.objectiveReview).toBe('needs-review');
    expect(lessonChecklist(edited).find((c) => c.key === 'objective')!.status).toBe('review');
  });

  it('a freeform edit to an assessed requirement becomes custom, assessment needs review', () => {
    const edited = applyLessonPatch(lesson, { practice: 'Write a haiku about the workflow.' });
    expect(edited.assessment.status).toBe('custom-needs-review');
    expect(lessonChecklist(edited).find((c) => c.key === 'evidence')!.status).toBe('review');
    // Typing the aligned text back restores the mapping without a review.
    expect(applyLessonPatch(edited, { practice: lesson.practice }).assessment.status).toBe('mapped');
  });

  it('review can restore the aligned text or confirm the mapping', () => {
    const edited = applyLessonPatch(lesson, { evidence: 'Something new.' });
    const restored = resolveAssessmentReview(edited, 'restore', 'now');
    expect(restored.evidence).toBe(lesson.evidence);
    expect(restored.assessment.status).toBe('mapped');
    const confirmed = resolveAssessmentReview(edited, 'confirm', 'now');
    expect(confirmed.evidence).toBe('Something new.');
    expect(confirmed.assessment).toMatchObject({ status: 'mapped', reviewedAt: 'now' });
  });

  it('rejects an invalid duration', () => {
    expect(applyLessonPatch(lesson, { durationMin: 0 }).durationMin).toBe(lesson.durationMin);
    expect(applyLessonPatch(lesson, { durationMin: 4 }).durationMin).toBe(4);
  });
});

describe('coverage checklist', () => {
  it('is derived from fields: missing practice and unresolved source review show up', () => {
    const p = createDefaultProgram();
    const sources = programChecklist(p).find((c) => c.key === 'sources')!;
    expect(sources.ok).toBe(3);
    expect(sources.open[0]).toMatchObject({ lessonId: 'lesson-3', status: 'review' });

    const blank = applyLessonPatch(p.lessons['lesson-1'], { practice: '   ' });
    expect(lessonChecklist(blank).find((c) => c.key === 'practice')!.status).toBe('missing');
  });
});

describe('diff', () => {
  it('reports replacement, move, edit and assessment changes', () => {
    const before = createDefaultProgram();
    let after = removeLesson(before, 'lesson-3')!.program;
    after = addLessonFromTemplate(after, TEMPLATE_IDS.claims, 'module-2', 0, 'lesson-9');
    after = { ...after, lessons: { ...after.lessons, 'lesson-1': applyLessonPatch(after.lessons['lesson-1'], { title: 'Save the context' }) } };
    const changes = diffPrograms(before, after);
    expect(changes.find((c) => c.type === 'lesson-replaced')).toMatchObject({
      before: 'Package a repeatable instruction',
      after: 'Check claims before handoff',
    });
    const assessment = changes.find((c) => c.type === 'assessment-changed');
    expect(assessment).toMatchObject({ before: 'instruction-package@1', after: 'claim-check@1' });
    expect(changes.find((c) => c.type === 'lesson-edited')).toMatchObject({ lessonId: 'lesson-1' });

    const moved = diffPrograms(before, moveLesson(before, 'lesson-4', 'module-1', 0));
    expect(moved).toHaveLength(1);
    expect(moved[0]).toMatchObject({ type: 'lesson-moved', lessonId: 'lesson-4' });
    expect(diffPrograms(before, createDefaultProgram())).toEqual([]);
  });
});
