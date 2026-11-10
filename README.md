# Terrafall

A colony and logistics strategy game that runs in the browser, on phones and on desktop widescreens. Your robots land
on a dusty alien planet: gather resources, link them into supply chains with a network of roads, build more robots and
spread across the map. Roads are the heart of the game: Haulers only drive on them, so where your roads go decides
how goods move.

- **Versus:** race a rival AI colony across the planet. Capture its Command Base to win (about 20–40 minutes).
  The rival is **Easy**, **Medium** (between Easy and Normal), **Normal** or **Hard**, and has a **personality**
  (Rival style: Random, Balanced, Turtle, Raider, Rusher or Tycoon; see below).
  **Players: Free-for-all · 3** adds a second rival (red and green): a round planet with the three starts 120° apart
  (player 0's third is generated and turned round onto the others, resources placed tile for tile so each third
  has as many). Capturing a Command Base hands over everything its owner built (`eliminate`); the last colony
  standing wins. Standard, Islands, Crater, Plateaus and Sky islands maps (`ffa: true` in `SHAPE_PRESETS`); the green team's
  art is the red team's recoloured at run time (`recolorArt`), and each AI fights its nearest rival (`rivalOf`).
- **Colony:** no rival. Settle the planet at your own pace, with colonization milestones. Free play has the full
  building roster, missiles and nuclear silos included, to experiment with, plus the **Research Lab** and optional
  **Wildlife** (creature nests that raid you; on by default).
- **Missions:** eight set challenges on hand-picked planets, each with its own goals and Easy, Normal and Hard
  levels. All of them are open from the start; finishing one ticks it off at that difficulty.

Before each game, sliders set the **map size** (Small to Huge), the **terrain** (Flat, Gentle,
Rolling, Rugged, Mountainous), the **resources** (Scarce to Abundant), the **map shape** (Standard, Long haul, Chokepoint, Islands, Crater, Plateaus or Sky islands), **Unlimited
resources** (a testing switch: `unlimitedTopUp` keeps your Command Base at `UNLIMITED_STOCK` of every good and fills
whatever your buildings are waiting for, once a second), the
**biome** (Red desert, Jungle or Polar: scenery only, with plants that roads and buildings clear), the **rival style**,
an optional **Nuclear race**, **Planet events** (on by default) and, in Colony, **Wildlife** (on by default). Resources come in separate
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
| Asphalt Plant | Crude + Cement → 2 **Asphalt** |
| Roadworks | Its Paver paves and maintains the roads you mark for asphalt (or every joined road), nearest first (1 Asphalt covers 4 tiles) |
| Ammo Plant | Alloy + Cement → 3 **Ammo**; warbots reload it in the Command Base and Outposts, 5 shots per Ammo (Versus) |
| Missile Factory | 2 Alloy + Chip + Fuel → **Missile** (20 s each; Versus) |
| Missile Silo | Fires Missiles at rival buildings up to 18 tiles away; holds 2, reloads in 25 s (Versus) |
| Repair Station | Fixes damaged bots three at a time; 1 **Alloy** repairs 12 health (Versus) |
| Nuclear Reactor | 2 Uranium → 1 **Enriched Uranium** (Nuclear race) |
| Nuclear Silo | 6 Enriched Uranium + 4 Alloy + 2 Chips → one nuclear missile; fires 40 tiles (Nuclear race) |
| Research Lab | Researches colony-wide upgrades with Chips, Crystal and Alloy (Colony) |
| Ropeway | Two stations joined by a cable straight across cliffs, water or rock; light bots ride it |

