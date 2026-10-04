#!/usr/bin/env python3
"""Record and clear the opt-in reasoning-effort level for a CodeOps session run.

The skills call this helper when a user passes `--auto-effort`. It writes one
small JSON file inside the session's CodeOps temp directory; the plugin reads
that file on every request and applies the level. The command fails closed:
an invalid level or a directory outside the CodeOps temp root exits with
status 2 and writes nothing.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path


#: The only levels a session flag may record.
EFFORT_LEVELS = ("low", "medium", "high", "max")

#: Name of the state file the plugin reads.
STATE_FILE_NAME = "reasoning-effort.json"


def codeops_tmp_root() -> Path:
    """Return the CodeOps-owned temp root for the active temp directory.

    The root mirrors the layout `bin/lib/tmp-hygiene.mjs` owns, so the helper
    and the plugin resolve the same per-session directory.

    Returns:
        Resolved path of the CodeOps temp root.
    """
    return Path(tempfile.gettempdir()).resolve() / "opencode" / "codeops"


def resolve_session_dir(raw_dir: str) -> Path | None:
    """Validate a session directory argument against the CodeOps temp root.

    A directory is accepted only when it exists, resolves strictly inside the
    CodeOps temp root, and is not the root itself. Symlinks are resolved, so a
    link that points outside the root is rejected.

    Args:
        raw_dir: The `--dir` argument as provided by the caller.

    Returns:
        The resolved session directory, or None when it is not acceptable.
    """
    try:
        resolved = Path(raw_dir).resolve(strict=True)
    except OSError:
        return None
    root = codeops_tmp_root()
    if resolved == root or root not in resolved.parents:
        return None
    if not resolved.is_dir():
        return None
    return resolved


def state_path(session_dir: Path) -> Path:
    """Return the state-file path inside a validated session directory.

    Args:
        session_dir: A directory accepted by `resolve_session_dir`.

    Returns:
        Path of the reasoning-effort state file.
    """
    return session_dir / STATE_FILE_NAME


def set_level(session_dir: Path, level: str) -> int:
    """Write the session level atomically and report it.

    The payload is written to a temporary file in the same directory and then
    moved over the final name with `os.replace`, so a reader never observes a
    partially written file.

    Args:
        session_dir: A validated session directory.
        level: One of `EFFORT_LEVELS`.

    Returns:
        Process exit code 0.
    """
    payload = {
        "schema": 1,
        "reasoning": level,
        "setAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    path = state_path(session_dir)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f"{STATE_FILE_NAME}.", suffix=".tmp", dir=session_dir
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, separators=(",", ":"), sort_keys=True)
            handle.write("\n")
        os.replace(temporary_name, path)
    except OSError:
        try:
            os.unlink(temporary_name)
        except OSError:
            pass
        raise
    print(f"Reasoning effort set: {level} for this session run.")
    return 0


def clear_level(session_dir: Path) -> int:
    """Remove the session level when present and report the cleanup.

    Args:
        session_dir: A validated session directory.

    Returns:
        Process exit code 0.
    """
    try:
        state_path(session_dir).unlink()
    except FileNotFoundError:
        pass
    print("Reasoning effort cleared.")
    return 0


def show_status(session_dir: Path) -> int:
    """Print the stored session level, or the empty-state message.

    Args:
        session_dir: A validated session directory.

    Returns:
        Process exit code 0.
    """
    level = None
    try:
        payload = json.loads(state_path(session_dir).read_text(encoding="utf-8"))
        if (
            isinstance(payload, dict)
            and payload.get("schema") == 1
            and payload.get("reasoning") in EFFORT_LEVELS
        ):
            level = payload["reasoning"]
    except (OSError, json.JSONDecodeError):
        level = None
    if level is None:
        print("No session reasoning effort set.")
    else:
        print(f"Session reasoning effort: {level}")
    return 0


def parse_args() -> argparse.Namespace:
    """Parse the command-line arguments.

    Returns:
        The parsed argparse namespace.
    """
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    set_parser = sub.add_parser("set", help="record a session reasoning level")
    set_parser.add_argument("--dir", required=True, help="session temp directory")
    set_parser.add_argument("--reasoning", required=True, help="level to record")

    clear_parser = sub.add_parser("clear", help="remove the session reasoning level")
    clear_parser.add_argument("--dir", required=True, help="session temp directory")

    status_parser = sub.add_parser("status", help="print the session reasoning level")
    status_parser.add_argument("--dir", required=True, help="session temp directory")

    return parser.parse_args()


def main() -> int:
    """Run the requested command.

    Returns:
        Process exit code: 0 on success, 2 on invalid input.
    """
    args = parse_args()
    session_dir = resolve_session_dir(args.dir)
    if session_dir is None:
        print(
            "Error: --dir must be an existing session directory inside the CodeOps temp root.",
            file=sys.stderr,
        )
        return 2
    if args.command == "set":
        if args.reasoning not in EFFORT_LEVELS:
            print(
                "Error: --reasoning must be one of: " + ", ".join(EFFORT_LEVELS) + ".",
                file=sys.stderr,
            )
            return 2
        return set_level(session_dir, args.reasoning)
    if args.command == "clear":
        return clear_level(session_dir)
    return show_status(session_dir)


if __name__ == "__main__":
    raise SystemExit(main())
