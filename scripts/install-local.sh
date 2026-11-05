#!/usr/bin/env bash
# dsh-caveman — install this bundle into a DSH profile from the packed tarball.
#
#   ./scripts/install-local.sh [profile-name]
#
# Defaults: profile "desktop", bundle tarball dsh-caveman-<version>.tgz beside this script's parent.
# It backs up package.json / cordis.patch.yml / pnpm-lock.yaml first, then:
#   1. pnpm add file:<tarball>       (copies the plugin into the profile's node_modules)
#   2. appends "dsh-caveman" to package.json's dsh.profile.bundles
# Restart DeepSeek Harness afterwards (or let HMR pick it up) and check Settings → Plugins.
set -euo pipefail

PROFILE_NAME="${1:-desktop}"
PKG_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE="$HOME/.dsh/profiles/$PROFILE_NAME"

NODE="${DSH_NODE:-$HOME/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin/node}"
PNPM="${DSH_PNPM:-$HOME/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/pnpm/bin/pnpm.mjs}"

if [ ! -x "$NODE" ]; then echo "error: Node not found at $NODE (set DSH_NODE)" >&2; exit 1; fi
if [ ! -f "$PNPM" ]; then echo "error: pnpm not found at $PNPM (set DSH_PNPM)" >&2; exit 1; fi
if [ ! -d "$PROFILE" ]; then echo "error: profile not found: $PROFILE" >&2; exit 1; fi

VERSION="$("$NODE" -p "require('$PKG_ROOT/package.json').version")"
TARBALL="$PKG_ROOT/dsh-caveman-$VERSION.tgz"
if [ ! -f "$TARBALL" ]; then
  echo "error: $TARBALL missing. Run: (cd \"$PKG_ROOT\" && npm pack)" >&2
  exit 1
fi

cd "$PROFILE"

# 1. Back up the three files this touches (undo: see scripts/uninstall-local.sh).
STAMP="$(date +%Y%m%d-%H%M%S)"
for f in package.json cordis.patch.yml pnpm-lock.yaml; do
  [ -f "$f" ] && cp -p "$f" "$f.bak-$STAMP"
done
echo "backed up to *.bak-$STAMP"

# 2. Drop a previously installed copy first: the lockfile pins the old tarball's integrity, and a
#    rebuilt tarball has different bytes, so `pnpm add` alone would refuse it.
if grep -q '"dsh-caveman"' "$PROFILE/package.json" 2>/dev/null; then
  "$NODE" "$PNPM" remove dsh-caveman --config.confirmModulesPurge=false >/dev/null 2>&1 || true
  echo "removed the previously installed copy"
fi

# 3. Add the package. --config.confirmModulesPurge=false keeps pnpm non-interactive.
"$NODE" "$PNPM" add "file:$TARBALL" --config.confirmModulesPurge=false

# 4. Select the bundle, so its cordis.patch.yml layer is composed into the profile.
"$NODE" -e '
  const fs = require("node:fs");
  const path = process.argv[1];
  const manifest = JSON.parse(fs.readFileSync(path, "utf8"));
  const bundles = manifest.dsh?.profile?.bundles;
  if (!Array.isArray(bundles)) throw new Error("profile package.json has no dsh.profile.bundles");
  if (!bundles.includes("dsh-caveman")) bundles.push("dsh-caveman");
  fs.writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
' "$PROFILE/package.json"

echo
echo "installed dsh-caveman@$VERSION into profile \"$PROFILE_NAME\""
echo "bundles: $("$NODE" -p "JSON.parse(require('fs').readFileSync('$PROFILE/package.json','utf8')).dsh.profile.bundles.join(', ')")"
echo
echo "Restart DeepSeek Harness to load the bundle."
echo "Skills: caveman, ultracave, megacave, caveman-commit, caveman-review, caveman-help, caveman-stats,"
echo "        caveman-compress, investigate-first, lean-build, migration, safe-refactor, surgical-patch, verify-and-stop"
echo "Try it in the input box: /caveman  (off again: say \"stop caveman\")"
