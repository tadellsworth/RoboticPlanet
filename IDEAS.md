# Ideas waiting their turn

Notes on features we've talked about but not built yet. (The nuclear race, desktop RTS controls, road maintenance
and biomes started here and are now in the game.)

## Built in November: city layout and a siege gun

Feed links (a factory beside its supplier is fed straight across), the Keep (a fortified base whose aura
toughens Walls and defences), the Rocket Truck (a mobile siege launcher between the Mortar and the Silo) and bulk
trade (the Trade Terminal: full lots by Road Train or Freight Train at below-cost rates) are in the game; see the
README. The Terminal ended up a building each colony puts up itself, 16+ tiles out, rather than a neutral one on
the map edge: roads and track can't run outside your border, and this way it's fair on every map shape.
Still open: a neutral, shared exchange the rivals compete over; contracts for Chips or Ammo.

## Held for later

- **A hauler turned back by raiders can still pass close to them** (a known edge case): a hauler with a load turns
  back before rival warbots on the road ahead, but on some maps the only other way to storage runs back past them
  (within about 2 tiles), and a worker caught at a site can fail to find cover. Seen with the foe-shy test's scenario
  on seeds 4242 (after the Fuel batch changed how the rival builds) and 4243 (before it); the test now plays seed 4244.
  A fix would have the hauler hold position or wait for the road to clear when every way home passes the threat.

