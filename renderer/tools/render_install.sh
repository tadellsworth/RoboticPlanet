#!/bin/bash
# Renders the installed Hollow set, tunnel exits and the new Fiber (Reedcane) and Oil (survey stake) art, from this
# folder, one job at a time. Output in out/hollow, out/res, out/art/biomes/hollow; tools/install_art.py then writes
# the game's files. (The design-sheet steps are in RENDERER.md: The Hollow set; Fiber and Oil directions.)
set -e
cd "$(dirname "$0")/.."
python3 terrain/terrain_hollow.py
python3 terrain/canyon_hollow.py
python3 terrain/plants_hollow.py
python3 terrain/oil_seeps.py
python3 post/hollow_post.py breach out/hollow
# the Hollow's pieces drawn with the ground (lit like the ground, graded at night) and their night glow
for c in veins floater chamber; do
  node run.js out/hollow "hollow:::$c-day:c=$c" "hollow:::$c-night:c=$c&tod=night"
done
# the Hollow's standing pieces: night renders, drawn as they are (it is always night there)
node run.js out/hollow 'hollow:::pillar-1:c=pillar&v=1&tod=night' 'hollow:::pillar-2:c=pillar&v=2&tod=night' \
  'murmur_moles:::deep-mound:c=burrow&s=4&tod=night'
# the tunnel exits, open and caved in, at every time of day
for st in open collapsed; do
  node run.js out/hollow "hollow:::exit-$st:c=exit&state=$st" "hollow:::exit-$st-morning:c=exit&state=$st&tod=morning" \
    "hollow:::exit-$st-evening:c=exit&state=$st&tod=evening" "hollow:::exit-$st-night:c=exit&state=$st&tod=night"
done
# Fiber: Reedcane at its four growth stages; Oil: the survey stake
node run.js out/res 'resources:::fiber-1:c=fiber&v=1' 'resources:::fiber-1-g0.25:c=fiber&v=1&g=0.25' \
  'resources:::fiber-1-g0.5:c=fiber&v=1&g=0.5' 'resources:::fiber-1-g0.75:c=fiber&v=1&g=0.75' 'resources:::vent-3:c=vent&v=3'
# finishing
python3 compose_any.py out/hollow exit-open exit-open-morning exit-open-evening exit-open-night exit-collapsed \
  exit-collapsed-morning exit-collapsed-evening exit-collapsed-night --b1 3.5 --b2 11
python3 compose_any.py out/hollow pillar-1 pillar-2
python3 compose_any.py out/hollow deep-mound --b1 10.5 --b2 33 --glow 0.7
python3 post/hollow_post.py fade out/hollow pillar-1 0.04 0.42
python3 post/hollow_post.py fade out/hollow pillar-2 0.04 0.42
python3 post/resource_post.py out/res fiber-1 fiber-1-g0.25 fiber-1-g0.5 fiber-1-g0.75 --day 0.12 --glowk 0.5
python3 post/resource_post.py out/res vent-3
echo renders done
