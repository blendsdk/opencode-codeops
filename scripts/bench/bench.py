#!/usr/bin/env python3
"""bench.py — dev-only, content-free measurement kit for CodeOps workflows.

Reads OpenCode's local database read-only and reports numbers only: token
totals, steps, context per step, edit classes, bookkeeping calls, and review
dispatches for one session tree. Tool inputs (paths, commands, agent names) are
inspected in memory to classify calls; no message, prompt, command, or file
text is ever printed. Also measures plan folders and the static instruction
footprint of each skill.

This script never ships: `scripts/bench/` is excluded from the npm package.

Usage:
  python3 scripts/bench/bench.py sessions --root <session-id> [--json] [--db PATH]
  python3 scripts/bench/bench.py sessions --ids <id,id,...> [--json] [--db PATH]
  python3 scripts/bench/bench.py plans <plan-dir> [<plan-dir> ...] [--json]
  python3 scripts/bench/bench.py instructions --ref <codeops-checkout> [--json]
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sqlite3
import statistics
import sys
from collections import Counter
from pathlib import Path
from typing import Iterator, List, Optional, Tuple

DEFAULT_DB = Path.home() / ".local" / "share" / "opencode" / "opencode.db"

EDIT_TOOLS = {"edit", "write", "patch"}
ARTIFACT_RE = re.compile(r"(^|/)(plans|requirements|codeops)/")
TEST_PATH_RE = re.compile(
    r"(^|/)(test|tests|__tests__|spec|fixtures)/|\.test\.|\.spec\.|_test\.|_spec\.|Test\.|(^|/)test_"
)
PATCH_FILE_RE = re.compile(r"^\*\*\* (?:Update|Add|Delete) File: (.+)$", re.MULTILINE)
#: `date` in command position: at the start, after a separator, or inside `$(` / backticks.
DATE_RE = re.compile(r"(?:^|[;&|]\s*|\$\(\s*|`\s*)date\b", re.MULTILINE)
PLAN_BOOKKEEPING_RE = re.compile(r"codeops_plan\.py\b.*?(--progress-bar|\smark\b)", re.DOTALL)
#: A shell command that writes a file (in-place edit, redirect, tee, scripted write).
SHELL_WRITE_RE = re.compile(
    r"\b(?:sed|perl)\s+(?:-\w+\s+)*-i|>>?\s*[\"']?[\w./-]+|\btee\b|write_text\(|open\([^)]*['\"][wa]['\"]"
)
#: An artifact path inside a shell command (after a space, quote, slash, or `=`).
ARTIFACT_IN_COMMAND_RE = re.compile(r"(?:^|[\s/'\"=])(?:plans|requirements|codeops)/")
PROGRESS_TOOLS = {"codeops_progress"}
DISPATCH_TOOLS = {"subagent", "task"}
TEMPLATE_RE = re.compile(r"Agent template:\s*([\w-]+)|project domain specialist (reviewer|executor)")
REFUTE_RE = re.compile(r"^Mode:\s*refute\b", re.MULTILINE)
REVIEW_ROLES = {
    "phase-reviewer", "correctness-reviewer", "security-auditor", "perf-auditor",
    "financial-integrity-auditor", "concurrency-auditor", "semantics-reviewer",
    "domain-specialist-reviewer", "performance-auditor", "reviewer",
}
AUDIT_ROLES = {"preflight-auditor"}
EXECUTOR_ROLES = {"plan-task-executor", "plan-task-executor-opus", "domain-specialist-executor",
                  "executor", "executor-opus", "demanding-executor"}

TASK_RE = re.compile(
    r"^-\s*\[[ xX~!]\]\s+(?:\*\*)?(?:[0-9]+\.[0-9]+\.[0-9]+|T-[0-9]+\.[0-9]+)\b(?:\*\*)?\s*(.*)$"
)
FENCE_RE = re.compile(r"^ {0,3}(`{3,}|~{3,})")
ROLE_TAG_RE = re.compile(r"^(?:\[[^\]]+\]\s*)+")
VERIFY_VERB_RE = re.compile(
    r"^(?:(?:run|verify|review|re-review|audit|red|green|gate|confirm|check|smoke|test)\b"
    r"|(?:final\s+)?full\s+verif)",
    re.IGNORECASE,
)
#: What a task produces: tests, spec cases, test files, or fixtures.
TEST_OBJECT_RE = re.compile(
    r"(?<![-\w])(?:tests?|spec\s+(?:tests?|cases?|files?)|fixtures?)(?![-\w])|\.(?:spec|impl)\.test\.|\.test\.",
    re.IGNORECASE,
)
#: Documentation *about* tests ("the README section on testing fixtures") is not verification.
DOC_ABOUT_RE = re.compile(
    r"\b(?:readme|docs?|documentation|guide|changelog|section)\b.*?\b(?:on|about|describing|covering)\b",
    re.IGNORECASE,
)
#: The task's first clause names its object; later clauses are detail ("— confirm it fails").
CLAUSE_SPLIT_RE = re.compile(r"\s+[—–]\s+|;\s+|,\s+|\s+with\s+")
PAREN_RE = re.compile(r"\([^)]*\)")
CASE_RE = re.compile(r"\b(?:ST|AC)-[0-9]+\b")
DECISION_RE = re.compile(r"\bD-[0-9]+\b")
REGISTER_ROW_RE = re.compile(r"^\|\s*[0-9]+\s*\|", re.MULTILINE)
LINK_RE = re.compile(r"\]\(([^)#\s]+\.md)(?:#[^)]*)?\)")
CONDITIONAL_RE = re.compile(
    r"only (?:when|if)|critical|--auto-design|discovery|exploration|if the|when the user", re.IGNORECASE
)


# ---------------------------------------------------------------------------
# sessions
# ---------------------------------------------------------------------------


def open_db(path: Path) -> sqlite3.Connection:
    """Open the OpenCode database strictly read-only."""
    return sqlite3.connect(Path(path).resolve().as_uri() + "?mode=ro", uri=True)


def session_tree(db: sqlite3.Connection, root: str) -> List[str]:
    """Return the root session and every descendant, walked breadth-first."""
    ids, frontier = [root], [root]
    while frontier:
        marks = ",".join("?" * len(frontier))
        children = [r[0] for r in db.execute(
            f"SELECT id FROM session_v2 WHERE parent_id IN ({marks}) ORDER BY time_created", frontier
        )]
        ids.extend(children)
        frontier = children
    return ids


def assistant_messages(db: sqlite3.Connection, session_id: str) -> Iterator[Tuple[str, dict]]:
    """Yield `(message id, data)` for a session's assistant messages in order."""
    for mid, data in db.execute(
        "SELECT id, data FROM session_message WHERE session_id = ? AND type = 'assistant' ORDER BY seq",
        (session_id,),
    ):
        yield mid, json.loads(data)


