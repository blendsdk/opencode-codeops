#!/usr/bin/env python3
"""Derive CodeOps plan progress directly from Markdown artifacts, and record task transitions.

Markdown remains authoritative: the helper has no state store, revision counter, lock, or
journal. Inspection is read-only. The one write is ``mark``, which records a single task
transition in ``99-execution-plan.md`` — the task's marker and status suffix, the Progress
header, and the Last Updated stamp — and prints the progress bar, so exec-plan spends one call per
transition instead of several bookkeeping steps.

Usage:
  python3 codeops_plan.py [--root ROOT] [--plan PLAN] [--json | --progress-bar]
  python3 codeops_plan.py mark [--root ROOT] --plan PLAN --task ID --state implemented|done|blocked [--note TEXT]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterator


IMPLEMENTS_RE = re.compile(r"^>[ \t]*\*\*Implements\*\*:[ \t]*(.+?)[ \t]*$", re.MULTILINE)
TARGET_RE = re.compile(
    r"(?<![A-Za-z0-9_-])(?:[A-Za-z0-9_][A-Za-z0-9_-]*/)?"
    r"(?:RD-(?:[A-Za-z0-9]+-)*\d+|T-\d+|REQ-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)"
    r"(?![A-Za-z0-9_-])"
)
TASK_RE = re.compile(r"^-\s*\[([ xX~!])\]\s+(.+?)\s*$")
FENCE_OPEN_RE = re.compile(r"^ {0,3}(`{3,}|~{3,})")
TASK_ID_RE = re.compile(r"^\s*(?:\*\*)?([0-9]+\.[0-9]+\.[0-9]+|T-[0-9]+\.[0-9]+)(?=[\s*—–-]|$)")
BLOCKED_REASON_RE = re.compile(r"(?:blocked|reason)\s*:\s*\S", re.IGNORECASE)
#: A task line's trailing status suffix written by ``mark`` (or by hand in the same format): the
#: last emoji-and-label group, closing with ``)`` at the end of the line, so task text that quotes
#: the format stays intact.
STATUS_SUFFIX_RE = re.compile(
    r"\s+(?:✅|⏳|🚫)\s*\((?:completed|implemented|Blocked)\b(?:(?!\s(?:✅|⏳|🚫)\s*\().)*\)\s*$"
)
PROGRESS_HEADER_RE = re.compile(r"^(>[ \t]*\*\*Progress\*\*:[ \t]*)\d+\s*/\s*\d+\s+tasks\s*\(\d+%\)", re.MULTILINE)
LAST_UPDATED_RE = re.compile(r"^(>[ \t]*\*\*Last Updated\*\*:[ \t]*)[^\r\n]*", re.MULTILINE)
MARK_STATES = {
    "implemented": ("~", "⏳", "implemented"),
    "done": ("x", "✅", "completed"),
    "blocked": ("!", "🚫", "Blocked"),
}
_PROGRESS_WIDTH = 10
_PROGRESS_FILLED = "█"
_PROGRESS_EMPTY = "░"


@dataclass(frozen=True)
class Task:
    """One authoritative Markdown checklist task and its derived state."""

    marker: str
    text: str

    @property
    def state(self) -> str:
        """Return the stable user-facing state represented by the task marker."""
        return {" ": "not-started", "~": "verification-pending", "x": "verified", "!": "blocked"}[
            self.marker.lower()
        ]


@dataclass(frozen=True)
class PlanStatus:
    """Read-only lifecycle, progress, and diagnostics derived for one plan."""

    plan: str
    implements: tuple[str, ...]
    lifecycle: str
    total: int
    not_started: int
    verification_pending: int
    verified: int
    blocked: int
    next_task: str | None
    problems: tuple[str, ...]


def parse_implements(index_text: str) -> tuple[str, ...]:
    """Return ordered, de-duplicated requirement or tracker targets for a plan."""
    match = IMPLEMENTS_RE.search(index_text)
    if not match:
        return ()
    return tuple(dict.fromkeys(TARGET_RE.findall(match.group(1))))


def _task_line_numbers(execution_text: str) -> Iterator[tuple[int, str]]:
    """Yield ``(line index, task id)`` for every real execution-task line, in document order.

    The same rule as ``_task_lines``: fenced blocks are skipped and the text must begin with a
    task id. Lines are split on ``\n`` only, so indices match the lines ``mark_task`` rewrites
    even when the text holds other line-break characters (form feeds, U+2028).
    """
    fence_char = ""
    fence_length = 0
    for index, line in enumerate(execution_text.split("\n")):
        line = line.rstrip()
        if fence_char:
            indent = len(line) - len(line.lstrip(" "))
            body = line[indent:] if indent <= 3 else ""
            if len(body) >= fence_length and body == fence_char * len(body):
                fence_char = ""
            continue
        opener = FENCE_OPEN_RE.match(line)
        if opener:
            fence_char = opener.group(1)[0]
            fence_length = len(opener.group(1))
            continue
        task = TASK_RE.match(line)
        task_id = TASK_ID_RE.match(task.group(2)) if task else None
        if task_id is not None:
            yield index, task_id.group(1)


def _task_lines(execution_text: str) -> Iterator[tuple[str, str, str]]:
    """Yield ``(marker, text, task_id)`` for every real execution-task line.

    A line qualifies when it carries one of the four checkbox markers outside a
    fenced code block and its text begins with a task id. Fences follow the
    Markdown shape: an opening run of three or more backticks or tildes (at
    most three leading spaces, optional info string) hides everything up to a
    closing run of the same character with at least the same length and nothing
    else on the line; an unclosed fence hides the rest of the document. An id
    is ``N.N.N`` or ``T-N.N`` after an optional ``**`` opener and must be
    followed by whitespace, ``*``, a dash, or the end of the line, so
    near-misses such as ``1.1.1.1``, ``T-05.1x``, and ``1.1.1:`` stay ignored.
    Duplicate ids are yielded; the caller decides which occurrence counts.
    """
    fence_char = ""
    fence_length = 0
    for line in execution_text.splitlines():
        line = line.rstrip()
        if fence_char:
            indent = len(line) - len(line.lstrip(" "))
            body = line[indent:] if indent <= 3 else ""
            if len(body) >= fence_length and body == fence_char * len(body):
                fence_char = ""
            continue
        opener = FENCE_OPEN_RE.match(line)
        if opener:
            fence_char = opener.group(1)[0]
            fence_length = len(opener.group(1))
            continue
        task = TASK_RE.match(line)
        task_id = TASK_ID_RE.match(task.group(2)) if task else None
        if task_id is None:
            continue
        yield task.group(1).lower(), task.group(2).strip(), task_id.group(1)


def parse_tasks(execution_text: str) -> tuple[Task, ...]:
    """Return the execution tasks a plan document really declares.

    Fenced examples and checkbox lines without a task id (deliverable and
    acceptance lists, quoted templates) are ignored, and a task id that appears
    more than once counts once, from its first occurrence in document order.
    """
    tasks: list[Task] = []
    seen: set[str] = set()
    for marker, text, task_id in _task_lines(execution_text):
        if task_id in seen:
            continue
        seen.add(task_id)
        tasks.append(Task(marker, text))
    return tuple(tasks)


def has_checkbox_lines(execution_text: str) -> bool:
    """Return whether a document carries at least one checklist line.

    Presence is deliberately id-agnostic: legacy execution plans may list
    tasks without ids, and migration admission must stay tolerant of them.
    Counting correctness is ``parse_tasks``' job; this predicate only answers
    "does the document look like it declares tasks at all". Fences are not
    stripped here for the same reason — a quoted checklist still proves the
    document format.
    """
    return any(TASK_RE.match(line.rstrip()) for line in execution_text.splitlines())


def next_task(tasks: tuple[Task, ...]) -> Task | None:
    """Resume verification first, otherwise start the first untouched task."""
    return next((task for task in tasks if task.marker == "~"), None) or next(
        (task for task in tasks if task.marker == " "), None
    )


def lifecycle(tasks: tuple[Task, ...]) -> str:
    """Derive the plan's Ready/Executing/Done/Blocked lifecycle from its checklist."""
    if any(task.marker == "!" for task in tasks):
        return "Blocked"
    if tasks and all(task.marker == "x" for task in tasks):
        return "Done"
    if any(task.marker in {"~", "x"} for task in tasks):
        return "Executing"
    return "Ready"


