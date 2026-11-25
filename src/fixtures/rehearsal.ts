import type { RehearsalStep, RehearsalStepId, SellerCriterionId } from '../types';

/**
 * Scripted two-turn sponsor conversation. Everything the sponsor says is synthetic
 * and fixed. Scoring uses the structured choices only (see src/rules/sellerRubric.ts).
 */

export const SPONSOR_OPENING_LINE =
  'Thanks for making time. I have seen the dashboard, and Marketing looks busy in Claude. What are you seeing on your side?';

export const REHEARSAL_STEP_ORDER: RehearsalStepId[] = ['opening', 'firstQuestion', 'followUp', 'intervention', 'measurement'];

export const SELLER_CRITERIA: Array<{ id: SellerCriterionId; label: string; description: string }> = [
  {
    id: 'observation-vs-assumption',
    label: 'Separates observation from assumption',
    description: 'States what was measured, with its denominator and dates, and keeps the interpretation open.',
  },
  {
    id: 'diagnostic-question',
    label: 'Asks a useful diagnostic question',
    description: 'Asks about how the work runs and where it breaks, before proposing a fix.',
  },
  {
    id: 'intervention-fit',
    label: 'Chooses an intervention that fits the task and constraints',
    description: 'One point for the decision in the conversation, one for a program that reflects it.',
  },
  {
    id: 'accuracy-and-approval',
    label: 'Handles source accuracy and human approval',
    description: 'The program checks claims against sources and keeps approval with a named person.',
  },
  {
    id: 'next-measurement',
    label: 'Defines an appropriate next measurement',
    description: 'Agrees a measure of the work itself, with a baseline and a date, before launch.',
  },
];

