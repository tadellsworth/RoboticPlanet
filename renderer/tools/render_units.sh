#!/bin/bash
# Renders the Skirmisher, the Arc Caster and the Railgunner (b/rob_skirmisher.js, rob_arccaster.js, rob_railgunner.js):
# four driving frames for both teams at every time of day, and the brake pass, then composes them as the other robots
# (compose_any.py --b1 3.5 --b2 10 --glow 1.4) and makes their brake / boost overlays (post/robot_overlays.py). Run from
# renderer/; then tools/install_units.py. About twenty minutes.
set -e
cd "$(dirname "$0")/.."
OUT=${1:-out/units}
for tod in day morning evening night; do
  X=""; [ $tod != day ] && X="&tod=$tod"
  J=(); N=""
  for r in skirmisher arccaster railgunner; do
    for t in 0 1; do T=$([ $t = 0 ] && echo '#38d4ff' || echo '#ff5a6e')
      for f in 0 1 2 3; do J+=("rob_$r::$T:$r@$t-f$f:f=$f$X"); N="$N $r@$t-f$f"; done
    done
  done
  nice -n 12 node run.js $OUT/$tod "${J[@]}"
  nice -n 12 python3 compose_any.py $OUT/$tod $N --b1 3.5 --b2 10 --glow 1.4 > /dev/null
done
nice -n 12 node run.js $OUT/brake 'rob_skirmisher::#38d4ff:skirmisher-brake:part=brake' 'rob_arccaster::#38d4ff:arccaster-brake:part=brake' 'rob_railgunner::#38d4ff:railgunner-brake:part=brake'
python3 compose_any.py $OUT/brake skirmisher-brake arccaster-brake railgunner-brake --b1 3.5 --b2 10 --glow 1.4 > /dev/null
python3 post/robot_overlays.py $OUT/brake $OUT/brake skirmisher arccaster railgunner
echo done
