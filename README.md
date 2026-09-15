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

### From npm (recommended)

Add to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-codeops"]
}
```

OpenCode installs the plugin automatically via Bun on next startup. A global config
(`~/.config/opencode/opencode.json`) is recommended so CodeOps is active in every project.

### Install the skills

OpenCode discovers skills only from the filesystem (`.opencode/skills/` or
`~/.config/opencode/skills/`); it never reads them from a plugin package. Install all CodeOps
skills with one command:

```bash
# Global (recommended) — available in every OpenCode project
curl -fsSL https://raw.githubusercontent.com/blendsdk/opencode-codeops/main/install.sh | bash

# Project-only — skills live in ./.opencode/skills and are committed with the repo
curl -fsSL https://raw.githubusercontent.com/blendsdk/opencode-codeops/main/install.sh | bash -s -- --project
```

Pin a version with `CODEOPS_REF` (defaults to `main`):

```bash
CODEOPS_REF=<tag-or-commit> curl -fsSL https://raw.githubusercontent.com/blendsdk/opencode-codeops/main/install.sh | bash
```

Re-running the installer upgrades an existing install in place. It replaces only the skills this
package owns, recorded in `<skills-dir>/.opencode-codeops.json`. Skills you author yourself, or
install with another tool, are left untouched. If you installed earlier with `npm`, run
`npx opencode-codeops install-skills` instead — it is the same installer.

Check or remove an install:

```bash
curl -fsSL https://raw.githubusercontent.com/blendsdk/opencode-codeops/main/install.sh | bash -s -- status
curl -fsSL https://raw.githubusercontent.com/blendsdk/opencode-codeops/main/install.sh | bash -s -- uninstall
```

Use `--dry-run` to preview an install. A same-named directory this package does not own is skipped
with a warning; pass `--force` to replace it.

### Local development

Clone this repo and place the plugin file in your OpenCode plugin directory:

```bash
# Project-level
ln -s /path/to/opencode-codeops/plugin/index.ts .opencode/plugins/codeops.ts

# Or global
ln -s /path/to/opencode-codeops/plugin/index.ts ~/.config/opencode/plugins/codeops.ts
```

Install the skills from the same clone:

```bash
node /path/to/opencode-codeops/bin/install-skills.mjs
```

## Setup

After installing the plugin and the skills, initialize CodeOps in your project:

```
/setup-codeops
```

This creates the `codeops/` layout, scaffolds `codeops/codeops.json` and `codeops/.codeops.yml`, installs the 12 CodeOps subagent files into `.opencode/agents/`, and adds a managed section to `AGENTS.md`.

Commit the result:

```bash
git add codeops/ .opencode/agents/ AGENTS.md
git commit -m "chore: initialize CodeOps"
```

## What the plugin does automatically

On every OpenCode session start and after every compaction, the plugin injects:
- `standards/coding-standards.md` — coding quality, security, testing, and working-style rules
- `standards/output-style.md` — how to report findings, format tables, and recommend next steps

These standards are active without any user action. They do not need to be copied into `AGENTS.md`.

The plugin also warns (non-blocking) if any tool attempts to edit `codeops/.codeops.yml` directly — that file is managed exclusively by the `setup-codeops` skill.

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
- Node.js 18+ or Bun (only for the one-time `npx opencode-codeops install-skills` step)
- `gh` CLI (for the `github-issues` skill only)

## License

MIT
