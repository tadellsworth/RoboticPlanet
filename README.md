# Botfall

A mobile-first colony and logistics strategy game that runs in the browser. Your robots land on
a dusty alien planet: gather resources, link them into supply chains, build more robots and spread
across the map.

- **Versus:** race a rival AI colony across the planet. Capture its Lander to win (about 15–30 minutes).
- **Colony:** no rival. Settle the planet at your own pace, with colonization milestones.

Before each game, sliders set the **map size** (Small to Huge), the **terrain** (Flat, Gentle,
Rolling, Rugged, Mountainous) and the **resources** (Scarce to Abundant). Resources come in separate
fields: your landing zone has a little of everything, and the rich fields beyond it are worth fighting for.

Botfall is an original game in the colony-logistics genre. It contains no code, art, sound or data from
any other game.

## Play it

- **Hosted:** once GitHub Pages is enabled (see below) the game lives at
  `https://<your-user>.github.io/<repo>/`. On a phone, open it and use **Add to Home Screen**: it runs
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
| Pulse Turret | Shoots enemy bots; uses Crystal as ammo |
| Depot | Extra storage, shortens hauling trips |
| Ramp | Cuts a slope into a one-level cliff so bots can climb it |
| Charging Station | Recharges bots' batteries, four at a time; burns **Fuel** |
| Bio Farm | A worker plants energy crops on fertile soil and harvests them into **Fuel** |
| Oil Pump | Built on an oil seep; a worker pumps **Crude** until it runs dry |
| Refinery | Crude → 2 **Fuel** |
| Munitions Works | Alloy + Crystal → **Warhead** (Versus) |
| Missile Silo | Fires missiles at rival buildings up to 18 tiles away (Versus) |

- Every production building needs one worker inside. Free workers haul goods and build construction sites.
  Run short and the game pulls workers off low-priority jobs, so build a Bot Foundry early.
- Placing a construction site is free; workers bring the materials from storage.
- **Paths** cost a quarter Stone per tile (1 Stone paves 4; refunded if you remove them) and make bots move twice as fast. Bots
  plan routes that use them even when that means a short detour. Bots are slow off paths.
- **Traffic:** on a two-way path, bots slow down whenever they meet traffic coming the other way. Switch the Paths banner to
  **One-way** and drag along a path to point it the way you drag (tap a path to turn its arrow). One-way loops keep busy
  routes flowing; going the wrong way up a one-way path is allowed but crawls.
- **Terrain levels:** the planet has terraces at different heights (lighter ground is higher). Bots
  can't climb cliffs; they use slopes at narrow passes, so some routes are long. Pave busy routes with
  Paths (slopes too) and build a **Ramp** to open your own way up. Buildings can't be placed where they
  would block the only way through a pass.
- **Priorities:** tap a building or construction site and set it to Low, Normal or High. High-priority
  buildings get workers and goods first; low ones are served last and lose their worker first when
  workers run short. **Pause** frees a building's worker entirely.
- **Storage:** tap your Lander or a Depot. *Fill first* makes workers bring finished goods there before
  any other storage; *Empty out* takes nothing new and moves what it holds elsewhere (handy before
  demolishing it). You can also switch individual goods off for that building.
- **Minimap:** tap or drag it to jump around; red pulses mark buildings under attack. The × hides it.
- **Batteries:** bots drain their battery walking, working and fighting, and recharge at the Lander, a
  Charging Station or (warbots) inside their garrison. A flat battery means half speed and half power. The Lander charges
  for free; Charging Stations burn Fuel (one Fuel is about one and a half full charges).
- **Army orders:** tap **Army**, then a rival building to attack it with warbots or a missile, or open
  ground to send warbots there to hold the area under a rally flag. Tap the flag to call them back.
- **Missiles** wreck smaller buildings and knock Outposts and Landers down to almost no armor; warbots
  still have to walk in and capture them.
- **Ordering bots:** the Bot Foundry only builds the bots you order. Tap it and use +1 or +5 for Workers or
  Warbots (Clear cancels the queue); with nothing queued it sits idle and uses no Alloy or Chips.
- The **Build** menu shows how many of each building you already have, and how many are being built.
- You can only build inside your border. Outposts push it out. Capturing an enemy Outpost takes its land,
  and enemy buildings left outside their border are lost.
- **Controls:** drag to pan, pinch or scroll to zoom, tap anything to inspect it.

## Custom art

Buildings, bots, resources and ground use custom art made in Claude Design (`art/`, with SVG sources in
`art/source/`). Anything without an image falls back to placeholder art drawn in code, so new art can be
added one piece at a time. See **[ART_GUIDE.md](ART_GUIDE.md)** for specs, the style brief and prompts,
including the remaining pieces (Ramp, slope and cliff textures, goods icons).

## Enabling GitHub Pages

1. Merge this branch into `main`.
2. In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The workflow in `.github/workflows/pages.yml` publishes the game on every push to `main`.

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

- More building tiers and goods
- Campaign of hand-made missions
- Custom art for goods icons, menus and effects
