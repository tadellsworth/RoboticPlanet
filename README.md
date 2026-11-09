# Terrafall

A colony and logistics strategy game that runs in the browser, on phones and on desktop widescreens. Your robots land
on a dusty alien planet: gather resources, link them into supply chains with a network of roads, build more robots and
spread across the map. Roads are the heart of the game: Haulers only drive on them, so where your roads go decides
how goods move.

- **Versus:** race a rival AI colony across the planet. Capture its Command Base to win (about 20–40 minutes).
- **Colony:** no rival. Settle the planet at your own pace, with colonization milestones. Free play has the full
  building roster, missiles and nuclear silos included, to experiment with.
- **Missions:** eight set challenges on hand-picked planets, each with its own goals and Easy, Normal and Hard
  levels. Finishing one unlocks the next and shows an unlock code for it, so progress can move to another device.

Before each game, sliders set the **map size** (Small to Huge), the **terrain** (Flat, Gentle,
Rolling, Rugged, Mountainous), the **resources** (Scarce to Abundant), the **map shape** (Standard or Long haul), the
**biome** (Red desert, Jungle or Polar: scenery only, with plants that roads and buildings clear) and an optional
**Nuclear race**. Resources come in separate
fields: your landing zone has a little of everything, and the rich fields beyond it are worth fighting for.

Terrafall is an original game in the colony-logistics genre. It contains no code, art, sound or data from
any other game.

## Play it

- **Hosted:** once GitHub Pages is enabled (see below) the game lives at https://tadellsworth.github.io/RoboticPlanet/ (in general
  `https://<your-user>.github.io/<repo>/`). On a phone, open it and use **Add to Home Screen**: it runs
  full-screen like an app and works offline.
- **Locally:** from this folder run a static server and open the address it prints:

  ```bash
  python3 -m http.server 8000
  ```

- **Single file:** `node tools/build-single.js` writes `dist/terrafall.html`, the whole game in one file you
  can open directly or send to someone.

Progress auto-saves in the browser every 20 seconds and whenever you leave the page.

## How to play

The full illustrated guide is **[how-to-play.html](how-to-play.html)** (open it in a browser; once GitHub
Pages is on it is at `…/how-to-play.html` next to the game). The short version:

| Building | Does |
|---|---|
| Harvester | A worker cuts teal stalk groves into **Fiber** |
| Quarry | A worker breaks boulders into **Stone** |
| Ore Mine | A worker digs **Ore** from dark veins |
| Crystal Tap | A worker taps violet clusters for **Crystal** |
| Grove Planter | A worker plants new stalk groves |
| Smelter | Ore + Fiber → **Alloy** |
| Chip Fab | Crystal + Alloy → **Chip** |
| Bot Foundry | Alloy + Chip → a new **Worker** or **Warbot** |
| Outpost | Expands your territory and garrisons Warbots |
| Pulse Turret | Turns to aim and shoots enemy bots; uses Crystal as ammo |
| Depot | Extra storage, shortens hauling trips; give it supply orders to stock it as a forward base |
| Ramp | Planned in Paths: cuts a slope into a one-level cliff so bots can climb it; counts as road |
| Charging Station | Recharges bots' batteries, four at a time; burns **Fuel** |
| Bio Farm | A worker plants energy crops on fertile soil and harvests them into **Fuel** |
| Oil Pump | Built on an oil seep; a worker pumps **Crude** until it runs dry (stops at 30 Crude by default) |
| Refinery | Crude → **Fuel**, one for one (stops at 30 unless you change its stock limit) |
| Cement Works | 1 Stone → 2 **Cement**, the main building material (stops at 40 unless you change its stock limit) |
| Asphalt Plant | Crude + Stone → 2 **Asphalt** |
| Roadworks | Its Paver paves and maintains the roads you mark for asphalt (or every joined road), nearest first (1 Asphalt covers 4 tiles) |
| Ammo Plant | Alloy + Stone → 3 **Ammo**; warbots reload it in the Command Base and Outposts (Versus) |
| Missile Factory | 2 Alloy + Chip + Fuel → **Missile** (20 s each; Versus) |
| Missile Silo | Fires Missiles at rival buildings up to 18 tiles away; holds 2, reloads in 25 s (Versus) |
| Repair Station | Fixes damaged bots three at a time; 1 **Alloy** repairs 12 health (Versus) |
| Nuclear Reactor | 2 Uranium → 1 **Enriched Uranium** (Nuclear race) |
| Nuclear Silo | 6 Enriched Uranium + 4 Alloy + 2 Chips → one nuclear missile; fires 40 tiles (Nuclear race) |

