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

- **High-speed transit** (the owner, Nov 17 2026: saved for later). Late-game, high-capacity links for a big colony,
  beyond roads, Freight Trains, Ropeways and Cargo Planes.
  - **Maglev line.** Elevated track on pylons, run straight over terrain, water and cliffs, between Maglev Terminals;
    pods carry goods at 3 to 4 times a Freight Train's speed. Dear in Alloy and Chips a tile, and it draws power from
    Generators: a solar flare or a blackout slows it to a crawl. Pylons can be shot down, cutting the line until it's
    repaired. Lore: the Accord's road standards had a "Phase 2" transit plan for the colonists, never built; the robots
    finally build it, for freight only. Lit up at night, it would look the part.
  - **Express highways.** A road tier above Asphalt: wide, banked, one-way lanes with on-ramps, where Freight Trucks and
    Road Trains run twice as fast; Haulers aren't allowed on them. Dear Asphalt, kept up by a Roadworks; it builds on
    the one-way roads and junctions already in the game.
  - **Mass driver.** A long electromagnetic rail that fires sealed cargo canisters in an arc to a Catcher building far
    across the map (up to about 30 tiles), one every 10 seconds or so. A big build, and power for every shot. Canisters
    fly over everything, but a rival's Flak can shoot them down, and a missed catch spills the cargo as crates. The
    Missile Silo's peaceful twin; none in the Hollow (nothing flies under the cavern roof).
- **Sounds for the Hollow, and for the Murmur up close** (the owner, Nov 17 2026: for later). Today the Hollow has a
  faint draught (its wind in `updateBeds`) and the low sound in the ground near nests, exits and the Deep's mound
  (`groundMurmur`: louder toward the mound, dead silent in the lull before a surge); the creatures themselves make no
  sound of their own. Ideas:
  - **The Hollow's own ambience:** water dripping and echoing off the cavern walls (a long reverb), stone settling far
    off and pebbles skittering down a chasm, the black lakes lapping, wind moaning down the breaches where daylight
    falls in, the Bloom veins crackling faintly with drained charge, and a deep cave hum that swells toward the Deep's
    mound. The tremors: a deep rumble and rock falling.
  - **The Murmur up close** (zoomed in, near the middle of the view; louder at night), a voice for each form:
    the Scuttler chittering and clicking, its legs skittering over rock; the Leech a wet suck with an electric whine
    that rises as it drains charge; the Spitter a throaty gurgle before it spits, and the crackle of its shards; the
    Brute low growls, heavy footfalls and a guttural huff as it smashes; the Sapper grinding and scraping under the
    ground before it surfaces. A pack on screen at night chitters together, and a shriek goes up when it finds prey.
  - **A warning by ear:** a pack's chittering heard from off screen, panned to the side it's coming from.
  - **Tone** (LORE.md: glimpsed, not seen): uncanny rather than monstrous roars, organic sounds with a faint electrical
    buzz in them (they feed on charge). None on Argos. The cave ambience on the Ambience volume (`AUDIO.natureBus`), the
    creatures on Effects.
- **More planetary events** (the owner, Nov 17 2026: saved for later). Today's four (`EVENTS` in `js/defs.js`): the dust
  storm, Ringfall, the solar flare and the *Wren*. Each new one hits every colony alike, comes from the seed and the
  clock (lockstep), and is mirrored for fairness where it touches the land. The owner's pick, if built: the eclipse
  and the Carrier drop.
  - **Ring eclipse.** The Ring's shadow sweeps across the land and for about a minute it's night at midday: the
    streetlights come on and the birds fall silent. With the Murmur on they stir in the false dark and a few packs come
    up early (a small raid out of hours); without them it's mostly mood, and Bio Farms pause their growth. Brings the
    fear of the night into the day.
  - **Carrier drop.** A reserve supply pod from one of the Carriers in orbit falls off course into no-one's land, at a
    spot fair to every colony, and the first colony whose robots reach it takes its load (Alloy, Chips, Ammo). A race
    and a skirmish over neutral ground; in the lore, the Carriers' last reserves running out.
  - **Flood season** (only on maps with rivers or lakes). The water rises for about 90 seconds: low ground beside it
    floods, robots wade slowly, and roads at the water's edge can't be used until it goes down; afterwards Bio Farms by
    the water grow faster for a while. (See Twin rivers below: its fords "a Planet event can flood".)
  - **Bloom tide** (only in the Bloom). Violet growth creeps over a few patches of each colony's land, blocking building
    there until a Torch burns it back or a Harvester cuts it for Fiber.
