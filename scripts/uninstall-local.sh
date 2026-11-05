#!/usr/bin/env bash
# dsh-caveman — remove the bundle from a DSH profile and restore the backed-up profile files.
#
#   ./scripts/uninstall-local.sh [profile-name] [backup-stamp]
#
# With no backup stamp it restores the newest *.bak-<stamp> copies of package.json /
# cordis.patch.yml / pnpm-lock.yaml, so the profile returns to its state before installation.
set -euo pipefail

PROFILE_NAME="${1:-desktop}"
PROFILE="$HOME/.dsh/profiles/$PROFILE_NAME"
NODE="${DSH_NODE:-$HOME/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin/node}"
PNPM="${DSH_PNPM:-$HOME/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/pnpm/bin/pnpm.mjs}"

[ -d "$PROFILE" ] || { echo "error: profile not found: $PROFILE" >&2; exit 1; }
cd "$PROFILE"

# Deselect the bundle first, then remove the package, so no layer points at missing files.
"$NODE" -e '
  const fs = require("node:fs");
  const path = process.argv[1];
  const manifest = JSON.parse(fs.readFileSync(path, "utf8"));
  const bundles = manifest.dsh?.profile?.bundles ?? [];
  manifest.dsh.profile.bundles = bundles.filter((b) => b !== "dsh-caveman");
  fs.writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
' "$PROFILE/package.json"

"$NODE" "$PNPM" remove dsh-caveman --config.confirmModulesPurge=false || true

STAMP="${2:-$(ls -t package.json.bak-* 2>/dev/null | head -1 | sed 's/.*\.bak-//')}"
if [ -n "$STAMP" ]; then
  for f in package.json cordis.patch.yml pnpm-lock.yaml; do
    if [ -f "$f.bak-$STAMP" ]; then cp -p "$f.bak-$STAMP" "$f"; echo "restored $f from $f.bak-$STAMP"; fi
  done
fi

rm -rf "$PROFILE/node_modules/dsh-caveman"
echo "dsh-caveman removed from profile \"$PROFILE_NAME\". Restart DeepSeek Harness."
