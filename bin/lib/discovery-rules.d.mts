/**
 * Type declarations for the CodeOps Discovery rules and model helper.
 *
 * The helper is plain JavaScript so the browser bundle and `node --test` can
 * import the same file. These declarations give the TypeScript plugin entry
 * point and the UI build typed access to it.
 */

/** Schema version written into every Discovery data file. */
export declare const DISCOVERY_SCHEMA_VERSION: 1

/** A question type. */
export type QuestionType = "single" | "multiple" | "text" | "single-other"

/** Every supported question type. */
export declare const QUESTION_TYPES: readonly QuestionType[]

/** Question types that carry options. */
export declare const CHOICE_TYPES: readonly QuestionType[]

/** A plan kind. */
export type PlanKind = "plan" | "requirements" | "preflight"

/** Every supported plan kind. */
export declare const PLAN_KINDS: readonly PlanKind[]

/** Pattern for question keys, group keys, and option ids. */
export declare const KEY_PATTERN: RegExp

/** Pattern for URL and file-name slugs. */
export declare const SLUG_PATTERN: RegExp

/** Maximum length of a title, group title, or option label. */
export declare const TITLE_MAX: 200

/** Maximum length of every other free-text value. */
export declare const TEXT_MAX: 4000

/** Maximum length of an artifact path. */
export declare const ARTIFACT_MAX: 300

/** Structural caps for one publish. */
export declare const LIMITS: {
  readonly groups: 50
  readonly questions: 200
  readonly optionsMin: 2
  readonly optionsMax: 20
  readonly evidence: 20
}

/** Question fields covered by the fingerprint. */
export declare const FINGERPRINT_FIELDS: readonly string[]

/** A stored answer; exactly one field is set. */
export interface Answer {
  choice?: string
  choices?: string[]
  text?: string
  other?: string
}

/** A deferral recorded by the user. */
export interface Defer {
  decision: string
  owner: string
  revisit: string
}

/** A compact answer: an option id, option ids, or text. */
export type CompactAnswer = string | string[]

/** An implication attached to one option. */
export interface Implication {
  question: string
  answer: CompactAnswer
  reason: string
}

/** One question option. */
export interface QuestionOption {
  id: string
  label: string
  description?: string
  implies?: Implication[]
}

/** One visibility condition. */
export interface ShowIfCondition {
  question: string
  anyOf: string[]
}

/** An agent-proposed settlement. */
export interface Proposal {
  answer: CompactAnswer
  reason: string
}

/** One normalized published question. */
export interface Question {
  key: string
  group: string
  type: QuestionType
  title: string
  why?: string
  evidence?: string[]
  options?: QuestionOption[]
  recommendation?: string | string[]
  showIf?: ShowIfCondition[]
  proposal?: Proposal
}

/** One normalized published group. */
export interface Group {
  key: string
  title: string
  description?: string
  dependsOn: string[]
}

/** A normalized published plan. */
export interface PublishedPlan {
  artifact: string
  kind: PlanKind
  title: string
  groups: Group[]
  questions: Question[]
}

/** The stored lifecycle of one question. */
export type QuestionStatus = "open" | "submitted" | "recorded" | "retired"

/** The mutable state of one question. */
export interface QuestionState {
  answer: Answer | null
  notes: string
  defer: Defer | null
  needsDiscussion: boolean
  proposalDismissed: boolean
  status: QuestionStatus
  changed: boolean
  revisedAt: number
  recordedAs: string | null
}

/** The mutable state of one plan. */
export interface PlanState {
  questions: Record<string, QuestionState>
  submittedGroups: string[]
}

/** One evaluated question. */
export interface EvaluationEntry {
  visible: boolean
  effective: Answer | null
  source: "user" | "implied" | null
  impliedBy: string[]
  impliedReasons: string[]
  overridesImplied: boolean
  conflict: { from: string; answer: Answer }[]
}

/** The result of evaluating a plan. */
export interface Evaluation {
  questions: Map<string, EvaluationEntry>
  lockedGroups: Set<string>
}

/** One reason a group is not ready. */
export interface Missing {
  key: string
  reason: "unanswered" | "changed" | "conflict" | "proposal" | "nothing-to-submit"
}

/** Per-bucket question counts for list views. */
export interface PlanCounts {
  open: number
  answered: number
  deferred: number
  discussion: number
  submitted: number
  recorded: number
}

/** The JSON Schema of the publish tool input. */
export declare const DiscoveryPublishSchema: Record<string, unknown>

/** Validate and normalize a publish payload; never throws. */
export declare function validatePublish(
  input: unknown
):
  | { ok: true; plan: PublishedPlan }
  | { ok: false; errors: string[] }

/** Validate one stored answer for its question type. */
export declare function validateAnswer(
  question: Question,
  answer: unknown
): { ok: true } | { ok: false; error: string }

/** Validate a deferral. */
export declare function validateDefer(
  defer: unknown
): { ok: true } | { ok: false; error: string }

/** Convert a compact answer into the stored shape. */
export declare function toAnswer(question: Question, compact: CompactAnswer): Answer

/** Canonical content string used to detect a changed question. */
export declare function questionFingerprint(question: Question): string

/** Evaluate visibility, implications, conflicts, and group locks. */
export declare function evaluatePlan(plan: PublishedPlan, state: PlanState): Evaluation

/** Whether a group can be submitted, and what is missing when it cannot. */
export declare function groupReadiness(
  plan: PublishedPlan,
  state: PlanState,
  evaluation: Evaluation,
  groupKey: string
): { ready: boolean; locked: boolean; missing: Missing[] }

/** Counts used by list views. */
export declare function planCounts(
  plan: PublishedPlan,
  state: PlanState,
  evaluation: Evaluation
): PlanCounts
