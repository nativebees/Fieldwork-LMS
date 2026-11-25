import { useEffect, useState, type ReactNode } from 'react';
import { Copy, Plus, Scissors, ShieldCheck, Trash2, Route as RouteIcon, X } from 'lucide-react';
import { ACCOUNT } from '../../fixtures/account';
import { getAssessment, rulesIdOf } from '../../fixtures/assessments';
import { BLOCK_KINDS, BLOCK_KIND_LABEL } from '../../fixtures/lessons';
import {
  MAX_DURATION,
  MIN_DURATION,
  isValidDuration,
  lessonChecklist,
  locate,
  programChecklist,
  totalMinutes,
  type LessonPatch,
} from '../../rules/program';
import { proposeAdaptToWorkflow, proposeTenMinuteVersion, proposeVerificationStep, type ProposalResult } from '../../rules/tailoring';
import { useStore } from '../../state/store';
import type { BlockKind, Lesson } from '../../types';
import { Button, Field, IconButton, SourceLine, StatusMark, Tag } from '../ui/primitives';

function Group({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-t border-rule py-4 first:border-t-0 first:pt-0">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="eyebrow">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

interface InspectorProps {
  onPropose: (result: ProposalResult) => void;
  onDuplicate: (lessonId: string) => void;
  onRemove: (lessonId: string) => void;
  onClose?: () => void;
}

export function Inspector(props: InspectorProps) {
  const { state } = useStore();
  const lesson = state.selectedLessonId ? state.program.lessons[state.selectedLessonId] : null;
  return lesson ? <LessonInspector key={lesson.id} lesson={lesson} {...props} /> : <ProgramInspector onPropose={props.onPropose} />;
}

/* ------------------------------------------------------------------ */
/* Lesson                                                              */
/* ------------------------------------------------------------------ */

function LessonInspector({ lesson, onPropose, onDuplicate, onRemove, onClose }: InspectorProps & { lesson: Lesson }) {
  const { state, dispatch } = useStore();
  const loc = locate(state.program, lesson.id);
  const assessment = getAssessment(lesson.assessment);
  const custom = lesson.assessment.status === 'custom-needs-review';
  const checklist = lessonChecklist(lesson);
  const context = { account: ACCOUNT, constraintKnown: state.constraint !== null };

  const [duration, setDuration] = useState(String(lesson.durationMin));
  const [newKind, setNewKind] = useState<BlockKind>('explanation');
  const durationNumber = Number(duration);
  const durationError =
    duration.trim() === '' || !isValidDuration(durationNumber) ? `Enter a whole number from ${MIN_DURATION} to ${MAX_DURATION}.` : null;

  // Follow outside changes, such as an accepted proposal, without fighting what is being typed.
  useEffect(() => {
    setDuration((current) => (Number(current) === lesson.durationMin ? current : String(lesson.durationMin)));
  }, [lesson.durationMin]);

  const patch = (p: LessonPatch) => dispatch({ type: 'program/updateLesson', lessonId: lesson.id, patch: p });

  return (
    <div data-testid="inspector-lesson">
      <div className="mb-4 flex items-start justify-between gap-2 border-b border-rule-strong pb-2">
        <div>
          <h2 className="eyebrow">Lesson inspector</h2>
          {loc && (
            <p className="meta mt-1">
              Lesson {loc.position} of {loc.total} · {loc.module.title}
            </p>
          )}
        </div>
        <IconButton
          label={onClose ? 'Close inspector' : 'Deselect lesson and show program settings'}
          onClick={() => (onClose ? onClose() : dispatch({ type: 'ui/select', lessonId: null }))}
          data-testid="inspector-close"
        >
          <X size={15} aria-hidden="true" />
        </IconButton>
      </div>

      <Group title="Basics">
        <div className="flex flex-col gap-3">
          <Field label="Title">
            {(p) => (
              <input
                {...p}
                type="text"
                className="field"
                value={lesson.title}
                onChange={(e) => patch({ title: e.target.value })}
                data-testid="field-title"
              />
            )}
          </Field>
          <Field
            label="Objective"
            hint={
              lesson.objectiveReview === 'needs-review'
                ? undefined
                : 'What the learner will be able to do. A large change is flagged so you can check it still matches the practice.'
            }
          >
            {(p) => (
              <textarea
                {...p}
                rows={3}
                className="field resize-y"
                value={lesson.objective}
                onChange={(e) => patch({ objective: e.target.value })}
                data-testid="field-objective"
              />
            )}
          </Field>
          {lesson.objectiveReview === 'needs-review' && (
            <div
              className="rounded-sm border border-ochre-deep/30 bg-ochre-wash px-3 py-2.5 text-[12.5px] leading-snug text-ochre-deep"
              data-testid="objective-review"
            >
              <p>The objective changed materially. Check that the practice and the evidence still assess it.</p>
              <Button
                size="sm"
                className="mt-2"
                onClick={() => dispatch({ type: 'objective/aligned', lessonId: lesson.id })}
                data-testid="objective-aligned"
              >
                Mark as aligned
              </Button>
            </div>
          )}
          <Field label="Duration (minutes)" error={durationError} className="max-w-[140px]">
            {(p) => (
              <input
                {...p}
                type="number"
                inputMode="numeric"
                min={MIN_DURATION}
                max={MAX_DURATION}
                step={1}
                className="field tabular"
                value={duration}
                data-testid="field-duration"
                onChange={(e) => {
                  setDuration(e.target.value);
                  const n = Number(e.target.value);
                  if (e.target.value.trim() !== '' && isValidDuration(n)) patch({ durationMin: n });
                }}
              />
            )}
          </Field>
        </div>
      </Group>

      <Group title="Content blocks" aside={<span className="meta text-[11px]">{lesson.blocks.length}</span>}>
        {lesson.blocks.length === 0 && <p className="mb-3 text-[12.5px] text-ink-2">No content blocks. Add one below.</p>}
        <ul className="flex flex-col gap-3">
          {lesson.blocks.map((block) => (
            <li key={block.id}>
              <Field
                label={BLOCK_KIND_LABEL[block.kind]}
                aside={
                  <IconButton
                    label={`Remove ${BLOCK_KIND_LABEL[block.kind].toLowerCase()} block`}
                    tone="danger"
                    className="h-6 w-6"
                    onClick={() => dispatch({ type: 'program/removeBlock', lessonId: lesson.id, blockId: block.id })}
                  >
                    <Trash2 size={12} aria-hidden="true" />
                  </IconButton>
                }
              >
                {(p) => (
                  <textarea
                    {...p}
                    rows={3}
                    className="field resize-y"
                    value={block.body}
                    placeholder="Write this block."
                    onChange={(e) =>
                      dispatch({ type: 'program/updateBlock', lessonId: lesson.id, blockId: block.id, body: e.target.value })
                    }
                    data-testid={`field-block-${block.kind}`}
                  />
                )}
              </Field>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-end gap-2">
          <Field label="Add a block" className="flex-1">
            {(p) => (
              <select
                {...p}
                className="field"
                value={newKind}
                onChange={(e) => setNewKind(e.target.value as BlockKind)}
                data-testid="new-block-kind"
              >
                {BLOCK_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {BLOCK_KIND_LABEL[kind]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Button
            icon={<Plus size={14} aria-hidden="true" />}
            onClick={() => dispatch({ type: 'program/addBlock', lessonId: lesson.id, kind: newKind })}
            data-testid="add-block"
          >
            Add
          </Button>
        </div>
      </Group>

      <Group title="Assessed requirements">
        <div className="flex flex-col gap-3">
          <Field label="Practice" hint="What the learner must do.">
            {(p) => (
              <textarea
                {...p}
                rows={3}
                className="field resize-y"
                value={lesson.practice}
                onChange={(e) => patch({ practice: e.target.value })}
                data-testid="field-practice"
              />
            )}
          </Field>
          <Field label="Evidence" hint="What shows it was done.">
            {(p) => (
              <textarea
                {...p}
                rows={3}
                className="field resize-y"
                value={lesson.evidence}
                onChange={(e) => patch({ evidence: e.target.value })}
                data-testid="field-evidence"
              />
            )}
          </Field>
          <p className="text-[11.5px] leading-snug text-ink-2">
            These two fields are what the typed assessment scores. Editing them freely marks the lesson as custom until the scoring mapping
            is reviewed.
          </p>
        </div>
      </Group>

      <Group
        title="Assessment"
        aside={
          custom ? (
            <Tag tone="ochre">Custom · needs review</Tag>
          ) : lesson.assessment.reviewedAt ? (
            <Tag tone="sage">Mapped · reviewed</Tag>
          ) : (
            <Tag tone="sage">Mapped</Tag>
          )
        }
      >
        <p className="meta" data-testid="inspector-rules">
          {rulesIdOf(lesson.assessment)} · {assessment.title}
        </p>
        {custom ? (
          <div
            className="mt-2.5 rounded-sm border border-ochre-deep/30 bg-ochre-wash px-3 py-2.5 text-[12.5px] leading-snug text-ochre-deep"
            data-testid="assessment-review"
          >
            <p>
              The requirement text no longer matches what these rules were written for. Learners can still do the practice, but nothing is
              scored and no criterion is recorded.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => dispatch({ type: 'assessment/resolve', lessonId: lesson.id, mode: 'restore' })}
                data-testid="assessment-restore"
              >
                Restore aligned text
              </Button>
              <Button
                size="sm"
                onClick={() => dispatch({ type: 'assessment/resolve', lessonId: lesson.id, mode: 'confirm' })}
                data-testid="assessment-confirm"
              >
                I reviewed it. The mapping holds
              </Button>
            </div>
          </div>
        ) : (
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {assessment.criteria.map((c) => (
              <li key={c.id} className="text-[12.5px] leading-snug">
                <span className="meta mr-1.5 text-[11px]">{c.id}</span>
                {c.label}
              </li>
            ))}
          </ul>
        )}
      </Group>

      <Group title="Coverage">
        <ul className="flex flex-col gap-1.5" data-testid="lesson-checklist">
          {checklist.map((item) => (
            <li key={item.key} data-check={item.key} data-status={item.status}>
              <StatusMark status={item.status} label={item.label} note={item.note} />
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11.5px] leading-snug text-ink-2">
          Derived from the fields above. It shows what is present, not how good it is.
        </p>
      </Group>

      {lesson.sourceIds.length > 0 && (
        <Group title="Sources">
          <ul className="flex flex-col gap-3">
            {lesson.sourceIds.map((id) => (
              <li key={id}>
                <SourceLine sourceId={id} compact />
              </li>
            ))}
          </ul>
        </Group>
      )}

      <Group title="Tailor this lesson" aside={<Tag tone="outline">Scenario rules</Tag>}>
        <div className="flex flex-col gap-2">
          <Button
            className="w-full justify-start"
            icon={<RouteIcon size={14} aria-hidden="true" />}
            onClick={() => onPropose(proposeAdaptToWorkflow(state.program, lesson.id, context))}
            data-testid="tailor-adapt"
          >
            Adapt to the customer’s workflow
          </Button>
          <Button
            className="w-full justify-start"
            icon={<ShieldCheck size={14} aria-hidden="true" />}
            onClick={() => onPropose(proposeVerificationStep(state.program, lesson.id, context))}
            data-testid="tailor-verify"
          >
            Add a verification step
          </Button>
        </div>
        <p className="mt-2 text-[11.5px] leading-snug text-ink-2">Each one shows a preview first. Nothing changes until you accept it.</p>
      </Group>

      <Group title="Lesson actions">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            icon={<Copy size={13} aria-hidden="true" />}
            onClick={() => onDuplicate(lesson.id)}
            data-testid="inspector-duplicate"
          >
            Duplicate
          </Button>
          <Button
            size="sm"
            variant="quiet-danger"
            icon={<Trash2 size={13} aria-hidden="true" />}
            onClick={() => onRemove(lesson.id)}
            data-testid="inspector-remove"
          >
            Remove
          </Button>
        </div>
      </Group>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Program                                                             */
/* ------------------------------------------------------------------ */

function ProgramInspector({ onPropose }: { onPropose: (result: ProposalResult) => void }) {
  const { state, dispatch } = useStore();
  const { program } = state;
  const checks = programChecklist(program);
  const update = (patch: { title?: string; audience?: string; goal?: string; reviewOwner?: string }) =>
    dispatch({ type: 'program/updateMeta', patch });

  return (
    <div data-testid="inspector-program">
      <div className="mb-4 border-b border-rule-strong pb-2">
        <h2 className="eyebrow">Program settings</h2>
        <p className="meta mt-1">Select a lesson to edit it</p>
      </div>

      <Group title="Customer brief">
        <div className="flex flex-col gap-3">
          <Field label="Program title">
            {(p) => (
              <input
                {...p}
                type="text"
                className="field"
                value={program.title}
                onChange={(e) => update({ title: e.target.value })}
                data-testid="field-program-title"
              />
            )}
          </Field>
          <Field label="Audience">
            {(p) => (
              <textarea
                {...p}
                rows={2}
                className="field resize-y"
                value={program.audience}
                onChange={(e) => update({ audience: e.target.value })}
              />
            )}
          </Field>
          <Field label="Goal">
            {(p) => (
              <textarea
                {...p}
                rows={3}
                className="field resize-y"
                value={program.goal}
                onChange={(e) => update({ goal: e.target.value })}
                data-testid="field-program-goal"
              />
            )}
          </Field>
          <Field label="Review owner" hint="Who approves the work this program produces.">
            {(p) => (
              <input
                {...p}
                type="text"
                className="field"
                value={program.reviewOwner}
                onChange={(e) => update({ reviewOwner: e.target.value })}
              />
            )}
          </Field>
        </div>
      </Group>

      <Group title="Coverage across the program">
        <ul className="flex flex-col gap-2.5">
          {checks.map((c) => (
            <li key={c.key}>
              <p className="flex items-baseline justify-between gap-2 text-[13px]">
                <span className="font-semibold">{c.label}</span>
                <span className="tabular text-ink-2">
                  {c.ok} of {c.total}
                </span>
              </p>
              {c.open.map((o) => (
                <button
                  key={o.lessonId}
                  type="button"
                  className="mt-1 block w-full rounded-sm text-left hover:bg-surface"
                  onClick={() => dispatch({ type: 'ui/select', lessonId: o.lessonId })}
                >
                  <StatusMark status={o.status} label={o.title} note={o.note} />
                </button>
              ))}
            </li>
          ))}
        </ul>
      </Group>

      <Group title="Tailor the program" aside={<Tag tone="outline">Scenario rules</Tag>}>
        <Button
          className="w-full justify-start"
          icon={<Scissors size={14} aria-hidden="true" />}
          onClick={() => onPropose(proposeTenMinuteVersion(program))}
          data-testid="tailor-shorten"
        >
          Shorten to a ten-minute version
        </Button>
        <p className="mt-2 text-[11.5px] leading-snug text-ink-2">
          Currently {totalMinutes(program)} minutes. You will see every lesson that changes before anything is applied.
        </p>
      </Group>
    </div>
  );
}
