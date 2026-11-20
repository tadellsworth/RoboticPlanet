#!/bin/bash
# Renders the Orbital Lift (IDEAS.md "Megastructures", the owner's look A, "Beacon Cable"): b/lift.js, the anchor pad,
# whole and below 30% (state=down), for both teams at every time of day, then composes them. Run from renderer/; then
# tools/install_lift.py. About ten minutes. (The cable above its foot, the climbers and the fall are drawn in code.)
set -e
cd "$(dirname "$0")/.."
OUT=${1:-out/lift-game}
for tod in day morning evening night; do
  X=""; [ $tod != day ] && X="&tod=$tod"
  J=(); N=""
  for t in 0 1; do T=$([ $t = 0 ] && echo '#38d4ff' || echo '#ff5a6e')
    J+=("lift::$T:lift@$t:$X" "lift::$T:lift-down@$t:state=down$X"); N="$N lift@$t lift-down@$t"
  done
  nice -n 12 node run.js $OUT/$tod "${J[@]}"
  nice -n 12 python3 compose.py $OUT/$tod $N > /dev/null
done
echo done