def tool_calls(db: sqlite3.Connection, message_id: str, data: dict) -> List[dict]:
    """Return a message's tool calls from its `content` list or its `session_part` rows.

    OpenCode stores a message's tool calls in one of the two places; both are read.
    """
    calls = [item for item in data.get("content") or [] if item.get("type") == "tool"]
    for (raw,) in db.execute(
        "SELECT data FROM session_part WHERE message_id = ? AND type = 'tool' ORDER BY ordinal",
        (message_id,),
    ):
        calls.append(json.loads(raw))
    return calls


def token_split(data: dict) -> Tuple[int, int, int]:
    """Return `(fresh, cached, context)` for one assistant message."""
    tokens = data.get("tokens") or {}
    cache = tokens.get("cache") or {}
    read, write = int(cache.get("read") or 0), int(cache.get("write") or 0)
    inp = int(tokens.get("input") or 0)
    fresh = inp + int(tokens.get("output") or 0) + int(tokens.get("reasoning") or 0) + write
    return fresh, read, inp + read + write


def relative_path(path: str, directory: str) -> Optional[str]:
    """Express a tool path relative to the session directory; None when it lies outside it."""
    base = directory.rstrip("/") + "/"
    if path.startswith(base):
        return path[len(base):]
    return None if path.startswith("/") else path.lstrip("./")


def classify_path(path: Optional[str]) -> str:
    """Classify a path as `artifacts`, `tests`, `product`, or `other` (outside the repository).

    Artifact folders are matched as any path segment, because a session's recorded directory
    can be an ancestor of the repository it works in (headless runs in a worktree).
    """
    if path is None:
        return "other"
    if ARTIFACT_RE.search(path):
        return "artifacts"
    if TEST_PATH_RE.search(path):
        return "tests"
    return "product"


def edited_paths(call: dict) -> List[str]:
    """Return the file paths an edit-type tool call touches."""
    inp = (call.get("state") or {}).get("input") or {}
    if call.get("name") == "patch":
        return PATCH_FILE_RE.findall(inp.get("patchText") or "")
    path = inp.get("path") or inp.get("filePath")
    return [path] if path else []


