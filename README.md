# Botfall

A mobile-first colony and logistics strategy game that runs in the browser. Your robots land on
a dusty alien planet: gather resources, link them into supply chains, build more robots and spread
across the map.

- **Versus:** race a rival AI colony on a small planet. Capture its Lander to win (about 15–30 minutes).
- **Colony:** no rival. A bigger planet to settle at your own pace, with colonization milestones.

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

- Every production building needs one worker inside. Free workers haul goods and build construction sites.
  Run short and the game pulls workers off low-priority jobs, so build a Bot Foundry early.
- Placing a construction site is free; workers bring the materials from storage.
- **Paths** make bots move almost twice as fast.
- You can only build inside your border. Outposts push it out. Capturing an enemy Outpost takes its land,
  and enemy buildings left outside their border are lost.
- **Controls:** drag to pan, pinch or scroll to zoom, tap anything to inspect it.

## Custom art

All art is placeholder drawn in code, and every building, bot, resource and ground tile can be swapped for
your own image without touching the code. See **[ART_GUIDE.md](ART_GUIDE.md)** for the full asset list,
specs, style direction and ready-made prompts for Claude Design.

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

```bash
node tools/headless-sim.js 99 normal 40 colony
```

```bash
node tools/smoke-test.js http://localhost:8000/ .
```

The first two play complete AI-vs-AI games (or an AI colony) in a few seconds and print the economy
each minute. The smoke test needs Playwright and a running local server.

## Ideas for next steps

- Minimap for quick navigation
- Player-set storage and building priorities
- More building tiers and goods
- Map size and resource richness options
- Campaign of hand-made missions
- Custom art for goods icons, menus and effects