- **Cement builds the colony.** Nearly every building costs Cement, and so does every road. Only the Quarry (2 Fiber)
  and the Cement Works (4 Stone, 2 Fiber) are built from raw materials, so you can always restart. Stone's other uses
  are Asphalt and Ammo. You land with 24 Cement, 8 Stone, 16 Fiber, 8 Alloy, 4 Chips, 4 Crystal and 4 Fuel.
- **Stock limits:** tap a production building and set when it stops: once you have that much of its product it takes
  no more inputs and its worker goes off to other jobs until it's needed again. The Cement Works stops at 40, the
  Refinery and Oil Pump at 30 and the Asphalt Plant at 20 by default; the rest have no limit until you set one.

- **Workers and Haulers:** Workers run buildings (one inside each production building), go out to cut, dig and mine,
  and build construction sites. They can go anywhere, but off the road they move at 40% speed, except while out
  gathering for their building. **Haulers** move every good between buildings, two at a time, and **only drive on
  roads**. If every Hauler is lost, workers carry goods slowly until the Foundry makes more. **Agribots** run Bio Farms
  and Grove Planters, **Pavers** run the Roadworks and **Warbots** fight. You start with 10 Workers, 5 Haulers and an
  Agribot (plus 4 Warbots in Versus).
- **Every building needs a road to storage.** Your Command Base starts with a ring of road around it; join each building and construction
  site to that network (or to a Depot on it), or Haulers can't bring it materials or collect its goods. A red road badge
  marks buildings with no road: tap one and press **Lay road** to plan the shortest route (shown dashed), or plan your
  own. Placement keeps a side of every building open for a road.
- **Planning roads:** in Paths, dragging and tapping only sketch a road (and tapping a road marks it to take up);
  the banner, at the top of the screen, shows the cost, with **Undo**, **Clear** and **Build**. Nothing is spent until
  Build. Building closes Paths, straight back to the map; leaving Paths any other way drops an unbuilt sketch.
  Arrows and Junctions still act at once. **Ramps** are planned in Paths too (tap the foot or top of a one-level
  cliff) and count as road once built.
- **Roads through Outposts:** an Outpost can stand on a road, and its tile joins the road network for every bot.
  Bots follow roads round corners (no diagonal shortcuts on or off a road).
- **Your robots:** tap the robot counter in the top bar for every robot by type and what they're doing.
- **Roads** cost Cement (1 Cement paves 5 tiles), paid when you build the plan. Planned tiles show dashed
  until free workers pave them: 1.5 s a tile (3 s through resources), working out from the existing network, so long
  highways take planning and spare workers. Calling off a planned tile refunds it. Roads double a bot's speed. Dragging
  plans roads round resources; tap a boulder, grove, ore or crystal tile to clear it for a road at 3× the Cement. A Roadworks' Paver
  upgrades roads to asphalt (2.75×) with Asphalt, driving out along the roads joined to its Roadworks, however far.
- **Paving and road wear:** Paths → **Pave** (W): drag along roads to mark them for asphalt (drag over marked road to
  clear it). Roadworks pave the marked roads joined to them (or, set to *Every joined road*, everything; the AI uses
  that). Every bot driving onto asphalt wears it (`WEAR_BOT`, Freight Trucks `WEAR_TRUCK`, three times as much): past
  half worn it slows bots (to 2.3× when nearly through), at `REPAVE_AT` the Paver resurfaces marked road, and worn
  through it drops back to plain road. On a busy trunk road that's every 8–10 minutes. Tap any of your roads to see its
  wear and mark it. Removing a road refunds its Cement.
- **Bridges and tunnels:** roads stop at water and rocky crags. The **Bridges** tool in Paths plans roads across them:
  a bridge costs 2 Cement and 1 Alloy a tile, a tunnel 3 Cement and 1 Alloy. Workers build them out from the shore or rock
  face (6–8 s a tile), and they join land on any level. Lay road routes use them only when going round is much longer.
