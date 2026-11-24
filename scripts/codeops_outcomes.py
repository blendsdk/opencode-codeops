#!/usr/bin/env python3
"""Record and summarize opt-in, content-free CodeOps outcome events."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


EVENTS = {
    "task-verified", "verification-run", "review-completed", "finding-escaped",
    "rework-cycle", "scope-drift", "assumption-invalidated", "runtime-ambiguity",
    "recovery-attempt",
    "coverage_hunt.completed", "coverage_hunt.accepted", "coverage_hunt.fallback",
    "coverage_hunt.independence", "coverage_hunt.effort",
}
STAGES = {"requirements", "specification", "planning", "execution", "verification", "review", "recovery"}
RESULTS = {"pass", "fail", "resolved", "blocked", "accurate", "inaccurate"}

#: Coverage-hunt events are defined by the shared protocol. They may only be
#: recorded at the requirements or planning stage, and their payload is a
#: fixed, content-free allowlist rather than free-form text.
COVERAGE_EVENTS = {
    "coverage_hunt.completed", "coverage_hunt.accepted", "coverage_hunt.fallback",
    "coverage_hunt.independence", "coverage_hunt.effort",
}
COVERAGE_STAGES = {"requirements", "planning"}
COVERAGE_LEVELS = {"low", "medium", "high", "xhigh", "max"}
COVERAGE_MAPPINGS = {"exact", "alias", "nearest", "fail-open"}
COVERAGE_FALLBACK_REASONS = {
    "subagents-unavailable", "dispatch-failed", "model-unavailable",
}
COVERAGE_EFFORT_FALLBACK_REASONS = COVERAGE_FALLBACK_REASONS | {"none"}
COVERAGE_STATUSES = {"mixed-model", "mixed-effort", "uniform-effort"}
PROVIDER_BOUNDARIES = {"same-provider", "cross-provider"}
COUNT_FIELDS = {
    "clusters", "candidates", "limits", "material", "accepted", "optional", "complexity",
}

#: Each coverage-hunt event owns a fixed set of content-free fields. A field
#: from another event is rejected so the payload cannot drift into a generic
#: key-value store.
EVENT_FIELDS = {
    "coverage_hunt.completed": {"clusters", "candidates", "limits"},
    "coverage_hunt.accepted": {"material", "accepted", "optional", "complexity"},
    "coverage_hunt.fallback": {"reason"},
    "coverage_hunt.independence": {"status", "provider_boundary"},
    "coverage_hunt.effort": {"requested", "applied", "mapping", "fallback_reason"},
}


def _require_vocabulary(key: str, item: Any, allowed: set[str]) -> None:
    """Reject a value outside an event's fixed string vocabulary.

    Args:
        key: Field name used in the error message.
        item: Candidate value; non-strings are rejected before membership so
            a JSON array or object cannot crash set membership.
        allowed: Accepted string values.

    Raises:
        ValueError: When the value is not an allowed string.
    """
    if not isinstance(item, str) or item not in allowed:
        raise ValueError(f"data field {key!r} is outside its fixed vocabulary.")


def validate_coverage_data(event: str, raw: str) -> dict[str, int | str]:
    """Validate a coverage-hunt payload against the per-event allowlist.

    Args:
        event: Coverage-hunt event name.
        raw: JSON object supplied through `--data`.

    Returns:
        The validated object.

    Raises:
        ValueError: When the payload is not an object, names a field that the
            event does not own, carries a non-scalar or negative count, or
            uses a value outside its fixed vocabulary.
    """
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError("--data must be a JSON object.") from exc
    if not isinstance(value, dict):
        raise ValueError("--data must be a JSON object.")

    allowed_fields = EVENT_FIELDS[event]
    validated: dict[str, int | str] = {}
    for key, item in value.items():
        if key not in allowed_fields:
            raise ValueError(f"data field {key!r} is not allowed for {event}.")
        if key in COUNT_FIELDS:
            if isinstance(item, bool) or not isinstance(item, int) or item < 0:
                raise ValueError(f"data field {key!r} must be a non-negative integer.")
        elif key == "status":
            _require_vocabulary(key, item, COVERAGE_STATUSES)
        elif key == "provider_boundary":
            _require_vocabulary(key, item, PROVIDER_BOUNDARIES)
        elif key == "mapping":
            _require_vocabulary(key, item, COVERAGE_MAPPINGS)
        elif key == "requested":
            _require_vocabulary(key, item, COVERAGE_LEVELS)
        elif key == "applied":
            _require_vocabulary(key, item, COVERAGE_LEVELS | {"unavailable"})
        elif key == "reason":
            _require_vocabulary(key, item, COVERAGE_FALLBACK_REASONS)
        elif key == "fallback_reason":
            _require_vocabulary(key, item, COVERAGE_EFFORT_FALLBACK_REASONS)
        validated[key] = item
    return validated


def config_for(root: Path) -> dict[str, Any]:
    path = root / "codeops" / "codeops.json"
    if not path.is_file():
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return value if isinstance(value, dict) else {}


def enabled(root: Path) -> bool:
    return config_for(root).get("metrics", {}).get("enabled") is True


def default_store() -> Path:
    override = os.environ.get("CODEOPS_DATA_DIR")
    # OpenCode keeps its user data under ~/.local/share/opencode; the override
    # lets projects and tests redirect the store without touching the default.
    base = (
        Path(override).expanduser()
        if override
        else Path.home() / ".local" / "share" / "opencode" / "codeops"
    )
    return base / "outcomes.jsonl"


def project_id(root: Path) -> str:
    return hashlib.sha256(str(root.resolve()).encode()).hexdigest()[:12]


def emit(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    if not enabled(root):
        print("CodeOps outcomes disabled; no event recorded.", file=sys.stderr)
        return 0
    if args.event not in EVENTS or args.stage not in STAGES or args.result not in RESULTS:
        print("Invalid event, stage, or result enum.", file=sys.stderr)
        return 2
    if args.event in COVERAGE_EVENTS and args.stage not in COVERAGE_STAGES:
        print("Coverage-hunt events require stage=requirements or stage=planning.", file=sys.stderr)
        return 2
    data = None
    if args.data is not None:
        if args.event not in COVERAGE_EVENTS:
            print("--data is only accepted for coverage-hunt events.", file=sys.stderr)
            return 2
        try:
            data = validate_coverage_data(args.event, args.data)
        except ValueError as exc:
            print(f"Invalid coverage-hunt data: {exc}", file=sys.stderr)
            return 2
    event = {
        "schema": 1,
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "project": project_id(root),
        "event": args.event,
        "stage": args.stage,
        "result": args.result,
        "count": args.count,
    }
    if args.duration_ms is not None:
        event["duration_ms"] = args.duration_ms
    if data is not None:
        event["data"] = data
    store = Path(args.store).expanduser()
    store.parent.mkdir(parents=True, exist_ok=True)
    with store.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, separators=(",", ":"), sort_keys=True) + "\n")
    print("Outcome event recorded.")
    return 0


def read_events(store: Path, project: str | None) -> list[dict[str, Any]]:
    if not store.is_file():
        return []
    events: list[dict[str, Any]] = []
    for line_number, line in enumerate(store.read_text(encoding="utf-8").splitlines(), 1):
        try:
            value = json.loads(line)
        except json.JSONDecodeError:
            print(f"Ignoring malformed event at line {line_number}.", file=sys.stderr)
            continue
        if isinstance(value, dict) and value.get("schema") == 1 and (project is None or value.get("project") == project):
            events.append(value)
    return events


def report(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    project = None if args.all_projects else project_id(root)
    events = read_events(Path(args.store).expanduser(), project)
    by_event = Counter(event.get("event") for event in events)
    by_result = Counter(event.get("result") for event in events)
    totals = Counter()
    for event in events:
        totals[event.get("event")] += int(event.get("count", 1))
    payload = {
        "events": len(events),
        "by_event": dict(sorted(by_event.items())),
        "by_result": dict(sorted(by_result.items())),
        "totals": dict(sorted(totals.items())),
    }
    if args.as_json:
        print(json.dumps(payload, indent=2, sort_keys=True))
    else:
        print(f"CodeOps outcome events: {len(events)}")
        for event, count in sorted(totals.items()):
            print(f"{event}: {count}")
        if not events:
            print("No local outcome evidence is available for this scope.")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.set_defaults(store=str(default_store()))
    sub = parser.add_subparsers(dest="command", required=True)
    emit_parser = sub.add_parser("emit")
    emit_parser.add_argument("--root", default=".")
    emit_parser.add_argument("--store", default=str(default_store()))
    emit_parser.add_argument("--event", required=True, choices=sorted(EVENTS))
    emit_parser.add_argument("--stage", required=True, choices=sorted(STAGES))
    emit_parser.add_argument("--result", required=True, choices=sorted(RESULTS))
    emit_parser.add_argument("--count", type=int, default=1)
    emit_parser.add_argument("--duration-ms", type=int)
    emit_parser.add_argument(
        "--data",
        help="JSON object of content-free coverage-hunt fields (allowlisted)",
    )
    report_parser = sub.add_parser("report")
    report_parser.add_argument("--root", default=".")
    report_parser.add_argument("--store", default=str(default_store()))
    report_parser.add_argument("--all-projects", action="store_true")
    report_parser.add_argument("--json", action="store_true", dest="as_json")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    duration = getattr(args, "duration_ms", None)
    if getattr(args, "count", 1) < 1 or (duration is not None and duration < 0):
        print("count must be positive and duration must be non-negative.", file=sys.stderr)
        return 2
    return emit(args) if args.command == "emit" else report(args)


if __name__ == "__main__":
    raise SystemExit(main())
