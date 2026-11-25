import type { ReactNode } from 'react';
import { ArrowRight, ArrowUpDown, ClipboardCheck, Minus, Pencil, Plus, Repeat2, Settings2 } from 'lucide-react';
import type { ProgramChange } from '../types';
import { Tag } from './ui/primitives';

/**
 * Renders a program diff. Used for proposal previews, the constraint banner and
 * the review, so "what changed" always comes from the same comparison.
 */

const ICON: Record<ProgramChange['type'], ReactNode> = {
  meta: <Settings2 size={14} aria-hidden="true" />,
  'lesson-added': <Plus size={14} aria-hidden="true" />,
  'lesson-removed': <Minus size={14} aria-hidden="true" />,
  'lesson-replaced': <Repeat2 size={14} aria-hidden="true" />,
  'lesson-moved': <ArrowUpDown size={14} aria-hidden="true" />,
  'lesson-edited': <Pencil size={14} aria-hidden="true" />,
  'assessment-changed': <ClipboardCheck size={14} aria-hidden="true" />,
};

const LABEL: Record<ProgramChange['type'], string> = {
  meta: 'Program',
  'lesson-added': 'Added',
  'lesson-removed': 'Removed',
  'lesson-replaced': 'Replaced',
  'lesson-moved': 'Moved',
  'lesson-edited': 'Edited',
  'assessment-changed': 'Assessment',
};

function BeforeAfter({ before, after }: { before: string; after: string }) {
  return (
    <div className="mt-1 grid gap-x-3 gap-y-1 text-[13px] leading-snug sm:grid-cols-[1fr_auto_1fr] sm:items-start">
      <p className="text-ink-2 line-through decoration-rule-strong">{before || 'Empty'}</p>
      <ArrowRight size={13} className="mt-[3px] hidden text-ink-2 sm:block" aria-hidden="true" />
      <p>
        <span className="sr-only">becomes </span>
        {after || 'Removed'}
      </p>
    </div>
  );
}

