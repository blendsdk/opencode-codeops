# Testing Strategy: Effort Allocation

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)
> **Status**: Planning Complete
> **CodeOps Artifact Schema**: 1

## Strategy

Specification-first. Every behavior phase writes its spec tests, confirms red, implements, then
adds impl tests and runs the phase gate. Unit tests cover the resolver and helper; content tests
cover the shared contract and skill surfaces; installer tests cover the generated-agent default and
legacy path; the full gate is `npm run verify`.

## Test slices

| Slice | Tier | Test files | Sources | Depends On | Gate |
|-------|------|------------|---------|------------|------|
| `bin.runtime` | task | `bin/effort-vocabulary.spec.test.mjs`, `bin/effort-provider.spec.test.mjs`, `bin/effort-provider.impl.test.mjs`, existing `bin/reasoning-effort.*` | `bin/lib/reasoning-effort.mjs`, `.d.mts` | `shared.schemas` | task |
| `scripts.tooling` | task | `scripts/effort.spec.test.mjs`, `scripts/reasoning-effort-content.spec.test.mjs`, `scripts/effort-disclosure-content.spec.test.mjs`, `scripts/install_agents.spec.test.mjs` | `scripts/codeops_effort.py`, `scripts/install_agents.py`, docs | `shared.schemas` | task |
| `plugin.runtime` | task | `plugin/effort-capability.spec.test.mjs`, `plugin/effort-capability.impl.test.mjs` | `plugin/index.ts` | `shared.schemas` | task |
| `content.guidance` | task | existing content tests | `skills/**`, `_shared/**` | `shared.schemas` | task |
| `full` | release | `npm run verify` | all | all | release |

## Specification test cases

| ID | Case | Input → expected output | Trace |
|----|------|-------------------------|-------|
| ST-1 | Five-level vocabulary | `EFFORT_LEVELS` → exactly `["low","medium","high","xhigh","max"]` | RD-03 FR-2; AR-24 |
| ST-2 | Marker accepts `xhigh` | `[codeops-effort: xhigh]` → parsed `xhigh` | RD-03 FR-12; AR-24 |
| ST-3 | Existing markers still parse | each of `low`, `medium`, `high`, `max` → same level | RD-03 FR-17 |
| ST-4 | Helper accepts `xhigh` | `codeops_effort.py set --reasoning xhigh` → exit 0; state file `{"schema":1,"reasoning":"xhigh"}` | RD-03 FR-12; AR-24 |
| ST-5 | Helper rejects unknown level | `set --reasoning default` → exit 2; no state write | RD-03 FR-2; AR-24 |
| ST-6 | Cross-language parity | JS `EFFORT_LEVELS` = Python `EFFORT_LEVELS` → true | RD-03 FR-12 |
| ST-7 | OpenAI identity | variants `{low,medium,high,xhigh,max}`; requests `low/high/xhigh/max` → same level | RD-03 FR-5; AR-25 |
| ST-8 | Anthropic identity | same fixture as ST-7 → same level | RD-03 FR-5; AR-25 |
| ST-9 | DeepSeek mapping | variants `{low,high,max}`; `medium→high`, `xhigh→max`, `none→none` | RD-03 FR-5; AR-25 |
| ST-10 | DeepSeek exact wins | variants `{low,medium,high,max}`; `medium→medium`, `xhigh→max` | RD-03 FR-5; AR-25 |
| ST-11 | Partial-set max guard | OpenAI variants `{low,high,max}`; request `xhigh` → fail-open (no `max`) | RD-03 FR-6; AR-24 |
| ST-12 | Only-max guard | variants `{max}`; request `low` → fail-open | RD-03 FR-7; AR-24 |
| ST-13 | Unknown provider names | variants `{fast,balanced,deep}`; request `high` → fail-open, mapping `fail-open` | RD-03 FR-5, FR-7 |
| ST-14 | Malformed variants | variants `{high:"invalid"}`; request `high` → fail-open, no error | RD-03 FR-8 |
| ST-15 | `none` unavailable | OpenAI fixture without `none`; request `none` → options unchanged | RD-03 FR-2; AR-24 |
| ST-16 | No raw passthrough | model `{capabilities:{reasoning:true}}` with no variants; request `xhigh` → original options, no `reasoningEffort` | RD-03 FR-8; AR-21 |
| ST-17 | Capability line content | resolved `high→xhigh`; line contains model, variants, context, requested, applied, mapping; no prompt/path | RD-03 FR-9; AR-3 |
| ST-18 | Capability-line dedupe | same tuple twice → one injection; changed tuple → second; `session.deleted` → state cleared | RD-03 FR-9; AR-3 |
| ST-19 | Identifier sanitization | model ID `bad\nmodel]` → control chars stripped/escaped; one-line header | RD-03 FR-9; security |
| ST-20 | Single header contract | content check: one header with `unit`, `model`, `effort`, `independence`; `effort=` omitted on inherit | RD-03 FR-11; AR-19 |
| ST-21 | Preflight disclosure | report header contains `Independence:` and `Effort: <requested>→<applied>`; three status forms accepted | RD-03 FR-10; AR-22 |
| ST-22 | Exec summary disclosure | session summary contains `Review Independence:` and `Effort:`; omitted when inherit | RD-03 FR-10; AR-22 |
| ST-23 | New specialist default | generated new file → `reasoningEffort: xhigh` and `# CodeOps-Agent-Version: 2` in the comment block after the frontmatter | RD-03 FR-14; AR-2 |
| ST-24 | Legacy specialist valid | pre-marker file with `reasoningEffort: max` → `LEGACY`, not error | RD-03 FR-14; AR-2 |
| ST-25 | Versioned max stale | versioned file with `max` → `STALE` | RD-03 FR-14; AR-2 |
| ST-26 | Test map ignores requirements docs | `node bin/codeops-test.mjs check --strict` → 0; task selection no longer full-fallbacks on `requirements/**` | AR-9 |
| ST-27 | Compatibility | existing four-level tests remain green; CHANGELOG records `xhigh`, max guard, distant-jump change | RD-03 FR-17 |
| ST-28 | Disclosure omission | no active level → effort field absent; no `default` invented | RD-03 FR-10; AR-13 |

