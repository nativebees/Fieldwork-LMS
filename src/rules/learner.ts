import { getAssessment, rulesIdOf } from '../fixtures/assessments';
import type { LearningProgram, Lesson, PracticeAttempt } from '../types';
import { listLessons } from './program';

/**
 * Learner progress, derived from attempts.
 *
 * Two things are kept apart on purpose:
 * - practice attempted (the learner did the exercise), and
 * - criteria demonstrated (a scored attempt met a criterion under the lesson's
 *   current rule version).
 * An attempt made against an older rule version never counts toward new criteria.
 */

export type LessonStatus = 'not-started' | 'attempted' | 'demonstrated' | 'needs-review';

export interface LessonProgress {
  lessonId: string;
  rulesId: string;
  /** False while the lesson is "custom, assessment needs review". */
  scorable: boolean;
  attempted: boolean;
  /** Scored attempts against the lesson's current rule version. */
  current: PracticeAttempt[];
  /** Attempts against an earlier version, or unscored practice. */
  earlier: PracticeAttempt[];
  criteria: Array<{ id: string; label: string; demonstrated: boolean }>;
  demonstrated: number;
  status: LessonStatus;
}

export function lessonProgress(lesson: Lesson, attempts: PracticeAttempt[]): LessonProgress {
  const rulesId = rulesIdOf(lesson.assessment);
  const scorable = lesson.assessment.status === 'mapped';
  const mine = attempts.filter((a) => a.lessonId === lesson.id);
  const current = mine.filter((a) => a.scored && a.rulesId === rulesId);
  const earlier = mine.filter((a) => !(a.scored && a.rulesId === rulesId));

  const criteria = scorable
    ? getAssessment(lesson.assessment).criteria.map((c) => ({
        id: c.id,
        label: c.label,
        demonstrated: current.some((a) => a.results.some((r) => r.criterionId === c.id && r.met)),
      }))
    : [];
  const demonstrated = criteria.filter((c) => c.demonstrated).length;

  let status: LessonStatus = 'not-started';
  if (!scorable) status = 'needs-review';
  else if (criteria.length > 0 && demonstrated === criteria.length) status = 'demonstrated';
  else if (mine.length > 0) status = 'attempted';

  return { lessonId: lesson.id, rulesId, scorable, attempted: mine.length > 0, current, earlier, criteria, demonstrated, status };
}

export interface ProgramProgress {
  lessons: number;
  attempted: number;
  criteriaTotal: number;
  criteriaDemonstrated: number;
  byLesson: Record<string, LessonProgress>;
}

export function programProgress(program: LearningProgram, attempts: PracticeAttempt[]): ProgramProgress {
  const entries = listLessons(program).map((l) => lessonProgress(l.lesson, attempts));
  return {
    lessons: entries.length,
    attempted: entries.filter((e) => e.attempted).length,
    criteriaTotal: entries.reduce((n, e) => n + e.criteria.length, 0),
    criteriaDemonstrated: entries.reduce((n, e) => n + e.demonstrated, 0),
    byLesson: Object.fromEntries(entries.map((e) => [e.lessonId, e])),
  };
}

/** Attempts whose lesson has since been removed or replaced. They are kept, never re-scored. */
export function orphanedAttempts(program: LearningProgram, attempts: PracticeAttempt[]): PracticeAttempt[] {
  return attempts.filter((a) => !program.lessons[a.lessonId]);
}
