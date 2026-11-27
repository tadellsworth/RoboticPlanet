#!/bin/bash
# Renders the installed space art (space expansion, phase 1: the owner's picks, Nov 2026), both teams, at every time of
# day, then finishes each with post/space_post.py (bloom, the thrusters' plumes; raw passes deleted as it goes). Run from
# renderer/; then tools/install_space.py writes the game's files. Four renders at a time.
#   ships.js      the Shuttle (c=shuttle_a, Frame Tug), the Dropship (drop_a, Clamshell) and the Gunship (gun_a, Lancet), straight
#                 down, nose east: flying (thrusters lit) and parked (gear down); the Dropship's stern ramp half and all the
#                 way down (its own robots left out: the game's walk out)
#   launchpad.js  the Launch Pad (v=a, Cradle Ring, accent pad lilac), empty: the game parks its craft on it
#   pdturret.js   the Point-Defence Turret (v=a, Twin Rotary, accent orchid), its guns turned to 8 headings
#   drift.js      the drifting asteroids, plain, Ore- and Crystal-bearing, and the two towed in their harness
#   module.js     the derelict modules (Solar Array, Docking Ring, Salvage Hulk): derelict (no team) and captured (each team)
set -e
cd "$(dirname "$0")/.."
TC=('#38d4ff' '#ff5a6e'); PAD='#d9c8ff'; PD='#ffb8ff'; N=${N:-4}
for tod in day morning evening night; do
  O=out/space/$tod; mkdir -p $O; X=""; [ $tod != day ] && X="&tod=$tod"
  J=()
  for t in 0 1; do T=${TC[$t]}
    for s in shuttle:shuttle_a dropship:drop_a gunship:gun_a; do k=${s%%:*}; c=${s##*:}
      J+=("ships::$T:$k@$t:c=$c&view=top&thr=1&gear=0$X" "ships::$T:$k-park@$t:c=$c&view=top&thr=0&gear=1$X")
    done
    J+=("ships::$T:dropship-ramp1@$t:c=drop_a&view=top&thr=0&gear=1&ramp=0.5&bots=0$X" "ships::$T:dropship-ramp2@$t:c=drop_a&view=top&thr=0&gear=1&ramp=1&bots=0$X")
    J+=("launchpad:$PAD:$T:launchpad@$t:v=a$X")
    for k in 0 1 2 3 4 5 6 7; do J+=("pdturret:$PD:$T:pdturret-$k@$t:v=a&rot=$((-k * 45))&el=30$X"); done
    for c in solar dock hulk; do J+=("module::$T:mod-$c@$t:c=$c&view=top&cap=1$X"); done
  done
  for c in solar dock hulk; do J+=("module::${TC[0]}:mod-$c:c=$c&view=top&cap=0$X"); done
  for c in plain ore crystal; do J+=("drift::${TC[0]}:rock-$c:c=$c&view=top$X"); done
  for c in ore crystal; do J+=("drift::${TC[0]}:rock-$c-tow:c=$c&view=top&tow=1&W=16$X"); done
  for k in $(seq 0 $((N - 1))); do A=(); i=0; for j in "${J[@]}"; do [ $((i % N)) = $k ] && A+=("$j"); i=$((i + 1)); done; node run.js $O "${A[@]}" > $O/log-$k.txt 2>&1 & done; wait
  for g in $O/*.geom.json; do n=$(basename $g .geom.json); a=()
    [ $tod = night ] && a+=(--night)
    case $n in *-park*|*ramp*|launchpad*|pdturret*|mod-*|rock-*) a+=(--plume 0);; esac
    python3 post/space_post.py $O $n "${a[@]}" && rm -f $O/$n.beauty.png $O/$n.glow.png
  done
done
echo renders done