- **A passive rival never trades, builds a Port or a Howitzer, or raids** (to decide): `P.passive` (an early
  mission's rival, on Easy) returns from `aiThink` before the missiles, and everything after them is skipped too:
  the Port, Ferry and landings (`aiNaval`), Howitzers, the Trade Terminal's contracts (`aiTrade`), the Vulcan Bomber
  and supply raids. "It builds, grows and defends, but never strikes first" reads as if only the strikes should go;
  moving the Port and the trade above that line would let a passive rival on an island map, or short of Crystal, still
  grow. It changes the early missions' rivals, so their mission runs would want checking.

- **The first pair wins most 2 vs 2 games, on every map** (to decide). Computer-only 2 vs 2 games, every rival
  Balanced and none held back: players 0 and 1 won 10 of 12 (Long Haul 2v2 4 of 4, Twin Valleys 3 of 4, Crossroads 3
  of 4); by chance on fair maps, about a 2% outcome. The maps are fair (Long Haul 2v2 checked tile for tile against
  each tile's twins, its Trade Posts in fair pairs), so it's the order of play: players 0 and 1 think first each tick
  (only one rival AI thinks in a step, ties going to the lowest number), and their robots, made first, move and shoot
  first. In single player that quietly helps the person's side (player 0 and the ally, player 1). A fix would take turns
  (start each tick's robots and AIs from a different player, or run them forward one tick and backward the next); it
  changes every game's course, so seed-pinned tests would need new seeds.

- **Co-op scenarios** (the owner's idea, Nov 17; decided: the single-player campaign is built first, then these; to
  brainstorm then). Two players together against the computer, as
  a multiplayer mode of its own, not the main campaign played by two: a set of 2-player scenarios on the campaign's
  maps and rivals, with goals made for two. One builds while the other fights; two fronts at once; one runs the home
  economy while the other pushes Depots to the front; escorting each other's trade convoys; a Holdout held together.
  Kept apart from the solo campaign because its story is one Command Base's (the last reserve on COBALT's Carrier) and
  every mission would need balancing twice; a finished solo mission could unlock its co-op version. It builds on Teams
  (any mix of people and computers), lockstep multiplayer and the mission system; new are missions that run in
  multiplayer (goals shared or each player's own) and a scenario picker in the lobby. Comes after the campaign. Related:
  Shared colony co-op (two players, one colony) in the November review list.

- **More map shapes** (Rift, Ring valley, Oases, Crossroads and Lakes are now in the game; each would be a
  `SHAPE_PRESETS` entry with its own step in `shapeExtras`, mirrored for fairness like the others):
  - **Terraces:** the land climbs in steps toward a summit in the middle, a ramp or two per step, the richest fields
    (and a Nuclear race's Uranium) on top. Whoever holds the high ground sees and shoots down onto the rest.
  - **Twin rivers:** two rivers run the length of the map, splitting it into three lanes joined by shallow fords
    that bots wade slowly (and that a Planet event can flood). Bridges are worth their price here.
- **Interchanges.** An overpass is a grade-separated crossing: both roads run straight through it and nobody turns
  there (turning traffic goes round by another junction). Still open: an interchange, an overpass with slip roads (a
  bigger footprint, dearer) that lets traffic turn without stopping; and whether the rival should put overpasses on its
  busiest crossings (it builds neither lights nor overpasses today).
- **Recycling: open questions.** (Settled: a robot is taken apart standing at the Foundry, 2 s a round of parts, while
  the Foundry carries on; a damaged one gives back as much as a sound one, since most give back a single Alloy.) Still
  open: planes, ships and trains can't reach a Foundry, so they can't be recycled: should their own yards (Airfield,
  Port, Rail Station) take them apart instead? Recycle spare Workers has no Hauler counterpart for players (the rival
  scraps both): wanted? Should the rival also scrap other spares (Freight Trucks with no Depot to run, an Agribot with
  no farm)?
- **Fuel.** Built: Tankers, explosions with chain reactions, Crude and Fuel pipelines, the Generator and trucks burning
  Fuel, and the rival keeping its Fuel up (Bio Farms first when it runs low, an Oil Pump and Refinery once its Foundry
  is up). Still open: a Generator that explodes too.
- **Ships.** Ports, Container Ships, Tanker Ships, Ferries and beach landings are in the game, and the rival keeps a
  forward Port stocked by Container Ship. Still open: a gunboat or patrol boat to escort ships and shell the shore
  (held back for now); the rival running ferry lines.
- **Air (after ships).** An **Airfield** (done, with the Cargo Plane and air drops), a **Vulcan Bomber** (its look follows
  a Foxbat three-view, mocked up in renderer/b/bomber.js: a long black radome, big box intakes, a broad flat body, a
  43-degree wing with tip pods, swept stabilators, twin canted fins, two big nozzles, bombs under the wings; up to
  two per Airfield beside its one Cargo Plane; the AI never uses the Cargo Plane and should fly bombers only seldom; each hits one target a sortie, then needs a while on the ground to rearm
  and refuel; its bomb is loaded from Ammo at the Airfield, several Ammo a sortie (about 6) for the bigger hit; Flak Guns,
  which shoot regular Ammo, are the counter) for precision strikes (a smaller, faster, cheaper hit
  than a Missile, on a building you pick, or on a moving target such as a Tanker on the road, which then explodes),
  and an **anti-aircraft gun** to shoot it down. Aircraft burn Fuel like ships and trucks (refuelling at the Airfield). To think through: what
  the bomber costs and carries, how far it flies and how long it takes to rearm, how the AA gun trades with turrets
  and walls, and how the AI uses both.
  More aircraft worth weighing once the first three work: a **fighter** (shoots down bombers and escorts its own,
  so the air war isn't only AA guns), a **transport helicopter** (drops a few warbots anywhere, like a beach landing
  but over walls and cliffs, slower and fragile), a **cargo plane** (fast, small loads between Airfields, dear in
  Fuel, for a cut-off island or an Outpost under siege), a **gunship / attack drone** (circles a spot and
  shoots warbots there for a while; close support rather than one strike), and a **radar station** (warns of
  incoming aircraft and lets AA guns fire further). A recon plane only matters if the map ever gets fog of war.
- **Graphics.** A first pass is done (rounded shorelines on ponds, lakes and seas, by day and in the night glow). Rock
  outcrops (crags) stay square: rounded crags were tried in November and the owner preferred the square look. Worth
  another look when new art comes in.
- **Bigger graphics upgrades** (owner: for later, after the Graphics quality setting). Installing the game as a
  desktop app gives it no more GPU than a tab does; Chrome already draws its canvas on the graphics card. For a bigger
  step up:
  - **More detailed art for buildings and robots at close zoom.** Today's sprites are drawn for the usual zoom and
    soften when you zoom right in. Higher-resolution versions would serve High and Ultra. A medium job; see Custom
    art in README.
  - **A WebGL renderer** in place of the 2D canvas. It would bring real lighting and shadows, glow, water
    reflections and thousands of particles. But it means rewriting the drawing side (`render.js`, `daynight.js`,
    `fx.js`), a big project, with the 2D renderer kept as the fallback for phones that can't run it. WebGPU, newer
    still, isn't needed.

- **A Tank Farm: big storage for Crude and Fuel (the owner's idea).** Put up beside a cluster of Oil Pumps (five, say),
  it holds a lot of Crude or Fuel, like a small Depot for liquids only. Today each Pump holds just 6 Crude and a
  Refinery 8 Fuel, so Tankers make many small runs. With a Tank Farm the pumps nearby fill it (by pipe or feed link),
  Tankers and pipelines draw full loads from one place, and a stock of Fuel builds up for trucks, ships and aircraft.
  It is the most dangerous thing in a colony: destroyed (not dismantled), it goes up in a huge fuel blast that grows
  with how full it is, setting off loaded Tankers and Refineries nearby in a chain. That makes it a prize target for
  bombers, missiles and raids, so it needs guarding and room around it. To settle: how much it holds and costs,
  whether it holds one liquid or both, if Fuel Stations and the Airfield draw from it, how big the blast is next to
  the existing ones (Tanker, Refinery), and how the rival builds, guards and hunts it.
  **Oil blocs** (the owner, too): the Tank Farm is the hub of an oil district: the Oil Pumps, the Tank Farm, the
  Refineries and an Asphalt Plant built together as one block. **Oil Pumps pipe into the Tank Farm**: the pipelines
  we have (Paths → Pipes) join it like storage, so a pump's **Pipe it to the Refinery** and the banner's **Pipe
  every Oil Pump** would send Crude to the nearest Tank Farm when there is one; from there it goes on by pipe to the
  Refineries and the Asphalt Plant, and their Fuel comes back into it (feed links where they touch). One choice to
  weigh: packing a bloc tight saves pipe and Tanker runs, but one blast can then take out the whole block.
  To be built here after the work in hand (trade routes, the Murmur), not handed to the other chat: it runs through
  the pipelines, fuel blasts, storage and the rival's oil play.

## Suggestions from the November review (not decided)

From a full review of the game after the audit work was merged. None is planned yet; each is for the owner to pick
or drop.

### Rough edges in what's there
- **Island maps stall.** The leading rival lands six warbots at a time (one Ferry load) and can't break a healthy
  base. Options: back-to-back landings that wait on the beach for the next load, or a staging island it takes first.
- **Free-for-alls run to the cap.** In 3- and 4-player games the rivals don't gang up on the leader or finish off a
  weakened third; most test games on The Wheel, Three Mesas, Pinwheel, Four Isles and Twin Valleys end undecided.
- **Long Haul starts slowly:** both rivals sit at 10 workers until minute 12-15 (a Foundry site waits behind a long
  Outpost road being paved).
- **Doctrine balance and text.** The Herald wins 10 of 12 against the Steward. The Architect's text promises a nuke it
  never builds (no Reactor in 10 Nuclear-race games); the Warden's says it "covers its land with turrets" but it
  builds about 2, all within 5 tiles of its base.

### Helping players see what's going on
- **Replays:** lockstep already makes a game its seed plus its orders. Keep the order list, replay at up to 4x with a
  scrubber: "watch how I lost", sharing, and bug reports that can be played back exactly.

### Reasons to come back
- **Daily planet:** the same seed, map shape and rival doctrine for everyone each day, with a score (time to win,
  robots made) and a local best; the relay could keep a shared board later.
- **More challenge modifiers** (Half Fuel, Endless dust storm, Rival head start, Scarce Crystal, Fragile robots and No
  turrets are built, with badges): still open are no roads over water (no bridges: route planning, the Paths tool and
  the rival's bridging all need to know) and no defences for every colony (the rival's defence planning would have to
  skip them, not only the player's Build menu).

### Deeper play without new systems
- **Truce and tribute in free-for-all:** pay a rival (say 20 Alloy) to leave you alone, or to hit the leader, for
  five minutes. It also gives stalled three- and four-player games a way to end.
- **Veteran warbots:** a warbot that survives fights earns a pip (a little more armor or accuracy), so pulling a hurt
  one back for repairs matters.

### Ten more
- **Holdout:** a survival mode where rival drop pods land every few minutes in growing waves; score is minutes held.
  Reuses drops, Outposts and the siege rules.
- **Map editor:** paint terrain and cliffs, place deposits and starts, and share the planet as a short code (maps
  already come from a seed plus settings; a saved edit layer on top).
- **Accessibility:** a colour-blind palette for player colours, territory and goods; a larger-text setting (the open
  "text size" question); captions for alert sounds.
- **Shared colony co-op:** two players run one colony against the computer, splitting the work (one builds, one
  fights), on the lockstep that's there.

## Trade routes and the finished-goods market (built Nov 2026)

Built as decided (see the README's Trade Terminal row and How to play, Trade routes): one standing route per
Terminal, a run every 2 minutes per Terminal (15 goods out by Road Train or Freight Train, the same convoy back), the
market board (raw goods sell at 35% of their worth and cost 75%, made goods sell at 57.5% and cost their worth, Fuel
half as much again; no raw-for-raw), prices easing a tenth a run and coming back about halfway in four minutes, a
cheaper Terminal (8 Cement, 3 Alloy), the Trade Post's no-fire zone (3 tiles round the pad), convoys with a pennant,
lanes on the minimap, alerts and crates when one is lost, the Escort switch (two warbots), and the rivals docking
from about 8 minutes with Escort on and the Salvager raiding convoy lanes. The *Wren* is unchanged. A new War mission,
*Convoy* (against a Salvager), teaches the route, Escort, wrecking a rival convoy and carrying its crates home.

Kept as built (the owner, Nov 17):

- **Prices.** Raw goods cost 75% of their worth, so a raw-for-made route is a trickle (15 Stone brings back 2.4
  Alloy every 2 minutes; three Terminals selling Stone for 40 minutes earned about a sixth of one busy Smelter) and a
  made good buying a raw one is generous (15 Alloy brings back about 17 Crystal).
- **Docked Terminals can't be attacked at all** (they stand on the no-fire ground); they change hands only with the
  colony.
- **Raiders leave a convoy lane's road be** and lie in wait for the convoys instead of tearing it up (a cut road meant
  no convoy ever came to fight over); raiders on a flag go after an enemy convoy within 6 tiles of it.
- **An escorted convoy holds** while its escort fights instead of turning back; an unescorted one still turns back,
  like any hauler. In nine computer-only games (Nov 17) convoys were hit in five and one or two lost in four; the games
  ran about two minutes longer on average and all ended.

Still open:

- **One market or one each?** Each colony's prices ease only with what it sells; the Post's ledger could keep one
  board for everyone, so rivals selling the same good push its price down for each other. Buying never raises a price.
- **The rivals' escort:** two warbots, as for a person; the plan's "an Outpost on the way" isn't built. Rivals mostly
  run Cement for Chips (one Chip a run), and a Crystal-short one Alloy for Crystal.
- **Ports and ships:** a Terminal is served by road and rail only; a Port-side Terminal (Container Ship convoys) would
  suit the island maps.

## Missions: follow-ups from the tutorial campaign

The campaign is now the tutorial, in seven chapters (see the README). Held back, or noticed while each mission was
built and played through headless:

- **King of the Hill, a bonus mission for Uplinks and free-for-all.** The Wheel, 3 players, rival doctrine Random. Setup
  would set `S.victory = 'uplinks'` and call `placeUplinks(S.seed)` (newGame only sets the victory type outside
  missions); goals: hold an Uplink (counted from `S.uplinks`, owner 0 and not jammed), then win the race.
  `finishMission` would also need `M.why = 'uplinks'` for a rival winning it. Kept out of the campaign until a solver
  shows a three-player Uplinks race can be won; Final Descent only mentions Uplinks and free-for-alls.
- **Walled-in workers.** A Worker who builds a Wall in a narrow channel can end up standing on it, walled in for good
  (Hold the Line). Builders and pavers now skip a worker whose last route failed, so the rest of the work goes on, but
  the worker stays stuck, and planning both rows of a double wall at once can shut the outer row off from every
  builder. Ideas: step the builder off to the home side when a Wall or Gate is finished; build a Wall from its
  home-side neighbour, outer row before inner; or let our own bots pass our own unbuilt Wall sites. A design decision.
- **Salvage that doesn't reach its site.** The Command Base's Fiber/Stone salvage (`landerSalvage`, "so it can always
  rebuild") can go to a running factory that burns the same good before the gatherer site it was meant for (Border
  Dispute on Hard stalled on Fiber until the hook set the Harvester site to High priority). A fix in dispatch: while a
  player is salvaging a good, only sites get it, not built factories. It touches the AI's economy too.
- **A rail-only line.** A far Rail Station needs a road to be built at all (its builders and materials come by road),
  so Iron Road asks for one. Trains bringing a station site its materials would make a track-only line possible.
- **Trade Winds waits for its second event.** Events come 300-480 s apart (`EVENT_GAP`), so a quick player can wait a
  few minutes after the trades. A shorter gap in missions would fix it.
- **Coach rings.** The tutorial's ring can only mark buildings: not a Trade Post (it isn't in `S.buildings`), and not
  the Crawler once it rolls out of the Foundry (the hint says to tap it). For a Container Ship order the ring is on the
  home Port while the supply orders that matter are on the new one.
- **Small counting quirks.** Airlift's "Supply a building by air" ticks when the Cargo Plane loads up (`airAt` is
  stamped in `airSupplyRun`), about a minute before the crates land; and a road to the deployed Crawler can fill its
  supply order by Hauler before a plane is needed. Harbour counts the Container Ship built, not a delivery. Siege
  Breakers remembers the rival forts it has seen in `S.mission.forts`, once a second, so one built and wrecked within
  a second is missed; missiles can do most of that goal on their own.
- **Bombs on a Command Base** didn't visibly dent it in the Final Descent solver runs (armor 30/30 at each minute
  mark). Not needed for the goal, but worth a look with the bombers.
- **Kits and Fiber.** On some seeds the kit's one Harvester has little Fiber in reach and the Smelter burns it as fast
  as it comes; the chapter 3 missions add a Grove Planter (and a second Agribot) for that. Other kits may want the same
  if a slow player runs dry.
- **Mostly waiting.** Breakthrough is mostly research timers, and Assembly Line and Pipe Dreams take a scripted player
  4-7 minutes; their Hard clocks are generous on purpose.

## AI stalemates

The old stall (Smelters "Waiting for Ore" while Ore lay in storage) no longer shows: measured second by second, a
Smelter now waits with Ore stored only while that Ore is already on its way. What did starve the rival was Fuel: its
Fuel Stations went dry around minute 10 and its robots crawled, which starved Fiber, Ore and Alloy in turn. It now puts
Fuel first when it runs low. AI-vs-AI wars on Islands can still run past 40 minutes now and then.

On the maps for three or four (The Wheel, Three Mesas, Pinwheel, Four Isles, Twin Valleys), every colony grows, gets
off its home ground and fights in AI-vs-AI games, and colonies are captured on every one. Fixed after the first runs: the
rival's first Fuel Station went out by an unroaded Outpost site (its robots ran flat; now it goes by the Command Base); the
road planner counted a way through a rival's Outpost, so a site behind one waited for good (and a site the planner and
the Haulers disagree about is given up after four minutes); two Ore Mines went side by side on one small patch (a
gatherer now counts only the deposits none of its kind already works); and the rival spans canyons onto a rival's mesa
or plateau with a Viaduct (see Fortresses in the README). Still worth a look: Ore near home is sparse at the Normal
level (about a tile and a half inside the starting border, sometimes none), so the first minutes hang on how well the
rival picks its first Ore Mine. (Fixed: the gunshy-test's rival stuck at four warbots wasn't short of Ore after all: the
test's turret covered its Chip Fab, Fuel Station, Quarries and Harvesters, so no Chips reached the Foundry and it could
never make the one more warbot it needed to clear the gun. A factory, gatherer or Fuel Station a gun has covered for a
minute no longer counts in its build plan (`aiShut`: another goes up out of reach), and when the gun has stood for two
and a half minutes with no new warbot for two, every warbot goes, the Command Base's last one too.) (Fixed: in a 2 v 2 a rival
that captured a Command Base had two road networks, each counting as home, so Crystal piled on one side while the Chip
Fabs on the other went without, and its army stopped growing; `aiJoinBases` now joins a captured base by road.)
(Fixed: in long 2 v 2 games on Crossroads the colony left on the losing side ran out of Crystal, so of Chips, and made
no more warbots while Alloy piled up; seed 3 ran to 59 minutes and seed 8 past an hour. Nearly all its Crystal went
into Chips (turret shots were a few in a hundred), but only one or two Taps were at work while it burned it twice as fast,
it counted Crystal short by tiles only once three clusters were left, and its Trade Terminal took Alloy for Stone and
never got a lot: the lot was fetched from the nearest building holding any of the good, a Harvester's four Fiber or a
Depot's last Stone, under a Road Train's load, so no train went. Now Crystal is judged by how long it lasts, Taps come
first, the Terminal and its Road Train come early and buy Crystal or Chips, its Smelters rest on piled-up Alloy so their
Ore and Fiber can pay for it, and the lot comes from storage with a train load; those two games end at 28 and 34
minutes.) (Fixed: the colony left winning a 2 v 2 could sit at the bot limit with 40 to 47 Workers, a dozen more than
its buildings called for, and some 25 warbots, Alloy piling up for want of room, and never finish the other:
`AI_ARMY_ROOM` kept room only from new Workers, it never thinned the ones it had. Crossroads seeds 1 and 14 ran past
90 minutes that way. Now it recycles its spare Workers and Haulers at its Foundry (`AI_SCRAP`) and fills the room with
warbots: those games end at 44 and 37 minutes, won by the same side. The other long ones, seeds 8, 11 and 13 at an hour or more, are close wars, not full
colonies.) Still open: a colony left with no Chips and no Road Train can't trade at all; and on Islands (seed 5, two players) a rival with 35 warbots lands only
four to six at a time (most sit in far garrisons) and hadn't taken a beaten rival with one warbot after an hour.

## Balance decisions

Decided: Fuel a bit scarcer (one Fuel recharges 2 batteries); Viaducts stay open to both sides; a nuclear missile that
lands on a Command Base destroys it; Brutes break through Walls slowly; Road Train wear stays as it is. Still noted:

- **Smelter recipe.** Tried 2 Ore + 1 Fiber → 2 Alloy to ease Fiber; on Standard maps Ore then ran short
  (Smelters waited for Ore 56–88% of the time) and games stalled, so the 1 + 1 recipe stays.
- **Sky islands AI-vs-AI can stall.** With forts harder to crack (missile floor, sorties, captured garrisons that
  survive), wars between two AIs last longer. On Sky islands, about 3 seeds in 8 then ran past 50 minutes: the
  Viaducts joining the two sides get shot down, both sides run short of Cement (Stone runs out on the mesas),
  and every new crossing is destroyed as soon as it's up. (The old rules ended those wars first, at 23–49 min.)
  It doesn't affect a game against you, but the AI could be smarter about guarding or replacing its crossings.
  Closed Outposts (enemies must break in) make long AI wars a little more likely: in a 13-game batch, 3 ran to the
  time cap. In each, both AIs keep one warbot in every one of their 15–20 forts and never have enough spare to march;
  the AI could pull more from forts far from the front.
  Since then: its Viaducts keep out of enemy guns and away from where one was lost, and a fort with another fort
  between it and the enemy can send its last warbot.
- **Bombing a Viaduct's deck** (Nov 2026). A bomb on the deck counts against the span: 14 off the end nearer it, or
  off the other end if that one's weaker, so two bombs anywhere on a deck bring it down (bombs on each end tower still
  leave both at 10). Open: should a deck be a target for warbots' Attack and the Army panel too (today they go for an
  end tower)? And the rival never bombs a Viaduct (`AI_BOMB_VALUE` has none): on Sky islands that could break a stall.

