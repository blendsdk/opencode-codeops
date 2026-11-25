#!/usr/bin/env python3
"""bwrap sandbox for benchmark arms.

An arm sees the root filesystem read-only, but /home, /tmp, and /run/user are empty tmpfs
mounts; only the ref, its tools, the arm's packet, the arm's workspace, node, and the opencode
binary are mounted back in. OpenCode runs as a private standalone server with a seeded data
directory (schema, migrations, credentials, model catalog — no sessions) and a config with no
plugins and no global skills; the ref's standards are loaded through `instructions`.
"""
import json, shutil, sqlite3
from pathlib import Path

HOST_DB = Path.home() / ".local/share/opencode/opencode.db"
NVM = Path.home() / ".nvm"
OC_BIN = Path.home() / ".opencode/bin"
ARM_HOME = "/home/arm"
#: Only the arm model's provider credential is copied in; it is wiped after the arm.
CREDENTIAL_PROVIDER = "deepseek"
KV_KEYS = ("models-dev:v3:catalog", "models-dev:v3:catalog:meta", "websearch:provider")


def seed_data(data_dir: Path) -> Path:
    """Create a fresh OpenCode data dir: schema + migrations + credentials + model catalog."""
    data_dir.mkdir(parents=True, exist_ok=True)
    db_path = data_dir / "opencode.db"
    src = sqlite3.connect(HOST_DB.resolve().as_uri() + "?mode=ro", uri=True)
    dst = sqlite3.connect(db_path)
    for (sql,) in src.execute(
        "SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' "
        "ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END"
    ):
        dst.execute(sql)
    for table, where, args in (("migration", "", ()),
                               ("credential", " WHERE integration_id = ?", (CREDENTIAL_PROVIDER,)),
                               ("kv", f" WHERE key IN ({','.join('?' * len(KV_KEYS))})", KV_KEYS)):
        cols = [r[1] for r in src.execute(f"PRAGMA table_info({table})")]
        rows = src.execute(f"SELECT {','.join(cols)} FROM {table}{where}", args).fetchall()
        dst.executemany(f"INSERT INTO {table} ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})", rows)
    dst.commit()
    dst.close()
    return db_path


def write_config(config_dir: Path, ref: Path) -> None:
    """Write an OpenCode config with no plugins; the ref's standards load as instructions."""
    config_dir.mkdir(parents=True, exist_ok=True)
    standards = [str(ref / "standards" / n) for n in ("coding-standards.md", "output-style.md")
                 if (ref / "standards" / n).is_file()]
    (config_dir / "opencode.json").write_text(json.dumps({
        "$schema": "https://opencode.ai/config.json",
        "instructions": standards,
        "autoupdate": False,
    }, indent=2) + "\n")


PROXY_PORT = 18080
REGISTRY_PORT = 18081
NETPROXY = Path(__file__).with_name("netproxy.py")


def bwrap(argv, *, cwd: Path, data_dir: Path, config_dir: Path, proxy_dir: Path, ro=(), rw=()):
    """Wrap argv in bwrap with only the given host paths visible and no direct network.

    The sandbox gets its own network namespace (loopback only); outbound HTTPS goes through
    the host's allow-listed CONNECT proxy and npm through the host's filtering registry mirror,
    whose Unix sockets (proxy.sock, registry.sock) sit in proxy_dir.
    """
    path_env = f"{NVM}/versions/node/{node_version()}/bin:{OC_BIN}:/usr/local/bin:/usr/bin:/bin"
    cmd = ["bwrap", "--ro-bind", "/", "/", "--dev", "/dev", "--proc", "/proc",
           "--tmpfs", "/home", "--tmpfs", "/tmp", "--tmpfs", "/var/tmp", "--tmpfs", "/run/user",
           "--dir", ARM_HOME,
           "--ro-bind", str(NVM), str(NVM), "--ro-bind", str(OC_BIN), str(OC_BIN),
           # Globally installed CodeOps packages under nvm hold subject answers.
           *[a for d in sorted(NVM.glob("versions/node/*/lib/node_modules/opencode-codeops")) for a in ("--tmpfs", str(d))],
           "--ro-bind", str(NETPROXY), "/tmp/.bench/netproxy.py", "--bind", str(proxy_dir), "/tmp/.bench/net",
           "--bind", str(data_dir), f"{ARM_HOME}/.local/share/opencode",
           "--ro-bind", str(config_dir), f"{ARM_HOME}/.config/opencode"]
    for p in ro:
        cmd += ["--ro-bind", str(p), str(p)]
    for p in rw:
        cmd += ["--bind", str(p), str(p)]
    proxy = f"http://127.0.0.1:{PROXY_PORT}"
    cmd += ["--unshare-pid", "--unshare-ipc", "--unshare-net", "--die-with-parent", "--clearenv",
            "--setenv", "HTTPS_PROXY", proxy, "--setenv", "HTTP_PROXY", proxy, "--setenv", "https_proxy", proxy,
            "--setenv", "http_proxy", proxy, "--setenv", "NO_PROXY", "127.0.0.1,localhost",
            "--setenv", "no_proxy", "127.0.0.1,localhost",
            "--setenv", "npm_config_registry", f"http://127.0.0.1:{REGISTRY_PORT}/",
            "--setenv", "HOME", ARM_HOME, "--setenv", "PATH", path_env, "--setenv", "TMPDIR", "/tmp",
            "--setenv", "LANG", "C.UTF-8", "--setenv", "TERM", "dumb", "--chdir", str(cwd),
            "sh", "-c", f"python3 -I /tmp/.bench/netproxy.py bridge /tmp/.bench/net/proxy.sock {PROXY_PORT} & "
                        f"python3 -I /tmp/.bench/netproxy.py bridge /tmp/.bench/net/registry.sock {REGISTRY_PORT} & "
                        "sleep 0.5; exec \"$@\"", "sh", *argv]
    return cmd


def node_version() -> str:
    """The nvm node directory name in use on the host (for example v24.21.0)."""
    return shutil.which("node").split("/versions/node/")[1].split("/")[0]


def scrub_credentials(db_path: Path) -> None:
    """Delete every credential from an arm's data directory once the arm is finished."""
    db = sqlite3.connect(db_path)
    db.execute("DELETE FROM credential")
    db.commit()
    db.execute("VACUUM")
    db.close()
