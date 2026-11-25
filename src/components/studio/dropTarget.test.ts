import { describe, expect, it } from 'vitest';
import { TEMPLATE_IDS, createDefaultProgram } from '../../fixtures/lessons';
import { reorderFlat } from '../../rules/program';
import { previewDrop, resolveDrop } from './dropTarget';

describe('resolving a drop', () => {
  const program = createDefaultProgram();

  it('a template dropped on a lesson is inserted before it', () => {
    expect(resolveDrop(program, `tpl:${TEMPLATE_IDS.claims}`, 'lesson-3')).toEqual({
      kind: 'add',
      templateId: TEMPLATE_IDS.claims,
      moduleId: 'module-2',
      index: 0,
    });
  });

  it('a template dropped on a module header lands at the end of the module above', () => {
    expect(resolveDrop(program, `tpl:${TEMPLATE_IDS.approval}`, 'divider:module-2')).toMatchObject({ moduleId: 'module-1', index: 2 });
  });

  it('a template dropped on the end zone lands last', () => {
    expect(resolveDrop(program, `tpl:${TEMPLATE_IDS.approval}`, 'journey-end')).toMatchObject({ moduleId: 'module-2', index: 2 });
    expect(previewDrop(program, `tpl:${TEMPLATE_IDS.approval}`, 'journey-end')).toMatchObject({ position: 5, total: 5 });
  });

  it('a lesson dropped on another lesson takes its place', () => {
    const result = resolveDrop(program, 'lesson-4', 'lesson-1');
    expect(result).toEqual({ kind: 'reorder', flat: ['lesson-4', 'lesson-1', 'lesson-2', 'divider:module-2', 'lesson-3'] });
    expect(previewDrop(program, 'lesson-4', 'lesson-1')).toMatchObject({ position: 1 });
  });

  it('a lesson dragged across a module header changes module', () => {
    const result = resolveDrop(program, 'lesson-2', 'divider:module-2');
    if (result?.kind !== 'reorder') throw new Error('expected a reorder');
    expect(reorderFlat(program, result.flat).modules.map((m) => m.lessonIds)).toEqual([['lesson-1'], ['lesson-2', 'lesson-3', 'lesson-4']]);
  });

  it('dropping outside the journey, or on itself, changes nothing', () => {
    expect(resolveDrop(program, 'lesson-2', null)).toBeNull();
    expect(resolveDrop(program, 'lesson-2', 'lesson-2')).toBeNull();
    expect(resolveDrop(program, 'lesson-4', 'journey-end')).toBeNull();
    expect(resolveDrop(program, `tpl:${TEMPLATE_IDS.claims}`, null)).toBeNull();
  });
});
