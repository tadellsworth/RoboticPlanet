#!/bin/bash
# Renders Terraforming stage 2's art (ART_GUIDE Batch 36): the Composter (b/composter.js, concept A "Drum"), the Tree
# Nursery (b/nursery.js, concept C "Pivot") and the Water Pump (b/wpump.js, concept B "Screw Lift"), each for both
# teams at every time of day, with its 8-frame working loop (only the moving parts: part=work) at every time of day,
# and the Nursery without its boom (part=base) under the loop; the groves at their three stages in four 1-tile variants
# (b/grove.js) and the sprinkler head (b/sprinkler.js), day only (the game grades them with the ground).
# Composed as the other buildings (compose.py) and plants (compose_any.py --b1 3.5 --b2 10 --glow 1).
# Run from renderer/; then tools/install_t2.py. About half an hour.
set -e
cd "$(dirname "$0")/.."
OUT=${1:-out/t2}
P='#38d4ff'; Rv='#ff5a6e'
for tod in day morning evening night; do
  X=""; [ $tod != day ] && X="tod=$tod"
  J=(); N=""
  for spec in composter:#d6a04a nursery:#8cff6a wpump:#3aa0ff; do
    s=${spec%%:*}; a=${spec#*:}
    J+=("$s:$a:$P:$s@0:$X" "$s:$a:$Rv:$s@1:$X"); N="$N $s@0 $s@1"
    [ $s = nursery ] && { J+=("$s:$a:$P:$s-base@0:part=base&$X" "$s:$a:$Rv:$s-base@1:part=base&$X"); N="$N $s-base@0 $s-base@1"; }
    for f in 0 1 2 3 4 5 6 7; do J+=("$s:$a::$s-work-$f:part=work&f=$f&$X"); N="$N $s-work-$f"; done
  done
  nice -n 12 node run.js $OUT/$tod "${J[@]}"
  for n in $N; do nice -n 12 python3 compose.py $OUT/$tod $n > /dev/null; done
done
J=(); N=""
for g in 1 2 3; do for v in 1 2 3 4; do J+=("grove:::grove-$g-$v:g=$g&v=$v"); N="$N grove-$g-$v"; done; done
J+=("sprinkler:::sprinkler"); N="$N sprinkler"
nice -n 12 node run.js $OUT/plants "${J[@]}"
nice -n 12 python3 compose_any.py $OUT/plants $N --b1 3.5 --b2 10 --glow 1 > /dev/null
echo done
