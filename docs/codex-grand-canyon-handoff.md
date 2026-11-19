# Codex handoff — Grand Canyon

November 19, 2026. The owner asked that this chat use only `codex/working-branch`. This handoff covers the changes made in this chat. Other commits on the branch may belong to separate work.

## Shipped in this chat

- [`07c51ba` — Add the Grand Canyon map preset](https://github.com/tadellsworth/RoboticPlanet/commit/07c51bab65d6143da28aa855b02f9c12c1ac560c)
- [`719d9f1` — Keep Grand Canyon trade posts and uplinks reachable](https://github.com/tadellsworth/RoboticPlanet/commit/719d9f1aa5e4d3cda39804b72d466e637dd866a3)

Grand Canyon is under **Heights → Grand Canyon** in the map picker. It supports two colonies in Versus and the usual solo Colony setup. Starts face each other from high rims. Two terraces step down to a winding river with broad flats and richer Ore and Crystal. Each rim has a two-lane switchback and a second descent through a side canyon. Robots can wade at shallow fords, Ports can serve the river, and the narrows have clear rim-to-rim Viaduct approaches. The Nuclear race places its Uranium in the canyon.

## Code to inspect

- `js/defs.js` appends Grand Canyon to `SHAPE_PRESETS`, with the `grandCanyon` flag, Heights grouping, a map tip, and naval support. Appending preserves the existing numeric map IDs used in saves and settings.
- `js/world.js` adds `grandCanyonShape` inside `generateMap` and calls it from `shapeExtras`. It uses the seed and half-turn symmetry to lay out the river, terraces, ramps, fords, and deposits. The canyon supplies its own levels and ramps. The ordinary map setup still handles starts and the initial economy.
- `js/ui.js` adds a canyon and river schematic to the existing map thumbnail renderer.
- `js/world.js` and `js/sim.js` integrate the objectives with the shared placement routines. On Grand Canyon, Trade Posts are placed before Murmur nests claim the river flats. Posts still use the distance-based fairness score, with room to select a farther pad when the terrain limits the choices. Both Trade Posts and Uplinks are restricted to terrain the starting colonies can reach. Uplinks use the usual central site plus a mirrored pair where possible, or two mirrored pairs. The follow-up also narrowed the river at the Viaduct approaches to give the dry riverbank more room.

## Verification

- The generator passed 300 headless cases across all four map sizes after the objective fix. The checks covered half-turn symmetry, rim-to-rim land access, reaching the floor with either descent blocked, reachable Ore and Crystal, a connected river with dock access, and valid rim-to-rim Viaduct spans.
- In 300 headless Versus games with Uplinks victory selected, all games had three Trade Posts and three or four Uplinks. Both starting colonies could reach every objective on foot at setup. The runs varied map size, Murmur setting, terrain, resources, biome, and Nuclear race.
- In 48 headless Colony games, all games had two Trade Posts reachable from the Command Base.
- Two six-minute AI-vs-AI smoke runs completed on the initial map implementation. A browser playthrough and longer balance checks are still pending.

## Discussed and on hold

- **Total war scars the land.** The owner asked to wait after reviewing the proposal. The suggested first slice was persistent Howitzer craters and Napalm scars on Greenreach, with compact saved tile state and cached terrain drawing. Burned farmland and Fiber groves would carry the gameplay cost; ordinary craters would remain traversable and buildable. Wildlife reactions were suggested as a later pass. See [`IDEAS.md`](../IDEAS.md#L43) for the original design.
- **Working branch play link.** The existing [GitHub Pages workflow](../.github/workflows/pages.yml) publishes `main` to the live site. A separate Cloudflare Pages branch preview was discussed and has yet to be configured. To run the working branch locally, serve a checkout or extracted branch ZIP with `python3 -m http.server 8000` from the repository root, then open `http://localhost:8000`.