- **Cement builds the colony.** Nearly every building costs Cement, and so does every road. Only the Quarry (2 Fiber)
  and the Cement Works (4 Stone, 2 Fiber) are built from raw materials, so you can always restart. Stone has no
  other use: it only goes into Cement (2 per Stone). You land with 24 Cement, 8 Stone, 16 Fiber, 8 Alloy, 4 Chips, 4 Crystal and 4 Fuel.
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
- **Paving and road wear:** Paths → **Pave** (E): drag along roads to mark them for asphalt (drag over marked road to
  clear it). Roadworks pave the marked roads joined to them (or, set to *Every joined road*, everything; the AI uses
  that). Every bot driving onto asphalt wears it (`WEAR_BOT`, Freight Trucks `WEAR_TRUCK`, three times as much): past
  half worn it slows bots (to 2.3× when nearly through), at `REPAVE_AT` the Paver resurfaces marked road, and worn
  through it drops back to plain road. On a busy trunk road that's every 8–10 minutes. Tap any of your roads to see its
  wear and mark it. Removing a road refunds its Cement.
- **Bridges and tunnels:** roads stop at water and rocky crags. The **Bridges** tool in Paths plans roads across them:
  a bridge costs 2 Cement and 1 Alloy a tile, a tunnel 3 Cement and 1 Alloy (`CROSS` in `js/defs.js`;
  `bridgeable`; a Sky bridge over the old `T_CHASM` canyons, 3 Cement and 1 Alloy, survives for old saves). Workers build them out from the shore or rock face (6–9 s a tile), and
  they join land on any level. A bridge is drawn as one level span at the height of the highest clifftop it lands on
  (`deckLevel` in `js/render.js`), ramping down at a lower end; its piers, end towers and suspension cables reach past
  the tile, so `drawBridgeRigging` draws them each frame over the map. Lay road routes use them only when going round is much longer.
  A bridge can be pushed out over water past your border, a tile at a time from your land or a bridge (`bridgeHead`).
- **Junctions, traffic lights and overpasses:** where three or four roads meet, bots slow down and give way to traffic
  already crossing. Switch the Paths banner to **Junctions** and tap a junction to put up a traffic light (1 Alloy): it
  lets one direction through at a time, switching when traffic waits the other way. On a busy crossing a light moves
  about half as many goods again; on a quiet one it costs nothing. Tap the light again for an **overpass** (4 Cement,
  3 Alloy): one road passes over the other and nobody slows or waits. Tap again to clear it.
- **Traffic map:** **Traffic map** in the Paths banner (or **T**) tints each road green to red by how busy it has been
  over the last minute and rings the spots where bots stand waiting.
- **Long hauls:** tap a Depot and set **supply orders** (how much of each good to keep there). Goods come from your other
  storage, and anything nearby then draws on the Depot. Who carries what (see the comment above `TRUCK_MIN_DIST` in
  `js/defs.js` and `dispatch` in `js/sim.js`): **Haulers** (2) do runs under `TRUCK_MIN_DIST` (12) tiles. **Freight
  Trucks** (8; 2 Alloy and 2 Chips at the Foundry) do the long runs from any building, with a full load (a far
  factory gets up to `LONG_BUFFER` of each input), and storage to storage. With trucks around, Haulers take a long run
  only when the far building is about to run dry, and a far producer waits for a truck until its output is nearly
  full. **Trunk runs** (`trunkRuns`): a store 12+ tiles from the Command Base sends home, in bulk, the goods nothing
  nearer to it uses (beyond its supply orders and `EXPORT_RESERVE`), by truck or Road Train only. **Road Trains**
  (30; 4 Alloy and 4 Chips) only do storage-to-storage runs 12+ tiles long, with `TRAIN_MIN_LOAD` (12) or more (any load
  without trucks); `TRAIN_ROAD` (35%) on plain road, slow corners, `TRAIN_LEN` of queue behind them, `WEAR_TRAIN` wear.
  On a straight asphalt trunk road one Road Train moves ~1.7× what two trucks do; on plain road about the same or less.
  Idle trucks spread out: each store keeps one waiting, and spare trucks park at the nearest Depot (or Command Base)
  with none. Trucks are slower than Haulers on concrete (80%) and slow to accelerate, but fastest of all on asphalt.
  An audit of 35-minute autopilot games: trucks were busy 18–60% before these rules and 76–92% after, Haulers made
  about half as many long trips, and about a quarter more goods moved.
