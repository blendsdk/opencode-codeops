/**
 * Implementation tests for the specialist-agent installer internals.
 *
 * These tests cover boundaries the specification tests cannot reach cleanly
 * through the CLI: the sanitization fixed point, byte-precise size limits,
 * YAML quoting of hostile values, and frontmatter parser edge cases
 * (colons in values, CRLF files, UTF-8 BOMs, duplicate and malformed lines).
 * Each case runs the real Python module in a subprocess and asserts on a
 * JSON result, so internals stay testable without a second test harness.
 *
 * @module install_agents.impl.test
 */

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { dirname, join, resolve } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const SCRIPTS = join(ROOT, "scripts")

const PRELUDE = `
import json
import sys
sys.path.insert(0, ${JSON.stringify(SCRIPTS)})
import install_agents as ia
`

/**
 * Run a Python snippet with the installer module importable, returning its
 * one-line JSON result.
 * @param {string} body - Python code that prints a JSON value.
 * @returns {unknown} The parsed JSON result.
 */
function runPython(body) {
  const result = spawnSync("python3", ["-c", PRELUDE + body], {
    encoding: "utf8",
    env: { ...process.env, CODEOPS_PLUGIN_ROOT: ROOT },
  })
  assert.equal(result.status, 0, `python failed: ${result.stderr}`)
  const line = result.stdout.trim().split("\n").pop()
  return JSON.parse(line)
}

describe("sanitize_prompt_text", () => {
  it("collapses whitespace, strips control characters, trims, and length-caps", () => {
    const results = runPython(`
print(json.dumps([
    ia.sanitize_prompt_text("a  b", 200),
    ia.sanitize_prompt_text("a\\u0001b", 200),
    ia.sanitize_prompt_text("  padded  ", 200),
    len(ia.sanitize_prompt_text("x" * 250, 200)),
]))`)
    assert.deepEqual(results, ["a b", "ab", "padded", 200])
  })

  it("strips C1 control and Unicode format characters", () => {
    const results = runPython(`
print(json.dumps([
    ia.sanitize_prompt_text("a\\u009bb\\u202ec", 200),
    ia.sanitize_brief_body("a\\u009bb\\n\\u200bc"),
]))`)
    assert.deepEqual(results, ["abc", "ab\nc"])
  })

  it("removes marker sequences to a fixed point with none remaining", () => {
    const results = runPython(`
payloads = ["x --> y", "<!--<!--x-->-->", "<!<!---- STITCH ---->>", "<!--<-->-->--><!--"]
once = [ia.sanitize_prompt_text(value, 200) for value in payloads]
twice = [ia.sanitize_prompt_text(value, 200) for value in once]
print(json.dumps({"once": once, "stable": [a == b for a, b in zip(once, twice)]}))`)
    for (const value of results.once) {
      assert.doesNotMatch(value, /<!--|-->/)
    }
    assert.deepEqual(results.stable, [true, true, true, true])
  })
})

describe("sanitize_brief_body", () => {
  it("removes control characters but preserves newlines and tabs", () => {
    const result = runPython(
      `print(json.dumps(ia.sanitize_brief_body("a\\u0000b\\nc\\td\\r\\n")))`,
    )
    assert.equal(result, "ab\nc\td\n")
  })
})

