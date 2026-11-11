# Coding standards (CodeOps) — core

These apply to all code I write unless this project's `AGENTS.md` overrides a specific point.
This is the compact, always-injected core; the complete text lives in
`standards/coding-standards-full.md` — **read it before writing substantial code or tests.**
Do not duplicate these standards in `~/.config/opencode/AGENTS.md` — the plugin injects them.

## Quality & structure
- **DRY**; **clarity over cleverness** (junior-readable); **single responsibility**; **no dead
  code**; **consistency with the existing codebase is non-negotiable**; be explicit when in doubt.
- Split files before ~700 lines (aim for 200–500); respect module boundaries (import public APIs only); imports at
  the top; keep the dependency surface minimal.
- **NON-NEGOTIABLE documentation:** write for a junior developer; explain complex logic,
  invariants, edge cases, and non-obvious decisions in a calm teaching tone. Document every
  public/exported class, interface, method, function, property, type, and constant, plus every
  non-trivial internal entity, using the language's doc-comment format; add `@example` to public
  APIs where practical. Do not pad trivial private code with comments that merely restate it.
  Never reference `codeops/`/`plans/`/`requirements/`, an execution plan, or a plan/RD/AR/task ID
  in code or doc comments; restate durable rationale in plain language. Full rules:
  `coding-standards-full.md`.
- Statically-typed code: no unsafe casts (`as any`/`as unknown`); use type guards; enums/constants
  for discriminators.

## Security — non-negotiable, from the first line
- Validate and sanitize ALL input server-side (allowlists). Prevent injection: parameterized
  queries, escaped output, no unsanitized shell/`eval`, canonicalized paths (reject `..`),
  anti-CSRF + `SameSite`, rate-limited auth.
- Protect data: TLS in transit, encryption at rest, `bcrypt`/`argon2`/`scrypt` for passwords, no
  hardcoded secrets, never log secrets/PII, minimal prod errors, restrictive CORS, non-root
  containers.

# Testing standards

## Prime directives for verification

1. **Test-first is unchanged.** Specification tests are written before implementation and run
   red, then green. Selection never changes this.
2. **The inner loop runs the smallest safe verification slice.** With a valid map, a task runs the
   selected feature-slice `task` groups plus fast static checks. Without a map, a plan's
   `**Task verify**` command may provide the same scoped behavior; otherwise the full verify runs
   as today.
3. **The outer gate is always full.** The full verify runs at phase/plan completion, before
   push/release, at acceptance, and in CI. A green slice is not a release signal.
4. **Selection fails closed.** Unknown paths, shared infrastructure, manifests/lockfiles,
   test-runner/config changes, CI changes, stale/invalid maps, and selector errors select the
   full suite. No silent skips.
5. **Spec tests are never skipped.** The feature's spec test file always runs, even if the map
   would not select its group. The executor passes the plan's declared spec file(s) with
   `--include`; the selector adds the owning group, or falls back to full if the spec file is
   unowned.
6. **Evidence is explicit.** Verification names the groups or scoped command used, what was
   deferred, and the baseline. CI remains authoritative.

**Conditional wording.** Run the project's full verify command before completing any task or
committing, unless the project has a valid `codeops/test-map.json` or `codeops/test-map/`
directory, or the plan records a validated `**Task verify**` scoped command. With either opt-in,
the task-level verify may run the selected groups or the scoped command; the full verify still
runs at phase/plan completion, before push/merge, at acceptance, and in CI. Any selection error,
unknown path, shared change, or stale map falls back to the full verify. The canonical detail is
`_shared/test-selection.md`.

- **Run the project's verify command before completing any task or committing**; full verify
  before declaring done. No code is "done" while any test fails.
- Granular coverage (happy path, edges, errors, integration); E2E where feasible; real objects
  over mocks (mock only true externals); test files split by concern.
- **Specification vs. implementation tests (non-negotiable):** `[feature].spec.test.[ext]`
  derives from requirements only — an immutable oracle (a failing spec test means the
  implementation is wrong, never the test); `[feature].impl.test.[ext]` covers internals.
  Order: spec tests → red → implement → green → impl tests → verify.
- Security tests are mandatory (input validation, authz, injection, rate limiting). Non-code
  artifacts get validation too — see the full standards' validation-command table.

# Working style
- **Cleanup after yourself (NON-NEGOTIABLE).** Put every temporary artifact you create — logs,
  diffs, patches, commit-message files, scratch directories — under `$CODEOPS_TMPDIR` when it is
  set (otherwise the OS temp directory), never inside the repository, and delete them all before
  reporting a task complete. Never delete user files, versioned artifacts, worktrees, or another
  session's temporary files. If something must outlive the task, name it and say why. Full rules:
  `_shared/workspace-hygiene.md`.
- **Ask before assuming**; **verify previous work** before building on it.
- **Do not overengineer:** use the simplest implementation that fully satisfies the authorized
  requirements and existing project conventions. Do not add abstractions, layers, dependencies,
  services, generalized frameworks, infrastructure, or future-proofing unless authorized
  requirements, existing project conventions, or demonstrated risks require them. Prefer modifying
  and reusing existing patterns; when multiple solutions are correct, choose the smaller one. A
  proposed material support surface triggers the explicit user-approval stop in
  `_shared/zero-ambiguity-gate.md`; `--auto-design` cannot approve it.
- **Grounded options & recommendations (NON-NEGOTIABLE):** Filter (only genuinely viable options,
  no strawmen; ≥2 only when ≥2 are viable) → Second-guess each → Ground in the code (cite
  `file:line`; say so if unverified) → Recommend (lead with it and a concrete reason; you
  recommend, the user decides). Proportionality: ceremony matches stakes. Harden consequential
  recommendations per `_shared/recommendation-hardening.md` (high-stakes decisions get one
  independent challenger; disclose `Confidence:`/`Hardening:` where that protocol requires).

> Project-specific commands, structure, and conventions live in this project's `AGENTS.md`
> (generate/refresh it with the `analyze-project` skill). Multi-step CodeOps workflows are available as
> skills: `make-plan`, `exec-plan`, `make-requirements`, `retro-requirements`, `grill-me`,
> `preflight`, `techdocs`, `roadmap`, `upgrade-plan`, `setup-codeops`, and `setup-routing`.
> Guarded commits, GitHub issues, comment cleanup, and outcome reviews are skills as well.