- **Napalm and scorched earth** (Nov 2026). A Vulcan Bomber can carry Napalm instead of its bomb (3 more Fuel, no
  Ammo, any ground in reach): the tile and the eight round it burn for 6 s, and fertile soil there is scorched for good.
  A Torch's Scorch the earth burns one patch with its whole tank (it needs 90% of a tank, then refills). The rival
  napalms a colony living on Bio Farm Fuel (two farms or more, no Oil Pump) every eight minutes at most, and every other
  raid takes a Torch to the farmland. Open: should burned soil ever recover (it doesn't: the owner asked for permanent),
  or a Grove Planter's stalk groves be scorchable too (napalm burns the groves but the ground still grows them)? Should
  the rival notice its own farms burning and turn to oil, or put Flak over its fields? Napalm on a Murmur nest or the
  Bloom (the Torches' first job in the lore) could be a later use.

## Lore expansions (held for later)

From the lore bible (LORE.md). The owner's decisions (Nov 2026): the Silence stays 31 years, the Sponsors stay faceless,
and it stays ambiguous whether the Murmur are only animals.

**Done (the quick wins, Nov 2026):** narrator lines (the landing line with its region on the briefing card, the first
road, the first nightfall, the first Uplink, a rival Command Base taken, the end screen); doctrine names and voices
(each rival speaks when it attacks you, fires a Missile at you and surrenders); callsigns (COBALT, VERMILION, VIRIDIAN,
TYRIAN) in messages, panels, statistics, the end screen, the setup and the lobby; region names as flavour (the setup
keeps the biome names); Ringfall; the *Wren* with its out-of-date cargo lists; a line of flavour on every building and
robot panel; a line on the loading screen; the Arrival clock on the Command Base; the Murmur as the name of the Colony
creatures (Scuttlers, Brutes, Murmur nests); and no Murmur on Lunar (a real rule: no nests and no raids on the moon).

Open questions from the quick wins, for the owner (LORE.md is left as the owner wrote it):

- **"Burrow" or "Murmur nest"?** Decided by the bible: they are Murmur nests on screen (Nov 2026).
- **The doctrines' timings.** The in-depth descriptions now give what games show rather than what the code allows
  (a rival only attacks what it outnumbers): headless games on Normal, against a computer-run colony, saw the first
  attack anywhere from about 6 to 16 minutes in whatever the doctrine (the Herald, on one planet, none in 16 minutes),
  and the Architect's Missile Factory at 8 to 16 minutes. Should the Herald really rush (take on a garrisoned Command
  Base sooner), or is the gentler Herald right?
- Should the narrator also speak in missions once the mission story pass is done? Should a rival's voice answer its
  own events (its nests cleared, a Ringfall on its land)? A Lore Guide page could collect the panel lines and loading
  lines a player has seen.

These wait for a later expansion:

- **Mission story pass.** Rewrite the campaign briefings as "your first terrafall" in the narrator's voice, keeping the
  tutorial clear.
- **Research Lab story.** Results written as findings about the Murmur and the Silence, the last one "Home signal
  analysis complete. No further instructions will follow."
- **The Pathfinder wreck.** A neutral landmark on some maps (the joint lander that built the Trade Posts and Uplinks),
  holding archive logs.
- **The Hollow (decided by the owner, Nov 17; being built).** The Murmur's cavern lair under the Bloom (LORE.md, The
  Hollow), as **its own map type with its own underground look** (not a biome for other maps). Always night; chasms,
  black lakes and the most nests of any map, with the Deep's mound at the centre. All four lore features in the first
  version: **breach shafts** (bases land under shafts of daylight; Ringfall falls only through them, in concentrated
  drops; Uplinks stand under them), **Bloom veins for Fiber** (no light for Stalks or crops; harvesting veins draws
  the Murmur), **floating Crystal** (the richest Crystal on masses hanging over the chasms, reached by Ropeway or
  bridge) and **ceiling tremors** (the Hollow's weather: dust and falling rock). **No aircraft underground** (no
  Airfields). No solar flares. It's always night there, so the Murmur's night rhythm (below) becomes surges on the
  same 12-minute clock, and the hum goes silent just before each one.
