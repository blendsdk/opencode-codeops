# Quality Profile (shared convention)

> **CodeOps Artifact Schema**: 1

This is the **single canonical definition** of the per-repo quality profile and the quality-agent
conventions built on it. It lives at the plugin root in `_shared/`; dispatching skills link here
instead of carrying copies.

## Structured profile

Quality and routing configuration lives in `codeops/codeops.json`, validated against
`schemas/codeops-config.schema.json`. `AGENTS.md` contains project guidance, not mutable machine
configuration.

The quality section controls independent review and stop conditions. The routing section controls
optional roles, effort, reasoning, model pins, sandboxes, and concurrency. Domain/risk tags in the active
specification select additional reviewer roles. Outcome metrics are disabled unless
`metrics.enabled` is explicitly `true`.

### Parsing, absence, and ownership

- Missing quality configuration selects strict CodeOps defaults for planned complex-system work:
  independent review on, at least one reviewer, and stop on major findings.
- Invalid structured configuration is a readiness blocker; do not silently discard malformed
  policy and continue with unknown guarantees.
- setup-routing proposes and updates structured policy. Hand edits are valid and validated.
- A missing optional custom agent never disables review; use a complete dynamic packet or inline
  fallback.

## Taxonomies

### Lens enum (7 — grow-only; renaming or repurposing an existing value is forbidden)

| Lens | Scope (one line) |
|------|------------------|
| `correctness` | Logic errors, broken behavior against the spec and tests. **Base.** |
| `maintainability` | Design-quality judgment calls: clarity, structure, duplication, naming. **Base.** |
| `standards` | Violations of the always-on written coding standards. **Base-only — never a valid profile add-on.** |
| `security` | Injection, authorization, secrets handling, unsafe input. Add-on. |
| `perf` | Hot paths, allocations, algorithmic complexity, blocking I/O. Add-on. |
| `api-surface` | Public interface design, compatibility, versioning. Add-on. |
| `concurrency` | Races, locking, ordering — explicitly **owns data-integrity**. Add-on. |

The base lenses `correctness` + `maintainability` + `standards` are always on for every review;
the profile's `lenses` list names **add-ons only**. Disambiguation: a violation of a written
standard is `standards`; a design-quality judgment with no written rule behind it is
`maintainability` — keeping the two distinguishable in findings and outcome evidence.

### security_profile enum (5)

| Profile | Focus |
|---------|-------|
| `owasp-web` | Classic web-app risks: injection, XSS, CSRF, broken access control, SSRF |
| `auth-protocol` | Authentication/session flows: token handling, expiry, replay, fixation |
| `financial-integrity` | Money movement: idempotency, double-spend, rounding, audit trails |
| `tenant-isolation` | Multi-tenant boundaries: cross-tenant reads/writes, scoping, leakage |
| `mcp-agent` | Agent/MCP integrations: prompt injection, tool abuse, secret exfiltration |

The per-profile checklists live in `agent-templates/security-auditor.md`; this table is the naming
authority. Both enums are grow-only: adding a value here legalizes it everywhere (the structural
guards read the enums from this file).

### Severity

Findings reuse the preflight severity scale **by reference** — 🔴 CRITICAL / 🟠 MAJOR /
🟡 MINOR as defined in the preflight skill — verbatim, with no extra levels.

### Finding prefixes

RV (phase-reviewer) · SA (security-auditor) · PA (preflight-auditor) · PE (perf-auditor) ·
SR (domain-specialist-reviewer), each numbered `XX-NNN`. Every finding-producing agent reports
"no findings" explicitly rather than returning empty output.

## Activation & supersession

