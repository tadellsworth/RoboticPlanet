#!/bin/bash
# Renders the Great Uplink (IDEAS.md "Megastructures", the owner's look A, "Dish Array"): b/gup.js, the dish array,
# whole and below 30% (state=down), for both teams at every time of day, then composes them. Run from renderer/; then
# tools/install_gup.py. About ten minutes. (The transmission: the dish glow, the beam and the jammed flicker are drawn in code.)
set -e
cd "$(dirname "$0")/.."
OUT=${1:-out/gup-game}
for tod in day morning evening night; do
  X=""; [ $tod != day ] && X="&tod=$tod"
  J=(); N=""
  for t in 0 1; do T=$([ $t = 0 ] && echo '#38d4ff' || echo '#ff5a6e')
    J+=("gup::$T:gup@$t:$X" "gup::$T:gup-down@$t:state=down$X"); N="$N gup@$t gup-down@$t"
  done
  nice -n 12 node run.js $OUT/$tod "${J[@]}"
  nice -n 12 python3 compose.py $OUT/$tod $N > /dev/null
done
echo done
