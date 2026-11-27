# Map audit, Nov 27 2026

Every map type in `SHAPE_PRESETS` (31 of them) was generated headless for each player count it takes (2, 3, 4; 4 also
as 2 vs 2 Teams), seeds 11, 21 and 37, on Small and Large (568 maps), with Uplinks victory and the Murmur Active so the
sites and nests are placed too. The three newest maps (The Ring, Half underground, Orbital platforms) and Passenger
Town were also run on Medium, Huge, Immense and Planetary with seeds 5, 21 and 99, and Passenger Town on Small to Huge
with seeds 1 to 8 for every player count. Each map type then played one 15-minute computer-only game (Medium, seed 21,
two colonies, plus four where the map takes four; three where it needs three), and was loaded in Chromium for a
screenshot of the start view, the zoomed-out view and the minimap.

Two generation bugs were found and fixed (both change those maps' seeds; see Findings). Everything else is listed as
a finding to judge or a recommendation; nothing was redesigned, and the backdrops of The Ring and Orbital platforms
and the cave mouths of Half underground were left alone.

## Tools

- `node tools/map-audit.js [--only NAME|=NAME] [--seeds 11,21,37] [--sizes 0,2] [--ai MIN] [--progress] [--json out]`:
  the headless sweep. Per map: generation time; the start's ground (water, lava, void, tidal flats, the fault, a cliff
  beside the Command Base, Depot spots within 6 tiles); how each pair of colonies is joined (`walk`; `tide`, over the
  flats at low tide; `bridge`, a road over water or through rock; `span`, a Viaduct or Ropeway over a chasm or space)
  and the walked path length; deposits in walking reach (nearest of each, totals within 12 and 24 tiles); fairness
  (the smallest colony's total within 24 tiles over the largest's, per good, inside and outside colonies of Half
  underground apart); Trade Posts and Uplinks and how each colony reaches them; Orbital platforms' decks, bridges and
  control boxes; Half underground's entrances and nests; and whether `S.zone` at the start matches a fresh one. With
  `--ai` it plays a computer-only game per map and reports crashes, colonies that built nothing for 4 minutes on end
  while they stood, and robots that stood on one tile with a task for 5 minutes. It exits non-zero on a problem.
- `node tools/map-shots.js [outDir] [name]`: the screenshots (Medium, seed 21, 1280 × 800 at scale 1), page errors,
  magenta (missing art) pixels and how much of the view is one flat colour.
- `tools/map-symmetry-test.js`, `army-pathing-test.cjs` and `civilian-pathing-audit.cjs` were run as they are.

## Per map

Generation: average / slowest ms over the Small and Large cases (Node, one core). Symmetry: `tools/map-symmetry-test.js`
(795 exact and 150 rounded layouts) passed for every map before and after the fixes. Reach: how the colonies are
joined in every case (all colonies reached every other in every case; no start beside water, lava, void, flats or a
cliff after the Dam fix). Fairness: the worst share of a colony's Ore, Crystal, Stone and Fiber within 24 tiles,
against the richest colony of its kind (1 = identical). Three-colony maps are turned 120° and rounded, so they can't be
exact. AI: the 15-minute game (built: buildings each colony finished; † a colony that fell). Visual: the start view,
overview and minimap drew with no page errors and no magenta tiles, at 2 and 4 colonies where the map takes four.

