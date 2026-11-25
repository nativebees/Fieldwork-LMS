import { REHEARSAL_STEP_ORDER } from '../fixtures/rehearsal';
import { chosenOption } from '../rules/sellerRubric';
import type {
  AccountContext,
  CriterionResult,
  HypothesisKind,
  LearningNeedHypothesis,
  RehearsalState,
  RehearsalStepId,
  SellerContext,
  SellerProfileId,
} from '../types';

/**
 * Coaching boundary.
 *
 * "Built with Claude Code" and "calls Claude at runtime" are different claims.
 * This app makes no model call. ScenarioCoachingProvider is the only working
 * provider: transparent, reproducible and dependent on context.
 *
 * LiveClaudeCoachingProvider marks where a genuine call would go. It reports
 * itself unavailable and rejects every request, so nothing can be shown under a
 * "live" label by accident.
 */

export type PipState = 'ready' | 'considering' | 'nudge' | 'done';

export interface PipMessage {
  pip: PipState;
  message: string;
}

export interface GuidanceRequest {
  seller: SellerContext;
  account: AccountContext;
  hypothesis: LearningNeedHypothesis;
}

export interface Guidance {
  providerId: string;
  /** The one decision to make next. Changes with the seller's context. */
  nextDecision: string;
  objective: string;
  question: string;
  successCriteria: string[];
  watchOut: string;
  /** Advice that leans on a source. The UI attaches the source's review state. */
  sourcedAdvice: Array<{ text: string; sourceId: string }>;
}

export interface RehearsalReviewRequest {
  seller: SellerContext;
  rehearsal: RehearsalState;
}

export type RehearsalReview = Partial<Record<RehearsalStepId, { feedback: string; profileNote?: string; reply: string }>>;

export interface AttemptCoachingRequest {
  attemptNumber: number;
  results: CriterionResult[];
  hints: Record<string, string>;
}

export interface ProviderAvailability {
  available: boolean;
  reason: string;
}

export interface CoachingProvider {
  readonly id: string;
  readonly label: string;
  readonly mode: 'scenario' | 'live';
  availability(): ProviderAvailability;
  getGuidance(request: GuidanceRequest): Promise<Guidance>;
  explainHypothesis(request: GuidanceRequest): Promise<PipMessage>;
  reviewRehearsal(request: RehearsalReviewRequest): Promise<RehearsalReview>;
  coachAttempt(request: AttemptCoachingRequest): Promise<PipMessage>;
}

/* ------------------------------------------------------------------ */
/* Scenario provider                                                   */
/* ------------------------------------------------------------------ */

type GuidanceBody = Omit<Guidance, 'providerId'>;
type GuidanceBuilder = (r: GuidanceRequest) => GuidanceBody;

