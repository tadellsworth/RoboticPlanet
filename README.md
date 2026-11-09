# Botfall

A colony and logistics strategy game that runs in the browser, on phones and on desktop widescreens. Your robots land
on a dusty alien planet: gather resources, link them into supply chains with a network of roads, build more robots and
spread across the map. Roads are the heart of the game: Haulers only drive on them, so where your roads go decides
how goods move.

- **Versus:** race a rival AI colony across the planet. Capture its Lander to win (about 20–40 minutes).
- **Colony:** no rival. Settle the planet at your own pace, with colonization milestones.
- **Missions:** eight set challenges on hand-picked planets, each with its own goals and Easy, Normal and Hard
  levels. Finishing one unlocks the next and shows an unlock code for it, so progress can move to another device.

Before each game, sliders set the **map size** (Small to Huge), the **terrain** (Flat, Gentle,
Rolling, Rugged, Mountainous) and the **resources** (Scarce to Abundant). Resources come in separate
fields: your landing zone has a little of everything, and the rich fields beyond it are worth fighting for.

Botfall is an original game in the colony-logistics genre. It contains no code, art, sound or data from
any other game.

## Play it

- **Hosted:** once GitHub Pages is enabled (see below) the game lives at https://tadellsworth.github.io/RoboticPlanet/ (in general
  `https://<your-user>.github.io/<repo>/`). On a phone, open it and use **Add to Home Screen**: it runs
  full-screen like an app and works offline.
- **Locally:** from this folder run a static server and open the address it prints:

  ```bash
  python3 -m http.server 8000
  ```

- **Single file:** `node tools/build-single.js` writes `dist/botfall.html`, the whole game in one file you
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
| Depot | Extra storage, shortens hauling trips |
| Ramp | Cuts a slope into a one-level cliff so bots can climb it |
| Charging Station | Recharges bots' batteries, four at a time; burns **Fuel** |
| Bio Farm | A worker plants energy crops on fertile soil and harvests them into **Fuel** |
| Oil Pump | Built on an oil seep; a worker pumps **Crude** until it runs dry (stops at 30 Crude by default) |
| Refinery | Crude → **Fuel**, one for one (stops at 30 unless you change its stock limit) |
| Cement Works | 1 Stone → 2 **Cement**, the main building material (stops at 40 unless you change its stock limit) |
| Asphalt Plant | Crude + Stone → 2 **Asphalt** |
| Roadworks | Its Paver lays Asphalt on your paths nearby (1 Asphalt covers 4 tiles) |
| Ammo Plant | Alloy + Stone → 3 **Ammo**; warbots reload it in the Lander and Outposts (Versus) |
| Missile Factory | 2 Alloy + Chip + Fuel → **Missile** (20 s each; Versus) |
| Missile Silo | Fires Missiles at rival buildings up to 18 tiles away; holds 2, reloads in 25 s (Versus) |

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
- **Every building needs a road to storage.** Your Lander lands on a ring of road; join each building and construction
  site to that network (or to a Depot on it), or Haulers can't bring it materials or collect its goods. A red road badge
  marks buildings with no road: tap one and press **Lay road** to plan the shortest route (shown dashed), or plan your
  own. Placement keeps a side of every building open for a road.
- **Roads** cost Cement (1 Cement paves 5 tiles), paid when you plan them. Planned tiles show dashed
  until free workers pave them: 1.5 s a tile (3 s through resources), working out from the existing network, so long
  highways take planning and spare workers. Calling off a planned tile refunds it. Roads double a bot's speed. Dragging
  plans roads round resources; tap a boulder, grove, ore or crystal tile to clear it for a road at 3× the Cement. A Roadworks' Paver
  upgrades roads to asphalt (2.75×) with Asphalt. Removing a road refunds its Cement.
- **Junctions and traffic lights:** where three or four roads meet, bots slow down and give way to traffic already
  crossing. Switch the Paths banner to **Lights** and tap a junction to put up a traffic light (1 Alloy): it lets one
  direction through at a time, switching when traffic waits the other way. On a busy crossing a light moves about half
  as many goods again; on a quiet one it costs nothing.
- **Traffic:** bots queue on roads, each waiting behind the bot ahead of it going the same way. On two-way roads each
  direction keeps to its own side, but passing oncoming traffic slows bots down. Switch the Paths banner to **Arrows** and
  drag along a road to point it the way you drag (tap a road to turn its arrow). One-way loops keep busy routes flowing;
  going the wrong way up a one-way road is allowed but crawls.
