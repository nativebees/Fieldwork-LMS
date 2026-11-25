/**
 * Fieldwork application schemas.
 *
 * These are app-owned types. They are NOT Anthropic API response schemas and no
 * field here should be read as coming directly from an Anthropic product. A later
 * customer-authorized adapter would normalize permitted observations into these
 * shapes (see src/providers/analytics.ts).
 */

export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string;

/* ------------------------------------------------------------------ */
/* Account, seller and evidence                                        */
/* ------------------------------------------------------------------ */

export type Department = 'Marketing' | 'Finance' | 'Revenue';
export type CapabilityState = 'available' | 'restricted';
export type Product = 'chat' | 'projects' | 'skills';

export interface ObservationWindow {
  start: ISODate;
  end: ISODate;
  timezone: 'UTC';
  snapshotDate: ISODate;
  days: number;
}

/** One synthetic member record for the observation window. */
export interface MemberRecord {
  id: string;
  department: Department;
  /** Days with at least one chat message in the window. */
  activeChatDays: number;
  /** null means the value is unavailable. It never means zero. */
  projectUse: boolean | null;
  /** null means the value is unavailable. It never means zero. */
  skillUse: boolean | null;
  capabilities: { projects: CapabilityState; skills: CapabilityState };
  telemetry: 'sufficient' | 'partial';
}

export interface SimulatedCrmContext {
  label: string;
  /** The synthetic "today" of the scenario. Never the real clock. */
  asOf: ISODate;
  /** Where this brief would surface in a seller's existing tools. */
  surface: string;
  /** The live deal, in a sentence. One of the three things guidance is tailored to. */
  dealSituation: string;
  dealLabel: string;
  stage: string;
  renewal: string;
  nextMeeting: { date: ISODate; title: string };
  lastCallNote: { date: ISODate; text: string };
}

export interface AccountContext {
  id: string;
  name: string;
  industry: string;
  plan: 'Enterprise';
  synthetic: true;
  mission: string;
  expansionCondition: string;
  sponsor: { name: string; title: string };
  approvalOwnerRole: string;
  recurringTask: string;
  crm: SimulatedCrmContext;
}

export type SellerProfileId = 'ae-new' | 'csm-experienced';

export interface SellerContext {
  id: SellerProfileId;
  role: string;
  shortRole: string;
  tenureLabel: string;
  tenureDays: number;
  needs: string[];
}

export type MissingState = 'complete' | 'partial' | 'unavailable';

/** A single measured statement. Keeps everything needed to read it honestly. */
export interface UsageObservation {
  id: string;
  cohortId: string;
  label: string;
  product: Product;
  /** null when the value cannot be read at all. */
  value: number | null;
  /** The population the value is counted within, after removing unavailable records. */
  denominator: number;
  denominatorLabel: string;
  window: ObservationWindow;
  sourceId: string;
  coverage: { withData: number; unavailable: number };
  missing: MissingState;
  missingReason?: string;
}

export interface Cohort {
  id: string;
  department: Department;
  label: string;
  assigned: number;
  active: number;
  /** Members who meet every eligibility rule for the reuse hypothesis. */
  eligibleMemberIds: string[];
  /** Members who look like the pattern but cannot be assessed (restricted or partial data). */
  blockedMemberIds: string[];
  segments: CohortSegment[];
}

export type SegmentKey = 'focus' | 'project' | 'skill' | 'other' | 'inactive' | 'unassessable';

export interface CohortSegment {
  key: SegmentKey;
  label: string;
  count: number;
}

export type HypothesisKind = 'investigate-repeatable-work' | 'resolve-access' | 'monitor';

export interface LearningNeedHypothesis {
  id: string;
  cohortId: string;
  department: Department;
  kind: HypothesisKind;
  priority: 1 | 2 | 3;
  title: string;
  /** The observed signal, in words, with its denominator. */
  signal: string;
  /** The interpretation. Always shown labeled as a hypothesis. */
  statement: string;
  reason: string;
  alternativeExplanation: string;
  missingContext: string;
  /** A default validation question. Seller-specific wording comes from the coaching provider. */
  validationQuestion: string;
  proposedArtifact: string;
  proposedIntervention: string;
  observationIds: string[];
  sourceIds: string[];
}

export interface AnalyticsSnapshot {
  providerId: string;
  providerLabel: string;
  synthetic: boolean;
  window: ObservationWindow;
  members: MemberRecord[];
}

export type SourceKind = 'official' | 'synthetic-sponsor' | 'synthetic-customer' | 'synthetic-analytics' | 'unreviewed-note';

export interface SourceReference {
  id: string;
  kind: SourceKind;
  title: string;
  publisher: string;
  url?: string;
  /** Original summary written for this prototype. Never a quotation. */
  summary: string;
  /** null means no review date is recorded, so the source must not be presented as authoritative. */
  checkedOn: ISODate | null;
  review: 'reviewed' | 'review-required';
  reviewNote?: string;
}

