import type { AssessmentVersion, AttemptResponse, CriterionResult, CriterionRule, ExercisePart } from '../types';

/**
 * Evaluates a structured response against one versioned rule set.
 * Pure and deterministic. It only reads explicit choices and orderings.
 */

function asList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return typeof value === 'string' && value.length > 0 ? [value] : [];
}

function evaluate(rule: CriterionRule, response: AttemptResponse): { met: boolean; explanation: string } {
  if (rule.type === 'sequence') {
    const order = asList(response[rule.partId]);
    const positions = rule.order.map((id) => order.indexOf(id));
    const present = positions.every((p) => p >= 0);
    const increasing = positions.every((p, i) => i === 0 || p > positions[i - 1]);
    const met = present && increasing;
    return { met, explanation: met ? rule.pass : rule.fail };
  }

  if (rule.type === 'choice') {
    const picked = response[rule.partId];
    const choice = typeof picked === 'string' ? picked : '';
    if (choice === rule.correct) return { met: true, explanation: rule.pass };
    return { met: false, explanation: rule.explain[choice] ?? 'That choice does not meet this criterion.' };
  }

  const selected = new Set(asList(response[rule.partId]));
  const missing = rule.required.filter((id) => !selected.has(id));
  const wrong = rule.forbidden.filter((id) => selected.has(id));
  if (missing.length === 0 && wrong.length === 0) return { met: true, explanation: rule.pass };
  const notes = [
    ...missing.map((id) => rule.missing[id] ?? 'Something required is missing.'),
    ...wrong.map((id) => rule.wrong[id] ?? 'Something selected does not belong.'),
  ];
  return { met: false, explanation: notes.join(' ') };
}

export function scoreResponse(version: AssessmentVersion, response: AttemptResponse): CriterionResult[] {
  return version.criteria.map((c) => {
    const { met, explanation } = evaluate(c.rule, response);
    return { criterionId: c.id, label: c.label, met, explanation };
  });
}

function partAnswered(part: ExercisePart, response: AttemptResponse): boolean {
  const value = response[part.id];
  if (part.type === 'order') return Array.isArray(value) && value.length === part.items.length;
  if (part.type === 'pick-one') return typeof value === 'string' && value.length > 0;
  return Array.isArray(value) && value.length > 0;
}

/** Every part needs an answer before a response can be checked. */
export function unansweredParts(version: AssessmentVersion, response: AttemptResponse): ExercisePart[] {
  return version.parts.filter((p) => !partAnswered(p, response));
}

export function initialResponse(version: AssessmentVersion): AttemptResponse {
  const response: AttemptResponse = {};
  for (const part of version.parts) {
    if (part.type === 'order') response[part.id] = [...part.initialOrder];
    else if (part.type === 'pick-many') response[part.id] = [];
  }
  return response;
}
