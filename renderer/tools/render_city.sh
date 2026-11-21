#!/bin/bash
# Renders Arrival City (IDEAS.md "Megastructures", the owner's look A, "Four Blocks round a Square"): b/city.js whole (both teams)
# and battle-damaged (state=down, both teams) at every time of day, and the lights the game switches on at dusk one tier
# after another (part=lit&tier=0..3: their glow passes, at night), the LED strips (tier 4) and what still burns on the
# wreck (tier 5, state=down), then composes them. Run from renderer/; then
# tools/install_city.py. About ten minutes.
set -e
cd "$(dirname "$0")/.."
OUT=${1:-out/city-game}
for tod in day morning evening night; do
  X=""; [ $tod != day ] && X="&tod=$tod"
  J=(); N=""
  for t in 0 1; do T=$([ $t = 0 ] && echo '#38d4ff' || echo '#ff5a6e')
    J+=("city::$T:city@$t:$X" "city::$T:city-down@$t:state=down$X"); N="$N city@$t city-down@$t"
  done
  nice -n 12 node run.js $OUT/$tod "${J[@]}"
  nice -n 12 python3 compose.py $OUT/$tod $N > /dev/null
done
J=(); for k in 0 1 2 3; do J+=("city:::city-lit-$k:part=lit&tier=$k&tod=night"); done
J+=("city:::city-led:part=lit&tier=4&tod=night" "city:::city-lit-down:part=lit&tier=5&state=down&tod=night")
nice -n 12 node run.js $OUT/lit "${J[@]}"
echo done
