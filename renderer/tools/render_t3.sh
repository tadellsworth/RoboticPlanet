#!/bin/bash
# Renders Terraforming stage 3's art (ART_GUIDE Batch 37): the Seam Drill (b/seamdrill.js, concept A "Derrick"), the
# Seed Mast (b/seedmast.js, concept B "Charge Mast") and the Thermal Plant (b/thermal.js, concept A "Cooling Tower"),
# each for both teams at every time of day, with its 8-frame working loop (only the moving parts: part=work) at every
# time of day, and the Seam Drill without its top drive and string (part=base) under the loop; the Crystal Seedbed's
# tile at its five looks (b/seedbed.js g=0 prepared, 1 seeded, 2 sprouting, 3 harvestable, 4 starved) in three
# variants by day, and its night glow (g=0..3, from the night render's glow pass).
# Composed as the other buildings (compose.py) and plants (compose_any.py --b1 3.5 --b2 10 --glow 0.8).
# Run from renderer/; then tools/install_t3.py. About half an hour (three renderers at once).
set -e
cd "$(dirname "$0")/.."
OUT=${1:-out/t3}
P='#38d4ff'; Rv='#ff5a6e'
for tod in day morning evening night; do
  X=""; [ $tod != day ] && X="tod=$tod"
  A=(); B=(); C=(); N=""
  for spec in seamdrill:#d94dff:A seedmast:#f78fc0:B thermal:#c9ef8f:C; do
    s=${spec%%:*}; r=${spec#*:}; a=${r%%:*}; q=${r#*:}
    J=("$s:$a:$P:$s@0:$X" "$s:$a:$Rv:$s@1:$X"); N="$N $s@0 $s@1"
    [ $s = seamdrill ] && { J+=("$s:$a:$P:$s-base@0:part=base&$X" "$s:$a:$Rv:$s-base@1:part=base&$X"); N="$N $s-base@0 $s-base@1"; }
    for f in 0 1 2 3 4 5 6 7; do J+=("$s:$a::$s-work-$f:part=work&f=$f&$X"); N="$N $s-work-$f"; done
    case $q in A) A+=("${J[@]}");; B) B+=("${J[@]}");; C) C+=("${J[@]}");; esac
  done
  nice -n 12 node run.js $OUT/$tod "${A[@]}" &
  nice -n 12 node run.js $OUT/$tod "${B[@]}" &
  nice -n 12 node run.js $OUT/$tod "${C[@]}" &
  wait
  for n in $N; do nice -n 12 python3 compose.py $OUT/$tod $n > /dev/null; done
done
J=(); N=""
for g in 0 1 2 3 4; do for v in 1 2 3; do J+=("seedbed:::seedbed-$g-$v:g=$g&v=$v"); N="$N seedbed-$g-$v"; done; done
for g in 0 1 2 3; do J+=("seedbed:::seedbed-$g-night:g=$g&v=1&tod=night"); done
nice -n 12 node run.js $OUT/plants "${J[@]}"
nice -n 12 python3 compose_any.py $OUT/plants $N --b1 3.5 --b2 10 --glow 0.8 > /dev/null
echo done
