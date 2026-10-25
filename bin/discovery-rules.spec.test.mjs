/**
 * Specification tests for the Discovery rules and model module.
 *
 * These cases pin the observable behaviour of the publish contract, answer
 * validation, rule evaluation, readiness, and fingerprinting before the module
 * exists. They are written from the contract documents only, so a failure here
 * means the implementation does not satisfy the specification — never that the
 * test is wrong.
 *
 * The module is pure and browser-safe: nothing in this file may require a
 * Node-only import from it.
 *
 * @module discovery-rules.spec.test
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

import {
  DiscoveryPublishSchema,
  evaluatePlan,
  groupReadiness,
  planCounts,
  questionFingerprint,
  validateAnswer,
  validateDefer,
  validatePublish,
} from "./lib/discovery-rules.mjs"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Builds one option of a choice question. */
function option(id, extra = {}) {
  return { id, label: id.toUpperCase(), ...extra }
}

/** Builds a `single` question with 2 options by default. */
function single(key, group, options = ["a", "b"], extra = {}) {
  return {
    key,
    group,
    type: "single",
    title: `${key} title`,
    options: options.map((id) => option(id)),
    ...extra,
  }
}

/** Builds a `multiple` question with 2 options by default. */
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

/** Builds a free-text question. */
function text(key, group, extra = {}) {
  return { key, group, type: "text", title: `${key} title`, ...extra }
}

/** Builds a full publish payload around the given questions. */
function payload(questions, groups = [{ key: "A", title: "A" }], extra = {}) {
  return {
    artifact: "plans/billing",
    kind: "plan",
    title: "Billing plan",
    groups,
    questions,
    ...extra,
  }
}

