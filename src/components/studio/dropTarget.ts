import { arrayMove } from '@dnd-kit/sortable';
import {
  DIVIDER_PREFIX,
  addLessonFromTemplate,
  flatIndexToLocation,
  flattenProgram,
  locate,
  reorderFlat,
  type LessonLocation,
} from '../../rules/program';
import type { LearningProgram } from '../../types';

export const END_ZONE_ID = 'journey-end';
export const EMPTY_PREFIX = 'empty:';
export const TEMPLATE_PREFIX = 'tpl:';

export type DropResult = { kind: 'add'; templateId: string; moduleId: string; index: number } | { kind: 'reorder'; flat: string[] } | null;

/** Where in a flat list something dropped on `overId` should be inserted. */
function insertIndex(flat: string[], program: LearningProgram, overId: string): number {
  if (overId === END_ZONE_ID) return flat.length;
  if (overId.startsWith(EMPTY_PREFIX)) {
    const moduleId = overId.slice(EMPTY_PREFIX.length);
    if (program.modules[0]?.id === moduleId) return 0;
    const divider = flat.indexOf(`${DIVIDER_PREFIX}${moduleId}`);
    return divider === -1 ? flat.length : divider + 1;
  }
  const at = flat.indexOf(overId);
  return at === -1 ? flat.length : at;
}

/**
 * Turn a drag result into a state change. Pure, so pointer drags, keyboard drags
 * and tests all resolve a drop the same way.
 * - A library template is inserted before the item it was dropped on.
 * - A lesson takes the place of the item it was dropped on, as a sortable list does.
 */
export function resolveDrop(program: LearningProgram, activeId: string, overId: string | null): DropResult {
  if (!overId) return null;
  const flat = flattenProgram(program);

  if (activeId.startsWith(TEMPLATE_PREFIX)) {
    const location = flatIndexToLocation(program, insertIndex(flat, program, overId));
    return { kind: 'add', templateId: activeId.slice(TEMPLATE_PREFIX.length), ...location };
  }

  const from = flat.indexOf(activeId);
  if (from === -1 || overId === activeId) return null;

  if (overId === END_ZONE_ID || overId.startsWith(EMPTY_PREFIX)) {
    const without = flat.filter((id) => id !== activeId);
    const at = insertIndex(without, program, overId);
    const next = [...without.slice(0, at), activeId, ...without.slice(at)];
    return next.join('|') === flat.join('|') ? null : { kind: 'reorder', flat: next };
  }

  const to = flat.indexOf(overId);
  if (to === -1) return null;
  return { kind: 'reorder', flat: arrayMove(flat, from, to) };
}

const PREVIEW_ID = '__drop-preview__';

/** Where the dragged item would land, for announcements. */
export function previewDrop(program: LearningProgram, activeId: string, overId: string | null): LessonLocation | null {
  const result = resolveDrop(program, activeId, overId);
  if (!result) return activeId.startsWith(TEMPLATE_PREFIX) ? null : locate(program, activeId);
  if (result.kind === 'add') {
    return locate(addLessonFromTemplate(program, result.templateId, result.moduleId, result.index, PREVIEW_ID), PREVIEW_ID);
  }
  return locate(reorderFlat(program, result.flat), activeId);
}
