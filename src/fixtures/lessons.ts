import type { BlockKind, LearningProgram, Lesson, LessonBlock, LessonTemplate } from '../types';

/** Synthetic lesson library. Six templates, each bound to a typed assessment. */

export const BLOCK_KIND_LABEL: Record<BlockKind, string> = {
  explanation: 'Brief explanation',
  'worked-example': 'Worked example',
  'guided-practice': 'Guided practice',
  'decision-check': 'Decision check',
  'source-reference': 'Source / reference',
  'transfer-task': 'Transfer task',
};

export const BLOCK_KINDS: BlockKind[] = [
  'explanation',
  'worked-example',
  'guided-practice',
  'decision-check',
  'source-reference',
  'transfer-task',
];

export const TEMPLATE_IDS = {
  context: 'tpl-context',
  workflow: 'tpl-workflow',
  skill: 'tpl-skill',
  claims: 'tpl-claims',
  approval: 'tpl-approval',
  transfer: 'tpl-transfer',
} as const;

export const LESSON_TEMPLATES: LessonTemplate[] = [
  {
    id: TEMPLATE_IDS.context,
    title: 'Create a reusable campaign-brief context',
    summary: 'Save what every brief needs, once.',
    leadKind: 'explanation',
    objective: 'Set up one saved context that holds what every campaign brief needs, so nobody retypes it.',
    durationMin: 5,
    blocks: [
      {
        kind: 'explanation',
        body: 'Most campaign briefs repeat the same background: who the audience is, how the product is positioned and which sections the brief must have. Saving that once, in a Claude Project or another shared space your admin has enabled, means each new brief starts from the same footing.',
      },
      {
        kind: 'worked-example',
        body: 'A saved context for launch briefs holds three things: the audience and positioning notes, the approved product descriptions with links to where they came from, and the brief template. The launch date and this week’s offer stay out. They change every time, so they belong in the request.',
      },
      {
        kind: 'guided-practice',
        body: 'List what your last three briefs had in common. Anything that appeared in all three is a candidate for the saved context.',
      },
    ],
    practice: 'Sort five items into what belongs in the saved context and what belongs in each request.',
    evidence: 'The saved context holds the durable material and leaves out one-off or private details.',
    assessment: { templateId: 'context-pack', version: 1 },
    sourceIds: [],
  },
  {
    id: TEMPLATE_IDS.workflow,
    title: 'Map a reviewable workflow',
    summary: 'Order the steps so someone can review them.',
    leadKind: 'guided-practice',
    objective: 'Lay out the steps from saved context to shared brief so someone else can follow and review them.',
    durationMin: 6,
    blocks: [
      {
        kind: 'explanation',
        body: 'A workflow is reviewable when each step has a visible output and a person who looks at it before the next step. That matters more than a polished first draft, because it lets the team see where a brief went wrong.',
      },
      {
        kind: 'worked-example',
        body: 'Start from the saved context, draft the brief with Claude, have a teammate review it, then share it with the agency. If the brief comes back with a problem, the team can point to the step that missed it.',
      },
      {
        kind: 'decision-check',
        body: 'Before sharing, ask: who looked at this, and what were they checking for?',
      },
    ],
    practice: 'Put the workflow steps in an order that keeps a review before anything leaves the team.',
    evidence: 'The saved context comes before drafting, and a person reviews the brief before it is shared.',
    assessment: { templateId: 'workflow-sequence', version: 1 },
    sourceIds: [],
  },
  {
    id: TEMPLATE_IDS.skill,
    title: 'Package a repeatable instruction',
    summary: 'Turn a retyped request into one shared instruction.',
    leadKind: 'worked-example',
    objective: 'Turn the brief request you keep retyping into one packaged instruction the whole team can run.',
    durationMin: 5,
    blocks: [
      {
        kind: 'explanation',
        body: 'When the same request gets typed again and again, the wording drifts and so do the results. A packaged instruction, for example a Skill where your admin has enabled Skills, fixes the inputs and the output format so briefs come out consistent.',
      },
      {
        kind: 'worked-example',
        body: 'A packaged brief instruction names the inputs it needs (product, audience, launch date), states the sections the brief must contain and ends with a review step. It leaves product claims out, because claims change.',
      },
      {
        kind: 'source-reference',
        body: 'Background: field note on packaging recurring work. This note has no review date, so treat it as unverified.',
      },
    ],
    practice: 'Choose what a packaged brief instruction should include.',
    evidence: 'The instruction names its inputs and output format, keeps a review step and hard-codes no product claim.',
    assessment: { templateId: 'instruction-package', version: 1 },
    sourceIds: ['src-field-note'],
  },
  {
    id: TEMPLATE_IDS.claims,
    title: 'Check claims before handoff',
    summary: 'Find the claim with no source behind it.',
    leadKind: 'source-reference',
    objective:
      'Find product claims that have no approved source and decide what evidence would support them, before the campaign owner sees the brief.',
    durationMin: 5,
    blocks: [
      {
        kind: 'explanation',
        body: 'A draft can read well and still say something nobody can back up. Claude can help you list the claims in a brief and compare them with the sources you provide. It cannot make an unsupported claim true, and it does not approve anything.',
      },
      {
        kind: 'worked-example',
        body: '“Relay connects to 85 business tools” matches the integration catalog, so it stays. “The most trusted platform in the industry” has no source, so it is flagged for the campaign owner or removed.',
      },
      {
        kind: 'source-reference',
        body: 'Use the synthetic source list for this exercise: the Relay 3.0 release notes, the integration catalog and the pricing sheet. In real use, the campaign owner decides which sources count as approved.',
      },
      {
        kind: 'decision-check',
        body: 'For each claim ask: where does this come from, and could the campaign owner open that source today?',
      },
    ],
    practice:
      'Read a draft brief, pick the claim with no approved source and choose the evidence that would let the campaign owner approve it.',
    evidence: 'The unsupported claim is identified, and the evidence chosen is a dated, approved source that states the claim.',
    assessment: { templateId: 'claim-check', version: 1 },
    sourceIds: ['src-meridian-sources'],
  },
  {
    id: TEMPLATE_IDS.approval,
    title: 'Keep approval with the campaign owner',
    summary: 'Place the human decision where it protects the brief.',
    leadKind: 'decision-check',
    objective: 'Place human approval where it protects the brief: after the checks and before anything is shared outside the team.',
    durationMin: 3,
    blocks: [
      {
        kind: 'explanation',
        body: 'Approval is a decision a named person makes. Claude can prepare the brief and the list of checked claims. The campaign owner decides whether it goes out.',
      },
      {
        kind: 'decision-check',
        body: 'If the campaign owner is away, the brief waits or the owner names a delegate. It does not go out unapproved.',
      },
    ],
    practice: 'Decide when the campaign owner approves and what they need in front of them.',
    evidence: 'Approval sits after the claim check and before external sharing, and it stays with the campaign owner.',
    assessment: { templateId: 'approval-gate', version: 1 },
    sourceIds: [],
  },
  {
    id: TEMPLATE_IDS.transfer,
    title: 'Apply the workflow to a new brief',
    summary: 'Run the same steps on a brief you have not seen.',
    leadKind: 'transfer-task',
    objective: 'Use the same saved context and workflow on a brief you have not seen, without extra coaching.',
    durationMin: 6,
    blocks: [
      {
        kind: 'explanation',
        body: 'The point of a reusable workflow is the second brief. This time the product and audience are different, and the steps stay the same.',
      },
      {
        kind: 'transfer-task',
        body: 'New request: a webinar campaign brief for Meridian Insights. Work through it the way you did the first one.',
      },
    ],
    practice: 'Decide what carries over from the saved context and who reviews the new brief before it is shared.',
    evidence: 'Durable context is reused, one-off details are replaced and a person reviews before sharing.',
    assessment: { templateId: 'transfer-brief', version: 1 },
    sourceIds: [],
  },
];

