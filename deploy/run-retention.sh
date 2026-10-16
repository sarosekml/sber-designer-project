#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: deploy/run-retention.sh

Cron/systemd-timer fallback for deleting old .sber-designer/runs/<run-id>
directories across all server-side workspaces.

Environment:
  SBER_DESIGNER_ENV_FILE=/etc/sber-designer/env
  SBER_DESIGNER_PROJECTS_ROOT=/srv/sber-designer/projects
  SBER_DESIGNER_RUNS_RETENTION_DAYS=30
USAGE
}

die() {
  printf 'run-retention: %s\n' "$*" >&2
  exit 1
}

log() {
  printf '[run-retention] %s\n' "$*"
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

env_file="${SBER_DESIGNER_ENV_FILE:-/etc/sber-designer/env}"
if [[ -r "$env_file" ]]; then
  set -a
  # shellcheck source=/dev/null
  . "$env_file"
  set +a
fi

projects_root="${SBER_DESIGNER_PROJECTS_ROOT:-/srv/sber-designer/projects}"
days="${SBER_DESIGNER_RUNS_RETENTION_DAYS:-0}"

case "$days" in
  ''|0|off|false)
    log "disabled"
    exit 0
    ;;
  *[!0-9]*)
    die "SBER_DESIGNER_RUNS_RETENTION_DAYS must be a positive integer, 0, or off"
    ;;
esac

[[ "$days" -ge 1 ]] || die "SBER_DESIGNER_RUNS_RETENTION_DAYS must be at least 1"
[[ -d "$projects_root" ]] || die "projects root not found: $projects_root"

log "deleting run artifacts older than $days day(s) under $projects_root"
deleted=0
skipped_running=0
while IFS= read -r -d '' run_dir; do
  manifest="$run_dir/run-manifest.json"
  if [[ -f "$manifest" ]] && grep -q '"status"[[:space:]]*:[[:space:]]*"running"' "$manifest"; then
    skipped_running=$((skipped_running + 1))
    continue
  fi
  printf '%s\n' "$run_dir"
  rm -rf -- "$run_dir"
  deleted=$((deleted + 1))
done < <(
  find "$projects_root" \
    -type d \
    -path '*/.sber-designer/runs/*' \
    -mtime +"$days" \
    -prune \
    -print0
)

log "deleted=$deleted skipped_running=$skipped_running"
