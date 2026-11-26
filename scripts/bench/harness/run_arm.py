#!/usr/bin/env python3
"""Run one benchmark arm: subject worktree -> headless workflow sessions -> acceptance -> metrics.

Subjects are standalone shallow repos; the ref is a process-only build (build_ref.py).
Usage: python3 -I run_arm.py <M|S> <n> <ref-sha> [--pin-tier] [--workflows make-plan,preflight,exec-plan]
Appends one JSON line per workflow session to ~/.local/state/codeops-bench/results.jsonl.
"""
import argparse, json, re, shutil, sqlite3, subprocess, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import sandbox  # noqa: E402

W = Path("/tmp/bench-lean")
#: Outputs live outside anything an arm is pointed at, so later arms cannot read earlier answers.
STORE = Path.home() / ".local/state/codeops-bench"
REPO = Path(__file__).resolve().parents[3]
MODEL = "deepseek/deepseek-flash#max"
DB = Path.home() / ".local/share/opencode/opencode.db"
TIMEOUT = {"make-plan": 5400, "preflight": 5400, "exec-plan": 10800}

SUBJECTS = {
    "M": {"base": "d168332^", "slug": "live-task-sidebar",
          # Slice 1 only: slice 0 fixes CodeOps's own plan parser, which every ref ships and runs.
          "accept": ["plugin/tui-foundation.spec.test.mjs"],
          "forbidden_paths": re.compile(r"^scripts/codeops_plan[\w-]*\.(?:py|[\w.]*mjs)$|^scripts/codeops-plan"),
          "forbidden_scope": re.compile(r"\bFR-(?:[1-5]|10|12)\b|\blive[- ]smoke\b", re.IGNORECASE)},
    "S": {"base": "80f4e18^", "slug": "reasoning-effort-trace",
          "accept": ["bin/reasoning-effort.spec.test.mjs", "scripts/reasoning-effort-content.spec.test.mjs"],
          "forbidden_paths": None, "forbidden_scope": None},
}

HEADER = """You are running one CodeOps benchmark arm. Work autonomously to completion; nobody will answer.

Rules (all mandatory):
1. The CodeOps rules under test live at REF = {ref}. Load the workflow by reading
   {ref}/skills/{wf}/SKILL.md with the read tool, and read every document it links by path,
   resolved relative to the linking file. NEVER use the skill tool. Where REF text and any other
   CodeOps text you see differ, the REF text governs.
2. Wherever the text says ${{CODEOPS_PLUGIN_ROOT}}, use {ref} (never the environment variable).
3. When the text dispatches a named CodeOps agent role, dispatch the `general` subagent and start
   its prompt with the full text of that role's template from {ref}/agent-templates/ (the
   role -> template map is {ref}/agent-templates/ROLES.md), then the packet.
4. NEVER use the question tool. Whenever the workflow asks the user something or needs a user
   decision or approval, answer it yourself: use the input packet first; if it does not answer the
   question, choose the recommended option and append one line
   `- <workflow>: <question> -> <choice>` to {assumptions}.
5. Work only inside the subject repository {subj}. Never commit, never push, never change git
   config, and never write outside {subj} except the assumptions file. Read nothing outside
   REF, the input packet named below, and {subj}.
6. When the workflow is complete (or cannot continue), reply with one final line: ARM DONE <reason>.

"""

