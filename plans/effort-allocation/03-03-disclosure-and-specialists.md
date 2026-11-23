# 03-03: Disclosure and Specialist Default

> **Document**: 03-03-disclosure-and-specialists.md
> **Parent**: [Index](00-index.md)
> **Status**: Planning Complete
> **CodeOps Artifact Schema**: 1

## Scope

Implement the single dispatch-header contract, the effort/independence disclosure on preflight,
exec-plan, and plan surfaces, the setup-routing policy text, and the new-specialist default with
the legacy `max` exception.

**Requirements:** RD-03 FR-9–FR-11, FR-13–FR-18; AR-2, AR-19, AR-22, AR-24.

## Dispatch header

`_shared/quality-profile.md` is the single owner:

```text
[codeops-dispatch agent=<name> feature=<slug> phase=<id> unit=<id> model=<pin|inherited> effort=<requested> independence=<mixed-model|mixed-effort|uniform-effort>]
```

- Omit `effort=` when there is no active level (inherit).
- `independence` uses only the three canonical values; `same-model` is a model-axis fact, never an
  independence status.
- RD-01 and RD-02 reference this contract; they do not define a second header.
- The preflight-auditor packet row becomes mode-aware (`preflight-audit` or `coverage-hunt`).

## Preflight disclosure

`skills/preflight/SKILL.md` and `skills/preflight/report-format.md`:

- `--thorough` recommends uniform `xhigh`, not `max`.
- The report header adds:
  `> **Independence**: mixed-model | mixed-effort | uniform-effort`
- Every effort-bearing finding batch/report adds
  `Effort: <requested>→<applied> (<mapping>)`; omit when inherit.

`_shared/reasoning-effort.md` owns the skill recommendation table and plan-suggestion derivation:
preflight `high`, `--thorough` uniform `xhigh`, plan adversarial `xhigh`, canonical `max` explicit
only. Preflight’s dimensions and fan-out are unchanged.

## Exec-plan disclosure

`skills/exec-plan/execution-protocol.md` session summary adds:

```markdown
**Review Independence:** mixed-model | mixed-effort | uniform-effort
**Effort:** <requested>→<applied> (<mapping>)
```

Omit the effort line when no level is active.

## Plan and setup-routing text

- `skills/make-plan/templates.md`: the `Reasoning` line lists `low`, `medium`, `high`, `xhigh`,
  `max`; adversarial phases suggest `xhigh`; `max` is explicit-only.
- `skills/make-plan/quality-checklist.md`: add an effort-disclosure item for plans that carry an
  effort suggestion.
- `skills/setup-routing/SKILL.md` and `routing.md`: explain canonical levels, the `xhigh` ceiling,
  the max guard, optional model diversity, and the `xhigh` new-specialist default. Do not require
  a model pin.

## Specialist default and legacy exception

`scripts/install_agents.py`:

- New generated agents emit `reasoningEffort: xhigh` (or no override when the role has no reasoning
  default), never `max` by default.
- New generated files carry `# CodeOps-Agent-Version: 2` in the generated comment block **after**
  the YAML frontmatter, never before it; the frontmatter must remain the first line.
- `--check`:
  - new files: expected content is the `xhigh` default plus the version marker;
  - pre-marker files with `reasoningEffort: max` are `LEGACY` (accepted, reported as a note, not an
    error);
  - a pre-marker file with any other reasoning value is `STALE`/`INVALID` as today;
  - a versioned file with `max` is `STALE` and must be regenerated.
- Hand-authored files remain untouched.
- Existing `agent-pipeline-reviewer` (pre-marker `max`) remains valid as a legacy file.

The installer spec test must cover new-default, legacy-accept, and versioned-stale cases.

## Documentation

- `README.md`: five levels, `xhigh` ceiling, max guard, provider table, optional diversity,
  specialist default/legacy.
- `CHANGELOG.md`: user-facing behavior change (`xhigh`, max guard, distant-jump fail-open,
  specialist default).
- `skills/setup-routing/routing.md`: remove the four-level-only statements.

## Error handling

| Case | Behavior |
|------|----------|
| Missing report/summary field | Content test fails; no gate depends on effort |
| No active level | Omit effort, do not invent `default` |
| Legacy generated agent | `LEGACY` note; accepted |
| Versioned agent still uses `max` | `STALE`; regenerate |
| Unsupported model pin | Inherit; disclose fallback |

## Security

- No secrets in the header, report, summary, or capability line.
- The installer preserves hand-authored files and refuses symlinked targets as today.
- Cross-provider diversity remains optional and approved per project policy.

## Acceptance

- ST-19 through ST-25 pass.
- One header contract is asserted by a content test.
- Preflight report and exec summary include the three independence forms and the effort line.
- New specialists default to `xhigh`; pre-marker `max` is legacy-valid; versioned `max` is stale.
- README/CHANGELOG/routing docs describe the new behavior.

## Traceability

| Fact | Owner |
|------|-------|
| Header contract | `_shared/quality-profile.md` |
| Level/resolution policy | 03-01, 03-02 |
| Installer behavior | this document |
| ST cases | 07-testing-strategy.md |
