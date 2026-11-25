import { useId, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type Announcements, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronUp, CircleCheck, CircleX, GripVertical, RotateCcw } from 'lucide-react';
import { getAssessment } from '../../fixtures/assessments';
import { cn } from '../../lib/cn';
import { plural } from '../../lib/format';
import { useAsyncValue } from '../../lib/hooks';
import { activeCoachingProvider } from '../../providers/coaching';
import type { LessonProgress } from '../../rules/learner';
import { initialResponse, unansweredParts } from '../../rules/scoring';
import type { AttemptResponse, ExerciseOption, ExercisePart, ExerciseScenario, Lesson, PracticeAttempt } from '../../types';
import { PipNote } from '../Pip';
import { useFeedback } from '../ui/feedback';
import { Button, IconButton, Tag } from '../ui/primitives';

/* ------------------------------------------------------------------ */
/* Parts                                                               */
/* ------------------------------------------------------------------ */

function SortableStep({ item, index, total, disabled, onMove }: { item: ExerciseOption; index: number; total: number; disabled: boolean; onMove: (delta: -1 | 1) => void }) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: item.id, disabled });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-testid={`step-item-${item.id}`}
      className={cn(
        'flex items-center gap-1 rounded-sm border bg-paper transition-[border-color,box-shadow] duration-150',
        isDragging ? 'relative z-10 border-terracotta-deep shadow-lift' : 'border-rule-strong',
        disabled && 'bg-surface-soft',
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        disabled={disabled}
        aria-label={`Reorder step: ${item.label}. Position ${index + 1} of ${total}.`}
        className="flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center text-rule-strong hover:text-ink active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
      >
        <GripVertical size={15} aria-hidden="true" />
      </button>
      <span className="meta tabular w-5 text-[11.5px]" aria-hidden="true">
        {index + 1}
      </span>
      <span className="min-w-0 flex-1 py-2 text-[14px] leading-snug">{item.label}</span>
      <span className="flex shrink-0 pr-1">
        <IconButton label={`Move “${item.label}” up`} disabled={disabled || index === 0} onClick={() => onMove(-1)} data-testid={`step-up-${item.id}`}>
          <ChevronUp size={15} aria-hidden="true" />
        </IconButton>
        <IconButton label={`Move “${item.label}” down`} disabled={disabled || index === total - 1} onClick={() => onMove(1)} data-testid={`step-down-${item.id}`}>
          <ChevronDown size={15} aria-hidden="true" />
        </IconButton>
      </span>
    </li>
  );
}