TASKS = {
    ("M", "make-plan"): """Workflow: make-plan. Feature name: `live-task-sidebar`.
Plan only slice 1 of {p}/01-requirements.md: FR-6, FR-7, FR-8, FR-9, and FR-11. Slice 0 (FR-1 to
FR-5 and FR-12) and FR-10 (the live smoke on an installed OpenCode build) are out of scope: plan no
task for them.
{p}/00-ambiguity-register.md holds the user's recorded answers: use it as a question -> answer
lookup for every decision the workflow raises. {p}/interface.md lists fixed interface facts the
implementation must satisfy. Write the plan under {subj}/plans/live-task-sidebar/.""",
    ("M", "preflight"): """Workflow: preflight. Target: the plan in {subj}/plans/live-task-sidebar/.
The user accepts every recommended fix; apply them to the plan. Same answer sources as before:
{p}/00-ambiguity-register.md, {p}/interface.md, {p}/01-requirements.md.""",
    ("M", "exec-plan"): """Workflow: exec-plan, arguments: `live-task-sidebar --no-commit`.
Execute the plan in {subj}/plans/live-task-sidebar/ until every task is done or blocked.
Answer sources for runtime questions: {p}/00-ambiguity-register.md, {p}/interface.md.""",
    ("S", "exec-plan"): """Workflow: exec-plan, arguments: `reasoning-effort-trace --no-commit`.
Execute the mini-plan in {subj}/plans/reasoning-effort-trace/99-execution-plan.md until every task
is done or blocked.""",
}


def sh(cmd, cwd=None, timeout=None):
    """Run a command, returning (rc, combined output)."""
    try:
        r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        return r.returncode, r.stdout + r.stderr
    except subprocess.TimeoutExpired as e:
        return 124, (e.stdout or b"").decode(errors="replace") if isinstance(e.stdout, bytes) else (e.stdout or "")


def session_id(title, db_path):
    db = sqlite3.connect(Path(db_path).resolve().as_uri() + "?mode=ro", uri=True)
    row = db.execute("SELECT id FROM session_v2 WHERE title = ? ORDER BY time_created DESC", (title,)).fetchone()
    return row[0] if row else None


#: Tool-input fields that hold text being written, not paths being accessed.
WRITTEN_CONTENT_KEYS = {"content", "newString", "oldString", "patchText"}


def audit(db_path, root, allowed):
    """List tool-input paths that reach outside the arm's roots (sandbox check).

    Flagged: any /home path other than the sandbox home, and any harness path under /tmp
    (refs, tools, packets, other arms) outside the arm's own ref, packet, and workspace — the
    compiled tools included, which arms may run only through the ref's stubs. Other /tmp paths
    are the arm's own scratch.
    """
    sys.path.insert(0, str(REPO / "scripts/bench"))
    import bench
    db = bench.open_db(Path(db_path))
    bad = set()
    for s in bench.session_tree(db, root):
        for mid, data in bench.assistant_messages(db, s):
            for c in bench.tool_calls(db, mid, data):
                inp = (c.get("state") or {}).get("input") or {}
                # Text an arm writes into files is content, not access.
                accessed = {k: v for k, v in inp.items() if k not in WRITTEN_CONTENT_KEYS}
                blob = json.dumps(accessed)
                for path in re.findall(r"(/(?:home|tmp)/[^\s\"'`;|&)\\]+)", blob):
                    harness = path.startswith((str(W), "/tmp/.bench"))
                    home = path.startswith("/home/") and not path.startswith(sandbox.ARM_HOME)
                    if (harness or home) and not path.startswith(allowed):
                        bad.add(path[:80])
    return sorted(bad)


RULES_BLOCK_RE = re.compile(r"^> \*\*⚠️ EXECUTION RULE.*?(?=\n(?!>)|\Z)", re.MULTILINE | re.DOTALL)


def seed_plan(source, target, ref):
    """Copy a stored plan into the subject with every task reset to `[ ]`.

    The plan's embedded execution-rules block is replaced by the ref's template block, as a plan
    written under the ref's rules would carry; everything else stays byte-for-byte.
    """
    sys.path.insert(0, str(REPO / "scripts/bench"))
    import bench
    target.mkdir(parents=True, exist_ok=True)
    template = (ref / "skills" / "make-plan" / "templates.md").read_text()
    block = RULES_BLOCK_RE.search(template)
    for doc in sorted(Path(source).glob("*.md")):
        text = doc.read_text()
        if doc.name == "99-execution-plan.md":
            text = re.sub(r"(?m)^- \[[~x!]\] ", "- [ ] ", text)
            text = re.sub(r" (?:✅|⏳|🚫) \((?:completed|implemented|Blocked)\b.*$", "", text, flags=re.MULTILINE)
            if block:
                text = RULES_BLOCK_RE.sub(lambda _: block.group(0), text, count=1)
        (target / doc.name).write_text(text)