- **Junctions, traffic lights and overpasses:** where three or four roads meet, bots slow down and give way to traffic
  already crossing. Switch the Paths banner to **Junctions** and tap a junction to put up a traffic light (1 Alloy): it
  lets one direction through at a time, switching when traffic waits the other way. On a busy crossing a light moves
  about half as many goods again; on a quiet one it costs nothing. Tap the light again for an **overpass** (4 Cement,
  3 Alloy): one road passes over the other and nobody slows or waits. Tap again to clear it.
- **Traffic map:** **Traffic map** in the Paths banner (or **T**) tints each road green to red by how busy it has been
  over the last minute and rings the spots where bots stand waiting.
- **Long hauls:** tap a Depot and set **supply orders** (how much of each good to keep there). Goods come from your other
  storage, and anything nearby then draws on the Depot. **Freight Trucks** (2 Alloy and 2 Chips at the Foundry) carry
  8 goods and take the long runs: storage to storage and deliveries of 3 or more over 12 tiles. Once you own a truck,
  supply orders always wait for one and trucks only leave with 3 or more goods, so Haulers stay local. Trucks are
  slower than Haulers on concrete (80%) and slow to accelerate, but fastest of all on asphalt.
- **Driving:** bots accelerate away from stops and brake for corners, junctions, red lights and the end of a trip
  (`BOT_ACCEL`, `BOT_BRAKE`, `BOT_CORNER` in `js/defs.js`; trucks have their own, slower values).
- **Frontier riches:** boulders, ore, crystal and oil hold more the further they are from the bases, up to 2.2× in the
  middle of the map; rich deposits sparkle. **Map shape: Long haul** on the new-game screen makes a narrow, long planet
  (75% as wide, 170% as long) with the bases far apart.
- **Raids:** armed warbots holding a rally flag in enemy land with nothing to fight tear up enemy roads near the flag,
  one tile per 12 warbot-seconds. The rival raids your busiest road clear of turrets and garrisons every few minutes
  (Easy rarely, Hard often) once it has warbots to spare. Missiles crater the roads where they land.
- **Traffic:** bots queue on roads, each waiting behind the bot ahead of it going the same way. On two-way roads each
  direction keeps to its own side, but passing oncoming traffic slows bots down. Switch the Paths banner to **Arrows** and
  drag along a road to point it the way you drag (tap a road to turn its arrow). One-way loops keep busy routes flowing;
  going the wrong way up a one-way road is allowed but crawls.
- **Goods panel:** tap a goods counter in the top bar for that good's stock, production and use per minute, net rate,
  which buildings make and use it, and any shortfall (buildings waiting on it with none in stock). Switch goods at the
  top of the panel.
- **Ammo:** warbots carry 20 shots and reload in your Command Base and Outposts, which haulers stock from an Ammo Plant. Out of
  ammo, a warbot can't fight at all: it heads back to a garrison to reload, and only armed warbots answer orders.
- **Repairs:** nothing heals by itself. Damaged bots go to a Repair Station (workers below 60% health, warbots below
  70% once their garrison is quiet), which uses 1 Alloy per 12 health. To fix a building, tap it and press **Repair**:
  you pay 1 Cement for every 6 missing armor and a free worker restores it.
- **Statistics:** the pause menu and the end-of-game screen show graphs of bots, land and goods over time and how busy
  each kind of building was; each building's panel shows its recent busy time.
- **Terrain levels:** the planet has terraces at different heights (lighter ground is higher). Bots
  can't climb cliffs; they use slopes at narrow passes, so some routes are long. Pave busy routes with
  Paths (slopes too) and build a **Ramp** to open your own way up. Buildings can't be placed where they
  would block the only way through a pass.
- **Priorities:** tap a building or construction site and set it to Low, Normal or High. High-priority
  buildings get workers and goods first; low ones are served last and lose their worker first when
  workers run short. A priority set on a construction site ends when it's built (back to Normal). **Pause** frees a building's worker entirely.
- **Storage:** tap your Command Base or a Depot. *Fill first* makes haulers bring finished goods there before
  any other storage; *Empty out* takes nothing new and moves what it holds elsewhere (handy before
  demolishing it). You can also switch individual goods off for that building.