def is_bookkeeping_shell(command: str) -> bool:
    """Tell whether a shell command is bookkeeping.

    Bookkeeping is a timestamp (`date` in command position), a plan-progress call
    (`codeops_plan.py --progress-bar` or `mark`, also across line continuations), or a scripted
    write to a CodeOps artifact (`sed -i`, redirects, `tee`, or a scripted file write that names
    a `plans/`, `requirements/`, or `codeops/` path).
    """
    if DATE_RE.search(command) or PLAN_BOOKKEEPING_RE.search(command):
        return True
    return bool(ARTIFACT_IN_COMMAND_RE.search(command) and SHELL_WRITE_RE.search(command))


def dispatch_class(inp: dict) -> str:
    """Classify a subagent dispatch as `review`, `refute`, `audit`, `executor`, or `other`.

    The template text the prompt carries decides (prompts are inspected in memory, never
    printed); a named agent role is the fallback. Free-text descriptions never decide.
    """
    prompt = str(inp.get("prompt") or "")
    match = TEMPLATE_RE.search(prompt)
    role = (match.group(1) or f"domain-specialist-{match.group(2)}") if match else str(
        inp.get("agent") or inp.get("subagent_type") or "")
    if role in REVIEW_ROLES:
        return "refute" if REFUTE_RE.search(prompt) else "review"
    if role in AUDIT_ROLES:
        return "audit"
    if role in EXECUTOR_ROLES:
        return "executor"
    return "other"


def percentile(values: List[int], fraction: float) -> int:
    """Nearest-rank percentile; 0 for an empty list."""
    if not values:
        return 0
    ordered = sorted(values)
    return ordered[max(0, math.ceil(fraction * len(ordered)) - 1)]


def measure_primary(db: sqlite3.Connection, session_id: str) -> dict:
    """Measure the named session alone: steps, context, edits, bookkeeping, reviews."""
    row = db.execute("SELECT directory FROM session_v2 WHERE id = ?", (session_id,)).fetchone()
    directory = row[0] if row else ""
    contexts: List[int] = []
    edits = {"artifacts": 0, "tests": 0, "product": 0, "other": 0}
    dispatches = {"review": 0, "refute": 0, "audit": 0, "executor": 0, "other": 0}
    models: Counter = Counter()
    total_calls = bookkeeping = rounds = refute_rounds = 0
    for mid, data in assistant_messages(db, session_id):
        contexts.append(token_split(data)[2])
        model = data.get("model") or {}
        models["{}/{}#{}".format(model.get("providerID", "?"), model.get("id", "?"), model.get("variant") or "-")] += 1
        step_classes = set()
        for call in tool_calls(db, mid, data):
            total_calls += 1
            name = call.get("name")
            inp = (call.get("state") or {}).get("input") or {}
            if name in EDIT_TOOLS:
                classes = [classify_path(relative_path(p, directory)) for p in edited_paths(call)]
                for cls in classes:
                    edits[cls] += 1
                if "artifacts" in classes:
                    bookkeeping += 1
            elif name in ("shell", "bash") and is_bookkeeping_shell(str(inp.get("command") or "")):
                bookkeeping += 1
            elif name in PROGRESS_TOOLS:
                bookkeeping += 1
            elif name in DISPATCH_TOOLS:
                cls = dispatch_class(inp)
                dispatches[cls] += 1
                step_classes.add(cls)
        rounds += int("review" in step_classes)
        refute_rounds += int("refute" in step_classes)
    return {
        "session": session_id,
        "steps": len(contexts),
        "ctx_median": int(statistics.median(contexts)) if contexts else 0,
        "ctx_p90": percentile(contexts, 0.9),
        "tool_calls": total_calls,
        "edits": edits,
        "bookkeeping_calls": bookkeeping,
        "review_rounds": rounds,
        "reviewer_dispatches": dispatches["review"],
        "refute_rounds": refute_rounds,
        "dispatches": dispatches,
        "model": models.most_common(1)[0][0] if models else None,
    }


def compaction_messages(db: sqlite3.Connection, session_id: str) -> Iterator[dict]:
    """Yield the data of a session's compaction messages, which carry their own token spend."""
    for (data,) in db.execute(
        "SELECT data FROM session_message WHERE session_id = ? AND type = 'compaction'", (session_id,)
    ):
        yield json.loads(data)


