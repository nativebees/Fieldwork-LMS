import { useState } from 'react';
import { Check, FileSearch, Lock, MessageSquare } from 'lucide-react';
import { ACCOUNT, OBSERVATION_WINDOW, SELLER_PROFILES, SNAPSHOT_LABEL } from '../../fixtures/account';
import { DISMISS_REASONS, INITIAL_INTERVENTION_CHOICES } from '../../fixtures/rehearsal';
import { cn } from '../../lib/cn';
import { formatDateRange, formatTime } from '../../lib/format';
import { useAsyncValue } from '../../lib/hooks';
import { activeCoachingProvider } from '../../providers/coaching';
import { PRIMARY_RECOMMENDATION_ID } from '../../state/reducer';
import { useStore } from '../../state/store';
import type { DecisionKind, LearningNeedHypothesis } from '../../types';
import { PipNote } from '../Pip';
import { useFeedback } from '../ui/feedback';
import { Button, DefRow, Field, Tag } from '../ui/primitives';

const KIND_TAG: Record<LearningNeedHypothesis['kind'], { label: string; tone: 'terracotta' | 'ochre' | 'neutral' }> = {
  'investigate-repeatable-work': { label: 'Worth a question', tone: 'terracotta' },
  'resolve-access': { label: 'Check access first', tone: 'ochre' },
  monitor: { label: 'No action suggested', tone: 'neutral' },
};

const DECISION_LABEL: Record<DecisionKind, string> = { accept: 'Accepted', adapt: 'Adapted', dismiss: 'Dismissed' };

function choiceLabel(choiceId: string | null): string | null {
  if (!choiceId) return null;
  return [...INITIAL_INTERVENTION_CHOICES, ...DISMISS_REASONS].find((c) => c.id === choiceId)?.label ?? null;
}

interface Props {
  hypothesis: LearningNeedHypothesis;
  onOpenEvidence: () => void;
}