- **Minimap:** tap or drag it to jump around; red pulses mark buildings under attack. The × hides it.
- **Sharp map:** the map is baked once at 32 px a tile for zoomed-out views; zoomed in, the part on screen is baked
  again in 8×8-tile chunks at 64 or 128 px a tile (a few per frame, least recently seen dropped), and big art images
  keep half-size copies so they shrink cleanly (`drawMapLayer`, `artMip` in `js/render.js`).
- **Batteries:** bots drain their battery walking, working and fighting, and recharge only at a Charging Station (or,
  for warbots, inside an Outpost). The Command Base doesn't charge anyone and you land without a Charging Station, so
  build the first one straight away (it runs on the 10 Fuel you land with). A flat battery means half speed and half power. Charging Stations burn Fuel (one Fuel is about
  three quarters of a full charge). A Bio Farm makes about
  2–3 Fuel a minute; an Oil Pump and Refinery up to 10 a minute until the seep runs dry (both stop at 30 by default).
- **Army orders:** tap **Army**, then a rival building to attack it with warbots or a missile, or open
  ground to send warbots there to hold the area under a rally flag. Tap the flag to call them back.
- **Garrisons:** tap an Outpost or your Command Base to set its **garrison priority** (new warbots, and ones called back
  from a flag, fill High garrisons first and Low ones last) or to **station warbots** there: choose how many and they
  march over from your other garrisons (each keeps one at home) and stay until you move them.
- **Missiles** are built at a Missile Factory (2 Alloy, 1 Chip and 1 Fuel each, 20 seconds) and carried to Missile Silos
  by haulers. A hit does 24 damage, which wrecks most buildings outright, plus 5 to other rival buildings and 9 to bots
  within 2.2 tiles. Outposts and Command Bases drop to almost no armor; warbots still have to walk in and capture them.
  To fire, tap a Silo and press **Aim missile**: its 18-tile range shows as a red ring; tap any spot inside it (a
  building or open ground) to see the blast radius, then **Fire**. (Army → rival building → Fire missile also works.)
- **Nuclear race** (new-game option): six small Uranium deposits glow green across the map. An Ore Mine within 4 tiles
  digs Uranium before ore; a Nuclear Reactor enriches it (2 → 1) and a Nuclear Silo assembles a missile from 6 Enriched
  Uranium, 4 Alloy and 2 Chips (60 s), so 12 Uranium a bomb. It flies 30 s (the target is warned and sees the blast
  ring) and wipes out every building, robot and road within 6 tiles, yours included; a Command Base survives with no
  garrison and 1 armor. The ground stays scorched for 4 minutes: nothing can be built there. The AI races too.
  Tunables: `NUKE` and `URANIUM_DEPOSITS` in `js/defs.js`.
- **Pace:** the whole game runs at 85% speed (`GAME_PACE` in `js/defs.js`) for a calmer feel; the speed button
  gives 2× and 3×.
- **Ordering bots:** the Bot Foundry only builds the bots you order. Tap it and use +1 or +5 for Workers or
  Warbots (Clear cancels the queue); with nothing queued it sits idle and uses no Alloy or Chips.
- The **Build** menu shows how many of each building you already have, and how many are being built.
- You can only build inside your border. Outposts push it out (7 tiles around them).
- **Salvage:** a colony out of Stone or Fiber with no Quarry or Harvester that can still work salvages 1 every 20 s from
  its Command Base (up to 6), so it can always rebuild. Capturing an enemy Outpost takes its land,
  and enemy buildings left outside their border are lost.
- **Controls:** drag to pan, pinch or scroll to zoom, tap anything to inspect it.
- **Game speed:** the speed chip in the top bar opens 0.75×, 0.875×, 1×, 2× and 3×.
- **Desktop (RTS controls):** on a wide screen the top bar is one row, the tools sit in a small dock and panels open
  on the right. Drag a box to select warbots (Shift adds; a box round a garrison takes its spare warbots), right-click
  ground to hold it, a rival building to attack, or your garrison to station them. Ctrl/Shift+1–9 saves a control
  group, 1–9 recalls it (twice jumps to it). Pan with the arrow keys, the window edge, or right/middle drag; hover for
  tooltips. Keys: **B** build then a building's letter (or **B R** for roads), **P** paths (**R** roads, **G** bridges
  and tunnels, **V** ramps, **W** pave, **O** one-way arrows, **L** junctions, **T** traffic map), **A** army, **F** select all warbots, **J** latest alert,
  **H** base, **[ ]** speed, **+/−** zoom, **M** minimap, **Space** pause, **Esc** back / clear selection.
  Phones and tablets keep the touch controls.