def measure_tree(db: sqlite3.Connection, root: str) -> dict:
    """Measure a session tree: token totals for the tree and for its subagent sessions.

    Totals include compaction spend; `messages` counts assistant messages only.
    """
    ids = session_tree(db, root)
    totals = {
        "fresh": 0, "cached": 0, "cost": 0.0, "messages": 0, "compactions": 0,
        "subagent_fresh": 0, "subagent_cached": 0,
    }
    contexts: List[int] = []
    for sid in ids:
        contexts += [token_split(data)[2] for _mid, data in assistant_messages(db, sid)]
    totals["ctx_median"] = int(statistics.median(contexts)) if contexts else 0
    totals["ctx_p90"] = percentile(contexts, 0.9)
    for sid in ids:
        spends = [(data, False) for _mid, data in assistant_messages(db, sid)]
        spends += [(data, True) for data in compaction_messages(db, sid)]
        for data, compaction in spends:
            fresh, cached, _ctx = token_split(data)
            totals["fresh"] += fresh
            totals["cached"] += cached
            totals["cost"] += float(data.get("cost") or 0)
            totals["compactions" if compaction else "messages"] += 1
            if sid != root:
                totals["subagent_fresh"] += fresh
                totals["subagent_cached"] += cached
    totals["cost"] = round(totals["cost"], 4)
    totals.update({"root": root, "sessions": len(ids), "subagent_sessions": len(ids) - 1})
    return totals


def cmd_sessions(args: argparse.Namespace) -> int:
    """Report one tree (`--root`) or several trees (`--ids`)."""
    db = open_db(Path(args.db))
    roots = [args.root] if args.root else [s for s in args.ids.split(",") if s]
    reports = [{"tree": measure_tree(db, r), "primary": measure_primary(db, r)} for r in roots]
    if args.json:
        print(json.dumps(reports[0] if args.root else reports, indent=2))
        return 0
    print("session                          fresh      cached  msgs subs steps ctx_med ctx_p90 calls bookk rev  edits(a/t/p)")
    for rep in reports:
        t, p = rep["tree"], rep["primary"]
        e = p["edits"]
        print("{:<30} {:>9,} {:>11,} {:>5} {:>4} {:>5} {:>7,} {:>7,} {:>5} {:>5} {:>3}  {}/{}/{}".format(
            t["root"], t["fresh"], t["cached"], t["messages"], t["subagent_sessions"], p["steps"],
            p["ctx_median"], p["ctx_p90"], p["tool_calls"], p["bookkeeping_calls"], p["review_rounds"],
            e["artifacts"], e["tests"], e["product"],
        ))
    return 0


# ---------------------------------------------------------------------------
# plans
# ---------------------------------------------------------------------------


def plan_tasks(text: str) -> List[str]:
    """Return the text of every numbered task line outside fenced blocks, deduplicated."""
    tasks, fence = [], None
    for line in text.splitlines():
        opened = FENCE_RE.match(line)
        if opened:
            marker = opened.group(1)[0]
            fence = None if fence == marker else (fence or marker)
            continue
        if fence:
            continue
        match = TASK_RE.match(line)
        if match:
            tasks.append(match.group(1))
    return tasks


def is_verification_task(text: str) -> bool:
    """Classify a task by its leading verb phrase.

    Verification means running or checking (run, verify, review, audit, red/green, gate, smoke,
    test, full verification), or producing tests whatever the verb: the task's first clause names
    tests, spec cases, a test file, or fixtures, and not documentation about them.
    """
    head = ROLE_TAG_RE.sub("", text.lstrip("* ")).lstrip("`* ")
    if VERIFY_VERB_RE.match(head):
        return True
    clause = CLAUSE_SPLIT_RE.split(PAREN_RE.sub("", head), 1)[0]
    return bool(TEST_OBJECT_RE.search(clause) and not DOC_ABOUT_RE.search(clause))


def measure_plan(plan_dir: Path) -> dict:
    """Measure one plan folder: documents, size, tasks, verification tasks, cases, decisions."""
    docs = sorted(plan_dir.glob("*.md"))
    texts = {doc.name: doc.read_text(encoding="utf-8", errors="replace") for doc in docs}
    execution = texts.get("99-execution-plan.md", "")
    tasks = plan_tasks(execution)
    verification = sum(1 for t in tasks if is_verification_task(t))
    everything = "\n".join(texts.values())
    register = texts.get("00-ambiguity-register.md", "")
    return {
        "plan": plan_dir.name,
        "documents": len(docs),
        "kb": round(sum(doc.stat().st_size for doc in docs) / 1024, 1),
        "tasks": len(tasks),
        "verification_tasks": verification,
        "verification_share": round(verification / len(tasks), 3) if tasks else None,
        "cases": len(set(CASE_RE.findall(everything))),
        "decisions": len(set(DECISION_RE.findall(everything))) + len(REGISTER_ROW_RE.findall(register)),
    }


