# Terrafall art guide

Every building, bot, resource and ground tile now uses custom art (batch 1). Anything without an
image keeps a placeholder drawn in code, so art can still be added **one piece at a time**. The
remaining pieces are listed under [Batch 2](#batch-2-terrain-levels-and-goods-icons), [Batch 3](#batch-3-missiles-batteries-and-army-orders)
[Batch 4](#batch-4-fuel-farms-and-oil) and [Batch 5](#batch-5-robot-types-roads-and-ammo). To give every building a realistic 3D
industrial look, see [Batch 6](#batch-6-realistic-3d-industrial-buildings-a-full-restyle). For Colony wildlife, the Research Lab
and empty Silos, see [Batch 11](#batch-11-colony-wildlife-the-research-lab-and-empty-silos); for the Ropeway and Road Train,
[Batch 12](#batch-12-ropeway-and-road-train). The new defences are in [Batch 14](#batch-14-bunker-disruptor-tower-and-mortar-pit), and
weapon effects, explosions and building collapses (muzzle flashes, tracers, smoke, bullet pockmarks, rubble) in
[Batch 15](#batch-15-weapon-effects-explosions-and-building-collapses).

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

### Day and night art

`art/tod/<morning|evening|night>/` mirrors the day art for every 3D sprite (same file names, canvases and anchors, only
re-lit), and `art/tod/shared/` holds the headlight overlays, the light pool and the kit's `time-of-day.json`. To re-lit a
new sprite: render its three versions, save them as WebP at the day file's size under the same path, and add its key to
`art/tod/tod-keys.js`. Sprites without them are colour-graded in code, which works but has no lights.

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

### Batch 10: Walls and Gates

Versus games now have **Walls** (a thick Cement block that stops every bot; enemy warbots have to shoot through
it) and **Gates** (a gap in the wall with a road through it and a barrier arm that lifts for your own bots). They
are planned in lines in Paths, so the pieces have to **join seamlessly** with their neighbours. Until art arrives the
game draws them itself (pale concrete blocks with a team-colour stripe, Gate posts with team-colour lights).

Make them in the same Claude Design chat as Batch 6 (paste the Batch 6 style brief first), with these changes:

- **Orthographic camera** (no perspective), same high three-quarter angle as the buildings, square-on. Without
  perspective, sections line up exactly when placed side by side.
- **512×512 transparent PNG = exactly one map tile wide.** No foundation pad: the wall stands straight on the ground.
- **Neutral colours** (weathered pale concrete, steel caps, hazard stripes). The game adds a team-colour stripe or
  light on top, so leave a plain strip along the top of the wall, or ask for team versions (`@0` cyan, `@1` red).
- Each straight section is cut off flat **exactly at the canvas edges**, so two of them side by side make one
  unbroken wall.

| Key | Size | What |
|---|---|---|
| `wall-post` | 512×512, transparent | A single square wall block, centred: where a wall ends or turns a corner |
| `wall-ew` | 512×512, transparent | A straight wall running left to right, filling the full width, ends cut flat at both edges |
| `wall-ns` | 512×512, transparent | A straight wall running away from the camera (top to bottom of the map), ends cut flat |
| `gate-ew` | 512×512, transparent | A gate in a left-to-right wall: two posts with lights, a road running top to bottom between them, the barrier arm **down** across the road |
| `gate-ew-open` | 512×512, transparent | The same with the barrier arm **raised** |
| `gate-ns` | 512×512, transparent | A gate in a top-to-bottom wall, the road running left to right between the posts, arm down |
| `gate-ns-open` | 512×512, transparent | The same, arm raised |
| `wall-icon` | 256×256, transparent | Build-menu icon: a short stretch of wall with a gate, at the same angle |

**Prompt (after the style brief):**

```
Wall pieces for the same game, as modular tiles that join seamlessly. Orthographic camera, same angle and light
as the buildings. Each image is 512x512 with a transparent background and is exactly one map tile wide. A thick,
squat defensive wall of weathered pale poured concrete about half a tile tall, with a steel cap rail along the
top, bolted reinforcing bands, chipped edges and a few hazard stripes at the base. No foundation pad: it stands
on the ground. Straight sections run edge to edge and are cut off flat exactly at the canvas edges so neighbouring
tiles join into one wall. Gates: two heavier concrete posts with a small light on top of each, a paved road
between them, and a striped barrier arm across the road (one version down, one raised).
```

Send them in a zip like the earlier batches. Claude Code will hook them up: the game picks `wall-ew`, `wall-ns`
or `wall-post` for each tile from its neighbours, and the Gate pieces from the road's direction.

### Batch 11: Colony wildlife, the Research Lab and empty Silos

Colony mode now has creature nests and two kinds of creature, the Research Lab, and Silos that look empty until a
missile is ready. Until art arrives the game draws the nest, the creatures and the Lab itself, and uses edited
copies of the Silo images for the empty ones. Make the Lab and the nests in the same Claude Design chat as Batch 6
(paste the Batch 6 style brief first, and attach the Smelter as the style anchor); the creatures follow the Batch 8
robot pattern (seen from straight above, facing right, four walking frames).

| Key | Size | What |
|---|---|---|
| `lab` | 512×512, transparent | Research Lab (one version: the game adds the team bar) |
| `nest-1`, `nest-2`, `nest-3` | 512×512, transparent | Creature Nest at levels 1, 2 and 3 |
| `scuttler-f0` … `scuttler-f3` | 256×256, transparent | Scuttler walking frames, facing right, no shadow |
| `brute-f0` … `brute-f3` | 256×256, transparent | Brute walking frames, facing right, no shadow |
| `silo-empty@0`, `silo-empty@1` | 512×512, transparent | Missile Silo with no missile in it (team versions) |
| `nukesilo-empty@0`, `nukesilo-empty@1` | 512×512, transparent | Nuclear Silo with no missile in it (team versions) |
| `trader-ship` | 256×256, transparent | Optional: the trader ship that hovers over a Command Base during a Planet event |

**`lab.png`** (after the Batch 6 style brief)
```
A Research Lab: a compact high-tech science station on the usual concrete and steel pad. A white-and-graphite
observatory-style dome with a horizontal glowing band of windows, a small satellite dish and an antenna mast on
the roof, a bank of server racks with blinking lights on one side and a sample bay with glass canisters on the
other. Cleaner and more precise than the industrial buildings, but still a little dusty. Accent colour: violet
#b98cff glow in the window band and canisters. Size class: about 1.35 tiles, like the production buildings.
Same camera angle, lighting, materials and scale as the Smelter.
```

**`nest-1.png`, `nest-2.png`, `nest-3.png`**
```
A creature nest on the alien planet, in three growth stages, as three separate images with identical framing.
It is organic, not built: a low mound of hardened dark purple-brown resin and fused rock, ribbed and knobbly
like a termite mound crossed with a beetle shell, with three or four dark burrow holes, and a sticky purple
creep spreading over the sand around its base. Clusters of pale glowing green eggs sit in hollows on the mound.
No foundation pad: the mound's base sits on the bottom edge (about 4% margin) and spans about 75% of the width,
like the buildings' pads. Same camera angle and lighting as the Smelter.
Stage 1: small and low, a few eggs. Stage 2: bigger, with bony spikes starting to grow and more eggs.
Stage 3: large and menacing, tall jagged spikes, many glowing eggs, a faint green glow from the burrows.
Make it read as hostile and alive at 50 pixels wide: a strong dark silhouette with the green eggs as the accent.
```

**Creatures** (one chat; paste this first)
```
Creature sprites for the same game. Two alien creatures that raid the robot colony. Render each as a realistic
3D model with an orthographic camera looking straight down and a soft sun from the top-left, like the robots in
my game: seen from directly above, facing RIGHT (head at the right), centred on a 256x256 transparent canvas.
No drop shadow and no ground: the game draws the shadow. The game turns each sprite round its centre to face
where it walks, so keep the body centred.

For each creature make 4 walking frames (f0 to f3): the legs step forward a quarter of a stride each frame so
f0, f1, f2, f3 loop smoothly back to f0. Nothing else may change between frames.

Scuttler (scuttler-f0 to f3): small and quick, about the size of a large dog next to the robots. A low beetle-
like body with a glossy dark purple carapace (#55306a, lighter ridges), six thin jointed legs splayed out to the
sides, short mandibles at the front and two small glowing magenta-pink eyes (#ff5fd2). The body fills about 45% of
the canvas width with the legs reaching to about 65%.

Brute (brute-f0 to f3): big, slow and armoured, about twice the Scuttler's size. A heavy six-legged creature with
thick overlapping brown-bronze armour plates (#6b4430), pale bony spikes along its back and sides, big crushing
mandibles and two glowing amber eyes (#ffb347). The body fills about 70% of the canvas width.

Both should be clearly creatures, not robots, and read at 20-30 pixels wide: bold silhouettes, the glowing eyes
as the accent.
```

**Empty Silos** (attach `silo@0.png`, `silo@1.png`, `nuclear-silo@0.png` and `nuclear-silo@1.png`)
```
Attached are four building images from my game: a Missile Silo and a Nuclear Silo, each in two team versions.
Make a copy of each that is exactly the same image, pixel for pixel, except that the missile is gone: the launch
pit is empty and dark inside, and its glowing ring and rim continue all the way round where the missile used to
hide them. Keep the canvas, framing, lighting and everything else identical, so the two images can be swapped in
place. Name them silo-empty@0, silo-empty@1, nuclear-silo-empty@0 and nuclear-silo-empty@1.
```

**`trader-ship.png`** (optional)
```
A small boxy cargo spaceship hovering in the air, seen from above at the same three-quarter angle and lighting
as the buildings: a battered white-and-orange hull, two stubby thruster pods glowing pale blue underneath, a
cargo hatch with a winch on its belly and blinking landing lights. 256x256 transparent PNG, the ship filling
about 75% of the width, no shadow and no ground (it floats; the game draws its shadow).
```

Send them in a zip like the earlier batches (WebP or PNG). Claude Code will register them: the Lab and the nests
with the same `B3D` sizing as the other buildings, the nest picked by its level, the creatures with `driveSet`-style
walking frames played by distance walked, and the empty Silos replacing the current edited ones.

### Batch 12: Ropeway and Road Train

The Ropeway (two pylon stations joined by a cable, with gondolas) and the Road Train (a tractor unit pulling two
flatbed trailers). Until art arrives the game draws them itself: the Road Train uses the Freight Truck's art for its
cab. Make the Ropeway pieces in the Batch 6 buildings chat and the Road Train in the Batch 8 robots chat.

| Key | Size | What |
|---|---|---|
| `ropeway@0`, `ropeway@1` | 512×512, transparent | Ropeway station (team versions) |
| `gondola@0`, `gondola@1` | 256×256, transparent | A gondola hanging from the cable (team versions) |
| `roadtrain@0-f0` … `f3`, `roadtrain@1-f0` … `f3` | 256×256, transparent | Road Train tractor unit, driving frames, facing right, no shadow |
| `roadtrain-trailer@0`, `roadtrain-trailer@1` | 256×256, transparent | Flatbed trailer, facing right, no shadow |
| `roadtrain-brake` | 256×256, transparent | Brake-light overlay for the tractor (optional) |

**`ropeway@0.png`, `ropeway@1.png`** (after the Batch 6 style brief)
```
A ropeway station: a slim steel lattice pylon tower on a small concrete footing pad, rising to about 80% of the image
height, with a large grooved bull wheel mounted at the very top for the haul cable, a small machine house with the drive
motor and a team-coloured status light at the foot of the tower, and a short loading platform with railings and
yellow-and-black hazard stripes. The bull wheel's centre must sit on the image's horizontal centre line, about 10% from
the top edge: the game attaches the cable there. Slimmer than the production buildings (about 1.1 tiles wide at its
pad). Team light cyan #38d4ff; then "Same image, but change every cyan accent to red #ff5a6e".
Same camera angle, lighting, materials and scale as the Smelter.
```

**`gondola@0.png`, `gondola@1.png`**
```
A small cargo gondola for the same ropeway, seen at the same three-quarter angle and lighting as the buildings: a grip
clamp at the very top centre of the image (about 8% from the top edge, where the cable passes), a short steel hanger
arm down from it, and below that an open-topped steel cargo cabin with a team-colour stripe (cyan #38d4ff; then the
same in red #ff5a6e) and a small crate rack. 256x256 transparent PNG, the cabin about 45% of the width, no shadow
and no ground (it hangs in the air).
```

**Road Train** (in the robots chat; attach the Freight Truck images `truck@0-f0` and `truck@1-f0` as the reference)
```
A Road Train for the same game, matching the attached Freight Truck exactly in camera, lighting, scale and style:
a realistic 3D model with an orthographic camera looking straight down, facing RIGHT, centred on a 256x256
transparent canvas, no drop shadow and no ground.

1. The tractor unit (roadtrain@0-f0 to f3, then the same with every cyan accent changed to red #ff5a6e for @1):
a heavy cab-over-engine prime mover, a little longer than the Freight Truck, with three axles, twin exhaust stacks
behind the cab, a fifth-wheel coupling plate at the back (no bed), and team-colour cyan #38d4ff stripes and roof
lights. 4 driving frames: roll every tyre forward a quarter of the gap between tread blocks each frame so f0 to f3
loop; nothing else changes.

2. The trailer (roadtrain-trailer@0, then @1 in red): a long flatbed trailer with low side rails, two axles at the
rear and a kingpin hitch at the RIGHT end, with a team-colour stripe along each side. Keep the bed empty (the game
draws the crates on it) and tell me the pixel rectangle of the bed inside the rails. The trailer about 60% of the
canvas width, centred.

3. Optional: roadtrain-brake.png, an overlay with the tractor's framing but no tractor in it: two small red brake
lights lit at its back (the left end) with a faint red glow just behind.
```

Send them in a zip like the earlier batches. Claude Code will register them: the station with the `B3D` sizing (and
line the cable up with the bull wheel), the gondola hanging from the cable, and the tractor and trailers in place of
the drawn ones.

### Batch 13: Crawler, Freight rail, 3D bridges, Viaducts and Sky islands cliffs (the final big batch)

**Installed** (from the first version of this prompt): Batches 11–13 are all in the game as WebP, sized to how big
they're drawn. The canyon set's `chasm-wall` serves as the Sky islands tall cliff face (its lower half carries on down
the second tile) and the `chasm-lip-*` overlays as the crumbled rims; the Sky bridge pieces, piers, towers and cables
dress the Viaducts (the rail bridge pieces when track runs across), and the old bottomless-canyon tiles still draw
`T_CHASM` in older saves. The Sky islands cliff and Viaduct prompts below weren't needed.

Everything added since Batch 10 in one go: the Crawler (with its treads, deploy sequence and spinning dish), the
Freight Train, the Rail Station and track, a 3D bridge kit (water and rail), the Viaduct and the Sky islands
cliffs, plus the Batch 11 and 12 assets if they aren't made yet. Until art arrives the game draws all of these
itself. A copy of every prompt from Batches 11 to 13, ready to paste in order, is in
`design/claude-design-final-prompt.md`.

**Master brief (paste this first in a new Claude Design chat; attach the Smelter and the Freight Truck
`truck@0-f0` as style anchors)**
```
I'm making the last set of sprites and tiles for Terrafall, a top-down sci-fi colony and logistics strategy game
for phones and desktop: robots build a mining colony on a dusty orange-brown alien planet, move goods by road,
rail, ropeway and bridge, and fight rival colonies. Attached are two finished assets as the style anchors: the
Smelter (a building) and the Freight Truck (a vehicle). Everything new must look like it belongs with them:
realistic, pre-rendered 3D models, like detailed miniatures photographed in warm sunlight. Materials: weathered
painted steel in gunmetal, warm grey and faded off-white, riveted panels, concrete, hydraulics, cable runs,
yellow-and-black hazard stripes, a little dust and rust. One glowing team-colour accent per asset.

There are three kinds of image. Never mix their cameras:
1. BUILDINGS (stations, nests, the Lab): the Smelter's camera, a high three-quarter view looking down at about
   55-60 degrees, square-on. Warm sun from the top-left, a short soft shadow down-right onto the pad. 512x512
   transparent; the foundation pad sits on the bottom edge (about 4% margin) and spans about 75% of the width.
2. VEHICLES and CREATURES (Crawler, train cars, Road Train, creatures): the Freight Truck's camera, an
   orthographic view looking STRAIGHT DOWN, the vehicle facing RIGHT (its front at the right), centred, with NO
   drop shadow and no ground (the game draws the shadow and turns the sprite to face where it drives). Soft sun
   from the top-left. 256x256 transparent unless I say otherwise.
3. TILES (track, bridges, viaducts, cliffs): straight down like the vehicles, lit like the buildings. Each is a square that
   repeats on a grid, so anything that crosses an edge must cross at exactly the position I give, to join the
   next tile. 256x256.

Team colours: player cyan #38d4ff, rival coral red #ff5a6e. For every team asset make the cyan version first,
then "the same image with every cyan accent changed to red #ff5a6e" (@0 and @1). The game recolours a third,
green team itself.

Animation: each frame is a separate image with an identical canvas, framing and lighting. Only the moving parts
change, and the last frame must loop smoothly back into the first. Driving frames are named -f0, -f1...;
one-off sequences -d0, -d1...; overlays (lights, glows, dust) are separate transparent layers with the same
framing that the game fades in and out.

Readability: a map tile is only 30-45 pixels wide on a phone. Bold silhouettes, a few large details, strong
lit-versus-shaded contrast, the team accent visible at that size. No text, logos, letters or people.
```

| Key | Size | What |
|---|---|---|
| `crawler@0-f0` … `f7`, `crawler@1-f0` … `f7` | 512×512 | Crawler driving frames (8, treads rolling), facing right, no shadow |
| `crawler-dish` | 512×512 | Sensor dish layer the game spins (team-neutral) |
| `crawler-lights`, `crawler-dust` | 512×512 | Headlight and beacon glow; dust plume behind the treads |
| `crawler-deploy@0-d0` … `d9`, `@1-…` | 512×512 | Deploy sequence (played backwards to pack up) |
| `crawlerbase@0`, `crawlerbase@1` | 512×512 | The deployed Crawler (vehicle camera, facing right) |
| `freight-loco@0-f0` … `f3`, `@1-…` | 256×256 | Locomotive driving frames, facing right, no shadow |
| `freight-loco-lights`, `-brake`, `-exhaust` | 256×256 | Locomotive overlays |
| `freight-wagon-flat@0/@1`, `freight-wagon-hopper@0/@1` | 256×256 | Wagons, facing right, no shadow, empty |
| `station@0`, `station@1` | 512×512 | Rail Station (building camera) |
| `rail-straight`, `rail-curve`, `rail-tee`, `rail-cross`, `rail-end` | 256×256 | Track tiles, transparent outside the ballast |
| `rail-level-crossing`, `rail-barrier-up`, `rail-barrier-down`, `rail-lights-on` | 256×256 | Level crossing and its barrier overlays |
| `bridge-…`, `railbridge-…` (`-ew`, `-ns`, `-end-w/e/n/s`, `-ramp-w/e/n/s`) | 256×256 | The bridge kit in two styles |
| `bridge-pier`, `railbridge-pier` | 256×512 | Piers below a deck tile |
| `cliff-tall`, `cliff-tall-2`, `canyon-floor` | 256×256, opaque | Sky islands: tall cliff walls and the canyon floor |
| `cliff-foot-w`, `cliff-foot-e` | 256×256 | Shadow at the foot of a mesa's side walls |
| `…-jungle`, `…-polar` | same | Optional biome versions of the cliff tiles |
| `viaduct-abutment@0/@1` | 256×256 | Viaduct end (faces right; the game turns it) |
| `viaduct-deck-ew`, `viaduct-deck-ns` (+ `-rail`) | 256×256 | One tile of Viaduct deck |
| `viaduct-pier` | 256×512 | A tall concrete pier, stretched to the drop |

**`crawler`** (vehicle camera, 512×512: it is huge, 1.5 by 1 tiles on the map)
```
THE CRAWLER: a colossal tracked mobile base, part mining crawler-transporter, part sci-fi command vehicle, seen
straight down and facing right. Two enormous tread units run the full length of both sides: wide steel track
plates with chunky grousers, with the drive sprockets and idler wheels showing at the ends. Between them a long
armoured hull: a raised command cab at the RIGHT (front) end with a wraparound tinted window band, a flat cargo
deck in the middle with stacked containers and cargo bay hatches, two folded charging arms clamped along the
sides, and a short folded sensor mast with a dish near the back. Weathered off-white and gunmetal, hazard
stripes on the corners, cyan #38d4ff running lights along the hull and on the cab roof. It fills about 90% of
the canvas width and 60% of its height, centred.

a) Driving frames crawler@0-f0 to f7: the treads crawl forward. Each frame moves every track plate forward
   (to the right) by exactly 1/8 of the gap between plates, and the sprockets and idlers turn to match, so f7
   loops into f0. Add a slight weight-shift: on f2 and f6 the hull sits one pixel further back and lower, as if
   the suspension settles over the plates. Nothing else changes.
b) Overlays, same framing, transparent everywhere else:
   - crawler-dish: only the sensor dish and its mast head, seen from above. Put the mast's pivot at canvas pixel
     (180, 256) and say so: the game spins this layer slowly on that point while the Crawler drives.
   - crawler-lights: only the light: two warm headlight pools spreading ahead of the cab past the right edge,
     and an amber rotating-beacon glow on the cab roof. Bright on transparent, so it can be added on top.
   - crawler-dust: a soft red-brown dust plume streaming back from the rear of both treads toward the left edge.
c) Deploy sequence crawler-deploy@0-d0 to d9, same camera and framing (the game plays it over about two
   seconds when the Crawler stops, and backwards when it packs up):
   d0 identical to crawler@0-f0.
   d1-d3 four heavy hydraulic outrigger legs swing out diagonally from the hull's corners and stamp down on round
         foot pads; small dust puffs burst at the pads on d3.
   d4 the hull lifts a little on its jacks: draw it very slightly larger and crisper, with darker contact
         shadows round the four foot pads.
   d5-d6 the side cargo panels fold down and out like wings, opening storage racks and four charging bays whose
         pads glow cyan.
   d7 the two charging arms swing out over the bays.
   d8 the sensor mast telescopes up and its dish opens (it reads as rising because the dish grows a little and
         its shadow on the deck lengthens toward the bottom-right).
   d9 fully deployed: identical to crawlerbase@0.
d) crawlerbase@0: the deployed Crawler as a standing base: outriggers planted, wings open with containers in the
   racks, four lit charging bays, mast up with a cyan beacon. Keep the vehicle camera (straight down, facing
   right) so the game can turn it to the way the Crawler was parked.
Then the team versions in red #ff5a6e (@1) of the frames, the deploy sequence and the base. The dish, lights and
dust layers are shared.
```

**`freight`** (vehicle camera; each car is its own sprite so the train bends round curves)
```
THE FREIGHT TRAIN: a locomotive and two kinds of wagon, each a separate 256x256 sprite seen straight down and
facing right, about 80% of the canvas wide and 40% tall (0.62 by 0.32 tiles in the game), centred. Each car has
a coupler at both ends exactly on the horizontal centre line, so the cars line up nose to tail. Keep every car
symmetric about that centre line: the game rolls each car along the curve of the track and rocks it a little on
curves.

a) Locomotive freight-loco@0-f0 to f3: a heavy modern freight locomotive from directly above: a long roof with two
   big round radiator fans under grilles, a folded pantograph, an exhaust hatch, walkways with yellow handrails
   down both sides, and a sloped nose at the RIGHT with a wide dark windscreen and twin headlights. Cyan #38d4ff
   livery band along both sides and across the nose. Frames: both roof fans turn a quarter of the way between
   their blades each frame, and the bogie side-frames peeking out under the walkways shift by a quarter of a
   wheel turn, so f3 loops into f0.
b) Overlays for the locomotive, same framing, transparent elsewhere:
   - freight-loco-lights: two long soft headlight beams spreading ahead of the nose off the right edge, warm white.
   - freight-loco-brake: red brake and marker lights at the rear (left) end with a faint glow.
   - freight-loco-exhaust: a thin heat shimmer and smoke wisp rising from the exhaust hatch, drifting toward the
     bottom-right.
c) Wagons, no frames, empty (the game draws the load on them):
   - freight-wagon-flat@0: a long flat container car with low end bulkheads and stake pockets along the sides.
     Leave the deck empty and tell me the pixel rectangle of the empty deck.
   - freight-wagon-hopper@0: an open-topped ore hopper with ribbed sides and a dark empty interior. Tell me the
     pixel rectangle of the opening.
   Both with a cyan stripe along each side. The game alternates them along the train.
Then all of them again in red #ff5a6e (@1). The overlays are shared.
```

**`station@0.png`, `station@1.png`** (building camera)
```
A freight Rail Station: a low steel goods shed with a long barrel-vaulted roof, an overhead gantry crane
spanning a loading strip along its front (south) edge with a container hanging from it, stacked containers and
pallets, loading ramps at both ends and a signal mast with a cyan #38d4ff team light. About 1.2 tiles wide at its
pad. The game draws the railway beside it, so no rails in the image. Same camera angle, lighting, materials and
scale as the Smelter. Then the same image with every cyan accent changed to red #ff5a6e.
```

**Track tiles** (tiles)
```
RAIL TRACK TILES, 256x256, transparent outside the track bed, seen straight down and lit from the top-left (the
rails cast thin shadows down-right). Standard track on a grey-brown gravel ballast bed: steel rails with a bright
worn top, dark timber sleepers. The ballast bed is 70% of the tile wide and centred; the two rails sit at exactly
33% and 67% across the tile so every tile joins its neighbours.
- rail-straight: running left to right, edge to edge (the game turns it for north-south).
- rail-curve: a 90-degree curve coming in through the left edge and leaving through the bottom edge, at the same
  rail positions.
- rail-tee: straight left to right, with a branch leaving through the bottom edge through a set of points, with
  the switch blades and a small lever box.
- rail-cross: a flat diamond crossing of two lines, left-right and top-bottom.
- rail-end: a buffer stop at the right end (a red-and-white striped buffer beam on a steel frame), track coming in
  from the left.
- rail-level-crossing: the track running left to right across a concrete road that runs top to bottom (the road
  56% of the tile wide), with rubber crossing panels between the rails and white stop lines on the road.
- rail-barrier-up and rail-barrier-down: overlays for the level crossing: a barrier post at each road edge with a
  red-and-white striped arm, raised (seen from above as a short stub at the post) or lowered across its half of
  the road.
- rail-lights-on: only the two red warning lamps on the posts, lit and glowing (the game flashes it while a train
  passes).
```

**Bridges** (tiles: the bridge kit)
```
BRIDGES, 256x256 tiles, transparent wherever there is no bridge, seen straight down, lit from the top-left. A
bridge holds one level all the way across and has to look solid and raised: a thick deck slab, girders showing
below it along its south (bottom) side, railings with posts on both edges, and depth beneath it. The road deck is
56% of the tile wide and centred (its road surface 46%), and joins the next tile edge to edge. Draw no shadow: the
game casts the bridge's shadow onto the water itself.

Make two styles, each as the same set of pieces:
1. bridge-...: a concrete-and-steel girder bridge low over WATER (pale concrete deck, steel girders, short piers).
2. railbridge-...: a riveted steel truss bridge for the railway: its deck carries ballast for the track (no rails:
   the game draws the track on top), with walkways and handrails along both sides.

Pieces for each style:
- -ew: a straight deck running left to right, edge to edge. Its south face shows: the slab edge, then the
  girders (for railbridge, a deep riveted truss).
- -ns: a straight deck running top to bottom, edge to edge. The south face is hidden; show the shaded east side
  of the girders as a narrow strip and a lit edge on the west.
- -end-w, -end-e, -end-n, -end-s: the abutment where the deck meets land on that side: a concrete abutment
  keyed into the shore, the railings ending in squat bollards.
- -ramp-w, -ramp-e, -ramp-n, -ramp-s: the last tile easing down onto lower land on that side: the same deck
  sloping down, with grip grooves across it and the railings stepping down.
- -pier (256x512): the support under one deck tile, from the deck's underside at the top of the image downward.
  bridge-pier: a stout concrete pier meeting the water about a quarter of the way down in a ring of ripples.
  railbridge-pier: a lattice steel trestle meeting the water the same way.
```

**Sky islands cliffs** (ground tiles, opaque and seamless)
```
SKY ISLANDS CLIFFS: on this map the islands are towering mesas standing over a canyon floor far below (three
to five levels down), with sheer rock walls all round and no slopes. 256x256 tiles, seen straight down and lit
from the top-left like the rest.
- cliff-tall: the sheer wall seen just below a mesa's southern rim, filling the whole tile: the top edge is the
  rim (a lit, crumbly red-brown lip), then a vertical face of banded sedimentary strata (rust, ochre and
  dark-brown bands running straight across so the tile repeats left to right, a few vertical cracks and narrow
  ledges), darkening as it goes down.
- cliff-tall-2: the next tile further down the same wall, continuing the strata from cliff-tall's bottom edge,
  darker still, ending in a band of deep shadow and a little scree where the wall meets the canyon floor.
- cliff-foot-w, cliff-foot-e: thin overlays (transparent elsewhere) of the soft shadow a mesa throws on the floor
  beside its west and east walls.
- canyon-floor: the canyon floor itself: the same planet ground as everywhere else, but in deep shade (darker,
  a little cooler), with scattered scree, dust drifts and a few fallen boulders. It must tile seamlessly in every
  direction.
Optional biome versions, the same images retinted: -jungle (darker rock, moss and hanging vines on the walls,
a lush shaded floor), -polar (blue-grey rock with ice streaks, snow on the rims and drifts on the floor).
```

**Viaduct** (tiles and a building)
```
VIADUCT: a level concrete-and-steel bridge straight across a dry valley or canyon between two clifftops, carrying
a road (or a railway) high over the ground below, where other traffic passes underneath.
- viaduct-abutment@0 and @1 (256x256, straight down, lit from the top-left): the end of a Viaduct: a heavy
  concrete abutment block keyed into the clifftop, the deck starting out of it toward the RIGHT edge (the game
  turns it to face the span), squat bollards where the railings end, and a small team-colour lamp (cyan
  #38d4ff; then red #ff5a6e).
- viaduct-deck-ew, viaduct-deck-ns (256x256, transparent): one tile of the deck: a pale concrete road deck 56% of
  the tile wide, railings with posts on both edges, and on the east-west piece the deck's slab edge and a steel
  girder showing along its south side. A rail version of each (-rail) with ballast instead of the road surface.
- viaduct-pier (256x512, transparent): one tall tapered concrete pier from the deck's underside at the top down to
  a footing on the ground at the bottom, lit on its left, with formwork lines across it. The game stretches it to
  the height of the drop.
```

Send them in zips by group (Crawler, train and station, track, bridges, viaduct, cliffs) like the earlier batches. Claude
Code will register them: the Crawler frames played by distance driven with the dish layer spinning, the deploy
sequence played on deploy and reversed on pack-up; train cars on the track's curve with the overlays faded in
for headlights, braking and exhaust; track and bridge pieces picked by their joins (rotated where the piece
allows); piers, towers and cables in the bridge rigging pass; the Viaduct deck and piers in its own pass; the cliff
tiles in place of the drawn cliffs.

### Batch 14: Bunker, Disruptor Tower and Mortar Pit

**Installed** (November): all three, both teams, the overlays, the Mortar's 16 tube directions and the morning, evening
and night sets. The brief is kept below for reference.

Three new defences for the Build menu's **Defend** tab.
Make them in the same Claude Design chat as Batch 6: paste the Batch 6 style brief first and attach the **Smelter**
as the style anchor, plus the **Outpost** so the three read as part of the same military family. Every image is a
**512×512 PNG with a transparent background**, the foundation pad on the bottom edge like the other 3D buildings
(Claude Code registers them with `B3D(...)`). Make the cyan version of each, then "the same image with every cyan
accent changed to red #ff5a6e" (the game recolours a third, green team itself).

| Key | What | Needed? |
|---|---|---|
| `bunker@0`, `bunker@1` | Bunker | yes |
| `bunker-fire@0`, `bunker-fire@1` | Overlay: muzzle flashes at its firing slit, flashed as it shoots | optional |
| `disruptor@0`, `disruptor@1` | Disruptor Tower | yes |
| `disruptor-pulse` | Overlay: coils and orb lit up, faded in and out with each pulse (one version: the pulse colour is the same for every team) | optional |
| `mortar@0`, `mortar@1` | Mortar Pit, the pit and sandbags with **no tube** | yes |
| `mortar-head-0` … `mortar-head-7` | The tube on its own in 8 directions, swapped as it aims (one set, no team colour; or 16 directions, `-0` … `-15`) | yes, with the pit |

The 8 directions are numbered like the turret heads: 0 right, 1 down-right, 2 down (toward the viewer), 3 down-left,
4 left, 5 up-left, 6 up (away from the viewer), 7 up-right.

**`bunker@0.png`**
```
A Bunker: a low, squat reinforced-concrete pillbox for two robots, on the usual concrete and steel foundation pad.
Thick sloped walls of weathered grey concrete with chipped edges and rust-streaked steel plates bolted over them,
a flat armoured roof with a small sensor dome and a periscope, and one long horizontal firing slit across the front
(south) face, dark inside. Concrete blocks and a few sandbags banked against the corners, yellow-and-black hazard
stripes along the roof edge. Team colour cyan #38d4ff in two small status lights on the roof and a thin light strip
just above the firing slit. It should hug the ground: lower and wider than the Outpost, about two thirds of its
height. Size class: about 1.2 tiles. Same camera angle, lighting, materials and scale as the Smelter.
```

**`bunker-fire@0.png`** (optional, right after the Bunker)
```
Now only the muzzle flashes, on their own: two bright yellow-white muzzle flashes with a few orange sparks bursting
out of the firing slit of the Bunker you just made, one left of centre and one right of centre, where its two gun
barrels would be. Same 512x512 canvas and exactly the same position as the Bunker, so the two images stack
perfectly. Transparent everywhere else: no bunker, no pad, no shadow.
```

**`disruptor@0.png`**
```
A Disruptor Tower: an electromagnetic pulse emitter on the foundation pad. A slim armoured mast of dark graphite
steel rises from a heavy octagonal base packed with capacitor banks, cable bundles and a small cooling fan. Three
stacked copper-and-steel induction coils wrap the mast, smaller toward the top, with ceramic insulators between
them, and a glass-and-steel orb crowns it. Warning stripes on the base. The coils and the orb glow a soft electric
ice blue #8fd8ff (the pulse colour, the same for every team); team colour cyan #38d4ff in a light band around the
base. Taller and thinner than the other buildings, with a strong vertical silhouette, on the usual pad. Size class:
about 1.3 tiles. Same camera angle, lighting, materials and scale as the Smelter.
```

**`disruptor-pulse.png`** (optional, right after the tower)
```
Now only the pulse glow, on its own: the three coils and the orb of the Disruptor Tower you just made, lit up
blindingly bright ice blue fading to white at the core, with a soft blue halo round them and a few thin electric arcs
jumping between the coils. Same 512x512 canvas and exactly the same position as the tower, so the two images stack
perfectly. Transparent everywhere else: no tower body, no pad, no shadow.
```

**`mortar@0.png`** (the pit, without its tube)
```
A Mortar Pit, without its gun: a round, sunken artillery emplacement on the foundation pad. A ring of stacked
sandbags and concrete blocks around a dug-in pit, ammunition crates stacked against the inside wall, a small
rangefinder on a tripod and a few spent shell casings on the floor. In the middle of the pit leave a round steel
turntable plate empty: the mortar tube sits there. Accents: team colour cyan #38d4ff on a small signal lamp and a
stripe on the crates, and a warm amber #ffb347 lamp on the rangefinder. Low and wide: the sandbag ring is barely
higher than the Bunker. Size class: about 1.3 tiles. Same camera angle, lighting, materials and scale as the Smelter.
```

**`mortar-head-0.png`** (the tube pointing right)
```
Now only the mortar itself, on its own: a heavy, stubby mortar tube of dark gunmetal on a bipod and a round base
plate, tilted steeply up at about 60 degrees, its muzzle leaning to the right, with a sight on the side and a scuffed
hazard stripe round the muzzle. Put it on the same 512x512 transparent canvas, in exactly the position where it sits
on the empty turntable of the pit you just made, so the two images stack perfectly. Nothing else in the image: no
pit, no pad, no shadow on the ground. Same camera, lighting and scale as before.
```

Then the other seven, one at a time, for example:
```
The identical mortar, turned on its turntable so the muzzle leans down-right (toward the viewer, to the right).
Same canvas, same position on the turntable, same lighting from the top-left: only the mortar has turned, the light
has not.
```
…and the same for down, down-left, left, up-left, up and up-right. The round base plate at the bottom of the tube must
stay in exactly the same spot in all eight, or the tube will wobble as it turns.

**Day and night.** If you also make the re-lit morning, evening and night versions (see "Day and night art" above),
do them for `bunker`, `disruptor` and `mortar` (both teams) and the mortar heads; the overlays glow on their own and
don't need them.

### Batch 15: Weapon effects, explosions and building collapses

Every weapon now has effects, all drawn in code until art arrives. **The game already looks right without this
batch**; these sheets replace the code drawings with richer animation. Do them in any order; each one is used as
soon as it's in the manifest.

**What plays when**

| Event | What you see |
|---|---|
| A Warbot, or a Warbot in a Bunker, fires | a muzzle flash at the barrel, a tracer streak to the target, a puff of gun smoke drifting up. Three rounds land: dust kicks up and **bullet pockmarks** pepper the ground round the target (on a building, sparks fly instead) |
| A Pulse Turret fires | its laser beam, a glow at the barrel in team colour, a puff of dust and a small **burn mark** where it hits (the beam and glow are drawn in code, in the beam's colour) |
| A Mortar Pit fires | a big muzzle flash straight up and a cloud of smoke; the shell arcs over trailing smoke; where it lands: a white flash, a fireball, chunks of debris thrown out, a smoke column and a **scorch mark** |
| A Disruptor Tower pulses | an electric **arc** jumps from its orb to every enemy robot it drains |
| A missile lands | a big blast (flash, fireball, debris, smoke, scorch) |
| A robot is destroyed | a small blast and a scorch mark |
| A building is destroyed | it shakes, leans and **sinks into the ground**; a main blast, then two smaller blasts 0.35 s and 0.7 s later; a **dust cloud** billows out from its base; it leaves **rubble** and a scorch mark that fade over about a minute and a half |

The collapse uses each building's own art (sunk, tilted and clipped at ground level), so no "ruined" version of any
building is needed. The white flash, laser beams and the Pulse Turret's glow stay drawn in code.

**Sprite sheets.** An animated effect is one image holding all its frames in a grid, the same size each, read
left to right, then row by row. The game plays the frames once over the effect's life (it stretches or squeezes the
timing to fit), so the **last frame should have faded to almost nothing**. Register it with its frame count and
columns:

```js
'fx-explosion': { src: 'effects/fx-explosion.webp', frames: 16, cols: 4 },   // 16 frames, 4 across, 4 down
'fx-tracer':    { src: 'effects/fx-tracer.png',     frames: 3,  cols: 1 },   // 3 frames stacked
```

Ground marks (`decal-…`) use the same layout, but each frame is a **variant**: the game picks one at random for each
mark, so four variants stop the pockmarks from looking stamped. If it's easier to make separate frames
(`fx-explosion-00.png` … `-15.png`), send those: Claude Code will pack them into a sheet.

**Transparent, not black.** Effects packs are often made on a black background for "additive" glow. These must be on
a **transparent** background with soft, feathered alpha edges: fire and sparks in bright opaque colours, smoke and
dust semi-transparent. A black background will show as black boxes in the game.

| Key | What | Frame size | Frames (grid) | Plays over | How it's placed | On screen |
|---|---|---|---|---|---|---|
| `fx-muzzle` | Gun muzzle flash (Warbots, Bunker, and pointing up for the Mortar) | 256×128 | 4 (4×1) | 0.1 s | **points right**; the barrel's end is the middle of the left edge; turned to face each shot | 0.55 tiles long (Mortar 0.9) |
| `fx-tracer` | Bullet streak from the gun to the target | 512×64 | 3 (1×3) | 0.12 s | **points right**: gun at the left edge, target at the right; **stretched** to the shot's length | as long as the shot, ½ tile thick |
| `fx-impact` | Dust kicked up where a round hits the ground | 128×128 | 8 (4×2) | 0.55 s | the hit point is the centre | ⅔ tile |
| `fx-spark` | Sparks where a round hits a building | 128×128 | 6 (6×1) | 0.35 s | the hit point is the centre | 1 tile |
| `fx-smoke` | Smoke: gun smoke, blast smoke columns, missile and shell trails, burning | 256×256 | 16 (4×4) | 0.9 – 3 s | the source sits **⅔ of the way down**, centred; the smoke rises and spreads within the frame | 0.4 – 3 tiles |
| `fx-explosion` | The fireball of every blast | 256×256 (or 512×512) | 16 (4×4) | 0.6 s | ground zero sits **⅔ of the way down**, centred | 1.2 tiles (a robot), 2.3 (a mortar shell), 3.3 (a building), 6.6 (a missile) |
| `fx-debris` | Chunks of metal and concrete thrown out by a blast | 256×256 | 12 (4×3) | 0.9 s | the blast point is the centre; chunks fly up and out and fall back round it | 1.4 – 3 tiles |
| `fx-arc` | The Disruptor's electric arc | 512×128 | 6 (1×6) | 0.3 s | **points right**: the bolt must touch the middle of the left edge (the orb) and of the right edge (the robot); **stretched** to the distance | as long as the arc, ½ tile thick |
| `fx-dustcloud` | Dust billowing out as a building collapses | 256×256 (or 512×512) | 16 (4×4) | 2.2 s | the building's foot sits **⅔ of the way down**, centred | 2.2 tiles (the Command Base 3.5) |
| `decal-pock` | Bullet pockmarks in the ground | 64×64 | 4 variants (4×1) | fades over 25 s | centred on the hit | ¼ tile |
| `decal-burn` | Laser burn on the ground (Pulse Turret) | 64×64 | 4 variants (4×1) | fades over 30 s | centred | ⅓ tile |
| `decal-scorch` | Blast scorch mark | 256×256 | 4 variants (4×1) | fades over 35 – 70 s | centred | 0.8 – 3.4 tiles |
| `decal-rubble` | The ruins left where a building stood | 256×256 | 4 variants (2×2) | fades over 90 s | centred on the building's pad | 1.2 tiles (the Command Base 1.9) |

Notes on the table:

- **Directional effects** (`fx-muzzle`, `fx-tracer`, `fx-arc`) are drawn pointing right and the game turns them.
  Draw them flat-on, as if seen from above, with no shadow.
- **Stretched effects** (`fx-tracer`, `fx-arc`) are stretched to whatever length the shot is, from 1 to 10 tiles, so
  keep detail spread evenly along their length (no big blob in the middle) and keep the streak in the middle third of
  the frame's height.
- **Ground marks** are painted flat on the ground under everything, seen at the game's 70° camera, so a round crater
  is a slightly squashed oval (about ¾ as tall as it is wide). The game fades them out itself; draw them at full
  strength.
- **Sizes**: the game scales each effect to the size of the blast, so one explosion sheet does a robot and a
  Command Base. Use 512×512 frames for `fx-explosion` and `fx-dustcloud` if they look soft on big blasts.
- Export the big sheets as **WebP** to keep the download small (a 4×4 sheet of 256 px frames is 1024×1024).

**Effects brief (paste this first, in a new Claude Design chat)**

```
I'm making animated visual-effects sprite sheets for Terrafall, a mobile strategy game on a dusty orange-brown
alien planet, run by robots. The game is seen from a high three-quarter overhead camera, like a detailed
miniature: realistic, gritty industrial sci-fi, not cartoony. The effects should match: like real film VFX
(gunfire, dust, fire, black smoke, sparks), simplified into bold, readable shapes because each one is only a few
dozen pixels wide on a phone.

Every sheet is a grid of equal frames read left to right, then top to bottom, on a TRANSPARENT background (not
black): fire and sparks in bright, opaque colours, smoke and dust semi-transparent with soft, feathered edges.
Light comes from the top-left. The animation plays once and its last frame has faded to almost nothing. No text,
no frame borders, no numbers, no ground or background.

Palette: the fire is white-hot yellow at the core, orange, then deep red at the edges; smoke is dark charcoal
grey to brown-grey; dust is the colour of the planet's rust-ochre sand (#b8743f to #d9a066); metal debris is
gunmetal grey with a few hot orange edges.
```

Then ask for each one:

**`fx-explosion`**
```
An explosion sprite sheet: 16 frames of 256x256 in a 4x4 grid (1024x1024 overall). Ground zero is centred
horizontally, two thirds of the way down each frame. Frame 1: a small white-hot flash. Frames 2-5: a fireball
bursts up and out, yellow-white core, orange and red edges, flecks of burning debris. Frames 6-10: the fire rolls
upward into a mushrooming ball, darkening at the edges into thick black smoke. Frames 11-16: the fire dies, leaving
a rising, thinning cloud of dark smoke that fades to nothing. Fill most of the frame at its biggest, without
touching the edges.
```

**`fx-muzzle`**
```
A gun muzzle-flash sprite sheet: 4 frames of 256x128 in one row (1024x128). The gun barrel's end is at the middle
of each frame's left edge and the flash fires to the right, seen from above. Frame 1: a sharp, bright white-yellow
star-shaped burst with a cone of flame reaching two thirds of the frame. Frame 2: slightly bigger, orange at the
tips, with two small side flares. Frame 3: breaking up into orange tongues and a puff of grey smoke. Frame 4: a
faint wisp of smoke, nearly gone.
```

**`fx-tracer`**
```
A bullet-tracer sprite sheet: 3 frames of 512x64 stacked in one column (512x192). Each frame is a thin glowing
streak running the full width of the frame, through the vertical middle, about 6 pixels thick: hot yellow-white at
the right end (the bullet's head), fading through orange to transparent at the left. Frame 1: the full streak.
Frame 2: the tail half gone, the head still bright. Frame 3: only a faint short glint at the right end.
```

**`fx-impact`**
```
A bullet-impact sprite sheet: 8 frames of 128x128 in a 4x2 grid (512x256). A round hitting sandy ground, seen from
above at a steep angle, centred: a small sharp spray of sand and grit thrown up and outward, a few pebbles flying,
then a little cloud of rust-ochre dust that spreads, settles and fades. Frame 1 is a bright little puff; the last
frame is nearly transparent.
```

**`fx-spark`**
```
A sparks sprite sheet: 6 frames of 128x128 in one row (768x128). A bullet striking armoured steel, centred: a
shower of bright yellow-white sparks bursting outward in thin streaks, with a small white flash at the centre in
the first frame. The sparks fly further and fall slightly with each frame, turn orange, then go out.
```

**`fx-smoke`**
```
A smoke sprite sheet: 16 frames of 256x256 in a 4x4 grid (1024x1024). The smoke comes from a point centred
horizontally, two thirds of the way down each frame. Frame 1: a small, dense grey puff. It billows, grows and rises
toward the top of the frame, drifting a little to the right, turning from dark charcoal to lighter brown-grey and
more transparent, and breaks up into wisps that are gone by frame 16. Soft and volumetric, lit from the top-left.
```

**`fx-debris`**
```
A debris sprite sheet: 12 frames of 256x256 in a 4x3 grid (1024x768). From the centre of the frame, 8 to 10 jagged
chunks of broken concrete, twisted gunmetal plate and a few glowing hot fragments are thrown up and out in all
directions, tumbling, then fall back down and land in a rough ring round the centre, the hot ones cooling from
orange to grey. Each chunk casts a tiny soft shadow. Nothing leaves the frame. Fade them out over the last 3 frames.
```

**`fx-arc`**
```
An electric-arc sprite sheet: 6 frames of 512x128 stacked in one column (512x768). Each frame is a jagged,
branching lightning bolt running the full width, from the middle of the left edge to the middle of the right edge,
ice blue (#8fd8ff) with a white-hot core and a soft blue glow round it, with a few small side forks. Each frame is a
different random bolt shape (it flickers). Frames 5 and 6 get thinner and dimmer.
```

**`fx-dustcloud`**
```
A building-collapse dust-cloud sprite sheet: 16 frames of 256x256 in a 4x4 grid (1024x1024). The base of a
collapsing building is centred horizontally, two thirds of the way down. Thick billowing clouds of rust-ochre dust
and grey concrete powder roll outward along the ground in both directions and churn upward, with a few chunks of
rubble tumbling in it; at its biggest it fills most of the frame. Then it slowly thins, settles and fades,
transparent by frame 16.
```

**`decal-pock`**
```
Four small ground-mark variants in one row, each 64x64 (256x64 overall): bullet pockmarks in sandy ground, seen
from above at a steep three-quarter angle. Each variant is a cluster of 2 to 4 small dark craters with a lighter
rim of thrown-up sand, in a different arrangement each time. Transparent background, soft edges.
```

**`decal-burn`**
```
Four small ground-mark variants in one row, each 64x64 (256x64 overall): laser burns on sandy ground, seen from
above at a steep three-quarter angle: a glassy, blackened oval with a faint dark-brown scorched halo and a thin wisp
of a fading orange edge. Each variant a little different in shape. Transparent background, soft edges.
```

**`decal-scorch`**
```
Four ground-mark variants in one row, each 256x256 (1024x256 overall): a blast scorch mark on sandy ground, seen
from above at a steep three-quarter angle, so it's an oval about three quarters as tall as wide: a shallow dark
crater in the middle, charred black ground, radiating streaks of soot and blown sand, fading softly to transparent
at the edges. Each variant a different irregular shape.
```

**`decal-rubble`**
```
Four ground-mark variants in a 2x2 grid, each 256x256 (512x512 overall): the flattened ruins of a destroyed
industrial building, seen from the same high three-quarter camera as the buildings: a low heap of broken concrete
slabs, twisted rebar and steel beams, crushed pipes and a few scorched gunmetal panels with faded hazard stripes,
grey dust over everything, lit from the top-left. Low, almost flat: no wall stands higher than a robot. Neutral
colours, no team colour, no glow. Transparent background, the heap filling about 85% of the frame.
```

**Checking it in the game.** Put the files in `art/effects/`, add the lines to the manifest (with `frames` and
`cols`), or just send them to Claude Code to wire in. Then start a Versus game and send a few armed Warbots at a
rival building: you'll see the gunfire, and the blast and collapse when it falls. If an effect plays too fast or too
slow, tell Claude Code: each effect's length is one number in the code.

### Not swappable yet (ask Claude Code if you want these)

- Menu background and logo
- Laser beams, the white blast flash and the Pulse Turret's glow (the other effects are in Batch 15)
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
  Installed since: the Batch 14 defences, streetlamps (`streetlamp-road`/`-asphalt`, `-lit`, `-pool`) and the Pulse
  Turret's `fx-pulse-laser` and `fx-pulse-hit`. The Pulse Turret's charge-up sheets (`turret-charge-0…15`) wait for
  a **3D turret by day** (`turret@0/@1` base and `turret-head-0…15@0/@1`, anchor [0.5, 0.615], scale 1.4): the
  morning, evening and night sets exist, but the day art is still the flat top-down turret.
  Installed from the Fuel update: the **Tanker** (`tanker@0/@1-f0…f3`, `-brake`, `-boost`, time-of-day frames and
  `tanker-headlights`), the **Generator** (`generator`, time-of-day versions and the working loop `generator-work-0…7`,
  played at 8 fps while it runs; any building with `<type>-work-0…7` art gets the same), new **Freight Truck** frames
  with exhaust stacks, and the diesel smoke sheets (`fx-exhaust`, `fx-exhaust-heavy`, listed as `smoke-exhaust` and
  `smoke-exhaust-heavy`). Smoke points live in `art/emitters.js`: `EXHAUST_POINTS` (truck, tanker, Road Train stack
  tips) and `BUILDING_EMITTERS` (chimneys and vents, from the animation brief's `building-emitters.json`). Smoke and
  black smoke and steam use the exhaust sheets for now; flame, sparks and dust points wait for their own sheets.
  Still to make: the **pipe pieces** and the **fuel blast** (`fx-fuel-blast`, `oil-scorch`): prompts in
  `design/claude-design-fuel.md`.
  **Design system:** the Terrafall design system for making new art lives at
  https://claude.ai/artifact/GAdLBz6kefeJeTRz57TTV7 (it can be added to the Claude Code chat so art is designed there).
  Still missing: a 3D turret by day, resources `crop` and `oil`, ground
  `fertile`, `slope` and `cliff`, markers `missile`, `rally` and `oneway`, and the 12 goods icons

### Tips

- Make the Worker and Command Base first, then check them in the game before doing the rest. It's much easier
  to adjust angle, lighting and scale with two assets than with twenty.
- If a building looks too small or too big in the game, change its `scale` in the manifest rather than
  re-exporting. `scale: 1.2` draws it 20% larger.
- Stalk plants are drawn smaller while they are still growing; Ore and Crystal shrink a little as they are mined out.
