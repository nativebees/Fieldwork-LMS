import { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ArrowRight, GripVertical, MessageSquare, Undo2, X } from 'lucide-react';
import { LESSON_TEMPLATES, TEMPLATE_BY_ID } from '../../fixtures/lessons';
import { plural } from '../../lib/format';
import { useMediaQuery } from '../../lib/hooks';
import { hrefFor } from '../../lib/router';
import {
  addLessonFromTemplate,
  duplicateLesson,
  listLessons,
  locate,
  moveLessonByStep,
  programChecklist,
  totalMinutes,
  type LessonLocation,
} from '../../rules/program';
import type { ProposalResult } from '../../rules/tailoring';
import { useStore } from '../../state/store';
import type { Proposal } from '../../types';
import { ViewSwitch } from '../ViewSwitch';
import { useFeedback } from '../ui/feedback';
import { Modal } from '../ui/Modal';
import { Button, IconButton, LinkButton, StatusMark } from '../ui/primitives';
import { ConstraintBanner } from './ConstraintBanner';
import { TEMPLATE_PREFIX, previewDrop, resolveDrop } from './dropTarget';
import { Inspector } from './Inspector';
import { Journey, Palette } from './Journey';
import { ProposalDialog } from './ProposalDialog';

const positionText = (loc: LessonLocation) => `position ${loc.position} of ${loc.total}, in ${loc.module.title}`;