export type DecisionKind = 'accept' | 'adapt' | 'dismiss';

/** The seller's recorded call on a recommendation. */
export interface ReviewDecision {
  recommendationId: string;
  decision: DecisionKind;
  /** The intervention or reason chosen when adapting or dismissing. */
  choiceId: string | null;
  note: string;
  sellerProfileId: SellerProfileId;
  at: ISODateTime;
}

/* ------------------------------------------------------------------ */
/* Learning program                                                    */
/* ------------------------------------------------------------------ */

export type BlockKind = 'explanation' | 'worked-example' | 'guided-practice' | 'decision-check' | 'source-reference' | 'transfer-task';

export interface LessonBlock {
  id: string;
  kind: BlockKind;
  body: string;
}

export type AssessmentTemplateId =
  'context-pack' | 'workflow-sequence' | 'instruction-package' | 'claim-check' | 'approval-gate' | 'transfer-brief';

export interface AssessmentBinding {
  templateId: AssessmentTemplateId;
  version: number;
  /** 'custom-needs-review' means the typed rules must not be run or award criteria. */
  status: 'mapped' | 'custom-needs-review';
  /** Set when a person reviewed the mapping after a freeform edit. */
  reviewedAt?: ISODateTime;
}

export interface Lesson {
  id: string;
  templateId: string;
  title: string;
  objective: string;
  durationMin: number;
  blocks: LessonBlock[];
  /** Assessed requirement: what the learner must do. */
  practice: string;
  /** Assessed requirement: what shows it was done. */
  evidence: string;
  assessment: AssessmentBinding;
  sourceIds: string[];
  /** The last text the scoring mapping was aligned to. Used to detect freeform edits. */
  aligned: { objective: string; practice: string; evidence: string };
  objectiveReview: 'aligned' | 'needs-review';
  /** Set when a lesson was added or changed because of the customer's constraint. */
  revisedFor?: 'customer-constraint';
}

export interface ProgramModule {
  id: string;
  title: string;
  summary: string;
  lessonIds: string[];
}

export interface LearningProgram {
  id: string;
  title: string;
  audience: string;
  goal: string;
  reviewOwner: string;
  modules: ProgramModule[];
  lessons: Record<string, Lesson>;
}

export interface LessonTemplate {
  id: string;
  title: string;
  summary: string;
  leadKind: BlockKind;
  objective: string;
  durationMin: number;
  blocks: Array<Omit<LessonBlock, 'id'>>;
  practice: string;
  evidence: string;
  assessment: { templateId: AssessmentTemplateId; version: number };
  sourceIds: string[];
}

/* ------------------------------------------------------------------ */
/* Typed assessments                                                   */
/* ------------------------------------------------------------------ */

export interface ExerciseOption {
  id: string;
  label: string;
}

export type ExercisePart =
  | { id: string; type: 'order'; prompt: string; items: ExerciseOption[]; initialOrder: string[] }
  | { id: string; type: 'pick-one'; prompt: string; options: ExerciseOption[] }
  | { id: string; type: 'pick-many'; prompt: string; options: ExerciseOption[] };

/** Versioned, declarative scoring rules. Evaluated by src/rules/scoring.ts. */
export type CriterionRule =
  | {
      type: 'sequence';
      partId: string;
      /** Item ids that must appear in this relative order. */
      order: string[];
      pass: string;
      fail: string;
    }
  | {
      type: 'choice';
      partId: string;
      correct: string;
      pass: string;
      explain: Record<string, string>;
    }
  | {
      type: 'set';
      partId: string;
      required: string[];
      forbidden: string[];
      pass: string;
      missing: Record<string, string>;
      wrong: Record<string, string>;
    };

export interface Criterion {
  id: string;
  label: string;
  rule: CriterionRule;
  /** A nudge shown after a miss. It points at the reasoning without giving the answer. */
  hint: string;
}

export interface ExerciseScenario {
  title: string;
  note: string;
  draft?: string[];
  sources?: string[];
}

export interface AssessmentVersion {
  templateId: AssessmentTemplateId;
  version: number;
  /** Stable identifier for the rule set, for example "claim-check@1". */
  rulesId: string;
  title: string;
  scenario?: ExerciseScenario;
  parts: ExercisePart[];
  criteria: Criterion[];
}

export type AttemptResponse = Record<string, string | string[]>;

export interface CriterionResult {
  criterionId: string;
  label: string;
  met: boolean;
  explanation: string;
}

export interface PracticeAttempt {
  id: string;
  lessonId: string;
  lessonTitle: string;
  /** The rule set this attempt was scored against. null for unscored practice. */
  rulesId: string | null;
  scored: boolean;
  response: AttemptResponse;
  results: CriterionResult[];
  n: number;
  at: ISODateTime;
}