export const TEMPLATE_BY_ID: Record<string, LessonTemplate> = Object.fromEntries(LESSON_TEMPLATES.map((t) => [t.id, t]));

/**
 * Built-in verification variants. Applied by the "Add a verification step" tailoring
 * action and by the customer-constraint suggestions. Each one moves the lesson to a
 * newer typed assessment version with its own criterion ids.
 */
export const VERIFICATION_VARIANTS: Record<
  string,
  {
    objective: string;
    workedExample?: string;
    transferTask?: string;
    sourceBlock: string;
    practice: string;
    evidence: string;
    assessment: { templateId: Lesson['assessment']['templateId']; version: number };
    sourceIds: string[];
  }
> = {
  [TEMPLATE_IDS.workflow]: {
    objective:
      'Lay out the steps from saved context to shared brief, with a claim check and campaign-owner approval before anything leaves the team.',
    workedExample:
      'Start from the saved context and draft the brief with Claude. Check every product claim against an approved source. The campaign owner approves the checked brief. Only then does it go to the agency.',
    sourceBlock:
      'Approved sources for this exercise: the release notes, the integration catalog and the pricing sheet in the synthetic source list. In real use, the campaign owner decides which sources count.',
    practice:
      'Put five steps in order so that claims are checked and the campaign owner approves before the brief is shared outside the team.',
    evidence:
      'Context comes before drafting. The claim check sits between drafting and approval. The campaign owner approves before external sharing.',
    assessment: { templateId: 'workflow-sequence', version: 2 },
    sourceIds: ['src-meridian-sources'],
  },
  [TEMPLATE_IDS.transfer]: {
    objective:
      'Use the same workflow on a brief you have not seen: find the unsupported claim, name the evidence and keep campaign-owner approval before sharing.',
    transferTask:
      'New request: a webinar campaign brief for Meridian Insights. The draft in the practice below contains one claim with no approved source.',
    sourceBlock:
      'Sources for the new brief: the webinar event plan, the Insights product specification and the trial offer sheet in the synthetic source list.',
    practice: 'In the new draft, pick the unsupported claim, choose the evidence that would support it and place campaign-owner approval.',
    evidence:
      'The unsupported claim is identified in an unfamiliar draft, the evidence is a dated approved source and the campaign owner approves before external sharing.',
    assessment: { templateId: 'transfer-brief', version: 2 },
    sourceIds: ['src-meridian-sources'],
  },
};

