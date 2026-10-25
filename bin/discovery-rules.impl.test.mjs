/**
 * Implementation tests for the Discovery rules and model helper.
 *
 * These cases cover internal edges that the specification tests do not pin:
 * normalization details, conversion helpers, bucket partitioning, and the
 * diagnostic paths callers rely on. They may change with the implementation;
 * the specification tests may not.
 *
 * @module discovery-rules.impl.test
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  FINGERPRINT_FIELDS,
  LIMITS,
  QUESTION_TYPES,
  evaluatePlan,
  groupReadiness,
  planCounts,
  questionFingerprint,
  toAnswer,
  validateAnswer,
  validateDefer,
  validatePublish,
} from "./lib/discovery-rules.mjs"

/** Builds one option. */
function option(id, extra = {}) {
  return { id, label: id.toUpperCase(), ...extra }
}

/** Builds a single-choice question. */
function single(key, group, options = ["a", "b"], extra = {}) {
  return { key, group, type: "single", title: `${key} title`, options: options.map((id) => option(id)), ...extra }
}

/** Builds a free-text question. */
function text(key, group, extra = {}) {
  return { key, group, type: "text", title: `${key} title`, ...extra }
}

/** Builds a multiple-choice question. */
function multiple(key, group, options = ["a", "b"], extra = {}) {
  return {
    key,
    group,
    type: "multiple",
    title: `${key} title`,
    options: options.map((id) => option(id)),
    ...extra,
  }
}

/** Builds a publish payload. */
function payload(questions, groups = [{ key: "A", title: "A" }], extra = {}) {
  return { artifact: "plans/billing", kind: "plan", title: "Billing", groups, questions, ...extra }
}

/** Builds a stored question state with the documented defaults. */
function state(extra = {}) {
  return {
    answer: null,
    notes: "",
    defer: null,
    needsDiscussion: false,
    proposalDismissed: false,
    status: "open",
    changed: false,
    revisedAt: 0,
    recordedAs: null,
    ...extra,
  }
}

/** Validates and returns the normalized plan. */
function accepted(input) {
  const result = validatePublish(input)
  assert.equal(result.ok, true, result.ok ? "" : result.errors.join("\n"))
  return result.plan
}

describe("constants", () => {
  it("should expose the documented caps and fingerprint fields", () => {
    assert.deepEqual([...QUESTION_TYPES], ["single", "multiple", "text", "single-other"])
    assert.deepEqual([...FINGERPRINT_FIELDS], [
      "type",
      "title",
      "why",
      "evidence",
      "options",
      "recommendation",
    ])
    assert.equal(LIMITS.groups, 50)
    assert.equal(LIMITS.questions, 200)
    assert.equal(LIMITS.optionsMin, 2)
    assert.equal(LIMITS.optionsMax, 20)
    assert.equal(LIMITS.evidence, 20)
    assert.throws(() => QUESTION_TYPES.push("ranked"), TypeError)
  })
})

describe("answer conversion", () => {
  it("should produce the stored shape for every question type when converting a compact answer", () => {
    assert.deepEqual(toAnswer({ type: "single" }, "a"), { choice: "a" })
    assert.deepEqual(toAnswer({ type: "single-other" }, "a"), { choice: "a" })
    assert.deepEqual(toAnswer({ type: "multiple" }, ["a", "b"]), { choices: ["a", "b"] })
    assert.deepEqual(toAnswer({ type: "text" }, "  hello  "), { text: "hello" })
  })

  it("should copy the option list instead of sharing it when converting a multiple answer", () => {
    const compact = ["a", "b"]
    const answer = toAnswer({ type: "multiple" }, compact)
    compact.push("c")
    assert.deepEqual(answer.choices, ["a", "b"])
  })
})

