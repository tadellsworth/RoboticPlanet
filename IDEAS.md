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

- **Does the south pair have an edge on Long Haul 2v2?** (to look into) In four computer-only 2 vs 2 games (seeds
  1 to 4, every rival Balanced) the south pair (players 0 and 1) won three, at 37, 19 and 25 minutes, and was ahead in
  the fourth when it stopped at 45 minutes. The map is the same for all four colonies, tile for tile (ground, deposits,
  heights, soil and roads checked against each tile's three twins on all four seeds), and the Trade Posts come in
  half-turn pairs, fair between the teams. So if the lean is real it comes from the order things happen in, not the
  map: players 0 and 1 think first each tick, and their robots, made first, act first. Next: run the same games on
  Crossroads and Twin Valleys 2 vs 2 (west pair against east pair, also players 0 and 1 against 2 and 3), and a few
  Long Haul games with the seats swapped, to see whether the first pair wins there too.

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
- **Cloud saves.** Saves move between devices by exporting and importing a file today; a cloud save (perhaps kept by
  the multiplayer relay on Cloudflare) would do it without the file.
- **Recycling: open questions.** A robot is taken apart the moment it reaches the Foundry: should it take a few
  seconds inside (the Foundry busy meanwhile), and should a damaged one give back less? Planes, ships and trains
  can't reach a Foundry, so they can't be recycled: should their own yards (Airfield, Port, Rail Station) take them
  apart instead? Recycle spare Workers has no Hauler counterpart for players (the rival scraps both): wanted? Should
  the rival also scrap other spares (Freight Trucks with no Depot to run, an Agribot with no farm)?
- **Send feedback: open questions.** A report's "version" is `gameVersion()`, the fingerprint of the rules code the
  multiplayer lobby compares: it tells two copies apart but not which commit a report came from. Should the published
  game carry a build number (say the commit's short hash, written in when the site is published) for reports to name?
  And should a Bug report be able to bring a screenshot of the map (a few hundred KB, ticked like the save)?
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
- **Graphics.** A first pass is done (rounded shorelines on ponds, lakes and seas, by day and in the night glow). Worth
  another look when new art comes in.

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
- **A Harvester counts regrowing stalks as in reach** (`reachableRes` in the AI's `cutting` test), so no new
  Harvester comes while it reports "No stalk groves left in reach"; Fiber sat at 0 for 14 minutes in one test.
- **Doctrine balance and text.** The Herald wins 10 of 12 against the Steward. The Architect's text promises a nuke it
  never builds (no Reactor in 10 Nuclear-race games); the Warden's says it "covers its land with turrets" but it
  builds about 2, all within 5 tiles of its base.

### Helping players see what's going on
- **Post-game report:** a timeline of the moments that mattered (first robot, first attack, when Fiber ran out, the
  deciding battle), where goods were lost, and one "next time, try..." tip drawn from the game's own stats.
- **Bottleneck finder:** a button (or a line in the Foundry's panel) that follows an idle Foundry back to the cause:
  "No Crystal: your Tap ran dry 3 minutes ago and none is being built." The rival AI already reasons like this
  (`aiGathers`, triage); showing it to the player cuts most "why is nothing happening?" moments.
- **Scout reports on the rival:** a line on what its doctrine is doing now ("massing for a push", "raiding your east
  road"), read from its real state (`P.massFor`, `P.raid`, `P.stormOn`). Drama for little cost.
- **Replays:** lockstep already makes a game its seed plus its orders. Keep the order list, replay at up to 4x with a
  scrubber: "watch how I lost", sharing, and bug reports that can be played back exactly.

### Reasons to come back
- **Daily planet:** the same seed, map shape and rival doctrine for everyone each day, with a score (time to win,
  robots made) and a local best; the relay could keep a shared board later.
- **Challenge modifiers** in Custom Game, mixed freely: no roads over water, half Fuel, a dust storm that never ends,
  a rival with a head start. Each won gives a small badge on the planet card.
- **A ladder of Colony goals** beyond land share: "run 3 Freight Trains", "a Ropeway to the canyon floor",
  "100 Alloy a minute". It leads players into the logistics most never touch.

### Deeper play without new systems
- **Truce and tribute in free-for-all:** pay a rival (say 20 Alloy) to leave you alone, or to hit the leader, for
  five minutes. It also gives stalled three- and four-player games a way to end.
- **Veteran warbots:** a warbot that survives fights earns a pip (a little more armor or accuracy), so pulling a hurt
  one back for repairs matters.
- **Blueprints:** save a stamped layout (a Smelter block and its roads) and paste it elsewhere. Far fewer taps on a
  phone.

### Phone polish
- **Paths tools on an upright phone:** the row shows 2-3 of its 11 tools (the edge with more fades). A "Tool"
  picker that opens all of them at once would be clearer.
- **The selection bar's last button** (Save as group) needs a sideways swipe on a 390 px phone.
- **Haptics** (`navigator.vibrate`) on a confirmed order, a placed building and an alert.

### Ten more
- **Watch mode:** two computer rivals, doctrines picked, with speed control and the scout reports. It shows off the
  doctrines and teaches by example (the menu demo already runs one).
- **Holdout:** a survival mode where rival drop pods land every few minutes in growing waves; score is minutes held.
  Reuses drops, Outposts and the siege rules.
- **Map editor:** paint terrain and cliffs, place deposits and starts, and share the planet as a short code (maps
  already come from a seed plus settings; a saved edit layer on top).
- **Photo mode:** hide the interface, free camera, a time-of-day slider, and save the picture. The art is the game's
  best advert.
- **Goods-flow overlay:** a map view that draws what each road carries (width by amount, colour by good), next to the
  Traffic map. It shows at a glance where a chain is starved.
- **Accessibility:** a colour-blind palette for player colours, territory and goods; a larger-text setting (the open
  "text size" question); captions for alert sounds.
- **Low-end phone setting:** a "battery saver" switch that lowers resolution, drops night lights and caps the frame
  rate, for older phones and long sessions.
- **Placement undo:** a building placed by mistake can be taken back with a full refund for 10 seconds (the Paths Undo
  already does this for roads).
- **Shared colony co-op:** two players run one colony against the computer, splitting the work (one builds, one
  fights), on the lockstep that's there.
- **Records and achievements:** fastest win per map shape, biggest colony, first Ropeway and so on, kept on the
  device and shown on the planet card. Some can open Archive pages, tying them to the lore.

## Trade routes and the finished-goods market (planned, after the current list)

The owner wants trade to be a steady supply line all game, not a deal or two, so trade convoys become a constant
target and the computer rivals build and guard their own. Plan so far (Nov 2026):

- **Standing trade routes** replace one-off contracts: set a route at the Terminal once ("send Stone, bring back
  Alloy") and it runs until changed. Merged with the finished-goods market: the market board sets what sells and buys
  at what price, the route moves the goods.
- **One convoy every 2 minutes or so** per colony (decided): the Trade Post's ledger takes one delivery per window,
  so convoys run on a schedule.
- **Small runs at modest rates:** about half a Road Train load a run at ~55-60% of value, the price of a good easing
  with each run and recovering over time, so a route settles at about one small factory's output. A cheaper
  Terminal (about 8 Cement, 3 Alloy) so it is worth building early.
- **The Trade Post is a no-fire zone** (decided): nothing shoots within its ground, so the fighting happens along the
  routes, never at the dock.
- **Convoys worth fighting over:** a flag on trade convoys, the route on the minimap, an alert when one is hit, and a
  destroyed convoy's cargo spilling as loot crates the raiders can carry home; an Escort option at the Terminal.
- **The rivals:** they build a Terminal earlier, run their own route, escort it with 2-3 warbots and an Outpost on the
  way; the Salvager makes enemy convoys its favourite target (outside the guns' reach).
- **Open: raw materials.** Can they be traded without being exploited (Stone never runs out)? Options to test:
  raw goods sell only at a low rate and buy at a markup; no raw-for-raw swaps; a good's price falls faster the more
  of it you sell; Stone sells only as Cement; a cap per window. Decide with balance runs.
- The *Wren* keeps its occasional big deals as the one-off event.

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
- **The Hollow (planned by the owner, after the Murmur design is settled).** A new biome and map in the Murmur's
  cavern lair under the Bloom (LORE.md, The Hollow): always night, daylight only down the breach shafts where Command
  Bases land, floating Crystal masses, chasms, underground lakes, ceiling tremors, Ringfall only through the breaches,
  no solar flares, Fiber from Bloom veins (which draws the Murmur), the most nests of any map with the Deep's mound at
  the centre.
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
Delver (tunnels under Walls and surfaces behind them: counters turtling). Mechanics from the lore:

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