const GUIDANCE: Record<HypothesisKind, Record<SellerProfileId, GuidanceBuilder>> = {
  'investigate-repeatable-work': {
    'ae-new': ({ account }) => ({
      nextDecision: `Decide what to ask ${account.sponsor.name.split(' ')[0]} before you propose anything.`,
      objective: `Read the signal before you sell to it. Leave the review knowing how ${account.recurringTask} actually get made.`,
      question:
        'Can you walk me through the last campaign brief the team produced, from first draft to sign-off? Where did it slow down or get sent back?',
      successCriteria: [
        'You state the observation with its denominator and its dates.',
        'You ask about the work before you name a fix.',
        'You leave without attaching a seat number to the conversation.',
      ],
      watchOut: 'An active-seat percentage describes activity. It does not support an expansion promise.',
      sourcedAdvice: [
        { text: 'The sponsor wants to see value before any conversation about seats.', sourceId: 'src-sponsor-note' },
        { text: 'Packaged workflows may get reused more once they exist. Treat this as a question to ask.', sourceId: 'src-field-note' },
      ],
    }),
    'csm-experienced': ({ account }) => ({
      nextDecision: `Decide which single intervention to pilot, and how you and ${account.sponsor.name.split(' ')[0]} will judge it.`,
      objective: 'Pick the one intervention worth a pilot, and agree the pass mark with your sponsor before it starts.',
      question:
        'If we ran a four-week pilot with one campaign team, what would you need to see in the briefs themselves to call it worth continuing, and who would judge that?',
      successCriteria: [
        'One cohort and one workflow are chosen, with a reason you can say in a sentence.',
        'Pilot criteria are agreed before launch: the measure, the baseline and the review dates.',
        'The sponsor owns the threshold, and a named person reviews the result.',
      ],
      watchOut: 'Three programs at once means you will not know which one helped.',
      sourcedAdvice: [
        { text: 'The sponsor wants to see value before any conversation about seats.', sourceId: 'src-sponsor-note' },
        {
          text: 'Packaged workflows may get reused more once they exist. Treat this as a pilot assumption to test.',
          sourceId: 'src-field-note',
        },
      ],
    }),
  },
  'resolve-access': {
    'ae-new': ({ hypothesis }) => ({
      nextDecision: `Decide whether to raise the ${hypothesis.department} restriction now or leave ${hypothesis.department} out of this review.`,
      objective: 'Treat a missing value as missing. Find out why the capability is off before saying anything about how this team works.',
      question: `I see Skills are not enabled for ${hypothesis.department}. Was that a deliberate choice, and who owns it?`,
      successCriteria: [
        'You describe the value as unavailable, never as zero.',
        'You ask who owns the restriction.',
        'You propose no training for this group until access is clear.',
      ],
      watchOut: 'Part of this group looks like the Marketing pattern. It is not comparable, because one of the two signals cannot be read.',
      sourcedAdvice: [
        {
          text: 'Analytics access is created by the customer’s primary owner. You only see what the customer chooses to share.',
          sourceId: 'src-analytics-api',
        },
      ],
    }),
    'csm-experienced': ({ hypothesis }) => ({
      nextDecision: `Decide who on the customer side can confirm the ${hypothesis.department} Skills policy before your next plan review.`,
      objective: `Resolve the access question through the right owner, then learn what ${hypothesis.department}’s recurring work is.`,
      question: `Before we plan anything for ${hypothesis.department}: is the Skills restriction a standing policy, or is it under review? I would rather work with your admin than around it.`,
      successCriteria: [
        'The policy owner is identified.',
        `${hypothesis.department} stays out of any adoption comparison until the signal can be read.`,
        'A context-gathering step is agreed in place of training.',
      ],
      watchOut: 'You know the account well enough to guess the reason. Confirm it anyway.',
      sourcedAdvice: [
        {
          text: 'Analytics access is created by the customer’s primary owner. You only see what the customer chooses to share.',
          sourceId: 'src-analytics-api',
        },
      ],
    }),
  },
  monitor: {
    'ae-new': ({ hypothesis }) => ({
      nextDecision: `Decide whether ${hypothesis.department} belongs in this conversation at all.`,
      objective: 'Keep the review focused. A healthy-looking team is a reason to ask what works, and nothing more yet.',
      question: `What are the two or three things ${hypothesis.department} has set up in Claude that they would not want to lose?`,
      successCriteria: [
        `You do not present ${hypothesis.department} as proof of value.`,
        'You ask what the Projects and Skills are used for.',
      ],
      watchOut: 'Feature use is not the same as useful work. Do not turn this into a reference story without asking.',
      sourcedAdvice: [],
    }),
    'csm-experienced': ({ hypothesis }) => ({
      nextDecision: `Decide whether to line up ${hypothesis.department} as a source of peer examples for after the first pilot.`,
      objective: `Sequence the work. ${hypothesis.department} can wait until the pilot has a result to compare against.`,
      question: `Once the first pilot has a result, would someone in ${hypothesis.department} be willing to show how they set up their shared work?`,
      successCriteria: [
        `${hypothesis.department} is parked with a reason and a date.`,
        'Any peer example is shared with the team’s permission.',
      ],
      watchOut: 'Starting a second workstream now splits the sponsor’s attention.',
      sourcedAdvice: [],
    }),
  },
};

const PIP_EXPLANATION: Record<HypothesisKind, PipMessage> = {
  'investigate-repeatable-work': {
    pip: 'considering',
    message:
      'This is a pattern worth a question. It does not tell you what anyone knows or can do. Ask how the briefs get made before you suggest a fix.',
  },
  'resolve-access': {
    pip: 'nudge',
    message: 'This could be an access issue. Check the permission before assigning training.',
  },
  monitor: {
    pip: 'ready',
    message: 'Nothing here asks for action. Spend the time on the question for the priority cohort.',
  },
};

export class ScenarioCoachingProvider implements CoachingProvider {
  readonly id = 'scenario';
  readonly label = 'Scenario coaching';
  readonly mode = 'scenario' as const;

  availability(): ProviderAvailability {
    return { available: true, reason: 'Scripted, deterministic guidance bundled with the app.' };
  }

  getGuidance(request: GuidanceRequest): Promise<Guidance> {
    const build = GUIDANCE[request.hypothesis.kind][request.seller.id];
    return Promise.resolve({ providerId: this.id, ...build(request) });
  }

  explainHypothesis(request: GuidanceRequest): Promise<PipMessage> {
    return Promise.resolve(PIP_EXPLANATION[request.hypothesis.kind]);
  }

