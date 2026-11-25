#!/usr/bin/env python3
"""Build a process-only CodeOps ref for benchmark arms.

The ref holds only what the workflows use (skills, _shared, agent-templates, standards,
references, schemas, process scripts) — never product code — because the subjects are past
features of this same repository and a full checkout would contain their answers. Python tools
are replaced by stubs that run compiled bytecode kept outside the ref, so arms can run them but
not read them. Mentions of subject S's trace switch are removed from the copied docs.

Usage: python3 -I build_ref.py <sha>   ->  /tmp/bench-lean/ref-<sha>
"""
import io, py_compile, re, shutil, subprocess, sys, tarfile
from pathlib import Path

W = Path("/tmp/bench-lean")
REPO = Path(__file__).resolve().parents[3]
DIRS = ["skills", "_shared", "agent-templates", "standards", "references", "schemas", "scripts"]
KEEP_MJS = {"discovery-toggle.mjs"}


def build(sha: str) -> Path:
    ref, tools = W / f"ref-{sha}", W / f"tools-{sha}"
    for d in (ref, tools):
        if d.exists():
            shutil.rmtree(d)
    tools.mkdir(parents=True)
    tar = subprocess.run(["git", "-C", str(REPO), "archive", sha, *DIRS], capture_output=True, check=True).stdout
    with tarfile.open(fileobj=io.BytesIO(tar)) as t:
        t.extractall(ref)
    scripts = ref / "scripts"
    for sub in ("bench", "fixtures"):
        shutil.rmtree(scripts / sub, ignore_errors=True)
    for f in list(scripts.iterdir()):
        if f.is_dir() or ".test." in f.name or (f.suffix == ".mjs" and f.name not in KEEP_MJS):
            shutil.rmtree(f) if f.is_dir() else f.unlink()
    for f in sorted(scripts.glob("*.py")):
        py_compile.compile(str(f), cfile=str(tools / (f.stem + ".pyc")), doraise=True)
        f.write_text(
            "# CodeOps tool (benchmark build): run it; its source is not part of the rules under test.\n"
            "import runpy, sys\n"
            f"sys.path.insert(0, {str(tools)!r})\n"
            f"runpy.run_path({str(tools / (f.stem + '.pyc'))!r}, run_name='__main__')\n"
        )
    strip_trace(ref)
    leaks = subprocess.run(["grep", "-rlE", "EFFORT_TRACE|appendEffortTrace|registerCodeOpsRpc|isCodeOpsStatus",
                            str(ref)], capture_output=True, text=True).stdout.strip()
    if leaks:
        sys.exit(f"subject answers still present in the ref:\n{leaks}")
    return ref


def strip_trace(ref: Path) -> None:
    """Remove the trace-switch section and sentences (subject S's documentation deliverable)."""
    p = ref / "_shared" / "reasoning-effort.md"
    t = p.read_text()
    t = re.sub(r"## Optional tracing\n.*?(?=\n## )", "", t, flags=re.S)
    t = re.sub(r"\s*Confirm the active model's set by enabling\s+`CODEOPS_EFFORT_TRACE=1`[^.]*\.", "", t)
    p.write_text(t)
    p = ref / "skills" / "setup-routing" / "routing.md"
    t = p.read_text()
    t = re.sub(r"\s*Confirm the active set with\s+`CODEOPS_EFFORT_TRACE=1`.*?\)\)\.", "", t, flags=re.S)
    p.write_text(t)


if __name__ == "__main__":
    print(build(sys.argv[1]))
