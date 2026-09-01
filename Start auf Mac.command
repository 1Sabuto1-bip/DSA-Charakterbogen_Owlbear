#!/bin/bash

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="5173"
URL="http://localhost:${PORT}"
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

clear
echo "Aventurischer Heldenbogen"
echo "=========================="
echo

if curl -fsS "${URL}/manifest.json" >/dev/null 2>&1; then
  echo "Der Heldenbogen läuft bereits unter ${URL}"
elif command -v python3 >/dev/null 2>&1; then
  echo "Starte den lokalen Heldenbogen …"
  python3 -m http.server "$PORT" --directory "${SCRIPT_DIR}/dist" >/tmp/dsa5-owlbear-sheet.log 2>&1 &
  SERVER_PID="$!"
elif command -v ruby >/dev/null 2>&1; then
  echo "Starte den lokalen Heldenbogen …"
  ruby -run -e httpd "${SCRIPT_DIR}/dist" -p "$PORT" >/tmp/dsa5-owlbear-sheet.log 2>&1 &
  SERVER_PID="$!"
else
  MESSAGE="Auf diesem Mac wurde weder Python 3 noch Ruby gefunden. Installiere bitte Node.js LTS von nodejs.org und starte anschließend npm run dev."
  echo "$MESSAGE"
  if command -v osascript >/dev/null 2>&1; then
    osascript -e "display dialog \"$MESSAGE\" buttons {\"OK\"} default button \"OK\" with icon caution"
  fi
  read -r -p "Drücke die Eingabetaste zum Beenden."
  exit 1
fi

for _attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "${URL}/manifest.json" >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

if ! curl -fsS "${URL}/manifest.json" >/dev/null 2>&1; then
  echo
  echo "Der Server konnte nicht gestartet werden."
  echo "Prüfe bitte /tmp/dsa5-owlbear-sheet.log oder ob Port ${PORT} bereits belegt ist."
  read -r -p "Drücke die Eingabetaste zum Beenden."
  exit 1
fi

echo
echo "Der Heldenbogen läuft jetzt unter:"
echo "${URL}"
echo
echo "Installationslink für Owlbear Rodeo:"
echo "${URL}/manifest.json"
echo
echo "Dieses Terminalfenster muss während des Spiels geöffnet bleiben."
echo "Zum Beenden Strg+C drücken oder das Fenster schließen."
echo

if command -v open >/dev/null 2>&1; then
  open "$URL"
fi

if [ -n "$SERVER_PID" ]; then
  wait "$SERVER_PID"
else
  read -r -p "Der vorhandene Server läuft weiter. Drücke die Eingabetaste zum Schließen."
fi
