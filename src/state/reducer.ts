import { DEFAULT_SELLER_PROFILE } from '../fixtures/account';
import { getAssessment, rulesIdOf } from '../fixtures/assessments';
import { INITIAL_COUNTER, createDefaultProgram } from '../fixtures/lessons';
import {
  addBlock,
  addLessonFromTemplate,
  duplicateLesson,
  markObjectiveAligned,
  moveLessonByStep,
  removeBlock,
  removeLesson,
  reorderFlat,
  resolveAssessmentReview,
  restoreLesson,
  updateBlock,
  updateLesson,
  type LessonPatch,
} from '../rules/program';
import { scoreResponse } from '../rules/scoring';
import { chosenOption, emptyRehearsal } from '../rules/sellerRubric';
import {
  STATE_VERSION,
  type AppState,
  type AttemptResponse,
  type BlockKind,
  type DecisionKind,
  type LearningProgram,
  type Proposal,
  type RehearsalStepId,
  type SellerProfileId,
  type SuggestionId,
} from '../types';

/**
 * One reducer, one source of truth. The seller studio, the customer preview, the
 * review and both exports all read this state. The reducer is pure: time is passed
 * in, and ids come from a counter held in state.
 */

export type Action =
  | { type: 'profile/set'; profileId: SellerProfileId }
  | { type: 'decision/record'; recommendationId: string; decision: DecisionKind; choiceId: string | null; note: string }
  | { type: 'decision/clear'; recommendationId: string }
  | { type: 'rehearsal/choose'; stepId: RehearsalStepId; optionId: string }
  | { type: 'rehearsal/reflection'; text: string }
  | { type: 'rehearsal/restart' }
  | { type: 'program/add'; templateId: string; moduleId: string; index: number }
  | { type: 'program/reorder'; flat: string[] }
  | { type: 'program/step'; lessonId: string; direction: -1 | 1 }
  | { type: 'program/remove'; lessonId: string }
  | { type: 'program/undoRemove' }
  | { type: 'program/dismissUndo' }
  | { type: 'program/duplicate'; lessonId: string }
  | { type: 'program/updateLesson'; lessonId: string; patch: LessonPatch }
  | { type: 'program/updateBlock'; lessonId: string; blockId: string; body: string }
  | { type: 'program/addBlock'; lessonId: string; kind: BlockKind }
  | { type: 'program/removeBlock'; lessonId: string; blockId: string }
  | { type: 'program/updateMeta'; patch: Partial<Pick<LearningProgram, 'title' | 'audience' | 'goal' | 'reviewOwner'>> }
  | { type: 'program/applyProposal'; proposal: Proposal }
  | { type: 'assessment/resolve'; lessonId: string; mode: 'restore' | 'confirm' }
  | { type: 'objective/aligned'; lessonId: string }
  | { type: 'suggestion/dismiss'; id: SuggestionId }
  | { type: 'suggestion/restore'; id: SuggestionId }
  | { type: 'attempt/record'; lessonId: string; response: AttemptResponse }
  | { type: 'attempt/unscored'; lessonId: string }
  | { type: 'ui/select'; lessonId: string | null }
  | { type: 'program/reset' }
  | { type: 'state/reset' };

/** The recommendation whose decision is the seller's initial recommendation. */
export const PRIMARY_RECOMMENDATION_ID = 'hyp-marketing';

const MAX_EVENTS = 150;

export function createInitialState(): AppState {
  return {
    version: STATE_VERSION,
    sellerProfileId: DEFAULT_SELLER_PROFILE,
    decisions: {},
    rehearsal: emptyRehearsal(),
    constraint: null,
    program: createDefaultProgram(),
    programAtReveal: null,
    dismissedSuggestions: [],
    revisionLog: [],
    attempts: [],
    events: [],
    selectedLessonId: null,
    lastRemoved: null,
    counter: INITIAL_COUNTER,
  };
}

function logEvent(state: AppState, at: string, type: string, detail?: string): AppState {
  const events = [...state.events, { id: `evt-${state.counter}`, at, type, detail }].slice(-MAX_EVENTS);
  return { ...state, events, counter: state.counter + 1 };
}

/** Keep the selection valid after any program change. */
function withProgram(state: AppState, program: LearningProgram): AppState {
  const selectedLessonId = state.selectedLessonId && program.lessons[state.selectedLessonId] ? state.selectedLessonId : null;
  return { ...state, program, selectedLessonId };
}

