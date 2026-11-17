# Terrafall

A colony and logistics strategy game that runs in the browser, on phones and on desktop widescreens. Your robots land
on a dusty alien planet: gather resources, link them into supply chains with a network of roads, build more robots and
spread across the map. Roads are the heart of the game: Haulers only drive on them, so where your roads go decides
how goods move.

- **Versus:** race a rival AI colony across the planet. Capture its Command Base to win (about 20–40 minutes), or pick a
  faster **Victory** on the new-game screen: **Domination** (hold most of the land for 3 minutes) or **Uplinks** (hold
  neutral relay towers for a total of 5 minutes). A rival that's clearly beaten surrenders.
  The rival is **Easy**, **Medium** (between Easy and Normal), **Normal** or **Hard**, and has a **doctrine**
  (Rival doctrine: the Steward, balanced, by default, or Random, the Warden (turtle), Salvager (raider), Herald (rusher)
  or Architect (tycoon); with three or four players one for each rival if you like; see below).
  **Players: Free-for-all · 3** adds a second rival (red and green): a round planet with the three starts 120° apart
  (player 0's third is generated and turned round onto the others, resources placed tile for tile so each third
  has as many). Capturing a Command Base hands over everything its owner built (`eliminate`); the last colony
  standing wins. Standard, Islands, Crater, Plateaus and Sky islands maps (`ffa: true` in `SHAPE_PRESETS`), and The Wheel and
  Three Mesas, which are made for three (`minPlayers: 3`); the green team's
  art is the red team's recoloured at run time (`recolorArt`), and each AI fights its nearest rival (`rivalOf`).
  With four players (Crossroads, Pinwheel, Four Isles or Twin Valleys), **Teams: 2 vs 2** puts the two western colonies
  against the two eastern ones; on **Long Haul 2v2** (made for it: picking it turns Teams on) the two southern colonies
  against the two northern ones (see Multiplayer).
- **Colony:** no rival. Settle the planet at your own pace, with colonization milestones and an optional ladder of
  **Colony goals** (see Colony goals, Records and achievements below). Free play has the full
  building roster, missiles and nuclear silos included, to experiment with, plus the **Research Lab** and optional
  **the Murmur** (native creatures whose nests raid you; on by default, never on Lunar).
