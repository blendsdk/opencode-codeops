---
name: analyze-project
description: Analyze the current repository and create or refresh concise CodeOps-aware AGENTS.md guidance using observed manifests, commands, structure, conventions, verification, and integration-branch facts. Use for analyze project, initialize project guidance, refresh AGENTS.md, or compact project instructions. Preserves hand-authored content and previews consequential rewrites.
---

# Analyze project guidance

`/init` can create a basic `AGENTS.md`; this skill adds CodeOps-specific, evidence-grounded guidance without replacing hand-authored policy.

## Protocol

1. Resolve the Git root, current/default branch, and nested `AGENTS.md` files.
2. Inspect manifests, build files, CI, test configuration, formatter/linter settings, source layout, package boundaries, and recent commit conventions; note specialization signals (a specialized framework, DSL, codegen, protocol, or domain invariants a generic agent would miss).
3. Derive commands only from executable configuration or documented scripts. Never invent a plausible command.
4. Prepare a concise managed section between:

```text
<!-- CODEOPS-PROJECT:START -->
<!-- CODEOPS-PROJECT:END -->
```

5. Include project type, principal languages/frameworks, authoritative build/test/verify commands, high-level structure, generated-file warnings, and CodeOps artifact/config locations.
6. If the managed section exists, replace only its contents. Preserve all other text byte-for-byte.
7. On a non-integration branch, preview changes to repository-wide guidance and ask before writing unless repository policy explicitly permits branch-local updates.
8. In compact mode, remove duplication and stale generated detail from the managed section only. Flag suspected hand-authored bloat; never silently rewrite it.
9. Validate every recorded command or mark it explicitly unverified.
10. Specialist coverage: read `codeops/specialist-check.json` when present and include a `Specialist coverage:` line in the managed section — `up to date (<YYYY-MM-DD>)` (from `checkedAt`) when the recorded plan set matches the current one; `check due — run analyze-agents` otherwise; when the state is absent or corrupt, render `check due — run analyze-agents (never checked)`. The `analyze-agents` skill runs the check (criteria: [../../_shared/specialist-agents.md](../../_shared/specialist-agents.md)); when a specialization signal is strong and no specialist covers it, report the candidate with evidence and recommend the `setup-routing` creation flow; never write agent files here. Preserve the `<!-- CODEOPS-SPECIALISTS:START -->` / `<!-- CODEOPS-SPECIALISTS:END -->` block byte-for-byte when refreshing the managed section.

## Discovery switch

`analyze-project` accepts `--with-discovery` and `--without-discovery`; passing both flags is a usage error. Both flags validate `codeops/codeops.json` against `schemas/codeops-config.schema.json` before changing anything: an invalid file stops the run with its schema errors and writes nothing (never discard malformed quality, routing, or metrics policy). Refuse to write when `codeops/` or `codeops/codeops.json` is a symlink or not a regular file; never write through a link.

- `--with-discovery`: set `discovery.enabled: true`, keeping every other key. When no file exists, create the minimal AR-35 file with the layout resolved from `_shared/layout-convention.md` (`nested` → `codeops`, `flat` → `.`):
  ```json
  {
    "schema": 1,
    "mode": "strict",
    "artifacts": { "layout": "flat", "root": "." },
    "discovery": { "enabled": true }
  }
  ```
  A newly created file always contains the `discovery` object. Preview the config change, then write it.
- `--without-discovery`: set `discovery.enabled: false`, keeping `chatMaxQuestions` and every other key. When no config exists, change no config; the managed line is simply removed.
- **Managed block (derived state).** On every run, including runs with neither flag, render this line immediately after `Specialist coverage:` when `discovery.enabled` is true:
  `- Discovery: enabled — question rounds open in the local Discovery page`
  Keep exactly one copy and replace it in place. On `--without-discovery` remove it by full-line match, including the em dash. Write with the file's dominant line ending. If the `CODEOPS-PROJECT` markers are missing, duplicated, or reversed, stop without writing and name the manual fix. The `CODEOPS-SPECIALISTS` block stays byte-for-byte.

Keep `AGENTS.md` small. Operational routing belongs in `codeops/codeops.json` or `opencode.json`, not prose.

---

> **Workspace hygiene (non-negotiable):** put every temporary artifact this run creates in
> `$CODEOPS_TMPDIR` (fallback: the OS temp directory), never in the repository, and delete them
> all before reporting completion. Never delete user files, versioned artifacts, worktrees, or
> another session's temporary files. Full rules:
> [_shared/workspace-hygiene.md](../../_shared/workspace-hygiene.md).
