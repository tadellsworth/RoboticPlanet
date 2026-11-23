#!/bin/bash
# Renders the Walking Factory (b/walker.js, the owner's look A "Foundry Crawler") for the game: straight down, facing
# right, 10 tiles across (W=20) at 2560 px, centred on its deck; six walk frames and the dormant rest frame, at every
# time of day, with the holder's colour dark (part=base); and the holder's parts alone in white (part=team), once, by
# day (they sit on the hull, which is the same in every frame; the game tints them, at every time of day). Then composes them. Run from renderer/; then tools/install_walker.py.
# About three minutes on four cores.
set -e
cd "$(dirname "$0")/.."
OUT=${1:-out/walker-game}
Q='view=top&W=20&n=6&size=2560'
run_tod() {
  local tod=$1 X="" J=() N=""
  [ $tod != day ] && X="&tod=$tod"
  for k in 0 1 2 3 4 5; do J+=("walker::#38d4ff:walker-f$k:$Q&f=$k&part=base$X"); N="$N walker-f$k"; done
  J+=("walker::#38d4ff:walker-rest:$Q&rest=1&dim=1&part=base$X"); N="$N walker-rest"
  if [ $tod = day ]; then
    J+=("walker::#38d4ff:walker-team:$Q&f=0&part=team"); N="$N walker-team"
  fi
  nice -n 12 node run.js $OUT/$tod "${J[@]}"
  nice -n 12 python3 compose_any.py $OUT/$tod $N --b1 7.5 --b2 20 > /dev/null
}
for tod in day morning evening night; do run_tod $tod & done
wait
echo done