/** A generic verification block for lessons that have no typed verification variant. */
export const GENERIC_VERIFICATION_BLOCKS: Array<Omit<LessonBlock, 'id'>> = [
  {
    kind: 'decision-check',
    body: 'Before handoff, check each product claim against a dated source. If there is no source, flag the claim for the campaign owner or take it out.',
  },
  {
    kind: 'source-reference',
    body: 'Sources for the check: the synthetic approved source list. In real use, the campaign owner decides which sources count.',
  },
];

export const PROGRAM_META = {
  baseline: {
    title: 'Reusable campaign briefs',
    goal: 'Turn a one-off campaign-brief request into a reusable workflow the team can review.',
    reviewOwner: 'To be confirmed with the sponsor',
  },
  revised: {
    title: 'Source-checked campaign briefs',
    goal: 'Produce a reusable, source-checked campaign brief with campaign-owner approval, then apply the same workflow to a new brief.',
    reviewOwner: 'Campaign owner. Approval stays with this role.',
  },
  audience: 'Marketing team members at Meridian Works who write campaign briefs',
};

export function instantiateTemplate(templateId: string, lessonId: string): Lesson {
  const t = TEMPLATE_BY_ID[templateId];
  if (!t) throw new Error(`Unknown lesson template: ${templateId}`);
  return {
    id: lessonId,
    templateId: t.id,
    title: t.title,
    objective: t.objective,
    durationMin: t.durationMin,
    blocks: t.blocks.map((b, i) => ({ id: `${lessonId}-b${i + 1}`, kind: b.kind, body: b.body })),
    practice: t.practice,
    evidence: t.evidence,
    assessment: { templateId: t.assessment.templateId, version: t.assessment.version, status: 'mapped' },
    sourceIds: [...t.sourceIds],
    aligned: { objective: t.objective, practice: t.practice, evidence: t.evidence },
    objectiveReview: 'aligned',
  };
}

/** The seller's starting proposal: two modules, four missions, 22 minutes. */
export function createDefaultProgram(): LearningProgram {
  const lessons = [
    instantiateTemplate(TEMPLATE_IDS.context, 'lesson-1'),
    instantiateTemplate(TEMPLATE_IDS.workflow, 'lesson-2'),
    instantiateTemplate(TEMPLATE_IDS.skill, 'lesson-3'),
    instantiateTemplate(TEMPLATE_IDS.transfer, 'lesson-4'),
  ];
  return {
    id: 'program-meridian-briefs',
    title: PROGRAM_META.baseline.title,
    audience: PROGRAM_META.audience,
    goal: PROGRAM_META.baseline.goal,
    reviewOwner: PROGRAM_META.baseline.reviewOwner,
    modules: [
      {
        id: 'module-1',
        title: 'Make the brief reusable',
        summary: 'Save the context and map the steps.',
        lessonIds: ['lesson-1', 'lesson-2'],
      },
      {
        id: 'module-2',
        title: 'Repeat it with confidence',
        summary: 'Standardize the work, then prove it transfers.',
        lessonIds: ['lesson-3', 'lesson-4'],
      },
    ],
    lessons: Object.fromEntries(lessons.map((l) => [l.id, l])),
  };
}

/** First id the reducer hands out after the default program's four lessons. */
export const INITIAL_COUNTER = 5;
