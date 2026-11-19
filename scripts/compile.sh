#!/usr/bin/env bash
# Compile the ballot contract. Prefers the `compact` manager; falls back to
# the `compactc` compiler binary when the manager cannot reach its backend
# (some sandboxed networks block the manager's GitHub API calls).
set -euo pipefail
cd "$(dirname "$0")/.."

if command -v compact >/dev/null 2>&1; then
  if compact compile contracts/ballot.compact contracts/managed/ballot; then
    exit 0
  fi
  echo "compact manager failed, trying compactc directly" >&2
fi

for candidate in \
  "$HOME/.compact/versions/0.36.1/compactc" \
  "$(command -v compactc || true)"; do
  if [ -n "$candidate" ] && [ -x "$candidate" ]; then
    exec "$candidate" contracts/ballot.compact contracts/managed/ballot
  fi
done

echo "No Compact compiler found. Install the toolchain first:" >&2
echo "  curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh" >&2
echo "  compact update 0.36.1" >&2
exit 1