describe("publish normalization details", () => {
  it("should reject unknown keys at the root and inside a question when a typo is published", () => {
    const root = validatePublish(payload([text("DQ-1", "A")], undefined, { extra: true }))
    assert.equal(root.ok, false)
    assert.ok(root.ok ? true : root.errors.some((error) => error.includes("payload.extra")))

    const nested = validatePublish(
      payload([text("DQ-1", "A", { surprise: true })]),
    )
    assert.equal(nested.ok, false)
    assert.ok(
      nested.ok ? true : nested.errors.some((error) => error.includes("questions[0].surprise")),
    )
  })

  it("should report duplicate option ids and blank labels when options are malformed", () => {
    const duplicate = validatePublish(
      payload([single("DQ-1", "A", ["a", "b"], { options: [option("a"), option("a")] })]),
    )
    assert.equal(duplicate.ok, false)
    assert.ok(
      duplicate.ok
        ? true
        : duplicate.errors.some((error) => error.includes("questions[0].options[1].id")),
    )

    const blankLabel = validatePublish(
      payload([single("DQ-1", "A", ["a", "b"], { options: [option("a", { label: "  " }), option("b")] })]),
    )
    assert.equal(blankLabel.ok, false)
    assert.ok(
      blankLabel.ok
        ? true
        : blankLabel.errors.some((error) => error.includes("options[0].label")),
    )
  })

  it("should reject duplicate group keys when two groups share a key", () => {
    const result = validatePublish(
      payload(
        [text("DQ-1", "A")],
        [
          { key: "A", title: "A" },
          { key: "A", title: "B" },
        ],
      ),
    )
    assert.equal(result.ok, false)
    assert.ok(result.ok ? true : result.errors.some((error) => error.includes("groups[1].key")))
  })

  it("should trim implication references and compact text when values are padded", () => {
    const plan = accepted(
      payload([
        single("DQ-1", "A", ["yes", "no"], {
          options: [
            option("yes"),
            option("no", {
              implies: [{ question: "  DQ-2  ", answer: "  n/a  ", reason: "r" }],
            }),
          ],
        }),
        text("DQ-2", "A"),
      ]),
    )
    const implication = plan.questions[0].options[1].implies[0]
    assert.equal(implication.question, "DQ-2")
    assert.equal(implication.answer, "n/a")

    const evaluation = evaluatePlan(plan, {
      questions: { "DQ-1": state({ answer: { choice: "no" } }) },
      submittedGroups: [],
    })
    assert.deepEqual(evaluation.questions.get("DQ-2").effective, { text: "n/a" })
  })

  it("should permit repeated option ids when the contract does not forbid them", () => {
    const plan = accepted(
      payload([multiple("DQ-1", "A", ["a", "b"], { recommendation: ["a", "a"] })]),
    )
    assert.deepEqual(plan.questions[0].recommendation, ["a", "a"])
  })

  it("should reject self-dependencies and unknown dependency targets", () => {
    const self = validatePublish(
      payload([text("DQ-1", "A")], [{ key: "A", title: "A", dependsOn: ["A"] }]),
    )
    assert.equal(self.ok, false)
    assert.ok(self.ok ? true : self.errors.some((error) => error.includes("dependsOn[0]")))

    const unknown = validatePublish(
      payload([text("DQ-1", "A")], [{ key: "A", title: "A", dependsOn: ["Z"] }]),
    )
    assert.equal(unknown.ok, false)
    assert.ok(unknown.ok ? true : unknown.errors.some((error) => error.includes("unknown group")))
  })

  it("should reject an artifact with an empty segment", () => {
    const result = validatePublish(payload([text("DQ-1", "A")], undefined, { artifact: "a//b" }))
    assert.equal(result.ok, false)
    assert.ok(result.ok ? true : result.errors.some((error) => error.includes("artifact")))
  })

  it("should trim nested strings and drop empty evidence entries when values are padded", () => {
    const plan = accepted(
      payload([
        text("DQ-1", "A", {
          title: "  Question  ",
          why: "  because  ",
          evidence: [" one ", "   ", " two "],
        }),
      ], [{ key: "A", title: "  Group  ", description: "  about  " }]),
    )
    assert.equal(plan.questions[0].title, "Question")
    assert.equal(plan.questions[0].why, "because")
    assert.deepEqual(plan.questions[0].evidence, ["one", "two"])
    assert.equal(plan.groups[0].title, "Group")
    assert.equal(plan.groups[0].description, "about")
    assert.deepEqual(plan.groups[0].dependsOn, [])
  })

  it("should reject a non-object payload without throwing", () => {
    for (const value of [null, 42, "text", []]) {
      const result = validatePublish(value)
      assert.equal(result.ok, false)
      assert.equal(result.errors.length, 1)
    }
  })
})

describe("answer validation edges", () => {
  it("should reject extra fields and unknown question types when an answer is validated", () => {
    const question = single("DQ-1", "A")
    assert.equal(validateAnswer(question, { choice: "a", bogus: 1 }).ok, false)
    assert.equal(validateAnswer({ ...question, type: "ranked" }, { choice: "a" }).ok, false)
    assert.equal(validateAnswer(question, null).ok, false)
    assert.equal(validateAnswer({ ...question, type: "multiple" }, { choices: [1] }).ok, false)
  })

  it("should reject malformed deferrals", () => {
    assert.equal(validateDefer(null).ok, false)
    assert.equal(validateDefer({ decision: "  ", owner: "me", revisit: "soon" }).ok, false)
    assert.equal(
      validateDefer({ decision: "later", owner: "me", revisit: "x".repeat(4001) }).ok,
      false,
    )
  })
})