## Custom art

Buildings, bots, resources and ground use custom art made in Claude Design (`art/`, with SVG sources in
`art/source/`). The production buildings, Depot, Outposts and construction sites use the pre-rendered 3D set
(512×512, each on its own pad, placed by an `anchor` point in `art/art-manifest.js`), as do the Charging Station, Bio
Farm, Oil Pump, Refinery, Cement Works, Asphalt Plant, Roadworks, Ramp, Ammo Plant, Missile Factory and Missile Silo
(team versions for the military ones), plus the Repair Station, the fortified Command Base, the Nuclear Reactor and
Nuclear Silo. All six robots (Worker, Warbot, Hauler, Agribot, Paver, Freight Truck) have four driving frames per team
plus brake-light and boost overlays (WebP, `driveSet()` in the manifest); the frames advance with the distance driven.
The nuclear missile, its 24-frame detonation sheet and the scorch mark are custom too. Still to make: a 3D Pulse
Turret, goods icons, a few terrain pieces and the biome art (plants for each biome, and Jungle and Polar ground,
water and rock; until then the game draws stand-in plants and recolours the desert textures). The app icon is in `icons/`. Anything without an image falls back to placeholder art drawn in code, so new art can be
added one piece at a time. See **[ART_GUIDE.md](ART_GUIDE.md)** for specs, the style brief and prompts,
including the remaining pieces (Ramp, slope and cliff textures, goods icons).

## Enabling GitHub Pages

1. In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. The workflow in `.github/workflows/pages.yml` publishes the game on every push to `main` or to the development
   branch `claude/elegant-cori-a8yj96`. To publish right away without a push, open **Actions → Deploy to GitHub Pages →
   Run workflow**.
3. Installed copies (Add to Home Screen) check for a newer version each time they open with internet, so they update
   by themselves.

(GitHub Pages on a private repository needs a paid GitHub plan; on a public repository it is free.)

## Project layout

```
index.html, style.css     page, HUD and menus
js/util.js                RNG, noise, heap, helpers
js/defs.js                all game data and balance numbers (costs, timings, ranges)
js/world.js               map generation, game state, territory, placement rules, save/load
js/path.js                A* pathfinding
js/sim.js                 simulation: logistics, workers, production, combat
js/ai.js                  rival AI
js/missions.js            mission campaign: goals, hand-placed map features, unlock codes
js/charts.js              line and bar charts for the statistics screen
js/render.js              canvas renderer and placeholder art
js/input.js               touch and mouse controls
js/ui.js                  HUD, build menu, info panels, objectives
js/audio.js               synthesized sound effects
js/main.js                boot and main loop
art/art-manifest.js       register custom art here
tools/headless-sim.js     AI-vs-AI balance test without a browser
tools/smoke-test.js       browser test on a phone-sized screen (Playwright)
tools/build-single.js     bundles everything into dist/terrafall.html
```

Plain JavaScript, no build step and no dependencies. Balance tweaks mostly live in `js/defs.js`.

### Testing

```bash
node tools/headless-sim.js 12345 normal 40
```

Optional extra arguments: mode (`versus`/`colony`), map size (0–3), terrain (0–4) and resources (0–4):

```bash
node tools/headless-sim.js 11 normal 45 versus 1 3 2
```

```bash
node tools/headless-sim.js 99 normal 40 colony
```

```bash
node tools/smoke-test.js http://localhost:8000/ .
```

The first two play complete AI-vs-AI games (or an AI colony) in a few seconds and print the economy
each minute. The smoke test needs Playwright and a running local server.

## Ideas for next steps

See [IDEAS.md](IDEAS.md) for ideas waiting their turn.

- Multiplayer and save export/import
- Custom art for goods icons, menus and effects
