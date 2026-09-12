# opencode-codeops

CodeOps plugin for OpenCode — specification-first engineering for complex systems.

## Repository rules

- This is an OpenCode plugin. The plugin entry point is `plugin/index.ts`.
- Use `CODEOPS_PLUGIN_ROOT` (not `PLUGIN_ROOT`) in all skill and shared-document script references.
- Agent files live in `agents/` (source) and are installed into `.opencode/agents/` in user projects by the `setup-codeops` skill. Do not hand-edit files in `agents/` — regenerate them with `scripts/install_agents.py`.
- Skill files live in `skills/` (source) and are installed into a discoverable skills directory (`.opencode/skills/` or `~/.config/opencode/skills/`) by `bin/install-skills.mjs`.
- `codeops/codeops.json` is the project-level config. `codeops/.codeops.yml` is the layout marker owned solely by `setup-codeops`.
- All CodeOps artifacts are plain Markdown files in the user's repo — host-agnostic and git-commitable.

## Versioning policy

- Semantic versioning. Breaking changes to skill contracts or artifact schemas increment MAJOR.
- All user-facing behavior changes go in `CHANGELOG.md`.
- The `> **CodeOps Artifact Schema**: 1` stamp in generated artifacts is the schema version, not the plugin version.

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

### Test install-skills.mjs

```bash
node bin/install-skills.mjs install-skills --dry-run
```

## Verification commands

- Type-check: `npx tsc --noEmit`
- Skill frontmatter: `python3 -c "import sys,re; [print(f) for f in __import__('glob').glob('skills/*/SKILL.md') if not re.search(r'^name:', open(f).read(), re.M)]"`
- No `${PLUGIN_ROOT}` leaks: `grep -r '\${PLUGIN_ROOT}' skills/ _shared/ standards/` (must be empty)
- No `.codex/` leaks: `grep -r '\.codex/' skills/ _shared/ standards/` (must be empty)
- No `codex` CLI in bin: `grep -n '\bcodex\b' bin/codeops-worktree` (must be empty)
