#!/bin/bash
# Renders the Mass Driver (b/massdriver.js c=driver, the owner's look A "Coil Ramp", two tiles long) pointing each of its four ways and
# the Catcher (c=catcher) with its arms open and closed, both teams, at every time of day, then composes them. Run from
# renderer/; then tools/install_massdriver.py. About eight minutes.
set -e
cd "$(dirname "$0")/.."
OUT=${1:-out/massdriver-game}
ONLY=${2:-}   # "driver": the Drivers alone
for tod in day morning evening night; do
  X=""; [ $tod != day ] && X="&tod=$tod"
  N=""
  for t in 0 1; do T=$([ $t = 0 ] && echo '#38d4ff' || echo '#ff5a6e')
    J=()
    for d in e s w n; do J+=("massdriver::$T:mdriver-$d@$t:c=driver&dir=$d$X"); N="$N mdriver-$d@$t"; done
    [ "$ONLY" = driver ] || { J+=("massdriver::$T:catcher@$t:c=catcher&arms=open$X" "massdriver::$T:catcher-closed@$t:c=catcher&arms=closed$X"); N="$N catcher@$t catcher-closed@$t"; }
    nice -n 12 node run.js $OUT/$tod "${J[@]}"
  done
  nice -n 12 python3 compose.py $OUT/$tod $N > /dev/null
done
echo done
