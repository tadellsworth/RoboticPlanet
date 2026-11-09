# Terrafall art guide

Every building, bot, resource and ground tile now uses custom art (batch 1). Anything without an
image keeps a placeholder drawn in code, so art can still be added **one piece at a time**. The
remaining pieces are listed under [Batch 2](#batch-2-terrain-levels-and-goods-icons), [Batch 3](#batch-3-missiles-batteries-and-army-orders)
[Batch 4](#batch-4-fuel-farms-and-oil) and [Batch 5](#batch-5-robot-types-roads-and-ammo). To give every building a realistic 3D
industrial look, see [Batch 6](#batch-6-realistic-3d-industrial-buildings-a-full-restyle).

This guide has three parts:

1. [How custom art plugs in](#1-how-custom-art-plugs-in)
2. [Style direction](#2-style-direction): cyberpunk industrial realism, plus a ready-to-paste brief for Claude Design
3. [The asset list](#3-the-asset-list): every image the game can use, in priority order, with a prompt for each

---

## 1. How custom art plugs in

1. Export the image as a **PNG with a transparent background** (SVG also works).
2. Put it in the `art/` folder, e.g. `art/buildings/smelter.png`.
3. Add one line to `art/art-manifest.js`:

   ```js
   const ART_MANIFEST = {
     smelter: 'buildings/smelter.png',
     lander: { src: 'buildings/lander.png', scale: 1.6 },   // scale = size in tiles
   };
   ```

4. Reload the game. That's it.

**Team colours.** You are cyan (`#38d4ff`) and the rival is coral red (`#ff5a6e`). For buildings and
bots you can either:

- make **one** image with neutral (white or grey) lights, and the game draws a coloured team marker
  under it, or
- make **two** versions and register them as `smelter@0` (yours, cyan lights) and `smelter@1`
  (rival, red lights). This looks best for Warbots, Outposts and the Command Base.

If it's easier, just send the finished files to Claude Code and ask it to wire them in.

### Technical specs (all assets)

| | Buildings and bots | Command Base | Resources | Ground tiles |
|---|---|---|---|---|
| Canvas | 256 × 256 px | 512 × 512 px | 256 × 256 px | 128 × 128 px |
| Background | transparent | transparent | transparent | **opaque, seamless** |
| Subject fills | ~80% of canvas, centred | ~90%, centred | ~70%, centred | whole tile |
| On screen | 1 tile | 1.6 tiles | 1 tile | 1 tile |

- **Camera:** top-down, slightly tilted (a "three-quarter overhead" view at about 70°): you see mostly the
  roof, with a sliver of the front (south) wall. Keep every asset at the same angle.
- **Light:** from the top-left. Bake a soft shadow falling down-right into the image, kept within the canvas.
- **Bots face right (east).** The game rotates them to face where they walk, so draw them seen from
  directly above, nose pointing right.
- **Readable when small.** On a phone a tile is only 30–45 px wide. Use bold shapes and one strong emissive
  colour per building, and avoid fine detail that turns to mush. Check each asset shrunk to 40 px.
- No text, no logos, no letters in the art.

---

## 2. Style direction

**Cyberpunk industrial realism.** A frontier mining colony on a dusty alien world, run entirely by
robots. Think heavy machinery that has worked through years of grit and storms: chunky, practical,
worn and dirty, lit by a few glowing neon accents.

- **Materials:** weathered gunmetal and graphite steel, scuffed paint, oxidised orange rust at seams,
  dust caked on lower edges, rubber hoses, bundled cables, bolted plates, vents and grilles.
- **Shapes:** chunky and modular: containers, cylinders, gantries, hazard-striped edges. Every building
  should be recognisable from its silhouette alone.
- **Colour:** a muted, desaturated base (graphite, gunmetal, dusty ochre) with **one saturated emissive
  accent** per building (glowing lights, screens, a furnace mouth, energy cores). Team colour lives
  in the lights.
- **Mood:** hard sci-fi realism with a neon edge. Grounded and believable, not cartoony, not toy-like.
- **Planet:** rust-ochre sandy ground, deep teal brine pools, dark brown rock plateaus, glowing
  teal fungal "stalk" plants and violet crystal formations.

### Brief to paste into Claude Design first

> I'm making sprite art for a mobile strategy game called **Terrafall**. Robots run a mining colony on a
> dusty alien planet. The style is **cyberpunk industrial realism**: weathered gunmetal and graphite machinery,
> rust, dust, cables and hazard stripes, lit by glowing neon accent lights. It should feel gritty and grounded,
> not cartoony.
>
> Every asset is a **single object seen from above at a three-quarter overhead angle (about 70°)**: mostly the
> roof, plus a sliver of the south-facing wall. Light comes from the top-left with a soft shadow down-right.
> Export each as a **256×256 PNG with a transparent background**, the object centred and filling about 80% of the
> canvas. No text or logos. Each one must still read clearly when shrunk to 40×40 px, so use bold silhouettes and
> one strong glowing accent colour per object.
>
> Team lights: player version uses **cyan #38d4ff**, rival version uses **coral red #ff5a6e**. Keep every other
> colour the same between the two versions.
>
> Keep all assets consistent in angle, lighting, scale and level of detail, as one matching set.

Then ask for each asset with the prompts below.

---

## 3. The asset list

Make them roughly in this order. The first few change the look of the game the most.

### Priority 1: what you see constantly

| Key | What it is | Prompt for Claude Design |
|---|---|---|
| `lander@0`, `lander@1` | Your main base and the rival's: the landing craft (512×512, `scale: 1.6`) | A large octagonal landing craft that has set down on four splayed hydraulic landing legs. Heavy armoured hull plates, scorch marks from re-entry, cargo hatches on the sides, and a glowing team-colour energy core dome in the centre. Make it the most important-looking object in the game. 512×512. |
| `worker@0`, `worker@1` | Worker bot: carries goods, builds, runs buildings | A small, sturdy utility robot seen from directly above, facing right: a compact rounded body on treads or four small wheels, a cargo cradle on its back, one glowing team-colour sensor eye at the front. Chunky and friendly-looking but worn. |
| `warbot@0`, `warbot@1` | Combat bot | An aggressive, low-slung combat robot seen from directly above, facing right: an arrowhead or wedge-shaped armoured chassis, twin forward weapon barrels, team-colour glowing armour seams and visor. Clearly more dangerous than the worker. |
| `ground` | Basic sand tile (128×128, **seamless, opaque**) | A seamless top-down texture of rust-ochre alien sand and packed dust with small pebbles and subtle wind ripples. Low contrast so buildings stand out on it. |
| `stalk` | Fungal plants, harvested for Fiber | A small cluster of 2–3 alien fungal stalks seen from above: thin dark-teal stems topped with glowing mint-teal bulbous caps, slightly bioluminescent. |
| `boulder` | Rocks, quarried for Stone | A cluster of 2–3 pale grey weathered boulders with cracks and dust, seen from above. |
| `ore` | Ore vein, mined for Ore | A jagged chunk of near-black rock seamed with glowing molten-orange metallic veins, seen from above. |
| `crystal` | Crystal cluster, tapped for Crystal | A cluster of 3 tall hexagonal violet crystals jutting from the ground at angles, faintly glowing from inside, seen from above. |

### Priority 2: the production buildings

| Key | What it does | Prompt for Claude Design |
|---|---|---|
| `harvester` | Cuts stalk plants for Fiber | An industrial harvesting station: a squat machine shed with a big circular cutting saw on an arm and a hopper of chopped green fibre. Accent light: teal. |
| `quarry` | Breaks boulders into Stone | A rock-crushing station: a heavy crusher with a hydraulic hammer, a conveyor and stacked cut stone blocks. Accent light: white or amber. |
| `mine` | Digs Ore | A mine head: a reinforced shaft entrance with a drilling rig on a gantry above it and an ore cart. Accent light: molten orange. |
| `tap` | Extracts Crystal | A crystal extraction rig: a pylon with clamps and pipes clamped around a violet crystal, with energy conduits. Accent light: violet. |
| `smelter` | Turns Ore and Fiber into Alloy | A blast furnace building: a squat furnace with a glowing orange mouth, a tall soot-stained chimney stack, and ingot moulds. Accent light: orange-hot glow. |
| `fab` | Turns Crystal and Alloy into Chips | A clean-room chip fabrication module: a sealed box with ventilation units, a glowing lime-green circuit pattern on the roof and cooling fins. Accent light: lime green. |
| `foundry` | Builds new robots | A robot assembly factory: a large hangar with an open bay door, robotic assembly arms visible inside, and a gear emblem on the roof. Accent light: ice blue. |

### Priority 3: the rest

| Key | What it does | Prompt for Claude Design |
|---|---|---|
| `outpost@0`, `outpost@1` | Military tower: expands territory, holds Warbots | A fortified round watchtower/bunker with a sensor mast and a team-colour banner or beacon light on top, armoured slits around the base. |
| `turret@0`, `turret@1` | Defence: shoots enemy bots | A rotating energy turret on an armoured circular base, with a long barrel pointing right and team-colour glowing coils. (The game rotates it to aim, so the barrel must point **right**.) |
| `depot` | Storage warehouse | A storage depot: stacked shipping containers and crates under a gantry crane, with hazard stripes on the ground. |
| `grower` | Plants new stalk plants | A greenhouse/hydroponics dome with misting nozzles and rows of glowing teal seedlings inside. |
| `site` | A building under construction | A construction site: a square foundation pad with scaffolding, a small crane arm, hazard tape and a few stacked materials. Neutral colours. |
| `water` | Brine pool tile (128×128, **seamless, opaque**) | A seamless top-down texture of deep teal-blue alien brine water with faint ripples and mineral sheen. |
| `rock` | Rock plateau tile (128×128, **seamless, opaque**) | A seamless top-down texture of dark brown cracked rock plateau, rough and impassable. |

### Batch 2: terrain levels and goods icons

The first 27 images are done and installed (sources are in `art/source/`). The game has since gained
**terrain levels** (cliffs, slopes and a buildable Ramp) and the goods icons became swappable, so these
are the remaining pieces. Use the same brief as before.

| Key | Size | What it is | Prompt for Claude Design |
|---|---|---|---|
| `ramp` | 256×256, transparent | Build-menu icon and construction site for the Ramp | A short stepped ramp cut into a rock ledge, seen from above: sandstone steps rising toward the **top** of the image, rough rock walls on both sides, a few hazard-striped edge markers. Same angle and light as the buildings. |
| `slope` | 128×128, **opaque** | The ground tile of a finished slope between two levels | A square ground tile showing a worn dirt-and-stone ramp rising toward the **top** of the tile: graded steps or tyre-packed switchback ruts, lighter at the top (higher), darker at the bottom, low rock edges along the left and right sides. Must sit naturally between the sand ground tiles. |
| `cliff` | 128×48, **opaque** | The rock wall you see where higher ground drops to lower ground (stretched along the cliff) | A horizontal strip of layered sedimentary rock wall seen face-on: dark rust-brown strata, small cracks and loose stones, darker at the bottom where it meets the ground. Must tile seamlessly left to right. |
| `icon-fiber` | 64×64, transparent | Fiber, in the top bar and menus | A small bundle of glowing teal plant fibre, tied. Bold, simple silhouette. |
| `icon-stone` | 64×64, transparent | Stone | Two stacked pale grey cut stone blocks. |
| `icon-ore` | 64×64, transparent | Ore | A dark rock chunk with glowing molten-orange veins. |
| `icon-crystal` | 64×64, transparent | Crystal | A single violet hexagonal crystal, faintly glowing. |
| `icon-alloy` | 64×64, transparent | Alloy | A stack of two brushed blue-steel ingots. |
| `icon-chip` | 64×64, transparent | Chip | A small lime-green circuit chip with pins on all sides. |

For the six icons: they show at 16 px, so make them flat-ish, bold and high-contrast, with a thin dark outline.
They can be less detailed than the buildings.

### Batch 3: missiles, batteries and army orders

New buildings, a new good and two new map markers. Same brief and angle as batch 1.

| Key | Size | What it is | Prompt for Claude Design |
|---|---|---|---|
| `charger` | 256×256, transparent | Charging Station: bots recharge their batteries here | A compact charging bay seen from above: four docking pads around a central power pylon with heavy cables, glowing green charge indicators and warning stripes. |
| `munitions` | 256×256, transparent | Missile Factory: builds Missiles from Alloy, Chips and Fuel | A small armoured missile factory seen from above: a blast-proof assembly hall with a half-built missile on a cradle, a loading crane and hazard markings. Accent light: amber. |
| `silo@0`, `silo@1` | 256×256, transparent | Missile Silo (team versions) | A round armoured missile silo seen from above: a heavy split blast hatch, partly open, with a missile nose cone visible inside, launch-rail lights in the team colour, scorch marks around the rim. |
| `missile` | 128×128, transparent | A missile in flight (drawn facing **right**; the game rotates it) | A sleek missile seen from directly above, nose pointing right: grey body, yellow warhead band, small fins, and a short bright exhaust flame at the tail. |
| `rally` | 128×128, transparent | Your rally flag where warbots hold an area | A small planted marker flag on a metal pole, cyan #38d4ff banner with a chevron symbol, a little tripod base. |
| `icon-warhead` | 64×64, transparent | Missile, in the top bar | A single small missile pointing up, grey body with a yellow nose band. Bold, simple, thin dark outline. |

### Batch 4: Fuel, farms and oil

Charging Stations now burn Fuel, grown at a Bio Farm or refined from oil. Same brief and angle as batch 1.

| Key | Size | What it is | Prompt for Claude Design |
|---|---|---|---|
| `farm` | 256×256, transparent | Bio Farm: a worker plants and harvests energy crops | A compact agri-bot station seen from above: a seed hopper and a small greenhouse dome with grow lights, a pink fuel tank with hoses, and a robotic arm folded at the side. Accent light: magenta #ff5c8a. |
| `pump` | 256×256, transparent | Oil Pump, built on top of an oil seep | An industrial pumpjack seen from above at a slight angle: a nodding beam on an A-frame over a wellhead, black oil stains on the pad, yellow hazard paint on the beam. |
| `refinery` | 256×256, transparent | Refinery: Crude → Fuel | A small refinery: two round storage tanks (one rust-brown for crude, one magenta for fuel) joined by pipes, a short distillation column and a flare stack with a small flame. |
| `crop` | 128×128, transparent | Energy crop on fertile soil (drawn smaller while it ripens) | A small row of alien crop plants seen from above: green leafy stems topped with glowing pink energy pods. |
| `oil` | 128×128, transparent | Oil seep | A dark, glossy pool of crude oil seeping out of cracked sand, with an oily rainbow sheen and a few bubbles. |
| `fertile` | 256×256, seamless | Fertile soil (one image spans 4×4 map tiles) | Dark, rich tilled soil seen from directly above, with straight furrows running left to right and a hint of green moss. Must tile seamlessly. |
| `oneway` | 64×64, transparent | Arrow painted on a one-way path (pointing **right**; the game rotates it) | A bold road-marking arrow pointing right, off-white paint with a slightly worn edge. |
| `icon-crude` | 64×64, transparent | Crude, in the top bar | A small black oil drop with a brown rim highlight. Bold, simple, thin dark outline. |
| `icon-fuel` | 64×64, transparent | Fuel, in the top bar | A small magenta fuel cell or canister with a white highlight. Bold, simple, thin dark outline. |

### Batch 5: robot types, roads and ammo

Three specialist robots, four buildings and three goods. Make each robot in both team versions (`@0` cyan, `@1` red),
same angle and scale as the Worker: seen from above, facing **right**. Until they exist, the game draws the Worker
with a small coloured badge (amber crate, green leaf, yellow stripe).

| Key | Size | What it is | Prompt for Claude Design |
|---|---|---|---|
| `hauler@0`, `hauler@1` | 256×256, transparent | Hauler: a transport bot that carries two goods | A low, wide cargo robot seen from above on four chunky wheels, with an open cargo bed and two crates strapped in, team-colour stripes along the sides. |
| `agribot@0`, `agribot@1` | 256×256, transparent | Agribot: a farm robot | A compact farm robot seen from above on tracks, with a seed hopper on its back, a small planting arm and green indicator lights, team-colour accents. |
| `paver@0`, `paver@1` | 256×256, transparent | Paver: a road crew robot | A small road-crew robot seen from above with a hot tar spreader at the back, yellow-and-black hazard stripes and an amber warning beacon, team-colour accents. |
| `kiln` | 256×256, transparent | Cement Works: Stone → Cement | A cement plant seen from above: an angled rotary kiln drum, a short chimney with a wisp of dust, and stacked grey cement sacks. |
| `tarworks` | 256×256, transparent | Asphalt Plant: Crude + Stone → Asphalt | An asphalt plant: a black insulated tar tank over a glowing burner, a stone hopper and a mixing drum, dark stains on the pad. |
| `roadworks` | 256×256, transparent | Roadworks: lays asphalt on paths | A road maintenance yard: a parked yellow road roller, cones and a small crew shed with a striped barrier. |
| `armory` | 256×256, transparent | Ammo Plant: Alloy + Stone → Ammo | A compact armoured ammunition press with brass shell casings on a conveyor and an amber hazard light. |
| `icon-cement` | 64×64, transparent | Cement, in the top bar | A small grey cement sack. Bold, simple, thin dark outline. |
| `icon-asphalt` | 64×64, transparent | Asphalt, in the top bar | A small dark tar block with a glossy highlight. Bold, simple, thin dark outline. |
| `icon-ammo` | 64×64, transparent | Ammo, in the top bar | Three brass bullets side by side. Bold, simple, thin dark outline. |

### Batch 6: realistic 3D industrial buildings (a full restyle)

This batch redraws **every building** as a realistic, 3D-rendered industrial model seen from a high three-quarter
angle, so buildings look solid and tall instead of flat. They are our own designs; the brief below sets the
look. Do them in one Claude Design chat so camera, lighting and scale stay consistent.

**How to work through it**

1. Paste the **style brief** below first.
2. Make the **Smelter** first and check it in the game before doing the rest. It is the "style anchor".
3. For every other building, paste its prompt and add: *"Same camera angle, lighting, materials and scale as the
   Smelter."*
4. Export each one as a 512×512 PNG with a transparent background, named as listed (for example `smelter.png`,
   `outpost@0.png`), and send them over in a zip. Claude Code will register them in the manifest with the right
   size for each.

**Style brief (paste this first)**

```
I'm making building sprites for Terrafall, a mobile colony-logistics strategy game on a dusty orange-brown alien
planet. Every building should look like a realistic, pre-rendered 3D industrial model: like a detailed miniature
photographed in warm sunlight. Each one is a compact robotic industrial facility standing on a square concrete
and steel foundation pad.

Camera: a high three-quarter view looking down at about 55-60 degrees, square-on to the viewer (not turned to a
diagonal), so the roof and the front face are both visible. Use exactly the same camera for every building.

Lighting: warm sun from the top-left, soft ambient fill, a short soft shadow falling down-right onto the pad. No
shadow beyond the pad.

Materials: weathered painted steel in gunmetal, warm grey and faded off-white; ribbed and riveted panels;
concrete; pipes, ducts, vents and cable runs; catwalks with railings; yellow-and-black hazard stripes; a little
dust and rust on the edges. Each building has one accent light colour that matches what it makes; I'll give it
with each building.

Format: 512x512 PNG with a transparent background. The foundation pad sits on the bottom edge (about 4% margin)
and spans about 75% of the width; the structure rises upward from it, and nothing touches the top or the sides.
No ground around the pad, no text, no logos, no people or robots.

Readability: it is shown at about 50 pixels wide on a phone, so give it a strong, distinctive silhouette, chunky
forms, clear contrast between lit and shaded faces, and a few large details rather than many tiny ones.
```

**Team colours.** The Command Base, Outpost, Pulse Turret and Missile Silo need two versions: `@0` with cyan `#38d4ff`
accents (lights, flags, stripes) and `@1` with red `#ff5a6e` accents, everything else identical. Ask for the second
one with: *"Same image, but change every cyan accent to red #ff5a6e."* Every other building is a single version;
the game adds a thin team-coloured bar under it.

**Size on the map** (Claude Code sets this in the manifest; listed so the proportions look right): the Command Base is
the biggest, about 1.9 tiles wide; the Foundry, Refinery, Missile Factory, Outpost and Missile Silo are large, about
1.5; most production buildings about 1.35; the Charging Station, Repair Station and Pulse Turret about 1.25. Keep these proportions
between images too: a Charging Station should look smaller than a Foundry.

**The buildings**

`smelter.png` (make this first)
```
A smelter: a squat brick-lined furnace with a glowing orange mouth, a tall chimney with a faint heat haze, an ore
hopper on one side and a stack of pale blue alloy ingots on the other. Accent colour: orange furnace glow.
```

`lander@0.png` and `lander@1.png` (the Command Base; the files keep the old name)
```
The colony's Command Base, the biggest and most important building: a fortified command center built around the
landing craft that brought the colony down. A thick, low octagonal wall of armoured concrete and riveted steel
plating runs around the whole pad, with a squat round bastion at each corner topped by a small twin-barrelled gun.
Inside the walls rises a stepped, heavily armoured command block (the old landing craft, its legs sunk into the
concrete and plated over) with a slanted band of glowing team-coloured windows and a tall communications mast
with a radar dish and a beacon light on top. A heavy blast gate in the front wall stands half open over a short
ramp, flanked by concrete barriers and yellow-and-black hazard stripes. In the courtyard between the wall and the
command block: a row of three charging docks with glowing cells, stacked supply crates and a few fuel drums.
Team-coloured lights run along the top of the wall. It should look like a stronghold, not a spacecraft.
Team colour: cyan #38d4ff.
```

`harvester.png`
```
A harvesting station: a compact shed with an articulated cutting arm and a conveyor feeding a hopper of bundled
teal-green plant fibre. Accent colour: teal #3fd8a6.
```

`quarry.png`
```
A stone quarry rig: a jaw crusher with an intake chute, a short conveyor, and pallets of cut grey stone blocks.
Accent colour: warm white work lights.
```

`mine.png`
```
An ore mine head: a steel headframe tower with a winch wheel over a shaft, an ore skip, and a heap of dark ore
with glowing orange flecks. Accent colour: orange #ff8a3d.
```

`tap.png`
```
A crystal extraction station: a drilling rig with a cluster of insulated probes and a glass-walled containment
tank holding violet crystal shards. Accent colour: violet #b98cff.
```

`fab.png`
```
A clean-room chip fabrication plant: a sealed white-and-grey building with ribbed air handlers on the roof, a
small loading door and a lime-green status light strip. Accent colour: lime #c8f05a.
```

`foundry.png`
```
A robot factory: a large hangar with a wide roll-up door, a robotic assembly arm visible inside, and a gantry
crane across the roof. A little bigger than the other production buildings. Accent colour: sky blue #8ec3e6.
```

`grower.png`
```
A plant nursery: rows of seedling trays under a small arched greenhouse frame, a water tank and a seed-sowing arm.
Accent colour: soft green.
```

`farm.png`
```
An agricultural station: a hydroponic greenhouse with grow lights, a harvesting gantry, and a pink fuel tank with
pipes. Accent colour: magenta #ff5c8a.
```

`charger.png`
```
A robot charging bay: a central power pylon with heavy cables running to four charging cradles on the pad, green
charge indicator lights and a small transformer box. Smaller than the factories. Accent colour: green #7ee08a.
```

`pump.png`
```
An oil pumpjack: a nodding beam on an A-frame over a wellhead, a counterweight, a short pipe to a storage drum, and
dark oil stains on the pad. Accent colour: amber.
```

`refinery.png`
```
A compact refinery: a tall distillation column with ladders, two round storage tanks (rust-brown for crude,
magenta for fuel) joined by pipes, and a small flare stack with a flame. Accent colour: magenta #ff5c8a.
```

`kiln.png`
```
A cement plant: an angled rotary kiln drum on rollers, a tall preheater tower, a storage silo and stacked grey
cement sacks. Accent colour: pale grey-blue #a9b4c2.
```

`tarworks.png`
```
An asphalt plant: a black insulated tar tank over a burner with an orange glow, a stone hopper, a mixing drum and
dark tar stains. Accent colour: amber.
```

`roadworks.png`
```
A road maintenance yard: a small depot shed, a parked yellow road roller, stacked traffic cones and a striped
barrier. Accent colour: yellow #ffcf4a.
```

`depot.png`
```
A storage depot: an open-sided steel warehouse with stacked crates and barrels and a loading bay. Accent colour:
warm white.
```

`outpost@0.png` and `outpost@1.png`
```
A fortified outpost: a round armoured bunker with sloped walls, firing slits, floodlights, and a tall antenna mast
flying a team-coloured flag. Team colour: cyan #38d4ff on the flag and lights.
```

`turret@0.png` and `turret@1.png`: see **Turrets that turn** below; this is the base only.

`armory.png`
```
An ammunition plant: an armoured press building with a conveyor carrying brass cartridges, ammo crates stacked by
the door and an amber warning light. Accent colour: brass #e8c39e.
```

`munitions.png` (the Missile Factory)
```
A missile assembly hall: a long armoured hall with an open bay showing a half-assembled missile on a cradle, a
gantry crane and hazard markings. Accent colour: amber #ffcf4a.
```

`silo@0.png` and `silo@1.png`
```
A missile silo: a round reinforced launch pad set into a raised concrete collar, split blast doors half open
showing a missile nose cone, and team-coloured launch lights around the rim. Team colour: cyan #38d4ff.
```

`repair.png` (the Repair Station)
```
A robot repair bay: an open-sided service shed with three repair cradles on the pad, a robotic welding arm
with a bright spark, a rack of spare plating and a small crane hoist. Smaller than the factories, about the size
of the Charging Station. Accent colour: orange #ff9a3c.
```

`site.png` (a construction site)
```
A construction site: a square foundation pad with scaffolding, a small crane, stacked building materials and
hazard tape. No finished building. Accent colour: yellow hazard stripes.
```

**Turrets that turn**

A 3D turret can't simply be spun like a flat picture: the lighting and the angle would turn with it and look
wrong. So the turret is made in two layers, and the game swaps the head image as it aims:

- a **base** that never moves: `turret@0.png` (cyan) and `turret@1.png` (red)
- a **gun head** drawn facing **8 directions**: `turret-head-0@0.png` … `turret-head-7@0.png`, plus the same eight
  with red accents as `turret-head-0@1.png` … `turret-head-7@1.png`

In the game the head turns at a steady speed (about 140° a second), only fires once it's lined up, and slowly
sweeps back and forth when there's nothing to shoot at. With 8 directions it steps every 45°; for smoother turning
you can make 16 directions instead (`turret-head-0` … `turret-head-15`, 22.5° apart) and the game uses them
automatically.

The 8 directions, numbered clockwise as seen on screen:

| Number | Gun points |
|---|---|
| 0 | right |
| 1 | down-right (toward the viewer, to the right) |
| 2 | straight down (toward the viewer) |
| 3 | down-left |
| 4 | left |
| 5 | up-left (away from the viewer, to the left) |
| 6 | straight up (away from the viewer) |
| 7 | up-right |

Step 1, the base:
```
The base of a defensive energy turret, without its gun head: a squat armoured octagonal plinth on the foundation
pad, with a round turret ring on top where the head will sit, cable conduits, and glowing team-coloured capacitor
cells on its sides. Leave the turret ring empty. Smaller than the factories. Team colour: cyan #38d4ff.
```

Step 2, the head pointing right (number 0):
```
Now only the turret's gun head, on its own: a rounded armoured head with a twin-barrelled pulse cannon and
team-coloured glowing coils, pointing to the right. Put it on the same 512x512 transparent canvas, in exactly the
position where it sits on the turret ring of the base you just made, so the two images stack perfectly. Nothing
else in the image: no base, no pad, no shadow on the ground. Same camera, lighting and scale as before.
```

Step 3, the other seven: ask for each one in turn, for example:
```
The identical gun head, turned so the cannon points down-right (toward the viewer, to the right). Same canvas,
same position on the turret ring, same lighting from the top-left: only the head has turned, the light has not.
```
Then the same for down, down-left, left, up-left, up and up-right. Check each new image against the last one: the
round turret ring at the bottom of the head should stay in exactly the same spot, or the head will wobble on the
base as it turns.

Step 4, the red team: ask for the base and all eight heads again with every cyan accent changed to red `#ff5a6e`.

If the heads drift between images, tell Claude Design which way and by how much ("the ring is 6 pixels too far
left compared with the right-facing head") and ask it to fix that one.

When these are in, the old flat versions of the same names are replaced; anything not yet redrawn keeps its
current art, so they can be swapped in a few at a time.

### Batch 7: Long haul

The Freight Truck, with a driving animation and two overlays for speeding up and braking. Make it as a 3D-rendered
model like the buildings, so the frames can be re-rendered with only the tyres turned. 13 files in all:

| Key | Size | What it is |
|---|---|---|
| `truck@0-f0` … `truck@0-f3` | 384×384, transparent | The truck (cyan), four driving frames; f0 is the main image |
| `truck@1-f0` … `truck@1-f3` | 384×384, transparent | The same four frames, red |
| `truck-brake` | 384×384, transparent | Overlay: rear brake lights glowing, shown while it slows down |
| `truck-boost` | 384×384, transparent | Overlay: dust and motor glow, shown while it speeds up |

**1. The truck** (`truck@0-f0.png`)
```
Make a top-down sprite of a heavy robotic Freight Truck for Terrafall, in the same style as the Hauler and the other
robots: a realistic 3D-rendered model seen from directly above, facing RIGHT.

Design: a driverless armoured cab at the right (front) end with a dark sensor windscreen strip across its nose and a
team-coloured roof panel. Behind it, a long flatbed with low side rails and tie-down points, left EMPTY (the game
draws the cargo crates on it). Three axles of chunky off-road tyres with deep, blocky treads showing at both sides.
Weathered gunmetal and off-white panels, yellow-and-black hazard stripes on the rear bumper, small amber marker
lights at the four corners, two small headlights at the front corners and two red brake lights at the rear corners
(unlit).

Proportions: about 2.2 times as long as it is wide. The truck spans 85% of the image width and sits exactly in the
centre of the image (the game spins it around the centre as it turns).

Lighting: soft sun from the top-left. NO drop shadow and no ground under it: the game draws the shadow itself, so
it stays in place when the truck turns.

Format: 384x384 PNG, transparent background. Team colour: cyan #38d4ff.
```

**2. Driving frames** (`truck@0-f1.png` to `truck@0-f3.png`)
```
Now make the driving animation: three more frames of exactly the same truck, f1, f2 and f3. In each frame, roll the
tyres forward by a quarter of the gap between two tread blocks, so f0, f1, f2, f3 loop smoothly back into f0.
Nothing else may change: same position, size, angle, colours and lighting, pixel for pixel, so the truck doesn't
wobble when the frames play.
```
Then the red team: *"Same four frames, but change every cyan accent to red #ff5a6e"* (`truck@1-f0` to `truck@1-f3`).

**3. Braking overlay** (`truck-brake.png`)
```
Make a braking overlay: a 384x384 transparent PNG with exactly the same framing as the truck, but with no truck in
it. It's empty except for the two rear brake lights lit bright red, each with a soft red glow spilling a little onto
the ground behind the truck. The lights must sit exactly over the truck's brake lights. The game lays this over the
truck while it slows down.
```

**4. Speeding-up overlay** (`truck-boost.png`)
```
Make an acceleration overlay: a 384x384 transparent PNG with exactly the same framing as the truck, but with no
truck in it. It's empty except for a puff of pale orange-brown dust kicked up behind the rear tyres, trailing off to
the left, and a faint blue-white glow from motor vents at the back of the cab. The game shows it while the truck
speeds up and fades it out once it's at full speed.
```
Before exporting the overlays, ask Claude Design to show each one on top of the truck to check they line up.

### Batch 8: driving frames for the other robots

The same pattern as the truck for the Worker, Hauler, Agribot, Paver and Warbot: four driving frames per team
and two team-neutral overlays, 256×256, facing right, centred, **no drop shadow** (the game draws one). Attach the
current robot images as the reference. Per robot: `<robot>@0-f0` … `f3`, `<robot>@1-f0` … `f3`,
`<robot>-brake`, `<robot>-boost`.

**Setup** (paste first, with the reference images attached)
```
I'm animating the robots in my game Terrafall. Attached are the current images: worker, hauler, agribot,
paver and warbot, each in two team versions (@0 has cyan #38d4ff accents, @1 has red #ff5a6e). For each robot
I need a short driving animation and two overlays that match the attached image exactly: same top-down view,
same design, facing RIGHT, same size and position on a 256x256 transparent canvas, centred (the game spins
each robot around the centre of the image as it turns).

Two changes from the attached images:
1. Remove the drop shadow completely: no shadow and no ground. The game draws the shadow itself so it stays
   in place when the robot turns.
2. Make the tracks or wheels clearly visible at the sides, with distinct track links or tread blocks, so
   the movement reads at small size.

Render each robot as a 3D model with an orthographic camera looking straight down and a soft sun from the
top-left.
```

**Frames** (one robot at a time; the Hauler shown)
```
Hauler: make 4 frames of the hauler, hauler@0-f0 to hauler@0-f3. In each frame, roll every tyre forward by
a quarter of the gap between two tread blocks, so f0, f1, f2, f3 loop smoothly back to f0. Nothing else may
change between frames, pixel for pixel. Keep the cargo bed empty (the game draws the crates on it), and tell
me the pixel rectangle of the bed inside its rails.
```
Worker, Agribot: the track links move a quarter of a link each frame. Paver: its tracks, and the front roller
turns a quarter of its surface pattern. Warbot: tracks only. Then *"Same frames for every robot, with every cyan
accent changed to red #ff5a6e"* for `@1`.

**Overlays**
```
For each robot, make two overlays with exactly the same framing as that robot, but with no robot in them:
- <robot>-brake.png: two small red brake lights at the back (the left end) lit up, with a faint red glow on
  the ground just behind.
- <robot>-boost.png: a small puff of pale orange-brown dust kicked up behind the tracks or wheels, trailing
  off to the left.
Show each overlay on top of its robot to check they line up before exporting.
```

### Batch 9: biomes and plant life

New games get a **Biome** choice: the current **Red desert** (the default), a **Jungle** world and a **Polar**
world. Each biome has its own ground, water and rock, and its own **decorative plants** scattered over open
ground: sparse in the desert and on the ice, thick in the jungle. Plants are scenery only. Bots drive straight
over them, and a building, road or construction site simply clears the plants on its tiles.

The game draws placeholder plants and recoloured ground until your art arrives, so each piece can be swapped in
on its own.

**Installed:** all of Batch 9 is in the game (`art/biomes/`, and 512×512 desert tiles in `art/tiles/`), converted to
WebP. Plants are drawn centred on the tile with their baked shadows; the minimap takes its colours from the textures.

**What to make**

| Keys | Size | What |
|---|---|---|
| `plant-desert-1` … `plant-desert-6` | 256×256, transparent | Six decorative plants for the Red desert |
| `plant-jungle-1` … `plant-jungle-6` | 256×256, transparent | Six for the Jungle |
| `plant-polar-1` … `plant-polar-6` | 256×256, transparent | Six for the Polar world |
| `ground-jungle`, `ground-polar` | 512×512, **opaque, seamless** | Open ground. One image covers 4×4 map tiles |
| `water-jungle`, `water-polar` | 512×512, **opaque, seamless** | Water |
| `rock-jungle`, `rock-polar` | 512×512, **opaque, seamless** | Rocky crags (impassable rock) |
| `cliff-jungle`, `cliff-polar` (optional) | 128×48, opaque, tiles left to right | The rock wall below a higher level |

The Red desert keeps today's `ground`, `water`, `rock` and `cliff`. Six plants per biome is a good set; the game
uses however many you give it (even one), numbered from 1. Save them as `art/biomes/<biome>/plant-1.png` and so on,
or just send the zip as before.

**Rules for the plants** (paste these with the brief)
```
These are background decoration, not resources, so they must never be mistaken for one:
- No glowing teal mushroom stalks (that's the Fiber plant), no violet crystals, no grey boulders, and no
  glowing orange veins (that's ore).
- Muted, natural colours, a little darker and less saturated than the resource art, so they sit in the
  background. Small accents (a flower, a few berries) are fine.
- Same camera as everything else: three-quarter overhead at about 70°, light from the top-left, a soft
  shadow falling down-right kept inside the canvas.
- Vary the sizes: some low and flat (filling about 40% of the canvas), some taller and bushier (up to 80%).
  Keep every plant inside its own canvas (nothing touching the edges), centred.
- They show at about 32 to 45 pixels on a phone, so use clear, simple silhouettes. Check each at 40×40.
- In the Jungle, a third of all open tiles have a plant, so the six must look good packed side by side.
```

**Red desert plants** (`plant-desert-1` to `-6`)
```
Six hardy alien desert plants for the rust-ochre sand of a dusty frontier world, as a matching set:
1. A flat crust of rust-red and dull-orange lichen spreading over the sand, low and irregular.
2. A small spiny succulent rosette in dark maroon and dusty olive, thick pointed leaves.
3. A dry, wiry scrub bush, bleached pale grey-tan, thin tangled branches.
4. A low creeper with a few dark, leathery seed pods.
5. A fan-shaped dry plant like dead coral, faded brick red.
6. A few tufts of stiff, pale ochre grass.
```

**Jungle plants** (`plant-jungle-1` to `-6`)
```
Six lush alien jungle plants for a humid, overgrown world, as a matching set, deep emeralds, olives and
moss greens with a few warm accents:
1. A clump of broad fern fronds radiating from the centre.
2. A giant leaf rosette: big olive leaves with burgundy veins.
3. A flowering shrub with a few magenta and orange blossoms.
4. A small tree seen from above: a round, leafy canopy with darker shade underneath.
5. A soft moss mat with tiny yellow-green spore heads.
6. A tangle of creeping vines with a couple of plump pitcher pods.
```

**Polar plants** (`plant-polar-1` to `-6`)
```
Six hardy plants for a frozen polar world, as a matching set, frosty blue-greys and dark greens dusted with
snow, with a little pale lilac and rust from lichen:
1. A frost-rimed shrub, blue-grey branches tipped with ice.
2. A small snow drift with dry grass blades poking through.
3. A small conifer seen from above, a dark green star of branches dusted with snow.
4. A low stone patched with pale lilac and rust-orange lichen.
5. A clump of frozen reeds crusted with ice.
6. A frost flower: a delicate pale blue-white crystalline bloom, low to the ground (pale ice blue, not violet).
```

**Ground, water and rock** (one prompt per image)
```
A seamless, tileable square ground texture seen straight from above, 512x512, no objects, no shadows from
objects, even lighting, for a strategy game map (it repeats across the whole map, so no obvious features
that would show the repeat):
- ground-jungle: dark, damp loamy soil with patches of short moss and scattered leaf litter, deep greens and browns.
- water-jungle: a slow, murky jungle river, olive-green and brown, faint ripples.
- rock-jungle: dark wet basalt crags with moss growing in the cracks.
- ground-polar: packed snow and wind-scoured ice, white with pale blue shadows and a few grey grit streaks.
- water-polar: dark, cold blue-black water with thin plates of floating ice.
- rock-polar: grey granite crags with snow lying in the cracks.
```
Optional cliffs: *"A horizontal strip of layered rock wall seen face-on, 128x48, tiling seamlessly left to right,
darker at the bottom: mossy dark basalt dripping with vines"* (`cliff-jungle`) and *"grey granite with snow
ledges and icicles"* (`cliff-polar`).

**Sharper Red desert ground** (for the HD map): today's `ground`, `water` and `rock` are only 128×128 for 4×4
tiles, so they look soft when zoomed in. Re-export the same three textures at **512×512** (same look, just more
detail), with the same seamless-tile prompt as above: *"rust-ochre sandy ground"*, *"deep teal brine water"*,
*"dark brown rock plateau, cracked"*.

Ask Claude Code if you'd like biome versions of the resources too (snow-capped boulders, mossy ore and so on);
for now the resources look the same on every world.

Bridges, tunnels and overpasses are drawn by the game itself for now (they have to join up with each other on any
side); ask Claude Code if you'd like those as art too.

### Not swappable yet (ask Claude Code if you want these)

- Menu background and logo
- Effects (laser beams, explosions, smoke)
- App icon: to change it, replace the PNGs in `icons/` (`icon-192.png`, `icon-512.png`, `icon-1024.png`,
  `apple-touch-icon.png` at 180×180 and `favicon-32.png`), all square and opaque
- 3D buildings: the set from Claude Design is installed (harvester, quarry, mine, tap, smelter, fab, foundry, depot,
  grower, site, outpost@0/@1), and so is the second set (charger, farm, pump, refinery, kiln, tarworks, roadworks,
  ramp). They use `B3D(...)` in `art/art-manifest.js`: scale 1.4 and anchor [0.5, 0.615], the centre of the pad's top
  surface. New buildings in the same style can use the same helper
- All six robots now drive with Batch 8 frames (`worker`, `warbot`, `hauler`, `agribot`, `paver`, `truck`, each
  `@0/@1-f0…f3` plus `-brake` and `-boost`, stored as WebP in `art/bots/` and listed with `driveSet()`); the hauler's
  crates are drawn on its bed. The military buildings, the 3D Command Base, the Repair Bay (`repair`) and the nuclear
  set (`reactor`, `nukesilo@0/@1`, `nuclear-missile`, the `nuke-blast` 6×4 sprite sheet and `nuke-scorch`) are
  installed too. Any robot can use this pattern: `<type>@<team>-f0…f3` driving frames (played by distance driven), `<type>-brake` and
  `<type>-boost` overlays, and `shadow: true` in the manifest when the art has no shadow of its own.
  Still missing: a 3D turret, resources `crop` and `oil`, ground
  `fertile`, `slope` and `cliff`, markers `missile`, `rally` and `oneway`, and the 12 goods icons

### Tips

- Make the Worker and Command Base first, then check them in the game before doing the rest. It's much easier
  to adjust angle, lighting and scale with two assets than with twenty.
- If a building looks too small or too big in the game, change its `scale` in the manifest rather than
  re-exporting. `scale: 1.2` draws it 20% larger.
- Stalk plants are drawn smaller while they are still growing; Ore and Crystal shrink a little as they are mined out.
