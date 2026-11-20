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

## The owner's ideas, filed Nov 19 2026

Roadmap order the owner set: finish the new transit items, **add all the new megastructures and other units, then a
complete game-balance audit** (every unit and building has a defined, useful purpose, nothing over- or underpowered),
and only **then revamp the Missions** (to use the new units) and **then the Main Campaign**. Quick fixes can go any time.

**Quick fixes (small, cheap; do these first when usage is short)**
- **Maglev pods are made only at a Maglev Terminal,** not in the Bot Foundry or any other yard (check the Foundry's order list
  and the Air/Army menus: `BOTS.magpod` must not appear there).
- **No "Pipe to Terminal" button on an Oil Pump with a Refinery right beside it:** the conveyor join to adjacent
  production buildings already feeds it (the button is noise). Show it only when no Refinery or Fuel Tank touches the pump.
- **Tone down the road trucks' smoke and brake noise** (the exhaust puffs on Freight Trucks and Road Trains, and the
  brake squeal in `js/audio.js`): a little quieter and less constant.
- **Dropped goods from a dismantled building go first to Haulers:** crates left by Dismantle are picked up before other
  loose goods (priority in the Hauler's pickup choice, `doLoot`/`lootNear` and the Hauler job order).
- **The main base beacon doesn't go so far up the screen at night:** shorter, dimmer beam (the Command Base's beam in
  `js/daynight.js`/`js/render.js`); it fills too much of the view.
- **Night lights: fewer bugs and less clutter** (the moths, fireflies and lamp insects round lights at night; see
  `js/wildlife.js` `light:` kinds): fewer, smaller, and none on phone/Saver.
- **Change the AI's difficulty mid-game** (a setting on the pause menu; rivals' difficulty is read from `P.diff`;
  lockstep: it must be an order so every device agrees, and a note in a multiplayer game).
- **The Deep spouts more Murmur the nearer it is to death** (the Hollow's mound: raise its exit/pack rate and size as its
  armor falls; `aiMurmur`/the nest code in js/sim.js; a last-stand surge).
- **A rolling autosave to go back to:** the game autosaves every minute after 5 (task #114), but the owner wants a list
  of recent restore points (say the last 5, one a minute) on the pause menu to undo a mistake and try again. Check
  what exists first (`autosave` in js/main.js or js/ui.js) and extend it to keep several slots.

**Maglev follow-ups (medium)**
- **Losing a Terminal doesn't lose the whole line:** today a destroyed Terminal takes the line, its pylons and its pods
  with it (a lot of money in one blow). Instead the line, pylons and pods stay (the pods wait stopped; rebuild the
  Terminal on the same tile and the line resumes), or at least the pylons stay and refund part.
- **Maglev lines can be strung together** (a route of stops): a Terminal may join two lines (a hub), or a line may bend at
  a relay pylon/Terminal, so a route can go round places a straight line can't reach (the owner: pylons can't always go
  where they want). Pods carry on through a hub or change there. See "lines of more than two Terminals" in the Maglev notes.
- **Easier line placement, and pylons over roads:** pylons may stand ON roads (and track), drawn at the side of the road
  so no road has to be taken up and rebuilt; a clearer preview, and nudging a bad pylon spot a tile instead of failing
  the whole line. (Currently a pylon never stands on a road or track: relax that rule; the road stays open.)

**Murmur: a bigger rework (after the megastructures and the audit, before the campaign)**
- **Smarter Murmur:** they sometimes walk straight past robots that then shoot them; fix their threat and target choice
  (avoid or engage, don't ignore armed robots in reach).
- **Late game: an almost unending horde,** growing with the colonies' power (the theme below).
- **A massive endgame unit, a behemoth,** the biggest Murmur form (its own art and abilities).
- **Much smarter, more aggressive planning:** by late game, if you haven't knocked out their tunnels they hunt you and
  sabotage every weak point in your base (the Phase 1+2 "crafty" Murmur is the base to build on).

**Game setup and structure**
- **Megastructures are an enable-able checkbox on game setup,** like Nuclear race (BUILT, Nov 20 2026, with the Lance of
  Corvane and the Shield Dome: the owner chose **on by default**; Custom Game, Observer mode and the multiplayer host's
  settings; missions keep their own; a save from before it loads with them off), so games without them stay as
  now. (Applies to the whole megastructure list; the Maglev and Express highway are ordinary buildings, not gated.)
- **A truly global map, a size above Huge,** for those who want an enormous battle, maybe with TWO biomes in it that slowly
  crossfade into each other across the map (a new map type; mind generation time and the 16 MB-free bundle design).

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
      0.00, Torches −0.20, a mix of all −0.23. Open: is a pure mass of Railgunners too strong against a Bulwark-heavy
      blob (+0.74 is more than a soft counter)? Mixed armies come out a little behind pure ones in these brawls.
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
    have the Grove Planter to regrow their groves.)
  - **The Research Lab in Versus too,** with economy research beside today's: Diamond Blades (every gatherer 25%
    faster), Seam Survey (fields hold 30% more), Automation (factories need no Worker inside, freeing Workers to build).
  - **Automated Harvesters.** A Mk III (or a research) where a Harvester runs on its own, a small drone cutting in place
    of a Worker: Workers saved in a big late colony.
