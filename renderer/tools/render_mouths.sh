#!/bin/bash
# Hollowgate's cave mouths: the game's layers for one concept (b/cavemouth.js), both faces, in parallel.
# usage: tools/render_mouths.sh <outDir> [concept]   then: python3 tools/install_mouths.py <outDir> <concept> ../art
cd "$(dirname "$0")/.."
OUT=${1:-out/mouths}; c=${2:-arch}
A=(); B=()
for f in s n; do
  A+=("cavemouth:::$c-$f-floor:c=$c&face=$f&part=floor&nokey=1" "cavemouth:::$c-$f-rock:c=$c&face=$f&part=rock&nokey=1")
  B+=("cavemouth:::$c-$f-lip:c=$c&face=$f&part=lip&nokey=1" "cavemouth:::$c-$f-key:c=$c&face=$f&part=key" "cavemouth:::$c-$f-glow:c=$c&face=$f&part=all&nokey=1&tod=night")
done
node run.js "$OUT" "${A[@]}" &
node run.js "$OUT" "${B[@]}" &
wait
