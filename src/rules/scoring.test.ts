import { describe, expect, it } from 'vitest';
import { ASSESSMENT_BY_RULES_ID, ASSESSMENT_VERSIONS } from '../fixtures/assessments';
import { initialResponse, scoreResponse, unansweredParts } from './scoring';

describe('typed assessment scoring', () => {
  it('every rule set has unique, explicit criterion ids and a stable rules id', () => {
    for (const v of ASSESSMENT_VERSIONS) {
      expect(v.rulesId).toBe(`${v.templateId}@${v.version}`);
      const ids = v.criteria.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(v.criteria.every((c) => c.hint.length > 0)).toBe(true);
    }
  });

  it('no starting state scores perfectly', () => {
    for (const v of ASSESSMENT_VERSIONS) {
      const results = scoreResponse(v, initialResponse(v));
      expect(results.every((r) => r.met)).toBe(false);
    }
  });

  it('a wrong claim choice fails with an explanation tied to the choice', () => {
    const v = ASSESSMENT_BY_RULES_ID['claim-check@1'];
    const results = scoreResponse(v, { claim: 'c3', evidence: 'e2' });
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ criterionId: 'cl.identify', met: false });
    expect(results[0].explanation).toMatch(/integration catalog/);
    expect(results[1].explanation).toMatch(/Rewording/);
  });

  it('a retry with the right choices meets both criteria', () => {
    const v = ASSESSMENT_BY_RULES_ID['claim-check@1'];
    expect(scoreResponse(v, { claim: 'c2', evidence: 'e1' }).every((r) => r.met)).toBe(true);
  });

  it('sequence rules check relative order, including approval before sharing', () => {
    const v = ASSESSMENT_BY_RULES_ID['workflow-sequence@2'];
    const good = scoreResponse(v, { steps: ['context', 'draft', 'claims', 'approve', 'share'] });
    expect(good.every((r) => r.met)).toBe(true);
    const shareEarly = scoreResponse(v, { steps: ['context', 'draft', 'claims', 'share', 'approve'] });
    expect(shareEarly.find((r) => r.criterionId === 'wf.approval-before-share')!.met).toBe(false);
    expect(shareEarly.find((r) => r.criterionId === 'wf.claims-before-approval')!.met).toBe(true);
  });

  it('set rules explain both what is missing and what does not belong', () => {
    const v = ASSESSMENT_BY_RULES_ID['context-pack@1'];
    const results = scoreResponse(v, { sort: ['audience', 'date'] });
    expect(results[0].met).toBe(false);
    expect(results[0].explanation).toMatch(/Approved product descriptions/);
    expect(results[1].explanation).toMatch(/launch date/);
  });

  it('reports unanswered parts so a response cannot be checked half finished', () => {
    const v = ASSESSMENT_BY_RULES_ID['transfer-brief@2'];
    expect(unansweredParts(v, { claim: 'w2' }).map((p) => p.id)).toEqual(['evidence', 'approval']);
    expect(unansweredParts(v, { claim: 'w2', evidence: 'v1', approval: 'after' })).toEqual([]);
  });
});
