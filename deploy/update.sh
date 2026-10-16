#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: deploy/update.sh <tag-or-branch-or-sha>

Runs on the remote server from the sber-designer checkout:
  fetch -> isolated worktree -> frozen install -> build web
        -> stop -> switch source/artifacts -> start -> readiness/parity -> smoke

Preparation never modifies the serving checkout. The switch has a short
service interruption. Any switch/readiness/parity/smoke failure restores the
previous source, dependencies, build metadata and bundle before restarting.

Environment:
  SBER_DESIGNER_ENV_FILE=/etc/sber-designer/env
  SBER_DESIGNER_API_SERVICE=sd-api
  SBER_DESIGNER_SANDBOX_SERVICE=sd-sandbox
  SBER_DESIGNER_SERVICE_USER=sd
  SBER_DESIGNER_SKIP_SYSTEMCTL=1        # syntax/dry-run helper
  SBER_DESIGNER_SKIP_SMOKE=1            # skip smoke probes
  SBER_DESIGNER_UPDATE_ALLOW_DIRTY=1    # allow dirty checkout
  SBER_DESIGNER_UPDATE_NO_ROLLBACK=1    # keep a failed checkout for inspection
  SBER_DESIGNER_READY_TIMEOUT=120       # seconds to wait for /health
  SBER_DESIGNER_READY_INTERVAL=3        # seconds between readiness probes
USAGE
}

die() {
  printf 'update: %s\n' "$*" >&2
  exit 1
}

