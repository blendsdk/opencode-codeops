# Current State: Effort Allocation

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)
> **Status**: Planning Complete
> **CodeOps Artifact Schema**: 1

## Existing implementation

| Surface | Current behavior | Evidence |
|---------|------------------|----------|
| Suggestion levels | Four: `low`, `medium`, `high`, `max`; marker and `isEffortLevel` use the same four | `bin/lib/reasoning-effort.mjs:34,70,83` |
| Routing enum | Already accepts `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max` | `bin/lib/reasoning-effort.mjs:44`; `schemas/codeops-config.schema.json:43` |
| Rank | `EFFORT_RANK` already includes `xhigh` | `bin/lib/reasoning-effort.mjs:312-320` |
| Variant selection | Exact canonical match, then nearest canonical key; ties resolve higher | `bin/lib/reasoning-effort.mjs:339-371` |
| No-variant path | Sends raw `reasoningEffort: level` when the model advertises reasoning but has no variants record | `bin/lib/reasoning-effort.mjs:395-406` |
| Helper | Python session writer accepts only four levels | `scripts/codeops_effort.py:22-23,202-208` |
| Type declaration | `EffortLevel` is four levels | `bin/lib/reasoning-effort.d.mts:9` |
| Plugin | Applies variants in the context hook; no capability line or mapping disclosure | `plugin/index.ts:296-371` |
| Shared contract | Says four levels; preflight `--thorough` recommends `max`; plan derivation maps complex phases to `max` | `_shared/reasoning-effort.md:19,84,104` |
| Quality profile | Header lacks `unit`, `model`, `effort`, `independence`; preflight-auditor packet is preflight-only | `_shared/quality-profile.md:90-108` |
| Preflight report | No independence or effort line | `skills/preflight/report-format.md:67-88` |
| Exec summary | No independence or effort line | `skills/exec-plan/execution-protocol.md:502-525` |
| Plan templates | Reasoning line enumerates `low/medium/high/max` | `skills/make-plan/templates.md` Reasoning template |
| Setup routing | Four-level suggestion vocabulary; specialists default `max` | `skills/setup-routing/routing.md:30,47-55` |
| Installer | Custom specialists default `reasoningEffort: max` | `scripts/install_agents.py:592,622` |
| Tests | Four-level assertions and marker behavior; no provider fixtures | `bin/reasoning-effort.spec.test.mjs`, `scripts/effort.spec.test.mjs`, `scripts/reasoning-effort-content.spec.test.mjs` |

## Reference verification

| Reference | Result |
|-----------|--------|
| `skills/exec-plan/execution-protocol.md` | Exists; owns dispatch packet/marker and session summary |
| `_shared/reasoning-effort.md` | Exists; owns levels, precedence, skill table, plan derivation |
| `_shared/quality-profile.md` | Exists; owns dispatch header and packet rows |
| `scripts/codeops_effort.py` | Exists; four-level allowlist |
| `scripts/effort.spec.test.mjs` | Exists; helper parity test |
| `scripts/reasoning-effort-content.spec.test.mjs` | Exists; content assertions |
| `scripts/install_agents.py` | Exists; generated custom-agent default |
| `codeops/test-map/policy.json` | Exists; `ignorePaths` lacks `requirements/**` (AR-9) |

## Constraints and risks

- **Existing tests pin the four-level behavior.** The plan must update them deliberately and keep
  the four-level values accepted.
- **The test map treats `requirements/**` as unknown.** `check --strict` and the task selector fail
  until AR-9 lands; Phase 1 fixes it.
- **No-variant models exist.** The current raw passthrough can send unsupported values; the plan
  removes it.
- **Partial canonical sets can select `max`.** The plan adds the max guard and proves it with
  partial-set fixtures.
- **Existing generated specialists use `max`.** The plan adds a version marker and a legacy-valid
  check so existing files remain valid while new files use `xhigh`.
- **The capability line must not repeat on every request.** The plan dedupes by session and mapping.

## Reusable patterns

- `selectEffortVariant` and `applyEffort` already isolate variant selection and option merging.
- `normalizeModelVariants` already adapts the host array to an id-keyed record.
- `readModelVariants` already resolves the active model record in the plugin.
- `install_agents.py` already owns generated-file boundaries and `--check` drift detection.
- Content tests already assert shared-doc and skill wording; extend them rather than creating a
  parallel content harness.
