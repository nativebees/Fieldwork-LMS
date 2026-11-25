import { getAssessment, rulesIdOf } from '../fixtures/assessments';
import { SOURCE_BY_ID } from '../fixtures/knowledge';
import { BLOCK_KIND_LABEL, instantiateTemplate } from '../fixtures/lessons';
import type { BlockKind, FieldChange, LearningProgram, Lesson, LessonBlock, ProgramChange, ProgramModule, RemovedLesson } from '../types';

/**
 * Pure operations on a learning program. The studio, the learner preview and the
 * exports all read the same program object, so every function here returns a new
 * program and never mutates its input.
 */

export interface LessonLocation {
  lesson: Lesson;
  module: ProgramModule;
  moduleIndex: number;
  /** Index within the module. */
  index: number;
  /** One-based position across the whole program. */
  position: number;
  total: number;
}

export function listLessons(program: LearningProgram): LessonLocation[] {
  const out: LessonLocation[] = [];
  const total = program.modules.reduce((n, m) => n + m.lessonIds.length, 0);
  let position = 0;
  program.modules.forEach((module, moduleIndex) => {
    module.lessonIds.forEach((id, index) => {
      const lesson = program.lessons[id];
      if (!lesson) return;
      position += 1;
      out.push({ lesson, module, moduleIndex, index, position, total });
    });
  });
  return out;
}

export function locate(program: LearningProgram, lessonId: string): LessonLocation | null {
  return listLessons(program).find((l) => l.lesson.id === lessonId) ?? null;
}

export function totalMinutes(program: LearningProgram): number {
  return listLessons(program).reduce((n, l) => n + l.lesson.durationMin, 0);
}

export function moduleMinutes(program: LearningProgram, moduleId: string): number {
  return listLessons(program)
    .filter((l) => l.module.id === moduleId)
    .reduce((n, l) => n + l.lesson.durationMin, 0);
}

