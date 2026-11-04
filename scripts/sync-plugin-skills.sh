#!/usr/bin/env bash
# Copies shared skills from skills/ into plugin directories that are installed
# on their own. Marketplaces copy only the plugin directory, so a symlink out of
# it would dangle; the copy is committed instead.
#
#   scripts/sync-plugin-skills.sh          update the copies
#   scripts/sync-plugin-skills.sh --check  fail if a copy is out of date
set -euo pipefail

cd "$(dirname "$0")/.."

# source skill dir -> plugin copy
copies=(
  "skills/kernel-mcp:grok/skills/kernel-mcp"
)

check=false
[[ "${1:-}" == "--check" ]] && check=true

status=0
for pair in "${copies[@]}"; do
  src="${pair%%:*}"
  dst="${pair#*:}"
  if $check; then
    if ! diff -r "$src" "$dst" >/dev/null 2>&1; then
      echo "$dst is out of date with $src. Run: scripts/sync-plugin-skills.sh" >&2
      status=1
    fi
  else
    rm -rf "$dst"
    mkdir -p "$(dirname "$dst")"
    cp -R "$src" "$dst"
    echo "copied $src -> $dst"
  fi
done
exit $status
