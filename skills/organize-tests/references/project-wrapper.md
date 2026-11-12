# Project Wrapper Guidance

> **CodeOps Artifact Schema**: 1

A wrapper is optional. It gives a project short npm scripts without copying
selector logic. The wrapper is a thin adapter over the plugin CLI.

## Rules

- No selection logic in the wrapper.
- No language detection, glob parsing, or command rewriting.
- Forward every argument unchanged.
- Resolve the project root and map path once, then call the CLI.
- Keep the file small enough to review in one screen.

## Example

`scripts/codeops-test.mjs`:

```js
#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const cli = process.env.CODEOPS_TEST_CLI ?? "codeops-test"
const result = spawnSync(cli, process.argv.slice(2), {
  cwd: root,
  stdio: "inherit",
  shell: false,
})
process.exitCode = result.status ?? 1
```

Package scripts:

```json
{
  "scripts": {
    "verify:task": "node scripts/codeops-test.mjs run --gate task",
    "verify:phase": "node scripts/codeops-test.mjs run --gate phase",
    "test:map:check": "node scripts/codeops-test.mjs check --strict"
  }
}
```

The full verify command stays the project's existing command:

```json
{
  "scripts": {
    "verify": "npm run typecheck && npm run test"
  }
}
```

## When not to use a wrapper

A project may call `node bin/codeops-test.mjs` or the installed `codeops-test`
binary directly. The AGENTS testing block names whichever command is real. Never
invent a script name that does not exist.

## Verification

After adding a wrapper, run:

1. `npm run test:map:check` — the map is valid.
2. `npm run verify:task` with one real change — a nonzero selected set runs.
3. `npm run verify` — the full gate still passes.

Record the observed counts in the adoption evidence.
