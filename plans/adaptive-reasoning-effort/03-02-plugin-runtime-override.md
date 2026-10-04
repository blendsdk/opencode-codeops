# Plugin Runtime Override: Adaptive Reasoning Effort

> **Document**: 03-02-plugin-runtime-override.md
> **Parent**: [Index](00-index.md)

This document owns the runtime mechanism: the pure helper module, the plugin hook wiring, the
per-session state file, the application algorithm, and every failure path. The contract (levels,
grammar, precedence) is owned by [03-01](03-01-reasoning-effort-contract.md).

## Helper module — `bin/lib/reasoning-effort.mjs`

A framework-free ES module (mirroring `bin/lib/tmp-hygiene.mjs`) so the behavior is testable with
`node --test`. It imports `sessionTmpDir` from `./tmp-hygiene.mjs`.

| Export | Contract |
| ------ | -------- |
| `EFFORT_LEVELS` | `["low","medium","high","max"]` (frozen) |
| `isEffortLevel(value)` | Type guard: true only for the four exact lower-case strings |
| `ROUTING_REASONING_VALUES` | The seven values accepted by `routing.roles.*.reasoning` (`none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, frozen) |
| `isRoutingReasoning(value)` | Type guard for the routing enum; routing is trusted project config and may name provider-native levels beyond the four suggestion levels |
| `findEffortMarker(texts)` | Scans each text's lines with the anchored marker regex; returns the first valid `EffortLevel`, else `undefined`; never throws on non-string items |
| `resolveEffort({ marker, session, routing })` | Returns the first defined of `marker`, `session`, `routing`; `marker`/`session` must pass `isEffortLevel`, `routing` must pass `isRoutingReasoning` |
| `sessionEffortPath(sessionID, base)` | `join(sessionTmpDir(sessionID, base), "reasoning-effort.json")` |
| `readSessionEffort(sessionID, base)` | Reads and validates the state file; a missing file, a non-regular file (symlinks are never followed), a file larger than 4 KiB, or any read/parse/shape failure returns `undefined` |
| `readRoutingReasoning(config, agent)` | Validates `config.routing.roles[agent].reasoning` against the full routing enum (`none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`) and returns it, else `undefined`; tolerates any malformed shape |
| `extractModelVariants(model)` | Returns the runtime `variants` record when it is a plain object, else `undefined`; uses an `in` check, never a cast |
| `modelSupportsReasoning(model)` | Reads `model.capabilities.reasoning` through a safe shape check; unknown shapes return `false` |
| `applyEffort(options, level, model)` | Pure; returns the original object when no safe change applies, or a new merged object |
| `deepMergePlain(target, source)` | Recursive merge for plain objects; non-plain values and arrays are replaced; neither input is mutated |
| `parseStateFile(text)` | Parses `{schema:1, reasoning: <level>}`; returns level or `undefined` |

### Application algorithm (`applyEffort`)

1. `level` fails `isRoutingReasoning` (the four suggestion levels are a subset of this enum) →
   return `options` unchanged.
2. `modelSupportsReasoning(model)` is false → return `options` unchanged (the caller logs a
   single deduplicated warning when an explicit marker requested the level).
3. `extractModelVariants(model)` returns a record:
   - the level is absent, or its value is not a plain object → return unchanged (unsupported by
     this model; this is the guard that stops an invalid provider value).
   - otherwise → return `deepMergePlain(options, variants[level])`. OpenCode's own variant mapping
     is provider-aware (for example `reasoningEffort` for OpenAI-compatible, `reasoning.{effort}`
     for OpenRouter), so no provider key is hardcoded.
4. No variants record exists → return `{ ...options, reasoningEffort: level }` (the documented
   passthrough for the assumed deepseek default, AR #14).

`deepMergePlain` merges plain objects recursively and replaces everything else; arrays and class
instances are replaced, not merged. The function never mutates its inputs.

## Plugin wiring — `plugin/index.ts`

Two new hooks plus one lifecycle extension (AR #10):

| Hook | Behavior |
| ---- | -------- |
| `chat.message` | Scans the message's text parts with `findEffortMarker`; stores `markers.set(message.id, { sessionID, level })` when found. The marker map is module-scope in the plugin closure. |
| `chat.params` | Resolves the level with `resolveEffort` (marker by `input.message.id`, then `readSessionEffort(input.sessionID)`, then routing from the project config) and calls `applyEffort(output.options, level, input.model)`; assigns `output.options` only when a new object is returned. |
| `event` (`session.deleted`) | Deletes every marker entry whose stored `sessionID` matches; the temp directory (and therefore the state file) is removed by the existing `removeSessionTmpDir` call. |

Routing config read: `readFileSync(join(directory, "codeops", "codeops.json"))` parsed as JSON and
passed to `readRoutingReasoning` with `input.agent`. The read is small, local, and wrapped; a
missing or invalid file yields no routing override.

The capture/apply split relies on `chat.message` running before `chat.params` and on both hooks
seeing the same message id; both are verified for OpenCode 1.18.34
(`session/prompt.ts:999-1009`, `session/llm/request.ts:114-121`), and manual scenario MS-1 confirms
the live behavior on a dispatch.

### Failure handling

- Every hook body is wrapped so an unexpected error is logged as a `codeops` service warning and
  the request proceeds unchanged. Hooks never throw and never block (AR #10, #16).
- Unsupported levels are skipped; when an explicit marker requested an unsupported level, one
  warning per session and level is logged (a `Set` in the plugin closure deduplicates), containing
  only the agent name and level — never prompt text.
- The marker map holds only `{sessionID, level}`; it is bounded by live dispatches and cleared on
  session deletion.

## Session state file

Path: `$CODEOPS_TMPDIR` (the plugin-computed session temp directory). File name:
`reasoning-effort.json`.

```json
{"schema": 1, "reasoning": "high", "setAt": "2026-10-04T12:30:00Z"}
```

Written and removed only by `scripts/codeops_effort.py`; read by the plugin on every request
(AR #11, #15). The plugin treats a missing, partially written, or non-conforming file as "no
session effort". The file lives inside the session's scratch directory, so session deletion removes
it with the rest of the scratch.

## CLI helper — `scripts/codeops_effort.py`

Follows `scripts/codeops_outcomes.py`: `from __future__ import annotations`, `argparse`, strict
validation, exit code 2 on invalid input.

| Command | Behavior |
| ------- | -------- |
| `set --dir <path> --reasoning <level>` | Validate the level and the directory, write atomically (temp file + `os.replace` in the same directory), print `Reasoning effort set: <level> for this session run.` |
| `clear --dir <path>` | Remove the file when present; print `Reasoning effort cleared.` |
| `status --dir <path>` | Print the current level or `No session reasoning effort set.` |

Path safety: the resolved `--dir` must exist and resolve strictly inside
`<tempfile.gettempdir()>/opencode/codeops` (the same root `bin/lib/tmp-hygiene.mjs` owns); anything
else exits 2 without writing. The directory name is expected to be the session directory the plugin
already created (`$CODEOPS_TMPDIR`), so no new path logic or environment variable is introduced.

## Edge Cases

| Case | Behavior |
| ---- | -------- |
| Two markers in one dispatch | First valid wins (03-01 §Marker grammar) |
| Marker with an unknown level | Ignored, dispatch proceeds inherited |
| Parent and child session state | Sessions have separate temp directories, so a parent's auto-effort never reaches a child; children rely on markers/routing |
| Plugin restart mid-session | Marker map is lost; the state file survives on disk and keeps applying |
| Routing file edited mid-run | Applied on the next request (fresh read, no cache) |
| Compaction / synthetic messages | No marker is present, so no override is applied |
| Model without reasoning support | `applyEffort` returns unchanged; at most one warning per session/level |

## Security Notes (AR #16)

- Marker and session levels are limited to the four-level allowlist; routing policy may name any
  value from the provider enum, and every value is re-validated per request before it can reach
  `options` through a variant merge or the `reasoningEffort` key; no marker content becomes an
  option key.
- Marker scanning is limited to user-role text parts and the state file is schema-validated.
- State writes are restricted to the CodeOps temp root, and session directory names are already
  sanitized by `bin/lib/tmp-hygiene.mjs`.
- No prompt text, file content, or secret is logged; only agent name, level, and a skip reason.
