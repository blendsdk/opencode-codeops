# Task T-01: Install `_shared/` and `references/` beside the installed skills

> **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Phase baseline tree**: ed376700a290ba13b2b5d6ec238cf2c5a800ef4e
> **Progress**: 6/6 tasks (100%)
> **Last Updated**: 2026-09-24 23:09

## Objective

Fix GitHub issue #1: after `opencode-codeops install`, every shipped skill link of the form
`../../_shared/<doc>.md` and `../../references/domains/<lens>.md` points at
`dirname(<skills-dir>)/_shared` and `dirname(<skills-dir>)/references`, which the installer never
creates. The skills silently fall back to their summaries, and `preflight` cannot read the domain
lenses. The fix installs the two package-root sibling directories next to the skills, records them
in the ownership marker, and removes them on uninstall — so the relative links resolve for the
agent's file reader and offline.

**Smallest viable design:** reuse the existing atomic-replace / marker / link machinery in
`bin/lib/opencode-install.mjs`. Add one small loop to `installSkills` in `bin/install-skills.mjs`
that copies (or links) `SHARED_DIRS = ["_shared", "references"]` from `dirname(sourceDir)` into
`dirname(targetDir)`, and the matching removal in `uninstallSkills`. No new dependency, layer,
harness, or framework: it places already-packaged files through the pattern the skills already use.

**Complexity check:** the resolution test is added to the existing `node --test` suite and proves
the accepted behavior directly, so the shared Complexity Escalation Gate does not trigger.

**Decisions (confirmed with the user):**
- Install both whole trees as siblings of the skills dir; track in the marker; remove on uninstall.
- Read siblings from `dirname(sourceDir)`; warn and skip when a custom source has none.
- Pre-existing unowned `_shared`/`references` are skipped with a warning unless `--force` (this
  applies on a first run too, because a missing marker means ownership is unknown).
- Deliverables: full test bundle, `CHANGELOG.md` entry, `README.md` install note.
- Verify command: `npm run verify`.

## Tasks

- [x] **T-01.1 — Specification tests (red).** (completed: 2026-09-24 22:55) Add
  `bin/install-skills.shared.spec.test.mjs` covering the installer's new contract. Run
  `npm test` and confirm the new tests fail for the expected reason (shared dirs absent).
  Cases:
  - **Resolution sweep (the regression test):** install from the real package
    `sourceDir = <repo>/skills` (so `dirname(sourceDir)` is the repo root holding `_shared/` and
    `references/`) into a temp target; then walk every installed skill file, extract Markdown link
    targets `](...)` whose relative path starts with `../../`, resolve each against the installed
    file's directory, and assert the target exists and stays inside the installed tree. Scan only
    installed **skill** files (not `_shared/`), because `_shared/layout-convention.md:10` mentions
    `../../_shared/layout-convention.md` in prose, not as a link.
  - First install creates `dirname(targetDir)/_shared` and `.../references` and records both in
    `marker.shared`.
  - Re-install replaces managed shared dirs and updates the marker version.
  - Uninstall removes managed shared dirs and the marker; an unowned sibling is left intact.
  - A pre-existing unowned `_shared` is skipped with a warning unless `--force`.
  - `--link` symlinks the shared dirs; `--dry-run` writes nothing.
  - A source tree with no siblings installs the skills and warns/skips the shared dirs without
    failing.

- [x] **T-01.2 — Implement shared-dir install (green).** ✅ (completed: 2026-09-24 22:55) In `bin/install-skills.mjs`:
  - Add and export `export const SHARED_DIRS = ["_shared", "references"]`.
  - In `installSkills`, compute `const sourceRoot = dirname(sourceDir)` and
    `const installRoot = dirname(targetDir)`; ensure both roots, and also call
    `cleanStaleArtifacts(installRoot)` so temp dirs left by an interrupted shared replace are
    removed.
  - After the skill loop, for each `name` in `SHARED_DIRS`: resolve `from = join(sourceRoot, name)`
    and `dest = join(installRoot, name)`. If `from` does not exist, log a warning and continue
    without recording ownership. If `entryExists(dest)` and the marker does not list `name` in
    `shared` and `force` is false, log the existing conflict message and skip. Otherwise install
    with `linkEntry` (link mode) or `atomicReplace({ from, targetDir: installRoot, name,
    recursive: true })`.
  - Extend `writeMarker` to accept and persist `shared`, and return the owned shared names from
    `installSkills`.
  - Update `main`'s install summary to report the shared dirs.

- [x] **T-01.3 — Implement uninstall and status for shared dirs.** ✅ (completed: 2026-09-24 22:55) In `install-skills.mjs`:
  remove each `marker.shared` entry from `join(dirname(targetDir), name)` (recursive, only when
  owned and present), and have `printStatus` warn when a marker-recorded shared dir is missing.
  Keep `readSkillsMarker` working: it still requires `Array.isArray(marker.skills)`, so `shared`
  stays optional for backward compatibility with markers written by older versions.

- [x] **T-01.4 — Docs.** ✅ (completed: 2026-09-24 22:56) Add an `## Unreleased` section to `CHANGELOG.md` with a `### Fixes` entry
  (the release tool replaces this section on release). Add a short sentence to the README install
  section (around `README.md:48`) stating that `_shared/` and `references/` are installed beside
  `skills/` so the skills' relative links resolve.

- [x] **T-01.5 — Full verify.** ✅ (completed: 2026-09-24 22:56) Run `npm run verify` and confirm type-check, all tests, and the
  version-parity guard pass.

- [x] **T-01.6 — Commit** with the **git-commit skill**; suggested message:
  `fix(installer): install _shared and references beside the skills`.
  ✅ (completed: 2026-09-24 23:09) Commit `8f964bc`, pushed to `main`.
  Released via the Release workflow (run 36059275317): published `opencode-codeops@1.7.0`
  (`latest`) on npm with signed provenance. The workflow derived a minor bump because the
  remote carries no release tags beyond `v1.3.1`, so a `feat` commit since `v1.3.1` was in
  range; reported separately as a release-tooling issue (lightweight tags are never pushed
  because `gitPush` uses `--follow-tags`).

## Post-phase review (strict defaults)

Independent review on the whole-task diff (correctness + maintainability + standards).

| ID | Severity | Finding | Ruling | Status |
|----|----------|---------|--------|--------|
| RV-001 | 🟠 MAJOR | Shared dirs installed beside the symlink parent when the target is a symlink (force mode), so links dangle. | User chose: skip shared install on a symlinked target and warn. | ✅ Fixed |
| RV-002 | 🟡 MINOR | Re-install from a source missing a sibling dropped marker ownership, orphaning the on-disk copy. | User chose: preserve ownership. | ✅ Fixed |
| RV-003 | 🟡 MINOR | Resolution sweep did not assert both siblings were exercised. | User chose: assert `_shared` and `references` counts. | ✅ Fixed |
| RV-004 | 🟡 MINOR | `uninstall` joins marker names without bare-name validation (parity with skills). | Report-only; not adopted. | ⏸ Accepted |

Fixes verified: `npm run verify` PASS (81 tests).

Re-review (scoped to the RV fixes): no findings — RV-001, RV-002, RV-003 verified fixed.
RV-004 remains accepted (report-only).

**Verify**: `npm run verify`
