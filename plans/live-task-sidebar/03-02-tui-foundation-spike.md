# TUI Foundation Spike: live-task-sidebar (slice 1)

> **Document**: 03-02-tui-foundation-spike.md
> **Parent**: [Index](00-index.md)
> **Files**: `bin/lib/codeops-rpc.mjs`, `bin/lib/codeops-rpc.d.mts`, `plugin/index.ts`, `plugin/tui.tsx`, `package.json`, `tsconfig.json`

## Overview

The spike proves, on the installed OpenCode v2 build, that a packaged TUI entry can render
server-owned data in the sidebar — the load-bearing mechanism the full feature (slice 2) depends
on. It ships the smallest honest foundation: a guarded `codeops.status` RPC and a one-line
`sidebar.content` strip that renders only when the server answers (AR #6, #13). No state machine,
no tool, no polling, no plan parsing.

## Architecture

### Proposed Changes

```
┌─ OpenCode v2 ────────────────────────────────────────────────┐
│  server process                     terminal (TUI) process   │
│  ┌─ plugin/index.ts (opencode-codeops)                      │
│  │    setup() ──registerCodeOpsRpc(ctx)──► codeops.status    │
│  │                                          │ RPC over the    │
│  │                                          ▼ connected      │
│  │  plugin/tui.tsx (opencode-codeops-tui)  client           │
│  │    ui.slot(append: "sidebar.content") ── status({})       │
│  │    render: `CodeOps v<version>` only on success           │
│  └───────────────────────────────────────────────────────────┘
└──────────────────────────────────────────────────────────────┘
```

### Component A — `bin/lib/codeops-rpc.mjs` (+ `.d.mts`)

The RPC definition is plain data (the SDK's `Rpc.define` is identity plus reserved-name
validation, `@opencode/schema/dist/rpc.js`), so the module needs no runtime import of the SDK and
`node --test` exercises it directly. The `.d.mts` gives `plugin/index.ts` and `plugin/tui.tsx`
typed access (the `bin/lib/reasoning-effort.*` pattern).

```js
export const CodeOpsRpc = {
  id: "codeops",
  methods: {
    status: {
      input:  { type: "object", additionalProperties: false },
      output: {
        type: "object",
        additionalProperties: false,
        required: ["pluginVersion", "openCodeVersion", "directory"],
        properties: {
          pluginVersion:   { type: "string" },
          openCodeVersion: { type: "string" },
          directory:       { type: "string" },
        },
      },
    },
  },
  events: {},
}

export async function registerCodeOpsRpc(ctx, { pluginVersion } = {}) { /* see contract */ }
```

`registerCodeOpsRpc` contract (AR #9):

1. Returns `false` — without throwing — when `ctx.rpc.register` is not a function (older build)
   or when registration fails for any reason.
2. Registers when available; the `status` handler returns exactly
   `{ pluginVersion, openCodeVersion: ctx.app.version, directory: ctx.location.directory }`;
   all values coerced to strings.
3. Returns `true` on success. It modifies nothing else and reads no files.

The module also exports `isCodeOpsStatus(value)`, the type guard for the RPC result (AR #20).
JSON-Schema payloads type as `unknown`, the coding standards ban unsafe casts, and Node cannot
unit-test a guard inside `.tsx` — so the guard lives here, next to the contract it validates.

### Component B — `plugin/index.ts` wiring

After the existing tool-hook block, before the cleanup return:

```ts
try {
  const registered = await registerCodeOpsRpc(ctx, { pluginVersion: packageVersion })
  if (!registered) warnContentFree("The codeops status RPC is unavailable in this OpenCode build; the sidebar status stays hidden.")
} catch {
  warnContentFree("Could not register the codeops status RPC.")
}
```

Existing hooks, standards injection, effort handling, environment export, and the cleanup are
untouched (FR-8). The registration lives with the plugin instance; the host disposes it on unload.

### Component C — `plugin/tui.tsx`

```tsx
export default Plugin.define({
  id: "opencode-codeops-tui",
  setup(context) {
    return context.ui.slot({ append: "sidebar.content", render: () => <CodeOpsStrip /> })
  },
})
```

`CodeOpsStrip` (inside the slot's JSX tree, so `usePlugin()` is valid per the official docs):

- calls `context.client.rpc(CodeOpsRpc).status({})` once per mount via `createResource`;
- narrows the result with the helper's `isCodeOpsStatus` guard (no unsafe casts, AR #20);
- renders a single `<text>` line `CodeOps v<pluginVersion>` only when the payload is valid;
- renders `null` on any failure — no error text, no spinner, no retry, no timer (AR #13);
- uses default styling; theme tokens are slice 2's concern.

### Component D — packaging and configuration

| Change | Value | AR Ref |
| ------ | ----- | ------ |
| `package.json` exports | add `"./tui": "./plugin/tui.tsx"` | AR #7 |
| `package.json` devDependencies | `@opentui/core` 0.5.17, `@opentui/solid` 0.5.17, `solid-js` 1.9.12 — the exact peer the OpenTUI releases pin, which also satisfies the SDK's `>=1.9.0` range; `npm install` additionally resolves `web-tree-sitter@0.25.10` (an `@opentui/core` peer) and may print advisory `EBADENGINE` warnings under Node 22/24 | AR #11 |
| `package.json` peerDependencies (+ `peerDependenciesMeta` optional) | `@opentui/core` `>=0.5.14`, `@opentui/solid` `>=0.5.14`, `solid-js` `>=1.9.0` | AR #11 |
| `package.json` files | add `"!plugin/*.test.mjs"` and `"!plugin/*.spec.test.mjs"` (mirrors the scripts/bin test exclusions; also stops shipping the pre-existing `plugin/temp-lifecycle.spec.test.mjs`) | AR #7 |
| `package.json` files (conditional) | If the entry-load pre-probe shows the packaged TSX resolving React's JSX runtime, add a minimal runtime `tsconfig.json` (`jsx: "react-jsx"`, `jsxImportSource: "@opentui/solid"`) to `files` — a partial mitigation only; renderer-instance skew is a host property | AR #12 |
| `tsconfig.json` | `jsx: "preserve"`, `jsxImportSource: "@opentui/solid"`; keep the existing `plugin/**/*.ts` include and add `plugin/**/*.tsx` to it | AR #12 |

`files` already includes `plugin/`, so `tui.tsx` ships; the new test files are excluded from the
tarball by the negations above. Before the full smoke, a bounded temp-only entry-load pre-probe
runs: a throwaway TSX package installed into a scratch project's `node_modules` verifies the
package-TUI load path on the installed build, and any missing strip in ST-12 is attributed to a
layer (entry load / slot render / RPC) from `--print-logs` capture. If the load path proves broken,
the attributed evidence and the documented host workaround (virtual `opentui:runtime-module:*`
imports; JSX-free slot construction) feed the slice-2 decision. No version bump —
the release tool owns versions and no release is performed (AR #15).

## Integration Points

- **Entry discovery**: OpenCode resolves `<package>/tui` through the exports map
  (`@opencode/plugin` `dist/host.js`); the CLI loads TUI components of configured packages,
  including when the server is remote.
- **Slot**: `sidebar.content` receives `{ sessionID }` reactively; the spike claims it with
  `append` so future contributions can coexist.
- **RPC**: registered server-side via `ctx.rpc.register`; called client-side via
  `client.rpc(CodeOpsRpc)` — the same definition object from the shared helper.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `ctx.rpc.register` missing (older build) | Helper returns `false`; one content-free warning; setup completes | AR #9 |
| Registration throws | Helper catches; `plugin/index.ts` try/catch is second layer; setup completes | AR #9 |
| TUI RPC call fails / returns invalid payload | Strip renders nothing | AR #13 |
| `sidebar.content` slot not rendered by the host layout | No code change; recorded as an observed limitation in the smoke notes | AR #14 |
| TUI entry fails to load | Server plugin unaffected (separate entry, separate id); triggers an in-spike iteration with layer attribution (pre-probe + `--print-logs` capture) before any conclusion is recorded | AR #6, #14 |

> **Traceability:** architecture, naming, contract, and dependency choices reference AR #6–#13;
> smoke behavior references AR #14.

## Testing Requirements

- Content spec tests ST-8 and ST-9 (packaging, slot claim, guarded wiring).
- Runtime tests ST-10 and ST-11 (helper contract; server `setup` with fake contexts, with and
  without `rpc`), isolated via `TMPDIR`/`HOME` fixtures.
- Implementation tests (post-implementation): `isCodeOpsStatus` accept/reject cases and the
  definition's schema invariants — `plugin/tui-foundation.impl.test.mjs`.
- The live smoke (ST-12) with recorded evidence, the tested minimum build, and layer attribution
  for any missing strip.
