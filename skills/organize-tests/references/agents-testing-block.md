# AGENTS.md Testing Block

> **CodeOps Artifact Schema**: 1

The testing block tells an agent how to verify this project without re-reading
the map. It lives inside the existing `CODEOPS-PROJECT` managed block and is
owned by one writer.

## Ownership

`organize-tests` is the **sole writer** of the block. `analyze-project` detects
the block and preserves it byte-for-byte on every refresh; it never renders or
overwrites it, and it warns when the block is missing or stale. A project that
has no map is not given a block by `analyze-project`.

The block markers are:

```markdown
<!-- CODEOPS-TESTING:START -->
<!-- CODEOPS-TESTING:END -->
```

## With a map

```markdown
<!-- CODEOPS-TESTING:START -->
- Test map: `codeops/test-map/` (8 groups, 3 slices)
- Task verify: `npm run verify:task` (affected task-tier groups + dependents)
- Phase verify: `npm run verify:phase` (task + phase tiers)
- Gate verify: `npm run verify` (full suite; release/acceptance/CI)
- Map check: `npm run test:map:check`
- Last map check: 2026-11-11 23:36
<!-- CODEOPS-TESTING:END -->
```

The commands are the project's real commands. Never invent a script name; if the
project does not want a wrapper, point at the CLI command instead.

## Optional Test slices table

A project that wants a map-less reference may add a human-readable table after
the commands. It is informational; the map remains the source of truth.

| Slice | Tier | Tests | Sources | Gate |
| --- | --- | --- | --- | --- |
| `billing.invoice-dialog` | task | `web/billing/**/*.test.tsx` | `web/billing/**` | task |
| `billing.invoice-dialog` | release | `tests/e2e/billing/**` | `web/billing/**` | release |
| `shared.auth` | task | `shared/auth/**/*.test.ts` | `shared/auth/**` | always-run |

The table columns are slice, tier, tests, sources, and gate. Keep it short; a
large table belongs in the map, not in `AGENTS.md`.

## Without a map

```markdown
<!-- CODEOPS-TESTING:START -->
- Testing: full suite only (no test map)
- Gate verify: `npm run verify`
<!-- CODEOPS-TESTING:END -->
```

The no-map text preserves today's behavior. `analyze-project` leaves an existing
no-map block untouched.

## Refresh rules

- Replace only the block contents; preserve surrounding managed and
  hand-authored text byte-for-byte.
- Keep exactly one block; stop on duplicate or reversed markers and name the
  manual fix.
- Update `Last map check` only after a successful `check`.
- Write with the file's dominant line ending; keep exactly one block; fail without writing on duplicate or reversed markers.
- Never put secrets, absolute machine paths, or test output in the block.

## Wrapper guidance

A thin project wrapper is optional. If the project wants npm scripts, generate a
small file that calls the plugin CLI with the project's map path and forwards
arguments. The wrapper contains no selection logic; it must not grow into a
second implementation. Record the wrapper path in the block.
