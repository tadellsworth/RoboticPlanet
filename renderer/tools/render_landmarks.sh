#!/bin/bash
# Renders the atlas landmarks (b/landmark.js): the standing pieces at every time of day, the flat ones (the town's ground,
# Glass Lake, Silent Crater) by day only (the game grades them with the ground). Run from renderer/; then
# tools/install_landmarks.py. About ten minutes. Pass piece names to render only those (e.g. `spire falls`).
set -e
cd "$(dirname "$0")/.."
OUT=out/landmarks
STAND="hull:c=hull spire:c=spire pillar-1:c=pillar&v=1 pillar-2:c=pillar&v=2 pillar-3:c=pillar&v=3 falls:c=falls geyser:c=geyser house-1:c=house&v=1 house-2:c=house&v=2 house-3:c=house&v=3 sign:c=sign shaft:c=shaft wreck-kestrel:c=wreck&w=kestrel wreck-survey:c=wreck&w=survey wreck-halvard:c=wreck&w=halvard"
FLAT="town:c=town town-s:c=town&s=1 lake:c=lake crater:c=crater"
want() { [ $# -eq 0 ] && return 0; for w in "${ONLY[@]}"; do [ "$w" = "$1" ] && return 0; done; return 1; }
ONLY=("$@")
for tod in day morning evening night; do
  X=""; [ $tod != day ] && X="&tod=$tod"
  J=()
  for p in $STAND; do n=${p%%:*}; q=${p#*:}; if [ ${#ONLY[@]} -eq 0 ] || want "$n"; then J+=("landmark:::$n:$q$X"); fi; done
  if [ $tod = day ]; then for p in $FLAT; do n=${p%%:*}; q=${p#*:}; if [ ${#ONLY[@]} -eq 0 ] || want "$n"; then J+=("landmark:::$n:$q"); fi; done; fi
  [ ${#J[@]} -gt 0 ] && nice -n 12 node run.js $OUT/$tod "${J[@]}"
done
echo done