/* ------------------------------------------------------------------ */
/* Seller rehearsal                                                    */
/* ------------------------------------------------------------------ */

export type RehearsalStepId = 'opening' | 'firstQuestion' | 'followUp' | 'intervention' | 'measurement';

export type RehearsalFlag = 'expansion-promise' | 'removes-approval';

export interface RehearsalOption {
  id: string;
  /** What the seller says. */
  text: string;
  /** Short description used when feedback cites the choice. */
  short: string;
  points: 0 | 1 | 2 | Record<SellerProfileId, 0 | 1 | 2>;
  /** The sponsor's reply. */
  reply: string;
  why: string;
  profileNote?: Partial<Record<SellerProfileId, string>>;
  /** If set, the option is only offered to these profiles. */
  onlyFor?: SellerProfileId[];
  flags?: RehearsalFlag[];
}

export interface RehearsalStep {
  id: RehearsalStepId;
  turn: 1 | 2;
  phase: 'initial' | 'revised';
  heading: string;
  prompt: string;
  criterionId: SellerCriterionId;
  options: RehearsalOption[];
}

export interface RehearsalState {
  choices: Record<RehearsalStepId, string | null>;
  reflection: string;
}

export type SellerCriterionId =
  'observation-vs-assumption' | 'diagnostic-question' | 'intervention-fit' | 'accuracy-and-approval' | 'next-measurement';

export interface SellerCriterionResult {
  id: SellerCriterionId;
  label: string;
  points: 0 | 1 | 2;
  max: 2;
  status: 'not-yet' | 'scored';
  /** Sentences citing the selected choices and actual program state. */
  evidence: string[];
}

/* ------------------------------------------------------------------ */
/* Revision, proposals and state                                       */
/* ------------------------------------------------------------------ */

export type SuggestionId = 's-claims' | 's-workflow' | 's-transfer' | 's-goal';
export type SuggestionStatus = 'applied' | 'pending' | 'dismissed' | 'not-applicable';

export interface ConstraintSuggestion {
  id: SuggestionId;
  title: string;
  why: string;
  status: SuggestionStatus;
  lessonIds: string[];
}

export interface RevisionEntry {
  id: string;
  at: ISODateTime;
  kind: 'constraint' | 'tailoring' | 'review';
  summary: string;
  reason: string;
  lessonIds: string[];
  suggestionId?: SuggestionId;
}

/** A previewed change. Nothing is applied until the author accepts it. */
export interface Proposal {
  id: string;
  kind: 'constraint' | 'tailoring';
  title: string;
  reason: string;
  nextProgram: LearningProgram;
  idsUsed: number;
  lessonIds: string[];
  suggestionId?: SuggestionId;
  selectLessonId?: string;
  /** One log entry per distinct reason, so each change can be traced to why it was made. */
  logEntries?: Array<{ summary: string; reason: string; lessonIds: string[]; suggestionId?: SuggestionId }>;
}

export interface FieldChange {
  field: string;
  before: string;
  after: string;
}

export type ProgramChange =
  | { type: 'meta'; field: string; before: string; after: string }
  | { type: 'lesson-added'; lessonId: string; title: string; where: string }
  | { type: 'lesson-removed'; lessonId: string; title: string; where: string }
  | { type: 'lesson-replaced'; lessonId: string; removedId: string; before: string; after: string; where: string }
  | { type: 'lesson-moved'; lessonId: string; title: string; from: string; to: string }
  | { type: 'lesson-edited'; lessonId: string; title: string; fields: FieldChange[] }
  | {
      type: 'assessment-changed';
      lessonId: string;
      title: string;
      before: string;
      after: string;
      criteriaAdded: string[];
      criteriaRemoved: string[];
    };

export interface PrototypeEvent {
  id: string;
  at: ISODateTime;
  type: string;
  detail?: string;
}

export interface RemovedLesson {
  lesson: Lesson;
  moduleId: string;
  index: number;
}

export const STATE_VERSION = 1;

export interface AppState {
  version: typeof STATE_VERSION;
  sellerProfileId: SellerProfileId;
  decisions: Record<string, ReviewDecision>;
  rehearsal: RehearsalState;
  /** Set once, the first time the sponsor reveals the constraint. */
  constraint: { revealedAt: ISODateTime } | null;
  program: LearningProgram;
  /** Snapshot of the program at the moment the constraint was revealed. */
  programAtReveal: LearningProgram | null;
  dismissedSuggestions: SuggestionId[];
  revisionLog: RevisionEntry[];
  attempts: PracticeAttempt[];
  events: PrototypeEvent[];
  selectedLessonId: string | null;
  lastRemoved: RemovedLesson | null;
  /** Monotonic counter for stable ids. */
  counter: number;
}
