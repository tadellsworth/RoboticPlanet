#!/bin/bash
# Renders the installed Maglev line (b/maglev.js v=a, Accord Phase 2): the Terminal, the pylon and the pylon shot down
# (building camera), the pod loaded and empty and one tile of guideway (straight down), both teams, at every time of
# day, then composes them. Run from renderer/; then tools/install_maglev.py. About ten minutes.
set -e
cd "$(dirname "$0")/.."
OUT=${1:-out/maglev-game}
for tod in day morning evening night; do
  X=""; [ $tod != day ] && X="&tod=$tod"
  for t in 0 1; do T=$([ $t = 0 ] && echo '#38d4ff' || echo '#ff5a6e')
    nice -n 12 node run.js $OUT/$tod "maglev::$T:magterm@$t:v=a$X" "maglev::$T:magpylon@$t:v=a&c=pylon$X" "maglev::$T:magpylon-cut@$t:v=a&c=pylon&state=cut$X" \
      "maglev::$T:magpod@$t:v=a&c=pod$X" "maglev::$T:magpod-empty@$t:v=a&c=pod&load=0$X" "maglev::$T:magdeck@$t:v=a&c=deck$X"
  done
  nice -n 12 python3 compose.py $OUT/$tod magterm@0 magterm@1 magpylon@0 magpylon@1 magpylon-cut@0 magpylon-cut@1 > /dev/null
  nice -n 12 python3 compose_any.py $OUT/$tod magpod@0 magpod@1 magpod-empty@0 magpod-empty@1 magdeck@0 magdeck@1 --b1 3.5 --b2 11
done
echo done
