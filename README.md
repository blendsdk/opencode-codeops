# opencode-codeops

**Specification-first engineering for complex systems — CodeOps plugin for OpenCode.**

Turn an idea or existing system into ambiguity-free requirements, grounded specifications, executable plans, verified code, and durable project state.

## Skills

| Skill | Purpose |
|---|---|
| `make-requirements` | Formal requirements from an idea — multi-phase discovery, Zero-Ambiguity Gate |
| `retro-requirements` | Reverse-engineer an existing codebase into structured requirements |
| `grill-me` | Deep disambiguation interview before planning or requirements |
| `make-plan` | Multi-document implementation plan from requirements |
| `preflight` | 13-dimension quality audit of any plan, requirements, or artifact |
| `exec-plan` | Execute a plan — implement → verify → commit loop with quality reviews |
| `roadmap` | Live feature-set roadmap — make, update, review, archive |
| `analyze-project` | Analyze repo and create/refresh CodeOps-aware `AGENTS.md` guidance |
| `setup-codeops` | Set up or migrate CodeOps in a git repo |
| `setup-routing` | Configure per-role subagent model and policy routing |
| `upgrade-plan` | Upgrade legacy CodeOps artifacts to current schema |
| `techdocs` | VitePress-compatible architecture docs and ADRs |
| `github-issues` | Read and manage GitHub issues via `gh` CLI |
| `clean-comments` | Audit and clean source comments without changing behavior |
| `git-commit` | Guarded commit — verify, stage deliberately, Conventional Commit message |
| `outcome-review` | Review local opt-in outcome metrics (requires `metrics.enabled: true`) |

## Installation

CodeOps has two parts that OpenCode loads differently: the **plugin** (standards and hooks) is
installed by OpenCode from npm, and the **skills** and **subagents** must be copied onto the
filesystem because OpenCode only discovers those from disk.

### 1. Add the plugin

Add to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-codeops"]
}
```

OpenCode installs the plugin automatically via Bun on next startup. A global config
(`~/.config/opencode/opencode.json`) is recommended so CodeOps is active in every project.

### 2. Install the skills and subagents

OpenCode discovers skills and subagents only from the filesystem; it never reads them from a plugin
package. One command installs both. The installer is a thin `npx` wrapper around this package, so
the installed files always match the published version:

```bash
# Global (recommended) — available in every OpenCode project
curl -fsSL https://cdn.jsdelivr.net/npm/opencode-codeops@latest/install.sh | bash

# Project-only — files live in ./.opencode and are committed with the repo
curl -fsSL https://cdn.jsdelivr.net/npm/opencode-codeops@latest/install.sh | bash -s -- --project
```

The same installer runs directly through npm:

```bash
npx -y opencode-codeops@latest install
npx -y opencode-codeops@latest update    # alias of install
```

The scope is auto-detected: inside a CodeOps project (a git repo with `.opencode/` or
`codeops/.codeops.yml`) it installs into `./.opencode/skills` and `./.opencode/agents`; anywhere
else it installs globally into `~/.config/opencode/`. Pass `--project` or `--global` to force one.

Pin a version with `CODEOPS_VERSION` (an npm dist-tag or exact version; defaults to `latest`):

```bash
CODEOPS_VERSION=1.5.0 curl -fsSL https://cdn.jsdelivr.net/npm/opencode-codeops@latest/install.sh | bash
```

Pin the plugin to the same version so the two cannot drift apart:

```json
{ "plugin": ["opencode-codeops@1.5.0"] }
```

Re-running the installer upgrades an existing install in place. It replaces only the files this
package owns, recorded in `.opencode-codeops.json`. Files you author yourself, or install with
another tool, are left untouched.

Check or remove an install:

```bash
npx -y opencode-codeops@latest status
npx -y opencode-codeops@latest uninstall
```

`status` reports the installed version next to the current package version, so a plugin/files
mismatch is visible. Use `--dry-run` to preview an install; a same-named file the package does not
own is skipped with a warning, and `--force` replaces it.

### Local development

Symlink the plugin into your OpenCode plugin directory and link the installed files to a checkout,
so edits are picked up without reinstalling:

```bash
# Plugin (project or global plugin directory)
ln -s /path/to/opencode-codeops/plugin/index.ts ~/.config/opencode/plugins/codeops.ts

# Skills and agents — link instead of copy
node /path/to/opencode-codeops/bin/index.mjs install --link --global
```

## Setup

After installing the plugin and the files, initialize CodeOps in your project:

```
/setup-codeops
```

This creates the `codeops/` layout, scaffolds `codeops/codeops.json` and `codeops/.codeops.yml`, installs the skills and the 12 CodeOps subagent files into `.opencode/`, and adds a managed section to `AGENTS.md`.

Commit the result:

```bash
git add codeops/ .opencode/ AGENTS.md
git commit -m "chore: initialize CodeOps"
```

## What the plugin does automatically

On every OpenCode session start and after every compaction, the plugin injects:
- `standards/coding-standards.md` — coding quality, security, testing, and working-style rules
- `standards/output-style.md` — how to report findings, format tables, and recommend next steps

These standards are active without any user action. They do not need to be copied into `AGENTS.md`.

The plugin also warns (non-blocking) if any tool attempts to edit `codeops/.codeops.yml` directly — that file is managed exclusively by the `setup-codeops` skill — and if the installed skills version differs from the plugin version, so a stale install is visible.

## Agent model configuration

All CodeOps subagents inherit the model of the primary agent that invoked them. No provider-specific configuration is required out of the box.

To pin specific models per role, use the `setup-routing` skill or add overrides directly in `opencode.json`:

```json
{
  "agent": {
    "demanding-executor": { "model": "anthropic/claude-opus-4-5" },
    "executor":           { "model": "anthropic/claude-haiku-4" }
  }
}
```

## Requirements

- OpenCode (current)
- Bash
- Python 3.8+
- Git
- Node.js 18+ (for the `npx` installer; Bun is used by OpenCode to load the plugin)
- `gh` CLI (for the `github-issues` skill only)

## License

MIT
