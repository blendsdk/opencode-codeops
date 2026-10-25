/**
 * Discovery rules and model.
 *
 * This module owns the publish contract, answer validation, rule evaluation,
 * submit readiness, and question fingerprinting. The browser bundle and the
 * Node server both import it, so "visible", "implied", "locked", and "ready"
 * mean exactly the same thing on both sides.
 *
 * It is deliberately pure and browser-safe: no `node:` imports, no file
 * system, no clock, no randomness. Every function either returns a value or a
 * documented result object; nothing here throws on malformed input.
 *
 * The data model is JSON-friendly. A plan carries its groups and questions,
 * while the mutable answers and lifecycle live in a separate `PlanState`
 * object so the stored record, the HTTP payload, and the page share one
 * representation.
 *
 * @module discovery-rules
 */

/** Schema version written into every Discovery data file. */
export const DISCOVERY_SCHEMA_VERSION = 1

/** Every supported question type. */
export const QUESTION_TYPES = Object.freeze(["single", "multiple", "text", "single-other"])

/** Question types that carry options and therefore accept choice answers. */
export const CHOICE_TYPES = Object.freeze(["single", "multiple", "single-other"])

/** Every supported plan kind. */
export const PLAN_KINDS = Object.freeze(["plan", "requirements", "preflight"])

/** Pattern for question keys, group keys, and option ids. */
export const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/

/** Pattern for the lower-case slugs used in URLs and file names. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Maximum length of a plan title, group title, or option label. */
export const TITLE_MAX = 200

/** Maximum length of every other free-text value. */
export const TEXT_MAX = 4000

/** Maximum length of the repository-relative artifact path. */
export const ARTIFACT_MAX = 300

/** Structural caps that keep one publish under the request body limit. */
export const LIMITS = Object.freeze({
  groups: 50,
  questions: 200,
  optionsMin: 2,
  optionsMax: 20,
  evidence: 20,
})

/**
 * Question fields that make up the fingerprint used to detect a changed
 * question on republish. `group`, `showIf`, and `proposal` are deliberately
 * absent: moving a question between groups or changing how it is revealed
 * does not invalidate a stored answer.
 */
export const FINGERPRINT_FIELDS = Object.freeze([
  "type",
  "title",
  "why",
  "evidence",
  "options",
  "recommendation",
])

// ---------------------------------------------------------------------------
// JSON Schema for the publish tool
// ---------------------------------------------------------------------------

/** A JSON Schema string leaf with an optional maximum length. */
function stringSchema(maxLength) {
  return maxLength === undefined
    ? { type: "string" }
    : { type: "string", minLength: 1, maxLength }
}

/** A compact answer: an option id, a list of option ids, or free text. */
const COMPACT_ANSWER_SCHEMA = {
  anyOf: [
    { type: "string" },
    { type: "array", minItems: 1, items: { type: "string" } },
  ],
}

/** One `implies` entry attached to an option. */
const IMPLIES_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["question", "answer", "reason"],
  properties: {
    question: stringSchema(),
    answer: COMPACT_ANSWER_SCHEMA,
    reason: { type: "string", minLength: 1, maxLength: TEXT_MAX },
  },
}

/** One question option. */
const OPTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["id", "label"],
  properties: {
    id: { type: "string", pattern: KEY_PATTERN.source },
    label: { type: "string", minLength: 1, maxLength: TITLE_MAX },
    description: { type: "string", maxLength: TEXT_MAX },
    implies: { type: "array", items: IMPLIES_SCHEMA },
  },
}

/** One visibility condition. */
const SHOW_IF_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["question", "anyOf"],
  properties: {
    question: stringSchema(),
    anyOf: { type: "array", minItems: 1, items: { type: "string" } },
  },
}

/** An agent-proposed settlement for one question. */
const PROPOSAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "reason"],
  properties: {
    answer: COMPACT_ANSWER_SCHEMA,
    reason: { type: "string", minLength: 1, maxLength: TEXT_MAX },
  },
}

/** One published group. */
const GROUP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["key", "title"],
  properties: {
    key: { type: "string", pattern: KEY_PATTERN.source },
    title: { type: "string", minLength: 1, maxLength: TITLE_MAX },
    description: { type: "string", maxLength: TEXT_MAX },
    dependsOn: { type: "array", items: { type: "string" } },
  },
}

/** One published question. */
const QUESTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["key", "group", "type", "title"],
  properties: {
    key: { type: "string", pattern: KEY_PATTERN.source },
    group: { type: "string" },
    type: { type: "string", enum: [...QUESTION_TYPES] },
    title: { type: "string", minLength: 1, maxLength: TITLE_MAX },
    why: { type: "string", maxLength: TEXT_MAX },
    evidence: {
      type: "array",
      maxItems: LIMITS.evidence,
      items: { type: "string", maxLength: TEXT_MAX },
    },
    options: {
      type: "array",
      minItems: LIMITS.optionsMin,
      maxItems: LIMITS.optionsMax,
      items: OPTION_SCHEMA,
    },
    recommendation: {
      anyOf: [
        { type: "string" },
        { type: "array", minItems: 1, items: { type: "string" } },
      ],
    },
    showIf: { type: "array", items: SHOW_IF_SCHEMA },
    proposal: PROPOSAL_SCHEMA,
  },
}

