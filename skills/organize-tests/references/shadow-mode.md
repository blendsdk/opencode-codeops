# Shadow Adoption

> **CodeOps Artifact Schema**: 1

Shadow mode proves that a proposed map selects every test the full suite would
fail. It is evidence, not a switch. Adoption requires zero missed failures; never enable the map from a single run.

## Procedure

1. Compute the selected set for the current diff with an explicit baseline.
2. Run the selected groups with `--no-fail-fast`; capture every result.
3. Run the full command regardless of the selected result.
4. Compare the two results.
5. Write the evidence record and report the verdict.
6. Never enable the map automatically; a user or the skill decides after
   reviewing the evidence.

## Verdicts

| Selected | Full | Verdict | Action |
| --- | --- | --- | --- |
| pass | pass | `zero-missed` | Candidate for adoption after review |
| pass | fail | `escaped` | Refuse adoption; name the escaped failure |
| fail | pass | `selected-failure` | Refuse adoption; fix selection or flake |
| fail | fail | `both-failed` | No adoption signal; report both tails |

The skill must refuse adoption on an escaped verdict. An `escaped` verdict is the dangerous case: the selected slice was green while
the full suite was red. The report must name the escaping group and include the
full failure tail. Do not explain it away as flaky without evidence.

## Evidence shape

```json
{
  "verdict": "zero-missed",
  "gate": "pr",
  "changed": ["src/a/dialog.ts"],
  "mapHash": "<sha256>",
  "selected": ["a.unit"],
  "selectedResult": "passed",
  "fullResult": "passed",
  "escaped": [],
  "enabled": false
}
```

The record contains no test output, secrets, or environment values. Failure
tails may appear in the human report but not in a committed map.

## Repetition

Run shadow mode on several real change sets, including:

- a single-slice change;
- a shared-contract change;
- a change that should force full;
- a docs-only change.

A single green shadow run is not enough to prove a selector. Adopt only after
the project has seen zero missed failures across representative changes.
