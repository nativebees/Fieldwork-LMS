import type { AssessmentBinding, AssessmentVersion } from '../types';

/**
 * Typed assessment templates with explicit criterion ids and versioned rules.
 *
 * Scoring is declarative: every criterion carries a rule that src/rules/scoring.ts
 * evaluates against a structured response. Nothing here grades free text.
 * All drafts and source lists below are synthetic.
 */

const CLAIM_APPROVAL_OPTIONS = {
  after: 'After the claim check and before the brief is shared outside the team',
  late: 'After the agency has it, so work is not held up',
  skip: 'Approval is not needed once Claude has checked the claims',
  anyone: 'Whoever is free can approve if the owner is busy',
};

const APPROVAL_EXPLAIN = {
  late: 'Once the agency has the brief, an unsupported claim is already outside the team. Approval has to come first.',
  skip: 'Claude can help compare claims with sources. The decision to publish stays with a person, and at Meridian Works that person is the campaign owner.',
  anyone:
    'The sponsor was specific: approval stays with the campaign owner. If the owner is away, the brief waits or the owner names a delegate.',
};

export const ASSESSMENT_VERSIONS: AssessmentVersion[] = [
  {
    templateId: 'context-pack',
    version: 1,
    rulesId: 'context-pack@1',
    title: 'Sort what belongs in the saved context',
    parts: [
      {
        id: 'sort',
        type: 'pick-many',
        prompt: 'Which of these belong in the saved campaign-brief context? Select all that apply.',
        options: [
          { id: 'audience', label: 'Audience and positioning notes' },
          { id: 'descriptions', label: 'Approved product descriptions, with links to their sources' },
          { id: 'template', label: 'The brief template and its required sections' },
          { id: 'date', label: 'This week’s launch date and offer' },
          { id: 'thread', label: 'A teammate’s private feedback thread' },
        ],
      },
    ],
    criteria: [
      {
        id: 'cx.durable',
        label: 'Saves durable material once',
        hint: 'Think about what appeared in every one of the last three briefs.',
        rule: {
          type: 'set',
          partId: 'sort',
          required: ['audience', 'descriptions', 'template'],
          forbidden: [],
          pass: 'Audience notes, approved descriptions and the template are the same for every brief, so they are saved once.',
          missing: {
            audience: 'Audience and positioning notes repeat in every brief. Leaving them out means retyping them.',
            descriptions: 'Approved product descriptions are the part most worth saving, because they carry their sources with them.',
            template: 'The template is what keeps briefs consistent. It belongs in the saved context.',
          },
          wrong: {},
        },
      },
      {
        id: 'cx.excludes-oneoff',
        label: 'Keeps one-off and private details out',
        hint: 'Ask of each item: will this still be true for the next brief, and should everyone see it?',
        rule: {
          type: 'set',
          partId: 'sort',
          required: [],
          forbidden: ['date', 'thread'],
          pass: 'Dates, offers and private threads stay out of the shared context.',
          missing: {},
          wrong: {
            date: 'The launch date and offer change with every brief. Saved context that goes stale produces wrong briefs.',
            thread: 'A private feedback thread is not something every brief needs, and it is not yours to share.',
          },
        },
      },
    ],
  },
  {
    templateId: 'workflow-sequence',
    version: 1,
    rulesId: 'workflow-sequence@1',
    title: 'Order the workflow',
    parts: [
      {
        id: 'steps',
        type: 'order',
        prompt: 'Arrange the steps from first to last.',
        items: [
          { id: 'context', label: 'Open the saved campaign-brief context' },
          { id: 'draft', label: 'Draft the brief with Claude' },
          { id: 'review', label: 'A teammate reviews the draft' },
          { id: 'share', label: 'Share the brief with the agency' },
        ],
        initialOrder: ['share', 'draft', 'context', 'review'],
      },
    ],
    criteria: [
      {
        id: 'wf.context-first',
        label: 'Starts from the saved context',
        hint: 'What does the draft need in front of it before the first word is written?',
        rule: {
          type: 'sequence',
          partId: 'steps',
          order: ['context', 'draft'],
          pass: 'The draft starts from the saved context, so it begins with the same footing every time.',
          fail: 'The draft comes before the saved context is opened. Without it, the brief starts from a blank page again.',
        },
      },
      {
        id: 'wf.review-before-share',
        label: 'Keeps a human review before sharing',
        hint: 'Find the last moment a person can still catch a problem.',
        rule: {
          type: 'sequence',
          partId: 'steps',
          order: ['draft', 'review', 'share'],
          pass: 'A person reviews the draft before it leaves the team.',
          fail: 'In this order the brief can reach the agency before anyone has reviewed the draft.',
        },
      },
    ],
  },
  {
    templateId: 'workflow-sequence',
    version: 2,
    rulesId: 'workflow-sequence@2',
    title: 'Order the workflow, with the claim check and approval',
    parts: [
      {
        id: 'steps',
        type: 'order',
        prompt: 'Arrange the five steps from first to last.',
        items: [
          { id: 'context', label: 'Open the saved campaign-brief context' },
          { id: 'draft', label: 'Draft the brief with Claude' },
          { id: 'claims', label: 'Check each product claim against an approved source' },
          { id: 'approve', label: 'Campaign owner approves the checked brief' },
          { id: 'share', label: 'Share the brief with the agency' },
        ],
        initialOrder: ['draft', 'share', 'approve', 'context', 'claims'],
      },
    ],
    criteria: [
      {
        id: 'wf.context-first',
        label: 'Starts from the saved context',
        hint: 'What does the draft need in front of it before the first word is written?',
        rule: {
          type: 'sequence',
          partId: 'steps',
          order: ['context', 'draft'],
          pass: 'The draft starts from the saved context.',
          fail: 'The draft comes before the saved context is opened. Without it, the brief starts from a blank page again.',
        },
      },
      {
        id: 'wf.claims-before-approval',
        label: 'Checks claims before approval',
        hint: 'The campaign owner can only approve what has already been checked. Where does the check have to sit?',
        rule: {
          type: 'sequence',
          partId: 'steps',
          order: ['draft', 'claims', 'approve'],
          pass: 'Claims are checked after drafting and before the campaign owner sees the brief.',
          fail: 'The claim check has to sit between drafting and approval. Otherwise the campaign owner is approving claims nobody has checked.',
        },
      },
      {
        id: 'wf.approval-before-share',
        label: 'Keeps campaign-owner approval before external sharing',
        hint: 'Once the agency has the brief, it is too late to stop a claim. Who decides before that?',
        rule: {
          type: 'sequence',
          partId: 'steps',
          order: ['approve', 'share'],
          pass: 'The campaign owner approves before anything leaves the team.',
          fail: 'The brief is shared before the campaign owner approves it. Approval has to come first, and it stays with the owner.',
        },
      },
    ],
  },
  {
    templateId: 'instruction-package',
    version: 1,
    rulesId: 'instruction-package@1',
    title: 'Choose what the packaged instruction includes',
    parts: [
      {
        id: 'contents',
        type: 'pick-many',
        prompt: 'What should a packaged brief instruction include? Select all that apply.',
        options: [
          { id: 'inputs', label: 'The inputs it needs: product, audience and launch date' },
          { id: 'format', label: 'The sections every brief must contain' },
          { id: 'review', label: 'A review step before the brief is shared' },
          { id: 'fixedclaim', label: 'A fixed performance claim to reuse in every brief' },
          { id: 'skip', label: 'A note that short briefs can skip review' },
        ],
      },
    ],
    criteria: [
      {
        id: 'ip.inputs-format',
        label: 'Names inputs and output format',
        hint: 'What would a teammate need to supply, and what should they expect back?',
        rule: {
          type: 'set',
          partId: 'contents',
          required: ['inputs', 'format'],
          forbidden: [],
          pass: 'Naming the inputs and the sections is what makes the result consistent from person to person.',
          missing: {
            inputs: 'Without named inputs, each person supplies something different and the briefs drift.',
            format: 'Without the required sections, the output format changes with every run.',
          },
          wrong: {},
        },
      },
      {
        id: 'ip.review-kept',
        label: 'Keeps the review step',
        hint: 'Does a shorter brief carry less risk of saying something wrong?',
        rule: {
          type: 'set',
          partId: 'contents',
          required: ['review'],
          forbidden: ['skip'],
          pass: 'The review step stays in, whatever the length of the brief.',
          missing: { review: 'A packaged instruction with no review step makes it faster to ship a mistake.' },
          wrong: { skip: 'Short briefs can carry a wrong claim just as easily as long ones. The review stays.' },
        },
      },
      {
        id: 'ip.no-fixed-claims',
        label: 'Leaves changeable claims out of the instruction',
        hint: 'Which of these will be out of date by next quarter?',
        rule: {
          type: 'set',
          partId: 'contents',
          required: [],
          forbidden: ['fixedclaim'],
          pass: 'No performance claim is baked in, so nothing goes stale inside the instruction.',
          missing: {},
          wrong: {
            fixedclaim: 'A claim fixed inside the instruction gets repeated in every brief after it stops being true.',
          },
        },
      },
    ],
  },
  {
    templateId: 'claim-check',
    version: 1,
    rulesId: 'claim-check@1',
    title: 'Check the claims in a draft brief',
    scenario: {
      title: 'Relay 3.0 launch: campaign brief',
      note: 'Synthetic draft and source list, written for this exercise.',
      draft: [
        'Relay 3.0 adds a visual workflow builder and role-based approvals.',
        'Customers cut onboarding time by 40% with Relay.',
        'Relay connects to 85 business tools at launch.',
        'Pricing starts at the Team tier.',
      ],
      sources: ['Relay 3.0 release notes, dated 2026-10-28', 'Integration catalog, dated 2026-10-30', 'Pricing sheet, dated 2026-11-02'],
    },
    parts: [
      {
        id: 'claim',
        type: 'pick-one',
        prompt: 'Which sentence makes a claim with no approved source?',
        options: [
          { id: 'c1', label: 'Relay 3.0 adds a visual workflow builder and role-based approvals.' },
          { id: 'c2', label: 'Customers cut onboarding time by 40% with Relay.' },
          { id: 'c3', label: 'Relay connects to 85 business tools at launch.' },
          { id: 'c4', label: 'Pricing starts at the Team tier.' },
        ],
      },
      {
        id: 'evidence',
        type: 'pick-one',
        prompt: 'What would let the campaign owner approve that claim?',
        options: [
          { id: 'e1', label: 'A dated, approved customer study that states the figure and who it covers' },
          { id: 'e2', label: 'A more confident rewrite of the sentence' },
          { id: 'e3', label: 'A similar figure on a competitor’s website' },
          { id: 'e4', label: 'A colleague’s memory of a customer call' },
        ],
      },
    ],
    criteria: [
      {
        id: 'cl.identify',
        label: 'Identifies the unsupported claim',
        hint: 'Check each sentence against the three documents in the source list. One sentence has nothing behind it.',
        rule: {
          type: 'choice',
          partId: 'claim',
          correct: 'c2',
          pass: 'No document in the source list states a 40% reduction, so the claim cannot go out as written.',
          explain: {
            c1: 'The release notes dated 2026-10-28 list both features. This sentence has a source.',
            c3: 'The integration catalog dated 2026-10-30 lists 85 tools. The number is specific and it is supported.',
            c4: 'The pricing sheet dated 2026-11-02 shows the Team tier as the entry point. This sentence has a source.',
          },
        },
      },
      {
        id: 'cl.evidence',
        label: 'Chooses evidence the owner can check',
        hint: 'Picture the campaign owner asking “where does this come from?” Which answer could they open and read?',
        rule: {
          type: 'choice',
          partId: 'evidence',
          correct: 'e1',
          pass: 'A dated study the campaign owner can open is something they can approve against.',
          explain: {
            e2: 'Rewording changes how the claim sounds. It does not change whether anyone can back it up.',
            e3: 'A competitor’s number says nothing about Relay, and it is not a source your campaign owner approved.',
            e4: 'A recollection can point you toward evidence. On its own it cannot be opened, dated or checked.',
          },
        },
      },
    ],
  },
  {
    templateId: 'approval-gate',
    version: 1,
    rulesId: 'approval-gate@1',
    title: 'Place the approval',
    parts: [
      {
        id: 'when',
        type: 'pick-one',
        prompt: 'When does the campaign owner approve the brief?',
        options: [
          { id: 'after', label: CLAIM_APPROVAL_OPTIONS.after },
          { id: 'late', label: CLAIM_APPROVAL_OPTIONS.late },
          { id: 'skip', label: CLAIM_APPROVAL_OPTIONS.skip },
          { id: 'anyone', label: CLAIM_APPROVAL_OPTIONS.anyone },
        ],
      },
      {
        id: 'packet',
        type: 'pick-many',
        prompt: 'What does the campaign owner need in front of them to decide? Select all that apply.',
        options: [
          { id: 'draft', label: 'The draft brief' },
          { id: 'claims', label: 'The list of claims with the source for each' },
          { id: 'flags', label: 'Any claims with no source, clearly flagged' },
          { id: 'transcript', label: 'The full chat transcript that produced the draft' },
        ],
      },
    ],
    criteria: [
      {
        id: 'ap.owner-before-share',
        label: 'Keeps campaign-owner approval before external sharing',
        hint: 'Find the last point where a wrong claim can still be stopped, and who is allowed to stop it.',
        rule: {
          type: 'choice',
          partId: 'when',
          correct: 'after',
          pass: 'Approval sits after the check and before sharing, with the campaign owner.',
          explain: APPROVAL_EXPLAIN,
        },
      },
      {
        id: 'ap.review-packet',
        label: 'Gives the owner what they need to decide',
        hint: 'The owner is deciding whether each claim can go out. What do they need to see to do that quickly?',
        rule: {
          type: 'set',
          partId: 'packet',
          required: ['draft', 'claims', 'flags'],
          forbidden: [],
          pass: 'The owner sees the draft, each claim with its source and anything still unsupported.',
          missing: {
            draft: 'The owner cannot approve a brief they have not seen.',
            claims: 'Without the claim-to-source list, the owner has to redo the check.',
            flags: 'Unsupported claims have to be visible, or they slip through as approved.',
          },
          wrong: {},
        },
      },
    ],
  },
  {
    templateId: 'transfer-brief',
    version: 1,
    rulesId: 'transfer-brief@1',
    title: 'Run the workflow on a new brief',
    scenario: {
      title: 'Meridian Insights spring webinar: campaign brief',
      note: 'Synthetic request. A different product and audience from the first brief.',
    },
    parts: [
      {
        id: 'carry',
        type: 'pick-many',
        prompt: 'Which parts of the saved context carry over to this brief? Select all that apply.',
        options: [
          { id: 'template', label: 'The brief template and its required sections' },
          { id: 'tone', label: 'The team’s tone and formatting guidance' },
          { id: 'relaydate', label: 'The Relay 3.0 launch date' },
          { id: 'relaydesc', label: 'The Relay 3.0 product description' },
        ],
      },
      {
        id: 'review',
        type: 'pick-one',
        prompt: 'Before the new brief is shared with the agency, what happens?',
        options: [
          { id: 'teammate', label: 'A teammate reviews it, the same as last time' },
          { id: 'nothing', label: 'Nothing. The workflow already worked once' },
          { id: 'self', label: 'Claude reviews its own draft' },
        ],
      },
    ],
    criteria: [
      {
        id: 'tr.reuse-context',
        label: 'Reuses durable context and replaces one-off details',
        hint: 'This brief is for a different product. Which saved items are about how the team works, and which are about Relay?',
        rule: {
          type: 'set',
          partId: 'carry',
          required: ['template', 'tone'],
          forbidden: ['relaydate', 'relaydesc'],
          pass: 'The template and tone guidance carry over. The Relay details are replaced with the Insights ones.',
          missing: {
            template: 'The template is the part built to carry over. Rebuilding it defeats the saved context.',
            tone: 'Tone and formatting guidance apply to every brief the team writes.',
          },
          wrong: {
            relaydate: 'The Relay launch date belongs to the last brief. It has no place in a webinar brief for Insights.',
            relaydesc: 'This brief is about Insights. Carrying the Relay description over would put the wrong product in it.',
          },
        },
      },
      {
        id: 'tr.review-before-share',
        label: 'Keeps a human review before sharing',
        hint: 'A workflow that worked once has been tested once. What stays the same on the second run?',
        rule: {
          type: 'choice',
          partId: 'review',
          correct: 'teammate',
          pass: 'The review step holds on the second brief too.',
          explain: {
            nothing: 'One good run does not make the next draft correct. The review is part of the workflow, every time.',
            self: 'Claude can list what to look at. A person still has to look.',
          },
        },
      },
    ],
  },
  {
    templateId: 'transfer-brief',
    version: 2,
    rulesId: 'transfer-brief@2',
    title: 'Check a new brief and keep the approval',
    scenario: {
      title: 'Meridian Insights spring webinar: campaign brief',
      note: 'Synthetic draft and source list. A different product and audience from the first brief.',
      draft: [
        'The webinar runs on 11 March 2027 for operations leaders.',
        'Insights is the fastest analytics add-on in its category.',
        'Insights dashboards refresh every 15 minutes.',
        'Attendees get a 30-day trial.',
      ],
      sources: [
        'Webinar event plan, dated 2026-11-10',
        'Insights product specification, dated 2026-10-21',
        'Trial offer sheet, dated 2026-11-05',
      ],
    },
    parts: [
      {
        id: 'claim',
        type: 'pick-one',
        prompt: 'Which sentence makes a claim with no approved source?',
        options: [
          { id: 'w1', label: 'The webinar runs on 11 March 2027 for operations leaders.' },
          { id: 'w2', label: 'Insights is the fastest analytics add-on in its category.' },
          { id: 'w3', label: 'Insights dashboards refresh every 15 minutes.' },
          { id: 'w4', label: 'Attendees get a 30-day trial.' },
        ],
      },
      {
        id: 'evidence',
        type: 'pick-one',
        prompt: 'What would let the campaign owner approve that claim?',
        options: [
          { id: 'v1', label: 'A dated, approved benchmark that defines the category and what was compared' },
          { id: 'v2', label: 'Stronger wording, such as “blazing fast”' },
          { id: 'v3', label: 'The 15-minute refresh figure from the product specification' },
          { id: 'v4', label: 'A customer quote saying it feels fast' },
        ],
      },
      {
        id: 'approval',
        type: 'pick-one',
        prompt: 'When does the campaign owner approve this brief?',
        options: [
          { id: 'after', label: 'After the claim check and before the brief leaves the team' },
          { id: 'late', label: 'After the agency has started work' },
          { id: 'skip', label: 'It is not needed if every claim has a source' },
          { id: 'anyone', label: 'A teammate can approve this one because it is only a webinar' },
        ],
      },
    ],
    criteria: [
      {
        id: 'tr.identify-claim',
        label: 'Identifies the unsupported claim in a new brief',
        hint: 'Same check as before, different documents. Which sentence compares Insights with products the sources never mention?',
        rule: {
          type: 'choice',
          partId: 'claim',
          correct: 'w2',
          pass: '“Fastest in its category” is a comparison, and none of the three sources compares Insights with anything.',
          explain: {
            w1: 'The event plan dated 2026-11-10 gives the date and the audience. This sentence has a source.',
            w3: 'The product specification dated 2026-10-21 states the 15-minute refresh. This sentence has a source.',
            w4: 'The trial offer sheet dated 2026-11-05 covers the 30-day trial. This sentence has a source.',
          },
        },
      },
      {
        id: 'tr.select-evidence',
        label: 'Chooses evidence the owner can check',
        hint: 'The claim is a comparison. What kind of document supports a comparison?',
        rule: {
          type: 'choice',
          partId: 'evidence',
          correct: 'v1',
          pass: 'A comparison needs a benchmark that says what was compared and when.',
          explain: {
            v2: 'Stronger wording makes the claim bigger. It does not make it supported.',
            v3: 'The refresh figure is real and sourced, but it describes Insights alone. It cannot support “fastest in its category”.',
            v4: 'A quote about how it feels is an opinion. It is not evidence for a category-wide comparison.',
          },
        },
      },
      {
        id: 'tr.approval-before-share',
        label: 'Keeps campaign-owner approval before external sharing',
        hint: 'The product changed. Did the rule about who approves change with it?',
        rule: {
          type: 'choice',
          partId: 'approval',
          correct: 'after',
          pass: 'Approval stays with the campaign owner and comes before sharing, on this brief as on the last.',
          explain: {
            late: 'By the time the agency has started, an unsupported claim is already in their hands.',
            skip: 'Sources make approval faster. They do not replace the owner’s decision.',
            anyone: 'The size of the campaign does not move the approval. It stays with the campaign owner.',
          },
        },
      },
    ],
  },
];

export const ASSESSMENT_BY_RULES_ID: Record<string, AssessmentVersion> = Object.fromEntries(ASSESSMENT_VERSIONS.map((v) => [v.rulesId, v]));

export function rulesIdOf(binding: Pick<AssessmentBinding, 'templateId' | 'version'>): string {
  return `${binding.templateId}@${binding.version}`;
}

export function getAssessment(binding: Pick<AssessmentBinding, 'templateId' | 'version'>): AssessmentVersion {
  const found = ASSESSMENT_BY_RULES_ID[rulesIdOf(binding)];
  if (!found) throw new Error(`Unknown assessment rules: ${rulesIdOf(binding)}`);
  return found;
}

/** Criterion ids that count as handling source accuracy. */
export const SOURCE_ACCURACY_CRITERIA = [
  'cl.identify',
  'cl.evidence',
  'tr.identify-claim',
  'tr.select-evidence',
  'wf.claims-before-approval',
];

/** Criterion ids that count as keeping human approval before sharing. */
export const HUMAN_APPROVAL_CRITERIA = ['wf.approval-before-share', 'ap.owner-before-share', 'tr.approval-before-share'];