function Body({ change }: { change: ProgramChange }) {
  switch (change.type) {
    case 'meta':
      return (
        <>
          <p className="text-[13.5px] font-semibold">{change.field}</p>
          <BeforeAfter before={change.before} after={change.after} />
        </>
      );
    case 'lesson-added':
      return (
        <p className="text-[13.5px]">
          <span className="font-semibold">{change.title}</span> <span className="text-ink-2">· {change.where}</span>
        </p>
      );
    case 'lesson-removed':
      return (
        <p className="text-[13.5px]">
          <span className="font-semibold">{change.title}</span> <span className="text-ink-2">· was {change.where}</span>
        </p>
      );
    case 'lesson-replaced':
      return (
        <>
          <p className="text-[13.5px] text-ink-2">{change.where}</p>
          <BeforeAfter before={change.before} after={change.after} />
        </>
      );
    case 'lesson-moved':
      return (
        <>
          <p className="text-[13.5px] font-semibold">{change.title}</p>
          <BeforeAfter before={change.from} after={change.to} />
        </>
      );
    case 'lesson-edited':
      return (
        <>
          <p className="text-[13.5px] font-semibold">{change.title}</p>
          <ul className="mt-1 flex flex-col gap-2">
            {change.fields.map((f, i) => (
              <li key={`${f.field}-${i}`}>
                <p className="meta">{f.field}</p>
                {f.before && f.after ? (
                  <BeforeAfter before={f.before} after={f.after} />
                ) : (
                  <p className="mt-0.5 text-[13px] leading-snug">
                    {f.after || <span className="text-ink-2 line-through decoration-rule-strong">{f.before}</span>}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      );
    case 'assessment-changed':
      return (
        <>
          <p className="text-[13.5px] font-semibold">{change.title}</p>
          <p className="meta mt-1 flex flex-wrap items-center gap-1.5">
            <span className="line-through decoration-rule-strong">{change.before}</span>
            <ArrowRight size={12} aria-hidden="true" />
            <span className="sr-only">becomes</span>
            <span className="font-medium text-ink">{change.after}</span>
          </p>
          {(change.criteriaAdded.length > 0 || change.criteriaRemoved.length > 0) && (
            <ul className="mt-1.5 flex flex-col gap-0.5 text-[12.5px] leading-snug">
              {change.criteriaAdded.map((c) => (
                <li key={`add-${c}`} className="flex gap-1.5 text-sage-deep">
                  <Plus size={12} className="mt-[3px] shrink-0" aria-hidden="true" />
                  <span>
                    <span className="sr-only">Criterion added: </span>
                    {c}
                  </span>
                </li>
              ))}
              {change.criteriaRemoved.map((c) => (
                <li key={`remove-${c}`} className="flex gap-1.5 text-ink-2">
                  <Minus size={12} className="mt-[3px] shrink-0" aria-hidden="true" />
                  <span>
                    <span className="sr-only">Criterion removed: </span>
                    {c}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      );
  }
}

export interface ChangeReason {
  why: string;
  source: 'customer-constraint' | 'tailoring' | 'review' | 'author';
}

const SOURCE_TAG: Record<ChangeReason['source'], { label: string; tone: 'terracotta' | 'neutral' | 'outline' }> = {
  'customer-constraint': { label: 'Customer constraint', tone: 'terracotta' },
  tailoring: { label: 'Tailoring', tone: 'neutral' },
  review: { label: 'Mapping review', tone: 'neutral' },
  author: { label: 'Author edit', tone: 'outline' },
};

export function ChangeList({ changes, reasons, testId }: { changes: ProgramChange[]; reasons?: ChangeReason[]; testId?: string }) {
  if (changes.length === 0) return <p className="text-[13.5px] text-ink-2">No changes.</p>;
  return (
    <ul className="flex flex-col" data-testid={testId}>
      {changes.map((change, i) => {
        const reason = reasons?.[i];
        return (
          <li
            key={i}
            className="grid grid-cols-[92px_1fr] gap-x-3 border-t border-rule py-3 first:border-t-0 first:pt-0"
            data-change-type={change.type}
          >
            <p className="eyebrow flex items-start gap-1.5 pt-[2px]">
              <span className="mt-px">{ICON[change.type]}</span>
              {LABEL[change.type]}
            </p>
            <div className="min-w-0">
              <Body change={change} />
              {reason && (
                <p className="mt-2 flex flex-wrap items-start gap-x-2 gap-y-1 text-[12.5px] leading-snug text-ink-2">
                  <Tag tone={SOURCE_TAG[reason.source].tone}>{SOURCE_TAG[reason.source].label}</Tag>
                  <span className="min-w-0 flex-1 basis-[240px]">
                    <span className="font-semibold text-ink">Why. </span>
                    {reason.why}
                  </span>
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Compact comparison: what changed, grouped by why                    */
/* ------------------------------------------------------------------ */

function Wording({ change, label = 'Show wording' }: { change: ProgramChange; label?: string }) {
  return (
    <details className="group mt-1">
      <summary className="cursor-pointer text-[12px] text-ink-2 underline decoration-rule-strong underline-offset-2 hover:text-ink">
        <span className="group-open:hidden">{label}</span>
        <span className="hidden group-open:inline">Hide</span>
      </summary>
      <div className="mt-2 border-l-2 border-rule pl-3">
        <Body change={change} />
      </div>
    </details>
  );
}

function CompactChange({ change }: { change: ProgramChange }) {
  const lead = (
    <span className="mr-1.5 inline-flex translate-y-[2px] text-ink-2" aria-hidden="true">
      {ICON[change.type]}
    </span>
  );
  switch (change.type) {
    case 'meta': {
      const short = change.before.length + change.after.length < 90;
      return (
        <div className="text-[13.5px] leading-snug">
          {lead}
          <span className="font-semibold">{change.field}</span>
          {short ? (
            <>
              {': '}
              <span className="text-ink-2 line-through decoration-rule-strong">{change.before}</span>
              <span className="sr-only"> becomes </span>
              <ArrowRight size={12} className="mx-1.5 inline text-ink-2" aria-hidden="true" />
              {change.after}
            </>
          ) : (
            <>
              {' rewritten'}
              <Wording change={change} />
            </>
          )}
        </div>
      );
    }
    case 'lesson-replaced':
      return (
        <p className="text-[13.5px] leading-snug">
          {lead}
          <span className="text-ink-2 line-through decoration-rule-strong">{change.before}</span>
          <span className="sr-only"> replaced by </span>
          <ArrowRight size={12} className="mx-1.5 inline text-ink-2" aria-hidden="true" />
          <span className="font-semibold">{change.after}</span>
          <span className="text-ink-2"> · {change.where}</span>
        </p>
      );
    case 'lesson-added':
      return (
        <p className="text-[13.5px] leading-snug">
          {lead}Added <span className="font-semibold">{change.title}</span>
          <span className="text-ink-2"> · {change.where}</span>
        </p>
      );
    case 'lesson-removed':
      return (
        <p className="text-[13.5px] leading-snug">
          {lead}Removed <span className="font-semibold">{change.title}</span>
          <span className="text-ink-2"> · was {change.where}</span>
        </p>
      );
    case 'lesson-moved':
      return (
        <p className="text-[13.5px] leading-snug">
          {lead}Moved <span className="font-semibold">{change.title}</span>
          <span className="text-ink-2">
            {' '}
            · from {change.from} to {change.to}
          </span>
        </p>
      );
    case 'lesson-edited':
      return (
        <div className="text-[13.5px] leading-snug">
          {lead}Edited <span className="font-semibold">{change.title}</span>
          <span className="text-ink-2"> · {change.fields.map((f) => f.field.toLowerCase()).join(', ')}</span>
          <Wording change={change} />
        </div>
      );
    case 'assessment-changed':
      return (
        <div className="text-[13.5px] leading-snug">
          {lead}
          <span className="font-semibold">{change.title}</span> is now scored by <span className="meta text-ink">{change.after}</span>
          <span className="text-ink-2">
            {' '}
            · was <span className="meta">{change.before}</span>
            {change.criteriaAdded.length > 0 && ` · ${change.criteriaAdded.length} criteria added`}
            {change.criteriaRemoved.length > 0 && ` · ${change.criteriaRemoved.length} removed`}
          </span>
          {(change.criteriaAdded.length > 0 || change.criteriaRemoved.length > 0) && <Wording change={change} label="Show criteria" />}
        </div>
      );
  }
}

export interface ExplainedItem extends ChangeReason {
  change: ProgramChange;
}

/**
 * The compact "what changed and why" comparison. Changes that share a reason are
 * grouped, so each reason is stated once next to everything it caused.
 */
export function ChangeGroups({ items, testId }: { items: ExplainedItem[]; testId?: string }) {
  const groups: Array<{ key: string; why: string; source: ChangeReason['source']; changes: ProgramChange[] }> = [];
  for (const item of items) {
    const key = `${item.source}|${item.why}`;
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, why: item.why, source: item.source, changes: [] };
      groups.push(group);
    }
    group.changes.push(item.change);
  }
  if (groups.length === 0) return <p className="text-[13.5px] text-ink-2">No changes.</p>;
  return (
    <div data-testid={testId}>
      <div className="hidden grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-x-8 border-b border-rule-strong pb-1.5 md:grid" aria-hidden="true">
        <p className="eyebrow">What changed</p>
        <p className="eyebrow">Why</p>
      </div>
      <ol className="flex flex-col">
        {groups.map((group) => (
          <li
            key={group.key}
            className="grid gap-x-8 gap-y-2.5 border-t border-rule py-3.5 first:border-t-0 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]"
            data-change-source={group.source}
          >
            <ul className="flex min-w-0 flex-col gap-2">
              {group.changes.map((change, i) => (
                <li key={i} data-change-type={change.type}>
                  <CompactChange change={change} />
                </li>
              ))}
            </ul>
            <div className="min-w-0 text-[13px] leading-snug text-ink-2">
              <Tag tone={SOURCE_TAG[group.source].tone}>{SOURCE_TAG[group.source].label}</Tag>
              <p className="mt-1.5">
                <span className="sr-only">Why: </span>
                {group.why}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
