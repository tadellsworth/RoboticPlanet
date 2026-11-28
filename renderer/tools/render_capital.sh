#!/bin/bash
# Renders the capital ships (space expansion, phase 3: The Void Fleet), both teams, at every time of day, then finishes each
# with post/space_post.py (bloom; no baked plumes: the game draws the engines' glow in code; raw passes deleted as it goes).
# Run from renderer/; then tools/install_capital.py writes the game's files. Four renders at a time.
#   capital.js  c=tender  the Flagship, a Carrier's tender (the canvas's "Tender"), straight down, nose east: flagship@T, and
#                         flagship-launch@T with its launch rails lit and a Gunship going up off one
#               c=line    the Line Ship (the canvas's "Line"): line@T (turrets trained ahead), line-fireL@T and line-fireR@T
#                         (trained to port or starboard, their muzzles flaring: a broadside)
set -e
cd "$(dirname "$0")/.."
TC=('#38d4ff' '#ff5a6e'); N=${N:-4}
for tod in day morning evening night; do
  O=out/capital/$tod; mkdir -p $O; X=""; [ $tod != day ] && X="&tod=$tod"
  J=()
  for t in 0 1; do T=${TC[$t]}
    J+=("capital::$T:flagship@$t:c=tender&view=top$X" "capital::$T:flagship-launch@$t:c=tender&view=top&launch=1$X")
    J+=("capital::$T:line@$t:c=line&view=top$X" "capital::$T:line-fireL@$t:c=line&view=top&rot=-90&fire=1$X" "capital::$T:line-fireR@$t:c=line&view=top&rot=90&fire=1$X")
  done
  for k in $(seq 0 $((N - 1))); do A=(); i=0; for j in "${J[@]}"; do [ $((i % N)) = $k ] && A+=("$j"); i=$((i + 1)); done; node run.js $O "${A[@]}" > $O/log-$k.txt 2>&1 & done; wait
  for g in $O/*.geom.json; do n=$(basename $g .geom.json); a=(--plume 0)
    [ $tod = night ] && a+=(--night)
    python3 post/space_post.py $O $n "${a[@]}" && rm -f $O/$n.beauty.png $O/$n.glow.png
  done
done
echo renders done