| Map | Cases | Generation ms | Reach | Fairness | AI run | Visual |
| --- | ---: | --- | --- | --- | --- | --- |
| Standard | 24 | 60 / 118 | walk | 0.87 | 2p 15 min, 34/35; 4p 15 min, 32/29/35/32 | ok |
| Long haul | 6 | 20 / 29 | walk | 1 | 2p, colony 1 won at 13.4 min, 26/29† | ok |
| Chokepoint | 6 | 13 / 22 | walk | 1 | 2p 15 min, 30/32 | ok |
| Islands | 12 | 41 / 60 | bridge or ferry (by design) | 0.56 (3p, Small) | 2p, colony 1 won at 11.7 min, 30/28† | ok |
| Crater | 12 | 29 / 68 | walk | 0.71 (3p) | 2p 15 min, 45/37 | ok |
| Plateaus | 12 | 20 / 45 | walk | 0.88 | 2p 15 min, 32/33 | ok |
| Sky islands | 12 | 42 / 73 | Viaduct (by design) | 0.75 (3p) | 2p 15 min, 49/41 | ok |
| Rift | 6 | 18 / 40 | walk (arches) | 1 | 2p, colony 1 won at 14.4 min, 32/29† | ok |
| Ring valley | 6 | 18 / 31 | walk | 1 | 2p 15 min, 44/35 | ok |
| Oases | 6 | 14 / 23 | walk | 1 | 2p 15 min, 43/35 | ok |
| Crossroads | 24 | 46 / 116 | walk | 0.87 | 2p 15 min, 36/31; 4p 15 min, 29†/30/40/40 | ok |
| Lakes | 6 | 28 / 52 | walk | 1 | 2p 15 min, 34/27 | ok |
| Tidal flats | 6 | 91 / 232 | walk (low tide) | 1 | 2p, colony 1 won at 14 min, 38/34† | ok |
| River delta | 6 | 38 / 60 | walk (fords) | 1 | 2p 15 min, 35/35 | ok |
| Volcano | 6 | 38 / 70 | walk | 1 | 2p 15 min, 28/32 | ok |
| Fault line | 6 | 71 / 204 | walk (before the quake) | 1 | 2p 15 min, 34/35 | ok |
| Canyon maze | 6 | 22 / 42 | walk | 1 | 2p 15 min, 39/37 | ok |
| The Wheel | 6 | 35 / 72 | walk | 0.88 | 3p 15 min, 38/34/27† | ok |
| Three Mesas | 6 | 25 / 46 | walk (basin) | 0.78 | 3p, colony 3 won at 14.8 min, 23†/35†/32 | ok |
| Pinwheel | 18 | 32 / 57 | walk | 0.81 | 3p 15 min, 36/36/32†; 4p 15 min, 32†/28/33/26† | ok |
| Four Isles | 18 | 27 / 43 | bridge or ferry; allies' sandbar in 2 vs 2 | 0.56 (2 vs 2, per team equal) | 3p 15 min, 46/48/41; 4p 15 min, 29/48/30†/48 | ok |
| Twin Valleys | 12 | 34 / 66 | walk | 0.89 | 4p 15 min, 33†/32/41/39 | ok |
| Long Haul 2v2 | 12 | 44 / 125 | walk | 1 | 4p 15 min, 29/37/39/27† | ok |
| The Hollow | 6 | 9 / 22 | walk | 1 | 2p 15 min, 52/41 | ok |
| Grand Canyon | 6 | 43 / 75 | walk (descents, fords) | 1 | 2p 15 min, 33/31 | ok |
| Passenger Town | 24 | 22 / 47 | walk (through the streets) | 0.67 (3p Small stone; was 0 Crystal on Medium 3p before the fix) | 2p 15 min, 36/38; 4p, colony 4 won at 13.8 min, 22†/31†/32†/31 | ok |
| The Walking Factory | 24 | 19 / 39 | walk | 0.91 | 2p 15 min, 32/38; 4p 15 min, 43/41/38/28† | ok |
| The Dam | 24 | 29 / 58 | walk | 0.77 (3p) | 2p 15 min, 35/32; 4p 15 min, 31†/34/36/30 | ok |
| The Ring | 6 (+12) | 15 / 21 | Viaduct or Ropeway between rocks (by design) | 1 | 2p 15 min, 43/41 | ok (backdrop not reviewed) |
| Half underground | 18 (+30) | 9 / 18 | walk (through the mouths) | 1 (inside and outside apart) | 2p, colony 1 won at 14.4 min, 26/31†; 4p 15 min, 31/21†/35/27† | ok (cave mouths not reviewed) |
| Orbital platforms | 6 (+12) | 21 / 33 | walk (over the lowered bridges) | 1 | 2p 15 min, 37/36 | ok (backdrop not reviewed) |

