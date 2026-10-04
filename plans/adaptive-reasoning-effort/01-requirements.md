# Requirements: Adaptive Reasoning Effort

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

CodeOps dispatches subagents for execution, reviews, and reconnaissance. Today every subagent with
no model pin inherits the parent session's model and reasoning variant; when the parent runs a
reasoning model on its `max` variant, all children run at `max`, and the request cost and latency
are identical whether the work is a trivial docs edit or a concurrency audit. Plans carry no
reasoning guidance, so the choice is invisible until a dispatch runs.

This feature gives CodeOps a per-dispatch reasoning level and a per-plan suggestion:

1. A shared contract defines four levels (`low`, `medium`, `high`, `max`), the marker grammar, the
   resolution precedence, and the suggestion-only / opt-in semantics (03-01).
2. The plugin applies the resolved level on every LLM request, overriding the inherited parent
   variant, with provider-aware and fail-open behavior (03-02).
3. `make-plan` writes an advisory `> **Reasoning**:` line per phase, and `exec-plan` turns it into
   dispatch markers, reports the applied level, and supports an opt-in `--auto-effort` flag for
   inline work (03-03).

Effort is an optimization: no gate, permission, reviewer count, or verification step may depend on
it, and every failure path falls back to the current inherited behavior.

## Functional Requirements

### Must Have