- **Megastructures** (the owner, Nov 17 2026: saved for later). Late-game, one per colony, slow to build and seen by
  everyone, so rivals can race or raid them. The owner's order (Nov 18), after the high-speed transit items: the Ring
  Breaker, the Sunlance, the Great Uplink, Arrival City, the Lance of Corvane and the Shield Dome; the Seismic Lance,
  the Orbital Lift, the Atmosphere Engine and the power plant perhaps later.
  - **Ring Breaker** (weapon). A tether-and-thruster station that pulls fragments out of the Ring and drops them where
    you choose: Ringfall on demand. Every few minutes a strike craters the area and leaves rich Ore or Crystal behind,
    so it is a weapon and a mine at once; slow to aim, so the target gets warning. Lore: the colony doing to Ithaca what
    the Sponsors did to Earth.
  - **Sunlance** (weapon). A field of mirrors focuses Corvane's light into a beam that sweeps a target, burning
    buildings in a line. By day only; useless in a dust storm, and a solar flare overloads and damages it. Night leaves
    you open, in step with the Murmur.
  - **Seismic Lance** (weapon). A deep drill hammering shockwaves into the ground: aimed at the Murmur it collapses
    tunnel networks map-wide and shakes nests; aimed at a rival it cracks roads and foundations in a radius. The Murmur
    hear it, and come for it.
  - **Great Uplink.** A giant dish array to talk to home, and a new way to win: power it and hold it through a long
    transmission window to "make contact", while rivals try to wreck or jam it. Ties into the campaign's last mission
    ("No further instructions"); in free play a last-stage victory, with a lore twist on what answers.
  - **Arrival City.** An arcology built for the colonists: homes, parks, a school, all lit and empty. Production round
    it goes up (the robots work harder for Arrival), and its land counts double for Domination. At night, a whole lit
    city for no one.
  - **Orbital Lift.** A space elevator to the colony's Carrier: bring down its last reserves on demand (robots, Alloy,
    Chips) and send goods up. Vastly dear; if it falls, the cable comes down across the map in a long line of wreckage.
  - **Atmosphere Engine.** A terraforming tower that slowly changes the land round it: no more dust storms in its
    region, barren ground turned fertile (Bio Farms anywhere near), the Bloom pushed back. Finishing the Pathfinder's
    work; the Murmur hate it and go for it.
  - **The Lance of Corvane: BUILT, Nov 20 2026** (README, "Megastructures"; How to play, Megastructures; the War mission
    *Aimed the Other Way*). The owner's look A (a 3 × 3 gun pit, a long barrel on a turntable), the beam across the whole
    map, killing robots of every side too, 2 Generators or a Reactor, 90 s charge, 4 min reload, allowed on Argos; the
    rival AI builds it late in a Nuclear race and chooses between it and the nukes (`aiMegaPick`). Still open: power lines
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
    pier), only chasms and rock are spanned. Open: the rival (below), riders (a Worker crew only, if ever), a line of
    more than two Terminals, Flak at pods (they are not aircraft: nothing shoots a pod but the pylon under it), and
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
    arrows (below) so a lane's arrow fits its markings. **To do: a tutorial mission** in the Roads chapter ("Arterial":
    a Roadworks, an Express pair of 12+ tiles, a Road Train on it, N goods moved), with hints naming Paths → Express
    (Shift+E) and the Roadworks; the How to play section and the tool exist, the mission does not.
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
  under a pylon). Also open from the build: riders (a Worker crew at most, never warbots), lines of more than two
  Terminals, and a hand-driven pod.

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
  - **Grand Canyon** (the owner's idea, Nov 2026). Two high rims, a colony on each, with a deep gorge between them and a
    river along its floor, the walls cut into layered terraces and crossed by side canyons. Unlike Rift or Canyon maze,
    the middle is the richest ground (Crystal and Ore exposed in the rock layers, water, easy road building) but it is
    overlooked from both rims: guns and Howitzers on the edge rule the floor, so whoever holds the rim holds the
    canyon. A few switchback trails (Ramps) down each wall, narrow points for Viaducts, Ropeways, and Ports on the river
    for ships. Side canyons from the edges to the floor let a rival flank round a blocked trail. The question it asks:
    hold the rim and snipe, or take the floor and gamble? Lore: the Ring's biggest strikes cracked the crust.
  - **The Spine:** a mountain range down the middle with three crossings of different character: a wide, easy pass, a
    narrow high pass that can be walled off, and a tunnel through the rock (the game's tunnels). The far side is
    richer. Clean chokepoint warfare, each crossing suiting a different plan; the easiest of these to build.
  - **The Dam:** a high valley lake held back by a dam above a low valley with a colony in it. Wreck the dam and the lake
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

- **AI stalemate: the Hollow, Medium, seed 11** (found Nov 19 2026 merging the codex branch and Express highways): a
  computer-against-computer game there passes on the codex branch with the rival AI fixes but runs past 45 minutes once
  the Express highway code is in, though rivals never build Express lanes; these single-seed AI games flip with almost
  any change. Look at it with the other stalemates (Hollow Small seed 25, Islands). Also: the oil seep shimmer timing
  check measures a full redraw when the seep is on screen (it passes only when it isn't): rewrite that test's timing.
