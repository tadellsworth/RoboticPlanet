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

## Redraw the code-drawn art through Claude Design (the owner, Nov 23 2026: the plan)

Everything the game draws live in code, with no images, looks plainer than the rendered 3D art. The owner's call: redo
it all, one piece at a time. Each piece starts as concepts on a Claude Design canvas (the Terrafall Art design system),
the owner picks or marks them up there, and the chosen look is then built into the game (rendered with `renderer/`
where it can be an image; where it has to move or follow the map, such as roads or rain, the code keeps drawing it but
to the approved design, with new textures and sprites). In order:
1. **The Contingency globe** (built Nov 23 2026: concept A, "Satellite"; ART_GUIDE.md, The Contingency globe): a
   realistic planet, natural coastlines, relief, smooth borders, drawn in WebGL. The menu planet shares its colours
   (its face is recoloured from the same picture). Canvas: https://claude.ai/artifact/Erzr8o7X7ZxnmTbbeNZ9Wb
2. **Passenger Town's buildings** (BUILT Nov 23 2026; ART_GUIDE Batch 33): rendered 3D buildings in place of the
   code-drawn boxes. The owner's decisions on the concepts ("looks great"): day and night renders shipped (morning and
   evening made in code from them), in a bundle of their own loaded only for the map; the town's night lifted a little
   over the shared night (more roof lights, some of the day render in the night one); a building in front of your
   robots fades; the arcade's ribs thinner and the zebra crossings lighter; heights in `TOWN_KINDS` matched to the art
   (they only draw: where a sentry's shots come from); stripping in two art steps (scaffold, frame), faltering lights
   small code overlays.
3. **Weapon effects:** laser beams, muzzle flashes, the white blast flash, tracers, missile trails, impacts.
4. **Sunsets, sunrises and the sky light** of each biome.
5. **Weather:** rain, snow, sandstorms, fog, storms and lightning (the Atmosphere Engine's too).
6. **War scars:** craters, scorch, burnt ground, wreck debris.
7. **Roads, Express lanes and their sign gantries,** rails and pipes where code-drawn.
8. **The Murmur's tunnel ridges, oil puddles, night light pools.**
9. **The robots' work animations** (welding, paving, drilling, scything): small tool sprites.
10. **The menu planet** (shares the globe's new look: its face already has the globe's colours; its shading, lights and clouds still to do), **the minimap** and **the interface** (panels, buttons, icons).

## The Walking Factory (built Nov 23 2026: open questions for the owner)

The owner's pitch (approved): "a huge old Accord mobile factory, a dormant machine, crawling slowly around a loop through
the middle of the map. Park robots aboard to claim it. While you hold it, it builds for you as it walks, so your front
line moves with it and both sides fight to board it." Built as `SHAPE_PRESETS` `walker` (README, The Walking Factory;
the help's section; js/walker.js for the look); the mission *The Walking Factory* (First Contact) teaches it. The design
calls made in building it, each a default for the owner to keep or change:

- **Size and speed:** its deck (where robots count as aboard) reaches 2.8 tiles from its middle (a hull about 5.4 × 3.4
  tiles on six legs); it walks 0.32 tiles a second, so a loop takes about three minutes on a Medium map (`WALKER`).
- **Its path:** dormant in a cradle at the very middle (as far from every colony), it wakes when first claimed and
  walks out a spur toward the claimer's base to a circular loop round the middle (radius 0.45 of the way to a base,
  kept 9 tiles short of a landing zone), then round it for good, turning round toward each new holder. A loop round the
  middle is fair for two, three and four (the map's symmetry carries it); the spur toward the claimer rewards the
  first claim. Open: a loop that pauses at each colony's side, or a figure-eight through the middle for two players.
- **Its yard:** the loop and everything inside it (3 tiles out past it) is bare, flat ground where nothing can be built
  (no turrets parked on its track, no Trade Post, Uplink or nest on it), and a lane is opened from each base to it.
  The map is flat (one level). Open: let colonies build inside the loop, or allow roads only.
- **Warm-up:** it can't be claimed for the first 4 minutes (`WALKER.wake`; at once in the mission). Without it the
  first band of starting warbots to arrive (20 s in) took it, and in AI games the first holder won every game (12 to
  14 minutes) without it ever changing hands.
- **Boarding and capture (king of the hill):** armed robots on its deck are aboard. One side alone aboard claims it in
  15 s for one robot, each more 25% faster (at most twice as fast); two sides aboard (allies are one side) is contested,
  frozen; an enemy alone aboard first takes the holder's hold down to nothing, then claims it. Its holder keeps it with
  no one aboard. An unfinished claim fades.
- **Riding:** a rally flag planted on its deck (a move order, the Send warbots aboard button, or its own Warbots') rides
  with it, so the robots holding it walk along and keep pace; they stay aboard until given another order. Robots aboard
  that belong to its holder recharge (4 a second) and get a round of Ammo every 3 s.
- **What it builds:** a Warbot every 50 s while held and not contested, onto the holder's flag on its deck (at most 5 of
  its Warbots alive per holder, never past the robot limit). Open: other robots by stage of the game, goods (crates
  dropped as it walks), or production that speeds up the longer it's held.
- **It can't be damaged** or destroyed: only boarded. Open: armour that guns can knock down to stall it for a while.
- **The rivals:** keep 2 to 4 guards aboard while they hold it (two more per enemy aboard), and send a band of at least
  4 (or what they have, at least 3) to claim or retake it, every 25 s at most (8 s with enemies aboard).
- **Lore:** named an "Accord Mobile Works", walking its circuit for the crew aboard ("Circuit held for the Accord. Output
  allocated to the crew aboard."). Where it stands on Ithaca I (a region, a name on the atlas) is the owner's to place;
  nothing in LORE.md was changed.
- **Balance watch:** holding it early snowballs (free Warbots plus a recharging, reloading crew); the cap of 5 and the
  50 s line are the knobs.
- **Art: done** (Nov 23 2026). The owner picked look A, the "Foundry Crawler", of three concepts (B the Accord Strider,
  C the Factory Block), and it's installed: rendered with `renderer/b/walker.js` (ART_GUIDE, The Walking Factory), six
  walk frames and a rest frame at every time of day, its holder's parts a tinted light layer, loaded only on its map.
  The deck (about 2.7 × 3.2 tiles) sits inside the 2.8-tile ring that counts as aboard; the ring was kept (a rule), so
  robots among its legs still count. Open: B's lit deck ring and knee lights carried over for more of a "still running"
  feel at night; a Warbot seen rolling down the chute as one is built.

## Passenger Town, the city map (built Nov 22 2026; the owner's decisions Nov 23 2026)

The owner's design (approved): the empty Accord town between the bases, its streets a maze, its buildings stripped
for salvage to open new ways through, cover beside them, caches, old sentries, rivals that strip near their routes.
Built as `SHAPE_PRESETS` `city` (README, Passenger Town); the mission *Passenger Town* (First Contact) teaches it.
The open questions, decided by the owner ("do your recs", Nov 23 2026):

- **Strip order on the building's panel (S): kept.** Workers in Terrafall are never selected, so the colony's free
  Workers go, up to 3 a building, like Call a worker.
- **Sentries stay part of their building**, not robots, **but now guard their post against anything:** they shoot the
  Murmur that come near as well as any colony's robots, and a Murmur creature right beside the building claws at the
  sentry (`TOWN.murmur`, half its bite a second: modest, so a pack passing through wears one down, it doesn't strip
  the town of them). Warbots are still sent by selecting them and tapping the building.
- **Salvage numbers: kept** (a unit every 4 s a Worker; `TOWN.perTile`; caches; sentry armour 40, 2.5 damage a second).
- **The avenues are real roads (BUILT):** worn old Accord roads (`TOWN.avenue`: plain road surface, road speed), owned by
  no one till a colony's land takes them (`S.wown` -1: `wayOwner` falls back to the land's owner), so Haulers and trucks
  use them once a colony's roads join them, and they wear, are torn up and can be removed like any road. Nothing stands
  on them and no arcade closes them, so the town has a backbone; the side streets stay old paving. Two colonies: the
  middle street from base side to base side. They end at the town's edge (the few tiles to the base are the colony's to
  lay). Recommended, not asked: a mission goal (*Join a road to the town's old avenue*).
- **Three and four players (BUILT):** four on a square map, a colony on each edge a little left of its middle, a square
  town with the town square and its one civic tower in the middle and an avenue in front of each colony right across the
  town (a #), turned 90° tile for tile; 2 vs 2 pairs neighbours (bottom and left against top and right). Three on the
  round planet, a round town (reaching further out between the colonies than in front of them), an avenue from each
  colony's side to the middle; a grid can't turn 120° tile for tile, so the thirds are matched as near as it allows
  (the same sentries, caches and arcades; salvage scaled even), like the rest of the three-player maps. The map card says
  3–4 players. Open: the three-player town's diagonal avenues are staircases on the grid, so a Hauler's trip along one
  to the middle is longer than straight down the first colony's (the trip on foot is about the same).
- **Trade Posts in the town: kept, as the town market:** only on a square or a parking lot, never in a street or by a
  welcome sign (`townPostOk`).
- **The look:** the buildings are rendered sprites (ART_GUIDE.md, Batch 33); the ground is drawn in code. Roads on the
  town's ground (the avenues, and any a colony lays) show through its paving.

## The Dam (built Nov 23 2026; design calls for the owner)

The owner's idea (approved): a high lake behind a dam over a colony's valley; wreck the dam and the lake floods the
valley. Built as `SHAPE_PRESETS` `dam` (README, The Dam; How to play, The Dam); the mission *The Dam* (First Contact)
teaches it. The calls made in building it, open for the owner:

- **Symmetric, not upper and lower colonies.** Every colony has its own valley under its own reservoir and dam, on a
  shared high shelf in the middle; so it works for two (turned half round), three and four (a star, turned a quarter
  at a time), every side the same. The "upper colony with a threat to wield" is whoever holds the high ground: your
  rival's dam stands across the shelf from you, its face over their valley, and both of you have the same reason to
  strike early and the same thing to guard. An asymmetric two-player version (one colony up, one down) would need a
  different plan for each side; not built.
- **How it's wrecked:** a strength of 400. The colony orders it wrecked from its panel (W), then its armed army robots
  within 3 tiles of the face take 1 a second off it (ten warbots: 40 seconds), a Howitzer within 6 tiles 3. Shells,
  bombs, Missiles and Mortars don't touch it (it was built to hold a lake): to be asked. Anyone can wreck any dam,
  their own included.
- **Defending and repairing:** warbots guard it; Shore it up (U) sends up to 3 free Workers, 2.5 a second each, only
  once nothing has hit it for 6 seconds and no enemy is about, and it costs nothing. A Cement cost per point mended
  is the obvious lever if it proves too cheap.
- **The flood:** 3.5 tiles a second down a fan from the dam's foot, stopping about 4 tiles short of the Command Base.
  Robots it reaches take 4 (in the river's path they're carried to the bank); buildings lose half their full armour,
  those in the river's path are wrecked (the Command Base never: it keeps 1); crops and Stalks wash away; roads, track
  and pipes on the river wash out; open ground is shallows for a minute (robots wade), then goes down leaving fertile
  silt on about half. A shallow river and its pool stay for good (Haulers and trucks need a bridge). The lake drains
  to a muddy bed with rich Ore and Crystal in the mud, and the breach becomes a ramp up from the gorge: a burst dam
  costs its valley and opens the high ground to it. Open: whether roads off the river's path should wash out too.
- **The rival computer:** guards its dam when your army comes near or hits it, shores it up after, and from 7 minutes
  in (14 on Easy) wrecks a foe's dam when it has 8 armed robots to spare and at least 3 foe buildings stand in the
  flood's way (never with its own there). It doesn't yet avoid building in its own flood's path.
- **Lore:** the panel calls the dams the Pathfinder's reservoirs for the first colony ("Reservoir 4. Capacity for the
  first colony: 200 years. Gauge read daily. Reading: full."). LORE.md isn't changed: whether the Pathfinder built
  dams is the owner's to say.
- **Not built:** Flood season (the planetary event) and a dam that can be opened on purpose (a spillway gate to drain
  it safely, or to flood a valley on cue); the ART_GUIDE look is drawn in code, no rendered sprite yet.

## The owner's notes, Nov 21 2026 (for later)

- **Lance of Corvane cooling down (BUILT, Nov 21 2026):** while it reloads, the barrel glows red-hot and smokes, fading slowly back to its
  normal look as the reload runs out (drawn from its reload clock; red at its hottest just after the shot).
- **Hollow seed 12 stalls again** (75 min, AI vs AI): the rule that fixed it (a rival's own dismantled crates not hauled
  first, `collectCrates` in js/sim.js) made a reloaded save play differently (murmur-forms-sim-test), so it was undone.
  The likely cause is cached road-network state the crate path reads; find it, then bring the rule back.
- **Next after the current batch (the owner, Nov 21 2026):**
  1. Design the new top-tier Murmur unit (the behemoth in the Murmur rework notes): a design sheet first.
     **The owner chose the Harrow (Nov 21)**, the walking siege mound, with Scuttlers in its spine and a cave-in
     crater when it comes up (design/behemoth on the behemoth-design branch). Being built into the game.
     The owner (Nov 21): the biggest and scariest-looking Murmur form, and the most powerful thing on the map:
     almost an endgame unit, which only a real army can bring down. **On the Hollow (the owner, Nov 21):** when the
     Deep's mound is almost destroyed, two burst out of it: one heads north and one south, one for each colony (one per
     colony with three or four). **And late in both campaigns** (the owner, Nov 21): the Main Campaign's Act III, and Contingency late in a
     run or with the Murmur meter high. **And in long ordinary games on Active** (the owner, Nov 21): past a set
     point, a 50% chance it comes, rolled from the game's seed so it stays rare. Which point: **night 6, confirmed by the owner (Nov 21 2026)** (one seeded roll at its dusk warning; on a hit it comes on a seeded night from 6 to 8).
     **BUILT (Nov 21 2026): the Harrow** (README, "The Harrow"; How to play, The Harrow; ART_GUIDE Batch 31; the
     mission *The Harrow* in First Contact; `lh/harrow-test.js`). Numbers measured, not the sheet's guess: **240 health**
     with small arms at a quarter (960 points of small-arms fire; the sheet's ~1,400 came before robots' ammo was
     counted: a 20-robot army fires about 250 points, heavy and quarter-strength, before it must reload). The owner
     (Nov 21): night 6 **confirmed**; **keep the slam and its strength as they are** (the owner will test it and wants it
     tough); **its crater stays open as a tunnel exit** of its nest (BUILT). Open: whether a second roll comes much later;
     whether Arc Casters should heal it (the sheet's Bearer idea, not used).
     **Refined (the owner, Nov 22 2026; BUILT):** a fifth smaller (drawn 4.8 tiles, its body `r` 1.2 and bite `reach` 2.1, so it still bites 0.9 tiles past its body as before;
     health, damage and the slam's 3 tiles unchanged), eight walking frames with its weight in them, breathing as it
     stands, a bite, swinging round slowly, the slam's crouch and impact (the screen shakes), and a death of its own
     (staggering, spires shattering, a thud, the core bursting: ART_GUIDE Batch 31, README). Open: whether its death
     should do something (stun robots round it as the core bursts?): for now it's looks only.
     **BUILT (Nov 21 2026): the Harrow** (README, "The Harrow"; How to play, The Harrow; ART_GUIDE Batch 31; the
     mission *The Harrow* in First Contact; `lh/harrow-test.js`). Numbers measured, not the sheet's guess: **240 health**
     with small arms at a quarter (960 points of small-arms fire; the sheet said ~1,400 health before robots' ammo was
     counted: a 20-robot army fires about 250 heavy and quarter-strength points before it must reload). Open: the roll's
     night (6: **proposed, awaiting the owner's confirmation**); whether a second roll comes much later; whether its
     crater should stay a tunnel exit; whether Arc Casters should heal it (the sheet's Bearer idea, not used).
  2. A smarter Murmur AI, and the Murmur about twice as hard overall: on **Quiet** a nuisance; on **Active** a real
     third opponent, slow at the start and growing powerful by the late game (more and bigger raids, planning, the new
     unit late on).
     **BUILT (Nov 22 2026): the Murmur grow bolder on Active** (README, "Bolder as the game goes on"; How to play, The
     Murmur, "Armed robots" and "As the game goes on"; the guide; *What Comes Up* teaches the hunt with a goal to
     collapse an exit near the colony; `lh/murmur-smart-test.js`; measuring: `lh/murmur-smart-measure.js`,
     `murmur-smart-batch.sh`, `murmur-smart-sum.js`). `MURMUR.bold`: (1) **threats**: an armed robot within 5 tiles (or
     whatever just hit one) is never walked past: a pack half again as strong turns on it, a weaker one falls back and
     comes on again (twice, then carries on), and shot at after that it fights; the Leech, Spitter and Sapper turn only
     on what shoots them. (2) **Pressure** from the 3rd night: 1.25, 1.5 ... at most 2.2 by the 7th, times the colony's
     power (buildings and twice its armed robots over 40, 0.6 to 1.6), never under 1: bigger packs, more up at once, an
     extra exit a nest from the 4th night (two from the 6th), a third wave from the 4th; a strike done with its target
     goes on through the colony. (3) **The hunt** from the 4th night: every 40 s teams come up at the colony's unguarded
     weak points (power cut first, sites, lone buildings, the robots there), only through exits within 40 tiles of it.
     (4) **The horde** from the 5th night: a strike under way is fed fresh packs every 35 s up the exit nearest it.
     Quiet is untouched (the same game, hash for hash); missions only where one asks (`bold`). The rival also turns a
     squad out at a Murmur exit into its Harrow flag. Fixed on the way: a game loaded part way through the danger maps'
     15 ticks rebuilt them from where things stood after loading, so a save could play on differently (`S.dng`,
     `S.mgn`). Measured (60-minute computer-run Colony games, seeds 7 and 8, Standard Small and Huge, the Hollow Small
     and Huge, before → after): **Active**, robots lost to the Murmur in all eight **22 → 77**, by night 1-2 15 → 15,
     3rd 3 → 14, 4th 2 → 23, 5th 2 → 25; the most up at once on the 5th night 15 to 18 → 23 to 45 (the first two nights
     the same); buildings at 15 minutes 218 → 218, at 30 291 → 291, at 45 341 → 334, at 60 360 → 349; blows on buildings
     in all eight 2,309 → 8,716, roads torn up 119 → 215, sites wrecked 12 → 11, the power cut 13 to 17 times a game →
     11 to 18. **Quiet**: unchanged (150 robots lost, 237, 308, 365, 395 buildings, before and after). Versus (Medium,
     shapes 0, 2 and 4, seeds 21 to 23, and the Hollow Small 21 and Medium 11, 75 minutes at most): Active, 11 of 11
     decided before and after (none undecided), a win in 27.6 → 21.4 minutes on average, 5.4 → 2.3 robots a colony lost
     to the Murmur (most games end by the 2nd or 3rd night, before the pressure starts, and packs now fall back from
     squads they can't beat; three winners changed); the Hollow won both times (Small 21 at 18.3 → 11.7, Medium 11 at
     28.0 → 20.7); Quiet, four games, unchanged. An earlier cut without the power floor and with packs turning on
     anything they merely outweighed ran one Versus game to the cap (both armies bled out at the exits), hence those two
     rules. Missions: *What Comes Up* won at all five levels (now 13 to 20 minutes of its 25 with the new goal; was 9 to
     11), *Something Keeps Time* and *The Harrow* played through and won; *Under the Bloom* has no play-through in the
     kit (the computer player never builds its Engine), and on it only the threat rule applies.
     Decided here, for the owner to check: the first two nights stay as they were (the pressure starts on the 3rd); a
     beaten or small colony draws them less (so a computer rival with no army isn't hunted into a stalemate: one Versus
     game ran to the cap with no such floor); finished buildings still can't be wrecked (but a Wall or Gate); the hunt
     and the horde come only through exits near the colony, so collapsing them is the answer.
     Open: whether the late horde should grow past the 7th night; whether the Harrow should lead a horde; the hunt in
     missions other than *What Comes Up*.
- **Global leaderboards (the owner, Nov 21 2026: for later, for when the game goes public).** Built on the relay's
  Cloudflare Worker (a small table of scores + a page to read them). Scores are proved, not trusted: the game is
  deterministic, so a submission carries the day's setup and the player's orders, and the server (or a nightly job)
  replays it and only then accepts the time. Steps: (1) the Daily Planet board, no accounts: a hidden player ID made on
  the device and a chosen display name (lost if the browser is cleared); (2) all-time boards (Daily Planets won, longest
  daily streak) and per-Mission fastest clears, later a Versus ranking; (3) optional accounts (passkey or an email link,
  no passwords) that also carry cloud saves between devices. Plan for a name filter and a way to hide names, a short
  privacy note (only ID, name and scores until accounts), and Cloudflare's free tier covering it.
- **Megastructure design sheet: Seismic Lance, Deep Core, Atmosphere Engine, and Arrival City's new Soviet-bloc look
  (Nov 21 2026): APPROVED, the recommendations for all 31 questions except the Seismic Lance's look, which is
  **B Piston Battery**. Renamed (the owner, Nov 21 2026): the **Sundering Ray** (first Groundbreaker; not "Seismic Lance": the Lance of Corvane already has the name); short name and key to choose so they don't clash. Was recommended: Seismic A Hammer Pit, Deep Core A Headframe, City A Four Blocks round a Square (C Twin Towers runner-up),
  **The Sundering Ray's look and effect, the plan (the owner, Nov 21 2026), real seismic methods:** a phased array.
  A ring or line of heavy hydraulic ram plates set in the ground (vibroseis-style) round a central bore tower over a
  deep shot hole. Charging: the rams pump one after another in a rolling, visible drumroll, dust lifting off the plates,
  the hum climbing. Firing: the bore charge goes off and every plate slams in a timed ripple; the tiny delays steer the
  energy one way (how real seismic arrays and radar aim without moving), so it really is a ray through the earth. The
  ray: a bulge running through the ground to the target, dust kicked up along it, a line of small cracks, trees shaking,
  robots staggering as it passes; it arrives a moment later (sound through rock), which gives the target its warning
  naturally. On arrival the ground heaves and cracks spread in a circle; Murmur tunnels cave in along the path and at
  the target. Keeps the approved Piston Battery look.
  - **The Sundering Ray: BUILT (Nov 21 2026)** (README, "Megastructures"; How to play, Megastructures and The Murmur; the
    First Contact mission *Something Keeps Time*). Short name **Ray**, key **Y** on the Mega tab (L is the Lance's; D pans
    the map, S too; the Deep Core is free to take any of E, K or P). The Piston Battery as the plan above has it: three
    hydraulic rams in a block round the bore tower over a shot hole, two stacks, six ram plates in a row before it
    (`renderer/b/sunder.js`); the rams pump in turn and the plates drum, faster to the blow; at the blow the plates slam
    in a timed ripple, the far side from the aim first; a bulge runs through the ground with dust and cracks behind it,
    caving in tunnels a tile either side of its path; on landing the ground heaves in rings and cracks spread (fading
    over 5 minutes). Every other answer the sheet's recommendation and its numbers. Decided here, for the owner to check:
    the ripple runs 10 tiles a second (1.5 to 6 s on the way, so a Quake's target has the ring's 20 s and a moment more);
    a Quake's aim is fixed once its ring shows (else the warning means nothing); a Quake cracks the colony's own
    buildings too (as the Lance's line burns its own), but nothing on a Trade Post's ground; a Strike the Deep's seal
    runs through the second night after the blow; cracked roads are mended by idle Workers by themselves, a 3 × 3 patch
    in 4 s (no Cement), cracked foundations by the ordinary paid Repair; stunned robots neither move nor fire for 4 s;
    the AI Warden picks it from 15 minutes in (when its pick is still open), as its one weapon, no Nuclear Silo then, and besides striking after a raid strikes the nest nearest home every other day while it is within 40 tiles (with no raid it would never fire: Wardens seldom march into Quake range).
    Open: whether the Murmur should also go for it on the night of a blow struck after dark (now: only the next night),
    and the balance audit's look at its numbers.
  Atmosphere Engine A Rain Tower with the missions Rain, Seed Vault, Under the Bloom and Landing Zone; build order City
  look, Deep Core, Seismic Lance, Atmosphere Engine. Ask the owner before starting each.
  - **Arrival City's new look: DONE (Nov 21 2026).** Four Blocks round a Square replaced the Terraced Arcology outright
    (art: `renderer/b/city.js`), the LED strips lit in the owner colony's colour (`city-led`, tinted in code), WELCOME
    HOME on the roof, WEL OME HOME flickering on the wreck (`city-lit-down`). No rules changed. Open: whether the side
    blocks should show their courtyard faces (the camera sees only their roofs and south gables), and a lit mosaic.
  - **The Deep Core: BUILT (Nov 21 2026)** (README, "Megastructures"; How to play, Megastructures; the new Industry and
    Trade mission *Dry Ground*, after Trade Winds). Look A, the Headframe (`renderer/b/deepcore.js`: the wheels turn while
    it works; the violet glow out of the shaft from stage 2, brighter at stage 3; the gauge's lamps), the name kept, and
    the sheet's numbers (60 Cement, 40 Alloy, 20 Chips, 10 Crystal, 300 s, armor 100, from 20 minutes, one per colony;
    6 Ore; 8 Ore and 3 Crystal after 6 minutes of power; 10 Ore, 4 Crystal and a Uranium every 4 minutes 10 minutes
    later; 30 of each in its hoppers; a Generator within 4 tiles burning a Fuel a minute, or a Reactor, no Uranium). The
    Murmur: a raid half again a night's pack the night after stage 2; the night after stage 3 two more Brutes and a new
    exit within 8 tiles; twice as big in the Hollow; nothing with them off. Destroyed: depth and stock lost, the shaft
    their exit until a Worker caps it (20 s, 4 Cement). Rivals: never under the cap; any rival from 30 minutes once its
    last Ore Mine is dry, guarding it on a call night; the Salvager marches on stage-3 Cores. Read into the sheet, for
    the owner to confirm:
    - "Breakers" in the sheet are the Brutes (LORE.md: the art brief's Breakers describe the Brute's size).
    - A Worker caps the shaft by itself (no button), paying the 4 Cement from storage as it sets out; warbots can also
      cave it in like any exit. Dismantled (not destroyed), a Core leaves no shaft.
    - "A crater for 5 minutes" is not a separate rule: the shaft (with the Murmur on) is the lasting mark; with them off
      the ground is free at once.
    - The Core's output is multiplied by the colony's difficulty `mult`, like every producer; Arrival City's boost
      doesn't reach it. It can be turned off on its panel like the Shield Dome (owner, Nov 21): no Fuel burned, depth kept.
    - The Hollow's "each stage counts double" is read as every call twice as big (Brutes too).
    - The mission *Dry Ground* teaches the Murmur briefly before First Contact (Quiet, four warbots), as the sheet put it
      in Industry and Trade; its Crystal goal counts what the Core brings up (12, 20 or 30 by level).
  - **The Atmosphere Engine: BUILT (Nov 21 2026)** (README, "Megastructures"; How to play, its own section "The
    Atmosphere Engine: terraforming"; the missions *Rain* (end of Growing the Colony), *Seed Vault* and *Under the Bloom*
    (First Contact, after What Comes Up) and *Landing Zone* (War, after Aimed the Other Way)). Look A, the Rain Tower
    (`renderer/b/atmos.js`; the plume, its night light and the rain in code), the sheet's numbers (50 Cement, 40 Alloy,
    24 Chips, 30 Crystal, 20 Fiber, 360 s, armor 100, 4 × 4, from 20 minutes, one per colony; 2 Generators, a Fuel a
    minute each, or a Reactor, a Uranium every 6 minutes; Calm 8, Rain 12, Green 16, Garden 20 tiles at 0, 6, 16 and 28
    minutes of power) and the (R) answers: everyone's circle (since made its owner's: below), green stays green when it falls, the Murmur first every
    night and Sappers at each new stage, no exits in the Garden, the Steward's project and the Herald's burning, no
    terraforming win yet. Read into the sheet, for the owner to confirm:
    - Key **N** on the Mega tab (A pans). Its own How to play section, with a pointer from Megastructures.
    - Its hold (Calm, the Bloom kept out, no exits) lasts while it stands, powered or not; only the growing needs power.
      Each stage's change spreads out from its foot at a quarter tile a second; the ground already changed moves up a
      stage at once.
    - Calm lifts the dust storm's slow-down for robots inside its circle; Missiles stay grounded (the storm is still in
      the sky), and the storm's haze on screen is unchanged.
    - Rain makes the ground fertile (`S.fert`) except under deposits, Ramps and burned soil; it is drawn as damp dark
      earth with sprouts, not farm furrows. Puddles are not drawn; a drizzle falls round the tower at night.
    - "The Bloom stops spreading" is read as no Murmur tunnel dug into its Rain; "withers back a tile a minute" as one
      tile of the Bloom (tunnel or Bloom vein) a minute, the nearest the Engine first; the Garden clears all of it at
      once and caves in any exit there.
    - "Trees and groves seed themselves" is a stalk grove (Fiber) every 20 seconds on open Garden ground, 24 in its circle
      at most (the map's own count), and young trees drawn on Garden ground; deer and songbirds come to any patch of
      Garden (looks only).
    - Burned soil stays burned, even in a Garden; burning greened ground removes its green.
    - "They go for it first" is a standing Engine drawing every pack from 20 tiles further than anything else, and an
      Active strike's first target; Sappers: one after Rain, two after Green and Garden, on Quiet too, none with the
      Murmur off. No other raid size is added.
    - Dismantled, it fades like a destroyed one. Damage doesn't slow it (no half-armor rule as on the Deep Core).
    - Rivals: "barren" is The Rust and Cinderlands (the sheet's "ash" read as Cinderlands), from about 21 minutes; the
      Herald sends up to 2 Torches every 2 minutes to fertile ground of a foe's Engine where no gun covers it (no Napalm).
    - The missions follow the sketches with these changes: *Under the Bloom* has the usual nights (not longer) and its
      "survey road" goal is "push the Bloom back" by tiles; *Landing Zone* is on a Small map with the share to green by
      level (25, 32, 40%: the sheet's 40 at Commander; stage 3 or more counts, burned ground doesn't) and its deer herd
      is the Garden's wildlife; *Seed Vault* draws the Pathfinder's hull in code as a mission landmark (LORE.md's open
      question about the wreck is otherwise untouched), its seed stock four crates of Fiber, and its storm is the Endless
      dust storm modifier.
  - **The Engine's new powers: BUILT (Nov 21 2026), the owner's five approved** (the circle is yours, Storm Front,
    Drought, Lightning, rain puts out fire; README, How to play "The Atmosphere Engine", the guide; the new War mission
    *Overcast*, after Landing Zone). Numbers: mud 50% speed; the storm 5 tiles round, robots 60% speed, sites 60%,
    guns 75% reach, a minute before it moves again; crops wither after 3 minutes; lightning once a minute of power,
    15% of the building's armor, never below 30%. **Decisions made for the owner to approve:**
    - "The circle is yours" replaces "everyone's circle": the calm and the faster crops are the owner's and allies'
      (a crop's owner: the Bio Farm it belongs to, else whose land it is); the land itself (fertile soil, the Bloom held
      back, no exits) still changes for everyone in it. The mud starts at Rain (Calm is only calm), holds while the
      Engine stands, powered or not, and slows robots and vehicles, not the Murmur, aircraft or ships. A fallen Engine's
      fading hold keeps its calm for its owner, but no mud.
    - The rain puts out fire only while the Engine has power: cut its power and Torches can burn the green again. So the
      Herald's Torches, rained out, now go for a Generator feeding it (or its Reactor). Rained out means no scorching
      the earth and no flame burns (War scars) in its circle; their flame still hurts buildings and robots there.
      Napalm is unchanged (the brief named Torches).
    - The Storm Front has no range limit (anywhere on the map, like Strike the Deep); its centre must be its stage's
      radius plus 5 from the Engine's middle (17, 21, 25 tiles), and not inside another standing Engine's circle.
      Nothing of any storm reaches inside any Engine's circle, its owner's included (a fallen one's fading hold too),
      so a circle that grows into a storm set earlier is calm.
    - Unpowered (or the Murmur's cut at night), the storm is gone at once and comes back where it was with power; it
      rolls in and breaks up over a few seconds on screen. It can be called off on the panel; a new one waits out the
      minute. No power, no new storm. Rivals' sites under it go up at 60% (a site's middle under the storm).
    - The drought is crops only (Bio Farm crops, not Grove Planter stalks), counted while the crop sits continuously
      under the storm; out from under it the count starts again. The soil stays fertile: the farm can replant.
    - Lightning needs a foe's finished building under the storm; none there, the bolt is lost. It is picked from the
      seed (no new random state). It never takes a building below 30%, so it never captures or wrecks anything.
    - The rivals: "Warlord-type" is read as the warlike doctrines (Herald, Salvager, Warden) or any rival on the Warlord
      level: over the foe's guns when its next attack is 75 seconds off or less. The Steward and the Architect go for
      fields (farms and crops), anyone with nothing better for the base. It looks every 20 seconds and moves the storm
      only to a clearly better spot. (Only the Steward builds the Engine on its own today.)
    - *Overcast* (War, after Landing Zone): a Steward on The Rust with its Engine already at Rain (Green from Colonist),
      its storm on your Command Base at the start (the Steward may move it to your fields). Goals: break it (their Engine
      gone, or your own Engine's circle over your Command Base), hold the sky 3/4/5 minutes, and send a Storm Front of
      your own, which is where the button is taught: Landing Zone has its four goals, and the other Engine missions are
      Colony games with no foe to storm.
    Open: balance (the 60/60/75 numbers and the minute's wait), whether the mud should also catch the Murmur, and
    whether napalm should be rained out too.
- **Polish round 2:** skip the What's new popup and the credits for now.
- **Tip jar (for when the game goes public):** it's free, so a small, optional way to donate (a link on the main menu
  or in the pause menu; nothing pushy, nothing in a game).
- **Mass Driver sound (BUILT, Nov 21 2026: a deep charging hum, a crack and thump, a falling rush of air):** the launch sounds like a funny whistle. Give it something cooler: a deep capacitor whine
  building up, a hard electromagnetic crack or thump as it fires, and a fading rush as the canister leaves.

## The main menu with room for campaigns (built Nov 22 2026; for the owner's approval)

The owner (Nov 22): "We will need a good way to organize the main menu without being too cluttered once we add these
extra campaigns." Built while the owner slept, so every call below waits for a yes or a change.

**Structure.** Home has a few big choices and a quiet row; everything else is one tap further, never more than two.
- **Home:** the title, **Continue** (when there's a save; Saved games and Rejoin as before), **Play** (the last settings,
  at once), then four tiles two by two: **Campaigns**, **Custom Game**, **Multiplayer**, **Daily Planet**. Along the
  foot, five small icon buttons: **How to play**, **Lore**, **Settings**, **Feedback**, **More**.
- **Campaigns** (a view in the same card, like Custom Game): a card each, picture, a line in the setting's voice and
  progress: **Missions** ("Command, newly woken. Learn the planet one order at a time.", finished / total, Next up, a
  bar), **Main Campaign** ("The last reserve Command Base. Fifteen missions, three acts.", *In preparation*, its acts
  as a teaser), **Contingency** ("The sealed orders, opened. Secure Ithaca I.": calls `openContingency()` once that
  exists, *Coming soon* until then), and a dashed **Co-op scenarios** card ("Two Commands, one landing.", *Later*).
- **More:** Observer, Records, Load a save file, Load from a code (and a leaderboard later, if one comes).

**Why.** The old Home had thirteen things of about equal weight (Daily card, Play, two big buttons, four text links,
five pills); three more campaigns would have made it a list. Grouping by what a player came to do (play now, play a
campaign, set one up, play with friends, today's planet) keeps Home to five big targets however many campaigns come:
new ones become cards in the hub, not buttons on Home. The hub is a view inside the menu card, not a full screen, so
the card stays the same width (the menu planet sits beside it) and Back / Esc behave as Custom Game's always did.
Observer, Records and the two loaders are used rarely and only by people who know they want them, so they went to
More; the help, story and settings stay on Home because a new player looks for them.

**Calls made (please approve or change):**
- Missions left Home for Campaigns (one tap more for the tutorial). The Campaigns tile reads "Start with the Missions"
  until one is finished, then "Missions: n of N done", so a new player is still pointed at them.
- The Daily Planet became a tile (gold, short date, the planet in a line, the best time once there is one); its
  "The same planet for everyone today" line moved to the tooltip and How to play.
- Observer, Records, Load a save file and Load from a code moved to **More**. Records could come back to Home (a
  sixth small button) or go into Campaigns if it grows into per-campaign records or leaderboards.
- The card pictures are 160 px crops of the Lore guide's art (`art/menu/`): the Rust's ground for the Missions,
  Ithaca I from orbit for the Main Campaign, the atlas globe for Contingency. Real art (a mission briefing frame, a
  sealed-orders envelope) would be better later.
- On an upright phone with the Planet background, the card now starts below the planet's orbit and the app icon is
  left out (the planet stands in for it), so the planet is never covered; on Classic nothing changed there.
- The Main Campaign card names the acts, including Act III's "The Silence" (a word from the lore's core vocabulary,
  not a statement of Earth's fate). Say if the act names should stay hidden until the campaign ships.
- Contingency's card can show a status line from the Contingency code (`contingencyMenuLine()`, e.g. "Year T+7 ·
  11 of 28 territories") once that worktree adds it.
- Arrow keys move the focus between the menu's buttons by where they sit, for keyboards and controllers that send
  arrows; there's no Gamepad API support anywhere in the game yet (a separate idea).

## Five rival levels (built Nov 21 2026; open questions)

The rival levels are now Settler, Pioneer, Colonist, Commander and Warlord (the owner's set C, "Frontier"; keys
easy/medium/normal/hard plus `warlord`). Warlord: mult 1.6, grace 100 s, threshold 3, four sites, thinks every second,
12 more of every good, raids every 90 s. In AI against AI (Standard, Steward against Steward, both seats, seeds 1 to 8)
a Warlord beat a Commander in 12 of 16, every game decided (8 to 20 minutes; one Warlord took a base at 3½ minutes).
- Is Warlord winnable by a strong human? Nobody has played it yet; if its first attack (from about 1½ minutes) is too
  much, raise grace before the economy numbers.
- Missions now use the same five levels (the owner's call, Nov 21 2026): old Easy, Normal and Hard are Settler,
  Colonist and Commander, and their ticks moved there. Pioneer and Warlord values are worked out from the old three
  (`mPick` in `js/missions.js`) and only Touchdown has been played through at Warlord: the tight clocks (Convoy's 13
  minutes, with Warlord's bigger goals and a Normal rival) may need their own five-long values once played. (Convoy has
  them since Nov 22 2026: a Medium rival and 16 minutes on Warlord. Border Dispute on Warlord is lost by the script too: see
  the balance audit of Nov 22 2026.) The
  future Main Campaign (CAMPAIGN.md) uses the same five.
- Observer mode gives every colony one level; a level per colony (as diff5-aivai.js does) would make Warlord against
  Commander a thing to watch.

## Contingency: a repeatable planet-conquest campaign (the owner's idea, Nov 21 2026)

A second campaign, apart from the Main Campaign and replayable: conquer Ithaca I region by region, as in Galactic
Conquest from Star Wars Battlefront II (the inspiration only; the name and look are ours). In the lore, the vanguards'
sealed contingency orders said "secure Ithaca I for us"; each run plays those orders out as a fresh what-if.
**Order (the owner, Nov 21):** Deep Core, Sundering Ray, Atmosphere Engine, the top-tier Murmur unit and the smarter
Murmur first; then **Contingency, before the Main Campaign** and other items.

**The full plan is in CONTINGENCY.md** (Nov 21): the globe, turns, battles, Reserve, the Murmur, megastructures
on the globe, winning, rival AI, screens, the build order and the questions still open.
**Decided (the owner, Nov 21):** the name is **Contingency**; the planet map is **turn-based**; battles are
**shorter** than a free game (about 15 to 25 minutes); **auto-resolve** is allowed for any battle.
**Open:** factions. Either the four vanguard callsigns, each with a small perk from its Sponsor (COBALT cheaper and
faster roads; VERMILION more Ore and Alloy; VIRIDIAN better Bio Farms and Agribots; TYRIAN better Trade Post rates),
or those callsigns plus a choice among the rival doctrines. Also open: whether fleets on the map can be intercepted
before they land, and whether a run ends on a fixed turn count.

The design so far:
- **The planet map:** the turning Ithaca I from the menu (js/menuplanet.js), reused as a globe you spin. It is cut
  into about 20 to 30 territories grouped by the LORE.md regions: the Rust, Greenreach, Emberwood, the Long Grass,
  Blackwater, the Polar Caps, Cinderlands, Steamwells, the Bloom and the Shoals. **Argos** is a front of its own,
  reached from orbit, and the only ground with no Murmur. **The Shoals** are reached only by sea or air, so a coastal
  Port territory is needed first. Each vanguard starts with a home territory.
- **Turns:** every side moves its landing forces (Command Groups dropped from its Carrier) one territory at a time.
  Moving into an enemy's territory starts a battle: a normal Terrafall match whose biome, map shape and size come from
  that territory. Rivals attack you too, and you defend in a real match. Any battle can be auto-resolved.
- **Territories pay:** each one adds supply to your Carrier between battles (the Rust Ore, Greenreach Fiber,
  Steamwells Fuel, strike sites Crystal). Special places: the **Uplinks** (hold most of them to win), **Arrival City**,
  **the Pathfinder's landing site** (a unique bonus), and the **Trade Posts** (neutral; nobody can take them). Fortified
  territories keep some walls and turrets: the next battle there starts with them built.
- **Between battles:** the Carrier's reserve stock buys upgrades (extra starting units, a second Command Base,
  research done ahead) and one-use cards: an **orbital drop** (reinforcements mid-battle), a **called ringfall**
  (a strike from the Ring), an **Accord ledger deal** (a cheap trade at a Trade Post), and a **Corvane flare** (enemy
  batteries drain).
- **The Murmur:** spread out from the Bloom and the Hollow between turns into territories nobody guards. Any vanguard
  can push them back. Late in a run, an assault on the Hollow can be an optional major battle that pushes the Murmur
  back for good.
- **Winning:** hold most of the Uplinks for a set number of turns, or take every rival's home territory.
- **Every run differs:** territory layout and resources are shuffled, rival doctrines are random, planet events come
  (a ringfall season, a flare year), and difficulty runs from Settler to Warlord. A run is about 3 to 6 hours, saved
  between battles. Later: 2 to 4 players on the same planet map, as allies or against each other.

### Contingency: built so far, and calls made for the owner's approval (Nov 22 2026)

Built: the engine (`js/contingency.js`, stage 1, tested headless over 50 to 200 whole runs) and the globe screens
(`js/contingency-ui.js`, stage 2), reached from the main menu's **Contingency** button. The plan was silent on these;
each is a call waiting for the owner's yes or no:

1. **Fixed places stay fixed.** The atlas's named places don't move: the Pathfinder's site at Pathfinder's Landing,
   Passenger Town, the Trade Posts at Ledger Post and Geyser Field (Spring Market), and four Uplinks at Northcap,
   Stillwater, Lantern Reef and the Lunar Relay. Each run deals the resources within each region, the fifth Uplink
   (in Emberwood, the Long Grass, Blackwater, Cinderlands, Steamwells or Southcap, never on a home) and the homes.
2. **Trade Post territories can be held.** The Post itself stays neutral (in a battle it's a neutral Trade Post on the
   map). Holding one pays 3 Reserve (4 for TYRIAN) and is what the Accord Ledger Deal card needs (+10 Reserve on the
   globe; half price in a Wren year).
3. **Palm Keys and Lantern Reef** are joined by a sea crossing of their own ("the Shoals' channel"); the atlas gave
   them no border.
4. **The Murmur start under every surface Uplink (level 1), and a side transmitting on 3 Uplinks draws surges at them**
   (20% an Uplink a year): "the ground answers the signal" (LORE.md: they repeat the Uplink's rhythm back). Without it a
   quarter of the computer-only runs were won on the Uplinks by T+9, before anyone could answer.
5. **A 1-star Command Group that loses a battle is lost** (it has no rank left to give up), as is one with nowhere to
   retreat. Without it groups almost never died and Reserve piled up.
6. **Several Command Groups may share a territory** and fight together in its battle.
7. **Taking a territory wrecks its megastructure** ("as long as you hold it"). An auto-resolved win has a small chance
   (6%; the Architect's 22%) of finishing one, so the globe's megastructures show up in auto-resolved runs too.
8. **Unguarded ground:** an enemy territory with no Command Group and no fortification is taken by walking in; one
   fortified but empty is a battle against its garrison.
9. **Orbit costs Reserve:** 3 a move to or from Argos, 1 with the Orbital Lift Charter (the refit's "cheaper moves").
10. **The Murmur meter:** +2 for every battle between vanguards, +1 for one against the Murmur, −1 a year, at most 100.
    Spread chance a year: (10% + 0.5% a point of meter) × the infested territory's level ÷ 2 (×1.7 Rampant, ×0.5 after
    the Hollow falls). After the Deep's mound falls the Hollow fills again slowly (they never go away for good); the
    assault can be made once a run.
11. **Truces are only ever with you** (rivals don't make them with each other yet). The Steward offers one when you're
    1.4× its strength or the meter is 60+; the computer answers in its doctrine's voice. An alliance offer comes when a
    truce has been kept 5 years (never from the Salvager).
12. **Rivals without their home can't buy Command Groups; you can** (the plan says so of rivals only). You lose when you
    have no group and under 14 Reserve, or no territory at all.
13. **Events:** each of the four comes 10% of years (60% none), announced in the report the year before.
14. **Probability of contact:** 0.2% × 2^((31 − T) / 6): 6.4% at T+1, never shown as zero, 0.2% at T+31.
15. **The window (T+31):** the rivals double the value of Uplinks that year; the most Uplinks wins, then the most
    territory, then the most stars.
16. **Auto-resolve numbers:** a group's kit is 4 warbots at 1 star to 14 at 5 (+2 Heavier Kit); defenders ×(1 + 0.15 a
    fortification level), ×1.1 at home, ×1.08 on the Polar Caps, the Shoals and Argos; an empty fortified territory
    fights with 1.5 + 2.5 a level; refits ×1.04 to ×1.07, Torch Doctrine ×1.25 against the Murmur, +2% a supply line,
    battle cards ×1.06 to ×1.15; rivals by difficulty ×0.9 to ×1.12; yours ×0.92 (a little below playing it); odds by
    strength to the power 2.2. A star a played win, half a star an auto-resolved one; a winner at under 45% may lose
    a star.
17. **Played battles (the bridge):** a battle against the Murmur alone is a Colony-mode match held for 12 minutes, or
    won by clearing every nest on the map; a surge, "until dawn", the same with the Murmur at least Active; when the
    Deep's mound sends out its Harrow (one per colony), Contingency sends a second the other way, so two come; the Hollow assault is won by destroying the Deep's mound; at the cap the land held
    decides, and the defender wins within 10% of the leader. The kit: +2.5× the starting stock × (stars − 1) / 4 and
    +30 Ore at 5 stars; +15 of each resource type held. Level 2's walls are a line of 7 Wall pieces 7 tiles out toward
    the nearest foe (as Siege Breakers' outer works), with a gap where a road goes through; level 3's Shield Dome is a
    site, joined by road, that the defender still has to supply. The Harrow comes six minutes in. Played wins give a star;
    survivors are recorded but don't add rank beyond it.
18. **Refits in battle:** Sealed Research seals one Research Lab upgrade, chosen when it's fitted (Power Tools by
    default, and the computer's pick); Torch Doctrine is ×1.5 to the Murmur from that side's Torches.
    **Cards in battle (stage 4):** Orbital Drop lands 6 warbots; Called Ringfall is five strikes round the spot (they
    dent, as Ringfall does, and crater roads); Corvane Flare drains every rival robot to 20% battery. They aim at the
    tapped tile (or the crosshair's middle of the view). The computer plays its cards at set times (the Flare at 4 minutes, the
    Drop at 5, the Ringfall on your base at 7). Road Standard and Foundry Surge are played on the battle card, as they act
    at the start; a flare year starts every battery at 40%.
19. **Ironman:** a battle keeps one save, for Continue and its battle card; restore points, slots, files and codes are
    refused, with a line saying so, and once a battle has begun it can't be auto-resolved instead. Withdraw still
    works. (Closing the tab loses at most the last in-game minute, as for any autosave.)
20. **Battle length (play-tested, computer on every side, 12 battles through the bridge):** home assaults on Large ran
    19 to 35 minutes (two to the 35-minute cap); assaults on other ground 7 to 19; Uplink battles 8 and 23; contested
    landings 9 and 11; three-sided battles 6 and 7. Median about 13 minutes, below the plan's 15 to 25. What ends them
    early is a capture by a side with a much higher rank (1 star against 3 or 4) or a Herald's rush; between equal
    ranks they mostly run 15 to 25. Tuned: the kit's warbots now come in waves (4 with the base, 6 for a defender, the
    rest at 3 and 6 minutes), which took a 1-star-against-3 home assault from 6 minutes to the cap; the others moved by a
    few minutes either way. Still open for the
    owner: a grace before a Command Base can be captured, or Medium-only maps for three sides; a person defends
    better than the computer, so played battles likely run longer than these.
21. **Megastructure targets (the owner approved picking them, Nov 22):** your Lance and Ray are aimed in the Spend phase
    when they're charged (a tap on a lit territory; the Ray asks Murmur or walls where it could do either), or Skip.
    Rivals' weapons, Skip and a target no longer in range use the automatic choice: the Lance the most fortified enemy
    territory two borders away, the Ray the first infested neighbour, else an enemy's fortification. The Lance's star
    loss spares a friend's groups.
22. **The win screen's year:** it reads the year the run was won and that year's odds of contact ("Arrival clock:
    T+19. Probability of contact: 0.9%"); at T+31 it is the plan's line exactly (0.2%). A rival's win reads "...
    speaks for Ithaca I ... Command authority transferred. Hold position."; the Steward's and others' on-defeat lines
    are their doctrine's surrender lines.
23. **Home territories pay 2** like plain ground (the plan gives them no income of their own).
24. **Balance (200 computer-only runs):** about 44% won on the Uplinks, 38% in the window, 18% by conquest; median run
    T+27; every callsign and doctrine wins (the Salvager least, about 19% of its runs against 25 to 32% for the rest).

### Contingency's landmarks (Nov 22 2026; approved by the owner as shipped)

The atlas's named places (LORE.md, The atlas) are now set pieces in a Contingency battle fought in their territory
(`js/landmarks.js`; README, Contingency). Each is scenery with its name (hovered or tapped; in faded atlas lettering
zoomed out) and, where it fit, a light touch. The owner approved all of it as built (placement, wreck territories,
the numbers, the three logs, the flavour lines); the "Open" notes and item 7 stay open for later:

1. **Where they go.** Near the middle of the line between the sides, outward from it to the first spot where it fits:
   open ground, nothing already there, at least 7 tiles from a base (5 if there's no room), and every tile either base
   could reach before still reachable (so never the only pass). On a cramped map Passenger Town drops to one street of
   4 houses, the Stone Forest to a small stand and the Long Falls to a shorter cliff, or none for its stream. Headless:
   all 14 placed on every seed tried.
2. **Which territory has which wreck** (the atlas names only the region): the *Kestrel* at Heron Reach (Blackwater), the
   *Ninth Survey* at Ashfield (Cinderlands), the *Halvard* at Foxford (Emberwood).
3. **The gameplay touches** (modest; every number is open):
   - the Pathfinder's hull (5 × 2), the Ring Shard Spire (3 × 3), Passenger Town's houses, the Stone Forest's pillars,
     the Breach Fields' shafts and Silent Crater's central peak block the way; nothing is built on any landmark's
     ground (and no road tunnels through one);
   - the Spire stands among Crystal clusters half as rich again as the map's own;
   - the Stone Forest: robots standing among its pillars take a quarter less damage (cover);
   - the Long Falls: a cliff (the map's own rock), its plunge pool and a short stream, which can be bridged;
   - Glass Lake: ice robots cross, never built on;
   - the Clock Geyser: from 45 seconds in, every 90 seconds for 8, its vent becomes impassable and robots within a tile
     and a half are scalded (4 damage a second) and pushed off the vent; its panel shows the time to the next;
   - Passenger Town: its lawns count as the Pathfinder's garden, so its deer and songbirds come to graze, and its welcome
     sign ("WELCOME TO ITHACA") lights up at dusk and flickers now and then;
   - Ledger Post and Spring Market: the battle's Trade Post nearest the middle carries the name; no rule changes;
   - the Breach Fields and Silent Crater: scenery only (the shafts breathe violet at night).
4. **The wrecks' logs.** Hold any robot of yours within a tile of a wreck's hatch for 20 seconds (Army, Hold ground)
   and its log is recovered: a line in the battle's messages, the wreck's panel opens on it, it is kept in the run
   (`run.logs`, won or lost, even on Withdraw) and in that year's report, and a later battle there has nothing more to
   give. Rivals' robots recover nothing. The three logs, in the colony's voice (Earth's fate never stated):
   - *Kestrel:* "Log recovered: the Kestrel, cargo lander, down in Blackwater at T−19. Final entries: "Ark construction
     update received: hull sections 112 to 118 complete." "Ark construction update received: no change." "Awaiting ark
     construction update." The last line repeats once a day for 1,106 days, then the batteries."
   - *Ninth Survey:* "Log recovered: the Ninth Survey, Accord survey craft, down in the Cinderlands at T−8. It went on
     listening after the crash. Its last 4,000 entries are the same: "Home channel open. Carrier steady. No content."
     The carrier is still logged steady on the final entry."
   - *Halvard:* "Log recovered: the Halvard, relay tender, down in Emberwood at T+3. Its receiver kept the deep-space
     bands until its power failed: "Machine handshakes, Catalog worlds 2, 5 and 7. Accord protocols. Routine." Every
     period closes with the same note: "No voice traffic this period.""
   Open: whether these dates and craft fit the canon (LORE.md has no wreck histories yet), and who sent each.
5. **The Lore guide.** Its atlas page lists the wrecks "each with a log to recover", so the logs found on this device
   show there under it ("Recovered logs", from `terrafall.logs` in the device's storage). Open: whether the Archive
   pages planned above should take them over, and whether a log should also count across devices (cloud saves).
6. **Flavour lines** for each landmark (its panel) are new text in LORE's tone: the owner may want to rewrite them.
7. **Not done:** no landmark marks on the minimap; Missions are untouched (Contingency isn't taught there); LORE.md's
   open question on the Pathfinder wreck as a landmark is left to the owner (Contingency now shows it at Pathfinder's
   Landing; Seed Vault keeps its own hull, drawn in code). The art (ART_GUIDE Batch 32) is new renders, not the Seed
   Vault drawing.

## Polish round 1 (built Nov 21 2026; open questions)

Camera spots (Shift+F1–F4 / F1–F4, minimap pips), J stepping back through recent alerts, each good's net change a
minute with the full-output and robot-limit warnings, and five named save slots with a Continue card are in the game
(`js/qol.js`; see the README). Still open:
- Ctrl+F1–F4 was the first thought for keeping a spot, but Ctrl+F4 closes the tab on Windows, so it's Shift. A key on
  a Mac laptop needs fn too: is a different pair (say Shift+Z..V) worth it?
- "Storage nearly full": warehouses hold without limit, so the warning reads the makers' output stores (haulers falling
  behind). Should a Fuel Tank (it has a cap) warn too, or a Depot's supply orders?
- Save slots live in localStorage beside the autosave and the restore points; a long game's save is ~300 KB, so a full
  set can reach a few MB. If browsers start refusing, the slots could move to IndexedDB.
- Tapping a whole message (not just its Go chip) to go there would stop taps reaching the map beneath it; kept to Go.

## Polish round 3 (built Nov 21 2026; open questions)

The Daily Planet, multiplayer chat, team pings (Alt+click, a long press on the minimap), Ready and colour picks in the
lobby, and "X reconnecting" are in the game (`js/polish3.js`; see the README). The relay needs a redeploy for Ready,
colours and lobby chat (the old one still plays, without them). Still open:
- **Daily Planet leaderboard**: the best time is only kept on the device. A shared board would need the relay to keep
  scores (and some check against made-up times); worth it?
- **Pings in a free-for-all** go nowhere (team-only, by choice). Should a 1 vs 1 or FFA allow pinging for yourself, as
  a marker?
- **Colours beyond the four teams**: the art is recoloured only to cyan, red, green and purple, so the lobby offers
  those four. More would need more recolours (`recolorArt`).
- **Chat filter**: there is none beyond plain text and a rate limit (6 lines in 5 s). Mute is all-or-nothing; muting
  one player could come later.
- The Daily Planet is always Normal and Versus. A weekly harder one (Hard, a challenge modifier) could sit beside it.

## Polish round 2 (built Nov 21 2026; open questions)

Reach rings, health bars (with a Settings switch), +N goods popups, a ? on panels, the Idle button (,), Surrender and
Rematch are in the game (`js/polish.js`; see the README). Still open:
- **Rematch in multiplayer.** The lobby has no way back from a finished game (each device leaves to the menu), so
  Rematch is single-player only. A host-side "Rematch" that reopens the lobby with the same settings and seed, waiting
  for everyone to tap ready, would fit; worth it?
- **Surrender with teams:** it gives up only your colony, so your ally fights on (and you watch). Should it ask the
  team, or offer the ally your colony instead of the rival?
- **−N popups** where construction spends goods were left out to keep the map quiet. Worth a try, or the +N ones off
  by a switch of their own?
- Rings for a big picked army are skipped above 12 robots (dozens of rings were noise). A single outline round their
  combined reach could replace them.

## Sunsets per biome (built Nov 20 2026; open questions)

Each biome now has its own sunset and sunrise (`js/sunset.js`; see the README's Day and night and ART_GUIDE's
Sunsets and sunrises). Open:
- A Sunsets switch of its own in Settings? For now it follows Time of day (none in Always day or Always night) and
  Graphics (Saver keeps just the colour grade).
- Real cast shadows: buildings' shadows are baked into their art (upper-left light), so only the robots' drop shadows
  stretch at dusk. Re-lit "golden hour" sprite sets from the renderer would let buildings throw long shadows too.
- The Ring as more than a faint arc: its shadow banding across the land, or ringshine lighting the night side.
- A second map biome mixes palettes by the biome under the middle of the view; a smooth per-tile blend would be nicer.
- On a device drawing the canvas without its graphics chip the sunset's full-screen blends cost about as much as the
  rest of the frame (measured in a software-rendered browser); if that shows up on real phones, Saver's colour grade alone
  could become Auto's too while frames are slow.

## Radiation: open questions (built Nov 21 2026)

Nuclear fallout and breached Reactors leave shrinking radiation zones that hurt robots, halve work and keep building out
(`RAD`, `js/radfx.js`; see README, Nuclear race). Open:
- A Shield Dome stops the nuke it catches, and with it the fallout, but it doesn't keep out a zone already on the ground
  (fallout drifting in under it). Should a raised Dome shelter what's under it from a zone too, at a Crystal cost?
- Fallout drifting with the wind (the clouds' wind, `ambWind`) rather than a still circle: it would need the wind as game
  state.
- Ways to clean it up faster: a decontamination crew or building, or rain washing it out sooner.
- The rival weighs its own buildings in the fallout when it aims a nuke, but not the fallout itself in the Lance-or-nukes
  choice (it slows the enemy's rebuilding and its own march in alike). Worth a point either way after more games?
- A cold ruin is only looks: should Haulers salvage it for Alloy like other scrap, or should it stay as a monument?

## The war on the land: open questions (built Nov 20 2026)

Smoke columns, creeping fires, ash and embers, shockwaves and the scars healing are in (`js/warfx.js`, looks only; see
README, War scars). Open:
- The healing is display-only, so it isn't shared: a loaded game starts healing afresh, and two devices in a multiplayer
  game can show different stages. Making it game state (a per-tile healed-at time in `S`, saved and hashed) would fix
  both, and would let the herds come back to healed ground. Worth it?
- Ash for good and nuclear glass heal like the rest (glass less); should glass never green?
- Fires only creep over ground the war has already scorched (so none with War scars Off). A real grass-fire mechanic
  (spreading by wind, burning crops and groves) would be game state and a balance question.
- Burning oil wells (built Nov 2026) are looks only. A gameplay version (a burning well can't be rebuilt until it's put
  out, a Worker or a new firefighting unit capping it; the smoke blinding turrets) was not asked for; the owner's call.
- Sound: crackling for the ground fires, a low boom for the shockwave's ring reaching the camera.

## The owner's ideas, filed Nov 19 2026

Roadmap order the owner set: finish the new transit items, **add all the new megastructures and other units, then a
complete game-balance audit** (every unit and building has a defined, useful purpose, nothing over- or underpowered),
and only **then revamp the Missions** (to use the new units) and **then the Main Campaign**. Quick fixes can go any time.
  In the Missions revamp, also bring the long mission texts within the static test's limits (goals of 40 characters, intros of 5 lines): Arterial's goals, Maglev's hub goal and intro, and the older Blacktop and Lance ones (the owner, Nov 20).

- **Owner, Nov 20: circle back to a Research Lab for Versus mode (Colony only today).** (Open.)
- **Road crews (built Nov 20; open questions).** At most 3 Workers lay planned road at once (Road crew 2, 3, 5 or No
  limit on the Roads tool), a Roadworks takes two Pavers that lay new road at twice a Worker's rate before any asphalt,
  long roads grow from both ends where the far end touches road or a finished building, and a Worker on the road leaves
  it for a site nearby. Still open: should the limit count per foothold (a Drop Outpost's island has its own Workers,
  and today shares the colony's crew of 3)? Should the Roadworks build its own Pavers rather than the Foundry? Should
  Pavers walk out to a far stretch on their own, or keep to the nearest work (today: nearest, by the paving order)?
  Should rivals build a Roadworks for its Pavers (today they build none, and choose No limit: held to 3 or 5 their
  roads fell behind and Hollow games stalled; see README)?

**Quick fixes (small, cheap; do these first when usage is short)**
- **Maglev pods are made only at a Maglev Terminal** (BUILT Nov 18 2026, checked Nov 22): the Foundry's list is
  `FOUNDRY_ORDER` (no `magpod`), its `foundryOrder` order refuses one, and only the Terminal's `yard` lists them.
- **No pipe button on an Oil Pump with a Refinery right beside it** (BUILT Nov 20 2026, checked Nov 22):
  `pumpFeedsNextDoor` in `pipeToRefinery` hides "Pipe it in" (and Paths → Pipe all pumps skips it) when a Refinery or
  Fuel Tank touches the pump.
- **Night sounds in the wilds (built Nov 20; open questions).** A cricket chorus that rises at dusk, a tree cricket's
  trill, katydids and the savanna's cicada, owls, night birds and leaves in the forests, peepers, frogs and splashes in
  Blackwater, insects and a dry wind on the Long Grass and in the Rust (`nightSounds` in `js/audio.js`; README, Sound).
  Open: the owner to listen and set the level (the crickets' peak is `0.016` in `nightSchedule`, the calls' rates in
  `NIGHT_SET`); whether the Shoals and Steamwells want more than their few crickets; whether the Bloom gets a night
  chorus of its own (stranger, not insects); whether a Murmur night should thin the insects out near their tunnels.
- **Tone down the road trucks' smoke and brake noise** (BUILT Nov 20 2026: softer, capped exhaust puffs and air brakes).
- **Dropped goods from a dismantled building go first to Haulers** (BUILT Nov 20 2026: `collectCrates(true)` in
  `dispatch`; Workers help with the rest after their own work). The rivals' exception is open: see Hollow seed 12 above.
- **The main base beacon doesn't go so far up the screen at night** (BUILT Nov 20 2026: shorter, dimmer beams).
- **Night lights: fewer bugs and less clutter** (BUILT Nov 18 2026: under half the moths round each light, smaller,
  none on a phone or on Saver; Nov 20, the lamps themselves fitted to their buildings and none on dead or dark ones).
- **Change the AI's difficulty mid-game** (a setting on the pause menu; rivals' difficulty is read from `P.diff`;
  lockstep: it must be an order so every device agrees, and a note in a multiplayer game).
- **The Deep spouts more Murmur the nearer it is to death** (the Hollow's mound: raise its exit/pack rate and size as its
  armor falls; `aiMurmur`/the nest code in js/sim.js; a last-stand surge).
- **A rolling autosave to go back to** (BUILT Nov 18–22 2026): the last 5 restore points, a game minute apart, kept in
  localStorage (the oldest dropped when storage is full); the pause menu's **Restore points** item lists each by game
  time and how long ago ("14:00 in game · 3 min ago") and loads one after a confirm; also on the game-over screen and
  the main menu after a reload. Hidden in multiplayer and Ironman. *Open:* let a multiplayer host offer them (a reload
  every player would have to take: today none).

**Maglev follow-ups (medium)** (BUILT, Nov 20 2026, in two rounds; README "Maglev lines" has the detail)
- **Losing a Terminal doesn't lose the whole line** (built): its lines stand broken (guideway and pylons kept, drawn
  with an amber stripe and the lost Terminal's outline), pods heading for it turn back with their loads, pods docked in
  it go to a Terminal it was joined to; **Rebuild the missing Terminal** joins every line that ended there again. The
  owner's call: a rebuild on the old foundation costs **half** a Terminal (rounded up: 4 Cement, 3 Alloy, 2 Chips); one
  built there by hand costs the whole price.
- **Maglev lines strung together** (built as hubs, up to three lines a Terminal, the owner's call to keep three): pods
  serve the whole network (four a line) and **carry on through a hub without stopping**: what the Terminals beyond it
  want stays aboard, the rest is unloaded there, and they top up as they pass (decided 4 tiles out, so a pod never waits
  at a hub for a line). *Open:* more than one hub in a single pass is fine (each is decided as it comes); a route planner
  for goods across networks that touch only by conveyor.
- **Bends** (built): a line bends at up to 4 pylons (Bend here while placing; each stretch 3 to 40 tiles, 60 in all,
  120° at most a bend), Route with a bend (or a jog of two) round a blocked stretch or past 40 tiles, before Route via a
  hub; pods follow the bends at 0.6 of top speed round 30° and 0.35 round 75° or more. **Edit bends** on a built line
  (built Nov 20 2026, the owner's yes): tap-to-pick-and-place on the line's Terminal panel rather than dragging (it
  works the same on a phone and with a mouse, and each tap is checked as placing is); a construction job paid only for
  length and pylons added, the old line running until the switch-over, pods held at the Terminals for the last 10%,
  what's taken down back as crates. *Open:* dragging a bend's diamond with the mouse; an edit that moves a line's end
  Terminal (today: a new line).
- **Easier line placement, and pylons over roads** (built): pylons over roads and track as a portal frame with the way
  open, the preview's colours and reasons, a far end snapping a tile over.
- **The rival and the Maglev** (built, Nov 20 2026, the owner's call: the Architect first, others only if it pays).
  The Architect builds one line, from its twelfth minute on Normal and up, to a far working cluster of its own (24+
  tiles out, three working buildings round it, no Rail Station there) once it holds the line's goods and 30 Alloy and
  15 Chips besides. Measured: eight 40-minute Architect-vs-Balanced games (2 players, size 2, seeds 3 7 11 17 23 29
  31 41), before and after, came out identical (Balanced won six, two undecided both times): the Architect never held
  the goods to spare with a busy cluster 24+ tiles out, so it built no line. It does build and run one when it has them
  (a scripted test: lh/maglev-ai-test.js). So it doesn't pay in today's games and stays rare on purpose; undecided games
  did not go up. The other doctrines build none. The owner (Nov 20 2026): keep the rule as it is, a late-game
  flourish.

**Murmur: a bigger rework (after the megastructures and the audit, before the campaign)**
- **Smarter Murmur:** they sometimes walk straight past robots that then shoot them; fix their threat and target choice
  (avoid or engage, don't ignore armed robots in reach). **BUILT (Nov 22 2026)**, with the next two: see the owner's notes, Nov 21, item 2.
- **Late game: an almost unending horde,** growing with the colonies' power (the theme below). **BUILT (Nov 22 2026)** (the pressure, the horde).
- **A massive endgame unit, a behemoth,** the biggest Murmur form (its own art and abilities).
- **Much smarter, more aggressive planning:** by late game, if you haven't knocked out their tunnels they hunt you and
  sabotage every weak point in your base (the Phase 1+2 "crafty" Murmur is the base to build on). **BUILT (Nov 22 2026)** (the hunt).

**Game setup and structure**
- **Megastructures are an enable-able checkbox on game setup,** like Nuclear race (BUILT, Nov 20 2026, with the Lance of
  Corvane and the Shield Dome, and Arrival City since: the owner chose **on by default**; Custom Game, Observer mode and the multiplayer host's
  settings; missions keep their own; a save from before it loads with them off), so games without them stay as
  now. (Applies to the whole megastructure list; the Maglev and Express highway are ordinary buildings, not gated.)
- **Immense map size** (built): 84×118 on Standard and about 40% longer in each direction than Huge on every shape.
  Immense surface maps now offer an optional second biome, with a seeded transition between their scenery. The first
  biome covers about 65% of the land and supplies the planet-wide weather and rules.
- **Planetary map size** (built): up to two colonies, 120×168 on Standard, and the same 65/35 second-biome option as Immense.

**New content**
- **Biome: Boiling Springs.** A geothermal basin: vibrant, mineral-hued hot springs and steaming geysers among
  sulfur-stained limestone terraces (colours: turquoise, ochre, rust-orange, white sinter; steam; its own plants,
  animals, ambience, music-less night glow). A standard biome entry (`BIOMES`, ART_GUIDE, a lazy `biome-*` bundle).
- **Biome: Tropical, selectable on naval maps,** with **sea life on all naval maps:** dolphins, fish that jump, the
  occasional whale spout (render-only scenery like the fauna; never blocks ships).
- **Lava maps: steam vents and livelier lava:** steam plumes and vents on any lava map (Volcano, Cinderlands, Fault Line),
  and animated lava tiles (slow flowing/pulsing, crust cracks, glow) so it looks alive. Render-only, Saver off.
- **Robotic dialogue, spoken at the start of each game and now and then** (generated audio): a robotic language we can't
  understand with subtitles ("Execute directives", "Directive acknowledged", etc.), in the voice of the colony's machines;
  a subtitle line on screen; an Ambience/Voice volume setting and an off switch. Tone per LORE.md (the Accord's orders, the
  contingency orders, COBALT); never states Earth's fate.

**Fauna and the living world** (the owner; pairs with "Fauna: better looks and movement" and "Total war scars the land")
- **Every biome gets at least two land animals and one bird** that move about (check each in `js/wildlife.js`: some have
  only one kind; the Rust has lizards and a hawk).
- **The Bloom: new, stranger creatures** in place of the floating jellyfish-like floaters (the owner doesn't care for
  them): think of weirder native life (design sheet first).
- **The swamp (Blackwater): alligators or turtles.**
- **Rework the deer and the wildebeest/herds** to look more realistic (models and motion).
- **Development pushes animals out:** roads and buildings displace the animals: they leave the land a colony builds on and
  its edges, so habitat shrinks as the colonies grow (and war damage, the war-scars idea). Render-only scenery (animals
  are not in `S`), but the move-away must be steady and cheap.
- **The somber theme** (the owner's direction; for LORE.md when they confirm the wording, since LORE.md is the canon):
  the war is also the suffering of the planet and its animals, a meaningless robot-versus-robot war on behalf of humans
  who will never arrive; and the Murmur were mostly held in homeostasis until the robots came and brought tremendous
  energy to the planet, which feeds the Murmur and makes them ever more dominant. This fits the lore's "the war feeds
  them" and the Leech's power-draining; check wording so it never states Earth's fate outright ("humans who will never
  arrive" hints at it: ask the owner before it goes into LORE.md or the game's text).

## Held for later

- **Polish and quality of life, to feel like a studio game** (the owner, Nov 2026: saved for later). The game already has
  photo mode, cloud saves with a QR code, goals, records and achievements, undo, control groups, idle-robot explanations,
  the traffic and goods-flow overlays, graphics presets, an installable app, reduced-motion and text-size options. A
  code search found these gaps (no key rebinding, no chat in multiplayer, one save only, no credits screen, no gamepad,
  no replays):
  - **Controls and navigation:** shortcut cheat sheet shipped on `/` and Pause → Keys; key rebinding; camera bookmarks
    and a "jump to the last alert" key; an idle-army button beside the idle-Worker one; attack-move and shift-queued
    orders if not complete.
  - **Feedback and clarity:** income per minute beside each resource in the top bar; warnings for "storage nearly full"
    and "robot cap reached"; range circles when hovering a defence; optional health bars; small "+N" popups for goods
    delivered; a "?" on any panel that opens the matching page of the guide.
  - **Audio:** short machine bleeps as unit acknowledgements on selecting and ordering, which give a game its character.
  - **Menus and saves:** several save slots; a Continue card showing the map, the time and a small picture; a "What's
    new" popup after an update; a credits screen; Surrender and Rematch buttons at the end of a game.
  - **Multiplayer:** chat, ready-up, map pings for allies, reconnect, a team colour picker.
  - **Accessibility:** subtitles for audio cues (alarms, the dusk warning); a high-contrast mode; colourblind-safe team
    patterns (partly there); fuller screen-reader labels.
  - **Meta:** a "Daily Planet", a shared seed of the day with your own best result, easy to run on the relay.
  - **Bigger and optional:** gamepad support, translations, replays (already on the hold list).
  - **Where to start (most polish for the effort):** camera bookmarks and last-alert jump,
    unit acknowledgement sounds, income rates and warnings, multiple save slots.
  - **A UX audit by Gemini:** the owner sends it screenshots of the main screens, and it lists confusing or unpolished
    spots against studio standards: a cheap, prioritised list (see handoff/ for how the export and import work).
- **Round out the military: counters to the Bulwark blob, and more combat units** (the owner, Nov 2026; the Skirmisher, Arc Caster and Railgunner built Nov 20 2026, see below).
  The owner's observation: many games are won by huge bundles of warbots behind Bulwarks that are hard to stop; the game
  has grown lots of supply-chain buildings and vehicles but a thin military side. Do this before the megastructure
  weapons, which would add power to a thin roster. First step: a measured arena test, not guesses (30 warbots and 6
  Bulwarks marching at Mortar Pits, Torches, Missiles and bombers in the headless harness, to see what beats them today).
  - **Why a blob wins (from the rules, not yet measured):** a warbot has 12 HP, a Bulwark 30 HP plus a 50-point shield
    that regenerates 4 a second after 2.5 s without a hit (`BULWARK`); the cap is 90 robots a player in Versus
    (`MAX_BOTS`). The counters are each weak: a Missile does 24 (9 against robots, splash 2.2) but a Silo holds 2 and now
    reloads in 60 s (raised from 25: it made blobs a little stronger); the Mortar Pit (range 10), Disruptor Tower (4.5)
    and Pulse Turret are stationary or single-target and the shield blocks them; the Torch (flame cone) has 18 HP and
    needs Fuel; bombers need an Airfield (two a field, none in the Hollow); the Howitzer, the mobile area-damage unit, is
    switched off (`BOTS_OFF`); only the Flak Gun shoots aircraft; there are no warships (ships only carry cargo).
    Open questions: do the blobs the owner met belong to the player, the computer, or both? Why was the Howitzer switched
    off?
  - **Missing:** a mobile unit that hurts groups from range, a shield-breaker, fast flankers, mines and area denial,
    mobile anti-air, naval combat, and any real cost for keeping a huge army supplied.
  - **A formula that works:** every unit gets a role, a counter and a weakness; soft counters (about 1.5 to 2 times
    damage, not 5); about three damage types against three armour types (for example bullets, blast, energy against
    light, shielded, structure); equal cost means about equal power, a specialist trading generality for its niche; keep
    the roster to about 8 combat robots (each needs art, rival AI, UI, tests). Loops: Bulwark beats Warbot, Skirmisher
    beats Bulwark (round its shield arc), Warbot beats Skirmisher (mass fire); artillery beats clumps and static defences,
    Skirmishers dive artillery, blobs beat Skirmishers; bombers beat ground clumps, Flak beats bombers, ground rushes
    beat Flak.
  - **Units to add:** *Skirmisher* (fast cheap flanker; beats Bulwarks, artillery, Workers; weak to mass fire and Minigun
    Nests); *Rail Lancer* (long range, slow, heavy shot; beats Bulwarks and armour; weak to flankers); *Arc Caster*
    (chain lightning that breaks shields; beats clumps; weak to anything that dives it); *Howitzer* back, rebalanced
    (minimum range, slow, fragile, needs Ammo); *Mine Layer* (area denial on roads and chokepoints; not "Sapper": that
    is a Murmur form); *Interceptor* (mobile anti-air, once there are more aircraft: bombers, Airships, the Orbital
    Lift); *Gunboat* (water combat, since Islands and Four Isles have none); *Repair Drone* (heals robots; careful, it
    strengthens blobs, and gives flankers a target).
  - **Other levers:** supply pressure (armies far from an Outpost or garrison lose Ammo and charge faster); Bulwark limits
    (dearer, a tighter shield arc, a longer break-down time, a smaller shield); a lower warbot cap such as 60 as a last
    resort; the rival AI must learn to answer blobs (Mortar Pits, Torches) or it loses to them whatever is added. Fits
    the doctrines: Salvager with Skirmishers, Warden with Mortars and Lancers, Herald with Warbot masses, Architect with
    Howitzers and megastructures, Steward a mix.
  - **The owner's plan (Nov 19 2026; order swapped the same day):** after war scars and shared co-op come the
    **Lance of Corvane and the Shield Dome** first, then the **Skirmisher, Arc Caster and Rail Lancer** (the Rail Lancer may need another name: the warbot art is already "Lancer"),
    balanced in with the three ground units there now (Warbot, Bulwark, Torch). The owner's view: the Bulwark is too
    strong; two Bulwarks and a big blob of warbots win almost any game, which is too easy. So the pass includes
    toning the Bulwark down and a measured blob arena test before and after (with the Lance and the Dome in the game).
  - **Built (Nov 20 2026): the Skirmisher, the Arc Caster and the Railgunner, and a Bulwark nerf.** (The Rail Lancer is
    the *Railgunner*: the Warbot's art set is already the "Lancer".) Numbers in README (Skirmisher, Arc Caster, Railgunner
    rows; `SKIRM`, `ARC`, `RAIL`). The Bulwark: shield 50 → 40, down 6 → 8 s, turning 2.6 → 1.8 rad/s (two attackers
    from different sides get round it); cost unchanged (3 rounds). Rivals build the three by doctrine (`AI_ANSWERS`) and
    answer what they face (`aiAnswers`). Measured in the headless arena (`lh/arena.js`; cost in Foundry rounds):
    - *A blob marching on a fort* (two Pulse Turrets and a Minigun Nest; the answer is P1's, at a third of the blob's
      cost): blob losses before → after. 30 warbots + 2 Bulwarks (36 rounds): nothing more 0 → 3; +16 warbots 8 → 14;
      +8 Torches 16 → 18; +16 Skirmishers 17; +8 Arc Casters 17; +5 Railgunners 15. 30 + 6 Bulwarks (48): nothing more
      0 → 0; +16 warbots 0 → 0 (the six shields still stop a defence a third its size); +8 Torches 6 → 9; +16
      Skirmishers 16 (5 of the 6 Bulwarks killed); +8 Arc Casters 8; +5 Railgunners 22 (all 6 Bulwarks). Mortar Pits (4:
      21 and 14) and Missiles (17 and 18) bleed a blob much as before; bombers barely touch it.
    - *Equal cost in the open* (score: share of the enemy's cost destroyed less your own, averaged over 3 planets and
      both sides; vs the blob at its cost): 30w+2B: warbots ±0, Torches +0.42, Skirmishers +0.15, Arc Casters +0.36,
      Railgunners −0.07; 30w+6B: warbots −0.01, Torches +0.22, Skirmishers +0.37, Arc Casters +0.41, Railgunners +0.74
      (before the pass: warbots −0.09, Torches +0.14, nothing else).
    - *Who beats whom* (24 rounds a side): Skirmishers beat Arc Casters +0.46 and Railgunners +0.47, are even with
      warbots and the blob, lose to Torches −0.42; Arc Casters beat Torches +0.78 and big blobs (above), lose to
      Skirmishers and Railgunners; Railgunners beat Torches and Arc Casters, lose to warbots −0.32 and Skirmishers −0.47.
      Averages: Railgunners +0.32 (the strongest pure army), the blob +0.13, warbots +0.05, Skirmishers +0.04, Arc Casters
      0.00, Torches −0.20, a mix of all −0.23. (The Railgunner was then the strongest pure army; see the
      tuning below.)
    - *Railgunner toned down* (the owner, Nov 2026; branch rail-tune): slugs lose 40% each robot they pass (was 30%),
      reload 5 s (was 4), a Bulwark's shield lets 80% through (was 60%) and the Bulwark takes ×1.7 (was ×1.3): four
      numbers; cost, health, reach and pierce count unchanged. Arena, before → after: a pure Railgunner army's average
      +0.32 → +0.01 (no longer the strongest pure army: the blob +0.21, warbots +0.11, Skirmishers +0.08 lead now); a mix
      of all six kinds (8 warbots, a Bulwark, a Torch, 4 Skirmishers, 2 Arc Casters, a Railgunner) against Railgunners
      −0.64 → −0.01 (a match); Railgunners still beat Arc Casters (+0.97 → +0.89) and Torches (+0.95); against a blob
      of 30 warbots and 6 Bulwarks at its cost +0.74 → +0.25 (still a win), 30 and 2 −0.07 → −0.35; holding a fort
      against 30 + 6 they still kill all six Bulwarks (blob losses 22 → 23 of 48). The mix of all six against the
      pure armies: Arc Casters +0.35, Torches +0.38, Railgunners −0.01, warbots and Torches +0.05, Skirmishers −0.14,
      warbots −0.26, the blob −0.47: it matches or beats the specialists but not massed warbots (fewer bodies for the
      price) or the blob. AI against AI (20 games, the same doctrine pairs, before → after): undecided 0 → 0, wins by
      doctrine unchanged (Steward 5, Warden 1, Salvager 6, Herald 5, Architect 3 of 8).
    - *Blob counters* (the owner, Nov 2026; branch blob-counter): a Torch's flame half wraps round a Bulwark's shield
      (`TORCH.shieldPass` 0.5) and what the shield takes burns it twice as fast (`shieldMul` 2); one Bulwark shelters
      at most 6 robots behind it, the nearest, ties by id (`BULWARK.coverMax`, `shieldCovers`; selected, it rings them);
      a rival facing a blob (2 Bulwarks, 12 in the army: `aiBlob`) puts Mortar Pits toward it (up to 2) and wants a
      Howitzer more (they're switched off). Mortar and Howitzer shells and napalm already came down over shields.
      Arena, before → after: blob of 30 + 6 at a fort with 8 Torches defending: blob losses 9 → 22 of 48 (Bulwarks left
      4 → 2); 30 + 2: Torches 18 → 24 of 36, 4 Mortar Pits 19 → 22; Torches against a Bulwark squad at its cost: 6w+2B
      −0.37 → +0.42, 18w+2B +0.21 → +0.48, 30w+6B +0.22 → +0.30; Torches vs the blob in the brawl table +0.21 → +0.48;
      the blob's average +0.21 → +0.18 (in open fights a Bulwark's lee seldom holds more than six anyway, so the cap
      bites mostly at forts and on the march); small escorts unchanged (6w+1B against warbots of its cost +0.54 → +0.54,
      6w+2B +0.35 → +0.38, 4w+2B +0.48 → +0.48). AI against AI (20 games): undecided 0 → 0, a win in 19.5 → 22.4 min,
      Salvager 6 → 5 and Herald 5 → 6 wins of 8, the rest unchanged.
    - *AI against AI* (40 two-player games, every pair of doctrines, Normal, Nuclear race on, 60 min at most; before →
      after): undecided 0 → 0, a win in 20.0 → 20.0 min on average; wins by doctrine Steward 9 → 9, Warden 2 → 2,
      Salvager 12 → 12, Herald 12 → 11, Architect 5 → 6 (of 16 each): none became dominant (the Salvager and Herald led
      before, as now). The rivals' armies: 917 warbots, 125 Bulwarks, 139 Torches → 789, 125, 109 and 80 Skirmishers,
      44 Arc Casters, 25 Railgunners. Reactors built 5 → 14, the Lance-or-nukes choice made 2 → 10 times (the Reactor
      now goes first in a Nuclear race's late game, the choice from 18 minutes). Open: in these games the choice comes
      but neither a Lance nor a nuke was finished before the game ended; on the Hollow (Small, 8 seeds) games stall
      undecided when both colonies' ore runs out: 3 in 8 before, 4 in 8 after (different ones; seed 21, the old
      "game that never ended" test, is among the new ones; without the Bulwark nerf, or without the rivals' answers, it
      ends again). Worth a look at the Hollow's late economy.
    - *Mission:* Siege Breakers has a Bulwark picket and a goal to break its shields (Arc Casters, Skirmishers).
  - **Suggested order:** first wave Skirmisher, Howitzer (rebalanced), Arc Caster (they close the main loops); then Rail
    Lancer and Mine Layer; later Interceptor and Gunboat. Design sheets for the new units could go through Gemini, as the
    megastructures did (handoff/ in the repo).
- **Neutral sites to find and use, as in Warcraft 3** (the owner, Nov 2026: saved for later). Neutral buildings, caches and
  oddities spread over the maps: they reward exploring, give objectives away from home, and add personality. We have a
  few already (Trade Posts, Uplinks, the Murmur's nests with their hoards, the *Wren*). The tone (LORE.md): dry and a
  little sad, machines applying old rules to a world that moved on, never slapstick.
  - **How it would work:** neutral buildings that belong to no colony and are claimed or used by standing near them for a
    while (as the Uplinks); placed from the seed and mirrored for fairness in Versus (as the Trade Posts); a Custom Game
    setting "Neutral sites: Off, Some, Many" (like the Murmur's); rivals seek them out too (the biggest piece of new
    work). Reuses: the Trade Posts' neutral ownership and no-fire zones, loot crates, parachute drops, Murmur hoards.
    New: a neutral-site system, the placement logic, the rivals' use of them, and art. Suggested first set: Charge Pool,
    Mercenary Foundry, Feral Sentinels, Archive Vault, Transit Stubs; then Weather Station, Seed Vault Annex, Hum Stone,
    Lottery Terminal, Salvage Field.
  - **Shops and services:** *Orphaned Mercenary Foundry* (an old vanguard stock never claimed: pay Alloy and Chips for a
    one-time squad of Bulwarks or Torches); *Charge Pool* (a hum of Ring Crystal where robots nearby recharge and repair
    free); *Accord Welcome Kiosk* (still running its script: greets you, hands out an "orientation brochure" of goods,
    charges a few Chips for a "map update"); *Empty Passenger Shelter* (a neutral rest stop with a no-fire zone: any side's
    robots recharge and repair there, so it is contested); *Carrier Callbox* (pay Chips for a one-time supply drop from
    the Carrier, by parachute); *Proving Ground* (destroy a set of target drones in 60 s for a temporary army buff).
  - **Guarded caches:** *Feral Sentinels* (old vanguard warbots still obeying orders from 31 years ago, "Position held",
    guarding a bridge or a cache; beat them for the salvage); *crashed supply pods* (dormant Carrier reserve pods: Workers
    pry them open, often guarded by a nest); *Lost Luggage* (crates from the arks that never came: goods, and now and
    then a pair of children's shoes).
  - **Map-changers:** *Accord Transit Stubs* (unfinished "Phase 2" transit stations from the lore: hold one to teleport
    to its twin, as Warcraft's Waygates; on big maps they change which routes matter; ties in with the Maglev idea);
    *Toll Gate* (a neutral checkpoint on a shortcut that demands "papers": 3 Chips to pass, or wreck it); *hazards*
    (steam geysers that burst now and then, hot springs that heal in Hoarfell, a "singing" Bloom patch).
  - **Information:** *Weather Station* (an Accord instrument array: a forecast of the next planetary event and the next
    Murmur night, "Dust storm in 2:40"); *Observatory* (on a high mesa: shows where the next Ringfall will land);
    *Survey Tower* (reveals hidden rich deposits within 20 tiles: a new mechanic, seams hidden until surveyed);
    *Listening Post* (stray machine traffic from other Catalog worlds: lore logs and a small bonus).
  - **Story sites:** *Archive Vault* (a sealed Accord data vault: hold it for a minute to open it: a lore log or a
    one-time perk; a way to deliver the campaign's story); *ghost town* (the empty Accord settlement of mission 2: claim it
    with an Outpost for lit streetlights, a free storage building and deer on the lawns); *Seed Vault Annex* (the
    Pathfinder's garden: plant a grove of Earth trees for free Fiber, or let Bio Farms grow anywhere near).
  - **Bargains and dry humor:** *Lottery Terminal* (5 Chips for a random reward, usually "Your number was not selected.
    Thank you for participating. Probability of contact: 0.2%."); *Tribunal* (the Accord's court that "has not met in
    decades": pay to file a complaint and call a 3-minute ceasefire; tied to the truce idea on the hold list);
    *Lost-and-Found Office* (pay a fee to recover half the goods lost to raids in the last five minutes; needs limits
    against exploiting it).
  - **The strange ones:** *Hum Stone* (a neutral monolith the Murmur gather round: leave it Crystal and they leave your
    colony alone for one night; bribery, ritual or both: the lore never answers); *Derelict Locomotive or Crawler* (an old
    machine waiting for orders: repair it with Alloy and it is yours).
  - **Contested economy:** *Salvage Field* (a graveyard of old robots with a big, finite pool of Alloy and Chips: a neutral
    mine to expand toward; the Murmur's Leeches feed on it, so it comes with a fight).
- **Easter eggs** (the owner asked for ideas, Nov 2026: saved for later). Quiet objects in the world and dry machine logs,
  not winks (LORE.md). There is one hidden feature already: tapping the clock three times opens Boosts. Small objects:
  *ARGOS*, a Hauler on the moon mission that waits idle beside the Pathfinder relay (the dog who waited twenty years;
  tapped, the log reads "Waiting."); *the ball*, a child's ball on a lawn of the empty town, nudged by the wind ("Object:
  ball. Purpose: unknown. Retained."); *the shoes*, a rare *Wren* offer of its 31-year-old cargo, 4,000 pairs of children's
  shoes, that does nothing useful but shows in the end-of-game stats; *the day counts always match* (the Warden's 12,054
  days, the Uplink's 11,324 days of static and the Arrival clock's 31 years agree). Hidden signals: the campaign ending's
  "one signal that matches no robot protocol" as real decodable data (Morse in the Uplink static, a repeating pattern)
  with a clue for the sequel; a console message ("Arrival clock: T+31 years. Probability of contact: 0.2%."). Hidden
  achievements (the game has the system): *Waited* (leave a game idle 31 minutes), *Lights On* (keep every road lit through
  a night), *Listener* (stay zoomed on an Uplink a full minute at night). Special seeds (cheap, easy to share): 2165 lands
  beside the Pathfinder wreck, 11324 gives a map where the animals are all deer, a text seed such as "Odysseus" triggers
  one; they change map generation, so need testing. The Murmur: a very rare Scuttler that follows a Hauler home and
  never attacks (deepens "are they only animals?", never answered).
- **Cutscenes: recorded game scenes with speech, and a glimmer of hope at the end** (the owner, Nov 2026: saved for
  later; the campaign itself is on hold until the new buildings, units, megastructures, biomes and maps are settled in
  the other chat, then it is rethought from the full roster: see CAMPAIGN.md).
  - **Recorded scenes (machinima).** The simulation is deterministic, so a scene is a script: a seed and setup, units
    given orders at set moments, camera keyframes (pans, slow zooms), a forced time of day and weather. A headless
    browser (Playwright, and `ffmpeg`, both available in the cloud environment) steps the game at a fixed rate, saves
    each frame at full quality on Ultra graphics, and encodes a video; retakes are exact. Sound: machine-voice clips
    (a TTS tool, perhaps Gemini's, to be checked) with a robotic filter, the game's own music and effects mixed in with
    `ffmpeg`, captions and a letterbox on top. Machines only, never faces (LORE.md). Limits: the camera is top-down
    (pans and zooms, no low angles); about 3 to 8 MB a minute, so videos load on demand from separate hosting (the single
    file is near its 16 MB cap), with a skip option on phones; this machine renders slowly (an estimated 30 to 60
    minutes a minute of footage, unattended); not interactive.
  - **The same script can play live in-engine** (no download, the player's own settings, as Warcraft 3 did most of its
    cutscenes): a cutscene system with camera script, captions with a portrait box, letterbox bars, a skip button, music
    ducking and a Voice volume beside Music, Effects and Ambience. Record to video only the big moments (the opening,
    the act endings, the finale) and a trailer for terrafall.app. Also motion-comic scenes (art with slow parallax) for
    flashbacks and orbital shots; art perhaps from Gemini.
  - **First step:** the scene-script and recording tool, then one 30-second test (the empty town at dusk with the beacon
    coming on) to see the real look and render time. Independent of the campaign: usable on today's tutorial missions.
  - **The ending's glimmer of hope** (to be chosen; hope without proof, so the sequel keeps the question of humans
    arriving or not open; the machines never say it, the world shows it: LORE.md tone). Options: (1) the Arrival clock,
    which has counted up for 31 years, stops and reads "Recalculating"; (2) one signal that matches no robot protocol,
    logged "Unclassified. Retain.", the channel left open as the credits play; (3) the Pathfinder's seed-vault manifest
    (mission 15): the planet really is prepared, and a deer grazes the lawn of the empty town; (4) the ark never
    accounted for, with a hypothetical arrival window computed and never confirmed; (5) a seed for the colonists
    themselves in the vault (a big lore choice: humans might begin here instead of arriving). Suggested: 1 and 2 for the
    ending with 3 as the image before it, and breadcrumbs earlier (mission 2's shelter, mission 10's archive noting one
    ark as "unaccounted"); the signal's origin left unknown for the sequel.
- **Electricity as a requirement** (the owner, Nov 17 2026: a design note, for later; builds on "Power for the
  megastructures" under Megastructures). The owner's question: should factories and production buildings, maybe
  turrets too, need power, made by Generators or power plants burning Fuel or Crystal, or a nuclear plant: more
  critical infrastructure to defend, for rivals to raid and for the Murmur to eat?
  - **For it:** LORE.md already has the Murmur feeding on charge (the Leech drawn at a power line; the Spitter already
    shorts buildings out); plants and pylons become targets; Fuel, Crystal and Uranium get a steady use; it feeds the
    megastructures; lights going dark pylon by pylon at night.
  - **Against it:** one more layer on top of roads, Haulers, Fuel for charging, Ammo, Tankers and rail, hardest on the
    early game and on phones; a dead plant silently stopping the economy feels bad; turrets that stop when it's cut
    make one raid decisive.
  - **Cost:** the grid is moderate work; the rival AI planning, building and guarding a grid (and riding out a
    blackout) is the big part; every mission wants retuning or a grid in its kit; balance runs. Lockstep is no problem.
  - **To keep it fun:** brownouts, not shutdowns (unpowered works at about half speed, powered at full); by tier (early
    buildings need none; advanced ones do: Chip Fab, Missile Factory, Reactor, Pulse Turret, the megastructures);
    coverage, not wiring (a plant and pylons cover an area, like today's Generator radius, pylons extending it); turrets
    keep a small backup battery; a power overlay like the traffic map and messages that say why ("your Chip Fabs are
    browned out: the Fuel plant ran dry").
  - **Suggested path:** first, power plants (Fuel, Crystal, Uranium) and pylons as a boost, required by the
    megastructures and a few advanced buildings; play it a while; then decide whether ordinary factories depend on it.
- **The Murmur undermine a colony** (the owner, Nov 17 2026: for later). Left alone long enough, a nest's tunnels grow
  so thick under a colony that the ground gives way: buildings over the densest tunnels sag, crack and at last collapse
  into a sinkhole, roads over them cave in, and robots on the spot fall in. Warning signs first, so it can be stopped:
  cracks in the ground and dust puffing up at night, tremors felt under the base, a building's panel saying
  "the ground under it is hollow". Collapsing the exits, wrecking the nest (its network dies back) or a Seismic Lance (see
  Megastructures) shores it up; the Sapper (the Murmur form that digs) would lead it. It makes ignoring the Murmur
  costly in long games, as the tunnel network keeps spreading under the old battlefields (LORE.md).
- **Total war scars the land: BUILT, Nov 19 2026, as War scars** (README, "War scars"; How to play, War scars). The
  owner's decisions: lasting craters from every real explosion sized by weapon (a nuke a glassed crater field), looks
  only; scorch that grows back in ten minutes, ash and charred stumps for good, a Grove Planter greens a patch; scrap
  from every destroyed robot and rubble from every building wrecked by force, for good, into graveyards; Haulers salvage
  it near roads for a little Alloy (the rivals too); the Murmur's tunnels lean toward big heaps of it; blasts kill
  animals, their bones stay, wildlife and birdsong leave the battlefields; a setting Off / Light / Full (Full by
  default) in Settings only, fixed into each game as it starts. (An end-of-game tally was dropped by the owner.) Still
  open: the Lance of Corvane's trench (built with it, Nov 20 2026: `S.cuts`, `scarTrench`); a renderer sprite set for scrap and bones; carrion
  birds over the old graveyards, not only fresh wrecks; whether ash should also stop Bio Farms and Harvesters (today
  only napalm and Torches burn farmland, as before). The notes as filed:
  **Total war scars the land** (the owner, Nov 18 2026: for later; "I really like the concepts of these battles
  affecting the environment"). The picture: a long war slowly turns a green, forested map into a World War 1
  battlefield. Animals in a blast's radius die (the fauna is scenery today, js/wildlife.js: they scatter from
  fighting but nothing kills them); trees and living plants burn and stay burnt (a charred trunk, a blackened stump,
  never growing back, as Napalm already scorches fertile soil for good: `scorch`, "Napalm and scorched earth" below);
  grass and living ground burn to bare earth and ash the same way; bomb, shell, Missile and nuclear craters remain
  (today's craters are decals that fade: `addDecal('scorch')`, DECAL_MAX, `S.decals` filtered by life; they would
  become lasting ground marks like the aircraft wrecks, `S.wrecks`, with a cap and dropped oldest first, in `S` so saves
  and every lockstep client agree). Over a protracted war the no-man's-land between two colonies accumulates: craters
  overlapping, burnt groves, dead ground, the remains and wrecks already there, carrion birds; the green regions
  (Greenreach, the Polar Caps' firs, the Autumn woods, the Bloom) show it most, the Rust and Argos least. Design points to
  settle with the owner: what heals (nothing? grass in a long time? Bio Farms and the Grove Planter can re-green a
  patch?), whether burnt ground hurts play (no Bio Farms on it, Harvesters find nothing: yes, that is the point) or is
  only a look, how craters affect movement (slow? none, like wrecks?), what the biggest weapons do (a nuke leaves a
  glassed crater field; the Lance of Corvane a trench), and the cost cap so a 60-minute war stays fast. LORE.md's
  tone fits (the garden the Pathfinder planted, harmed by the war; "the war feeds them": the Murmur get stronger).
  The owner again, Nov 19 2026: wants to work on this; animals scared off and killed on the map during war, the map
  slowly turning from green nature into a WW1 battlefield of craters and destruction, and **robot scrap that stays on
  the ground** wherever robots are destroyed, so the old battlefields read as robot graveyards (today a destroyed bot
  leaves only a fading decal; aircraft already leave lasting wrecks, `S.wrecks`). "Anything to help in this theme":
  the somber side plot of the planet and its animals suffering for a meaningless war on behalf of humans who never
  arrive, and the Murmur, held in balance until the robots brought them so much energy, growing ever more dominant.
- **Fauna: better looks and movement** (the owner, Nov 18 2026: for later; the fauna models were added by the other chat
  with basic tools). Review every animal in js/wildlife.js (deer, songbirds, geese, foxes, herds, herons, hares, owls,
  lizards, hawks, vultures, beetles, ember moths, floaters, blind crawlers, glow-worms, the carrion birds) and rework
  them with the renderer (Claude Design): more detailed models at the game's sizes, day and night, and better motion
  (walk and run cycles, wing beats, grazing and startle poses, flocks that turn together, herds that bunch when they
  run). Keep them scenery (LORE.md: nobody's side, no victory count); pair with "Total war scars the land" above so
  the dead are drawn too.
- **Redesign the Fiber stalks (Reedcane)** (the owner's to-do, Nov 18: for later). The Fiber plant on the map is the
  Reedcane the owner picked from a sheet in Nov 2026 (jointed canes; `art/resources`, ART_GUIDE; the Bloom and the Hollow
  use veins instead). The owner wants a new look. When picked up: ask what they dislike and what they want (taller?
  denser groves? a grass or crop look? motion in the wind?), then a sheet of three directions as for the oil seeps,
  on the Rust and the green biomes, by day and at night, at 96/48/28 px, with the Harvester cutting it and a cut grove
  regrowing (the Grove Planter).
- **Nicer one-way road arrows** (the owner's to-do, Nov 18: for later). Today a one-way road shows a plain painted arrow
  on each tile (`drawRoadArrow` in js/render.js, the Arrows tool in Paths). The owner wants them to look better than an
  arrow on a road: candidates are painted lane markings in the road's style (a dashed centre line with chevrons, an edge
  line, a "no entry" bar at the wrong-way end), small roadside signs or bollards at the entry, a lit cat's-eye string
  at night as the Expressway has, or an arrow that fades out along the lane. Pair with the Express highway's art so the
  two share a marking language. A small sheet of three looks first.
- **Redesign the nuclear missile** (the owner's to-do, Nov 17: for later). Today's: the Nuclear race's missile, built at a
  Nuclear Silo from 6 Enriched Uranium (`NUKE` in `js/defs.js`; the Silo and its launch, flight, warning and blast in
  `js/sim.js` and `js/render.js`, the blast's `effects/nuke-blast-sheet.webp`). When it's picked up, first ask the owner
  what the redesign covers (its look in the Silo, in flight and the blast; how it plays; or both), then show a design
  sheet to pick from, as for the Airship. Mind the single file's room (see Room to grow below): its art may want a
  bundle of its own beside the page.
- **Upgrades for long games** (the owner, Nov 17 2026: saved for later; the aim is economies that keep growing on large
  maps, enough to feed the megastructures). Today the only upgrades are the Research Lab's (`TECHS`: Cargo Racks,
  Long-life Cells, Rapid Paving, Sentry Optics, Turbo Motors, Power Tools, Nanite Repair), colony-wide and Colony only.
  The picks, if built: building tiers and deep extraction.
  - **Building tiers (Mk II, Mk III).** An Upgrade button on a gatherer's panel, paid in Alloy and Chips (Crystal too
    for Mk III), with a short refit while it pauses. Harvester Mk II: 50% faster and its reach 5 tiles to 7; Mk III:
    twice as fast and a second Worker. The same for the Quarry, Mine, Crystal Tap and Oil Pump, and the factories could
    follow (Smelter, Chip Fab, Cement Works: Mk II makes 2 a batch). Upgraded buildings look it (a bigger rig, a second
    arm, brighter lights). The rival upgrades its own once it's established, so long games scale for everyone.
  - **Deep extraction.** On big maps the fields of Ore, Stone and Crystal run dry and late games starve. A Deep Bore
    upgrade lets a Mine, Quarry or Crystal Tap keep drawing a trickle from a spent field for good. (Harvesters already
    have the Grove Planter to regrow their groves.) Partly answered (Nov 20 2026): the Ring drizzle drops a small Ore or
    Crystal deposit on every colony's share every three to four minutes from minute 12 in every game, and the *Wren* brings a raw good
    the land is running out of on about one visit in four. Rivals now favor usable drizzle deposits during shortages.
    In 12 matched Normal games, drizzle Ore mined rose from 38 to 158 and Crystal from 46 to 108. One game reached the
    60-minute cap on each build and the mean time moved from 22:36 to 22:56. Still open: whether long games on Huge maps
    need more.
  - **The Research Lab in Versus too,** with economy research beside today's: Diamond Blades (every gatherer 25%
    faster), Seam Survey (fields hold 30% more), Automation (factories need no Worker inside, freeing Workers to build).
    The owner, Nov 20 2026: circle back to this later (a Research Lab for Versus; today it is Colony only). It came up
    as one of the Orbital Lift's possible rewards for sending goods up (Research in Colony mode), not the one chosen.
  - **Automated Harvesters.** A Mk III (or a research) where a Harvester runs on its own, a small drone cutting in place
    of a Worker: Workers saved in a big late colony.
- **Approved for later (the owner, Nov 20 2026).** On record, none started:
  - **Commands for an AI teammate** (done, Nov 21 2026: the Ally panel, `js/ally.js`, order `allyCmd`): attack here,
    defend this area, help me, hold back, ask for goods, back to its own plan. Still open for the owner: whether goods
    should travel by real trucks on the roads (today a supply run crosses the map on a timer), a Missions goal for it
    once there is a team mission, and whether an ally should ever ask you for help or goods in return.
  - **A Research Lab for Versus** (Colony only today).
  - **Balance audit.** The open-field Bulwark blob is still strong (+0.18). Levers to try: a slower Bulwark, the shield
    dropping while it moves, a shock when a shield breaks. Mixed-army cohesion too: a mix loses to massed warbots and to
    the blob.
    **Done, Nov 21 2026** (the audit of November 2026, every change the owner approved; the Bulwark left alone: at equal
    cost the blob only draws with warbots, and four units beat it):
    - *Warden* (AI only): claims 3 Outposts before it walls in, walls the side facing its rival first and stops at 16
      pieces (it had 26 to 39), each turret that falls due goes first (up to six), its first Keep waits for 3 turrets
      and 3 Outposts, army growth 0.9 → 1.0. In a trace on Standard 11 it held 13 robots and 124 Alloy made at 18
      minutes (6 and 90 before). Won **3 of 16** in the 40-game batch (1.5 before): up, but short of the hoped 30–40%.
      Army 1.1 and an earlier missile start were tried on top and did worse (2.5 of 16, 3 games undecided), so not kept.
    - *Skirmisher* health 10 → 9: average at 24 parts +.15 → +.02, against warbots +.19 → +.04 (even); still beats
      Railgunners (+.51) and Arc Casters (+.45). Salvager 11 of 16 (12).
    - *Pulse Turret* armor 12 → 20 and 5 a shot (was 4); *Bunker* armor 32 → 40. Two Turrets (stocked once) now kill
      18.6 of 6 warbots (12.4), 18.6 of 6 Skirmishers (0) and hold against 3 Torches (fell). A Bunker with 2 warbots
      holds against 3 Torches (1 of 3) and kills 18.6 of 6 Skirmishers (8.3), but still only 8.3 of 6 warbots.
    - *Minigun Nest* 2 Cement 2 Alloy (was 1 Alloy): six now cost 32 value against the 37 they stop (19 before).
    - *Disruptor Tower* without its 3 Crystal. *Railgunner* reach on buildings 4.5 → 5.5, past a Pulse Turret's 5: two
      Railgunners now take 2 Turrets without a loss (they held before), which is the siege role it was meant to get.
    - *Rivals against a blob*: up to 4 Mortar Pits (was 2).
    - *Architect* (AI only): its missile programme starts with its army up to 4 behind its rival's (it waited for 2
      ahead). Won 6 of 16 (4.5), but its Silos still came at 22.6 minutes on average (5 built in 40 games, 5 Missiles
      fired): the factory's site waits for Alloy its Bot Foundry and Ammo Plant take. Letting the Foundry rest for it
      put Silos at 18.5 minutes but cost it its army (3.5 of 16), so not kept. Still open.
    - *Marching together* (a rule): robots sent together move at the slowest one's pace until they meet the enemy
      (enemy land, 6 tiles from the target or flag, an armed foe that close, or a hit). Measured from 18 tiles apart, the
      W+S+A+R mix went −.51 → −.42 and all six −.24 → −.28: about no change. The audit's same-speed lever (−.27 → −.02)
      worked by changing speeds in the fight itself, not on the way, so this rule doesn't make mixed armies even. Open
      for the owner: keep it (columns arrive as one), or try pacing through the fight too.
    - *Megastructures*: build times to about two-thirds, Arrival City at 12 minutes (was 15), the rivals' Lance and
      Lift from 15 (18; a Herald's Lift from 19, was 22) and Dome from 17 (20). In 40 games 17 Cities and 14 Lifts were
      placed (7 and 3) and one City finished (none before); games ran a little longer (24.0 minutes to a win, was 20.4).
    - 40-game batch: no game undecided (1 before). Wins of 16: Salvager 11, Herald 11, Steward 9, Architect 6, Warden 3.
    - **Doctrine retune (Nov 21 2026, the owner: the Warden and the Architect in line with the others; Salvager,
      Steward and Herald left as they are).** 40-game batch, wins of 16 before → after: Salvager 11 → 10, Herald 11 → 8,
      Steward 9 → 7, Architect 6 → 8, Warden 3 → 7; none undecided; 24.0 → 19.4 minutes to a win.
      **The owner (Nov 21): the Warden is fine at 7; revisit it later.** The rivals' Deep Core test now plays its war
      on a Large map at Easy: with the retuned Warden one side won before the Core stood.
      - *Warden*: what held it back was keeping a third of its army at home until its push (about four wins on its
        own, measured on its 16 games: walls and Keeps alone, 5; without the home third, 9), marching only on a push, and
        six turrets each put ahead of its economy. Now it marches as the plain rule says and still makes its all-in push
        (from 16 minutes with two more than its rival, before that twice its threshold and a fifth more than its rival);
        grace and threshold a Steward's, four turrets one every six minutes, 12 Wall pieces, up to three Keeps,
        Railgunners per 6 (up to 2). Tried and dropped: a bigger or earlier army (army 1.2–1.35, `armyFrom` 0.7: 1 to
        3.5 wins), fewer walls or turrets with push-only marching (5), the push without normal marches (5).
      - *Architect*: army 0.9 → 1.3 from early on (`armyFrom` 0.7, grace 1.15 → 1.0); its Foundry no longer rests for
        missiles whenever it is three warbots up (it never pulled ahead: 5 wins), only for a missile site short of
        Alloy or Chips, 45 s at most a site; its Ammo Plant rests for such a site and its Arrival City waits for its first
        Silo (or 18 minutes); the programme starts from 8 minutes (was 10), its Silos without spare workers once the
        factory stands. Missile Factory up at 10–13 minutes in most games, but Silos still often come late or not at
        all (3 built in 16 games: 14, 17 and 29 minutes; 6 Missiles fired): a 90 s rest put them at 12–17 but cost
        three wins (5 of 16), a rest for as long as a site waits four. **Still open:** Silos at 10–12 minutes without
        thinning its army (an Alloy reserve that doesn't stop the Foundry?).
      - *Hollow stalls* (r2 batch: Hollow 11 27 → 71.5, Hollow 25 33 → 74.5 minutes after the balance pass): in an even
        war a Steward massing for a march had 11 of its 26 warbots shuttling crates from the nests' hoards, so it never
        had the 15 it massed for at home and never marched. While it masses for a march with the warbots it needs, at
        most a quarter of its armed army now goes on carrying (`LOOT_MASS_SHARE`): Hollow 11 28, Hollow 25 17.1. The
        r2 batch: 1 undecided (Hollow 12, the known stall), 22.6 minutes on average (31.1). Hollow Large (seeds 11 and
        21) ran out the 90-minute clock in a check with this rule; seed 21 did before it too, seed 11 ended at 37.6:
        worth a closer look.
      - Siege Breakers: on Normal and Hard its Warden makes no march or push of its own for 15 minutes (its push at
        10 minutes broke the stand-in player's siege before a shield went down; won again at 24:53 and 26:04).
  - **The main menu as Corvane's system** (done, Nov 21 2026: `js/menuplanet.js`): Ithaca I on a slow orbit round
    Corvane with the Ring, Argos and its shadow, the Carriers, ringfall and the Wren; the war flickering on the night side
    and, rarely, a nuclear blast. Since Nov 21 2026 it's a choice, **Menu background** in Settings (now also on the
    main menu), and **Classic** (the demo game) is the default for now, the owner's call. Still open: whether Planet
    becomes the default later; the other planets of the system (Ithaca I is the fourth; LORE.md names
    none), and whether the Wren's waystation could show at the system's edge.
  - **Map edges, looks only** (done, Nov 20 2026: `natureOffMap` in `js/nature.js`): faded, unplayable terrain carries
    on past the map's edge (the map's own ground mirrored there) into a haze of the biome's colour that thickens outward,
    and zoomed far out the camera tilts a little under a depth haze (the planet view). Still open: a true curve of the
    horizon at the very furthest zoom.
  - **Road crews:** the rivals and the Roadworks; a shorter phone label ("All" instead of "No limit").
  - **Orbital Lift:** an 18-minute opening time; rivals rarely reach it; the Warden in the Hollow gets no main project.
- **Megastructures** (the owner, Nov 17 2026: saved for later). Late-game, one per colony, slow to build and seen by
  everyone, so rivals can race or raid them. The owner's order (Nov 18), after the high-speed transit items: the Ring
  Breaker, the Sunlance, the Great Uplink, Arrival City, the Lance of Corvane and the Shield Dome; the Seismic Lance,
  the Orbital Lift (built, in the Ring Breaker's place), the Atmosphere Engine and the power plant perhaps later.
  - **Ring Breaker** (weapon; dropped from the line-up on the Orbital Lift's sheet, Nov 20 2026: the Lift took its
    place, and the rivals' weapon pick stays the Lance or the nukes). A tether-and-thruster station that pulls fragments out of the Ring and drops them where
    you choose: Ringfall on demand. Every few minutes a strike craters the area and leaves rich Ore or Crystal behind,
    so it is a weapon and a mine at once; slow to aim, so the target gets warning. Lore: the colony doing to Ithaca what
    the Sponsors did to Earth.
  - **Sunlance** (weapon; saved for later, the owner, Nov 21 2026: not in this round of megastructures, as the Lance of
    Corvane already fills the beam-weapon role). A field of mirrors focuses Corvane's light into a beam that sweeps a target, burning
    buildings in a line. By day only; useless in a dust storm, and a solar flare overloads and damages it. Night leaves
    you open, in step with the Murmur.
  - **Seismic Lance** (weapon). A deep drill hammering shockwaves into the ground: aimed at the Murmur it collapses
    tunnel networks map-wide and shakes nests; aimed at a rival it cracks roads and foundations in a radius. The Murmur
    hear it, and come for it.
  - **Great Uplink: BUILT, Nov 20 2026** (README, "Megastructures"; How to play, Megastructures and Rivals, teams and
    victory; the War mission *Aimed the Other Way*). The owner's look A (the Dish Array: one huge white dish, ribbed and
    tilted to the sky on a turning mount, a feed tripod, three small dishes at the corners, a control hut, floodlights
    from below and red rim lights at night) and the sheet's numbers: 50 Cement, 40 Alloy, 30 Chips, 24 Crystal, 300 s,
    armor 120; Begin transmission from 25 minutes in, on 3 Generators with Fuel within 4 tiles (a Fuel every 30 s each);
    8 minutes make contact; an enemy warbot within 3 tiles jams it, and jammed or unpowered the clock runs back at half
    speed; destroyed, the transmission is lost. The owner's answers: an on/off **Great Uplink win** beside Victory (off by
    default) that works alongside any Victory; buildable only with it on and Megastructures on; not in the Hollow (nor
    Colony, as the sheet has it); a banner in the sender's colour and a ping for everyone; contact wins for that colony
    and its team; the end screen shows answer (c), "Signal acknowledged. Source unidentified. Further instructions to
    follow."; the sound: a slow pulse, the Murmur repeating it back in the last seconds (with the Murmur on), then
    silence and one answering tone. Rivals: the Steward builds it as its main project when the win is on (else Arrival
    City); every rival makes a foe's transmission its first target (warbots to jam it, Missiles, bombers and the Lance).
    Still open, for the owner:
    - Power, answered: a Nuclear Reactor and 1 Generator also power it, the Reactor burning a Uranium every 4 minutes of
      transmission (2 a whole one: a Uranium-rich map holds about 24, a nuke takes 12, a Lance shot 2); with both in
      reach, the Generators. Built Nov 20 2026.
    - Stand down, answered: built. Its progress is lost (decaying would let a colony pause through a raid or a Fuel
      shortage and pick up where it left off); everyone is told. A rival never stands down: losing the Uplink costs it
      no more than standing down would.
    - Stewards building it at home and winning 2 of 6 late games: the owner's answer, fine, leave it.
    - The dish doesn't turn to follow the sky (the sprite is one still frame); the sheet's "the colony's street lights
      flicker in time" isn't in. Both are looks only.
    - "Alerts at half, 2 minutes and 30 s" come once each: a clock pushed back past them doesn't repeat them.
    - The Steward builds no Arrival City in a game with the win on, Domination included (the Uplink is its main project).
    - Measured (Nov 20 2026): 16 AI-vs-AI games with Megastructures on (Normal, 60 minutes; Steward against each doctrine
      on 12 maps, two 2 vs 2), the win on against off: on, all 16 decided by Capture, none by contact (most end before
      minute 25; four Stewards had a site up); off, 15 decided and 1 undecided. In six late-start games (both colonies
      stocked, 20 minutes of peace) a Steward made contact in 2 (against the Architect and the Salvager, its Uplink behind
      its base: their bands were cut down on the way), was jammed and lost in 1, lost power at 6:18 of 8:00 in 1. Too
      strong for a Steward building it at home, or the counterplay working as the sheet meant?
    - The campaign's last mission ("No further instructions") and whether its ending should answer differently from free
      play: not done; the mission that teaches it only asks to begin a transmission.
    The notes as filed: A giant dish array to talk to home, and a new way to win: power it and hold it through a long
    transmission window to "make contact", while rivals try to wreck or jam it.
  - **Arrival City: BUILT, Nov 20 2026** (README, "Megastructures"; How to play, Megastructures; the War mission
    *Aimed the Other Way*). The owner's look A from the design sheet (the Terraced Arcology, 4 × 4: three terraces of
    homes stepping back to the north, a school and running track, a park and pond, allotments and two grazing deer, a
    glass atrium with the Arrival clock at T+31, a ring road, a station with an empty tram, bus shelters, a welcome
    sign; its windows lit on a timer at dusk, tier by tier, nobody home), the sheet's numbers (60 Cement, 30 Alloy, 15
    Chips, 24 Fiber, 5 min; +20% work within 8 tiles for factories, gatherers and builders; 6 tiles of land counting
    twice in Domination; a Fuel a minute at night or dark at half bonus; opens 15 minutes in). The owner's answers: it
    can never be destroyed, only captured (knocked to 0 it's down: no bonus, battle damage, dark windows, capturable;
    repairs bring it back; warbots at its walls 20 s take it); it stores nothing; not on Argos; a new Mega tab (key 6,
    with the Lance and the Dome moved there). Rivals: one weapon and two megastructures at most (a Dome in answer to a
    threat doesn't count); the Architect, Warden and Steward build it as their main project, the Salvager and Herald
    don't (in Domination, all do); they march on a foe's City to take it. (Since the Orbital Lift, the Warden builds the
    Lift instead.) Still open, for the owner:
    - Fuel for its lights was the sheet's recommendation and is in; the owner's answers didn't mention it. Keep it?
    - "Repaired to a quarter of its armor, it's up again" and "taken from within 2.5 tiles of its walls" (its square is
      solid, so warbots can't stand on it) are this build's readings of the answers.
    - The sheet's "deer graze its terraces" is in the art only; real wildlife on its terraces would be a wildlife.js job.
    - The sheet's school bell at dawn and the lights' click at dusk aren't in; its hum, the clock's chime and the station
      chime (taken, or lit again) are.
    The notes as filed: An arcology built for the colonists: homes, parks, a school, all lit and empty. Production round
    it goes up (the robots work harder for Arrival), and its land counts double for Domination. At night, a whole lit
    city for no one.
  - **Orbital Lift: BUILT, Nov 20 2026** (README, "Megastructures"; How to play, Megastructures; the War mission
    *Aimed the Other Way*). It takes the Ring Breaker's place as the third non-weapon megastructure. The owner's look A
    (the Beacon Cable: a 3 × 3 anchor pad and collar, the cable a bright beam rising up the screen with climber pods
    riding it, the higher the smaller, red warning lights, floodlights; its shadow along the fall line), and the sheet's
    recommendations for the rest: 60 Cement, 44 Alloy, 26 Chips, 20 Crystal, 330 s, armor 90; the fall line turned with
    R as it is placed (8 ways, half the map's width, on the map, over no other colony's land, Trade Post or Uplink); four
    loads (a Security detail, a Work crew, 30 Alloy, 18 Chips), 45 s down, everyone told, 6 minutes from a landing to the
    next call; the Carrier holds 6 drops, refilled by sending 30 goods up, each load a drop back and the next drop half
    again bigger, up to double; 2 Fuel a climb from a Generator within 4 tiles, a solar flare holds it; below 30% its line
    flashes red ("Lift cable unstable"); destroyed by an enemy, 5 s of creaking, then the cable falls along its line at 4
    tiles a second (2 on Argos), 30 damage to each building (a Keep at half, a Command Base at its floor, another
    megastructure badly hurt), robots on it destroyed and beside it hurt, Walls, roads and track broken, aircraft not hit,
    and its wreckage stays (War scars' scrap: half speed, nothing built on it until Haulers cut it up, an Alloy a tile);
    not in the Hollow. Rivals: the Warden builds it as its main project (no longer Arrival City), the Herald past 22
    minutes, both calling Security when attacked or before a push; the Salvager waits at a foe's anchor when a climber
    comes down; marches go for a Lift whose fall would crush enough. Still open, for the owner:
    - The reserve Command Base through the Lift (restock the Carrier fully, say three times, for a second Command Base if
      the first falls): not approved yet; ask again later.
    - The player can build it from the start (Arrival City opens at 15 minutes; the Lift has no hour of its own, only its
      price). Should it open at 18 minutes, as the rivals build it?
    - "Only a Lift destroyed by an enemy falls" reads here as: a foe hit its colony in the last 2 seconds (`liftKiller`).
      Its own side's Lance, or the ground, reels it in. The Murmur count as an enemy.
    - The sheet's "the Murmur drain the charge left in the wreckage at night" is in the art only (a violet glimmer); their
      tunnels lean toward it as toward any scrap heap.
    - The Warden builds no Arrival City now, even where the Lift is banned (the Hollow): it builds no main project there.
    - The robots a drop brings come whatever the bot limit (they are the Carrier's, not the Foundry's).
    The notes as filed: A space elevator to the colony's Carrier: bring down its last reserves on demand (robots, Alloy,
    Chips) and send goods up. Vastly dear; if it falls, the cable comes down across the map in a long line of wreckage.
  - **Atmosphere Engine: BUILT (Nov 21 2026; see the design sheet's entry above).** A terraforming tower that slowly changes the land round it: no more dust storms in its
    region, barren ground turned fertile (Bio Farms anywhere near), the Bloom pushed back. Finishing the Pathfinder's
    work; the Murmur hate it and go for it.
  - **The Lance of Corvane: BUILT, Nov 20 2026** (README, "Megastructures"; How to play, Megastructures; the War mission
    *Aimed the Other Way*). The owner's look A (a 3 × 3 gun pit, a long barrel on a turntable), the beam across the whole
    map, killing robots of every side too, 2 Generators or a Reactor, 90 s charge, 4 min reload, allowed on Argos; the
    rival AI builds it late in a Nuclear race and chooses between it and the nukes (`aiMegaPick`). On Reactor power
    (the owner, Nov 20): a 45 s charge and a 3 min reload (Generators 90 s and 4 min), 2 Uranium or an Enriched Uranium a
    shot; with both in reach, the Generators unless Use Reactor is switched on in its panel (the rival switches it on
    once it has chosen the Lance). Widened (the owner, Nov 20: a full-map shot often took only 2 buildings, no more
    than a Missile): a 2-tile core that destroys every building it touches and a 1-tile scorched edge either side that
    takes half the armor of buildings and half the health of robots without destroying anything; the trench, its War
    scars and the aim line widened to match, and the rival's aim scores the wider line. Open: whether the core should
    grow to 3, or the edge burn crops and groves too. Still open: power lines
    to carry its power from further off (below). The notes as filed: (the owner: "a giant laser gun"; weapon). A planet-scale laser cannon on the colony's own
    power, by day or night (unlike the Sunlance): it needs Generators or a Nuclear Reactor beside it, and much Alloy,
    Chips and Crystal (a Ring Crystal lens). It charges for a minute or two before each shot: the colony's lights dim
    and its factories slow while it does, and a glow climbs the barrel for everyone to see. The beam crosses the whole
    map in a straight line, cutting through every building in its path, carving a scorched trench, boiling water to
    steam and breaching Walls; a Command Base holds at a floor, as with Missiles. Counterplay: a Shield Dome takes a
    shot, buildings spread off the line, wrecking the Generators that feed it stops the charge, and a dust storm
    scatters the beam. The charging draws the Murmur within reach, so firing by night is a gamble. Lore: an orbital
    defence design from Earth's last years, found in the archives and built again here, aimed at each other. At night
    the beam lights the map for a moment and the cut glows red, then cools. (The game has no power lines: Generators
    power what's within 4 tiles of them. Power lines that carry a Generator's power further, and that the Murmur's
    Leeches drain, would be an idea of their own; the lore already speaks of them.)
  - **Power for the megastructures: power lines and nuclear power** (the owner: a use for Uranium beyond the bomb). For
    now the Lance runs on 2 Generators or a Nuclear Reactor (2 Uranium a shot) within 4 tiles, and the Dome on a
    Generator: this is still open, and would take over from those.
    Today Uranium is only in a Nuclear race, enriched at the Reactor for the bomb, and Generators only speed up what is
    within 4 tiles. Instead: a **Nuclear Power Plant** burns Enriched Uranium for far more power than Generators, and
    **power lines** (pylons, laid like roads or track) carry it across the colony. The big structures (the Lance, the
    Shield Dome, the Mass driver, the Maglev, the Great Uplink) run on that grid and stop when it's cut; factories on it
    work faster. Uranium deposits would then appear in more games, not just a Nuclear race, so it is a choice: power or
    the bomb. Risks: a Plant hit hard enough melts down (a small fallout zone where nothing works for a while); the
    Murmur's Leeches drain power lines at night, the lights going out pylon by pylon (as LORE.md already has it); a
    rival cuts a line to stop a charging Lance.
  - **Shield Dome: BUILT, Nov 20 2026** (README, "Megastructures"; How to play, Megastructures). The owner's look A (a
    faint blue hex-panel dome from a 2 × 2 emitter), radius 9, 100 strength, a Crystal every 20 s and a Generator; the
    rivals put one up late when threatened from afar. The notes as filed: A great energy dome over the base, stopping Missiles, bombs, Ringfall and Howitzer shells while
    powered; it drains Crystal all the time, and warbots can still walk in, so a war on it turns from bombardment to
    ground assault.
- **High-speed transit** (the owner, Nov 17 2026: saved for later; Nov 18: next after the oil seeps, in this order: Maglev,
  Express highways, Mass driver, each from a design sheet). Late-game, high-capacity links for a big colony,
  beyond roads, Freight Trains, Ropeways and Cargo Planes.
  - **Maglev line** (built, Nov 18 2026: direction A, "Accord Phase 2", from the design sheet, every recommendation on
    it accepted). Maglev Terminals (Build → Move; 8 Cement, 6 Alloy, 3 Chips; storage with conveyor joins like a Rail
    Station's), a Paths tool (Maglev, Shift+M, two taps) for a straight line 6–40 tiles long in any direction over
    anything, a pylon every 3 tiles (open ground, cliff tops or water; a chasm of up to two spans crossed), 1 Alloy, ½
    Chip and 1 Cement a tile prepaid from storage, built out from the near Terminal by a Worker, the far Terminal
    last; pods (4 Alloy, 2 Chips at a Terminal's pod bay, four to a line) carry 16 goods both ways at 3× a Freight
    Train's speed with 4× its acceleration on the rail plan's loads; a Generator within 4 tiles of each Terminal or a
    solar flare slows them to a Worker's pace; pylons have a Wall's toughness and cut the line when shot down (a pod on
    the span is lost, the rest turn back), a Worker rides out and rebuilds one in 20 s; allowed in the Hollow, where a
    running line draws the Murmur as a Generator does. Decided on the build: pylons clear a boulder or grove under
    their foot (the sheet's "open ground" would have blocked most lines on a rich map); the far end may also be a
    Terminal site or a finished Terminal (then the line's site is its first pylon); all water counts as shallow (a
    pier), only chasms and rock are spanned. Open: the rival (below), riders (a Worker crew only, if ever), Flak at pods (they are not aircraft: nothing shoots a pod but the pylon under it), and
    whether 4× a train's acceleration is brisk enough on a short line (a 20-tile line takes about 5 s, not the sheet's 3).
    Lit up at night, it looks the part.
  - **Express highways** (built, Nov 19 2026: direction A, the Expressway, on B's mechanics, from the design sheet,
    every recommendation on it accepted). A road tier above Asphalt (`S.pave` 3): a one-way lane a tile wide, laid in
    pairs (or singly with Shift) by the Paths tool Express (Shift+E), the base a road laid by Workers, the surface by
    the Roadworks' Paver for 1 Asphalt and a quarter Alloy a tile; Road Trains 2× Asphalt (5.5), Freight Trucks and
    Tankers 1.64× (4.5), warbots at Asphalt speed, Haulers and the light bots never along it (only across, at an
    overpass); wear as Asphalt, worn through it drops to Asphalt; ramps and ends autotiled; roads cross a lane only on
    an overpass, planned for you; lanes never cross; 90° bends; allowed in the Hollow. Decided on the build: the Paver
    may drive a lane (it has to lay and resurface it); the Alloy is paid only when a lane first goes up, resurfacing
    costs the Asphalt alone; the overpass is planned the moment the crossing exists (the sketches count and price it);
    the cat's-eyes are drawn live rather than baked, so the Murmur's dark puts them out tile by tile. Open: the rival
    (the Architect lays a pair base to Depot cluster once its late game has a Roadworks; raiders already tear lanes up
    like roads); C's flyover as a later piece over a second lane; the sign gantries (built Nov 19 2026, drawn in code, blank boards); nicer one-way
    arrows (below) so a lane's arrow fits its markings. **Tutorial done:** Arterial follows Blacktop in Roads and Traffic. It has a stocked
    Roadworks, a 16-tile Express pair, two side ramps, and Freight Truck deliveries to a survey Depot.
    **Reviewed Nov 22 2026** (determinism, pathing, saves, art, docs: sound). Fixed: a lane dragged across a lane still
    only planned took the crossing tile over (the lanes would have crossed once built); now refused there, as across a
    built one. A lane can now be dragged under a Maglev pylon, as a road can (`tools/transit-test.js`). *Open:* a Hauler
    or light bot off the road may step across a lane at any tile, not only at an overpass (pathing allows any crossing
    step across the lane's way); should open ground beside a lane be fenced, as the barrier art suggests?
  - **Mass driver** (built, Nov 19 2026: look A, "Coil Ramp", from the design sheet, with the owner's changes: no Fuel a
    shot, only a Generator within 4 tiles; reach 12–30). A Mass Driver (Build → Move, V; 10 Cement, 8 Alloy, 4 Chips)
    aimed on its panel at a Catcher (C; 6 Cement, 4 Alloy, 2 Chips) throws a canister of 12 goods every 10 s, 2–3 s in
    the air, from a goods list of up to 3 goods (each with a reserve the colony keeps at home); enemy Flak bursts
    canisters (crates where they fall), a canister with no Catcher lands as crates; none in the Hollow; the mission The
    Schedule teaches it. Decided after (the owner, Nov 19 2026): Flak as a hard counter is fine (a Flak Gun right under
    the arc bursts every canister that crosses its reach, so a line has to go round rival Flak); two tiles ("a 2x1
    footprint would be cooler"), laid east-west or north-south as it's placed, firing off the end facing its Catcher.
    Open: the rival (it builds none); whether a Catcher should also send goods back (a Driver at each end works today);
    a Catcher full of goods nobody fetches (no cap today).
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
  aboard (a truck in the pod?). (Fuel and Crude both fly: the owner's call, Nov 17.)
- **Maglev lines and the rival** (Nov 18). The Maglev is player-only too: no rival builds Terminals or lines, though its
  warbots, Howitzers and bombers hit pylons and Terminals like any building. The sheet's answer stands: a Maglev joins
  the rival's list when its late game gets a transit tier, and then only the Architect and the Steward, with a line from
  their base to a far Depot cluster, once they have Chips to spare; and a rival should then learn to cut a line (guns
  under a pylon). Also open from the build: riders (a Worker crew at most, never warbots) and a hand-driven pod
  (lines of more than two Terminals: built as hubs, Nov 20 2026). The Architect builds a line since Nov 20 2026 (see
  the Maglev follow-ups above); a rival cutting a line on purpose (guns under a pylon) is still open.

- **Room to grow in the single-file game** (owner's to-do, Nov 17; done Nov 18: every picture now lives in a bundle beside the page,
  `dist/art-{buildings,bots,effects,other}.js`, loaded as the page starts (`loadArt`), and the page is about 3.9 MB of code,
  so art can be added freely; kept for the record). `dist/terrafall.html` must stay under 16 MB (its
  host's limit for a page; each file beside it has its own 16 MB). It reached 16,346 KB with the Hollow's and the new
  Fiber and Oil art, so the Forest's and the Polar Caps' biome art moved into bundles beside the page like the newer biomes'
  (`LAZY_BIOMES`), freeing about 1 MB (15,409 KB). That buys a few batches of art and code, not the long run. The page
  still carries every other image as text (about 9.7 MB of WebP, a third more once inlined): buildings 5 MB (each in two
  team colours), bots 2 MB, effects 1.2 MB. The lasting fix is to move the rest of the art beside the page too, in a
  few bundles (buildings, bots, effects and the Desert) that load before the game starts (or as the Lore and night
  sets do), so the page holds code alone and can't fill up again. Then check that the single file still opens straight
  from a folder and still plays offline. Meanwhile, the biggest single images are `effects/nuke-blast-sheet.webp`
  (377 KB) and `effects/fx-fuel-blast.webp` (125 KB), if a quick re-encode is ever wanted.
- **A new look for the oil seeps (done Nov 18 2026).** The owner's reference pictures showed a puddle of crude: glossy,
  jet black, a soft wavy outline of lobes and pinched waists, a few droplets beside it, pale sheen patches, a thin white
  light along the lower rim. From a design sheet of three directions (A fresh spill, B spattered seep, C still pool;
  `renderer/preview/oil_seep_sheet.py`) the owner chose **B, the Spattered seep**, and decided: a slow shimmer in the
  sheen for motion (render-only, nothing on Saver); **no survey stakes at all** (the puddle alone marks the oil; the
  stake art is gone); the Hollow's seeps a touch stronger in rim and sheen with a violet gleam; droplets may lie on the
  open ground beside the seep; pumping dry recedes from the pump outward (a pump's own tile first); under a road the
  puddle stops at the kerb and the road keeps its stain; one look on every biome, tuned where black on dark ground needs
  it. Built in code, not art: `js/seep.js` (ART_GUIDE Batch 20). Open: a bubble that swells and pops now and then was
  the other motion idea; it can be added later if the shimmer is too quiet.
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

- **2 vs 2 seat order and ally support.** In the earlier computer-only sample, players 0 and 1 won 10 of 12
  games. Since Nov 19 (fixed) tied AI turns rotate across the teams and the unit and building update order alternates
  in team games. Also fixed computer orders aimed at allied buildings, adds help against raiders on an ally's land, and pairs
  neutral Trade Posts where the terrain allows. See [the replay and map checks](docs/ai-stalemate-fixes.md#4-2v2-fairness).

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
  - **Grand Canyon** (the owner's idea, Nov 2026). Two high rims, a colony on each, with a deep gorge between them and a
    river along its floor, the walls cut into layered terraces and crossed by side canyons. Built with rocky shelves,
    fertile bends of varying width, and a river that splits around a mirrored pair of islands. Unlike Rift or Canyon maze,
    the middle is the richest ground (Crystal and Ore exposed in the rock layers, water, easy road building) but it is
    overlooked from both rims: guns and Howitzers on the edge rule the floor, so whoever holds the rim holds the
    canyon. A few switchback trails (Ramps) down each wall, narrow points for Viaducts, Ropeways, and Ports on the river
    for ships. Side canyons from the edges to the floor let a rival flank round a blocked trail. The question it asks:
    hold the rim and snipe, or take the floor and gamble? Lore: the Ring's biggest strikes cracked the crust.
  - **The Spine:** a mountain range down the middle with three crossings of different character: a wide, easy pass, a
    narrow high pass that can be walled off, and a tunnel through the rock (the game's tunnels). The far side is
    richer. Clean chokepoint warfare, each crossing suiting a different plan; the easiest of these to build.
  - **The Dam (BUILT Nov 23 2026: see The Dam above):** a high valley lake held back by a dam above a low valley with a colony in it. Wreck the dam and the lake
    floods the lower valley. The upper colony has a threat to wield, the lower one a reason to strike early. Pairs
    with Flood season (see the planetary events idea).
  - **Isthmus:** two landmasses joined by a narrow neck, sea on both sides. Land armies fight over a tiny bridge while
    ships, Ferries and Airships go round it, so every kind of unit has a job.
  - **The Thaw** (polar; the most ambitious): a frozen sea that melts as the game goes on, so crossing routes open and
    close over time: walk to the enemy early, not late, unless you build a Port. Needs terrain that changes during
    play (a new piece of simulation).
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
  forward Port stocked by Container Ship. Still open: the rival running ferry lines, and **the naval war** (owner,
  Nov 21: add a **Warboat**, and expand fighting at sea). Proposed roster, in build order:
  - **Warboat** (built at a Port): a fast armed patrol craft with a pulse cannon. It escorts convoys, hunts enemy
    ships and Ferries, and lightly shells the shore. The core naval unit.
  - **Coastal Battery** (a shore building): a heavy gun that outranges the Warboat, so a held coast is a real defence.
  - **Diver**: a submersible drone, unseen until it surfaces to fire torpedoes at ships. It is spotted by Warboats
    close by, or by a **Sonar Buoy** (a cheap placeable picket on the water).
  - **Flak Corvette**: an anti-air escort that sails with convoys and Ferries against bombers and Airships.
  - **Monitor**: a slow, heavily armoured shore-bombardment ship, like a Howitzer at sea, for breaking coastal forts.
    Weak against Divers.
  - **Sea mines** (dropped by a Warboat upgrade or a Mine Layer boat): close a channel or a Port mouth.
  Rock-paper-scissors: Warboat beats Diver once found; Diver beats Monitor and cargo; Coastal Battery beats Warboat;
  Monitor beats Coastal Battery; Flak Corvette guards the lot from the air. Needs: ship-vs-ship combat, the rival using
  it (`aiNaval`), art sheets for the owner to pick from, Missions goals, and How to play.
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
  **The air war (owner, Nov 21: save for later).** Proposed roster, in build order:
  - **Interceptor** (a fighter from the Airfield): shoots down bombers and Airships and escorts your own bombers, so
    bombers meet a counter in the air and not only guns on the ground. The core air-combat unit.
  - **Radar Station** (a building): sees aircraft coming early (an alert), and Flak Guns near it fire further.
  - **Gunship / Attack Drone**: circles a spot for a while strafing warbots; close support, not a one-off strike.
  - **Transport Helicopter**: drops a small band of warbots anywhere, over walls and cliffs; slow and fragile, a raid tool
    beside the Ferry's beach landings.
  - **SAM Launcher** (a building, or mobile): long-range missiles, a hard hit and a slow reload; beats Gunships and
    Airships, while fast Interceptors can slip it.
  - **Repair Drone**: hovers over damaged robots and mends them in the field.
  - **Carrier** (late, joins the naval war): a ship that launches and refuels aircraft.
  Counters: Interceptor beats bombers and Gunships; Flak and SAM beat low Interceptors; Gunship beats warbots; Radar
  makes every air defence better. First pair to build: Interceptor + Radar Station.
- **Graphics.** A first pass is done (rounded shorelines on ponds, lakes and seas, by day and in the night glow). Rock
  outcrops (crags) stay square: rounded crags were tried in November and the owner preferred the square look. Worth
  another look when new art comes in.
- **Redesign the Fiber and Oil resources on the map (the owner, Nov 17; installed Nov 2026).** The owner didn't love
  either look: Fiber's Stalks (teal fungal stalks with glowing mint caps) and the oil seep (a dark glossy pool with a
  rainbow sheen). From a design sheet of three directions each, the owner picked **Reedcane** for Fiber (jointed
  sage-teal canes with mint plumes, an image for each growth stage, the plumes glowing at night) and the **Pathfinder
  survey stake** for Oil (the seep drawn as soaked dark ground across all its tiles, an old survey stake on each pump
  spot, its lamp lit at night). ART_GUIDE Batch 16. (Nov 18: the oil look was redone again as a puddle of crude and the
  survey stakes retired: see "A new look for the oil seeps" above and ART_GUIDE Batch 20.)
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
  a Keep, where the leader's bands keep taking Outposts that are lost again (historical seeds 2, 5, 17); and a staging
  island it takes first, which isn't tried. Fixed Nov 19: the Ore trap in Medium seed 21 (a rival now works a lone
  deposit when that is all it can reach, and gives its first crossing priority on Ore-poor islands); seed 21 ends at
  20:53 after four landing runs. See [the seeded replay notes](docs/ai-stalemate-fixes.md#3-islands-crossings).
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
- **Shared colony co-op** (decided by the owner, Nov 19 2026: shared control, no fixed roles). Two players run one
  colony against the computer, both with full control of everything: one economy, one set of buildings and robots, one
  win or loss. Each keeps their own camera, selection and menus. The partner's cursor shows as a coloured dot with
  their name; a ping key marks a spot for both (with a sound); build sites, plans and army orders carry a small badge
  of who placed them, and the log names who did what. An optional role preference in the lobby (Economy, Military,
  Both) only filters which alerts and quick menus pop up, never what a player may do. Dismantling something the
  partner placed under a minute ago asks to confirm. Technically: two humans share one player seat on the lockstep
  (orders carry the issuer), plus the cursor, pings and badges. It can ship as a Custom Game option before the co-op
  scenarios, which build on it.
  **Built** (Nov 2026, as decided; see the README's Co-op paragraph and How to play, Multiplayer): Custom Game's
  **Host a co-op game** in Versus or Colony, the lobby's co-op seat, cursors, the `.` ping (and Ping on the bar for a
  touch screen: the middle of the view), site badges, order badges and log lines, roles, the Dismantle check. Still
  open: the co-op scenarios; whether roles should also hide whole quick menus (today they filter pop-up alerts only,
  as no menu opens by itself); co-op with Teams (two people on one side of a 2 vs 2) is not offered yet; and whether
  pings deserve a touch gesture of their own (a long press is taken by the map).

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
- **No deposits on a post's ground** (the owner, Nov 2026): only a Terminal or a Ramp can be built there, so a deposit
  there could never be mined. The map's are moved just off the ground (the same kind and amount, each with its twins on the other colonies' sides, so a symmetric map stays symmetric tile for tile),
  as are an older save's as it loads; Ringfall's pieces land just off it, and Grove Planters and Bio Farms plant nothing
  there.

Still open:

- **Fertile soil on a post's ground** stays (it isn't a deposit, and no Bio Farm plants there now): should it be moved
  off too, or is it fine as it is?

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

## Balance audit, Nov 22 2026 (after the megastructures, the Harrow and the bolder Murmur)

Measured headless (the full report: the audit folder's REPORT.md): 40-game doctrine batches (all 10 pairs × Standard
11 and 23 with seats swapped, Chokepoint 5, Standard Large 31) with the Murmur Off, Quiet and Active, megastructures
on and off, plus 40 games over 12 map types, sizes and biomes, 16 Colony games, 12 two-hour Colony games for the
Harrow, the arena and defence trials, and every mission at all five levels.

**Fixed:**
- *Active games that never ended* (8 of 40, 6 on Standard Large 31): both rivals' only roads to their Crystal ran
  past a nest, and their Haulers turned back there for good. The ground kept clear of a nest's guards in Versus was a
  circle round each guard (5 to 6 tiles from the nest), where they never bite. Now it's the circle they bite in
  (`GUARD_VERSUS` + 1 round the nest), and a rival's roads go round it where they can (`roadNestAvoid`). Active:
  undecided 8 → 3 of 40 (two of those end at 49 and 56 minutes, one is a long war); Quiet 0 → 0; Off unchanged.
- *Convoy on Warlord* (none of 3 scripted runs won): a Medium rival and 16 minutes (five-long values); 4 of 5 won.

**Wins of 16** (Salvager, Herald, Steward, Architect, Warden):
- Off: 10, 8, **11**, 6, **5**.
- Off without megastructures: 11, 9, 11, 3, 6.
- Quiet: 12, 11, 9, 3, 5 (after the fix 13, 10, 7, 3, 7).
- Active: 11.5, 7, 8, 8, 5.5 (after the fix 15, 8, 8, 6, 3).
- Minutes to a win: 19.6 Off, 22.1 Quiet, 25.3 Active.

**For the owner (not changed):**
- **The Steward on The Rust (the default biome) and Cinderlands is 11 of 16, and the Warden 5.** The Nov 21 retune's
  7 and 7 were measured before the Atmosphere Engine merged. On a barren home the Engine (from 21 minutes) replaces
  Arrival City (from 12) as the Steward's main project, and a City it rarely finishes was costing it games. With the
  Engine off for rivals the batch gives back the approved numbers exactly (10, 8, 7, 8, 7). Choose: the Engine only
  with Planetary events (back to the approved balance), or keep it.
- **Megastructures never decide a game between rivals.** In 160 games, 49% are over by 20 minutes and 82% by 30.
  - Arrival City: placed 25 times, finished 2.
  - Orbital Lift: placed 41, finished 0.
  - Lance: chosen 28 times, never built.
  - Sundering Ray: chosen 19 times, never placed, not even in peace.
  - Deep Core: placed 13 at about 36 minutes, never finished.
  - Atmosphere Engine: placed 11, finished 0.

  A weapon pick that never gets built also costs the rival its Nuclear Silo. Proposed: choose the Lance or Ray only
  with half its cost in hand; the Deep Core for rivals from 20 minutes (30 now, and only once its last Ore Mine is
  dry). Pacing (build times or costs to two thirds) is the owner's call.
- **The Harrow and a colony with no army:** it came in 5 of 12 two-hour Colony games on Active (night 6 or 7). The
  computer-run colony had no armed robot each time; the Harrow was barely scratched (235 of 240), left after 15
  minutes, and 13 to 55 buildings went; colonies ended with 1 to 16 buildings (33 to 77 without it). Proposed: the
  Observer/autoplay colony raises 12 armed robots once the roll hits, and the dusk warning names it; strength as set.
- **The Salvager leads with the Murmur on** (12 to 15 of 16).
- **The Architect is weakest** on Quiet and without megastructures (3 of 16); its Silos are still late (3 in 16
  games, at 14, 17 and 29 minutes).
- **The rivals built 2 bombers in 160 games:** the Flak Gun has nothing to shoot in a game against them.
- **Missions on Warlord:** Border Dispute is lost at all three scripted work speeds (the Command Base falls at 3½ to
  13 minutes) with mPick's rival a level up; with Commander's rival on Warlord all three win (7 to 13 minutes). Hold
  the Line's script plans its Walls on a Trade Post's ground now (the post has moved), so it can't be judged. Live
  Fire on Warlord: the script's army runs out of Ammo by the rival base at 1 armor. Harbour: the script ships nothing
  (on Nov 21 code too).

**Unchanged and fine:**
- Combat and defences: no number changed. Every robot and defence has its job (the brawl tables match Nov 21).
- Colony on Active and Quiet: the same as when the bolder Murmur were built.
- The known Hollow stalls end (Hollow 12 at 42.6, Hollow Large 11 at 28.1 and 21 at 33.3).
- Sky islands and Islands still have their known long wars (4 of 40 in the map batch).

### The parity pass, Nov 22 to 23 2026 (the owner approved the proposals above)

The owner's goal: every rival doctrine wins 6 to 10 of 16 in the core batch (10 doctrine pairs x 4 games: Standard 11
and 23 seats swapped, Chokepoint 5, Standard Large 31; Colonist, Nuclear race on, The Rust), for Murmur Off, Quiet and
Active, megastructures on.

**Shipped:** the Atmosphere Engine is the Steward's main project only with Planetary events on (the player's Engine
unchanged); the Lance and the Sundering Ray are chosen only with half their cost in hand (short of it the Nuclear Silo
plan goes on); rivals start the Deep Core from 20 minutes without waiting for their last Ore Mine to run dry; Border
Dispute on Warlord keeps Commander's Normal rival (won at all three scripted work speeds: 13:11, 7:09, 7:29).

**Wins of 16** (Salvager, Herald, Steward, Architect, Warden; undecided count half), before, with what shipped, and
with everything tried:
- Off: 10, 8, 11, 6, 5; shipped 10, 8, 7, 8, 7; all 9, 8, 9, 5, 9.
- Quiet: 13, 10, 7, 3, 7; shipped 14, 11, 5, 3, 7; all 15.5, 9.5, 5, 5, 5 (1 undecided).
- Active: 15, 8, 8, 6, 3 (3 undecided); shipped 15, 9, 7, 6, 3 (2); all 15, 9, 4.5, 4, 7.5 (4).
- The 12 map types, with all: 9, 8.5, 8.5, 7.5, 6.5 (8 undecided, 6 before).

**Tried and held back** (not clearly better; kept on branch parity-nov22 for later):
- The Architect's Alloy reserve (its Foundry takes no parts for up to 90 s while a missile site waits): Silos finished
  13 to 21 in 120 games, but its wins summed over the three batches went 17 to 14.
- The Warden on Active (army 1.15, its ring of Walls from 20 minutes): 3 to 7.5 there, at the Steward's and the
  Architect's cost (8 to 4.5, 6 to 4).
- Bombers against a dug-in enemy (an Airfield from 14 minutes, two bombers): 40 Airfields placed, 3 bombers built.
- A computer-run colony arming 12 robots for the Harrow, and the dusk warning naming it: on the 5 two-hour games the
  roll hits, the colony ended with 1 to 6 buildings (1 to 16 unarmed); on night 6 the warning leaves a minute, and on
  night 7 the twelve took the Harrow to 176 and 196 of its 240.
- Trims of the Salvager with the Murmur on (on its 16 Quiet games it won 14): no raids at or near night 15, army 1.0
  15, raids half as often 15, all three 13 of 13, rivals keeping their home guard against it 14, no rival nest strikes
  before 20 minutes 12 of 13, and the AI's Murmur handling off for both sides 12.

**The owner's answers, Nov 23 2026, built:** (1) the Murmur spread their attacks more evenly: what a pack goes for
(`murmurPrey`) weighs a building's charge by `murmurFair`, the colonies' mean charge over its own colony's, clamped to 0.5
to 1 (the richest draws them less). Also tried and dropped, each running 3 Standard Large games on Active past 90
minutes (both sides worn down): the same factor on where tunnels head, up to 2 for a lean colony, and Active's pressure
by the colonies' mean power. (2) The hangar fix, for every colony: a yard's parts are asked for like a factory's inputs,
as urgently as a Bot Foundry's, and held there (`yardHeld`): a rival's one bomber now gets built (0 or 1 a batch to 1
to 3; the rivals' earlier, two-bomber Airfield on top of it built 16 a batch but added a stall in Quiet, so it stays out).
(3) The Warden tweak on Active (army 1.15, its ring from 20 minutes) is in.

Core batch, wins of 16 (Salvager, Herald, Steward, Architect, Warden):
- Off: 10, 8, 7, 8, 7 (unchanged: the Murmur and Warden changes don't apply, the hangar fix changed no game).
- Quiet: 14, 11, 5, 3, 7 (every game the same as before).
- Active: 15, 9, 7, 6, 3 (2 undecided) to 14.5, 8.5, 6, 4, 7 (3; the third, Standard Large Herald against Salvager,
  ends at 77 minutes; it was won at 45.7, the cap is 50). Without the Warden tweak: 14.5, 9.5, 7, 6, 3 (3).

**Still open:** the Salvager with the Murmur on (14 to 15 of 16). The Murmur aren't why: in the Quiet games measured
(to 22 minutes) they destroyed no building of either side and one robot or none, and evening out their targets
changed no Quiet game. What differs is the map: nests hold ground (no rival builds within 6 tiles of one, roads and
Haulers keep off their guards), and the lean, raiding Salvager loses least by it. Next, if wanted: measure how much
Ore and land each doctrine gives up to the nests, or a Salvager rule for Murmur maps.

**For the owner (asked Nov 22, answered above):**
- **Murmur targeting and the Salvager.** The Murmur go for what holds the most charge, so they hit the bigger
  economies and leave the lean Salvager alone (its Alloy at 10 minutes is 64 on Quiet, 55 Off; its rivals' the same):
  it wins 14 to 15 of 16 with them on, and no AI lever moved it. The answer looks like a Murmur rule, not a doctrine
  number.
- **The hangar supply fix for bombers.** A hangar's parts are a standing order drawn only from storage beyond every
  other need, and an AI colony's Alloy and Chips never sit in storage (the Foundry's conveyors take them as made), so a
  rival's bomber is almost never finished. Fix: let a hangar's round come first (or from the Foundry's own parts).

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
  Cinderlands. Needs new art. The campaign's set pieces are listed in CAMPAIGN.md. (Contingency's battles have the
  atlas's own landmarks and wrecks now: see Contingency's landmarks above.)
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
  - **The rival clears the nests on the Ore and oil it needs (fixed Nov 17).** Medium seed 11 (computer only, the
    Murmur Active) ended at 27.5 minutes, ran to 75 with no winner from the rival's oil first (f3405c7) on, ended at
    34.8 after the Murmur's craft and at 32.5 on today's main. Traced on 5b04c5e: by about half an hour each colony has
    worked out the Ore and seeps it can get at, and all that's left lies 2 to 5 tiles from four nests in the flank
    caverns (336 Ore, and 222 of the 229 Crude). The rival builds nothing within 6 tiles of a nest (`aiNestClear`), and
    its day strikes went for the nests nearest its buildings, which guarded nothing, mostly without the warbots to
    spare (every garrison keeps one). So both colonies ran dry of Alloy (no warbots, Ammo or Chips) and Fuel at about
    35 minutes with ten warbots each, Crystal piling up past 300, and nothing happened for the last 40 minutes. Oil
    first didn't cause it: before it one colony ran on no Fuel all game and lost at 27.5; evenly matched, both ran dry
    together. Still there on today's main: seed 11 got to the same place by 25 minutes (one colony dry of Ore, Alloy
    and Fuel), and ended only because the other happened to wreck the Deep's mound and then an Ore nest; Medium seed 12
    ran to 75 with no winner. It isn't one map: a fifth to four fifths of a Hollow map's Ore, and up to half its oil,
    lies within 6 tiles of a nest (most on Small maps).
    Now a nest on what the colony is running out of comes first (`aiNestRiches`): Ore once the Ore it can get at away
    from every nest is under 150, oil (where oil is its Fuel) under 60; the one holding most, within 34 tiles; its rear
    garrisons send every warbot they hold to the flag, and it masses for it while it's short. Measured, today's main →
    with it (75 minutes at most): the Hollow, Medium seeds 11 to 16, 32.5, none, 20.8, 15.9, 17.1, 21.3 → 28.2, 48.6,
    20.8, 17.4, 17.1, 21.5; Small 21 to 23, none, 20.1, 18.2 → the same; Large 31 and 32, 46.3, 51.8 → the same; the
    same winners wherever there was one. On 5b04c5e with it, seed 11 ends at 39.5. Standard (map types 0, 2 and 4,
    seeds 21 to 23, seven games): the same, 14.8 to 45.4 minutes, the same winners (one game lost one robot fewer).
    Still open: seed 12 showed a colony with no Oil
    Pump for ten minutes while 111 Crude lay on its own land (its pumps out in the middle wrecked, its sites full: the
    open item above).
  - **The rival gathers its whole army for a storm (fixed Nov 18).** Small seed 21 (computer only, Normal, the Murmur
    Active) ran to 75 minutes with no winner before and after the nests fix: from 19 minutes the second seat had two to
    three times the first's army (35 against 13) but stormed its base with 12 to 14 and marched on its Outposts with
    18 to 21, beaten every time. It wasn't the forts' home guards (its Outposts kept none, its Keep two, its Bunkers two
    each): traced, at 19 minutes 8 of its 35 warbots were in a garrison and 26 out, 9 hauling crates; at 25 to 31
    minutes 13 to 18 of 27 to 29 were hauling, and it could gather 1 or 2 for a base that took 24 to 28. An idle
    warbot picks up crates within 6 tiles and, once it has carried one home, goes back for more within 50 (`doLoot`);
    the cleared nests' hoards never rot (`LOOT_KEEP`), and a march counts only garrisoned warbots (`aiSpare`), so the
    rival "massed" (`P.massFor`) while half its army shuttled crates, and went with what was left. Later (46 minutes)
    the base took 34 behind turrets and mortar pits, and the storm stopped at 30 whatever the base took (`aiMarch`):
    it massed for four minutes, gave up, marched on the cheapest Outpost with 18 to 21, lost them, and again. Now a
    rival with a decisive lead (the storm's: half as many warbots again as the enemy and four more) massing for a march
    or a storm it has the armed warbots for (`P.massFor` with `lead`), or with a storm under way, has a warbot that
    brought a crate home stay there instead of going back for more (`lootHeld`), so the march can draw on it; and the
    storm is as big as the base takes and two more when that is over 30 and it can gather them. Two wider cuts were
    measured and dropped: holding every crate run of any massing colony (nest strikes too) starved two colonies out of
    a Standard game, and holding a massing colony with the army but no lead ran three of four Hollow Large games to
    the cap that had ended (a rival in an even war masses for some Outpost from 11 minutes on, so that hold never
    lifted, and on the Hollow the nests' hoards are the Alloy it lives on; the cap change alone replayed those games
    unchanged). Measured (75 minutes at most, the same winner unless said), before → after: the Hollow, Small seeds
    21 to 25, none, 20.1, 18.2, 55.7, 31.2 → 22.7 (the second seat wins), 17.1, 18.2, 57.6, none; Medium 11 to 16,
    28.2, 48.6, 20.8, 17.4, 17.1, 21.5 → 27.6, 40.9, 23.5, 18.3, 17.6, 21.5; Large 31 to 34, 46.3, 51.8, 30.5, 26.0
    → 44.9, 49.9, 33.2, 25.8. Standard (map types 0, 2 and 4, seeds 21 to 25, 13 games): 14.7 to 37 minutes, within
    a few minutes of before, one winner changed (type 0 seed 21: 45.4, first seat → 37.0, second). Still open: Small
    seed 25 ran to the cap after (the second seat won at 31.2 before). The games are the same to 20 minutes and part
    there by chance; then the second seat, with 38 against 8 to 11, storms the base four times under the crushed-rival
    rule (twice the enemy's army and two more, however the guns count: 24, 20, 17 and 21 warbots) against a base that
    takes 34, 37 and 41 (two or three turrets, a Keep, a Bunker, three Outposts and seven warbots within 9 tiles),
    loses all 82, and has no Fuel or Chips left to make more. That rule throws a crushing army at guns that beat it
    whenever the enemy's army is small and its guns many; a storm beaten there once could wait for what the base takes.
    Test: `lh/hollow-storm-test.js`.
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
  them (earlier warnings, better counters). Regional variants: armoured in the Rust, pale and slow in the Polar Caps,
  violet-glowing in the Bloom.
- **The new forms' art is in** (Nov 2026, ART_GUIDE Batch 17): drawn true size with their action loops, glow and light
  pools; the behaviour is the sim's. Open, for whoever builds it: a Sapper under the ground shows only within
  `SIGHT_R` (6) tiles of the colony on this device (`colonySees` in js/render.js), so the tap and hover there (js/ui.js)
  should skip one the player can't see; the regional variants (`v=rust|white|bloom` in murmur_moles.js) aren't rendered
  for the game yet; and whether the Murmur's light should show on the minimap at night.

- **AI stalemate: the Hollow, Medium, seed 11** (fixed Nov 19): fully planned roads kept disconnected sites from
  expiring, tying up build slots needed to replace depleted pumps. The AI now retires idle sites in that case.
  Seed 11 finished at 35:29 in the [retest](docs/ai-stalemate-fixes.md).
  With the ground army (Skirmishers, Arc Casters, Railgunners) the same rule flips it the other way: Medium seed 11,
  both Balanced, ends at 32.7 without the rule and runs to 75 minutes with it; giving a site waiting on a planned
  road 8 minutes instead of 4 ends it (27.0) but leaves Medium seed 12 open on main. Medium 12 and Small 21 stay open
  on that ground-army revision either way.
  **Working-branch retest (Nov 20):** the four-minute road rule stays. The Hollow AI now works isolated Ore veins
  when starved, keeps essential Workers at their jobs when a charging trip would gain too little, and can storm
  with a smaller armed force if parts have dried up and its opponent is clearly beaten. All six named Hollow and
  Islands matches finished within an hour. See the [ground-army retest](docs/hollow-ground-army-retest.md) for
  the upstream comparison and every Standard doctrine matchup.
- **Oil seep shimmer timing check:** it measures a full redraw when the seep is on screen. Separate that redraw
  from the shimmer timing.
