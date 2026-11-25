import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Check, ChevronDown, CircleDashed, Lock, RotateCcw } from 'lucide-react';
import { ACCOUNT, CUSTOMER_CONSTRAINT, SELLER_PROFILES } from '../../fixtures/account';
import { REHEARSAL_STEPS, REHEARSAL_STEP_ORDER, REVEAL_BRIDGE, SPONSOR_OPENING_LINE } from '../../fixtures/rehearsal';
import { cn } from '../../lib/cn';
import { useAsyncValue } from '../../lib/hooks';
import { hrefFor } from '../../lib/router';
import { activeCoachingProvider } from '../../providers/coaching';
import { chosenOption, currentStep, optionsFor, rubricTotal, scoreSellerRubric } from '../../rules/sellerRubric';
import { evaluateSuggestions } from '../../rules/tailoring';
import { PRIMARY_RECOMMENDATION_ID } from '../../state/reducer';
import { useStore } from '../../state/store';
import type { RehearsalOption, RehearsalStepId, SellerCriterionResult } from '../../types';
import { ProfileSwitch } from '../ProfileSwitch';
import { useFeedback } from '../ui/feedback';
import { Button, Field, LinkButton, Tag } from '../ui/primitives';

const SPONSOR_FIRST_NAME = ACCOUNT.sponsor.name.split(' ')[0];

function SponsorLine({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <div className="flex animate-rise flex-col gap-1 pr-6 sm:pr-16" data-testid={testId}>
      <p className="eyebrow">{ACCOUNT.sponsor.name} · scripted</p>
      <div className="paper rounded-tl-none px-4 py-3 font-serif text-[16.5px] leading-snug">{children}</div>
    </div>
  );
}

function SellerLine({ children }: { children: ReactNode }) {
  return (
    <div className="flex animate-rise flex-col items-end gap-1 pl-6 sm:pl-16">
      <p className="eyebrow">You</p>
      <div className="rounded-md rounded-tr-none border border-ink bg-ink px-4 py-3 text-[14.5px] leading-relaxed text-canvas">
        {children}
      </div>
    </div>
  );
}

function CoachNote({ feedback, profileNote, role }: { feedback: string; profileNote?: string; role: string }) {
  return (
    <div className="animate-rise border-l-2 border-sage pl-3.5 text-[13.5px] leading-relaxed" role="note">
      <p className="eyebrow mb-1">Coaching note</p>
      <p>{feedback}</p>
      {profileNote && (
        <p className="mt-1 text-ink-2">
          <span className="font-semibold text-ink">For a {role}. </span>
          {profileNote}
        </p>
      )}
    </div>
  );
}

interface ChooserProps {
  stepId: RehearsalStepId;
  options: RehearsalOption[];
  staleChoice: boolean;
  onConfirm: (optionId: string) => void;
}

function Chooser({ stepId, options, staleChoice, onConfirm }: ChooserProps) {
  const step = REHEARSAL_STEPS[stepId];
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const name = useId();
  const ref = useRef<HTMLFieldSetElement>(null);

  // Bring each new decision into view and give it focus, so the thread reads top to bottom.
  useEffect(() => {
    const el = ref.current;
    if (!el || stepId === 'opening') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    el.focus({ preventScroll: true });
  }, [stepId]);

  return (
    <fieldset
      ref={ref}
      tabIndex={-1}
      className="animate-rise rounded-md border border-rule-strong bg-surface-soft p-4 outline-none sm:p-5"
      data-testid={`step-${stepId}`}
    >
      <legend className="float-left mb-3 w-full">
        <span className="eyebrow block">
          Turn {step.turn} · {step.heading}
        </span>
        <span className="font-display mt-1 block text-[20px]">{step.prompt}</span>
      </legend>
      {staleChoice && (
        <p className="clear-both mb-3 text-[13px] text-ochre-deep">
          Your earlier answer belonged to the other seller profile. Choose again for this one.
        </p>
      )}
      <div className="clear-both flex flex-col gap-2">
        {options.map((option) => {
          const checked = selected === option.id;
          return (
            <label
              key={option.id}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-sm border bg-paper px-3.5 py-3 text-[14px] leading-relaxed transition-[border-color,box-shadow] duration-150',
                checked
                  ? 'border-terracotta-deep shadow-[inset_3px_0_0_var(--color-terracotta)]'
                  : 'border-rule-strong hover:border-control',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={checked}
                onChange={() => {
                  setSelected(option.id);
                  setError(false);
                }}
                className="mt-[5px] accent-terracotta-deep"
                data-testid={`option-${option.id}`}
              />
              <span>“{option.text}”</span>
            </label>
          );
        })}
      </div>
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
        <p className={cn('text-[12.5px]', error ? 'font-medium text-terracotta-deep' : 'text-ink-2')} role={error ? 'alert' : undefined}>
          {error ? 'Choose what you would say first.' : 'Your choice is recorded once you say it.'}
        </p>
        <Button
          variant="primary"
          data-testid={`say-${stepId}`}
          onClick={() => {
            if (!selected) {
              setError(true);
              return;
            }
            onConfirm(selected);
          }}
        >
          Say this
        </Button>
      </div>
    </fieldset>
  );
}