export function whereLabel(loc: Pick<LessonLocation, 'module' | 'index'>): string {
  return `${loc.module.title}, position ${loc.index + 1}`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function mapModules(program: LearningProgram, fn: (m: ProgramModule) => ProgramModule): LearningProgram {
  return { ...program, modules: program.modules.map(fn) };
}

function setLesson(program: LearningProgram, lesson: Lesson): LearningProgram {
  return { ...program, lessons: { ...program.lessons, [lesson.id]: lesson } };
}

export function insertLesson(program: LearningProgram, lesson: Lesson, moduleId: string, index: number): LearningProgram {
  const target = program.modules.find((m) => m.id === moduleId) ?? program.modules[program.modules.length - 1];
  if (!target) return program;
  const next = mapModules(program, (m) => {
    if (m.id !== target.id) return m;
    const ids = [...m.lessonIds];
    ids.splice(clamp(index, 0, ids.length), 0, lesson.id);
    return { ...m, lessonIds: ids };
  });
  return setLesson(next, lesson);
}

export function addLessonFromTemplate(
  program: LearningProgram,
  templateId: string,
  moduleId: string,
  index: number,
  lessonId: string,
): LearningProgram {
  return insertLesson(program, instantiateTemplate(templateId, lessonId), moduleId, index);
}

/** Move a lesson. `toIndex` is the index in the destination after the lesson is lifted out. */
export function moveLesson(program: LearningProgram, lessonId: string, toModuleId: string, toIndex: number): LearningProgram {
  if (!program.lessons[lessonId] || !program.modules.some((m) => m.id === toModuleId)) return program;
  const lifted = mapModules(program, (m) => ({ ...m, lessonIds: m.lessonIds.filter((id) => id !== lessonId) }));
  return mapModules(lifted, (m) => {
    if (m.id !== toModuleId) return m;
    const ids = [...m.lessonIds];
    ids.splice(clamp(toIndex, 0, ids.length), 0, lessonId);
    return { ...m, lessonIds: ids };
  });
}

/** Move one step up or down the journey, crossing module boundaries. */
export function moveLessonByStep(program: LearningProgram, lessonId: string, direction: -1 | 1): LearningProgram {
  const loc = locate(program, lessonId);
  if (!loc) return program;
  const { module, moduleIndex, index } = loc;
  if (direction === -1) {
    if (index > 0) return moveLesson(program, lessonId, module.id, index - 1);
    const prev = program.modules[moduleIndex - 1];
    return prev ? moveLesson(program, lessonId, prev.id, prev.lessonIds.length) : program;
  }
  if (index < module.lessonIds.length - 1) return moveLesson(program, lessonId, module.id, index + 1);
  const next = program.modules[moduleIndex + 1];
  return next ? moveLesson(program, lessonId, next.id, 0) : program;
}

export function removeLesson(program: LearningProgram, lessonId: string): { program: LearningProgram; removed: RemovedLesson } | null {
  const loc = locate(program, lessonId);
  if (!loc) return null;
  const lessons = { ...program.lessons };
  delete lessons[lessonId];
  const next = mapModules({ ...program, lessons }, (m) => ({ ...m, lessonIds: m.lessonIds.filter((id) => id !== lessonId) }));
  return { program: next, removed: { lesson: loc.lesson, moduleId: loc.module.id, index: loc.index } };
}

export function restoreLesson(program: LearningProgram, removed: RemovedLesson): LearningProgram {
  if (program.lessons[removed.lesson.id]) return program;
  return insertLesson(program, removed.lesson, removed.moduleId, removed.index);
}

export function duplicateLesson(program: LearningProgram, lessonId: string, newId: string): LearningProgram {
  const loc = locate(program, lessonId);
  if (!loc) return program;
  const copy: Lesson = {
    ...loc.lesson,
    id: newId,
    title: `${loc.lesson.title} (copy)`,
    blocks: loc.lesson.blocks.map((b, i) => ({ ...b, id: `${newId}-b${i + 1}` })),
    assessment: { ...loc.lesson.assessment },
    aligned: { ...loc.lesson.aligned },
    sourceIds: [...loc.lesson.sourceIds],
  };
  return insertLesson(program, copy, loc.module.id, loc.index + 1);
}

/* ------------------------------------------------------------------ */
/* Flat ordering, used by drag and drop                                */
/* ------------------------------------------------------------------ */

export const DIVIDER_PREFIX = 'divider:';

/** Lessons in order, with a divider id in front of every module after the first. */
export function flattenProgram(program: LearningProgram): string[] {
  return program.modules.flatMap((m, i) => (i === 0 ? m.lessonIds : [`${DIVIDER_PREFIX}${m.id}`, ...m.lessonIds]));
}

/** Rebuild module membership from a flat order. Dividers must keep their relative order. */
export function reorderFlat(program: LearningProgram, flat: string[]): LearningProgram {
  const groups: string[][] = [[]];
  for (const id of flat) {
    if (id.startsWith(DIVIDER_PREFIX)) groups.push([]);
    else if (program.lessons[id]) groups[groups.length - 1].push(id);
  }
  if (groups.length !== program.modules.length) return program;
  return { ...program, modules: program.modules.map((m, i) => ({ ...m, lessonIds: groups[i] })) };
}

/** Translate a flat index into a module and an index inside it. */
export function flatIndexToLocation(program: LearningProgram, flatIndex: number): { moduleId: string; index: number } {
  const flat = flattenProgram(program);
  const at = clamp(flatIndex, 0, flat.length);
  let moduleIndex = 0;
  let index = 0;
  for (let i = 0; i < at; i += 1) {
    if (flat[i].startsWith(DIVIDER_PREFIX)) {
      moduleIndex += 1;
      index = 0;
    } else index += 1;
  }
  return { moduleId: program.modules[moduleIndex].id, index };
}

/* ------------------------------------------------------------------ */
/* Editing and review flags                                            */
/* ------------------------------------------------------------------ */

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A transparent rule, not a judgement of quality: an objective change is "material"
 * when fewer than 80% of the distinct words are shared with the aligned version.
 */
export function isMaterialObjectiveChange(before: string, after: string): boolean {
  const a = new Set(normalizeText(before).split(' ').filter(Boolean));
  const b = new Set(normalizeText(after).split(' ').filter(Boolean));
  if (a.size === 0 && b.size === 0) return false;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  const union = new Set([...a, ...b]).size;
  return shared / union < 0.8;
}

export interface LessonPatch {
  title?: string;
  objective?: string;
  durationMin?: number;
  practice?: string;
  evidence?: string;
}

export const MIN_DURATION = 1;
export const MAX_DURATION = 30;

export function isValidDuration(n: number): boolean {
  return Number.isInteger(n) && n >= MIN_DURATION && n <= MAX_DURATION;
}

/**
 * Apply a freeform edit.
 * - Title, sequence and objective edits flow straight to preview and export.
 * - A material objective change is flagged for alignment review.
 * - A change to the assessed requirements (practice, evidence) marks the lesson
 *   "custom, assessment needs review". The typed rules stop running until a person
 *   reviews the mapping or the text returns to the aligned version.
 */
export function applyLessonPatch(lesson: Lesson, patch: LessonPatch): Lesson {
  const next: Lesson = { ...lesson, ...patch };
  if (patch.durationMin !== undefined && !isValidDuration(patch.durationMin)) next.durationMin = lesson.durationMin;

  if (patch.objective !== undefined) {
    next.objectiveReview = isMaterialObjectiveChange(lesson.aligned.objective, next.objective) ? 'needs-review' : 'aligned';
  }

  if (patch.practice !== undefined || patch.evidence !== undefined) {
    const same =
      normalizeText(next.practice) === normalizeText(lesson.aligned.practice) &&
      normalizeText(next.evidence) === normalizeText(lesson.aligned.evidence);
    next.assessment = same
      ? {
          templateId: lesson.assessment.templateId,
          version: lesson.assessment.version,
          status: 'mapped',
          reviewedAt: lesson.assessment.reviewedAt,
        }
      : { templateId: lesson.assessment.templateId, version: lesson.assessment.version, status: 'custom-needs-review' };
  }
  return next;
}

export function updateLesson(program: LearningProgram, lessonId: string, patch: LessonPatch): LearningProgram {
  const lesson = program.lessons[lessonId];
  return lesson ? setLesson(program, applyLessonPatch(lesson, patch)) : program;
}

export function updateBlock(program: LearningProgram, lessonId: string, blockId: string, body: string): LearningProgram {
  const lesson = program.lessons[lessonId];
  if (!lesson) return program;
  return setLesson(program, { ...lesson, blocks: lesson.blocks.map((b) => (b.id === blockId ? { ...b, body } : b)) });
}

export function addBlock(program: LearningProgram, lessonId: string, kind: BlockKind, blockId: string): LearningProgram {
  const lesson = program.lessons[lessonId];
  if (!lesson) return program;
  return setLesson(program, { ...lesson, blocks: [...lesson.blocks, { id: blockId, kind, body: '' }] });
}

export function removeBlock(program: LearningProgram, lessonId: string, blockId: string): LearningProgram {
  const lesson = program.lessons[lessonId];
  if (!lesson) return program;
  return setLesson(program, { ...lesson, blocks: lesson.blocks.filter((b) => b.id !== blockId) });
}

/**
 * Resolve "custom, assessment needs review".
 * - restore: put the aligned requirement text back. The typed rules apply again.
 * - confirm: a person confirms the typed exercise still assesses the edited text.
 */
export function resolveAssessmentReview(lesson: Lesson, mode: 'restore' | 'confirm', at: string): Lesson {
  if (mode === 'restore') {
    return {
      ...lesson,
      practice: lesson.aligned.practice,
      evidence: lesson.aligned.evidence,
      assessment: { templateId: lesson.assessment.templateId, version: lesson.assessment.version, status: 'mapped' },
    };
  }
  return {
    ...lesson,
    aligned: { ...lesson.aligned, practice: lesson.practice, evidence: lesson.evidence },
    assessment: { templateId: lesson.assessment.templateId, version: lesson.assessment.version, status: 'mapped', reviewedAt: at },
  };
}

export function markObjectiveAligned(lesson: Lesson): Lesson {
  return { ...lesson, aligned: { ...lesson.aligned, objective: lesson.objective }, objectiveReview: 'aligned' };
}

/* ------------------------------------------------------------------ */
/* Coverage checklist                                                  */
/* ------------------------------------------------------------------ */

export type CheckStatus = 'ok' | 'missing' | 'review';
export type CheckKey = 'objective' | 'practice' | 'evidence' | 'sources';

export interface ChecklistItem {
  key: CheckKey;
  label: string;
  status: CheckStatus;
  note: string;
}

/**
 * Derived from the lesson's actual fields. It reports what is present, missing or
 * waiting for review. It does not rate instructional quality.
 */
export function lessonChecklist(lesson: Lesson): ChecklistItem[] {
  const rules = rulesIdOf(lesson.assessment);
  const criteria = getAssessment(lesson.assessment).criteria.length;
  const needsReview = lesson.sourceIds.filter((id) => SOURCE_BY_ID[id]?.review === 'review-required');

  const objective: ChecklistItem = !lesson.objective.trim()
    ? { key: 'objective', label: 'Objective', status: 'missing', note: 'No objective written.' }
    : lesson.objectiveReview === 'needs-review'
      ? {
          key: 'objective',
          label: 'Objective',
          status: 'review',
          note: 'Objective changed. Check it still matches the practice and evidence.',
        }
      : { key: 'objective', label: 'Objective', status: 'ok', note: 'Objective present.' };

  const practice: ChecklistItem = !lesson.practice.trim()
    ? { key: 'practice', label: 'Practice', status: 'missing', note: 'No assessed practice described.' }
    : { key: 'practice', label: 'Practice', status: 'ok', note: 'Assessed practice described.' };

  const evidence: ChecklistItem = !lesson.evidence.trim()
    ? { key: 'evidence', label: 'Evidence', status: 'missing', note: 'No evidence of success described.' }
    : lesson.assessment.status === 'custom-needs-review'
      ? {
          key: 'evidence',
          label: 'Evidence',
          status: 'review',
          note: 'Custom. Assessment needs review before any criterion is recorded.',
        }
      : {
          key: 'evidence',
          label: 'Evidence',
          status: 'ok',
          note: `${criteria} ${criteria === 1 ? 'criterion' : 'criteria'} mapped (${rules}).`,
        };

  const sources: ChecklistItem =
    needsReview.length > 0
      ? {
          key: 'sources',
          label: 'Sources',
          status: 'review',
          note: `${needsReview.length} cited ${needsReview.length === 1 ? 'source needs' : 'sources need'} review.`,
        }
      : lesson.sourceIds.length === 0
        ? { key: 'sources', label: 'Sources', status: 'ok', note: 'No source cited.' }
        : { key: 'sources', label: 'Sources', status: 'ok', note: 'Cited sources are reviewed or marked synthetic.' };

  return [objective, practice, evidence, sources];
}

export interface ProgramCheckSummary {
  key: CheckKey;
  label: string;
  ok: number;
  total: number;
  open: Array<{ lessonId: string; title: string; status: CheckStatus; note: string }>;
}

export function programChecklist(program: LearningProgram): ProgramCheckSummary[] {
  const keys: Array<{ key: CheckKey; label: string }> = [
    { key: 'objective', label: 'Objective' },
    { key: 'practice', label: 'Practice' },
    { key: 'evidence', label: 'Evidence' },
    { key: 'sources', label: 'Sources' },
  ];
  const lessons = listLessons(program).map((l) => ({ lesson: l.lesson, items: lessonChecklist(l.lesson) }));
  return keys.map(({ key, label }) => {
    const rows = lessons.map((l) => ({ lesson: l.lesson, item: l.items.find((i) => i.key === key)! }));
    return {
      key,
      label,
      ok: rows.filter((r) => r.item.status === 'ok').length,
      total: rows.length,
      open: rows
        .filter((r) => r.item.status !== 'ok')
        .map((r) => ({ lessonId: r.lesson.id, title: r.lesson.title, status: r.item.status, note: r.item.note })),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Criteria carried by the program                                     */
/* ------------------------------------------------------------------ */

export interface ProgramCriterion {
  lessonId: string;
  lessonTitle: string;
  criterionId: string;
  label: string;
  rulesId: string;
  mapped: boolean;
}

export function programCriteria(program: LearningProgram): ProgramCriterion[] {
  return listLessons(program).flatMap(({ lesson }) =>
    getAssessment(lesson.assessment).criteria.map((c) => ({
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      criterionId: c.id,
      label: c.label,
      rulesId: rulesIdOf(lesson.assessment),
      mapped: lesson.assessment.status === 'mapped',
    })),
  );
}

/** Lessons whose mapped assessment records at least one of the given criteria. */
export function lessonsWithMappedCriteria(program: LearningProgram, criterionIds: string[]): ProgramCriterion[] {
  return programCriteria(program).filter((c) => c.mapped && criterionIds.includes(c.criterionId));
}

/* ------------------------------------------------------------------ */
/* Diff                                                                */
/* ------------------------------------------------------------------ */

function assessmentLabel(lesson: Lesson): string {
  const base = rulesIdOf(lesson.assessment);
  return lesson.assessment.status === 'custom-needs-review' ? `${base} · custom, needs review` : base;
}

function criterionLabels(lesson: Lesson): Map<string, string> {
  return new Map(getAssessment(lesson.assessment).criteria.map((c) => [c.id, `${c.label} (${c.id})`]));
}

function assessmentChange(before: Lesson, after: Lesson, lessonId: string, title: string): ProgramChange | null {
  if (assessmentLabel(before) === assessmentLabel(after)) return null;
  const a = criterionLabels(before);
  const b = criterionLabels(after);
  return {
    type: 'assessment-changed',
    lessonId,
    title,
    before: assessmentLabel(before),
    after: assessmentLabel(after),
    criteriaAdded: [...b.entries()].filter(([id]) => !a.has(id)).map(([, label]) => label),
    criteriaRemoved: [...a.entries()].filter(([id]) => !b.has(id)).map(([, label]) => label),
  };
}

function blockChanges(before: LessonBlock[], after: LessonBlock[]): FieldChange[] {
  const out: FieldChange[] = [];
  const a = new Map(before.map((b) => [b.id, b]));
  const b = new Map(after.map((x) => [x.id, x]));
  for (const block of before) {
    const match = b.get(block.id);
    if (!match) out.push({ field: `Removed: ${BLOCK_KIND_LABEL[block.kind]}`, before: block.body, after: '' });
    else if (match.body !== block.body) out.push({ field: BLOCK_KIND_LABEL[block.kind], before: block.body, after: match.body });
  }
  for (const block of after) {
    if (!a.has(block.id)) out.push({ field: `Added: ${BLOCK_KIND_LABEL[block.kind]}`, before: '', after: block.body });
  }
  return out;
}

function fieldChanges(before: Lesson, after: Lesson): FieldChange[] {
  const out: FieldChange[] = [];
  if (before.title !== after.title) out.push({ field: 'Title', before: before.title, after: after.title });
  if (before.objective !== after.objective) out.push({ field: 'Objective', before: before.objective, after: after.objective });
  if (before.durationMin !== after.durationMin) {
    out.push({ field: 'Duration', before: `${before.durationMin} min`, after: `${after.durationMin} min` });
  }
  if (before.practice !== after.practice) out.push({ field: 'Practice', before: before.practice, after: after.practice });
  if (before.evidence !== after.evidence) out.push({ field: 'Evidence', before: before.evidence, after: after.evidence });
  return [...out, ...blockChanges(before.blocks, after.blocks)];
}

/** Ids that keep their relative order between two sequences (longest common subsequence). */
function stableIds(a: string[], b: string[]): Set<string> {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const keep = new Set<string>();
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      keep.add(a[i]);
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) i += 1;
    else j += 1;
  }
  return keep;
}

/** Compare two versions of a program. Drives every "what changed" view and proposal preview. */
export function diffPrograms(before: LearningProgram, after: LearningProgram): ProgramChange[] {
  const changes: ProgramChange[] = [];

  const meta: Array<[string, string, string]> = [
    ['Program title', before.title, after.title],
    ['Audience', before.audience, after.audience],
    ['Goal', before.goal, after.goal],
    ['Review owner', before.reviewOwner, after.reviewOwner],
  ];
  for (const [field, a, b] of meta) if (a !== b) changes.push({ type: 'meta', field, before: a, after: b });

  const locA = new Map(listLessons(before).map((l) => [l.lesson.id, l]));
  const locB = new Map(listLessons(after).map((l) => [l.lesson.id, l]));
  const removed = [...locA.values()].filter((l) => !locB.has(l.lesson.id));
  const added = [...locB.values()].filter((l) => !locA.has(l.lesson.id));

  const consumed = new Set<string>();
  for (const add of added) {
    const swap = removed.find((r) => !consumed.has(r.lesson.id) && r.module.id === add.module.id && r.index === add.index);
    if (swap) {
      consumed.add(swap.lesson.id);
      changes.push({
        type: 'lesson-replaced',
        lessonId: add.lesson.id,
        removedId: swap.lesson.id,
        before: swap.lesson.title,
        after: add.lesson.title,
        where: whereLabel(add),
      });
      const change = assessmentChange(swap.lesson, add.lesson, add.lesson.id, add.lesson.title);
      if (change) changes.push(change);
    } else {
      changes.push({ type: 'lesson-added', lessonId: add.lesson.id, title: add.lesson.title, where: whereLabel(add) });
    }
  }
  for (const r of removed) {
    if (!consumed.has(r.lesson.id)) {
      changes.push({ type: 'lesson-removed', lessonId: r.lesson.id, title: r.lesson.title, where: whereLabel(r) });
    }
  }

  const commonA = [...locA.keys()].filter((id) => locB.has(id));
  const commonB = [...locB.keys()].filter((id) => locA.has(id));
  const stable = stableIds(commonA, commonB);

  for (const id of commonB) {
    const a = locA.get(id)!;
    const b = locB.get(id)!;
    if (a.module.id !== b.module.id || !stable.has(id)) {
      changes.push({ type: 'lesson-moved', lessonId: id, title: b.lesson.title, from: whereLabel(a), to: whereLabel(b) });
    }
    const fields = fieldChanges(a.lesson, b.lesson);
    if (fields.length > 0) changes.push({ type: 'lesson-edited', lessonId: id, title: b.lesson.title, fields });
    const change = assessmentChange(a.lesson, b.lesson, id, b.lesson.title);
    if (change) changes.push(change);
  }

  return changes;
}

/** One line per change, for logs and plain-text exports. */
export function describeChange(change: ProgramChange): string {
  switch (change.type) {
    case 'meta':
      return `${change.field} changed from "${change.before}" to "${change.after}".`;
    case 'lesson-added':
      return `Added "${change.title}" (${change.where}).`;
    case 'lesson-removed':
      return `Removed "${change.title}" (was ${change.where}).`;
    case 'lesson-replaced':
      return `Replaced "${change.before}" with "${change.after}" (${change.where}).`;
    case 'lesson-moved':
      return `Moved "${change.title}" from ${change.from} to ${change.to}.`;
    case 'lesson-edited':
      return `Edited "${change.title}": ${change.fields.map((f) => f.field).join(', ')}.`;
    case 'assessment-changed': {
      const parts = [`Assessment for "${change.title}" changed from ${change.before} to ${change.after}.`];
      if (change.criteriaAdded.length) parts.push(`Criteria added: ${change.criteriaAdded.join(', ')}.`);
      if (change.criteriaRemoved.length) parts.push(`Criteria removed: ${change.criteriaRemoved.join(', ')}.`);
      return parts.join(' ');
    }
  }
}