export function reducer(state: AppState, action: Action, at: string): AppState {
  switch (action.type) {
    case 'profile/set': {
      if (action.profileId === state.sellerProfileId) return state;
      return logEvent({ ...state, sellerProfileId: action.profileId }, at, 'seller-profile-changed', action.profileId);
    }

    case 'decision/record': {
      // The initial recommendation locks once the customer shares the constraint,
      // so the before and after comparison stays honest.
      if (action.recommendationId === PRIMARY_RECOMMENDATION_ID && state.constraint) return state;
      const decisions = {
        ...state.decisions,
        [action.recommendationId]: {
          recommendationId: action.recommendationId,
          decision: action.decision,
          choiceId: action.choiceId,
          note: action.note,
          sellerProfileId: state.sellerProfileId,
          at,
        },
      };
      return logEvent({ ...state, decisions }, at, 'recommendation-decision', `${action.recommendationId}:${action.decision}`);
    }

    case 'decision/clear': {
      if (action.recommendationId === PRIMARY_RECOMMENDATION_ID && state.constraint) return state;
      if (!state.decisions[action.recommendationId]) return state;
      const decisions = { ...state.decisions };
      delete decisions[action.recommendationId];
      return { ...state, decisions };
    }

    case 'rehearsal/choose': {
      // A recorded choice stands until the rehearsal is restarted.
      if (chosenOption(state.rehearsal, action.stepId, state.sellerProfileId)) return state;
      const rehearsal = { ...state.rehearsal, choices: { ...state.rehearsal.choices, [action.stepId]: action.optionId } };
      let next: AppState = { ...state, rehearsal };
      if (action.stepId === 'firstQuestion' && !state.constraint) {
        next = { ...next, constraint: { revealedAt: at }, programAtReveal: state.program };
        next = logEvent(next, at, 'customer-constraint-revealed');
      }
      return logEvent(next, at, 'rehearsal-choice', `${action.stepId}:${action.optionId}`);
    }

    case 'rehearsal/reflection':
      return { ...state, rehearsal: { ...state.rehearsal, reflection: action.text } };

    case 'rehearsal/restart':
      return logEvent({ ...state, rehearsal: { ...emptyRehearsal(), reflection: state.rehearsal.reflection } }, at, 'rehearsal-restarted');

    case 'program/add': {
      const lessonId = `lesson-${state.counter}`;
      const program = addLessonFromTemplate(state.program, action.templateId, action.moduleId, action.index, lessonId);
      if (program === state.program) return state;
      const next = { ...withProgram(state, program), selectedLessonId: lessonId, lastRemoved: null, counter: state.counter + 1 };
      return logEvent(next, at, 'lesson-added', `${lessonId}:${action.templateId}`);
    }

    case 'program/reorder': {
      const program = reorderFlat(state.program, action.flat);
      if (program === state.program) return state;
      return logEvent(withProgram(state, program), at, 'lesson-reordered');
    }

    case 'program/step': {
      const program = moveLessonByStep(state.program, action.lessonId, action.direction);
      if (program === state.program) return state;
      return logEvent(withProgram(state, program), at, 'lesson-reordered', action.lessonId);
    }

    case 'program/remove': {
      const result = removeLesson(state.program, action.lessonId);
      if (!result) return state;
      return logEvent({ ...withProgram(state, result.program), lastRemoved: result.removed }, at, 'lesson-removed', action.lessonId);
    }

    case 'program/undoRemove': {
      if (!state.lastRemoved) return state;
      const program = restoreLesson(state.program, state.lastRemoved);
      const next = { ...withProgram(state, program), selectedLessonId: state.lastRemoved.lesson.id, lastRemoved: null };
      return logEvent(next, at, 'lesson-restored', state.lastRemoved.lesson.id);
    }

    case 'program/dismissUndo':
      return state.lastRemoved ? { ...state, lastRemoved: null } : state;

    case 'program/duplicate': {
      const newId = `lesson-${state.counter}`;
      const program = duplicateLesson(state.program, action.lessonId, newId);
      if (program === state.program) return state;
      const next = { ...withProgram(state, program), selectedLessonId: newId, counter: state.counter + 1 };
      return logEvent(next, at, 'lesson-duplicated', `${action.lessonId}->${newId}`);
    }

    case 'program/updateLesson':
      return withProgram(state, updateLesson(state.program, action.lessonId, action.patch));

    case 'program/updateBlock':
      return withProgram(state, updateBlock(state.program, action.lessonId, action.blockId, action.body));

    case 'program/addBlock': {
      const blockId = `${action.lessonId}-b${state.counter}`;
      const program = addBlock(state.program, action.lessonId, action.kind, blockId);
      return { ...withProgram(state, program), counter: state.counter + 1 };
    }

    case 'program/removeBlock':
      return withProgram(state, removeBlock(state.program, action.lessonId, action.blockId));

    case 'program/updateMeta':
      return withProgram(state, { ...state.program, ...action.patch });

    case 'program/applyProposal': {
      const { proposal } = action;
      const program = proposal.nextProgram;
      const selected =
        proposal.selectLessonId && program.lessons[proposal.selectLessonId]
          ? proposal.selectLessonId
          : state.selectedLessonId && program.lessons[state.selectedLessonId]
            ? state.selectedLessonId
            : null;
      const entries = proposal.logEntries ?? [
        { summary: proposal.title, reason: proposal.reason, lessonIds: proposal.lessonIds, suggestionId: proposal.suggestionId },
      ];
      const firstId = state.counter + proposal.idsUsed;
      const next: AppState = {
        ...state,
        program,
        selectedLessonId: selected,
        lastRemoved: null,
        counter: firstId + entries.length,
        revisionLog: [
          ...state.revisionLog,
          ...entries.map((entry, i) => ({ id: `rev-${firstId + i}`, at, kind: proposal.kind, ...entry })),
        ],
      };
      return logEvent(next, at, 'proposal-accepted', proposal.id);
    }

    case 'assessment/resolve': {
      const lesson = state.program.lessons[action.lessonId];
      if (!lesson || lesson.assessment.status !== 'custom-needs-review') return state;
      const resolved = resolveAssessmentReview(lesson, action.mode, at);
      const program = { ...state.program, lessons: { ...state.program.lessons, [lesson.id]: resolved } };
      const next: AppState = {
        ...state,
        program,
        counter: state.counter + 1,
        revisionLog: [
          ...state.revisionLog,
          {
            id: `rev-${state.counter}`,
            at,
            kind: 'review',
            summary: `Scoring mapping reviewed for “${lesson.title}”`,
            reason:
              action.mode === 'confirm'
                ? 'The author confirmed that the typed exercise still assesses the edited requirement.'
                : 'The author restored the requirement text the scoring rules were written for.',
            lessonIds: [lesson.id],
          },
        ],
      };
      return logEvent(next, at, 'assessment-review-resolved', `${lesson.id}:${action.mode}`);
    }

    case 'objective/aligned': {
      const lesson = state.program.lessons[action.lessonId];
      if (!lesson || lesson.objectiveReview === 'aligned') return state;
      const program = { ...state.program, lessons: { ...state.program.lessons, [lesson.id]: markObjectiveAligned(lesson) } };
      return logEvent({ ...state, program }, at, 'objective-alignment-confirmed', lesson.id);
    }

    case 'suggestion/dismiss':
      return state.dismissedSuggestions.includes(action.id)
        ? state
        : logEvent({ ...state, dismissedSuggestions: [...state.dismissedSuggestions, action.id] }, at, 'suggestion-dismissed', action.id);

    case 'suggestion/restore':
      return { ...state, dismissedSuggestions: state.dismissedSuggestions.filter((id) => id !== action.id) };

    case 'attempt/record': {
      const lesson = state.program.lessons[action.lessonId];
      // Typed rules only run against a mapped assessment. Never against custom content.
      if (!lesson || lesson.assessment.status !== 'mapped') return state;
      const version = getAssessment(lesson.assessment);
      const n = state.attempts.filter((a) => a.lessonId === lesson.id).length + 1;
      const attempt = {
        id: `attempt-${state.counter}`,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        rulesId: rulesIdOf(lesson.assessment),
        scored: true,
        response: action.response,
        results: scoreResponse(version, action.response),
        n,
        at,
      };
      const next = { ...state, attempts: [...state.attempts, attempt], counter: state.counter + 1 };
      return logEvent(next, at, 'practice-attempt', `${lesson.id}:${attempt.rulesId}`);
    }

    case 'attempt/unscored': {
      const lesson = state.program.lessons[action.lessonId];
      if (!lesson) return state;
      const n = state.attempts.filter((a) => a.lessonId === lesson.id).length + 1;
      const attempt = {
        id: `attempt-${state.counter}`,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        rulesId: null,
        scored: false,
        response: {},
        results: [],
        n,
        at,
      };
      const next = { ...state, attempts: [...state.attempts, attempt], counter: state.counter + 1 };
      return logEvent(next, at, 'practice-attempt-unscored', lesson.id);
    }

    case 'ui/select':
      if (action.lessonId !== null && !state.program.lessons[action.lessonId]) return state;
      return action.lessonId === state.selectedLessonId ? state : { ...state, selectedLessonId: action.lessonId };

    case 'program/reset': {
      // Back to the starting program. Rehearsal choices, decisions and attempts are kept.
      const next: AppState = {
        ...state,
        program: createDefaultProgram(),
        selectedLessonId: null,
        lastRemoved: null,
        dismissedSuggestions: [],
        revisionLog: [],
      };
      return logEvent(next, at, 'program-reset');
    }

    case 'state/reset':
      return createInitialState();
  }
}
