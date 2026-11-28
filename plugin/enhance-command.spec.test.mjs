/**
 * Specification tests for the `/enhance` command.
 *
 * These tests pin the observable contract of the command: the feature-detected
 * registration guard, how an invocation is submitted back to the same session,
 * the `--ask` option, the usage reply for an empty prompt, the instruction
 * rules the agent receives, and the plugin wiring with and without the host's
 * command API.
 *
 * This is the specification oracle: a failing test means the implementation is
 * wrong, never the test.
 *
 * @module enhance-command.spec.test
 */

import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, describe, it } from "node:test"

/** Fixture temp bases created by this suite; removed on exit. */
const fixtures = []

after(() => {
  while (fixtures.length > 0) {
    rmSync(fixtures.pop(), { recursive: true, force: true })
  }
})

/**
 * Import the module under test per call, so this file loads and reports
 * per-test failures before the module exists.
 *
 * @returns {Promise<object>} The module namespace.
 */
async function enhance() {
  return import("../bin/lib/enhance-command.mjs")
}

/**
 * Build a fake context exposing only the command and session domains.
 *
 * @param {object} [options] - `fail` makes `session.prompt` reject.
 * @returns {{ ctx: object, adds: object[], prompts: object[] }} The context and
 *   the captured command entries and submitted prompts.
 */
function commandContext(options = {}) {
  const adds = []
  const prompts = []
  const ctx = {
    command: {
      transform: async (callback) => {
        await callback({ add: (entry) => adds.push(entry) })
      },
    },
    session: {
      prompt: async (input) => {
        if (options.fail) throw new Error("prompt failed")
        prompts.push(input)
      },
    },
  }
  return { ctx, adds, prompts }
}

/**
 * Register the command on a capturing context and invoke it once.
 *
 * @param {string} text - The argument text the user typed after `/enhance`.
 * @param {object[]} [files] - Composer attachments on the invocation.
 * @returns {Promise<object>} The single submitted prompt input.
 */
async function invoke(text, files) {
  const { registerEnhanceCommand } = await enhance()
  const { ctx, adds, prompts } = commandContext()
  assert.equal(await registerEnhanceCommand(ctx), true)
  const prompt = files ? { text, files } : { text }
  await adds[0].execute({ sessionID: "s1", prompt, delivery: "queue" })
  assert.equal(prompts.length, 1, "one prompt is submitted per invocation")
  return prompts[0]
}

describe("registration guard", () => {
  it("EC-1 — returns false without throwing when the host lacks the command or prompt API", async () => {
    const { registerEnhanceCommand } = await enhance()
    const prompt = async () => {}

    assert.equal(await registerEnhanceCommand({}), false)
    assert.equal(await registerEnhanceCommand({ command: {}, session: { prompt } }), false)
    assert.equal(
      await registerEnhanceCommand({ command: { transform: async () => {} }, session: {} }),
      false
    )
    assert.equal(
      await registerEnhanceCommand({
        command: {
          transform: async () => {
            throw new Error("no editor")
          },
        },
        session: { prompt },
      }),
      false
    )
  })

  it("EC-2 — adds one described `enhance` command whose run never throws", async () => {
    const { registerEnhanceCommand } = await enhance()
    const { ctx, adds } = commandContext({ fail: true })

    assert.equal(await registerEnhanceCommand(ctx), true)
    assert.equal(adds.length, 1)
    assert.equal(adds[0].name, "enhance")
    assert.match(adds[0].description, /improve/i)
    await adds[0].execute({ sessionID: "s1", prompt: { text: "What is X?" }, delivery: "steer" })
  })
})

