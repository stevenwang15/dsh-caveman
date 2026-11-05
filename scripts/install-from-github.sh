#!/usr/bin/env bash
# dsh-caveman — install straight from GitHub. No npm publish involved.
#
#   ./scripts/install-from-github.sh [profile-name] [version]
#
#   profile-name  DSH profile to install into (default: desktop)
#   version       release version to fetch (default: 0.2.2, or $CAVEMAN_VERSION)
#
# What it does, in order:
#   1. downloads https://github.com/<repo>/releases/download/v<version>/dsh-caveman-<version>.tgz
#   2. backs up the profile's package.json / cordis.patch.yml / pnpm-lock.yaml
#   3. pnpm add file:<tgz>   (copies the plugin into the profile's node_modules)
#   4. appends dsh-caveman to package.json's dsh.profile.bundles
#   5. bumps the config marker so a running DSH recomposes and hot-loads the plugin
#
# Remove again with ./scripts/uninstall-local.sh [profile-name].
set -euo pipefail

PROFILE_NAME="${1:-desktop}"
VERSION="${2:-${CAVEMAN_VERSION:-0.2.2}}"
REPO="${CAVEMAN_REPO:-stevenwang15/dsh-caveman}"
PROFILE="$HOME/.dsh/profiles/$PROFILE_NAME"

NODE="${DSH_NODE:-$HOME/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin/node}"
PNPM="${DSH_PNPM:-$HOME/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/pnpm/bin/pnpm.mjs}"
BUNDLE="dsh-caveman"
MARKER="# dsh-caveman dev reload trigger"

command -v curl >/dev/null || { echo "error: curl not found" >&2; exit 1; }
[ -x "$NODE" ] || { echo "error: Node not found at $NODE (set DSH_NODE)" >&2; exit 1; }
[ -f "$PNPM" ] || { echo "error: pnpm not found at $PNPM (set DSH_PNPM)" >&2; exit 1; }
[ -d "$PROFILE" ] || { echo "error: profile not found: $PROFILE" >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
TGZ="$TMP/dsh-caveman-$VERSION.tgz"
URL="https://github.com/$REPO/releases/download/v$VERSION/dsh-caveman-$VERSION.tgz"

echo "downloading $URL"
curl -fL --retry 3 --connect-timeout 20 -o "$TGZ" "$URL" || {
  echo "error: download failed. Check the version/tag on https://github.com/$REPO/releases" >&2
  exit 1
}

# Sanity check: the tarball really is this package at the requested version.
INNER_VERSION="$(tar -xzOf "$TGZ" package/package.json | "$NODE" -p "
  JSON.parse(require('fs').readFileSync(0, 'utf8')).version" 2>/dev/null || true)"
if [ "$INNER_VERSION" != "$VERSION" ]; then
  echo "error: tarball version is '$INNER_VERSION', expected '$VERSION'" >&2
  exit 1
fi

cd "$PROFILE"

STAMP="$(date +%Y%m%d-%H%M%S)"
for f in package.json cordis.patch.yml pnpm-lock.yaml; do
  [ -f "$f" ] && cp -p "$f" "$f.bak-$STAMP"
done
echo "backed up to *.bak-$STAMP"

# Drop an older copy first: the lockfile pins the old tarball's integrity, and a rebuilt
# tarball has different bytes, so `pnpm add` alone would refuse it.
if grep -q "\"$BUNDLE\"" "$PROFILE/package.json" 2>/dev/null; then
  "$NODE" "$PNPM" remove "$BUNDLE" --config.confirmModulesPurge=false >/dev/null 2>&1 || true
  echo "removed the previously installed copy"
fi

"$NODE" "$PNPM" add "file:$TGZ" --config.confirmModulesPurge=false

# Select the bundle so its cordis.patch.yml layer joins the composition.
"$NODE" -e '
  const fs = require("node:fs");
  const [path, bundle] = process.argv.slice(1);
  const manifest = JSON.parse(fs.readFileSync(path, "utf8"));
  const bundles = manifest.dsh?.profile?.bundles;
  if (!Array.isArray(bundles)) throw new Error("profile package.json has no dsh.profile.bundles");
  if (!bundles.includes(bundle)) bundles.push(bundle);
  fs.writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
' "$PROFILE/package.json" "$BUNDLE"

# Trigger a recomposition in a running DSH: a configuration event reloads the bundle's module.
if [ -f "$PROFILE/cordis.patch.yml" ]; then
  grep -v "^${MARKER}" "$PROFILE/cordis.patch.yml" > "$PROFILE/cordis.patch.yml.tmp"
  printf '\n%s %s\n' "$MARKER" "$STAMP" >> "$PROFILE/cordis.patch.yml.tmp"
  mv "$PROFILE/cordis.patch.yml.tmp" "$PROFILE/cordis.patch.yml"
fi

echo
echo "installed $BUNDLE@$VERSION into profile \"$PROFILE_NAME\" from GitHub"
echo "bundles: $("$NODE" -p "JSON.parse(require('fs').readFileSync('$PROFILE/package.json','utf8')).dsh.profile.bundles.join(', ')")"
echo
echo "Skills: caveman, ultracave, megacave, caveman-commit, caveman-review, caveman-help, caveman-stats,"
echo "        caveman-compress, investigate-first, lean-build, migration, safe-refactor, surgical-patch, verify-and-stop"
echo "If DSH was running, it reloads the bundle on the configuration change; otherwise it loads on next start."
