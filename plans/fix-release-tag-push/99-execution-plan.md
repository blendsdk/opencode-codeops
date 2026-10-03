# Task T-02: Push release tags by creating annotated tags

> **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Phase baseline tree**: 63e8c37791ca41d71f47e633267a6758b7e1c2f2
> **Progress**: 4/4 tasks (100%)
> **Last Updated**: 2026-09-24 23:16

## Objective

The release tool creates lightweight tags (`git tag vX.Y.Z`) but pushes with
`git push --follow-tags`, which pushes only **annotated** tags. Every release tag created by the
Release workflow was therefore never published: the remote carried no tag beyond `v1.3.1`, so the
next release's `lastTag()` fell back to `v1.3.1`, pulled an old `feat` commit into range, and bumped
`1.6.0 → 1.7.0` (minor) instead of a patch. The fix makes the tool create annotated tags so
`--follow-tags` actually pushes them.

**Smallest viable design:** in `scripts/release.mjs`, `commitAndTag` currently runs
`git tag v${version}`. Build the tag with `-a` and a `-m` message instead. Extract the tag arguments
into a small exported pure function `tagArgs(version)` so the annotation contract can be
unit-tested without invoking git, matching the test file's stated scope (pure rules only).

**Decisions (user-specified):** the fix approach is annotated tags. As an out-of-band repair, tags
`v1.4.0`–`v1.7.0` were created as annotated tags at their release commits and pushed.

**Complexity check:** a one-function change plus a pure unit test in the existing suite; no new
layer, dependency, harness, or framework. The Complexity Escalation Gate does not trigger.

## Tasks

- [x] **T-02.1 — Specification test (red).** ✅ (completed: 2026-09-24 23:16) In `scripts/release.spec.test.mjs`, import `tagArgs`
  and assert `tagArgs("1.2.3")` returns the annotated form
  `["tag", "-a", "v1.2.3", "-m", "opencode-codeops v1.2.3"]`. Run `npm test` and confirm it fails
  because `tagArgs` is not exported yet.
- [x] **T-02.2 — Implement (green).** ✅ (completed: 2026-09-24 23:16) In `scripts/release.mjs`, add and export
  `tagArgs(version)` returning the annotated tag arguments, and make `commitAndTag` run
  `run("git", tagArgs(version))` instead of the lightweight `git tag v${version}`.
- [x] **T-02.3 — Full verify.** ✅ (completed: 2026-09-24 23:16) Run `npm run verify`.
- [x] **T-02.4 — Commit + push** ✅ (completed: 2026-09-24 23:16) with the **git-commit skill**; suggested message:
  `fix(release): create annotated tags so --follow-tags pushes them`.

**Verify**: `npm run verify`
