import { GENERIC_VERIFICATION_BLOCKS, PROGRAM_META, TEMPLATE_IDS, VERIFICATION_VARIANTS, instantiateTemplate } from '../fixtures/lessons';
import type {
  AccountContext,
  ConstraintSuggestion,
  LearningProgram,
  Lesson,
  LessonBlock,
  Proposal,
  SuggestionId,
  SuggestionStatus,
} from '../types';
import { insertLesson, listLessons, locate, removeLesson, totalMinutes } from './program';

/**
 * Deterministic program transformations.
 *
 * Every function here returns a proposal: a full next version of the program that
 * the author previews and then accepts or cancels. Nothing is applied automatically
 * and nothing here is model output.
 */

export type ProposalResult = { ok: true; proposal: Proposal } | { ok: false; reason: string };

export interface TailoringContext {
  account: AccountContext;
  constraintKnown: boolean;
}

const idFor = (counter: number, offset: number) => `lesson-${counter + offset}`;

function replaceLessonObject(program: LearningProgram, lesson: Lesson): LearningProgram {
  return { ...program, lessons: { ...program.lessons, [lesson.id]: lesson } };
}

/* ------------------------------------------------------------------ */
/* Verification variant                                                */
/* ------------------------------------------------------------------ */

function hasTypedVerification(lesson: Lesson): boolean {
  const { templateId, version } = lesson.assessment;
  if (templateId === 'claim-check' || templateId === 'approval-gate') return true;
  return (templateId === 'workflow-sequence' || templateId === 'transfer-brief') && version >= 2;
}

function upsertBlock(blocks: LessonBlock[], kind: LessonBlock['kind'], body: string, id: string): LessonBlock[] {
  const at = blocks.findIndex((b) => b.kind === kind);
  if (at === -1) return [...blocks, { id, kind, body }];
  return blocks.map((b, i) => (i === at ? { ...b, body } : b));
}

/** Move a workflow or transfer lesson to its verified variant, with a newer typed assessment. */
export function applyVerificationVariant(lesson: Lesson, forConstraint: boolean): Lesson | null {
  const variant = VERIFICATION_VARIANTS[lesson.templateId];
  if (!variant || lesson.assessment.templateId !== variant.assessment.templateId || hasTypedVerification(lesson)) return null;
  let blocks = lesson.blocks;
  if (variant.workedExample) blocks = upsertBlock(blocks, 'worked-example', variant.workedExample, `${lesson.id}-v-example`);
  if (variant.transferTask) blocks = upsertBlock(blocks, 'transfer-task', variant.transferTask, `${lesson.id}-v-task`);
  if (!blocks.some((b) => b.body === variant.sourceBlock)) {
    blocks = [...blocks, { id: `${lesson.id}-v-source`, kind: 'source-reference', body: variant.sourceBlock }];
  }
  return {
    ...lesson,
    objective: variant.objective,
    blocks,
    practice: variant.practice,
    evidence: variant.evidence,
    assessment: { ...variant.assessment, status: 'mapped' },
    sourceIds: [...new Set([...lesson.sourceIds, ...variant.sourceIds])],
    aligned: { objective: variant.objective, practice: variant.practice, evidence: variant.evidence },
    objectiveReview: 'aligned',
    revisedFor: forConstraint ? 'customer-constraint' : lesson.revisedFor,
  };
}

/* ------------------------------------------------------------------ */
/* Customer-constraint suggestions                                     */
/* ------------------------------------------------------------------ */

const SUGGESTION_COPY: Record<SuggestionId, { title: string; why: string }> = {
  's-claims': {
    title: 'Replace the generic Skill lesson with a claim check',
    why: 'Dana said the sticking point is unsupported product claims. Packaging the instruction would practise the part that was not hurting.',
  },
  's-workflow': {
    title: 'Add a claim check and owner approval to the workflow lesson',
    why: 'Approval must stay with the campaign owner, so the workflow needs a named approval step after the claim check.',
  },
  's-transfer': {
    title: 'Make the transfer task include a claim check',
    why: 'Transfer should prove the new habit. A fresh brief with one unsupported claim tests exactly what Dana described.',
  },
  's-goal': {
    title: 'Name source checks and the approval owner in the program goal',
    why: 'The customer brief should say what the program is for in Dana’s terms and who approves the result.',
  },
};