/**
 * JSON Schema of the `codeops_discovery_publish` payload.
 *
 * Every object level rejects unknown keys, so a typo in a field name is a
 * validation error instead of silently ignored content.
 */
export const DiscoveryPublishSchema = {
  type: "object",
  additionalProperties: false,
  required: ["artifact", "kind", "title", "groups", "questions"],
  properties: {
    artifact: { type: "string", minLength: 1, maxLength: ARTIFACT_MAX },
    kind: { type: "string", enum: [...PLAN_KINDS] },
    title: { type: "string", minLength: 1, maxLength: TITLE_MAX },
    takeover: { type: "boolean" },
    groups: {
      type: "array",
      minItems: 1,
      maxItems: LIMITS.groups,
      items: GROUP_SCHEMA,
    },
    questions: {
      type: "array",
      minItems: 1,
      maxItems: LIMITS.questions,
      items: QUESTION_SCHEMA,
    },
  },
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** True for an object created by `{}` or `JSON.parse`, false for arrays/null. */
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

/** Trims a value that must be a string, returning "" for any other type. */
function trimmedString(value) {
  return typeof value === "string" ? value.trim() : ""
}

/** Trims an optional string and reports length violations. */
function optionalString(value, path, maxLength, fail) {
  if (value === undefined) return undefined
  if (typeof value !== "string") {
    fail(path, "expected a string")
    return undefined
  }
  const trimmed = value.trim()
  if (trimmed.length > maxLength) {
    fail(path, `must be at most ${maxLength} characters`)
    return undefined
  }
  return trimmed.length === 0 ? undefined : trimmed
}

/** Reports fields that the contract does not define. */
function rejectUnknownKeys(value, allowed, path, fail) {
  for (const key of Object.keys(value)) {
    if (allowed.includes(key)) continue
    fail(path === "" ? `payload.${key}` : `${path}.${key}`, "unknown field")
  }
}

/** Canonical serialization of an answer, used for equality and conflicts. */
function canonicalAnswer(answer) {
  if (answer === null || answer === undefined) return "null"
  if (Array.isArray(answer.choices)) {
    return JSON.stringify({ choices: [...answer.choices].sort() })
  }
  if (typeof answer.choice === "string") return JSON.stringify({ choice: answer.choice })
  if (typeof answer.text === "string") return JSON.stringify({ text: answer.text })
  if (typeof answer.other === "string") return JSON.stringify({ other: answer.other })
  return JSON.stringify(answer)
}

/** True when two answers carry the same value. */
function sameAnswer(left, right) {
  return canonicalAnswer(left) === canonicalAnswer(right)
}

/** Option ids selected by a stored answer, ignoring free text. */
function selectedOptionIds(question, answer) {
  if (!answer) return []
  if (question.type === "multiple") {
    return Array.isArray(answer.choices) ? [...answer.choices] : []
  }
  if (question.type === "single" || question.type === "single-other") {
    return typeof answer.choice === "string" ? [answer.choice] : []
  }
  return []
}

/** Trims a compact answer's string parts without changing its shape. */
function normalizeCompactAnswer(compact) {
  if (typeof compact === "string") return compact.trim()
  if (Array.isArray(compact)) {
    return compact.map((value) => (typeof value === "string" ? value.trim() : value))
  }
  return compact
}

/** Validates a repository-relative POSIX artifact path. */
function validateArtifact(artifact) {
  if (artifact.length === 0) return "is required"
  if (artifact.length > ARTIFACT_MAX) return `must be at most ${ARTIFACT_MAX} characters`
  if (artifact.startsWith("/")) return "must be repository-relative"
  if (artifact.includes("\\")) return "must use POSIX separators"
  const segments = artifact.split("/")
  if (segments.some((segment) => segment.length === 0)) return "must not contain empty segments"
  if (segments.includes("..")) return "must not contain a parent segment"
  return null
}

// ---------------------------------------------------------------------------
// Publish validation
// ---------------------------------------------------------------------------

/**
 * Validate and normalize a publish payload.
 *
 * The function never throws. It collects every structural problem first, then
 * checks cross-references and cycles, and finally returns a normalized copy
 * with trimmed strings and dropped empty optional values.
 *
 * @param {unknown} input - The raw tool input.
 * @returns {{ ok: true, plan: object } | { ok: false, errors: string[] }}
 *   The normalized plan, or one error per problem with its field path.
 */
export function validatePublish(input) {
  const errors = []
  const fail = (path, message) => errors.push(`${path}: ${message}`)
  if (!isPlainObject(input)) return { ok: false, errors: ["payload: expected an object"] }

  rejectUnknownKeys(
    input,
    ["artifact", "kind", "title", "takeover", "groups", "questions"],
    "",
    fail,
  )

  const artifact = trimmedString(input.artifact)
  const artifactError = validateArtifact(artifact)
  if (artifactError !== null) fail("artifact", artifactError)

  if (!PLAN_KINDS.includes(input.kind)) {
    fail("kind", `expected one of ${PLAN_KINDS.join(", ")}`)
  }

  let title = trimmedString(input.title)
  if (title.length === 0) fail("title", "is required")
  else if (title.length > TITLE_MAX) {
    fail("title", `must be at most ${TITLE_MAX} characters`)
  }

  if ("takeover" in input && typeof input.takeover !== "boolean") {
    fail("takeover", "expected a boolean")
  }

  const groups = []
  const seenGroupKeys = new Set()
  if (!Array.isArray(input.groups)) {
    fail("groups", "expected an array")
  } else {
    if (input.groups.length < 1 || input.groups.length > LIMITS.groups) {
      fail("groups", `must hold 1 to ${LIMITS.groups} entries`)
    }
    input.groups.forEach((raw, index) => {
      const path = `groups[${index}]`
      if (!isPlainObject(raw)) {
        fail(path, "expected an object")
        return
      }
      rejectUnknownKeys(raw, ["key", "title", "description", "dependsOn"], path, fail)
      const key = trimmedString(raw.key)
      if (!KEY_PATTERN.test(key)) fail(`${path}.key`, "must be a key of 1 to 40 characters")
      else if (seenGroupKeys.has(key)) fail(`${path}.key`, `duplicate group key "${key}"`)
      else seenGroupKeys.add(key)
      const groupTitle = trimmedString(raw.title)
      if (groupTitle.length === 0) fail(`${path}.title`, "is required")
      else if (groupTitle.length > TITLE_MAX) {
        fail(`${path}.title`, `must be at most ${TITLE_MAX} characters`)
      }
      const description = optionalString(raw.description, `${path}.description`, TEXT_MAX, fail)
      const dependsOn = []
      if (raw.dependsOn !== undefined) {
        if (!Array.isArray(raw.dependsOn)) fail(`${path}.dependsOn`, "expected an array")
        else {
          raw.dependsOn.forEach((value, position) => {
            const target = trimmedString(value)
            if (!KEY_PATTERN.test(target)) {
              fail(`${path}.dependsOn[${position}]`, "expected a group key")
              return
            }
            dependsOn.push(target)
          })
        }
      }
      groups.push({
        key,
        title: groupTitle,
        ...(description === undefined ? {} : { description }),
        dependsOn,
      })
    })
  }

  const questions = []
  const questionPaths = []
  const questionByKey = new Map()
  if (!Array.isArray(input.questions)) {
    fail("questions", "expected an array")
  } else {
    if (input.questions.length < 1 || input.questions.length > LIMITS.questions) {
      fail("questions", `must hold 1 to ${LIMITS.questions} entries`)
    }
    input.questions.forEach((raw, index) => {
      const path = `questions[${index}]`
      questionPaths[index] = path
      if (!isPlainObject(raw)) {
        fail(path, "expected an object")
        return
      }
      rejectUnknownKeys(
        raw,
        [
          "key",
          "group",
          "type",
          "title",
          "why",
          "evidence",
          "options",
          "recommendation",
          "showIf",
          "proposal",
        ],
        path,
        fail,
      )
      const key = trimmedString(raw.key)
      if (!KEY_PATTERN.test(key)) fail(`${path}.key`, "must be a key of 1 to 40 characters")
      else if (questionByKey.has(key)) fail(`${path}.key`, `duplicate question key "${key}"`)
      const group = trimmedString(raw.group)
      if (group.length === 0) fail(`${path}.group`, "is required")
      const type = raw.type
      if (!QUESTION_TYPES.includes(type)) {
        fail(`${path}.type`, `expected one of ${QUESTION_TYPES.join(", ")}`)
      }
      const questionTitle = trimmedString(raw.title)
      if (questionTitle.length === 0) fail(`${path}.title`, "is required")
      else if (questionTitle.length > TITLE_MAX) {
        fail(`${path}.title`, `must be at most ${TITLE_MAX} characters`)
      }
      const why = optionalString(raw.why, `${path}.why`, TEXT_MAX, fail)

      let evidence
      if (raw.evidence !== undefined) {
        if (!Array.isArray(raw.evidence)) fail(`${path}.evidence`, "expected an array")
        else {
          if (raw.evidence.length > LIMITS.evidence) {
            fail(`${path}.evidence`, `must hold at most ${LIMITS.evidence} items`)
          }
          evidence = []
          raw.evidence.forEach((value, position) => {
            if (typeof value !== "string") {
              fail(`${path}.evidence[${position}]`, "expected a string")
              return
            }
            const trimmed = value.trim()
            if (trimmed.length > TEXT_MAX) {
              fail(`${path}.evidence[${position}]`, `must be at most ${TEXT_MAX} characters`)
              return
            }
            if (trimmed.length > 0) evidence.push(trimmed)
          })
        }
      }

      let options
      if (type === "text") {
        if (raw.options !== undefined) fail(`${path}.options`, "a text question has no options")
      } else if (CHOICE_TYPES.includes(type)) {
        if (!Array.isArray(raw.options)) {
          fail(`${path}.options`, "expected an array")
        } else {
          if (
            raw.options.length < LIMITS.optionsMin ||
            raw.options.length > LIMITS.optionsMax
          ) {
            fail(`${path}.options`, `must hold ${LIMITS.optionsMin} to ${LIMITS.optionsMax} options`)
          }
          options = []
          const seenIds = new Set()
          raw.options.forEach((rawOption, position) => {
            const optionPath = `${path}.options[${position}]`
            if (!isPlainObject(rawOption)) {
              fail(optionPath, "expected an object")
              return
            }
            rejectUnknownKeys(rawOption, ["id", "label", "description", "implies"], optionPath, fail)
            const id = trimmedString(rawOption.id)
            if (!KEY_PATTERN.test(id)) {
              fail(`${optionPath}.id`, "must be an option id of 1 to 40 characters")
            } else if (seenIds.has(id)) {
              fail(`${optionPath}.id`, `duplicate option id "${id}"`)
            }
            seenIds.add(id)
            const label = trimmedString(rawOption.label)
            if (label.length === 0) fail(`${optionPath}.label`, "is required")
            else if (label.length > TITLE_MAX) {
              fail(`${optionPath}.label`, `must be at most ${TITLE_MAX} characters`)
            }
            const description = optionalString(
              rawOption.description,
              `${optionPath}.description`,
              TEXT_MAX,
              fail,
            )
            if (rawOption.implies !== undefined && !Array.isArray(rawOption.implies)) {
              fail(`${optionPath}.implies`, "expected an array")
            }
            options.push({
              id,
              label,
              ...(description === undefined ? {} : { description }),
              ...(Array.isArray(rawOption.implies) ? { implies: rawOption.implies } : {}),
            })
          })
        }
      }

      let recommendation
      if (raw.recommendation !== undefined) {
        if (typeof raw.recommendation === "string") {
          const trimmed = raw.recommendation.trim()
          if (trimmed.length === 0 || trimmed.length > TEXT_MAX) {
            fail(`${path}.recommendation`, "must be a non-empty string")
          } else {
            recommendation = trimmed
          }
        } else if (Array.isArray(raw.recommendation)) {
          if (raw.recommendation.length === 0) {
            fail(`${path}.recommendation`, "must not be empty")
          } else {
            recommendation = []
            raw.recommendation.forEach((value, position) => {
              const trimmed = trimmedString(value)
              if (trimmed.length === 0) {
                fail(`${path}.recommendation[${position}]`, "must not be empty")
                return
              }
              recommendation.push(trimmed)
            })
          }
        } else {
          fail(`${path}.recommendation`, "expected a string or an array of strings")
        }
      }

      let showIf
      if (raw.showIf !== undefined) {
        if (!Array.isArray(raw.showIf)) fail(`${path}.showIf`, "expected an array")
        else {
          showIf = []
          raw.showIf.forEach((condition, position) => {
            const conditionPath = `${path}.showIf[${position}]`
            if (!isPlainObject(condition)) {
              fail(conditionPath, "expected an object")
              return
            }
            rejectUnknownKeys(condition, ["question", "anyOf"], conditionPath, fail)
            const reference = trimmedString(condition.question)
            if (reference.length === 0) fail(`${conditionPath}.question`, "is required")
            const anyOf = []
            if (!Array.isArray(condition.anyOf) || condition.anyOf.length === 0) {
              fail(`${conditionPath}.anyOf`, "expected a non-empty array of option ids")
            } else {
              condition.anyOf.forEach((value, idPosition) => {
                const id = trimmedString(value)
                if (!KEY_PATTERN.test(id)) {
                  fail(`${conditionPath}.anyOf[${idPosition}]`, "expected an option id")
                  return
                }
                anyOf.push(id)
              })
            }
            showIf.push({ question: reference, anyOf })
          })
        }
      }

      const normalized = {
        key,
        group,
        type,
        title: questionTitle,
        ...(why === undefined ? {} : { why }),
        ...(evidence === undefined ? {} : { evidence }),
        ...(options === undefined ? {} : { options }),
        ...(recommendation === undefined ? {} : { recommendation }),
        ...(showIf === undefined ? {} : { showIf }),
        ...(raw.proposal === undefined ? {} : { proposal: raw.proposal }),
      }
      if (key.length > 0 && !questionByKey.has(key)) questionByKey.set(key, normalized)
      questions.push(normalized)
    })
  }

  // Structural problems make the cross-reference pass meaningless.
  if (errors.length > 0) return { ok: false, errors }

  const groupKeys = new Set(groups.map((group) => group.key))
  for (const [index, group] of groups.entries()) {
    for (const [position, dependency] of group.dependsOn.entries()) {
      if (!groupKeys.has(dependency)) {
        fail(`groups[${index}].dependsOn[${position}]`, `unknown group "${dependency}"`)
      }
      if (dependency === group.key) {
        fail(`groups[${index}].dependsOn[${position}]`, "a group cannot depend on itself")
      }
    }
  }

  for (const [index, question] of questions.entries()) {
    const path = questionPaths[index]
    if (!groupKeys.has(question.group)) {
      fail(`${path}.group`, `unknown group "${question.group}"`)
    }
    for (const [position, condition] of (question.showIf ?? []).entries()) {
      const conditionPath = `${path}.showIf[${position}]`
      const target = questionByKey.get(condition.question)
      if (!target) {
        fail(`${conditionPath}.question`, `unknown question "${condition.question}"`)
        continue
      }
      if (target.key === question.key) {
        fail(`${conditionPath}.question`, "a question cannot depend on itself")
        continue
      }
      if (!CHOICE_TYPES.includes(target.type)) {
        fail(`${conditionPath}.question`, "the referenced question must be a choice question")
        continue
      }
      for (const [idPosition, id] of condition.anyOf.entries()) {
        if (!optionIdsOf(target).includes(id)) {
          fail(`${conditionPath}.anyOf[${idPosition}]`, `unknown option "${id}"`)
        }
      }
    }
    for (const [optionPosition, option] of (question.options ?? []).entries()) {
      for (const [implyPosition, implication] of (option.implies ?? []).entries()) {
        const implyPath = `${path}.options[${optionPosition}].implies[${implyPosition}]`
        validateImplication(implication, implyPath, questionByKey, question, fail)
      }
    }
    if (question.proposal !== undefined) {
      validateProposal(question, question.proposal, `${path}.proposal`, fail)
    }
    validateRecommendation(question, `${path}.recommendation`, fail)
  }

  if (errors.length > 0) return { ok: false, errors }

  checkAcyclic(
    groups.map((group) => [group.key, group.dependsOn]),
    (cycle) => fail("groups", `dependency cycle ${cycle.join(" -> ")}`),
  )
  checkAcyclic(
    questions
      .filter((question) => (question.showIf ?? []).length > 0)
      .map((question) => [question.key, question.showIf.map((condition) => condition.question)]),
    (cycle) => fail("questions", `showIf cycle ${cycle.join(" -> ")}`),
  )

  if (errors.length > 0) return { ok: false, errors }

  const normalizedQuestions = questions.map((question) => ({
    ...question,
    ...(question.options === undefined
      ? {}
      : {
          options: question.options.map((option) => ({
            ...option,
            ...(option.implies === undefined
              ? {}
              : {
                  implies: option.implies.map((implication) => ({
                    question: implication.question.trim(),
                    answer: normalizeCompactAnswer(implication.answer),
                    reason: implication.reason.trim(),
                  })),
                }),
          })),
        }),
    ...(question.proposal === undefined
      ? {}
      : {
          proposal: {
            answer: normalizeCompactAnswer(question.proposal.answer),
            reason: question.proposal.reason.trim(),
          },
        }),
  }))

  return {
    ok: true,
    plan: {
      artifact,
      kind: input.kind,
      title,
      groups,
      questions: normalizedQuestions,
    },
  }
}

/** Option ids of a choice question. */
function optionIdsOf(question) {
  return (question.options ?? []).map((option) => option.id)
}

/** Validate one `implies` entry against the payload's questions. */
function validateImplication(implication, path, questionByKey, owner, fail) {
  if (!isPlainObject(implication)) {
    fail(path, "expected an object")
    return
  }
  rejectUnknownKeys(implication, ["question", "answer", "reason"], path, fail)
  const reference = trimmedString(implication.question)
  if (reference.length === 0) {
    fail(`${path}.question`, "is required")
    return
  }
  const target = questionByKey.get(reference)
  if (!target) {
    fail(`${path}.question`, `unknown question "${reference}"`)
    return
  }
  if (target.key === owner.key) {
    fail(`${path}.question`, "a question cannot imply itself")
    return
  }
  const reason = trimmedString(implication.reason)
  if (reason.length === 0) fail(`${path}.reason`, "is required")
  else if (reason.length > TEXT_MAX) {
    fail(`${path}.reason`, `must be at most ${TEXT_MAX} characters`)
  }
  const compact = validateCompactAnswer(target, implication.answer)
  if (!compact.ok) fail(`${path}.answer`, compact.error)
}

/** Validate a proposal's answer against its own question. */
function validateProposal(question, proposal, path, fail) {
  if (!isPlainObject(proposal)) {
    fail(path, "expected an object")
    return
  }
  rejectUnknownKeys(proposal, ["answer", "reason"], path, fail)
  const reason = trimmedString(proposal.reason)
  if (reason.length === 0) fail(`${path}.reason`, "is required")
  else if (reason.length > TEXT_MAX) {
    fail(`${path}.reason`, `must be at most ${TEXT_MAX} characters`)
  }
  const compact = validateCompactAnswer(question, proposal.answer)
  if (!compact.ok) fail(`${path}.answer`, compact.error)
}

/** Validate a recommendation against its question type. */
function validateRecommendation(question, path, fail) {
  if (question.recommendation === undefined) return
  const ids = optionIdsOf(question)
  if (question.type === "text") {
    if (typeof question.recommendation !== "string" || question.recommendation.length === 0) {
      fail(path, "a text question recommends a non-empty string")
    }
    return
  }
  if (question.type === "multiple") {
    if (!Array.isArray(question.recommendation)) {
      fail(path, "a multiple question recommends an array of option ids")
      return
    }
    for (const id of question.recommendation) {
      if (!ids.includes(id)) fail(path, `unknown option "${id}"`)
    }
    return
  }
  if (typeof question.recommendation !== "string") {
    fail(path, "a single question recommends one option id")
    return
  }
  if (!ids.includes(question.recommendation)) {
    fail(path, `unknown option "${question.recommendation}"`)
  }
}

/** Validate a compact answer (option id, ids, or text) for a question. */
function validateCompactAnswer(question, compact) {
  const ids = optionIdsOf(question)
  if (question.type === "multiple") {
    if (!Array.isArray(compact) || compact.length === 0) {
      return { ok: false, error: "expected a non-empty array of option ids" }
    }
    for (const value of compact) {
      if (typeof value !== "string" || !ids.includes(value)) {
        return { ok: false, error: `unknown option "${String(value)}"` }
      }
    }
    return { ok: true }
  }
  if (question.type === "text") {
    if (typeof compact !== "string" || compact.trim().length === 0) {
      return { ok: false, error: "expected non-empty text" }
    }
    if (compact.trim().length > TEXT_MAX) {
      return { ok: false, error: `must be at most ${TEXT_MAX} characters` }
    }
    return { ok: true }
  }
  if (typeof compact !== "string" || !ids.includes(compact)) {
    return { ok: false, error: `unknown option "${String(compact)}"` }
  }
  return { ok: true }
}

/** Detect a cycle in a directed graph and report the first one found. */
function checkAcyclic(edges, onCycle) {
  const state = new Map()
  const stack = []
  let reported = false

  function visit(node) {
    if (reported) return
    const current = state.get(node) ?? 0
    if (current === 1) {
      const start = stack.indexOf(node)
      onCycle(stack.slice(start).concat(node))
      reported = true
      return
    }
    if (current === 2) return
    state.set(node, 1)
    stack.push(node)
    const targets = edges.find(([source]) => source === node)?.[1] ?? []
    for (const target of targets) visit(target)
    stack.pop()
    state.set(node, 2)
  }

  for (const [node] of edges) visit(node)
}

// ---------------------------------------------------------------------------
// Answers and deferrals
// ---------------------------------------------------------------------------

/**
 * Validate one stored answer for its question type.
 *
 * Exactly one of `choice`, `choices`, `text`, or `other` is allowed, except
 * that a `single-other` question accepts `choice` or `other` — never both.
 *
 * @param {object} question - A normalized question.
 * @param {unknown} answer - The candidate stored answer.
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateAnswer(question, answer) {
  if (!isPlainObject(answer)) return { ok: false, error: "expected an object" }
  const ids = optionIdsOf(question)
  const fields = Object.keys(answer)

  if (question.type === "single") {
    if (fields.length !== 1 || !("choice" in answer)) {
      return { ok: false, error: "a single question accepts exactly one choice" }
    }
    if (typeof answer.choice !== "string" || !ids.includes(answer.choice)) {
      return { ok: false, error: `unknown option "${String(answer.choice)}"` }
    }
    return { ok: true }
  }
  if (question.type === "single-other") {
    if (fields.length !== 1 || (!("choice" in answer) && !("other" in answer))) {
      return { ok: false, error: "a single-other question accepts a choice or free text, not both" }
    }
    if ("choice" in answer) {
      if (typeof answer.choice !== "string" || !ids.includes(answer.choice)) {
        return { ok: false, error: `unknown option "${String(answer.choice)}"` }
      }
      return { ok: true }
    }
    const other = trimmedString(answer.other)
    if (other.length === 0) return { ok: false, error: "free text must not be empty" }
    if (other.length > TEXT_MAX) {
      return { ok: false, error: `free text must be at most ${TEXT_MAX} characters` }
    }
    return { ok: true }
  }
  if (question.type === "multiple") {
    if (fields.length !== 1 || !("choices" in answer)) {
      return { ok: false, error: "a multiple question accepts exactly one choices list" }
    }
    if (!Array.isArray(answer.choices) || answer.choices.length === 0) {
      return { ok: false, error: "choose at least one option" }
    }
    const seen = new Set()
    for (const value of answer.choices) {
      if (typeof value !== "string" || !ids.includes(value)) {
        return { ok: false, error: `unknown option "${String(value)}"` }
      }
      if (seen.has(value)) return { ok: false, error: `repeated option "${value}"` }
      seen.add(value)
    }
    return { ok: true }
  }
  if (question.type === "text") {
    if (fields.length !== 1 || !("text" in answer)) {
      return { ok: false, error: "a text question accepts exactly one text value" }
    }
    const value = trimmedString(answer.text)
    if (value.length === 0) return { ok: false, error: "text must not be empty" }
    if (value.length > TEXT_MAX) {
      return { ok: false, error: `text must be at most ${TEXT_MAX} characters` }
    }
    return { ok: true }
  }
  return { ok: false, error: `unsupported question type "${String(question.type)}"` }
}

/**
 * Validate a deferral: decision, owner, and revisit must all be non-empty.
 *
 * @param {unknown} defer - The candidate deferral.
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateDefer(defer) {
  if (!isPlainObject(defer)) return { ok: false, error: "expected an object" }
  for (const field of ["decision", "owner", "revisit"]) {
    const value = trimmedString(defer[field])
    if (value.length === 0) return { ok: false, error: `${field} is required` }
    if (value.length > TEXT_MAX) {
      return { ok: false, error: `${field} must be at most ${TEXT_MAX} characters` }
    }
  }
  return { ok: true }
}

/**
 * Convert a compact answer (option id, ids, or text) into the stored shape.
 *
 * @param {object} question - The target question.
 * @param {unknown} compact - A validated compact answer.
 * @returns {object} `{ choice }`, `{ choices }`, or `{ text }`.
 */
export function toAnswer(question, compact) {
  if (question.type === "multiple") return { choices: [...compact] }
  if (question.type === "text") return { text: String(compact).trim() }
  return { choice: compact }
}

// ---------------------------------------------------------------------------
// Fingerprint
// ---------------------------------------------------------------------------

/**
 * Canonical content string used to detect a changed question on republish.
 *
 * Two questions with the same fingerprint keep the user's answer untouched.
 * Group membership, visibility rules, and the agent's proposal are excluded so
 * moving or re-revealing a question never invalidates an answer.
 *
 * @param {object} question - A normalized question.
 * @returns {string} A deterministic serialization of the content fields.
 */
export function questionFingerprint(question) {
  const canonical = {}
  for (const field of FINGERPRINT_FIELDS) {
    if (field === "options") {
      canonical.options = (question.options ?? []).map((option) => ({
        id: option.id,
        label: option.label,
        description: option.description ?? null,
      }))
      continue
    }
    if (field === "evidence") {
      canonical.evidence = [...(question.evidence ?? [])]
      continue
    }
    canonical[field] = question[field] ?? null
  }
  return JSON.stringify(canonical)
}

// ---------------------------------------------------------------------------
// Rule evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate visibility, implications, conflicts, and group locks.
 *
 * Visibility reads only the **explicit** answers, so an implied answer can
 * never reveal or hide another question. Implications are computed in one
 * pass from explicit answers on visible questions; an implied answer never
 * triggers further implications.
 *
 * @param {object} plan - A normalized published plan.
 * @param {object} state - The plan state (`{ questions, submittedGroups }`).
 * @returns {{ questions: Map<string, object>, lockedGroups: Set<string> }}
 */
export function evaluatePlan(plan, state) {
  const questions = plan.questions ?? []
  const stateQuestions = state?.questions ?? {}
  const submittedGroups = new Set(state?.submittedGroups ?? [])
  const questionByKey = new Map(questions.map((question) => [question.key, question]))

  const statusOf = (key) => stateQuestions[key]?.status ?? "open"
  const explicitAnswerOf = (key) => stateQuestions[key]?.answer ?? null

  const visibility = new Map()
  for (const question of questions) {
    if (statusOf(question.key) === "retired") {
      visibility.set(question.key, false)
      continue
    }
    const conditions = question.showIf ?? []
    if (conditions.length === 0) {
      visibility.set(question.key, true)
      continue
    }
    const satisfied = conditions.every((condition) => {
      const target = questionByKey.get(condition.question)
      if (!target) return false
      if (statusOf(condition.question) === "retired") return false
      const answer = explicitAnswerOf(condition.question)
      if (!answer) return false
      return selectedOptionIds(target, answer).some((id) => condition.anyOf.includes(id))
    })
    visibility.set(question.key, satisfied)
  }

  const implied = new Map()
  for (const question of questions) {
    if (visibility.get(question.key) !== true) continue
    if (!question.options) continue
    const answer = explicitAnswerOf(question.key)
    if (!answer) continue
    const selected = selectedOptionIds(question, answer)
    for (const option of question.options) {
      if (!selected.includes(option.id)) continue
      for (const implication of option.implies ?? []) {
        if (visibility.get(implication.question) !== true) continue
        const target = questionByKey.get(implication.question)
        if (!target) continue
        const entries = implied.get(implication.question) ?? []
        entries.push({
          from: question.key,
          reason: implication.reason,
          answer: toAnswer(target, implication.answer),
        })
        implied.set(implication.question, entries)
      }
    }
  }

  const evaluated = new Map()
  for (const question of questions) {
    const visible = visibility.get(question.key) === true
    const explicit = explicitAnswerOf(question.key)
    const entries = visible ? implied.get(question.key) ?? [] : []
    const distinct = new Map()
    for (const entry of entries) distinct.set(canonicalAnswer(entry.answer), entry.answer)
    const conflict =
      distinct.size > 1
        ? entries.map((entry) => ({ from: entry.from, answer: entry.answer }))
        : []
    const impliedAnswer = distinct.size === 1 ? [...distinct.values()][0] : null

    let effective = null
    let source = null
    let overridesImplied = false
    if (visible) {
      if (explicit !== null) {
        effective = explicit
        source = "user"
        overridesImplied = impliedAnswer !== null && !sameAnswer(explicit, impliedAnswer)
      } else if (impliedAnswer !== null) {
        effective = impliedAnswer
        source = "implied"
      }
    }

    evaluated.set(question.key, {
      visible,
      effective,
      source,
      impliedBy: entries.map((entry) => entry.from),
      impliedReasons: entries.map((entry) => entry.reason),
      overridesImplied,
      conflict,
    })
  }

  const lockedGroups = new Set()
  for (const group of plan.groups ?? []) {
    if ((group.dependsOn ?? []).some((dependency) => !submittedGroups.has(dependency))) {
      lockedGroups.add(group.key)
    }
  }

  return { questions: evaluated, lockedGroups }
}

// ---------------------------------------------------------------------------
// Readiness and counts
// ---------------------------------------------------------------------------

/**
 * Whether a group can be submitted, and what is missing when it cannot.
 *
 * A group is ready when it is unlocked, has at least one pending visible
 * `open` question, every pending question is answered, validly deferred, or
 * marked "needs discussion", and at least one of them is answered or deferred
 * so the submission always carries something for the agent.
 *
 * @param {object} plan - A normalized published plan.
 * @param {object} state - The plan state.
 * @param {object} evaluation - The result of {@link evaluatePlan}.
 * @param {string} groupKey - The group to inspect.
 * @returns {{ ready: boolean, locked: boolean, missing: Array<{key: string, reason: string}> }}
 */
export function groupReadiness(plan, state, evaluation, groupKey) {
  const stateQuestions = state?.questions ?? {}
  const locked = evaluation.lockedGroups.has(groupKey)
  const missing = []
  const pending = (plan.questions ?? []).filter(
    (question) =>
      question.group === groupKey &&
      evaluation.questions.get(question.key)?.visible === true &&
      (stateQuestions[question.key]?.status ?? "open") === "open",
  )
  let carriesSubmission = false

  for (const question of pending) {
    const questionState = stateQuestions[question.key] ?? {}
    const entry = evaluation.questions.get(question.key)
    if (questionState.changed === true) {
      missing.push({ key: question.key, reason: "changed" })
      continue
    }
    if (entry.conflict.length > 0 && questionState.answer == null) {
      missing.push({ key: question.key, reason: "conflict" })
      continue
    }
    if (entry.effective !== null) {
      carriesSubmission = true
      continue
    }
    if (questionState.defer && validateDefer(questionState.defer).ok) {
      carriesSubmission = true
      continue
    }
    if (questionState.needsDiscussion === true) continue
    if (question.proposal !== undefined && questionState.proposalDismissed !== true) {
      missing.push({ key: question.key, reason: "proposal" })
      continue
    }
    missing.push({ key: question.key, reason: "unanswered" })
  }

  if (missing.length === 0 && (!carriesSubmission || pending.length === 0)) {
    missing.push({ key: groupKey, reason: "nothing-to-submit" })
  }

  return {
    ready: !locked && pending.length > 0 && missing.length === 0,
    locked,
    missing,
  }
}

/**
 * Counts used by list views. A question lands in exactly one bucket.
 *
 * Hidden and retired questions are excluded from every count. `open` counts
 * visible questions still waiting for an answer, a deferral, or a discussion
 * marker.
 *
 * @param {object} plan - A normalized published plan.
 * @param {object} state - The plan state.
 * @param {object} evaluation - The result of {@link evaluatePlan}.
 * @returns {{ open: number, answered: number, deferred: number, discussion: number,
 *   submitted: number, recorded: number }}
 */
export function planCounts(plan, state, evaluation) {
  const counts = {
    open: 0,
    answered: 0,
    deferred: 0,
    discussion: 0,
    submitted: 0,
    recorded: 0,
  }
  const stateQuestions = state?.questions ?? {}

  for (const question of plan.questions ?? []) {
    if (evaluation.questions.get(question.key)?.visible !== true) continue
    const questionState = stateQuestions[question.key] ?? {}
    const status = questionState.status ?? "open"
    if (status === "submitted") {
      counts.submitted += 1
      continue
    }
    if (status === "recorded") {
      counts.recorded += 1
      continue
    }
    if (status !== "open") continue
    const entry = evaluation.questions.get(question.key)
    if (entry.effective !== null) counts.answered += 1
    else if (questionState.needsDiscussion === true) counts.discussion += 1
    else if (questionState.defer && validateDefer(questionState.defer).ok) counts.deferred += 1
    else counts.open += 1
  }

  return counts
}
