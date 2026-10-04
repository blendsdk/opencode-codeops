# Testing Strategy: Adaptive Reasoning Effort

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Core parsing/precedence/application (`bin/lib/reasoning-effort.mjs`) | 90%+ branches |
| CLI helper (`scripts/codeops_effort.py`) | 100% command paths and validation exits |
| Shipped contract and skill docs | 100% of required clauses asserted by content guards |
| Plugin hook wiring | Type-checked and content-guarded; exercised by user-owned manual scenarios |

- Test names state behavior: `should [expected behavior] when [condition]`.
- Real filesystem fixtures are used instead of mocks; the Python CLI is spawned as a real process
  (the pattern in `scripts/install_agents.spec.test.mjs`). No network and no live LLM calls.
- **E2E: N/A** — a live end-to-end check would require a running OpenCode server and a real provider
  request. Manual scenarios MS-1…MS-3 (below) cover that layer as user-owned acceptance evidence
  (AR #14); they are never self-certified by an executor.
- Security tests are mandatory and mapped below (ST-1, ST-5, ST-10, ST-12).

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> These cases are derived from [03-01](03-01-reasoning-effort-contract.md),
> [03-02](03-02-plugin-runtime-override.md), and [03-03](03-03-plan-skill-integration.md). They
> define expected behavior BEFORE implementation. **Immutable-oracle rule:** never edit an
> expectation to match the implementation.

### Marker parsing — `bin/reasoning-effort.spec.test.mjs`

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | --- | --- | --- |
| ST-1 | Single line `[codeops-effort: medium]` | `findEffortMarker` returns `"medium"` | 03-01 §Marker grammar, AR #9 |
| ST-2 | Line with surrounding spaces/tabs | Returns the level | 03-01 §Marker grammar |
| ST-3 | Two valid markers, `low` before `max` | Returns `"low"` (first valid wins) | 03-01 §Marker grammar rule 4 |
| ST-4 | `[codeops-effort: HIGH]`, `[codeops-effort: none]`, `[codeops-effort: max] extra`, `x [codeops-effort: low]` | `undefined` for each (malformed is ignored) | 03-01 §Marker grammar rules 1–2 |
| ST-5 | Marker text passed among non-text / non-string parts | Text parts are scanned; non-text entries are skipped without error | 03-02 §Helper module, AR #16 |

### Precedence and routing — `bin/reasoning-effort.spec.test.mjs`

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | --- | --- | --- |
| ST-6 | `{marker:"medium", session:"high", routing:"low"}` | `"medium"` | 03-01 §Precedence |
| ST-7 | `{marker:undefined, session:"high", routing:"low"}` | `"high"` | 03-01 §Precedence |
| ST-8 | `{marker:undefined, session:undefined, routing:"low"}` | `"low"` | 03-01 §Precedence |
| ST-9 | All undefined, or invalid values (`"extreme"`, `42`) | `undefined`; invalid values ignored, no throw | 03-02 §Helper module |
| ST-10 | Config `{routing:{roles:{executor:{reasoning:"high"}}}}`, agent `executor` | `"high"` | 03-01 §Precedence, AR #13 |
| ST-11 | Unknown agent, missing `routing`, `config` null/array/string, `reasoning:"bogus"` | `undefined` for each | 03-02 §Helper module |
| ST-12 | Routing value `"xhigh"` (provider enum member) | `resolveEffort` returns `"xhigh"`; `applyEffort` merges the `xhigh` variant when the model exposes it, else returns options unchanged | 03-02 §Helper module, AR #13 |

### Application — `bin/reasoning-effort.spec.test.mjs`

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | --- | --- | --- |
| ST-13 | Variants expose `{medium:{reasoningEffort:"medium"}}`; level `medium` | New options with `reasoningEffort:"medium"`; other keys preserved | 03-02 §Application step 3, AR #14 |
| ST-14 | Variants record exists but lacks the level | Original options returned (identity), no provider write | 03-02 §Application step 3 |
| ST-15 | `capabilities.reasoning` false | Original options returned | 03-02 §Application step 2 |
| ST-16 | No variants, reasoning supported, level `low` | `reasoningEffort:"low"` added; input object not mutated | 03-02 §Application step 4 |
| ST-17 | Nested variant options (`{reasoning:{effort:"max"}}`) merged over existing `{reasoning:{effort:"high"}, topP:0.9}` | `effort` becomes the variant value; `topP` preserved; merge is pure | 03-02 §Helper module (`deepMergePlain`), AR #14 |

### Session state read — `bin/reasoning-effort.spec.test.mjs`

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | --- | --- | --- |
| ST-18 | Valid file at `sessionTmpDir(id)/reasoning-effort.json` | `readSessionEffort` returns the level | 03-02 §Session state file, AR #11 |
| ST-19 | Missing file, invalid JSON, `schema:2`, unknown level | `undefined` for each; no throw | 03-02 §Failure handling, AR #15 |

### CLI helper — `scripts/effort.spec.test.mjs` (spawns `python3`)

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | --- | --- | --- |
| ST-20 | `set --dir <session-dir> --reasoning high` | Exit 0; file contains `{"schema":1,"reasoning":"high",...}`; no `*.tmp` remains | 03-02 §CLI helper, AR #15 |
| ST-21 | `status` after `set`, then `clear`, then `status` | Prints the level, then `No session reasoning effort set.`; file removed | 03-02 §CLI helper |
| ST-22 | `set --reasoning extreme` | Exit 2; no file written; error names the allowed levels | 03-02 §CLI helper, AR #16 |
| ST-23 | `set --dir <outside the CodeOps temp root>` | Exit 2; no file written | 03-02 §CLI helper path safety, AR #16 |

### Content guards — `scripts/reasoning-effort-content.spec.test.mjs`

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | --- | --- | --- |
| ST-24 | Read `_shared/reasoning-effort.md` | Has the schema stamp; contains all four levels, the marker literal, the precedence chain, the seven-skill table, the derivation signals, and the suggestion-only guarantee | REQ-ARE-1, 03-01 |
| ST-25 | Read `plugin/index.ts` | Contains `"chat.message"` and `"chat.params"` hook keys and imports `reasoning-effort.mjs` | REQ-ARE-2, 03-02 |
| ST-26 | Read `skills/make-plan/templates.md` and `SKILL.md` | Phase template and mini-plan shape contain `> **Reasoning**:`; SKILL.md links `_shared/reasoning-effort.md` | REQ-ARE-6, 03-03 |
| ST-27 | Read `skills/exec-plan/execution-protocol.md` and `SKILL.md` | Packet rule contains `[codeops-effort:`, inline rule contains `Suggested reasoning:`, and the flag section names `--auto-effort` | REQ-ARE-7, 03-03 |
| ST-28 | Read the seven skill files | Each contains `--auto-effort` and links `_shared/reasoning-effort.md`; preflight documents `max` with `--thorough` | REQ-ARE-8, 03-01 §Skill table |
| ST-29 | Read `README.md`, `skills/setup-routing/routing.md`, `_shared/quality-profile.md` | README documents the marker and flag; routing.md has the policy subsection; quality-profile links `reasoning-effort.md` | REQ-ARE-12, 03-03 §Documentation |

## Implementation Tests — `bin/reasoning-effort.impl.test.mjs`

Written after implementation; derived from internals:

- `deepMergePlain` edge cases: arrays replaced, `undefined` sources, nested three levels, empty
  objects, key collisions, non-mutation of both inputs.
- `findEffortMarker` line-ending handling (`\r\n`, `\r`), very long text, first-match across
  multiple text parts, empty/whitespace-only input.
- `extractModelVariants` and `modelSupportsReasoning` with `null`, arrays, functions, and objects
  with hostile `__proto__`/constructor-shaped keys (no prototype pollution, no throw).
- `readSessionEffort` with a directory in place of the file, oversized file, and symlinked file
  (returns `undefined`, never follows into unexpected paths).
- `applyEffort` returns the identical object reference when unchanged.

## Integration Tests

| Test | Components | Description |
| ---- | ---------- | ----------- |
| Plugin wiring contract | `plugin/index.ts` ↔ `bin/lib/reasoning-effort.mjs` | Covered by type-check plus the ST-25 content guard; a live hook invocation belongs to the manual scenarios |
| CLI ↔ filesystem | `scripts/codeops_effort.py` ↔ session temp dir | ST-20…ST-23 exercise the real script against real temp directories |

## End-to-End Tests

| Scenario | Steps | Expected Result |
| -------- | ----- | --------------- |
| N/A | — | A real dispatch requires a running OpenCode server and a provider call; manual scenarios replace it (recorded, user-owned) |

## Manual Acceptance Scenarios (user-owned)

| # | Scenario | Expected observation |
| --- | -------- | -------------------- |
| MS-1 | Parent session on the deepseek flash model with the `max` variant; dispatch an executor whose packet carries `[codeops-effort: medium]` | The child's request shows `medium` reasoning; the task completes at lower cost than before |
| MS-2 | Run `make-requirements --auto-effort` on a small request | `Auto-effort active — reasoning high applied for this run` appears; the session's requests use `high`; the final summary follows `clear` |
| MS-3 | Configure `routing.roles.executor.reasoning = "medium"` and dispatch an executor with no marker | `medium` applies; removing the routing entry returns to inherited behavior |
| MS-4 | Configure an unsupported routing value for the active model and dispatch | The dispatch still completes unchanged; at most one skip warning appears |

## Security Test Cases

| Case | Coverage |
| ---- | -------- |
| Level allowlist and malformed markers | ST-4, ST-9, ST-22 |
| Unsupported level never reaches the provider | ST-14 |
| Path traversal / writes outside the CodeOps temp root | ST-23 |
| Malformed config/state shapes without throws or prototype pollution | ST-11, ST-19, impl-test edge cases |

## Test Data

- Temporary session directories created under a fixture temp base (`TMPDIR` is overridden in the
  spawning tests so both Node and Python resolve the same CodeOps root).
- Small JSON fixtures for routing config and state files; no user or secret data ever appears in a
  fixture.

## Test File Map

| File | Type | Covers |
| ---- | ---- | ------ |
| `bin/reasoning-effort.spec.test.mjs` | specification | ST-1…ST-19 |
| `bin/reasoning-effort.impl.test.mjs` | implementation | Internal edges listed above |
| `scripts/effort.spec.test.mjs` | specification (spawns `python3`) | ST-20…ST-23 |
| `scripts/reasoning-effort-content.spec.test.mjs` | specification (content) | ST-24…ST-29 |
| `npm run verify` | full verify | Type-check, all `node --test` suites, version parity |

## Verify Command

`npm run verify` (type-check + `node --test` + version parity), confirmed in AR #22. Every phase's
Verify line uses it.