- **Ropeways** (`ROPE_*` in `js/defs.js`; `ropeLink`, `placeRopeway`, `ropewayAcross`): two stations 3–14 tiles apart
  joined straight across anything. The near station is the construction site (it takes the whole cost); when it's built
  the far one goes up (`b.link` both ways). To the pathfinder a ride is an extra edge between the station tiles
  (`ROPE_COST` × a paved road of that length); zones and the road network join across it (`roadNet().comp`), but not for
  trucks (`compT`, `truckLinked`, `routeOpts.noRope`). Riders move at `ROPE_SPEED` (`u.ride`) and are drawn in gondolas.
- **Viaducts** (`VIA_*` in `js/defs.js`; `viaductBlocked`, `placeViaduct`, `viaductAcross` in `js/sim.js`; `viaLink` in
  `js/world.js`): two abutment buildings joined straight across lower ground, like a Ropeway's stations but level and
  open to every bot. Paid up front (`prepaid`, its cost per site in `b.cost`, read with `siteCost`), built in
  `VIA_TIME` seconds a tile spanned (`b.buildTime`). To the pathfinder it's an edge between the abutment tiles at
  plain-road cost; zones, both road networks (`comp` and `compT`) and the railway (`railNbrs`) join across it. A bot
  out on the deck drives as if on the abutment it left (`moveAlong`), so the ground below is untouched and its traffic
  passes underneath. The deck, piers and girders are drawn each frame (`drawViaductDeck`). An abutment on no-one's
  land survives `computeTerritory`; one inside another colony's land is lost. A far end claims the no-one's ground
  within `VIA_CLAIM` (3) tiles, never anyone's land, so a new mesa can take an Outpost. A bot out on a deck keeps
  `u.deck` (the two ends) until it reaches one, so a new order or a chase starts from the deck, not the ground below.
- **Freight rail** (`RAIL_*` in `js/defs.js`; the rail section of `js/world.js`; `layRail`, `deliverTrain` in
  `js/sim.js`): track is a tile layer (`S.rail`), laid instantly from the Paths **Rail** tool (`RAIL_COST` a tile, mostly
  Cement with a quarter of an Alloy, paid through the same credit as road Cement; `RAIL_BRIDGE_COST` over water), level
  except on bridges (`railStep`) and across a Viaduct with track on both abutments (`railNbrs`). Rail Stations stand beside the track;
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
  (75% as wide, 170% as long) with the bases far apart; **Chokepoint** walls the middle of the map off with a band of
  crags and leaves one 4-tile pass between the two halves (`CHOKE_BAND`, `CHOKE_APPROACH` in `js/defs.js`).
  **Islands** (a taller map) puts each base on its own island with a big middle island and islets, at least
  `ISLE_GAP` tiles of sea apart, so the only way across is bridges; the AI bridges toward its rival (`aiBridge`).
  **Crater** sinks a crater one cliff below a rim in the middle, its floor holding rich fields (and Uranium in a
  Nuclear race), with one natural ramp in from each side. **Plateaus** stands each base on the top level, with a
  terrace one level down all round and only two natural slopes off it. Both force at least three levels.
  **Sky islands** (`sky: true`) lays out a smaller home island per side, a small middle one and a jittered grid of
  small islands between (the same for every side), then turns the sea into a canyon floor at level 0 and lifts every
  island into a mesa (home islands +3 levels, the rest +4; small ones flattened to one level), so every drop is 3+ levels: no Ramp can
  reach the floor, only a Ropeway. A thin scatter of boulders and ore lies down there. Viaducts cross between the
  clifftops; the AI finds one with `aiViaductSpot`. (`T_CHASM`, the old bottomless canyon, is kept for old saves.)
- **Loitering:** a warbot standing still in another player's territory for more than `BATTERY.waitGrace` (15 s) drains
  `BATTERY.warbotWait` a second; once flat it gives up its attack, or leaves its rally flag, to recharge at home.
