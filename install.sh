#!/usr/bin/env bash
#
# Bootstrap the CodeOps skills for OpenCode.
#
# Usage:
#   curl -fsSL https://cdn.jsdelivr.net/npm/opencode-codeops@latest/install.sh | bash
#   curl -fsSL .../install.sh | bash -s -- --project
#   curl -fsSL .../install.sh | bash -s -- install-agents --project
#   curl -fsSL .../install.sh | bash -s -- status
#   curl -fsSL .../install.sh | bash -s -- uninstall
#   CODEOPS_VERSION=<tag-or-version> curl -fsSL .../install.sh | bash
#
# This script is a thin wrapper around `npx opencode-codeops`. The package
# ships the skills, the agent definitions, and the installer, so nothing extra
# is downloaded here: npx fetches one versioned package and runs its installer.
# Pin a version with CODEOPS_VERSION (an npm dist-tag or exact version;
# defaults to "latest").
#
# Subcommands (see `npx opencode-codeops help` for the full option list):
#   install     Install or upgrade skills and subagents   (default)
#   update      Alias of install
#   status      Show the installed versions
#   uninstall   Remove the managed files
#   help        Show installer help

set -euo pipefail

readonly PACKAGE="opencode-codeops"
readonly VERSION="${CODEOPS_VERSION:-latest}"

# The version is interpolated into the npx package spec, so reject anything
# that could change its meaning or inject shell syntax.
if [[ ! "$VERSION" =~ ^[A-Za-z0-9._-]+$ ]]; then
  printf 'error: invalid CODEOPS_VERSION "%s"\n' "$VERSION" >&2
  exit 2
fi

if ! command -v npx >/dev/null 2>&1; then
  printf 'error: npx is required but was not found on PATH. Install Node.js 18 or newer.\n' >&2
  exit 1
fi

# The subcommand is optional and defaults to install. Any remaining arguments
# are passed through to the installer unchanged.
subcommand="install"
if (( $# > 0 )); then
  case "$1" in
    install | update | status | uninstall | help)
      subcommand="$1"
      shift
      ;;
  esac
fi

exec npx -y "${PACKAGE}@${VERSION}" "$subcommand" "$@"
