#!/bin/bash
# Renders the Deep Core (IDEAS.md "Megastructures", the owner's look A, "Headframe"): b/deepcore.js without its wheels
# (both teams) at every time of day, and the two winding wheels turning (part=work, 8 frames through 60 degrees: day
# only, not team-coloured; the game grades them for the time of day), then composes them. Run from renderer/; then
# tools/install_deepcore.py. About eight minutes. (The violet glow in the shaft and the gauge's lamps are drawn in code.)
set -e
cd "$(dirname "$0")/.."
OUT=${1:-out/deepcore-game}
for tod in day morning evening night; do
  X=""; [ $tod != day ] && X="tod=$tod"
  J=(); N=""
  for t in 0 1; do T=$([ $t = 0 ] && echo '#38d4ff' || echo '#ff5a6e')
    J+=("deepcore::$T:deepcore@$t:$X"); N="$N deepcore@$t"
  done
  nice -n 12 node run.js $OUT/$tod "${J[@]}"
  nice -n 12 python3 compose.py $OUT/$tod $N > /dev/null
done
J=(); N=""; for f in 0 1 2 3 4 5 6 7; do J+=("deepcore::#38d4ff:deepcore-work-$f:part=work&f=$f"); N="$N deepcore-work-$f"; done
nice -n 12 node run.js $OUT/work "${J[@]}"
nice -n 12 python3 compose.py $OUT/work $N > /dev/null
echo done