def task_text(execution_plan):
    """The plan's numbered task lines only: notes and registers may name out-of-scope items."""
    sys.path.insert(0, str(REPO / "scripts/bench"))
    import bench
    return "\n".join(bench.plan_tasks(execution_plan.read_text(errors="replace"))) if execution_plan.exists() else ""


def audit_verdict(paths, work):
    """Split flagged paths into known-benign probes and violations.

    Benign: listing the sandbox's own visible directories (the harness root, `arms/`, `packets/`),
    the compiled tools (scanned clean of subject answers at build time), the opencode binary and
    its directory, and the masked nvm CodeOps folder. Anything else is a violation.
    """
    benign_exact = {str(W), str(W) + "/", f"{W}/arms", f"{W}/arms/", f"{W}/packets", f"{W}/packets/",
                    "/home/gevik", "/home/gevik/"}
    # Globs under the harness root can only match what the sandbox mounts: the arm's own paths.
    root_glob = re.compile(re.escape(str(W)) + r"/.*\*")
    benign_prefix = (f"{W}/tools-", "/home/gevik/.opencode", "/home/gevik/.nvm/")
    violations = [p for p in paths if p.rstrip("*") not in benign_exact and not p.startswith(benign_prefix)
                  and not root_glob.match(p)]
    return {"benign": len(paths) - len(violations), "violations": violations}


#: Arm databases holding a credential; scrubbed on every exit path.
SEEDED = []


def main():
    """Run one arm; credentials are wiped however the arm ends."""
    try:
        run()
    finally:
        for db_path in SEEDED:
            sandbox.scrub_credentials(db_path)


