#!/bin/sh
# Renders every piece of the Maglev design sheet (b/maglev.js) into out/maglev and composes them. Run from renderer/.
# Terminals, pylons and the cut pylon compose like buildings (compose.py); pods and deck tiles like the train cars
# (compose_any.py --b1 3.5 --b2 11, 512 -> 256); the presentation scenes with compose_any.py (1600 x 1000 -> 800 x 500).
set -e
OUT=${1:-out/maglev}
J=""
for v in a b c; do
  for t in 0 1; do
    T=$([ $t = 0 ] && echo '#38d4ff' || echo '#ff5a6e')
    for n in "" "-n"; do
      X=$([ -z "$n" ] && echo "" || echo "&tod=night")
      J="$J maglev::$T:t$v$t$n:v=$v$X maglev::$T:p$v$t$n:v=$v&c=pylon$X maglev::$T:pod$v$t$n:v=$v&c=pod$X"
      [ $t = 0 ] && J="$J maglev::$T:pod$v${t}e$n:v=$v&c=pod&load=0$X maglev::$T:d$v$t$n:v=$v&c=deck$X maglev::$T:scene-$v$n:v=$v&c=scene$X"
    done
  done
done
J="$J maglev::#38d4ff:pa0-cut:v=a&c=pylon&state=cut maglev::#38d4ff:pa0-cut-n:v=a&c=pylon&state=cut&tod=night"
# six jobs per browser
set -- $J
while [ $# -gt 0 ]; do
  B=""; k=0
  while [ $# -gt 0 ] && [ $k -lt 6 ]; do B="$B $1"; shift; k=$((k+1)); done
  eval nice -n 12 node run.js "$OUT" $(for j in $B; do printf "'%s' " "$j"; done)
done
B=""; A=""; S=""
for v in a b c; do for t in 0 1; do for n in "" "-n"; do B="$B t$v$t$n p$v$t$n"; A="$A pod$v$t$n"; done; done; A="$A pod${v}0e pod${v}0e-n d${v}0 d${v}0-n"; S="$S scene-$v scene-$v-n"; done
nice -n 12 python3 compose.py "$OUT" $B pa0-cut pa0-cut-n > /dev/null
nice -n 12 python3 compose_any.py "$OUT" $A --b1 3.5 --b2 11
nice -n 12 python3 compose_any.py "$OUT" $S
echo done