- **The Murmur in regular games (decided by the owner, Nov 17; built Nov 17: see README, The Murmur).** A Custom Game setting for every map,
  **Off / Quiet / Active, Active by default** (never on Argos, the moon). It **forces the day/night cycle on**: the
  Murmur live by it. **By night they tunnel**: every night each nest's tunnel network spreads further (toward power),
  new exits open along it, and more of them **pop out of the exits** to harass the colonies as they fight each other,
  so the longer a game goes the bigger the networks and the raids. **At dawn the ones that came up go back down**; the
  nests stay on the map and can be attacked by day (days to strike the nests, nights to hold the line). **Counterplay:**
  warbots collapse a tunnel exit (it stays shut a while), and wrecking a nest makes its whole network die back.
  Tunnels pass under roads, buildings and Walls. Quiet: fewer, slower tunnels and smaller packs. The rival AI learns to
  live with them.
  As built: Versus nests send nothing by day (only Colony's do); nests are placed by the map's symmetry, one a colony
  in each set (Active two sets on a Medium map for two, Quiet one); exits open no nearer than 9 tiles to a Command Base;
  a collapsed exit stays shut 15 minutes; the Hollow's `alwaysNight` turns the nights into surges with a silent lull.
  Open: art for the tunnels and exits (procedural for now: `paintTunnelTile`, `paintTunnelVeins`, `drawBurrow`,
  `drawExitScar` in js/render.js); the Leech, Spitter and Sapper as raiders; whether Torches should burn tunnels out.
- **A campaign mode built around the Murmur** (the owner's long-term wish): the owner's outline is in CAMPAIGN.md, 15
  missions in three acts, from the landing in the Rust to "No further instructions" at the Pathfinder.
- **Archives.** The main menu's Lore guide (`#screen-lore`) is the archive as it stands, the same for everyone. Next: pages that fill with logs found across games (ark construction updates that stop, the last
  transmission's background noise, the *Wren*'s silent waystation, machine traffic from other Catalog worlds, one signal
  that matches no robot protocol), so players piece together Earth's fate without ever being told.

### The Murmur as a real enemy (after the models are chosen)

"The Murmur" is the blanket name; each class has its own, and each counters something robotic. Classes so far:
Scuttler (small, fast, packs), Brute (armoured, breaks Walls), and new ones to design in the chosen style: the
Leech (named by the owner; latches onto vehicles, trains and buildings and drains their charge, shutting them down while it feeds),
a Spitter (spits conductive crystal slurry that shorts robots and turrets for a moment: counters defence lines) and a
Sapper (tunnels under Walls and surfaces behind them: counters turtling). Mechanics from the lore:

- A game setting (Off / Quiet / Active, like Planetary events), in Versus as well as Colony; none on the Lunar biome
  (Argos, the moon, is the only silent ground).
- Nests near Crystal seams and strike sites; surges after a Ringfall.
- Drawn to charge: raids go for Fuel Stations, Generators, Crystal stockpiles; bigger colonies draw more.
- They feed on the war: battle wreckage feeds their burrows, so long wars grow a third enemy that hits everyone (the
  computer rivals have to handle them too).
- Glimpsed, not seen: road lights going dark one by one at night as they come; sensor blips before contact.
- Counters: Torches (built to burn back the Bloom) do extra damage to them and clear burrows; the Research Lab studies
  them (earlier warnings, better counters). Regional variants: armoured in the Rust, pale and slow in the White,
  violet-glowing in the Bloom.
