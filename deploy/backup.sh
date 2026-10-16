#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: deploy/backup.sh [output-directory]

Creates a tar.gz backup of:
  - SBER_DESIGNER_PROJECTS_ROOT, including .trash/ (excluding dependency
    caches and retained run evidence)
  - /home/sd/.sber-designer, including auth/ and users/
  - /etc/sber-designer

Environment:
  SBER_DESIGNER_ENV_FILE=/etc/sber-designer/env
  SBER_DESIGNER_BACKUP_DIR=/var/backups/sber-designer
USAGE
}

die() {
  printf 'backup: %s\n' "$*" >&2
  exit 1
}

log() {
  printf '[backup] %s\n' "$*"
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

backup_dir="${1:-${SBER_DESIGNER_BACKUP_DIR:-/var/backups/sber-designer}}"
projects_root="${SBER_DESIGNER_PROJECTS_ROOT:-/srv/sber-designer/projects}"
sd_home="${SBER_DESIGNER_HOME:-/home/sd}"
config_dir="${SBER_DESIGNER_CONFIG_DIR:-/etc/sber-designer}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive_name="sber-designer-backup-$timestamp.tgz"
tmp_archive="$backup_dir/.$archive_name.tmp"
archive="$backup_dir/$archive_name"

paths=()
for candidate in "$projects_root" "$sd_home/.sber-designer" "$config_dir"; do
  if [[ -e "$candidate" ]]; then
    paths+=("$candidate")
  else
    log "skip missing path $candidate"
  fi
done

[[ "${#paths[@]}" -gt 0 ]] || die "nothing to back up"

mkdir -p "$backup_dir"
umask 077

log "writing $archive"
tar \
  --exclude='*/node_modules' \
  --exclude='*/.sber-designer/runs' \
  -czf "$tmp_archive" \
  "${paths[@]}"
mv "$tmp_archive" "$archive"
chmod 600 "$archive"

log "done: $archive"