## Verify commands

**Task verify**

```bash
node bin/codeops-test.mjs run --gate task --baseline HEAD \
  --include bin/effort-vocabulary.spec.test.mjs \
  --include bin/effort-provider.spec.test.mjs \
  --include bin/effort-provider.impl.test.mjs \
  --include plugin/effort-capability.spec.test.mjs \
  --include plugin/effort-capability.impl.test.mjs \
  --include scripts/effort.spec.test.mjs \
  --include scripts/reasoning-effort-content.spec.test.mjs \
  --include scripts/effort-disclosure-content.spec.test.mjs \
  --include scripts/install_agents.spec.test.mjs
```

The selected `bin.runtime`, `scripts.tooling`, and `plugin.runtime` groups auto-include new
`*.test.mjs` files through their `{tests}` patterns. This command becomes usable after AR-9 adds
`requirements/**` to `ignorePaths`.

**Task verify evidence:** interim scoped `node --test` run observed **127 passing tests** on
2026-11-24 (existing effort, helper, content, and installer specs). The test-map command will be
validated at the end of Phase 1 after AR-9.

**Phase verify (gate)**

```bash
npm run verify
```

**Map check**

```bash
node bin/codeops-test.mjs check --strict
```

## Test files

| File | Owner |
|------|-------|
| `bin/effort-vocabulary.spec.test.mjs` | new — vocabulary, marker, parity |
| `bin/effort-provider.spec.test.mjs` | new — provider fixtures |
| `bin/effort-provider.impl.test.mjs` | new — edge cases, max guard, no-variant |
| `plugin/effort-capability.spec.test.mjs` | new — capability line/dedupe |
| `plugin/effort-capability.impl.test.mjs` | new — sanitization, session clear |
| `scripts/effort.spec.test.mjs` | extend — helper xhigh/parity |
| `scripts/reasoning-effort-content.spec.test.mjs` | extend — shared-doc wording |
| `scripts/effort-disclosure-content.spec.test.mjs` | new — header/report/summary |
| `scripts/install_agents.spec.test.mjs` | extend — default/marker/legacy |
| `scripts/test-selection-docs.spec.test.mjs` | existing — AR-9 map check |

## Security tests

- ST-19 identifier sanitization.
- Capability line contains no prompt, path, or secret (ST-17).
- Provider table is exact-match only; unknown providers fail open (ST-13).
- No raw unsupported value is sent to a provider (ST-16).
- Generated-agent writes preserve hand-authored files (installer tests).
