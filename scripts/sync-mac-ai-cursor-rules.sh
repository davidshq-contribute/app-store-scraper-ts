#!/usr/bin/env bash
# Symlink shared Cursor rules from sibling mac-ai (mac-project layout).
# Run from repo root: ./scripts/sync-mac-ai-cursor-rules.sh
# Or: npm run cursor-rules:sync
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${ROOT}/.cursor/rules"
# From .cursor/rules: .. → .cursor, ../.. → package root, ../../.. → mac-project (sibling repos)
MAC_REL="../../../mac-ai/.cursor/rules"
RULES=(
  engineering-principles.mdc
  documentation-maintenance.mdc
  ai-guidelines.mdc
  test-and-code-fixes.mdc
  typescript-standards.mdc
)

cd "${TARGET}"
if [[ ! -d "${MAC_REL}" ]]; then
  echo "sync-mac-ai-cursor-rules: mac-ai not found (expected $(dirname "${ROOT}")/mac-ai); skipping symlinks" >&2
  exit 0
fi

for f in "${RULES[@]}"; do
  ln -sfn "${MAC_REL}/${f}" "${f}"
done
echo "sync-mac-ai-cursor-rules: linked ${#RULES[@]} rules in ${TARGET}"
