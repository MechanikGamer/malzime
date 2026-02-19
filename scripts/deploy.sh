#!/usr/bin/env bash
# malziME Deploy-Script
# Aktualisiert Cache-Busting-Versionen und deployed auf Firebase.
#
# Nutzung:
#   ./scripts/deploy.sh              # Hosting + Functions
#   ./scripts/deploy.sh hosting      # Nur Hosting
#   ./scripts/deploy.sh functions    # Nur Functions

set -euo pipefail
cd "$(dirname "$0")/.."

# ── Cache-Busting-Version generieren ──
VERSION=$(date +"%Y%m%d")$(printf "%02d" "$(date +%-H)")
echo "Cache-Busting-Version: ?v=$VERSION"

# Alle HTML-Dateien mit ?v= aktualisieren
for f in public/index.html public/datenschutz.html public/impressum.html; do
  if [ -f "$f" ]; then
    sed -i '' "s/\?v=[0-9]*/\?v=$VERSION/g" "$f"
    echo "  $f aktualisiert"
  fi
done

# ── Deploy-Ziel bestimmen ──
TARGET="${1:-hosting,functions}"

echo ""
echo "Deploy-Ziel: $TARGET"
echo "Weiter? (Enter = ja, Ctrl+C = abbrechen)"
read -r

npx firebase deploy --only "$TARGET"

echo ""
echo "Deploy abgeschlossen. Version: ?v=$VERSION"