- **Airships and the rival** (Nov 17). The Airship and its Mooring Masts are player-only for now: no rival builds Masts
  or Airships, though its Flak Guns (and armoured trains' flak) shoot yours down, and it builds Flak once you have any
  aircraft. Open: should a rival (an Architect, say) link a far foothold home by Airship line, and should rivals then
  learn to cut a line (Flak under its path, a raid on a Mast)? Also open from the build: lines of more than two Masts
  (a route of stops), an Airship you can fly by hand (a one-off drop of riders, like a Ferry's beach landing), vehicles
  aboard (a truck in the pod?), and whether Crude should fly (Fuel does now, for a far side's chargers, as a Cargo
  Plane's does).

- **Room to grow in the single-file game** (owner's to-do, Nov 17). `dist/terrafall.html` must stay under 16 MB (its
  host's limit for a page; each file beside it has its own 16 MB). It reached 16,346 KB with the Hollow's and the new
  Fiber and Oil art, so the Forest's and Hoarfell's biome art moved into bundles beside the page like the newer biomes'
  (`LAZY_BIOMES`), freeing about 1 MB (15,409 KB). That buys a few batches of art and code, not the long run. The page
  still carries every other image as text (about 9.7 MB of WebP, a third more once inlined): buildings 5 MB (each in two
  team colours), bots 2 MB, effects 1.2 MB. The lasting fix is to move the rest of the art beside the page too, in a
  few bundles (buildings, bots, effects and the Desert) that load before the game starts (or as the Lore and night
  sets do), so the page holds code alone and can't fill up again. Then check that the single file still opens straight
  from a folder and still plays offline. Meanwhile, the biggest single images are `effects/nuke-blast-sheet.webp`
  (377 KB) and `effects/fx-fuel-blast.webp` (125 KB), if a quick re-encode is ever wanted.
- **A new look for the oil seeps** (owner's to-do, Nov 17: "I don't like the current one"). The owner's two reference
  pictures show a puddle of crude: glossy, jet black, with a soft, wavy, irregular outline (lobes and pinched waists,
  no straight edges), a few separate small round droplets and smaller puddles scattered beside it, faint dark-grey
  sheen patches inside, and thin bright white highlights along the lower (front) rims, as if lit from above and
  behind. Today's seep is a texture drawn across all its tiles as one shape (`drawSeep` in `js/render.js`, the
  `oil-seep` art) with its night glow in `resourceGlow`; the Hollow's seeps use the same art. A redo would make the
  puddle (and its droplets) the art, keep it reading as one shape across a seep's tiles, darken as it is pumped dry,
  and keep a faint gleam at night. Render a sample sheet for the owner to pick from first.
- **The rival doctrines' texts** (owner: on hold until the owner has finished fine-tuning the rivals). Then play each
  doctrine again, measure what it really does, and rewrite its text to match. Known gaps are under "Doctrine balance
  and text" in the November review below.
- **Bigger graphics upgrades** (owner: on hold). More detailed close-zoom art and a WebGL renderer: see the entry of
  that name below.
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
- **Recycling.** (Settled: a robot is taken apart standing at the Foundry, 2 s a round of parts, while the Foundry
  carries on; a damaged one gives back as much as a sound one, since most give back a single Alloy.) The owner's
  answers to the open questions: planes, ships and trains are not recycled at their own yards (Airfield, Port, Rail
  Station), not for now; no Recycle spare Haulers button for players; the rival scraps its other spares too (Freight
  Trucks, Tankers, Road Trains, Agribots) when it has too many, is starved of Alloy or Chips, or they stand idle while
  its Foundry waits for parts (done: `AI_SCRAP` in the README).
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
- **Redesign the Fiber and Oil resources on the map (the owner, Nov 17; installed Nov 2026).** The owner didn't love
  either look: Fiber's Stalks (teal fungal stalks with glowing mint caps) and the oil seep (a dark glossy pool with a
  rainbow sheen). From a design sheet of three directions each, the owner picked **Reedcane** for Fiber (jointed
  sage-teal canes with mint plumes, an image for each growth stage, the plumes glowing at night) and the **Pathfinder
  survey stake** for Oil (the seep drawn as soaked dark ground across all its tiles, an old survey stake on each pump
  spot, its lamp lit at night). ART_GUIDE Batch 16.
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

- **Built: the Fuel Tank and oil blocs (the owner's idea; first called the Tank Farm).** Gather tab (T), 5 Cement and
  2 Alloy: storage for Crude and Fuel only, up to 120 together. An Oil Pump's **Pipe it in** (renamed from Pipe it to
  the Refinery) and **Pipe every Oil Pump** run to the nearest Refinery or Fuel Tank; a pipeline with a Fuel Tank on it
  moves 8 a second instead of 4, filling the Fuel Tank before other storage. By feed link it gives Crude (and Fuel) to
  up to 4 neighbours and takes in the Crude a pump beside it pumps and the Fuel a Refinery beside it makes, so pumps,
  a Fuel Tank, Refineries and an Asphalt Plant make one oil bloc. Tankers and trucks fill up there like
  at any storage (ships and planes still fill up at their Port and Airfield). Destroyed full, it goes up in the biggest fuel blast in the game (1 tile empty, up to 3.8 full; 8
  damage to robots, 7 to buildings; a Refinery's is 2.4, 6 and 5), setting off Refineries, Fuel Tanks and loaded
  Tankers in it; its panel shows how full it is and how big the blast would be now. The rival builds one by its pumps
  once it has a working Oil Pump, a Refinery and a Foundry, touching the Refinery where it can, and its bombers rate one highly. Taught in Pipe Dreams (its last goal:
  store Fuel in a Fuel Tank touching the Refinery). **For the owner to check:** the cap (120), the cost, the blast
  size, the 4 feed links and the doubled pipeline rate are first guesses.

## Suggestions from the November review (not decided)

From a full review of the game after the audit work was merged. None is planned yet; each is for the owner to pick
or drop.

### Rough edges in what's there
- **Island maps still stall now and then.** With a decisive lead (or a landing held back by guns) the rival now gathers
  a band on a beach out of the guns, with a second Ferry, and goes in when it's strong enough (`aiBeach`); in 12
  Islands test games 4 still ran to 50 minutes (6 before). Left: a rival dug in behind several Mortar Pits, turrets and
  a Keep, where the leader's bands keep taking Outposts that are lost again (seeds 2, 5, 17); a colony whose home
  island has no Ore left makes no Alloy, so no army and no Ferry, and nobody lands at all (seed 21); and a staging
  island it takes first, which isn't tried.
- **Free-for-alls run to the cap.** In 3- and 4-player games the rivals don't gang up on the leader or finish off a
  weakened third; most test games on The Wheel, Three Mesas, Pinwheel, Four Isles and Twin Valleys end undecided.
  (One cause fixed, Nov 17: in the last fight the winner of the earlier ones couldn't gather a storm, every fort,
  Keep and Command Base it held keeping warbots back; that storm now draws on them all. Small Crossroads games that
  sat out the clock with two colonies left now finish, in about an hour.)
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

- **A rail-only line.** A far Rail Station needs a road to be built at all (its builders and materials come by road),
  so Iron Road asks for one. Trains bringing a station site its materials would make a track-only line possible.
- **Bombs on a Command Base** didn't visibly dent it in the Final Descent solver runs (armor 30/30 at each minute
  mark). Not needed for the goal, but worth a look with the bombers.
- **Kits and Fiber, Trade Winds** (done). From Pipe Dreams on the kits bring a Grove Planter (`KIT8`): without one the
  Harvester's 30-45 Fiber were gone into the Smelter in 5-8 minutes and an idle player lived on salvage. Trade Winds
  was still on `KIT7` (it was left alone while the trade missions were reworked) and now has `KIT8` too: left idle on
  Normal, its colony had made 30 Fiber and no more by 6 minutes, with none in store from 8; with the Grove Planter it
  makes about 7 a minute (110 by 16 minutes) and keeps 9-12 in store. Its comment on seed 1445's events now says what
  they are since the shorter gap between events in missions (`MISSION_EVENT_GAP`): Ringfall 2:30-3:21 and a solar flare
  5:22-6:33 (not over by 9:36). Played with its hints' steps (Road Trains +1, dock at the nearer post and Lay road, then
  Send Stone and Bring back Alloy), it is won at 6:33 on Easy and Normal (the second event is the last goal met) and at
  8:06 on Hard (the third run), as with `KIT7`: no hint or line of the briefing needed changing. Long Haul (`KIT8`
  without the Mine now: its Ore is far up the valley) and Convoy have it too. Long Haul played at a newcomer's pace
  (its hints' steps, the AI off) is won at 6:41, 7:18 and 8:05 on Easy, Normal and Hard (7:05, 7:20 and 7:53 before).
- **Mostly waiting.** Breakthrough is mostly research timers, and Assembly Line and Pipe Dreams take a scripted player
  4-7 minutes; their Hard clocks are generous on purpose.
- **Convoy: Hard with the Grove Planter** (retuned Nov 17: a Medium rival on Hard). Mission rivals have the
  rival's opening, so Convoy's Salvager (Medium on Normal, Normal on Hard until this retune) keeps an army; the note that Hard was lost at
  21 minutes (the AI alone) didn't hold on later code, where it was won at 9 to 12 minutes. As the owner then decided:
  Hard's clock is 13 minutes (40 before); the raid goal comes first, so its hint shows from the start (it says to start
  the route first); the Salvager's convoys press on (`pressOn`, `convoysPress`: out of a besieged Command Base, and
  past warbots in their way even unescorted), which ends the soft lock where besieging the rival before wrecking one
  of its convoys left nothing to wreck, and the Easy trap of unescorted convoys turning back from every band; and the
  kit has the Grove Planter (`KIT8`). Played with the hints' steps and the AI on your side (work speeds 1 to 1.3), and
  by the AI alone, before (`KIT7`, 13 minutes, the old order, no pressing on) and after:
  - Easy: before 8:46, 21:59 and still open at 40 minutes with the steps, 10:04 and twice open at 40 alone; now
    9:04 to 10:39 with the steps and 8:25 to 10:22 alone.
  - Normal: before 6:47 to 12:53 with the steps and 10:22 to 22:36 alone; now 6:47 to 13:00 and 6:43 to 10:04.
  - Hard: before 6 of 7 with the steps (9:21 to 12:24) and 3 of 3 alone (8:53 to 9:13); now 2 of 7 (10:12, 10:23)
    and 2 of 3 (8:43, 10:28), the rest lost on the clock, mostly with no convoy wrecked yet.
  - It's the Grove Planter, not the pressing on: with `KIT7` and the convoys pressing on Hard was won 4 of 4 (8:57 to
    10:17), with `KIT8` and no pressing on 1 of 4. The layouts differ only by the Grove Planter and its Agribot, so it's
    most likely the war tipping the other way. With no clock, `KIT8` and pressing on, Hard went 10:12 to 24:42 and the
    Command Base was captured at 15:02 and 17:38 in 2 of 7: a longer clock alone doesn't fix it.
  - Retunes measured: a Medium rival on Hard (as on Normal) with the 13-minute clock won 4 of 4 with the steps (9:09
    to 11:14) and 1 of 2 alone (9:12; the other lost on the clock); or Convoy's kit back to `KIT7`. **Made: the Medium
    rival on Hard** (the kit the owner chose stays), tight against 13 minutes, close to the 6 of 7 before the kit change.