describe("fingerprint determinism", () => {
  it("should stay stable across key insertion order and treat option order as significant", () => {
    const base = accepted(
      payload([single("DQ-1", "A", ["a", "b"], { recommendation: "a" })]),
    ).questions[0]
    const reordered = {
      recommendation: base.recommendation,
      options: base.options,
      title: base.title,
      type: base.type,
      key: base.key,
      group: base.group,
    }
    assert.equal(questionFingerprint(reordered), questionFingerprint(base))

    const swapped = { ...base, options: [base.options[1], base.options[0]] }
    assert.notEqual(questionFingerprint(swapped), questionFingerprint(base))
  })
  it("should treat absent and empty evidence the same when fingerprinting", () => {
    const base = accepted(payload([text("DQ-1", "A", { evidence: ["one"] })])).questions[0]
    const omitted = { ...base }
    delete omitted.evidence
    const empty = { ...base, evidence: [] }
    assert.equal(questionFingerprint(omitted), questionFingerprint(empty))
  })
})

describe("evaluation edges", () => {
  it("should not mark an override when the explicit answer equals the implication", () => {
    const plan = accepted(
      payload([
        single("DQ-1", "A", ["yes", "no"], {
          options: [
            option("yes"),
            option("no", {
              implies: [{ question: "DQ-2", answer: "n/a", reason: "No refunds" }],
            }),
          ],
        }),
        text("DQ-2", "A"),
      ]),
    )
    const evaluation = evaluatePlan(plan, {
      questions: {
        "DQ-1": state({ answer: { choice: "no" } }),
        "DQ-2": state({ answer: { text: "n/a" } }),
      },
      submittedGroups: [],
    })
    assert.equal(evaluation.questions.get("DQ-2").overridesImplied, false)
  })

  it("should let an explicit answer win while still reporting the conflict", () => {
    const plan = accepted(
      payload([
        single("DQ-1", "A", ["a", "b"], {
          options: [
            option("a", { implies: [{ question: "DQ-3", answer: "x", reason: "first" }] }),
            option("b"),
          ],
        }),
        single("DQ-2", "A", ["a", "b"], {
          options: [
            option("a"),
            option("b", { implies: [{ question: "DQ-3", answer: "y", reason: "second" }] }),
          ],
        }),
        single("DQ-3", "A", ["x", "y", "z"]),
      ]),
    )
    const evaluation = evaluatePlan(plan, {
      questions: {
        "DQ-1": state({ answer: { choice: "a" } }),
        "DQ-2": state({ answer: { choice: "b" } }),
        "DQ-3": state({ answer: { choice: "z" } }),
      },
      submittedGroups: [],
    })
    const target = evaluation.questions.get("DQ-3")
    assert.deepEqual(target.effective, { choice: "z" })
    assert.equal(target.conflict.length, 2)
  })

  it("should unlock a group when its dependency is submitted", () => {
    const plan = accepted(
      payload(
        [text("q1", "A"), text("q2", "B")],
        [
          { key: "A", title: "A" },
          { key: "B", title: "B", dependsOn: ["A"] },
        ],
      ),
    )
    const evaluation = evaluatePlan(plan, {
      questions: {},
      submittedGroups: ["A"],
    })
    assert.equal(evaluation.lockedGroups.has("B"), false)
    const readiness = groupReadiness(plan, { questions: {}, submittedGroups: ["A"] }, evaluation, "B")
    assert.equal(readiness.locked, false)
    assert.equal(readiness.ready, false)
  })

  it("should treat an unknown group as having nothing to submit", () => {
    const plan = accepted(payload([text("q1", "A")]))
    const evaluation = evaluatePlan(plan, { questions: {}, submittedGroups: [] })
    assert.deepEqual(groupReadiness(plan, { questions: {}, submittedGroups: [] }, evaluation, "Z"), {
      ready: false,
      locked: false,
      missing: [{ key: "Z", reason: "nothing-to-submit" }],
    })
  })
})

describe("counts partition", () => {
  it("should place every visible question in exactly one bucket", () => {
    const plan = accepted(
      payload([
        single("q1", "A"),
        text("q2", "A"),
        text("q3", "A"),
        text("q4", "A"),
        text("q5", "A"),
        text("q6", "A"),
      ]),
    )
    const model = {
      q1: state({ answer: { choice: "a" } }),
      q2: state({ defer: { decision: "later", owner: "me", revisit: "soon" } }),
      q3: state({ needsDiscussion: true }),
      q4: state(),
      q5: state({ status: "submitted" }),
      q6: state({ status: "recorded", recordedAs: "AR-1" }),
    }
    const evaluation = evaluatePlan(plan, { questions: model, submittedGroups: [] })
    assert.deepEqual(planCounts(plan, { questions: model, submittedGroups: [] }, evaluation), {
      open: 1,
      answered: 1,
      deferred: 1,
      discussion: 1,
      submitted: 1,
      recorded: 1,
    })
  })
})
