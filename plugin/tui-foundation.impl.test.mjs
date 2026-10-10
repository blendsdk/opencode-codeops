/**
 * Implementation tests for the TUI foundation helper.
 *
 * These tests cover the payload guard's accept/reject surface and the schema
 * invariants of the shared RPC definition. Unlike the spec suite, they may
 * derive from the implementation's internals and evolve with them.
 *
 * @module tui-foundation.impl.test
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { CodeOpsRpc, isCodeOpsStatus, requestStatus } from "../bin/lib/codeops-rpc.mjs"

describe("isCodeOpsStatus payload guard", () => {
  it("should accept exactly the three string fields", () => {
    assert.equal(
      isCodeOpsStatus({
        pluginVersion: "2.1.1",
        openCodeVersion: "2.0.24",
        directory: "/project",
      }),
      true
    )
  })

  it("should reject payloads missing a field", () => {
    assert.equal(isCodeOpsStatus({}), false)
    assert.equal(isCodeOpsStatus({ pluginVersion: "2.1.1", openCodeVersion: "2.0.24" }), false)
    assert.equal(isCodeOpsStatus({ pluginVersion: "2.1.1", directory: "/project" }), false)
    assert.equal(isCodeOpsStatus({ openCodeVersion: "2.0.24", directory: "/project" }), false)
  })

  it("should reject payloads with extra fields", () => {
    assert.equal(
      isCodeOpsStatus({
        pluginVersion: "2.1.1",
        openCodeVersion: "2.0.24",
        directory: "/project",
        extra: true,
      }),
      false
    )
  })

  it("should reject payloads whose fields are not strings", () => {
    assert.equal(
      isCodeOpsStatus({ pluginVersion: 211, openCodeVersion: "2.0.24", directory: "/project" }),
      false
    )
    assert.equal(
      isCodeOpsStatus({ pluginVersion: "2.1.1", openCodeVersion: null, directory: "/project" }),
      false
    )
    assert.equal(
      isCodeOpsStatus({ pluginVersion: "2.1.1", openCodeVersion: "2.0.24", directory: ["x"] }),
      false
    )
  })

  it("should reject non-object payloads", () => {
    for (const value of [undefined, null, "text", 42, true, ["2.1.1", "2.0.24", "/project"]]) {
      assert.equal(isCodeOpsStatus(value), false, `must reject ${JSON.stringify(value)}`)
    }
  })
})

describe("requestStatus transport containment", () => {
  it("should return the raw payload when the status call resolves", async () => {
    const payload = { pluginVersion: "2.1.1", openCodeVersion: "2.0.24", directory: "/project" }
    const client = { rpc: () => ({ status: async () => payload }) }

    assert.deepEqual(await requestStatus(client), payload)
  })

  it("should return undefined when the status call rejects", async () => {
    const client = {
      rpc: () => ({
        status: async () => {
          throw new Error("rpc unavailable")
        },
      }),
    }

    assert.equal(await requestStatus(client), undefined)
  })

  it("should return undefined when the client rpc accessor throws", async () => {
    const client = {
      rpc: () => {
        throw new Error("no rpc API")
      },
    }

    assert.equal(await requestStatus(client), undefined)
  })
})

describe("codeops RPC definition invariants", () => {
  it("should keep one status method with an empty-object input and no events", () => {
    assert.equal(CodeOpsRpc.id, "codeops")
    assert.deepEqual(Object.keys(CodeOpsRpc.methods), ["status"])
    assert.deepEqual(CodeOpsRpc.methods.status.input, {
      type: "object",
      additionalProperties: false,
    })
    assert.deepEqual(CodeOpsRpc.events, {})
  })

  it("should require exactly the three string fields in the output schema", () => {
    const output = CodeOpsRpc.methods.status.output

    assert.equal(output.type, "object")
    assert.equal(output.additionalProperties, false)
    assert.deepEqual(output.required, ["pluginVersion", "openCodeVersion", "directory"])
    assert.deepEqual(output.properties, {
      pluginVersion: { type: "string" },
      openCodeVersion: { type: "string" },
      directory: { type: "string" },
    })
  })
})