- **Missions:** the tutorial campaign (`MISSIONS` in `js/missions.js`): hand-picked planets, each with its own goals
  and Easy, Normal and Hard levels, that teach the game one idea at a time in seven chapters, in order: **First Steps**
  (a building and its road, Stone and Cement, batteries, the first Alloy), **Growing the Colony**, **Roads and
  Traffic**, **Industry and Trade**, **Sea and Sky** (all Colony games, so the economy is learned in peace), then
  **First Contact** (the Murmur's nests, a passive rival, a border war, a chokepoint against a Herald) and **War** (Ammo and
  repairs, Torches, Bulwarks and missiles against a Warden, the Nuclear race, Keeps and bombers). All of them are open
  from the start; finishing one ticks it off at that difficulty (saved by its `id`, so a reworked mission keeps its
  ticks), and the list marks the first unfinished one **Next up**. A mission is plain data: `chapter`, `brief`, `intro`
  lines for the briefing card, the planet (`seed`, `size`, `rough`, `biome`, `shape`, `players`), the rival (`rival`
  level per difficulty, `style`, `rivalBonus`, `passive`), `limit` (minutes per difficulty), switches for what
  missions otherwise leave out (`war`, `lab`, `events`, `wildlife`, `nuke`), `layout(m, W)` to edit the generated map
  (`placeField`, `placeFertile`, `mapTiles`, `mirrored`), `setup(S, diff)` and up to four `goals`. Built-in goal kinds
  count buildings, goods made, bots made or owned, road tiles, one-way tiles, lights, land, Outposts and the capture;
  any other goal counts itself with `count(P, S)` and its own `text` (bridge tiles, a Ramp up a ledge, research done,
  trades, nests cleared, minutes held, a nuclear launch). Each goal's `hint` names the real buttons and keys and its
  `ui` selector lights up the button it needs (`missionCoach` in `js/ui.js`; with `at`, a ring pulses on the building
  whose panel holds it). Steps already taken stay dark (Build while its menu is open, the card while placing that
  building: then **Build here** lights, as Paths' **Build** does once a sketch is drawn), a lit button below the fold of
  a panel is scrolled into view once, and a `built` goal whose site is already going up (`goalSites`) says to wait for
  it, or to **Lay road** to a site with none (`siteNeedsRoad`), instead of asking for another (its own `wait` text if
  it has one). From the second mission on, setup puts down the colony the earlier missions taught:
  `kit(S, types, workers)` builds each type where the rival AI would (`aiFindSpot`), finished and road-joined (`KIT6`:
  Harvester, Quarry, Cement Works, Fuel Station, Ore Mine, Crystal Tap, Smelter, Chip Fab, Bot Foundry; `KIT7` adds a
  Bio Farm), and `preBuild` puts down one building where the mission wants it; custom goals count tiles with
  `ownTiles(test)`. Goals once met stay met (`M.got`) unless they say `hold`. **Capture lock:** while any goal other
  than capturing the rival Command Base is open, that base holds at 1 armor against you (`captureLocked`, applied in
  `hitBuilding`; its panel says to finish the other goals first), so winning too soon can't lose a mission.
- **Observer mode:** the computer plays every colony (two to four, on any map type, each with the doctrine you pick) while you
  look on at up to 8×, with a scout report on what each is doing and a camera that follows the fighting; nothing is
  saved (see Observer mode below).
- **Scout reports:** in your own games, a message now and then on what a computer rival is up to (massing for a push on
  your east Outpost, a band heading for your north road, a storm forming), once as it starts, with Go to the place.
- **Blueprints:** keep a block of your buildings and the roads between them on the device, and place it again elsewhere
  with a ghost that turns; every site and road is planned at once.

Before each game, the new-game screen picks the mode, players and rival, the **map shape** (Standard, Long haul,
Chokepoint, Islands, Crater, Plateaus, Sky islands, Rift, Ring valley, Oases, Crossroads, Lakes, Tidal flats, River delta,
Volcano, Fault line or Canyon maze, and for three or four players only The Wheel, Three Mesas, Pinwheel, Four Isles, Twin
Valleys and Long Haul 2v2: cards in groups, each with a sketch and a line on it) and the **map size** (Small to
Huge). **More settings** (a collapsible section, its summary listing whatever isn't the default) holds the planet
number, the **biome** (named for its region of Ithaca I, `BIOMES[k].name`, with its kind of ground under it, `kind`: the
Rust (red desert), Greenreach (forest), the White (polar snow), Emberwood, the Long Grass, the Sump, Cinderlands, the
Bloom and Argos, the moon; scenery only, with plants that roads and buildings clear), the
**terrain** (Flat, Gentle, Rolling, Rugged, Mountainous), the **resources** (Scarce to Abundant; Normal is
`RESOURCE_PRESETS` density 0.78, amount 0.8, which was Sparse until everything was lowered a notch: older saves,
saved planets and missions move up one, `resLevelUp`), the **rival doctrine** (one for all, or one for each rival),
and switches for the **Nuclear race** (on by default), **Planetary events** (off by default), **The Murmur** (Colony; on by default; off and greyed on Lunar),
**Day and night** and **Unlimited resources** (a testing switch: `unlimitedTopUp` keeps your Command Base at
`UNLIMITED_STOCK` of every good and fills whatever your buildings are waiting for, once a second). Resources come in separate
fields: your landing zone has a little of everything, and the rich fields beyond it are worth fighting for.

Terrafall is an original game in the colony-logistics genre. It contains no code, art, sound or data from
any other game.

## Play it

- **Hosted:** the game lives at https://terrafall.app (and www.terrafall.app), served by GitHub Pages under a custom
  domain; the old https://tadellsworth.github.io/RoboticPlanet/ forwards there. (A fork without a domain is at
  `https://<your-user>.github.io/<repo>/` once Pages is enabled, see below.) Saves are kept per address, so a save made
  on the old address moves over by Download save file and Load a save file. Link previews (`og:` and `twitter:` tags,
  `icons/og-image.jpg`), `robots.txt` and `sitemap.xml` point at the domain. On a phone, open it and use **Add to Home Screen**: it runs
  full-screen like an app and works offline. The service worker (`sw.js`) asks the server for a newer copy of every file
  each time the game is opened; art already checked since then comes straight from its cache (the day-and-night sets
  are let go and loaded again every few minutes), and cached art waits at most `ART_WAIT` (3 s) for a slow server.
- **Locally:** from this folder run a static server and open the address it prints:

  ```bash
  python3 -m http.server 8000
  ```

- **Single file:** `node tools/build-single.js` writes `dist/terrafall.html`, the whole game in one file you
  can open directly or send to someone.

Progress auto-saves in the browser every 20 seconds and whenever you leave the page.

## How to play

The full illustrated guide is **[how-to-play.html](how-to-play.html)** (open it in a browser; once GitHub
Pages is on it is at `…/how-to-play.html` next to the game; the in-game How to play links to it, except in the
single-file build, which has no page beside it). In the game, **How to play** (main menu and pause menu)
opens on its contents; tapping a topic shows that one section, with a bar above it that stays put (Contents, a picker
for any section, ‹ ›) and Previous / Next at its end (`helpPage` in `js/ui.js`). The short version:

| Building | Does |
|---|---|
| Harvester | A worker cuts teal stalk groves into **Fiber** |
| Quarry | A worker breaks boulders into **Stone**; with none left it cuts Stone from a rock face in reach, or digs it (never runs out) |
| Ore Mine | A worker digs **Ore** from dark veins, two at a time (`dig`) |
| Crystal Tap | A worker taps violet clusters for **Crystal** |
| Grove Planter | A worker plants new stalk groves |
| Smelter | 2 Ore + 2 Fiber → 3 **Alloy** (15 s; it keeps 6 of each on hand, `hopper`) |
| Chip Fab | Crystal + Alloy → **Chip** |
| Bot Foundry | Alloy + Chip → a new **Worker**, **Warbot**, **Bulwark** or **Torch** |
| Outpost | Holds a wide ring of land (buildings inside it can't be cut off; defences can go there) and garrisons Warbots |
| Pulse Turret | Turns to aim and shoots enemy bots, 5 tiles out; uses Crystal as ammo (3 Cement, 3 Alloy) |
| Bunker | A pillbox for 2 warbots who fire out (3½ tiles) with their own Ammo; claims no land; wrecked, not captured |
| Disruptor Tower | A pulse every 2½ s jams enemy robots' guns within 4½ tiles for 2 s (`jam`) and drains 10 battery; kills nothing itself; 1 Fuel per 4 pulses |
| Mortar Pit | Shells where enemies bunch up, 3–10 tiles out: 6 damage, 3 within 1½ tiles, up to 6 robots a shell (`most`); 3 shells per Ammo |
| Keep | 14 Cement, 6 Alloy, 2 Chips: a fortified base with a roof cannon (Crystal, 6 tiles) that houses 25 warbots, 6 of them firing from cover (`slots`, 4 tiles); claims land; roads pass through it like an Outpost (`passTile`); captured, not wrecked. Within 7 tiles (`KEEP.aura`) Walls/Gates take damage ÷1.5 and mend after 8 s quiet, and defences get +1 range and ×0.8 reload (`auraRange`, `auraRate`); 16 tiles apart. AI: one (a Warden up to three) |
| Bulwark (Foundry, 3 rounds of parts) | Shield robot (`BULWARK`, `shieldBlock`, `bulwarkTick`): a frontal shield (±1.0 rad) soaks 50 damage from shots at it or at its owner's robots within 2.1 tiles behind its line (`SHIELDS`, rebuilt each step), regenerates 4/s after 2.5 s without a hit, fails for 6 s when worn out (back at 35%); shells, bombs, Missiles and blasts from above, and fire from the side or behind, get past; a Disruptor pulse drains 14. Turns to face the nearest armed enemy. Twin blasters, 1 a shot every 0.9 s, no Ammo. Leads its group (`escortMove`, `formPlace`, `FORM`): warbots and Torches on the same attack or flag each take a place in its lee (Torches at its back, warbots in rows of 3, 0.6 tiles apart, 1.05 tiles behind and 0.6 more a row, square to its heading) and keep pace with it (no faster than it goes, a little faster the further off their place), until it's within 2.6 tiles of the goal, they can already shoot the target, it's fighting a robot, or it hasn't got a tile nearer in 4 s (held up): then they fight as usual. (They used to stop dead whenever they got ahead of it: the squad stuttered, bunched to 0.1 tiles apart, and stood idle while it fought.) 30 health |
| Torch (Foundry, 2 rounds of parts) | Flamethrower robot (`TORCH`, `torchFire`): every 0.2 s a cone (±0.5 rad, 1.9 tiles) does 0.35 to each enemy robot in it (through `damageBot`, so a facing shield stops it) and 0.8 to the building it burns, ×1.6 to defences, Walls and Gates (a Wall in about 6 s); a 12 s tank, one Fuel a fill (`reloadArmy`, `fuelPoint`, task `refill`); explodes with fuel aboard (`BLAST.torch`). **Scorch the earth** (its panel, X; the selection bar with Torches selected; the `scorch` order, `orderScorch`): with its tank at least `scorchMin` (90%) full it walks to a patch of fertile soil (`scorchTileWhy`), stops within `scorchReach` (1.3) tiles, sprays its whole tank into it over `scorch` (3) s (task `scorch`, `doScorch`) and the soil burns for good (`scorchSoil`); then it refills (`scorchDone`). A group takes a patch each, nearest Torch first, within `scorchSpread` (3) tiles of the one tapped. 18 health |
| Howitzer (Foundry; **switched off for now**: `BOTS_OFF` in `js/defs.js`) | Mobile siege launcher (`ROCKET`): parks 4–11 tiles from a building and fires 4 rockets (5 each, splash 2 to buildings, 4 to robots), reloads 4 Ammo at a garrison or storage; a Command Base or Keep stops at `missileFloor` (anything else it can knock out); hurt below 60% it goes to a Repair Station within `ROCKET.repairReach` (30) tiles; 14 hp. AI builds 1–3 and hunts the enemy's  A new one rolls off the Foundry to a post (`u.post`) it returns to after reloading; `u.stance` `hold` fires only on orders, otherwise it shells what comes in reach of its post without moving |
| Depot | Extra storage, shortens hauling trips; give it supply orders to stock it as a forward base |
| Trade Terminal | Bulk trade, docked within 2 tiles of a neutral Trade Post (`S.posts`, `TRADE_POST`, `placePosts`: placed fairly between the colonies at the start, one more than there are colonies, two in Colony; `nearPost`), one per post per colony, out past the usual reach; a rival's land round a post keeps you out (`TERMINAL`): 3 contracts at a time (new every 5 min), a lot of 30 of one good for Ore, Crystal, Stone, Fiber or Alloy at 65% of worth (`TRADE_VALUE`; Alloy only bought, never a good traded down for one worth under 1/1.3 of it, `tradePairOk`), +1.5%/tile beyond 16 (max +25%), each lot sold fetching 12% less for a while; served only by Road Trains and Freight Trains (`terminalSpare`, `updateTerminal`), a Road Train bringing the lot from storage that holds 10 or more of it (`TERMINAL.minLoad`: the nearest with only a few, a Harvester's Fiber, say, used to hold the lot up for good); its goods can't be spent until a train takes them home. On top, always, a steep **Fuel contract** (`fuelContract`, `o.steep`, last in the list): 30 Stone or Fiber (whichever the colony has more to spare, `TERMINAL.fuelGive`) for Fuel at `TERMINAL.fuelRate` (30%, about half the usual): 6 Fuel, 8 far out. Its Fuel goes home by Tanker to storage (logistics step 4e; never a train), or by pipeline: a Terminal on a Fuel line gives it to the storage and Fuel users there (`updatePipes`) and no Tanker comes. The rival takes it only when dry of Fuel with no source (`P.fuelDry`, `aiFuelSource`), and docks a Terminal for it from 10 minutes |
| Ramp | Planned in Paths: cuts a slope into a one-level cliff so bots can climb it; counts as road |
| Fuel Station | Recharges bots' batteries, four at a time; burns **Fuel** |
| Bio Farm | A worker plants energy crops on fertile soil and harvests them into **Fuel** |
| Oil Pump | Built on an oil seep; a worker pumps **Crude** until it runs dry (no stock limit unless you set one) |
| Refinery | Crude → **Fuel**, one for one (stops at 30 unless you change its stock limit); explodes when destroyed |
| Generator | Burns a Fuel every 40 s to make factories, Refineries, Oil Pumps and the Foundry within 4 tiles work a third faster |
| Cement Works | 1 Stone → 2 **Cement**, the main building material (stops at 40 unless you change its stock limit) |
| Asphalt Plant | Crude + Cement → 2 **Asphalt** |
| Roadworks | Its Paver paves and maintains the roads you mark for asphalt (or every joined road), nearest first (1 Asphalt covers 4 tiles) |
| Ammo Plant | Alloy + Cement → 3 **Ammo**; warbots reload it in the Command Base and Outposts, 5 shots per Ammo (Versus) |
| Missile Factory | 2 Alloy + Chip + Fuel → **Missile** (20 s each; Versus) |
| Missile Silo | Fires Missiles at rival buildings up to 18 tiles away; holds 2, reloads in 25 s (Versus) |
| Repair Station | Fixes damaged bots three at a time; 1 **Alloy** repairs 12 health (Versus) |
| Nuclear Reactor | 2 Uranium → 1 **Enriched Uranium** (Nuclear race) |
| Nuclear Silo | 6 Enriched Uranium + 4 Alloy + 2 Chips → one nuclear missile; fires 40 tiles (Nuclear race) |
| Research Lab | Researches colony-wide upgrades with Chips, Crystal and Alloy (Colony) |
| Ropeway | Placed in Paths: two stations joined by a cable straight across cliffs, water or rock; light bots ride it |
| Viaduct | Placed in Paths: a level bridge straight across a valley between two clifftops; every bot crosses it |

- **Cement builds the colony.** Nearly every building costs Cement, and so does every road. Only the Quarry (2 Fiber)
  and the Cement Works (4 Stone, 2 Fiber) are built from raw materials, so you can always restart. Stone goes into
  Cement (2 per Stone) and new Cement Works. You land with 24 Cement, 8 Stone, 16 Fiber, 8 Alloy, 4 Chips, 4 Crystal and 10 Fuel.
- **Stock limits:** tap a production building and set when it stops: once you have that much of its product it takes
  no more inputs and its worker goes off to other jobs until it's needed again. By default the Cement Works stops at
  40, the Refinery and Oil Pump at 30, the Ammo Plant at 24, the Asphalt Plant at 20, the Chip Fab at 10 and the Missile
  Factory at 4 (so Chips and Ammo don't swallow the Foundry's Alloy); the rest have no limit until you set one.
  Gatherers and Bio Farms have none (they make no recipe): pause them if their goods pile up.

- **Workers and Haulers:** Workers run buildings (one inside each production building), go out to cut, dig and mine
  (the nearest node in reach, unless the walk there is over `NODE_DETOUR` (1.75) times the straight line: then the
  shortest walk of the four nearest, `findNode`, `routeCost`),
  and build construction sites. They can go anywhere, but off the road they move at 40% speed, except while out
  gathering for their building. **Haulers** move every good between buildings (except Crude and Fuel: see Tankers),
  two at a time, and **only drive on roads**. A factory less than a Hauler's load short of an input, with more than
  its next batch in hand or on the way, waits to be topped up (`dispatch`), so Haulers carry full loads instead of one
  unit after every batch. If every Hauler is lost, workers carry goods slowly until the Foundry
  makes more. **Agribots** run Bio Farms and Grove Planters, **Pavers** run the Roadworks and **Warbots** fight. You
  start with 10 Workers, 5 Haulers, a Tanker and an Agribot (plus 4 Warbots in Versus).
- **Every building needs a road to storage.** Your Command Base starts with a ring of road around it; join each building and construction
  site to that network (or to a Depot on it), or Haulers can't bring it materials or collect its goods. A red road badge
  marks buildings with no road: tap one and press **Lay road** to plan the shortest route (shown dashed; of the
  routes as short, the one with fewest bends: `roadSearch` pays `ROAD_TURN` 0.05 a turn, as the rival's roads do), or plan your
  own. Placement keeps a side of every building open for a road.
- **Planning roads:** in Paths, dragging and tapping only sketch a road (and tapping a road marks it to take up; a
  drag that starts on planned road or track of yours and goes on along it calls the plan off tile by tile instead,
  `planErasable` / `eraseTile`: sketched tiles drop out, waiting ones are marked to call off at Build, cost back; one
  that leaves it for open ground draws on from there, and built road is never touched by a drag);
  the banner, at the top of the screen, shows the cost, with **Undo**, **Clear** and **Build**. On an upright phone the
  banner (and every mode's banner) is docked across the bottom in place of the tools: the line is up to three lines,
  the tools are behind one button, **Tool: Roads ▾** (the tool in use; it drops the word Tool where Route to leaves
  it too narrow, `toolFit`), that opens all of them at once as a grid over the map, the one in use lit, and shuts when
  one is picked (`toolPicker`; a touch elsewhere shuts it too, and one on the map does nothing more), with Route to,
  Traffic and Done beside it and Undo, Clear, Build and Done in the row below; a mission goal that lights a Paths
  tool lights the Tool button while that tool isn't the one in use (`coachTarget`). On a phone on its side the tools
  are one row to swipe along (an end with more tools beyond it fades out, `segEdges`). **How it works** is a tab on
  the banner's edge that opens as a card over the map. Sketching up to the edge
  of the map scrolls it on under the finger (`paintScroll`), and a tap just above the docked banner glides the map up
  so the banner's new row doesn't cover it (`planInView`). Nothing is spent until
  Build. Building closes Paths, straight back to the map; leaving Paths any other way drops an unbuilt sketch.
  Arrows and Junctions still act at once. **Ramps** are planned in Paths too (tap the foot or top of a one-level
  cliff, or just drag a road or track up it: `dragCliff`) and count as road once built.
- **Roads through Outposts:** an Outpost can stand on a road, and its tile joins the road network. Like a Gate it only
  lets its owner's bots through (`passTile`); an armed enemy warbot breaks in (`breachable`), which captures it.
  So connectivity is worked out per player (`roadNet(who)`, `roadLikeFor`): an Outpost, Keep, Gate or Ropeway station
  joins roads only for its owner, and a building anyone can't pass blocks the road under it, exactly as `findPath` has
  it; `buildingNets`, `botNets`/`botGroups`, `pileNets`, `onHomeNet`, `roadRouteTo` and `roadReach` all use the
  owner's view, so nothing counts as linked that a hauler can't drive. An overpass is two straight roads in all of
  them (`tileNets`, `laneComp`: see Junctions below), as in `findPath`. Each player's networks are numbered from
  `(who + 1) * RN_SPAN`, so ferry-line groups (`netGroups`) never mix players up; `roadNet()` (everyone's at once) is
  for drawing roads and junctions. A capture (or a colony knocked out) bumps `S.roadVer`.
  Bots follow roads round corners (no diagonal shortcuts on or off a road).
- **Your robots:** tap the robot counter in the top bar for every robot by type and what they're doing, and the
  spare Workers (`workersWanted`, `spareBots`) with **Recycle spare Workers**.
- **Recycling** (`js/sim.js`, the recycling section; `RECYCLE_SHARE` and `RECYCLE_KEEP` in `js/defs.js`): a robot's
  panel has **Recycle this unit** (**Delete**), a selection of warbots **Recycle these N units** on the selection bar
  (a second tap to confirm; Undo), and Your robots **Recycle spare Workers** (orders `recycle`, `unrecycle`,
  `recycleSpare`). The robot drops what it was doing (a load goes down in crates), heads for the nearest finished Bot
  Foundry it can reach (on its ground; a road vehicle by road: `recycleFoundry`) with task `recycle`, and there stands
  at the Foundry while it is taken apart: `RECYCLE_TIME` (2 s) for each round of parts (`recycleTime`; `task.t` counts
  them, `recyclingNow`; a Worker or Warbot 2 s, a Crawler 12 s), sparks flying and the robot fading as it goes, the
  Foundry carrying on with its own work and taking apart any number at once. It can be shot meanwhile, and a damaged
  robot gives back as much as a sound one. Then `recycleBot`: `RECYCLE_SHARE` (half) of its parts, 1 Alloy and 1 Chip a round, rounded down, Alloy
  first (`recycleYield`: a Worker or Warbot 1 Alloy, a Freight Truck, Tanker or Torch 1 Alloy and 1 Chip, a Crawler 3
  and 3, its goods left in crates), goes into that Foundry's stock, and its place under the robot limit is free; a
  ring, sparks, the goods floating up and a clank. Its status reads *Going to be recycled*, then *Being taken apart at
  the Bot Foundry (n s)*; **Keep this unit**
  (`stopRecycle`) or any other order calls it off; its Foundry wrecked, captured or dismantled on the way, it stops
  where it is (`releaseBotsFrom`). A Worker or Hauler that takes cover from enemy warbots on the way (`takeCover`) sets
  off again once they've gone (`u.recycleTo`), and isn't given other work meanwhile. Robots on their way don't count in
  `dispatch` (free workers, Haulers, Tankers) and `callWorker` passes them over. Planes, ships, trains and the Murmur
  can't be recycled (`recyclable`). Spare Workers: past one for each building that takes a Worker (sites too) and
  `MIN_FREE_WORKERS` + `RECYCLE_KEEP` (4) free for building; picked idle first, never one running a building.
- **Bot Foundry build order:** its panel lists every bot type with ▲ ▼ arrows to move it up or down (`b.order`,
  `foundryList`, `moveFoundryOrder`), and a choice of **Take turns** (one of each ordered type in turn, in the list's
  order) or **Top of the list first** (`b.omode = 'first'`: every bot of the top ordered type before the next). The
  type being built is highlighted. The AI keeps the default order, taking turns.
- **Roads** cost Cement (1 Cement paves 5 tiles), paid when you build the plan. Planned tiles show dashed
  until free workers pave them: 1.5 s a tile (3 s through resources), working out from the existing network, so long
  highways take planning and spare workers. A worker that just found no way somewhere (walled in on the Wall it built,
  say: `u.failUntil`) sits out the next building and paving rounds, and isn't counted as soon free (`nearSoon`), so
  the others still come; a tile nobody can reach is skipped for a while (`paveSkip`). Calling off a planned tile refunds it. Roads double a bot's speed. Dragging
  plans roads round resources; tap a boulder, grove, ore or crystal tile to clear it for a road at 3× the Cement. A Roadworks' Paver
  upgrades roads to asphalt (2.75×) with Asphalt, driving out along the roads joined to its Roadworks, however far.
- **Paving and road wear:** Paths → **Pave** (E): drag along roads to mark them for asphalt (drag over marked road to
  clear it). Roadworks pave the marked roads joined to them (or, set to *Every joined road*, everything; the AI builds no Roadworks). Every bot driving onto asphalt wears it (`WEAR_BOT`, Freight Trucks `WEAR_TRUCK`, three times as much): past
  half worn it slows bots (to 2.3× when nearly through), at `REPAVE_AT` the Paver resurfaces marked road, and worn
  through it drops back to plain road. On a busy trunk road that's every 8–10 minutes. Tap any of your roads to see its
  wear and mark it. Removing a road refunds its Cement.
- **Bridges and tunnels:** a road dragged out over water (or a canyon) in Roads carries on as a bridge, and through
  rocky crags as a tunnel, so there's no need to switch tools. The **Bridges** tool in Paths plans them too:
  a bridge costs 2 Cement and half an Alloy a tile (cheaper than a Viaduct span: Islands live on bridges), a tunnel 3 Cement and 1 Alloy (`CROSS` in `js/defs.js`;
  `bridgeable`; a Sky bridge over the old `T_CHASM` canyons, 3 Cement and half an Alloy, survives for old saves). Workers build them out from the shore or rock face (6–9 s a tile), and
  they join land on any level. A bridge is drawn as one level span at the height of the highest clifftop it lands on
  (`deckLevel` in `js/render.js`), ramping down at a lower end; its piers, end towers and suspension cables reach past
  the tile, so `drawBridgeRigging` draws them each frame over the map. Lay road routes use them only when going round is much longer.
  A bridge can be pushed out over water past your border, a tile at a time from your land or a bridge (`bridgeHead`).
  Like a Viaduct's far end, where a bridge comes ashore on no-one's land the ground within `VIA_CLAIM` (3) tiles of the
  landing is claimed for whoever's land the bridge runs out from (`computeTerritory` traces each bridge from its owner's
  border or shore; land only, never water or anyone's land), so an Outpost can go on the new island, even right at the
  end of the bridge. Territory is recomputed whenever a bridge tile is built or removed.
- **Plans that wait for goods** (`settlePlans`, `S.planQ` in `js/sim.js`): anything you plan in Paths (road, bridge and
  tunnel tiles, track, Walls, Gates, Ramps, traffic lights and overpasses) and Viaducts can be planned without the goods.
  Planning the same thing again moves it to the back of the queue, once (`queuePlan`). Each joins a queue, oldest
  first, and `settlePlans` (once a second, and right after you plan) pays for what it can from storage; a good an
  older plan is still waiting for isn't spent on a newer one. Road tiles waiting for their goods are flagged in
  `S.owe` (workers pave only paid tiles: `planList` vs `planAll`), track waiting to go down in `S.railPlan`, and
  store-paid sites (`prepaid` Walls, Gates and Viaducts, and every Ramp planned in Paths, `b.fromStore`) take their goods a
  unit at a time (`payInto`) and are built as far as their goods go. Calling off an unpaid tile gives nothing back; a
  half-paid site gives back what it holds. The computer still pays up front (`canPlace` keeps its check for AI players).
  Dragging a road or track across a one-level cliff plans a Ramp there (`dragCliff`: on whichever side can take one,
  preferring a tile with no road or track yet; two levels or more, or no room, says so in the banner). The Ramp is the
  road on its tile, and the track over one waits in the queue until it's finished. Ramps don't count against
  `MAX_SITES` (they're part of a path), so a plan never quietly loses its Ramp when six buildings are going up.
- **Junctions, traffic lights and overpasses:** where three or four roads meet, bots slow down and give way to traffic
  already crossing. Switch the Paths banner to **Junctions** and tap a junction to put up a traffic light (1 Alloy): it
  lets one direction through at a time, switching when traffic waits the other way. On a busy crossing a light moves
  half as many goods again or more, while on a quiet one it costs a few percent (a light switches as soon as nobody is
  coming on green; `LIGHT_MIN_GREEN` only holds while green traffic is still coming). Tap the light again for an **overpass** (4 Cement,
  3 Alloy), only on a crossing of four roads (`isCrossing`: `roadNet().junc` holds 3 or 4): the east-west road passes over
  the north-south one and nobody slows or waits, but **nobody turns there**. `findPath` only steps onto an overpass
  straight on, as one move from the tile before it to the tile after it (across overpasses in a row, every step paid
  for, the overpass tiles kept in the path); a route may still start or end on one. `roadNet` gives the tile two
  labels, `comp` for its east-west road and `compV` for its north-south one (see `tileNets`, `laneComp`), so roads that
  only meet at an overpass are separate networks, and `roadSearch`, Route to (`routeSearch`) and the zones
  (`computeZones`) go straight across too. A route planned before the overpass went up and turning on it is planned
  again (`routeCheck`). On a T-junction the second tap clears the light and says why (`OVER_T_WHY`); an overpass left on
  one (a crossing that lost a road, or an older save) becomes a traffic light (`overToLight`, the rest of its cost
  refunded) and a planned one a planned light. Tap again to clear it. Short of goods, a tap
  plans the light or overpass instead (`S.junPlan`, a `'j'` entry in `S.planQ`): it's paid all at once when the goods
  are in (oldest plans first) and goes up then; a light already standing keeps working while its overpass waits, and its
  Alloy counts toward it (`junPlanCost`). Calling a plan off gives nothing back; the AI pays up front.
- **Traffic map:** **Traffic map** in the Paths banner (or **T**) tints each road green to red by how busy it has been
  over the last minute and rings the spots where bots stand waiting. How busy each road has been (`HEAT.flow`, `countTraffic`)
  is kept in the save (`S.heat`): the AI picks its raids by it (`aiRaid`), and a loaded game must raid the same.
- **Goods flow map:** **Goods flow** beside it in the Paths banner (or **Shift+T**; one of the two maps at a time,
  `setRoadMap`) draws what each road and track tile has carried over about the last minute: a line along the road,
  wider the more goods went over it (five widths, `GFLOW_STEPS`: past 2, 5, 12 and 25 goods a minute), coloured by the
  good most of them were (`GOOD[g].color`), on a dark edge, red where bots stand in a jam (`HEAT.jam`, only read). A
  dashed ring in a good's colour marks a factory of yours idle for want of it (`flowStarved`), and the banner's key
  (`goodsFlowKey`) lists the goods on the move and how many factories wait. It is display only and outside `S`
  (`R.gf`, not saved, never read by a rule): `sampleGoodsFlow` (in `render`, every few frames, while a game is on) adds
  the goods aboard each of your moving robots times the distance it went since the last look to its tile's count for
  each good (a `Float32Array`, tiles × goods), and twice a second `fadeGoodsFlow` lets them fade with a time constant of
  a minute of game time (`GFLOW_FADE`) and works out each tile's total and main good. Only tiles in view are drawn, one
  stroke per good and width.
- **Long hauls:** tap a Depot and set **supply orders** (how much of each good to keep there). Goods come from your other
  storage, and anything nearby then draws on the Depot. A garrison that is storage too (the Command Base, a Drop Outpost,
  a Crawler) holds its own `ammoStock` back from supply orders and from other such garrisons (`ammoHeld`, `keepSupply`). Who carries what (see the comment above `TRUCK_MIN_DIST` in
  `js/defs.js` and `dispatch` in `js/sim.js`): **Haulers** (2) do runs under `TRUCK_MIN_DIST` (12) tiles. **Freight
  Trucks** (8; 2 Alloy and 2 Chips at the Foundry) do the long runs from any building, with a full load (a far
  factory gets up to `LONG_BUFFER` of each input), and storage to storage. With trucks around, Haulers take a long run
  only when the far building is about to run dry, and a far producer waits for a truck until its output is nearly
  full. A truck takes a supply order only for `TRUCK_KEEP_LOAD` (4) goods or more (or half the order, if smaller),
  unless the store has run dry. "Long" means 12+ tiles across plus down (`farApart`), as roads follow the grid. **Trunk runs** (`trunkRuns`): a store 12+ tiles from the Command Base sends home, in bulk, the goods nothing
  nearer to it uses (beyond its supply orders and `EXPORT_RESERVE`), by truck or Road Train only. **Road Trains**
  (30; 4 Alloy and 4 Chips) only do storage-to-storage runs 12+ tiles long, with `TRAIN_MIN_LOAD` (18) or more (any load
  without trucks). Trucks leave those loads to a Road Train that can get there (`roadTrainFor`): trunk loads build up
  to `TRAIN_MIN_LOAD`, and a supply order of twice that or more waits for a train load until the Depot is down to a
  third. **Backhauls** (`backhaul`): a truck or Road Train that delivers to far storage takes home what's waiting there
  (the trunk-run goods) instead of driving back empty. Measured on a 30-tile asphalt run with 2 trucks and a Road Train:
  missed supply at the far Depot fell from 63 to 11 uses in 10 minutes; trucks alone brought home 178 goods instead of 24. On plain road a Road Train runs at `TRAIN_ROAD` (35%); it takes corners slowly, holds `TRAIN_LEN` of
  queue behind it and wears the road by `WEAR_TRAIN`.
  On a straight asphalt trunk road one Road Train moves 1.5–1.75× what two trucks do; on plain road about the same or less.
  Idle trucks spread out: each store keeps one waiting, and spare trucks park at the nearest Depot (or Command Base)
  with none. Trucks are slower than Haulers on concrete (80%) and slow to accelerate, but fastest of all on asphalt.
  An audit of 35-minute autopilot games: trucks were busy 18–60% before these rules and 76–92% after, Haulers made
  about half as many long trips, and about a quarter more goods moved.
- **Ropeways** (`ROPE_*` in `js/defs.js`; `ropeLink`, `placeRopeway`, `ropewayAcross`): two stations 3–14 tiles apart
  joined straight across anything. Placed from Paths, not the Build menu: the **Ropeways** tool (**Shift+Y**), two taps
  (`ropewayTap`, the `link` order), like the Viaducts tool below. The near station is the construction site (it takes the whole cost); when it's built
  the far one goes up (`b.link` both ways). To the pathfinder a ride is an extra edge between the station tiles
  (`ROPE_COST` × a paved road of that length); zones and the road network join across it (`roadNet().comp`), but not for
  trucks (`compT`, `truckLinked`, `routeOpts.noRope`). Riders move at `ROPE_SPEED` (`u.ride`) and are drawn in gondolas.
- **Viaducts** (`VIA_*` in `js/defs.js`; `viaductBlocked`, `placeViaduct`, `viaductAcross` in `js/sim.js`; `viaLink` in
  `js/world.js`): two abutment buildings joined straight across lower ground, like a Ropeway's stations but level and
  open to every bot. Placed from Paths, not the Build menu: the **Viaducts** tool (**Shift+V**) starts the same two-tap
  placement a building card does (`enterPlaceMode`, `viaductTap`, the `link` order: `R.mode` is `'place'`), with the
  Paths tools kept on show (`crossingTools`, `pathsSeg`) and a road plan sketched in Paths kept meanwhile
  (`setMode(mode, keepPlan)`, `UI.planKept`): Cancel or the Viaduct placed goes back to it. (Their `BDEFS` stay: old
  saves and the AI build Viaducts through the sim; the AI never builds a Ropeway.) Paid up front (`prepaid`, its cost per site in `b.cost`, read with `siteCost`), built in
  `VIA_TIME` seconds a tile spanned (`b.buildTime`). To the pathfinder it's an edge between the abutment tiles at
  plain-road cost; zones, both road networks (`comp` and `compT`) and the railway (`railNbrs`) join across it. A bot
  out on the deck drives as if on the abutment it left (`moveAlong`), so the ground below is untouched and its traffic
  passes underneath. The deck, piers and girders are drawn each frame (`drawViaductDeck`). On Sky islands both ends must be
  mesa tops (level 3+), so a Viaduct never reaches the floor or its low rises. A far end may land on
  no-one's land or in a rival's (a bridgehead); `computeTerritory` keeps a Viaduct while either end stands in its
  owner's land (or the abutment is on no-one's), and takes it down once neither does. When one comes down, `offDeck`
  moves any bot on its deck to the nearer end (a civilian bot drops its order there, its load put down in crates; a
  warbot plans its way again), and a bot whose route jumps a Viaduct or Ropeway that's gone drops the
  route and its order (`moveAlong`). `roadSearch` crosses Viaducts, so roads (and the AI's) reach sites on far mesas,
  and `wouldBlock` / `canPlace` treat Outposts and Viaduct ends as walkable. A far end claims the no-one's ground
  within `VIA_CLAIM` (3) tiles, never anyone's land, so a new mesa can take an Outpost. A bot out on a deck keeps
  `u.deck` (the two ends) until it reaches one, so a new order or a chase starts from the deck, not the ground below.
- **Air: Airfields, the Cargo Plane and air drops** (every map). An **Airfield** (10 Cement, 4 Alloy; Build → Move) is
  a hangar with a runway `RUNWAY_LEN` (5) tiles long running straight out from it (`runwayDir`: the first of east, west,
  south, north with open, level ground of yours; kept in `b.rwy`, and nothing else goes on it: `runwayAt`). It is storage
  like a Depot. A **Cargo Plane** (6 rounds, built in the Airfield's hangar: `BDEFS.airfield.yard`, `updateYard`; `AIRFIELD_HOLDS`: one per Airfield) is based there (`u.home`, parked at the runway head). One load a flight (`u.mission`), dropped by parachute
  (`S.drops`, `AIR_DROP_FALL` s to come down): a **Drop Outpost** kit (6 Cement, 3 Alloy, paid from storage: a small
  outpost on any open ground nobody else holds; `terr` 4, garrison 2, `ammoStock` 4, storage, a 2-slot Fuel charger),
  two robots (Warbots from garrisons as for a march, or idle Workers, who board at the Airfield: the `board` task and
  `ferryWait`, as for a Ferry) anywhere, the enemy's land too, or up to 8 goods (`u.cargo`) for a place **supplied by
  air** (`b.airSupply`: any building with needs, construction sites too; a Drop Outpost and sites in its land have it
  on). The places take turns (`airSupplyRun`: the one served longest ago, `c.airAt`, or run dry of something, first). A
  supply drop comes down as a crate for every few goods (`d.crates`), swaying under team parachutes, and lands in front of
  the building with a puff of dust, its parachute collapsing out flat beside it, before it's taken in (`crateland`;
  art from `renderer/b/airdrop.js`: chute-fall, chute, crate-drop, chute-flat). Each place is served from its nearest
  Airfield with a plane (`airBaseNear`); that Airfield keeps what they're
  short of (`airWant`, up to `AIR_KEEP` of each) plus `AIRFIELD_FUEL` (12) Fuel for its planes (`airKeep`), and haulers
  (Tankers, for the Fuel) bring it.
  A flight (`flyStep`): it rolls down the runway from its head gathering speed (`ROLL_ACCEL`), lifts off at the far end,
  climbs (`PLANE_CLIMB` s) and turns at up to `PLANE_TURN` (never circling a spot it can't turn onto: `steerPlane`), drops
  over the spot, flies a circuit round to line up with the runway (`headHome`), comes down on final, touches down at the
  far end and brakes (`ROLL_BRAKE`) back to the head. It burns `PLANE_BURN` of its tank a second (a full tank is about
  45 s of flight; `sortieFuel`, `planeReach`: it checks its range before it takes off); one Fuel at the Airfield puts
  back `PLANE_FILL[type]` of it (`planeFill`, `fuelPlane`): 20 for a Cargo Plane, whose long round trip so takes 4 to 6
  Fuel, 40 for a bomber. Short of the Fuel for a flight it waits at the Airfield and says so (`M.noFuel`: how much
  more). Each of your planes shows a fuel gauge over it (`drawPlane`) and in its panel; the Airfield's panel shows its
  Fuel against `AIRFIELD_FUEL` and about how many flights that covers (`airFuelText`, `typicalFlight`: a round trip of
  `AIR_TYPICAL` (30) tiles each way, a bomber's charge on top). With no Airfield left it comes down in the field and
  flies to the next one built. Only Flak Guns hurt aircraft in the air (`damageBot` passes them by). Off the road network, within `FOOT_CARRY` (12) tiles,
  Workers carry goods by hand between buildings no Hauler reaches (a Drop Outpost's goods to a site beside it).
  Warbots posted to a cut-off post (`secluded`: supplied by air, or where they can't walk to the Command Base) stay with
  it: they recharge and reload there, go for repairs, rally flags and attacks only within `SECLUDED_REACH` (16) of it,
  and dropped beside a garrison of yours they're posted to it.
  The AI never flies Cargo Planes.
- **Vulcan Bombers** (Versus; `BOTS.bomber`, `BOMBER`): built in an Airfield's hangar, two to a hangar. A sortie
  (`orderStrike`, `strikeBlocked`: parked, in reach of a full tank) loads `BOMBER.ammo` (6) Ammo at its Airfield (which
  keeps that much a bomber, `airKeep`) and `BOMBER.fuel` (3) Fuel on top of what its tank needs (`tankFuel`; it takes
  off only with all of it there, none taken till then, and says what it waits for), flies out like a Cargo Plane and over the target drops one bomb
  (`bombDrop`; a vehicle on the move is led, and a target that's gone sends it home): `damage` 14 to the building aimed at
  (a Command Base or Keep held at `missileFloor`, see `captureOnly`), `splashBld` 4 to others and `botDamage` 8 to robots within `splash` 1.3, double on a
  vehicle hit squarely (a Tanker explodes). Home again it rearms for `rearm` 25 s (`bomberOnGround`); a bomb it didn't
  drop goes back into Ammo (the sortie's Fuel is spent). Flak Guns shoot it down. The AI (not a Warden) builds an Airfield from 22 minutes with its Ammo
  Plant running, one bomber, and a sortie at most every `AI_BOMB_GAP` (240) s at the most valuable building or loaded
  Tanker no Flak covers (`aiBomber`, `AI_BOMB_VALUE`). With the Airfield it puts up one more Fuel maker, decided once
  (`P.airFuel`): a Refinery while its Oil Pumps outnumber its Refineries, else a Bio Farm where there's soil its farms
  don't work, else a Refinery (and a pump) on oil; it goes up even with Fuel in stock.
  A Viaduct's deck can be bombed: a tap on a deck tile (`crossingAtTap` / `viaductOver`, which also make a tap on a deck
  or a Ropeway's cable select its nearer end) sends the `strike` order with that tile; the mission keeps it
  (`u.mission.deck`), the bomber flies there (`strikeAim`) and the bomb (`m.deck`) falls on it. It counts against the
  span: `damage` off the end nearer it, or the other end if that's the weaker (`deckBombEnd`), so two bombs anywhere on
  a deck bring it down (an end's `armor` is 24, and one end falling takes the other). The check that holds a bomb when
  those already falling will finish the target reckons a Viaduct as a span (`spanDoomed`).
- **Napalm** (`NAPALM`, the bomber's other payload): picking a bomber's target the strike banner's **Payload** switch
  (`strikeSeg`, keys B and N, `UI.strikeKind`) chooses Bomb or Napalm; a building's panel has **Napalm** beside **Bomb
  it**, and a rival's fertile soil **Napalm it** (`napalmFromPanel`). The `napalm` order (`orderNapalm`,
  `napalmBlocked`: parked, any `T_GROUND` tile in reach) makes a `strike` mission with `napalm: 1` and the tile (`x`,
  `y`, no target). On the ground it takes no Ammo but `NAPALM.fuel` (3) Fuel on top of `BOMBER.fuel` and its tank
  (`bomberOnGround`: it waits, saying so, until all of it is there; `u.napalmLoad` goes back into the Airfield if it
  lands with it). Over the tile it drops a canister (`napalmDrop`, a `bomb` missile with `napalm`), and where it lands
  (`napalmImpact`) every tile within `radius` 1.5 (`napalmTiles`: the tile and the eight round it) has its crops and
  stalk groves burned and its fertile soil scorched for good (`scorchSoil`), and a fire (`S.fires`, `updateFires`,
  `napalmBurn`, every `tick` 0.5 s, saved with the game) burns for `burn` 6 s: `bot` 0.6 a second to enemy robots on
  those tiles and `bld` 0.6 a second to enemy buildings (`bombHit`, so forts stop at their floor). The aiming overlay
  (`drawNapalmPick`) shows the bomber's reach and the soil it would burn (`napalmSoil`). The AI (`aiNapalmSpot`, in
  `aiBomber`) napalms an enemy that gets its Fuel from Bio Farms (`AI_NAPALM_FARMS` (2) or more at work, no Oil Pump that
  isn't dry) while its own Fuel is at least `AI_NAPALM_FUEL` (12), at most every `AI_NAPALM_GAP` (480) s, on the tile
  round one of its farms (no Flak covering it) where it scorches the most soil, `AI_NAPALM_SOIL` (3) patches at least.
- **Scorched earth** (`scorchSoil`): fertile soil burned by napalm or a Torch loses `S.fert` for good and is marked in
  `S.burnt` (tile → 1, saved; `burntSoil`), drawn as charred black earth (`drawBurnt`, a dark tile on the minimap) and
  repainted at once (`markDirty`); a crop on it burns; soil under a building is spared. The burner's tally:
  `stats.scorched`, and `stats.scorchedFoe` when the soil was a foe's (`soilHolder`: the owner of the nearest Bio Farm
  whose fields reach it, else the land's). A Bio Farm with no soil left says its fields were burned (`burntIn`).
  `hashState` covers `S.fert` and the fires.
- **Flak Guns** (4 Cement, 3 Alloy; Build → Defend; Versus): a twin anti-aircraft gun (`def.flak`, `updateFlak`). It
  tracks the nearest enemy aircraft in the air within 7 tiles (`aircraftNear`; never one on the ground, never a robot)
  and every `reload` s fires a salvo of `salvo` shells, each led to where the plane will be when it gets there (shell
  `speed`) give or take `scatter` tiles (`S.flak`, `updateFlakShells`); a burst hurts every enemy aircraft within
  `splash` (`hitAircraft`, `damage` at the middle). One Ammo is `shells` (8) shells. A Cargo Plane gets through one
  quick pass over a gun hurt and is mended at its Airfield; a few guns bring it down: the wreck falls burning
  (`S.drops` kind `wreck`) and crashes, and what it carried is lost. Bursts are drawn in the air layer
  (`drawFlakBurst`: a flash and fragments, then a ragged black puff that drifts and fades). The AI puts up two Flak
  Guns by its Command Base once a rival has an Airfield or aircraft.
- **Ships and Ports** (naval maps only: Islands and Lakes, `naval` in `SHAPE_PRESETS`, `navalMap`; `NAVAL_ON` switches them
  off everywhere): a **Port** (8 Cement, 3 Alloy; Build → Move) is storage on land beside water at least `SEA_MIN` (20)
  tiles big (`portDocks`; `seaNet` labels the bodies of water). Building on other islands: `buildZones` lets you build in the Command Base's zone and any where you hold a built store
  or garrison (a Drop Outpost, an Outpost, a Port). A Ferry founds a Port (`orderFoundPort`, `PORT_FOUND`: 12 Cement, 4 Alloy
  loaded at its Port, up to 4 Workers) on an empty shore nobody holds; it claims `claim` 4 tiles (`b.claim`, read by
  `computeTerritory`), and the Ferry heads home running a ferry line to it. A Ferry under your orders (`f.manual`:
  `orderSail`, `embarkWarbots`, `orderBoardFerry` with `v.embarkOn`, `disembark`, then `ferryBack`) sails anywhere, takes
  warbots aboard off a beach within `FERRY_REACH` and puts them ashore beside it; meanwhile it doesn't serve its line
  (`ferryLines`), and a line with no Ferry or no far Port puts its waiting passengers off again (`unloadFerry`). Warbots
  aboard stay aboard when the Port or Airfield they left from is lost (`releaseBotsFrom`, `aboardHold`).
  Ships are built at a Port's shipyard (`BDEFS.port.yard`, `updateYard`,
  `YARD`: a round of 1 Alloy + 1 Chip every 8 s, haulers bring `YARD.hopper` of each) and put to sea there (`launchFromYard`); they sail open water by `seaRoute` (8-way A*, never cutting a corner of land, under
  bridges) and move like trains. They burn Fuel under way (`SHIP_BURN`, a tank of 100 like a truck's) and fill up from a
  Port's Fuel when they tie up below `SHIP_REFUEL` (each Port with ships keeps `PORT_FUEL`, 4, which haulers bring;
  running low, an idle ship sails to a Port with Fuel, `findFuel`; empty, it crawls at half speed); they're mended
  while tied up (`SHIP_MEND`). **Container Ships** (40
  goods) and **Tanker Ships** (40 Crude or Fuel) take the dispatch role `'sea'` (`shipAt`): a Port's supply orders are
  filled by ship from another Port on its water, and a far Port sends its spare goods home to the Port nearest the
  Command Base, `SHIP_MIN_LOAD` (8) or more. A sunk ship's load goes down with it; a Tanker Ship explodes like a Tanker.
  A **Ferry** serves a ferry line (`b.ferryTo` on both Ports, `setFerryLine`): `ferryLink` makes the line a link in its
  owner's routes (`findPath`, at `FERRY_COST` times the distance plus `FERRY_BOARD`) and joins the zones at its ends. A
  bot whose route crosses waits in the Port (`u.ferryWait`, `ferryPassenger`), boards (six seats, `seatsFor`: a truck
  two, a Road Train three), sails and carries on from the far Port (`updateFerry`, `unloadFerry`); it gives up after
  `FERRY_GIVEUP` s. **Beach landings** (`orderLanding`, `doLanding`): a Ferry tied up at a Port takes up to six armed
  warbots (free ones first, then stationed ones) and lands them on any shore tile it can reach, where they hold a rally
  flag; `LANDING_GATHER` s after the order it sails with whoever is aboard. A Ferry sunk with bots aboard takes them
  down. Turrets, Bunkers, Mortar Pits and Missiles hit ships; warbots don't chase them (`nearestEnemyBot` with `land`).
  The rival builds a Port once its Foundry runs, a Ferry with a fair army, and every few minutes lands six warbots
  beside whichever enemy building it can reach that's least guarded (`aiNaval`). Later (after 15 minutes) it builds a
  second Port out toward the enemy, gives it supply orders (Cement and Ammo) and orders a Container Ship to keep it stocked. The art is top-down like the trucks
  (`renderer/b/ship.js`, `renderer/b/port.js`), drawn two tiles wide with a wake under way (`drawShip`); a ship tied
  up is drawn at its Port's dock. On naval maps a bridge tile costs more the further it is from shore (`bridgeMul`:
  `BRIDGE_NEAR` 2 tiles at the usual price, then `BRIDGE_STEP` 1.5 times more for each tile further).
- **Freight rail** (`RAIL_*` in `js/defs.js`; the rail section of `js/world.js`; `layRail`, `deliverTrain` in
  `js/sim.js`): track is a tile layer (`S.rail`), laid instantly from the Paths **Rail** tool (`RAIL_COST` a tile, mostly
  Cement with a quarter of an Alloy, paid through the same credit as road Cement; `RAIL_BRIDGE_COST` over water,
  `RAIL_TUNNEL_COST` through rock: a Rail drag carries straight on over water and through crags, `drawRailTunnel`). Track
  joins where a road would (`railStep` uses `canStep`): on one level, or a level up or down over a Ramp (natural or
  built in Paths), where trains drop to `RAIL_GRADE` (0.55) of their speed and brake for it in advance (`driveSpeed`);
  rail bridges join any level, and a Viaduct with track on both abutments joins its ends (`railNbrs`). Dragging track
  across a one-level cliff with no Ramp says to build one there. Rail Stations stand beside the track and build Freight Trains in their rail yard (the same `updateYard`; the Foundry
  builds neither ships nor trains, and orders for them in an older save move to a yard);
  their platforms are the track tiles next to them (`railPlatforms`), and `railNet` groups stations by line. Freight
  Trains (56 goods) take the dispatch role `'rail'`: trunk runs from a far station to the home station and supply orders
  between stations on one line, `RAIL_MIN_LOAD` (10) or more; `railRoute` plans along the track. Road bots wait at a
  level crossing while a train is near (`trainNear`, `RAIL_CROSS_HOLD`). Trains never need charging.
- **Which carrier** (`fleet-bench`: a far store full of Stone, 12 rounds of parts of each fleet, goods home in 8 min):

  | Distance | Trucks ×6, road | Road Trains ×3, road | Trucks ×6, asphalt | Road Trains ×3, asphalt | Freight Trains ×2, rail |
  |---|---|---|---|---|---|
  | 16 | 1200 | 1170 | 1512 | 2250 | 2996 |
  | 28 | 776 | 720 | 1128 | 1860 | 2016 |
  | 40 | 576 | 540 | 888 | 1560 | 1680 |

  Four trucks and a Road Train on plain road do worst of all (the Road Train holds up the trucks). The rail line ran
  15% longer than the road in these tests (it went round obstacles), and costs `RAIL_COST` a tile plus two stations.
  The Freight Trains were measured at 6 rounds of parts each; they're 5 now, so two cost 10 rounds, not 12.
- **Crawlers** (`updateCrawler`, `deployCrawler`, `packCrawler`): a slow tracked bot that drives off-road and deploys
  into the `crawlerbase` building (store, 4-slot charger burning its Fuel, Outpost territory, garrison 4). Packing up
  turns it back into a bot carrying the store's goods (`u.cargo`); if it's destroyed on the move they spill as loot.
- **Driving:** bots accelerate away from stops and brake for corners, junctions, red lights and the end of a trip
  (`BOT_ACCEL`, `BOT_BRAKE`, `BOT_CORNER` in `js/defs.js`; trucks have their own, slower values).
- **Frontier riches:** boulders, ore, crystal and oil hold more the further they are from the bases, up to 2.2× in the
  middle of the map; rich deposits sparkle. **Map shape: Long haul** on the new-game screen makes a narrow, long planet
  (75% as wide, 170% as long) with the bases far apart; **Chokepoint** walls the middle of the map off with a ragged belt of
  crags (2 to 5 tiles deep, rough outcrops in front) and one to three narrow channels winding through it to a gallery
  along the middle line, different every game (`chokeBand`; the mouths are kept in `S.choke`, see `chokePass`).
  **Islands** (a taller map) puts each base on its own island, with two or three medium islands in the middle (by the
  seed: a facing pair, or one in the middle and a pair out to the sides; one on a Small map; for a free-for-all, three
  between the homes out toward the rim, sized to leave as much sea as a two-way map, round an islet in the middle) and
  a couple of little islets, at least `ISLE_GAP` (4) tiles of sea apart (5 to 10 bridge tiles), so a crossing is a
  long, dear bridge (`bridgeMul`) or a ship; the AI bridges toward its rival (`aiBridge`) and makes beach landings
  (`aiNaval`: its landed warbots march on once the beach is clear, idle ones across the water go after the nearest
  enemy building there, and once a rival's army is nearly gone (the weakest one, in a free-for-all) it lands by that
  rival's Command Base; warbots stranded across the water out of Ammo don't stop its Foundry, as unarmed ones at home
  do). Specks of land under 8 tiles go under.
  On Islands and Sky islands each home island (or mesa) is topped up to `HOME_STONE` (300) Stone with a boulder field
  near the base, since Cement comes from Stone alone and every crossing costs Cement; on Sky islands boulders also
  get `SKY_RES_MUL` like the other mesa deposits.
  **Crater** sinks a crater one cliff below a rim in the middle, its floor holding rich fields (and Uranium in a
  Nuclear race), with one natural ramp in from each side. **Plateaus** stands each base on the top level, with a
  terrace one level down all round and only two natural slopes off it. Both force at least three levels.
  Five more shapes are for two players (laid over the finished terrain by `shapeExtras`, each tile with its twin, from
  the shape's own random numbers so laying one again gives the same map): **Rift** cuts a chasm (`T_CHASM`, 4–8 tiles
  across) along the middle line, crossed only by natural rock arches, a pair with their twins and sometimes one down the
  middle (a Sky bridge is the slow way to open another); **Ring valley** fills the middle with a massif too steep to
  climb, a valley running round it on each side (a long tunnel is the only shortcut; the massif stops short of each
  landing zone, so the starter fertile field is never buried); **Oases** is a barren,
  crag-strewn waste with nothing worth having outside the home ground and a few rich oases (three a side and one in the
  middle, fertile with two fields each) joined by narrow, winding passes; **Crossroads** (a wider map) splits the
  planet into four quarters with ridges along both middle lines, meeting at an open plaza with the richest fields, the
  bases in two opposite corners and the other two quarters rich and unclaimed, with gaps near the edges for flanking
  (built so it can grow into four players, one a quarter); **Lakes** scatters many small lakes between the bases (the
  `naval` flag marks it, with Islands, for the ships to come). Each shape lists `links`, the places its base must reach
  by land (each arch, both valleys, the plaza and both flank gaps), and `linkBase` opens the cheapest way to each one
  round the shape's own barrier (`wall`: a ford or a cut through crags, two tiles wide, only where there's no way
  round), so the twin of every link reaches the other base and no river or crag can cut a way across off.
  **Sky islands** (`sky: true`) lays out a home island per side, a small middle one, a chain of stepping-stone
  mesas from each home island to the middle (so the sides can always meet) and a jittered grid of islands between
  (14-tile cells in 2-player, 12 in 3-player; about 11 mesas, or 13–16 with three sides; the same for every side; canyons
  kept narrow by `SKY_GAP`, so the typical Viaduct spans 4 tiles and the route between bases never needs one over 6), then turns the sea into a canyon floor at level 0 and lifts every
  island into a mesa (home islands +3 levels, the rest +4; small ones flattened to one level), so every drop is 3+ levels: no Ramp can
  reach the floor, only a Ropeway. The outermost rim of every mesa is kept clear of resources (moved up to 3 tiles inland)
  and crags so a Viaduct can start or land anywhere on it (with two players worked out on one half and copied to each
  tile's twin, so the map stays point-symmetric). Each home mesa is topped up to at least 10 Ore and 8 Crystal tiles (a
  compact field 5–7 tiles out, placed the same for every side), and Ore, Crystal and Stalk on the mesas hold
  `SKY_RES_MUL` (1.8) times the usual amount, since half the fields fall into the canyons (`richRes` scales its mark to
  match). The floor gets low rises, rock formations, plants and a thin scatter of boulders and ore. Viaducts
  cross between the clifftops; the AI finds one with `aiViaductSpot` (only spans that bring it closer to its rival),
  puts an Outpost on each mesa it lands on, and rests its Ammo Plant and Chip Fab (and, with a fair army, its Foundry)
  while it saves the Alloy for the next span. (`T_CHASM`, the old bottomless canyon, is kept for old saves and is the Rift's chasm.)
- **Maps for three or four only** (`minPlayers` in `SHAPE_PRESETS`: the player choice can't go below it, Random only
  picks them for three or four, and Colony games on them leave the other colonies empty). **The Wheel** (`wheel`, three):
  rock spokes run out along the lines between the thirds from a raised hub (the only ground on the top level, the
  richest fields) to a rim road of open ground round the outside; the hub's cliff has one ramp up from each third
  (`tryRamp` from the middle toward each base, the others cleared). **Three Mesas** (`mesas`, three): each third is a
  mesa at level 3 (`mesaE`, from the sides of the third and the basin's edge), with terraces at 2 and 1 round it and
  the canyon floor at 0: a basin in the middle holding the riches and a narrow canyon along each line between the
  thirds, where neighbouring mesas come 9 tiles apart (a Viaduct's span). Every cliff is a mesa's, so all the ramps
  are cleared and one way down is laid from each base straight toward the basin, a ramp at each step, two lanes where
  the ground allows. The four-quarter maps (`quad4`, turned a quarter at a time like Crossroads, for three or four):
  **Pinwheel** (`pinwheelShape`) draws one curved ridge (from the plaza out to a few tiles short of the edge, curling
  round by about 70° near the plaza) and `put` lays it on all four quarters; **Four Isles** (`isles4`, `islands`, `flat`)
  cuts the bottom-left quarter into a home island, a quarter of the rich middle island and the islets on the lines to
  its neighbours (where there's room for the sea round them), and in a team game (`cfg.teams`) lays a two-tile sandbar of
  fords from each island to its ally's (half-turn twins: west pair and east pair); **Twin Valleys** (`twin`, four only)
  is the plain four-quarter terrain with a rock spine 4–6 tiles wide down the middle column, laid after the turns with
  its half-turn twin (`orbit` is the half turn there too), crossed by a south pass and its north twin with rich fields at
  each end, the ways from each base to its pass and up its valley carved open. The Trade Posts on Twin Valleys (whose
  middle is a mountain) fall back to being about as near the two nearest colonies (`placePosts`), and its Uplinks are
  two half-turn pairs. **Long Haul 2v2** (`haul4`, four only, `haul4Map`; not a four-quarter map) is the Long haul
  planet as long and 1.6 times as wide (`w: 1.2, h: 1.7`: 36×72 Small, 48×96 Medium, 60×120 Large, 72×142 Huge, the width
  kept even), standing upright, with two colonies side by side at each end: south-west and south-east (players 0 and 1,
  a team in 2 vs 2), north-east and north-west (2 and 3), allies about 21 tiles apart (17 on Small). The bottom-left
  quarter is generated (the plain terrain, a little sparser in scattered fields, `areaK` × 0.75) and mirrored left to
  right and end to end onto the others (`mirror4`; `orbit` is the tile with its three mirror images, so ramps and
  everything laid with `put` stay the same for all four). Its own fields: the "beyond" fields squeezed into the
  colony's half of the width and stretched up the map, five more strung along the middle stretch (Crystal, Ore,
  Boulders, Oil, Ore, from about a fifth to three fifths of the way from the middle line to the base row), and Ore,
  Crystal and Oil round a plaza of open, level ground at the very centre (`haul4Shape`, the ground round it kept within a
  level, a way to it from the base carved open). The frontier riches peak there, so the rich deposits crowd the middle third
  of the length (on a Medium map about four times as many as in each end third). Its Trade Posts: the first on the plaza, the rest in pairs, each with its half-turn twin
  (down the middle line between allies, or out at the flanks of the middle line), so both teams have the same; its
  Uplinks: the middle and one for each colony, mirrored both ways; meteor showers fall mirrored both ways too.
  **Teams: 2 vs 2** starts on when it's picked (`teamDefault`: in the map picker, a saved planet, or on loading
  remembered settings), and can be turned off for a free-for-all of four.
- **Three players, the same in every third:** the terrain is turned from player 0's third onto the others, and turned
  again after the specks and slopes are smoothed (a patch just under the 10-tile limit in one third could be just over
  it in another); the ramps are laid in player 0's third and turned onto the others (`turned`: the nearest tile at the
  foot of the same step), then any ground that lost its way up or down gets a ramp back, the same in every third. Each
  third now has about as many ramps (within a tile or two; it used to vary up to two to one).
- **Fortresses** (`fortressHome`, Three Mesas and Plateaus): a colony's home ground counts as one while no more than six
  ramp tiles lead off it. From 10 minutes in (`AI_FORTRESS_SPAN_AT`), with twice the goods to spare, the computer spans a
  canyon with a Viaduct straight onto a rival's fortress, out of its guns' reach (`aiFortressSpan`; at most two onto
  one fortress), so its attacks needn't all come up the one ramp the rival's turrets hold.
- **Shooting across a canyon:** a warbot that can't close in shoots from up to `WARBOT_RANGE_BLOCKED` (2.2) across
  a building or cliff, and up to `WARBOT_RANGE_GAP` (3.6) from a clifftop across lower ground (`overGap`: a narrow
  canyon with no rock, water or building in the line), so garrisons facing each other across a Sky islands canyon
  fight instead of standing off.
- **Loitering:** a warbot standing still in another player's territory for more than `BATTERY.waitGrace` (15 s) drains
  `BATTERY.warbotWait` a second; once flat it gives up its attack, or leaves its rally flag, to recharge at home.
- **Raids:** armed warbots holding a rally flag in enemy land with nothing to fight tear up enemy roads (not bridges or
  tunnels, which only a Missile can crater) near the flag,
  one tile per 12 warbot-seconds. The rival raids your busiest road clear of your defences every few minutes (Easy
  rarely, Hard often; a Salvager far more) once it has warbots to spare: out of reach of every gun (Pulse Turrets, Minigun
  Nests, Bunkers, Mortar Pits, Disruptor Towers, Keeps: `aiDefReach`, plus 3½ tiles for the raiders' spread) and of
  garrisons with two armed warbots in them, by a way in that crosses no gun's reach (`aiRouteHot`: the best four
  stretches are tried in turn). A raid's clock (`RAID_TIME`) starts when the first raider reaches the flag (`P.raid.at`;
  until then it has two seconds a tile from home and half a minute), and the band comes home early when the enemy
  army within 5 tiles of it outnumbers it. The rival answers your raids (`aiCounterRaid`) only when it can send a third
  more warbots than the flag has. Every other raid (`P.raidN`), with a Torch of its own ready in a garrison, it picks a
  road within `AI_SCORCH_NEAR` (6) tiles of an enemy Bio Farm instead and sends a Torch along (`aiRaidTorch`); a Torch on
  a raid with a full tank burns the nearest patch of an enemy farm's soil within `AI_SCORCH_REACH` (8) tiles that no gun
  covers (`aiRaidScorch`), refills and comes back to the flag (`u.resume`). Missiles crater the roads where they land.
- **Warbot movement:** warbots don't queue in road traffic, give way at junctions or stop at red lights (they still wait
  for trains), and nobody queues behind one, so a squad marching along a road or massing at a Gate it means to break
  down all keeps going (and all shoot). Chasing a foe, a warbot goes straight only when the whole line to it is
  walkable (`clearLine`); otherwise it follows a route (`viaT`: committed for 1.5 s, re-planned only when the foe moves
  off its end), gives up on foes that are only reachable the long way round (more than 3 times the distance) or not at
  all (left alone for 12 s, unless they come within shooting reach), and squads holding one spot edge apart
  (`spreadOut`) instead of stacking on a single point. On the march (not in a fight) warbots, Bulwarks and Torches
  plan round enemy guns: a tile an enemy gun reaches (`dangerMap` bit 1, the map civilians keep clear of) costs
  `COVER_COST` (4) more (`routeOpts` sets `opts.cover`, see `findPath`), so a short detour beats walking through it.
- **Setting off together:** an attack or rally flag that draws warbots from several garrisons (`sendAttack`,
  `sendToRally`: the Army panel's orders and the rival's marches, not its raids, counter-raids or hunts) times each
  one's walk along its route (`paceSquad`, `walkTime`), and the nearer ones wait where they stand for the difference
  (`task.wait`, at most `PACE_MAX` 45 s, not under `PACE_MIN` 2 s) so the squad arrives together; one shot at while it
  waits goes at once, and one whose target falls or changes hands meanwhile (an ally took it, say) stops waiting and
  drops it at once (as an attack does: crates, the fort, or the next building near by). Selected warbots sent
  directly, and orders given with `hurry`, go at once. Army units ordered
  together share their route searches (`squadRoute`: the routes planned in the same tick, by start tile, goal, owner,
  kind, armed and fighting; each gets a copy), and a squad on its way to a flag makes for the flag tile itself until
  it is within 4 tiles, then for its own spot round it, so a 20-warbot order costs one search, not twenty.
- **Routes looked over again** (`routeCheck`, from `moveAlong`): when the roads change or a building is put up
  (`routeVer`: `S.roadVer` and the newest building), a moving bot looks over the rest of its route. One that now
  crosses water or rock (a bridge or tunnel gone) plans again at once, and with no other way drops its job there (a
  load goes down in crates) instead of driving on over open water; a civilian bot also plans again when a new building
  stands on its route, or (road-bound) when its road was taken up and the way round is quicker than crawling across
  the gap (`GAP_DETOUR`). Fighting units' routes are only cleared, so they plan their own way again.
- **Traffic:** bots queue on roads, each waiting behind the bot ahead of it going the same way. On two-way roads each
  direction keeps to its own side, but passing oncoming traffic slows bots down. Switch the Paths banner to **Arrows** and
  drag along a road to point it the way you drag (tap a road to turn its arrow). The arrows turn at once, but each drag
  or tap is remembered as a stroke, so **Undo** turns them back (`draftUndo`, op `dir`); a drag that starts off your
  roads moves the map instead (`roadPaintStarts`), so a habitual pan doesn't turn every road it crosses. One-way loops
  keep busy routes flowing; going the wrong way up a one-way road is allowed but crawls.
- **Goods panel:** tap a goods counter in the top bar for that good's stock, production and use per minute, net rate,
  which buildings make and use it, and any shortfall (buildings waiting on it with none in stock). Switch goods at the
  top of the panel.
- **Why idle? (the bottleneck finder, `js/insight.js`):** a factory that isn't making anything (the Bot Foundry first,
  the Smelter, every factory with a recipe) shows **Why idle?** under its status (`whyIdle`, `refreshWhy`), worked out
  for the open panel only, once a second. It follows the missing input back down the chain and stops at the first real
  cause (`goodWhy`, `makerWhy`, `siteWhy`, at most three links down): is any in storage (then: no road, no Hauler or
  Tanker, storage no road joins to it, enemy guns, every Hauler busy: `haulWhy`)? Is there a building that makes it,
  and is it paused, cut off, under enemy guns, unstaffed (no free Worker: `workerWhy`), waiting for its own input
  (asked again, a link down), with no road, or for a gatherer out of deposits in reach (`insLeft`: none left, all on a
  rival's land, or all under guns; "ran dry N minutes ago" from `b.dryAt`, set in `updateDepleted`)? With none, is one
  going up (and why it isn't done), was one destroyed (from `S.log`), and are all `MAX_SITES` sites taken? A **Show**
  button opens the culprit's panel, **Build** places the missing building. The panel holds still: the box shows once the
  building has waited `WHY_DELAY` (3) seconds (a panel opened on an idle building shows it at once), the room it took
  stays while the panel is open, and a factory's progress bar stays, empty, while it waits. A Bot Foundry waiting on
  Chips used to move its buttons up to 120 px several times a minute. **The colony's shortage**
  (`insightColony`, once a second): the good gone longest without while something waits for it (`P.dry`, below), the
  Foundry's first; its counter in the top bar is ringed red (`.res-chip.starved`) and the Goods panel leads with it
  and its cause (`goodsWhyHTML`). Display only: it never asks the danger map unless it is current (`insGuns`), so it
  can't change when the simulation works it out.
- **Post-game report (`gameReport`, on the end screen, `#o-report`; missions too):** the moments that mattered
  (`reportMoments`, the dozen weightiest, in order): your first robot and first defence, the first attack each way,
  runs of buildings lost or taken, every shortage of 45 s or more and how long it lasted (still going at the end
  too), Command Bases falling and surrenders, and the deciding moment (the last big run of losses before the fall, the
  fall itself, or the Domination or Uplinks hold); where your goods were lost (buildings destroyed or taken, their
  materials and the goods inside, goods on robots destroyed, crates still lying on your land); and one **Next time,
  try** tip chosen from what happened (`reportTip`: an early rush, no defences, the longest shortage, raided supply
  roads, heavy losses, or a harder rival after a win). It reads **`S.log`**, the game's story, written by the
  simulation with one-line hooks (`logEvent`, `logFirst`, `noteLost`, `noteGone`, `logTick` in `js/sim.js`): kinds
  `bot`, `def`, `hit`, `lost` (a run of losses, each within `LOG_RUN` 60 s of the last), `dry` (`LOG_GOODS`, checked
  every 2 s: none on hand while a factory, a Fuel Station or a site waits for it; `LOG_DRY`) and `out`, capped at
  `LOG_MAX` (60: past it the smallest run of losses or shortage goes; firsts stay), saved, the same on every device, and
  left out of `hashState`. A building is lost when it goes without `b.gone` (set when it is dismantled, moved, packed
  up or a Ramp is finished); a fort captured is noted in `captureBuilding`. Totals that mustn't shrink with the cap
  are in `P.stats` (`lostBld`, `lostMat`, `lostIn`, `lostAboard`); open shortages in `P.dry`. A save from before the
  log starts it where it was loaded (`S.logFrom`).
- **Ammo:** warbots carry 10 shots (each Ammo reloads 5) and reload in your Command Base and Outposts, which haulers stock from an Ammo Plant. Out of
  ammo, a warbot can't fight at all: it heads back to a garrison to reload, and only armed warbots answer orders.
  On an attack, one that runs dry while the target stands and squad-mates are still on it goes to reload at a garrison
  with Ammo within `RELOAD_REACH` (16) tiles (a Torch: refills where Fuel is kept) and comes back, once per attack
  (`startReload`, `task.reload`, `task.trips`), so attacks no longer melt away at the wall.
  A rival's empty warbot sitting in a garrison with no Ammo and none on the way (an Outpost no road reaches yet)
  goes to reload where there is some and keeps away from that one for 90 s; yours stay where you posted them.
- **Rival boost (hidden):** tap the clock three times quickly, or press **`**, to give a rival a supply drop, 4 armed
  Warbots or 3 Workers at its Command Base (`BOOST` in `js/defs.js`, `boostRival` in `js/sim.js`), for a game you're
  winning too easily. The game pauses while it's open.
- **Repairs:** nothing heals by itself. Damaged bots go to a Repair Station (workers below 60% health, warbots below
  70% once their garrison is quiet; Colony free play too), which uses 1 Alloy per 12 health. A warbot below 35%
  (`REPAIR_RETREAT`) on an attack, a rally flag or a sortie pulls out of the fight for repairs when a Repair Station can
  fix it (otherwise it fights on), but not while it stands where an enemy gun reaches (`gunCovers`: walking out hurt
  through the guns killed more than it saved), takes no new fights on the way (`u.retreat`), and goes back to its attack or flag
  once mended (`u.resume`, `resumeAfterRepair`; the flag stays up meanwhile, and Recall cancels the return). Haulers keep up to 3 Alloy
  in it, and an empty one gets the first Alloy that reaches storage (like an empty Fuel Station's Fuel). To fix a building, tap it and press **Repair**:
  you pay 1 Cement for every 6 missing armor and a free worker restores it.
- **Statistics:** the pause menu and the end-of-game screen show graphs over time of bots, land, goods, **Economy size**
  (Output: goods made a minute, from the running total `made`; Buildings: finished non-military buildings, `econ`;
  Workers and vehicles, `civ`) and, with war on, **Military size** (Army, `war`; Defences: forts and guns, `def`),
  every colony a line (`recordHistory`), then how busy each kind of building was over the game; each building's panel
  shows its recent busy time.
- **Terrain levels:** the planet has terraces at different heights (lighter ground is higher). Bots
  can't climb cliffs; they use slopes at narrow passes, so some routes are long. Pave busy routes with
  Paths (slopes too) and build a **Ramp** (Paths, Ramps) on the top or at the foot of a cliff to open your own way up or down. Its worker builds it from whichever side of the cliff is the shorter trip (`rampStand`: the Ramp's tile or the ground across the cliff, `rampSides`), so a Ramp down off a plateau is built from the top, and its foot can even be ground no bot can reach yet. Buildings can't be placed where they
  would block the only way through a pass.
- **Placement undo:** for `SITE_UNDO` (10) seconds after you place a building (the `place` order notes `b.placedAt`,
  game time) an **Undo** chip shows at the foot of the map (`siteUndoTick`, `#undo-site`), and **Ctrl+Z** / **Cmd+Z**
  on the map does the same (outside Paths, whose Ctrl+Z stays its own Undo). It is an order (`undoSite`, the last in
  the table): only the sender's own site, not finished, placed with `place` (not a move) no more than 10 s ago by the
  game's clock, so every device agrees. Unlike Dismantle, nothing is left in crates: what was delivered or paid into
  the site, a Hauler's load on its way to it and a Cargo Plane's load for it go straight into the storage nearest it,
  the way a road's Cement is refunded (`undoSite` in `js/sim.js`; crates only if you have no storage at all). In
  multiplayer the chip goes a little early, by the order delay (`siteUndoLead`). Placing several sites in a row, Undo
  takes back the newest, then the one before while its 10 s last. `b.placedAt` is dropped when the site is finished.
- **Priorities:** tap a building or construction site and set it to Low, Normal or High. High-priority
  buildings get workers and goods first; low ones are served last and lose their worker first when
  workers run short. A priority set on a construction site ends when it's built (back to Normal). **Pause** frees a building's worker entirely. A Generator, Mortar Pit or Pulse Turret can be **turned off** (`pausable`, `setPaused`): it burns no Fuel, or holds its fire, and nothing more is hauled to it until it's back on.
- **Storage:** tap your Command Base or a Depot. *Fill first* makes haulers bring finished goods there before
  any other storage; *Empty out* takes nothing new and moves what it holds elsewhere (handy before
  demolishing it). You can also switch individual goods off for that building.
- **Minimap:** tap or drag it to jump around; red pulses mark buildings under attack; warbots are dots in a pale shade of
  their colony's colour (`MM_WARBOT`: every rival its own). The × hides it (on a touch screen it is a 44 px tab hanging
  under the minimap, so a finger-sized button isn't lying over the map).
- **Sharp map:** the map is baked once at 32 px a tile for zoomed-out views; zoomed in, the part on screen is baked
  again in 8×8-tile chunks at 64 or 128 px a tile (a few per frame, least recently seen dropped: off-screen ones give way
  to keep the lot under `HD_TOTAL` pixels and four screens' worth; the whole-map bake isn't drawn under chunks that
  cover it), `bakeMap` reuses its canvases and runs again only when art the map is drawn from arrives (`bakedArt`; at most
  every 2 s while more is coming, and at launch once that art is in or after `BAKE_WAIT`), and big art images keep half-size copies so they shrink cleanly (`drawMapLayer`, `artMip` in `js/render.js`).
- **Batteries:** bots drain their battery walking, working and fighting, and recharge only at a Fuel Station (or,
  for warbots, inside an Outpost). The Command Base doesn't charge anyone and you land without a Fuel Station, so
  build the first one straight away (it runs on the 10 Fuel you land with). A flat battery means half speed and half power.
  A factory's worker goes to recharge at `BATTERY.low`, or below `IDLE_TOP` (60) while its factory has nothing for
  it to do (`standingBy`: short of an input with none on the way, or full with no pickup coming), so the walk costs
  no working time. Fuel Stations burn Fuel (one Fuel is
  two full charges, `FUEL_ENERGY`). A Bio Farm makes about
  2–3 Fuel a minute (its Agribot keeps up with about 4 or 5 fertile tiles: more soil than that doesn't make more); an Oil Pump and Refinery up to 10 a minute until the seep runs dry (both stop at 30 by default).
  A dry Oil Pump shows a crossed-out oil drop over it, frees its worker and says so once: demolish it (any Crude
  still in a demolished building goes to storage). Harvesters, Ore Mines, Crystal Taps and Bio Farms do the
  same with their own resource crossed out when nothing is left in reach (and go back to work if groves regrow).
  A Quarry never runs dry (`bedrock` in its definition): out of boulders, its worker cuts Stone from the nearest
  rock face in reach (`rockFace`: ground against a crag or a cliff; 8 s a Stone, about 4 a minute) or, with none,
  digs it at the Quarry (20 s, about 2½ a minute), against about 8 a minute from boulders. It rests while the colony
  has `bedrock.rest` (40) Stone or more, so renewable Stone only flows when it's needed.
- **Moving buildings:** tap Move on one of your finished buildings (`movable`: not the Command Base or Outposts, which
  hold your land, nor Walls, Gates, Ramps, Viaducts, Ropeways or a deployed Crawler), then the new spot. `startMove`
  puts a site of the same kind there that costs nothing (`siteFrac` treats it as fully supplied); workers put it
  together in its build time while the old one keeps working, and `finishMove` hands over its goods, settings and
  work in hand (`MOVE_KEEPS`: orders and parts, a Silo's reload, a finished nuclear missile), its armor as it stood, a
  Port's ferry line and stationed warbots, then takes the old one down quietly. Calling the move off, demolishing either
  end or losing the old one takes the site down (`cancelMove`), so no building comes free.
- **Saved planets:** **Save** beside the planet number (More settings), or **Save this planet** in the pause menu, keeps
  the seed and the settings that shape the map (shape, size, terrain, resources, biome, players) on this device
  (`terrafall.planets` in localStorage, newest first, up to 40). Tap one in Saved planets to set the menu to it; ×
  forgets it (`savedPlanets`, `renderPlanets` in `js/ui.js`). A saved planet, or a remembered menu setting, that this
  version doesn't offer (from another version, or damaged) is left out or falls back to its default (`planetOk`,
  `checkMenuSettings`): one used to stop the game booting, and a planet's seed was shown as markup.
- **Alloy** (balance audit, AI games): Alloy income was set by how much Ore reached the Smelters, not how many Smelters
  there were. A Smelter eats Ore much faster than a Mine worker, who walks out and back for every Ore, can bring it, so
  extra Smelters just sat idle. Now a Smelter makes 3 Alloy from 2 Ore and 2 Fiber (the same 12 a minute flat out, a
  third less Ore per Alloy), keeps 6 of each on hand, and a Mine worker digs two Ore a trip: about 50 to 80% more Alloy
  by the 20-minute mark. Two or three Ore Mines keep a Smelter busy; a Smelter waiting for Ore says so.
- **Fuel, Tankers and pipelines:** Crude and Fuel are liquids (`LIQUID` in `js/defs.js`): only **Tankers** carry them
  (10 at a time, near or far; `take(…, g)` in `dispatch` hands every liquid job to a Tanker that can reach it). Haulers
  carry a liquid only when no Tanker can get there (none left, or none on that road network), one at a time, so nothing
  locks up. Every colony lands with a Tanker; order more at the Bot Foundry (2 rounds of parts, like a Freight Truck).
  A Tanker on a factory run brings it a full buffer (`LONG_BUFFER`), so a Refinery isn't kept waiting.
  **Fuel is dangerous** (`BLAST`, `fuelBlast` in `js/sim.js`): a Tanker destroyed with a load explodes (0.7 tiles
  across, up to 1.3 when full: 4½ damage to robots, 3 to buildings, half at the edge, anyone's), and so does a
  Refinery wrecked by warbots, a missile or a nuke (1.5 to 2.4 tiles: 6 and 5); its Crude and Fuel burn instead of
  spilling as crates. Loaded Tankers and Refineries caught in a blast go up a moment later (a chain reaction). Forts
  never fall to a blast (they keep 1 armor). Demolishing a Refinery is safe.
  **Pipelines** (Paths → **Pipes**, K) carry Crude and Fuel. Drag from an Oil Pump to a Refinery and the pipe routes itself
  (`pipeRoute`: inside your border, over roads and track, under buildings if it must, up cliffs, across water on stilts
  and bored through rock at `PIPE_CROSS_COST` (1.2 Cement) a tile, weighed by price so it goes round only when that's
  cheaper, with few bends); tap a
  pump to pipe it to the nearest Refinery, or **Pipe every Oil Pump** in the banner; an Oil Pump's panel has a one-tap
  **Pipe it to the Refinery** too. Pipe costs 0.3 Cement a tile (`PIPE_COST`), laid at once when you tap Build (or as
  the Cement comes in). A pipe joins every building it runs under or beside; each second each line moves up to 4 Crude
  (`updatePipes`) from its pumps to its Refineries (which keep up to 6) and Asphalt Plants, then into storage on it, and
  from storage on it to its Refineries. A piped pump never waits for a Tanker. **Fuel** moves the same way, up to 4 a
  second: from the Refineries and Bio Farms on a line (`fuelMaker`) to what burns it there (`fuelUser`: Fuel Stations,
  Generators, Flame Towers, the Missile Factory) up to what each asks for, then into storage; and from storage to what
  burns it. Lines joined through something that burns Fuel count as one (its tank passes Fuel on). What's made on a line
  with storage never waits for a Tanker (`pipedFuel`); on a line with only burners a Tanker takes just a full output's
  surplus (`fuelLine`); and nothing on a line with somewhere Fuel is made, or storage holding some, is sent Fuel by
  Tanker (`fuelByPipe`), unless it has sat empty for `PIPE_DRY` (20 s). Tap a Fuel Station or Generator in Pipes, or
  **Pipe Fuel to it** on its panel, to pipe it to the nearest storage, Refinery or Bio Farm (`pipeToFuel`); the rival
  pipes its own Fuel Stations and Generators that are within 10 tiles. Raiders cut pipe (it counts like a road
  for them), missiles and fuel blasts break it; broken pipe is planned again at once and relaid when it's paid for.
  **Trucks burn Fuel** (`TRUCK_BURN`): Freight Trucks, Road Trains and Tankers have a fuel tank instead of a battery,
  draining as they drive (a full tank lasts about 4 minutes of driving, a Road Train's under 3); low, they fill up at the
  nearest storage or Fuel Station holding Fuel (one Fuel fills the tank). With no Fuel anywhere they crawl at half
  speed. A **Generator** (Build → Make) burns a Fuel every 40 s while anything in its reach is working, and makes every
  factory, Refinery, Oil Pump and Foundry within 4 tiles work a third faster. Selected (or while you place one) it
  shows its reach as an amber ring, with corner brackets and a lightning badge on every building it powers
  (`drawRanges`, `drawBoosted`).
- **Feed links** (`FEED_TIME`, `FEED_MAX`, `FEED_BOOST`; `feedTargets`, `feedStep`): a production building passes
  what it makes straight to a neighbour (any of the 8 tiles round it) that uses it, one good every 2 s a link, by a
  short raised conveyor (a pipe for Crude and Fuel), with no Hauler, and a building being fed works a tenth faster.
  Each producer feeds at most two neighbours (side by side before corners); storage and walls never take part, and a
  Refinery also passes Crude on from its intake. So Mine → Smelter → Chip Fab → Foundry, Quarry → Cement Works,
  Smelter + Cement Works → Ammo Plant, Refinery → Asphalt Plant → Roadworks, Missile Factory → Silo work as blocks.
  Haulers leave a fed factory's input to the conveyor: they bring only its next round's worth of that good
  (`feedHaul`), never drive it over from the touching producer, and that producer keeps back for its neighbours what
  they still need instead of sending it to storage (`feedHold`; not while it is paused or cut off).
  Placing a building shows the links it would make as green arrows (`feedPreview`); a building's panel lists what it
  feeds and what feeds it; the belts are drawn over the gap between buildings, a crate riding across with each good
  (`drawFeeds`, `drawFeedLink`). The AI puts its factories beside their suppliers (`AI_FEED` in `aiSearchSpot`).
  **Smoke:** trucks puff diesel exhaust from their stacks (light while idling or cruising, thick black smoke pulling
  away), and working buildings smoke and steam from their chimneys (`vehicleSmoke`, `buildingSmoke` in
  `js/render.js`; the points are in `art/emitters.js`). The Generator plays its working loop (`generator-work-0…7`).
  Balance (`fuelprobe.js` AI games over every map shape, 45 minutes): colonies use a bit over half the Fuel they make,
  Fuel Stations stand dry about 2% of the time and trucks run empty almost never; trucks take about a tenth of the
  Fuel, a Generator a fifth where there is one.
- **Ways to win** (`VICTORY`, `S.victory`, `S.endHow`; Versus only, not missions): **Capture** is the default.
  **Surrender** (`SURRENDER`, `checkSurrender`): in any mode, 12 minutes in, a rival down to 40% of its best (buildings,
  warbots counting double) against a colony 4× as strong, or with nothing to rebuild with, gives up after about 40 s and
  everything it had changes hands as if captured. **Keep playing** (`keepPlaying`, `S.endless`): after a victory against
  the computer (not multiplayer, not missions) the end screen can carry on with the same game: no one wins again (no
  surrender, Domination or Uplinks count, and the last rival falling ends nothing), but losing your own colony still
  ends it. **Domination** (`DOM`, `updateDomination`, `domShare`): hold 60% of the
  land anyone holds with one rival (half with two, 45% with three) and a fifth of the planet for 3 minutes straight.
  **Uplinks** (`UPLINK`, `placeUplinks`, `updateUplinks`): 3 to 5 neutral towers (`S.uplinks`) placed by the map's own
  symmetry (180° for two, 120° for three, quarter turns on the four-quarter maps, the half turn on Twin Valleys, mirrored both ways on Long Haul 2v2), so every colony has the same, using a travel-effort
  map (`travelCost`) to keep them fair; on Sky islands only on mesa tops. Each belongs to the colony whose land covers it,
  and an armed enemy warbot within 2.5 tiles jams it. From `UPLINK.online` (8 min) the colony holding at least half of
  them and more than anyone else runs its clock (`S.upClock`, kept when it stops); 5 minutes in all wins. The AI plays
  for the Uplinks rather than the Command Base (`aiUplinks`): it pushes Outposts toward free ones (`aiUplinkGap`, a pull
  in `aiSearchSpot`; Keeps too), bridges or viaducts across to one it can't walk to (`aiCrossTarget`), holds its own
  (garrison priority High at the forts there, a guard flag of 2 to 4 warbots beside each from 90 s before they come
  online, two more per jammer, and a Bunker right beside each that skips the queue), and sends attacks, marches,
  bombers and missiles at the forts holding a rival's Uplinks (`holdsUplink`), even ahead of a crushed rival's
  Command Base, jamming them while that rival's clock runs (`aiJamUplink`).
- **Army orders:** tap **Army**, then a rival building to attack it with warbots or a missile, or open
  ground to send warbots there to hold the area under a rally flag. An Attack on a building no garrison is in reach of
  plants a flag beside it that targets it (`assault` sets `rally.target`): the warbots there shoot it first
  (`holdRally`), and once it falls or changes hands the flag comes down (`followRallies`), so they carry off the crates
  that spilled out and come home, as after any attack. Tap the flag to call them back, or press
  **Recall all** in the Army banner (**C** on a computer) to end every attack and rally flag at once. Under a finger
  Recall all asks for a second tap within 3 seconds (`recallAllTap`: the button says how many come home).
- **Saving:** the game saves itself every `AUTOSAVE_EVERY` (20) seconds while you play, and when you switch away or
  close it (`autoSave`); Continue on the main menu picks it up. The pause menu says when it last saved, and a failed
  save (storage full or blocked) is reported once. A long game's save is about 250–300 KB. Saves live in that browser
  only: **Download save file** (pause menu, `downloadSave`: through the artifact `downloads` capability in claude.ai,
  an ordinary download elsewhere) writes `terrafall-<mode>-<date>-<time>.json` (`saveFileText`: the save with when and
  what), and **Load a save file** (main menu, `importSaveFile`) loads one, a bare save too. A save is checked before it is used
  (`checkSave` in `js/world.js`: unknown building, robot, good, biome, map type, mission or event, map layers of the wrong
  size, owners or places off the map, or a name holding `<`, `>` or `"`; in text those three are swapped for look-alikes
  that can't make markup, so nothing in a save can run script in the panels; a multiplayer catch-up is checked the same
  way). One that fails is refused and changes nothing; if
  Continue can't load this device's save, the menu says so. A loaded file becomes this device's save only once its game
  is running (`enterLoaded`), and the save it replaced is kept as a backup (`SAVE_BACKUP_KEY`, `botfall.save.bak`).
- **Send feedback** (`js/feedback.js`, `#screen-feedback`): the small **Feedback** pill beside **Lore** at the foot of the
  main menu, and **Send feedback** in the pause menu, open a short form: the kind (**Bug**, **Idea**, **Balance** or
  **Other**), the message (3 to 5,000 characters, with a counter), an optional email or name (up to 200), a hidden
  honeypot field (`website`) and, only while a game is running, **Attach my current game** and **Attach a picture of the
  map** (each ticked for a Bug, unticked for the others until the player sets it). It posts JSON to the relay's
  `/feedback` (`feedbackUrl`: `relayUrl()` with `wss:` as `https:`, see Multiplayer, The relay): `{ type, text,
  contact?, meta, save?, shot?, website }`. `meta` (`feedbackMeta`, kept under 4,000 characters of JSON) is the build
  (`feedbackBuild`: index.html's `terrafall-build` tag, `dev` in the repository, which the publishing workflow stamps
  with the commit's short hash and the date, e.g. `1902487 2026-11-17`, and `tools/build-single.js` the same with
  `one-file`), the game's version (`gameVersion`, the fingerprint the lobby compares), the browser's user agent, the window's size, pixel ratio and touch or mouse and, from a game: mode (or
  mission and its difficulty), map type, biome, size, seed, players, the rival difficulty (Versus), game time and the
  last five messages (`UI.msgLog`). `save` is `saveFileText()`, the file Download save file writes, left out (and the
  thanks say so) if it is over 8 MB. `shot` (`feedbackShot`) is the map's canvas (`R.canvas`: no panels or menus) at
  most 1,600 px on its long side as a JPEG data URL under 1 MB (a lower quality if need be). The form says in one line
  what is sent. **Sending…** holds the button; on 200 it
  thanks the player with the report's number ("Report #n is filed.") and empties the text; 503 `off` (feedback not set up
  on the relay yet), 429 (too many reports), no connection and any other error each get their own words, and the text is
  never lost (it stays through closing the form too). It is only interface: it sends no order, doesn't change
  `UI.paused` (opened over the pause menu the game stays paused; a multiplayer game runs on under its menu as always) and
  takes every key pressed in it, so no hotkey fires while typing. Esc, Back or a phone's Back close it (on the main menu
  opening adds a history entry, as the Lore guide does; in a game `escapeKey` closes it first).
- **Photo mode** (`js/photo.js`, `#photo-bar`): **Photo mode** in the pause menu, or **Shift+P** (`photoEnter`), hides the
  whole interface (`body.photo`) and stands the game still (`UI.paused`; a multiplayer game runs on), and taps and drags
  on the map only move it (`inputSwap` gives `INPUT` handlers that select, order and paint nothing). A small toolbar
  fades after `PHOTO_IDLE` (3.2 s) left alone and comes back at a tap on the map, a mouse move or a key: **Time of day**
  (a slider over the 12-minute cycle; it sets `TOD.over`, which `todNow` and `todFrame` show instead of the game's
  clock: looks only, `S` and `S.time` don't change, the narrator's nightfall line ignores it, and it is let go on
  exit), **Borders** (`R.terrOff`: the land's tint and border lines) and **Minimap** (both off unless switched on,
  kept on this device in `terrafall.photo`), **Save picture** and **Exit**. The map is drawn by `photoRender`, which
  sets aside the selection, range rings, a Paths plan, a building being placed and the hover marks only for the
  drawing, with `R.clean = 2` (render.js leaves out badges, health bars and paused and cut-off signs). **Save picture**
  (`photoSave`) draws the map once more at the screen's full resolution (`devicePixelRatio`, up to 3 and
  `PHOTO_MAX_PX` pixels: `R.dpr` may be lower while the game runs), adds the minimap if it shows and a small
  Terrafall mark bottom right (`photoMark`), and offers `terrafall-<seed>-<date>-<time>.png` (`toBlob`) the way
  Download save file does: the artifact `downloads` capability in claude.ai, else an `<a download>` link
  (`plainDownload`, which takes a Blob too). Esc, Shift+P, **Exit** or a phone's Back (`escapeKey`) leave it, back
  to the pause menu if it was opened from there; everything set aside comes back as it was.
- **Observer mode** (`js/watch.js`, `#screen-watch`, `#watch-card`): the **Observer** pill on the main menu opens a setup card
  (`openWatch`): the map type (grouped as in the Custom Game picker), how many colonies (2, or up to the map type's
  `maxPlayers`) and each one's doctrine (or Random: one no other colony has), kept on this device in `terrafall.watch`.
  **Start observing** (`watchStart`) is a normal game in which the computer plays every colony: `newGame` with
  `humans: []` (each gets the rival's difficulty settings and doctrine; COBALT's doctrine is set straight after, since
  `newGame` gives player 0 the Steward), Normal difficulty, Nuclear race on, no planetary events, a random biome. `ME`
  stays 0, a colony the computer plays like the rest (as in the menu's backdrop game), for what this device shows and
  hears; `S.watch` has the game play on to the last colony standing (`eliminate`: a game with nobody in it otherwise
  ends when COBALT falls), and `playerName` says COBALT, not You. Nothing is saved: `saveGame` and `autoSave` never save
  a game whose player 0 the computer plays, and `clearSave` isn't called, so the player's own save stays as it was
  (Download save file is hidden). The HUD keeps the clock, the speed (`WATCH_SPEEDS`: 1×, 2×, 4×, 8×; `speedList`) and the
  pause menu (**Back to the menu**, Photo mode, Statistics); the minimap works; goods, the goal, the tools and the
  selection are hidden (`body.watching`). Taps and drags select and order nothing (`inputSwap`), and only the keys that
  move the map, pause, change speed, show the minimap, Statistics or How to play reach the game (F follows the
  action). `R.clean = 1` leaves out the marks render.js draws for this device's own colony. **The Scout report**
  (`watchReport`, once a second by the clock; its title folds it away to the colonies' line) lists each colony by doctrine ("the Warden", or "the blue Warden" when
  two share one) with its warbots, then up to two lines: news first for 15 s (a Command Base taken, a surrender, a
  nuclear launch: `watchEvents`), then the busiest colonies, read from the computer's own plans in `js/ai.js` without
  touching them (`rivalPlans`, which the scout reports of your own games read too, put in words by `watchDoing`: `P.stormOn` storming or forming up to storm a Command Base, `P.march` and `P.siegeAt` a
  march and its target, `P.homeCall` under attack at home, Missiles and bombers in flight, `P.raid` a band raiding a
  colony's road, named by its compass point from that colony's Command Base, `P.pushOn` a Warden's big push,
  `P.massFor` massing for a push; when quiet, an opening line for its doctrine or what it has built). The game's own
  messages are for a colony's player ("your Command Base"), so they're dropped. **The camera** (`watchCamera`) glides to
  the busiest fighting (`watchSpot`: warbots in a fight, buildings just hit, shells and missiles landing, in 10-tile
  cells; a spot keeps the camera while it's half as busy as the busiest), else the biggest band on the move, else each
  Command Base in turn; once the map is moved by hand it stays (**Follow the action**, or F, takes it back). The end
  (`watchOver`, from `showGameOver`) says who won and when each colony fell, with **Observe another** (the same setup on a
  new planet) and **Main menu**; `toMenu` ends Observer mode (`watchEnd`).
- **Scout reports** (`js/scout.js`): in your own games (not Colony, not Observer), `scoutTick` (from `uiTick`, once a
  second by the clock) reads each enemy computer rival's plans with `rivalPlans` (the Observer's reading, above) and
  `scoutNews` turns them into news, each with a key: a storm of your (or your ally's) Command Base forming up (and
  `stormgo` as it goes in), a march on one of your forts (`P.siegeAt`'s building), a band raiding your road (named by
  its compass point from your Command Base), massing for a push on one of your forts, a Warden's big push, and a
  rival pulling back to hold its base while 3 of your warbots are within 12 tiles of it; of the other rivals of a
  free-for-all only their storms and marches. A piece of news is told once while it lasts (`SCOUT.news`: it's over
  once it hasn't been seen for `SCOUT_OVER` s), once it has lasted `SCOUT_DELAY` (6 game seconds; a storm going in, 2),
  at least `SCOUT_GAP` (15 s) after the last report, the most important first; massing and pulling back are told again
  after `SCOUT_AGAIN` (300 s) if they go on, and massing is one piece of news however its aim moves between colonies
  (`quiet` while it isn't you). Fair: bands are counted as the map shows them (warbots out in the open, `watchBand`),
  an army's size is "about" (`scoutAbout`, from the warbot count Statistics shows), and the number a rival waits for
  (`P.massFor.need`) is never told. It's a `toast` (Go to the place, kept in the message list) starting "Scouts:".
  **Scout reports: On/Off** in the pause menu, kept on the device (`terrafall.scouts`). Display only.
- **Blueprints** (`js/blueprint.js`): kept on the device (`terrafall.blueprints`, up to `BP_MAX` = 8, newest first,
  each `{ name, b: [[type, dx, dy]...], r: [[dx, dy]...] }` round its middle; `bpList` drops anything damaged). Saving:
  **Build → Blueprints** (`openBlueprints`, the `#build-bp` card shown on every tab) → **New blueprint** enters mode
  `bppick` (`UI.bpPick`: tap your buildings to pick or drop them, a mouse drag boxes several, `onSelectBox`), or with a
  mouse a selection box that catches no warbots but buildings of yours offers the `#bp-offer` chip for 8 s
  (`bpBoxOffer`); `bpFrom` keeps the buildings the Build menu places (and Walls and Gates, up to `BP_PIECES` = 30) and
  your roads, laid or planned, within a tile of them. Named after its commonest building ("Smelter block"); the name
  is edited in the list, and ✕ twice deletes. Placing: mode `bpplace` (`UI.bpPlace`: the ghost starts mid-screen,
  follows the mouse, `bpHover`, or goes where a finger taps; R or **Rotate** turns it, `bpTurn`). `bpEval` checks each
  piece with `canPlace` (and `canRoad` for roads) twice a second or when it moves: red can't go, red and dashed past
  `MAX_SITES` (Walls and Gates don't count), drawn by `drawBlueprint` (called from render.js). **Place here** (or a
  click, or a second tap on the spot: `bpPlaceNow`) sends a `place` order for every building that fits and one
  `paths` order with the new road tiles, then a message says how many went down, how many the site limit held back and
  why the rest couldn't go. No new order.
- **A failed frame never stops the game:** `frame` books the next frame before running this one and catches its errors
  (reported once each to the console), and each stage of a frame (simulation, camera, drawing, interface, sound) runs
  on its own (`stage` in `js/main.js`): one that keeps failing during a game says so once and pauses saving
  (`UI.saveHold`), so the last good save is still there to reload. A Missile Silo's placement preview used to throw (`siloReady` on a stand-in
  with no stock), which stopped the drawing loop: the game froze when you went to place one. An art image that fails
  to download is tried once more a moment later (`loadImg`), and one that still fails draws nothing or the shape drawn
  in code: a missing canyon lip, Viaduct tower, Freight Train wagon or crossing barrier no longer makes the map throw
  (a Rift or Sky islands map could not start).
- **The menu's backdrop:** an AI-vs-AI demo game plays behind the main menu. It opens 150 s into its game, fast-forwarded
  a slice each frame (`DEMO_WARM`, at most `WARM_MS` of a frame, in daylight: `TOD.dayHold`), so the page never waits
  for it at launch or on Save and quit (it ran all 4,500 steps at once: seconds on a phone).
- **Gates on track:** a Gate can stand across railway track (`canPlace`; a wall line crossing track puts one there,
  `wallKind`), and track can be laid through your own Gate (`railBlocked`). Your trains run straight through it (rail
  routes ignore it; it's `passTile` for its owner); enemy robots can't walk through.
- **Wall to Gate:** a built Wall's panel has **Make it a Gate** (`wallToGate`): it becomes a Gate where it stands, for
  the difference in cost (1 Cement and 2 Alloy, `gateUpgradeCost`, paid from storage), keeping its share of armor.
- **Through traffic:** an Outpost or Gate a road runs through counts as the best road leading into it, never worn
  (`throughPave`), for speed and route planning, so it never slows the traffic going through: asphalt on either side
  makes it asphalt (Freight Trucks and Road Trains keep their speed).
- **Crates and loot:** goods inside any building that's wrecked, blown up, lost or demolished spill out as a crate
  pile on its tile (`dropLoot`, called by `destroyBuilding`; up to `LOOT_MAX`), and a robot destroyed with a load
  drops it (`dropCarried`). On a player's own land its Haulers (a Freight Truck for a big pile; workers with no
  Haulers) collect piles and take them to storage (`dispatch` step 4d, `doCrate`) while no enemy robot or gun is
  within `CRATE_SAFE` tiles (`foesNear`). Idle or victorious warbots nearby carry one crate each to their side's
  nearest garrison and go back for more (`doLoot`). Crates left at an Outpost (`b.loot`) are hauled on to storage.
  Piles on claimed land stay; on no-one's land they rot after `LOOT_TIME`. Claims on a pile are recounted from the
  bots' tasks every second (`updateLoot`), so a run called off never leaves a pile looking taken.
- **Walls and Gates (Versus):** in Paths, **Walls** (**X**) sketches a wall line: a Wall on each tile (5 Cement, 40
  armor) and a Gate where it crosses a road (6 Cement + 2 Alloy, 32 armor; tap a planned Wall to make it a Gate).
  They're `prepaid` (paid from storage on Build, no Hauler or road, outside the site limit). Walls block every bot;
  Gates let their owner's bots and road through (`passTile(t, who)`). Armed enemy warbots plan through a Wall or
  Gate as if it were `BREACH_COST + armor` tiles long, so they go round a short way or stop and shoot through
  (`breachHit`); a bot whose route gets walled off re-plans (`blockedStep`). An order whose squad can't shoot
  through the walls on its routes says so to the player who gave it (`squadBreach`, `breachCheck`: the armor to shoot
  away against what the squad carries, `breachShots`, counting one reload near the wall for an attack, see
  `startReload`; a Bulwark never runs dry); the rival can ask before it orders (`attackBreach(owner, target, count, all)`
  gives `{ need, shots, sent }`), and `sendToRally` returns it as `breach`. On Chokepoint maps the AI walls the mouth
  of each channel on its side on every difficulty but Easy (a Warden on Easy too: `aiWalls`). Its Gate goes on a mouth
  tile its bots can walk to from the Command Base without going through another mouth, and get on from to the middle
  of the map with Walls on the rest (`aiWallGate`, walking the ground with `aiFlood`): an existing Gate, its road
  through, or the middle tile and outwards. The middle tile (or the road) could be a spur beside the one tile that
  leads on, and the Wall there shut the colony's own warbots in. A mouth no Gate keeps open is left unwalled, and a
  Wall of its own that shuts one (an older save) comes down; mouths with every piece up are looked at again every 30 s
  (`P.gateChk`).
- **Garrisons and posts** (yours, `usesPosts`; the AI spreads its own to the front as before): every warbot belongs
  somewhere. `u.post` is the Outpost or Bunker it was stationed at; with none it belongs to the Command Base. All your
  warbots stay at the Command Base until you station some: tap an Outpost and **Station here** (how many; from the
  Command Base first, `stationSources`), select warbots and order them in (`orderStation`), or set the Outpost's
  **Keep** (`keepAt`; 0 unless set, per garrison `b.keepW` Auto/0/1/2/4 or for every Outpost in the Army banner
  `P.keepW`): `stockPost` keeps that many posted there, sent from the Command Base and replaced when lost. Wherever a
  warbot goes (a sortie, a rally flag, an attack, repairs, a loot run), it comes back to its post (`goGarrison`).
  Attacks, rally flags and beach landings draw first on the Command Base (which keeps its own Keep, 1), then on warbots
  stationed at Outposts, nearest first (`spareArmed`/`takeArmed` with `posted`): they go, and come back to their post
  when recalled; their Outpost isn't restocked while they're out (`postedAt` counts them). They sortie to defend their
  own Outpost too. Only stocking another garrison (Station here, Keep) leaves stationed warbots where they are
  (`freeToGo`). A Wall standing alone is drawn as a full section with a pillar at each end, across whatever it plugs
  (`drawBarrierArt`). **Send them back to the Command Base** (`unstation`) releases an
  Outpost's warbots and sets its Keep to 0. A Bunker always keeps its two (stocked the same way). **Your robots** (the
  population chip) lists where your warbots are (`warbotGroups`: at the Command Base, in Outposts, heading home,
  attacking, on a rally flag, guarding, being repaired, carrying loot, or standing with nowhere to go), and **Show**
  takes you to each in turn. Garrison priority (High/Low) still orders the AI's and any warbot with nowhere else to go. A garrison's panel shows how
  many are inside and what kinds (`garrisonMix`: "3 Warbots, 1 Bulwark, 1 Torch").
- **Guards** (`garrisonDefense`): enemy warbots near a garrison bring out one more guard than there are of them, and
  the guards fight foes within `SORTIE_REACH` (6.5) of it. A guard lets a foe go (and leaves it alone 12 s) once it's
  more than `SORTIE_LEASH` (9) tiles from the fort and out of the guard's reach, so a passer-by can't lead the guards
  off into its own side's guns. A fort with no enemy at its own walls also answers for the buildings round it: where
  enemy warbots (or creatures) are hitting one of its owner's buildings within `AREA_DEFENCE` (14) tiles
  (`P.raided`, set in `hitBuilding`), it sends one guard more than there are raiders, never its last armed warbot
  (`task.ax`/`ay`: the guards' leash is measured from there, the spot follows the raid, and they go home after
  `AREA_QUIET` (6) quiet seconds). A squad on a rally flag outside rival land guards the ground round it the same
  way (foes within 6.5 tiles of the flag, leash 9).
- **Rival doctrines** (the lore's command doctrines, LORE.md; `PERSONALITIES` in `js/defs.js`, each player's `style`,
  applied by `aiStyle`/`aiLevel` in `js/ai.js`; the keys stay the old style words): each scales the difficulty's grace
  period, attack threshold, army growth and raid rate (the attack threshold stays between 3 and `AI_THRESHOLD_MAX`, 9:
  an Easy Warden's came to 11, more than its army ever grew to). The **Steward** (`balanced`) is the plain AI. The **Warden** (`turtle`):
  later and bigger attacks, rare raids, a square ring of Walls and Gates six tiles round its Command Base
  (`aiTurtleWalls`) and a turret more every four minutes (up to six). It marches only in one big push (`aiPush`,
  `push`): before 22 minutes (`AI_PUSH_AT`) only with twice its attack threshold and half as many again as its rival's
  army and two more; from then on with its threshold and two more than its rival's (after a push, as many as that push
  took less two). For four minutes (`P.pushOn`) its home guard is two, its Keeps hold two and its Outposts none, and the
  march takes all it can gather, its threshold at least; never while its base is threatened, and until its push it
  keeps a third of its army at home (see the home guard below). (It used to march in a quarter of its games, half an
  hour in, with a third of its army kept back.) Every doctrine fortifies (`AI_FORT`, `aiFort`):
  up to `turrets` Pulse Turrets, one more every `every` seconds (round the Command Base on the side facing the rival,
  spread apart), a Minigun Nest or Bunker by its fort nearest the rival every six minutes from about ten minutes in (up to
  `front`, through `P.defWant`), and with chance `walls` (decided once a game from the seed) an arc of Wall seven tiles
  out on the side facing the rival, two pieces every 30 s from nine minutes, up to 16 (`aiFortWalls`); Easy halves it all.
  Opening fixes: a Harvester down to its last couple of stalks it can cut (ripe, on its own side, out of enemy guns:
  `aiGathers`) doesn't count as cutting, and with none cutting and none
  on the way a new one goes up past the usual limit on sites (Alloy-starved sites could otherwise hold every slot while
  the Smelters wait for Fiber); a new gatherer's spot is scored by what it could really work there (`aiUsableRes`: not a
  rival's groves across the border, nor ground under enemy guns, and a grove still growing at half), where it used to
  go up beside the other colony's grove and cut next to nothing; and until its first Bot Foundry has its Alloy, the Ammo Plant and (with Chips enough for
  the Foundry) the Chip Fab rest, so they don't eat the Alloy the Foundry needs (`forFoundry`). With no stalks left to
  cut and Fiber under 6, groves come first (`groveFirst`): a Bio Farm gives its Agribot to a Grove Planter (placed by a
  Harvester, or else near home) until a Harvester has stalks again, since without Fiber there's no Alloy for another
  Agribot. Bio Farms go by the patch (`aiFarmClaims`, `aiFarmSoil`): each of its farms claims the nearest
  `AI_FARM_TILES` (5) fertile tiles it can farm, a new farm counts only the tiles none claims, a site with fewer than
  `AI_FARM_MIN` (3) isn't used, and the best unworked patch wins (so one farm a patch, two on a big one; before, farms
  crowded onto small patches, several sharing three or four tiles). Fuel first too: with Fuel under 6 for half a minute (`P.fuelLow`) a Bio Farm goes first (never while one
  waits for its Agribot; at most two plus one for every 15 robots), an Oil Pump once the Bot Foundry is up (oil costs
  Alloy), and a Refinery for a pump that has none; without it the Fuel Stations went dry around minute 10 and the
  workers crawled, which in turn starved the Fiber, Ore and Alloy. Low for `AI_FUEL_DRY` (60 s) with no Bio Farm that
  has soil and no Refinery with a working pump (`aiFuelSource`), it is dry (`P.fuelDry`): at its Trade Terminal it
  takes the steep Fuel contract (after a Crystal one, before Chips), and dry for `AI_FUEL_TRADE` (3 minutes) it docks a
  Terminal for it, from 10 minutes. Down to fewer than `AI_FEW` (8) workers after the first
  minute (a raid got the rest), it triages until it has as many as its staffed buildings want and two more
  (`AI_ENOUGH` 10 at least, `AI_PLENTY` 16 at most): its open sites are called off and only a missing link of the
  chain that makes bots (`AI_CHAIN`) is started, every staffed building rests but the links the next robot waits for
  (the Foundry while it has a part of each kind, or always with more than three workers; the Chip Fab while Chips are
  short; the Smelter while Alloy is short; a Mine while Alloy and Ore both are; and a gatherer short of its good), so
  the few workers go down the chain to the link that can work, and the Foundry makes workers alone, a Hauler first
  when it has none and three workers (`P.triage`). With no Hauler left, one worker stays free to carry, and a link
  that holds a round of its inputs, with room for what it makes (`hasRound`), takes even that one until the round
  is used (`dispatch`). Without it a colony left with one to three workers carried, or ran a Smelter piling up Alloy
  with no Chips, and never made another. At the bot limit (90 in Versus) it
  keeps room for the army it wants (`aiWantArmy`, but no more than `AI_ARMY_ROOM`, two fifths of the limit): workers
  stop where they would eat into that room, the Foundry makes warbots, and Haulers, trucks and other helpers aren't
  ordered (but a first Tanker); warbots past what it wants leave `AI_WORKER_ROOM` (6) places for workers. Without it a
  colony that had taken a lot of buildings made workers to staff them all until the limit was full, and never fielded
  an army again (a 2 v 2 game ran past an hour). With less room than that army wants (and outside Colony), it scraps
  its extras (`AI_SCRAP`): Workers past the ones its buildings call for and 4 more, then Haulers past the ones it wants
  and 2 more (4 at least), go to its Foundry to be recycled (`recycleSpare`), at most 4 on their way at once, until the
  room is there; its Foundry fills it with warbots. **Crystal** (every robot takes a Chip, every Chip a Crystal) runs short
  by how long what's left would last, in stock and in the ground on its land, at the rate its Chip Fabs burn it
  (`goodRates`; under `AI_CRYSTAL_MINS`, 10 minutes, counting at least `AI_CRYSTAL_BURN`, 4 a minute, once it has a
  Foundry), not only by the clusters left (`P.short`, by tiles, came only once the last three were all there was,
  too late to do anything). Short, with Crystal no-one holds within `AI_CRYSTAL_REACH` (20) tiles of a fort of its own
  on the same ground, its Outposts head for it (the nearest pulls the next one its way); forts holding Crystal are worth more to attack
  (`crystalHeld`); it docks a Trade Terminal from 10 minutes (`AI_CRYSTAL_TRADE_AT`), past the usual limit on sites,
  and orders the Road Train for it straight away (it takes four Chips: once the Crystal had gone there were none left
  to make it). Running low (`P.crLow`: short, or under 10 in stock with the Taps bringing in less than the Fabs use),
  it puts up Crystal Taps first wherever clusters are left on its land, up to `AI_CRYSTAL_TAPS` (4), even with every
  worker busy, and they get a worker first; its Smelters rest while it holds `AI_ALLOY_PILE` (40) Alloy, until it's
  down to half (`b.alloyRest`: Alloy can't be sold, so the Ore and Fiber they'd burn go to the Terminal instead, and
  their workers to the Taps); and at the Terminal (`aiTrade`) a contract that brings Crystal, or else Chips, comes
  first, it never gives Crystal away, and a contract under way that brings neither is given up for one. Its Terminal's
  contracts are made for it the same way (`tradeShortest`: Crystal, then Chips, count as what it's shortest of while it
  runs low, whatever lies in the ground on its land, which can be land out by the enemy's guns it can't work: a set of
  contracts with neither had left one starving for ten minutes). Any contract
  with no lot sold for `AI_TRADE_STALL` (5 minutes) is dropped for another. Before, in long 2 v 2 games the colony
  left on the losing side took Alloy for Stone while its Foundry stood idle for want of Chips, Alloy piling up, and the
  game ran to an hour. Its Missile Factory and Silos come
  only through `aiMissilePlan` (not the plain build plan, where a Hard rival put a factory up four minutes in), one
  site at a time, and the factory rests while no built Silo has room for another Missile. It walks its best spots for a
  gatherer (`walkRes`: only nodes within three times the reach on foot count), so it never puts a Harvester at the foot
  of a cliff below groves fifty tiles away by the ramp. Its forts (`rearGarrison`): one counts as behind the
  lines, free to send its last warbot on a march, when no rival building is within 18 tiles, or when every one that
  near has another fort of ours, with someone in it, at least 4 tiles nearer to it. Its Viaducts (Sky islands): not
  into the enemy's guns, nor for four minutes where one was just knocked down (`P.viaLost`). Under an enemy gun
  (`aiClearGuns`): a factory, gatherer or Fuel Station a gun has covered for over a minute doesn't count in its build
  plan (`aiShut`), so another goes up out of reach. It sends a squad that can win (`aiGunNeed`), and a new one only when
  it can win with half of those still at the gun counted, never a few at a time into one being shot down (before, two
  went to join one left of a squad the gun had cut down). When the gun has stood for two and a half minutes with no new
  warbot for two (the gun may be over the Chip Fab the Foundry needs), every warbot goes, the Command Base's last one
  too (`attackAvailable(p, t, 'every')`), if that gives it a real chance (enough but for the margin of one), or its Bot
  Foundry is shut down anyway (none at work: it's that or nothing).
  **Attacks into defences** (`aiGuards`, `aiFire`, `guardsNear`, `aiSpare`, `aiSquad`): before any attack the rival
  counts, in warbots, the defences that would fire on the squad at its target (their reach plus two tiles): a Pulse Turret
  or Mortar Pit 3 (a Mortar's shells burst among a squad bunched on its way in), a Minigun Nest or Disruptor Tower 2, a
  Bunker 2 for each armed warbot in it, a Keep 3 and 1.3 for each manned gun slot and 1 for each warbot past them (they
  come out), a quarter more for a defence in a Keep's aura, the armed warbots of any other garrison close enough to
  sortie, and its owner's armed warbots in the field within 7 (not a Flak Gun, nor a gun that is cut off or switched
  off; a gun out of ammo still counts). A Bulwark at the head of the squad takes `AI_SHIELD_TAKES` (2.25, about a Pulse
  Turret; never more than three quarters of a gun) off the strongest gun firing straight at it (not a Mortar's shells or
  a Disruptor's pulse); the rival's Bulwarks, then Torches, leave a garrison first (`lead` on `sendAttack` and
  `sendToRally`, see `takeArmed`). A construction site or a fort shot down to a quarter of its armor takes the usual
  band (2, or the threshold) or one more than its guards; anything else its garrison ×1.3 + 2 + its guards; a gun its
  own fire too (`aiGunNeed`); never fewer than the threshold for a finished building; and with guards worth
  `AI_HEAVY` (5) or more and no Bulwark in the squad, a third more (`aiBare`: fire from several sides adds up faster than
  the count says). So clearing a lone Minigun Nest over its buildings takes 3 warbots, or a Bulwark and 1; a building
  beside a nest and a Pulse Turret takes 10 (5 with a Bulwark). With the squad for
  it, an attack on a building a gun covers goes at the gun first (`aiFirstGun`): warbots on an attack shoot back only at
  robots, so sent at the building they stood hitting it while the gun shot them down; and the squad on a flag it plants
  (a march, a flag beside a gun it is clearing, an Uplink jam) goes for the gun covering the flag first (`r.first`, see
  `holdRally`), then on as usual. Without, it attacks what it can take
  (an unguarded target scores a little higher), or waits and gathers: the best target the guns held back is marked
  (`P.soften`) for its Howitzers (`P.siegeAt`), its Missiles (+6) and its bomber, and the Foundry orders a Bulwark if it
  has none (`P.shieldWant`, whatever the size of its army). Marches (more for the guns at the flag), Howitzer hunts
  (none until there are enough for the guns round it), Uplink jams (five and the guns) and beach landings (not onto a
  beach covered by more than the boatload less two) count them the same way. Measured in the sim on open ground: two
  warbots beat a lone nest with the lead at 5 of 12 health, a Bulwark and a warbot kill it in about 14 s untouched;
  two warbots die to a Pulse Turret, three sent at the building beside one all die, three at the turret lose one.
  **Marches, storms and the home guard** (Medium and up; `aiMarch`, `aiStorm`, `aiStage`, `aiBattles`): nothing goes
  for five minutes within 8 tiles of where an attack or march lost more than half its warbots, unless half as many
  again go (`P.fights`, `P.beaten`); an attack whose squad couldn't shoot through the walls on its way (`attackBreach`)
  isn't sent, nor tried there again for a minute (every level). With nothing in reach, a big army (twice the attack
  threshold) marches on the enemy fort that takes the fewest to beat (`aiTakeNeed`: what an attack on it counts, and
  never less than the plain march, twice the threshold and the guns at the flag; plus 0.15 a tile from home), with that
  many and two more (14 to 22), Bulwarks at its head and at the gun covering the flag first (`r.first`); with fewer it
  masses: the army target rises (`P.massFor`, `aiWantArmy`), its Outposts with no enemy near keep no warbot back
  (`keepW` 0), the spot is softened (`P.soften`) and a Bulwark ordered (`P.shieldWant`), until it marches. With a
  decisive lead (half as many again as the enemy's army, and four more) the next march is a storm of the enemy Command
  Base (`P.stormOn`): up to 30 warbots form up under a flag about 9 tiles out, on the side it comes from, where the
  fewest enemy guns reach with three tiles to spare (`aiStage`, on `DANGER.guns`); once three in five stand there the
  flag moves beside the base and they go in at the gun covering it first (`r.first`, the next one as each falls), then
  the base. It masses for it up to four minutes (`P.stormT`) and calls it off when under two in five are left armed.
  Against a crushed rival (twice its army and two more) it storms however the base's guns count, once it can gather
  twice the enemy's whole army and two more, 8 at least, and three in five of its own armed army outside Bunkers (or
  the full count, if that is less); with three times the enemy's army and four more it masses for that and marches on
  nothing else meanwhile. An Easy rival marches as the plain rule says, and in an Uplinks game the forts holding the
  enemy's Uplinks still come first. The home guard (`P.homeGuard`, through `keepAt` and `homeGuarded`): while four or
  more enemy warbots stand within 12 tiles of its base, or the base was hit in the last half minute (`P.homeCall`),
  about a third of its army (2 to 8) stays in its Command Base and up to 3 in each Keep, out of every attack, raid and
  march, the rear's too, and new and idle warbots go there first (`goGarrison`); otherwise 2, and the usual one when no
  enemy army can walk to its base (on an island). A Salvager keeps the usual one, threatened or not (its doctrine's
  thin home guard: with two its first raid waited for a fifth warbot, four minutes late). With twice its rivals' warbots and two more its Outposts keep none
  back. A Normal or Hard rival (a Warden on any level) answers an army parked on its land, or within 14 tiles of its
  Command Base, with a Mortar Pit: four or more enemy warbots there, while no other defence is on order, put one by its
  fort nearest them, 7 to 10 tiles from where they stand (`P.defWant.ax`/`ay`, see `aiSearchSpot`), up to three, one at
  most every three minutes (`P.parkAt`). It remembers where its civilians were shot down (`noteDanger`, `P.danger`):
  for 3 minutes, 3 more for each further death within 3 tiles, up to 15, its workers neither build, mend nor pave
  within `DANGER_R` (4) tiles of the spot (or of where the one shot was going) and it puts no site there (`dangerAt`).
  The danger map sees the guns that can fire now; this sees one that fires now and then, such as a Pulse Turret out of
  the map while it waits for its next Crystal. Nor does it build for five minutes within 4 tiles of where a building
  or site of its own was destroyed by force (`destroyBuilding` adds a `P.avoid` entry with `r2` 16).
  Once it's ready to march it orders a Bulwark for every five warbots (two, three against a dug-in rival) and a Torch
  for every four (three, four), only with Fuel for Torches. The **Salvager** (`raider`): raids three times as often from early on,
  keeping none back: its band of three (`raidSize`) goes as soon as it has three to send (`raidKeep` 0), and may take a
  rear fort's last warbot. Its raids (`harass`) go for the busiest road by the most of its rival's working buildings
  (half as much again for each within 3 tiles, up to four), clear of every manned fort by 10 tiles and of the rival's
  warbots in the field by 8, and the band forms up on the way out of the rival's land (`aiRaidStage`: the first tile back
  toward home 4 tiles clear of it, `P.raid.to`) before its flag moves on to the road, so the rival's warbots aren't
  waiting there (they answer a flag on their land). Its attacks put a working building, Fuel Station or Depot that
  little guards ahead of a fort. The **Herald** (`rusher`): the fastest-growing army, raids now and then, few turrets. The **Architect** (`tycoon`): its bots work 15%
  faster (`econ`), it builds extra Smelters and Chip Fabs (and a second Crystal Tap) and goes for Missile Silos (up to
  three) once its Bot Foundry runs: its programme (`aiMissilePlan`) starts from ten minutes once it has two warbots
  more than its rival (five at least) and two workers to spare; the Missile Factory and then each Silo (the next once
  the ones it has hold a Missile each) go down as soon as the Cement is there, one past its site limit, its first Ammo
  Plant and turret still going ahead; its Bot Foundry rests for them only while it has three warbots more than its
  rival, the factory rests while no Silo has room or its army is more than two behind its rival's, and from
  `AI_ALL_IN` (28 minutes) it rests for good. Its Silos stand back from the border, nearest home with six of its
  rival's buildings in reach (`aiSearchSpot`). On Normal and Hard its Missiles go at what its rival lives on
  (`aiMissileWorth`, by `AI_BOMB_VALUE`), then any other working building, and at a fort only when its warbots in reach
  could follow; nothing worth less, a Wall say, gets one. Under siege (`P.homeCall`) the doctrines answer in their own
  ways: a Salvager raids at once, a Warden starts no push, and an Architect on Normal or Hard fires its Missiles into the
  biggest knot of enemy warbots within 12 tiles of its Command Base (`aiMissileKnot`). The new-game screen's **Rival doctrine** chips set every computer player's (`UI.menu.style`: 0 Random, then
  `PERSONALITY_ORDER`); with three or four players **Each rival** (a dropdown per colour) sets each computer player's own
  (`UI.menu.styles`, by player slot 0 to 3, null: as the chips), and in multiplayer the host picks each computer place's
  in the lobby (sent round with the settings as `styles`, by player slot, so a choice stays with its colony when people
  come and go or the teams change, and every device deals the same; the lobby lists exactly the places the game will
  have, `mpCpuSlots`: people away at the start get none). `newGame` takes `styles`, one per computer player in player
  order (`mpOnStart` turns the lobby's by-slot list into that), over `style` (all of them); Random deals one no other
  computer player has, picked from the seed after the named ones are taken out. Saves keep each player's `style`. Each
  doctrine's `quote`, `play` (what it builds first, when and how it attacks, how it defends: what headless games on
  Normal show, not the earliest the code allows, since a rival only attacks what it outnumbers) and `weak` are the
  setup's in-depth description (`docInfo`/`docHTML`). With a mouse, pointing at a doctrine (or focusing it) shows it in
  the line under the doctrines, which keeps the height of the longest so nothing moves. On a touch screen (`canHover`)
  the line is a sentence (`docShortHTML`) with **How it plays** until a tap opens the whole of it, and nothing is held for
  it; while the rivals have doctrines of their own, a first tap on a chip only shows it (`UI.docPeek`, a dashed chip) and
  a second gives it to them all. The lobby's line (`mpDocNote`) is shorter still, a few words per doctrine (`tag`), with
  How it plays for the rest: with a mouse it is always there and sized to the longest; on a touch screen it opens with a
  tap on a row and closes with another. Missions use the Steward unless they name one (Hold the Line's Herald, Siege Breakers' Warden). The
  briefing (`doctrineLines`, multiplayer too), the rival Command Base's panel and the Boosts menu name it, as
  "Warden (turtle)" (`docLabel`).
  A mission's scripted rival (`P.bold`: Hold the Line's Herald, which also lands with a Bulwark) makes its assault
  whatever the guns: that mission is about holding it.
- **The rival's economy** (`aiThink` in `js/ai.js`): on every difficulty its Smelters rest while Fiber is nearly gone
  and a site is short of it, or while a building it wants can't be started for lack of it (`P.fiberWait`): a busy
  Smelter used to burn every Fiber the Harvesters cut, and nothing that costs Fiber could go up. A site no road reaches
  yet doesn't count (it can't take any), and with no Harvester cutting they start again once there are 6 Fiber and
  nothing waits for it, where they used to stay off while the Fiber a cut-out grove still gave piled up. On Medium,
  Normal and Hard (`smart`; an Easy rival keeps the old habits) its Depots out toward the front (12 tiles or more from
  the Command Base) keep Cement and Ammo and take in no Ore, Crystal, Stone or Fiber (`reject`): a Depot among the far
  Mines used to collect their whole output, a long run from the Smelters waiting for it. Its Bot Foundry rests to save
  for a Missile Factory or Silo (`aiMissilePlan`) only while the army isn't well behind and the colony has the workers
  and the Haulers its buildings call for (an Architect by its rival's army: see Rival doctrines): with the army alone to
  go by, it stood off up to two fifths of a war game while buildings waited for workers. A rival with one site at a time
  (Easy) puts the plan's opening, up to its first Bot Foundry (`AI_OPENING`), ahead of every other ask from six minutes
  in (`AI_EASY_OPENING`) until its Foundry is under way: expansion Outposts, a spare gatherer and the Ammo Plant used
  to take its only slot first, the Outposts then waited minutes for their roads, and most Easy rivals never built a
  Smelter or a robot. (Its first minutes go as before, so it still opens slower than a Normal rival.) On every
  difficulty, once its Bot Foundry stands, with no Mine (or no Crystal Tap) at work, none on the way and under 4 Ore
  (or Crystal) in store, one goes up first, past the usual limit on sites (`starved`): a gatherer counts as at work
  while it has a node it can go to, on no rival's land and out of enemy guns (`aiGathers`), and a site as on the way
  for 150 s or once a road reaches it. Sites stuck where its robots won't go (their road through ground where they were
  shot, see `noteDanger`) used to hold every place while the last field ran dry, and two rivals could sit at 0 Chips
  with a few warbots each for 20 minutes.
- **The rival's roads and Ramps** (`aiRoads`, `aiRampCut` in `js/ai.js`): where its road to a site would run the long
  way round a one-level cliff (8 tiles or more), or no slope leads there at all, it cuts up to two Ramps instead, as
  Route to does in Paths, when that way (each Ramp counted as 6 tiles) is at most 60% of the long road and 6 tiles
  shorter. The site's road waits for the Ramps (`P.rampWait`, 3 minutes at most) and then takes the short way. It
  cuts none for a Ramp, and none onto its own plateau or mesa home (`fortressHome`). It used to run a road forty
  tiles round a low cliff to a site eight tiles away, and gave up sites no slope led to.
- **The story** (LORE.md is canon; text and presentation only, nothing in it changes a rule). **Callsigns**
  (`CALLSIGNS`, `callsign(p, colour)`): players are named COBALT (player 0, blue), VERMILION (red), VIRIDIAN (green) and
  TYRIAN (purple) wherever the game used to say "the Red rival" (`playerName`: 'You', a person's name in multiplayer,
  'VERMILION (ally)' for a team-mate, 'Murmur' for the Colony wildlife slot), with the colour where it helps find them
  ("VERMILION (red) to the north"); the setup's Each rival dropdowns and the lobby's computer places are named so too.
  **The narrator** (`NARRATOR`, `narrate(p, key, x, y, every)` in `js/world.js`): your Command AI's dry lines, as toasts
  of kind `narr` (italic, a grey edge): the first road (`layRoad`), the first nightfall (`nightfallLine`, UI-side, with
  the day/night cycle on), the first Uplink taken, a rival Command Base captured (or one changing hands between two
  others), and the landing line on the briefing card (`landingLog`: "Terrafall complete... Landing site: the Rust.")
  and the end screen's last line (`#o-log`: the region secured, or lost on the Uplinks, "another colony speaks for Ithaca
  I", or on land, "settlement priority lost"), and the *Wren*'s arrival, each visit. **Doctrine voices** (`PERSONALITIES[k].voice`, `doctrineVoice(p, to, what)`):
  a computer rival speaks to the colony it hits, under its callsign, as toasts of kind `voice`, after the alert it goes
  with: when its warbots or raiders hit you (at most every 4 minutes each), when it fires a Missile at you (every 90 s)
  or a nuke your way (every launch: a key of its own), and when it surrenders; the Warden counts the days (`wardenDay`). Lines are picked by `hash2` of the time and the
  players, never the game's RNG; what has been said is kept in `S.lore` (saved with the game, left out of `hashState`),
  so nothing here can split a multiplayer game. A save from before the narrator gets `S.lore` filled in on loading (the
  first road, Uplink and nightfall already said), the first nightfall is only said in the first game day, and a
  multiplayer resync keeps this device's own nightfall key. Never in missions (`loreDue`), which keep their own texts
  (the *Wren*'s arrival line included). A story toast never counts towards the toast limit or pushes a warning out: it
  goes in under a newer warning (a phone on its side shows only the newest) and gives way only to a newer story line,
  the lines of one moment (a surrender's last words and the narrator's line after them) staying together.
  **Regions** (`BIOMES[k].region`, `regionName`): the Rust, Greenreach, the White, Emberwood, the Long Grass, the Sump,
  Cinderlands and the Bloom, regions of Ithaca I, and Argos, its moon (Lunar), as flavour only (briefing, landing message, loading lines): the
  setup keeps the plain biome names. **Panel flavour** (`FLAVOR`, `flavorLine`): one quiet italic line at the foot of
  every building's and robot's panel (and the Trade Post's and Uplink's), below every button; the Command Base's is its
  Arrival clock (`ARRIVAL_CLOCK`), shown under its name. **Loading lines** (`SPLASH_LINES`, picked at first paint by an
  inline script in `index.html`, which keeps its own copy): one under the splash bar, which now stays about 2 s.
  **The Lore guide** (`#screen-lore`, `openLore`/`closeLore`/`initLore` in `js/ui.js`): the small **Lore** pill at the
  end of the main menu's links (beside **Feedback**) opens the colony's archive, LORE.md told in ten pages (Terrafall, The Arrival clock,
  Ithaca I, The regions, The four vanguards, The doctrines, Neutral ground, The Murmur, Accord standards, Your colony),
  in the archive's own voice: Earth's fate is never stated, only hinted (an unreviewed second reading of "terrafall",
  "no ark construction update on file after T−14", the *Wren*'s waystation last answering at T−2). It pages like the How
  to play, on the same code (`pagerInit`/`pagerShow`, `HELP_PAGER` and `LORE_PAGER`): it opens on its first page, which
  lists the rest; a picker stays on top, Previous / Next end each page, ← → turn them; Esc, Back or a phone's Back
  closes it (opening adds a history entry; closing takes it back). Its pictures are `data-src` until it first opens,
  then all fetched at once, so the service worker keeps them for offline play, and `tools/build-single.js` puts them in a
  bundle beside the page (`dist/lore.js`, fetched when the guide first opens, so the page stays under 16 MB):
  `art/lore/ithaca.webp` (Ithaca I from orbit, the Ring, Argos and Corvane: `renderer/b/lore_planet.js` and
  `renderer/post/lore_planet.py`), `art/lore/region-<biome>.webp` (each region's ground, shot from the game),
  `art/lore/murmur-<class>.webp` (the direction-B mole renders at night, `renderer/b/murmur_moles.js` with `hero=1`: to
  be replaced when the Murmur are reworked to LORE.md's art brief), and the game's own Command Base, Trade Post, Uplink
  and *Wren* art. The Ithaca I page's catalog plate and the callsign emblems are inline SVG. Only the Scuttler and the
  Brute are met in the game so far, so the Leech, Spitter and Delver are on file as "sighted".
- **The Murmur** (players' name for the wildlife: Colony; `WILD` in `js/defs.js`, `updateNest`/`updateCritter` in `js/sim.js`; the
  new-game option "The Murmur", on by default; in missions only where one switches it on, `wildlife: true`, as The Murmur (id `bughunt`)
  does). **None on a silent biome** (`BIOMES.lunar.silent`, `murmurGround`): on Lunar, Argos the moon, `newGame`
  never sets `S.wildlife`, a mission's `wildlife` is ignored and `placeNests` places nothing, so there are no nests and
  no raids in any mode; the setup's switch is off and greyed there (the saved setting is kept for other biomes), and an
  old Lunar save that has nests keeps them. Internally the creatures are still `wildlife`, the nests type `'nest'`;
  players see "the Murmur", "Murmur nest", Scuttler and Brute. One nest per `WILD.perTiles` tiles (3–8), owned by `WILD_OWNER` (the empty
  second player slot of a Colony game), at least 16 tiles from the landing site and reachable on foot. Each keeps
  `guards + level` Scuttlers on guard and from `WILD.first` (7 min) sends a pack every 260–400 s at the nearest building,
  road or bot the colony has within `WILD.reach` (24) tiles: Scuttlers (6 hp, bite 1) go for bots in the open (once there,
  any within `WILD.hunt`, 6, tiles they can walk to; with none, they move on); Brutes (24 hp,
  bite 3; from level 2) tear up roads and batter buildings (never below 1 armor; construction sites are wrecked) and
  break through Walls and Gates, slowly (`WILD.wallBite`, a third of a bite: about 40 s for one Brute on a Wall). Nests grow a
  level every `WILD.grow` s (to 3); packs grow with the colony (`perBuildings`). Turrets, garrisons and warbots treat
  creatures as enemies; warbots clear a nest (`clearNest`: its hoard spills as loot, its creatures scatter). Nothing can be
  built within `WILD.clear` tiles of one.
- **Research** (Colony; `TECHS` in `js/defs.js`, `startResearch`/`updateLab` in `js/sim.js`): a Research Lab (staffed)
  researches one upgrade at a time, cost paid on start (Cancel refunds), progress `dt × mult` per staffed Lab. Upgrades:
  Cargo Racks (`botCarry`), Long-life Cells (`drainMul`, and chargers 50% faster; the old Fast Charging upgrade is folded into it), Rapid Paving, Sentry Optics (`turretRange`,
  `shotsPer`), Turbo Motors (`speedMul`), Power Tools (`mult` × 1.15), Nanite Repair (`naniteRepair`).
- **Planetary events** (`EVENTS` in `js/defs.js`, `updateEvents` in `js/sim.js`; new-game option; in missions only with
  `events: true`, as in Trade Winds, whose setup brings the first one forward with `S.nextEvent`): the
  first after 8 minutes, then one every 5–8 minutes, never one of the last two again, most with a 20 s warning. **Dust
  storm**: bots at `DUST_SPEED` (⅔) and every missile grounded (`missileBlocked`, `nukeBlocked`). **Ringfall** (a meteor
  shower, pieces of the planet's Ring; type `'meteor'`):
  `METEOR_HITS` strikes on each colony's share (mirrored with two players, turned with three: `meteorPlan`), each
  cratering roads (re-planned at once if the Cement allows), denting buildings and bots (never below 1 armor) and
  leaving a rich Ore or Crystal deposit (Uranium sometimes in a Nuclear race); it ends "Ringfall over. Fresh Ore and
  Crystal in the strike zones. Listen for the Murmur." (its last words only where the Murmur are in the game: Colony
  with them on, never on Lunar). **Solar flare**: battery drain ×
  `FLARE_DRAIN` (2). **The *Wren*** (the trader ship, type `'trader'`; its card shows the name in italics,
  `EVENTS.trader.html`, and one of its 31-year-old cargo lists, `WREN_CARGO` by the event's number): 75 s; offers the raw good that runs out (Ore, Crystal, Stone or Crude: the one
  lowest in stock plus deposits left on your land, `TRADE_GET`/`TRADE_LEFT`) for a good you hold well over
  `TRADE_KEEP` of (never Chips, Ammo or Missiles) at `TRADE_BONUS` (1.3×) its worth; the AI takes its deal when short.
  An event card under the top bar shows it with a countdown and the Trade button.
- **Missiles** are built at a Missile Factory (2 Alloy, 1 Chip and 1 Fuel each, 20 seconds) and carried to Missile Silos
  by haulers. A hit does 24 damage, which wrecks most buildings outright, plus 5 to other rival buildings and 9 to bots
  within 2.2 tiles. Only a Command Base or Keep (`captureOnly`) drops no lower than `MISSILE_FLOOR` (35%) of its armor, from Missiles, bombs or rockets alike; warbots have to capture those. Everything else, Outposts and Bunkers included, can be knocked out, and a wrecked fort's garrison walks out alive (`releaseBotsFrom`; a nuke kills it first). A fort under `SORTIE_ARMOR` (25%) sends every armed warbot inside out to fight, and capturing one ejects whoever is left inside instead of killing them.
  A Silo is drawn with its launch pit empty until it's ready to fire (loaded and not reloading; a Nuclear Silo once
  armed), then the missile fades in (`siloRise`; art `silo-empty`, `nukesilo-empty`).
  To fire, tap a Silo and press **Aim missile**: its 18-tile range shows as a red ring; tap any spot inside it (a
  building or open ground) to see the blast radius, then **Fire**. (Army → rival building → Fire missile also works.)
  Under a finger the view never zooms out past `AIM_TILE` (20 px a tile; fitting the whole ring on a phone made tiles
  9 px, twenty under a fingertip): tap to drop the crosshair, drag it to adjust (`mapGrab`, a drag that starts on it;
  elsewhere a drag moves the map), and only Fire launches (a second tap on the spot fires only with a mouse). A bomber's
  strike and a Howitzer's target are picked by a tap, ringed, then confirmed on the banner (`pickTarget`).
- **Nuclear race** (new-game option): six small Uranium deposits on each side (`URANIUM_DEPOSITS`, in each colony's half, third or quarter) glow green. An Ore Mine within 4 tiles
  digs Uranium before ore; a Nuclear Reactor enriches it (2 → 1) and a Nuclear Silo assembles a missile from 6 Enriched
  Uranium, 4 Alloy and 2 Chips (60 s), so 12 Uranium a bomb. It flies 30 s (the target is warned and sees the blast
  ring; the **Evacuate** button on the incoming-nuke card, or the AI by itself, sends every robot in the ring plus
  `EVAC_MARGIN` out of it and holds jobs there until the blast: `startEvac`, `evacSweep`, `doFlee`) and wipes out every building, robot and road within 6 tiles, yours included; a Command Base survives with no
  garrison and 1 armor, unless the missile lands on it (within `NUKE.direct`, 2 tiles, of its centre): then it's
  destroyed and that colony is out, what's left of it going to the colony that fired (`eliminate(..., 'nuke')`), so the
  AI aims for a rival's Command Base whenever one is in range. The ground stays scorched for 4 minutes: nothing can be built there. The AI races too.
  Tunables: `NUKE` and `URANIUM_DEPOSITS` in `js/defs.js`.
- **Pace:** the whole game runs at 85% speed (`GAME_PACE` in `js/defs.js`) for a calmer feel; the speed button
  gives 2× and 3×.
- **Ordering bots:** the Bot Foundry only builds the bots you order. Tap it and use +1 or +5 for Workers or
  Warbots (Clear cancels the queue); with nothing queued it sits idle and uses no Alloy or Chips.
- The **Build** menu shows how many of each building you already have, and how many are being built.
- **Demolishing** returns half a building's materials straight to the nearest other storage; anything inside it (a
  Silo's Missiles, a Nuclear Silo's finished missile as its parts, a Depot's whole stock) spills out in crates for the
  Haulers to collect.
- **Land is influence** (`computeTerritory`): military buildings claim their ring (BDEFS `terr`: Command Base 8,
  Outpost 7, Keep 6), every other finished building `CIV_CLAIM` (2) tiles round itself (`civClaims`), and a military
  claim outranks the small ones. You build on your own land or on no-one's within `BUILD_REACH` (10) 8-way steps of
  your buildings, roads or track (`reachMap`, `inReach`, `landRule`), never on a rival's; defences (`DEFENCE_TYPES`)
  only on your own land. Roads, track and pipes run on any ground no rival holds that your bots can reach
  (`reachZone`); roads and track have their own owner (`S.wown`, read through `wayOwner`), so raids, missiles,
  creatures, paving and junctions go by who laid them, not whose land they're on.
- **Warbots march in single file** on roads (`queueRoom`, `WARBOT_GAP`): a warbot on the march falls in behind the next
  warbot of its side in its lane (never behind a truck, nor one that's fighting or breaking down a Gate) and spreads out
  for its last `WARBOT_SPREAD` tiles; off-road tiles cost `WARBOT_OFFROAD` times more when it plans a route, so squads
  keep to the roads. Other traffic still never queues behind a warbot.
- **Rail Stations** can go up before any track: a rail drag over your own station skips its tile, so dragging from one
  station to another lays track that ends beside each.
- **Cut off** (`cutOff`, `crumble`): a finished building whose ground a rival's ring takes stops working (nothing is
  hauled to it, its worker leaves) and loses `armor / CUT_CRUMBLE` (90 s) a second until it's lost (`dropLoot`); it
  recovers if its owner takes the land back. A construction site on a rival's ground is lost at once. A land-claiming
  building can't go where its ring would cover a rival's ordinary building (`ringOverRival`; a Drop Outpost dropped, a
  Port a Ferry founds and a Crawler deploying too): cut-offs come from capture or a fort falling. The AI builds on its own land first and on open ground only when it has no spot at home.
- **Salvage:** a colony out of Stone or Fiber with no Quarry or Harvester that can still work salvages 1 every 20 s from
  its Command Base (up to 6), so it can always rebuild. Capturing an enemy Outpost takes its land,
  and enemy buildings its ring now covers are cut off (see above).
- **Controls:** drag to pan, pinch or scroll to zoom, tap anything to inspect it. Wheel deltas are normalised and capped
  per event (smooth on a Magic Mouse or trackpad); a Ctrl + wheel pinch zooms faster, a sideways swipe or Shift + wheel
  pans, and Safari's trackpad pinch (`gesture*` events) zooms the map instead of the page. Drawing resolution is capped
  at `RENDER_BUDGET` pixels (about 4K; a 5K iMac at 2× would be four times the work) and `watchFrameRate` lowers it,
  down to 1×, if frames run below ~45 a second and drawing is what's slow (not when the screen or a power-saving mode
  holds a steady beat, such as 30 a second, nor when the simulation is the slow part), and raises it again when there's
  room; the minimap is laid out again whenever it changes. Nothing is drawn under a full screen (the pause menu, Help,
  Statistics, Send feedback, game over) while the game behind it stands still, unless the view, the canvas or the art changes
  (`drawNeeded` in js/main.js), and the demo behind the main menu is drawn 30 times a second (`DEMO_FRAME`).
- **Phones and tablets (touch):** a touch on the map is only ever a touch there: the click a browser makes after it
  is cancelled (`initInput`), so the tap that opens a panel can't also press a button that appears under the finger,
  and a tap on a tile beside a button doesn't press the button. Where panels open across the bottom of the screen
  they open at **half height** (`setSheetSize`), with the goal card out of the way, and the map glides so that what the
  panel is about sits in view above it (`sheetMoved`; the map may scroll further up past its last row for this,
  `R.lift`). Under a finger (`pointer: coarse` in style.css) every button, choice, switch, stepper and slider in a game
  is at least 44 px to press (the goods counters stay 32 px high, so their two rows don't take more off the map), and no
  text in a game is under 12 px. The **grab handle** at the top of the panel drags it to full height, to half, or down to just its title
  strip (further down closes it); a tap on the handle swaps half and full. The Build list, Goods and Your robots open
  at full height, which stops below the goods and the clock. The panel's body scrolls; its handle and close button
  stay put.
- **A phone on its side** (`(orientation: landscape) and (max-height: 519px)` in style.css) has its own layout: the
  goods in one row across the top, the tools as a **rail down the left edge**, panels as a **column down the right**
  (as tall as the screen allows, so no grab handle; the map glides to bring the panel's subject out from under it), a
  mode's banner and the selection bar as a box at the bottom left beside the rail, and only the newest message, at the
  bottom right. The minimap is sized from the short side (`layoutMinimap`: 84 px there, where it got the desktop's 156
  and filled two thirds of the height), and a new game opens at a zoom that fits the short side (`enterGame`).
- **How to play on a touch screen** (`helpForTouch`): the Touch controls card (`#h-touch`) heads the contents page,
  on one screen, and key names are left out (the mouse and keyboard paragraphs and brackets that only name keys are
  marked `.keys` once at start-up, before the section pager is built, by `helpMarkKeys`, and hidden under
  `(pointer: coarse)`).
- **Messages and the goal card** (`toast`, `openMsgSheet`): a message stays for a time that fits its length (3.8 s up
  to 12; a building lost, 8 at least), lets taps through to the map, and has a **Go** chip when it's about a place. The
  last 20 are kept for the messages button beside the folded goal card. On a small screen the goal card folds by
  itself at the first tap on the map and opens again for each new step (unless you fold or open it yourself); folded
  it still counts buildings with no road. In free play the Build list pins the building the step asks for at the top
  (`OBJECTIVES[].build`, `nextBuilds`), and a building with no road to storage has Lay road at the top of its panel.
- **Colony goals, Records and achievements** (`js/goals.js`; display and device only: nothing there changes `S` or
  sends an order, so the save and the lockstep are untouched). `metaTick` (from `uiTick`, once a second of real time)
  reads the game. **Colony goals** (`COLONY_GOALS`, Colony free play): about 16 optional goals in four tiers
  (`GOAL_TIERS`: Groundwork, Long hauls, Across the planet, Accord scale), each counted from `S` by its own `count(P)`
  (a traffic light or overpass, a pipeline joining two buildings, a Generator, a Depot with supply orders, a Research Lab
  upgrade; 30 tiles of asphalt, a Road Train, a Freight Train, a Trade Terminal contract, a Murmur nest; a Ropeway, a
  Viaduct, a Port and a Container Ship, a Cargo Plane delivery; three Freight Trains at once, 100 Alloy a minute
  (`goodRates`), 100 robots, every upgrade), with `when` leaving out the ones the planet can't offer (`navalMap`, no
  cliffs, no Murmur, no Trade Posts). A goal met stays met: its flag goes in this game's entry in `terrafall.games`
  (localStorage, `metaStart`: a new game gets an entry keyed by its seed and the time it started on this device; a
  loaded save finds the newest entry for its seed and mode that isn't further on than the save, so goals met before a
  save stay met, and those met before a load bring no second message). The goals button beside the Goal card
  (`#btn-goals`, `goalsHUD`) opens the panel (`openGoalsSheet`, sheet kind `'goals'`): the land milestones, then each
  goal with its count, a hint and a button (`goalAction`: **Show** goes to the nearest building of `at` and opens its
  panel, else the `paths` tool opens, else the Build list on the `build` building's tab with its card ringed). A goal
  met brings a message and a flash of the button. **Records** (`terrafall.records`, `metaRecordsTick`, `metaGameOver`):
  fastest win per map type and rival level, most robots, most buildings (not Walls, Gates or Ramps), longest game and
  most land held, from single-player Versus and Colony games (`metaCounts`: no mission, no multiplayer, no autopilot,
  and never Boosts, rival bans or Unlimited resources at any point, `metaAssisted`). The end screen (`#o-meta`) lists
  the records a game beat (one it set where there was none isn't news, except a first win on a map type and level) and
  the achievements it earned. **Achievements** (`ACHIEVEMENTS`, 22, `terrafall.achievements`): victories from the
  result (a win; on Hard; by Domination; on the Uplinks; a free-for-all; on every map type; each doctrine beaten at
  Medium or harder, and all five; no Pulse Turret site placed, Normal or Hard; **Full escort**, a rival Command Base
  taken with `STORM_MIN` (20) of your armed robots within `STORM_R` of it, counted each second before it fell,
  `metaStormTick`), deeds from any game played without help, multiplayer and missions too (`metaDeeds`: the first
  Ropeway and Freight Train, a nest cleared, every upgrade, the last Colony milestone, every Colony goal), and the
  missions (`metaCampaign`, from `loadCampaign`). Earned in a game they pop up as a message. **Records** on the main
  menu (`#screen-records`, `openRecords`, a pill beside Lore and Feedback) shows them all; an earned achievement with
  `lore` has a button that opens the Lore guide on that page (`openLore(id)`). **Forget records and achievements**
  (two taps) clears both.
- **Back and the screen** (`initBack`, `syncWakeLock`): in a game a phone's (or the browser's) Back button steps back
  like Esc instead of leaving the page: it closes the start-of-game card, a screen, a panel or a mode, clears the
  selection, and with nothing open brings up the pause menu (a history entry is added on entering a game and put back
  each time Back takes it; leaving for the main menu removes it). The screen is kept awake (`navigator.wakeLock`) while
  a game runs, and let go when it's paused, over, left or hidden. A long press brings up no browser menu.
- **Warbots by touch** (`touchSelect`, `touchOrder` in js/ui.js): tap one of your warbots or Howitzers to select it
  (tap it again within half a second for all of its kind in view). The selection bar (docked across the bottom in
  place of the tools on an upright phone) says what they're doing and has two rows of buttons that fit without
  scrolling: **All in view**, **Whole army**, **Box** and **Info**, then **Undo**, **Recycle** and **Save as group**
  (where the bar is under 380 px wide a few words go: Recycle 6, Save group 1, Tap again); while it shows, a tap on the map is the order a right-click gives, with a ring and
  **Undo** for 4 seconds (`ORDER_UNDO`; the `undoCommand` order sends each back to what it was doing). A drag or a
  pinch is never an order. **Box** (or a finger held still 350 ms, `LONG_PRESS` in js/input.js, then dragged, where
  you have warbots out) draws a selection box. With a panel open the bar steps aside and taps inspect.
- **Vibration** (`haptic` in js/input.js): under a finger, on a device that can vibrate (`navigator.vibrate`), a short
  buzz says an order went through (a tap-to-order with warbots selected or in the Army banner, a building, Viaduct or
  Ropeway placed, a Paths plan built, Lay road) and marks a warning or alarm from the game (at most one every 2.5 s).
  **Vibration** in the pause menu (shown only on a touch screen that can vibrate) switches it off; it is kept on this
  device (`botfall.haptics`), on by default.
- **Game speed:** the speed chip in the top bar opens 0.75×, 0.875×, 1×, 2× and 3×.
- **Sound** (`js/audio.js`, all Web Audio, no audio files): a generative synthwave score that follows the game (menu,
  building, war when you're attacked or fighting, and an alarm while a nuke flies; the building music takes turns between
  three themes, `BUILD_THEMES`, every `MUSIC_ROTATE` seconds of play: Lost in a Dream, the main theme (the menu music is a
  slow take on its chords), Night Drive (Dorian, octave bass,
  claps, a plucked lead) and Horizon (half-time, a chord every two bars, an arpeggio in threes)), written a bar at a time from chord
  progressions, arpeggios, bass, drums and short melodies in 8-bar sections. **Now playing** (`nowPlayingTick` in js/ui.js,
  display only): on a computer (a mouse, the wide layout) a ♪ in the bottom left corner opens into a card naming each theme
  as it starts (`MUSIC_TITLES`: the menu's slow take is Lost in a Dream too, the war theme Overdrive, the nuke alarm Zero
  Hour, `end` none) for `NP_SHOW` ms, and on hover or click; a title shown in the last `NP_AGAIN` ms (a minute) isn't
  shown again, and nothing shows with the Music at 0, in photo mode, under a full screen (the main menu is fine) or where
  it would run into the tools or the menu's card (a new theme's card waits for room). Effects include radio blips for orders, a
  Pulse Turret's tesla-coil discharge (a short charge whine, then a buzzing arc crackling with sparks: `pulse`), a
  nuke siren and blast, and sounds from the map when on screen (traffic hum, louder where the moving bots bunch up in 5-tile squares, with engines
  going by, warning beeps, toots and robot chirps from the busiest squares; welding, concrete, asphalt, truck air
  brakes and horns, biome wind, jungle birds and insects). Ambience that grows with the colony (`ambienceBeds`): a
  city murmur that rises with the built-up area on screen (and a little with the colony's size; quieter at night),
  far-off horns in a big town, a soft industrial hum under working factories (it and the traffic hum wander in pitch and swell and ease, never one
  steady drone) plus their own one-shots (`WORK_SOUNDS`:
  furnaces, clanks, drills, pump thumps, beeps; the Smelter and the Bot Foundry also press, ratchet and machine), a train's diesel throb and rail clack that quickens with its speed,
  its horn as it pulls out and brakes as it slows, aircraft engines panned to where they fly, with a rival's take-off
  roll, the approach whine and the touchdown chirp, a ship's horn leaving port, the sea's wash (full on the sea maps,
  Islands, Tidal flats and Four Isles; softer on lakes and rivers), bubbling lava and crickets on warm nights. Under it
  all, **the land's own sounds** (`natureBeds`, `biomeCall`): each biome's bed (`NATURE`: leaves rustling as the wind
  gusts in the forests, grass on the savanna, sand or snow hissing in the desert and at the poles, cicadas in the
  savanna's heat and insects in the forest by day, the swamp's frogs and insects by night, the Bloom's shimmer, brighter
  by night, the ashlands' ground rumbling) and calls now and then (forest birds by day and a night bird's hoot, cicadas
  and far-off calls, frogs, drips and bubbling mud, the Bloom's sliding calls and night chimes, vents hissing, sand
  skittering, wind whistling through rock and rock ticking as it cools at night, ice cracking and groaning, snow
  sliding). Both are loudest out in the wilds and fade as the view fills with a town: `WORLD.wild` is the share of the
  land on screen that isn't built on, paved or laid with track (a third built up is all town), eased so it doesn't jump;
  the calls come every few seconds in the wilds, hardly ever in the streets, more at dawn and fewer in rain or fog.
  Water: surf breaking on a sea map's shore, little waves lapping at a lake's or a river's banks (quicker on a river
  delta). The ground rumbles near the volcano on a Volcano map, harder once it rumbles its warning and while it erupts,
  and over lava. The weather (`weatherSound`: `weatherAt` while weather is shown, or a planet event's dust storm) is
  heard too: rain, with thunder a moment after each lightning flash the storm shows (the same flashes: `hash2` of the
  seed and the 5-second stretch), the wind blowing up in a sandstorm, blizzard or gale (`STORM_WIND`; fog stills it),
  sand and snow hissing, leaves in a gale, embers ticking as they fall in an ashfall, an aurora's shimmer. Near a Murmur
  nest, now and then (more at night), a low sound in the ground (`groundMurmur`). Argos is near-silent: only the
  faintest rumble for a wind, no calls, and its frozen pools make no water sounds; the Cinderlands' lakes sound like the
  lava they look like. The mix, measured against the build music at the default volumes (a tap on the music bus and one
  on these voices): a calm wild scene sits about 18 to 22 dB under the music, a storm about 11 to 14 dB under, an
  eruption about 16 dB under, and a town about 25 dB under (the land fades there); thunder and surf peak at least 8 dB
  under the music's peaks. (A drone is a narrow band of noise, so its level number is far higher than a rustle's for
  the same loudness.) Music and Effects volumes are in the pause menu.
- **Briefing at the start:** the messages a new game opens with (where you landed, your goal, the map's notes) come
  together on one card while the game waits paused behind it; it closes by itself after a few seconds (longer for
  more text), or at a tap or key. In multiplayer the game doesn't pause for it.
- **Desktop (RTS controls):** on a wide screen the top bar is one row, the tools sit in a small dock and panels open
  on the right (the Build list three cards across in a wider panel from 1600 px wide). Drag a box to select warbots (Shift adds; a box round a garrison takes its spare warbots), right-click
  ground to hold it, a rival building to attack, or your garrison to station them. Ctrl/Shift+1–9 saves a control
  group, 1–9 recalls it (twice jumps to it). Pan with **WASD** or the arrow keys, the window edge, or right/middle drag; hover for
  tooltips. Clicking the same spot again steps through what's piled there (a Crawler on a Foundry, workers at a site). Keys:
  **B** build, then **1–5** a tab (Gather, Make, Move, Defend, All; **Tab** steps; it opens on the last one used) and the
  letter on a card (`BUILD_KEYS` in js/ui.js: letters are per tab, so every building has one and none needs W, A, S, D, B
  or R; on All a card shows "2 K"; **B R** lays roads, **B X** walls), **R** (or **P**) opens and closes Paths
  and inside it picks a tool (**R** roads, **G** bridges
  and tunnels, **V** ramps, **Shift+V** viaducts, **Shift+Y** ropeways (`PATHS_SHIFT_KEYS`: every plain letter is taken),
  **E** pave, **O** one-way arrows, **L** junctions, **X** walls, **T** traffic map, **Shift+T** goods flow map), **Q** army, **C** recall all warbots, **F** select all warbots, **Shift+F** a Bot Foundry's Order bots list from anywhere without moving the map (again: the next Foundry, `openFoundryOrders`), **J** latest alert,
  **H** base, **I** statistics, **U** robots, **Y** goods, **[ ]** speed, **+/−** zoom, **M** minimap, **Enter** the banner's main
  button, panel buttons by the key shown on them (`SHEET_KEYS`; **Delete** twice demolishes, and on a robot's panel
  recycles it), **Space** pause, **Esc** back / clear selection (in Paths it takes back the last stroke; **Ctrl+Z** is Undo there, and on the map, for 10 s after placing a building, it takes the site back), **Alt+Enter**
  full screen (also a top-bar button and a pause-menu item). Chrome opens the installed app in a plain window on a
  computer (it ignores the manifest's `fullscreen`), so the app goes full screen itself on the first click unless you
  left full screen last time; Esc stays the game's key (`navigator.keyboard.lock`; hold it to leave). On a screen wider
  or taller than the map the planet's ground carries on, darkened, past the map's edges (`drawOffMap`).
  Phones and tablets keep the touch controls.

## Custom art

Buildings, bots, resources and ground use custom art made in Claude Design (`art/`, with SVG sources in
`art/source/`). The renderer that made the 3D art (three.js scenes in headless Chrome, plus the compose, effect and
terrain scripts, and `jobs.txt` with the recipe for every shipped file) is in `renderer/`: see `renderer/RENDERER.md`
to render new sprites in the same style. The art rules are in the Terrafall design system
(https://claude.ai/artifact/GAdLBz6kefeJeTRz57TTV7). The production buildings, Depot, Outposts and construction sites use the pre-rendered 3D set
(512×512, each on its own pad, placed by an `anchor` point in `art/art-manifest.js`), as do the Fuel Station, Bio
Farm, Oil Pump, Refinery, Cement Works, Asphalt Plant, Roadworks, Ramp, Ammo Plant, Missile Factory and Missile Silo
(team versions for the military ones), plus the Repair Station, the fortified Command Base, the Nuclear Reactor and
Nuclear Silo. All six robots (Worker, Warbot, Hauler, Agribot, Paver, Freight Truck) have four driving frames per team
plus brake-light and boost overlays (WebP, `driveSet()` in the manifest); the frames advance with the distance driven.
The nuclear missile, its 24-frame detonation sheet and the scorch mark are custom too, and so are the Bunker,
Disruptor Tower and Mortar Pit (with their firing overlays, the Mortar's tube in 16 directions and morning, evening
and night sets), the streetlamps along roads (`streetLamps`: posts sorted with buildings and bots, lit heads and
light pools at dusk and night) and the Pulse Turret's twin violet laser and hit burst (`fx-pulse-laser`,
`fx-pulse-hit`), the 3D Pulse Turret (a base and its gun head in 16 directions, with its violet charge-up,
`turret-charge-0…15`, and the beam leaving the barrel tips in `PULSE_MUZZLES`), the Walls and Gates
(`drawBarrierArt`: the dark Citadel, smooth charcoal stone with bastion towers at the posts, razor wire on insulator
posts along the top with live arcs crackling over it now and then, and steel blast-door Gates that slide open into
the towers, layered per tile), the
Viaduct's abutment tiles (`viaduct-abut-*`) and the working loops of the Oil Pump (its beam nodding over `pump-base`),
Refinery and Smelter. Still to make: goods icons and a few terrain pieces. The biome art is in `art/biomes/` (six plants per biome with their
shadows baked in, and the Jungle and Polar ground, water, rock and cliff), and the Red desert ground, water and rock
are 512×512 (one image per 4×4 tiles, sharp on the zoomed-in map); all WebP to keep the single-file build small. The app icon is in `icons/` (its source: `icons/icon.svg`). Anything without an image falls back to placeholder art drawn in code, so new art can be
added one piece at a time. See **[ART_GUIDE.md](ART_GUIDE.md)** for specs, the style brief and prompts,
including the remaining pieces (Ramp, slope and cliff textures, goods icons).

Weapon effects are drawn in code: muzzle flashes, tracers, gun smoke, dust kicks and bullet pockmarks round each
target (sparks on buildings), the Disruptor's arcs, and blasts with a fireball, flying debris, smoke and a scorch mark.
A destroyed building shakes, leans and sinks into the ground in a dust cloud, with secondary blasts, and leaves rubble.
Big blasts and quakes near the middle of the screen shake the view (`fxShake`), unless the device is set to reduce
motion (`LESS_MOTION`). Each frame starts from a clean canvas state (no dash offset, line ends or text baseline left
over from the last one), and a train's wagons start again behind it after it drove unseen (`trailOf`).
A Pulse Turret charges for 0.45 s before each shot (`PULSE_CHARGE`; the charge builds while it reloads, so its rate of
fire is unchanged), energy gathering at its muzzle, then fires a thick electric beam wrapped in arcs. At night,
streetlights light every third road tile (`drawStreetLights`): sodium orange over concrete, white over asphalt.
Ground marks fade over a minute or so (at most 350 at once). Each effect can be swapped for a sprite sheet
(`frames` and `cols` in the manifest; `FX_ART` and `DECAL_ART` in `js/render.js`): see ART_GUIDE Batch 15.

## Enabling GitHub Pages

1. In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. The workflow in `.github/workflows/pages.yml` publishes the game on every push to `main` (the development branch
   `claude/elegant-cori-a8yj96` no longer deploys: work reaches the site once it's on `main`). The `github-pages`
   environment must allow `main`: **Settings → Environments → github-pages → Deployment branches and tags**, a Branch
   rule for `main`. To publish right away without a push, open **Actions → Deploy to GitHub Pages → Run workflow**.
   Before uploading it writes the build (the commit's short hash and the date) into `index.html`'s `terrafall-build`
   tag, which feedback reports name (see Send feedback).
3. Installed copies (Add to Home Screen) check for a newer version each time they open with internet, so they update
   by themselves.

(GitHub Pages on a private repository needs a paid GitHub plan; on a public repository it is free.)

### Day and night

The planet turns: morning, day, evening and night, 12 minutes of game time round (`TOD_CYCLE` in `js/daynight.js`),
starting at dawn, with half-minute crossfades. It runs on game time, so it pauses with the game and is saved with it;
the clock in the top bar shows a sun (coloured for dawn, day and dusk) or a moon. Turn it off in the pause menu (Day and
night; a display setting kept on the device).

- **Re-lit art.** Every 3D sprite (buildings, robots and vehicles, track and bridge pieces: the 207 keys in
  `art/tod/tod-keys.js`) has a morning, evening and night version from the Claude Design day/night kit, at
  `art/tod/<time>/<same path as the day art>` (WebP, the day file's size; the kit's design names, such as cement-works
  for the Cement Works, are installed under the game's). `drawArt` draws the current time's version and fades in the
  next one over a transition (`todVariant`); only the sets in use now and next are loaded (`todFrame`), and a set's
  re-lit and graded copies of each sprite, the green and purple teams' too, are let go with it (`todDropSet`, `todFree`;
  a graded stand-in goes as soon as the re-lit image arrives), and the sprites drawn lately get the coming set's versions
  ready a couple a frame ahead of the change (`todWarm`, `artSeen`). The single-file
  build puts each set in a bundle beside the page (`dist/tod-<time>.js`, loaded when needed).
- **Graded in code** (`out = in × multiply + add`, values from the kit's `art/tod/shared/time-of-day.json`): the baked
  ground, roads, track, pipes, plants, resources and territory tint (`todGradeGround`), and any sprite without a
  re-lit version or whose set hasn't loaded yet (`todGraded`). Tile art drawn over the graded ground (bridge piers,
  towers and cables, Viaduct decks, level-crossing barriers) goes through `withTod`, like `drawArt`. Light overlays (brake lights, boost glow,
  lamps), the UI and nuke blasts are never graded.
- **Evening and night:** vehicles' headlights (`drawHeadlights`, the kit's overlays at 3× the sprite), a glow in team
  colour under every finished building (`lightPool`, all drawn in one additive pass; small ones along Walls, bigger at Gates), a searchlight
  sweeping ahead of every Pulse Turret's gun as it turns (`drawSearchlight`), and bots' drop shadows lean left at dawn, right at dusk and
  fade at night (`todShadow`).
- Every building and robot has a re-lit set (lit windows, beacons and team-colour glows; headlights on everything that
  drives), including the 3D Pulse Turret and its heads, every Wall and Gate piece, the Viaduct's abutments and the
  moving parts of the Generator's and Oil Pump's working loops. Light loops (the Smelter's furnace, the Refinery's
  column lights, the turret's charge-up, the walls' sparks) are never graded.

## Project layout

```
index.html, style.css     page, HUD and menus
js/util.js                RNG, noise, heap, helpers
js/defs.js                all game data and balance numbers (costs, timings, ranges)
js/world.js               map generation, game state, territory, placement rules, save/load
js/path.js                A* pathfinding
js/sim.js                 simulation: logistics, workers, production, combat
js/ai.js                  rival AI
js/missions.js            mission campaign: goals, hand-placed map features, progress
js/orders.js              every player action as an order: a name and plain arguments, checked against the player
js/lockstep.js            multiplayer: every device runs the game, only orders travel (see Multiplayer below)
js/net.js                 multiplayer: the connection to the relay (rooms, reconnecting, catching up)
js/mpui.js                multiplayer screens: host, join, the lobby, the in-game banner, pause and leave
js/feedback.js            Send feedback: the form (main menu and pause menu) that posts to the relay's /feedback
js/goals.js               Colony goals, Records and achievements: read from the game, kept on the device (display only)
js/photo.js               photo mode: the interface hidden, a time-of-day slider and Save picture (a PNG of the map)
js/watch.js               Observer mode: computer colonies play while you watch, with a scout report and a camera that follows the fighting
js/scout.js               scout reports in your own games: what a computer rival starts doing, as a message with Go
js/blueprint.js           blueprints: a block of buildings and its roads kept on the device, placed again through orders
js/charts.js              line and bar charts for the statistics screen
js/render.js              canvas renderer and placeholder art
js/daynight.js            day and night: the clock, re-lit art sets, grading, headlights, light pools
js/input.js               touch and mouse controls
js/ui.js                  HUD, build menu, info panels, objectives
js/audio.js               synthesized sound effects
js/main.js                boot and main loop
art/art-manifest.js       register custom art here
art/lore/                 the Lore guide's pictures (the planet, the regions, the Murmur)
tools/headless-sim.js     AI-vs-AI balance test without a browser
tools/smoke-test.js       browser test on a phone-sized screen (Playwright)
tools/build-single.js     bundles everything into dist/terrafall.html (and dist/tod-<time>.js, biome-<b>.js, lore.js)
relay/                    the multiplayer relay and player feedback: a Cloudflare Worker (deployed by .github/workflows/relay.yml)
```

Plain JavaScript, no build step and no dependencies. Balance tweaks mostly live in `js/defs.js`.

### Multiplayer

Two to four people play one game, each on their own phone, tablet or computer (any mix), with computer rivals
in any places left over. Everyone sees the whole map.

**Playing.** Main menu → **Multiplayer**. One person types their name and taps **Host a game**: the lobby shows a
five-character room code, and **Share** sends it (with a link that opens the game straight to it). The others type
their name and the code and tap **Join**. The host can **Change settings** (the usual new-game screen: map type,
biome, size, rules, how many colonies in all and how hard the computer rivals are), picks each computer place's
**doctrine** from its row in the lobby (pointing at a row, or tapping it, says in a line how that doctrine plays, and
How it plays opens the whole of it) and taps
**Start game**. In the game:

- The menu button (top right) opens the menu without stopping the game; **Pause the game for everyone** pauses all
  of you (anyone can resume). The game runs at one speed for everyone.
- If someone's connection drops, the others' games wait for it; after 12 seconds the computer runs that colony.
  When the device comes back it catches up and the colony is handed back. A page that reloads (or a phone app that
  was closed) offers **Rejoin multiplayer game** on the main menu, and gets the game from the others.
- **Leave the game** hands your colony to the computer for the rest of the game. A multiplayer game isn't saved for
  Continue.

**Teams (2 vs 2).** With four colonies in all (Crossroads, Pinwheel, Four Isles, Twin Valleys or Long Haul 2v2), the host can set **Teams: 2 vs 2** in the settings: the
two western colonies (south-west and north-west) play the two eastern ones (on Long Haul 2v2, where picking the map turns
Teams on, the two southern colonies play the two northern ones). The lobby shows the two teams, people
first and then computer players, and the host taps a person to move them to the other team (never more than two a
side). Allies never shoot, shell, raid or capture each other, their turrets and Flak leave each other alone, the
computer only ever goes after the other team, and a team game is won by **Capture**: take both enemy Command Bases
and both colonies of your team win. Teams also work in a one-person game (Versus, **You vs 3**: you and a computer
ally against two computer rivals). Rules: `S.teams` (`[0, 0, 1, 1]`), with `foes(p, q)`, `allies(p, q)` and
`teamOf(p)` in `world.js`; without teams `foes` is just `p !== q`.

**The relay.** The devices talk through a small relay server: `relay/`, a Cloudflare Worker with one Durable Object per
game room, free on Cloudflare's free plan. It's deployed from this repository by the **Deploy multiplayer relay**
workflow (`.github/workflows/relay.yml`, again on every push that changes `relay/`), and runs at
`https://terrafall-relay.tadellsworth.workers.dev` (`RELAY_DEFAULT` in `js/net.js`). A deploy that fails right after
the upload (Cloudflare not yet seeing a Worker it has just been sent: "This Worker does not exist on your account
[code: 10007]") is tried again after half a minute, and once more after a minute. Setting it up on another account:

1. Make a free Cloudflare account (dash.cloudflare.com/sign-up). Open **Workers & Pages** once: it asks you to pick
   your `workers.dev` subdomain.
2. Copy your **Account ID** (on the Workers & Pages overview, on the right).
3. **My Profile → API Tokens → Create Token → Edit Cloudflare Workers → Use template**, pick your account, then
   **Continue to summary → Create Token**, and copy the token (it's only shown once).
4. In this repository: **Settings → Secrets and variables → Actions → New repository secret**: add
   `CLOUDFLARE_API_TOKEN` (the token) and `CLOUDFLARE_ACCOUNT_ID` (the Account ID).
5. **Actions → Deploy multiplayer relay → Run workflow.** When it's done, its summary shows the relay's address,
   `https://terrafall-relay.<your-subdomain>.workers.dev` (opening it says *Terrafall relay: ok*).
6. Put that address in `RELAY_DEFAULT` at the top of `js/net.js` (as `wss://...`) and push: the published game then uses it. (To try
   it before that, open the game with `?relay=<address>` on the end of its web address: that device remembers it.)

The relay runs locally too: `cd relay && npx wrangler dev`, then open the game with `?relay=ws://127.0.0.1:8787`.

**Player feedback.** The relay also takes the game's **Send feedback** form (`js/feedback.js`; see Send feedback above):
`POST /feedback` (`relay/src/feedback.js`, whose header has the exact contract) with JSON `{ type, text, contact?, meta?,
save?, shot?, website? }` answers 200 `{ ok: true, n }`, and each report becomes issue #n in a private GitHub repository,
labelled by type and `from-game`; an attached save is committed to `saves/` there and linked from the issue (load it
with Load a save file to play the bug back), and a picture of the map (a JPEG, PNG or WebP data URL up to 1 MB) to
`shots/`, shown in the issue. CORS is open (`*`). Other answers: 503 `{ why: 'off' }` until it is set up,
429 past 5 reports an hour or 20 a day from one address (counted by a hash of it, never stored), 400 for a text under
3 characters, 413 for a request over 9 MB, 502 if GitHub refuses it. Anything in the hidden `website` field marks a bot:
it is thanked and dropped. Setting it up: add two more Actions secrets, `FEEDBACK_REPO` (the private repository, as
`owner/name`) and `FEEDBACK_TOKEN` (a fine-grained GitHub token for that repository only, with Issues and Contents read
and write), then run **Deploy multiplayer relay** again: its summary says whether player feedback is on. Until then the
form says feedback isn't switched on yet, and keeps what the player wrote.

**How it works.** Multiplayer is lockstep: every device runs the whole game, and only the players' orders go between
them.

- **Orders** (`js/orders.js`): everything a player does on the screens goes through `act(name, args, callback)` in
  `js/ui.js`, which runs one of the `ORDERS` (place a building, set a priority, send warbots, plan roads...). Each
  takes plain arguments (ids, numbers, tile lists), checks that what it's given belongs to the player who sent it,
  and gives back how it went; the screens say so in the callback. In a single-player game it runs at once.
- **Lockstep** (`js/lockstep.js`): time is cut into turns of 3 ticks (a tenth of a second). An order is sent for a
  turn a little way ahead (each device picks how far from its own round trip to the relay), and a turn starts only
  once every player's orders for it are in, so every device carries them out at the same tick. Once a second each
  device sends a fingerprint of its game (`hashState`); if they ever differ, the host sends its game to the device
  that went astray. A player who goes quiet for 12 seconds (or leaves) has their colony run by the computer, on every
  device from the same turn, until they're back (`rejoin`); a device with no game asks for it (`want`).
- **The relay** (`relay/src/index.js`): seats up to four players per room, keeps the lobby, numbers every game message
  and hands it to every device in one order (that shared order is what keeps the decisions above the same
  everywhere), and keeps a log so a dropped connection picks up what it missed. **The connection** (`js/net.js`)
  reconnects by itself and sends big messages (a whole game) in pieces; **the screens** are `js/mpui.js`.
- **The same game everywhere**: no `Math.random` or clocks in the game; exact maths for angles and distances
  (`dsin`, `dcos`, `datan2`, `dhypot` in `js/util.js`, the same on every browser and phone); `ME` is the player at
  this device (messages, sounds, what the screens show), while the rules only ask whether a player is a person or
  the computer (`human`). Saves (and a game sent between devices) are taken at the start of a whole second.

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
- Custom art for goods icons, menus and effect sprite sheets (ART_GUIDE Batch 15)