No map threw, no generation took more than a quarter of a second (Immense and Planetary on the newest maps: at most
0.8 s on a loaded machine), no computer colony stopped building for 4 minutes while it stood, and no robot stood still
on a task for 5 minutes. The picker has a card, a drawn thumbnail and a blurb for all 31 map types, and How to play,
the guide and README name every one.

## Findings

| # | Map | Finding | Verdict | Fix |
| --- | --- | --- | --- | --- |
| 1 | The Dam, four colonies | Each Command Base stands on the middle of an edge (`edge4`, x = W/2 − 1), right on the line between two quarters. The map is generated in the bottom-left quarter and turned onto the others (`turn4`), so the half of the landing zone and starter fields over the line was never laid: it came from the turned copy of the ground beside the next colony's base. Seed 37 Large put a stream through the tiles beside the Command Base on every side, and the starter Crystal and the larger Stone field (east of the base) were missing: on Large, seed 11 had no Stone within 12 tiles (nearest 13.6), Small had its nearest Crystal 9 to 12 tiles out. All four colonies alike, so fair, but not the start the map promises. | Bug, fixed | `generateMap` (js/world.js): for the Dam with four, a field's or the landing terrace's tiles over the quarter's edge are written at the tile the turn copies them from (`src4`), and random fields and uranium keep clear of that half of the landing zone too (`nearHome`). Now every four-colony Dam start has the standard fields (nearest Ore, Crystal, Stone 7.8, 5.8, 3.6 on Large seed 11, as on Standard). **Changes The Dam's four-colony maps for every seed**; two colonies are unchanged (hashes compared) and three untouched (the change only runs for four). |
| 2 | Passenger Town, three colonies (and Small for two) | `townSetup` clears the town's ground and a ring 1.5 tiles round it, deposits and all. For three colonies the round town reaches within about 5.5 tiles of each base on Medium (its radius is capped at the distance to the base less `TOWN.clear` + 1, and the clearing ring and the lobes come on top), which wipes starter Ore or Crystal north of the base; the 120° rounding makes it wipe one colony's and not another's. Medium three-colony games (the default size) were unfair on 4 of 8 seeds: seed 5 left colony 1 with no Crystal within 32 tiles while the others had it at 7. Small two-colony seed 21 lost the starter Ore (nearest 11.2). | Bug, fixed | The ring round the town is still levelled and opened (crags and water become ground) but keeps its deposits; only the town itself is bare. On Small to Huge, seeds 1 to 8, every colony now has Ore and Crystal within 9 tiles and no colony has under 0.6 of another's. **Changes Passenger Town maps for every player count** (those with deposits in the ring). `tools/city-test.js` passes. |
| 3 | Islands, Long haul, Rift, Tidal flats, Three Mesas, Half underground, Passenger Town (4p) | Several 15-minute computer games end in a win (11.7 to 14.8 minutes). | Not a map problem | First found as an apparent hang: the audit's loop waited for the clock while a won game had stopped (`simStep` does nothing once `S.winner` is set). The tool now stops at the win. |
| 4 | Small maps of most types | No oil seep in walking reach of either colony on Small: Chokepoint, Rift, Ring valley, Lakes, Volcano, Canyon maze, Grand Canyon, Passenger Town, the Walking Factory (and some Small Dam and Four Isles cases). The "beyond" oil field 13 tiles out and the middle one fall under the map's own features (the massif, the town, the factory's yard, the maze walls). Sky islands never has oil on the home mesa (it is on other mesas). | Judgment | None. Fuel still comes from crops (Bio Farm on fertile soil) and the landing stock. See Recommendations. |
| 5 | All generic maps | The starter Ore and Crystal fields are random fills of a small circle, so some seeds get one tile: seed 21 Large gives one Ore and one Crystal tile within 12 tiles on Standard and most maps built on it; Fault line seed 21 Large has no starter Ore at all (nearest 12.7). Always the same for every colony. | Judgment | None (balance). |
| 6 | The Dam, two and three colonies, Small | The ramp feet beside the dam clear the starter Crystal field (nearest Crystal 11 to 12 tiles, the rich field on the shelf). | Judgment | None: a layout choice of the map's (the ramps' way in is kept open). |
| 7 | Trade Posts and Uplinks | Some sites can't be walked to from any colony on maps that are otherwise walkable: Passenger Town Small four colonies seed 37 put four posts in corner pockets cut off by lakes; Oases Large seed 37 put two posts and two Uplinks on a 128-tile pocket behind crags; two Three Mesas cases likewise. They are reachable by bridge or tunnel and fair between colonies. `placePosts` prefers walkable ground (+6) but allows the rest. | Judgment | None. |
| 8 | Trade Posts on Small (known, Nov 19 audit) | Many Small maps still get no Trade Post (Standard, Crater, Plateaus, Rift, Ring valley, Tidal flats, Fault line, Canyon maze, The Wheel, Three Mesas, Twin Valleys, Passenger Town, the Walking Factory, Pinwheel), and Four Isles for three can get 0 or 1 Uplink. | Known | None (open from `docs/map-fairness-audit.md`). |
| 9 | Three-colony maps | Rounded 120° turns leave per-colony totals within 24 tiles up to 0.56 apart (Islands Small seed 21 Ore 165/132/93; Crater Large Ore 0.71). | Judgment | None. |
| 10 | Four Isles, 2 vs 2 | Allies' islands are joined by a sandbar, so only the half turn holds: colonies 1 and 3 match, 2 and 4 match, each team has one of each. | By design | None. |
| 11 | Orbital platforms | `computeZones` runs before the lowered bridges get their roads (`orbRoads` in `newGame`), which looked like it would leave the decks apart at the start. | Not a bug | A later step recomputes the areas before play; the audit found `S.zone` at the start equal to a fresh one on every Orbital case. |
| 12 | The Ring, Orbital platforms (visual) | On the zoomed-out view a pale diagonal band falls across the left of the home rock or deck. | For the backdrop and dusk-shadow work | None here (those are being redone by other agents). |
| 13 | Standard, Long haul | No start tip (`tip`): every other map type posts one when a game starts. Standard has its four-colony `quadTip` only. | Judgment | None. |

