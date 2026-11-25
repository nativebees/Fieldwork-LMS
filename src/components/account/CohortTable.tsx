import { SEGMENT_LABEL, formatObservation, formatPercent, percent } from '../../rules/analytics';
import { cn } from '../../lib/cn';
import type { Cohort, SegmentKey, UsageObservation } from '../../types';

/**
 * Cohort breakdown: a table of figures with a thin segmented bar per row.
 * The text carries every number, so the bar never has to be read by colour alone.
 * Marks use the validated chart palette in a fixed order. Unavailable is a hatch.
 */

const SEGMENT_CLASS: Record<SegmentKey, string> = {
  focus: 'bg-chart-focus',
  project: 'bg-chart-project',
  skill: 'bg-chart-skill',
  other: 'bg-chart-other',
  unassessable: 'hatch',
  inactive: 'bg-chart-inactive',
};

function Swatch({ segment }: { segment: SegmentKey }) {
  return <span aria-hidden="true" className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]', SEGMENT_CLASS[segment])} />;
}

function SegmentedBar({ cohort }: { cohort: Cohort }) {
  const parts = cohort.segments.filter((s) => s.count > 0);
  const summary = parts.map((s) => `${s.label}: ${s.count} of ${cohort.assigned}`).join('. ');
  return (
    <div
      className="group relative rounded-full py-2 outline-offset-4"
      role="img"
      tabIndex={0}
      aria-label={`${cohort.department}, split of ${cohort.assigned} assigned seats. ${summary}.`}
      data-testid={`bar-${cohort.department.toLowerCase()}`}
    >
      <div className="flex h-2 w-full gap-[2px]">
        {parts.map((s) => (
          <span
            key={s.key}
            className={cn('h-full min-w-[3px] first:rounded-l-full last:rounded-r-full', SEGMENT_CLASS[s.key])}
            style={{ flexGrow: s.count, flexBasis: 0 }}
          />
        ))}
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-full left-0 z-20 hidden w-max max-w-[300px] rounded-md border border-rule-strong bg-paper px-3 py-2 shadow-lift group-hover:block group-focus-visible:block"
      >
        <p className="eyebrow mb-1.5">
          {cohort.department} · {cohort.assigned} assigned seats
        </p>
        <ul className="flex flex-col gap-1">
          {parts.map((s) => (
            <li key={s.key} className="flex items-center gap-2 text-[12.5px]">
              <Swatch segment={s.key} />
              <span className="flex-1">{s.label}</span>
              <span className="tabular font-semibold">{s.count}</span>
              <span className="tabular w-9 text-right text-ink-2">{formatPercent(s.count, cohort.assigned)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ObservationValue({ observation, emphasis = false }: { observation: UsageObservation | undefined; emphasis?: boolean }) {
  if (!observation) return null;
  if (observation.value === null) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-ink-2" title={observation.missingReason}>
        <Swatch segment="unassessable" />
        <span className="italic">Unavailable</span>
      </span>
    );
  }
  return (
    <span className={cn('tabular whitespace-nowrap', emphasis && 'font-semibold')}>
      {formatObservation(observation)}
      {observation.missing === 'partial' && (
        <span className="block text-[12px] font-normal text-ink-2" title={observation.missingReason}>
          {observation.coverage.unavailable} unavailable
        </span>
      )}
    </span>
  );
}

interface Props {
  cohorts: Cohort[];
  observations: UsageObservation[];
  priorityCohortId: string;
}

export function CohortTable({ cohorts, observations, priorityCohortId }: Props) {
  const find = (cohort: Cohort, suffix: string) =>
    observations.find((o) => o.id === `obs-${cohort.department.toLowerCase()}-${suffix}`);
  const present = new Set(cohorts.flatMap((c) => c.segments.filter((s) => s.count > 0).map((s) => s.key)));
  const legend = (Object.keys(SEGMENT_LABEL) as SegmentKey[]).filter((k) => present.has(k));

  return (
    <div data-testid="cohort-table">
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Legend">
        {legend.map((key) => (
          <li key={key} className="flex items-center gap-1.5 text-[12px] text-ink-2">
            <Swatch segment={key} />
            {SEGMENT_LABEL[key]}
          </li>
        ))}
      </ul>

      {/* Wide screens: a real table */}
      <table className="hidden w-full table-fixed border-collapse text-left text-[13.5px] md:table">
        <colgroup>
          <col className="w-[15%]" />
          <col className="w-[17%]" />
          <col className="w-[25%]" />
          <col className="w-[17%]" />
          <col className="w-[14%]" />
          <col className="w-[12%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-rule-strong">
            {['Department', 'Seats active', 'Split of assigned seats', 'Frequent chat, no reuse', 'Project use', 'Skill use'].map((h, i) => (
              <th key={h} scope="col" className={cn('eyebrow py-2 align-bottom font-semibold', i < 5 && 'pr-4')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((cohort) => {
            const priority = cohort.id === priorityCohortId;
            return (
              <tr key={cohort.id} className="border-b border-rule align-middle" data-testid={`cohort-row-${cohort.department.toLowerCase()}`}>
                <th scope="row" className="py-2.5 pr-4 font-semibold">
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className={cn('h-4 w-[3px] rounded-full', priority ? 'bg-terracotta' : 'bg-transparent')} />
                    {cohort.department}
                  </span>
                </th>
                <td className="tabular py-2.5 pr-4 whitespace-nowrap">
                  {cohort.active} of {cohort.assigned}
                  <span className="ml-1.5 text-ink-2">{formatPercent(cohort.active, cohort.assigned)}</span>
                </td>
                <td className="py-1 pr-6">
                  <SegmentedBar cohort={cohort} />
                </td>
                <td className="py-2.5 pr-4">
                  <ObservationValue observation={find(cohort, 'frequent-no-reuse')} emphasis={priority} />
                </td>
                <td className="py-2.5 pr-4">
                  <ObservationValue observation={find(cohort, 'project')} />
                </td>
                <td className="py-2.5">
                  <ObservationValue observation={find(cohort, 'skill')} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Narrow screens: the same figures, stacked */}
      <ul className="flex flex-col md:hidden">
        {cohorts.map((cohort) => (
          <li key={cohort.id} className="border-t border-rule py-3 first:border-t-0">
            <div className="flex items-baseline justify-between gap-3">
              <p className="flex items-center gap-2 font-semibold">
                <span aria-hidden="true" className={cn('h-4 w-[3px] rounded-full', cohort.id === priorityCohortId ? 'bg-terracotta' : 'bg-transparent')} />
                {cohort.department}
              </p>
              <p className="tabular text-[13px]">
                {cohort.active} of {cohort.assigned} active
                <span className="ml-1.5 text-ink-2">{percent(cohort.active, cohort.assigned)}%</span>
              </p>
            </div>
            <SegmentedBar cohort={cohort} />
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-[13px]">
              {(
                [
                  ['Frequent chat, no reuse', 'frequent-no-reuse'],
                  ['Project use', 'project'],
                  ['Skill use', 'skill'],
                ] as const
              ).map(([label, suffix]) => (
                <div key={suffix} className="flex items-baseline justify-between gap-3">
                  <dt className="text-ink-2">{label}</dt>
                  <dd>
                    <ObservationValue observation={find(cohort, suffix)} />
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
