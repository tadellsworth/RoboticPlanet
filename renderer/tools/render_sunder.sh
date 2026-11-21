#!/bin/bash
# Renders the Sundering Ray (IDEAS.md "Megastructures", the owner's look B, "Piston Battery"): b/sunder.js, the pad and
# block with its bore tower (part=base) and its two construction stages (part=site&stage=1|2) for both teams, and its
# moving parts alone with no team colour: each great ram at three heights (part=ram&side=-1|1&e=0|1|2) and each of the
# six ram plates seated and raised (part=plate&k=0..5&e=0|1), at every time of day (one time per argument, or all),
# then composes them. Run from renderer/; then tools/install_sunder.py. About 12 minutes a time of day.
set -e
cd "$(dirname "$0")/.."
OUT=out/sunder-game
TODS=${@:-day morning evening night}
for tod in $TODS; do
  X=""; [ $tod != day ] && X="&tod=$tod"
  J=(); N=""
  for t in 0 1; do T=$([ $t = 0 ] && echo '#38d4ff' || echo '#ff5a6e')
    J+=("sunder::$T:sunder@$t:part=base$X" "sunder::$T:sunder-site1@$t:part=site&stage=1$X" "sunder::$T:sunder-site2@$t:part=site&stage=2$X"); N="$N sunder@$t sunder-site1@$t sunder-site2@$t"
  done
  for s in -1 1; do for e in 0 1 2; do n="sunder-ram-$([ $s = -1 ] && echo w || echo e)-$e"; J+=("sunder:::$n:part=ram&side=$s&e=$e$X"); N="$N $n"; done; done
  for k in 0 1 2 3 4 5; do for e in 0 1; do n="sunder-plate-$k-$e"; J+=("sunder:::$n:part=plate&k=$k&e=$e$X"); N="$N $n"; done; done
  nice -n 12 node run.js $OUT/$tod "${J[@]}"
  nice -n 12 python3 compose.py $OUT/$tod $N > /dev/null
done
echo done
