#!/bin/bash
# The Harrow's game art (ART_GUIDE.md, Batch 31): every frame the game draws, at every time of day, rendered at 1280 and
# composed to 640 (murmur_behemoth.js c=harrow&game=1, hungry: charge=0.3, the game adds its light with the glow images).
# usage (from renderer/): tools/render_harrow.sh [out/harrow]   then: python3 tools/install_harrow.py out/harrow <game>/art
out=${1:-out/harrow}
J='murmur_behemoth:::'
keys=(harrow-f0:pose=walk\&f=0 harrow-f1:pose=walk\&f=1 harrow-f2:pose=walk\&f=2 harrow-f3:pose=walk\&f=3
  harrow-slam-f0:pose=rear harrow-slam-f1:pose=slam harrow-hurt-f0:pose=hurt harrow-fall-f0:pose=fall
  harrow-up-f0:pose=emerge\&f=0 harrow-up-f1:pose=emerge\&f=1 harrow-up-f2:pose=emerge\&f=2
  harrow-crater:pose=crater harrow-cracks:pose=cracks)
run() { # one time of day, all keys
  local tod=$1 suf=$2 jobs=()
  for k in "${keys[@]}"; do n=${k%%:*}; q=${k#*:}; jobs+=("$J$n$suf:c=harrow&$q&game=1&px=1280&charge=0.3${tod:+&tod=$tod}"); done
  node run.js "$out" "${jobs[@]}"
}
run '' '' & run morning --morning & run evening --evening & run night --night & wait
names=$(ls "$out"/*.beauty.png | xargs -n1 basename | sed 's/.beauty.png//')
python3 compose_any.py "$out" $names --b1 8 --b2 25 --glow 1.4