export const SUGGESTION_ORDER: SuggestionId[] = ['s-claims', 's-workflow', 's-transfer', 's-goal'];

function lessonsByTemplate(program: LearningProgram, templateId: string): Lesson[] {
  return listLessons(program)
    .map((l) => l.lesson)
    .filter((l) => l.templateId === templateId);
}

function suggestionState(
  program: LearningProgram,
  id: SuggestionId,
): { status: 'applied' | 'pending' | 'not-applicable'; lessonIds: string[] } {
  if (id === 's-claims') {
    const skill = lessonsByTemplate(program, TEMPLATE_IDS.skill);
    const claims = listLessons(program)
      .map((l) => l.lesson)
      .filter((l) => l.assessment.templateId === 'claim-check' && l.assessment.status === 'mapped');
    if (claims.length > 0 && skill.length === 0) return { status: 'applied', lessonIds: claims.map((l) => l.id) };
    return { status: 'pending', lessonIds: [...skill, ...claims].map((l) => l.id) };
  }
  if (id === 's-workflow' || id === 's-transfer') {
    const templateId = id === 's-workflow' ? 'workflow-sequence' : 'transfer-brief';
    const lessons = listLessons(program)
      .map((l) => l.lesson)
      .filter((l) => l.assessment.templateId === templateId);
    if (lessons.length === 0) return { status: 'not-applicable', lessonIds: [] };
    const pending = lessons.filter((l) => l.assessment.version < 2);
    return pending.length === 0
      ? { status: 'applied', lessonIds: lessons.map((l) => l.id) }
      : { status: 'pending', lessonIds: pending.map((l) => l.id) };
  }
  const done = program.goal !== PROGRAM_META.baseline.goal && program.reviewOwner !== PROGRAM_META.baseline.reviewOwner;
  return { status: done ? 'applied' : 'pending', lessonIds: [] };
}

/** Status is derived from the program itself, so a manual edit in the studio counts. */
export function evaluateSuggestions(program: LearningProgram, dismissed: SuggestionId[]): ConstraintSuggestion[] {
  return SUGGESTION_ORDER.map((id) => {
    const state = suggestionState(program, id);
    const status: SuggestionStatus = state.status === 'pending' && dismissed.includes(id) ? 'dismissed' : state.status;
    return { id, ...SUGGESTION_COPY[id], status, lessonIds: state.lessonIds };
  });
}

interface Step {
  program: LearningProgram;
  idsUsed: number;
  lessonIds: string[];
  selectLessonId?: string;
}

function applySuggestion(program: LearningProgram, id: SuggestionId, counter: number): Step {
  if (id === 's-claims') {
    const skill = lessonsByTemplate(program, TEMPLATE_IDS.skill);
    const hasClaims = listLessons(program).some((l) => l.lesson.assessment.templateId === 'claim-check');
    let next = program;
    let idsUsed = 0;
    const lessonIds: string[] = [];
    let selectLessonId: string | undefined;
    if (!hasClaims) {
      const newId = idFor(counter, 0);
      idsUsed = 1;
      const lesson: Lesson = { ...instantiateTemplate(TEMPLATE_IDS.claims, newId), revisedFor: 'customer-constraint' };
      const first = skill[0] ? locate(next, skill[0].id) : null;
      if (first) {
        const lifted = removeLesson(next, first.lesson.id)!;
        next = insertLesson(lifted.program, lesson, first.module.id, first.index);
      } else {
        const last = next.modules[next.modules.length - 1];
        next = insertLesson(next, lesson, last.id, 0);
      }
      lessonIds.push(newId);
      selectLessonId = newId;
    }
    for (const lesson of lessonsByTemplate(next, TEMPLATE_IDS.skill)) next = removeLesson(next, lesson.id)!.program;
    return { program: next, idsUsed, lessonIds, selectLessonId };
  }

  if (id === 's-workflow' || id === 's-transfer') {
    const templateId = id === 's-workflow' ? 'workflow-sequence' : 'transfer-brief';
    let next = program;
    const lessonIds: string[] = [];
    for (const { lesson } of listLessons(program)) {
      if (lesson.assessment.templateId !== templateId) continue;
      const upgraded = applyVerificationVariant(lesson, true);
      if (upgraded) {
        next = replaceLessonObject(next, upgraded);
        lessonIds.push(lesson.id);
      }
    }
    return { program: next, idsUsed: 0, lessonIds, selectLessonId: lessonIds[0] };
  }

  return {
    program: {
      ...program,
      title: program.title === PROGRAM_META.baseline.title ? PROGRAM_META.revised.title : program.title,
      goal: PROGRAM_META.revised.goal,
      reviewOwner: PROGRAM_META.revised.reviewOwner,
    },
    idsUsed: 0,
    lessonIds: [],
  };
}

