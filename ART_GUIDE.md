# Botfall art guide

Every building, bot, resource and ground tile now uses custom art (batch 1). Anything without an
image keeps a placeholder drawn in code, so art can still be added **one piece at a time**. The
remaining pieces are listed under [Batch 2](#batch-2-terrain-levels-and-goods-icons), [Batch 3](#batch-3-missiles-batteries-and-army-orders)
[Batch 4](#batch-4-fuel-farms-and-oil) and [Batch 5](#batch-5-robot-types-roads-and-ammo).

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
  (rival, red lights). This looks best for Warbots, Outposts and the Lander.

If it's easier, just send the finished files to Claude Code and ask it to wire them in.

### Technical specs (all assets)

| | Buildings and bots | Lander | Resources | Ground tiles |
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

> I'm making sprite art for a mobile strategy game called **Botfall**. Robots run a mining colony on a
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
| `munitions` | 256×256, transparent | Munitions Works: packs Alloy and Crystal into Warheads | A small armoured munitions plant: a blast-proof bunker with a conveyor of yellow-tipped warhead shells, a loading crane and hazard markings. Accent light: amber. |
| `silo@0`, `silo@1` | 256×256, transparent | Missile Silo (team versions) | A round armoured missile silo seen from above: a heavy split blast hatch, partly open, with a missile nose cone visible inside, launch-rail lights in the team colour, scorch marks around the rim. |
| `missile` | 128×128, transparent | A missile in flight (drawn facing **right**; the game rotates it) | A sleek missile seen from directly above, nose pointing right: grey body, yellow warhead band, small fins, and a short bright exhaust flame at the tail. |
| `rally` | 128×128, transparent | Your rally flag where warbots hold an area | A small planted marker flag on a metal pole, cyan #38d4ff banner with a chevron symbol, a little tripod base. |
| `icon-warhead` | 64×64, transparent | Warhead, in the top bar | A single yellow-tipped warhead shell. Bold, simple, thin dark outline. |

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
| `tarworks` | 256×256, transparent | Asphalt Plant: Crude + Stone → Asphalt | An asphalt plant: a black insulated tar tank over a glowing burner, a gravel hopper and a mixing drum, dark stains on the pad. |
| `roadworks` | 256×256, transparent | Roadworks: lays asphalt on paths | A road maintenance yard: a parked yellow road roller, cones and a small crew shed with a striped barrier. |
| `armory` | 256×256, transparent | Ammo Plant: Alloy + Stone → Ammo | A compact armoured ammunition press with brass shell casings on a conveyor and an amber hazard light. |
| `icon-cement` | 64×64, transparent | Cement, in the top bar | A small grey cement sack. Bold, simple, thin dark outline. |
| `icon-asphalt` | 64×64, transparent | Asphalt, in the top bar | A small dark tar block with a glossy highlight. Bold, simple, thin dark outline. |
| `icon-ammo` | 64×64, transparent | Ammo, in the top bar | Three brass bullets side by side. Bold, simple, thin dark outline. |

### Not swappable yet (ask Claude Code if you want these)

- Menu background and logo
- Effects (laser beams, explosions, smoke)
- App icon: to change it, replace `icons/icon-192.png` and `icons/icon-512.png` directly (square PNGs)

### Tips

- Make the Worker and Lander first, then check them in the game before doing the rest. It's much easier
  to adjust angle, lighting and scale with two assets than with twenty.
- If a building looks too small or too big in the game, change its `scale` in the manifest rather than
  re-exporting. `scale: 1.2` draws it 20% larger.
- Stalk plants are drawn smaller while they are still growing; Ore and Crystal shrink a little as they are mined out.
