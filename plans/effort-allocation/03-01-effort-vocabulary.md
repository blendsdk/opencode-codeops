# 03-01: Effort Vocabulary and Flags

> **Document**: 03-01-effort-vocabulary.md
> **Parent**: [Index](00-index.md)
> **Status**: Planning Complete
> **CodeOps Artifact Schema**: 1

## Scope

Implement the five-level canonical vocabulary and make it usable through the marker, the
`--auto-effort` flag, the Python session helper, and the TypeScript declarations. This component
does not implement provider resolution or disclosure; those are 03-02 and 03-03.

**Requirements:** RD-03 FR-2, FR-12, FR-18; AR-19, AR-24.

## Data and interfaces

### JavaScript core

`bin/lib/reasoning-effort.mjs`:

| Export | Change |
|--------|--------|
| `EFFORT_LEVELS` | `["low", "medium", "high", "xhigh", "max"]` |
| `isEffortLevel(value)` | Accepts the five values |
| `findEffortMarker(texts)` | Marker regex accepts `xhigh` |
| `resolveEffort` | Unchanged precedence; accepts `xhigh` from the marker/session/routing |
| `isRoutingReasoning` | Unchanged; the routing enum already includes `xhigh` |

Marker grammar:

```text
[codeops-effort: <low|medium|high|xhigh|max>]
```

Unknown or malformed markers remain ignored, never errors. The first valid marker still wins.

### Python helper

`scripts/codeops_effort.py`:

- `EFFORT_LEVELS` becomes `("low", "medium", "high", "xhigh", "max")`.
- `set --reasoning xhigh` writes the existing state file and exits 0.
- An unknown value exits 2 with the existing invalid-level message.
- The state file schema stays `{"schema":1,"reasoning":"<level>"}`.

### Type declarations

`bin/lib/reasoning-effort.d.mts`:

```ts
export type EffortLevel = "low" | "medium" | "high" | "xhigh" | "max"
```

All signatures that use `EffortLevel` keep their shape; only the union widens.

### Shared contract and skill text

`_shared/reasoning-effort.md`:

- Levels table includes `xhigh` with its meaning and default-ceiling role.
- Marker grammar includes `xhigh`.
- Auto-effort flag examples include `--auto-effort=xhigh`.

The skill recommendation table and plan-suggestion derivation in the same file are owned by 03-03
(disclosure), not this component.

Skill flag sections (`skills/preflight/SKILL.md`, `skills/make-plan/SKILL.md`,
`skills/exec-plan/SKILL.md`) accept `xhigh` in `--auto-effort=<level>`. The existing four values
remain valid.

## Error handling

| Case | Behavior |
|------|----------|
| Unknown marker text | Ignored; the request continues |
| More than one `--auto-effort` token | Argument error |
| Invalid `--auto-effort=<level>` | Argument error listing the five levels |
| Helper state directory unavailable | Fail-open note; continue |
| Unknown helper level | Exit 2; no state file written |
| Existing four-level marker | Accepted unchanged |

## Security

- No new external input beyond the existing flag/marker.
- The helper writes only the small state file under the runtime temp directory; no secrets.
- The plan does not add a network endpoint or credential path.

## Acceptance

- ST-1 through ST-6 pass.
- `EFFORT_LEVELS`, marker, helper, and `.d.mts` agree; a cross-language parity test fails on drift.
- Existing `low/medium/high/max` tests remain green.
- The shared contract and skill text list five levels and the `xhigh` ceiling.

## Traceability

| Fact | Owner |
|------|-------|
| Five levels and marker | this document |
| `xhigh` ceiling / max policy | 03-02 §Resolution |
| Disclosure text | 03-03 §Disclosure |
| ST cases | 07-testing-strategy.md |
