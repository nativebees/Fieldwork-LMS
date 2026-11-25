import { describe, expect, it } from 'vitest';
import { OBSERVATION_WINDOW } from '../fixtures/account';
import { MEMBERS } from '../fixtures/members';
import { BEST_AE_PATH, fresh, run, snapshotOf } from '../test/helpers';
import type { AppState } from '../types';
import { summarizeOrganization } from './analytics';
import { buildEnablementMeasurement, buildFollowUpPlan, buildMarkdownBrief, buildPlanJson, explainChanges } from './export';
import { buildHypotheses } from './recommendations';
import { SUGGESTION_ORDER, proposeSuggestions } from './tailoring';

const ctx = (state: AppState) => ({
  state,
  hypotheses: buildHypotheses(snapshotOf()),
  organization: summarizeOrganization(MEMBERS),
  window: OBSERVATION_WINDOW,
  exportedAt: '2026-11-25T12:00:00.000Z',
});

function revised(): AppState {
  const talked = run(fresh(), ...BEST_AE_PATH);
  const result = proposeSuggestions(talked.program, SUGGESTION_ORDER, [], talked.counter);
  if (!result.ok) throw new Error(result.reason);
  return run(talked, { type: 'program/applyProposal', proposal: result.proposal });
}

describe('exports reflect the current state', () => {
  it('an edited lesson title appears in the Markdown brief and the JSON plan', () => {
    const s = run(fresh(), { type: 'program/updateLesson', lessonId: 'lesson-1', patch: { title: 'Save the Relay brief context' } });
    expect(buildMarkdownBrief(ctx(s))).toContain('**Save the Relay brief context** (5 min)');
    const json = buildPlanJson(ctx(s)) as { program: { sequence: Array<{ title: string }> } };
    expect(json.program.sequence[0].title).toBe('Save the Relay brief context');
  });

  it('the brief has the customer sections and leaves seller context out', () => {
    const md = buildMarkdownBrief(ctx(revised()));
    for (const heading of [
      '## Audience',
      '## Goal',
      '## Sequence',
      '## Source notes',
      '## Practice',
      '## Review owner',
      '## Follow-up (proposed)',
    ]) {
      expect(md).toContain(heading);
    }
    expect(md).toContain('## What changed after the adoption review');
    expect(md).toContain('Check claims before handoff');
    expect(md).not.toMatch(/CRM|renewal|rubric|Enterprise AE/i);
    expect(md).toMatch(/synthetic/);
  });

  it('custom content is exported as needing review, not as scored', () => {
    const s = run(fresh(), { type: 'program/updateLesson', lessonId: 'lesson-2', patch: { evidence: 'A new requirement.' } });
    expect(buildMarkdownBrief(ctx(s))).toMatch(/custom content\. The assessment needs review/);
  });

  it('the follow-up plan follows the program and stays labeled as proposed', () => {
    expect(buildFollowUpPlan(fresh()).measure).toMatch(/saved context/);
    const plan = buildFollowUpPlan(revised());
    expect(plan.measure).toMatch(/unsupported product claims/);
    expect(plan.checkpoints.map((c) => c.day)).toEqual([14, 28]);
    expect(plan.boundary).toMatch(/Nothing here has been measured/);
  });

  it('seller impact is measured by what changes, and claims nothing it has not collected', () => {
    const empty = buildEnablementMeasurement(fresh());
    expect(empty.measures.map((m) => m.id)).toEqual(['use-in-work', 'live-behaviour', 'customer-outcome', 'commercial']);
    expect(empty.measures[0].inThisDemo).toMatch(/No first call was recorded/);
    expect(empty.measures[1].inThisDemo).toMatch(/Not rehearsed yet/);

    const done = buildEnablementMeasurement(revised());
    expect(done.measures[0].inThisDemo).toMatch(/constraint was heard and \d+ program changes followed/);
    expect(done.measures[1].inThisDemo).toMatch(/10 of 10 on a scripted task/);
    const commercial = done.measures.find((m) => m.id === 'commercial')!;
    expect(commercial.measure).toMatch(/Ramp time, win rate and attainment/);
    expect(commercial.status).toBe('proposed');
    expect(commercial.inThisDemo).toMatch(/Not produced by this demo/);
    expect(done.boundary).toMatch(/Completion and satisfaction are left off/);
    // Nothing in the list reports completion or satisfaction as a measure.
    expect(done.measures.map((m) => m.measure).join(' ')).not.toMatch(/completion|satisfaction/i);
  });

  it('the measure to watch first follows the seller’s role and tenure', () => {
    const ae = buildEnablementMeasurement(fresh());
    const csm = buildEnablementMeasurement(run(fresh(), { type: 'profile/set', profileId: 'csm-experienced' }));
    expect(ae.focus).toMatch(/45 days in.*ramp time/);
    expect(csm.focus).toMatch(/18 months in.*attainment/);
  });

  it('the customer brief never carries seller impact measures', () => {
    const md = buildMarkdownBrief(ctx(revised()));
    expect(md).not.toMatch(/ramp time|win rate|attainment/i);
    const json = buildPlanJson(ctx(revised())) as { enablementMeasurement: { status: string } };
    expect(json.enablementMeasurement.status).toBe('proposed');
  });

  it('every change since the constraint carries a reason', () => {
    const changes = explainChanges(revised());
    expect(changes.length).toBeGreaterThan(3);
    expect(changes.every((c) => c.why.length > 0)).toBe(true);
    expect(changes.filter((c) => c.source === 'customer-constraint').length).toBe(changes.length);

    const manual = run(fresh(), ...BEST_AE_PATH, { type: 'program/updateLesson', lessonId: 'lesson-1', patch: { title: 'Renamed' } });
    expect(explainChanges(manual)[0]).toMatchObject({ source: 'author' });
  });

  it('the JSON keeps adoption figures from the fixture and separates the two kinds of practice', () => {
    const json = buildPlanJson(ctx(revised())) as {
      snapshot: { organization: { active: number } };
      sellerPractice: { total: { points: number } };
      learnerPractice: { criteriaDemonstrated: number };
      notice: { synthetic: boolean };
    };
    expect(json.snapshot.organization.active).toBe(156);
    expect(json.sellerPractice.total.points).toBe(10);
    expect(json.learnerPractice.criteriaDemonstrated).toBe(0);
    expect(json.notice.synthetic).toBe(true);
  });
});