## Recommendations

1. **Guarantee a Fuel source near home on Small.** Lay the "beyond" oil field (or a seep inside the landing zone, as
   The Ring and Orbital platforms do) where the map's feature can't cover it, or move it out of the massif, town,
   factory yard and maze walls when they do. Small Chokepoint, Rift, Ring valley, Lakes, Volcano, Canyon maze, Grand
   Canyon, Passenger Town and the Walking Factory have no seep either colony can walk to.
2. **Give the starter Ore and Crystal fields a floor** (at least two or three tiles each), so a seed can't hand both
   colonies a single tile of each, or none (Fault line seed 21 Large).
3. **Keep Trade Posts and Uplinks on walkable ground** on maps meant to be walked (everything but Islands, Four Isles,
   Sky islands and The Ring): make `home` a requirement there, falling back only when nothing walkable fits, and do the
   same in `placeUplinks`.
4. **The Small-map Trade Post gap** from the Nov 19 audit is still open: a fallback pass, or a line before launch.
5. **The Dam on Small**: consider moving the starter Crystal out of the ramp feet (or the ramps' clearing round it).
6. **A start tip for Standard and Long haul**, if wanted: Long haul's blurb has the substance ("built for long supply
   lines", the richer fields).
7. **Run `tools/map-audit.js` after map changes.** It takes about 20 s for the generation sweep and catches the two
   kinds of bug found here (fields lost to a later pass, starts on the wrong side of a symmetry line). `--ai 15` adds
   about a minute per map.

## Checks

- `tools/map-symmetry-test.js`, `tools/army-pathing-test.cjs`, `tools/civilian-pathing-audit.cjs`, `tools/city-test.js`,
  `tools/lint.js`, `tools/help-coverage-test.js`, `tools/mission-data-test.js` and `tools/build-single.js` pass.
- `hashState` at generation and after two minutes of a computer-only game (Medium, seed 21; two colonies, and four
  where the map takes four; three where it needs three) matches the previous commit on every map type except
  Passenger Town (two and four colonies) and The Dam with four colonies, the two fixes above.
