#!/bin/bash
# Renders the Atmosphere Engine (IDEAS.md "Megastructures", the owner's look A, "Rain Tower"): b/atmos.js (both teams)
# at every time of day, then composes them. Run from renderer/; then tools/install_atmos.py. About six minutes. (The
# plume, its night light, the rim lamps' blink and the rain are drawn in code: drawAtmosPlumes.)
set -e
cd "$(dirname "$0")/.."
OUT=${1:-out/atmos-game}
for tod in day morning evening night; do
  X=""; [ $tod != day ] && X="tod=$tod"
  J=(); N=""
  for t in 0 1; do T=$([ $t = 0 ] && echo '#38d4ff' || echo '#ff5a6e')
    J+=("atmos::$T:atmos@$t:$X"); N="$N atmos@$t"
  done
  nice -n 12 node run.js $OUT/$tod "${J[@]}"
  nice -n 12 python3 compose.py $OUT/$tod $N > /dev/null
done
echo done
