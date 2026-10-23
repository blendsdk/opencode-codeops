# Requirements: discovery

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Discovery is an opt-in, local web app for answering the discovery questions CodeOps skills ask.
The CodeOps plugin serves it from inside the OpenCode background service. Agents publish a plan's
questions in groups through a tool; the user answers in the browser; Submit wakes the owning
session, which reads the answers through a tool and records them in the plan's authoritative
artifact (Ambiguity Register or preflight report). This plan delivers the runtime, the Fluent UI
app, the agent tools, the opt-in switch, and adoption by `make-plan` and `preflight` (AR-18).

## Functional Requirements

### Must Have

- [ ] **R1 Opt-in.** `discovery.enabled` (boolean) and `discovery.chatMaxQuestions` (integer ≥ 0,
  default 3) in `codeops/codeops.json`, validated by the schema. Off by default: no tools, no
  listener, skills ask in chat exactly as today. A change takes effect at the next request
  without restart. `analyze-project --with-discovery` / `--without-discovery` switch it (AR-11,
  AR-13, AR-34, AR-35, AR-45).
- [ ] **R2 Listener.** One listener per OpenCode process, shared by every opted-in project in it,
  bound to 127.0.0.1, port 4747 or `CODEOPS_DISCOVERY_PORT`; when the port is taken, an
  OS-assigned port with a visible notice; started when an opted-in project's plugin instance
  loads; stopped with the process (AR-3, AR-9, AR-21, AR-30, AR-48).
- [ ] **R3 Navigation.** Projects page (each checkout directory is a project, grouped by
  repository) → a project's plans → a plan's question groups, as separate views (AR-3, AR-22,
  AR-36).
- [ ] **R4 Publishing.** `codeops_discovery_publish` validates and stores a plan's groups,
  questions, and rules in one idempotent call; enforces ownership with explicit takeover and
  orphan adoption; merges republished questions by key, treating each publish as the plan's full
  question set; keeps submitted questions readable until they are recorded or explicitly retired;
  returns the plan link and opens the browser only when no tab shows that plan (AR-14, AR-15,
  AR-16, AR-23, AR-24, AR-31, AR-40).
- [ ] **R5 Answering.** Four question types; notes; Defer with decision, owner, and revisit;
  "Needs discussion"; recommendation badge never pre-selected; no "accept all"; autosave on
  change; stale saves rejected only for changed questions; latest save per question wins across
  tabs (AR-25, AR-49).
- [ ] **R6 Rules.** `showIf`, `implies`, and group `dependsOn` evaluated live; implied answers
  pre-filled, labelled, and overridable; conflicting implications answered manually; locked groups
  visible read-only (AR-6, AR-26, AR-43).
- [ ] **R7 Submit.** Submit one group or all ready groups; readiness counts answered, deferred,
  and "needs discussion" questions; changed questions need re-confirmation; the confirmation
  names project · branch · plan (AR-5, AR-24, AR-42, AR-47).
- [ ] **R8 Wake and delivery.** A submission wakes the owning session with a one-line pointer
  (`delivery: "queue"`), exactly once; undelivered submissions are delivered when the owning
  process's plugin starts or at its next Discovery tool call for that plan; a process wakes only
  sessions it can reach, as measured by Phase 1 assumption F; a deleted owner session leaves the
  plan orphaned until the next session adopts it (AR-5, AR-20, AR-40, AR-41, AR-46).
- [ ] **R9 Reading and resolving.** `codeops_discovery_answers` returns submitted, unrecorded
  answers with their source (user or implied), notes, deferral, and overridden implications;
  `codeops_discovery_resolve` marks questions recorded (`AR-n` / `PF-NNN`) or retired (AR-14,
  AR-27).
- [ ] **R10 Persistence.** JSON files under the CodeOps data directory with `schemaVersion: 1`;
  newer versions refused and never rewritten; no automatic deletion; archive and confirmed delete
  from the page; recorded questions read-only; each change re-reads the file before an atomic
  write (AR-7, AR-8, AR-28, AR-46).
- [ ] **R11 Security.** No authentication; 127.0.0.1 only; Host allowlist; JSON-only writes with
  an own-origin or absent `Origin`; no CORS headers; data directory 0700 and files 0600; strict
  CSP with a per-request style nonce; plain-text rendering; 256 KB body cap; schema validation;
  no internal details in errors (AR-4, AR-29).
- [ ] **R12 UI quality.** React 19 + Fluent UI v9 + Fluent icons; light/dark from the OS; keyboard
  and screen-reader support, labelled fields, visible focus, announced save and submit results;
  current Chrome, Edge, Firefox, Safari; English; live updates over server-sent events; a visible
  restart notice with automatic reconnect (AR-24, AR-30, AR-32, AR-36).
