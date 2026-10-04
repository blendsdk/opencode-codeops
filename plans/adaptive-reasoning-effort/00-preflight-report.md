# Preflight Report: adaptive-reasoning-effort

> **CodeOps Artifact Schema**: 1
> **Audit target**: `plans/adaptive-reasoning-effort/` — 9 documents
> **Context documents** (read for grounding, not audited): `plugin/index.ts`,
> `bin/lib/tmp-hygiene.mjs`, `bin/lib/tmp-hygiene.d.mts`, `package.json`, `tsconfig.json`,
> `schemas/codeops-config.schema.json`, `scripts/install_agents.py`, `scripts/codeops_outcomes.py`,
> `_shared/quality-profile.md`, `_shared/recommendation-hardening.md`, `skills/make-plan/*`,
> `skills/exec-plan/*`, `skills/setup-routing/*`, `README.md`, installed
> `@opencode-ai/plugin` 1.18.30 type declarations, and OpenCode `v1.18.34` source files
> (`provider/transform.ts`, `session/llm/request.ts`, `session/prompt.ts`, `tool/task.ts`)
> **Git ref at scan start**: `d321d75` (plan docs are untracked; content hashes below)
> **Scan 1**: 2026-10-04 12:36 · **Iteration 2**: 2026-10-04 12:40
> **Scope mode**: strict (no `--explore-scope`)
> **Modification set**: iteration 1 review-only; iteration 2 — the accepted fixes inside the audit
> target (plan documents) only
> **⚠️ SAME-SESSION REVIEW**: this plan was authored by the same model in the same session
> (`make-plan` completed moments earlier). Systematic blind spots are likely; consider a
> fresh-session audit for full independence.
> **Method**: all 13 dimensions scanned sequentially in the lead context (the `preflight-auditor`
> agent type is manual-invocation-only in this session). The itemized MAJOR recommendations were
> hardened with in-context layers; no independent challenger was dispatchable
> (Challenger: unavailable), so those recommendations were presented at Med confidence and the
> user ruled on each.

## Artifact hashes

| Document | Scan 1 (start) | Iteration 2 (re-scan) |
| -------- | -------------- | --------------------- |
| 00-ambiguity-register.md | `b9beef17…e402762f` | `2db70498…94195f8c` |
| 00-index.md | `7c5103fd…34177eed` | `dc7ab0cd…823bcac8` |
| 01-requirements.md | `fb1cda47…b4895f05e9` | `630fad0d…9a46e54d` |
| 02-current-state.md | `7e621efa…81355d53` | `28483995…3816d268` |
| 03-01-reasoning-effort-contract.md | `ce6ad615…d30486cd` | `73733104…61f3e695` |
| 03-02-plugin-runtime-override.md | `3588a023…495a0050` | `ba7300f6…41a7823c` |
| 03-03-plan-skill-integration.md | `282d51fb…d07beee` | `57cf289c…9799708a` |
| 07-testing-strategy.md | `642f00b7…f6ffb007` | `c372b9ff…7133130` |
| 99-execution-plan.md | `04c40351…cd411e0b` | `04c40351…cd411e0b` (unchanged) |

Full hashes available on request; truncated to first/last 8 hex characters for readability.

## Codebase Context Summary

