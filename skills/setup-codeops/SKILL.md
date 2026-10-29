---
name: setup-codeops
description: >-
  Sets up or upgrades CodeOps in the current git repo. It scaffolds a fresh nested codeops/ layout, auto-migrates a flat requirements/ + plans/ layout, and detects obsolete traceability.json workflow-state graphs in an existing nested project. Use when the user says "setup-codeops", "/setup-codeops", "set up codeops", "initialize codeops", "upgrade existing codeops", "migrate to the nested layout", or "scaffold the codeops structure". Supports --dry-run, unattended --yes, and --enable-discovery/--disable-discovery for existing projects. Every migration previews deterministically, refuses unsafe or ambiguous apply, requires clean Git state for writes, and is idempotent. setup-codeops is the SOLE writer of the layout marker.
---

# CodeOps Layout Setup (`setup-codeops`)

> **CodeOps Artifact Schema**: 1

Set up the CodeOps **nested `codeops/` layout** for the git repo the user is currently in. Run as
`/codeops:setup-codeops` or the typeable alias `/setup-codeops`. This is the one skill that
**creates and owns the layout marker** `codeops/.codeops.yml`; every other skill only reads it.

Resolve all paths and the marker schema via **[_shared/layout-convention.md](../../_shared/layout-convention.md)** —
it is the single source of truth for the layout. Do not re-encode paths here.

## Scope

- **Per-repo only.** One git repo at a time; no cross-repo or portfolio-of-projects work.
- This skill sets up the *structure*. It never authors requirements, plans, or roadmaps — that is
  `make-requirements` / `make-plan` / `roadmap`, which then resolve paths via the convention doc.
- A fresh scaffold enables Discovery by default (`discovery.enabled: true`,
  `chatMaxQuestions: 3`). Existing projects can toggle it with
  `setup-codeops --enable-discovery` / `--disable-discovery`; `analyze-project --with-discovery`
  remains available for the same config change with guidance refresh.

## Dispatch — detect repo state, then branch

Run inside the repo and detect, in this order:

```
1. Any codeops/features/*/traceability.json or codeops/_archive/*/traceability.json present
       → LEGACY WORKFLOW-STATE UPGRADE, even when the layout marker is already present. Follow the
         nested-project flow in migration.md. Preview with codeops_plan_migrate.py; with --yes,
         apply only when the preview has no BLOCKED entry, then verify with codeops_plan.py.
         This check intentionally precedes the marker no-op so re-running setup upgrades an
         existing project without requiring a separate upgrade prompt.
2. codeops/.codeops.yml present
       → already set up. NO-OP for the layout: print a short status report (layout = nested, where
         things live). BUT if the marker is **missing `integrationBranch`**, BACKFILL it — add that
         one line (resolved to the repo's integration branch: `origin/HEAD`, else the current branch,
         else `main`/`master`) without touching any other key; if it is already present, leave it.
         Never re-scaffold or re-migrate. (Idempotent — a marker that is present and complete → no
         change; this is the existing-project entry point for parallel-agents support.)
3. Flat layout detected (requirements/  OR  plans/00-roadmap.md  OR  any plans/<dir>/)
       → MIGRATE. Follow migration.md: run the engine --dry-run, render the preview, take ONE
         confirmation, then apply. The engine (scripts/codeops-migrate.sh) owns the algorithm.
4. Neither
       → fresh SCAFFOLD. Follow scaffold.md: create the minimal codeops/ skeleton.
```

If the repo is **not a git repo**, refuse with a clear message (migration needs `git mv`; even a
fresh scaffold should live in version control) and suggest `git init` first.

## Flags

| Flag | Effect |
|------|--------|
| *(none)* | Interactive: scaffold creates the skeleton; either migration previews then asks for one confirmation before applying. |
| `--dry-run` | Preview only — compute and show what would happen; change **nothing**. |
| `--yes` | Apply an unblocked migration without confirmation, then verify it. Safety refusals still apply. |
| `--enable-discovery` | Enable Discovery in an existing project without re-scaffolding. Preserves every other config key. |
| `--disable-discovery` | Disable Discovery, keeping `chatMaxQuestions` and every other config key. |

