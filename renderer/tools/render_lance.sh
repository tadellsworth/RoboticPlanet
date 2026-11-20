#!/bin/bash
# Renders the megastructures (IDEAS.md "Megastructures", the owner's look A for both): the Lance of Corvane's gun pit
# (b/lance.js part=base, both teams) and its gun on the turntable turned each of 16 ways (part=head, no team colour), and
# the Shield Dome's emitter (b/dome.js, both teams), at every time of day, then composes them. Run from renderer/; then
# tools/install_lance.py. About half an hour.
set -e
cd "$(dirname "$0")/.."
OUT=${1:-out/lance-game}
for tod in day morning evening night; do
  X=""; [ $tod != day ] && X="&tod=$tod"
  N=""
  J=()
  for t in 0 1; do T=$([ $t = 0 ] && echo '#38d4ff' || echo '#ff5a6e')
    J+=("lance::$T:lance@$t:part=base$X" "dome::$T:dome@$t:$X"); N="$N lance@$t dome@$t"
  done
  for k in $(seq 0 15); do J+=("lance:::lance-head-$k:part=head&rot=$k&n=16$X"); N="$N lance-head-$k"; done
  nice -n 12 node run.js $OUT/$tod "${J[@]}"
  nice -n 12 python3 compose.py $OUT/$tod $N > /dev/null
done
echo done
