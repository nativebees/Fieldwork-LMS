import type { AccountContext, ObservationWindow, SellerContext, SellerProfileId } from '../types';

/**
 * Everything in this file is synthetic. Meridian Works, its sponsor, its notes and
 * its numbers were invented for this demo. Nothing here comes from a real customer
 * or from the author's employment history.
 */

export const OBSERVATION_WINDOW: ObservationWindow = {
  start: '2026-11-16',
  end: '2026-11-22',
  timezone: 'UTC',
  snapshotDate: '2026-11-23',
  days: 7,
};

export const SNAPSHOT_LABEL = 'Synthetic snapshot · 2026-11-23';

export const ACCOUNT: AccountContext = {
  id: 'acct-meridian-works',
  name: 'Meridian Works',
  industry: 'B2B software',
  plan: 'Enterprise',
  synthetic: true,
  mission: 'Prepare for the adoption review. Leave with a clearer picture of the work and one useful next step.',
  expansionCondition: 'Expansion is only on the table after the customer sees useful, sustained work.',
  sponsor: { name: 'Dana Whitfield', title: 'Director of Marketing Operations' },
  approvalOwnerRole: 'campaign owner',
  recurringTask: 'campaign briefs',
  crm: {
    label: 'Simulated CRM and call-note context. No CRM is connected.',
    asOf: '2026-11-25',
    surface: 'The account record, in meeting prep',
    dealSituation: 'An adoption review ahead of a June 2027 renewal. The sponsor wants to see value before any conversation about seats.',
    dealLabel: 'Adoption review, renewal June 2027',
    stage: 'Adoption review',
    renewal: 'June 2027',
    nextMeeting: { date: '2026-12-02', title: 'Adoption review with Dana Whitfield' },
    lastCallNote: {
      date: '2026-11-12',
      text: 'Dana asked whether Marketing usage is real work or just chatting. She wants to see value before any conversation about seats.',
    },
  },
};

/** The line that changes the brief. Revealed in the seller rehearsal. */
export const CUSTOMER_CONSTRAINT = {
  id: 'constraint-claims-approval',
  speaker: 'Dana Whitfield',
  quote:
    'The team repeats campaign briefs, but the real sticking point is unsupported product claims. Approval must stay with the campaign owner.',
  sourceId: 'src-sponsor-constraint',
};

export const SELLER_PROFILES: Record<SellerProfileId, SellerContext> = {
  'ae-new': {
    id: 'ae-new',
    role: 'New Enterprise AE',
    shortRole: 'Enterprise AE',
    tenureLabel: '45 days in role',
    tenureDays: 45,
    needs: [
      'Interpreting evidence without over-reading it',
      'Asking a diagnostic question before proposing',
      'Avoiding an expansion promise the evidence cannot support',
    ],
  },
  'csm-experienced': {
    id: 'csm-experienced',
    role: 'Experienced CSM',
    shortRole: 'CSM',
    tenureLabel: '18 months in role',
    tenureDays: 548,
    needs: [
      'Prioritizing one intervention over several',
      'Setting pilot criteria before launch',
      'Aligning with the sponsor on who judges the result',
    ],
  },
};

export const DEFAULT_SELLER_PROFILE: SellerProfileId = 'ae-new';
