#!/bin/bash
# Tavern tesztkörnyezet a saját gépen (az asztali „Tavern teszt – indító” indítja).
# A mostani munkapéldányt futtatja (http://localhost:3100) a teszt adatbázissal (TavernTeszt, lib/testEnv.js): csak a
# tesztfiókokkal lehet belépni, levél és telefonos értesítés nem megy ki. A beállítások (adatbázis címe, kulcsok) a
# repón kívül vannak: ~/Library/Application Support/TavernTeszt/env. Az ablak bezárásakor (vagy Ctrl+C-re) a szerver leáll.
REPO="$(cd "$(dirname "$0")/.." && pwd)"
ENVFILE="$HOME/Library/Application Support/TavernTeszt/env"
PORT=3100
URL="http://localhost:$PORT/admin"
cd "$REPO" || exit 1
printf '\033]0;Tavern tesztkörnyezet\007'
echo "Tavern tesztkörnyezet – $URL"
echo "Leállítás: zárd be ezt az ablakot (vagy Ctrl+C)."
echo

if [ ! -f "$ENVFILE" ]; then
  echo "Hiányzik a beállítás: $ENVFILE"
  read -r -n 1 -p "Nyomj meg egy gombot a bezáráshoz…"; exit 1
fi
if lsof -ti "tcp:$PORT" >/dev/null 2>&1; then
  echo "A tesztkörnyezet már fut, megnyitom."
  open "$URL"; sleep 2; exit 0
fi

# a beállítások betöltése (a Node olvassa be, így az idézőjelek és különleges karakterek is rendben vannak)
eval "$(node -e 'const { parseEnv } = require("node:util"); const fs = require("node:fs"); for (const [k, v] of Object.entries(parseEnv(fs.readFileSync(process.argv[1], "utf8")))) if (/^[A-Z_][A-Z0-9_]*$/.test(k)) console.log(`export ${k}='"'"'${String(v).replace(/'"'"'/g, `'"'"'\\'"'"''"'"'`)}'"'"'`);' "$ENVFILE")"
if [ -z "$MONGODB_URI" ] || [ "$MONGODB_URI" = "[Sensitive]" ]; then
  echo "Hiányzik az adatbázis címe (MONGODB_URI) a beállításokból. Megnyitom a fájlt: írd be a MongoDB Atlas"
  echo "kapcsolódási címét (Atlas › Connect › Drivers) a MONGODB_URI= után, mentsd el, és indítsd újra."
  open -e "$ENVFILE"
  read -r -n 1 -p "Nyomj meg egy gombot a bezáráshoz…"; exit 1
fi
# külön build-mappa (.next-teszt), hogy a tesztek szerverével (.next) ne akadjon össze
export NEXT_DIST_DIR=.next-teszt
# belépés nélkül a belépőre visz (nem az élő oldalra): lib/testEnv.js isLocalTest
export TEST_LOCAL=1
node node_modules/next/dist/bin/next dev -p "$PORT" &
PID=$!

stop() {
  trap - EXIT INT TERM HUP
  echo; echo "Leállítás…"
  pkill -TERM -P "$PID" 2>/dev/null; kill -TERM "$PID" 2>/dev/null
  sleep 1
  lsof -ti "tcp:$PORT" 2>/dev/null | xargs kill -9 2>/dev/null
  exit 0
}
trap stop EXIT INT TERM HUP

# ha elindult, megnyitja a böngészőben
for _ in $(seq 1 180); do
  if curl -s -o /dev/null "$URL"; then open "$URL"; break; fi
  kill -0 "$PID" 2>/dev/null || break
  sleep 1
done
wait "$PID"