/** Builds one stored question state with the documented defaults. */
function questionState(extra = {}) {
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

/** Builds a plan state container around the given per-question states. */
function planState(questions = {}, submittedGroups = []) {
  return { questions, submittedGroups }
}

/** Validates a payload and returns its normalized plan, failing the test otherwise. */
function accepted(input) {
  const result = validatePublish(input)
  assert.equal(result.ok, true, result.ok ? "" : result.errors.join("\n"))
  return result.plan
}

/** Asserts that every object-shaped schema node rejects unknown keys. */
function assertClosedObjects(node, path = "$") {
  if (node === null || typeof node !== "object") return
  if (Array.isArray(node)) {
    node.forEach((item, index) => assertClosedObjects(item, `${path}[${index}]`))
    return
  }
  for (const key of ["properties", "items", "anyOf", "oneOf", "allOf", "$defs", "definitions"]) {
    if (!(key in node)) continue
    const child = node[key]
    if (key === "properties" && child !== null && typeof child === "object") {
      for (const [name, schema] of Object.entries(child)) {
        assertClosedObjects(schema, `${path}.properties.${name}`)
      }
      continue
    }
    assertClosedObjects(child, `${path}.${key}`)
  }
  const looksLikeObject = node.type === "object" || node.properties !== undefined
  if (looksLikeObject) {
    assert.equal(node.additionalProperties, false, `${path} must reject unknown keys`)
  }
}

// ---------------------------------------------------------------------------
// Publish schema
// ---------------------------------------------------------------------------

describe("publish schema", () => {
  it("should require every published field and reject unknown keys at every level when the schema is inspected", () => {
    const schema = DiscoveryPublishSchema
    assert.equal(schema.type, "object")
    for (const field of ["artifact", "kind", "title", "groups", "questions"]) {
      assert.ok(schema.required.includes(field), `required must include ${field}`)
    }
    assert.deepEqual([...schema.properties.kind.enum], ["plan", "requirements", "preflight"])
    assert.deepEqual(
      [...schema.properties.questions.items.properties.type.enum],
      ["single", "multiple", "text", "single-other"],
    )
    assert.equal(schema.properties.takeover.type, "boolean")
    assert.ok(!schema.required.includes("takeover"), "takeover stays optional")
    assertClosedObjects(schema)
  })
})

// ---------------------------------------------------------------------------
// Publish normalization
// ---------------------------------------------------------------------------

describe("publish normalization", () => {
  it("should trim group titles and drop empty optional strings when a publish carries padded values", () => {
    const plan = accepted(
      payload([text("DQ-1", "A", { why: "   " })], [{ key: "A", title: " Scope " }]),
    )
    assert.equal(plan.groups[0].title, "Scope")
    assert.equal(plan.questions[0].why, undefined)
  })
})

// ---------------------------------------------------------------------------
// Publish validation
// ---------------------------------------------------------------------------

describe("publish validation", () => {
  it("should report duplicate keys, unknown references, cycles, caps, and bad shapes by path when a publish is invalid", () => {
    const manyQuestions = Array.from({ length: 201 }, (_, index) =>
      single(`Q${index + 1}`, "A"),
    )
    const manyOptions = Array.from({ length: 21 }, (_, index) => `o${index + 1}`)
    const manyEvidence = Array.from({ length: 21 }, (_, index) => `e${index + 1}`)
    const manyGroups = Array.from({ length: 51 }, (_, index) => ({
      key: `G${index + 1}`,
      title: `G${index + 1}`,
    }))

    const cases = [
      {
        label: "duplicate question key",
        input: payload([single("DQ-1", "A"), single("DQ-1", "A")]),
        needle: "questions[1].key",
      },
      {
        label: "unknown group",
        input: payload([single("DQ-1", "Z")]),
        needle: "questions[0].group",
      },
      {
        label: "unknown dependency",
        input: payload([single("DQ-1", "A")], [
          { key: "A", title: "A", dependsOn: ["Z"] },
        ]),
        needle: "groups[0].dependsOn",
      },
      {
        label: "dependency cycle",
        input: payload([single("DQ-1", "A")], [
          { key: "A", title: "A", dependsOn: ["B"] },
          { key: "B", title: "B", dependsOn: ["A"] },
        ]),
        needle: "groups",
      },
      {
        label: "choice question with one option",
        input: payload([single("DQ-1", "A", ["a"])]),
        needle: "questions[0].options",
      },
      {
        label: "text question with options",
        input: payload([
          text("DQ-1", "A", { options: [option("a"), option("b")] }),
        ]),
        needle: "questions[0].options",
      },
      {
        label: "recommendation that is not an option",
        input: payload([
          single("DQ-1", "A", ["a", "b"], { recommendation: "zz" }),
        ]),
        needle: "questions[0].recommendation",
      },
      {
        label: "title over the limit",
        input: payload([text("DQ-1", "A")], undefined, { title: "x".repeat(201) }),
        needle: "title",
      },
      {
        label: "too many questions",
        input: payload(manyQuestions),
        needle: "questions",
      },
      {
        label: "too many options",
        input: payload([single("DQ-1", "A", manyOptions)]),
        needle: "questions[0].options",
      },
      {
        label: "too much evidence",
        input: payload([text("DQ-1", "A", { evidence: manyEvidence })]),
        needle: "questions[0].evidence",
      },
      {
        label: "why over the limit",
        input: payload([text("DQ-1", "A", { why: "x".repeat(4001) })]),
        needle: "questions[0].why",
      },
      {
        label: "too many groups",
        input: payload([single("DQ-1", "G1")], manyGroups),
        needle: "groups",
      },
    ]

    for (const item of cases) {
      const result = validatePublish(item.input)
      assert.equal(result.ok, false, item.label)
      const joined = result.ok ? "" : result.errors.join("\n")
      assert.ok(
        joined.includes(item.needle),
        `${item.label}: expected "${item.needle}" in:\n${joined}`,
      )
    }

    for (const artifact of ["../x", "/abs", "a\\b"]) {
      const result = validatePublish(payload([text("DQ-1", "A")], undefined, { artifact }))
      assert.equal(result.ok, false, `artifact ${artifact}`)
      assert.ok(
        (result.ok ? "" : result.errors.join("\n")).includes("artifact"),
        `artifact ${artifact}: error must name the field`,
      )
    }
  })

  it("should report broken rule references by path when a rule points at a missing or invalid target", () => {
    const cases = [
      {
        label: "showIf on an unknown question",
        input: payload([
          single("DQ-1", "A"),
          text("DQ-2", "A", { showIf: [{ question: "DQ-9", anyOf: ["a"] }] }),
        ]),
        needle: "showIf",
        path: "questions[1]",
      },
      {
        label: "showIf on a text question",
        input: payload([
          text("DQ-1", "A"),
          text("DQ-2", "A", { showIf: [{ question: "DQ-1", anyOf: ["a"] }] }),
        ]),
        needle: "showIf",
        path: "questions[1]",
      },
      {
        label: "showIf on itself",
        input: payload([
          single("DQ-1", "A", ["a", "b"], {
            showIf: [{ question: "DQ-1", anyOf: ["a"] }],
          }),
        ]),
        needle: "showIf",
        path: "questions[0]",
      },
      {
        label: "showIf cycle",
        input: payload([
          single("DQ-1", "A", ["a", "b"], {
            showIf: [{ question: "DQ-2", anyOf: ["a"] }],
          }),
          single("DQ-2", "A", ["a", "b"], {
            showIf: [{ question: "DQ-1", anyOf: ["a"] }],
          }),
        ]),
        needle: "showIf",
        path: "questions",
      },
      {
        label: "implies on an unknown question",
        input: payload([
          single("DQ-1", "A", ["a", "b"], {
            options: [
              option("a", {
                implies: [{ question: "DQ-9", answer: "a", reason: "because" }],
              }),
              option("b"),
            ],
          }),
          single("DQ-2", "A"),
        ]),
        needle: "implies",
        path: "questions[0]",
      },
      {
        label: "implies answer that is not an option of the target",
        input: payload([
          single("DQ-1", "A", ["a", "b"], {
            options: [
              option("a", {
                implies: [{ question: "DQ-2", answer: "zz", reason: "because" }],
              }),
              option("b"),
            ],
          }),
          single("DQ-2", "A"),
        ]),
        needle: "implies",
        path: "questions[0]",
      },
      {
        label: "implies on itself",
        input: payload([
          single("DQ-1", "A", ["a", "b"], {
            options: [
              option("a", {
                implies: [{ question: "DQ-1", answer: "b", reason: "because" }],
              }),
              option("b"),
            ],
          }),
        ]),
        needle: "implies",
        path: "questions[0]",
      },
      {
        label: "implies with a blank reason",
        input: payload([
          single("DQ-1", "A", ["a", "b"], {
            options: [
              option("a", {
                implies: [{ question: "DQ-2", answer: "a", reason: "   " }],
              }),
              option("b"),
            ],
          }),
          single("DQ-2", "A"),
        ]),
        needle: "implies",
        path: "questions[0]",
      },
    ]

    for (const item of cases) {
      const result = validatePublish(item.input)
      assert.equal(result.ok, false, item.label)
      const joined = result.ok ? "" : result.errors.join("\n")
      assert.ok(joined.includes(item.needle), `${item.label}: ${joined}`)
      assert.ok(joined.includes(item.path), `${item.label}: ${joined}`)
    }
  })
})

// ---------------------------------------------------------------------------
// Answer and deferral validation
// ---------------------------------------------------------------------------

describe("answer validation", () => {
  it("should accept exactly one well-formed value when the answer matches the question type", () => {
    const singleQuestion = single("DQ-1", "A", ["a", "b"])
    const multipleQuestion = multiple("DQ-1", "A", ["a", "b", "c"])
    const textQuestion = text("DQ-1", "A")
    const otherQuestion = {
      ...single("DQ-1", "A", ["a", "b"]),
      type: "single-other",
    }

    assert.equal(validateAnswer(singleQuestion, { choice: "a" }).ok, true)
    assert.equal(validateAnswer(singleQuestion, { choice: "zz" }).ok, false)
    assert.equal(validateAnswer(singleQuestion, { choices: ["a"] }).ok, false)

    assert.equal(validateAnswer(multipleQuestion, { choices: ["a", "b"] }).ok, true)
    assert.equal(validateAnswer(multipleQuestion, { choices: [] }).ok, false)
    assert.equal(validateAnswer(multipleQuestion, { choices: ["a", "a"] }).ok, false)

    assert.equal(validateAnswer(textQuestion, { text: " x " }).ok, true)
    assert.equal(validateAnswer(textQuestion, { text: "   " }).ok, false)
    assert.equal(validateAnswer(textQuestion, { text: "x".repeat(4001) }).ok, false)

    assert.equal(validateAnswer(otherQuestion, { choice: "a" }).ok, true)
    assert.equal(validateAnswer(otherQuestion, { other: "x" }).ok, true)
    assert.equal(validateAnswer(otherQuestion, { choice: "a", other: "x" }).ok, false)
    assert.equal(validateAnswer(otherQuestion, { other: "" }).ok, false)
  })

  it("should require a complete deferral when a deferral is recorded", () => {
    assert.equal(
      validateDefer({ decision: "decide later", owner: "me", revisit: "next week" }).ok,
      true,
    )
    const incomplete = validateDefer({ decision: "decide later", revisit: "next week" })
    assert.equal(incomplete.ok, false)
    assert.ok(incomplete.ok ? true : incomplete.error.includes("owner"))
  })
})

// ---------------------------------------------------------------------------
// Visibility and locks
// ---------------------------------------------------------------------------

describe("rule evaluation", () => {
  it("should show a question when its condition holds on explicit answers only", () => {
    const plan = accepted(
      payload(
        [
          single("DQ-0", "A"),
          single("DQ-1", "A", ["yes", "no"], {
            options: [
              option("yes"),
              option("no"),
            ],
          }),
          text("DQ-2", "A", { showIf: [{ question: "DQ-1", anyOf: ["yes"] }] }),
          text("DQ-3", "A"),
          multiple("DQ-4", "A", ["a", "b", "c"]),
          text("DQ-5", "A", { showIf: [{ question: "DQ-4", anyOf: ["a", "c"] }] }),
        ],
      ),
    )
    // DQ-0 explicitly selects "a"; its implication makes DQ-1 effectively "yes".
    const withImplication = accepted(
      payload(
        [
          single("DQ-0", "A", ["a", "b"], {
            options: [
              option("a", {
                implies: [{ question: "DQ-1", answer: "yes", reason: "bundle" }],
              }),
              option("b"),
            ],
          }),
          single("DQ-1", "A", ["yes", "no"]),
          text("DQ-2", "A", { showIf: [{ question: "DQ-1", anyOf: ["yes"] }] }),
          text("DQ-3", "A"),
          multiple("DQ-4", "A", ["a", "b", "c"]),
          text("DQ-5", "A", { showIf: [{ question: "DQ-4", anyOf: ["a", "c"] }] }),
        ],
      ),
    )

    const unanswered = evaluatePlan(plan, planState())
    assert.equal(unanswered.questions.get("DQ-2").visible, false)

    const confirmed = evaluatePlan(
      plan,
      planState({ "DQ-1": questionState({ answer: { choice: "yes" } }) }),
    )
    assert.equal(confirmed.questions.get("DQ-2").visible, true)

    const denied = evaluatePlan(
      plan,
      planState({ "DQ-1": questionState({ answer: { choice: "no" } }) }),
    )
    assert.equal(denied.questions.get("DQ-2").visible, false)

    const retired = evaluatePlan(
      plan,
      planState({ "DQ-3": questionState({ status: "retired" }) }),
    )
    assert.equal(retired.questions.get("DQ-3").visible, false)

    const impliedOnly = evaluatePlan(
      withImplication,
      planState({ "DQ-0": questionState({ answer: { choice: "a" } }) }),
    )
    assert.equal(
      impliedOnly.questions.get("DQ-1").effective?.choice,
      "yes",
      "the implication applies",
    )
    assert.equal(
      impliedOnly.questions.get("DQ-2").visible,
      false,
      "an implied answer never reveals a question",
    )

    const anyOfC = evaluatePlan(
      plan,
      planState({ "DQ-4": questionState({ answer: { choices: ["c"] } }) }),
    )
    assert.equal(anyOfC.questions.get("DQ-5").visible, true)

    const anyOfA = evaluatePlan(
      plan,
      planState({ "DQ-4": questionState({ answer: { choices: ["a"] } }) }),
    )
    assert.equal(anyOfA.questions.get("DQ-5").visible, true)
  })

  it("should apply implications from explicit answers in one pass when a rule targets another question", () => {
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
        text("DQ-3", "A"),
      ]),
    )

    const implied = evaluatePlan(
      plan,
      planState({ "DQ-1": questionState({ answer: { choice: "no" } }) }),
    )
    const impliedAnswer = implied.questions.get("DQ-2")
    assert.deepEqual(impliedAnswer.effective, { text: "n/a" })
    assert.equal(impliedAnswer.source, "implied")
    assert.deepEqual(impliedAnswer.impliedBy, ["DQ-1"])
    assert.deepEqual(impliedAnswer.impliedReasons, ["No refunds"])

    const overridden = evaluatePlan(
      plan,
      planState({
        "DQ-1": questionState({ answer: { choice: "no" } }),
        "DQ-2": questionState({ answer: { text: "30 days" } }),
      }),
    )
    const explicit = overridden.questions.get("DQ-2")
    assert.deepEqual(explicit.effective, { text: "30 days" })
    assert.equal(explicit.source, "user")
    assert.equal(explicit.overridesImplied, true)

    const chained = accepted(
      payload([
        single("DQ-1", "A", ["yes", "no"], {
          options: [
            option("yes"),
            option("no", {
              implies: [{ question: "DQ-2", answer: "x", reason: "bundle" }],
            }),
          ],
        }),
        single("DQ-2", "A", ["x", "y"], {
          options: [
            option("x", {
              implies: [{ question: "DQ-3", answer: "z", reason: "downstream" }],
            }),
            option("y"),
          ],
        }),
        text("DQ-3", "A"),
      ]),
    )
    const onePass = evaluatePlan(
      chained,
      planState({ "DQ-1": questionState({ answer: { choice: "no" } }) }),
    )
    assert.equal(onePass.questions.get("DQ-2").effective?.choice, "x")
    assert.equal(onePass.questions.get("DQ-3").effective, null)
  })

  it("should report conflicting implications when targets disagree and none when they agree", () => {
    const conflictPlan = (secondAnswer) =>
      accepted(
        payload([
          single("DQ-1", "A", ["a", "b"], {
            options: [
              option("a", {
                implies: [{ question: "DQ-3", answer: "x", reason: "first" }],
              }),
              option("b"),
            ],
          }),
          single("DQ-2", "A", ["a", "b"], {
            options: [
              option("a"),
              option("b", {
                implies: [
                  { question: "DQ-3", answer: secondAnswer, reason: "second" },
                ],
              }),
            ],
          }),
          single("DQ-3", "A", ["x", "y", "z"]),
        ]),
      )

    const conflicting = evaluatePlan(
      conflictPlan("y"),
      planState({
        "DQ-1": questionState({ answer: { choice: "a" } }),
        "DQ-2": questionState({ answer: { choice: "b" } }),
      }),
    )
    const conflict = conflicting.questions.get("DQ-3")
    assert.equal(conflict.effective, null)
    assert.equal(conflict.conflict.length, 2)

    const agreeing = evaluatePlan(
      conflictPlan("x"),
      planState({
        "DQ-1": questionState({ answer: { choice: "a" } }),
        "DQ-2": questionState({ answer: { choice: "b" } }),
      }),
    )
    const agreed = agreeing.questions.get("DQ-3")
    assert.equal(agreed.conflict.length, 0)
    assert.deepEqual(agreed.effective, { choice: "x" })
    assert.deepEqual([...agreed.impliedBy].sort(), ["DQ-1", "DQ-2"])
  })

  it("should keep a hidden answer stored but ineffective and uncounted when its condition turns false", () => {
    const plan = accepted(
      payload([
        single("DQ-1", "A", ["yes", "no"]),
        text("DQ-2", "A", { showIf: [{ question: "DQ-1", anyOf: ["yes"] }] }),
      ]),
    )

    const hidden = evaluatePlan(
      plan,
      planState({
        "DQ-1": questionState({ answer: { choice: "no" } }),
        "DQ-2": questionState({ answer: { text: "kept" } }),
      }),
    )
    const hiddenQuestion = hidden.questions.get("DQ-2")
    assert.equal(hiddenQuestion.visible, false)
    assert.equal(hiddenQuestion.effective, null)

    const hiddenCounts = planCounts(plan, planState({
      "DQ-1": questionState({ answer: { choice: "no" } }),
      "DQ-2": questionState({ answer: { text: "kept" } }),
    }), hidden)
    assert.equal(hiddenCounts.open, 0)
    assert.equal(hiddenCounts.answered, 1)
    assert.equal(hiddenCounts.submitted, 0)

    const visible = evaluatePlan(
      plan,
      planState({
        "DQ-1": questionState({ answer: { choice: "yes" } }),
        "DQ-2": questionState({ answer: { text: "kept" } }),
      }),
    )
    assert.equal(visible.questions.get("DQ-2").visible, true)
    assert.deepEqual(visible.questions.get("DQ-2").effective, { text: "kept" })
  })

  it("should lock a dependent group until its prerequisite is submitted", () => {
    const plan = accepted(
      payload(
        [single("q1", "A"), text("q6", "B")],
        [
          { key: "A", title: "A" },
          { key: "B", title: "B", dependsOn: ["A"] },
        ],
      ),
    )
    const state = planState({
      q1: questionState({ answer: { choice: "a" } }),
    })
    const evaluation = evaluatePlan(plan, state)
    const readiness = groupReadiness(plan, state, evaluation, "B")
    assert.equal(readiness.ready, false)
    assert.equal(readiness.locked, true)
  })
})