describe("invocation", () => {
  it("EC-3 — submits to the same session, keeps attachments and delivery, and runs without a pause", async () => {
    const files = [{ uri: "file:///w/notes.md", name: "notes.md" }]
    const submitted = await invoke("Which queue fits our\nevent volume?", files)

    assert.equal(submitted.sessionID, "s1")
    assert.equal(submitted.delivery, "queue")
    assert.deepEqual(submitted.files, files)
    assert.ok(
      submitted.text.includes("Which queue fits our\nevent volume?"),
      "the user's prompt is carried verbatim"
    )
    assert.match(submitted.text, /run the improved prompt now/i)
    assert.doesNotMatch(submitted.text, /wait for the user's go-ahead/i)
  })

  it("EC-4 — a leading `--ask` pauses after the improved prompt; elsewhere it is prompt text", async () => {
    const { parseEnhanceArguments } = await enhance()

    assert.deepEqual(parseEnhanceArguments("--ask  What is X?"), { ask: true, prompt: "What is X?" })
    assert.deepEqual(parseEnhanceArguments("/enhance What is X?"), { ask: false, prompt: "What is X?" })
    assert.deepEqual(parseEnhanceArguments("Compare A --ask B"), {
      ask: false,
      prompt: "Compare A --ask B",
    })

    const submitted = await invoke("--ask What is X?")
    assert.match(submitted.text, /wait for the user's go-ahead/i)
    assert.doesNotMatch(submitted.text, /run the improved prompt now/i)
    assert.ok(!submitted.text.includes("--ask What"), "the option token is removed")
  })

  it("EC-5 — an empty prompt gets a usage reply instead of the enhancement steps", async () => {
    for (const text of ["", "   ", "--ask"]) {
      const submitted = await invoke(text)
      assert.match(submitted.text, /Usage: `\/enhance \[--ask\] <prompt>`/)
      assert.doesNotMatch(submitted.text, /Ask what matters/)
    }
  })
})

describe("instruction rules", () => {
  it("EC-6 — the agent looks around, asks what matters, shows the improved prompt, then acts", async () => {
    const { buildEnhancePrompt } = await enhance()
    const text = buildEnhancePrompt({ prompt: "How should we cache API responses?", ask: false })

    // Step 1: brief grounding in the repo and the web.
    assert.match(text, /AGENTS\.md/)
    assert.match(text, /1–3 quick web searches/)
    // Step 2: as many questions as matter, in batches, never an interview.
    assert.match(text, /question tool/)
    assert.match(text, /as many as needed/i)
    assert.match(text, /at most one follow-up batch/i)
    assert.match(text, /not a requirements interview/i)
    assert.match(text, /write no files/i)
    // Step 3: the improved prompt's parts.
    for (const part of ["Goal", "Context", "Also consider", "You'll also want to know", "A good answer", "Assumptions"]) {
      assert.ok(text.includes(`**${part}**`), `the improved prompt names ${part}`)
    }
    // Guardrail: add angles, never change the goal or add work.
    assert.match(text, /never change the goal/i)
    // A better-fitting CodeOps skill is suggested, never switched to.
    for (const skill of ["deep-research", "grill-me", "make-plan", "make-requirements"]) {
      assert.ok(text.includes(skill), `names ${skill}`)
    }
    assert.match(text, /do not switch/i)
    // The prompt sits between explicit markers.
    assert.match(text, /<prompt>\nHow should we cache API responses\?\n<\/prompt>/)
  })
})

describe("plugin wiring", () => {
  /**
   * Build a fake server plugin context mirroring only the surface `setup` uses.
   *
   * @param {string} directory - Project directory reported by the context.
   * @param {object[]|null} commandAdds - Captured command entries, or `null`
   *   for a host without the command API.
   * @returns {object} The fake context.
   */
  function pluginContext(directory, commandAdds) {
    const ctx = {
      location: { directory },
      app: { version: "2.0.26" },
      event: { subscribe: () => (async function* () {})() },
      session: { hook: async () => {}, prompt: async () => {} },
      shell: { hook: async () => {} },
      tool: { hook: async () => {} },
      model: { list: async () => ({ data: [] }) },
    }
    if (commandAdds) {
      ctx.command = {
        transform: async (callback) => {
          await callback({ add: (entry) => commandAdds.push(entry) })
        },
      }
    }
    return ctx
  }

  it("EC-7 — setup registers `/enhance` when the host supports commands and completes without it", async () => {
    const base = mkdtempSync(join(tmpdir(), "codeops-enhance-"))
    fixtures.push(base)
    const previousTmpdir = process.env.TMPDIR
    const previousHome = process.env.HOME
    process.env.TMPDIR = base
    process.env.HOME = base
    try {
      const plugin = (await import("../plugin/index.ts")).default

      const adds = []
      const cleanupWith = await plugin.setup(pluginContext(base, adds))
      assert.deepEqual(
        adds.map((entry) => entry.name),
        ["enhance"]
      )
      await cleanupWith()

      const cleanupWithout = await plugin.setup(pluginContext(base, null))
      assert.equal(typeof cleanupWithout, "function")
      await cleanupWithout()
    } finally {
      if (previousTmpdir === undefined) delete process.env.TMPDIR
      else process.env.TMPDIR = previousTmpdir
      if (previousHome === undefined) delete process.env.HOME
      else process.env.HOME = previousHome
    }
  })
})
