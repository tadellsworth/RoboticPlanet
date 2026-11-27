#!/bin/bash
# Renders the Leveller (b/leveller.js, Bucket Wheel; ART_GUIDE Batch 42) with its boom slewed round to the other three
# quarters (hd=1: north-north-east, 2: east-south-east, 3: south-south-west; hd=0, the west-north-west of
# render_t5.sh, is the plain leveller art), so the game can turn it toward the tile it works:
#  - each without its moving parts (both teams, every time of day);
#  - the moving parts alone, 4 frames (part=work), by day (the game grades them for the time of day).
# Composed by compose.py. Run from renderer/; then tools/install_t5_slew.py. About eight minutes.
set -e
cd "$(dirname "$0")/.."
OUT=${1:-out/t5slew}
LA='#d8b18c'; PT='#38d4ff'; RT='#ff5a6e'
for tod in day morning evening night; do
  X=""; [ $tod != day ] && X="tod=$tod&"
  A=(); B=(); N=""
  for h in 1 2 3; do
    A+=("leveller:$LA:$PT:leveller-h$h@0:${X}hd=$h"); B+=("leveller:$LA:$RT:leveller-h$h@1:${X}hd=$h"); N="$N leveller-h$h@0 leveller-h$h@1"
  done
  nice -n 12 node run.js $OUT/$tod "${A[@]}" &
  nice -n 12 node run.js $OUT/$tod "${B[@]}" &
  wait
  for n in $N; do nice -n 12 python3 compose.py $OUT/$tod $n > /dev/null; done
done
A=(); B=(); N=""
for h in 1 2 3; do
  for f in 0 1; do A+=("leveller:$LA:$PT:leveller-h$h-work-$f:part=work&f=$f&hd=$h"); N="$N leveller-h$h-work-$f"; done
  for f in 2 3; do B+=("leveller:$LA:$PT:leveller-h$h-work-$f:part=work&f=$f&hd=$h"); N="$N leveller-h$h-work-$f"; done
done
nice -n 12 node run.js $OUT/work "${A[@]}" &
nice -n 12 node run.js $OUT/work "${B[@]}" &
wait
for n in $N; do nice -n 12 python3 compose.py $OUT/work $n > /dev/null; done
echo done