def run():
    ap = argparse.ArgumentParser()
    ap.add_argument("subject", choices=["M", "S"])
    ap.add_argument("n")
    ap.add_argument("ref")
    ap.add_argument("--pin-tier", action="store_true")
    ap.add_argument("--workflows", default=None)
    ap.add_argument("--seed-plan", type=Path, default=None,
                    help="a stored arm's plan folder to execute (paired exec-plan comparisons)")
    a = ap.parse_args()
    s = SUBJECTS[a.subject]
    wfs = a.workflows.split(",") if a.workflows else (
        ["make-plan", "preflight", "exec-plan"] if a.subject == "M" else ["exec-plan"])
    # Rebuild the ref for every arm from the full SHA: no stale or hand-edited ref is ever reused.
    full = sh(["git", "-C", str(REPO), "rev-parse", "--verify", a.ref + "^{commit}"])[1].strip()
    a.ref = full[:7]
    rc, out = sh(["python3", "-I", str(Path(__file__).with_name("build_ref.py")), full, f"{a.subject}-{a.n}"])
    if rc:
        sys.exit(f"ref build failed: {out}")
    ref = Path(out.strip().splitlines()[-1])
    work = W / "arms" / f"{a.subject}-{a.ref}-{a.n}"
    arm = STORE / "arms" / f"{a.subject}-{a.ref}-{a.n}"
    if arm.exists() or work.exists():
        sys.exit(f"arm exists: {arm}")
    arm.mkdir(parents=True)
    work.mkdir(parents=True)
    subj, p, assumptions = work / "subj", W / "packets" / a.subject, work / "assumptions.md"
    accept_src = STORE / "accept" / a.subject
    assumptions.write_text("")
    log = arm / "runner.log"

    def note(msg):
        with log.open("a") as f:
            f.write(time.strftime("%H:%M:%S ") + msg + "\n")

    # Standalone repo with history up to the base only: no future commits or objects reachable.
    base = sh(["git", "-C", str(REPO), "rev-parse", s["base"]])[1].strip()
    sh(["git", "init", "-q", str(subj)])
    rc, out = sh(["git", "-c", "protocol.version=2", "fetch", "-q", "--depth", "30", f"file://{REPO}", base], cwd=subj)
    rc2, out2 = sh(["git", "checkout", "-q", "-B", "main", "FETCH_HEAD"], cwd=subj)
    (subj / ".git" / "FETCH_HEAD").unlink(missing_ok=True)
    note(f"subject base={base[:7]} fetch rc={rc} checkout rc={rc2} {out.strip()} {out2.strip()}")
    rc, out = sh(["npm", "ci", "--no-audit", "--no-fund"], cwd=subj, timeout=900)
    note(f"npm ci rc={rc}")
    if a.subject == "S":
        d = subj / "plans" / s["slug"]
        d.mkdir(parents=True)
        shutil.copy(p / "99-execution-plan.md", d / "99-execution-plan.md")
    if a.seed_plan:
        seed_plan(a.seed_plan, subj / "plans" / s["slug"], ref)
    if a.pin_tier:
        (subj / "codeops").mkdir(exist_ok=True)
        (subj / "codeops" / "codeops.json").write_text(json.dumps({
            "schema": 1, "mode": "strict", "artifacts": {"layout": "flat", "root": "plans"},
            "quality": {"verificationTier": "standard"}}, indent=2) + "\n")
    main_before = sh(["git", "-C", str(REPO), "status", "--porcelain"])[1]
    tools = ref.with_name(ref.name.replace("ref-", "tools-", 1))
    data_dir, config_dir = arm / "data", arm / "config"
    db_path = sandbox.seed_data(data_dir)
    SEEDED.append(db_path)
    sandbox.write_config(config_dir, ref)
    allowed = (str(ref), str(p), str(work), sandbox.ARM_HOME)
    # Network: model API only (CONNECT allow-list) plus an npm mirror that refuses CodeOps itself.
    net_dir = arm / "net"
    net_dir.mkdir()
    net_log = arm / "net.log"
    proxies = [
        subprocess.Popen(["python3", "-I", str(sandbox.NETPROXY), "serve", str(net_dir / "proxy.sock"), str(net_log),
                          "api.deepseek.com"], stderr=subprocess.DEVNULL),
        subprocess.Popen(["python3", "-I", str(sandbox.NETPROXY), "registry", str(net_dir / "registry.sock"), str(net_log),
                          "opencode-codeops"], stderr=subprocess.DEVNULL),
    ]
    time.sleep(1)

    session_records = []
    for wf in wfs:
        title = f"bench-{a.subject}-{wf}-{a.ref}-{a.n}"
        prompt = HEADER.format(ref=ref, wf=wf, assumptions=assumptions, subj=subj) + \
            TASKS[(a.subject, wf)].format(p=p, subj=subj)
        note(f"start {wf} title={title}")
        t0 = time.time()
        cmd = sandbox.bwrap(["opencode", "run", "--standalone", "-m", MODEL, "--title", title, "--auto", prompt],
                            cwd=subj, data_dir=data_dir, config_dir=config_dir, proxy_dir=net_dir,
                            ro=[ref, tools, p], rw=[work])
        rc, out = sh(cmd, timeout=TIMEOUT[wf])
        secs = round(time.time() - t0)
        (arm / f"{wf}.out").write_text(out)
        sid = session_id(title, db_path)
        done = re.findall(r"ARM DONE.*", out)
        note(f"end {wf} rc={rc} secs={secs} session={sid} {done[-1] if done else 'no ARM DONE line'}")
        metrics = None
        if sid:
            mrc, mout = sh(["python3", "-I", str(REPO / "scripts/bench/bench.py"), "sessions", "--db", str(db_path),
                            "--root", sid, "--json"])
            metrics = json.loads(mout) if mrc == 0 else None
        rec = {"subject": a.subject, "n": a.n, "ref": a.ref, "workflow": wf, "session": sid, "rc": rc,
               "secs": secs, "done": done[-1] if done else None, "metrics": metrics, "model": MODEL,
               "pin_tier": a.pin_tier, "sandbox": True, "out_of_scope": audit(db_path, sid, allowed) if sid else None,
               "time": time.strftime("%Y-%m-%d %H:%M")}
        session_records.append(rec)
        with (STORE / "results.jsonl").open("a") as f:
            f.write(json.dumps(rec) + "\n")

    for proc in proxies:
        proc.terminate()
    net_text = net_log.read_text() if net_log.exists() else ""

    # Scope: an arm that changes out-of-scope code or plans out-of-scope requirements is invalid.
    sh(["git", "add", "-A", "--intent-to-add"], cwd=subj)
    changed = sh(["git", "diff", "--name-only", "HEAD"], cwd=subj)[1].split()
    plan_text = task_text(subj / "plans" / s["slug"] / "99-execution-plan.md")
    scope_violations = []
    if s["forbidden_paths"]:
        scope_violations += [f for f in changed if s["forbidden_paths"].search(f)]
    if s["forbidden_scope"]:
        scope_violations += sorted(set(s["forbidden_scope"].findall(plan_text)))

    # Acceptance: the subject's original spec tests, copied over the arm's files.
    for rel in s["accept"]:
        dst = subj / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(accept_src / rel, dst)
    # Arm-written code runs inside the sandbox, with no network (no proxies are listening).
    offline = arm / "offline"
    offline.mkdir()

    def boxed(argv):
        return sandbox.bwrap(argv, cwd=subj, data_dir=data_dir, config_dir=config_dir, proxy_dir=offline,
                             ro=[ref, p], rw=[work])

    rc, out = sh(boxed(["node", "--test", *s["accept"]]), timeout=900)
    (arm / "accept.log").write_text(out)
    pas = re.search(r"ℹ pass (\d+)", out); fail = re.search(r"ℹ fail (\d+)", out)
    vrc, vout = sh(boxed(["npm", "run", "verify"]), timeout=1800)
    (arm / "verify.log").write_text(vout)
    main_after = sh(["git", "-C", str(REPO), "status", "--porcelain"])[1]
    plans = sh(["python3", "-I", str(REPO / "scripts/bench/bench.py"), "plans", "--json",
                str(subj / "plans" / s["slug"])])[1]
    diffstat = sh(["git", "diff", "--shortstat", "HEAD"], cwd=subj)[1].strip()
    untracked = sh(["git", "ls-files", "--others", "--exclude-standard"], cwd=subj)[1].split()
    summary = {"subject": a.subject, "n": a.n, "ref": a.ref, "workflow": "acceptance",
               "accept_pass": int(pas.group(1)) if pas else None, "accept_fail": int(fail.group(1)) if fail else None,
               "verify_rc": vrc, "assumptions": sum(1 for l in assumptions.read_text().splitlines() if l.startswith("- ")),
               "main_unchanged": main_before == main_after, "diffstat": diffstat, "untracked": len(untracked),
               "plan": (json.loads(plans)[0] if plans.strip().startswith("[") else None),
               "net_denied": sorted(set(re.findall(r"(?:DENY|REGISTRY DENY) (\S+)", net_text))),
               "scope_violations": scope_violations,
               "audit": audit_verdict(sorted({x for r in session_records for x in (r["out_of_scope"] or [])}), work),
               "time": time.strftime("%Y-%m-%d %H:%M")}
    summary["valid"] = not summary["scope_violations"] and not summary["audit"]["violations"] \
        and summary["main_unchanged"]
    with (STORE / "results.jsonl").open("a") as f:
        f.write(json.dumps(summary) + "\n")
    # Keep the plan folder and a diff for inspection, then drop the worktree.
    if (subj / "plans" / s["slug"]).is_dir():
        shutil.copytree(subj / "plans" / s["slug"], arm / "plan", dirs_exist_ok=True)
    (arm / "subject.diff").write_text(sh(["git", "diff", "HEAD"], cwd=subj)[1])
    shutil.copy(assumptions, arm / "assumptions.md")
    shutil.rmtree(work, ignore_errors=True)
    note("done " + json.dumps(summary))
    print(json.dumps(summary))


if __name__ == "__main__":
    main()
