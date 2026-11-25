import { OBSERVATION_WINDOW, SNAPSHOT_LABEL } from '../../fixtures/account';
import { formatDateRange } from '../../lib/format';
import { FREQUENT_CHAT_DAYS, formatObservation } from '../../rules/analytics';
import { MIN_ELIGIBLE_COUNT, MIN_ELIGIBLE_SHARE } from '../../rules/recommendations';
import type { Cohort, LearningNeedHypothesis, UsageObservation } from '../../types';
import { Modal } from '../ui/Modal';
import { SourceLine, Tag } from '../ui/primitives';

const PRODUCT_LABEL = { chat: 'Chat', projects: 'Projects', skills: 'Skills' } as const;
const MISSING_LABEL = { complete: 'Complete', partial: 'Partly unavailable', unavailable: 'Unavailable' } as const;

function idRange(ids: string[]): string {
  if (ids.length === 0) return 'None';
  return ids.length === 1 ? ids[0] : `${ids[0]} to ${ids[ids.length - 1]}`;
}

interface Props {
  hypothesis: LearningNeedHypothesis | null;
  cohort: Cohort | null;
  observations: UsageObservation[];
  onClose: () => void;
}

/** Everything behind a recommendation: each observation with its provenance, the rule and the sources. */
export function EvidenceDrawer({ hypothesis, cohort, observations, onClose }: Props) {
  const rows = hypothesis ? observations.filter((o) => hypothesis.observationIds.includes(o.id)) : [];
  return (
    <Modal
      open={hypothesis !== null}
      onClose={onClose}
      title={hypothesis ? `${hypothesis.department}: what the evidence is` : 'Evidence'}
      eyebrow="Evidence drawer"
      width="md"
      testId="evidence-drawer"
    >
      {hypothesis && cohort && (
        <div className="flex flex-col gap-6">
          <section>
            <h3 className="eyebrow mb-2">Observations</h3>
            <p className="meta mb-3">
              Window {formatDateRange(OBSERVATION_WINDOW.start, OBSERVATION_WINDOW.end)}, {OBSERVATION_WINDOW.days} days, UTC · {SNAPSHOT_LABEL}
            </p>
            <ul className="flex flex-col">
              {rows.map((o) => (
                <li key={o.id} className="border-t border-rule py-3 first:border-t-0 first:pt-0" data-testid={`observation-${o.id}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[14px] font-semibold">{o.label}</p>
                    <p className="tabular shrink-0 text-[15px] font-semibold">{o.value === null ? <span className="italic">Unavailable</span> : formatObservation(o)}</p>
                  </div>
                  <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12.5px]">
                    <dt className="text-ink-2">Denominator</dt>
                    <dd className="tabular">
                      {o.denominator} {o.denominatorLabel}
                    </dd>
                    <dt className="text-ink-2">Product</dt>
                    <dd>{PRODUCT_LABEL[o.product]}</dd>
                    <dt className="text-ink-2">Coverage</dt>
                    <dd className="tabular">
                      {o.coverage.withData} with data, {o.coverage.unavailable} unavailable
                    </dd>
                    <dt className="text-ink-2">Missing values</dt>
                    <dd>
                      <Tag tone={o.missing === 'complete' ? 'outline' : 'ochre'}>{MISSING_LABEL[o.missing]}</Tag>
                    </dd>
                    <dt className="text-ink-2">Source</dt>
                    <dd>Synthetic usage snapshot (Fieldwork fixture)</dd>
                  </dl>
                  {o.missingReason && <p className="mt-1.5 text-[12.5px] leading-snug text-ochre-deep">{o.missingReason}</p>}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="eyebrow mb-2">The rule that produced this</h3>
            <p className="text-[13.5px] leading-relaxed">
              A member matches the pattern when they chatted on {FREQUENT_CHAT_DAYS} or more days in the window, both Projects and Skills are
              available to them, telemetry is sufficient and no Project or Skill use was observed. A restricted capability or a missing value
              never matches.
            </p>
            <p className="mt-2 text-[13.5px] leading-relaxed">
              The pattern is raised as a hypothesis when at least {MIN_ELIGIBLE_COUNT} members match and they are {Math.round(MIN_ELIGIBLE_SHARE * 100)}%
              or more of the active members in the group.
            </p>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
              <dt className="text-ink-2">Members matching</dt>
              <dd className="tabular" data-testid="evidence-matching">
                {cohort.eligibleMemberIds.length} ({idRange(cohort.eligibleMemberIds)})
              </dd>
              <dt className="text-ink-2">Cannot be assessed</dt>
              <dd className="tabular">
                {cohort.blockedMemberIds.length}
                {cohort.blockedMemberIds.length > 0 ? ` (${idRange(cohort.blockedMemberIds)})` : ''}
              </dd>
            </dl>
          </section>

          <section>
            <h3 className="eyebrow mb-2">What this cannot tell you</h3>
            <ul className="flex list-disc flex-col gap-1 pl-4 text-[13.5px] leading-relaxed marker:text-rule-strong">
              <li>What anyone knows or is able to do. It counts features used in one week.</li>
              <li>Whether chat is already the right tool for the work.</li>
              <li>Anything about a real customer. These records are synthetic, and the three groups are disjoint in this fixture only.</li>
            </ul>
          </section>

          <section>
            <h3 className="eyebrow mb-3">Sources behind this recommendation</h3>
            <ul className="flex flex-col gap-3.5">
              {hypothesis.sourceIds.map((id) => (
                <li key={id}>
                  <SourceLine sourceId={id} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Modal>
  );
}
