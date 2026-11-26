#!/bin/bash
# Renders the Grader (b/rob_grader.js, the owner's concept A "Dozer"): four driving frames with the blade raised and
# four work frames with it down, for both teams, the heap of earth ahead of the blade at three sizes (team-neutral),
# at every time of day; then the brake pass. Composed as the other robots (compose_any.py --b1 3.5 --b2 10 --glow 1.4),
# with the brake / boost overlays (post/robot_overlays.py), the headlights (post/grader_post.py) and the 2D effect
# sheets (fx/terraform.py: clods and dust, splash, mud plume).
# Run from renderer/; then tools/install_grader.py. About ten minutes.
set -e
cd "$(dirname "$0")/.."
OUT=${1:-out/grader}
for tod in day morning evening night; do
  X=""; [ $tod != day ] && X="&tod=$tod"
  J=(); N=""
  for t in 0 1; do T=$([ $t = 0 ] && echo '#38d4ff' || echo '#ff5a6e')
    for f in 0 1 2 3; do
      J+=("rob_grader::$T:grader@$t-f$f:f=$f$X"); N="$N grader@$t-f$f"
      J+=("rob_grader::$T:grader-work@$t-f$f:f=$f&blade=1$X"); N="$N grader-work@$t-f$f"
    done
  done
  for n in 1 2 3; do L=$(echo "0.3 0.55 0.8" | cut -d' ' -f$n)
    J+=("rob_grader:::grader-load-$n:blade=1&load=$L&part=load$X"); N="$N grader-load-$n"
  done
  nice -n 12 node run.js $OUT/$tod "${J[@]}"
  nice -n 12 python3 compose_any.py $OUT/$tod $N --b1 3.5 --b2 10 --glow 1.4 > /dev/null
done
nice -n 12 node run.js $OUT/brake 'rob_grader::#38d4ff:grader-brake:part=brake'
python3 compose_any.py $OUT/brake grader-brake --b1 3.5 --b2 10 --glow 1.4 > /dev/null
python3 post/robot_overlays.py $OUT/brake $OUT/brake grader
python3 post/grader_post.py $OUT
python3 fx/terraform.py $OUT/fx
echo done
