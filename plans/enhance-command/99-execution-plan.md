# Task T-09: The /enhance command — improve a question or research prompt, then run it

> **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Progress**: 4/4 tasks (100%)
> **Reasoning**: medium — one plugin command following the existing feature-detected registration pattern
> **Last Updated**: 2026-11-28 12:17

## Objective

`/enhance <prompt>` replaces the user's habit of appending "read, review, enhance and rewrite
this prompt, then use the enhanced one". It targets question and research prompts, where the
user often does not know what else to ask. The command: (1) looks around briefly — AGENTS.md,
named files, 1–3 quick web searches; (2) asks the questions whose answers would change the
direction, as many as needed in one batch plus at most one follow-up batch, never a
requirements interview and never a file; (3) shows the improved prompt — goal, context, added
considerations, related questions, what a good answer looks like, assumptions; (4) runs it.
`--ask` pauses after step 3. A better-fitting CodeOps skill is suggested in one line, never
switched to. Keeps the user's goal; adds angles, never work.

**Smallest viable design:** one framework-free helper module (`bin/lib/enhance-command.mjs`
with its `.d.mts`) that builds the instruction prompt and registers the command through
`ctx.command.transform`, feature-detected and never-throwing; one call site in
`plugin/index.ts`. No skill, no installer change, no configuration, no new dependency.

## Tasks

- [x] T-09.1 Write `plugin/enhance-command.spec.test.mjs`: registration guard, submission to the same session with attachments and delivery kept, `--ask`, empty-prompt usage, the pinned instruction rules, and plugin setup wiring — confirm it fails ✅ (completed: 2026-11-28 12:11; red: 7/7 fail)
- [x] T-09.2 Implement `bin/lib/enhance-command.mjs` + `.d.mts` and register it in `plugin/index.ts` ✅ (completed: 2026-11-28 12:11; 7/7 pass, tsc clean)
- [x] T-09.3 README section and `CHANGELOG.md` Unreleased entry ✅ (completed: 2026-11-28 12:11)
- [x] T-09.4 Full verification (`npm run verify`) and test-map check ✅ (completed: 2026-11-28 12:17; verify 1139/1139, map ok; live: registers and runs on OpenCode 2.4.1)

**Verify**: `npm run verify`
