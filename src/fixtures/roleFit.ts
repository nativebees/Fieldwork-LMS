/**
 * How the prototype answers the role it was built for.
 *
 * These are design choices derived from the public posting (source id "src-role").
 * They do not describe Anthropic's internal systems, and the "not shown" column is
 * part of the claim: it marks where the prototype stops.
 */

export interface RoleFitRow {
  id: string;
  asked: string;
  shown: string;
  notShown: string;
}

export const ROLE_FIT_SOURCE_ID = 'src-role';

export const ROLE_FIT_INTRO =
  'Fieldwork answers a role that asks for enablement personalized to each seller’s role, tenure and live deals, delivered in the flow of work and measured by what it changes. The seller learns by preparing for a real account conversation. There is no course to complete.';

export const ROLE_FIT: RoleFitRow[] = [
  {
    id: 'personalized',
    asked: 'Tailored to each seller’s role, tenure and live deals',
    shown:
      'The next decision, the question to ask, the success criteria and the bar for measurement all change with the seller’s profile, inside one live account.',
    notShown: 'Two scripted profiles and one deal. No model tailors anything at runtime.',
  },
  {
    id: 'flow-of-work',
    asked: 'Guidance in the tools sellers already use, at the moment they need it',
    shown: 'The journey starts from an account review a week away and opens on a preparation task. It never starts from a course catalog.',
    notShown: 'The CRM entry point is simulated. Nothing is embedded in a real tool.',
  },
  {
    id: 'measured',
    asked: 'Measured by what it changes, beyond completion and satisfaction',
    shown:
      'Practice is scored on decisions and on the plan the seller actually built. The review proposes measures of use, live behaviour, customer outcome, ramp time, win rate and attainment.',
    notShown: 'No measure has been collected. There are no results to report.',
  },
  {
    id: 'knowledge',
    asked: 'Knowledge that stays accurate, current and easy to find',
    shown: 'Every piece of advice shows its source, the date it was checked and whether it still needs review.',
    notShown: 'A small fixed knowledge pack. No search and no automatic refresh.',
  },
  {
    id: 'governance',
    asked: 'Clear standards for responsible AI use and data governance',
    shown: 'The standards below are enforced in the interface and covered by tests.',
    notShown: 'They have not been reviewed by a legal, privacy or security team.',
  },
];

/** The standards the prototype holds itself to. Each one is visible in the product. */
export const STANDARDS: Array<{ id: string; rule: string; where: string }> = [
  {
    id: 'hypothesis',
    rule: 'A usage pattern is a hypothesis, never a diagnosis of a person.',
    where: 'Every recommendation is labeled and offers another explanation.',
  },
  {
    id: 'unavailable',
    rule: 'An unavailable value is never shown as zero.',
    where: 'A restricted capability leads to “check access first”, with no training proposed.',
  },
  {
    id: 'consent',
    rule: 'Customer data is used only with the customer’s authorization.',
    where: 'The analytics integration is a proposal that starts with the customer’s primary owner.',
  },
  {
    id: 'preview',
    rule: 'Nothing replaces a person’s work without a preview and their consent.',
    where: 'Every suggested change opens as a preview that can be cancelled.',
  },
  {
    id: 'labels',
    rule: 'Scripted output is never presented as model output.',
    where: 'The coaching badge reads from the active provider, and previews are labeled as rules.',
  },
  {
    id: 'practice',
    rule: 'A practice score describes a task, not a person.',
    where: 'Seller scores are labeled as practice and free text is never scored.',
  },
  {
    id: 'outcomes',
    rule: 'No outcome is claimed without measurement.',
    where: 'Follow-up and impact measures are marked proposed, and practice never changes adoption figures.',
  },
  {
    id: 'approval',
    rule: 'A person keeps the decisions that need accountability.',
    where: 'Approval stays with the campaign owner in every version of the program.',
  },
];