log() {
  printf '[update] %s\n' "$*"
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

ref="${1:-${SBER_DESIGNER_UPDATE_REF:-}}"
[[ -n "$ref" ]] || die "missing ref; pass tag, branch, or sha"

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/.." && pwd)"
env_file="${SBER_DESIGNER_ENV_FILE:-/etc/sber-designer/env}"

if [[ -r "$env_file" ]]; then
  set -a
  # shellcheck source=/dev/null
  . "$env_file"
  set +a
fi

if [[ -n "${SBER_DESIGNER_DEPLOYMENT_MODE:-}" && "${SBER_DESIGNER_DEPLOYMENT_MODE}" != "server" ]]; then
  die "remote update requires SBER_DESIGNER_DEPLOYMENT_MODE=server"
fi
export SBER_DESIGNER_DEPLOYMENT_MODE=server

cd "$repo_root"

api_service="${SBER_DESIGNER_API_SERVICE:-sd-api}"
sandbox_service="${SBER_DESIGNER_SANDBOX_SERVICE:-sd-sandbox}"
service_user="${SBER_DESIGNER_SERVICE_USER:-sd}"
bun_bin="${SBER_DESIGNER_BUN_PATH:-/home/${service_user}/.bun/bin/bun}"

[[ "$bun_bin" == /* ]] || die "SBER_DESIGNER_BUN_PATH must be an absolute path"
[[ -x "$bun_bin" ]] || die "Bun is not executable at $bun_bin"

as_service_user() {
  if [[ "$(id -u)" == "0" ]]; then
    sudo -u "$service_user" "$@"
  else
    "$@"
  fi
}

if [[ "${SBER_DESIGNER_UPDATE_ALLOW_DIRTY:-0}" != "1" ]]; then
  as_service_user git diff --quiet || die "checkout has unstaged changes; commit/stash or set SBER_DESIGNER_UPDATE_ALLOW_DIRTY=1"
  as_service_user git diff --cached --quiet || die "checkout has staged changes; commit/stash or set SBER_DESIGNER_UPDATE_ALLOW_DIRTY=1"
fi

# Prepare in a detached worktree. The checkout, dependencies and dist used by
# running processes/nginx stay untouched until every preparation step passes.
log "fetching tags"
as_service_user git fetch --tags origin
rollback_ref="$(as_service_user git rev-parse HEAD)"
log "rollback point is $rollback_ref"
checkout_ref="$ref"
if as_service_user git rev-parse --verify --quiet "origin/$ref^{commit}" >/dev/null; then
  checkout_ref="origin/$ref"
fi
deployed_sha="$(as_service_user git rev-parse --verify "$checkout_ref^{commit}")" || die "unknown ref: $ref"

stage_root="$(as_service_user mktemp -d "$repo_root/.sd-update-XXXXXX")"
stage_tree="$stage_root/tree"
backup_root="$stage_root/previous"
as_service_user mkdir -p "$backup_root"
switch_started=0
completed=0

service_action() {
  local action="$1" service="$2"
  if [[ "${SBER_DESIGNER_SKIP_SYSTEMCTL:-0}" == "1" ]]; then
    log "skip systemctl $action $service"
  elif [[ "$(id -u)" == "0" ]]; then
    systemctl "$action" "$service"
  else
    sudo systemctl "$action" "$service"
  fi
}

rollback() {
  log "restoring $rollback_ref and its built artifacts"
  service_action stop "$api_service" || true
  service_action stop "$sandbox_service" || true
  as_service_user git -C "$repo_root" checkout --detach "$rollback_ref" || return 1
  # The journal is written before each artifact switch so even a failed mv
  # restores the old dependency tree and bundle, including absent artifacts.
  while IFS= read -r artifact; do
    if [[ -e "$backup_root/$artifact" || -L "$backup_root/$artifact" ]]; then
      as_service_user rm -rf "$repo_root/$artifact"
      as_service_user mkdir -p "$(dirname "$repo_root/$artifact")"
      as_service_user mv "$backup_root/$artifact" "$repo_root/$artifact" || return 1
    elif [[ -f "$backup_root/$artifact.absent" ]]; then
      as_service_user rm -rf "$repo_root/$artifact"
    fi
  done < "$stage_root/artifacts"
  service_action start "$sandbox_service" || return 1
  service_action start "$api_service" || return 1
}

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  if [[ "$completed" != "1" && "$switch_started" == "1" ]]; then
    if [[ "${SBER_DESIGNER_UPDATE_NO_ROLLBACK:-0}" == "1" ]]; then
      log "rollback disabled; prepared version and backup retained at $stage_root"
      exit "$status"
    fi
    if ! rollback; then
      log "ERROR: rollback failed; backup retained at $stage_root"
      exit 1
    fi
  fi
  as_service_user git -C "$repo_root" worktree remove --force "$stage_tree" >/dev/null 2>&1 || true
  as_service_user rm -rf "$stage_root"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
fail_update() { die "$*"; }

as_service_user git worktree add --detach "$stage_tree" "$deployed_sha"
cd "$stage_tree"
log "installing dependencies from bun.lock in staging"
as_service_user "$bun_bin" install --frozen-lockfile || fail_update "install failed; the running version was not changed"
log "building web in staging"
as_service_user env \
  SBER_DESIGNER_DEPLOYMENT_MODE=server \
  SBER_DESIGNER_AUTH_MODE="${SBER_DESIGNER_AUTH_MODE:-password}" \
  SBER_DESIGNER_BUILD_SHA="$deployed_sha" \
  VITE_API_URL="${VITE_API_URL:-}" \
  "$bun_bin" run build || fail_update "build failed; the running version was not changed"
[[ -f apps/web/dist/index.html && -f BUILD_INFO.json && -d node_modules ]] || fail_update "build artifacts missing; the running version was not changed"

# Only the switch has downtime. Keep original artifacts until readiness,
# exact commit parity and smoke have succeeded, so rollback needs no build.
cd "$repo_root"
as_service_user touch "$stage_root/artifacts"
switch_started=1
service_action stop "$api_service"
service_action stop "$sandbox_service"
as_service_user git checkout --detach "$deployed_sha"
artifact_plan="$stage_root/plan"
{
  printf '%s\n' node_modules BUILD_INFO.json apps/web/dist
  for directory in "$repo_root"/apps/*/node_modules "$repo_root"/packages/*/node_modules "$repo_root"/services/*/node_modules "$repo_root"/plugins/*/node_modules "$stage_tree"/apps/*/node_modules "$stage_tree"/packages/*/node_modules "$stage_tree"/services/*/node_modules "$stage_tree"/plugins/*/node_modules; do
    [[ -e "$directory" || -L "$directory" ]] || continue
    directory="${directory#"$repo_root/"}"
    directory="${directory#"$stage_tree/"}"
    # Strip the staging prefix first (it lives below repo_root).
    directory="${directory#"${stage_tree#"$repo_root/"}/"}"
    printf '%s\n' "$directory"
  done
} | sort -u > "$artifact_plan"
while IFS= read -r artifact; do
  printf '%s\n' "$artifact" >> "$stage_root/artifacts"
  as_service_user mkdir -p "$(dirname "$backup_root/$artifact")"
  if [[ -e "$repo_root/$artifact" || -L "$repo_root/$artifact" ]]; then
    as_service_user mv "$repo_root/$artifact" "$backup_root/$artifact"
  else
    as_service_user touch "$backup_root/$artifact.absent"
  fi
  if [[ -e "$stage_tree/$artifact" || -L "$stage_tree/$artifact" ]]; then
    as_service_user mkdir -p "$(dirname "$repo_root/$artifact")"
    as_service_user mv "$stage_tree/$artifact" "$repo_root/$artifact"
  fi
done < "$artifact_plan"
log "restarting services"
service_action start "$sandbox_service"
service_action start "$api_service"

api_local_url="${SBER_DESIGNER_API_LOCAL_URL:-http://127.0.0.1:${PORT:-3000}}"
sandbox_local_url="${SBER_DESIGNER_SANDBOX_URL:-http://127.0.0.1:3001}"
ready_timeout="${SBER_DESIGNER_READY_TIMEOUT:-120}"
ready_interval="${SBER_DESIGNER_READY_INTERVAL:-3}"
wait_for_ready() {
  local label="$1" url="$2" deadline
  deadline=$(( $(date +%s) + ready_timeout ))
  while true; do
    if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
      log "$label is ready"
      return 0
    fi
    if [[ "$(date +%s)" -ge "$deadline" ]]; then
      fail_update "$label did not become ready at $url within ${ready_timeout}s"
    fi
    sleep "$ready_interval"
  done
}
wait_for_ready "api" "$api_local_url/health"
wait_for_ready "sandbox" "$sandbox_local_url/health"
version_body="$(curl -fsS --max-time 10 "$api_local_url/api/version")" || fail_update "version endpoint failed"
# Match the entire SHA value, never a substring or a warning-only check.
if [[ ! "$version_body" =~ \"gitSha\"[[:space:]]*:[[:space:]]*\"$deployed_sha\" ]]; then
  fail_update "version parity failed: running API is not $deployed_sha"
fi
if [[ "${SBER_DESIGNER_SKIP_SMOKE:-0}" == "1" ]]; then
  log "skip smoke"
  completed=1
  exit 0
fi

if [[ -z "${SBER_DESIGNER_SMOKE_SERVICE_TOKEN:-}" && -n "${SBER_DESIGNER_SERVICE_TOKENS:-}" ]]; then
  IFS=',' read -r -a service_token_entries <<<"$SBER_DESIGNER_SERVICE_TOKENS"
  for entry in "${service_token_entries[@]}"; do
    name="${entry%%:*}"
    token="${entry#*:}"
    if [[ "$name" == "smoke" && "$token" != "$entry" ]]; then
      export SBER_DESIGNER_SMOKE_SERVICE_TOKEN="$token"
      break
    fi
  done
fi

export SBER_DESIGNER_SMOKE_WEB_URL="${SBER_DESIGNER_SMOKE_WEB_URL:-${SBER_DESIGNER_PUBLIC_URL:-http://127.0.0.1}}"
export SBER_DESIGNER_SMOKE_API_URL="${SBER_DESIGNER_SMOKE_API_URL:-${SBER_DESIGNER_PUBLIC_URL:-$api_local_url}}"
export SBER_DESIGNER_SANDBOX_URL="$sandbox_local_url"
export SBER_DESIGNER_SMOKE_CHECK_ENDPOINTS="${SBER_DESIGNER_SMOKE_CHECK_ENDPOINTS:-1}"

log "running smoke"
if [[ "$(id -u)" == "0" ]]; then
  sudo -u "$service_user" env \
    SBER_DESIGNER_SMOKE_WEB_URL="$SBER_DESIGNER_SMOKE_WEB_URL" \
    SBER_DESIGNER_SMOKE_API_URL="$SBER_DESIGNER_SMOKE_API_URL" \
    SBER_DESIGNER_SANDBOX_URL="$SBER_DESIGNER_SANDBOX_URL" \
    SBER_DESIGNER_SMOKE_CHECK_ENDPOINTS="$SBER_DESIGNER_SMOKE_CHECK_ENDPOINTS" \
    SBER_DESIGNER_SMOKE_SERVICE_TOKEN="${SBER_DESIGNER_SMOKE_SERVICE_TOKEN:-}" \
    "$bun_bin" run smoke:local-mvp || fail_update "smoke failed"
else
  "$bun_bin" run smoke:local-mvp || fail_update "smoke failed"
fi

completed=1
log "done"
