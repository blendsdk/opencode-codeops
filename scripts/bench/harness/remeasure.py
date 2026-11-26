#!/usr/bin/env python3
"""Re-apply the current kit and validity checks to stored arms, without rerunning them.

Session records get fresh `metrics` from each arm's session database; acceptance records get the
scope check (from the stored diff and plan) and the audit verdict recomputed, and `valid` set.
The results file is rewritten in place (a `.bak` copy is kept).

Usage: python3 -I remeasure.py
"""
import json, re, shutil, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import run_arm  # noqa: E402

RESULTS = run_arm.STORE / "results.jsonl"


def arm_dir(rec):
    return run_arm.STORE / "arms" / f"{rec['subject']}-{rec['ref']}-{rec['n']}"


def main():
    rows = [json.loads(line) for line in RESULTS.read_text().splitlines() if line.strip()]
    shutil.copy(RESULTS, RESULTS.with_suffix(".jsonl.bak"))
    for rec in rows:
        arm = arm_dir(rec)
        db = arm / "data" / "opencode.db"
        if rec["workflow"] != "acceptance" and rec.get("session"):
            out = subprocess.run(["python3", "-I", str(run_arm.REPO / "scripts/bench/bench.py"), "sessions",
                                  "--db", str(db), "--root", rec["session"], "--json"],
                                 capture_output=True, text=True, check=True).stdout
            rec["metrics"] = json.loads(out)
    for rec in rows:
        if rec["workflow"] != "acceptance":
            continue
        arm, s = arm_dir(rec), run_arm.SUBJECTS[rec["subject"]]
        diff = (arm / "subject.diff").read_text(errors="replace") if (arm / "subject.diff").exists() else ""
        changed = re.findall(r"^\+\+\+ b/(\S+)", diff, re.MULTILINE)
        plan_text = run_arm.task_text(arm / "plan" / "99-execution-plan.md")
        violations = []
        if s["forbidden_paths"]:
            violations += [f for f in changed if s["forbidden_paths"].search(f)]
        if s["forbidden_scope"]:
            violations += sorted(set(s["forbidden_scope"].findall(plan_text)))
        flagged = sorted({p for r in rows if r["workflow"] != "acceptance" and r["subject"] == rec["subject"]
                          and r["n"] == rec["n"] and r["ref"] == rec["ref"] for p in (r.get("out_of_scope") or [])})
        rec["scope_violations"] = violations
        rec["audit"] = run_arm.audit_verdict(flagged, None)
        rec["valid"] = not violations and not rec["audit"]["violations"] and rec.get("main_unchanged", False)
    RESULTS.write_text("".join(json.dumps(r) + "\n" for r in rows))
    for rec in rows:
        if rec["workflow"] == "acceptance":
            print(f"{rec['subject']}{rec['n']} valid={rec['valid']} scope={rec['scope_violations'][:6]} "
                  f"audit_violations={rec['audit']['violations'][:4]}")


if __name__ == "__main__":
    main()