export function RecommendationCard({ hypothesis, onOpenEvidence }: Props) {
  const { state, dispatch } = useStore();
  const { announce } = useFeedback();
  const coaching = activeCoachingProvider();
  const seller = SELLER_PROFILES[state.sellerProfileId];
  const isPrimary = hypothesis.id === PRIMARY_RECOMMENDATION_ID;
  const decision = state.decisions[hypothesis.id];
  const locked = isPrimary && state.constraint !== null;

  const [mode, setMode] = useState<'idle' | 'adapt' | 'dismiss'>('idle');
  const [choiceId, setChoiceId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pipOpen, setPipOpen] = useState(false);

  const guidance = useAsyncValue(() => coaching.getGuidance({ seller, account: ACCOUNT, hypothesis }), [seller.id, hypothesis.id]);
  const pip = useAsyncValue(() => coaching.explainHypothesis({ seller, account: ACCOUNT, hypothesis }), [seller.id, hypothesis.id]);

  const kind = KIND_TAG[hypothesis.kind];
  const hasHypothesis = hypothesis.kind === 'investigate-repeatable-work';

  const record = (kindOfDecision: DecisionKind, chosen: string | null, text: string) => {
    dispatch({ type: 'decision/record', recommendationId: hypothesis.id, decision: kindOfDecision, choiceId: chosen, note: text.trim() });
    setMode('idle');
    setChoiceId(null);
    setNote('');
    setError(null);
    announce(`${DECISION_LABEL[kindOfDecision]} the recommendation for ${hypothesis.department}.`);
  };

  const save = () => {
    const needsChoice = mode === 'dismiss' || (mode === 'adapt' && isPrimary);
    if (needsChoice && !choiceId) {
      setError(mode === 'dismiss' ? 'Choose a reason before saving.' : 'Choose how you would adapt it before saving.');
      return;
    }
    if (mode === 'adapt' && !isPrimary && !note.trim()) {
      setError('Describe the change before saving.');
      return;
    }
    record(mode === 'adapt' ? 'adapt' : 'dismiss', choiceId, note);
  };

  const options: Array<{ id: string; label: string; note?: string }> =
    mode === 'dismiss' ? DISMISS_REASONS : isPrimary ? INITIAL_INTERVENTION_CHOICES : [];

  return (
    <article className="paper" data-testid={`rec-${hypothesis.id}`} aria-labelledby={`${hypothesis.id}-title`}>
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-rule px-5 pt-4 pb-3">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="meta tabular">Priority {hypothesis.priority}</span>
            <Tag tone={kind.tone}>{kind.label}</Tag>
          </div>
          <h3 id={`${hypothesis.id}-title`} className="font-display text-[20px]">
            {hypothesis.title}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            icon={<FileSearch size={13} aria-hidden="true" />}
            onClick={onOpenEvidence}
            data-testid={`evidence-${hypothesis.id}`}
          >
            Evidence
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={pipOpen}
            icon={<MessageSquare size={13} aria-hidden="true" />}
            onClick={() => setPipOpen((v) => !v)}
            data-testid={`ask-pip-${hypothesis.id}`}
          >
            {pipOpen ? 'Hide Pip' : 'Ask Pip'}
          </Button>
        </div>
      </header>

      {pipOpen && pip.status === 'ready' && (
        <div className="border-b border-rule bg-surface-soft px-5 py-3">
          <PipNote state={pip.value.pip} testId={`pip-${hypothesis.id}`}>
            {pip.value.message}
          </PipNote>
        </div>
      )}

      <dl className="px-5 py-1">
        <DefRow term="Observed">
          <p>{hypothesis.signal}</p>
          <p className="meta mt-1">
            {formatDateRange(OBSERVATION_WINDOW.start, OBSERVATION_WINDOW.end)} UTC · {SNAPSHOT_LABEL}
          </p>
        </DefRow>
        <DefRow term={hasHypothesis ? 'Hypothesis' : 'Reading'}>
          {hasHypothesis && (
            <Tag tone="outline" className="mr-2 align-[1px]">
              Hypothesis, not a diagnosis
            </Tag>
          )}
          {hypothesis.statement} <span className="text-ink-2">{hypothesis.reason}</span>
        </DefRow>
        <DefRow term="Could also be">{hypothesis.alternativeExplanation}</DefRow>
        <DefRow term="Missing">{hypothesis.missingContext}</DefRow>
        <DefRow term="Ask">
          {guidance.status === 'ready' ? (
            <p className="font-serif text-[16px] leading-snug italic" data-testid={`question-${hypothesis.id}`}>
              “{guidance.value.question}”
            </p>
          ) : guidance.status === 'loading' ? (
            <p className="text-ink-2">Loading guidance.</p>
          ) : (
            <p>“{hypothesis.validationQuestion}”</p>
          )}
        </DefRow>
        <DefRow term="Propose">
          <p>
            <span className="font-semibold">Work artifact.</span> {hypothesis.proposedArtifact}.
          </p>
          <p className="mt-0.5">
            <span className="font-semibold">Intervention.</span> {hypothesis.proposedIntervention}
          </p>
        </DefRow>
      </dl>

      <footer className="rounded-b-md border-t border-rule bg-surface-soft px-5 py-3.5">
        {decision && mode === 'idle' ? (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2" data-testid={`decision-recorded-${hypothesis.id}`}>
            <div className="min-w-0 text-[13.5px]">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                <Check size={15} className="text-sage-deep" aria-hidden="true" />
                {isPrimary ? 'Initial recommendation recorded' : 'Your call recorded'}: {DECISION_LABEL[decision.decision]}
              </p>
              <p className="mt-0.5 text-ink-2">
                {[choiceLabel(decision.choiceId), decision.note].filter(Boolean).join('. ')}
                {choiceLabel(decision.choiceId) || decision.note ? '. ' : ''}
                As {SELLER_PROFILES[decision.sellerProfileId].shortRole}, {formatTime(decision.at)}.
              </p>
            </div>
            {locked ? (
              <p className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
                <Lock size={13} aria-hidden="true" />
                Locked when the customer shared the constraint
              </p>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'decision/clear', recommendationId: hypothesis.id })}>
                Change
              </Button>
            )}
          </div>
        ) : locked ? (
          <p className="flex items-center gap-1.5 text-[13px] text-ink-2">
            <Lock size={13} aria-hidden="true" />
            No initial recommendation was captured before the customer shared the constraint. It stays empty so the comparison is honest.
          </p>
        ) : mode === 'idle' ? (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
            <p className="text-[13.5px] font-semibold">{isPrimary ? 'Your initial call' : 'Your call'}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={isPrimary ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => record('accept', null, '')}
                data-testid={`decision-accept-${hypothesis.id}`}
              >
                Accept
              </Button>
              <Button size="sm" onClick={() => setMode('adapt')} data-testid={`decision-adapt-${hypothesis.id}`}>
                Adapt
              </Button>
              <Button size="sm" onClick={() => setMode('dismiss')} data-testid={`decision-dismiss-${hypothesis.id}`}>
                Dismiss
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            {options.length > 0 && (
              <fieldset>
                <legend className="mb-2 text-[13.5px] font-semibold">
                  {mode === 'dismiss' ? 'Why dismiss it?' : 'How would you adapt it?'}
                </legend>
                <div className="flex flex-col gap-1.5">
                  {options.map((option) => (
                    <label
                      key={option.id}
                      className={cn(
                        'flex cursor-pointer items-start gap-2.5 rounded-sm border bg-paper px-3 py-2 text-[13.5px] transition-colors duration-150',
                        choiceId === option.id ? 'border-terracotta-deep' : 'border-rule-strong hover:border-control',
                      )}
                    >
                      <input
                        type="radio"
                        name={`${hypothesis.id}-${mode}`}
                        className="mt-[3px] accent-terracotta-deep"
                        checked={choiceId === option.id}
                        onChange={() => {
                          setChoiceId(option.id);
                          setError(null);
                        }}
                      />
                      <span>
                        <span className="font-semibold">{option.label}</span>
                        {option.note && <span className="block text-[12.5px] text-ink-2">{option.note}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <Field label={options.length > 0 ? 'Note (optional)' : 'What would you change?'} error={error}>
              {(props) => (
                <textarea
                  {...props}
                  rows={2}
                  className="field resize-y"
                  value={note}
                  onChange={(event) => {
                    setNote(event.target.value);
                    setError(null);
                  }}
                />
              )}
            </Field>
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setMode('idle');
                  setChoiceId(null);
                  setNote('');
                  setError(null);
                }}
              >
                Cancel
              </Button>
              <Button size="sm" variant="primary" type="submit" data-testid={`decision-save-${hypothesis.id}`}>
                Save {mode === 'adapt' ? 'adaptation' : 'dismissal'}
              </Button>
            </div>
          </form>
        )}
      </footer>
    </article>
  );
}