export const REHEARSAL_STEPS: Record<RehearsalStepId, RehearsalStep> = {
  opening: {
    id: 'opening',
    turn: 1,
    phase: 'initial',
    heading: 'Open the review',
    prompt: 'How do you describe what you are seeing?',
    criterionId: 'observation-vs-assumption',
    options: [
      {
        id: 'o-observe',
        text: 'Here is what the snapshot shows and what it does not. In the week of 16 to 22 November, 44 of your 64 active Marketing members chatted on three or more days, with no Project or Skill use showing. That could mean repeated work is being rebuilt by hand. It could also mean chat is the right tool for what they do. I would like to understand the work before suggesting anything.',
        short: 'gave the count, its denominator and the dates, then asked to understand the work',
        points: 2,
        reply: 'Good, because I would not have guessed that from the dashboard. Ask away.',
        why: 'You gave the count, its denominator and the dates, named two explanations and asked to learn more. Observation and diagnosis stayed apart.',
        profileNote: {
          'ae-new': 'This is the habit to build in your first quarter: count, denominator, dates, then a question.',
          'csm-experienced':
            'Solid. With your history on this account you can go one step further and suggest which campaign team to learn from first.',
        },
      },
      {
        id: 'o-workshop',
        text: 'Most of Marketing is in chat a lot, but hardly anyone uses Projects or Skills. I think a Skills workshop would move that.',
        short: 'described the pattern loosely and attached a Skills workshop to it',
        points: 1,
        reply: 'Maybe. I am not sure a workshop is the gap. What would it fix?',
        why: 'The observation is roughly right, but it arrived with a solution attached. You do not yet know whether reuse is the problem.',
        profileNote: {
          'ae-new': 'Leading with a workshop makes the review sound like a pitch. Ask first.',
          'csm-experienced': 'A workshop is one of several interventions. You have not yet earned the right to pick one.',
        },
      },
      {
        id: 'o-diagnose',
        text: 'Your Marketing team is stuck at a basic level. 44 people have not learned Projects or Skills yet, so they need training.',
        short: 'treated one week without Project or Skill use as a skills gap',
        points: 0,
        reply: 'I would be careful there. Some of those 44 are my strongest writers. What makes you say basic?',
        why: 'No Project or Skill use in one week is an observation. “Basic level” is a diagnosis the data cannot support.',
        profileNote: {
          'ae-new': 'The snapshot counts features used. It does not measure what anyone knows.',
          'csm-experienced': 'You have seen this account long enough to know usage patterns and ability are different things.',
        },
      },
      {
        id: 'o-expand',
        text: 'The headline is strong: 78% of seats active. I think that supports adding seats for the rest of Marketing.',
        short: 'used the 78% active figure to argue for more seats',
        points: 0,
        reply: 'I am not adding seats on activity alone. Show me the work got better first.',
        why: '78% active describes activity. It says nothing yet about useful work, and it turned the review into a pitch.',
        flags: ['expansion-promise'],
        profileNote: {
          'ae-new':
            'For a seller 45 days in, this is the one to unlearn first: an expansion ask with no customer-agreed evidence behind it.',
          'csm-experienced': 'Dana buys on outcomes. Lead with the pilot and let expansion follow the evidence.',
        },
      },
    ],
  },
  firstQuestion: {
    id: 'firstQuestion',
    turn: 1,
    phase: 'initial',
    heading: 'Ask your first question',
    prompt: 'Dana is listening. What do you ask?',
    criterionId: 'diagnostic-question',
    options: [
      {
        id: 'q-walkthrough',
        text: 'Can you walk me through the last campaign brief the team produced, from first draft to sign-off? Where did it slow down or get sent back?',
        short: 'asked Dana to walk through the last brief and where it was sent back',
        points: 2,
        reply: 'Sure. Briefs are most of what they do in Claude, so that is the right place to look.',
        why: 'It asks about a real, recent piece of work and where it broke. That is how the actual constraint surfaces.',
      },
      {
        id: 'q-time',
        text: 'Which recurring task takes the team the most time?',
        short: 'asked which recurring task takes the most time',
        points: 1,
        reply: 'Campaign briefs, easily. Though time is not really what worries me.',
        why: 'It finds the task. It assumes the problem is time, and Dana had to correct that.',
      },
      {
        id: 'q-training',
        text: 'Would the team come to a 60-minute Skills training next month?',
        short: 'asked whether the team would attend a Skills training',
        points: 0,
        reply: 'They would come. I am not convinced it is the problem.',
        why: 'A yes-or-no question about your solution tells you nothing about their work.',
      },
    ],
  },
  followUp: {
    id: 'followUp',
    turn: 2,
    phase: 'revised',
    heading: 'Ask a follow-up',
    prompt: 'Dana has told you what the real sticking point is. What do you ask next?',
    criterionId: 'diagnostic-question',
    options: [
      {
        id: 'f-evidence',
        text: 'When a claim gets flagged, what does the campaign owner need to see before they will approve it?',
        short: 'asked what the campaign owner needs to see to approve a flagged claim',
        points: 2,
        reply:
          'A source they can open, with a date on it. Release notes, the pricing sheet, an approved customer study. If there is no source, the claim comes out.',
        why: 'It asks about the decision the owner makes and the evidence they need. That tells you what the practice has to teach.',
      },
      {
        id: 'f-volume',
        text: 'Roughly how many briefs a month get sent back for this?',
        short: 'asked how many briefs a month are sent back',
        points: 1,
        reply: 'Maybe a third. I have not counted properly, which is part of the problem.',
        why: 'Useful for sizing and for a baseline later. It does not tell you what a good check looks like.',
      },
      {
        id: 'f-automate',
        text: 'Could Claude approve the low-risk claims, so the owner only sees the hard ones?',
        short: 'asked whether Claude could approve low-risk claims',
        points: 0,
        reply: 'No. Approval stays with the campaign owner. That is not up for discussion.',
        why: 'Dana had just said approval stays with the owner. This question tried to move it.',
        flags: ['removes-approval'],
      },
    ],
  },
  intervention: {
    id: 'intervention',
    turn: 2,
    phase: 'revised',
    heading: 'Revise the intervention',
    prompt: 'What do you propose now?',
    // Points here are the decision point only. The second point comes from the program itself.
    criterionId: 'intervention-fit',
    options: [
      {
        id: 'i-replace',
        text: 'Swap the generic Skill lesson for a claim-check exercise, keep the workflow practice and build owner approval into the steps.',
        short: 'proposed replacing the Skill lesson with a claim check and keeping owner approval',
        points: 1,
        reply: 'That is closer to what we need. Keep it short, they are busy.',
        why: 'It drops the part that was not hurting, keeps the workflow practice that still helps and respects the approval rule.',
      },
      {
        id: 'i-reminder',
        text: 'Keep the Skills lesson as planned and add a reminder to double-check claims.',
        short: 'kept the Skills lesson and added a reminder about claims',
        points: 0,
        reply: 'A reminder will not change much. They already know they should check.',
        why: 'It acknowledges the constraint without practising it. A reminder is not a check.',
      },
      {
        id: 'i-later',
        text: 'Run the original program first and come back to claims next quarter.',
        short: 'kept the original program and deferred claims to next quarter',
        points: 0,
        reply: 'Then we have trained the part that was not hurting.',
        why: 'The plan no longer matches what the customer told you. The program should change when the brief changes.',
      },
      {
        id: 'i-auto',
        text: 'Have Claude verify the claims automatically, so the owner only signs off at the end.',
        short: 'proposed that Claude verify claims automatically',
        points: 0,
        reply: 'Claude can help them check. It cannot be the check. The owner has to see the sources.',
        why: 'It hands the judgement to the tool and reduces the owner to a signature. That is the opposite of what Dana asked for.',
        flags: ['removes-approval'],
      },
    ],
  },
  measurement: {
    id: 'measurement',
    turn: 2,
    phase: 'revised',
    heading: 'Agree what to measure',
    prompt: 'How will you and Dana know whether this helped?',
    criterionId: 'next-measurement',
    options: [
      {
        id: 'm-pilot',
        text: 'Set the pilot criteria together now: one campaign team, the share of briefs returned for unsupported claims against today’s baseline, reviewed by the campaign owner at 14 and 28 days, and a threshold you choose for continuing.',
        short: 'set pilot criteria with a baseline, a named reviewer, 14 and 28 day checks and a sponsor-chosen threshold',
        points: 2,
        reply: 'Yes. I will set the threshold and the owner reviews. Put that in writing.',
        why: 'It names the measure, the baseline, who reviews it, when, and who decides what counts as enough.',
        onlyFor: ['csm-experienced'],
      },
      {
        id: 'm-returned',
        text: 'Agree one measure with Dana before launch: the share of briefs returned for unsupported claims, with a baseline now and checks at 14 and 28 days.',
        short: 'agreed to track briefs returned for unsupported claims at 14 and 28 days',
        points: { 'ae-new': 2, 'csm-experienced': 1 },
        reply: 'I can get the campaign owners to track returns. Fourteen and twenty-eight days works.',
        why: 'It measures the work itself, with a baseline and dates, and it was agreed before launch.',
        profileNote: {
          'csm-experienced':
            'For an experienced CSM the bar is higher. Name who reviews the result and the threshold for continuing, and get the sponsor to own both.',
        },
      },
      {
        id: 'm-completion',
        text: 'Report how many people complete the lessons.',
        short: 'offered lesson completion as the measure',
        points: 1,
        reply: 'Completion is a start. It does not tell me the briefs improved.',
        why: 'Completion shows people did the practice. It does not show the work changed.',
      },
      {
        id: 'm-activity',
        text: 'Track weekly active users and message volume in Marketing.',
        short: 'offered active users and message volume as the measure',
        points: 0,
        reply: 'That tells me they are busy. I already know they are busy.',
        why: 'Volume is a proxy for activity, not for value. More messages could mean more rework.',
      },
      {
        id: 'm-seats',
        text: 'Tie it to a seat expansion proposal at the end of the quarter.',
        short: 'tied the result to a seat expansion proposal',
        points: 0,
        reply: 'Let us see whether the briefs improve before we talk about seats.',
        why: 'An expansion proposal is an outcome you hope for. It is not a measure of whether the customer’s work improved.',
        flags: ['expansion-promise'],
        onlyFor: ['ae-new'],
      },
    ],
  },
};