- **Top bar:** hover over (or tap) a goods counter to see its name and what it's for.
- **Ammo:** warbots carry 20 shots and reload in your Lander and Outposts, which haulers stock from an Ammo Plant. Out of
  ammo, a warbot hits at about a third of its strength.
- **Statistics:** the pause menu and the end-of-game screen show graphs of bots, land and goods over time and how busy
  each kind of building was; each building's panel shows its recent busy time.
- **Terrain levels:** the planet has terraces at different heights (lighter ground is higher). Bots
  can't climb cliffs; they use slopes at narrow passes, so some routes are long. Pave busy routes with
  Paths (slopes too) and build a **Ramp** to open your own way up. Buildings can't be placed where they
  would block the only way through a pass.
- **Priorities:** tap a building or construction site and set it to Low, Normal or High. High-priority
  buildings get workers and goods first; low ones are served last and lose their worker first when
  workers run short. **Pause** frees a building's worker entirely.
- **Storage:** tap your Lander or a Depot. *Fill first* makes haulers bring finished goods there before
  any other storage; *Empty out* takes nothing new and moves what it holds elsewhere (handy before
  demolishing it). You can also switch individual goods off for that building.
- **Minimap:** tap or drag it to jump around; red pulses mark buildings under attack. The × hides it.
- **Batteries:** bots drain their battery walking, working and fighting, and recharge at the Lander, a
  Charging Station or (warbots) inside their garrison. A flat battery means half speed and half power. The Lander charges
  for free; Charging Stations burn Fuel (one Fuel is about three quarters of a full charge). A Bio Farm makes about
  2–3 Fuel a minute; an Oil Pump and Refinery up to 10 a minute until the seep runs dry (both stop at 30 by default).
- **Army orders:** tap **Army**, then a rival building to attack it with warbots or a missile, or open
  ground to send warbots there to hold the area under a rally flag. Tap the flag to call them back.
- **Garrisons:** tap an Outpost or your Lander to set its **garrison priority** (new warbots, and ones called back
  from a flag, fill High garrisons first and Low ones last) or to **station warbots** there: choose how many and they
  march over from your other garrisons (each keeps one at home) and stay until you move them.
- **Missiles** are built at a Missile Factory (2 Alloy, 1 Chip and 1 Fuel each, 20 seconds) and carried to Missile Silos
  by haulers. A hit does 24 damage, which wrecks most buildings outright, plus 5 to other rival buildings and 9 to bots
  within 2.2 tiles. Outposts and Landers drop to almost no armor; warbots still have to walk in and capture them.
- **Ordering bots:** the Bot Foundry only builds the bots you order. Tap it and use +1 or +5 for Workers or
  Warbots (Clear cancels the queue); with nothing queued it sits idle and uses no Alloy or Chips.
- The **Build** menu shows how many of each building you already have, and how many are being built.
- You can only build inside your border. Outposts push it out (7 tiles around them).
- **Salvage:** a colony out of Stone or Fiber with no Quarry or Harvester that can still work salvages 1 every 20 s from
  its Lander (up to 6), so it can always rebuild. Capturing an enemy Outpost takes its land,
  and enemy buildings left outside their border are lost.
- **Controls:** drag to pan, pinch or scroll to zoom, tap anything to inspect it.
- **Desktop:** on a wide screen the top bar is one row, the tools sit in a small dock and panels open on the right.
  Right-drag pans in every mode; a building being placed follows the mouse. Keys: **B** build, **P** paths
  (**R** roads, **O** one-way arrows, **L** lights), **A** army, **H** base, arrows/WASD pan, **+/−** zoom,
  **1–3** speed, **M** minimap, **Space** pause, **Esc** back.

## Custom art

Buildings, bots, resources and ground use custom art made in Claude Design (`art/`, with SVG sources in
`art/source/`). The production buildings, Depot, Outposts and construction sites use the pre-rendered 3D set
(512×512, each on its own pad, placed by an `anchor` point in `art/art-manifest.js`), as do the Charging Station, Bio
Farm, Oil Pump, Refinery, Cement Works, Asphalt Plant, Roadworks and Ramp. Still to make: Hauler, Agribot and Paver
robots (they borrow the Worker's art with a badge), the Ammo Plant, Missile Factory and Silo, goods icons and a few
terrain pieces. The app icon is in `icons/`. Anything without an image falls back to placeholder art drawn in code, so new art can be
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
tools/build-single.js     bundles everything into dist/botfall.html
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

- Multiplayer and save export/import
- Custom art for goods icons, menus and effects