- **Final Descent is a real war now.** With the opening its rival keeps an army (the old one's was gone by minute 10).
  A scripted player (the AI on your side plus the hints' steps) won six of seven runs on Normal and on Hard; one lost
  its Command Base at 22 minutes on Hard, and one on Normal was still open at 41 minutes, its army shrinking. If
  players find the last mission too hard on Normal, its rival could go to Medium there.

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
colonies.) Still open: a colony left with no Chips and no Road Train can't trade at all; and on Islands a well dug-in rival can
still hold out to the clock against a leader landing band after band (see Island maps, above).

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
- **The Pathfinder wreck.** A neutral landmark on some maps (the joint lander that built the Trade Posts and Uplinks
  and sowed the garden: LORE.md, The Pathfinder's garden), holding archive logs. The campaign's last mission is played
  around it (CAMPAIGN.md).
- **Landmarks and named places for every map** (the owner: second batch, after the living-world layer). Each map gets a
  name and a few named landmarks (a waterfall off a cliff, a fallen ring shard with a crystal spire, a stone forest, a
  frozen lake), labelled in faded atlas lettering when zoomed out, each with a line of flavour on tap. Also: the
  Pathfinder's arrival camps (empty shelters, a lit "Welcome to Ithaca" sign, a landing field whose lights still blink
  at night) and the half-buried wrecks of earlier landings that failed, each with a log for the Archives. A
  once-a-game moment for each biome: a herd crossing the Long Grass, geese over Emberwood, a lava flow in the
  Cinderlands. Needs new art. The campaign's set pieces are listed in CAMPAIGN.md.
- **The Hollow (decided by the owner, Nov 17; built Nov 2026).** The Murmur's cavern lair under the Bloom (LORE.md, The
  Hollow), as **its own map type with its own underground look** (not a biome for other maps). Always night; chasms,
  black lakes and the most nests of any map, with the Deep's mound at the centre. All four lore features in the first
  version: **breach shafts** (bases land under shafts of daylight; Ringfall falls only through them, in concentrated
  drops; Uplinks stand under them), **Bloom veins for Fiber** (no light for Stalks or crops; harvesting veins draws
  the Murmur), **floating Crystal** (the richest Crystal on masses hanging over the chasms, reached by Ropeway or
  bridge) and **ceiling tremors** (the Hollow's weather: dust and falling rock). **No aircraft underground** (no
  Airfields). No solar flares. It's always night there, so the Murmur's night rhythm (below) becomes surges on the
  same 12-minute clock, and the hum goes silent just before each one.
  **Built:** the map (two players, Versus and Colony; README, The Hollow; no Trade Posts or Uplinks, keeping to the
  lore), breaches, Bloom veins (they grow back), floating
  Crystal (the rival AI ropeways out to it), side chambers of robot parts (crates of Alloy and Chips), stone pillars,
  tremors with falling rock, the Deep's mound (wrecking it spills its hoard and knocks every nest back to level 1), no
  Airfields, Grove Planters, Bio Farms or Ports, no dust storms or solar flares, the mission *Into the Hollow*.
  **Joined with the Murmur's night system (Nov 17):** the Murmur setting decides here as anywhere (the Hollow's
  default is Active; the `TEMP(hollow)` line is gone); nests in Versus as in Colony on the sites laid out with the map
  (`S.hollow.nests`, twin pairs, and the Deep's mound, `S.hollow.deep`; Quiet keeps half the pairs), owned by the
  Murmur's slot; tunnels and exits as everywhere; always night with the nights as surges on the 12-minute clock, the
  hum going dead silent for a minute first; cutting veins draws the packs (`veinLure`, in `wildTarget` and the night
  packs' `murmurPrey`). The mission *Into the Hollow* still has no Murmur. Computer-only Versus games here with the
  Murmur Active at first never ended (three Medium games still going at 75 minutes): the rival built no nearer a nest
  than 8 tiles, and every Ore deposit off its home ground lay 3 to 7 tiles from one, so it ran out of Ore 13 minutes
  in. Now it keeps 6 off in Versus (`AI_NEST_CLEAR_VS`; the guards reach 3), and six games (Medium and Small) ended
  at 19, 24, 24, 26 and 28 minutes and one Small at 66, won 4 to 2 by the first seat (the Murmur cost each colony
  about 18 robots; on Standard, about 3). With them Off the same seeds end at 20 to 34 minutes.
  **Its art is installed** (Nov 2026, from the design sheet the owner approved: ART_GUIDE Batch 16): terrain, chasm,
  plants, Bloom veins, floating Crystal, pillars, side chambers, the Deep's mound, the breach shafts' light, and the
  Murmur's tunnels as curved ridges with art for their exits on every map. It loads only when the Hollow is played.
  **For the owner:**
  - **Decided (owner, Nov 17; the owner left these to us):** no Trade Posts or Uplinks (the Pathfinder never mapped
    it); the Deep's mound stays as it is (every nest back to level 1, a hoard of 30 Crystal, 20 Alloy and 10 Chips);
    four contested breaches in the flank caverns; roof rock every other tremor (about every four to five minutes) after
    an 8-second trickle.
  - Decided (owner, Nov 17): Colony's daytime raids are gone; with the Murmur on, packs come only at night (in the
    Hollow, in the surges), as in Versus. Computer-run colonies, first 35 minutes, before → after: the Hollow, Small:
    23 robots lost → 5, 30 buildings by 15 minutes → 34; Huge: 32 → 15 (with the exit cap), 25 → 27; Standard, Small:
    33 → 30, 21 → 27; Huge: 20 → 10, 21 → 27. (The day packs had been 80 to 260 creatures a game.) The mission The
    Murmur (`bughunt`), whose packs came by day at 4 minutes, now meets them at its first night: a turret and warbots
    by nightfall, two exits to collapse (the one dug the night before, then one that opens at nightfall), then nests.
  - Computer-only games end in 15 to 40 minutes, neither seat favoured (11 wins to 14 over 26 games, one still going
    at 45). **Small maps get a second oil seep by home (decided Nov 17):** with one 3-tile seep each (39 Crude
    within 12 tiles of home; Medium has 4 to 6 tiles) both computer colonies were slow to get Fuel. The second, also
    three tiles, lies on the other side of home (`hollowMap`, last of the resources so nothing else on the map moves):
    now 6 tiles, 78 Crude, the same as a Medium home at its richest.
    Six computer-only Small games each way (seeds 21-26, the Murmur Active): all six ended with it (11.7 to 36 minutes
    before, one still going at 45; 14.5 to 36 after), but the computer's Fuel came no sooner, because what holds it
    up is its Refinery, not the oil: it builds one only after a Foundry (oil costs Alloy), at 3 to 42 minutes or
    never, while its first Oil Pump goes up at about 3 minutes either way. If the rival's Fuel on the Hollow is to come
    sooner, that's the place (`aiThink`'s Fuel-low plan). Winners by seat: 2 to 3 before, 5 to 1 after.
  - **The rival's Refinery in the Hollow (fixed Nov 17, the owner's go-ahead).** Traced: its Bot Foundry turned every
    bit of Alloy into robots, so a Refinery (4 Cement, 3 Alloy) waited for its whole price in storage that never came,
    and a colony ran on no Fuel from minute 4 to minute 19; and once the home seep ran dry its next Oil Pump went out
    to a richer seep 18 tiles off among the nests (unstaffed, dry for minutes) while the new seep 6 tiles from home
    went unused. Now oil comes first there (`oilFirst`: the Refinery first after the opening, started on its Cement,
    its Alloy delivered first) and pumps go near home (`AI_HOLLOW_PUMP_FAR`). The same six Small games: every colony
    had its Refinery by 3 to 9 minutes (before, 5 of 12 waited 14 to 17 minutes or never got one) and Fuel in stock at
    10 minutes (before, 6 of 12 had none); all six ended, in 14 to 35 minutes; winners by seat 2 to 4, so the lean
    above was most likely one colony starved of Fuel. Still open: with Fuel low later on, a pump can wait behind other
    sites (a Missile Silo, say) for a slot.
  - Three or four players: not built (the layout is made for two, turned half round).
  - Decided (owner, Nov 17): Off stays allowed on the Hollow, with the menu's warning.
  - Decided (Nov 17): Colony on the Hollow caps the exits open at once (`murmurExitCap`) at what a Standard Colony map
    of the same Size could have by that night (its nests, 3 to 8, times the exits a nest has opened by then: Huge,
    Active, 12 after the first surge and 18 later). Its 14 nests and the mound had opened 18 to 19 by the first dawn
    and 25 to 30 by the second; now 12 and 18 (Standard Huge: 8 to 10, then 11 to 15). Nests and mound unchanged, Versus
    uncapped.
