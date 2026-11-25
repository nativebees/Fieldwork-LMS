import type { PointerEventHandler } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronUp, CircleAlert, Copy, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { rulesIdOf } from '../../fixtures/assessments';
import { BLOCK_KIND_LABEL } from '../../fixtures/lessons';
import { cn } from '../../lib/cn';
import { DIVIDER_PREFIX, flattenProgram, lessonChecklist, listLessons, moduleMinutes, type LessonLocation } from '../../rules/program';
import type { LearningProgram, LessonTemplate, ProgramModule } from '../../types';
import { IconButton, Tag } from '../ui/primitives';
import { EMPTY_PREFIX, END_ZONE_ID, TEMPLATE_PREFIX } from './dropTarget';

/* ------------------------------------------------------------------ */
/* Lesson library                                                      */
/* ------------------------------------------------------------------ */

interface PaletteItemProps {
  template: LessonTemplate;
  finePointer: boolean;
  addLabel: string;
  onAdd: () => void;
}

function PaletteItem({ template, finePointer, addLabel, onAdd }: PaletteItemProps) {
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: `${TEMPLATE_PREFIX}${template.id}`,
    data: { type: 'template', templateId: template.id },
  });
  // Pointer drag only. Keyboard users add with the button, which is announced.
  const pointer = { onPointerDown: listeners?.onPointerDown as PointerEventHandler | undefined };
  return (
    <li
      ref={setNodeRef}
      {...(finePointer ? pointer : {})}
      data-testid={`template-${template.id}`}
      className={cn(
        'group flex w-[220px] shrink-0 items-stretch rounded-md border border-rule-strong bg-paper transition-[border-color,box-shadow,opacity] duration-150 lg:w-auto',
        finePointer && 'cursor-grab active:cursor-grabbing',
        isDragging ? 'opacity-40' : 'hover:border-control hover:shadow-paper',
      )}
    >
      <span
        {...(finePointer ? {} : pointer)}
        aria-hidden="true"
        data-testid={`template-handle-${template.id}`}
        className="flex w-6 shrink-0 touch-none items-center justify-center rounded-l-md text-rule-strong transition-colors group-hover:text-ink-2"
      >
        <GripVertical size={14} />
      </span>
      <div className="min-w-0 flex-1 py-2 pr-1">
        <p className="text-[13px] leading-snug font-semibold">{template.title}</p>
        <p className="mt-0.5 truncate text-[12px] leading-snug text-ink-2" title={template.summary}>
          {template.summary}
        </p>
        <p className="meta mt-1 text-[11px]">
          {template.durationMin} min · {BLOCK_KIND_LABEL[template.leadKind]}
        </p>
      </div>
      <div className="flex items-center pr-1.5">
        <IconButton label={addLabel} onClick={onAdd} onPointerDown={(event) => event.stopPropagation()} data-testid={`add-${template.id}`}>
          <Plus size={15} aria-hidden="true" />
        </IconButton>
      </div>
    </li>
  );
}

interface PaletteProps {
  templates: LessonTemplate[];
  finePointer: boolean;
  addTargetLabel: string;
  onAdd: (templateId: string) => void;
}

