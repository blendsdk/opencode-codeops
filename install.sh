#!/usr/bin/env bash
#
# Install, inspect, or remove the CodeOps skills for OpenCode.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/blendsdk/opencode-codeops/main/install.sh | bash
#   curl -fsSL .../install.sh | bash -s -- --project
#   curl -fsSL .../install.sh | bash -s -- status
#   curl -fsSL .../install.sh | bash -s -- uninstall
#   CODEOPS_REF=<tag-or-commit> curl -fsSL .../install.sh | bash
#
# The installer uses only Node built-ins, so this script downloads the
# repository tarball for the requested ref and runs the packaged installer. Pin
# a tag or commit with CODEOPS_REF to install a fixed version.

set -euo pipefail

readonly REPO="blendsdk/opencode-codeops"
readonly REF="${CODEOPS_REF:-main}"

# The ref is interpolated into the download URL, so reject anything that could
# change the URL's meaning or inject shell syntax.
if [[ ! "$REF" =~ ^[A-Za-z0-9._/-]+$ ]]; then
  printf 'error: invalid CODEOPS_REF "%s"\n' "$REF" >&2
  exit 2
fi

for tool in node curl tar; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    printf 'error: %s is required but was not found on PATH\n' "$tool" >&2
    exit 1
  fi
done

node_major="$(node -p 'process.versions.node.split(".")[0]')"
if (( node_major < 18 )); then
  printf 'error: Node.js 18 or newer is required (found %s)\n' "$(node -v)" >&2
  exit 1
fi

workdir="$(mktemp -d)"
cleanup() { rm -rf "$workdir"; }
trap cleanup EXIT

url="https://codeload.github.com/${REPO}/tar.gz/${REF}"
if ! curl -fsSL "$url" | tar -xz --strip-components=1 -C "$workdir"; then
  printf 'error: failed to download %s@%s\n' "$REPO" "$REF" >&2
  exit 1
fi

# The subcommand is optional and defaults to install. Any remaining arguments
# are passed through to the installer unchanged.
subcommand="install"
if (( $# > 0 )); then
  case "$1" in
    install | status | uninstall)
      subcommand="$1"
      shift
      ;;
  esac
fi

node "$workdir/bin/install-skills.mjs" "$subcommand" "$@"
