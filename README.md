# Terrafall

A colony and logistics strategy game that runs in the browser, on phones and on desktop widescreens. Your robots land
on a dusty alien planet: gather resources, link them into supply chains with a network of roads, build more robots and
spread across the map. Roads are the heart of the game: Haulers only drive on them, so where your roads go decides
how goods move.

- **Versus:** race a rival AI colony across the planet. Capture its Command Base to win (about 20–40 minutes).
  The rival is **Easy**, **Medium** (between Easy and Normal), **Normal** or **Hard**, and has a **personality**
  (Rival style: Balanced by default, or Random, Turtle, Raider, Rusher or Tycoon; see below).
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

Before each game, the new-game screen picks the mode, players and rival, the **map shape** (Standard, Long haul,
Chokepoint, Islands, Crater, Plateaus, Sky islands, Rift, Ring valley, Oases, Crossroads or Lakes, as buttons with a line
on each) and the **map size** (Small to
Huge). **More settings** (a collapsible section, its summary listing whatever isn't the default) holds the planet
number, the **biome** (Red desert, Jungle or Polar: scenery only, with plants that roads and buildings clear), the
**terrain** (Flat, Gentle, Rolling, Rugged, Mountainous), the **resources** (Scarce to Abundant), the **rival style**,
and switches for the **Nuclear race** (on by default), **Planet events** (off by default), **Wildlife** (Colony; on by default),
**Day and night** and **Unlimited resources** (a testing switch: `unlimitedTopUp` keeps your Command Base at
`UNLIMITED_STOCK` of every good and fills whatever your buildings are waiting for, once a second). Resources come in separate
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
| Quarry | A worker breaks boulders into **Stone**; with none left it cuts Stone from a rock face in reach, or digs it (never runs out) |
| Ore Mine | A worker digs **Ore** from dark veins, two at a time (`dig`) |
| Crystal Tap | A worker taps violet clusters for **Crystal** |
| Grove Planter | A worker plants new stalk groves |
| Smelter | 2 Ore + 2 Fiber → 3 **Alloy** (15 s; it keeps 6 of each on hand, `hopper`) |
| Chip Fab | Crystal + Alloy → **Chip** |
| Bot Foundry | Alloy + Chip → a new **Worker** or **Warbot** |
| Outpost | Expands your territory and garrisons Warbots |
| Pulse Turret | Turns to aim and shoots enemy bots; uses Crystal as ammo |
| Bunker | A pillbox for 2 warbots who fire out (3½ tiles) with their own Ammo; claims no land; wrecked, not captured |
| Disruptor Tower | A pulse every 2½ s drains 10 battery from enemy robots within 4½ tiles; 1 Fuel per 4 pulses |
| Mortar Pit | Shells where enemies bunch up, 3–10 tiles out: 6 damage, 3 within 1½ tiles; 3 shells per Ammo |
| Depot | Extra storage, shortens hauling trips; give it supply orders to stock it as a forward base |
| Ramp | Planned in Paths: cuts a slope into a one-level cliff so bots can climb it; counts as road |
| Fuel Station | Recharges bots' batteries, four at a time; burns **Fuel** |
| Bio Farm | A worker plants energy crops on fertile soil and harvests them into **Fuel** |
| Oil Pump | Built on an oil seep; a worker pumps **Crude** until it runs dry (stops at 30 Crude by default) |
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
| Ropeway | Two stations joined by a cable straight across cliffs, water or rock; light bots ride it |

- **Cement builds the colony.** Nearly every building costs Cement, and so does every road. Only the Quarry (2 Fiber)
  and the Cement Works (4 Stone, 2 Fiber) are built from raw materials, so you can always restart. Stone goes into
  Cement (2 per Stone) and new Cement Works. You land with 24 Cement, 8 Stone, 16 Fiber, 8 Alloy, 4 Chips, 4 Crystal and 10 Fuel.
- **Stock limits:** tap a production building and set when it stops: once you have that much of its product it takes
  no more inputs and its worker goes off to other jobs until it's needed again. By default the Cement Works stops at
  40, the Refinery and Oil Pump at 30, the Ammo Plant at 24, the Asphalt Plant at 20, the Chip Fab at 10 and the Missile
  Factory at 4 (so Chips and Ammo don't swallow the Foundry's Alloy); the rest have no limit until you set one.
  Gatherers and Bio Farms have none (they make no recipe): pause them if their goods pile up.

- **Workers and Haulers:** Workers run buildings (one inside each production building), go out to cut, dig and mine,
  and build construction sites. They can go anywhere, but off the road they move at 40% speed, except while out
  gathering for their building. **Haulers** move every good between buildings (except Crude and Fuel: see Tankers),
  two at a time, and **only drive on roads**. If every Hauler is lost, workers carry goods slowly until the Foundry
  makes more. **Agribots** run Bio Farms and Grove Planters, **Pavers** run the Roadworks and **Warbots** fight. You
  start with 10 Workers, 5 Haulers, a Tanker and an Agribot (plus 4 Warbots in Versus).
- **Every building needs a road to storage.** Your Command Base starts with a ring of road around it; join each building and construction
  site to that network (or to a Depot on it), or Haulers can't bring it materials or collect its goods. A red road badge
  marks buildings with no road: tap one and press **Lay road** to plan the shortest route (shown dashed), or plan your
  own. Placement keeps a side of every building open for a road.
- **Planning roads:** in Paths, dragging and tapping only sketch a road (and tapping a road marks it to take up);
  the banner, at the top of the screen, shows the cost, with **Undo**, **Clear** and **Build**. Nothing is spent until
  Build. Building closes Paths, straight back to the map; leaving Paths any other way drops an unbuilt sketch.
  Arrows and Junctions still act at once. **Ramps** are planned in Paths too (tap the foot or top of a one-level
  cliff, or just drag a road or track up it: `dragCliff`) and count as road once built.
- **Roads through Outposts:** an Outpost can stand on a road, and its tile joins the road network. Like a Gate it only
  lets its owner's bots through (`passTile`); an armed enemy warbot breaks in (`breachable`), which captures it.
  Bots follow roads round corners (no diagonal shortcuts on or off a road).
- **Your robots:** tap the robot counter in the top bar for every robot by type and what they're doing.
- **Bot Foundry build order:** its panel lists every bot type with ▲ ▼ arrows to move it up or down (`b.order`,
  `foundryList`, `moveFoundryOrder`), and a choice of **Take turns** (one of each ordered type in turn, in the list's
  order) or **Top of the list first** (`b.omode = 'first'`: every bot of the top ordered type before the next). The
  type being built is highlighted. The AI keeps the default order, taking turns.
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
  3 Alloy): one road passes over the other and nobody slows or waits. Tap again to clear it. Short of goods, a tap
  plans the light or overpass instead (`S.junPlan`, a `'j'` entry in `S.planQ`): it's paid all at once when the goods
  are in (oldest plans first) and goes up then; a light already standing keeps working while its overpass waits, and its
  Alloy counts toward it (`junPlanCost`). Calling a plan off gives nothing back; the AI pays up front.
