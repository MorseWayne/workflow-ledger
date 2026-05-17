#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/MorseWayne/workflow-ledger"
ARCHIVE_URL="https://github.com/MorseWayne/workflow-ledger/archive/refs/heads/main.tar.gz"
TARGET_DIR="${1:-$PWD}"

TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"
SCRIPT_PATH="${BASH_SOURCE[0]-}"
SCRIPT_DIR=""
if [ -n "$SCRIPT_PATH" ] && [ "$SCRIPT_PATH" != "bash" ] && [ "$SCRIPT_PATH" != "-" ]; then
  SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
fi

cleanup_dir=""
cleanup() {
  if [ -n "$cleanup_dir" ] && [ -d "$cleanup_dir" ]; then
    rm -rf "$cleanup_dir"
  fi
}
trap cleanup EXIT

SOURCE_DIR="$SCRIPT_DIR"
if [ ! -d "$SOURCE_DIR/skills/workflow-ledger" ] || [ ! -f "$SOURCE_DIR/examples/claude-project/CLAUDE.md.snippet" ] || [ ! -f "$SOURCE_DIR/bin/workflow-ledger.js" ]; then
  if ! command -v curl >/dev/null 2>&1; then
    echo "error: curl is required when install.sh is run outside a workflow-ledger checkout" >&2
    exit 1
  fi
  if ! command -v tar >/dev/null 2>&1; then
    echo "error: tar is required when install.sh is run outside a workflow-ledger checkout" >&2
    exit 1
  fi

  cleanup_dir="$(mktemp -d)"
  curl -fsSL "$ARCHIVE_URL" | tar -xz -C "$cleanup_dir"
  SOURCE_DIR="$cleanup_dir/workflow-ledger-main"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "error: workflow-ledger requires Node.js 18 or newer" >&2
  exit 1
fi

node "$SOURCE_DIR/bin/workflow-ledger.js" init --tool claude-code --root "$TARGET_DIR"

echo "installed workflow-ledger into $TARGET_DIR"
echo "next: run /workflow-ledger start \"your task\" in Claude Code"
echo "optional: run npx workflow-ledger doctor"