function OrderPart({ part, value, disabled, onChange }: { part: Extract<ExercisePart, { type: 'order' }>; value: string[]; disabled: boolean; onChange: (next: string[]) => void }) {
  const { announce } = useFeedback();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const byId = new Map(part.items.map((i) => [i.id, i]));
  const label = (id: string) => byId.get(id)?.label ?? id;

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up step: ${label(String(active.id))}. Position ${value.indexOf(String(active.id)) + 1} of ${value.length}.`,
    onDragOver: ({ active, over }) => (over ? `${label(String(active.id))} is over position ${value.indexOf(String(over.id)) + 1} of ${value.length}.` : ''),
    onDragEnd: ({ active, over }) => (over ? `${label(String(active.id))} dropped at position ${value.indexOf(String(over.id)) + 1} of ${value.length}.` : ''),
    onDragCancel: ({ active }) => `Move cancelled. ${label(String(active.id))} stays where it was.`,
  };

  const onDragEnd = (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return;
    onChange(arrayMove(value, value.indexOf(String(event.active.id)), value.indexOf(String(event.over.id))));
  };

  const move = (id: string, delta: -1 | 1) => {
    const from = value.indexOf(id);
    const to = from + delta;
    if (to < 0 || to >= value.length) return;
    onChange(arrayMove(value, from, to));
    announce(`${label(id)} moved to position ${to + 1} of ${value.length}.`);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={{ announcements }}>
      <SortableContext items={value} strategy={verticalListSortingStrategy}>
        <ol className="flex flex-col gap-1.5" data-testid={`part-${part.id}`}>
          {value.map((id, index) => {
            const item = byId.get(id);
            return item ? <SortableStep key={id} item={item} index={index} total={value.length} disabled={disabled} onMove={(delta) => move(id, delta)} /> : null;
          })}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function ChoicePart({
  part,
  value,
  disabled,
  invalid,
  onChange,
}: {
  part: Extract<ExercisePart, { type: 'pick-one' | 'pick-many' }>;
  value: string | string[] | undefined;
  disabled: boolean;
  invalid: boolean;
  onChange: (next: string | string[]) => void;
}) {
  const name = useId();
  const many = part.type === 'pick-many';
  const selected = new Set(Array.isArray(value) ? value : value ? [value] : []);
  return (
    <div className="flex flex-col gap-1.5" data-testid={`part-${part.id}`}>
      {part.options.map((option) => {
        const checked = selected.has(option.id);
        return (
          <label
            key={option.id}
            className={cn(
              'flex items-start gap-3 rounded-sm border px-3.5 py-2.5 text-[14px] leading-snug transition-[border-color,box-shadow,background-color] duration-150',
              disabled ? 'cursor-default bg-surface-soft' : 'cursor-pointer bg-paper',
              checked ? 'border-ink shadow-[inset_3px_0_0_var(--color-ink)]' : invalid ? 'border-terracotta-deep' : 'border-rule-strong',
              !disabled && !checked && 'hover:border-control',
            )}
          >
            <input
              type={many ? 'checkbox' : 'radio'}
              name={name}
              className="mt-[3px] accent-ink"
              checked={checked}
              disabled={disabled}
              data-testid={`choice-${part.id}-${option.id}`}
              onChange={() => {
                if (!many) onChange(option.id);
                else {
                  const next = new Set(selected);
                  if (checked) next.delete(option.id);
                  else next.add(option.id);
                  onChange(part.options.map((o) => o.id).filter((id) => next.has(id)));
                }
              }}
            />
            <span>{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function Scenario({ scenario }: { scenario: ExerciseScenario }) {
  return (
    <div className="rounded-md border border-rule-strong bg-canvas" data-testid="scenario">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-2.5">
        <p className="font-display text-[17px]">{scenario.title}</p>
        <Tag tone="outline">Synthetic</Tag>
      </div>
      <div className="px-4 py-3.5">
        <p className="mb-3 text-[12.5px] text-ink-2">{scenario.note}</p>
        {scenario.draft && (
          <>
            <p className="eyebrow mb-2">Draft</p>
            <ol className="mb-4 flex flex-col gap-1.5">
              {scenario.draft.map((line, i) => (
                <li key={line} className="flex gap-2.5 font-serif text-[16px] leading-snug">
                  <span className="meta tabular mt-[3px] text-[11.5px]">{i + 1}</span>
                  {line}
                </li>
              ))}
            </ol>
          </>
        )}
        {scenario.sources && (
          <>
            <p className="eyebrow mb-2">Approved sources</p>
            <ul className="flex flex-col gap-1 text-[13.5px]">
              {scenario.sources.map((s) => (
                <li key={s} className="flex gap-2">
                  <span aria-hidden="true" className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-ink-2" />
                  {s}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

function AttemptFeedback({ attempt, hints }: { attempt: PracticeAttempt; hints: Record<string, string> }) {
  const coaching = activeCoachingProvider();
  const met = attempt.results.filter((r) => r.met).length;
  const pip = useAsyncValue(() => coaching.coachAttempt({ attemptNumber: attempt.n, results: attempt.results, hints }), [attempt.id]);
  const allMet = met === attempt.results.length;

  return (
    <div className="flex flex-col gap-4" data-testid="attempt-feedback" data-all-met={allMet}>
      <p className="text-[14px] font-semibold" role="status" data-testid="attempt-summary">
        Attempt {attempt.n}: {met} of {plural(attempt.results.length, 'criterion', 'criteria')} demonstrated.
      </p>
      <ul className="flex flex-col">
        {attempt.results.map((r) => (
          <li key={r.criterionId} className="flex items-start gap-3 border-t border-rule py-3 first:border-t-0 first:pt-0" data-testid={`result-${r.criterionId}`} data-met={r.met}>
            {r.met ? (
              <CircleCheck size={18} className="mt-px shrink-0 text-sage-deep" aria-hidden="true" />
            ) : (
              <CircleX size={18} className="mt-px shrink-0 text-terracotta-deep" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className="text-[14px] leading-snug font-semibold">
                {r.label}
                <span className={cn('ml-2 text-[12px] font-semibold', r.met ? 'text-sage-deep' : 'text-terracotta-deep')}>{r.met ? 'Demonstrated' : 'Not yet'}</span>
              </p>
              <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-2">{r.explanation}</p>
            </div>
          </li>
        ))}
      </ul>
      {pip.status === 'ready' && (
        <PipNote state={pip.value.pip} testId="pip-attempt">
          {pip.value.message}
        </PipNote>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Exercise                                                            */
/* ------------------------------------------------------------------ */

interface Props {
  lesson: Lesson;
  progress: LessonProgress;
  onRecord: (response: AttemptResponse) => void;
  onUnscored: () => void;
}

export function Exercise({ lesson, progress, onRecord, onUnscored }: Props) {
  if (!progress.scorable) return <UnscoredPractice lesson={lesson} progress={progress} onUnscored={onUnscored} />;
  // Remount when the rule version changes, so a new assessment never shows an old draft.
  return <ScoredExercise key={`${lesson.id}:${progress.rulesId}`} lesson={lesson} progress={progress} onRecord={onRecord} />;
}

function UnscoredPractice({ lesson, progress, onUnscored }: Omit<Props, 'onRecord'>) {
  const unscored = progress.earlier.filter((a) => !a.scored).length;
  return (
    <div className="flex flex-col gap-3" data-testid="unscored-practice">
      <p className="text-[15px] leading-relaxed">{lesson.practice || 'No practice has been written for this lesson yet.'}</p>
      <p className="rounded-sm border border-ochre-deep/30 bg-ochre-wash px-3.5 py-2.5 text-[13px] leading-snug text-ochre-deep">
        This practice has been customized and its scoring is being reviewed. You can do the practice. It is not scored, and no criterion is
        recorded for it.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={onUnscored} data-testid="mark-attempted">
          Mark practice as attempted
        </Button>
        {unscored > 0 && <p className="text-[13px] text-ink-2">Attempted {plural(unscored, 'time')}, unscored.</p>}
      </div>
    </div>
  );
}

function ScoredExercise({ lesson, progress, onRecord }: Omit<Props, 'onUnscored'>) {
  const version = getAssessment(lesson.assessment);
  const latest = progress.current[progress.current.length - 1] ?? null;
  const [draft, setDraft] = useState<AttemptResponse>(() => latest?.response ?? initialResponse(version));
  const [answering, setAnswering] = useState(latest === null);
  const [showMissing, setShowMissing] = useState(false);
  const missing = unansweredParts(version, draft);
  const hints = Object.fromEntries(version.criteria.map((c) => [c.id, c.hint]));
  const disabled = !answering;

  const check = () => {
    if (missing.length > 0) {
      setShowMissing(true);
      return;
    }
    setShowMissing(false);
    setAnswering(false);
    onRecord(draft);
  };

  const retry = () => {
    setDraft(initialResponse(version));
    setAnswering(true);
    setShowMissing(false);
  };

  return (
    <div className="flex flex-col gap-5" data-testid="exercise" data-rules={version.rulesId}>
      <p className="text-[15px] leading-relaxed">{lesson.practice}</p>
      {version.scenario && <Scenario scenario={version.scenario} />}

      {version.parts.map((part, i) => {
        const invalid = showMissing && missing.some((m) => m.id === part.id);
        return (
          <fieldset key={part.id} className="flex flex-col gap-2.5" aria-invalid={invalid || undefined}>
            <legend className="mb-2.5 flex items-baseline gap-2 text-[15px] font-semibold">
              {version.parts.length > 1 && (
                <span className="meta tabular text-[12px]" aria-hidden="true">
                  {i + 1}
                </span>
              )}
              {part.prompt}
            </legend>
            {part.type === 'order' ? (
              <OrderPart part={part} value={(draft[part.id] as string[]) ?? part.initialOrder} disabled={disabled} onChange={(next) => setDraft((d) => ({ ...d, [part.id]: next }))} />
            ) : (
              <ChoicePart part={part} value={draft[part.id]} disabled={disabled} invalid={invalid} onChange={(next) => setDraft((d) => ({ ...d, [part.id]: next }))} />
            )}
            {invalid && (
              <p className="text-[12.5px] font-medium text-terracotta-deep" role="alert">
                Answer this part before checking.
              </p>
            )}
          </fieldset>
        );
      })}

      {answering ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" size="lg" onClick={check} data-testid="check-work">
            Check my work
          </Button>
          <p className="text-[12.5px] text-ink-2">Scored against {plural(version.criteria.length, 'criterion', 'criteria')}. You can retry as often as you like.</p>
        </div>
      ) : (
        latest && (
          <div className="rounded-md border border-rule-strong bg-canvas px-4 py-4 sm:px-5">
            <AttemptFeedback attempt={latest} hints={hints} />
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-rule pt-4">
              <Button icon={<RotateCcw size={14} aria-hidden="true" />} onClick={retry} data-testid="retry">
                Try again
              </Button>
              <p className="text-[12.5px] text-ink-2">Every attempt is kept. A retry never erases an earlier one.</p>
            </div>
          </div>
        )
      )}

      {(progress.current.length > 0 || progress.earlier.length > 0) && (
        <details className="group text-[13px]" data-testid="attempt-history">
          <summary className="cursor-pointer text-ink-2 underline decoration-rule-strong underline-offset-2 hover:text-ink">
            Attempt history ({progress.current.length + progress.earlier.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {[...progress.earlier, ...progress.current].map((a) => {
              const counted = a.scored && a.rulesId === progress.rulesId;
              return (
                <li key={a.id} className="flex flex-wrap items-baseline gap-x-2" data-testid={`history-${a.id}`} data-counted={counted}>
                  <span className="tabular font-semibold">Attempt {a.n}</span>
                  <span className="meta">{a.rulesId ?? 'unscored'}</span>
                  {a.scored && (
                    <span className="tabular text-ink-2">
                      {a.results.filter((r) => r.met).length} of {a.results.length} demonstrated
                    </span>
                  )}
                  {!counted && <Tag tone="outline">{a.scored ? 'Earlier version · not counted toward current criteria' : 'Unscored practice'}</Tag>}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}
