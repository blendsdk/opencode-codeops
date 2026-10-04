# Testing Strategy: Specialist Agents

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Installer logic (`scripts/install_agents.py`) | Every documented mode, state, and error-table row has at least one case; no numeric percentage (PF-029) |
| Content and protocol documents | Structural assertions (existence, links, stamps, clauses, leaks) |
| Skill prose | Content assertions plus recorded manual scenarios |

- Test names state behavior: `should [expected behavior] when [condition]`.
- The repository's verify command is `npm run verify` (type-check + `node --test` + version
  parity); every spec and impl test file runs under `node --test`.
- No new test harness: spec tests spawn `python3 scripts/install_agents.py` from Node in temporary
  fixture projects (AR #17). Every spawn **overrides `CODEOPS_PLUGIN_ROOT` to the checkout root**,
  because the plugin exports that variable into shells and the installer prefers it over its own
  location (PF-030).
- E2E agent dispatch is `N/A` as an automated test because skills are model instructions, not
  executable code; ST-34, ST-35, and ST-43 record the manual scenarios instead.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived exclusively from `01-requirements.md`, the `03-XX` component specifications, and the
> Ambiguity Register. Expectations are the immutable oracle: a failing spec test means the
> implementation is wrong.

### Brief validation and generation

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-1 | Valid reviewer brief (`kind: reviewer`, description, body) + `--custom` | Exit 0; `.opencode/agents/<role>.md` exists; marker line first; frontmatter has the sanitized description (quoted/escaped), `mode: subagent`, `hidden: false`, `reasoningEffort: max`, `edit: deny`; body contains the reviewer contract text followed by the brief body | Req R4, AR #9/#10/#12 |
| ST-2 | Valid executor brief + `--custom` | Exit 0; frontmatter `edit: allow`; body contains the executor contract text | Req R4, AR #9 |
| ST-3 | Brief without `description` | Exit 1; error names `description`; no file written | Req R3, AR #12 |
| ST-4 | Brief with `kind: auditor` | Exit 1; error lists `reviewer` and `executor`; no file written | Req R3, AR #12 |
| ST-5 | Role `UPPER_case` / a 42-character slug / `con` / `name.` | Exit 1 naming the rule; no file written. A 41-character slug is **accepted** (boundary pin) | Req R9, AR #15, PF-002, PF-025 |
| ST-6 | Role `../evil` or `a/b`; symlinked brief file; symlinked `codeops/specialists/`; symlinked `.opencode/agents/`; symlinked AGENTS.md | Exit 1; no file created or modified outside the project; symlinks are never written through or replaced | Req R9, AR #15, PF-006 |
| ST-7 | Role equal to a catalog role (`executor`), a built-in (`plan`), or a hidden system agent (`title`) | Exit 1; reserved-name error; catalog/built-in files unchanged | Req R4/R9, AR #15, PF-009 |
| ST-8 | Target `.opencode/agents/<role>.md` exists without the CodeOps marker | Exit 1; refuse; file bytes unchanged | Req R4, AR #15 |
| ST-9 | Brief `reasoning: high` and routing policy `reasoning: medium` | Generated frontmatter has `reasoningEffort: medium` (routing wins) | Req R5, AR #10/#19 |
| ST-10 | Executor with routing `sandbox: read-only`; reviewer with routing `sandbox: workspace-write` | Executor frontmatter `edit: deny` and `bash: deny`; reviewer frontmatter `edit: deny` (clamp wins) | Req R4/R9, PF-010 |
| ST-11 | Routing policy pins `model: provider/model` / no pin | Frontmatter contains the `model` line / contains no `model` line | Req R5, AR #13 |
| ST-12 | Brief with an unknown frontmatter key (including `briefSchema`) | Exit 1; error names the key; no file written | Req R3, AR #18 |
| ST-13 | Brief body of exactly 16385 bytes | Exit 1; error states the 16384-byte limit; no file written | Req R3, AR #12, PF-028 |
| ST-14 | Description/`required-for` containing `-->`, `<!<!---- CODEOPS-SPECIALISTS:START ---->>`, a control character, or a leading YAML indicator (`[unterminated`, `*alias`, `- item`, `# tag`) | Sanitization completes at a fixed point; no `<!--`/`-->` remains; frontmatter values are quoted/escaped so YAML parses to the exact intended string; AGENTS.md is not corrupted; brief-body control characters are stripped while Markdown structure survives | Req R9, AR #14/#15, PF-007, PF-008, PF-027 |
| ST-15 | `--dry-run --custom <role>` | Exit 0; prints intended files/changes; nothing is written | Req R11, AR #13 |
| ST-16 | Run `--custom <role>` twice with an unchanged brief | Second run exits 0 and the generated file is byte-identical | Req R11, AR #13, PF-026 |

### `--check` states

> Every check fixture pre-generates the twelve catalog agents so exit codes are attributable to
> the custom states under test (`scripts/install_agents.py:212-252`; PF-003).

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-17 | Brief exists, generated agent deleted; second brief has a marker-generated agent but no brief | Exit 1; reports `MISSING: <role>` and `ORPHAN: <role>`; catalog agents are not reported missing | Req R8, AR #13, PF-003 |
| ST-18 | Brief edited after generation | Exit 1; reports `STALE: <role>` | Req R8, AR #13 |
| ST-19 | Brief with invalid frontmatter in `codeops/specialists/` | Exit 1; reports `INVALID: <role> — <reason>` | Req R8, PF-021 |
| ST-20 | Brief + up-to-date agent + up-to-date AGENTS.md block, all 12 catalog agents present | Exit 0; prints `OK: N default, M custom` | Req R8, AR #13, PF-003 |
| ST-21 | AGENTS.md absent / block absent / block outdated | Exit 1; reports `AGENTS.md MISSING (file)`, `AGENTS.md MISSING (block)`, `AGENTS.md STALE` respectively | Req R6, AR #14, PF-004 |

### Removal

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-22 | `--remove-custom <role>` without `--yes` | Exit 0; prints the agent and brief paths; neither file is deleted | Req R8, AR #11 |
| ST-23 | `--remove-custom <role> --yes` | Index is validated first; agent and brief are deleted; AGENTS.md entry is removed in the same run | Req R8, AR #11, PF-015, PF-022 |
| ST-24 | `--remove-custom executor --yes`; `--remove-custom <role> --yes` on a marker-less hand-authored file; `--remove-custom <role> --yes` on a marker-owned agent whose `Template:` comment is not `domain-specialist-*` | Exit 1; all refused; files unchanged | Req R8/R9, AR #11/#15, PF-005 |

### AGENTS.md synchronization

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-25 | AGENTS.md without markers, one specialist brief | Block appended at end with role, sanitized description, and `required-for`; all pre-existing bytes unchanged | Req R6, AR #8/#14 |
| ST-26 | Both markers present, brief changed | Only content between markers is replaced; text before `START` and after `END` is byte-identical | Req R6, AR #14 |
| ST-27 | Both markers present, no briefs remain | Block and exactly one adjacent blank line (the one the sync added) are removed; other text unchanged | Req R6, AR #14, PF-028 |
| ST-28 | Exactly one marker, duplicate START/END pairs, or END before START | Exit 1; error; AGENTS.md bytes unchanged | Req R6, AR #14/#18, PF-004 |
| ST-29 | Run `--sync-agents-md` twice with unchanged briefs | Second run leaves AGENTS.md byte-identical | Req R6, AR #14 |
| ST-36 | AGENTS.md absent | Created containing only the managed block; `--check` then reports OK for the file state | Req R6, PF-004 |
| ST-37 | AGENTS.md empty (0 bytes) | Block written as the only content | Req R6, PF-004 |
| ST-38 | AGENTS.md without trailing newline; AGENTS.md with CRLF | Block appended with one blank line separator; CRLF file receives CRLF block lines; other bytes unchanged | Req R6, PF-004 |
| ST-39 | `--dry-run --sync-agents-md` | Prints the delta; AGENTS.md bytes unchanged | Req R11, PF-014 |
| ST-40 | `--dry-run --remove-custom <role> --yes` | Prints intended deletions; both files remain; dry-run wins over `--yes` | Req R11, PF-014 |
| ST-41 | `--sync-agents-md` with an invalid brief present | Exit 1; reports `INVALID: <role>`; AGENTS.md unchanged | Req R6, PF-021 |
| ST-42 | Regenerate a catalog role (e.g. `executor`) with the refactored generator | Output is byte-identical to the pre-refactor golden fixture `scripts/fixtures/catalog-executor.golden.md` (captured before any generator edit; AR #25) | Req R5, AC #6, PF-023, AR #25 |

### Protocol and skill content

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-30 | Repository content check | `_shared/specialist-agents.md` exists, carries `> **CodeOps Artifact Schema**: 1`, contains the detection criteria, candidate packet, authority/budget clauses (≤2 candidates, `--auto-design` ban), always-record outcome, and lifecycle | Req R1/R2/R10, AR #6/#24, PF-001, PF-012 |
| ST-31 | Repository content check | `_shared/layout-convention.md` documents `codeops/specialists/`; edited skill/shared files contain no `${PLUGIN_ROOT}` leak; every edited `SKILL.md` keeps a `name:` frontmatter field | Req R3/R10, AR #20 |
| ST-32 | Repository content check | `_shared/specialist-agents.md` is linked from `make-requirements`, `make-plan`, `analyze-project`, `setup-routing`, and `_shared/quality-profile.md`; `skills/make-plan/templates.md` contains the `## Specialist Agents` section; `_shared/quality-profile.md` documents `SR`, specialist resolution, and fallback; `skills/exec-plan/*` point at it; `skills/setup-routing/SKILL.md` documents the managed-block stance (no longer "AGENTS.md receives only a concise instruction"); `schemas/codeops-config.schema.json` declares the `reasoning` enum | Req R7/R10, AR #16, PF-001, PF-016 |

### Layout migration

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-33 | Flat git fixture with `requirements/`, `plans/<x>/`, `codeops/specialists/<role>.md`, and a valid `codeops/codeops.json`; run `--dry-run`, then apply. Second fixture with a malformed `codeops/codeops.json` | Dry-run exits 0 and previews the preservation; apply moves only `requirements/` and `plans/`, leaves `codeops/specialists/` in place, preserves the valid `codeops/codeops.json` byte-for-byte with a warning, and never overwrites. The malformed fixture is refused before any move | Req R10, PF-013 |

### Manual scenarios (recorded, not automated)

| # | Scenario | Expected Result | Source |
|---|----------|-----------------|--------|
| ST-34 | Create a specialist in a scratch project from an installed working-tree plugin, restart OpenCode, run an `exec-plan` phase that lists it | Agent appears in the task list; dispatched as an additional reviewer; findings use `SR-NNN`; standard gate still runs; the active model accepts `reasoningEffort: max` (or the override is recorded) | Req R7, AR #16/#19, PF-018, PF-031 |
| ST-35 | With the plan still listing the specialist, delete its generated agent (keep the brief) and run the same phase | Dispatch falls back to a generic subagent with the brief excerpt; the fallback is reported; the phase still completes review | Req R7, AR #16, AR #27 |
| ST-43 | Run detection on a plan/requirements set where no gap exists; attempt to propose more than two candidates | Outcome recorded as `None` with evidence; the third candidate is refused under the AR #24 budget | Req R1/R2, AR #24, PF-012 |
| ST-44 | In a gap-bearing project, ask CodeOps to run the specialist-gap check and follow it through the gate; approve the candidate and the brief | The skill presents the candidate packet with an independent challenger verdict and waits for approval; on approval `setup-routing` writes routing policy first, creates the brief and generated agent, syncs AGENTS.md, and `--check` is clean; no creation happens before approval (`--auto-design` cannot approve) | Req R1/R2/R4/R6, AR #4/#21 |

## Test Categories

### Specification Tests (from ST-cases above)

| Test File | ST Cases Covered | Component |
| --------- | ---------------- | --------- |
| `scripts/install_agents.spec.test.mjs` | ST-1 … ST-29, ST-36 … ST-42 | Installer and templates |
| `scripts/specialist-content.spec.test.mjs` | ST-30 … ST-32 | Protocol and skill content |
| `scripts/specialists-migration.spec.test.mjs` | ST-33 | Layout migration regression |
| `scripts/specialists-lifecycle.spec.test.mjs` | End-to-end lifecycle (acceptance criterion #5) | Full custom-role lifecycle |

### Implementation Tests (edge cases, internals)

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `scripts/install_agents.impl.test.mjs` | Sanitization boundaries, fixed-point behavior, YAML quoting, frontmatter parser edge cases (colons, CRLF, BOM), block-marker scanning, unique temp behavior removed (PF-026) | High |

### Integration Tests

| Test | Components | Description |
| ---- | ---------- | ----------- |
| End-to-end custom role | Brief → routing policy → `--custom` → `--sync-agents-md` → `--check` → `--remove-custom --yes` → `--check` | Full lifecycle in one temporary fixture (`scripts/specialists-lifecycle.spec.test.mjs`) |

### End-to-End Tests

`N/A` — skills are model instructions without an executable harness; ST-34, ST-35, and ST-43
record the manual scenario procedure and results.

## Test Data

### Fixtures Needed

- Temporary fixture projects created per test: empty repo; one valid reviewer brief; one valid
  executor brief; a hand-authored agent collision; a marker-generated orphan; an invalid brief;
  AGENTS.md variants (absent, empty, no trailing newline, CRLF, with/without markers, duplicate
  and reversed markers); symlink variants (brief file, specialists dir, agents dir, AGENTS.md).
- **Check fixtures pre-generate all twelve catalog agents** so `--check` exit codes are
  attributable to custom states (PF-003).
- A flat migration fixture with `requirements/`, a plan folder, `codeops/specialists/`, and a
  committed `codeops/codeops.json` (PF-013).
- The pre-refactor catalog golden file `scripts/fixtures/catalog-executor.golden.md` for the ST-42
  regression comparison (AR #25).

### Mock Requirements

None. Tests use real filesystem objects in temporary directories and the real `python3`
interpreter; no external services or network. Every spawn overrides `CODEOPS_PLUGIN_ROOT` to the
checkout root (PF-030).

## Verification Checklist

- [ ] All specification test cases (ST-*) defined with concrete input/output pairs
- [ ] Every ST case traces to a requirement, spec doc, AR, or PF entry
- [ ] Specification tests written BEFORE implementation
- [ ] Specification tests verified to FAIL before implementation (red phase); ST-33 is documented
      as an immediately-green regression guard where no red phase is possible
- [ ] All specification tests pass after implementation (green phase)
- [ ] Implementation tests written for edge cases and internals
- [ ] `npm run verify` passes with no regressions
- [ ] ST-34, ST-35, ST-43, and ST-44 manual scenarios executed and recorded as user-owned acceptance
      evidence in `99-execution-plan.md`