// ---------------------------------------------------------------------------
// Readiness and counts
// ---------------------------------------------------------------------------

describe("group readiness", () => {
  function readinessPlan() {
    return accepted(
      payload(
        [
          single("q1", "A"),
          text("q2", "A"),
          text("q3", "A"),
          single("q4", "A"),
          single("q5", "A"),
          text("q6", "B"),
        ],
        [
          { key: "A", title: "A" },
          { key: "B", title: "B", dependsOn: ["A"] },
        ],
      ),
    )
  }

  function readyState() {
    return planState({
      q1: questionState({ answer: { choice: "a" } }),
      q2: questionState({ defer: { decision: "later", owner: "me", revisit: "next week" } }),
      q3: questionState({ needsDiscussion: true }),
      q4: questionState({ answer: { choice: "a" } }),
      q5: questionState({ answer: { choice: "a" } }),
    })
  }

  it("should be ready when every pending question is answered, deferred, or needs discussion", () => {
    const plan = readinessPlan()
    const state = readyState()
    const evaluation = evaluatePlan(plan, state)
    const readiness = groupReadiness(plan, state, evaluation, "A")
    assert.equal(readiness.ready, true)
    assert.equal(readiness.locked, false)
    assert.deepEqual(readiness.missing, [])
  })

  it("should report an incomplete deferral as unanswered", () => {
    const plan = readinessPlan()
    const state = readyState()
    state.questions.q2 = questionState({
      defer: { decision: "later", owner: "me" },
    })
    const evaluation = evaluatePlan(plan, state)
    const readiness = groupReadiness(plan, state, evaluation, "A")
    assert.equal(readiness.ready, false)
    assert.deepEqual(readiness.missing, [{ key: "q2", reason: "unanswered" }])
  })

  it("should block a changed question until it is re-confirmed", () => {
    const plan = readinessPlan()
    const state = readyState()
    state.questions.q1 = questionState({ answer: { choice: "a" }, changed: true })
    const evaluation = evaluatePlan(plan, state)
    const readiness = groupReadiness(plan, state, evaluation, "A")
    assert.equal(readiness.ready, false)
    assert.ok(readiness.missing.some((entry) => entry.key === "q1" && entry.reason === "changed"))
  })

  it("should block a conflict when there is no explicit answer", () => {
    const plan = accepted(
      payload([
        single("r1", "A", ["a", "b"], {
          options: [
            option("a", {
              implies: [{ question: "r4", answer: "x", reason: "first" }],
            }),
            option("b"),
          ],
        }),
        single("r2", "A", ["a", "b"], {
          options: [
            option("a"),
            option("b", {
              implies: [{ question: "r4", answer: "y", reason: "second" }],
            }),
          ],
        }),
        single("r4", "A", ["x", "y"]),
      ]),
    )
    const state = planState({
      r1: questionState({ answer: { choice: "a" } }),
      r2: questionState({ answer: { choice: "b" } }),
    })
    const evaluation = evaluatePlan(plan, state)
    const readiness = groupReadiness(plan, state, evaluation, "A")
    assert.equal(readiness.ready, false)
    assert.ok(
      readiness.missing.some((entry) => entry.key === "r4" && entry.reason === "conflict"),
    )
  })

  it("should block an unconfirmed proposal", () => {
    const plan = accepted(
      payload([
        single("p1", "A", ["a", "b"], {
          proposal: { answer: "a", reason: "the agent infers this settlement" },
        }),
      ]),
    )
    const state = planState({ p1: questionState() })
    const evaluation = evaluatePlan(plan, state)
    const readiness = groupReadiness(plan, state, evaluation, "A")
    assert.equal(readiness.ready, false)
    assert.deepEqual(readiness.missing, [{ key: "p1", reason: "proposal" }])
  })

  it("should stay unready when every pending question only needs discussion", () => {
    const plan = accepted(payload([text("d1", "A"), text("d2", "A")]))
    const state = planState({
      d1: questionState({ needsDiscussion: true }),
      d2: questionState({ needsDiscussion: true }),
    })
    const evaluation = evaluatePlan(plan, state)
    const readiness = groupReadiness(plan, state, evaluation, "A")
    assert.equal(readiness.ready, false)
    assert.deepEqual(
      readiness.missing.map((entry) => entry.reason),
      ["nothing-to-submit"],
    )
  })
})