export function StudioView() {
  const { state, dispatch } = useStore();
  const { announce, toast } = useFeedback();
  const { program } = state;
  const isWide = useMediaQuery('(min-width: 1024px)');
  const finePointer = useMediaQuery('(pointer: fine)');
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const [activeId, setActiveId] = useState<string | null>(null);
  const [templateOverId, setTemplateOverId] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const titleOf = useCallback(
    (id: string) =>
      (id.startsWith(TEMPLATE_PREFIX) ? TEMPLATE_BY_ID[id.slice(TEMPLATE_PREFIX.length)]?.title : program.lessons[id]?.title) ?? 'Lesson',
    [program],
  );

  // Templates follow the pointer. Lessons use the standard sortable behaviour.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    if (String(args.active.id).startsWith(TEMPLATE_PREFIX)) {
      const hits = pointerWithin(args);
      if (hits.length > 0) return hits;
    }
    return closestCenter(args);
  }, []);

  const announcements: Announcements = useMemo(
    () => ({
      onDragStart: ({ active }) => {
        const id = String(active.id);
        const loc = locate(program, id);
        return loc ? `Picked up “${titleOf(id)}”. It is at ${positionText(loc)}.` : `Picked up “${titleOf(id)}” from the lesson library.`;
      },
      onDragOver: ({ active, over }) => {
        const id = String(active.id);
        // Hovering over its own slot is not news. Keep the pick-up announcement instead.
        if (over && over.id === active.id) return undefined;
        const loc = previewDrop(program, id, over ? String(over.id) : null);
        return loc ? `“${titleOf(id)}” would move to ${positionText(loc)}.` : `“${titleOf(id)}” is not over the journey.`;
      },
      onDragEnd: ({ active, over }) => {
        const id = String(active.id);
        const loc = previewDrop(program, id, over ? String(over.id) : null);
        if (!loc) return `“${titleOf(id)}” was not added.`;
        return id.startsWith(TEMPLATE_PREFIX)
          ? `Added “${titleOf(id)}” at ${positionText(loc)}.`
          : `“${titleOf(id)}” is now at ${positionText(loc)}.`;
      },
      onDragCancel: ({ active }) => `Move cancelled. “${titleOf(String(active.id))}” was left where it was.`,
    }),
    [program, titleOf],
  );

  const endDrag = () => {
    setActiveId(null);
    setTemplateOverId(null);
  };

  const onDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));

  const onDragOver = (event: DragOverEvent) => {
    if (String(event.active.id).startsWith(TEMPLATE_PREFIX)) setTemplateOverId(event.over ? String(event.over.id) : null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const result = resolveDrop(program, String(event.active.id), event.over ? String(event.over.id) : null);
    endDrag();
    if (!result) return;
    if (result.kind === 'add')
      dispatch({ type: 'program/add', templateId: result.templateId, moduleId: result.moduleId, index: result.index });
    else dispatch({ type: 'program/reorder', flat: result.flat });
  };

  /* ---------- actions that do not involve dragging ---------- */

  const selected = state.selectedLessonId ? locate(program, state.selectedLessonId) : null;
  const lastModule = program.modules[program.modules.length - 1];
  const addTarget = selected
    ? { moduleId: selected.module.id, index: selected.index + 1, label: `The plus button adds after “${selected.lesson.title}”.` }
    : { moduleId: lastModule.id, index: lastModule.lessonIds.length, label: `The plus button adds to the end of “${lastModule.title}”.` };

  const addTemplate = (templateId: string) => {
    const preview = locate(addLessonFromTemplate(program, templateId, addTarget.moduleId, addTarget.index, '__preview__'), '__preview__');
    dispatch({ type: 'program/add', templateId, moduleId: addTarget.moduleId, index: addTarget.index });
    if (preview) announce(`Added “${TEMPLATE_BY_ID[templateId].title}” at ${positionText(preview)}.`);
    if (!isWide) setInspectorOpen(false);
  };

  const step = (lessonId: string, direction: -1 | 1) => {
    const loc = locate(moveLessonByStep(program, lessonId, direction), lessonId);
    dispatch({ type: 'program/step', lessonId, direction });
    if (loc) announce(`“${loc.lesson.title}” moved to ${positionText(loc)}.`);
  };

  const duplicate = (lessonId: string) => {
    const loc = locate(duplicateLesson(program, lessonId, '__preview__'), '__preview__');
    dispatch({ type: 'program/duplicate', lessonId });
    if (loc) announce(`Duplicated. The copy is at ${positionText(loc)}.`);
  };

  const remove = (lessonId: string) => {
    const title = program.lessons[lessonId]?.title ?? 'Lesson';
    dispatch({ type: 'program/remove', lessonId });
    setInspectorOpen(false);
    announce(`Removed “${title}”. Undo is available above the journey.`);
  };

  const select = (lessonId: string) => dispatch({ type: 'ui/select', lessonId });

  const propose = (result: ProposalResult) => {
    if (result.ok) {
      setInspectorOpen(false);
      setProposal(result.proposal);
    } else {
      toast({ message: `Nothing to change. ${result.reason}` });
      announce(`Nothing to change. ${result.reason}`);
    }
  };

  const applyProposal = (p: Proposal) => {
    dispatch({ type: 'program/applyProposal', proposal: p });
    setProposal(null);
    toast({ message: 'Applied. The customer preview and the exports now show this version.' });
    announce(`Applied: ${p.title}.`);
  };

  const cancelProposal = () => {
    setProposal(null);
    toast({ message: 'Cancelled. No changes were made.' });
    announce('Cancelled. No changes were made.');
  };

  const lessons = listLessons(program);
  const checks = programChecklist(program);
  const inspector = (
    <Inspector onPropose={propose} onDuplicate={duplicate} onRemove={remove} onClose={isWide ? undefined : () => setInspectorOpen(false)} />
  );

  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-7 pb-16 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <p className="eyebrow">Program studio · seller view</p>
          <h1 className="font-display mt-2 text-[30px] sm:text-[36px]" data-testid="studio-title">
            {program.title || 'Untitled program'}
          </h1>
          <p className="meta tabular mt-2" data-testid="studio-meta">
            {plural(lessons.length, 'lesson')} · {totalMinutes(program)} min · {program.modules.length} modules
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ViewSwitch active="studio" />
          <LinkButton href={hrefFor('review')} iconAfter={<ArrowRight size={14} aria-hidden="true" />} testId="go-review">
            Review and export
          </LinkButton>
        </div>
      </header>

      <div className="mt-6">
        {state.constraint ? (
          <ConstraintBanner onPropose={propose} />
        ) : (
          <p
            className="flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-rule py-3 text-[13.5px] text-ink-2"
            data-testid="no-constraint-hint"
          >
            <MessageSquare size={15} aria-hidden="true" />
            This is your starting plan. You have not heard the customer’s side yet.
            <a
              href={hrefFor('rehearsal')}
              className="font-semibold text-ink underline decoration-rule-strong underline-offset-2 hover:decoration-ink"
            >
              Rehearse the conversation
            </a>
          </p>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={endDrag}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              'To reorder a lesson, press space or enter on its handle, move it with the arrow keys and press space again to drop. Press escape to cancel. The move up and move down buttons do the same thing.',
          },
        }}
      >
        <div className="mt-7 grid gap-x-7 gap-y-8 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
          <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <Palette templates={LESSON_TEMPLATES} finePointer={finePointer} addTargetLabel={addTarget.label} onAdd={addTemplate} />
          </div>

          <section aria-label="Learning journey" className="min-w-0">
            <ul
              className="mb-5 flex flex-wrap gap-x-5 gap-y-1.5 border-b border-rule pb-3"
              data-testid="program-checklist"
              aria-label="Coverage"
            >
              {checks.map((c) => (
                <li key={c.key} data-check={c.key} data-ok={c.ok} data-total={c.total}>
                  <StatusMark
                    status={
                      c.total === 0
                        ? 'missing'
                        : c.open.some((o) => o.status === 'missing')
                          ? 'missing'
                          : c.open.length > 0
                            ? 'review'
                            : 'ok'
                    }
                    label={c.label}
                    note={`${c.ok} of ${c.total}`}
                  />
                </li>
              ))}
            </ul>

            {state.lastRemoved && (
              <div
                role="status"
                className="mb-4 flex animate-rise flex-wrap items-center justify-between gap-2 rounded-md border border-rule-strong bg-surface-soft py-2 pr-2 pl-3.5 text-[13.5px]"
                data-testid="undo-bar"
              >
                <p>Removed “{state.lastRemoved.lesson.title}”.</p>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    icon={<Undo2 size={13} aria-hidden="true" />}
                    data-testid="undo-remove"
                    onClick={() => {
                      const title = state.lastRemoved?.lesson.title;
                      dispatch({ type: 'program/undoRemove' });
                      announce(`Restored “${title}”.`);
                    }}
                  >
                    Undo
                  </Button>
                  <IconButton label="Dismiss" onClick={() => dispatch({ type: 'program/dismissUndo' })}>
                    <X size={14} aria-hidden="true" />
                  </IconButton>
                </div>
              </div>
            )}

            {lessons.length === 0 && (
              <p
                className="mb-4 rounded-md border border-rule-strong bg-ochre-wash px-4 py-3 text-[13.5px] text-ochre-deep"
                data-testid="empty-program"
              >
                The program has no lessons. The customer preview will be empty until you add one from the library.
              </p>
            )}

            <Journey
              program={program}
              selectedLessonId={state.selectedLessonId}
              finePointer={finePointer}
              templateOverId={templateOverId}
              draggingTemplate={activeId !== null && activeId.startsWith(TEMPLATE_PREFIX)}
              showEdit={!isWide}
              onSelect={select}
              onEdit={(id) => {
                select(id);
                setInspectorOpen(true);
              }}
              onStep={step}
              onDuplicate={duplicate}
              onRemove={remove}
            />
          </section>

          {isWide && (
            <aside
              aria-label="Inspector"
              className="scroll-quiet lg:sticky lg:top-24 lg:max-h-[calc(100vh-7.5rem)] lg:self-start lg:overflow-y-auto lg:pr-1"
            >
              {inspector}
            </aside>
          )}
        </div>

        <DragOverlay dropAnimation={reducedMotion ? null : { duration: 160, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' }}>
          {activeId && (
            <div className="flex w-[280px] items-center gap-2 rounded-md border border-terracotta-deep bg-paper py-2.5 pr-3 pl-2 shadow-lift">
              <GripVertical size={15} className="shrink-0 text-ink-2" aria-hidden="true" />
              <span className="font-display min-w-0 truncate text-[16px]">{titleOf(activeId)}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {!isWide && (
        <>
          <section className="mt-8 border-t border-rule-strong pt-5" aria-label="Program settings">
            {state.selectedLessonId ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13.5px]">
                  Selected: <span className="font-semibold">{selected?.lesson.title}</span>
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="primary" onClick={() => setInspectorOpen(true)} data-testid="open-inspector">
                    Edit lesson
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'ui/select', lessonId: null })}>
                    Program settings
                  </Button>
                </div>
              </div>
            ) : (
              inspector
            )}
          </section>
          <Modal
            open={inspectorOpen && state.selectedLessonId !== null}
            onClose={() => setInspectorOpen(false)}
            title="Edit lesson"
            eyebrow="Inspector"
            width="sm"
            testId="inspector-drawer"
          >
            {inspector}
          </Modal>
        </>
      )}

      <ProposalDialog proposal={proposal} program={program} onApply={applyProposal} onCancel={cancelProposal} />
    </div>
  );
}
