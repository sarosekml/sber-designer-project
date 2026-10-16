#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: deploy/remote-update.sh <user@host> <tag-or-branch-or-sha> [remote-repo]

Runs deploy/update.sh on the remote server over SSH.
Default remote repo: /opt/sber-designer

Environment:
  SBER_DESIGNER_REMOTE_SUDO=0  # do not prefix remote command with sudo
USAGE
}

die() {
  printf 'remote-update: %s\n' "$*" >&2
  exit 1
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

remote="${1:-}"
ref="${2:-}"
remote_repo="${3:-/opt/sber-designer}"

[[ -n "$remote" ]] || die "missing remote user@host"
[[ -n "$ref" ]] || die "missing ref"

printf -v quoted_repo '%q' "$remote_repo"
printf -v quoted_ref '%q' "$ref"

if [[ "${SBER_DESIGNER_REMOTE_SUDO:-1}" == "1" ]]; then
  ssh "$remote" "cd $quoted_repo && sudo deploy/update.sh $quoted_ref"
else
  ssh "$remote" "cd $quoted_repo && deploy/update.sh $quoted_ref"
fi