def cmd_plans(args: argparse.Namespace) -> int:
    """Report each plan folder."""
    reports = [measure_plan(Path(d)) for d in args.dirs]
    if args.json:
        print(json.dumps(reports, indent=2))
        return 0
    print("plan                             docs     KB tasks verif share cases decisions")
    for r in reports:
        share = "-" if r["verification_share"] is None else "{:.0%}".format(r["verification_share"])
        print("{:<32} {:>4} {:>6} {:>5} {:>5} {:>5} {:>5} {:>9}".format(
            r["plan"], r["documents"], r["kb"], r["tasks"], r["verification_tasks"], share, r["cases"], r["decisions"]
        ))
    return 0


# ---------------------------------------------------------------------------
# instructions
# ---------------------------------------------------------------------------


def approx_tokens(text: str) -> int:
    """Approximate tokens as characters / 4."""
    return len(text) // 4


def linked_docs(path: Path, text: str) -> List[Tuple[Path, bool]]:
    """Return `(linked .md path, conditional?)` for each local Markdown link in a document.

    A link is conditional when its line names a flag, tier, or other condition.
    """
    found = []
    for line in text.splitlines():
        for target in LINK_RE.findall(line):
            if "://" in target:
                continue
            resolved = (path.parent / target).resolve()
            if resolved.is_file():
                found.append((resolved, bool(CONDITIONAL_RE.search(line))))
    return found


def measure_skill(skill_md: Path) -> dict:
    """Measure a skill's static footprint: SKILL.md plus linked documents, two levels deep."""
    text = skill_md.read_text(encoding="utf-8")
    seen = {skill_md.resolve(): False}
    level = [(skill_md.resolve(), text, False)]
    for _depth in range(2):
        nxt = []
        for path, body, conditional in level:
            for target, cond in linked_docs(path, body):
                if target in seen:
                    continue
                seen[target] = conditional or cond
                nxt.append((target, target.read_text(encoding="utf-8"), conditional or cond))
        level = nxt
    always = sum(approx_tokens(p.read_text(encoding="utf-8")) for p, c in seen.items() if not c)
    conditional = sum(approx_tokens(p.read_text(encoding="utf-8")) for p, c in seen.items() if c)
    return {
        "skill": skill_md.parent.name,
        "skill_md": approx_tokens(text),
        "always": always,
        "conditional": conditional,
        "documents": len(seen),
    }


def cmd_instructions(args: argparse.Namespace) -> int:
    """Report every skill's instruction footprint at a CodeOps checkout."""
    reports = [measure_skill(p) for p in sorted(Path(args.ref).glob("skills/*/SKILL.md"))]
    if args.json:
        print(json.dumps(reports, indent=2))
        return 0
    print("skill                 SKILL.md   always  conditional  docs   (approx tokens)")
    for r in reports:
        print("{:<20} {:>9,} {:>8,} {:>12,} {:>5}".format(
            r["skill"], r["skill_md"], r["always"], r["conditional"], r["documents"]
        ))
    return 0


def build_parser() -> argparse.ArgumentParser:
    """Build the command-line parser."""
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    sessions = sub.add_parser("sessions", help="measure session trees from the OpenCode database")
    target = sessions.add_mutually_exclusive_group(required=True)
    target.add_argument("--root", help="root session id; its whole tree is measured")
    target.add_argument("--ids", help="comma-separated session ids, each measured as a tree")
    sessions.add_argument("--db", default=os.environ.get("OPENCODE_DB", str(DEFAULT_DB)))
    sessions.add_argument("--json", action="store_true")
    sessions.set_defaults(func=cmd_sessions)

    plans = sub.add_parser("plans", help="measure plan folders")
    plans.add_argument("dirs", nargs="+")
    plans.add_argument("--json", action="store_true")
    plans.set_defaults(func=cmd_plans)

    instructions = sub.add_parser("instructions", help="measure each skill's instruction footprint")
    instructions.add_argument("--ref", required=True, help="path to a CodeOps checkout")
    instructions.add_argument("--json", action="store_true")
    instructions.set_defaults(func=cmd_instructions)
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    """Run the kit."""
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