- [ ] REQ-ARE-1 — `_shared/reasoning-effort.md` defines the four levels, the marker grammar, the
  precedence order, the per-skill recommendation table, and the suggestion-only / auto-effort
  contract. (AR #1..#9, #12, #17)
- [ ] REQ-ARE-2 — The plugin captures a standalone `[codeops-effort: <level>]` marker from each
  dispatch message and applies that level to the child session's LLM requests. (AR #9, #10)
- [ ] REQ-ARE-3 — When no marker and no session level exist, the plugin applies
  `routing.roles[<agent>].reasoning` from `codeops/codeops.json`, and only when that entry exists.
  (AR #1, #13)
- [ ] REQ-ARE-4 — A skill run started with `--auto-effort` records its recommended level through
  `scripts/codeops_effort.py`; the plugin applies it to that session until the run clears it or the
  session is deleted. (AR #3, #11)
- [ ] REQ-ARE-5 — `scripts/codeops_effort.py` supports `set`, `clear`, and `status`, validates the
  level against the four-level allowlist, and refuses any directory outside the CodeOps temp root.
  (AR #11, #16)
- [ ] REQ-ARE-6 — `make-plan` writes `> **Reasoning**: <level> — <reason>` into every phase header
  and every task mini-plan, derived from the phase's risk signals. (AR #2, #8)
- [ ] REQ-ARE-7 — `exec-plan` injects the resolved marker into every dispatch packet, reports the
  applied level, prints the phase suggestion for inline work, and accepts `--auto-effort` to change
  the session level for inline phases. (AR #3, #6, #12)
- [ ] REQ-ARE-8 — make-requirements, make-plan, preflight, grill-me, exec-plan, retro-requirements,
  and upgrade-plan accept `--auto-effort` and `--auto-effort=<level>` with the shared parsing rules,
  and print a suggestion when the flag is absent. (AR #3, #5, #7)
- [ ] REQ-ARE-9 — A supported level is applied through the runtime model's own variant options when
  available, otherwise as `reasoningEffort` when the model supports reasoning; unsupported levels
  leave the request unchanged. (AR #14)
- [ ] REQ-ARE-10 — Every failure path (missing or invalid routing config, state file, marker, model
  capability, or helper availability) fails open to the current behavior; plugin hooks never throw
  and never block a request or dispatch. (AR #15, #16)
- [ ] REQ-ARE-11 — The behavior is pinned by executable tests: spec and implementation tests for
  the helper module, spec tests for the CLI helper, and content guards for the contract document,
  plan templates, skill option sections, plugin wiring, and documentation. (AR #18)
- [ ] REQ-ARE-12 — `README.md`, `skills/setup-routing/routing.md`, and `_shared/quality-profile.md`
  document the marker, the flag, the precedence, and the routing-level guidance. (AR #8, #23)

### Should Have

- [ ] REQ-ARE-13 — `codeops_effort.py status` prints the current session level for debugging.
- [ ] REQ-ARE-14 — The execution plan records manual acceptance scenarios as user-owned evidence
  rather than self-certified automated checks.

### Won't Have (Out of Scope)

- Changing `install_agents.py` defaults or generating effort-tiered agents (AR #17)
- Model pins or temperature/`effort` (temperature) policy changes (AR #17)
- Any OpenCode change, new runtime dependency, or new custom tool (AR #17)
- An `inherit` marker or retrofitting plans without a `Reasoning:` line (AR #17)
- Outcome-metric events for effort decisions (AR #17)

## Technical Requirements

### Performance

- The plugin reads at most one small file (state, then routing config) per LLM request; no network
  calls, no subprocesses, and no provider round-trips. All parsing is in-memory.

### Compatibility

- OpenCode 1.18.x plugin hooks (`chat.message`, `chat.params`, `shell.env`, `session.deleted`);
  Node 18+; Python 3.8+.
- The four suggested levels match the assumed default deepseek flash model's variants (its API id
  contains `deepseek-v4`, which adds `max`); other models degrade safely because application is
  variant-aware and fail-open (AR #14).
- Existing projects and plans change behavior only when a marker, a session flag, or an explicit
  routing entry is present (AR #1, #17).

### Security

- Marker and state-file levels are validated against an allowlist before touching provider options;
  no value can inject arbitrary option keys, permissions, or model names (AR #16).
- The state path is resolved and required to be strictly inside the CodeOps temp root; the session
  directory is derived from an already-sanitized session identifier (AR #16).
- No prompt text, marker content, or secrets are logged; the plugin logs only a service-level
  warning that an override was skipped (AR #16).

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
| -------- | ------------------ | ------ | --------- | ------ |
| Automation source | Marker-only, marker + routing, full auto-classification | Marker + routing defaults | Zero behavior change without explicit intent; routing is existing project policy | AR #1 |
| Suggestion granularity | Per phase, per task, plan-level | Per phase | Matches the dispatch unit; no plan noise | AR #2 |
| Parent-session behavior | Advise-only, always auto, opt-in flag | Opt-in `--auto-effort` | User keeps control; flag is explicit and announced | AR #3 |
| Level set | Four deepseek levels, full enum | `low/medium/high/max` | Matches the assumed default model's variants | AR #4 |
| Runtime override point | Task parameter, plugin hooks, tiered agents | Plugin `chat.message` + `chat.params` | No Task parameter exists; variant merges last, so agent options are insufficient | AR #10 |
| Session state transport | Custom tool, helper script + file, env var | Helper script + per-session file | No permanent tool surface; matches `codeops_*.py` + `$CODEOPS_TMPDIR` pattern | AR #11 |
| Routing scope | Built-in defaults, explicit entries only | Explicit `routing.roles` entries only | Policy stays where projects already write it | AR #13 |

> **Traceability:** every decision above references the register entry that resolved it; full
> resolutions and evidence are in [00-ambiguity-register.md](00-ambiguity-register.md).

## Acceptance Criteria

1. [ ] All 24 tasks in `99-execution-plan.md` are `[x]` with passing verification.
2. [ ] `npm run verify` (type-check + `node --test` + version parity) passes.
3. [ ] Every ST case in `07-testing-strategy.md` is covered by a passing test or is a recorded
   user-owned manual scenario.
4. [ ] No gate, permission, reviewer requirement, or verification step reads or depends on an
   effort level.
5. [ ] Documentation updated: `README.md`, `_shared/reasoning-effort.md`,
   `skills/setup-routing/routing.md`, and `_shared/quality-profile.md`.