/** Build one previewable proposal from one or more pending suggestions. */
export function proposeSuggestions(
  program: LearningProgram,
  ids: SuggestionId[],
  dismissed: SuggestionId[],
  counter: number,
): ProposalResult {
  const pending = evaluateSuggestions(program, dismissed).filter(
    (s) => ids.includes(s.id) && (s.status === 'pending' || s.status === 'dismissed'),
  );
  if (pending.length === 0) return { ok: false, reason: 'These changes are already in the program.' };
  let next = program;
  let idsUsed = 0;
  const lessonIds: string[] = [];
  let selectLessonId: string | undefined;
  const logEntries: NonNullable<Proposal['logEntries']> = [];
  for (const s of pending) {
    const step = applySuggestion(next, s.id, counter + idsUsed);
    next = step.program;
    idsUsed += step.idsUsed;
    lessonIds.push(...step.lessonIds);
    selectLessonId ??= step.selectLessonId;
    logEntries.push({ summary: s.title, reason: s.why, lessonIds: step.lessonIds, suggestionId: s.id });
  }
  const single = pending.length === 1 ? pending[0] : null;
  return {
    ok: true,
    proposal: {
      id: `proposal-constraint-${pending.map((s) => s.id).join('+')}`,
      kind: 'constraint',
      title: single ? single.title : 'Revise the program for the customer’s constraint',
      reason: single ? single.why : pending.map((s) => s.why).join(' '),
      nextProgram: next,
      idsUsed,
      lessonIds,
      suggestionId: single?.id,
      selectLessonId,
      logEntries,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Tailoring: adapt to the customer's workflow                         */
/* ------------------------------------------------------------------ */

type ExampleBuilder = (ctx: TailoringContext) => string;

const ADAPTED_EXAMPLES: Record<string, ExampleBuilder> = {
  [TEMPLATE_IDS.context]: ({ account, constraintKnown }) =>
    `At ${account.name}, the Marketing team writes a campaign brief for every launch. Their saved context holds the Relay audience and positioning notes, the approved product descriptions with links to the release notes and integration catalog, and the brief template.` +
    (constraintKnown
      ? ` Because unsupported claims are what gets briefs sent back, it also lists the sources the ${account.approvalOwnerRole} accepts.`
      : ' The launch date and the offer stay in each request.'),
  [TEMPLATE_IDS.workflow]: ({ account, constraintKnown }) =>
    `At ${account.name}, a brief moves from the Marketing writer to the agency. The writer opens the saved context and drafts with Claude.` +
    (constraintKnown
      ? ` Each product claim is checked against the approved source list, the ${account.approvalOwnerRole} approves the checked brief, and only then does the agency receive it.`
      : ' A teammate reviews the draft before the agency receives it.'),
  [TEMPLATE_IDS.skill]: ({ account, constraintKnown }) =>
    `For ${account.name}, the packaged instruction asks for the product, the audience and the launch date, and returns a brief in the team’s template with a review step at the end.` +
    (constraintKnown
      ? ` It also asks the writer to attach the source for each product claim, so the ${account.approvalOwnerRole} can approve against them.`
      : ''),
  [TEMPLATE_IDS.claims]: ({ account }) =>
    `In a ${account.name} launch brief, “Relay 3.0 adds role-based approvals” matches the release notes, so it stays. “Customers cut onboarding time by 40%” has no document behind it, so it is flagged for the ${account.approvalOwnerRole} before the agency sees it.`,
  [TEMPLATE_IDS.approval]: ({ account }) =>
    `At ${account.name}, the ${account.approvalOwnerRole} is the approver. The writer hands over the draft, the claim-to-source list and anything still unsupported. If the owner is away, the brief waits.`,
  [TEMPLATE_IDS.transfer]: ({ account, constraintKnown }) =>
    `The next ${account.name} request is a webinar brief for Insights. The template and tone guidance carry over. The Relay details do not.` +
    (constraintKnown
      ? ` The claim check and the ${account.approvalOwnerRole}’s approval apply exactly as they did for the launch brief.`
      : ''),
};

export function proposeAdaptToWorkflow(program: LearningProgram, lessonId: string, ctx: TailoringContext): ProposalResult {
  const lesson = program.lessons[lessonId];
  if (!lesson) return { ok: false, reason: 'Select a lesson first.' };
  const build =
    ADAPTED_EXAMPLES[lesson.templateId] ??
    (({ account }: TailoringContext) =>
      `Example from ${account.name}: the Marketing team writes ${account.recurringTask} for each launch and sends them to an agency.`);
  const body = build(ctx);
  const existing = lesson.blocks.find((b) => b.kind === 'worked-example');
  if (existing?.body === body) return { ok: false, reason: `This lesson already uses the ${ctx.account.name} example.` };

  const blocks: LessonBlock[] = existing
    ? lesson.blocks.map((b) => (b.id === existing.id ? { ...b, body } : b))
    : [...lesson.blocks.slice(0, 1), { id: `${lesson.id}-adapted-example`, kind: 'worked-example', body }, ...lesson.blocks.slice(1)];

  const variantHint =
    ctx.constraintKnown && !hasTypedVerification(lesson) && VERIFICATION_VARIANTS[lesson.templateId]
      ? ' The scored practice does not include the claim check yet. Use “Add a verification step” for that.'
      : '';

  return {
    ok: true,
    proposal: {
      id: `proposal-adapt-${lesson.id}`,
      kind: 'tailoring',
      title: `Adapt “${lesson.title}” to the ${ctx.account.name} workflow`,
      reason:
        `Rewrites the worked example around how ${ctx.account.name} produces ${ctx.account.recurringTask}` +
        (ctx.constraintKnown ? `, including the claim check and ${ctx.account.approvalOwnerRole} approval the sponsor described.` : '.') +
        ' The assessed practice and its criteria are unchanged.' +
        variantHint,
      nextProgram: replaceLessonObject(program, { ...lesson, blocks }),
      idsUsed: 0,
      lessonIds: [lesson.id],
      selectLessonId: lesson.id,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Tailoring: add a verification step                                  */
/* ------------------------------------------------------------------ */

export function proposeVerificationStep(program: LearningProgram, lessonId: string, ctx: TailoringContext): ProposalResult {
  const lesson = program.lessons[lessonId];
  if (!lesson) return { ok: false, reason: 'Select a lesson first.' };
  if (hasTypedVerification(lesson)) {
    return { ok: false, reason: 'This lesson already checks claims or places approval in its scored practice.' };
  }

  const upgraded = applyVerificationVariant(lesson, ctx.constraintKnown);
  if (upgraded) {
    return {
      ok: true,
      proposal: {
        id: `proposal-verify-${lesson.id}`,
        kind: 'tailoring',
        title: `Add a verification step to “${lesson.title}”`,
        reason: `Adds a claim check and ${ctx.account.approvalOwnerRole} approval to the scored practice. The lesson moves to a newer assessment version with its own criteria. Earlier attempts stay recorded against the old version.`,
        nextProgram: replaceLessonObject(program, upgraded),
        idsUsed: 0,
        lessonIds: [lesson.id],
        selectLessonId: lesson.id,
      },
    };
  }

  const already = GENERIC_VERIFICATION_BLOCKS.every((g) => lesson.blocks.some((b) => b.body === g.body));
  if (already) return { ok: false, reason: 'This lesson already has the verification step.' };
  const blocks: LessonBlock[] = [
    ...lesson.blocks,
    ...GENERIC_VERIFICATION_BLOCKS.filter((g) => !lesson.blocks.some((b) => b.body === g.body)).map((g, i) => ({
      id: `${lesson.id}-verify-${i + 1}`,
      kind: g.kind,
      body: g.body,
    })),
  ];
  return {
    ok: true,
    proposal: {
      id: `proposal-verify-${lesson.id}`,
      kind: 'tailoring',
      title: `Add a verification step to “${lesson.title}”`,
      reason:
        'Adds a decision check and a source reference, and one minute. This is unscored practice. No new criterion is recorded, because this lesson’s typed assessment does not cover claim checking.',
      nextProgram: replaceLessonObject(program, {
        ...lesson,
        blocks,
        durationMin: Math.min(30, lesson.durationMin + 1),
        sourceIds: [...new Set([...lesson.sourceIds, 'src-meridian-sources'])],
      }),
      idsUsed: 0,
      lessonIds: [lesson.id],
      selectLessonId: lesson.id,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Tailoring: ten-minute version                                       */
/* ------------------------------------------------------------------ */

export const SHORT_VERSION_MINUTES = 10;
const MIN_LESSON_MINUTES = 2;

function firstSentences(text: string, count: number): string {
  const parts = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts.slice(0, count).join(' ');
}

export function proposeTenMinuteVersion(program: LearningProgram): ProposalResult {
  const lessons = listLessons(program).map((l) => l.lesson);
  if (lessons.length === 0) return { ok: false, reason: 'Add a lesson before shortening the program.' };
  const total = totalMinutes(program);
  if (total <= SHORT_VERSION_MINUTES) return { ok: false, reason: `The program is already ${total} minutes.` };
  const max = Math.floor(SHORT_VERSION_MINUTES / MIN_LESSON_MINUTES);
  if (lessons.length > max) {
    return {
      ok: false,
      reason: `Ten minutes fits ${max} lessons at ${MIN_LESSON_MINUTES} minutes each. This program has ${lessons.length}. Remove a lesson first.`,
    };
  }

  // Start every lesson at the minimum, then hand out the remaining minutes to the longest lessons first.
  const minutes = new Map(lessons.map((l) => [l.id, Math.min(MIN_LESSON_MINUTES, l.durationMin)]));
  let remaining = SHORT_VERSION_MINUTES - [...minutes.values()].reduce((a, b) => a + b, 0);
  const byLength = [...lessons].sort((a, b) => b.durationMin - a.durationMin);
  while (remaining > 0) {
    let gave = false;
    for (const l of byLength) {
      if (remaining === 0) break;
      const current = minutes.get(l.id)!;
      if (current < l.durationMin) {
        minutes.set(l.id, current + 1);
        remaining -= 1;
        gave = true;
      }
    }
    if (!gave) break;
  }

  let next = program;
  for (const lesson of lessons) {
    let keptExplanation = false;
    const blocks = lesson.blocks.flatMap((b): LessonBlock[] => {
      if (b.kind === 'worked-example') return [];
      if (b.kind === 'explanation') {
        if (keptExplanation) return [];
        keptExplanation = true;
        return [{ ...b, body: firstSentences(b.body, 2) }];
      }
      return [b];
    });
    next = replaceLessonObject(next, { ...lesson, blocks, durationMin: minutes.get(lesson.id)! });
  }

  return {
    ok: true,
    proposal: {
      id: 'proposal-ten-minute',
      kind: 'tailoring',
      title: 'Shorten the program to a ten-minute version',
      reason:
        'Keeps every assessed practice and its criteria. Removes worked examples, trims each explanation to two sentences and reallocates time so the practice fits in ten minutes.',
      nextProgram: next,
      idsUsed: 0,
      lessonIds: lessons.map((l) => l.id),
    },
  };
}