export function Palette({ templates, finePointer, addTargetLabel, onAdd }: PaletteProps) {
  return (
    <section aria-labelledby="library-title" data-testid="palette">
      <div className="flex items-baseline justify-between gap-2 border-b border-rule-strong pb-2">
        <h2 id="library-title" className="eyebrow">
          Lesson library
        </h2>
        <span className="meta text-[11px]">{templates.length} templates</span>
      </div>
      <p className="mt-2 mb-3 text-[12px] leading-snug text-ink-2">
        Drag a lesson into the journey, or use the plus button. {addTargetLabel}
      </p>
      <ul className="scroll-quiet -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
        {templates.map((template) => (
          <PaletteItem
            key={template.id}
            template={template}
            finePointer={finePointer}
            addLabel={`Add “${template.title}” to the journey`}
            onAdd={() => onAdd(template.id)}
          />
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Journey                                                             */
/* ------------------------------------------------------------------ */

function DropLine({ show }: { show: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-x-0 -top-[7px] h-[3px] rounded-full bg-terracotta transition-opacity duration-100',
        show ? 'opacity-100' : 'opacity-0',
      )}
    />
  );
}

function ModuleHeader({ module, program, index }: { module: ProgramModule; program: LearningProgram; index: number }) {
  const count = module.lessonIds.length;
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1 border-b border-rule-strong pb-2">
      <div className="min-w-0">
        <p className="eyebrow">Module {index + 1}</p>
        <h3 className="font-display mt-0.5 text-[20px]">{module.title}</h3>
      </div>
      <p className="meta tabular pb-0.5">
        {count} {count === 1 ? 'lesson' : 'lessons'} · {moduleMinutes(program, module.id)} min
      </p>
    </div>
  );
}

/** A later module's header lives inside the sortable list, so dragging past it moves a lesson between modules. */
function SortableDivider({
  module,
  program,
  index,
  dropHint,
}: {
  module: ProgramModule;
  program: LearningProgram;
  index: number;
  dropHint: boolean;
}) {
  const { setNodeRef, transform, transition } = useSortable({ id: `${DIVIDER_PREFIX}${module.id}`, disabled: { draggable: true } });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="relative pt-6"
      data-testid={`module-${module.id}`}
    >
      <DropLine show={dropHint} />
      <ModuleHeader module={module} program={program} index={index} />
    </li>
  );
}

function EmptyModule({ moduleId, active }: { moduleId: string; active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${EMPTY_PREFIX}${moduleId}` });
  return (
    <li
      ref={setNodeRef}
      data-testid={`empty-${moduleId}`}
      className={cn(
        'rounded-md border border-dashed px-4 py-5 text-center text-[13px] transition-colors duration-150',
        isOver
          ? 'border-terracotta-deep bg-terracotta-wash text-terracotta-deep'
          : active
            ? 'border-control text-ink-2'
            : 'border-rule-strong text-ink-2',
      )}
    >
      No lessons in this module yet. Drag one here, or select nothing and use the plus button in the library.
    </li>
  );
}

interface LessonCardProps {
  loc: LessonLocation;
  selected: boolean;
  finePointer: boolean;
  dropHint: boolean;
  showEdit: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onStep: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

function LessonCard({ loc, selected, finePointer, dropHint, showEdit, onSelect, onEdit, onStep, onDuplicate, onRemove }: LessonCardProps) {
  const { lesson, position, total } = loc;
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: lesson.id,
    data: { type: 'lesson' },
  });
  const checks = lessonChecklist(lesson);
  const sourceReview = checks.find((c) => c.key === 'sources')?.status === 'review';
  const missing = checks.filter((c) => c.status === 'missing');

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('relative', isDragging && 'z-10 opacity-40')}
      data-testid={`lesson-${lesson.id}`}
      data-position={position}
      data-selected={selected}
    >
      <DropLine show={dropHint} />
      <div
        {...(finePointer ? { onPointerDown: listeners?.onPointerDown as PointerEventHandler | undefined } : {})}
        onClick={onSelect}
        className={cn(
          'group flex items-stretch rounded-md border bg-paper transition-[border-color,box-shadow,background-color] duration-150',
          selected
            ? 'border-terracotta-deep shadow-[inset_3px_0_0_var(--color-terracotta)]'
            : 'border-rule-strong hover:border-control hover:shadow-paper',
        )}
      >
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Reorder “${lesson.title}”. Position ${position} of ${total}. Press space to pick up, arrow keys to move, space to drop.`}
          data-testid={`handle-${lesson.id}`}
          onClick={(event) => event.stopPropagation()}
          className="flex w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-l-md text-rule-strong transition-colors hover:text-ink active:cursor-grabbing group-hover:text-ink-2"
        >
          <GripVertical size={15} aria-hidden="true" />
        </button>

        <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-stretch">
          <div className="min-w-0 flex-1 py-3 pr-2">
            <div className="flex items-baseline gap-2.5">
              <span className="meta tabular text-[11.5px]" aria-hidden="true">
                {String(position).padStart(2, '0')}
              </span>
              <button
                type="button"
                aria-pressed={selected}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect();
                }}
                data-testid={`select-${lesson.id}`}
                className="font-display min-w-0 text-left text-[17.5px] leading-snug hover:underline hover:decoration-rule-strong hover:underline-offset-4"
              >
                {lesson.title || 'Untitled lesson'}
              </button>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 pl-[30px]">
              <span className="meta tabular">{lesson.durationMin} min</span>
              <span className="meta" aria-hidden="true">
                ·
              </span>
              <span className="meta" data-testid={`rules-${lesson.id}`}>
                {rulesIdOf(lesson.assessment)}
              </span>
              {lesson.revisedFor === 'customer-constraint' && (
                <Tag tone="terracotta" title="Changed because of what the customer said">
                  Revised · customer constraint
                </Tag>
              )}
              {lesson.assessment.status === 'custom-needs-review' && (
                <Tag tone="ochre">
                  <CircleAlert size={11} aria-hidden="true" />
                  Custom · assessment needs review
                </Tag>
              )}
              {lesson.objectiveReview === 'needs-review' && <Tag tone="ochre">Objective changed · check alignment</Tag>}
              {sourceReview && <Tag tone="ochre">Source needs review</Tag>}
              {missing.map((m) => (
                <Tag key={m.key} tone="terracotta">
                  Missing {m.label.toLowerCase()}
                </Tag>
              ))}
            </div>
          </div>

          <div
            className="flex shrink-0 items-center justify-end gap-0.5 border-t border-rule py-1 pr-2 sm:border-t-0 sm:py-2"
            onClick={(event) => event.stopPropagation()}
          >
            {showEdit && (
              <IconButton label={`Edit “${lesson.title}”`} onClick={onEdit} data-testid={`edit-${lesson.id}`}>
                <Pencil size={14} aria-hidden="true" />
              </IconButton>
            )}
            <IconButton
              label={`Move “${lesson.title}” up`}
              onClick={() => onStep(-1)}
              disabled={position === 1}
              data-testid={`up-${lesson.id}`}
            >
              <ChevronUp size={15} aria-hidden="true" />
            </IconButton>
            <IconButton
              label={`Move “${lesson.title}” down`}
              onClick={() => onStep(1)}
              disabled={position === total}
              data-testid={`down-${lesson.id}`}
            >
              <ChevronDown size={15} aria-hidden="true" />
            </IconButton>
            <IconButton label={`Duplicate “${lesson.title}”`} onClick={onDuplicate} data-testid={`duplicate-${lesson.id}`}>
              <Copy size={14} aria-hidden="true" />
            </IconButton>
            <IconButton label={`Remove “${lesson.title}”`} tone="danger" onClick={onRemove} data-testid={`remove-${lesson.id}`}>
              <Trash2 size={14} aria-hidden="true" />
            </IconButton>
          </div>
        </div>
      </div>
    </li>
  );
}