- **Traffic map:** **Traffic map** in the Paths banner (or **T**) tints each road green to red by how busy it has been
  over the last minute and rings the spots where bots stand waiting.
- **Long hauls:** tap a Depot and set **supply orders** (how much of each good to keep there). Goods come from your other
  storage, and anything nearby then draws on the Depot. Who carries what (see the comment above `TRUCK_MIN_DIST` in
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
  passes underneath. The deck, piers and girders are drawn each frame (`drawViaductDeck`). On Sky islands both ends must be
  mesa tops (level 3+), so a Viaduct never reaches the floor or its low rises. A far end may land on
  no-one's land or in a rival's (a bridgehead); `computeTerritory` keeps a Viaduct while either end stands in its
  owner's land (or the abutment is on no-one's), and takes it down once neither does. When one comes down, `offDeck`
  moves any bot on its deck to the nearer end, and a bot whose route jumps a Viaduct or Ropeway that's gone drops the
  route and its order (`moveAlong`). `roadSearch` crosses Viaducts, so roads (and the AI's) reach sites on far mesas,
  and `wouldBlock` / `canPlace` treat Outposts and Viaduct ends as walkable. A far end claims the no-one's ground
  within `VIA_CLAIM` (3) tiles, never anyone's land, so a new mesa can take an Outpost. A bot out on a deck keeps
  `u.deck` (the two ends) until it reaches one, so a new order or a chase starts from the deck, not the ground below.
- **Ships and Ports** (naval maps only: Islands and Lakes, `naval` in `SHAPE_PRESETS`, `navalMap`; `NAVAL_ON` switches them
  off everywhere): a **Port** (8 Cement, 3 Alloy; Build → Move) is storage on land beside water at least `SEA_MIN` (20)
  tiles big (`portDocks`; `seaNet` labels the bodies of water). Ships come from the Bot Foundry and put to sea at the
  nearest Port (`deliverShip`); they sail open water by `seaRoute` (8-way A*, never cutting a corner of land, under
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
  beside whichever enemy building it can reach that's least guarded (`aiNaval`). The art is top-down like the trucks
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
  across a one-level cliff with no Ramp says to build one there. Rail Stations stand beside the track;
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
  **Islands** (a taller map) puts each base on its own island, with two or three medium islands in the middle (by
  the seed: a facing pair, or one in the middle and a pair out to the sides; one on a Small map; for a free-for-all,
  three between the homes out toward the rim, sized to leave as much sea as a two-way map, round an islet in the
  middle) and a couple of little islets, at least `ISLE_GAP` (4) tiles of sea apart (5 to 8 bridge tiles), so a crossing is a long, dear bridge (`bridgeMul`) or a ship; the AI bridges toward its rival
  (`aiBridge`) and makes beach landings (`aiNaval`: its landed warbots march on once the beach is clear, idle ones
  across the water go after the nearest enemy building there, and with the enemy's army nearly gone it lands by the
  enemy Command Base; warbots stranded across the water out of Ammo don't stop its Foundry, as unarmed ones at home
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
  climb, a valley running round it on each side (a long tunnel is the only shortcut); **Oases** is a barren,
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
  and crags so a Viaduct can start or land anywhere on it. Each home mesa is topped up to at least 10 Ore and 8 Crystal tiles (a
  compact field 5–7 tiles out, placed the same for every side), and Ore, Crystal and Stalk on the mesas hold
  `SKY_RES_MUL` (1.8) times the usual amount, since half the fields fall into the canyons (`richRes` scales its mark to
  match). The floor gets low rises, rock formations, plants and a thin scatter of boulders and ore. Viaducts
  cross between the clifftops; the AI finds one with `aiViaductSpot` (only spans that bring it closer to its rival),
  puts an Outpost on each mesa it lands on, and rests its Ammo Plant and Chip Fab (and, with a fair army, its Foundry)
  while it saves the Alloy for the next span. (`T_CHASM`, the old bottomless canyon, is kept for old saves and is the Rift's chasm.)
- **Shooting across a canyon:** a warbot that can't close in shoots from up to `WARBOT_RANGE_BLOCKED` (2.2) across
  a building or cliff, and up to `WARBOT_RANGE_GAP` (3.6) from a clifftop across lower ground (`overGap`: a narrow
  canyon with no rock, water or building in the line), so garrisons facing each other across a Sky islands canyon
  fight instead of standing off.
- **Loitering:** a warbot standing still in another player's territory for more than `BATTERY.waitGrace` (15 s) drains
  `BATTERY.warbotWait` a second; once flat it gives up its attack, or leaves its rally flag, to recharge at home.
- **Raids:** armed warbots holding a rally flag in enemy land with nothing to fight tear up enemy roads (not bridges or
  tunnels, which only a Missile can crater) near the flag,
  one tile per 12 warbot-seconds. The rival raids your busiest road clear of turrets and garrisons every few minutes
  (Easy rarely, Hard often; a Raider far more) once it has warbots to spare. Missiles crater the roads where they land.
- **Warbot movement:** warbots don't queue in road traffic, give way at junctions or stop at red lights (they still wait
  for trains), and nobody queues behind one, so a squad marching along a road or massing at a Gate it means to break
  down all keeps going (and all shoot). Chasing a foe, a warbot goes straight only when the whole line to it is
  walkable (`clearLine`); otherwise it follows a route (`viaT`: committed for 1.5 s, re-planned only when the foe moves
  off its end), gives up on foes that are only reachable the long way round (more than 3 times the distance) or not at
  all (left alone for 12 s, unless they come within shooting reach), and squads holding one spot edge apart
  (`spreadOut`) instead of stacking on a single point.
- **Traffic:** bots queue on roads, each waiting behind the bot ahead of it going the same way. On two-way roads each
  direction keeps to its own side, but passing oncoming traffic slows bots down. Switch the Paths banner to **Arrows** and
  drag along a road to point it the way you drag (tap a road to turn its arrow). One-way loops keep busy routes flowing;
  going the wrong way up a one-way road is allowed but crawls.
- **Goods panel:** tap a goods counter in the top bar for that good's stock, production and use per minute, net rate,
  which buildings make and use it, and any shortfall (buildings waiting on it with none in stock). Switch goods at the
  top of the panel.
- **Ammo:** warbots carry 10 shots (each Ammo reloads 5) and reload in your Command Base and Outposts, which haulers stock from an Ammo Plant. Out of
  ammo, a warbot can't fight at all: it heads back to a garrison to reload, and only armed warbots answer orders.
  A rival's empty warbot sitting in a garrison with no Ammo and none on the way (an Outpost no road reaches yet)
  goes to reload where there is some and keeps away from that one for 90 s; yours stay where you posted them.
- **Rival boost (hidden):** tap the clock three times quickly, or press **`**, to give a rival a supply drop, 4 armed
  Warbots or 3 Workers at its Command Base (`BOOST` in `js/defs.js`, `boostRival` in `js/sim.js`), for a game you're
  winning too easily. The game pauses while it's open.
- **Repairs:** nothing heals by itself. Damaged bots go to a Repair Station (workers below 60% health, warbots below
  70% once their garrison is quiet; Colony free play too), which uses 1 Alloy per 12 health. A warbot below 35%
  (`REPAIR_RETREAT`) on an attack, a rally flag or a sortie pulls out of the fight for repairs when a Repair Station can
  fix it (otherwise it fights on), takes no new fights on the way (`u.retreat`), and goes back to its attack or flag
  once mended (`u.resume`, `resumeAfterRepair`; the flag stays up meanwhile, and Recall cancels the return). Haulers keep up to 3 Alloy
  in it, and an empty one gets the first Alloy that reaches storage (like an empty Fuel Station's Fuel). To fix a building, tap it and press **Repair**:
  you pay 1 Cement for every 6 missing armor and a free worker restores it.
- **Statistics:** the pause menu and the end-of-game screen show graphs of bots, land and goods over time and how busy
  each kind of building was; each building's panel shows its recent busy time.
- **Terrain levels:** the planet has terraces at different heights (lighter ground is higher). Bots
  can't climb cliffs; they use slopes at narrow passes, so some routes are long. Pave busy routes with
  Paths (slopes too) and build a **Ramp** (Paths, Ramps) on the top or at the foot of a cliff to open your own way up or down. Its worker builds it from whichever side of the cliff is the shorter trip (`rampStand`: the Ramp's tile or the ground across the cliff, `rampSides`), so a Ramp down off a plateau is built from the top, and its foot can even be ground no bot can reach yet. Buildings can't be placed where they
  would block the only way through a pass.
- **Priorities:** tap a building or construction site and set it to Low, Normal or High. High-priority
  buildings get workers and goods first; low ones are served last and lose their worker first when
  workers run short. A priority set on a construction site ends when it's built (back to Normal). **Pause** frees a building's worker entirely. A Generator, Mortar Pit or Pulse Turret can be **turned off** (`pausable`, `setPaused`): it burns no Fuel, or holds its fire, and nothing more is hauled to it until it's back on.
- **Storage:** tap your Command Base or a Depot. *Fill first* makes haulers bring finished goods there before
  any other storage; *Empty out* takes nothing new and moves what it holds elsewhere (handy before
  demolishing it). You can also switch individual goods off for that building.
- **Minimap:** tap or drag it to jump around; red pulses mark buildings under attack. The × hides it.
- **Sharp map:** the map is baked once at 32 px a tile for zoomed-out views; zoomed in, the part on screen is baked
  again in 8×8-tile chunks at 64 or 128 px a tile (a few per frame, least recently seen dropped), and big art images
  keep half-size copies so they shrink cleanly (`drawMapLayer`, `artMip` in `js/render.js`).
- **Batteries:** bots drain their battery walking, working and fighting, and recharge only at a Fuel Station (or,
  for warbots, inside an Outpost). The Command Base doesn't charge anyone and you land without a Fuel Station, so
  build the first one straight away (it runs on the 10 Fuel you land with). A flat battery means half speed and half power. Fuel Stations burn Fuel (one Fuel is about
  two and a half full charges, `FUEL_ENERGY`). A Bio Farm makes about
  2–3 Fuel a minute; an Oil Pump and Refinery up to 10 a minute until the seep runs dry (both stop at 30 by default).
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
  together in its build time while the old one keeps working, and `finishMove` hands over its goods, settings
  (`MOVE_KEEPS`) and stationed warbots, then takes the old one down quietly. Calling the move off, demolishing either
  end or losing the old one takes the site down (`cancelMove`), so no building comes free.
- **Saved planets:** **Save** beside the planet number (More settings), or **Save this planet** in the pause menu, keeps
  the seed and the settings that shape the map (shape, size, terrain, resources, biome, players) on this device
  (`terrafall.planets` in localStorage, newest first, up to 40). Tap one in Saved planets to set the menu to it; ×
  forgets it (`savedPlanets`, `renderPlanets` in `js/ui.js`).
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
  **Pipelines** (Paths → **Pipes**, K) carry Crude only. Drag from an Oil Pump to a Refinery and the pipe routes itself
  (`pipeRoute`: inside your border, over roads and track, under buildings if it must, up cliffs, across water on stilts
  and bored through rock at `PIPE_CROSS_COST` (1.2 Cement) a tile, weighed by price so it goes round only when that's
  cheaper, with few bends); tap a
  pump to pipe it to the nearest Refinery, or **Pipe every Oil Pump** in the banner; an Oil Pump's panel has a one-tap
  **Pipe it to the Refinery** too. Pipe costs 0.3 Cement a tile (`PIPE_COST`), laid at once when you tap Build (or as
  the Cement comes in). A pipe joins every building it runs under or beside; each second each line moves up to 4 Crude
  (`updatePipes`) from its pumps to its Refineries (which keep up to 6) and Asphalt Plants, then into storage on it, and
  from storage on it to its Refineries. A piped pump never waits for a Tanker. Raiders cut pipe (it counts like a road
  for them), missiles and fuel blasts break it; broken pipe is planned again at once and relaid when it's paid for.
  **Trucks burn Fuel** (`TRUCK_BURN`): Freight Trucks, Road Trains and Tankers have a fuel tank instead of a battery,
  draining as they drive (a full tank lasts about 4 minutes of driving, a Road Train's under 3); low, they fill up at the
  nearest storage or Fuel Station holding Fuel (one Fuel fills the tank). With no Fuel anywhere they crawl at half
  speed. A **Generator** (Build → Make) burns a Fuel every 40 s while anything in its reach is working, and makes every
  factory, Refinery, Oil Pump and Foundry within 4 tiles work a third faster. Selected (or while you place one) it
  shows its reach as an amber ring, with corner brackets and a lightning badge on every building it powers
  (`drawRanges`, `drawBoosted`).
  **Smoke:** trucks puff diesel exhaust from their stacks (light while idling or cruising, thick black smoke pulling
  away), and working buildings smoke and steam from their chimneys (`vehicleSmoke`, `buildingSmoke` in
  `js/render.js`; the points are in `art/emitters.js`). The Generator plays its working loop (`generator-work-0…7`).
  Balance (`fuelprobe.js` AI games over every map shape, 45 minutes): colonies use a bit over half the Fuel they make,
  Fuel Stations stand dry about 2% of the time and trucks run empty almost never; trucks take about a tenth of the
  Fuel, a Generator a fifth where there is one.
- **Army orders:** tap **Army**, then a rival building to attack it with warbots or a missile, or open
  ground to send warbots there to hold the area under a rally flag. Tap the flag to call them back, or press
  **Recall all** in the Army banner (**C** on a computer) to end every attack and rally flag at once.
- **Saving:** the game saves itself every `AUTOSAVE_EVERY` (20) seconds while you play, and when you switch away or
  close it (`autoSave`); Continue on the main menu picks it up. The pause menu says when it last saved, and a failed
  save (storage full or blocked) is reported once. A long game's save is about 250–300 KB.
- **A failed frame never stops the game:** `frame` books the next frame before running this one and catches its errors
  (reported once each to the console). A Missile Silo's placement preview used to throw (`siloReady` on a stand-in
  with no stock), which stopped the drawing loop: the game froze when you went to place one.
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
  (`breachHit`); a bot whose route gets walled off re-plans (`blockedStep`). On Chokepoint maps the AI walls the mouth
  of each channel on its side on Normal and Hard (`aiWalls`).
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
  takes you to each in turn. Garrison priority (High/Low) still orders the AI's and any warbot with nowhere else to go.
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
  Cargo Racks (`botCarry`), Long-life Cells (`drainMul`, and chargers 50% faster; the old Fast Charging upgrade is folded into it), Rapid Paving, Sentry Optics (`turretRange`,
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
  within 2.2 tiles. Outposts and Command Bases drop no lower than `MISSILE_FLOOR` (35%) of their armor; warbots still have to shoot their way in. A fort under `SORTIE_ARMOR` (25%) sends every armed warbot inside out to fight, and capturing one ejects whoever is left inside instead of killing them.
  A Silo is drawn with its launch pit empty until it's ready to fire (loaded and not reloading; a Nuclear Silo once
  armed), then the missile fades in (`siloRise`; art `silo-empty`, `nukesilo-empty`).
  To fire, tap a Silo and press **Aim missile**: its 18-tile range shows as a red ring; tap any spot inside it (a
  building or open ground) to see the blast radius, then **Fire**. (Army → rival building → Fire missile also works.)
- **Nuclear race** (new-game option): six small Uranium deposits glow green across the map. An Ore Mine within 4 tiles
  digs Uranium before ore; a Nuclear Reactor enriches it (2 → 1) and a Nuclear Silo assembles a missile from 6 Enriched
  Uranium, 4 Alloy and 2 Chips (60 s), so 12 Uranium a bomb. It flies 30 s (the target is warned and sees the blast
  ring; the **Evacuate** button on the incoming-nuke card, or the AI by itself, sends every robot in the ring plus
  `EVAC_MARGIN` out of it and holds jobs there until the blast: `startEvac`, `evacSweep`, `doFlee`) and wipes out every building, robot and road within 6 tiles, yours included; a Command Base survives with no
  garrison and 1 armor. The ground stays scorched for 4 minutes: nothing can be built there. The AI races too.
  Tunables: `NUKE` and `URANIUM_DEPOSITS` in `js/defs.js`.
- **Pace:** the whole game runs at 85% speed (`GAME_PACE` in `js/defs.js`) for a calmer feel; the speed button
  gives 2× and 3×.
- **Ordering bots:** the Bot Foundry only builds the bots you order. Tap it and use +1 or +5 for Workers or
  Warbots (Clear cancels the queue); with nothing queued it sits idle and uses no Alloy or Chips.
- The **Build** menu shows how many of each building you already have, and how many are being built.
- **Demolishing** returns half a building's materials straight to the nearest other storage; anything inside it (a
  Silo's Missiles, a Nuclear Silo's finished missile as its parts, a Depot's whole stock) spills out in crates for the
  Haulers to collect.
- You can only build inside your border. Outposts push it out (7 tiles around them).
- **Salvage:** a colony out of Stone or Fiber with no Quarry or Harvester that can still work salvages 1 every 20 s from
  its Command Base (up to 6), so it can always rebuild. Capturing an enemy Outpost takes its land,
  and enemy buildings left outside their border are lost (their goods spill as loot, `dropLoot`; their crew walks out).
- **Controls:** drag to pan, pinch or scroll to zoom, tap anything to inspect it. Wheel deltas are normalised and capped
  per event (smooth on a Magic Mouse or trackpad); a Ctrl + wheel pinch zooms faster, a sideways swipe or Shift + wheel
  pans, and Safari's trackpad pinch (`gesture*` events) zooms the map instead of the page. Drawing resolution is capped
  at `RENDER_BUDGET` pixels (about 4K; a 5K iMac at 2× would be four times the work) and `watchFrameRate` lowers it,
  down to 1×, if frames run below ~45 a second.
- **Game speed:** the speed chip in the top bar opens 0.75×, 0.875×, 1×, 2× and 3×.
- **Sound** (`js/audio.js`, all Web Audio, no audio files): a generative synthwave score that follows the game (menu,
  building, war when you're attacked or fighting, and an alarm while a nuke flies), written a bar at a time from chord
  progressions, arpeggios, bass, drums and short melodies in 8-bar sections. Effects include radio blips for orders, a
  Pulse Turret's tesla-coil discharge (a short charge whine, then a buzzing arc crackling with sparks: `pulse`), a
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
  **H** base, **[ ]** speed, **+/−** zoom, **M** minimap, **Space** pause, **Esc** back / clear selection, **Alt+Enter**
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
`turret-charge-0…15`, and the beam leaving the barrel tips in `PULSE_MUZZLES`), the electrified Walls and Gates
(`drawBarrierArt`: posts, arms, hubs and gates layered per tile, sparks crackling along them now and then), the
Viaduct's abutment tiles (`viaduct-abut-*`) and the working loops of the Oil Pump (its beam nodding over `pump-base`),
Refinery and Smelter. Still to make: goods icons and a few terrain pieces. The biome art is in `art/biomes/` (six plants per biome with their
shadows baked in, and the Jungle and Polar ground, water, rock and cliff), and the Red desert ground, water and rock
are 512×512 (one image per 4×4 tiles, sharp on the zoomed-in map); all WebP to keep the single-file build small. The app icon is in `icons/`. Anything without an image falls back to placeholder art drawn in code, so new art can be
added one piece at a time. See **[ART_GUIDE.md](ART_GUIDE.md)** for specs, the style brief and prompts,
including the remaining pieces (Ramp, slope and cliff textures, goods icons).

Weapon effects are drawn in code: muzzle flashes, tracers, gun smoke, dust kicks and bullet pockmarks round each
target (sparks on buildings), the Disruptor's arcs, and blasts with a fireball, flying debris, smoke and a scorch mark.
A destroyed building shakes, leans and sinks into the ground in a dust cloud, with secondary blasts, and leaves rubble.
A Pulse Turret charges for 0.45 s before each shot (`PULSE_CHARGE`; the charge builds while it reloads, so its rate of
fire is unchanged), energy gathering at its muzzle, then fires a thick electric beam wrapped in arcs. At night,
streetlights light every third road tile (`drawStreetLights`): sodium orange over concrete, white over asphalt.
Ground marks fade over a minute or so (at most 350 at once). Each effect can be swapped for a sprite sheet
(`frames` and `cols` in the manifest; `FX_ART` and `DECAL_ART` in `js/render.js`): see ART_GUIDE Batch 15.

## Enabling GitHub Pages

1. In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. The workflow in `.github/workflows/pages.yml` publishes the game on every push to `main` or to the development
   branch `claude/elegant-cori-a8yj96`. To publish right away without a push, open **Actions → Deploy to GitHub Pages →
   Run workflow**.
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
  next one over a transition (`todVariant`); only the sets in use now and next are loaded (`todFrame`). The single-file
  build puts each set in a bundle beside the page (`dist/tod-<time>.js`, loaded when needed).
- **Graded in code** (`out = in × multiply + add`, values from the kit's `art/tod/shared/time-of-day.json`): the baked
  ground, roads, track, pipes, plants, resources and territory tint (`todGradeGround`), and any sprite without a
  re-lit version or whose set hasn't loaded yet (`todGraded`). Tile art drawn over the graded ground (bridge piers,
  towers and cables, Viaduct decks, level-crossing barriers) goes through `withTod`, like `drawArt`. Light overlays (brake lights, boost glow,
  lamps), the UI and nuke blasts are never graded.
- **Evening and night:** vehicles' headlights (`drawHeadlights`, the kit's overlays at 3× the sprite), a glow in team
  colour under every finished building (`drawLightPool`; small ones along Walls, bigger at Gates), a searchlight
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
js/charts.js              line and bar charts for the statistics screen
js/render.js              canvas renderer and placeholder art
js/daynight.js            day and night: the clock, re-lit art sets, grading, headlights, light pools
js/input.js               touch and mouse controls
js/ui.js                  HUD, build menu, info panels, objectives
js/audio.js               synthesized sound effects
js/main.js                boot and main loop
art/art-manifest.js       register custom art here
tools/headless-sim.js     AI-vs-AI balance test without a browser
tools/smoke-test.js       browser test on a phone-sized screen (Playwright)
tools/build-single.js     bundles everything into dist/terrafall.html (and dist/tod-<time>.js)
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
- Custom art for goods icons, menus and effect sprite sheets (ART_GUIDE Batch 15)
