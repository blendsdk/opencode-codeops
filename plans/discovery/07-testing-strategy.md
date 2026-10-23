# Testing Strategy: discovery

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --- | --- |
| Core logic (`discovery-rules.mjs`, `discovery-store.mjs`) | 90% |
| Supporting modules (`discovery-server.mjs`, `discovery-tools.mjs`, `plugin/index.ts` wiring, UI pure modules) | 80% |
| UI views and protocol text | 60% — render smoke, content contracts, manual checklist |

- Test names state behaviour: `should [expected behaviour] when [condition]`.
- Every test uses a fresh temp data directory under `$CODEOPS_TMPDIR` (fallback `os.tmpdir()`)
  and removes it; servers listen on port 0 unless a case says otherwise; no test opens a browser
  (injected opener) or touches `~/.local/share` (AD-59). Plugin-instance tests pre-create the
  runtime with `createDiscoveryRuntime({ port: 0, store, assetsDir: <temp>, version: "test" })` —
  it installs itself in the process-wide slot — and set `CODEOPS_DATA_DIR` before `setup`, so no
  case depends on the developer's running OpenCode or on 4747 (ST-27).
- Red phases: a case that already holds before implementation (for example ST-41's negative
  checks) is recorded as passing with its justification, exactly as task 2.1.2 does.
- Language: `bin/lib/*.mjs` run directly; `plugin/index.ts` and the UI's `.ts` modules load through
  Node type stripping (toolchain floor Node ≥22.18; CI Node 24), so UI `.ts` modules use erasable
  syntax only and explicit `.ts` import extensions; `.tsx` is only executed after an esbuild bundle
  (AD-59).
- E2E: ST-62 (live run) and ST-63 (manual checklist); no committed browser harness (AR-33).

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived exclusively from 01-requirements.md, 03-01…03-07, and the Ambiguity Register.
> **IMMUTABLE ORACLE RULE:** if the implementation does not match a spec test, the implementation
> is wrong — never adjust the expectation. Error texts are asserted by the field path or error
> code they must contain, not by full wording.