  reviewRehearsal({ seller, rehearsal }: RehearsalReviewRequest): Promise<RehearsalReview> {
    const review: RehearsalReview = {};
    for (const stepId of REHEARSAL_STEP_ORDER) {
      const option = chosenOption(rehearsal, stepId, seller.id);
      if (!option) continue;
      review[stepId] = { feedback: option.why, profileNote: option.profileNote?.[seller.id], reply: option.reply };
    }
    return Promise.resolve(review);
  }

  coachAttempt({ attemptNumber, results, hints }: AttemptCoachingRequest): Promise<PipMessage> {
    const missed = results.filter((r) => !r.met);
    if (missed.length === 0) {
      const total = results.length;
      return Promise.resolve({
        pip: 'done',
        message:
          `${total === 1 ? 'The criterion is' : `All ${total} criteria are`} met on attempt ${attemptNumber}.` +
          (attemptNumber > 1 ? ' Your earlier attempts stay on the record.' : ''),
      });
    }
    const first = missed[0];
    const hint = hints[first.criterionId] ?? 'Read the explanation under the criterion, then try again.';
    return Promise.resolve({
      pip: 'nudge',
      message: `${missed.length} of ${results.length} not met yet. Start with “${first.label}”. ${hint}`,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Live provider boundary (not implemented)                            */
/* ------------------------------------------------------------------ */

export class LiveCoachingUnavailableError extends Error {
  constructor() {
    super('Live Claude coaching is not configured in this build.');
    this.name = 'LiveCoachingUnavailableError';
  }
}

/**
 * Placeholder for a genuine Claude call. A real implementation would POST to a
 * server-side route that holds the credential. See docs/LIVE_COACHING.md.
 */
export class LiveClaudeCoachingProvider implements CoachingProvider {
  readonly id = 'claude-live';
  readonly label = 'Live Claude coaching';
  readonly mode = 'live' as const;

  availability(): ProviderAvailability {
    return {
      available: false,
      reason: 'No server route or credential is configured. Live coaching is off, and nothing is simulated in its place.',
    };
  }

  getGuidance(): Promise<Guidance> {
    return Promise.reject(new LiveCoachingUnavailableError());
  }
  explainHypothesis(): Promise<PipMessage> {
    return Promise.reject(new LiveCoachingUnavailableError());
  }
  reviewRehearsal(): Promise<RehearsalReview> {
    return Promise.reject(new LiveCoachingUnavailableError());
  }
  coachAttempt(): Promise<PipMessage> {
    return Promise.reject(new LiveCoachingUnavailableError());
  }
}

/** The contract a future live response must satisfy before anything is shown. */
export interface LiveCoachingResponse {
  feedback: Array<{ criterionId: string; evidence: string; sourceIds: string[] }>;
  uncertainty: string;
  suggestedNextTask: string;
}

/**
 * Validate a live response against the rubric and source pack that were sent.
 * Unknown criterion ids or source ids fail validation. Nothing is repaired.
 */
export function validateLiveCoachingResponse(
  response: unknown,
  allowed: { criterionIds: string[]; sourceIds: string[] },
): { ok: true; value: LiveCoachingResponse } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const r = response as Partial<LiveCoachingResponse> | null;
  if (!r || typeof r !== 'object') return { ok: false, errors: ['Response is not an object.'] };
  if (typeof r.uncertainty !== 'string') errors.push('Missing uncertainty statement.');
  if (typeof r.suggestedNextTask !== 'string') errors.push('Missing suggested next task.');
  if (!Array.isArray(r.feedback)) errors.push('Missing feedback list.');
  else {
    r.feedback.forEach((f, i) => {
      if (!f || typeof f.criterionId !== 'string' || !allowed.criterionIds.includes(f.criterionId)) {
        errors.push(`Feedback ${i + 1} cites a criterion that was not in the rubric.`);
      }
      if (!f || typeof f.evidence !== 'string' || f.evidence.trim() === '') errors.push(`Feedback ${i + 1} has no evidence.`);
      if (!f || !Array.isArray(f.sourceIds)) errors.push(`Feedback ${i + 1} has no source list.`);
      else {
        for (const id of f.sourceIds) {
          if (!allowed.sourceIds.includes(id)) errors.push(`Feedback ${i + 1} cites a source that was not provided: ${String(id)}.`);
        }
      }
    });
  }
  return errors.length === 0 ? { ok: true, value: r as LiveCoachingResponse } : { ok: false, errors };
}

export const scenarioCoaching = new ScenarioCoachingProvider();
export const liveCoaching = new LiveClaudeCoachingProvider();

/** The provider the app actually uses. Live is never selected while it is unavailable. */
export function activeCoachingProvider(): CoachingProvider {
  return liveCoaching.availability().available ? liveCoaching : scenarioCoaching;
}