| Condition | Effect |
|-----------|--------|
| No structured profile | Strict defaults: every non-trivial executed phase's diff gets one correctness review, at the time its plan's verification tier sets (below) |
| `quality.independentReview: false` | Allowed only outside strict mode; announce that routine independent review is disabled. This never disables a required Complexity Escalation Gate challenger after an escalation is detected. |
| Independent review on | Post-phase quality review covers **all executed phases and task mini-plans** (whole-task diff), at the time the verification tier sets; trivial tasks are never reviewed |
| Docs-only diff | Phase reviewer still runs (immediately, or in the completion review when the phase is carried forward); security/perf auditors skip — the skip is logged, never silent |
| `critical` tier (also: no tier line, or an unknown value) | Every non-trivial phase is reviewed when it ends |
| `standard` tier | A phase is reviewed when it ends if it is risk-tagged or changes 150 or more product lines (added + deleted, counted per the verification-balance classification in exec-plan's post-phase step); otherwise it is marked `carried forward`. At plan completion — before the plan is reported done, finally pushed, or released — the completion review covers every carried-forward phase as one cumulative diff |
| Security risk tags active | Security auditor dispatches once per phase with the union of applicable checklists and supersedes the reviewer's security lens |
| Performance-critical tag + code diff | Performance auditor dispatches and supersedes the reviewer's performance lens |

Supersession exists so the same ground is never reviewed twice at different depths: a dedicated
agent replaces the reviewer's matching add-on lens for that phase.

The verification tier changes **when** a diff is reviewed, never **whether** it is reviewed: the
completion review satisfies the strict defaults for every carried-forward phase. The tier table
lives in [spec-first-ordering.md](spec-first-ordering.md) §Verification tiers.

## Finding calibration

These rules apply to every finding raised in exec-plan's post-phase review — by the correctness
reviewer, every auditor, and every specialist reviewer — at every verification tier. Preflight
audits keep their own rules. exec-plan applies this section again when it merges findings.

1. **Test-gap severity.** A missing or thin test is 🟡 MINOR — unless an ST-case or acceptance
   criterion has no test at all, which is 🟠 MAJOR.
2. **Not findings.** Report none of these:
   - an issue in code outside the changed lines and the code that directly calls, or is called
     by, them;
   - anything the project's linter, formatter, or type checker reports;
   - a guard for a hypothetical scenario that neither the requirements nor an active security or
     risk checklist covers;
   - a test that re-proves behavior an existing test already proves;
   - a style preference that no written rule states.
3. **Quoted rule.** A `standards` finding quotes the text of the written rule it relies on.
   Without a quote it is not a `standards` finding.
4. **Machinery routing.** A remedy that would add a test harness, validator, gate, guard
   framework, or other verification support code is not a fix task. Raise it as a complexity
   escalation under the Complexity Escalation Gate in
   [zero-ambiguity-gate.md](zero-ambiguity-gate.md).

## Dispatch packets & header

**Line 1 of every quality-agent dispatch prompt** is a compact scope header:

```
[codeops-dispatch agent=<name> feature=<slug> phase=<id> unit=<id> model=<pin|inherited> effort=<requested> independence=<mixed-model|mixed-effort|uniform-effort>]
```

- `unit=` carries the dispatched unit: a task id, or the cluster id for a coverage-hunt dispatch.
- `model=` records `inherited` when no model pin applies.
- `effort=` is the requested canonical level. Omit `effort=` entirely when no level is active
  (inherit); never write `default`.
- `independence=` is one of the three canonical values. `same-model` is a model-axis fact, never
  an independence status.

This is the only dispatch-header definition. RD-01 and RD-02 link here rather than restating it.
The header makes parallel results attributable and auditable. Outcome metrics never parse prompt
or response content.

| Agent | Packet contents (the agent receives nothing else and must need nothing else) |
|-------|------------------------------------------------------------------------------|
| phase-reviewer, security-auditor, perf-auditor | Phase diff (`git diff <phase-start-ref>..HEAD`), original goal + smallest viable design, relevant approved complexity AR/PF/RV excerpts (a `standard` plan: the relevant approved `D-n` rows), the phase's task + Deliverable lines, active lenses, scope mode (`strict` or `explore`), confirmed scope baseline, profile excerpt, the `Finding calibration` section, verify command + last result |
| phase-reviewer in `Mode: refute` | `Mode: refute` as the first packet-body line after the header; the phase diff; the 🔴/🟠 findings to challenge, verbatim; the ST-cases or acceptance criteria and requirements they cite (when any are cited); the `Finding calibration` section; the refute output contract (one row per finding: `<ID> — Confirmed \| Downgraded → <severity> \| Refuted — <evidence file:line>`) |
| plan-task-executor, plan-task-executor-opus | Phase task + Deliverable + Verify lines, governing spec/ST/AR excerpts (a `standard` plan: the phase's `AC-n` rows and the relevant `D-n` rows), original goal + smallest viable design, relevant approved complexity PF/RV excerpts, target paths, scope mode (`strict` or `explore`), confirmed scope baseline, verify command |
| spec-test-author | Spec excerpts + test cases, planned interface signatures from the plan documents, test framework/conventions, the FORBIDDEN implementation-file list, verify command (expected RED) |
| preflight-auditor | The artifact under audit + ONE assigned cluster — a dimension cluster in `preflight-audit` mode or a category cluster in `coverage-hunt` mode — + original goal + smallest viable design + relevant approved complexity AR/PF/RV excerpts + scope mode (`strict` or `explore`) + confirmed scope baseline |
| domain-specialist-reviewer | Line-1 dispatch header; phase diff; original goal + smallest viable design; phase task + Deliverable lines; active lenses plus the brief's domain checklist; scope mode + confirmed baseline; the `Finding calibration` section; verify command + last result; the specialist brief excerpt |
| domain-specialist-executor | Phase task + Deliverable + Verify lines; governing spec/ST/AR excerpts (a `standard` plan: the phase's `AC-n` and relevant `D-n` rows); original goal + smallest viable design; target paths; scope mode + confirmed baseline; verify command; the specialist brief excerpt |
| design-challenger | Problem + candidate options, **without** the parent's preferred choice (per `_shared/recommendation-hardening.md`) |
| codebase-scout | The factual questions, search hints, and the facts-only contract |

Every packet also carries the session temp root (`$CODEOPS_TMPDIR`) and the hygiene requirement:
the agent creates temporary files only under that root and deletes its own before returning (see
`_shared/workspace-hygiene.md`). A parent never deletes a subagent's artifacts while its dispatch
is still in flight.

## Project specialists

A project may define specialist roles on top of the catalog (see `_shared/specialist-agents.md`).
Specialists resolve like any project agent; routing policy may pin model, effort, sandbox, and
reasoning, and a generated agent embeds `reasoningEffort` (default `xhigh`). Pre-marker generated
agents that embed `max` remain valid as a documented legacy exception. Dispatch only roles
listed in the plan's `## Specialist Agents` table, as **additional** reviewers or executors — a
specialist never replaces a required reviewer or gate, and an unavailable or invalid-brief
specialist falls back to a complete dynamic packet with the fallback reported.

## Budget caps

- **Preflight fan-out:** ~5 clustered auditor dispatches — an exact partition of the preflight
  skill's 13 dimensions, grouped by affinity: ① Ambiguities + Logical Contradictions +
  Consistency (document soundness) · ② Implicit Assumptions + Codebase Alignment (grounding) ·
  ③ Completeness Gaps + Dependency Issues + Ordering & Sequencing (delivery) · ④ Security Blind
  Spots + Edge Cases + Feasibility Concerns (risk) · ⑤ Testability + Scope Creep Indicators
  (fit). `--thorough` expands to one dispatch per dimension.
- **Re-review:** at most ONE re-review per phase, only after 🔴/🟠 fixes, scoped to the fix
  diff — never a third pass.
- **Scout:** ≤3 codebase-scout dispatches per skill run, enforced by the dispatching parent.
- **Challenger:** caps live in `_shared/recommendation-hardening.md` and apply unchanged.
- **Specialist dispatch:** limited to the roles listed in the plan's `## Specialist Agents` table
  (`00-index.md`, or a `standard` plan's single document);
  no additional fan-out.

## Model, effort, and agent resolution

Routing policy lives in `codeops/codeops.json`; see the setup-routing skill. Policy names roles and capabilities, not vendor tiers. A role may optionally declare a current OpenCode model, reasoning effort, and sandbox, but no gate depends on a particular model being available.

Resolution order is:

1. an explicit model/effort requested for the current dispatch;
2. a generated or hand-authored project agent in `.opencode/agents/<role>.md`;
3. project `[agents]` defaults in `opencode.json`;
4. the parent session's model and effort.

For the runtime reasoning-effort override (a dispatch marker, a session `--auto-effort` level, or
a routing role default), see [reasoning-effort.md](reasoning-effort.md); the static resolution
order above is unchanged.

Use `python3 "${CODEOPS_PLUGIN_ROOT}/scripts/install_agents.py" --project . --roles ...` to create optional project agents. Generated agent files carry a CodeOps marker. The installer owns only marked files and preserves every hand-authored file. Use `--check` to detect missing or stale generated agents and `--dry-run` to preview changes. Project specialists are generated with `--custom <role>` from `codeops/specialists/<role>.md` and indexed into `AGENTS.md` with `--sync-agents-md`; their routing policy may also set `reasoning`.

Dynamic packets are the correctness baseline. If a named agent is missing or a model pin is unavailable, spawn a generic subagent with the complete packet or run inline. Report the fallback and preserve required reviewer independence, sandbox intent, and every ambiguity/readiness/verification gate.
