import { describe, expect, it } from 'vitest';
import { ACCOUNT, SELLER_PROFILES } from '../fixtures/account';
import { buildHypotheses } from '../rules/recommendations';
import { snapshotOf } from '../test/helpers';
import { SyntheticAnalyticsProvider } from './analytics';
import { activeCoachingProvider, liveCoaching, scenarioCoaching, validateLiveCoachingResponse } from './coaching';

const hypotheses = buildHypotheses(snapshotOf());
const marketing = hypotheses.find((h) => h.department === 'Marketing')!;
const finance = hypotheses.find((h) => h.department === 'Finance')!;

describe('scenario coaching provider', () => {
  it('changing the seller context changes the decision, the question and the success criteria', async () => {
    const ae = await scenarioCoaching.getGuidance({ seller: SELLER_PROFILES['ae-new'], account: ACCOUNT, hypothesis: marketing });
    const csm = await scenarioCoaching.getGuidance({ seller: SELLER_PROFILES['csm-experienced'], account: ACCOUNT, hypothesis: marketing });
    expect(ae.nextDecision).not.toEqual(csm.nextDecision);
    expect(ae.question).not.toEqual(csm.question);
    expect(ae.successCriteria).not.toEqual(csm.successCriteria);
    expect(ae.watchOut).toMatch(/expansion/);
    expect(csm.successCriteria.join(' ')).toMatch(/Pilot criteria/);
    // More than a job-title swap: neither text mentions the role name.
    expect(`${ae.objective} ${csm.objective}`).not.toMatch(/AE|CSM/);
  });

  it('is reproducible', async () => {
    const request = { seller: SELLER_PROFILES['ae-new'], account: ACCOUNT, hypothesis: marketing };
    expect(await scenarioCoaching.getGuidance(request)).toEqual(await scenarioCoaching.getGuidance(request));
  });

  it('treats a restricted capability as an access question', async () => {
    const request = { seller: SELLER_PROFILES['ae-new'], account: ACCOUNT, hypothesis: finance };
    const pip = await scenarioCoaching.explainHypothesis(request);
    expect(pip.message).toBe('This could be an access issue. Check the permission before assigning training.');
    expect((await scenarioCoaching.getGuidance(request)).successCriteria.join(' ')).toMatch(/no training/);
  });

  it('nudges after a miss without giving the answer away, and reports success plainly', async () => {
    const miss = await scenarioCoaching.coachAttempt({
      attemptNumber: 1,
      results: [
        { criterionId: 'cl.identify', label: 'Identifies the unsupported claim', met: false, explanation: '' },
        { criterionId: 'cl.evidence', label: 'Chooses evidence the owner can check', met: true, explanation: '' },
      ],
      hints: { 'cl.identify': 'Check each sentence against the source list.' },
    });
    expect(miss.pip).toBe('nudge');
    expect(miss.message).toMatch(/1 of 2 not met/);
    expect(miss.message).not.toMatch(/40%/);

    const done = await scenarioCoaching.coachAttempt({
      attemptNumber: 2,
      results: [{ criterionId: 'cl.identify', label: 'x', met: true, explanation: '' }],
      hints: {},
    });
    expect(done.pip).toBe('done');
    expect(done.message).toMatch(/attempt 2/);
  });
});

describe('live coaching boundary', () => {
  it('is visibly unavailable and is never the active provider', async () => {
    expect(liveCoaching.availability().available).toBe(false);
    expect(activeCoachingProvider().id).toBe('scenario');
    await expect(liveCoaching.getGuidance()).rejects.toThrow(/not configured/);
  });

  it('a future live response must cite only supplied criteria and sources', () => {
    const allowed = { criterionIds: ['cl.identify'], sourceIds: ['src-meridian-sources'] };
    const ok = validateLiveCoachingResponse(
      {
        feedback: [{ criterionId: 'cl.identify', evidence: 'Picked sentence 2.', sourceIds: ['src-meridian-sources'] }],
        uncertainty: 'low',
        suggestedNextTask: 'Retry.',
      },
      allowed,
    );
    expect(ok.ok).toBe(true);
    const bad = validateLiveCoachingResponse(
      { feedback: [{ criterionId: 'made.up', evidence: 'x', sourceIds: ['src-invented'] }], uncertainty: 'low', suggestedNextTask: 'x' },
      allowed,
    );
    expect(bad).toMatchObject({ ok: false });
    if (!bad.ok) expect(bad.errors.join(' ')).toMatch(/not in the rubric.*not provided/);
  });
});

describe('synthetic analytics provider', () => {
  it('loads with no credentials and can simulate an outage', async () => {
    const snapshot = await new SyntheticAnalyticsProvider().load();
    expect(snapshot.synthetic).toBe(true);
    expect(snapshot.members).toHaveLength(200);
    await expect(new SyntheticAnalyticsProvider({ simulateUnavailable: true }).load()).rejects.toThrow(/not loaded/);
  });
});
