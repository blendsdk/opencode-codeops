# opencode-codeops

CodeOps plugin for OpenCode — specification-first engineering for complex systems.

## Repository rules

- This is an OpenCode plugin. The plugin entry point is `plugin/index.ts`.
- Use `CODEOPS_PLUGIN_ROOT` (not `PLUGIN_ROOT`) in all skill and shared-document script references.
- Agent files live in `agents/` (source) and ship inside the package. Do not hand-edit files in `agents/` — regenerate them with `scripts/install_agents.py`.
- Skill files live in `skills/` (source). `bin/index.mjs` is the package binary: `install`/`update` install the skills and the subagents together, auto-detecting the project or global scope, then register the plugin by calling `opencode plugin` (skip with `--no-plugin`). `bin/install-skills.mjs` and `bin/install-agents.mjs` are the internal installers it orchestrates; `bin/lib/opencode-plugin.mjs` owns the OpenCode config registration. The curl bootstrap is `install.sh`; it is a thin wrapper that runs `npx opencode-codeops`.
- `package.json` holds the one product version. It is written only by `scripts/release.mjs`, which derives the bump from conventional commits; `scripts/check-version.mjs` guards against drift. Do not hand-edit the version.
- `codeops/codeops.json` is the project-level config. `codeops/.codeops.yml` is the layout marker owned solely by `setup-codeops`.
- All CodeOps artifacts are plain Markdown files in the user's repo — host-agnostic and git-commitable.

## Versioning policy

- Semantic versioning. Breaking changes to skill contracts or artifact schemas increment MAJOR.
- Release with `node scripts/release.mjs release --type auto --tag <dist-tag>` (or the Release workflow). It sets `package.json` and `package-lock.json`, updates `CHANGELOG.md`, commits, tags, and publishes.
- All user-facing behavior changes go in `CHANGELOG.md`.
- The `> **CodeOps Artifact Schema**: 1` stamp in generated artifacts and `layoutVersion` in `codeops/.codeops.yml` are schema versions, not the plugin version. The release tool never changes them.

## Development

### Install dependencies

```bash
npm install
```

### Type-check the plugin

```bash
npx tsc --noEmit
```

### Install dev requirements (Python validation scripts)

```bash
pip install -r requirements-dev.txt
```

### Test install_agents.py

```bash
python3 scripts/install_agents.py --project /path/to/test-project --dry-run
```

### Test the installer

```bash
node bin/index.mjs install --dry-run --project
node bin/index.mjs status --project
```

### Release dry run

```bash
node scripts/release.mjs release --type auto --tag next --dry-run
```

## Verification commands

- Full verify: `npm run verify` (type-check + tests + version parity)
- Type-check: `npx tsc --noEmit`
- Installer and release tests: `node --test`
- Version parity: `node scripts/check-version.mjs`
- Skill frontmatter: `python3 -c "import sys,re; [print(f) for f in __import__('glob').glob('skills/*/SKILL.md') if not re.search(r'^name:', open(f).read(), re.M)]"`
- No `${PLUGIN_ROOT}` leaks: `grep -r '\${PLUGIN_ROOT}' skills/ _shared/ standards/` (must be empty)
- No `.codex/` leaks: `grep -r '\.codex/' skills/ _shared/ standards/` (must be empty)
- No `codex` CLI in bin: `grep -n '\bcodex\b' bin/codeops-worktree` (must be empty)