// ---------------------------------------------------------------------------
// Fingerprint
// ---------------------------------------------------------------------------

describe("question fingerprint", () => {
  it("should track content fields but ignore group, proposal, and visibility rules when the fingerprint is compared", () => {
    const base = accepted(
      payload([
        single("DQ-1", "A", ["a", "b"], {
          why: "why it matters",
          evidence: ["evidence"],
          recommendation: "a",
        }),
        single("DQ-2", "A"),
      ]),
    ).questions[0]

    const clone = (changes) => ({ ...structuredClone(base), ...changes })

    assert.equal(questionFingerprint(clone({ group: "A" })), questionFingerprint(base))
    assert.notEqual(
      questionFingerprint(clone({ type: "multiple" })),
      questionFingerprint(base),
    )
    assert.notEqual(
      questionFingerprint(clone({ title: `${base.title} changed` })),
      questionFingerprint(base),
    )
    assert.notEqual(
      questionFingerprint(
        clone({
          options: base.options.map((entry, index) =>
            index === 0 ? { ...entry, label: `${entry.label} changed` } : entry,
          ),
        }),
      ),
      questionFingerprint(base),
    )
    assert.notEqual(
      questionFingerprint(
        clone({
          options: base.options.map((entry, index) =>
            index === 0 ? { ...entry, description: "described" } : entry,
          ),
        }),
      ),
      questionFingerprint(base),
    )
    assert.notEqual(
      questionFingerprint(clone({ why: "another reason" })),
      questionFingerprint(base),
    )
    assert.notEqual(
      questionFingerprint(clone({ evidence: ["another evidence"] })),
      questionFingerprint(base),
    )
    assert.notEqual(
      questionFingerprint(clone({ recommendation: "b" })),
      questionFingerprint(base),
    )
    assert.equal(
      questionFingerprint(clone({ proposal: { answer: "a", reason: "because" } })),
      questionFingerprint(base),
    )
    assert.equal(
      questionFingerprint(clone({ showIf: [{ question: "DQ-2", anyOf: ["a"] }] })),
      questionFingerprint(base),
    )
  })

  it("should live in a browser-safe module with no Node imports", () => {
    const source = readFileSync(new URL("./lib/discovery-rules.mjs", import.meta.url), "utf8")
    assert.doesNotMatch(source, /from\s+["']node:/)
    assert.doesNotMatch(source, /import\s*\(\s*["']node:/)
  })
})
