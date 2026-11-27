#!/bin/bash
# Renders Terraforming stage 5's art (ART_GUIDE Batch 42), the owner's picks from the stage 5 canvas: the Reservoir
# (b/reservoir.js, Dew Towers) and the Leveller (b/leveller.js, Bucket Wheel), both 3 x 3 megastructures framed as the
# Deep Core (b/t5kit.js):
#  - each without its moving parts (both teams, every time of day): the game draws its work frame over it;
#  - the moving parts alone, 4 frames (part=work: the Dew Towers' fans, mist, ripples and spill; the Bucket Wheel's
#    wheel, belts' load, track pads and dust), by day and for every team (the game grades them for the time of day);
#  - the build stages site1 (footings, a crawler crane) and site2 (rising in scaffolding), both teams, by day.
# Composed by compose.py. Run from renderer/; then tools/install_t5.py. About twelve minutes.
set -e
cd "$(dirname "$0")/.."
OUT=${1:-out/t5}
RA='#0ad5d8'; LA='#d8b18c'; PT='#38d4ff'; RT='#ff5a6e'
for tod in day morning evening night; do
  X=""; [ $tod != day ] && X="tod=$tod"
  A=(); B=(); N=""
  for t in 0 1; do T=$PT; [ $t = 1 ] && T=$RT
    A+=("reservoir:$RA:$T:reservoir@$t:$X"); B+=("leveller:$LA:$T:leveller@$t:$X"); N="$N reservoir@$t leveller@$t"
  done
  nice -n 12 node run.js $OUT/$tod "${A[@]}" &
  nice -n 12 node run.js $OUT/$tod "${B[@]}" &
  wait
  for n in $N; do nice -n 12 python3 compose.py $OUT/$tod $n > /dev/null; done
done
A=(); B=(); N=""
for f in 0 1 2 3; do
  A+=("reservoir:$RA:$PT:reservoir-work-$f:part=work&f=$f"); B+=("leveller:$LA:$PT:leveller-work-$f:part=work&f=$f"); N="$N reservoir-work-$f leveller-work-$f"
done
for t in 0 1; do T=$PT; [ $t = 1 ] && T=$RT
  for k in 1 2; do A+=("reservoir:$RA:$T:reservoir-site$k@$t:site=$k"); B+=("leveller:$LA:$T:leveller-site$k@$t:site=$k"); N="$N reservoir-site$k@$t leveller-site$k@$t"; done
done
nice -n 12 node run.js $OUT/work "${A[@]}" &
nice -n 12 node run.js $OUT/work "${B[@]}" &
wait
for n in $N; do nice -n 12 python3 compose.py $OUT/work $n > /dev/null; done
echo done