- **Raids:** armed warbots holding a rally flag in enemy land with nothing to fight tear up enemy roads (not bridges or
  tunnels, which only a Missile can crater) near the flag,
  one tile per 12 warbot-seconds. The rival raids your busiest road clear of turrets and garrisons every few minutes
  (Easy rarely, Hard often; a Raider far more) once it has warbots to spare. Missiles crater the roads where they land.
- **Traffic:** bots queue on roads, each waiting behind the bot ahead of it going the same way. On two-way roads each
  direction keeps to its own side, but passing oncoming traffic slows bots down. Switch the Paths banner to **Arrows** and
  drag along a road to point it the way you drag (tap a road to turn its arrow). One-way loops keep busy routes flowing;
  going the wrong way up a one-way road is allowed but crawls.
- **Goods panel:** tap a goods counter in the top bar for that good's stock, production and use per minute, net rate,
  which buildings make and use it, and any shortfall (buildings waiting on it with none in stock). Switch goods at the
  top of the panel.
- **Ammo:** warbots carry 10 shots (each Ammo reloads 5) and reload in your Command Base and Outposts, which haulers stock from an Ammo Plant. Out of
  ammo, a warbot can't fight at all: it heads back to a garrison to reload, and only armed warbots answer orders.
- **Repairs:** nothing heals by itself. Damaged bots go to a Repair Station (workers below 60% health, warbots below
  70% once their garrison is quiet), which uses 1 Alloy per 12 health. To fix a building, tap it and press **Repair**:
  you pay 1 Cement for every 6 missing armor and a free worker restores it.
- **Statistics:** the pause menu and the end-of-game screen show graphs of bots, land and goods over time and how busy
  each kind of building was; each building's panel shows its recent busy time.
- **Terrain levels:** the planet has terraces at different heights (lighter ground is higher). Bots
  can't climb cliffs; they use slopes at narrow passes, so some routes are long. Pave busy routes with
  Paths (slopes too) and build a **Ramp** (Paths, Ramps) on the top or at the foot of a cliff to open your own way up or down; tap ground your bots can't reach yet and it's planned on the side they can. Buildings can't be placed where they
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
  A dry Oil Pump shows a crossed-out oil drop over it, frees its worker and says so once: demolish it (any Crude
  still in a demolished building goes to storage). Harvesters, Quarries, Ore Mines, Crystal Taps and Bio Farms do the
  same with their own resource crossed out when nothing is left in reach (and go back to work if groves regrow).
- **Army orders:** tap **Army**, then a rival building to attack it with warbots or a missile, or open
  ground to send warbots there to hold the area under a rally flag. Tap the flag to call them back, or press
  **Recall all** in the Army banner (**C** on a computer) to end every attack and rally flag at once.
- **Loot:** goods inside a building warbots wreck spill out as a crate pile (`dropLoot`, up to `LOOT_MAX`); idle or
  victorious warbots nearby carry one crate each to their side's nearest garrison and go back for more (`doLoot`).
  Crates left at an Outpost (`b.loot`) are hauled on to storage; a warbot killed carrying one drops it; piles rot
  after `LOOT_TIME`.
- **Walls and Gates (Versus):** in Paths, **Walls** (**X**) sketches a wall line: a Wall on each tile (5 Cement, 40
  armor) and a Gate where it crosses a road (6 Cement + 2 Alloy, 32 armor; tap a planned Wall to make it a Gate).
  They're `prepaid` (paid from storage on Build, no Hauler or road, outside the site limit). Walls block every bot;
  Gates let their owner's bots and road through (`passTile(t, who)`). Armed enemy warbots plan through a Wall or
  Gate as if it were `BREACH_COST + armor` tiles long, so they go round a short way or stop and shoot through
  (`breachHit`); a bot whose route gets walled off re-plans (`blockedStep`). On Chokepoint maps the AI walls its end
  of the pass on Normal and Hard (`aiWalls`).