`--enable-discovery` and `--disable-discovery` are mutually exclusive. Validate that before the
layout branch so a usage error never changes the repository.

## Discovery toggle

After the layout branch (no-op, migration, or fresh scaffold), apply exactly one discovery flag
when present:

```bash
node "${CODEOPS_PLUGIN_ROOT}/scripts/discovery-toggle.mjs" --root . --enable-discovery
node "${CODEOPS_PLUGIN_ROOT}/scripts/discovery-toggle.mjs" --root . --disable-discovery
```

Add `--dry-run` to preview. The script validates the JSON, refuses symlinked `codeops/` or
`codeops/codeops.json`, preserves unrelated policy, and adds or removes the managed line
`- Discovery: enabled — question rounds open in the local Discovery page` when the
`CODEOPS-PROJECT` block exists. If `AGENTS.md` is absent or has no managed block, the config still
changes; report that guidance should be refreshed with `analyze-project`.

A fresh scaffold starts enabled. Passing `--disable-discovery` during scaffold turns it off; passing
`--enable-discovery` is idempotent. Without either flag, an existing project keeps its current
setting and a fresh scaffold stays enabled.

## Migration engines (delegation — do not re-implement)

Flat-to-nested path arithmetic, slug derivation, hazard scanning, dirty-tree refusal,
path-traversal protection, idempotency, and `git mv` apply live in
**`scripts/codeops-migrate.sh`** (see [migration.md](migration.md)):

- Preview: `scripts/codeops-migrate.sh --dry-run`
- Apply:   `scripts/codeops-migrate.sh --yes`

Never re-derive the move map in prose — read it from the engine's output and present it.

Existing nested-project graph removal and Markdown ownership inference live in
**`scripts/codeops_plan_migrate.py`**. Do not inspect or rewrite graph semantics in the skill:

- Preview: `python3 "${CODEOPS_PLUGIN_ROOT}/scripts/codeops_plan_migrate.py" ./codeops`
- Apply: `python3 "${CODEOPS_PLUGIN_ROOT}/scripts/codeops_plan_migrate.py" ./codeops --apply`
- Verify: `python3 "${CODEOPS_PLUGIN_ROOT}/scripts/codeops_plan.py" --root . --json`

On `--yes`, run preview first. Apply only when it exits successfully with no `BLOCKED` entry, then
run verification. The migrator itself owns clean-tree refusal, all-or-nothing writes, graph
deletion, and idempotency.

## Reference files

- [scaffold.md](scaffold.md) — the minimal fresh-repo skeleton.
- [migration.md](migration.md) — flat-layout and legacy workflow-state migration UX.
- `scripts/discovery-toggle.mjs` — deterministic config and managed-line toggle.
- [_shared/layout-convention.md](../../_shared/layout-convention.md) — the layout/path/ID/marker source of truth.

## Grounded Options & Recommendations

When a migration surfaces choices (e.g. an ambiguous slug source, or warnings the user must act
on), present only **genuinely viable** options, second-guessed and grounded in what the engine
actually reported, and lead with a recommendation. The user decides; never apply a migration
without an explicit confirmation (or `--yes`). For consequential choices, apply the
recommendation-hardening protocol (`_shared/recommendation-hardening.md`).

---

> **Workspace hygiene (non-negotiable):** put every temporary artifact this run creates in
> `$CODEOPS_TMPDIR` (fallback: the OS temp directory), never in the repository, and delete them
> all before reporting completion. Never delete user files, versioned artifacts, worktrees, or
> another session's temporary files. Full rules:
> [_shared/workspace-hygiene.md](../../_shared/workspace-hygiene.md).
