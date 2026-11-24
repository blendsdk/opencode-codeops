# Routing policy

CodeOps routing lives under the optional `routing` and `quality` fields in `codeops/codeops.json`.

```json
{
  "schema": 1,
  "mode": "strict",
  "artifacts": {"layout": "nested", "root": "codeops"},
  "quality": {
    "independentReview": true,
    "minimumReviewers": 1,
    "stopOnMajorFinding": true
  },
  "routing": {
    "maxConcurrentAgents": 4,
    "roles": {
      "explorer": {"effort": "medium"},
      "executor": {"effort": "high"},
      "correctness-reviewer": {"effort": "high", "sandbox": "read-only"},
      "security-auditor": {"effort": "high", "sandbox": "read-only"}
    }
  },
  "metrics": {"enabled": false}
}
```

Allowed effort values follow the active OpenCode release. Prefer `medium` for bounded reconnaissance, `high` for correctness/security review, and higher supported levels only for genuinely demanding semantic or architectural work.

An optional per-role `reasoning` field sets the reasoning level (`none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`). Generated project specialists default to `xhigh`; a pre-marker generated agent that embeds `max` remains a legacy exception until it is regenerated. A routing value wins over the brief and is embedded without provider-capability detection. At runtime the plugin applies a level only when the active model exposes a usable variant; an unsupported value leaves the request unchanged and reports `mapping=fail-open` (see the policy below).

```json
"roles": {
  "pg-migration-reviewer": {"reasoning": "xhigh"}
}
```

## Reasoning effort policy

A role's `reasoning` entry is a project default, not the only source. The runtime resolution
order is `dispatch marker > session auto-effort > routing role default > inherit parent variant`
(see [../../_shared/reasoning-effort.md](../../_shared/reasoning-effort.md)). A dispatch marker
comes from an execution plan's per-phase suggestion; a session level comes from an explicit
`--auto-effort` run. Both override the routing default for their scope, and routing applies only
when a role entry exists — with no entry the child inherits the parent variant.

The suggestion vocabulary is `low`, `medium`, `high`, `xhigh`, and `max`, while the routing field
accepts the wider provider enum (`none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`).
`xhigh` is the ceiling for adversarial or high-risk work; a max guard keeps `max` explicit-only.
Runtime variants are authoritative: an exact canonical variant wins, then the verified provider
table applies (DeepSeek `medium→high`, `xhigh→max`), then a nearest canonical variant only when it
is one step away. `none` stays exact-match only. On the deepseek flash model in this environment
(`low`/`high`/`max`), `medium` therefore resolves to `high`. Confirm the active set with
`CODEOPS_EFFORT_TRACE=1` and `variantLevels` on an apply line (see
[../../_shared/reasoning-effort.md](../../_shared/reasoning-effort.md)). Prefer `low` for
mechanical work, `medium` for bounded implementation, `high` for planning and review, `xhigh` for
adversarial analysis, and `max` only by explicit user choice. A value that cannot be mapped fails
open, so a routing entry never produces a provider error.

Model pins are optional per role. When omitted, OpenCode resolves the model from the explicit spawn, project defaults, and parent session. A missing pin must never block the workflow. Model diversity across roles is also optional: it needs the project's approval and a stated provider boundary; same-provider mixed effort already provides an independence axis.

Reviewer selection is driven by risk tags:

| Tag | Required role |
|---|---|
| `security` | security auditor |
| `financial-integrity` | financial-integrity auditor |
| `concurrency` | concurrency auditor |
| `performance-critical` | performance auditor |
| `compiler-semantics` | semantics reviewer |
| `migration` | migration/data-integrity reviewer |
| all non-trivial phases | correctness reviewer |

Multiple applicable tags produce a review team. Combine closely related lenses into one agent only when independence is not lost and the packet remains bounded.