### Rules and model (03-02)

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | --- | --- | --- |
| ST-1 | Structural inspection of `DiscoveryPublishSchema` | Required `artifact`, `kind`, `title`, `groups`, `questions`; `additionalProperties: false` on every object; `kind` enum exactly `plan, requirements, preflight`; question `type` enum exactly `single, multiple, text, single-other`; `takeover` optional boolean | R4; 03-02 §Publish contract; AR-16, AR-25 |
| ST-2 | `validatePublish` with one group `{key:"scope", title:" Scope "}` and one `single` question with options `yes`/`no` and `why: "   "` | `ok: true`; group title `"Scope"`; `why` absent | R4; 03-02 rule 8 |
| ST-3 | `validatePublish` error matrix: duplicate question key; unknown `group`; unknown `dependsOn`; `dependsOn` cycle a→b→a; `single` with 1 option; `text` with options; `recommendation: "zz"`; artifact `"../x"`, `"/abs"`, `"a\\b"` | Each `ok: false` with an error containing the offending path (`questions[1].key`, `questions[0].group`, `groups[0].dependsOn`, `groups`, `questions[0].options`, `questions[0].recommendation`, `artifact`) | R4; 03-02 rules 1–5; AR-29 |
| ST-4 | Rule-reference errors: `showIf` on an unknown question; on a `text` question; on itself; a `showIf` cycle; `implies` on an unknown question; `implies` answer `"zz"` not an option of the target; `implies` on itself; `implies` with `reason: " "` | Each `ok: false` with an error containing `showIf` or `implies` and the question path | R6; 03-02 rules 6–7; AR-26 |
| ST-5 | Caps: title of 201 characters; 201 questions; 21 options; 21 evidence items; `why` of 4001 characters; 51 groups | Each `ok: false` naming the field | 03-02 §Constants; AR-29 |
| ST-6 | `validateAnswer`: single `{choice:"yes"}` / `{choice:"zz"}` / `{choices:["yes"]}`; multiple `{choices:["a","b"]}` / `{choices:[]}` / `{choices:["a","a"]}`; text `{text:" x "}` / `{text:"   "}` / 4001 characters; single-other `{choice:"a"}` / `{other:"x"}` / `{choice:"a",other:"x"}` / `{other:""}`. `validateDefer` with all three fields; without `owner` | ok / error / error; ok / error / error; ok / error / error; ok / ok / error / error. Defer ok; error containing `owner` | R5; 03-02 §Answer shape; AR-25 |
| ST-7 | Visibility: `DQ-2.showIf = [{question:"DQ-1", anyOf:["yes"]}]`; DQ-1 unanswered, `yes`, `no`; a retired DQ-3; a variant where DQ-1 reaches `yes` only through an implication; a `multiple` question with `anyOf:["a","c"]` selecting `c` alone then `a` alone | DQ-2 hidden, visible, hidden; DQ-3 not visible; the implied `yes` does not reveal DQ-2 (visibility reads explicit answers only); DQ-2 visible in both `multiple` cases | R6; 03-02 §evaluatePlan; AR-26, AR-50 |
| ST-8 | DQ-1 option `no` implies DQ-2 (text) `"n/a"` reason `"No refunds"`; DQ-2's own option (when DQ-2 is a choice question in a variant fixture) implies DQ-3. (a) DQ-1 explicit `no`; (b) DQ-2 explicit `"30 days"`; (c) variant: DQ-1 explicit `no` implies DQ-2 = option `x` which implies DQ-3 | (a) DQ-2 `effective: {text:"n/a"}`, `source: "implied"`, `impliedBy: ["DQ-1"]`, `impliedReasons: ["No refunds"]`; (b) effective = explicit, source `user`, `overridesImplied: true`; (c) DQ-3 has no implied answer (no chaining) | R6; AR-6, AR-26, AR-50 |
| ST-9 | DQ-1 `a` implies DQ-3 = `x`; DQ-2 `b` implies DQ-3 = `y`; then both imply `x` | Conflict with two entries and no effective answer; then no conflict, implied `x` from `["DQ-1","DQ-2"]` | R6; AR-26 |
| ST-10 | DQ-2 holds a stored answer; DQ-1 changes so DQ-2 is hidden; then DQ-1 changes back | Hidden: `visible: false`, no effective answer, not counted by `planCounts`; visible again: effective answer equals the stored answer | R6; AR-51 |
| ST-11 | Groups `A` and `B` (`dependsOn: ["A"]`). Readiness of A when: q1 answered, q2 valid defer, q3 needs discussion; q2 defer missing `revisit`; q1 `changed`; q4 in conflict without explicit answer; q5 with only an unconfirmed proposal; all pending questions need discussion. Readiness of B before A is submitted | ready; missing `{key:"q2", reason:"unanswered"}`; `changed`; `conflict`; `proposal`; not ready (nothing to deliver); B `{ready:false, locked:true}` | R6, R7; 03-02 §groupReadiness; AR-6, AR-24, AR-26, AR-42, AR-43 |
| ST-12 | `questionFingerprint` for the same question in another group; with a changed title; with a changed option label; with a changed option `description`, `why`, `evidence`, and `recommendation` (one variant each); with a changed `proposal` or `showIf`. Source inspection of `discovery-rules.mjs` | equal; different; different; different for every `FINGERPRINT_FIELDS` variant; equal for `proposal`/`showIf`. The module contains no `from "node:` import | R4; 03-02 §Constants/§Functions; AR-24, AD-54 |

