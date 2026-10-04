# Reasoning Effort Contract: Adaptive Reasoning Effort

> **Document**: 03-01-reasoning-effort-contract.md
> **Parent**: [Index](00-index.md)

This document owns the shared contract published as `_shared/reasoning-effort.md` and consumed by
the plugin, the plan skills, and `setup-routing`. Specifications below are the source; the shipped
document restates them for runtime consumers.

## Levels

| Level | Meaning | Typical work |
| ----- | ------- | ------------ |
| `low` | Mechanical, fully specified, deterministic verification | Docs and formatting edits, renames, config updates |
| `medium` | Ordinary bounded feature work with known patterns | Standard implementation phases, recon, single-file reviews |
| `high` | Correctness- or security-sensitive, cross-cutting, or planning/review work | Requirements, planning, correctness/security review, ambiguous implementation |
| `max` | Adversarial or high-risk analysis where a missed detail is costly | Preflight `--thorough`, complex/sensitive or financial/concurrency/migration/semantic phases |

The four levels are the complete suggestion vocabulary (AR #4). They are validated at runtime
before any provider option is written; when the runtime model does not expose a level, the request
is left unchanged (03-02 §Application).

Routing policy is project config, not a suggestion: `routing.roles.<agent>.reasoning` may name any
value declared by the config schema (`none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`),
and 03-02 applies it when the runtime model exposes that value. Markers, session flags, and plan
suggestions remain limited to the four levels.

## Marker grammar

A dispatch marker is one standalone line in the dispatch message:

```text
[codeops-effort: <level>]
```

Rules (AR #9):

1. The whole trimmed line must match `^\[codeops-effort:\s*(low|medium|high|max)\]\s*$`.
2. The level is exactly lower-case. Unknown or malformed markers are ignored, never errors.
3. Only user-role text parts of a message are scanned; tool output, diffs, and quoted documents
   are never scanned.
4. The first valid marker in message order wins; additional markers are ignored.
5. The marker is deliberately distinct from the human-readable plan line `> **Reasoning**: …`, so a
   quoted plan line can never act as a machine directive.

Placement (03-03 owns the dispatch rules): after the `[codeops-dispatch …]` header for
quality-agent packets, or as the first line for executor, spec-author, and scout packets.

## Precedence

When more than one source exists, the most specific wins (AR #12):

```text
dispatch marker  >  session auto-effort  >  routing.roles[<agent>].reasoning  >  inherit parent variant
```

| Source | Scope | Owner |
| ------ | ----- | ----- |
| Dispatch marker | One child dispatch | `exec-plan` composes it from the phase suggestion or the run's forced level |
| Session auto-effort | One skill run in the user's session | `--auto-effort` through `scripts/codeops_effort.py` |
| Routing role default | Project policy for one agent name | `codeops/codeops.json` → `routing.roles.<agent>.reasoning` |
| Inherit | Everything else | Current behavior: parent model and variant |

Routing lookup applies only when the dispatching agent's name has an explicit `routing.roles`
entry (AR #13). There are no built-in catalog defaults, hand-authored agents are untouched, and
generated specialists keep their embedded value unless the project adds a routing entry.

## Skill recommendation table

Used for suggestions and for bare `--auto-effort` (AR #8).

| Skill | Recommended level | Notes |
| ----- | ----------------- | ----- |
| make-requirements (make-requirements, add_requirement, review_requirements) | `high` | Structured discovery and gap expansion |
| make-plan | `high` | Decomposition plus the Zero-Ambiguity Gate |
| preflight | `high`; `max` with `--thorough` | Adversarial multi-dimension audit |
| grill-me | `high` | Branch-by-branch disambiguation |
| exec-plan | current phase's `Reasoning:` level | Bare flag follows the phase; `=<level>` forces a constant |
| retro-requirements | `high` | Nine-phase archaeology |
| upgrade-plan | `high` | Content gate plus structural migration |
| setup-codeops, setup-routing | `high` (reference only) | Structure and policy authoring |
| techdocs, analyze-project, clean-comments, outcome-review | `medium` (reference only) | Structured but bounded |
| roadmap, git-commit, github-issues | `low` (reference only) | Mechanical bookkeeping |

## Plan suggestion derivation

`make-plan` derives the advisory phase level from signals it already records (AR #2, #8):

| Signal | Suggested level |
| ------ | --------------- |
| Phase carries a `Technical (complexity escalation)` approval, or a complex/sensitive tag | `max` |
| Phase carries a security, financial-integrity, concurrency, performance-critical, compiler-semantics, or migration lens/risk tag | `high` |
| Docs/config/rename-only phase with deterministic verification | `low` |
| Any other non-trivial phase | `medium` |

The line is written as `> **Reasoning**: <level> — <one-line reason>`. It is a suggestion: the
user may edit or delete it, and `exec-plan` never blocks on it. Plans without the line keep
today's inherited behavior (AR #17).

## Auto-effort option

Skills listed in the table's first seven rows accept the flag; other skills document their
recommended levels for reference only and do not implement the flag. Parsing follows the existing
standalone-token pattern (`--auto-design`, `--explore-scope`): exactly one occurrence before the
first `--` sentinel, removed before target resolution; zero means advise-only; more than one or an
invalid `=<level>` is an argument error.

| Flag | Behavior |
| ---- | -------- |
| *(absent)* | Print `Suggested reasoning: <level> — <reason>` once at start; change nothing |
| `--auto-effort` | Use the skill's recommended level (exec-plan: current phase level) |
| `--auto-effort=<level>` | Use the named level; reject values outside the four-level set |

For `exec-plan`, a bare flag composes each dispatch marker from the current phase's suggestion,
while `--auto-effort=<level>` composes every dispatch marker at the named level for the whole run
(03-03 §Dispatch packets).

Semantics (AR #3, #11, #15):

1. Announce: `Auto-effort active — reasoning <level> applied for this run`.
2. Record through `python3 "${CODEOPS_PLUGIN_ROOT}/scripts/codeops_effort.py" set --dir "$CODEOPS_TMPDIR" --reasoning <level>`.
3. Clear at run completion (before the final summary) with `clear --dir "$CODEOPS_TMPDIR"`.
4. Run-scoped: the level applies from the point it is set until cleared or the session is deleted.
5. Fail-open: when `$CODEOPS_TMPDIR` is empty or the helper fails, print an advise-only note and
   continue; the skill never blocks and never changes permissions or gates.
6. Never a gate: effort affects cost and latency only. No readiness check, verification step,
   reviewer requirement, or finding gate may read it.

## Suggestion-only guarantee

| Allowed | Forbidden |
| ------- | --------- |
| Printing a suggested level and its reason | Blocking a run because a level is missing or unsupported |
| Applying a level when a marker, flag, or routing entry explicitly asks | Overriding an explicit user plan edit with a derived default |
| Reporting the applied level and its source | Treating effort as an acceptance, review, or security control |

## Documentation requirements

`_shared/reasoning-effort.md` is the shipped restatement of this contract and is consumed by the
plugin and skills. `README.md` carries a user-facing summary, `skills/setup-routing/routing.md`
carries the routing-level policy guidance, and `_shared/quality-profile.md` links to this document
instead of restating precedence.
