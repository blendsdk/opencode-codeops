# Task T-05: Map missing reasoning levels to the nearest exposed variant

> **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Progress**: 3/3 tasks (100%)
> **Reasoning**: high — contract behavior change on the request path with security-adjacent tests
> **Last Updated**: 2026-10-04 14:13

## Objective

Make every requested reasoning level take effect on every reasoning-capable model. Today a
level the model does not expose (for example `medium` on a model exposing only
`low`/`high`/`max`) is silently skipped, so the most common plan suggestion does nothing.
Instead, when the exact variant is missing, apply the nearest exposed variant by the provider
scale; ties resolve to the higher level. `none` stays exact-match only. Only when no variant can
be chosen is the request left unchanged.

**Smallest viable design:** one exported selector in the existing reasoning-effort helper, used
by `applyEffort` and the optional trace; documentation and tests updated to the new contract.
No new dependency, no new configuration, no default behavior change for models that expose the
requested level.

## Tasks

- [x] T-05.1 Update and extend the specification tests for nearest-variant selection (red) ✅ (completed: 2026-10-04 14:12)
- [x] T-05.2 Implement the selector, rewire `applyEffort`, trace the applied level, and correct the docs ✅ (completed: 2026-10-04 14:13)
- [x] T-05.3 Full verification and a hook-level harness proving `medium` resolves to `high` on a `low`/`high`/`max` model ✅ (completed: 2026-10-04 14:13)

**Verify**: `npm run verify`