- **Garrisons:** tap an Outpost or your Command Base to set its **garrison priority** (new warbots, and ones called back
  from a flag, fill High garrisons first and Low ones last) or to **station warbots** there: choose how many and they
  march over from your other garrisons (each keeps one at home) and stay until you move them.
- **Rival personalities** (`PERSONALITIES` in `js/defs.js`, applied by `aiStyle`/`aiLevel` in `js/ai.js`): each scales
  the difficulty's grace period, attack threshold, army growth and raid rate. **Balanced** is the plain AI. **Turtle**:
  later and bigger attacks, rare raids, a square ring of Walls and Gates six tiles round its Command Base
  (`aiTurtleWalls`) and a turret more every four minutes (up to six). **Raider**: raids three times as often from early on,
  sending every warbot it can spare. **Rusher**: attacks early with a fast-growing army. **Tycoon**: its bots work 15%
  faster (`econ`), it builds extra Smelters and Chip Fabs and goes for Missile Silos (up to three) once its Bot Foundry
  runs. With Random each rival gets a different one, picked from the seed; missions use Balanced. The landing messages
  and the rival Command Base's panel name it.
- **Wildlife** (Colony; `WILD` in `js/defs.js`, `updateNest`/`updateCritter` in `js/sim.js`; new-game option, on by
  default, never in missions): one creature nest per `WILD.perTiles` tiles (3–8), owned by `WILD_OWNER` (the empty
  second player slot of a Colony game), at least 16 tiles from the landing site and reachable on foot. Each keeps
  `guards + level` Scuttlers on guard and from `WILD.first` (7 min) sends a pack every 260–400 s at the nearest building,
  road or bot the colony has within `WILD.reach` (24) tiles: Scuttlers (6 hp, bite 1) go for bots in the open; Brutes (24 hp,
  bite 3; from level 2) tear up roads and batter buildings (never below 1 armor; construction sites are wrecked). Nests grow a
  level every `WILD.grow` s (to 3); packs grow with the colony (`perBuildings`). Turrets, garrisons and warbots treat
  creatures as enemies; warbots clear a nest (`clearNest`: its hoard spills as loot, its creatures scatter). Nothing can be
  built within `WILD.clear` tiles of a nest.
- **Research** (Colony; `TECHS` in `js/defs.js`, `startResearch`/`updateLab` in `js/sim.js`): a Research Lab (staffed)
  researches one upgrade at a time, cost paid on start (Cancel refunds), progress `dt × mult` per staffed Lab. Upgrades:
  Cargo Racks (`botCarry`), Long-life Cells (`drainMul`), Fast Charging, Rapid Paving, Sentry Optics (`turretRange`,
  `shotsPer`), Turbo Motors (`speedMul`), Power Tools (`mult` × 1.15), Nanite Repair (`naniteRepair`).
- **Planet events** (`EVENTS` in `js/defs.js`, `updateEvents` in `js/sim.js`; new-game option, never in missions): the
  first after 8 minutes, then one every 5–8 minutes, never one of the last two again, most with a 20 s warning. **Dust
  storm**: bots at `DUST_SPEED` (⅔) and every missile grounded (`missileBlocked`, `nukeBlocked`). **Meteor shower**:
  `METEOR_HITS` strikes on each colony's share (mirrored with two players, turned with three: `meteorPlan`), each
  cratering roads (re-planned at once if the Cement allows), denting buildings and bots (never below 1 armor) and
  leaving a rich Ore or Crystal deposit (Uranium sometimes in a Nuclear race). **Solar flare**: battery drain ×
  `FLARE_DRAIN` (2). **Trader ship**: 75 s; offers the raw good that runs out (Ore, Crystal, Stone or Crude: the one
  lowest in stock plus deposits left on your land, `TRADE_GET`/`TRADE_LEFT`) for a good you hold well over
  `TRADE_KEEP` of (never Chips, Ammo or Missiles) at `TRADE_BONUS` (1.3×) its worth; the AI takes its deal when short.
  An event card under the top bar shows it with a countdown and the Trade button.