function EndZone({ visible }: { visible: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: END_ZONE_ID });
  return (
    <div
      ref={setNodeRef}
      data-testid="journey-end"
      className={cn(
        'mt-2 rounded-md border border-dashed px-4 text-center text-[12.5px] transition-[height,padding,opacity,border-color,background-color] duration-150',
        visible ? 'py-3 opacity-100' : 'h-3 border-transparent py-0 opacity-0',
        isOver ? 'border-terracotta-deep bg-terracotta-wash text-terracotta-deep' : 'border-control text-ink-2',
      )}
    >
      {visible && 'Drop here to place it at the end'}
    </div>
  );
}

interface JourneyProps {
  program: LearningProgram;
  selectedLessonId: string | null;
  finePointer: boolean;
  /** The id the dragged template is currently over. It will be inserted before that item. */
  templateOverId: string | null;
  draggingTemplate: boolean;
  showEdit: boolean;
  onSelect: (lessonId: string) => void;
  onEdit: (lessonId: string) => void;
  onStep: (lessonId: string, direction: -1 | 1) => void;
  onDuplicate: (lessonId: string) => void;
  onRemove: (lessonId: string) => void;
}

export function Journey({
  program,
  selectedLessonId,
  finePointer,
  templateOverId,
  draggingTemplate,
  showEdit,
  onSelect,
  onEdit,
  onStep,
  onDuplicate,
  onRemove,
}: JourneyProps) {
  const flat = flattenProgram(program);
  const locations = new Map(listLessons(program).map((l) => [l.lesson.id, l]));
  const first = program.modules[0];

  const renderLessons = (module: ProgramModule) =>
    module.lessonIds.length === 0 ? (
      <EmptyModule key={`empty-${module.id}`} moduleId={module.id} active={draggingTemplate} />
    ) : (
      module.lessonIds.map((id) => {
        const loc = locations.get(id);
        if (!loc) return null;
        return (
          <LessonCard
            key={id}
            loc={loc}
            selected={selectedLessonId === id}
            finePointer={finePointer}
            dropHint={templateOverId === id}
            showEdit={showEdit}
            onSelect={() => onSelect(id)}
            onEdit={() => onEdit(id)}
            onStep={(direction) => onStep(id, direction)}
            onDuplicate={() => onDuplicate(id)}
            onRemove={() => onRemove(id)}
          />
        );
      })
    );

  return (
    <div data-testid="journey">
      <ModuleHeader module={first} program={program} index={0} />
      <SortableContext items={flat} strategy={verticalListSortingStrategy}>
        <ol className="mt-3 flex flex-col gap-2.5">
          {renderLessons(first)}
          {program.modules
            .slice(1)
            .map((module, i) => [
              <SortableDivider
                key={`divider-${module.id}`}
                module={module}
                program={program}
                index={i + 1}
                dropHint={templateOverId === `${DIVIDER_PREFIX}${module.id}`}
              />,
              renderLessons(module),
            ])}
        </ol>
      </SortableContext>
      <EndZone visible={draggingTemplate} />
    </div>
  );
}
