import { ArrowRight, Check, CircleDashed, Undo2 } from 'lucide-react';
import { CUSTOMER_CONSTRAINT } from '../../fixtures/account';
import { hrefFor } from '../../lib/router';
import { explainChanges } from '../../rules/export';
import { SUGGESTION_ORDER, evaluateSuggestions, proposeSuggestions, type ProposalResult } from '../../rules/tailoring';
import { useStore } from '../../state/store';
import { ChangeList } from '../ChangeList';
import { Button, LinkButton, Tag } from '../ui/primitives';

/**
 * The signature moment, carried into the studio. It connects what the customer
 * said to the lessons and criteria it affects. Each suggestion can be previewed,
 * accepted or dismissed, and a manual edit that satisfies one counts as applied.
 */
export function ConstraintBanner({ onPropose }: { onPropose: (result: ProposalResult) => void }) {
  const { state, dispatch } = useStore();
  const suggestions = evaluateSuggestions(state.program, state.dismissedSuggestions);
  const pending = suggestions.filter((s) => s.status === 'pending');
  const applied = suggestions.filter((s) => s.status === 'applied');
  const changes = explainChanges(state);

  return (
    <section
      className="border border-rule-strong bg-paper shadow-[inset_4px_0_0_var(--color-terracotta)]"
      aria-labelledby="constraint-title"
      data-testid="constraint-banner"
    >
      <div className="grid gap-x-8 gap-y-4 px-5 py-4 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <p id="constraint-title" className="eyebrow text-terracotta-deep">
            The customer changed the brief
          </p>
          <blockquote className="font-display mt-2 text-[19px] leading-snug">“{CUSTOMER_CONSTRAINT.quote}”</blockquote>
          <p className="meta mt-2">{CUSTOMER_CONSTRAINT.speaker} · synthetic sponsor statement</p>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule pb-2">
            <p className="eyebrow">
              Suggested changes · {applied.length} of {suggestions.filter((s) => s.status !== 'not-applicable').length} in the program
            </p>
            {pending.length > 1 && (
              <Button
                size="sm"
                variant="accent"
                data-testid="preview-all-suggestions"
                onClick={() => onPropose(proposeSuggestions(state.program, SUGGESTION_ORDER, state.dismissedSuggestions, state.counter))}
              >
                Preview all {pending.length}
              </Button>
            )}
          </div>
          <ul className="flex flex-col">
            {suggestions.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5 border-t border-rule py-2.5 first:border-t-0"
                data-testid={`suggestion-${s.id}`}
                data-status={s.status}
              >
                <div className="flex min-w-0 flex-1 basis-[260px] items-start gap-2">
                  {s.status === 'applied' ? (
                    <Check size={15} className="mt-[2px] shrink-0 text-sage-deep" aria-hidden="true" />
                  ) : (
                    <CircleDashed size={15} className="mt-[2px] shrink-0 text-ink-2" aria-hidden="true" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[13.5px] leading-snug font-semibold">{s.title}</p>
                    <p className="mt-0.5 text-[12.5px] leading-snug text-ink-2">{s.why}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {s.status === 'applied' && <Tag tone="sage">In the program</Tag>}
                  {s.status === 'not-applicable' && <Tag tone="outline">No matching lesson</Tag>}
                  {s.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        data-testid={`preview-${s.id}`}
                        onClick={() => onPropose(proposeSuggestions(state.program, [s.id], state.dismissedSuggestions, state.counter))}
                      >
                        Preview
                      </Button>
                      <Button size="sm" variant="ghost" data-testid={`dismiss-${s.id}`} onClick={() => dispatch({ type: 'suggestion/dismiss', id: s.id })}>
                        Dismiss
                      </Button>
                    </>
                  )}
                  {s.status === 'dismissed' && (
                    <>
                      <Tag tone="outline">Dismissed</Tag>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Undo2 size={13} aria-hidden="true" />}
                        onClick={() => dispatch({ type: 'suggestion/restore', id: s.id })}
                      >
                        Restore
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {changes.length > 0 && (
        <details className="group border-t border-rule bg-surface-soft" data-testid="what-changed">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-5 py-2.5 sm:px-6 [&::-webkit-details-marker]:hidden">
            <span className="text-[13.5px] font-semibold">
              What changed and why
              <span className="ml-2 font-normal text-ink-2">
                {changes.length} {changes.length === 1 ? 'change' : 'changes'} since the customer spoke
              </span>
            </span>
            <span className="text-[12.5px] text-ink-2 underline decoration-rule-strong underline-offset-2 group-open:hidden">Show</span>
            <span className="hidden text-[12.5px] text-ink-2 underline decoration-rule-strong underline-offset-2 group-open:inline">Hide</span>
          </summary>
          <div className="px-5 pt-1 pb-4 sm:px-6">
            <ChangeList changes={changes.map((c) => c.change)} reasons={changes} testId="what-changed-list" />
            <div className="mt-3 flex justify-end">
              <LinkButton href={hrefFor('review')} size="sm" variant="ghost" iconAfter={<ArrowRight size={13} aria-hidden="true" />}>
                Full review
              </LinkButton>
            </div>
          </div>
        </details>
      )}
    </section>
  );
}