describe("parse_brief edge cases", () => {
  const parseScript = (contentExpression) => `
import tempfile, pathlib
root = pathlib.Path(tempfile.mkdtemp())
path = root / "my-role.md"
path.write_bytes(${contentExpression})
try:
    parsed = ia.parse_brief(path, "my-role")
    print(json.dumps({"ok": True, "parsed": {k: v for k, v in parsed.items() if k != "body"}, "body": parsed["body"]}))
except ia.BriefError as exc:
    print(json.dumps({"ok": False, "error": str(exc)}))
`

  it("keeps colons inside values and reports body byte size", () => {
    const content = "---\nrole: my-role\nkind: reviewer\ndescription: Check db/x.sql:1 and a:b\n---\n\nBody\n"
    const result = runPython(parseScript(`${JSON.stringify(content)}.encode("utf-8")`))
    assert.equal(result.ok, true, result.error)
    assert.equal(result.parsed.description, "Check db/x.sql:1 and a:b")
    assert.equal(result.parsed.body_bytes, 5)
  })

  it("parses CRLF files and normalizes the body line endings", () => {
    const content = "---\r\nrole: my-role\r\nkind: reviewer\r\ndescription: Hi\r\n---\r\n\r\nBody line\r\n"
    const result = runPython(parseScript(`${JSON.stringify(content)}.encode("utf-8")`))
    assert.equal(result.ok, true, result.error)
    assert.equal(result.parsed.description, "Hi")
    assert.equal(result.body, "Body line\n")
  })

  it("tolerates a UTF-8 BOM", () => {
    const content = "\ufeff---\nrole: my-role\nkind: reviewer\ndescription: Hi\n---\n\nBody\n"
    const result = runPython(parseScript(`${JSON.stringify(content)}.encode("utf-8")`))
    assert.equal(result.ok, true, result.error)
    assert.equal(result.parsed.description, "Hi")
  })

  it("counts the body size in bytes, not characters", () => {
    const content = `---\nrole: my-role\nkind: reviewer\ndescription: Hi\n---\n\n${"€".repeat(6000)}`
    const result = runPython(parseScript(`${JSON.stringify(content)}.encode("utf-8")`))
    assert.equal(result.ok, false)
    assert.match(result.error, /16384/)
  })

  it("rejects duplicate keys, malformed lines, unclosed frontmatter, and role mismatch", () => {
    const cases = [
      "---\nrole: my-role\nrole: my-role\nkind: reviewer\ndescription: Hi\n---\n\nBody\n",
      "---\nrole my-role\nkind: reviewer\ndescription: Hi\n---\n\nBody\n",
      "---\nrole: my-role\nkind: reviewer\ndescription: Hi\n\nBody\n",
      "---\nrole: other-role\nkind: reviewer\ndescription: Hi\n---\n\nBody\n",
    ]
    for (const content of cases) {
      const result = runPython(parseScript(`${JSON.stringify(content)}.encode("utf-8")`))
      assert.equal(result.ok, false, `brief must be rejected: ${content}`)
    }
  })

  it("reports invalid UTF-8 as a clean brief error", () => {
    const result = runPython(`
import tempfile, pathlib
root = pathlib.Path(tempfile.mkdtemp())
path = root / "my-role.md"
path.write_bytes(b"---\\nrole: my-role\\nkind: reviewer\\ndescription: \\xff\\n---\\n\\nBody\\n")
try:
    ia.parse_brief(path, "my-role")
    print(json.dumps({"ok": True}))
except ia.BriefError as exc:
    print(json.dumps({"ok": False, "error": str(exc)}))
`)
    assert.equal(result.ok, false)
    assert.match(result.error, /brief/i)
  })

  it("rejects an oversized brief file before reading it fully", () => {
    const result = runPython(`
import tempfile, pathlib
root = pathlib.Path(tempfile.mkdtemp())
path = root / "my-role.md"
path.write_bytes(b"---\\n" + b"x" * (2 * 1024 * 1024))
try:
    ia.parse_brief(path, "my-role")
    print(json.dumps({"ok": True}))
except ia.BriefError as exc:
    print(json.dumps({"ok": False, "error": str(exc)}))
`)
    assert.equal(result.ok, false)
    assert.match(result.error, /too large/i)
  })

  it("rejects unsupported schema, hidden, effort, and reasoning values", () => {
    const cases = [
      "---\nschema: 2\nrole: my-role\nkind: reviewer\ndescription: Hi\n---\n\nBody\n",
      "---\nrole: my-role\nkind: reviewer\ndescription: Hi\nhidden: yes\n---\n\nBody\n",
      "---\nrole: my-role\nkind: reviewer\ndescription: Hi\neffort: extreme\n---\n\nBody\n",
      "---\nrole: my-role\nkind: reviewer\ndescription: Hi\nreasoning: turbo\n---\n\nBody\n",
    ]
    for (const content of cases) {
      const result = runPython(parseScript(`${JSON.stringify(content)}.encode("utf-8")`))
      assert.equal(result.ok, false, `brief must be rejected: ${content}`)
    }
  })
})

describe("generate_custom_agent YAML quoting", () => {
  it("quotes and escapes hostile description values exactly", () => {
    const hostile = 'He said "hi" \\ on [unterminated *alias # tag'
    const result = runPython(`
import tempfile, pathlib
root = pathlib.Path(tempfile.mkdtemp())
path = root / "my-role.md"
path.write_text('---\\nrole: my-role\\nkind: reviewer\\ndescription: ' + ${JSON.stringify(hostile)} + '\\n---\\n\\nBody\\n', encoding="utf-8")
brief = ia.parse_brief(path, "my-role")
content = ia.generate_custom_agent(pathlib.Path(${JSON.stringify(ROOT)}), "my-role", brief, {})
line = next(line for line in content.split("\\n") if line.startswith("description: "))
print(json.dumps(json.loads(line[len("description: "):])))
`)
    assert.equal(result, hostile)
  })
})