- **The Murmur in regular games (decided by the owner, Nov 17; built Nov 17: see README, The Murmur).** A Custom Game setting for every map,
  **Off / Quiet / Active, Active by default** (never on Argos, the moon). It **forces the day/night cycle on**: the
  Murmur live by it. **By night they tunnel**: every night each nest's tunnel network spreads further (toward power),
  new exits open along it, and more of them **pop out of the exits** to harass the colonies as they fight each other,
  so the longer a game goes the bigger the networks and the raids. **At dawn the ones that came up go back down**; the
  nests stay on the map and can be attacked by day (days to strike the nests, nights to hold the line). **Counterplay:**
  warbots collapse a tunnel exit (it stays shut a while), and wrecking a nest makes its whole network die back.
  Tunnels pass under roads, buildings and Walls. Quiet: fewer, slower tunnels and smaller packs. The rival AI learns to
  live with them.
  As built: nests send nothing by day, in Colony as in Versus (the owner's call, Nov 17: Colony's daytime raids are
  gone), and Versus guards only go for what comes right up to the nest (a nest by a colony's road to its fields
  stopped a rival's economy dead; the rival keeps 6 tiles off: owner OK, Nov 17); Quiet stays light (owner OK);
  Always night stays a choice with them on, for its looks only (they still come out at the game clock's nightfall); nests are placed by the map's
  symmetry, one a colony in each set (Active two sets on a Medium map for two, Quiet one), off the ways between the
  colonies; exits open no nearer than 12 tiles to a Command Base or 4 to a building; a collapsed exit stays shut 15
  minutes; the Hollow's `alwaysNight` turns the nights into surges with a silent lull.
  **Their craft (the owner's decision, Nov 17; built, Active only, Quiet keeps the plain packs):** at dusk a watcher
  stands at the edge of each colony's land facing it (the strike falls there); the packs gather out of the guns' reach
  and off the colony's land, out of sight of its roads, and come in together; a few go first for the Fuel Stations,
  Generators or streetlamps near the target (dark and dead till dawn: the lights go out one by one); targets and routes
  keep out of gun cover; Brutes lead, Scuttlers spread round the target and scatter from warbots; half lost, the rest
  go back down and come again; their dead are dragged off (no blast or fire, nothing left by morning); they remember
  where they were killed (exits and strikes keep away) and where they fed (strikes come back), fading each night; from
  night 3, with warbots about, a feint on the far side first. The rival builds a Pulse Turret where its power was cut.
  To keep it fair the packs are smaller (Active [2, 0.34, 4], was [2, 0.5, 5]), only the exits with something near
  them send a pack (as before), and a plan draws the packs of its three exits nearest the rally point.
  Measured (35-minute computer-run Colony games, Active, seeds 7 and 8, before → after): robots lost to the Murmur,
  Standard Small 28, 32 → 5, 15; Standard Huge 11, 9 → 10, 8; the Hollow Small 1, 5 → 15, 13; the Hollow Huge 8, 8 →
  8, 10; buildings at 15 minutes, all eight, 221 → 231, at 30 minutes 260 → 287 (construction sites wrecked 3 → 10).
  Versus, nine computer-only games: seven on Standard, shape 2 and shape 4 end in 13.9 to 40.5 minutes (mean 23.9, was
  22.1), the first seat winning 5 to 2 (was 3 to 4), about 3 robots a colony lost to the Murmur (was 3.5); on the
  Hollow, Medium seed 11 ends at 34.8 (before: still going at 75) and Small seed 21 at 17.7 (was 29.4).
  **Their other forms (the owner's decision, Nov 17; built, Active only):** the Leech, the Spitter and the Sapper (BOTS
  `leech`, `spitter`, `sapper`), at most one of each with a strike from their nights (2, 2, 3), each with its part:
  the Leech takes the power cut (it feeds, dark and draining, and takes the charge home: its nest grows sooner), the
  Spitter shorts out the guns and eats at Walls from a few tiles off, the Sapper goes under the Walls and guns (out
  of reach; its route stays a tunnel) and comes up by the target. Repair brings a cut building's power back. Under
  ground a Sapper can't be hit at all: the chosen answer is to meet it where it comes up (warbots there; the rival
  does it too), with a moment as it heaves up when it can't fight back. Their art reads u.pose, u.poseT, u.charge,
  u.fx/u.fy, b.shortT and the fx 'spit' and 'spitHit' (installed Nov 17). Taught in *What Comes
  Up* (First Contact), which also teaches the craft: a Fuel Station a Leech drank dry to repair, a Pulse Turret by a
  Fuel Station, warbots where the watcher stood, and a Leech, a Spitter and a Sapper to kill.
  Measured with the forms (the same games as for the craft, before → after the forms): Colony, robots lost to the
  Murmur in all eight 84 → 70, buildings at 15 minutes 231 → 231, at 30 minutes 287 → 293 (the Leech takes the power
  cut, so the Brutes go in with the rest); Versus, the same nine all end, mean 21.6 minutes (was 23.9, with one still
  going on the Hollow before the craft), the first seat 7 to 2 (was 6 to 3), 2.9 robots a colony lost to the Murmur
  (was 3.1). Most Versus games end by the second or third night, so the forms show up in few of them.
  The Hollow in Colony is now harder for a computer-run colony (its robots lost go from a handful to a dozen or so in
  35 minutes; its size is the same). The owner (Nov 17): keep it hard there, it's their lair.
  Open: art for the tunnels and exits (procedural for now: `paintTunnelTile`, `paintTunnelVeins`, `drawBurrow`,
  `drawExitScar` in js/render.js); whether Torches should burn tunnels out.
- **A campaign mode built around the Murmur** (the owner's long-term wish): the owner's outline is in CAMPAIGN.md, 15
  missions in three acts, from the landing in the Rust to "No further instructions" at the Pathfinder.
  Its music is ready (Nov 17): **The Long Silence**, the campaign theme (`MOODS.campaign` in js/audio.js; see the README's
  Sound), which tells the story's arc from a level the campaign sets with `musicStory(level)`: at `(mission - 1) / 14`
  missions 1 and 2 are Landfall, 3 and 4 the colony at work, 5 and 6 the first murmur, 7 to 10 Contingency, 11 to 14
  the Murmur rising (the climax) and 15 the Silence. Until then the Lore guide plays it. Open: whether a mission should
  play it all through in place of the build themes (as wired now: the war, the Murmur and a nuke still take over), or
  only in its briefing and quiet stretches, taking turns with the build themes; and whether the Now playing card should
  show over the Lore guide, which it doesn't (a full screen covers it).
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
  them (earlier warnings, better counters). Regional variants: armoured in the Rust, pale and slow in Hoarfell,
  violet-glowing in the Bloom.
- **The new forms' art is in** (Nov 2026, ART_GUIDE Batch 17): drawn true size with their action loops, glow and light
  pools; the behaviour is the sim's. Open, for whoever builds it: a Sapper under the ground shows only within
  `SIGHT_R` (6) tiles of the colony on this device (`colonySees` in js/render.js), so the tap and hover there (js/ui.js)
  should skip one the player can't see; the regional variants (`v=rust|white|bloom` in murmur_moles.js) aren't rendered
  for the game yet; and whether the Murmur's light should show on the minimap at night.