| Claim in the plan | Reality | Verdict |
| ----------------- | ------- | ------- |
| Plugin has no chat hooks; hooks are `event`, `experimental.session.compacting`, `shell.env`, `tool.execute.before` | `plugin/index.ts:154,173,188,203` | ✓ |
| `chat.message` / `chat.params` exist and expose message parts, message id, model, and `output.options` | `@opencode-ai/plugin` 1.18.30 `dist/index.d.ts:187-215` | ✓ |
| `Model.capabilities.reasoning` exists | SDK `types.gen.d.ts:1289` | ✓ |
| Runtime model exposes a `variants` record | Verified in OpenCode `v1.18.34`: `request.ts:80-91` reads `input.model.variants[variant]`; the SDK 1.18.30 type omits it, so the helper's `in`-check is required | ✓ |
| `chat.message` fires before `chat.params` for the same user message | `prompt.ts:999-1009` triggers `chat.message` when the message is resolved; `request.ts:114-121` later passes `message: input.user` to `chat.params` | ✓ |
| Session temp dir contract (`sessionTmpDir`, `$CODEOPS_TMPDIR`, sanitized session id) | `bin/lib/tmp-hygiene.mjs:48-94,162` | ✓ |
| `.d.mts` companion for a JS helper consumed by the TS plugin | `bin/lib/tmp-hygiene.d.mts` exists; `tsconfig.json` includes only `plugin/**/*.ts` | ✓ |
| `routing.roles.*.reasoning` enum includes `none,minimal,low,medium,high,xhigh,max` | `schemas/codeops-config.schema.json:43` | ✓ |
| `install_agents.py` embeds specialist `reasoningEffort: max` | `scripts/install_agents.py` (~555-563) | ✓ |
| `_shared/` ships wholesale with skills | `bin/install-skills.mjs:59` `SHARED_DIRS` | ✓ |
| `npm run verify` = type-check + `node --test` + version parity; Node >=18 | `package.json:6-21` | ✓ |
| Test names `*.spec.test.mjs` / `*.impl.test.mjs` are discovered | existing `bin/*.spec.test.mjs`, `bin/tmp-hygiene.impl.test.mjs`, `scripts/*.spec.test.mjs` | ✓ |
| Skill anchors: make-plan phase header (`templates.md:455-460`), mini-plan shape (`SKILL.md:102`), exec-plan auto-design sections (`SKILL.md:20,31`), quality-profile dispatch header (`:88`) and model/effort section (`:139`), setup-routing `## Propose before writing` (`:47`), README `## Agent model configuration` (`:141`) | verified | ✓ |
| The deepseek flash model exposes `low/medium/high/max`; other openai-compatible models expose `low/medium/high` | `provider/transform.ts` `@ai-sdk/openai-compatible` case builds `WIDELY_SUPPORTED_EFFORTS` and adds `max` only when the API id contains `deepseek-v4`; the session model's API id does (PF-007 resolution) | ✓ |
| AR back-references resolve | all 23 now referenced (iteration 2) | ✓ |

## Findings

| # | Severity | Finding | Resolution | Status |
| - | -------- | ------- | ---------- | ------ |
| PF-001 | 🟠 MAJOR | Routing values outside the four-level set were silently inert, contradicting REQ-ARE-3 and the existing routing docs | Accept the full routing enum through `applyEffort` (variant-validated) | ✅ Fixed |
| PF-002 | 🟠 MAJOR | `--auto-effort=<level>` could not reach dispatched children (marker > session), contradicting 03-03 §Flag parsing | `=<level>` now composes every dispatch marker at the forced level for the run | ✅ Fixed |
| PF-003 | 🟡 MINOR | AR #21 had no back-reference in any plan document | `(AR #21)` added in 00-index §Specialist Agents | ✅ Fixed |
| PF-004 | 🟡 MINOR | "Other skills print their recommended level" had no implementing task | Reworded to "documented for reference only; they do not implement the flag"; table notes now "reference only" | ✅ Fixed |
| PF-005 | 🟡 MINOR | Impl tests required symlink/oversized state files to return `undefined`, unstated in the helper contract | `readSessionEffort` contract now rejects non-regular files (symlinks never followed) and files > 4 KiB; ST-19 covers both | ✅ Fixed |
| PF-006 | 🟡 MINOR | 03-03 §Skills template said "the recommended level below" with no level below | Now references 03-01 §Skill recommendation table | ✅ Fixed |
| PF-007 | 🔵 OBS | Model naming drifted (`deepseek-v4` / `deepseek-v4-flash` / `deepseek-flash`) | Standardized on the deepseek flash model; evidence now records that `max` exists only because its API id contains `deepseek-v4` | ✅ Fixed |
| PF-008 | 🔵 OBS | Hook order / message-id identity was an unevidenced assumption | Verified against OpenCode `v1.18.34` source (`prompt.ts:999`, `request.ts:114`) and recorded in 02 + 03-02 | ✅ Fixed |
| PF-009 | 🔵 OBS | Dispatch enumeration said "researcher" while the profile names `codebase-scout`; design challenger unstated | Names aligned; the complexity-gate design challenger is explicitly excluded (independence unchanged) | ✅ Fixed |

---

### PF-001 — 🟠 MAJOR — Routing values outside the four-level set were silently inert

