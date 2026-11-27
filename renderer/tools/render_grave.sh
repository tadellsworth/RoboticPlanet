#!/bin/bash
# Renders The Graveyard's art (space expansion, phase 2: the owner's design, Nov 2026), both teams, at every time of day,
# then finishes each with post/space_post.py (bloom from the glow pass; raw passes deleted as it goes). Run from renderer/;
# then tools/install_grave.py writes the game's files. Four renders at a time.
#   grave.js c=plate    the hulks' deck plating, 4 by 4 tiles straight down: v=0 the dead hulls, v=1 torn up, v=2 the
#                       Arbiter's Accord white (day only: the map's ground is baked, and the game's light grades it)
#   grave.js c=salvage  the towable wreckage (v=0 an engine bell on a hull plate, v=1 plates round a cargo pod)
#   grave.js c=junk     a debris lane's shard cloud
#   grave.js c=arb      the Arbiter's relay: derelict (no team) and captured (each team)
set -e
cd "$(dirname "$0")/.."
TC=('#38d4ff' '#ff5a6e'); N=${N:-4}
for tod in day morning evening night; do
  O=out/grave/$tod; mkdir -p $O; X=""; [ $tod != day ] && X="&tod=$tod"
  J=()
  if [ $tod = day ]; then for v in 0 1 2; do J+=("grave::${TC[0]}:plate-$v:c=plate&v=$v"); done; fi
  for v in 0 1; do J+=("grave::${TC[0]}:salvage-$v:c=salvage&v=$v$X"); done
  J+=("grave::${TC[0]}:junk:c=junk$X" "grave::${TC[0]}:arb:c=arb&cap=0$X")
  for t in 0 1; do J+=("grave::${TC[$t]}:arb@$t:c=arb&cap=1$X"); done
  for k in $(seq 0 $((N - 1))); do A=(); i=0; for j in "${J[@]}"; do [ $((i % N)) = $k ] && A+=("$j"); i=$((i + 1)); done; [ ${#A[@]} -gt 0 ] && node run.js $O "${A[@]}" > $O/log-$k.txt 2>&1 & done; wait
  for g in $O/*.geom.json; do n=$(basename $g .geom.json); a=(--plume 0)
    [ $tod = night ] && a+=(--night)
    python3 post/space_post.py $O $n "${a[@]}" && rm -f $O/$n.beauty.png $O/$n.glow.png
  done
done
echo renders done