### Store (03-03)

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | --- | --- | --- |
| ST-13 | `resolveDataDir({CODEOPS_DATA_DIR:"/tmp/x"}, "/h")`; `({}, "/h")`; `({CODEOPS_DATA_DIR:"~/d"}, "/h")` | `/tmp/x/discovery`; `/h/.local/share/opencode/codeops/discovery`; `/h/d/discovery` | R10; AR-34 |
| ST-14 | Fresh temp base: create store, register a project. Pre-existing discovery dir with mode 0755 (POSIX only) | discovery dir and project dir mode `0700`; `project.json` mode `0600`; the 0755 dir becomes `0700` | R10, R11; AR-29 |
| ST-15 | Register `<tmp>/w/My Repo`, `<tmp>/v/my-repo`, then `<tmp>/w/My Repo` with branch `feat/x`, then `<tmp>/w/___` (directories created by the test) | slugs `my-repo`, `my-repo-2`, `my-repo` (branch updated to `feat/x`), `project` | R3; AR-15, AR-22, AD-54 |
| ST-16 | In one project: publish artifact `plans/billing` kind `plan`; kind `preflight` same artifact; kind `requirements` artifact `requirements`; kind `plan` artifact `x/billing` | slugs `billing`, `billing-preflight`, `requirements`, `billing-2` | R4; AR-15, AD-54 |
| ST-17 | Session `s1` publishes; `s2` publishes; `s2` publishes with `takeover: true`; `markOrphaned(…, "s2")` then `s3` publishes without takeover | owner `s1`; `{ok:false, reason:"owned", owner:"s1"}`; owner `s2`; owner `s3`, `orphaned: false` | R4, R8; AR-23, AR-40 |
| ST-18 | Revision 1: DQ-1 answered, DQ-2 answered, DQ-3 open, DQ-4 recorded as `AR-7`, DQ-6 submitted and not yet recorded, DQ-8 open. Republish A: DQ-1 unchanged, DQ-2 title changed, DQ-3 omitted, DQ-4 title changed, DQ-5 new, DQ-6 omitted, DQ-8 unchanged; then a save on DQ-8. Republish B: DQ-7 added with `type` changed from an open question | Republish A → revision 2; DQ-1 answer kept, `changed: false`; DQ-2 answer kept, `changed: true`, `revisedAt: 2`; DQ-3 `retired`; DQ-4 still `recorded` and a warning containing `DQ-4`; DQ-5 `open`, `revisedAt: 2`; DQ-6 still `submitted` and a warning containing `DQ-6`; DQ-8's save succeeds and leaves `revision` at 2. Republish B → `{ok:false, reason:"invalid"}` with an error containing `DQ-7` and `type`, and `revision` stays 2 | R4; AR-24, AR-28, AR-52, AD-54 |
| ST-19 | `setArchived(true)` then publish again | `archived: true`; after publish `archived: false` and `unarchivedAt` set | R10; AR-28, AR-53 |
| ST-20 | `saveAnswer`: valid choice; choice `"zz"`; question in a locked group; a submitted question; a recorded question; `baseRevision 1` on DQ-2 (`revisedAt 2`); `baseRevision 1` on DQ-1 (`revisedAt 1`); `reconfirm` on DQ-2; `reconfirm` after the republish removed the selected option; `confirmProposal`; two saves on one question | ok; `invalid`; `locked`; `read-only`; `read-only`; `stale`; ok; `changed: false`; `invalid` with the answer cleared; answer equals the proposal; the second save's value stored | R5; AR-6, AR-24, AR-43, AR-49, AR-52 |
| ST-21 | Submit ready group A (q1 answered explicitly, q2 implied by q1, q3 needs discussion); submit not-ready group B | Submission `id: 1`, `deliveredAt: null`; q1, q2 `submitted`, q3 stays `open`; q2's entry `source: "implied"`, `impliedBy: ["q1"]`; A `submittedAt` set; B → `{ok:false, reason:"not-ready", missing:[…]}` | R7; AR-5, AR-27, AR-42 |
| ST-22 | Submit all with groups A ready, B not ready, C ready; then with none ready | One submission with `groups: ["A","C"]` and `skipped: [{group:"B", missing:[…]}]`; then `nothing-ready` | R7; AR-47 |
| ST-23 | `pendingDeliveries` → `claimDelivery(…, 1, "s1")` twice → `pendingDeliveries` → `releaseDelivery(…, 1)` → `pendingDeliveries` | lists submission 1; `true`, then `false`; empty; lists submission 1 again | R8; AR-5, AR-46, AD-57 |
| ST-24 | Owner `s1` `readAnswers`; `s2` `readAnswers`; orphaned plan and `s2` `readAnswers`; `resolve` recorded `[{key:"q1", as:"AR-7"}]`, retire `["q9"]`; recorded unknown key; recording an `open` key | submissions with `submitted` questions, undelivered ones claimed; `owned`; `s2` adopts; `{recorded:1, retired:1}` with `recordedAs: "AR-7"`; `invalid`; `invalid` | R8, R9; AR-14, AR-27, AR-40 |
| ST-25 | A plan file with `schemaVersion: 2`; a malformed plan file next to a valid one | `getPlan` fails with `newer-version` and the file bytes are unchanged after every store operation; the malformed one fails with `unreadable`; the valid plan stays readable | R10; AR-28 |
| ST-26 | Two store instances on one data dir: A saves q1 and resolves; then B (created before A's write) saves q2; `Promise.all` of two saves through the same store; `markOrphaned` for `s1`; `deletePlan` | The file holds both answers in both cases (one process-wide queue per path); `markOrphaned` returns the number of plans orphaned and sets `orphaned: true`; the plan file is gone | R10; AR-28, AR-40, AR-46 |

### Server (03-04)

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | --- | --- | --- |
| ST-27 | `resolvePort({})`, `({CODEOPS_DISCOVERY_PORT:"5000"})`, `("abc")`, `("70000")`. `createDiscoveryRuntime` on port 0; a second runtime on a port the test already holds | 4747, 5000, 4747, 4747. `{fallback:false}` on the bound port; `{fallback:true}` on another port; the returned URL uses the bound port | R2; AR-21, AR-30 |
| ST-27B | Fallback B selected (replaces ST-27's last two cases): `createDiscoveryRuntime` twice with the default port | Both listeners bind `127.0.0.1:0`, both URLs use their bound port, and neither reports a fallback | R2; 03-04 §Fallback B; AR-19 |
| ST-28 | Listener address after `ensureListening` | `127.0.0.1` | R2, R11; AR-4 |
| ST-29 | `GET /api/health` with `Host: evil.example:<port>`; with `Host: localhost:<port>` | 421 `{error:"forbidden-host"}`; 200 `{name:"codeops-discovery", instanceId, version}` | R11; AR-4 |
| ST-30 | `PUT` a question with `Content-Type: text/plain`; with `Origin: http://evil.example`; with the own origin; without `Origin` | 415 `unsupported-media-type`; 403 `forbidden-origin`; routed (200); routed (200); no response carries `Access-Control-Allow-Origin` | R11; AR-4 |
| ST-31 | Body of 256 KB + 1 byte; body `{bad`; a store call forced to throw | 413 `too-large`; 400 `bad-request`; 500 `{error:"internal"}` with no path or stack in the body, and one content-free log line | R11; AR #29 |
| ST-32 | `GET /`, an API call, an asset, an error response; two `GET /` calls | Every response has `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`; API responses `Cache-Control: no-store`; HTML CSP exactly as 03-04 §Static assets with a nonce; the two nonces differ and each equals the nonce in that page's `csp-nonce` meta | R11; AR-29, AD-55 |
| ST-33 | `GET /assets/app.js`; `GET /assets/%2e%2e%2fpackage.json`; `GET /assets/unknown.js`; `GET /` with no `dist/` | 200 `text/javascript`; 404; 404; 200 HTML containing `npm run build:discovery` and no `<script` | R11, R14; AR-29, AR-37 |
| ST-34 | Store with a registered, published plan; runtime with and without the project registered: `GET /api/projects`, `GET /api/projects/:p`, `GET …/plans/:plan`, unknown slugs, `GET …/plans/..%2F..%2Fpackage` | Repository grouping with the project, counts, and `live: true` / `false`; plans list; plan content; 404 `not-found`; 404 before any store call (route slug check) | R3; AR-22, AR-41 |
| ST-34B | Fallback B selected (replaces ST-34's grouping case): two registered projects in two listeners | Each `GET /api/projects` lists only its own project | R3; 03-04 §Fallback B; AR-19 |
| ST-35 | `PUT` valid answer; `PUT` stale; `POST submit` for a registered project whose `deliver` resolves `"woken"`; for an unregistered project; with an older `baseRevision`; not ready; `POST archive`; `DELETE` without and with `confirm` | 200 and the store reflects it; 409 `stale`; 200 `delivery: "woken"`; 200 `delivery: "pending"`; 409 `stale`; 409 `not-ready` with `missing`; 200; 400 `bad-request`; 200 and the plan is gone | R5, R7, R8, R10; AR-41, AR-49 |
| ST-36 | Open the events stream; another client saves an answer; close the stream | `text/event-stream`; first event `hello` with `instanceId` and `revision`; then `changed` with the **unchanged** revision after the save; `hasViewer` true while open, false after the close is observed (bounded polling) | R12; AR-24, AR-30, AR-31 |
| ST-37 | `getDiscoveryRuntime` twice; `ensureListening` twice concurrently | Same object; one listener on one port; the concurrent calls share one attempt and neither reports a spurious fallback | R2; AR-3, AD-55 |
| ST-37B | Fallback B selected (replaces ST-37): `createDiscoveryRuntime` twice | Two distinct runtimes, each with its own listener on `127.0.0.1:0` | R2; 03-04 §Fallback B; AR-19 |
| ST-38 | Two projects registered; unregister one; unregister the other and `closeIfIdle` | Still listening; closed | R2; AR-13, AD-57 |

### Plugin integration (03-05)

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | --- | --- | --- |
| ST-39 | Structural inspection of `schemas/codeops-config.schema.json` | `discovery` object with `additionalProperties: false`, `enabled` boolean, `chatMaxQuestions` integer minimum 0; all existing keys unchanged | R1; AR-13, AR-34 |
| ST-40 | `readDiscoveryConfig` with: no file; `{discovery:{enabled:true}}`; `chatMaxQuestions: 5`; malformed JSON; `enabled: "yes"`; `chatMaxQuestions: -1` | `{enabled:false, chatMaxQuestions:3}`; `{true, 3}`; `{true, 5}`; disabled; disabled; `{true, 3}` | R1; AR-11, AR-13 |
| ST-41 | `setup` with a fake context and no `discovery` setting | No Discovery tool added by the transform; no listener; project not registered; no Discovery data directory created; the progress tool and other hooks registered as before | R1; AR-13 |
| ST-42 | Enabled at setup; then the file flips to disabled and a `context` hook runs; then back to enabled; then a dispose and a second setup for the same directory | Three tools added, listener running, project registered; after the flip `tool.reload` called, transform adds no Discovery tools, project unregistered, listener closed once `closeIfIdle` resolves (the hook does not block); after the flip back all registered again; after dispose and re-setup the directory is registered again and a stale unregister did not remove it | R1, R2; AR-45, AR-48 |
| ST-43 | `codeops_discovery_publish` through `registerDiscoveryTools` with an injected opener: valid payload with no viewer; again with a connected viewer; invalid payload; a plan owned by another session; listener unavailable; the default port held | `{ok:true, url}` matching `^http://127\.0\.0\.1:\d+/#/p/[a-z0-9-]+/[a-z0-9-]+$`, `revision: 1`, `opened: true`, `fallbackPort: null`, opener called once with the URL; `opened: false`, opener not called; `reason: "invalid"` with `errors`; `reason: "owned"` with `owner`; `reason: "unavailable"`; `fallbackPort` equals the bound port and the URL uses it | R4; AR-14, AR-23, AR-30, AR-31, AD-56 |
| ST-44 | After a store submission: `codeops_discovery_answers`; `codeops_discovery_resolve` recorded one key; either tool for an unknown plan | Submissions with `source` and `impliedBy`; `{ok:true, recorded:1, retired:0}`; `reason: "not-found"`; a connected event stream receives `changed` after both calls | R9; AR-14, AR-27, AR-24 |
| ST-44A | Fallback A selected (adds to ST-44): `codeops_discovery_answers` with `wait: true` against a plan with a pending submission; then with an aborted `context.signal` | Resolves with the submission; resolves `{ok:false, reason:"aborted"}` | R9; 03-05 §Fallback A; AR-19 |
| ST-45 | Delivery for a reachable owner with two pending submissions (two answers, group "Scope", project `my-repo`, title "Billing plan"); a second delivery; an owner whose `session.get` rejects; `session.prompt` rejecting once; a pending submission for a reachable owner followed by a publish for that plan; an owner whose prior claim carries a dead pid; an open events stream | One `session.prompt` call per plan with `{sessionID, delivery:"queue", text:"Discovery: 2 answers submitted for my-repo › Billing plan (Scope). Read them with codeops_discovery_answers."}` and `deliveredAt` set only after it resolves; no second call; no call and the submission stays pending; the claim is released and the next delivery point prompts; the publish prompts; the dead claim is released at store creation and prompted; the stream receives `delivered` with the submission id | R8; AR-5, AR-20, AR-46, AD-57 |
| ST-45A | Fallback A selected (replaces ST-45): no waker; `answers` with `wait: true` | No `session.prompt` call; the waiting call resolves when the submission arrives | R8; 03-05 §Fallback A; AR-19 |
| ST-46 | A pending submission in the data dir whose owner is reachable; `setup` runs | One prompt during setup | R8; AR-41, AR-46 |
| ST-47 | Scripted `session.deleted`; `setup` without `tool.transform`, without `session.prompt`, with a throwing transform; a tool call whose store throws; calling the returned cleanup | Owned plans `orphaned: true`; setup resolves with a cleanup each time and existing hooks stay registered; `{ok:false, reason:"error"}`; the cleanup unregisters the project and closes the idle listener | R8; AR-13, AR-40, AD-56 |

### Web UI (03-06)

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | --- | --- | --- |
| ST-48 | `parseRoute` for `""`, `"#/"`, `"#/p/my-repo"`, `"#/p/my-repo/billing"`, `"#/p/My%20Repo"`, `"#/x"`; `formatRoute` of each valid route | projects; projects; project `my-repo`; plan `my-repo`/`billing`; not-found; not-found; round-trips to the same hash | R3; AR-3, AD-58 |
| ST-49 | `planView` and `projectsView` over fixtures | Groups ordered after their `dependsOn`; locked group label `Unlocks after Scope is submitted`; recommended option flagged and nothing selected; implied label `Implied by DQ-1 — No refunds`; conflict lists both sources; changed question offers re-confirm; status labels `Open`, `Answered`, `Deferred`, `Needs discussion`, `Submitted`, `Recorded as AR-7`, `Retired`; retired questions listed separately; a deferred question and a "needs discussion" question count in their own buckets, not in `answered`; submit-all summary lists ready and skipped groups with reasons; `projectsView` groups by repository and shows `Not open in OpenCode` when `live` is false | R3, R5–R7, R12; AR-6, AR-24–AR-26, AR-41, AR-43, AR-47 |
| ST-50 | `buildDiscoveryUi` into a temp dir with the esbuild metafile | `index.html` contains the `csp-nonce` meta with `__CSP_NONCE__` and `src="/assets/app.js"`, and no `http://` / `https://`; `assets/app.js` ≤ 1,048,576 bytes; the bundle contains no `import("http`, `from "http`, or `fetch("http`; `@griffel/core` resolves from exactly one package location | R14; AR-37, AR-44, AD-55 |
| ST-51 | `renderToString` of `App({ route, initial, api })` (esbuild-bundled test entry, injected fixture API and initial data) at `#/`, `#/p/my-repo`, `#/p/my-repo/billing` | Non-empty HTML containing the repository and project names; the plan title; the question title, `Recommended`, the group title, and `Submit group`; no exception | R3, R12; AR-36, AD-59 |
| ST-52 | `createAppRenderer("abc", stubDocument)` from `discovery-ui/src/renderer.ts` | The renderer's style element attributes include `nonce: "abc"`; calling it without the second argument in a Node process does not throw before a document is needed | R11; AR-29, AD-58 |
| ST-53 | `buildDiscoveryUi({ outdir: <temp> })`, then `npm pack --dry-run --json --ignore-scripts` after copying the build into `discovery-ui/dist/` | Lists `discovery-ui/dist/index.html` and `discovery-ui/dist/assets/app.js`; lists no `discovery-ui/src/` file; no build runs inside the test | R14; AR-37 |
| ST-54 | Inspect `package.json`, `discovery-ui/tsconfig.json`, and `.gitignore` | Scripts `build:discovery`, `prepack`, and a `typecheck` including `tsc -p discovery-ui`; `files` includes `discovery-ui/dist/`; `.gitignore` includes `discovery-ui/dist/`; devDependencies include `react`, `react-dom`, `@fluentui/react-components`, `@fluentui/react-icons`, `@griffel/react`, `esbuild`; `dependencies` is exactly `{"@opencode/plugin"}`; the UI tsconfig sets `allowImportingTsExtensions`, `erasableSyntaxOnly`, and `noEmit` | R14; AR-36, AR-37 |
| ST-55 | `api.ts` with a fake `fetch`: 200; 409 `{error:"stale"}`; a rejected fetch | Data; an error with kind `stale`; an error with kind `network` | R5; AR-49, AD-58 |

### Skills and docs (03-07)

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | --- | --- | --- |
| ST-56 | Read `_shared/discovery.md` | Schema stamp; mentions `chatMaxQuestions`, `--no-discovery`, `Complexity Escalation`, `takeover`, `codeops_discovery_publish`, `codeops_discovery_answers`, `codeops_discovery_resolve`, `implied by`, ends the turn without polling, and never skipping a gate | R13; AR-11, AR-13, AR-23, AR-27, AD-62 |
| ST-57 | Read `_shared/zero-ambiguity-gate.md` | A Discovery section linking `discovery.md` that keeps escalations in chat and the register authoritative | R13; AR-27 |
| ST-58 | Read `skills/make-plan/SKILL.md` | A `--no-discovery` option section; Phase 1.1 and Phase 1C reference `_shared/discovery.md` | R13; AR-13, AR-38 |
| ST-59 | Read `skills/preflight/SKILL.md` and `report-format.md` | `--no-discovery` option; Step 5 Discovery path naming `single-other`, `PF-`, the four severity groups, and `Accepted Risk` | R13; AR-39, AD-62 |
| ST-60 | Read `skills/analyze-project/SKILL.md` | `--with-discovery`, `--without-discovery`, the managed line `Discovery: enabled`, the minimal file with `"mode": "strict"`, and the usage error for both flags | R1; AR-13, AR-35, AD-62 |
| ST-61 | Read `README.md` and `CHANGELOG.md` | A Discovery section mentioning `CODEOPS_DISCOVERY_PORT`, `npm run build:discovery`, and `--no-discovery`, and the single-user-machine assumption; when the changelog opens with `## Unreleased`, that section carries the Discovery entry; otherwise the document contains a `- discovery:` item anywhere (never the bare word, which also appears in older prose) | R16 |

### End-to-end

| # | Input / Scenario | Expected Output / Behavior | Source |
| --- | --- | --- | --- |
| ST-62 | Live run: packed tarball in an isolated scratch project with `discovery.enabled: true`; publish a round from `make-plan`; answer it in the browser; Submit | The owning session receives the pointer message, calls `codeops_discovery_answers`, records the answers in the scratch plan's `00-ambiguity-register.md` as exact text with their `DQ-` keys, and calls `codeops_discovery_resolve`; evidence recorded with the OpenCode build | Acceptance 4; AR-5, AR-19 |
| ST-62A | Fallback A selected (replaces ST-62's wake step) | `make-plan` calls `answers` with `wait: true` after publishing; the run continues on the submission without a chat prompt | Acceptance 4; 03-05 §Fallback A; AR-19 |
| ST-63 | Manual checklist (03-06 §Manual checklist) run by the user | Every item confirmed or a finding recorded | Acceptance 5; AR-33 |

## Test Categories

### Specification Tests

| Test File | ST Cases Covered | Component |
| --- | --- | --- |
| `bin/discovery-rules.spec.test.mjs` | ST-1…ST-12 | Rules and model |
| `bin/discovery-store.spec.test.mjs` | ST-13…ST-26 | Store |
| `bin/discovery-server.spec.test.mjs` | ST-27…ST-38 (+ the ST-27B/34B/37B variants when selected) | Server |
| `plugin/discovery-plugin.spec.test.mjs` | ST-39…ST-47 (+ ST-44A/45A when selected) | Plugin integration |
| `scripts/discovery-ui.spec.test.mjs` | ST-48…ST-55 | Web UI |
| `scripts/discovery-content.spec.test.mjs` | ST-56…ST-61 | Skills and docs |

Helper suites sit beside their module in `bin/`, matching the existing
`bin/reasoning-effort.*.test.mjs` and `bin/tmp-hygiene.*.test.mjs`; `plugin/` keeps only the
wiring suites.

### Implementation Tests

| Test File | Description | Priority |
| --- | --- | --- |
| `bin/discovery-rules.impl.test.mjs` | Normalization edges, every error path, cap boundaries | High |
| `bin/discovery-store.impl.test.mjs` | Slug edge cases, temp-file cleanup on failure, queue ordering, dead-claim release | High |
| `bin/discovery-server.impl.test.mjs` | MIME map, asset allow-list, viewer counting, internal-error path, single-flight bind | Med |
| `plugin/discovery-plugin.impl.test.mjs` | Transform guard paths, reload on toggle, release on prompt failure | High |
| `scripts/discovery-ui.impl.test.mjs` | Route encoding edges, view-model edge states | Med |

### Integration Tests

| Test | Components | Description |
| --- | --- | --- |
| Server over store | 03-03, 03-04 | ST-34…ST-36 run the real store behind the real listener |
| Plugin over server | 03-04, 03-05 | ST-42 and ST-46 run `setup` with a pre-created runtime on port 0 and an isolated data dir; ST-43 and ST-45 drive `registerDiscoveryTools` and the delivery callback directly with an injected opener |

### End-to-End Tests

| Scenario | Steps | Expected Result |
| --- | --- | --- |
| ST-62 live run | See ST-62 | Pointer received, answers recorded |
| ST-63 manual checklist | See 03-06 | All items confirmed |

## Test Data

### Fixtures Needed
- Publish payloads: minimal, rules-heavy (showIf, implies, conflicts, proposals), and two
  republish fixtures for ST-18 — fixture A (title change, submitted question retained, DQ-8 save)
  and fixture B (a `type` change that must be refused) — built in the test file. A stub document
  for ST-52 and initial view data for ST-51.

### Mock Requirements
- Fake plugin context (existing pattern), fake `fetch` for `api.ts`, injected browser opener.
  Prefer the real store and listener everywhere else.

## Verification Checklist

- [ ] All specification test cases defined with concrete input/output pairs
- [ ] Every ST case traces to a requirement, spec doc, or AR entry
- [ ] Specification tests written before implementation and verified to fail (red phase)
- [ ] All specification tests pass after implementation (green phase)
- [ ] Implementation tests written for edge cases and internals
- [ ] ST-62 and ST-63 evidence recorded
- [ ] No regressions in existing tests