function RubricRow({ result }: { result: SellerCriterionResult }) {
  const scored = result.status === 'scored';
  return (
    <li className="border-t border-rule first:border-t-0" data-testid={`rubric-${result.id}`}>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start gap-3 py-2.5 [&::-webkit-details-marker]:hidden">
          <span
            className={cn(
              'tabular mt-px inline-flex h-6 min-w-[38px] items-center justify-center rounded-xs border px-1 text-[12.5px] font-semibold',
              !scored
                ? 'border-rule-strong text-ink-2'
                : result.points === 2
                  ? 'border-sage bg-sage-wash text-sage-deep'
                  : 'border-rule-strong bg-paper text-ink',
            )}
            data-testid={`rubric-points-${result.id}`}
          >
            {scored ? `${result.points}/${result.max}` : '–'}
          </span>
          <span className="min-w-0 flex-1 text-[13.5px] leading-snug">
            <span className="font-semibold">{result.label}</span>
            <span className="sr-only">{scored ? `, ${result.points} of ${result.max} points` : ', not scored yet'}</span>
          </span>
          <ChevronDown
            size={15}
            className="mt-1 shrink-0 text-ink-2 transition-transform duration-150 group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <ul className="flex flex-col gap-1 pb-3 pl-[50px] text-[12.5px] leading-snug text-ink-2">
          {result.evidence.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
    </li>
  );
}

export function RehearsalView() {
  const { state, dispatch } = useStore();
  const { announce } = useFeedback();
  const coaching = activeCoachingProvider();
  const profileId = state.sellerProfileId;
  const seller = SELLER_PROFILES[profileId];
  const step = currentStep(state.rehearsal, profileId);
  const done = step === 'done';
  const choicesKey = JSON.stringify(state.rehearsal.choices);

  const review = useAsyncValue(() => coaching.reviewRehearsal({ seller, rehearsal: state.rehearsal }), [seller.id, choicesKey]);
  const rubric = scoreSellerRubric({
    profileId,
    rehearsal: state.rehearsal,
    program: state.program,
    constraintKnown: state.constraint !== null,
  });
  const total = rubricTotal(rubric);
  const suggestions = evaluateSuggestions(state.program, state.dismissedSuggestions);
  const initial = state.decisions[PRIMARY_RECOMMENDATION_ID];
  const revealed = chosenOption(state.rehearsal, 'firstQuestion', profileId) !== null;

  const confirm = (stepId: RehearsalStepId, optionId: string) => {
    dispatch({ type: 'rehearsal/choose', stepId, optionId });
    announce(stepId === 'firstQuestion' ? 'Recorded. The customer has shared a constraint.' : 'Recorded. The sponsor has replied.');
  };

  return (
    <div className="mx-auto max-w-[1180px] px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <header className="max-w-[820px]">
        <div className="flex flex-wrap items-center gap-2">
          <p className="eyebrow">Seller rehearsal</p>
          <Tag tone="outline">{coaching.label}</Tag>
        </div>
        <h1 className="font-display mt-3 text-[34px] sm:text-[44px]">Practise the conversation with {SPONSOR_FIRST_NAME}.</h1>
        <p className="mt-4 max-w-[62ch] text-[16px] leading-relaxed text-ink-2">
          Two turns. You choose what to say, {SPONSOR_FIRST_NAME} answers from a script and each choice is read against five visible
          criteria. Nothing here judges your wording.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <ProfileSwitch />
          <Button
            size="sm"
            variant="ghost"
            icon={<RotateCcw size={13} aria-hidden="true" />}
            onClick={() => {
              dispatch({ type: 'rehearsal/restart' });
              announce('Rehearsal restarted.');
            }}
            disabled={REHEARSAL_STEP_ORDER.every((id) => state.rehearsal.choices[id] === null)}
            data-testid="restart-rehearsal"
          >
            Restart rehearsal
          </Button>
        </div>
      </header>

      <div className="mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5" data-testid="conversation">
          {!initial && !state.constraint && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-rule-strong bg-ochre-wash px-4 py-2.5 text-[13.5px] text-ochre-deep">
              You have not recorded an initial recommendation yet. It makes the before and after comparison meaningful.
              <a href={hrefFor('account')} className="font-semibold underline underline-offset-2">
                Record it on the account page
              </a>
            </p>
          )}

          <p className="eyebrow border-b border-rule pb-2">Turn 1 · Open and ask</p>
          <SponsorLine>{SPONSOR_OPENING_LINE}</SponsorLine>

          {REHEARSAL_STEP_ORDER.map((stepId) => {
            const option = chosenOption(state.rehearsal, stepId, profileId);
            const isCurrent = step === stepId;
            if (!option && !isCurrent) return null;
            const feedback = review.status === 'ready' ? review.value[stepId] : undefined;
            return (
              <div key={stepId} className="flex flex-col gap-5">
                {stepId === 'followUp' && <p className="eyebrow border-b border-rule pt-3 pb-2">Turn 2 · Revise</p>}
                {option ? (
                  <>
                    <SellerLine>{option.text}</SellerLine>
                    {feedback && (
                      <CoachNote feedback={feedback.feedback} profileNote={feedback.profileNote} role={seller.role.toLowerCase()} />
                    )}
                    <SponsorLine testId={`reply-${stepId}`}>{option.reply}</SponsorLine>
                  </>
                ) : (
                  <Chooser
                    key={`${stepId}-${profileId}`}
                    stepId={stepId}
                    options={optionsFor(stepId, profileId)}
                    staleChoice={state.rehearsal.choices[stepId] !== null}
                    onConfirm={(optionId) => confirm(stepId, optionId)}
                  />
                )}

                {stepId === 'firstQuestion' && option && (
                  <section
                    className="animate-rise my-2 border-y border-rule-strong bg-paper px-5 py-6 shadow-[inset_4px_0_0_var(--color-terracotta)] sm:px-7"
                    aria-labelledby="reveal-title"
                    data-testid="constraint-reveal"
                  >
                    <p id="reveal-title" className="eyebrow text-terracotta-deep">
                      The customer changes the brief
                    </p>
                    <blockquote className="font-display mt-3 text-[24px] leading-[1.22] sm:text-[28px]">
                      “{CUSTOMER_CONSTRAINT.quote}”
                    </blockquote>
                    <p className="meta mt-3">
                      {CUSTOMER_CONSTRAINT.speaker}, {ACCOUNT.sponsor.title} · synthetic sponsor statement
                    </p>
                    <p className="mt-3 text-[13.5px] text-ink-2">{REVEAL_BRIDGE[option.id]}</p>
                  </section>
                )}
              </div>
            );
          })}

          {done && (
            <section className="animate-rise paper mt-2 px-5 py-5" data-testid="rehearsal-complete">
              <p className="eyebrow">Rehearsal complete</p>
              <h2 className="font-display mt-1.5 text-[22px]">
                {total.points} of {total.max} points so far. The rest depends on the program.
              </h2>
              <p className="mt-2 max-w-[60ch] text-[14px] leading-relaxed text-ink-2">
                Two of the five criteria read the program itself. They only move when the plan you built reflects what {SPONSOR_FIRST_NAME}{' '}
                told you.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <LinkButton
                  href={hrefFor('studio')}
                  variant="accent"
                  size="lg"
                  iconAfter={<ArrowRight size={15} aria-hidden="true" />}
                  testId="go-studio"
                >
                  Revise the program in the studio
                </LinkButton>
                <LinkButton href={hrefFor('review')} size="lg">
                  See the review
                </LinkButton>
              </div>
            </section>
          )}

          {revealed && (
            <div className="mt-2 border-t border-rule pt-5">
              <Field
                label="In your own words: what changed in your thinking?"
                aside={<Tag tone="outline">Optional · not automatically assessed</Tag>}
                hint="Kept for your own reflection and included in the JSON export. No rule reads it and it never affects a score."
              >
                {(props) => (
                  <textarea
                    {...props}
                    rows={3}
                    className="field resize-y"
                    value={state.rehearsal.reflection}
                    onChange={(event) => dispatch({ type: 'rehearsal/reflection', text: event.target.value })}
                    data-testid="reflection"
                  />
                )}
              </Field>
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-7 lg:sticky lg:top-24 lg:self-start" aria-label="Practice record">
          <section>
            <div className="flex items-end justify-between gap-3 border-b border-rule-strong pb-2">
              <div>
                <p className="eyebrow">Seller practice</p>
                <h2 className="font-display mt-0.5 text-[20px]">Five criteria</h2>
              </div>
              <p className="tabular text-[13px] text-ink-2" data-testid="rubric-total">
                <span className="text-[20px] font-semibold text-ink">{total.points}</span> / {total.max}
              </p>
            </div>
            <ul className="flex flex-col">
              {rubric.map((r) => (
                <RubricRow key={r.id} result={r} />
              ))}
            </ul>
            <p className="mt-2 text-[12px] leading-snug text-ink-2">
              Scored from structured choices and the state of the program. Performance on a practice task, not an assessment of a person.
              Open a row to see what it cites.
            </p>
          </section>

          <section>
            <p className="eyebrow mb-2.5 border-b border-rule pb-2">Before and after</p>
            <dl className="flex flex-col gap-3 text-[13.5px] leading-snug">
              <div>
                <dt className="flex items-center gap-1.5 font-semibold">
                  {state.constraint && <Lock size={12} className="text-ink-2" aria-hidden="true" />}
                  Initial recommendation
                </dt>
                <dd className="mt-0.5 text-ink-2" data-testid="initial-summary">
                  {initial
                    ? `${initial.decision === 'accept' ? 'Accepted' : initial.decision === 'adapt' ? 'Adapted' : 'Dismissed'} the suggested program for Marketing.`
                    : 'Not captured.'}
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Customer constraint</dt>
                <dd className="mt-0.5 text-ink-2">
                  {state.constraint ? 'Unsupported product claims. Approval stays with the campaign owner.' : 'Not discovered yet.'}
                </dd>
              </div>
            </dl>
          </section>

          {state.constraint && (
            <section data-testid="rehearsal-suggestions">
              <p className="eyebrow mb-1 border-b border-rule pb-2">Suggested program changes</p>
              <ul className="flex flex-col">
                {suggestions.map((s) => (
                  <li key={s.id} className="flex items-start gap-2 border-t border-rule py-2 text-[13px] leading-snug first:border-t-0">
                    {s.status === 'applied' ? (
                      <Check size={14} className="mt-[2px] shrink-0 text-sage-deep" aria-hidden="true" />
                    ) : (
                      <CircleDashed size={14} className="mt-[2px] shrink-0 text-ink-2" aria-hidden="true" />
                    )}
                    <span>
                      {s.title}
                      <span className="text-ink-2">
                        {' '}
                        ·{' '}
                        {s.status === 'applied'
                          ? 'in the program'
                          : s.status === 'dismissed'
                            ? 'dismissed'
                            : s.status === 'not-applicable'
                              ? 'not applicable'
                              : 'pending'}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[12px] leading-snug text-ink-2">
                Nothing is applied for you. Preview and accept each change in the studio.
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
