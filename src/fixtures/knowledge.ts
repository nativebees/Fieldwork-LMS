import type { SourceReference } from '../types';

/**
 * A tiny dated knowledge pack.
 *
 * Official entries are original summaries of pages that were fetched and read on
 * 2026-11-25 while this prototype was built. Synthetic entries are identified as
 * synthetic. An entry with checkedOn: null has no review date and must be shown
 * as "needs review", never as authoritative.
 */

export const KNOWLEDGE_CHECKED_ON = '2026-11-25';

export const SOURCES: SourceReference[] = [
  {
    id: 'src-snapshot',
    kind: 'synthetic-analytics',
    title: 'Meridian Works usage snapshot',
    publisher: 'Fieldwork synthetic fixture',
    summary:
      'Member-level records for 200 assigned seats, 16 to 22 November 2026 (UTC). Invented for this demo. Not exported from any Claude product.',
    checkedOn: '2026-11-23',
    review: 'reviewed',
    reviewNote: 'Synthetic. The checked date is the fixture snapshot date.',
  },
  {
    id: 'src-sponsor-note',
    kind: 'synthetic-sponsor',
    title: 'Sponsor call note, 12 November 2026',
    publisher: 'Synthetic sponsor context',
    summary:
      'Dana Whitfield asked whether Marketing usage is real work or just chatting, and said she wants to see value before any conversation about seats.',
    checkedOn: '2026-11-12',
    review: 'reviewed',
    reviewNote: 'Synthetic. Written for this scenario.',
  },
  {
    id: 'src-sponsor-constraint',
    kind: 'synthetic-sponsor',
    title: 'Sponsor statement in the adoption review',
    publisher: 'Synthetic sponsor context',
    summary:
      'The team repeats campaign briefs. The sticking point is unsupported product claims. Approval stays with the campaign owner.',
    checkedOn: KNOWLEDGE_CHECKED_ON,
    review: 'reviewed',
    reviewNote: 'Synthetic. Scripted for the seller rehearsal.',
  },
  {
    id: 'src-meridian-sources',
    kind: 'synthetic-customer',
    title: 'Meridian Works approved source list',
    publisher: 'Synthetic stand-in for a customer-owned list',
    summary:
      'Release notes, an integration catalog, a pricing sheet and event documents used in the practice drafts. In real use the customer supplies this list and the campaign owner decides what counts.',
    checkedOn: KNOWLEDGE_CHECKED_ON,
    review: 'reviewed',
    reviewNote: 'Synthetic. Replace with the customer’s own list before any delivery.',
  },
  {
    id: 'src-usage-analytics',
    kind: 'official',
    title: 'View usage analytics for Team and Enterprise plans',
    publisher: 'Claude Help Center',
    url: 'https://support.claude.com/en/articles/12883420-view-usage-analytics-for-team-and-enterprise-plans',
    summary:
      'Owners and admins can open in-product analytics that show who is using Claude by product, adoption and stickiness, Skill and connector use, chat activity such as projects and artifacts, and Cowork sessions. A seller does not see these views unless the customer shares them.',
    checkedOn: KNOWLEDGE_CHECKED_ON,
    review: 'reviewed',
  },
  {
    id: 'src-analytics-api',
    kind: 'official',
    title: 'Analytics APIs',
    publisher: 'Claude Platform documentation',
    url: 'https://platform.claude.com/docs/en/manage-claude/analytics-api',
    summary:
      'Two separate APIs exist. The Claude Enterprise Analytics API needs an Analytics API key with the read:analytics scope, and only the organization’s primary owner can create one. Engagement data is a per-day snapshot that usually arrives the next day. Most Chat and Cowork unified activity is reported under its own product value.',
    checkedOn: KNOWLEDGE_CHECKED_ON,
    review: 'reviewed',
  },
  {
    id: 'src-user-activity',
    kind: 'official',
    title: 'List User Activity',
    publisher: 'Claude Platform API reference',
    url: 'https://platform.claude.com/docs/en/api/http/beta/organization/analytics/users/list',
    summary:
      'Per-member activity for a UTC day or a date range. Distinct counts over a range are recomputed or approximated and are never a sum of daily values. Some fields can be null, which means unavailable. Rows grouped by RBAC group are not an exclusive partition and can sum above organization totals.',
    checkedOn: KNOWLEDGE_CHECKED_ON,
    review: 'reviewed',
  },
  {
    id: 'src-surveys',
    kind: 'official',
    title: 'Create surveys for your organization',
    publisher: 'Claude Help Center',
    url: 'https://support.claude.com/en/articles/16764057-create-surveys-for-your-organization',
    summary:
      'Enterprise owners and admins can run short in-product surveys. Each survey exports as a CSV with one row per response, including the respondent’s email and group, so exports are identifiable. The article does not describe a survey API.',
    checkedOn: KNOWLEDGE_CHECKED_ON,
    review: 'reviewed',
  },
  {
    id: 'src-brand',
    kind: 'official',
    title: 'Brand guidelines skill',
    publisher: 'anthropics/skills on GitHub',
    url: 'https://github.com/anthropics/skills/blob/main/skills/brand-guidelines/SKILL.md',
    summary:
      'Lists published brand colours, including the dark, light, light gray, orange and green values that Fieldwork uses as starting points. It names Poppins and Lora as its fonts. Fieldwork uses different typefaces by choice.',
    checkedOn: KNOWLEDGE_CHECKED_ON,
    review: 'reviewed',
  },
  {
    id: 'src-role',
    kind: 'official',
    title: 'Role posting this concept responds to',
    publisher: 'Anthropic careers (Greenhouse)',
    url: 'https://job-boards.greenhouse.io/anthropic/jobs/5461190008',
    summary:
      'Listed in the product brief as the role behind this concept. No summary is given because the page could not be re-read while the prototype was built.',
    checkedOn: null,
    review: 'review-required',
    reviewNote:
      'The host was unreachable from the build environment on 2026-11-25. The product brief records its own check on that date. Re-read before publication.',
  },
  {
    id: 'src-field-note',
    kind: 'unreviewed-note',
    title: 'Field note: packaging recurring work',
    publisher: 'Synthetic internal note, undated',
    summary:
      'Suggests teams reuse a workflow more often once it is packaged and shared. Written as a plausible internal note for this demo. It has no author, no review date and no evidence behind it.',
    checkedOn: null,
    review: 'review-required',
    reviewNote: 'No review date recorded. Use it to form a question, not to state a fact.',
  },
];

export const SOURCE_BY_ID: Record<string, SourceReference> = Object.fromEntries(SOURCES.map((s) => [s.id, s]));

export const SOURCE_KIND_LABEL: Record<SourceReference['kind'], string> = {
  official: 'Official documentation',
  'synthetic-sponsor': 'Synthetic sponsor context',
  'synthetic-customer': 'Synthetic customer material',
  'synthetic-analytics': 'Synthetic analytics',
  'unreviewed-note': 'Unreviewed note',
};
