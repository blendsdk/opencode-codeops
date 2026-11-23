# 03-02: Provider Resolution and Capability Line

> **Document**: 03-02-provider-resolution.md
> **Parent**: [Index](00-index.md)
> **Status**: Planning Complete
> **CodeOps Artifact Schema**: 1

## Scope

Implement the small verified provider table, the `max` guard, the no-distant-jump rule, the
fail-open no-variant path, and the plugin capability line. No generic inference pipeline.

**Requirements:** RD-03 FR-5–FR-11, FR-19; AR-1, AR-3, AR-23, AR-24, AR-25.

## Verified provider table

A frozen constant in `bin/lib/reasoning-effort.mjs`, keyed by `providerID`:

```js
const VERIFIED_PROVIDER_ALIASES = Object.freeze({
  openai:    { low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" },
  anthropic: { low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" },
  deepseek:  { low: "low", medium: "high", high: "high", xhigh: "max", max: "max", none: "none" },
})
```

**Rules:**

- The table is a fallback for models that do not expose the canonical level.
- Runtime `variants` are authoritative; an exact canonical match wins even when the table differs.
- Gateways and unknown `providerID`s have no entry and fail open.
- The DeepSeek entry applies to the `deepseek` provider. A model that exposes `medium` uses that
  exact variant; the table’s `medium→high` applies only when `medium` is absent.
- `default` is never selected.

## Resolution algorithm

```text
selectVariant(requested, model):
  if requested == "none":
    return exact "none" or undefined
  variants = normalized runtime variants
  if variants has requested:
    return requested
  alias = VERIFIED_PROVIDER_ALIASES[model.providerID]?.[requested]
  if alias and variants has alias:
    return alias
  nearest = nearest exposed canonical variant
  if nearest is undefined:
    return undefined
  if nearest == "max" and requested != "max":
    return undefined                      # max guard
  if |rank(nearest) - rank(requested)| > 1:
    return undefined                      # no distant jump
  return nearest
```

`applyEffort` merges the selected variant’s settings. If no variant is selected, it returns the
original options unchanged. The raw `reasoningEffort` passthrough for a model with no variants
record is removed.

## Provider/model wiring

`plugin/index.ts` currently resolves the model record for variants. The plan extends that path to
pass `providerID` and `modelID` into the resolver:

```ts
const modelInfo = await readModelInfo(ctx, event.model)
const applied = applyEffort(event.options, level, {
  variants: modelInfo.variants,
  providerID: event.model.providerID,
  modelID: event.model.id,
  contextLimit: modelInfo.limit.context,
})
```

`readModelInfo` keeps one registry lookup; no second model call is added.

## Capability line

When a resolved level is applied, the plugin injects one content-free system line:

```text
CodeOps effort: model=<provider>/<id>; variants=<a,b,c>; context=<limit>; requested=<level>; applied=<variant|unavailable>; mapping=<exact|alias|nearest|fail-open>
```

**Dedupe state:** a `Map` in the plugin keyed by `sessionID` with the last
`{ requested, applied, mapping }`. Inject only when the tuple changes. Clear on `session.deleted`.
No line when no level is active.

**Sanitization:** escape/JSON-quote identifiers, strip CR/LF/control characters, cap length, and
allowlist `[A-Za-z0-9._:/-]` for model/variant/provider IDs before they enter the line or header.

## Edge cases

| Case | Behavior |
|------|----------|
| Exact canonical variant | Use it |
| DeepSeek `medium` absent | Use `high` |
| DeepSeek `xhigh` absent | Use `max` |
| OpenAI/Anthropic `xhigh` present | Use `xhigh`; no default `max` |
| Partial set `{low, high, max}`, request `xhigh` | Fail open (max guard) unless the DeepSeek alias applies |
| Set `{max}` only, request `low` | Fail open; never `max` |
| Unknown/non-canonical variant names | Fail open; disclose `mapping=fail-open` |
| Malformed variant entry | Ignore it; fail open if none remain |
| `none` and provider has no `none` | Leave unchanged; never map to a reasoning level |
| No variants record | Return original options; no raw `reasoningEffort` |
| Model pin unavailable | Inherit; disclose the fallback |

## Error handling and observability

- No provider error; failure is always fail-open.
- Optional trace records `mapping` and `applied`; content-free.
- The capability line is deduplicated and never contains prompt or file content.

## Security

- Provider/model IDs are untrusted strings; sanitize before prompt-bound use.
- Using the current model is the default; cross-provider diversity requires explicit approval.
- No credentials or secrets enter the resolver, line, trace, or report.

## Acceptance

- ST-7 through ST-18 pass.
- Partial sets, only-`max`, malformed variants, and unknown providers fail open.
- DeepSeek `medium→high`, `xhigh→max`, `none→none` are asserted by fixtures.
- No raw `reasoningEffort` passthrough remains.
- Capability line is emitted once per changed tuple and cleared on session deletion.
- Identifier sanitization is tested with control characters and overlong values.

## Traceability

| Fact | Owner |
|------|-------|
| Provider table and resolver | this document |
| Five-level vocabulary | 03-01 |
| Disclosure surfaces | 03-03 |
| ST cases | 07-testing-strategy.md |
