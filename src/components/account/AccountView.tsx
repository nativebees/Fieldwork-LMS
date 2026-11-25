import { useState } from 'react';
import { ArrowRight, CircleAlert, RefreshCw, TriangleAlert } from 'lucide-react';
import { ACCOUNT, OBSERVATION_WINDOW, SELLER_PROFILES, SNAPSHOT_LABEL } from '../../fixtures/account';
import { daysBetween, formatDate, formatDateRange } from '../../lib/format';
import { useAsyncValue } from '../../lib/hooks';
import { hrefFor } from '../../lib/router';
import { activeCoachingProvider } from '../../providers/coaching';
import { useAccountData } from '../../state/data';
import { PRIMARY_RECOMMENDATION_ID } from '../../state/reducer';
import { useStore } from '../../state/store';
import type { LearningNeedHypothesis } from '../../types';
import { ProfileSwitch } from '../ProfileSwitch';
import { Button, LinkButton, SectionHeading, SourceLine, Tag } from '../ui/primitives';
import { CohortTable } from './CohortTable';
import { EvidenceDrawer } from './EvidenceDrawer';
import { RecommendationCard } from './RecommendationCard';

function NextDecision({ hypothesis }: { hypothesis: LearningNeedHypothesis }) {
  const { state } = useStore();
  const coaching = activeCoachingProvider();
  const seller = SELLER_PROFILES[state.sellerProfileId];
  const guidance = useAsyncValue(() => coaching.getGuidance({ seller, account: ACCOUNT, hypothesis }), [seller.id, hypothesis.id]);

  if (guidance.status === 'loading') {
    return (
      <section className="border-l-[3px] border-rule-strong pl-5" aria-busy="true">
        <p className="eyebrow">Your next decision</p>
        <p className="mt-2 text-ink-2">Loading guidance.</p>
      </section>
    );
  }
  if (guidance.status === 'error') {
    return (
      <section className="border-l-[3px] border-rule-strong pl-5">
        <p className="eyebrow">Your next decision</p>
        <p className="mt-2 text-ink-2">Guidance is unavailable right now. The evidence below is unaffected.</p>
      </section>
    );
  }

  const g = guidance.value;
  return (
    <section className="border-l-[3px] border-terracotta pl-5 sm:pl-6" aria-labelledby="next-decision" data-testid="next-decision">
      <div className="flex flex-wrap items-center gap-2">
        <p className="eyebrow">Your next decision</p>
        <Tag tone="outline">{coaching.label}</Tag>
      </div>
      <h2 id="next-decision" className="font-display mt-2 max-w-[24ch] text-[26px] sm:text-[30px]" data-testid="next-decision-title">
        {g.nextDecision}
      </h2>
      <dl
        className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5"
        data-testid="tailored-to"
        aria-label="What this guidance is tailored to"
      >
        <dt className="eyebrow mr-1">Tailored to</dt>
        <dd>
          <Tag tone="neutral">Role · {seller.shortRole}</Tag>
        </dd>
        <dd>
          <Tag tone="neutral">Tenure · {seller.tenureLabel}</Tag>
        </dd>
        <dd>
          <Tag tone="neutral">Live deal · {ACCOUNT.crm.dealLabel}</Tag>
        </dd>
      </dl>
      <p className="mt-2.5 max-w-[60ch] text-[15px] leading-relaxed text-ink-2">{g.objective}</p>

      <div className="mt-6 grid gap-x-10 gap-y-6 md:grid-cols-2">
        <div>
          <p className="eyebrow mb-2">A question worth asking</p>
          <blockquote className="font-serif text-[18px] leading-snug italic" data-testid="next-decision-question">
            “{g.question}”
          </blockquote>
        </div>
        <div>
          <p className="eyebrow mb-2">You will know it went well if</p>
          <ul className="flex flex-col gap-1.5 text-[14px] leading-snug" data-testid="next-decision-criteria">
            {g.successCriteria.map((c) => (
              <li key={c} className="flex gap-2">
                <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-5 max-w-[66ch] text-[14px] leading-snug" data-testid="deal-note">
        <span className="font-semibold">On this deal. </span>
        {g.dealNote}
      </p>

      <p className="mt-3 flex max-w-[66ch] items-start gap-2 text-[14px] leading-snug">
        <TriangleAlert size={15} className="mt-[2px] shrink-0 text-terracotta-deep" aria-hidden="true" />
        <span>
          <span className="font-semibold">Watch out. </span>
          {g.watchOut}
        </span>
      </p>

      {g.sourcedAdvice.length > 0 && (
        <div className="mt-5 border-t border-rule pt-4">
          <p className="eyebrow mb-2.5">What this leans on</p>
          <ul className="grid gap-x-10 gap-y-3 md:grid-cols-2">
            {g.sourcedAdvice.map((advice) => (
              <li key={advice.sourceId} className="text-[13.5px] leading-snug">
                <p className="mb-1.5">{advice.text}</p>
                <SourceLine sourceId={advice.sourceId} compact />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function AccountView() {
  const { data, retry } = useAccountData();
  const { state } = useStore();
  const [evidenceFor, setEvidenceFor] = useState<string | null>(null);
  const seller = SELLER_PROFILES[state.sellerProfileId];

  if (data.status === 'loading') {
    return (
      <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6" aria-busy="true" data-testid="account-loading">
        <p className="eyebrow">Account mission</p>
        <p className="font-display mt-2 text-[28px]">Loading the synthetic snapshot.</p>
      </div>
    );
  }

  if (data.status === 'error') {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-16 sm:px-6" data-testid="account-unavailable">
        <p className="eyebrow">Account mission</p>
        <h1 className="font-display mt-2 text-[32px]">The account evidence is unavailable.</h1>
        <p className="mt-3 flex items-start gap-2 text-[15px] leading-relaxed text-ink-2">
          <CircleAlert size={17} className="mt-[3px] shrink-0 text-ochre-deep" aria-hidden="true" />
          {data.error} No figures are shown, because an unavailable value is not a zero. The studio and the customer preview still work.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="primary" icon={<RefreshCw size={14} aria-hidden="true" />} onClick={retry}>
            Try again
          </Button>
          <LinkButton href={hrefFor('studio')}>Open the studio</LinkButton>
        </div>
      </div>
    );
  }

  const { organization, cohorts, observations, hypotheses } = data.value;
  const primary = hypotheses.find((h) => h.id === PRIMARY_RECOMMENDATION_ID) ?? hypotheses[0];
  const decision = state.decisions[PRIMARY_RECOMMENDATION_ID];
  const evidenceHypothesis = hypotheses.find((h) => h.id === evidenceFor) ?? null;
  const evidenceCohort = evidenceHypothesis ? (cohorts.find((c) => c.id === evidenceHypothesis.cohortId) ?? null) : null;

  return (
    <div className="mx-auto max-w-[1180px] px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <header className="max-w-[820px]">
        <div className="flex flex-wrap items-center gap-2">
          <p className="eyebrow">Account mission · {ACCOUNT.name}</p>
          <Tag tone="outline">Synthetic account</Tag>
        </div>
        <h1 className="font-display mt-3 text-[36px] sm:text-[48px]">Make the next customer conversation useful.</h1>
        <p className="mt-4 max-w-[64ch] text-[16px] leading-relaxed text-ink-2">
          {ACCOUNT.name} is an {ACCOUNT.plan} customer in {ACCOUNT.industry}. You have an adoption review with {ACCOUNT.sponsor.name},{' '}
          {ACCOUNT.sponsor.title}, on {formatDate(ACCOUNT.crm.nextMeeting.date)}. {ACCOUNT.expansionCondition}
        </p>
        <div className="mt-6">
          <ProfileSwitch />
        </div>
      </header>

      <div className="mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-12">
          <NextDecision hypothesis={primary} />

          <section aria-labelledby="signals">
            <SectionHeading
              id="signals"
              eyebrow="Evidence"
              title="What the snapshot shows"
              aside={
                <p className="meta">
                  {formatDateRange(OBSERVATION_WINDOW.start, OBSERVATION_WINDOW.end)} UTC · {SNAPSHOT_LABEL}
                </p>
              }
            />
            <p className="mt-4 text-[15px] leading-relaxed" data-testid="org-summary">
              <span className="tabular font-semibold">
                {organization.active} of {organization.assigned}
              </span>{' '}
              assigned seats were active in the window, or{' '}
              <span className="tabular font-semibold">
                {organization.activePercent === null ? 'an unavailable share' : `${organization.activePercent}%`}
              </span>
              . That is activity. It does not say whether the work was useful.
            </p>
            <div className="mt-5">
              <CohortTable cohorts={cohorts} observations={observations} priorityCohortId={primary.cohortId} />
            </div>
            <p className="mt-3 text-[12.5px] leading-snug text-ink-2">
              Unique members are counted once. The three departments are disjoint in this fixture only, so their totals happen to add up.
              Real groups overlap and must not be summed.
            </p>
          </section>

          <section aria-labelledby="recommendations">
            <SectionHeading
              id="recommendations"
              eyebrow="Decide"
              title="Recommendations"
              aside={<p className="meta">{hypotheses.length} from deterministic rules</p>}
            />
            <div className="mt-5 flex flex-col gap-5">
              {hypotheses.map((h) => (
                <RecommendationCard key={h.id} hypothesis={h} onOpenEvidence={() => setEvidenceFor(h.id)} />
              ))}
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start" aria-label="Context">
          <section className="paper overflow-hidden" data-testid="crm-strip">
            <div className="hatch-soft flex items-center justify-between gap-2 border-b border-rule px-4 py-2">
              <p className="eyebrow bg-surface-soft px-1">In the flow of work</p>
              <Tag tone="ochre">Simulated</Tag>
            </div>
            <div className="px-4 py-3.5">
              <p className="text-[13px] leading-snug" data-testid="flow-of-work">
                This brief would open from {ACCOUNT.crm.surface.charAt(0).toLowerCase() + ACCOUNT.crm.surface.slice(1)},{' '}
                <span className="font-semibold">{daysBetween(ACCOUNT.crm.asOf, ACCOUNT.crm.nextMeeting.date)} days before the review</span>.
                It is not a course to find and finish.
              </p>
              <p className="mt-1.5 text-[12.5px] leading-snug text-ink-2">{ACCOUNT.crm.label}</p>
              <dl className="mt-3 flex flex-col gap-2.5 text-[13.5px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-2">Stage</dt>
                  <dd className="text-right font-semibold">{ACCOUNT.crm.stage}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-2">Next meeting</dt>
                  <dd className="text-right font-semibold">{formatDate(ACCOUNT.crm.nextMeeting.date)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-2">Renewal</dt>
                  <dd className="text-right font-semibold">{ACCOUNT.crm.renewal}</dd>
                </div>
              </dl>
              <div className="mt-3.5 border-t border-rule pt-3">
                <p className="eyebrow">Call note · {formatDate(ACCOUNT.crm.lastCallNote.date)}</p>
                <p className="mt-1.5 font-serif text-[15px] leading-snug italic">{ACCOUNT.crm.lastCallNote.text}</p>
              </div>
            </div>
          </section>

          <section>
            <p className="eyebrow mb-2">Coaching focus · {seller.shortRole}</p>
            <ul className="flex flex-col gap-1.5 text-[13.5px] leading-snug" data-testid="coaching-focus">
              {seller.needs.map((need) => (
                <li key={need} className="flex gap-2">
                  <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-2" />
                  {need}
                </li>
              ))}
            </ul>
          </section>

          <section className="border-t border-rule pt-5">
            <p className="eyebrow mb-2">Next step</p>
            <p className="mb-3 text-[13.5px] leading-snug text-ink-2">
              {decision
                ? 'Your initial recommendation is recorded. Rehearse the conversation and see whether it survives contact with the customer.'
                : 'Record your initial call on the first recommendation. Then rehearse the conversation with Dana.'}
            </p>
            <LinkButton
              href={hrefFor('rehearsal')}
              variant={decision ? 'accent' : 'secondary'}
              size="lg"
              className="w-full"
              iconAfter={<ArrowRight size={15} aria-hidden="true" />}
              testId="go-rehearsal"
            >
              Rehearse the conversation
            </LinkButton>
          </section>
        </aside>
      </div>

      <EvidenceDrawer
        hypothesis={evidenceHypothesis}
        cohort={evidenceCohort}
        observations={observations}
        onClose={() => setEvidenceFor(null)}
      />
    </div>
  );
}
