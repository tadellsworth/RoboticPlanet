#!/bin/bash
# The Harrow's game art (ART_GUIDE.md, Batch 31): every frame the game draws, at every time of day, rendered at 1024 and
# composed to 512 (murmur_behemoth.js c=harrow&game=1, hungry: charge=0.3, the game adds its light with the glow images).
# Eight walking frames (f=0, 0.5 .. 3.5: half a step each), the slam's wind-up and blow, the bite, the flinch, the dying
# (staggering, toppling) and the dead, coming up, and its two marks on the ground.
# usage (from renderer/): tools/render_harrow.sh [out/harrow]   then: python3 tools/install_harrow.py out/harrow <game>/art
out=${1:-out/harrow}
J='murmur_behemoth:::'
keys=()
for k in 0 1 2 3 4 5 6 7; do keys+=("harrow-f$k:pose=walk&f=$(python3 -c "print($k/2)")"); done
keys+=(harrow-slam-f0:pose=rear harrow-slam-f1:pose=slam harrow-bite-f0:pose=bite harrow-hurt-f0:pose=hurt
  harrow-die-f0:pose=die\&f=0 harrow-die-f1:pose=die\&f=1 harrow-fall-f0:pose=fall
  harrow-up-f0:pose=emerge\&f=0 harrow-up-f1:pose=emerge\&f=1 harrow-up-f2:pose=emerge\&f=2
  harrow-crater:pose=crater harrow-cracks:pose=cracks)
run() { # one time of day, all keys
  local tod=$1 suf=$2 jobs=()
  for k in "${keys[@]}"; do n=${k%%:*}; q=${k#*:}; jobs+=("$J$n$suf:c=harrow&$q&game=1&px=1024&charge=0.3${tod:+&tod=$tod}"); done
  node run.js "$out" "${jobs[@]}"
}
run '' '' & run morning --morning & run evening --evening & run night --night & wait
names=$(ls "$out"/*.beauty.png | xargs -n1 basename | sed 's/.beauty.png//')
python3 compose_any.py "$out" $names --b1 6.4 --b2 20 --glow 1.4
