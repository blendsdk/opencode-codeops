#!/usr/bin/env python3
"""Build the subject input packets and acceptance specs for benchmark arms.

Packets (what an arm may read) go to /tmp/bench-lean/packets/<subject>/; acceptance specs (never
visible to an arm) go to ~/.local/state/codeops-bench/accept/<subject>/. Git-derived parts are read
from this repository's history; hand-written parts live next to this script in packets/.

Subjects:
- S: reasoning-effort trace helper (mini-plan T-03.1..T-03.3), base 80f4e18^, acceptance = its
  spec files at 80f4e18.
- M: live-task-sidebar slice 1 (TUI/RPC foundation), base d168332^, inputs = the slice-1 cut of
  01-requirements (packets/M/), the ambiguity register at d168332, and the interface sheet;
  acceptance = the tui-foundation spec at 6ac519d. Slice 0 is excluded: it fixes CodeOps's own plan
  parser, which every ref ships. The requirements carry no slice-0 or live-smoke requirement, so
  an arm has nothing to plan for them; run_arm.py invalidates an arm that touches them anyway.

Usage: python3 -I build_packets.py
"""
import shutil, subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
W = Path("/tmp/bench-lean")
STORE = Path.home() / ".local/state/codeops-bench"

SOURCES = {
    "M": {
        # 01-requirements.md is hand-cut to slice 1 (packets/M/); the register stays a lookup.
        "packet": {"00-ambiguity-register.md": "d168332:plans/live-task-sidebar/00-ambiguity-register.md"},
        "accept": {"plugin/tui-foundation.spec.test.mjs": "6ac519d:plugin/tui-foundation.spec.test.mjs"},
    },
    "S": {
        "packet": {},
        "accept": {"bin/reasoning-effort.spec.test.mjs": "80f4e18:bin/reasoning-effort.spec.test.mjs",
                   "scripts/reasoning-effort-content.spec.test.mjs": "80f4e18:scripts/reasoning-effort-content.spec.test.mjs"},
    },
}


def show(spec: str) -> str:
    """Read one file from this repository's history (`<rev>:<path>`)."""
    return subprocess.run(["git", "-C", str(REPO), "show", spec], capture_output=True, text=True, check=True).stdout


def build() -> None:
    for subject, parts in SOURCES.items():
        packet, accept = W / "packets" / subject, STORE / "accept" / subject
        for d in (packet, accept):
            shutil.rmtree(d, ignore_errors=True)
            d.mkdir(parents=True)
        for name, spec in parts["packet"].items():
            (packet / name).write_text(show(spec))
        for rel, spec in parts["accept"].items():
            (accept / rel).parent.mkdir(parents=True, exist_ok=True)
            (accept / rel).write_text(show(spec))
        for src in sorted((HERE / "packets" / subject).iterdir()):
            text = src.read_text()
            if src.name == "interface.md.in":
                text = text.replace("@@CODEOPS_RPC_DTS@@", show("6ac519d:bin/lib/codeops-rpc.d.mts"))
            (packet / src.name.removesuffix(".in")).write_text(text)
        print(subject, sorted(p.name for p in packet.iterdir()), sorted(str(p.relative_to(accept)) for p in accept.rglob("*.mjs")))


if __name__ == "__main__":
    build()