def render_progress(verified: int, total: int) -> str:
    """Render verified task progress with both visual and textual context.

    The bar deliberately rounds filled cells down so it never visually suggests that a completion
    threshold has been reached early. The accompanying rounded percentage and exact fraction make
    the display understandable when block glyphs are unavailable or difficult to distinguish.

    Args:
        verified: Number of tasks whose verification passed.
        total: Total number of tasks in the checklist.

    Returns:
        A single user-facing progress line containing ten cells, counts, and percentage.

    Raises:
        ValueError: If either count is negative or verified exceeds total.
        TypeError: If either count is not an integer.

    Example:
        >>> render_progress(1, 3)
        'Progress: [███░░░░░░░] 1/3 tasks (33%)'
    """
    if isinstance(verified, bool) or not isinstance(verified, int):
        raise TypeError("verified must be an integer")
    if isinstance(total, bool) or not isinstance(total, int):
        raise TypeError("total must be an integer")
    if verified < 0 or total < 0:
        raise ValueError("task counts cannot be negative")
    if verified > total:
        raise ValueError("verified tasks cannot exceed total tasks")

    filled = (verified * _PROGRESS_WIDTH // total) if total else 0
    percentage = round(verified / total * 100) if total else 0
    cells = (_PROGRESS_FILLED * filled) + (_PROGRESS_EMPTY * (_PROGRESS_WIDTH - filled))
    return f"Progress: [{cells}] {verified}/{total} tasks ({percentage}%)"


def inspect_plan(plan_dir: Path, root: Path | None = None) -> PlanStatus:
    """Inspect one plan directory without mutating it."""
    index_path = plan_dir / "00-index.md"
    execution_path = plan_dir / "99-execution-plan.md"
    problems: list[str] = []
    index_text = index_path.read_text(encoding="utf-8") if index_path.is_file() else ""
    execution_text = execution_path.read_text(encoding="utf-8") if execution_path.is_file() else ""
    if not index_path.is_file():
        problems.append("missing required 00-index.md")
    if not execution_path.is_file():
        problems.append("missing required 99-execution-plan.md")
    implements = parse_implements(index_text)
    if not implements:
        problems.append("00-index.md must declare one or more requirement or tracker targets in **Implements**")
    tasks = parse_tasks(execution_text)
    if not tasks:
        problems.append("99-execution-plan.md contains no execution tasks")
    for task in tasks:
        if task.marker == "!" and not BLOCKED_REASON_RE.search(task.text):
            problems.append(f"blocked task lacks a visible 'Blocked: <reason>': {task.text}")
    counts = {marker: sum(task.marker == marker for task in tasks) for marker in (" ", "~", "x", "!")}
    candidate = next_task(tasks)
    display = str(plan_dir.resolve())
    if root is not None:
        try:
            display = plan_dir.resolve().relative_to(root.resolve()).as_posix()
        except ValueError:
            pass
    return PlanStatus(
        plan=display,
        implements=implements,
        lifecycle=lifecycle(tasks),
        total=len(tasks),
        not_started=counts[" "],
        verification_pending=counts["~"],
        verified=counts["x"],
        blocked=counts["!"],
        next_task=candidate.text if candidate else None,
        problems=tuple(problems),
    )


class MarkError(ValueError):
    """A ``mark`` request that cannot be applied; the plan is left unchanged."""


def mark_task(execution_text: str, task_id: str, state: str, note: str | None, now: str) -> str:
    """Return the plan text with one task transition recorded.

    The counted (first) occurrence of ``task_id`` gets the state's marker and a fresh status
    suffix — ``⏳ (implemented: <now>)``, ``✅ (completed: <now>)``, or ``🚫 (Blocked: <note>;
    <now>)`` — replacing any previous suffix; a note is carried inside the suffix. The Progress
    header (verified / total) and the Last Updated stamp are refreshed when the plan has them.
    Repeating a transition the task already shows changes nothing, so the call is idempotent.

    Args:
        execution_text: The current ``99-execution-plan.md`` text.
        task_id: A task id such as ``1.1.2`` or ``T-03.1``.
        state: ``implemented``, ``done``, or ``blocked``.
        note: Optional text for the suffix; required for ``blocked`` (the visible reason).
        now: The timestamp to record, ``YYYY-MM-DD HH:MM``.

    Returns:
        The updated plan text.

    Raises:
        MarkError: For an unknown state, a missing blocked reason, or an id the plan does not
            declare as a task.

    Example:
        >>> mark_task("- [ ] 1.1.1 Do it", "1.1.1", "done", None, "2026-01-02 03:04")
        '- [x] 1.1.1 Do it ✅ (completed: 2026-01-02 03:04)'
    """
    if state not in MARK_STATES:
        raise MarkError(f"unknown state {state!r}; use implemented, done, or blocked")
    if state == "blocked" and not (note and note.strip()):
        raise MarkError("a blocked task needs --note with the visible reason")
    marker, emoji, label = MARK_STATES[state]
    lines = execution_text.split("\n")
    index = next((i for i, tid in _task_line_numbers(execution_text) if tid == task_id), None)
    if index is None:
        raise MarkError(f"no execution task {task_id} in the plan")
    line = lines[index]
    ending = "\r" if line.endswith("\r") else ""
    task = TASK_RE.match(line.rstrip())
    current = STATUS_SUFFIX_RE.search(task.group(2))
    note_text = note.strip() if note and note.strip() else ""
    if task.group(1).lower() == marker and current and _same_status(current.group(0), emoji, label, note_text):
        return execution_text
    body = STATUS_SUFFIX_RE.sub("", task.group(2).strip())
    detail = f"Blocked: {note_text}; {now}" if state == "blocked" else \
        f"{label}: {now}" + (f"; {note_text}" if note_text else "")
    lines[index] = f"- [{marker}] {body} {emoji} ({detail}){ending}"
    text = "\n".join(lines)
    tasks = parse_tasks(text)
    verified = sum(task.marker == "x" for task in tasks)
    percentage = round(verified / len(tasks) * 100) if tasks else 0
    text = PROGRESS_HEADER_RE.sub(lambda m: f"{m.group(1)}{verified}/{len(tasks)} tasks ({percentage}%)", text, count=1)
    return LAST_UPDATED_RE.sub(lambda m: f"{m.group(1)}{now}", text, count=1)


def _same_status(suffix: str, emoji: str, label: str, note: str) -> bool:
    """Tell whether an existing status suffix already records this state and note."""
    suffix = suffix.strip()
    if not suffix.startswith(f"{emoji} ({label}"):
        return False
    return not note or note in suffix


def mark_main(argv: list[str]) -> int:
    """Record one task transition in a plan and print its progress bar."""
    parser = argparse.ArgumentParser(prog="codeops_plan.py mark", description=mark_task.__doc__.split("\n")[0])
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--plan", type=Path, required=True, help="the plan directory")
    parser.add_argument("--task", required=True, help="task id, for example 1.1.2 or T-03.1")
    parser.add_argument("--state", required=True, choices=sorted(MARK_STATES))
    parser.add_argument("--note", help="text carried in the status suffix; the reason when blocked")
    args = parser.parse_args(argv)
    plan_dir = args.plan if args.plan.is_absolute() else args.root.resolve() / args.plan
    path = plan_dir / "99-execution-plan.md"
    if not path.is_file():
        print(f"codeops_plan.py mark: missing {path}", file=sys.stderr)
        return 2
    with path.open(encoding="utf-8", newline="") as handle:  # keep CRLF files byte-stable
        original = handle.read()
    try:
        updated = mark_task(original, args.task, args.state, args.note, datetime.now().strftime("%Y-%m-%d %H:%M"))
    except MarkError as error:
        print(f"codeops_plan.py mark: {error}", file=sys.stderr)
        return 2
    if updated != original:
        with path.open("w", encoding="utf-8", newline="") as handle:
            handle.write(updated)
    tasks = parse_tasks(updated)
    print(render_progress(sum(task.marker == "x" for task in tasks), len(tasks)))
    return 0


def discover_plans(root: Path) -> tuple[Path, ...]:
    """Discover flat and nested plan directories by their execution plan."""
    paths = set((root / "plans").glob("*/99-execution-plan.md"))
    paths.update((root / "codeops" / "features").glob("*/plans/*/99-execution-plan.md"))
    return tuple(sorted(path.parent for path in paths))


def rd_delivery(statuses: tuple[PlanStatus, ...]) -> dict[str, str]:
    """Derive each RD's delivery state from its implementing plan or plans."""
    grouped: dict[str, list[str]] = {}
    for status in statuses:
        for rd_id in status.implements:
            if not rd_id.rsplit("/", 1)[-1].startswith("RD-"):
                continue
            grouped.setdefault(rd_id, []).append(status.lifecycle)
    result: dict[str, str] = {}
    for rd_id, states in grouped.items():
        if "Blocked" in states:
            result[rd_id] = "Blocked"
        elif states and all(state == "Done" for state in states):
            result[rd_id] = "Done"
        elif any(state == "Executing" for state in states):
            result[rd_id] = "Executing"
        else:
            result[rd_id] = "Ready"
    return result


def build_parser() -> argparse.ArgumentParser:
    """Build the command-line parser for read-only plan inspection."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--plan", type=Path, help="inspect one plan directory")
    output = parser.add_mutually_exclusive_group()
    output.add_argument("--json", action="store_true")
    output.add_argument(
        "--progress-bar",
        action="store_true",
        help="render verified task progress as an accessible ten-cell bar",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    """Inspect selected plans (read-only), or record one task transition with ``mark``."""
    argv = sys.argv[1:] if argv is None else argv
    if argv[:1] == ["mark"]:
        return mark_main(argv[1:])
    args = build_parser().parse_args(argv)
    root = args.root.resolve()
    plan_dirs = (args.plan if args.plan.is_absolute() else root / args.plan,) if args.plan else discover_plans(root)
    statuses = tuple(inspect_plan(path, root) for path in plan_dirs)
    payload = {"plans": [asdict(status) for status in statuses], "requirements": rd_delivery(statuses)}
    if args.json:
        print(json.dumps(payload, indent=2))
    elif args.progress_bar:
        for status in statuses:
            print(render_progress(status.verified, status.total))
    else:
        for status in statuses:
            progress = f"{status.verified}/{status.total} verified"
            print(f"{status.plan}: {status.lifecycle} ({progress})")
            if status.next_task:
                print(f"  next: {status.next_task}")
            for problem in status.problems:
                print(f"  ERROR: {problem}")
    return 1 if any(status.problems for status in statuses) else 0


if __name__ == "__main__":
    sys.exit(main())
