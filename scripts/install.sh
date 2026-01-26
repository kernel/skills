#!/usr/bin/env bash
set -e

REPO="https://github.com/kernel/skills"

# ANSI colors
BOLD=$'\033[1m'
GREY=$'\033[90m'
RED=$'\033[31m'
GREEN=$'\033[32m'
YELLOW=$'\033[33m'
PURPLE=$'\033[38;2;139;92;246m'  # #8B5CF6
CYAN=$'\033[36m'
NC=$'\033[0m'

info() { printf "${BOLD}${GREY}>${NC} %s\n" "$*"; }
warn() { printf "${YELLOW}! %s${NC}\n" "$*"; }
error() { printf "${RED}x %s${NC}\n" "$*" >&2; exit 1; }
completed() { printf "${GREEN}✓${NC} %s\n" "$*"; }

print_success() {
  printf "${PURPLE}"
  cat <<'EOF'

  █▄▀ █▀▀ █▀█ █▄ █ █▀▀ █
  █ █ ██▄ █▀▄ █ ▀█ ██▄ █▄▄

  Skills installed successfully!

EOF
  printf "${NC}"
}

# Parse arguments
USE_SYMLINK=false
for arg in "$@"; do
  case "$arg" in
    --symlink|-s) USE_SYMLINK=true ;;
    --help|-h)
      echo "Usage: install.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  -s, --symlink  Use symlinks instead of copying (requires local checkout)"
      echo "  -h, --help     Show this help message"
      exit 0
      ;;
  esac
done

install_skills() {
  local skills_dir="$1"
  local name="$2"
  local source_dir="$3"
  local use_symlink="$4"

  mkdir -p "$skills_dir"

  # Clean up previously installed kernel skills
  for item in "$skills_dir"/kernel-*; do
    [ -e "$item" ] || [ -L "$item" ] || continue
    if [ -L "$item" ]; then
      unlink "$item" 2>/dev/null || true
    else
      rm -rf "$item" 2>/dev/null || true
    fi
  done

  local count=0
  local method=""
  [ "$use_symlink" = "true" ] && method=" (symlinked)"

  for plugin_dir in "$source_dir"/plugins/*/; do
    [ -d "$plugin_dir" ] || continue
    plugin_name="${plugin_dir%/}"
    plugin_name="${plugin_name##*/}"

    [ -d "$plugin_dir/skills" ] || continue

    for skill_dir in "$plugin_dir"/skills/*/; do
      [ -d "$skill_dir" ] || continue
      skill_name="${skill_dir%/}"
      skill_name="${skill_name##*/}"
      [[ "$skill_name" == _* ]] && continue
      [ -f "$skill_dir/SKILL.md" ] || continue

      if [ "$use_symlink" = "true" ]; then
        ln -sf "$(cd "$skill_dir" && pwd)" "$skills_dir/kernel-$plugin_name-$skill_name"
      else
        cp -R "$skill_dir" "$skills_dir/kernel-$plugin_name-$skill_name"
      fi
      count=$((count + 1))
    done
  done

  completed "$name: ${GREEN}$count${NC} skills$method → ${CYAN}$skills_dir${NC}"
}

# Targets: [dir, name]
declare -a TARGETS=(
  "$HOME/.claude/skills|Claude Code"
  "$HOME/.codex/skills|OpenAI Codex"
  "$HOME/.config/opencode/skill|OpenCode"
  "$HOME/.cursor/skills|Cursor"
)

# Detect available tools
declare -a FOUND=()
for target in "${TARGETS[@]}"; do
  dir="${target%%|*}"
  parent="${dir%/*}"
  [ -d "$parent" ] && FOUND+=("$target")
done

if [ ${#FOUND[@]} -eq 0 ]; then
  error "No supported tools found."
  printf "\nSupported:\n"
  printf "  • Claude Code (~/.claude)\n"
  printf "  • OpenAI Codex (~/.codex)\n"
  printf "  • OpenCode (~/.config/opencode)\n"
  printf "  • Cursor (~/.cursor)\n"
  exit 1
fi

printf "\n${BOLD}Kernel Skills${NC}\n\n"

# Determine source directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

if [ "$USE_SYMLINK" = "true" ] && [ -d "$REPO_DIR/plugins" ]; then
  info "Using symlinks from local checkout: ${CYAN}$REPO_DIR${NC}"
  source_dir="$REPO_DIR"
else
  if [ "$USE_SYMLINK" = "true" ]; then
    warn "Local plugins not found, falling back to download..."
    USE_SYMLINK=false
  fi
  command -v git >/dev/null 2>&1 || error "git is required but not installed."
  info "Downloading from ${CYAN}$REPO${NC}..."
  source_dir=$(mktemp -d)
  trap 'rm -rf "$source_dir"' EXIT
  git clone --depth 1 --quiet "$REPO" "$source_dir"
fi
printf "\n"

for target in "${FOUND[@]}"; do
  dir="${target%%|*}"
  name="${target##*|}"
  install_skills "$dir" "$name" "$source_dir" "$USE_SYMLINK"
done

# Local installs (skip if CWD is $HOME)
if [ "$(pwd)" != "$HOME" ]; then
  declare -a LOCAL_TARGETS=(
    ".claude/skills|Claude Code (local)"
    ".codex/skills|OpenAI Codex (local)"
    ".config/opencode/skill|OpenCode (local)"
    ".cursor/skills|Cursor (local)"
  )
  for target in "${LOCAL_TARGETS[@]}"; do
    dir="${target%%|*}"
    name="${target##*|}"
    parent="${dir%/*}"
    [ -d "./$parent" ] && install_skills "./$dir" "$name" "$source_dir" "$USE_SYMLINK"
  done
fi

printf "\n"
print_success
warn "Restart your tool(s) to load skills."
printf "\n"
info "Re-run anytime to update."
printf "\n"
