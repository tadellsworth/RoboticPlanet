#!/bin/bash
# Renders Terraforming stage 4's art (ART_GUIDE Batch 38), the owner's picks from the stage 4 concept canvas:
#  - the earthworks as per-tile pieces on the walls camera (walls/b/earthwork.js: Earth Bank, Fire Trench, Dragon's
#    Teeth), a post and n/e/s/w arms (and for the bank a hub, the stake alone, for a straight run) each at three looks (d=0 intact, 1 worn, 2 breached): the posts for both teams (the
#    team's colour is on the post only), the arms once. By day only: the game bakes them with the ground and grades them
#    with it; their night lights are the posts' glow pass.
#  - the Sluice (b/sluice.js, Radial Gates), for each side its water can be on (dir=n|s|e|w), shut and open, both teams,
#    at every time of day;
#  - the Sap Head (b/tunnel.js c=sap, Tunnel Bore A) and its four-frame work loop (f=0..3), both teams, every time of
#    day; its break-out, the Sap Exit (c=exit f=1), both teams, every time of day.
# Composed as the Walls (walls/compose_walls.py) and the buildings (compose.py). Run from renderer/; then
# tools/install_t4.py. About ten minutes.
set -e
cd "$(dirname "$0")/.."
OUT=${1:-out/t4}
P='%2338d4ff'; Rv='%23ff5a6e'
J=(); N=""
for k in bank trench teeth; do for d in 0 1 2; do
  for p in n e s w; do J+=("earthwork:ew-$k-$p-$d:k=$k&piece=$p&d=$d"); N="$N ew-$k-$p-$d"; done
  J+=("earthwork:ew-$k-post-$d@0:k=$k&piece=post&d=$d&team=$P" "earthwork:ew-$k-post-$d@1:k=$k&piece=post&d=$d&team=$Rv"); N="$N ew-$k-post-$d@0 ew-$k-post-$d@1"
  [ $k = bank ] && for t in 0 1; do T=$P; [ $t = 1 ] && T=$Rv; for a in ew ns; do J+=("earthwork:ew-$k-hub-$a-$d@$t:k=$k&piece=hub&d=$d&team=$T"); N="$N ew-$k-hub-$a-$d@$t"; done; done
done; done
nice -n 12 node walls/run.js $OUT/ew "${J[@]}"
python3 walls/compose_walls.py $OUT/ew $N > /dev/null
SA='#b8ffe8'; TA='#ffa38c'; PT='#38d4ff'; RT='#ff5a6e'
for tod in day morning evening night; do
  X=""; [ $tod != day ] && X="&tod=$tod"
  A=(); B=(); M=""
  for t in 0 1; do T=$PT; [ $t = 1 ] && T=$RT
    for d in n s e w; do A+=("sluice:$SA:$T:sluice-$d@$t:dir=$d&f=0$X" "sluice:$SA:$T:sluice-$d-open@$t:dir=$d&f=3$X"); M="$M sluice-$d@$t sluice-$d-open@$t"; done
    for f in 0 1 2 3; do B+=("tunnel:$TA:$T:saphead-f$f@$t:c=sap&f=$f$X"); M="$M saphead-f$f@$t"; done
    B+=("tunnel:$TA:$T:sapexit@$t:c=exit&f=1$X"); M="$M sapexit@$t"
  done
  nice -n 12 node run.js $OUT/$tod "${A[@]}" &
  nice -n 12 node run.js $OUT/$tod "${B[@]}" &
  wait
  for n in $M; do nice -n 12 python3 compose.py $OUT/$tod $n > /dev/null; done
done
echo done
