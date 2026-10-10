# Findings Ledger: live-task-progress

> **CodeOps Artifact Schema**: 1
> **Authority**: Auto-design `AD-EP-LTP-20261010-1` — eligible technical fixes delegated
> (phase 2: host adapter promise contract; phase 3: contract-conformant clear guard and
> subscription registration).
> **Re-review**: phase 2 fix diff `67f9edd` confirmed — RV-001 and RV-002 resolved; no new
> findings.
> **Re-review**: phase 3 fix diff `b2adb57` confirmed — RV-001…RV-003 resolved; no new findings.
> Non-blocking observation (not fixed, out of scope): the `clearedAt` overwrite is not
> monotonic; reordered or same-window clear deliveries are self-healing.

| Finding | Phase | Severity | Area | Ruling |
| ------- | ----- | -------- | ---- | ------ |
| RV-001 | 2 | MAJOR | bin/lib/codeops-progress.mjs | fixed |
| RV-002 | 2 | MAJOR | bin/lib/codeops-rpc.mjs | fixed |
| RV-001 | 3 | MINOR | plugin/tui-progress.spec.test.mjs | fixed |
| RV-002 | 3 | MAJOR | plugin/tui.tsx | fixed |
| RV-003 | 3 | MINOR | plugin/tui.tsx | fixed |
| RV-001 | 4 | MINOR | scripts/exec-plan-progress-content.spec.test.mjs | fixed |
| RV-002 | 4 | MINOR | README.md | fixed |
| RV-003 | 4 | MINOR | README.md | fixed |
| RV-004 | 4 | MINOR | plans/live-task-progress/99-execution-plan.md | fixed |