**Evidence.** `03-02-plugin-runtime-override.md` listed `readRoutingReasoning` as validating the
**full routing enum** (`none, minimal, low, medium, high, xhigh, max`) while `resolveEffort` and
`applyEffort` step 1 dropped every value outside the four levels; `07-testing-strategy.md` ST-12
expected `xhigh` to be "returned unchanged for runtime variant validation" — which could not
happen. REQ-ARE-3 says the plugin applies the routing entry, and `skills/setup-routing/routing.md`
documents the full enum as a passthrough.

**Resolution (user ruling, option a).** Routing is trusted project config and may name any value
from the provider enum. `resolveEffort` gates `marker`/`session` with `isEffortLevel` but accepts
routing values that pass `isRoutingReasoning`; `applyEffort` accepts any routing-enum value and
merges the model's variant when present, else leaves the request unchanged. Applied in 03-01
(§Levels routing paragraph), 03-02 (helper table, application step 1, security note), and 07
(ST-12 now asserts the end-to-end behavior). Markers, session flags, and suggestions remain
limited to the four levels (AR #4 intact).

### PF-002 — 🟠 MAJOR — `--auto-effort=<level>` could not reach dispatched children

**Evidence.** 03-01 said a named level "forces a constant"; 03-03 §Flag parsing said "force that
level for the whole run"; but dispatch markers were always composed from the phase's `Reasoning:`
line, and precedence puts marker > session — so a forced level never reached children.

**Resolution (user ruling, option a).** With `--auto-effort=<level>`, `exec-plan` composes every
dispatch marker at the forced level for the run; bare `--auto-effort` keeps per-phase markers.
Applied in 03-01 (§Auto-effort sentence, precedence owner cell), 03-03 (§Flag parsing, §Dispatch
packets resolution).

---

## Iteration 2 — verification of fixes

| Check | Result |
| ----- | ------ |
| All 13 dimensions re-scanned within the unchanged audit target | No new findings, no regressions |
| PF-001…PF-006 artifact edits present and internally consistent | ✓ |
| PF-007…PF-009 evidence/name edits present | ✓ |
| AR #1…#23 all back-referenced in plan documents | ✓ |
| Relative links resolve (code-fence examples excluded) | ✓ |
| Task count 24 consistent across 01 requirements, 99 header/table, success criteria | ✓ |
| Stale phrases (`recommended level below`, `and researcher`, `deepseek-v4-flash`, `is not one of the four`) | none |
| `99-execution-plan.md` unchanged (findings did not touch execution tasks) | ✓ |

**Evidence upgrade from iteration 2:** the `max` variant is provider-gated by the API-id substring
`deepseek-v4` (`provider/transform.ts`, `@ai-sdk/openai-compatible` case). The deepseek flash model
qualifies; any future model without that id simply has no `max` variant, and the variant-validated
application skips it (covered by ST-14/MS-4). No plan change required; recorded in 01 and 02.

## Verdict

**✅ PREFLIGHT PASSED — all 9 findings resolved (2 major, 4 minor, 3 observations), 0 remaining.**

Both blocking findings are resolved by explicit user decisions and applied edits; the artifact is
ready for `exec-plan`. Residual caveats: (1) same-session authorship limits review independence;
(2) the two MAJOR policy rulings were made at Med confidence without an independent challenger, as
disclosed above; (3) live runtime behavior remains covered by the user-owned manual scenarios
MS-1…MS-4, which are never self-certified.

## Decisions log

| # | User decision | Applied | Re-scan |
| - | ------------- | ------- | ------- |
| PF-001 | Pass the full routing enum through `applyEffort` (variant-validated) | ✓ | iteration 2 clean |
| PF-002 | `--auto-effort=<level>` overrides dispatch-marker composition for the run | ✓ | iteration 2 clean |
| PF-003 | Add AR #21 back-reference | ✓ | ✓ |
| PF-004 | Reword advise-only clause to reference-only | ✓ | ✓ |
| PF-005 | Document non-regular-file rejection and 4 KiB cap | ✓ | ✓ |
| PF-006 | Fix the dangling template reference | ✓ | ✓ |
| PF-007 | Standardize on deepseek flash; record the `deepseek-v4` API-id condition | ✓ | ✓ |
| PF-008 | Record the verified hook ordering/id evidence | ✓ | ✓ |
| PF-009 | Align scout naming; exclude the design challenger | ✓ | ✓ |