- **Missiles** are built at a Missile Factory (2 Alloy, 1 Chip and 1 Fuel each, 20 seconds) and carried to Missile Silos
  by haulers. A hit does 24 damage, which wrecks most buildings outright, plus 5 to other rival buildings and 9 to bots
  within 2.2 tiles. Outposts and Command Bases drop to almost no armor; warbots still have to walk in and capture them.
  A Silo is drawn with its launch pit empty until it's ready to fire (loaded and not reloading; a Nuclear Silo once
  armed), then the missile fades in (`siloRise`; art `silo-empty`, `nukesilo-empty`).
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
- **Demolishing** returns half a building's materials, and anything inside it goes to the nearest storage (a Silo's
  Missiles, a Nuclear Silo's finished missile as its parts).
- You can only build inside your border. Outposts push it out (7 tiles around them).
- **Salvage:** a colony out of Stone or Fiber with no Quarry or Harvester that can still work salvages 1 every 20 s from
  its Command Base (up to 6), so it can always rebuild. Capturing an enemy Outpost takes its land,
  and enemy buildings left outside their border are lost.
- **Controls:** drag to pan, pinch or scroll to zoom, tap anything to inspect it. Wheel deltas are normalised and capped
  per event (smooth on a Magic Mouse or trackpad); a Ctrl + wheel pinch zooms faster, a sideways swipe or Shift + wheel
  pans, and Safari's trackpad pinch (`gesture*` events) zooms the map instead of the page. Drawing resolution is capped
  at `RENDER_BUDGET` pixels (about 4K; a 5K iMac at 2× would be four times the work) and `watchFrameRate` lowers it,
  down to 1×, if frames run below ~45 a second.
- **Game speed:** the speed chip in the top bar opens 0.75×, 0.875×, 1×, 2× and 3×.
- **Sound** (`js/audio.js`, all Web Audio, no audio files): a generative synthwave score that follows the game (menu,
  building, war when you're attacked or fighting, and an alarm while a nuke flies), written a bar at a time from chord
  progressions, arpeggios, bass, drums and short melodies in 8-bar sections. Effects include radio blips for orders, a
  nuke siren and blast, and sounds from the map when on screen (traffic hum, welding, concrete, asphalt, truck air
  brakes and horns, biome wind, jungle birds and insects). Music and Effects volumes are in the pause menu.
- **Desktop (RTS controls):** on a wide screen the top bar is one row, the tools sit in a small dock and panels open
  on the right. Drag a box to select warbots (Shift adds; a box round a garrison takes its spare warbots), right-click
  ground to hold it, a rival building to attack, or your garrison to station them. Ctrl/Shift+1–9 saves a control
  group, 1–9 recalls it (twice jumps to it). Pan with **WASD** or the arrow keys, the window edge, or right/middle drag; hover for
  tooltips. Keys: **B** build then a building's key (a letter, or 1–7 for Smelter, Bio Farm, Roadworks, Depot, Ropeway, Rail
  Station and Research Lab, so WASD keeps panning; or **B R** to start laying roads), **R** (or **P**) opens and closes Paths
  and inside it picks a tool (**R** roads, **G** bridges
  and tunnels, **V** ramps, **E** pave, **O** one-way arrows, **L** junctions, **X** walls, **T** traffic map), **Q** army, **C** recall all warbots, **F** select all warbots, **J** latest alert,
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
Turret, goods icons and a few terrain pieces. The biome art is in `art/biomes/` (six plants per biome with their
shadows baked in, and the Jungle and Polar ground, water, rock and cliff), and the Red desert ground, water and rock
are 512×512 (one image per 4×4 tiles, sharp on the zoomed-in map); all WebP to keep the single-file build small. The app icon is in `icons/`. Anything without an image falls back to placeholder art drawn in code, so new art can be
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
js/missions.js            mission campaign: goals, hand-placed map features, progress
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
