# Terrafall art guide

Every building, bot, resource and ground tile now uses custom art (batch 1). Anything without an
image keeps a placeholder drawn in code, so art can still be added **one piece at a time**. The
remaining pieces are listed under [Batch 2](#batch-2-terrain-levels-and-goods-icons), [Batch 3](#batch-3-missiles-batteries-and-army-orders)
[Batch 4](#batch-4-fuel-farms-and-oil) and [Batch 5](#batch-5-robot-types-roads-and-ammo). To give every building a realistic 3D
industrial look, see [Batch 6](#batch-6-realistic-3d-industrial-buildings-a-full-restyle). For Colony wildlife, the Research Lab
and empty Silos, see [Batch 11](#batch-11-colony-wildlife-the-research-lab-and-empty-silos); for the Ropeway and Road Train,
[Batch 12](#batch-12-ropeway-and-road-train). The new defences are in [Batch 14](#batch-14-bunker-disruptor-tower-and-mortar-pit), and
weapon effects, explosions and building collapses (muzzle flashes, tracers, smoke, bullet pockmarks, rubble) in
[Batch 15](#batch-15-weapon-effects-explosions-and-building-collapses). The Hollow's art, the Murmur's tunnels and the new Fiber
and Oil are in [Batch 16](#batch-16-the-hollow-the-murmurs-tunnels-and-new-fiber-and-oil-installed); the Airship and
the Mooring Mast in [Batch 18](#batch-18-the-airship-and-the-mooring-mast-installed); the Maglev line in
[Batch 21](#batch-21-the-maglev-line-installed).

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

### Sunsets and sunrises (drawn in code; no images)

The owner's ask (Nov 20 2026): lighting is a big part of the game's look, so the sunsets should be beautiful and a little
different per biome. `js/sunset.js` lays a render-only layer over the day-and-night light: no new art, nothing to
re-render. Corvane sets in the west and rises in the east (the evening shadows fall east), so the land is lit from that
side of the screen and falls into a cool shade on the far side. The grade is soft light (the land keeps its contrast:
nothing is washed pale), a colour-dodge glow brightens the lit side's light tones, a multiply deepens the far side, and
over everything standing goes a lighter soft-light grade and the low sun's glare. The rules a new biome's palette
should keep (`DUSK_BIOMES`: three stops, `sun`, `tint`, `shade`, for golden hour, fire and violet):

| Biome | Sunset | Touches |
|---|---|---|
| The Rust (red desert) | deep amber to blood red, violet shade | glowing dust, heat haze easing off, glints on the pools |
| The Long Grass (savanna) | amber to red, violet shade | acacias silhouetted, gold dust, heat haze easing off |
| The Shoals (tropical) | blazing orange, then pink and magenta | the sea's sheen and a path of glints toward the sun, palms silhouetted |
| The Bloom | teal on the sun's side, violet away from it: no warm light at all | its glow wakes before night, spores drift up catching the light, shafts |
| Greenreach (forest) | soft gold to rose | gold light shafts through the trees, pollen |
| Blackwater (swamp) | dusty pink to mauve | pink fog banks over the ground |
| Emberwood (autumn) | rich copper to plum | shafts, pollen |
| The Polar Caps | pastel peach and pink, long blue shade | ice glints in the air |
| Cinderlands (volcanic) | ember red fused with the lava | the lava glows up early, embers rising |
| Steamwells | gold to rose | steam plumes lit gold, shafts through the steam |
| Argos (the moon) | none: no air to redden the light | the evening's warm cast taken out, a hard terminator sweeping east to west in a minute |
| The Hollow | none: it's underground | |

**Long shadows (Nov 2026 redraw, waiting for the owner's approval):** with the sun low every building throws a long, soft
shadow away from it (east at dusk, west at dawn), from half again its height in the golden hour to about four times it
as the sun sets (`duskCastShadows`): its own art as a flat silhouette (made once per building and team), sheared along
the light, drawn in one third-size layer in the shade's colour so crossing shadows don't double up. The plants throw
theirs too, up to about a tile long: the whole map's plant silhouettes (`duskSilBake`, now made in every biome with a
sunset) smeared along the light into the same layer. Not on Saver, Argos or the Hollow.

Dawn uses one cooler palette (violet, rose, pale gold) except the Bloom's own (violet, teal, mint), at about 60%
strength. The Ring shows as a faint pale arc low over the top of the view when zoomed out, after the land has gone
into shadow. Robots' drop shadows stretch and turn violet. Keep team colours, buildings and robots clear: the strong
grade goes on the ground, under the buildings, and the one over them is light and eases off zoomed far in.

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

### Command Deck interface

The look of the whole game's interface: Contingency's screens (the globe, its panels and sheets, the Campaigns screen and
the new run) and, since the Command Deck in game, everything over a game too (the top bar, goal card, minimap, Army Group
cards, tools, messages, panels, selection bar, the pause menu and the screens over a game), and the main menu. A ship's
command deck seen in the dark: glass readouts over the planet.

- **Two accents.** The game is the **coral Command Deck**: the main menu, its Custom Game setup, and everything in and
  over a game wear the app icon's coral (`#ff6b4a`, peach `#ffb08f`, warm white `#fff1ec` text, quiet text `#b4b9c9`,
  deep navy panels `rgba(12, 17, 30, 0.94)`, dark ink `#2a0d06` on coral). **Contingency is blue**: its globe and screens
  (`#screen-contingency`, `.cg-*`) keep the cyan Command Deck below, tinted by the player's callsign. Alarm red in the
  coral game is a magenta-red, `#ff4d8a` (a crimson `#d1205a` under white text), so a danger never reads as the accent;
  the Missions' light there is cyan `#38d4ff`, the one cool colour, so it stands out from everything coral. Amber stays
  the Daily Planet's and warnings', violet the Murmur's. Player and team colours on the map are untouched.
- **The main menu** (M2, the cinematic Command Deck): Ithaca I large in the middle, lit from the front by Corvane behind
  its left limb; the TERRA/FALL title top left in the icon's gradient (`#fff6ec` → `#ffb08f` → `#ff6b4a`, clipped to the
  text, a soft coral glow, never dimmed); one console docked along the bottom with Play as its coral cell; a bracketed
  rail on the right; a ticked ring and the planet's name on a leader line. Custom Game: a large preview, the settings
  as rows that open pickers (popovers, or sheets on a phone), Advanced folding out, Start docked. The same brackets,
  scanlines, Chakra Petch labels and monospace readouts as below, in coral.

- **Palette.** Panels `rgba(5, 12, 20, 0.9)` (near opaque: no backdrop blur, for speed), text `#e3f4fb`, quiet text
  `#93b4c4`. Accents in the player's callsign colour, `--c` (COBALT `#38d4ff`, VERMILION `#ff5a6e`, VIRIDIAN `#5be06c`,
  TYRIAN `#b36bff`): the panel hairlines, the corner brackets, section headings, lit diamonds and the primary button
  (dark ink `#031620` on it). Fixed meanings: amber `#ffc457` for warnings and charged weapons, green `#7ee08a` for
  income, violet `#c58cff` for the Murmur, yellow `#ffdc78` for orders, alarm red `#ff5a6e` for a battle.
- **Panels.** Square corners, a 1 px border in the accent at 20%, a 14 × 2 px bracket on each corner in the full accent,
  faint scanlines every 3 px, and a soft drop shadow. Rows inside are split by dashed hairlines. A faint 48 px grid and
  a vignette lie over the globe, and a ticked orbit ring round it.
- **Type.** Labels, headings and buttons in **Chakra Petch** (600 and 700, bundled in `style.css` as a 20 KB latin
  subset, OFL), labels uppercase with wide tracking (0.14 to 0.16 em). Numbers, logs and readouts in the system
  monospace (`ui-monospace`, SF Mono, Menlo, Consolas). Body text in the system sans.
- **Marks.** Status lights (8 px glowing dots), diamonds for Uplinks and stars, short bars for levels, segments for
  meters. Buttons are square, uppercase, at least 44 px tall, with a 2 px white focus ring.
- **In game.** Over the bright, busy map the panels are a touch more solid (`rgba(6, 12, 19, 0.94)`, with a 1 px dark
  outer line to lift them off it) and the accent is coral whatever your colour (cyan before Nov 24 2026); your callsign,
  first in the top bar, wears your colour. Brackets 14 × 2 px on a computer, 9 × 1 px on a phone. Labels over panel names have a status light
  (coral, amber for standby, magenta-red over a rival's building). The Missions' light is cyan (`#38d4ff`), an outline
  and a soft glow, so it never reads as a selected (coral) button. Army Group badges are diamonds, health a segmented bar.
- **The top bar holds still.** On a computer it is one row 40 px high that never wraps and never changes size as the
  numbers move: each goods counter is three digits wide whatever it holds, in tabular figures; the rate a minute sits
  small under the number, out of the flow; a shortage is a small magenta-red dot inside the counter's top right corner
  (and its ring), never a dot over the bar's edge. Short of room it gives up, in order, the rates (still in the counter's
  tip), the callsign block and the gaps (below 1600 px), then takes two fixed rows of seven (below 1270 px). Panels dock
  under the bar, never over its buttons. Coral in a list is for what needs you or is under way (the bot being built);
  a plain status ("none queued") is quiet grey.
- **Panels and screens fit the screen.** On a computer a long panel goes wider and lays out in two columns (three on a
  very wide screen); Missions, Statistics and the end of a game spread across the width rather than down it. Lists are
  compact: one line a row, small controls side by side (44 px tall to tap; under a mouse on a computer, 30 to 34 px).
  A panel's name line stays pinned at the top while the rest scrolls, its main buttons (Pause, Move, Dismantle) at
  the bottom, both on the solid panel colour with a hairline; a long description or hint shows two lines and a small
  coral **More**. Build's All is one wide panel of compact two-line cards (icon 28 px, name, then cost and how many
  you have) in columns under the tab names; Missions and Keys flow down four or five columns. Phones keep one column.
- **Where it lives.** The Contingency block of `style.css` (`#screen-contingency`, `.cg-*`), and the markup in
  `index.html` (`#screen-contingency`) and `js/contingency-ui.js`; in game, the "Command Deck in game" block at the end of
  `style.css` (all under `body.deck`, which `index.html` sets) and the few lines of markup README.md lists.

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
| `charger` | 256×256, transparent | Fuel Station: bots recharge their batteries here | A compact charging bay seen from above: four docking pads around a central power pylon with heavy cables, glowing green charge indicators and warning stripes. |
| `munitions` | 256×256, transparent | Missile Factory: builds Missiles from Alloy, Chips and Fuel | A small armoured missile factory seen from above: a blast-proof assembly hall with a half-built missile on a cradle, a loading crane and hazard markings. Accent light: amber. |
| `silo@0`, `silo@1` | 256×256, transparent | Missile Silo (team versions) | A round armoured missile silo seen from above: a heavy split blast hatch, partly open, with a missile nose cone visible inside, launch-rail lights in the team colour, scorch marks around the rim. |
| `missile` | 128×128, transparent | A missile in flight (drawn facing **right**; the game rotates it) | A sleek missile seen from directly above, nose pointing right: grey body, yellow warhead band, small fins, and a short bright exhaust flame at the tail. |
| `rally` | 128×128, transparent | Your rally flag where warbots hold an area | A small planted marker flag on a metal pole, cyan #38d4ff banner with a chevron symbol, a little tripod base. |
| `icon-warhead` | 64×64, transparent | Missile, in the top bar | A single small missile pointing up, grey body with a yellow nose band. Bold, simple, thin dark outline. |

### Batch 4: Fuel, farms and oil

Fuel Stations now burn Fuel, grown at a Bio Farm or refined from oil. Same brief and angle as batch 1.

| Key | Size | What it is | Prompt for Claude Design |
|---|---|---|---|
| `farm` | 256×256, transparent | Bio Farm: a worker plants and harvests energy crops | A compact agri-bot station seen from above: a seed hopper and a small greenhouse dome with grow lights, a pink fuel tank with hoses, and a robotic arm folded at the side. Accent light: magenta #ff5c8a. |
| `pump` | 256×256, transparent | Oil Pump, built on top of an oil seep | An industrial pumpjack seen from above at a slight angle: a nodding beam on an A-frame over a wellhead, black oil stains on the pad, yellow hazard paint on the beam. |
| `refinery` | 256×256, transparent | Refinery: Crude → Fuel | A small refinery: two round storage tanks (one rust-brown for crude, one magenta for fuel) joined by pipes, a short distillation column and a flare stack with a small flame. |
| `fueltank` | 512×512, transparent (3D, rendered here) | Fuel Tank: storage for Crude and Fuel, an oil bloc's hub | Three white domed storage tanks with crude-stained feet in a low concrete containment bund, a pipe manifold and a small pump house, team bands and roof beacons. |
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
1.5; most production buildings about 1.35; the Fuel Station, Repair Station and Pulse Turret about 1.25. Keep these proportions
between images too: a Fuel Station should look smaller than a Foundry.

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
of the Fuel Station. Accent colour: orange #ff9a3c.
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
side); ask Claude Code if you'd like those as art too. An overpass is drawn in two layers: its shadow on the
north-south road, and the east-west deck (with its approach ramps) among the robots, so traffic on the deck drives
over it and north-south traffic passes under it. Art for one would come the same way: a deck over a plain crossing.

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
copies of the Silo images for the empty ones. Make the Lab in the same Claude Design chat as Batch 6 (paste the Batch 6
style brief first, and attach the Smelter as the style anchor). The Murmur's nests and creatures are no longer made in
Claude Design: they come from the 3D renderer, built to LORE.md's art brief (see **The Murmur** just below the table).

| Key | Size | What |
|---|---|---|
| `lab` | 512×512, transparent | Research Lab (one version: the game adds the team bar) |
| `nest-1`, `nest-2`, `nest-3` | 512×512, transparent | The Murmur's Burrow (the nest) at levels 1, 2 and 3 (rendered: see below) |
| `scuttler-f0` … `scuttler-f3` | 256×256, transparent | Scuttler walking frames, facing right, no shadow (rendered) |
| `brute-f0` … `brute-f3` | 256×256, transparent | Brute walking frames, facing right, no shadow (rendered) |
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

**The Murmur: the Scuttler, the Brute and the nests** (rendered by `renderer/b/murmur_moles.js`, which uses the shared kit
`renderer/b/murmur_moleskit.js`, to the brief in LORE.md, "Art brief: the Murmur")

They are burrowing mammals, built from the star-nosed mole and the naked mole-rat. Fur, skin, soil and stone only: no
shells, mandibles, extra legs, wings or slime.

- **Body.** Low, heavy and barrel-chested, like a mole crossed with a badger: a deep chest under a hump of shoulder, a
  narrower waist and a low wedge of a head.
- **Fur.** Near-black velvet, dusted with Crystal grit that glints violet.
- **Face.** No eyes. In place of a nose, a star of 22 fleshy tendrils. It is gathered while they walk, and flares open
  and lights up violet when they find power.
- **Hands.** Huge spade hands turned outward, with four long jointed fingers, a thumb and heavy nails, a little too
  much like hands.
- **Crystal.** Eaten Crystal splits out through the shoulders and spine like broken geodes: a grey stone rind, a pale
  agate edge, and pale lilac crystal inside that glows violet. It glows when they are full of charge and goes dull when
  they are hungry; the game's raiders are drawn well fed (`charge=0.75`).
- **Palette.** Near-black fur, violet glow and pale lilac crystal, against the robots' clean lights.

Each class:

- **Scuttler** (the brief's Runners). The lightest build with the longest legs, and the mole-rat's buck teeth under the
  star. Geodes split out of each shoulder and in a seam down the spine.
- **Brute** (the Breakers). A huge barrel chest and shoulder hump. Its back is a mantle of geode stone split along the
  spine, with the crack packed with crystal and geodes along the mantle's edge. It has the biggest hands.
- **The nest** (`nest-1` to `nest-3`, the Burrow). A molehill of churned earth, ringed with crystal spires round a
  throat lined with crystal like a geode. Raised tunnel ridges branch away from it, with the Bloom's violet root-veins
  breaking through along them and pulses of light that show at night.
  - Level 1: a small heap with 3 spires and 1 tunnel.
  - Level 2: 6 spires and 3 tunnels.
  - Level 3: a giant mound with taller spires and more between them, 5 tunnels, and the tendril star of the Deep rising
    out of the throat.

Sprites follow the robots: seen from straight above, facing right, centred on the body, with no ground or shadow (the
game draws the shadow). Only the limbs move across the four frames, in diagonal pairs. The nests use the buildings'
camera, with no pad. Every one has morning, evening and night versions in `art/tod/<time>/` (the crystal lights up after
dark). The same scene also makes the Leech, Spitter and Sapper, the regional variants (`v=rust|white|bloom`) and the hero
shots: see `renderer/RENDERER.md` for all its options.

To re-render them and install them (from `renderer/`):
```
python3 tools/rerender.py 'units/(scuttler|brute)-f|buildings/nest-|lore/murmur-'   # renders and finishes every time of day
python3 tools/install_murmur.py out/rerender/art ../art                             # WebP into art/bots, art/buildings, art/tod, art/lore
```
`install_murmur.py` saves the sprites as lossy WebP at quality 80 (`--q`), and prints each file's size and the byte
totals before and after. The one-file build is close to its size limit, so keep the new set no bigger than the old.

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

Send them in a zip like the earlier batches (WebP or PNG). Claude Code will register them: the Lab with the same `B3D`
sizing as the other buildings, and the empty Silos replacing the current edited ones. (The nests use `B3D` too, picked
by their level, and the creatures' four walking frames play while they move.)

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

**Installed (Nov 2026 redraw, waiting for the owner's approval):** `fx-explosion`, `fx-muzzle`, `fx-impact`, `fx-spark`,
`fx-smoke`, `fx-debris`, `fx-dustcloud`, `decal-scorch`, `decal-pock` and `decal-burn`, painted with the effects library
like the fuel blast (`python3 renderer/fx/battle.py <outdir>`, which also runs `fx/explosion.py`; WebP, about 360 KB
together). The fireball (`drawBoomFx`) and muzzle flash (`drawMuzzleFx`) draw their sheet frame but keep, in code, their
light on the ground, a short hot glow and a few sparks; the blast's shock ring is now a soft band of light, not a drawn
line, and the fireball's late smoke thins sooner than the sheet's. Tracers, the Disruptor's arc and `decal-rubble` are
still drawn in code. Remove a line from the manifest to get the code drawing back.

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

**The war on the land** (`js/warfx.js`, all drawn in code, no sheets): what a fight leaves in the air and on the
ground after the effects above are over. The owner's theme: the immense beauty of the planet, torn apart by war, and
healing.

| What | Look |
|---|---|
| Smoke column (a building burned down, a burning wreck, a big blast) | Lumpy billows (`wfxSmoke`: sooty brown-black low down, pale grey up high, shaded at night) rising up to 9 tiles, spreading and leaning further downwind the higher they get; faint at the foot (the robots under it show), thinner zoomed in, lit orange from under while its fire burns. Columns within 1.8 tiles join. Lasts about 3½ minutes (a robot's wreck about 2), thinning over the last part |
| Ground fire | Teardrop flames (`wfxFlame`) licking up from scorched grass round a wreck, a thin curl of smoke off each; a tree on it burns higher and longer. At dusk and night each throws the light pool, flickering, on the ground and buildings round it |
| Ash and embers | Grey flakes drifting downwind and settling, orange embers floating up and winking out (glowing at night), over the 6-tile cells where things burned and blew up |
| Shockwave | An ellipse racing out along the ground to 3.2 × the blast's reach: a dusty band behind a bright warm edge, and a fainter dusty ripple; a flash over the area and briefly the screen (brighter at night; a nuclear blast keeps its own). Reduced motion: no flash, a fainter, slower ring |
| Burning oil (an Oil Pump, Refinery or Fuel Tank destroyed by force) | A roaring jet of flame from the wellhead: one long tongue the whole height with tongues of fire tearing up it, white-hot at its foot, swaying a little with the wind, sooty smoke torn off its top into a thick black column. Blackened, oil-soaked ground round it (`wfxSootBlot`); the ruin drawn in code: a charred wellhead stump and its pumpjack's fallen beam, or a burst tank's blackened shell, red embers for a minute after the flame dies. A tank's flame is lower and wider. At night two flickering light pools, strong. If art is ever made: `fx-oilfire` (a looping jet sheet) and `oilwell-ruin` would replace the code |
| Healing ground | Baked into the ground with the scars (`paintScarHeal`): the scorch and ash drawn fainter step by step (glass less), grass tufts in the biome's colours, then small flowers (white, yellow, pink, violet by biome: `WFX_BLOOM`), thickest on crater rims. Craters, stumps and scrap stay as they are |

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

### The Contingency globe (`art/globe/`)

The owner's pick of three concepts (Nov 23 2026, concept A, "Satellite"): Ithaca I as a satellite would see it, real
coastlines with bays and islets, relief, polar ice, clouds, the sea shading from shelf turquoise to deep blue, lit from
the upper left with a soft terminator, the glint of the sea and a thin halo of air; the territories as smooth borders
over it, each owner's land tinted (soft, stronger at the edge) and outlined in its colour with a dark casing.
Drawn by `js/contingency-draw.js` (README: Contingency, the screens).

| File | Size | What |
|---|---|---|
| `globe/ithaca-2048.webp` | 2048×1024 | The surface, equirectangular (longitude −180° at the left edge, north up): each region's colours and detail (the Rust's dunes, mesas and salt pans, Greenreach's forest, Emberwood's reds, the Long Grass, Blackwater's wetlands, the Cinderlands' flows and Cinder Rift's graben, the Steamwells' vents, the Shoals' islets and reefs, the Bloom's veins), rivers, beaches, the atlas's craters and Ringfall Basin, the caps' ice and floes, the relief baked in as hillshade from the north-west. Alpha is the land (255; 224 the sea), for the sea's glint. About 300 KB: the one fetched by default. |
| `globe/ithaca-4096.webp` | 4096×2048 | The same, sharper: fetched only when the globe is over 1100 device px across (a big or sharp screen) and the GPU takes it. About 790 KB. |
| `globe/ithaca-clouds.webp` | 1024×512 | The clouds' cover as grey (zonal bands, wisps), turned 0.45 of the way round on the globe at the start (`CGL.cloudShift`), then drifting slowly east over the ground (below). It wraps left to right, so it can turn for ever. About 13 KB. |

How they're made (reproducible, no randomness outside fixed seeds): `python3 tools/atlas/globe_texture.py` (W 4096 by
default, about 5 minutes on 4 cores; numpy, scipy, Pillow) evaluates the atlas's own fields at every texel
(`tools/atlas/globe_planet.py`: the same value noise, territories and coast calibration as `atlas.py`, plus fractal
coast detail, relief and the region palettes), writes the three files and recolours `lore/ithaca-map.webp` (run
`atlas.py` first if that needs remaking). The outlines are `python3 tools/atlas/globe_borders.py` (a few seconds):
each territory's edge (where its score meets a neighbour's, the smoothed coast a little offshore, or the caps' edge)
traced with marching squares on a 2048 × 1024 grid, simplified and delta-coded into `js/contingency-globe.js`; its
picks agree with the atlas's `CONT_CELLS` on 99.9% of their land cells. To change the look, edit the palettes and
detail in `globe_texture.py` (`PAL`, the per-region blocks) and the light, halo and glint in the shader
(`CGL_FS` in `js/contingency-draw.js`). In the one-file build the pictures are `dist/globe.js` (2048 and clouds) and
`dist/globe-hd.js` (4096), fetched when Contingency first opens.

**The clouds drift** (the owner's loose end, Nov 23 2026): they are a layer of their own over the ground, turning a
little faster than it, east, so the globe reads as having weather: `CGL.cloudDrift` (1/1100 of the way round a second,
a lap in about 18 minutes; by the page's clock, never the run's), still when the device asks to reduce motion. The
picture moves as a whole (no bands sliding at different speeds, which would smear it over a long session). In WebGL only
the planet's canvas is drawn again, each `CGL.cloudStep` (0.5) device px of drift; the per-pixel globe keeps the shaded
planet without its clouds and lays them over it again, a few rows a frame, every `CGL.flatCloudMs` (240 ms). To make
them faster or slower, change `cloudDrift`; to make them read more as weather, the cover itself (thicker bands, more
breaks) is in `globe_texture.py`.

### The Lore guide's pictures (`art/lore/`)

The main menu's Lore guide (`#screen-lore` in `index.html`) shows a few pictures of its own. They are plain `<img>`
tags (with `data-src`, loaded when the guide first opens), not manifest keys: to change one, replace the file at the
same size, or point the tag at a new one. Keep them small (WebP; the atlas, the largest, is about 250 KB).

| File | Size | What, and how it was made |
|---|---|---|
| `lore/ithaca.webp` | 1280×720 | Ithaca I from orbit: the coral-red patchwork of regions, the bright Ring (the planet's shadow across it, its own shadow on the planet), Argos, ringfall streaks, Corvane flaring top left; colony lights in the four callsign colours, lava and the Bloom glowing on the night side. `renderer/b/lore_planet.js` (`node run.js out/lore 'lore_planet:::ithaca:w=2560&h=1440'`, from `renderer/`), then `python3 post/lore_planet.py out/lore/ithaca.beauty.png ../art/lore/ithaca.webp --q 86` (ringfall, bloom, a Kuwahara filter for the painted look, grain, vignette). |
| `lore/atlas.webp` | 2400×1620 | The atlas of Ithaca I (LORE.md: The atlas, approved by the owner): every region, territory, sea and named place, the ringfall belt, Argos in the corner. Made by `tools/atlas/atlas.py` (writes `tools/atlas/out/ithaca-atlas.png`, then WebP); shown on the guide's The atlas page, a tap enlarging it. `lore/atlas-globe.webp` (1760×680): three views of the globe from it (`tools/atlas/globe.py`). |
| `lore/ithaca-map.webp` | 512×256 | Not in the guide: the menu planet's face (`js/menuplanet.js`, and the Contingency globe without WebGL), equirectangular (longitude −180° at the left edge), with no labels or borders. Its alpha holds the night lights (255 none, 254–225 ever brighter). Written by `tools/atlas/atlas.py` itself (`menu_map`), then recoloured from the Contingency globe's surface by `tools/atlas/globe_texture.py` (its lights kept where there is land), about 28 KB; inline in the one-file build (`window.ITHACA_MAP`). |
| `lore/region-<biome>.webp` | 480×270 | A patch of each region's ground (`desert`, `jungle`, `polar`, `autumn`, `savanna`, `swamp`, `volcanic`, `lunar`, `alien`), screenshots of the game's own map in daylight at about 54 px a tile. |
| `lore/murmur-<class>.webp` | 480×360 | The Scuttler, Brute, Leech (feeding, with the power line it drinks from), Spitter and Sapper at night, 3/4 view, built to LORE.md's art brief. Made with `renderer/b/murmur_moles.js` (`hero=1&hi=2&tod=night`, the Leech `pose=feed`), bloomed with `compose_any.py --b1 12 --b2 34 --glow 1.3`, then cropped round the animal to 480×360 WebP by `renderer/post/murmur_lore.py`. The exact jobs are in `renderer/jobs.txt`; `tools/rerender.py 'lore/murmur-'` remakes them. |

The guide also shows the game's own `buildings/lander@0`, `lander@1`, the night Trade Post, Uplink, Command Base and
*Wren* (`tod/night/...`); the Ithaca I page's catalog plate and the four callsign emblems are inline SVG in the page.

### Batch 16: the Hollow, the Murmur's tunnels, and new Fiber and Oil (installed)

Rendered with the renderer in this repository (`renderer/tools/render_install.sh`, then `renderer/tools/install_art.py`
writes the WebP files; the design sheets came from `renderer/preview/hollow_sheet.py` and `resource_sheet.py`).

**The Hollow** (biome key `hollow`, `art/biomes/hollow/`, the chasm pieces in `art/canyon/*-hollow`). Every key ends
`-hollow`, so it all loads only when the Hollow is played (`LAZY_BIOMES`; in the single file, `dist/biome-hollow.js`
beside the page). It is always night there: the ground and anything drawn with it are lit like the other biomes' and
graded by the night light, with `-glow` images for what gives its own light; the standing pieces are night renders,
drawn as they are (`TOD_NEVER` takes in keys ending `-hollow`).

| Key | What | How it's drawn |
|---|---|---|
| `ground-hollow`, `water-hollow`, `rock-hollow` (+ `ground-glow`, `water-glow`) | Cave floor of grey-violet silt and worn stone flags under the Bloom's moss and root-veins; black lakes with the roof's Bloom reflected; the black cave wall | 512 seamless, as every biome; the rock darkens toward the middle of a mass (`hollowRockDark`) |
| `cliff-hollow`, `wall-hollow` | A ledge face (128×48); the cave wall's face where rock meets floor (128×64, new) | `wall-hollow` on a floor tile under a rock tile, 0.7 of a tile tall (`hollowWall`) |
| `chasm-*-hollow` | The canyon set, its void deeper than any surface canyon's | as the canyon set |
| `plant-hollow-1…6` (+ `-glow`) | Bracket fungus, geode puffballs, a tendril star, gypsum cave flowers, a dripstone, a spore cushion | as every biome's plants |
| `vein-hollow` (+ `vein-glow-hollow`) | The Bloom-vein node, the Hollow's Fiber: root-veins heaving out of the floor round three glowing bulbs | the resource `vein`'s art, 1.4 tiles, anchor [0.5, 0.6145] |
| `floater-hollow` (+ glow) | A floating Crystal mass: a raft with a crust of lilac crystal on top, a crystal beard and roots below | 8.3 tiles, over each mass in `S.hollow.masses`, drawn with each tile under it but only on the platform and the chasm round it (`hollowDecorTile`) |
| `chamber-hollow` (+ glow) | A side chamber's floor: robot parts laid out in rows | 3.35 tiles, over each of `S.hollow.chambers`, on open floor only |
| `pillar-1-hollow`, `pillar-2-hollow` | Stone pillars with spiral grooves the Bloom climbs, fading up into the dark | 3.3 tiles, anchor [0.5, 0.8], on each of `S.hollow.pillars` (`drawPillar`) |
| `deep-mound-hollow` | The Deep's mound: the Burrow's level 4, its tendril star risen | 5.6 tiles at the nests' size (`drawMound`) |
| `breach-light-hollow`, `breach-beam-hollow` | The pool of daylight under a breach (a soft mask) and the column of pale gold with dust | under the mask the baked ground shows as by day, warmed (`drawBreachLight`, `drawDayGround`); the column is added over everything (`drawBreachShafts`), 2 × (radius + 0.6) tiles wide, twice as tall, its foot at 0.86 |

The night glow map also carries a faint light along a black lake's shore, a chasm's lip and the foot of a cave wall
(`hollowTileGlow`).

**The Murmur's tunnels, on every map.** The ridges are drawn in code as smooth curves (`tunnelRuns`, `paintRidges`,
`paintRidgeVeins` in `js/render.js`; `renderer/tunnels/ridges.js` is the reference): each run of a network between forks
and ends is one curve through its tiles, each tile's point nudged off its middle, the earth in the ground's own colour,
tapering where it's still digging, the veins glowing at night with pulses running back to the nest. The curves are
smoothed so they sweep across the tile grid, and zoomed in they're drawn live at the screen's own resolution (filled
outlines, layer by layer), so they stay crisp at any zoom; zoomed out they come from a baked layer, of which only the
blocks round the tiles that changed are drawn again. The redraw (Nov 2026; proposal): loose spoil spilled either side,
paler and drier than the ground with a damp foot; the shaded flank down-right; the back rounded in narrower, paler bands
toward a pale crest; and here and there a short fissure off the crest where the crust split, with a pale lip (all in
`paintRidges`, baked as before). Exits are art: `tunnel-exit` (1.05 tiles, anchor [0.5, 0.6145], with
morning, evening and night versions) and `tunnel-exit-collapsed` (drawn with the ground while it stays shut).

**Fiber and Oil, on every map** (`art/resources/`). Fiber's Stalks are now **Reedcane**: a clump of jointed sage-teal
canes with mint plumes. `stalk` is full grown and `stalk-1`, `stalk-2`, `stalk-3` show it a quarter, half and three
quarters grown back, drawn full size (`stalkKey`); `stalk-glow` and `stalk-3-glow` are the plumes' light at night. All
192 px (glows 128) to keep the page small. Resources are graded with the ground at night, so they have no time-of-day
versions; their light is in the night glow map (`resourceGlow`). (This batch's Oil look, soaked dark ground with the
Pathfinder's survey stake on each tile, was replaced in Batch 20 by a puddle of crude made in code; the `oil`, `oil-glow`
and `oil-seep` images are gone.)

### Batch 17: the Leech, the Spitter and the Sapper, and the Murmur's light (installed)

Rendered with `renderer/b/murmur_moles.js` (the owner approved the forms sheet, `renderer/preview/forms_sheet.py`), then
`renderer/tools/install_murmur_forms.py` writes the WebP files (RENDERER.md, "The Leech, the Spitter and the Sapper").
Every Murmur key (the Scuttler's and the Brute's too, re-rendered with the rest) loads only in a game with the Murmur:
`ensureMurmurArt` in `js/render.js`, and in the single file the bundle `dist/murmur.js` beside the page, with their
morning, evening and night sets (`MURMUR_TOD_KEYS` in `art/tod/tod-keys.js`).

| Keys | What | How it's drawn |
|---|---|---|
| `scuttler-f0…3`, `brute-f0…3`, `leech-f0…3`, `spitter-f0…3`, `sapper-f0…3` | Walking frames, 256×256, straight down, facing right, no ground or shadow | The frame `MURMUR_LOOK.size` tiles across: Scuttler 0.62, Spitter 0.73, Leech 0.81, Brute 0.82, Sapper 0.9 (true to one another but the Brute, shrunk to fit the map), turned to face, a shadow under it |
| `leech-feed-f0…3` | Feeding: the star pressed to the power, pulsing open and lit, the sac swelling with each draw | Looped while `u.pose` is `feed` (0.18 s a frame) |
| `spitter-spit-f0…3` | Wind-up (head back, pouches swollen and burning), the spit (jaws wide, the volley leaving), recoil (head thrust on, pouches emptied, the last grit leaving), recovering | `spit`: 0.42, 0.14, 0.2 and 0.24 s |
| `sapper-dig-f0…3` | Digging in, nose first: each spade hand in turn thrown up and back with a load of soil, clods in the air over its back, a crater of fresh soil round the hole | `dig`, 0.13 s a frame |
| `sapper-under-f0…3` | Under the ground: only a dome of soil heaving and splitting, a short ridge behind it, crystal chips turned up in the cracks | `under`, 0.22 s a frame, only within sight of the colony (6 tiles of its buildings, bots or lamps); its fresh ridge is drawn behind it in code, like the tunnels |
| `sapper-up-f0…4` | Coming up: the ground bursting, star and fingers breaking through, head and hands out, shoulders, climbing out | `up`, 0.17 s a frame, once, held on the last |
| `<every key above>-glow` | The crystal's light alone (and the Leech's sac, the Spitter's pouches): the night render's glow pass, bloomed, one gain per creature | Added over the sprite (`murmurGlow`) as bright as it's charged (`u.charge`), weak by day and full at night, breathing |
| `fx-spit` (+ `fx-spit-glow`) | The Spitter's volley in flight: five knots of crystal shards trailing grit, pointing right | 0.6 of a tile across, from the Spitter to its target over the effect's life, its light added at night |
| `fx-spit-hit` | The volley striking: 8 frames of 128 in a row (a violet-white flash, splinters flying back, charge crawling over the struck face, embers), from `renderer/fx/spit_impact.py` | One tile across, turned the way the volley came |

The sprites are rendered hungry (`charge=0.3`): their light is added by the game, so a hungry one is dull and a full
one burns. Everything else is drawn in code: the violet light on the ground round every Murmur at dusk and night
(the light pool tinted `WILD_COLOR`, as bright as it's charged), lamps and building glow dimming where a Leech drinks, a
shorted building's dark gun and the arcs crawling over it, and the Sapper's fresh ridge. The Lore guide's Spitter
(`art/lore/murmur-spitter.webp`) was rendered again for its brighter pouches.

### Batch 32: the atlas's landmarks (installed)

Rendered with `renderer/b/landmark.js` (`renderer/tools/render_landmarks.sh`, then `renderer/tools/install_landmarks.py`
writes the WebP files and prints each frame's scale and anchor; `--sheet` makes a review sheet). The set pieces of a
Contingency battle (`js/landmarks.js`, README, Contingency), at true scale (10 world units a tile) in the buildings'
57-degree view; the town's ground, Glass Lake and Silent Crater straight down. No ground is drawn: an invisible floor
hides what's buried, soft stains blend each foot into the map. Every key starts `lm-`, so it all loads only in a battle
with a landmark (`ensureLandmarkArt`; in the single file, `dist/landmarks.js` beside the page, with its morning,
evening and night sets: `LANDMARK_TOD_KEYS` in `art/tod/tod-keys.js`). About 670 KB in all.

| Key | What | How it's drawn |
| --- | --- | --- |
| `lm-hull` | The Pathfinder's hull: the long white joint lander lying half-buried, its Accord stripe faded, the seed vault's hatch open, drift sand banked along it | 7.96 tiles, its middle on the line between the two rows of its 5 × 2 tiles |
| `lm-spire` (+ `lm-spire-glow`) | The Ring Shard Spire: a curved slab of the Ring driven in, a tall lilac crystal spire out of it, crystals and rubble round its foot | 5.54 tiles, anchor [0.5, 0.8]; its glow added, breathing, faint by day and full at night |
| `lm-pillar-1…3` | The Stone Forest: banded red sandstone columns, worn and faceted; 3 a hoodoo with its cap | 2.38 tiles, one on each pillar tile |
| `lm-falls` | The Long Falls: the lip of the cliff, the water going over it and the foam in the pool | 4.31 tiles at the cliff's foot (the cliff is the map's rock, the pool and stream its water); streaks and spray animated in code |
| `lm-geyser` | The Clock Geyser: the sinter cone and its terraces, cream to rust, warm pools stepping down, the dark vent | 4.02 tiles; the eruption (a column of steam, the seething before it) drawn in code from the simulation's clock |
| `lm-house-1…3` | Passenger Town's houses: small bungalows, gable roofs (red, slate, green), porch, door, hedge, mailbox; the windows lit at night | 1.72 tiles, on each house tile |
| `lm-sign` (+ `lm-sign-glow`) | The welcome sign: WELCOME TO ITHACA, PASSENGER TOWN, a flower bed; lit at night | 1.82 tiles; its lettering's glow added after dark, flickering now and then |
| `lm-town`, `lm-town-s` | The town's ground: mown lawns, the street with its faded centre line and grass in the cracks, sidewalks, walks | 9 tiles square, straight down, with the ground (the compact town: one row of houses) |
| `lm-lake` | Glass Lake: clear ice, dark over the deep, bubbles, cracks, snow drifted at its rim | 12 tiles square, straight down, with the ground |
| `lm-crater` | Silent Crater: the bowl, its rim and central peak, scattered rocks, fading into the ground | 8 tiles square, straight down, with the ground |
| `lm-shaft` | A shaft of the Breach Fields: a hole down into the Hollow, its lip of heaved earth crusted with violet crystal, root-veins running over the edge | 1.61 tiles; a violet breath of light over it in code |
| `lm-wreck-kestrel`, `-survey`, `-halvard` | The failed landings, half-buried, the hatch toward you: the *Kestrel* (a boxy cargo lander broken in two, in the reeds), the *Ninth Survey* (a slim craft, its antenna mast and dish, under ash), the *Halvard* (a relay tender nose-down, red-gold leaves in its open bay) | 4.94 tiles over its 3 × 2 tiles; a ring fills at the hatch while it's held |

### Batch 31: the Harrow, the behemoth (installed)

The owner chose direction A of the behemoth sheet (design/behemoth/BEHEMOTH-SHEET.md): **the Harrow**, the walking siege
mound, with two borrowings (Scuttlers riding in its spine crack, a cave-in crater where it comes up). Rendered with
`renderer/b/murmur_behemoth.js` (`c=harrow&game=1`: every pose centred on the body like the walk, the ground effects
left to the game) at 1024 and composed to 512 by `renderer/tools/render_harrow.sh`, hungry (`charge=0.3`), at every
time of day; `renderer/tools/install_harrow.py` writes the WebP files and the glow images. In the Murmur's lazy bundle
with the rest of them (`MURMUR_ART`, `MURMUR_TOD_KEYS`, `dist/murmur.js`). Made a fifth smaller on the map (Nov 22
2026: 6 tiles to 4.8), its frames went from 640 to 512 (the same pixels a tile), which paid for the new ones: 20 keys
instead of 13 for about the same bytes.

| Keys | What | How it's drawn |
|---|---|---|
| `harrow-f0…7` | Walking, half a step a frame (`f=0, 0.5 … 3.5`), its body dipping as each pair of feet comes down and its shoulders rolling with the leading hand: a badger-mole the size of a hill, its back a mantle of banded geode plate split down the spine where a ridge of crystal spires stands, the core lit through seams in the plate, plated neck and flanks, hands the size of a Hauler, the jaws open on a lit throat. 512×512, straight down, facing right, the frame 18 world units | `MURMUR_LOOK.harrow`: 4.8 tiles across (its body about 3.6 by 2.4), turned to face (swinging round at 1.8 radians a second), a shadow 3.4 by 2 tiles under it, 6 walking frames a second; standing, f0 breathing (a slow swell, its glow with it: `harrowMotion`, `harrowBreath`) |
| `harrow-slam-f0`, `-f1` | Rearing (the front of it up, hands raised and spread, the star flared) and the slam (hands flat on the ground ahead) | `HARROW_POSES.slam`: `HARROW.rear` s, then 0.6 s; its glow flaring. In code: a crouch first (drawn a little smaller and back), rising toward you as it rears, trembling at the top, then squashed into the ground as it lands; the screen shakes |
| `harrow-bite-f0` | The bite: lunging, head low and forward, jaws thrown wide on the lit throat, one hand swiping ahead | Half a second after each blow (at a robot or a building: `u.cd`), lunging forward 0.2 of a tile and back; its throat's glow flaring |
| `harrow-hurt-f0` | Flinching: head down, rolled away, the star clenched, the jaws wide | `hurt`, after a blow of 6 or more; its glow stuttering |
| `harrow-die-f0` | Dying, staggering: reeled back and rolled, head down, jaws wide, cracks of light racing across every plate (the seams and eight more, blazing) | `HARROW_DEATH` (`drawHarrowDying`): the first 0.9 s, swaying, its glow stuttering and racing out from the core (the glow clipped to a growing disc) |
| `harrow-die-f1` | Toppling onto its side, half its spires snapped off, the light in its seams going | 0.9 to 1.9 s, rolling a quarter tile to its side; the snapped spires are code: 28 shards flung out, tumbling, landing and fading (`drawHarrowDeathFx`) |
| `harrow-fall-f0` | Dead: rolled onto its side, limbs limp, the light gone, spires broken off beside it | Its body where it fell (`S.mur.husks`) from 1.9 s (the thud: a ring of dust in code, the screen shaking), its core gathering light, bursting at 2.8 s (a violet flash and shockwave in code) and going dark; fading out over its last 10 s |
| `harrow-up-f0…2` | Coming up out of the ground: the ground bursting with only its spires and hands through, head and shoulders out, climbing out; a crater of broken earth, torn slabs and lit cracks round it | `up`, `HARROW.up` s, once |
| `harrow-crater` | The cave-in crater it leaves: a dark throat, a heaped rim, torn slabs, cracks lit faintly | On the ground where it came up (`S.mur.craters`), 4.8 tiles, fading over its last minute (`HARROW.crater` s); its light at dusk and night. It stays open as a tunnel exit, so the exit's own art stands in its middle until warbots collapse it |
| `harrow-cracks` | The slam's broken ground: a disc of split earth, the cracks lit violet, slabs heaved up | Where it slammed (`S.mur.cracks`), 6 tiles (`HARROW_CRACKS`: the slam's reach, which didn't shrink with it), fading in 20 s, its light strongest at first |
| `<every key above>-glow` | The crystal's light alone: the night glow pass, bloomed, one gain for every frame | Added over it as bright as it's charged, by day faint and full at night |

Drawn in code: its light pool at dusk and night (7.5 tiles across, `L.light`), the Scuttlers riding on its back
(`drawHarrowRiders`: the Scuttler's own art, 0.45 of a tile, curled along its spine, one fewer each time two jump off), its hp
bar (2 tiles wide) and its ring on the minimap. The slam's dust, ring and flash are the game's own effects.

### Batch 18: the Airship and the Mooring Mast (installed)

The owner chose direction C from the design sheet (`renderer/preview/airship_sheet.py`): the **armoured blimp** and the
**armoured pylon**. Rendered with `renderer/b/airship.js` and `renderer/b/mast.js` (`v=c`), both teams, at every time of
day, by `renderer/tools/render_airship.sh`; `renderer/tools/install_airship.py` writes the WebP files (jobs.txt lists
each one; RENDERER.md, "The Airship and the Mooring Mast").

| Key | What | How it's drawn |
|---|---|---|
| `airship@0`, `airship@1` (+ morning, evening, night in `art/tod/<time>/bots/`) | The armoured blimp: a stubby, flattened envelope in the Cargo Plane's and the Bomber's armour (gunmetal plates, team-colour strips along its creases, an armoured hood with a sensor visor and lit bridge windows), four ducted lift fans on pylons at its corners, a V-tail; its cargo pod is under the belly, out of sight. Straight down, facing right, 512 px, 30 world units across | `drawAirship` (from `drawPlane`, so a falling wreck's stand-in draws too): 3 tiles across × (0.94 + 0.1 × its height), so a touch bigger as it climbs off a Mast and smaller as it comes down; the hull runs about 2⅓ tiles. Turned to its heading. Moored it hangs at the Mast's mooring cup, 0.75 of a tile up the screen (the cup's mark, [0.5, 0.08] of the Mast's art; `AIRSHIP.lift`), its nose (the art's `dock` mark, 0.3855 of the frame ahead of its middle: `AIRSHIP.nose`) at the cup and its body lying back along the line; it rises off the cup and settles onto it in place, its shadow falling further off as it climbs |
| (code) | Its four lift fans turning | The `fan0`–`fan3` marks (fractions of the frame from its middle, `AIRSHIP_ART.fans`): over each, a dark blur over the art's still blades and three blades sweeping round with a fading motion trail, faster in the air, darker at night (`drawAirshipFans`); none when a fan is under 2.5 px |
| `airship-shadow` | Its silhouette (the day render's alpha), softened, 256 px, black | Down-sun of it like a plane's shadow: 0.8 of a tile down (and 0.7 of that across) moored, 1.05 cruising, at about 0.3 by day and fainter at night |
| (code) | Its light at night | The light pool, in its team colour, on the ground where its shadow falls (the night render's windows, nav lights and strips are in the art) |
| `mast@0`, `mast@1` (+ morning, evening, night) | The Mooring Mast: a faceted concrete pylon banded in armour, a fuel line up its side in glowing Fuel-orange collars, an armoured clamp head under the mooring cup; at its foot a bunkered loading bay with a lit blast door, a cargo lift and blast walls | `B3D`: one tile (scale 1.4, anchor [0.5, 0.615]), like the other buildings; its site is the shared `site` art |

The line between a linked pair is drawn in code: dashed, in its owner's colour, from mooring cup to mooring cup, while
either Mast (or one of its Airships) is selected, its dashes running along it (`drawMastLine`). The Airship's
load (goods and riders) is shown on its panel, not on the sprite: the pod hides it.

### Batch 19: crash sites, the wrecks aircraft leave (installed)

An aircraft Flak brings down falls burning and crashes, and its wreck lies where it came down for the rest of the game
(`S.wrecks`; README, "Aircraft shot down"), overgrowing slowly by biome. Each aircraft has its own crash site: its
broken, burnt airframe lying on the ground at the angle it came in. They were rendered here from each aircraft's own
scene with `renderer/b/wreck.js` (RENDERER.md: the `wreck` scene, its `c=` and `w=`, and the jobs in `jobs.txt`).

| Key | What | How it's drawn |
|---|---|---|
| `wreck-cargoplane` | The Cargo Plane, come down belly first: the nose broken off at the flight deck, swung aside and dug in; the tail snapped behind the wing and twisted away, its T-tail knocked flat; the right wing folded down onto the ground; the left wing missing its tip and its outer engine (they broke away in the fall: the engine lies on its side beside it); the roof burned through behind the wing, its frames showing. 512×512, 26 world units across (2.08 tiles) | Straight down, nose right, no ground, its own soft shadows baked in. Centred on where the wreck lies (`S.wrecks` x, y), turned to its heading (`a`), drawn `scale` tiles across (`ambWreckArt` in `js/ambient.js`, from `drawRemains`, over the burnt ground and under the growth) |
| `wreck-bomber` | The Vulcan Bomber: radome and canopy broken off and rolled ahead, the right wing's tip pod gone, the left fin flat on the ground beside the tail, the right one bent outward, a tailplane bent down, the deck over the engines burned through. 24 units (1.38 tiles) | The same |
| `wreck-airship` | The Airship (the armoured blimp, `b/airship.js` `v=c`): settled heavily, its envelope collapsed on itself, long, flattened and buckled into folds, kinked behind the middle, the nose crushed into the ground, burned through in three places to its ring frames; one lift fan torn off and lying on its side, the others hanging off bent pylons, a V-tail fin flat on the ground. 34 units (3.4 tiles) | The same |

All three are neutral (one picture for every team: burnt, their team colours dead) and have morning, evening and night
versions (`art/tod/<time>/bots/`, keys in `art/tod/tod-keys.js`). **How they were made:** `wreck.js` builds the
aircraft with its own scene, then bakes every mesh into world space and cuts it into small triangles (so it can bend and
tear anywhere), gives each triangle to a piece by where it lies (the pieces, their hinges and how each lies are in
`WRECKS` at the top of the file), crumples the pieces (harder where they tore), lays them on the ground, and chars the
paint through its vertex colours: soot over the hottest places, heat-browned metal round them, grey-white ash where the
alloy burned through, scorched paint at the edges; every glow is dead, and the inside of the skin, seen through a tear,
is black. A few torn panels lie round it. A shadow catcher keeps only the shadows; the sun is kept high (52° or more), so
the shadows stay short when the game turns the wreck. Rendered at 1024 and composed with
`compose_any.py --b1 5 --b2 15`, then saved as WebP (quality 82) into `art/bots/` and `art/tod/<time>/bots/`:

```
cd renderer
node run.js out/wreck/day 'wreck:::wreck-cargoplane:c=cargoplane' 'wreck:::wreck-bomber:c=bomber' 'wreck:::wreck-airship:c=airship'
node run.js out/wreck/night 'wreck:::wreck-cargoplane:c=cargoplane&tod=night' ...   # and morning, evening
python3 compose_any.py out/wreck/day wreck-cargoplane wreck-bomber wreck-airship --b1 5 --b2 15
```

The Airship's needs `renderer/b/airship.js` (branch `airship-art` until it's merged). The rest of a crash is drawn in
code: the fall (the aircraft's own sprite drawn by `drawPlane` into a canvas of its own and charred, squeezed as it rolls
and pitches, flames licking back off it, pieces breaking away, its shadow and a thick smoke trail), the fireball, fires
and scorch marks, the burnt ground under the wreck, its smouldering and embers, and what grows over it. An aircraft
added later with no `wreck-<type>` art of its own is drawn as its outline, broken in two and charred, until it has one.

### Batch 20: oil seeps as puddles of crude (installed; no images)

The oil seeps are now puddles of crude, after the owner's reference picture: glossy, jet black, a soft wavy outline of
lobes and pinched waists, a few droplets and small puddles beside it, pale sheen spots inside, a thin white light along
the edges nearest the player. From the design sheet's three directions (`renderer/preview/oil_seep_sheet.py`: A fresh
spill, B spattered seep, C still pool) the owner chose **B, the Spattered seep**: more lobes, tighter waists, a trail of
droplets off one side, the sheen in smaller spots, a slightly thinner rim light, and as it is pumped its waists pinch
off and it breaks into two or three pools. **There is no art for it**: the puddle is made in code from the seep's own
tiles (`js/seep.js`), so any layout of tiles comes out right, and it is baked with the ground (the whole-map bake, the
sharp chunks at 64 and 128 px a tile, and the night glow map), so it costs nothing per frame.

How it is made (`seepGeometry`, a port of `renderer/terrain/oil_puddles.py` direction b): a disc on each oil tile (its
size from how much crude is left, jittered a little), a lobe or two off each, bridges to its oil neighbours, and the
droplets (placed once, just outside the full shape, most in a trail off one side); the union is softened and its edge
pushed about by low-frequency noise (a domain warp, more lobes from another noise), and the 0.5 contour of that field
(marching squares, 16 cells a tile) is the puddle, one `Path2D` in map pixels. It is shaded from its own shape when
drawn (`drawSeepPuddle`): the shape filled white then filled black shifted up a hair leaves the white rim light along
every edge that faces the player; the same trick the other way leaves a faint grey line on the edges that face away;
soft pale spots toward its top are the sheen; a translucent dark fill of the full shape and a soft dark edge are the
damp stain under and round it. At night the rim and sheen are left in the glow map as a faint cool gleam
(`drawSeepGlow`), violet in the Hollow. **Motion:** the sheen spots breathe slowly (`drawSeepShimmer`: one 64 px blob
sprite drawn over each spot with a slow sine, a handful of draws a seep; not on the Saver step, with reduced motion, or
zoomed out past 18 px a tile). **Pumping:** a pump takes from the fullest tile it reaches, so for the picture the
crude of the tiles it reaches is pooled and handed back farthest tile first (`seepFills`): the pump's own tile dries
first, the wet area recedes from the pump and pinches into pools; the puddle is made again only when the seep's amount
crosses one of ten steps, and only its tiles are repainted (`seepFrame`, `redrawRegion`). A dry seep leaves its stain.

**The survey stakes are gone** (the owner, Nov 18): nothing stands on a seep now, on any map. `oil.webp`, `oil-glow.webp`
and `oil-seep.webp` were removed from `art/resources/` and the manifest. **The Hollow's seeps** are the same puddle
with a touch stronger rim light and sheen and a violet gleam (`SEEP_LOOK.hollow`); the Cinderlands' and Blackwater's
(black on dark ash and mud) get a stronger rim and sheen and a paler stain (`SEEP_LOOK.volcanic`, `.swamp`). Droplets
lie only on open ground on the seep's own level (never water, rock, a road or track, a building or another resource);
under a road or track the puddle stops at the kerb and the road keeps its dark stain. Since the Nov 2026 redraw (proposal)
the body also holds the sky: a faint cool sheen across its top half, gone toward the bottom, and a thin film of oil's
colours just inside its edge (both baked with it, in `drawSeepPuddle`). Everything is render state (`SEEP`),
read from `S` and never written to it; the simulation never reads it.

### Batch 21: the Maglev line (installed)

In play, pylons sharing a road or track show their footing on the shoulder, with a support arm connecting to the straight guideway.

The owner chose direction **A, Accord Phase 2**, from the design sheet (`renderer/preview/maglev_sheet.py`), with the two
mixes the sheet suggested: the pylon caps and the Terminal's dock in gunmetal (as drawn) and B's hazard chevrons on A's
pylon caps. Rendered with `renderer/b/maglev.js` (`v=a`), both teams, at every time of day, by
`renderer/tools/render_maglev_game.sh`; `renderer/tools/install_maglev.py` writes the WebP files (jobs.txt lists each
one; RENDERER.md, "The Maglev line").

| Key | What | How it's drawn |
|---|---|---|
| `magterm@0`, `magterm@1` (+ morning, evening, night in `art/tod/<time>/buildings/`) | The Maglev Terminal: a round glass-sided transit hall in pale weathered concrete on the usual pad, a lit platform ring and a railing on its roof, lamp masts, a gunmetal dock at deck height in the platform's middle, and at its door a canopy, a shelter with an empty bench and a timetable board glowing blank. 512 px, the buildings' angle | `B3D` at scale 1.6 (as big as the Rail Station; anchor [0.5, 0.615]), like any building; its site is the shared `site` art. The guideway meets it at the art's `head` mark, `MAGLEV.head` (0.464) tiles up the screen from its tile centre |
| `magpylon@0`, `magpylon@1` (+ morning, evening, night) | A slender tapering concrete pylon on an octagonal footing banded in hazard yellow, a gunmetal hammerhead cap with hazard chevrons on its ends and a team-colour strip up its front, a red aviation light. 512 px, the buildings' angle, no pad | `B3D` (scale 1.4), its foot on the tile centre, drawn by `drawMagPylon` under the band: squashed shorter on ground higher than the line's ends and stretched taller over a dip (`MAG_LEVEL`, 0.3 a level, as the Viaduct's piers); its head is `MAGLEV.deck` (0.343) tiles up |
| `magpylon-cut@0`, `magpylon-cut@1` (+ times of day) | The pylon shot down: a sheared, charred stump with its rebar out, the column lying beside it with its cap still on, broken deck slabs (one with a live power rail), rubble and scorched ground | In every cut of a line, on the fallen pylon's spot, until the Worker rebuilds it |
| `magpod@0`, `magpod@1`, `magpod-empty@0`, `magpod-empty@1` (+ times of day) | The pod: a sleek rounded capsule in pale white, a band of lit windows along each flank with the seats folded inside, a team-colour rail along each edge, its roof hatch standing open over the crates when loaded (`magpod`) and shut when empty (`magpod-empty`). Straight down, facing right, 256 px, one tile (10 world units) across | `drawMagPod`: one tile across (`MAGLEV.podFrame`), turned along the line, at deck height (`MAGLEV.head` up the screen from where it is on the ground), a dark ellipse of shadow on the ground `MAG_SHADOW` (0.6 right, 0.55 down) of its height off; loaded art with anything in its hold. One is drawn docked at each Terminal |
| `magdeck@0`, `magdeck@1` (+ times of day, in `art/tiles/`) | One tile of guideway: a slim pale box girder with a team-colour power rail along each edge, running east. Straight down, 256 px, one tile | `magBand`: repeated along a straight band from the near Terminal's dock to the far one's (turned to the line, clipped to its length, ending `MAG_END` short of each dock), split at a cut, and as far as it's built on a line going up; its shadow is the same band drawn dark on the ground down-sun (`drawMaglevShadows`, before the buildings); at night a soft ribbon of team light along it (`magGlow`), dim on a line without power |

The band, the pylons and the pods go on after the buildings and robots (so what stands under a line is under it) and
before the air (`drawMaglevs`); nothing of it is baked, because lines come and go. The placement preview is the same
band at 75% (red and dashed past the first blocked spot) with every pylon spot ringed (`MAG_SPOT`: green standing, blue
over a road or track, yellow shifted a tile with a dotted tick back to its spot, dashed white spanned, red with a cross
blocked, the reason in a small dark label beside the first) and a ghost of the far Terminal (and of the hub, labelled,
on a Route via a hub).

Drawn in code since the hubs (Nov 2026), no new images: a **pylon over a road or track** is a portal frame instead of
the pylon sprite (`drawMagPortal`): two slim pale legs on the kerb either side of the deck, outlined in the cap's
gunmetal, a crossbeam just under the deck in hazard yellow with dark chevrons (the pylon cap's), and the legs' small
shadows on the road, so the road reads as open under it. A **suspended line** (a Terminal lost) keeps its band, without
the night glow, with an amber dashed stripe down the deck; the lost Terminal is its sprite at 28% on its old tile under a
pulsing dashed amber ring.

### Batch 22: Express highways (installed; drawn in code)

The Express lane (direction A, the Expressway, from the November 2026 design sheet: `renderer/preview/highway_tiles.py`,
`highway_mock.py`, `highway_sheet.py` keep the three directions' painters and mock-ups) is drawn by the game the way its
roads are, in `drawExpress` (`js/render.js`), with no images: a surface a shade darker and bluer than asphalt filling
the tile (28/32), a hard shoulder with a white edge line and red cat's-eyes, a broken white lane line with white
cat's-eyes, and between two lanes running opposite ways the median: an amber edge line, hard standing and the concrete
barrier along the shared edge. Ordinary roads join as ramps (a hazard-striped apron on the shoulder, B's mix) or ends
(the lane narrows onto the road); bends are the lanes' own arms; worn lanes crack and pothole like asphalt. At night
the cat's-eyes light (`drawRoadGlow` in `js/daynight.js`), the asphalt street lamps (`streetlamp-asphalt`) stand on the
median, and a strip in the team's colour runs along the barrier. The one-way arrow is the road's (`oneway`, still to
make). The sign gantries are drawn in code (`drawGantry`: galvanised square posts on concrete footings on the verges, a
box-truss beam of two chords and a Warren lattice, and over each lane a catwalk and a blank green board with a white rim
and two lamp hoods; the beam's shadow falls across the road down-sun, from the time of day's shadow; at night the lamps
wash the boards); a sprite could replace them later. Until `oneway` exists, the arrow is drawn as a painted road marking
(`drawRoadArrow`: a slender white arrow with a dark edge and scuffed paint; on an Express lane every other tile).

**Roads, the redraw (Nov 2026; proposal, the owner to approve).** Concrete and asphalt are still drawn in code and baked
with the ground (`drawRoad`, `roadShape`), so they cost nothing a frame. Each tile keeps to its own square and every
join comes from its neighbours as before, but now: the verge either side is packed dark by traffic; the kerb has a shadow
down-right and a lit edge up-left; bends and junctions have a small fillet in each inner corner, so they sweep instead of
meeting square (the outer corner of a bend and a dead end stay round); the wheel tracks are polished a shade darker and a
fine aggregate shows. Concrete: slabs of slightly different shades, a joint across at each tile's edge and a faint one down
the middle, now and then a hairline crack or a stain. Asphalt: one even surface with an oil line down each lane and, on a
two-way straight or dead end, a broken pale-yellow centre line (none in a junction). The Express lane has the same kerb
and verge, polished wheel tracks in both lanes, and a finer aggregate.

### Batch 23: the Mass Driver and Catcher (installed)

The owner chose look **A, "Coil Ramp"** from the design sheet (Nov 19 2026). Rendered with `renderer/b/massdriver.js`,
both teams, at every time of day, by `renderer/tools/render_massdriver.sh`; `renderer/tools/install_massdriver.py`
writes the WebP files (jobs.txt lists each one; RENDERER.md, "The Mass Driver and Catcher").

| Key | What | How it's drawn |
|---|---|---|
| `mdriver-<dir>@0`, `mdriver-<dir>@1` (dir: e w (lying east-west), n s (north-south); + morning, evening, night) | The Mass Driver, two tiles long on a 2 × 1 pad: a pale concrete ramp with buttresses down its flanks carrying a coil-gun rail of eleven copper coil rings on gunmetal yokes, rising to a flared muzzle with a team-light ring and a red light; a breech house with a hopper at its foot, capacitor banks on both flanks cabled to the coils, three sealed canisters on a rack; the coils' inner bands glow pale blue-white after dark. 512 px, the buildings' angle, framed wide (the pad's two tiles across 0.85 of the frame) | `MD_FRAME` in the manifest (its scale and anchor, from the render: the anchor is the middle of its two tiles); drawn over the middle of its tiles, the end facing its Catcher (`mdDir`); `mdriver@T` (the menu, a Driver not yet aimed) is the east one |
| `catcher@0`, `catcher@1`, `catcher-closed@0`, `catcher-closed@1` (+ times of day) | The Catcher: a wide ribbed steel funnel cradle on an octagonal concrete plinth, its rim lit in the team colour, copper braking rings glowing in its throat, four magnetic arms in hazard yellow on legs round it, swung up and out (open) or in over the funnel with their magnet heads lit (closed); a small control cabin, a floodlight pole. 512 px | `B3D` at scale 1.4; the closed art while a canister is landing (`mdArmsIn`) |
| (code) | The shot | `drawMassDrivers`: the coils light blue-white in sequence breech to muzzle as it charges, arcs of light crackling between them and up the rail, a ray along the rail; on the shot every coil blazes and a flash at the muzzle; a faint dashed guidance beam from the muzzle to the Catcher's cradle while a canister flies; the canister, a stubby gunmetal cargo container (ribbed sides, dark corner castings, a band in the team colour, an amber running light blinking at its nose) holding its heading along the arc, with a short glowing streak and its shadow on the ground; after dark the coils glow faintly between shots. `MD_ART` holds the renders' marks |
| (code) | The shot back (Nov 26 2026: the line is two-way) | `drawCatcherLamps`: a Catcher charging gathers a blue-white glow in its funnel that swells with the charge, arcs crackling between its arms, then a flash and a short ray straight up as it fires; `drawMassDriverLamps`: a canister caught at the Driver lights its muzzle and the coils down the rail. The canister leaves from and lands at each end's port (`mdPort`: the Driver's muzzle, the Catcher's cradle, an Outpost's or Keep's roof). No new renders. |

### Batch 24: the megastructures, the Lance of Corvane and the Shield Dome (installed)

The owner chose look **A** for both from the design sheet (Nov 20 2026): the Lance a "Gun Emplacement", the Dome a "Hex
Lattice". Rendered with `renderer/b/lance.js` and `renderer/b/dome.js` at every time of day by
`renderer/tools/render_lance.sh`; `renderer/tools/install_lance.py` writes the WebP files and prints the frames and the
marks the game draws by (RENDERER.md, "The megastructures"). Both are wider than a tile: their frames put the middle of
their square on the frame's anchor.

| Key | What | How it's drawn |
|---|---|---|
| `lance@0`, `lance@1` (+ morning, evening, night) | The Lance's 3 × 3 gun pit (30 × 30 world units on its own pad): an eight-sided concrete-faced berm with buttresses and a team-light band along its crest, beacons at its corners, the pit floor scored in pours with the turntable race (a hazard ring, its rail and bolt circle) and the turntable well EMPTY; four capacitor banks outside the berm in the corners cabled in over it, a coolant plant with two white tanks at the back, a fire-control bunker with lit slits at the front left, a rack of spare Ring Crystal lenses, transformers, floodlights. 512 px, framed wide (the pad's 30 units across 0.62 of it: about 5 tiles) | `LANCE_FRAME` in the manifest; drawn over the middle of its square, then the head |
| `lance-head-0`…`lance-head-15` (+ times of day; no team colour, one set for every team) | The gun on its turntable deck turned each of 16 ways (0 east, then clockwise): two armoured trunnion cheeks, a finned breech housing with its cable bundles, a counterweight, the long barrel raised 11° with eight dark ceramic charge rings between copper windings, cooling fins, and the focusing head at the muzzle round a pale Ring Crystal lens; warm work lights | `turretHead(owner, b.aim, 'lance')`: the way nearest its aim, which turns slowly toward where it's aimed (`b.aim`) |
| `dome@0`, `dome@1` (+ times of day) | The Shield Dome's 2 × 2 emitter: a six-sided steel plinth with the team band round its rim, a tapered tower wound with three copper field coils and halo rings, a gallery, four claws holding a faceted blue Ring Crystal projector in a halo; six field pylons on a hexagon round it with ceramic insulators and crystal tips, cabled in; a Crystal hopper, a transformer, floodlights. 512 px, framed wide (its 20 units across 0.7 of the frame) | `DOME_FRAME` in the manifest |
| (code) | The Lance's charge, beam and cut | `drawLanceCharge`: the eight rings light one by one, orange to gold, as the charge climbs (the leading one pulsing), all white-hot when full, the lens gathering light (marks for each way in `LANCE_ART`, from the install); `drawLanceBeams`: for 2½ s a white-hot core in orange and red glow from the muzzle across the map, flickering flares along it, the light it throws on the ground, and at night a warm flash over the whole screen; `drawCuts`: the trench for good (a scorched band, a charred furrow, glassy flecks), glowing white, then orange, then dull red as it cools over 45 s, with steam rising off water it crossed for 40 s |
| (code) | The dome | `drawDomes`: the dome's outline (the front half of its ground circle, an ellipse over it), faintly filled pale blue, brighter at the rim; a lattice of hexagon panels on its surface with a shimmer drifting over it; panels flashing and a ring spreading where something hits; flickering when weak, breaking up as it drops; a soft blue light under it at night |

### Batch 30: the Atmosphere Engine (installed)

The owner's look **A** from the megastructure design sheet (Nov 21 2026), the "Rain Tower". Rendered with
`renderer/b/atmos.js` at every time of day for both teams by `renderer/tools/render_atmos.sh`;
`renderer/tools/install_atmos.py` writes the WebP files and prints its frame and marks (RENDERER.md, "The Atmosphere
Engine"). Framed like Arrival City (`ATMOS_FRAME`), the biggest of the megastructures: the shell rises about two tiles
over its square on screen, and the plume twice that again. The plume is the whole idea, so it is drawn in code and moves.
Flavor: "Scheduled in the Pathfinder's plan for T−10. Started late. Running to plan."

| Key | What | How it's drawn |
|---|---|---|
| `atmos@0`, `atmos@1` (+ morning, evening, night) | A 4 × 4 hazard-edged concrete pad; one great concrete cooling-tower shell (a hyperboloid, wider at the foot, pour lines and rain streaks) on a ring of raking X-braced columns with the dark air intake between them; a blue-grey waist band (lit cyan at night) over a thin team stripe; the dark throat with a rim walkway and two red lamps; six intake fan drums with grilles and pipes to the shell; a low control house at the front left (team band, lit windows at night); a fuel line, a power cabinet, crates and two light masts | `renderer/b/atmos.js` |
| (code) | The plume | `drawAtmosPlumes` (`ATMOS_MARKS.throat`): a dozen soft white puffs rising out of the throat, swelling and drifting east, graded for the time of day; thinner and slower while it has no power |
| (code) | Night | pale cyan light from inside the throat up the plume, the waist band's glow (`bandL`, `bandR`, `band`), the rim lamps blinking (`rimL`, `rimR`); dark when the Murmur cut it |
| (code) | Rain | from stage 2, a drizzle at night within about 7 tiles of the tower |
| (code) | The changed land | `drawGreen`, in the ground tiles: Calm a little cleaner, Rain damp dark earth with sprouts, Green grass, Garden deep grass with flowers and young trees |
| (code) | The Storm Front | `drawAtmosStorms`: over the storm's spot, three spiral arms of heaped billows (from `wxCloud`: a dark underside, a slate body, paler tops; blue-grey and dimmer at night) wound round a dense heart and turning slowly, their shadow on the ground, a dashed rim at its 5-tile edge, rain streaks falling all over it; it rolls in over 3 s and breaks up over 2; at the Garden a flash in the cloud now and then. Aiming: `drawStormAim` (the Engine's kept-clear circle in green, the storm's circle at the pointer) |
| (code) | Lightning | fx `stormbolt`: a jagged white-blue bolt from high above down to the building (`boltPath`, a branch), flickering twice, and a white-blue flash where it lands |
| (code) | Seed Vault's hull | `drawPathfinderHull`: a long white lander hull half-buried in drift sand, its Accord stripe faded, the vault hatch open |

### Batch 29: the Deep Core (installed)

The owner's look **A** from the megastructure design sheet (Nov 21 2026), the "Headframe". Rendered with
`renderer/b/deepcore.js` at every time of day for both teams by `renderer/tools/render_deepcore.sh`;
`renderer/tools/install_deepcore.py` writes the WebP files and prints its frame and marks (RENDERER.md, "The Deep Core").
Framed like the Lift (`DEEP_FRAME`), sized to stand with the other 3 × 3 megastructures: its tower is the tallest thing
on the pad, as tall on screen as the Lift's cable stub and twice the Uplink's dish. What moves and what tells its depth
is drawn in code, so it reads at any zoom. Flavor: "Core sample rig, rated to 40 kilometres. The survey filed the lower
readings as instrument error."

| Key | What | How it's drawn |
|---|---|---|
| `deepcore@0`, `deepcore@1` (+ morning, evening, night) | A 3 × 3 hazard-edged concrete pad; a raised concrete shaft collar with a hazard-ringed dark square shaft and its cage guides; a red steel lattice winding tower (four legs braced in X's) rising to a sheave deck with a team-colour fascia and a railing, two raking back legs down to the winding house; floodlights on the deck aimed at the wheels (white at dusk and night) and a red beacon; the ropes from the wheels into the shaft and to the winding house, a long white shed with a hipped roof, a team band under its eaves, a lit window band at night; a skip bin on the tower and a covered conveyor down to three hoppers (rust ORE, violet CRY, green U, labelled, team-colour rims) with chutes where Haulers load; the depth gauge, a grey cabinet with three dark lamp sockets; a spoil heap of broken rock in the north-west corner; a fuel line and crates. No wheels: the game draws them | `drawDeep` |
| `deepcore-work-0`…`deepcore-work-7` (day only, graded for the time of day; no team colour, one set for every team) | The two spoked red winding wheels alone (six spokes, a pale tab on the rim so the turning reads), frame k turned k/8 of 60 degrees, the left one way and the right the other; every other surface depth only | `drawDeep`: 8 frames a second while it works, held where they stopped when it doesn't (`DEEP_WHEEL`) |
| (code) | The shaft's glow | `deepLights` (`DEEP_MARKS.shaft`): from stage 2 a violet pool in the shaft's mouth and a column of violet light rising out of it, pulsing slowly; at stage 3 bigger, brighter and quicker; faint by day, full at night (`deepGlow`); its light pool on the ground at night too |
| (code) | The gauge | three violet lamps at `DEEP_MARKS.g1`…`g3`, one lit per stage, the next blinking while it works toward it |
| (code) | Floodlit wheels | soft white light over `wheelL` and `wheelR` at dusk and night (dark when the Murmur cut it) |
| (code) | Under construction | the generic megastructure site (`drawMegaSite`): the tower rising out of its dashed footprint as the work goes on |

### Batch 28: the Great Uplink (installed)

The owner's look **A** from the design sheet (Nov 20 2026), the "Dish Array". Rendered with `renderer/b/gup.js` at every
time of day for both teams, whole and below 30% of its armor, by `renderer/tools/render_gup.sh`;
`renderer/tools/install_gup.py` writes the WebP files and prints its frame and marks (RENDERER.md, "The Great Uplink").
Framed like the Lance and the Lift (`GUP_FRAME`). The transmission is drawn in code, in its owner's colour, so it reads
at any zoom: the dish's glow, the beam, the ping and the jammed flicker. Flavor: "Landing beacon for the arks.
Transmitting on all channels. Listening on all channels."

| Key | What | How it's drawn |
|---|---|---|
| `gup@0`, `gup@1` (+ morning, evening, night) | A 3 × 3 hazard-edged concrete pad with a painted ring; a round concrete plinth and a turntable with a team-colour band, a yoke holding the elevation bearings and a counterweight; one huge white dish, its bowl seamed in rings and spokes with a team-colour band near the rim, ribbed truss at the back, tilted a little north to the sky; ten red lights round its rim (lit at dusk and night); a feed tripod of three struts to a feed horn with a team cap; three small dishes on posts at the north-west, north-east and south-west corners, each looking at a different part of the sky; a control hut at the south-east with an amber window band and a team stripe, a mast on its roof; a power cabinet, cable trays and a red Fuel line on the west; four floodlights at the dish's foot aimed up at it (white at dusk and night) | `drawGup` over the middle of its square |
| `gup-down@0`, `gup-down@1` (+ times of day) | Below 30%: the bowl holed and scorched, one feed strut snapped and the horn fallen to the pad, the north-east small dish toppled, scorch, rubble and torn white panels strewn over the pad, floods and windows dark | `drawGup` while `b.armor < 30%` |
| (code) | Rim lights | `drawGupSignals`: red glows blinking in turn at the rim's four marks (`GUP_MARKS`) at night |
| (code) | Transmitting | a glow in its owner's colour swelling in the bowl with each pulse (`GUP.pulse` 2.4 s, `gupPhase`); a pale beam rising straight up the screen from the feed horn, its white core fading out, a bright band climbing it each pulse; a ring spreading over the ground from the dish (the ping) |
| (code) | Jammed | the glow and the beam turned red, flickering a dozen times a second, the beam jittering and its pulse broken into pieces; no ring |
| (code) | No power | the glow down to a slow red blink, no beam |
| (code) | Minimap | rings in its owner's colour pulsing out from it while it transmits, red while it stalls |

### Batch 28: the Sundering Ray (installed)

The owner's look **B** from the design sheet (Nov 21 2026), the "Piston Battery" (drawn on the sheet as the Seismic
Lance; renamed the Sundering Ray), with the owner's plan for how it works (IDEAS.md): a phased array of hydraulic rams
round a bore tower. Rendered with `renderer/b/sunder.js` at every time of day by `renderer/tools/render_sunder.sh`;
`renderer/tools/install_sunder.py` writes the WebP files and prints its frame and marks (RENDERER.md, "The Sundering
Ray"). Framed like the Lance (`SUNDER_FRAME`). The parts that move are each their own image on the same frame, so the
game pumps them; the glow, smoke, dust, the ripple and the cracks are drawn in code.

| Key | What | How it's drawn |
|---|---|---|
| `sunder@0`, `sunder@1` (+ morning, evening, night) | A 3 × 3 hazard-edged pad; a long dark-concrete block at the back, ribbed, a team stripe along its face and a hazard band at its foot, a steel tread deck with two empty ram bores (orange collars, bolt circles) and white accumulators; in the middle the bore tower over the shot hole: a steel casing in a four-legged lattice, braced, a crown deck with a team band, a yellow sheave and a red beacon; two stacks at the back corners (orange-lit mouths at night); an orange manifold with lines down to six steel-rimmed plate sockets in a row; the control cabin (lit window band, team stripe) and the pump house at the front; amber lamps, floodlights, a team light strip | the art |
| `sunder-site1@T` | Going up: the block's formwork and rebar, the shot hole drilled with the rig over it, pallets and a heap of spoil | under 45% built; `drawSunderSite` |
| `sunder-site2@T` | Going up: the block cast, the bores open, the tower's legs half up in scaffolding, a crawler crane leaning over | 45% to 85%; then the finished art rises over it |
| `sunder-ram-w-0..2`, `sunder-ram-e-0..2` (+ times of day) | A great ram alone, west or east, its head down, half up or full up on its chrome rod: a dark steel cylinder with an orange band and a bolted crown. No team colour | `drawSunder` by `sunderAnim` |
| `sunder-plate-K-0`, `sunder-plate-K-1` | Ram plate K alone, seated or raised on its two orange lift rams | the same |
| (code) | The wind-up | the rams pump in turn and the plates drum down the row, faster as it nears the blow (`sunderPhase`); dust lifts off each plate as it comes down; the shot hole glows orange under the tower; the stacks breathe orange smoke, glowing at night |
| (code) | The blow | a white-hot flash and a column of dust out of the shot hole; the rams slam down, the plates slam in a ripple, the far side from the aim first (`sunderOrder`) |
| (code) | The ripple | `drawSunderGround`: a bulge running through the ground (a light crest, its shadow behind, a bright arc at its front: amber for a Quake, violet for Strike the Deep at night), a line of small cracks left along its path; `drawSunderAir`: dust kicked up along it |
| (code) | The landing | rings of heaved ground out to the circle's edge; cracks spreading from the middle, branching, fading over 5 minutes; on Strike the Deep, the caved-in pits (violet-lit at night) |
| (code) | The marks | cracked roads and track (dark zigzags, until mended), cracks up the walls of cracked buildings, sparks circling stunned robots, the Quake's red ring for its last 20 s (its own side sees the aim, dashed, all the way) |

### Batch 27: the Orbital Lift (installed)

The owner's look **A** from the design sheet (Nov 20 2026), the "Beacon Cable". The anchor pad is rendered with
`renderer/b/lift.js` at every time of day for both teams, whole and below 30% of its armor, by
`renderer/tools/render_lift.sh`; `renderer/tools/install_lift.py` writes the WebP files and prints its frame and marks
(RENDERER.md, "The Orbital Lift"). Framed like the Lance (`LIFT_FRAME`). Everything that moves or reads at a distance is
drawn in code, so it stays sharp at any zoom and takes its owner's colour: the cable rising up the screen, its climbers
and warning lights, its shadow along the fall line, and the fall.

| Key | What | How it's drawn |
|---|---|---|
| `lift@0`, `lift@1` (+ morning, evening, night) | A 3 × 3 hazard-edged concrete pad with a painted ring; an eight-sided stepped concrete collar in the middle with a team-colour band round its crest; eight clamp housings round a steel clamp ring; the cable's foot, a bright braided stub with four guide rails and the climber dock's yellow buffer ring, two red warning lights on it; two tension winches with fat cable drums led in to the collar; a control house with an amber window band and a team stripe; a power cabinet, a red Fuel feed pipe; four floodlight masts at the corners aimed in, each with a red beacon (white floods lit at dusk and night) | `drawLift` over the middle of its square |
| `lift-down@0`, `lift-down@1` (+ times of day) | Below 30%: scorch over the pad, rubble and torn plates strewn over it, one clamp housing torn open and charred, a crack down the collar, the south-east floodlight mast knocked down across the pad, the floods and window band dark | `drawLift` while `b.armor < 30%` |
| (code) | The cable | `drawLiftBeam` from the cable's foot (`liftFoot`): a soft column of light in its owner's colour, brighter at night, fading out up the screen; a white core line; six red warning lights stepping up it, blinking in turn (bright by night); two climber pods riding it, the higher the smaller; swaying when weak |
| (code) | The climber | `drawLiftPod`: a white capsule with a band of windows (amber at night) and its owner's stripe when it carries a drop, coming down (growing) or going up (shrinking) over its 45 s; waiting at the top or bottom without power |
| (code) | The shadow | `drawLiftShadow`: a soft dark line along the ground the way it would fall, flashing red while it's weak for whoever has land or robots on it; on the minimap a faint line, flashing red |
| (code) | The fall | `drawLiftFalling`: for 5 s the cable stands over the gone anchor, swaying harder, its line flashing red; then it comes down from the anchor out, the part still falling hanging from where it struck to its top, dust and smoke where it lands (`addFx`) |
| (code) | The wreckage | `drawCableWreck`, baked into the ground: the braided cable lying along its line through each tile, torn plates of its climber track beside it in its owner's colour; sparks along it for a minute after it falls, the Murmur's violet glimmer over it at night |
| (code) | Its lights | the floodlights' four white pools at the pad's corners and its owner's glow under the cable (the light pass) |

### Batch 26: Arrival City (installed)

The owner's look **A** from the design sheet (Nov 20 2026), the "Terraced Arcology". Rendered with `renderer/b/city.js`
at every time of day for both teams, whole and battle-damaged, by `renderer/tools/render_city.sh`;
`renderer/tools/install_city.py` writes the WebP files and prints its frame (RENDERER.md, "Arrival City"). It is the
widest building: its frame puts the middle of its 4 × 4 square on the frame's anchor (`CITY_FRAME`). All its own lights
are off in these images (windows dark glass, lamps unlit): the game adds them.

| Key | What | How it's drawn |
|---|---|---|
| `city@0`, `city@1` (+ morning, evening, night) | The owner's look A, Four Blocks round a Square (a lit-up Soviet-bloc square from the future): four prefab panel apartment blocks of raw concrete, each panel a shade of its own with dark joints and a window, round a central square. A long five-storey block across the north (shop windows on its ground floor, loggias, three entrances with canopies; on its roof lift housings, solar panels, dishes, two masts with red lights and WELCOME HOME in big red letters on a steel lattice), two five-storey blocks down the sides (a tiled mosaic of the ringed planet on their south gables), a three-storey block along the south street split by a gateway under a bridge of flats. An LED strip round every roof edge in the team colour. In the square: paving, four kerbed lawns with trees, benches and three grazing deer, lamps, a fountain, and a concrete stele with the Arrival clock ("ARRIVAL T+31 YEARS") and the Ring round its top (no statues: LORE.md). A street round it; tram rails and an overhead wire along the south side, an empty two-car tram at a glass stop with a departure board ("ON TIME") | `drawCity` over the middle of its square |
| `city-down@0`, `city-down@1` (+ times of day) | Knocked down by fighting: windows dark and many broken, panels cracked, some fallen out (dark holes, rebar) and four lying on the square, scorch over the faces, roofs and square, the south block's east end blown out into rubble and twisted rebar in the street, the LED strips broken, most trees burnt to sticks, the fountain dry, a mast bent over, the C of WELCOME fallen and some letters burnt, the clock face cracked, lamps knocked askew, the deer gone | `drawCity` while `b.cDown` |
| `city-lit-0`…`city-lit-3` (one set for every team and time) | Its lights as light to add: 0 the street and square lamps, the fountain, the tram, its stop and board, the lamp under the gateway; 1 the ground and first floors' windows and the lobbies; 2 the second and third floors'; 3 the top floors', WELCOME HOME (red), the clock and the Ring (each the glow pass of `part=lit&tier=k`, bloomed; colour ÷ alpha). Every window the same warm white | `cityLights`: added (`lighter`) tier by tier as dusk falls, on a timer (`cityLightLevel`), all on by night and in the Hollow; none while it's down or out of Fuel. Its warm light pool and a wide glow round it (`drawCityGlow`) come on with them |
| `city-led` (one for every team and time) | The LED strips round its roofs, white (`part=lit&tier=4`) | `cityLights`: tinted in the owner colony's colour (`cityLedTint`, made once per colour and size), on with the lamps (a capture changes the colour) |
| `city-lit-down` | What still burns on the wreck: WEL OME HOME (the C fallen), the clock, the masts' red lights (`state=down&part=lit&tier=5`) | `cityLights` while it's down, at night: flickering on a failing circuit (steady on Graphics Saver); none out of Fuel |
| (code) | Being taken | `drawCityTaking`: a ring round it filling in the taker's colour over 20 s, with a small flag |

### Batch 25: the Skirmisher, the Arc Caster and the Railgunner (installed)

Three army robots in the Warbot's "Lancer" family (the shared `renderer/b/robkit.js`: seen straight down, facing east,
the same armour paint, grime, team light strips, sensor slit, rear lights and brake lenses), modelled in
`renderer/b/rob_skirmisher.js`, `rob_arccaster.js` and `rob_railgunner.js`, rendered at every time of day for both teams
by `renderer/tools/render_units.sh` and written as WebP by `renderer/tools/install_units.py` (102 files, about 670 KB).
Drawn like the Warbot (its size on the map, the warbots' headlights at night, the brake and dust overlays).

| Key | What | How it's drawn |
|---|---|---|
| `skirmisher@0-f0`…`@1-f3` (+ morning, evening, night), `-brake`, `-boost` | A lean arrowhead body slung low between four big all-terrain tyres on swing arms (the tread rolls a quarter block a frame), team strips along its flanks, swept tail fins, a swivel with twin short autoguns, two dash thrusters in the tail glowing team colour. Smaller than the Warbot in the same frame | `drawArmyLights`: its thrusters flare (a glow and two streaks of team light) while it dashes; `'dash'`: a kick of dust and twin light streaks where it sets off |
| `arccaster@...` | A short boxy tracked hull filled by a Tesla coil seen from above: a plinth, stacked ceramic insulator rings, a fat steel discharge torus with an electric-blue seam round a white-blue core, three lightning rods with lit tips; two banks of capacitor drums with blue charge lights on the rear deck, copper leads | `drawArmyLights`: the coil glows with the bolts left (brighter at night) and flares as it fires, lighting the ground blue; `'chain'`: a jagged blue-white bolt from the caster to each robot it jumps to, re-forming every few frames and forking side branches, a white core, light where it lands |
| `railgunner@...` | A long low tracked wedge with a folded stabiliser spade (hazard stripes) at the tail, a turret set back with a breech block between two big capacitor drums ringed in team light, and a long open rail (two heavy rails, six glowing coil clamps, a muzzle brace with a lit muzzle) reaching to the frame's edge; a rangefinder with a red lens | `drawArmyLights`: the coil clamps light up one after another as it charges; `'railglint'`: a white star swelling and spinning at the muzzle; `'railshot'`: a bright straight streak, white core in a glow of the team colour, fading from the back, a ring of air at the muzzle, the line lit on the ground at night; `'railhit'`: a flash and sparks thrown on along the line |

### War scars (drawn in code; no images)

The owner's War scars (Nov 19 2026: README, "War scars"): a long war turns the land into a World War One battlefield.
Everything is drawn in code into the baked ground (`js/render.js`: `paintScars`, `scarBigCrater`, `scarHole`,
`scarPatch`, `drawScrap`, `scrapBits`, `scrapHull`, `scrapWreck`, `scrapRubble`, `drawBones`, `drawStump`,
`drawScarPuddles`; colours in `SCAR_COL`), so it is re-lit for the time of day with the rest of the ground and costs
nothing a frame. The look: earth browns and greys whatever the biome (mud is mud on snow or sand), light from the upper
left like the art (a lit lip on each crater, its far wall in shade), team colour only as a faded chip of paint on scrap.

| What | How it's drawn |
|---|---|
| Light scorch | Ragged patches of dry, browned ground over the grass, stronger at first, fading in three steps back to grass. |
| Ash for good / glass | Grey-black earth flecked with pale ash and cinders, flush to scarred neighbours and ragged at the edge; a nuke's glass near-black with streaks of sheen. |
| Shell hole | A lip of lighter thrown earth, a dark bowl, its shadowed far side; up to seven a tile. |
| Churned mud | Brown mud with dark and light ridges where four or more holes overlap. |
| Big crater | A spray of thrown earth and clods, a raised rim with a lit lip, a deep graded bowl; spills onto the tiles round it. With rain: a dark puddle with a sky glint and raindrop rings. |
| Scrap | A burn under each pile, then up to seven pieces: bits (twisted plates, a wheel), a warbot's hull broken in two and burnt through (a leg strut, its head rolled off), a heavy wreck on its tracks (burnt-out cab, rust, torn plating), a building's rubble (concrete chunks, rebar). Cut up for salvage: a stripped, paler frame. |
| Bones | A bleached spine, ribs, skull and a leg bone with a soft shadow, at three sizes. |
| Stumps | A charred split stake with an ashen lit side and its shadow, or a burnt fallen log. |

**The Nov 2026 redraw (waiting for the owner's approval).** The ground is no longer flat tile-sized patches:
`paintScarGround` paints each scarred tile pixel by pixel from fields with a value at every tile's middle (`scarFieldsAt`:
the blight, a light scorch, ash or glass, torn earth and churned mud), blended between the four nearest tiles, its edges
broken by a world-space noise (`scarNoise`, a 256 px tileable value noise made once) so neighbouring tiles meet with no
seams, in ragged organic shapes, fading out before a tile with no scars. The grain, ash flecks and cinders, glass sheen
and the churned mud's ridges come from the same noise. A changed scar repaints the tiles round it too (`flushDirtyTiles`).
Shell holes and big craters are lit heightfields (`renderer/fx/scars.py`): `scar-hole` (8 variants, 64 px) and
`scar-crater` (4 variants, 256 px; the rim at 0.3 of the frame), earth browns with a lit lip, a far wall in light and
thrown clods; they are baked art (`bakedArt`), so the map is baked again when they arrive. Without them the code holes
are drawn.

A sprite set could replace the scrap and bones later (renderer, `art/` like the wrecks: `wreck-<type>`); keep them flat
on the ground and small, since they are baked at 32 px a tile and redrawn at 64 or 128 close up.

### Batch 33: Passenger Town's buildings (installed; the ground drawn in code)

The owner's art direction (Nov 22 2026): the mood of the dense sci-fi cities of *Industries of Titan*, not their
content: our own buildings, in our camera view. A dense grid of blocks packed with mid-rise and taller buildings of
varied heights and footprints (not a sparse suburb); chunky blocky forms with rooftop clutter (vents, tanks, fans,
landing pads, antennas); many small warm-lit windows (amber, cream) and cool accents (cyan strips, glyph signs, a few red
panel signs); a few landmark towers and a big civic block; wide streets with dashed lanes, kerbs and street lamps, a
plaza or two; low haze over it, thickest at dusk and night, deeper toward the map's edges; empty and abandoned, its
lights still running on automatic (LORE: empty, waiting). By day the same forms in muted greys, browns and teal panels,
lights off. A stripped building leaves a cleared lot: a foundation slab, rubble and rebar.

**The buildings** are rendered with `renderer/b/town.js` (concepts approved by the owner Nov 23 2026: "looks great";
`renderer/preview/town_concept.py` and `town_sheet.py` make the concept pictures). One building on its lot, at true
scale (10 world units a tile), in the buildings' 57-degree view but orthographic, 128 px a tile, so neighbouring lots
join exactly; the lot's front-left corner (`lotFL`) is put on the lot's front-left corner on the game's ground.
`?k=` the kind (`TOWN_KINDS`), `w`/`h` the lot, `v` the look, `strip=1|2` being stripped, `tod=night` lights on.

| Kind | What |
| --- | --- |
| `house` (walk-up flats) | A row of two or three narrow walk-ups of four to six floors, each its own colour (brick reds, cream, browns), balconies with pale rails, a stair tower and antenna; a deep lot gets a taller block behind |
| `shop` (shopfront) | A tall glazed ground floor under an awning and a sign band in Accord script, shutters half down on some; two or three floors over it set back, condenser units on the ledge |
| `flats` (apartment block) | A front slab with balconies, a taller back slab, a lift core taller still in teal panels with a cyan strip; a billboard or big tank on the roof |
| `tower` (residential tower) | A podium of shops, a shaft of 12 to 16 storeys with a cyan strip and a red bar sign, a lower annex, a crown with a landing pad or a lift house, an antenna with a red light |
| `school` | An L of three storeys round a yard with a painted court, a yellow band, the clock over the door, solar panels and an observatory dome |
| `hall` (civic hall) | A podium and steps, a colonnade, a high chamber with a stepped copper-green roof and the clock, a bare flagpole, skylights |
| `spire` (civic tower) | The tallest thing in town: stepped, cyan light fins up its corners, the beacon's lens toward the sky road, a red-tipped mast |
| `arcade` | A glass barrel roof on thin steel ribs over the street (the owner: thin ribs), kiosks lit by night |
| `car` | A dusty town runabout, flat tyres, a rust patch |

Being stripped (`strip=1`): the top floors gone, panels out, scaffold and a green net over the front, girders over a
dark hole where the roof was, crates of salvage at its foot; `strip=2`: only the frame left (columns and slabs), rubble.

`renderer/tools/render_town.sh` renders every lot in `renderer/tools/town_footprints.json` (each kind and size
townSetup lays, with how often: `node tools/town_footprints.js` writes it again when the layout changes), in three
looks for the commonest lots (a 2 x 2 walk-up, a car), two for any lot at least 0.3% of the town and one for the rare
ones; each by day and at night, and the first look stripped twice by day (`tools/install_town.py jobs` lists the jobs).
Then `python3 tools/install_town.py` blooms them, takes them down 2x, crops them and writes `art/town/` at 96 px a tile
(72 for a rare lot: under 0.1% of the town, the civic halls, schools and long arcades), the stripped looks at 64: about
3.7 MB in all (day and night 2.55 MB, stripped 1 MB, shadows and the list 0.17 MB; the web game loads only the lots in
play, the stripped ones once stripping starts):

| File | What |
| --- | --- |
| `<kind>-<w>x<h>-<v>.webp`, `-n.webp` | By day; at night, lights on automatic, lifted with 13% of the day render (`NIGHT_LIFT`) so the roofs read, brighter than the shared very dark night (the owner) |
| `<kind>-<w>x<h>-1-s1.webp`, `-s2.webp` | Stripped, scaffold and frame, by day only, the lot's first look whichever look it was (the scaffold covers the change): their lights are cut, so the game grades them at night (`TOWN_NIGHT`, a little lighter than the land) |
| `-sh.webp` | The shadow alone (black, its alpha the shadow) at 16 px a tile, as the town's ground |
| `town-art.js` | `window.TOWN_ART`: each lot's looks and their marks in the sprite's pixels: `fl` (the lot's corner), `roof`/`roofG` (the sentry's post and the ground under it: the drawn height), `mast` (a tower's red light), `beacon` (the civic tower's), and at night `flick` (a few lit windows the game lets falter) |

All of it loads only for a Passenger Town map (`ensureTownArt` in js/city.js: the list first, then the pictures of the
lots that town has, the stripped ones once stripping starts); in the one-file copy it's a bundle beside the page
(`dist/town.js`). Morning and evening are made in the game: the day render graded for the time, and at evening the night
render laid over it at the share the lights are on. A lot size the art doesn't have uses its kind's nearest, stretched
across; with no art at all (still loading) a building is a plain block. To regenerate: change `b/town.js`, run
`tools/render_town.sh` (about an hour on four cores; delete `out/town` after), `tools/install_town.py`, and look over
`tools/install_town.py --sheet <png>`.

**The rest is drawn in code** (`js/city.js`):

| What | How it's drawn |
|---|---|
| Streets and lots (`townGroundCanvas`) | One picture of the whole town at 16 px a tile, made again only when a building comes down, its look changes or the roads on it change, drawn with the ground (graded with it at dusk and night): asphalt with grit, concrete block slabs with a pale kerb and its shadow, dashed lane lines down every street, light thin zebra crossings, parking bays, plazas (paving grid, planters, a dry fountain), stripped lots. Roads on it (the avenues, old Accord roads, and any a colony lays) are cut out in the shape the map draws roads, so they show through. A square town (four colonies) fades out on all four sides; a round one (three) is clipped to its outline (`townEdge`) and fades out round it. Every building's shadow goes on it as one layer (where two fall together they don't darken twice), at 45%. |
| Buildings (`townDraw`) | The sprite for the time of day (halved copies for drawing it small; a few graded versions made a frame, kept while in use), sorted with the robots by their foot. A building in front of one of your robots (or one you've selected) fades to 35% while it's behind it. At night a few lit windows falter now and then. |
| Sentries (`townSentryDraw`) | A squat white Accord security robot with a blue band and a lit cyan visor, on its look's `roof` mark; its armour bar once hit. |
| The rest | The civic tower's beacon pulsing from dusk to dawn and a tower's red light blinking (on their marks), street lamps at the crossings (lit at night, with light pools), the WELCOME TO ITHACA sign (the landmarks' `lm-sign` art and glow) at each end, the haze (`townHaze`: a band over the town, thicker at the map's edges, banks of it drifting east) and the name in atlas lettering zoomed out. |

### The Walking Factory (installed)

The owner picked look A, the **Foundry Crawler** (Nov 23 2026), of three concepts (B the Accord Strider, a pale ceramic
hull on long insect legs; C the Factory Block, a works shed and control tower on braced columns). It belongs with the
Foundry, Refinery and Smelter: a heavy gunmetal box-girder chassis on six box-section legs with hydraulic rams,
Accord-yellow knee drums and wide pad feet; at the back a foundry block with twin sooted stacks, a refinery column, a
crucible of molten alloy and a slewing yellow crane over the deck; in the middle a big open square of tread plate
(about 2.7 × 3.2 tiles) with a painted muster ring and yellow rails, where the robots aboard stand; at the front an
open-roofed fabrication bay with a lit floor and a hazard-striped chute down to the ground ahead (its exit). The
holder's colour is on the flank bands, the bay's door lights and the corner lamps. At night the furnace glows, the deck's
floodlights and the works' windows are lit. Hull 5.4 × 3.4 tiles; a tripod gait, one leg cycle per 1.3 tiles walked,
three feet always down, the feet 3.35 tiles out from its middle line (`WALKER_LOOK.reach`, where the yard's ruts are).

**How it was made:** `renderer/b/walker.js` (the concept kit and scene A merged), with the renderer's own `lib.js`
materials, sun, time of day and glow pass. `renderer/tools/render_walker.sh` renders the game's set, `view=top`:
orthographic straight down, facing right, `W=20` world units (10 tiles) across at 2560 px, centred on the deck (the
riders stand round its middle), the sun nearly overhead so the baked shadow sits under it whichever way the game turns
it; composed with `compose_any.py --b1 7.5 --b2 20` to 1280 px (128 px a tile). Then `renderer/tools/install_walker.py`
writes `art/walker/` as WebP (q82; the team layer q85 at half size): 29 pictures, about 1.4 MB.

| File | What | How the game uses it |
|---|---|---|
| `walker-f0` … `walker-f5` (+ `tod/<morning\|evening\|night>/`) | Walking: the six frames of the gait, the holder's parts dark plate (`part=base`), the bay and furnace lit | `walkerArtBody` (js/walker.js): 10 tiles across at its middle, turned to its heading (eased round for the eye: `walkerFace`), frame `floor(od / 1.3 × 6) mod 6`; the time of day's frame, faded into the next as drawArt does |
| `walker-rest` (+ the same) | Dormant in its cradle: every foot down, the hull lowered, the work lights, furnace and bay out (`rest=1&dim=1`) | While it hasn't woken (`ph` 0) |
| `walker-team` | The holder's parts alone in white with their glow (`part=team`), every other surface depth only; one layer for every frame (the hull is the same in all of them), 640 px | Tinted to the holder's colour (`walkerTint`, a little white kept in the hot middles) and laid over the frame, pulsing a little; no one's: dim Accord amber, 55% walking, 30% dormant |
| `walker-art.js` | `window.WALKER_ART`: the frames, the stride, and the marks in tiles from its middle (u ahead, v right): `exit` (the chute's foot), `stacks`, `crucible`, `deck` | The chute's foot glows in the holder's colour as the next Warbot nears; smoke rises from the stacks while it walks (`walkerArtSmoke`) |

It loads only for a Walking Factory map (`ensureWalkerArt`, from `walkerGround`): the list, then every picture. In the
one-file build it's a bundle beside the page (`dist/walker-art.js`, `window.WALKER_BUNDLE`). Until the day frames are in
(or if they fail), the old drawing in code stands in. The ring, claim arc, countdown, CONTESTED and its name are drawn
in code over it (`walkerMarks`). To regenerate: change `b/walker.js`, run `tools/render_walker.sh` (about two minutes on
four cores), then `python3 tools/install_walker.py`; the concept renders were `view=hero` (the buildings' 57° camera,
with a crew and a Warbot on the line).

### The Dam (drawn in code; no images)

The Dam map's walls, floods and lakebeds are drawn in code in `js/dam.js` (no art files yet): each dam a concrete wall a
little over half a tile high (`DAM_H`), its crest light grey with parapets, its valley face darker with shuttering
seams and a spillway gate with a trickle over it; up to 12 cracks (the same for a dam every time) spreading as it
weakens, water seeping from them below half, chips flying while it's hit, a strength bar while it's hurt, and your
order as a dashed outline (red: wreck; green: shore up). Burst: the broken ends stand, rubble in the breach and the
lake pouring through it (white water and spray, fading as the lake drains). The flood is drawn on the ground: silty
blue water spreading from the dam's foot with a foaming front and streaks running down the valley, then wet silt as it
goes down; the drained lakebed is dark mud with puddles, fading to a faint stain. A rendered wall sprite (intact,
cracked, burst; by day and night) would be the art to ask for.

### Weather (drawn in code; no images)

`js/weather.js`. **The Nov 2026 redraw (waiting for the owner's approval):** the haze, mist, dust and driven snow are
layers of soft noise (`wxTex`, from the war scars' `scarNoise`; `wxLayer` tiles one over the view as a pattern),
stretched along the wind and scrolling at different speeds, instead of round blobs: the sandstorm and blizzard a darker
body, lighter billows and fine bright streaks whipping past; the rain's mist banks and gusting sheets; the swamp fog's
slow banks and quicker wisps; the ashfall's smoke. Rain falls in three depths (a fine far haze of drops, the main fall,
a few big near streaks), heavier where a gust sheet passes; splashes throw a crown of droplets; lightning lights one part
of the sky most. Saver draws one layer of each and no far rain. Colours stay those of the old drawing.

### Light pools (drawn in code; no image)

The glow buildings, blasts and robots throw on the ground at dusk and night (`lightPool` in `js/daynight.js`, one per
colour, made once): light from a lamp above, so nearly white and hot in the middle, falling off as light from a height
does (1 / (1 + (r/r0)²)^1.5) through the colour itself to a long faint tail, finely dithered so it never bands. It
replaced the tinted `art/tod/shared/light-pool.webp` (kept for `renderer/`'s mock-ups; no longer loaded). The street
lamps' own pools are still art (`streetlamp-*-pool`).

### Megastructures at night (drawn in code; no images)

The owner, Nov 25 2026: the megastructures stood dark beside a lit base, their night renders' lamps too dim. So at dusk
and night (as `TOD.state.lights` rises) each one but Arrival City (its own `cityLights`) gets, over its sprite
(`megaNight` in `js/render.js`):
- **A light layer**, made once per night image and colony colour (`megaNightLayer`, 512 px, kept with the image) and laid
  on additively in one draw: the night art multiplied by itself three times (only its lamps and lit windows left) and
  bloomed (a 96 px and a 32 px copy scaled back up); the deck floodlit warm-white (`#ffd9a8`) from the middle of its pad
  (the day art, faded out toward the edge, at 34%); an LED strip in the owner's colour round the pad's edge, with a soft
  glow. Only blending, no pixel reads, so it works on a page opened from a file.
- **Beacons** (`MEGA_LAMPS`: the pad's edge and each lamp as fractions of the sprite): red warning lights blinking slowly
  on the tall parts (the Lift's anchor and huts, the Ray's stacks and bore tower, the Deep Core's headframe, the Engine's
  rim, the Uplink's small dishes, the Lance's corner rigs and its muzzle, `lanceTipLight`, which turns with the gun);
  white floods on lamp heads; a lamp in the owner's colour on the Dome's emitter and the Lift's anchor.
Their own lights stay as they were (the Lift's cable, the Uplink's rim, the Deep Core's shaft, the Engine's plume, the
Lance's charge glow, the Dome's shimmer). Knocked out or offline (`megaOut`) it is dark: its graded day art in place of
the lit night art (`drawMegaArt`), no layer, no pools, its Lift cable dim and unlit, and only its amber lamp blinking
(`drawMegaDark`). A site is drawn as any site. Moving a lamp: change its `[u, v]` in `MEGA_LAMPS` (read off the night
render, 0..1 across and down).

### The minimap (drawn in code)

`minimapDetail` makes its picture at a few pixels a tile whenever the land, the borders or the roads change: the tile
colours softened, the relief (higher ground lit along its top-left edges, a little shade down-right), a pale line of surf
on every shore, the roads as fine light lines, each colony's border as a crisp line in its colour over a lighter tint,
and the resources as small dots in their colours. Buildings have a dark rim and a lit top; the view is a thin white
frame with a dark edge and brighter corners.

### Wind, water, sky and the planet view (drawn in code; no images)

The owner's theme for these: the immense beauty of the planet, being torn apart by war. All of it is drawn in code
(`js/nature.js`, `js/menuplanet.js`) and none of it takes art, but these are the looks to keep if any of it is ever
redrawn as images:

- **Wind.** One wind for the whole map, blowing the way the clouds drift. Up close the trees and plants lean a few
  pixels downwind and shiver; gusts roll across them as waves. On the grass the gusts show as long crests of light
  (`255,248,214`) with the darker side of the grass (`58,54,40`) just upwind, rolling with the wind at about three tiles
  a second, faint enough that roads, buildings and robots read as before. A blast shoves the plants outward and sends a
  ring of flattened grass out from it.
- **Water.** By day: short horizontal flecks of sun on the ripples, warmer in the morning and evening, thickest toward
  the top of the view. At night: Argos as a soft glow with a broken column of light under it, the Ring's band as a long
  streak of glitter, a few stars; all of it fixed on the screen, as reflections are. On every shore a soft line of foam
  runs up and slides back.
- **Wet ground and frost.** After rain the land is a shade darker and cooler, roads glossy, puddles pale with the sky;
  at night lamps and lit buildings leave long streaks of their colour on the wet ground. Frost is small white six-armed
  crystals and pale patches over a cool tint, creeping in from the hollows of a noise field at dawn.
- **The night sky on the land.** The Ring's light is silver and faint, a little stronger on one side of the map; its tint
  and angle differ by planet (`NATFX.ring`). Auroras: green, sky blue and violet on the Polar Caps, violet and rose in the
  Bloom, pale blue and teal on Argos.
- **The planet view.** Past the map's edge, the map's own ground carries on, mirrored and faded into a haze in the biome's
  colour (`NATFX.haze`: ochre for the Rust, grey-green for Greenreach, pale blue for the Polar Caps, near-black for Argos
  and the Hollow), thickening outward; a soft dark line marks where the usable land ends. Zoomed right out the camera
  tilts a little and the far side is a little lost in haze.
- **The main menu: Corvane's system** (only what LORE.md has in the sky). Beside the card (across the top on a phone),
  Corvane glows orange-white with a breathing corona, a thin anamorphic streak and faint lens rings, flaring now and then.
  Ithaca I goes round it on a slow, flattened orbit (four minutes), bigger on the near side, passing behind the star's
  glare on the far side, its lit side always toward Corvane, turning west to east. Its face is the atlas (LORE.md: The
  atlas; `art/lore/ithaca-map.webp`): the three continents and their seas, the regions' colours blended softly across
  their seams, the ringfall belt's craters, polar ice, under the Contingency globe's own clouds (`art/globe/ithaca-clouds.webp`,
  their shadows a little east of them), lit as that globe is (since Nov 2026: a soft terminator with a warm band, the sun's
  glint on the seas, the blue haze of air toward the limb and a blue halo round it, thicker toward Corvane), and on the
  night side the colonies' lights along the coasts and in the territories' hearts (few in the Bloom, none on the ice). The war is down there, kept distant: small orange-white bursts in a few
  fronts near the lights, a red glow (and by day a smudge of smoke) where they fought, now and then a missile's thin
  line arcing between colonies and a brighter strike with a fading ring; after a few minutes on the menu, rarely, a
  nuclear blast (a white flash lighting the night side and the Ring, a pale ring spreading, an orange glow fading over
  half a minute). The Ring in cream bands, brightest toward the star; Argos, grey and cratered, going round with its
  shadow crossing the planet; the four vanguard Carriers as tiny white specks with a blinking light; ringfall streaking
  into the atmosphere; the Wren's speck and thruster trail coming in from the system's edge. A deep starfield (far stars
  and a faint nebula, nearer stars drifting a little), and a soft dark shade behind the card.

### The Walking Factory (drawn in code; no images)

The old Accord mobile works on its map (`SHAPE_PRESETS` walker) is drawn in code, in `js/walker.js` (`WALKER_LOOK`: its
sizes and colours). Straight down like the rest of the map, its stacks and crane standing up toward the camera:
weathered grey plate with rust streaks, old Accord yellow (`#d8b04a`: knees, crane, the Accord's ring-of-four mark), its
holder's colour on its flanks (with hazard chevrons), corner lamps, stack bands and a pennant on the crane. Six legs in a
tripod gait, stepping by the tiles it has walked, their knees raised; a grating deck at the front where the robots
aboard stand (drawn under them), the works at the back, its line's ramp at the front glowing as the next Warbot nears;
its stacks smoke while it walks (not with reduced motion). The yard round it is a paler disc with two worn ruts of
footprints and the cradle's dashed pad in the middle. On top: the deck's ring (dashed in its holder's colour; flashing
red and white when contested), the claim's arc in the claimant's colour, the next Warbot's countdown arc, and THE
WALKING FACTORY with its state over it. A rendered sprite set (a walk cycle in eight headings) could replace it later.

### Radiation (drawn in code; one optional image)

Fallout zones and breached Reactors (README, Nuclear race, "Radiation"; `js/radfx.js`). All drawn in code:

| What | How it's drawn |
|---|---|
| A zone on the ground | The grass under it drained of colour and dulled (a plain grey wash on Saver), a sickly green-yellow haze (`#96be28` to `#cee448`) thickest towards the rim and soft past it, a dark-backed dashed ring of `#def85c` on the edge, creeping round, and a small yellow-and-black trefoil on its north side close up. At night the haze adds light. |
| Motes | Small green-yellow and pale mint specks drifting up through the haze (more on High and Ultra, none on Saver). |
| A robot in a zone | A green glow round it, flickering, and specks rising off it. |
| The reactor ruin | The owner's Reactor art, greyed and darkened, its cooling stack cut off along a jagged line (a charred rim, bent rebar, a dark mouth), a hole torn in its dome, burns across the pad and pieces of the stack on it; a darker blue-grey copy fades in at night. While it's hot, the stack's mouth glows green and the dome's hole blue. |
| The light column | At night, over a hot ruin: a beam of light straight up from the stack, pale green-white at the bottom through green to blue, fading into the sky about 12 tiles up, with a wider soft halo (not on Saver) and its light on the ground round the ruin. |
| Minimap | A ringed green-yellow disc for each zone; a green dot for a hot ruin, grey for a cold one. |

`reactor-ruin@0` / `reactor-ruin@1` (optional, 512 px like the Reactor, same anchor): a painted ruin would replace the
code-made one by day; keep the broken stack's mouth near (160, 140) and the dome's hole near (302, 176) of the 512, where
the glows and the light column are drawn (`RADFX.stack`, `RADFX.dome`).

### The Campaigns hub pictures (`art/menu/`)

Each card on the main menu's Campaigns page has a 320×320 WebP shown at 160 px. **Contingency** (`contingency.webp`) is
Ithaca I from orbit, made from the Contingency globe's own picture (`art/globe/ithaca-2048.webp` and the clouds) with
the same top-left light, sea glint, blue limb and Argos beside it. **Missions** (`missions.webp`) is the tutorial's first
order: the Command Base on the red ground, a Worker and a dashed route to a glowing objective ring, from the game's own
sprites. Both are made by `python3 tools/menu_icons.py . art/menu` (the owner asked for them, Nov 23 2026); the Main
Campaign's picture is unchanged.

### Not swappable yet (ask Claude Code if you want these)

- Menu background and logo
- Laser beams, the white blast flash and the Pulse Turret's glow (the other effects are in Batch 15)
- The work animations: a builder's weld, mending, paving, loading a crate, and the gathering moves (scything Reedcane
  and Bloom veins, drilling Ore and Uranium, hammering boulders and rock faces, the Crystal cutting beam, an Agribot
  picking and planting) are drawn in code, with the tool on a drawn arm (`drawToolArm`: a heavy upper arm with its
  hydraulic ram, a lighter forearm, bolted joints, its shadow). The tool heads are small sprites made once in code
  (`workTool`, `WORK_TOOLS`: the scythe blade, the drill head and bit, the hammer head, the gripper's palm, the welding
  torch, the repair wrench, the screed bar (workers spread concrete with it; the Paver drags it as a heated screed over its asphalt, with a glowing seam of hot mix and spitting flecks); 64 px, straight down, lit from the top left), so painted ones could replace
  them one for one (same keys, pointing +x). Sparks are short hot streaks that cool from white to orange (`workSpark`);
  a weld's sparks fall and skip off the ground. Mending (a Worker repairing a building) works one spot, then moves round;
  a Worker's load is small steel-framed crates with the good's colour on the lid (`goodsCrate`), and when it picks one up
  or sets it down its arm lifts the crate on or off (`drawHaulMove`, watched from `carry` alone, nothing kept in S). The
  chips, dust, motes and glints stay code-drawn
- App icon: its source is `icons/icon.svg` (the planet, ring and T in flat colours). To change it, replace the PNGs in `icons/` (`icon-192.png`, `icon-512.png`, `icon-1024.png`,
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
  Turret's `fx-pulse-laser` and `fx-pulse-hit`. Rendered here with `renderer/` and installed: the **3D Pulse
  Turret** (`turret@0/@1` base and `turret-head-0…15@0/@1`, anchor [0.5, 0.615], scale 1.4, every time of day) with
  its charge-up sheets (`turret-charge-0…15`, 8 frames each) and barrel tips (`PULSE_MUZZLES` in `art/emitters.js`);
  the electrified **Walls and Gates** (`renderer/walls`: `wall-post`, `wall-n/e/s/w`, `wall-hub-ew/ns`,
  `gate-ew/ns-closed/open`, each `@0/@1` with six spark frames, every time of day); the **Viaduct's abutment**
  (`viaduct-abut-w/e/n/s`, the bridge scene's `abut-*` piece); and the working loops of the **Oil Pump**
  (`pump-base` plus `pump-work-0…7`, re-lit too), **Refinery** and **Smelter** (`refinery-work-`, `smelter-work-0…7`,
  light).
  Installed from the Fuel update: the **Tanker** (`tanker@0/@1-f0…f3`, `-brake`, `-boost`, time-of-day frames and
  `tanker-headlights`), the **Generator** (`generator`, time-of-day versions and the working loop `generator-work-0…7`,
  played at 8 fps while it runs; any building with `<type>-work-0…7` art gets the same), new **Freight Truck** frames
  with exhaust stacks, and the diesel smoke sheets (`fx-exhaust`, `fx-exhaust-heavy`, listed as `smoke-exhaust` and
  `smoke-exhaust-heavy`). Smoke points live in `art/emitters.js`: `EXHAUST_POINTS` (truck, tanker, Road Train stack
  tips) and `BUILDING_EMITTERS` (chimneys and vents, from the animation brief's `building-emitters.json`). Smoke and
  black smoke and steam use the exhaust sheets for now; flame, sparks and dust points wait for their own sheets.
  Rendered here with `renderer/`: the **pipe pieces** (`art/pipes/pipe-straight`, `-corner`, `-tee`, `-cross`,
  `-end`, `-raised`: 256 px tiles, straight down, from `renderer/b/pipe.js`; the game picks the piece and turns it from
  the pipe's neighbours, and uses the raised one on a gantry where the pipe crosses a road, track or water) and the
  **fuel blast** (`fx-fuel-blast`, 16 frames in a 4 x 4 grid from `renderer/fx/fuelblast.py`, played over 1.15 s
  and scaled to the blast). Still to make: `oil-scorch` (the blast leaves the ordinary scorch mark for now).
  Rendered here for the oil blocs: the **Fuel Tank** (`fueltank@0/@1`, every time of day, from `renderer/b/fueltank.js`
  with eight lines in `renderer/jobs.txt`, accent `#ff9a3c`): three domed tanks with crude-stained feet in a concrete
  bund with hazard stripes, a catwalk between the two big roofs, a pipe manifold along the front into a small pump
  house, and the powered-realism layer (team bands round each tank, roof beacons, a bund strip, a floodlight, a
  junction box and conduit). `B3D(...)` like the other buildings; re-render with `python3 tools/rerender.py 'fueltank'`.
  **Renderer:** the three.js renderer that made all the 3D art is in `renderer/` (see `renderer/RENDERER.md`), so new
  sprites can be rendered in the same style right here.
  **Design system:** the Terrafall design system for making new art lives at
  https://claude.ai/artifact/GAdLBz6kefeJeTRz57TTV7 (it can be added to the Claude Code chat so art is designed there).
  Still missing: resources `crop` and `oil`, ground
  `fertile`, `slope` and `cliff`, markers `missile`, `rally` and `oneway`, and the 12 goods icons

### Tips

- Make the Worker and Command Base first, then check them in the game before doing the rest. It's much easier
  to adjust angle, lighting and scale with two assets than with twenty.
- If a building looks too small or too big in the game, change its `scale` in the manifest rather than
  re-exporting. `scale: 1.2` draws it 20% larger.
- Stalk plants are drawn smaller while they are still growing; Ore and Crystal shrink a little as they are mined out.


### Deer and wildebeest

The Greenreach and Emberwood deer use white-tailed deer proportions, with a slender neck,
tapered face, pale underside to the tail and antlers on some adults. Long Grass wildebeest
have a deeper chest, a back that slopes toward the rump, a dark mane and short shoulder bands.
Both use jointed legs for their walk and run. Their horns, antlers and coats follow the scene lighting.

### Steamwells (geothermal basin)

Steamwells uses pale limestone, sulfur ochre, and turquoise and sage mineral water. The
terraces have bright carbonate lips and darker seams, with the same upper-left lighting as the
other terrain. The 512 px textures tile seamlessly. The six centered transparent scenery sprites
show baths, stacked pools, a geyser cone, a dry sulfur shelf and vents. The geyser and vents use
the same tile offsets for their animated steam. The Sky islands use layered limestone canyon art.
The bison are drawn in `js/wildlife.js` with a tall shoulder hump, a low bearded head and short
upswept horns. Those shapes carry the silhouette at game zoom. The fur accents appear only closer in.

Regenerate the WebP set with
`python renderer/terrain/terrain_springs.py art/biomes/springs` using the renderer's Python environment.


### The Shoals (tropical coasts) and lava motion

The Shoals' tropical sand has warm ripples and pale coral grit. Two rendered palm silhouettes, broadleaf
plants and low shoreline vegetation use the same camera and light as the other biome sprites.
Warm sand shows through turquoise reef shallows. Seagulls have white bodies and dark wing tips.
Small waves drift across open water. Fish, dolphins, and whale blows are canvas
scenery, with water ripples and muted silhouettes at night. Lava reuses the baked crust texture
under thin moving highlights and rising steam.

Generate the Shoals' (tropical) WebP assets with
`python renderer/terrain/terrain_tropical.py art/biomes/tropical`.


### Wildlife silhouettes

Deer have a high, slender neck, articulated legs, pale rump and occasional branching antlers. Wildebeest have
a heavy shoulder, lower rump, mane, hooked horns and dark hooves. The game draws these shapes and their gait
from `js/wildlife.js`. Blackwater alligators have low olive bodies, broad rounded snouts, paired rows of
raised scutes and muscular tails. Short legs and splayed feet carry each step. The Bloom’s fauna shares
dark plum plates, warm amber eyes and soft rose highlights. Six-legged hinge-backs open overlapping
plates along a warm seam. Switchtails balance on hooked feet with two flexing tails and raised sensory vanes.
Sailwings bank on ribbed membranes around a narrow body. The hinge-back also uses this art in the Hollow.
The Hollow’s sailwing has a pale body, a thin line of cartilage and translucent violet membranes with
scalloped edges. Its blind crawler has overlapping bone-colored plates, hooked legs and long feelers.
Shoals crabs have red shells, broad pincers and four pairs of walking legs. Their body faces across
the direction of travel during a sidestep.
Red foxes have dark shins, sharp ears and a long white-tipped brush. Arctic foxes have a deeper coat,
shorter muzzles and rounded ears. Geese carry a white cheek patch in both poses, with a long neck stretched
forward in flight and a widening wake on the water. Turtle shells have a domed profile, a pale rim and
separate scutes. Cinderlands ash beetles have six legs and a warm seam between dark wing cases. Ember moths
have charcoal forewings, rust-colored hindwings and bright bands that flicker as they flap.

Blackwater herons fold an S-shaped neck while wading and extend it in a fishing strike. In flight,
the neck tucks in and the feet trail behind broad wings. Woodland owls have feather tufts and darker
facial discs. Snowy owls have round heads and barred pale feathers. Both use the same positions for
their eyes and eyeshine as they scan. Rock lizards have a low, sand-colored body, splayed toes and
a tapering tail that swings through their darting gait.

The dolphin’s pitch follows its leap, with a swept dorsal fin, moving flukes and a splash fixed
where it reenters the water. Gulls have gray mantles, black primaries and white wingtip spots.
They bank while flying and pull their wings in as they approach the ground. Hares alternate a
crouched body and a long bound. Dry-biome hares have sandy coats. Polar hares keep white coats.

Dusk bats have dark brown bodies and scalloped membranes stretched along visible wing fingers.
Each bat varies its wingbeat and banks into turns. The wings compress asymmetrically during a
bank, so the motion reads at game scale.

Soaring birds have species-specific profiles in `SOARING_BIRDS`. Hawks have broad wings and a broad
rust-colored fan. Vultures rock gently on long, fingered wings. Crows beat more often and spread a
rounded fan, while ravens coast longer between beats and show a wedge tail. Both the flight and shadow
draws use the same outlines.