/** How the sponsor gets to the reveal, depending on the first question asked. */
export const REVEAL_BRIDGE: Record<string, string> = {
  'q-walkthrough': 'Your question took Dana straight to it.',
  'q-time': 'Dana volunteered what the question did not ask for. A sharper question would have reached it sooner.',
  'q-training': 'Dana volunteered what the question did not ask for. A sharper question would have reached it sooner.',
};

export const INITIAL_INTERVENTION_CHOICES = [
  {
    id: 'adapt-skills-workshop',
    label: 'A Skills workshop for all of Marketing',
    note: 'Broad and feature-led. It assumes the pattern is a skills gap.',
  },
  {
    id: 'adapt-pilot-one-team',
    label: 'The same program, piloted with one campaign team first',
    note: 'Smaller scope. Still assumes reuse is the need.',
  },
  {
    id: 'adapt-ask-first',
    label: 'No program yet. Ask the sponsor how briefs get made first',
    note: 'Holds the recommendation until the conversation.',
  },
];

export const DISMISS_REASONS = [
  { id: 'dismiss-chat-fits', label: 'Chat may be the right tool for this work' },
  { id: 'dismiss-thin-evidence', label: 'One week of data is too thin to act on' },
  { id: 'dismiss-other-priority', label: 'Another cohort matters more right now' },
];

/**
 * The order options are shown in. Fixed, so the demo is reproducible, and arranged
 * so the strongest choice is not always first.
 */
export const OPTION_DISPLAY_ORDER: Record<RehearsalStepId, string[]> = {
  opening: ['o-workshop', 'o-diagnose', 'o-observe', 'o-expand'],
  firstQuestion: ['q-time', 'q-walkthrough', 'q-training'],
  followUp: ['f-volume', 'f-automate', 'f-evidence'],
  intervention: ['i-reminder', 'i-replace', 'i-auto', 'i-later'],
  measurement: ['m-completion', 'm-returned', 'm-activity', 'm-pilot', 'm-seats'],
};
