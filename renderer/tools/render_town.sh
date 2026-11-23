#!/bin/bash
# Renders Passenger Town's buildings (b/town.js) for the game: every lot in tools/town_footprints.json, by day and at
# night (lights on automatic), and stripped (scaffold, frame) by day, in a few variants (tools/install_town.py jobs).
# Run from renderer/; then tools/install_town.py. About twenty minutes on four cores. Pass a kind (e.g. `house`) to
# render only its lots. OUT (default out/town) is where the passes go: delete it after installing (about 1 GB).
set -e
cd "$(dirname "$0")/.."
OUT=${OUT:-out/town}
mkdir -p "$OUT"
mapfile -t J < <(python3 tools/install_town.py jobs "$@")
N=${SHARDS:-3}
for ((s = 0; s < N; s++)); do
  S=(); for ((i = s; i < ${#J[@]}; i += N)); do S+=("${J[$i]}"); done
  nice -n 12 node run.js "$OUT" "${S[@]}" > "$OUT/log-$s.txt" 2>&1 &
done
wait
grep -h "ERROR\|PAGEERROR" "$OUT"/log-*.txt || true
echo "rendered ${#J[@]}"
