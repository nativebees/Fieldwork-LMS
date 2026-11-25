import { describe, expect, it } from 'vitest';
import { SUGGESTION_ORDER, proposeSuggestions } from './tailoring';
import { BEST_AE_PATH, fresh, run } from '../test/helpers';
import { optionsFor, rubricTotal, scoreSellerRubric } from './sellerRubric';
import type { AppState } from '../types';

const score = (s: AppState) =>
  scoreSellerRubric({ profileId: s.sellerProfileId, rehearsal: s.rehearsal, program: s.program, constraintKnown: s.constraint !== null });

function withRevisedProgram(s: AppState): AppState {
  const result = proposeSuggestions(s.program, SUGGESTION_ORDER, [], s.counter);
  if (!result.ok) throw new Error(result.reason);
  return run(s, { type: 'program/applyProposal', proposal: result.proposal });
}

describe('seller practice rubric', () => {
  it('has five criteria worth two points each and starts unscored', () => {
    const results = score(fresh());
    expect(results).toHaveLength(5);
    expect(rubricTotal(results)).toEqual({ points: 0, max: 10, scored: 0 });
  });

  it('good conversation choices alone do not earn full marks: the program has to change too', () => {
    const talked = run(fresh(), ...BEST_AE_PATH);
    expect(rubricTotal(score(talked)).points).toBe(7);
    const fit = score(talked).find((r) => r.id === 'intervention-fit')!;
    expect(fit.points).toBe(1);
    expect(fit.evidence.join(' ')).toMatch(/no scored claim-check lesson/);

    const revised = withRevisedProgram(talked);
    expect(rubricTotal(score(revised)).points).toBe(10);
    expect(score(revised).find((r) => r.id === 'accuracy-and-approval')!.evidence.join(' ')).toMatch(/cl\.identify/);
  });

  it('proposing that Claude approve claims withholds the approval point even with a revised program', () => {
    const s = withRevisedProgram(
      run(
        fresh(),
        { type: 'rehearsal/choose', stepId: 'opening', optionId: 'o-observe' },
        { type: 'rehearsal/choose', stepId: 'firstQuestion', optionId: 'q-walkthrough' },
        { type: 'rehearsal/choose', stepId: 'followUp', optionId: 'f-automate' },
      ),
    );
    const result = score(s).find((r) => r.id === 'accuracy-and-approval')!;
    expect(result.points).toBe(1);
    expect(result.evidence.join(' ')).toMatch(/ruled out/);
  });

  it('changing the seller profile changes the options and the bar for measurement', () => {
    const ae = optionsFor('measurement', 'ae-new').map((o) => o.id);
    const csm = optionsFor('measurement', 'csm-experienced').map((o) => o.id);
    expect(ae).toContain('m-seats');
    expect(ae).not.toContain('m-pilot');
    expect(csm).toContain('m-pilot');
    expect(csm).not.toContain('m-seats');

    const asAe = run(fresh(), ...BEST_AE_PATH);
    const asCsm = run(asAe, { type: 'profile/set', profileId: 'csm-experienced' });
    const points = (s: AppState) => score(s).find((r) => r.id === 'next-measurement')!.points;
    expect(points(asAe)).toBe(2);
    expect(points(asCsm)).toBe(1);
  });

  it('the free-text reflection is never scored', () => {
    const base = run(fresh(), ...BEST_AE_PATH);
    const withText = run(base, { type: 'rehearsal/reflection', text: 'observation denominator diagnostic approval measurement' });
    expect(score(withText)).toEqual(score(base));
  });
});
