# Skill Descriptions: Right-Sized Verification (Wave 1)

> **Document**: 03-04-skill-descriptions.md
> **Parent**: [Index](00-index.md)

## Overview

Descriptions decide when a skill loads; when they summarize the workflow, agents tend to follow
the summary instead of the body. Rewrite all 18 to trigger-only form (AR-21).

## Rules (AR-21)

1. Start with `Use when` followed by the situations and trigger phrases (keep every trigger phrase
   the current description lists, e.g. `make-plan`, `plan this feature`).
2. Where a sibling is easily confused, add `Not for <case> (use <skill>).` Pairs to cover:
   make-requirements / make-plan / grill-me / preflight / exec-plan / retro-requirements /
   upgrade-plan / roadmap.
3. ≤500 characters after folding (07 §Folding rule).
4. No workflow summary (no gates, loops, step lists, or internal modes). Invocation arguments a
   user types (e.g. `--auto-commit`) may stay. Any fact removed from a description must already
   exist in that skill's body; if it does not, move it into the body.
5. Keep phrases pinned by existing spec tests: `organize-tests` keeps a single-line `description:`
   value containing `test-impact map` on that same line
   (`scripts/organize-tests-content.spec.test.mjs:49`).
6. Use either an inline plain value without `: ` or ` #`, or a `>-` block. `name:` is unchanged.

## Example

Before (`exec-plan`, 931 chars) → after (illustrative, ≤500):

```yaml
description: >-
  Use when the user wants to execute, run, continue, or resume an implementation plan created by
  make-plan — "exec-plan", "run the plan", "execute the plan", "continue the plan for <feature>".
  Accepts a feature name and --ask-commit, --no-commit, or --auto-commit. Not for creating a plan
  (use make-plan) or auditing one (use preflight).
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|---|---|---|
| A rewrite would drop a fact absent from the body | Add the fact to the body in the same task | AR-21 |
| An existing test pins description wording | Keep that wording | AR-27 |