- [ ] **R13 Skills.** `_shared/discovery.md` defines the protocol; `make-plan` sends its Phase 1.1
  interview and Phase 1C register review; `preflight` sends all findings grouped by severity;
  rounds within the chat cutoff and complexity escalations stay in chat; `--no-discovery` skips
  Discovery for one run; an unavailable Discovery falls back to chat without skipping any gate;
  answers are transcribed as exact text with their question key (AR-11, AR-13, AR-27, AR-38,
  AR-39).
- [ ] **R14 Packaging.** The UI bundle is built at publish (prepack), gitignored, at most 1 MB of
  minified JavaScript, free of remote URLs, and included in the npm tarball; a git checkout
  serves a clear "not built" message until `npm run build:discovery` runs, then picks the build
  up without an OpenCode restart (AR-37, AR-44).
- [ ] **R15 Spike.** Phase 1 proves the host assumptions A–F in 03-01 with the pre-agreed
  fallbacks (AR-19).

### Should Have

- [ ] **R16 Docs.** A README section (enabling, using, port, data location, limitations) and a
  `CHANGELOG.md` entry (AGENTS.md §Versioning policy).

### Won't Have (Out of Scope)

- Exec-plan review batches, a sidebar indicator, a `/discovery` slash command, a per-question
  "Ask the agent" button, an export/print view, colleague sharing (AR-18).
- Remote OpenCode or SSH use (AR-2).
- A standalone process, CRUD API, SDK, start/stop commands, cross-process event stream (AR-3).
- `@blendsdk/fluentui-react-components`, react-hook-form, a router library, Vite, browser test
  harnesses (AR-36, AR-33); Markdown or HTML in question text (AR-29).
- `make-requirements` adoption (AR-18); the `requirements` plan kind exists in the data model
  only (AR-16).
- Authentication or multi-user access (AR-4).
- A release (performed separately with `scripts/release.mjs`).

## Technical Requirements

### Performance

- Plan pages render from one local request; no target beyond the 1 MB bundle budget (AR-44).
- Request bodies are capped at 256 KB (AR-29).

### Compatibility

- Plugin-side modules (`bin/lib/discovery-*.mjs`) use only Node built-ins available in the OpenCode
  runtime; `discovery-rules.mjs` imports no `node:` modules because the browser bundle includes it
  (03-02).
- Package engines stay `node >=18`; tests keep the repository's existing toolchain floor
  (Node ≥22.18 type stripping, CI Node 24).
- OpenCode `>=2 <3`; every host API is feature-detected like `codeops_progress`.

### Security

Per R11; the controls live in 03-04 §Request pipeline and §Static assets and CSP, and in 03-03
§Durability.

- **Rate limiting:** N/A — the listener accepts loopback connections only and has no public or
  authentication endpoints (AR-4).
- **Encryption at rest:** N/A — data stays in the user's home directory under 0700/0600. The
  modes protect the files at rest only; the running listener answers any local user, so Discovery
  assumes a single-user machine (AR-4, AR-29).
- **Secrets:** none are created, stored, or required.
- **Injection:** question and answer text is rendered as text (XSS), assets come from a fixed
  allow-list and artifacts are validated (path traversal), the browser opener uses `execFile`
  without a shell (command injection) — AR-29, AD-55, AD-57.

## Scope Decisions

| Decision | Chosen | AR Ref |
| --- | --- | --- |
| Feature form | Local web app, no Markdown sheet | AR #1 |
| Environment | Local machine only | AR #2 |
| Runtime | In-plugin listener, fixed port, separate views | AR #3 |
| UI stack | React 19 + Fluent UI v9, esbuild, hash routing | AR #36 |
| Plan contents | Core + `make-plan` + `preflight` | AR #18 |
| Opt-in | `codeops/codeops.json`, `analyze-project` flags, immediate effect | AR #13, #35, #45 |
| Record of decisions | Ambiguity Register / preflight report | AR #7, #27, #39 |

> **Traceability:** Every scope decision references the Ambiguity Register entry that resolved it.

## Acceptance Criteria

1. [ ] Every ST-case in [07-testing-strategy.md](07-testing-strategy.md) passes; red phases were recorded.
2. [ ] The Phase 1 spike outcomes and the selected fallbacks are recorded in the execution plan.
3. [ ] With Discovery off, a fake-context setup registers no Discovery tools and starts no listener.
4. [ ] A live end-to-end run: an opted-in scratch project publishes from `make-plan`, the user
   answers in the browser, Submit wakes the session, and the answers land in the register.
5. [ ] The manual browser checklist (03-06 §Manual checklist) is completed by the user.
6. [ ] `npm run verify` passes; `npm pack --dry-run` lists the built UI assets.
7. [ ] README and CHANGELOG updated.
