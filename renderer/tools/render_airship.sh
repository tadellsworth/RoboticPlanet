#!/bin/bash
# Renders the installed Airship (b/airship.js v=c, the armoured blimp) and Mooring Mast (b/mast.js v=c, the armoured
# pylon), both teams, at every time of day, then composes them. Run from renderer/; then tools/install_airship.py.
set -e
cd "$(dirname "$0")/.."
for tod in day morning evening night; do
  X=""; [ $tod != day ] && X="&tod=$tod"
  for t in 0 1; do T=$([ $t = 0 ] && echo '#38d4ff' || echo '#ff5a6e')
    node run.js out/airship/$tod "airship::$T:airship@$t:v=c$X" "mast::$T:mast@$t:v=c$X"
  done
  python3 compose_any.py out/airship/$tod airship@0 airship@1 --b1 5 --b2 15
  python3 compose.py out/airship/$tod mast@0 mast@1
done
