#!/usr/bin/env bash
# dsh-caveman — dev helper: force a live recomposition without restarting the app.
#
#   ./scripts/dev-reload.sh [profile-name]
#
# DSH's HMR recomposes on profile configuration changes (it watches cordis.patch.yml). Editing
# package.json's bundle list alone was NOT enough in practice: the running host kept the old
# module instance. A configuration event does reload the bundle's module, so this script bumps a
# single marker comment in cordis.patch.yml (removing the previous one to keep the file tidy).
#
# Use after `npm pack` + `./scripts/install-local.sh`.
set -euo pipefail

PROFILE_NAME="${1:-desktop}"
PROFILE="$HOME/.dsh/profiles/$PROFILE_NAME"
NODE="${DSH_NODE:-$HOME/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin/node}"
MARKER="# dsh-caveman dev reload trigger"

[ -d "$PROFILE" ] || { echo "error: profile not found: $PROFILE" >&2; exit 1; }
[ -f "$PROFILE/cordis.patch.yml" ] || { echo "error: no cordis.patch.yml in $PROFILE" >&2; exit 1; }

STAMP="$(date +%Y%m%d-%H%M%S)"
# Drop earlier markers, then append one with a fresh timestamp: net change on every run.
grep -v "^${MARKER}" "$PROFILE/cordis.patch.yml" > "$PROFILE/cordis.patch.yml.tmp"
printf '\n%s %s\n' "$MARKER" "$STAMP" >> "$PROFILE/cordis.patch.yml.tmp"
mv "$PROFILE/cordis.patch.yml.tmp" "$PROFILE/cordis.patch.yml"
echo "bumped configuration marker in $PROFILE/cordis.patch.yml ($STAMP)"
echo "waiting for the recomposition..."
sleep 5
echo "done — check that the skill catalog now lists the expected skills"
