# Robotic Planet working branch log

This log covers the chat that started November 18, 2026, with a GitHub access check. Work from the chat is saved on `codex/working-branch` for review before any integration into `main`. Add dated entries as work is completed, with commit links, verification, and any open follow-up.

## Session summary

- **Transport and logistics.** Made Maglev lines recoverable after terminal loss, kept pods at terminals, enabled road-sharing pylons and transfers between lines, prioritized dismantle crates, and audited freight, Worker assignments, and military movement. Added the Arterial Express tutorial and tightened unit recycling and refunds. See [gameplay fixes](#maglev-recovery-and-gameplay-fixes), [freight assignments](#freight-and-worker-assignments), and [Arterial](#arterial-express-tutorial).
- **Biomes and presentation.** Added geothermal and tropical scenery, naval wildlife, waves, animated lava, and more varied land animals that move away from development. Reduced truck effects and night-light clutter. Generated radio dialogue was disabled in play. See [scenery](#new-biomes-and-scenery), [wildlife](#wildlife-and-concept-art), and [night lighting](#freight-salvage-and-night-lighting).
- **Rival and Murmur behavior.** Improved Murmur sabotage and ambush tactics, scaled the Deep's waves with damage, addressed seeded AI stalls and naval crossings, improved 2v2 support and fairness, and taught rivals to mine Ring drizzle deposits. See [seeded fixes](ai-stalemate-fixes.md), [Hollow retest](hollow-ground-army-retest.md), and [drizzle results](#rival-mining-of-ring-drizzle).
- **Saves, multiplayer, and controls.** Added solo restore points and host-controlled midgame rival difficulty. Audited reconnects, stalled orders, save recovery, opening usability, input, and late-game performance. See [audit synthesis](audit-synthesis.md) and [pause and restore changes](#pause-menu-the-deep-and-restore-points).
- **Maps.** Added Immense and the two-colony Planetary size, both with optional 65/35 mixed biomes. Reworked Grand Canyon with fertile basins, river islands, and two single-lane natural descents per rim. See [size and compatibility results](immense-validation.md) and [Grand Canyon](#grand-canyon-river-basins).

## November 18, 2026

### Repository and workflow

- Verified read and push access to RoboticPlanet and created `codex/working-branch` from `main` at `f9689e4`. Discussed how branches, commits, pushes, and review work. The owner reserved any eventual merge to `main` for a separate review.
- Discussed accessing this local desktop chat from a phone, how that differs from a cloud task, and approval settings for unattended work.

### Maglev, recovery, and gameplay fixes

- A completed Maglev line keeps its guideway and pylons if one terminal is destroyed. The surviving end can rebuild the missing terminal. Adjacent terminals on separate lines can transfer freight by conveyor. Pylons can shift around obstructions and share road or track tiles, with their feet drawn to the side. Pods are built at Maglev Terminals.
- Single-player games retain up to five checkpoints at one-minute in-game intervals, with restore available from the pause or defeat screen. Custom games allow changes to rival AI difficulty from the pause menu. The host controls it in multiplayer.
- On the Hollow, The Deep sends larger packs more often as its armor falls. Idle Haulers prioritize dismantled-building crates. Oil pumps hide the pipe shortcut when an adjacent refinery or fuel tank already receives crude by conveyor.
- Reduced truck smoke, truck brake noise, insects around night lights, and the height of the Command Base beacon. Added synthesized Command radio with translated captions at landing and every eight game minutes. See the November 19 entry for its current status.
- Simulation and phone-sized browser checks covered Maglev operation through terminal loss and rebuilding, pod production, adjacent crude delivery, AI difficulty, and checkpoint restore after defeat. Live multiplayer was left for a playtest.

[Gameplay fixes and checkpoints commit](https://github.com/tadellsworth/RoboticPlanet/commit/24bf853051d938d600379e8d291942028ddae953)

### New biomes and scenery

- **Boiling Springs** adds turquoise and amber mineral pools, sulfur-stained limestone terraces, steam, and erupting geysers. The map preset still controls crossings and resources. Checked both browser builds, save and reload, and repeatability from the same seed. [Boiling Springs commit](https://github.com/tadellsworth/RoboticPlanet/commit/ef15ce65dcb7819b8cd0906e9bca6585601ddf6a)
- **Tropical** is selectable on naval maps and has coconut palms, coral beaches, turquoise reefs, and seagulls. Open water has gentle waves, including lakes. Naval maps also have leaping fish, dolphins, and occasional whale spouts. Volcano maps and Cinderlands have animated lava highlights and steaming vents. Checked the picker and effects in both browser builds. [Tropical, water, and lava commit](https://github.com/tadellsworth/RoboticPlanet/commit/303f9fa667ef051008cdb5d111b258da4bfff545)

### Wildlife and concept art

- Gave all 11 inhabited biomes at least two ground species and a moving bird or native flier. Blackwater has alligators and turtles. The Bloom gained three native creatures. Deer and wildebeest have distinct, more natural silhouettes and gaits.
- Roads, railways, and construction displace nearby animals. This supports the story of development and war disturbing local habitats. Working industry can feed up to two extra Scuttlers per pack on Active from night two, within the existing population cap. Browser and simulation checks covered the species roster, movement, displacement, and responses to war. [Wildlife commit](https://github.com/tadellsworth/RoboticPlanet/commit/36d7939dc6875c1c4f183712458cde1cd8c50476)
- Shared in-game previews of Boiling Springs, Tropical coasts, lava vents, and wildlife in the chat. Reviewed the megastructure ideas in [IDEAS.md](../IDEAS.md) and shared `megastructure-concepts.png` with concept art for the **Great Uplink**, **Arrival City**, and **Shield Dome**. The concepts are awaiting art review before game integration.

### Murmur tactics review

- Reproduced three problems in isolated simulations. A failed route could count as arriving at a rally point, waiting Brutes could abandon the raid for a passing Worker, and a stationary defender could count as having fallen for a feint. Proposed physical rally checks, sabotage aimed at consequential infrastructure, and feints that depend on defenders actually moving.
- Also proposed a separate freight-road ambush for possible later testing.

## November 19, 2026

### Active Murmur raids

- Packs check their route, wait for enough creatures to physically reach the rally, and try another approach or withdraw if the route closes.
- Cutters choose power infrastructure whose loss would disrupt the target. The pack holds during the sabotage window, and Brutes stay focused on the assigned building.
- A feint can trigger an early strike if a defender moves away from the real target and nobody replaces them.
- Targeted simulations covered the three improvements, save compatibility, and Quiet raids. Full nights ran in Colony, the Hollow, and the Murmur tutorial.

[Active Murmur commit](https://github.com/tadellsworth/RoboticPlanet/commit/ecd246ddc0aa92dd6e213b1a67b0f8ebb7251e30)

### Freight and Worker assignments

- Audited pickups, deliveries, work assignments, and routing by road, rail, water, and air. Dispatch looks at other suppliers when the closest supplier has no carrier that can complete the trip. **Call a worker** checks that the Worker can reach the job.
- Interrupted trips release their reservations. Loaded carriers look for reachable storage or hold their cargo. Trains recheck broken track for detours. Low-charge vehicles can keep working slowly if the available charger is unreachable.
- Haulers can collect the dry goods from a dismantling crate while its liquid cargo waits for a Tanker. Supply drops use Airfields with Cargo Planes, and Airships recalculate how much Fuel they can carry after refuelling.
- Targeted simulations checked alternate suppliers, cargo conservation, rail and ferry interruptions, separate port basins, loading and refuelling, and Worker routing. A 12-minute simulated match completed.

[Freight dispatch commit](https://github.com/tadellsworth/RoboticPlanet/commit/a815e7c154640942708966184cb1ab539e481f90)

### Hauler trip-time benchmark

- Compared supplier ranking by distance with estimates that account for driving time, congestion, and ferry waits. Saved the harness, report, and 280 trial records. The strongest candidate checked traffic at dispatch and capped extra route searches.
- In the controlled tests, the candidate cut median delivery time for 12 Ore from 55.4 to 35.0 game seconds in heavy traffic and from 81.4 to 39.7 in an avoidable ferry crossing. Clear-road delivery tied at 27.0 seconds. A burst of 24 assignments took a median 9.16 ms with the cap, 40.46 ms with the uncapped estimator, and 3.29 ms with the current dispatcher.
- The estimator runs in the benchmark harness. A crowded-colony playtest with mixed vehicles is pending before deciding whether to use it in the game.

[Benchmark commit](https://github.com/tadellsworth/RoboticPlanet/commit/bf94cab826420b8490958c9c81e694a88943007e) · [Report](../tools/benchmarks/haul-eta.md) · [Trial records](../tools/benchmarks/haul-eta-results.csv)

### Command radio and military movement

- Disabled the generated Command radio voice and translated captions in-game. The toggle can restore both later. Checked that the opening and recurring transmission triggers stay silent. [Radio commit](https://github.com/tadellsworth/RoboticPlanet/commit/51716c405911be8772cf94cba0901a76830ebed3)
- Warbots and Torches favor immediate, shootable threats, keep their facing when blocked, and try short reachable moves under an active Bulwark shield when they can stay in firing range. Torches only spend Fuel on targets they can hit. Automatic repairs respect active combat and explicit marches. Reload trips preserve their destination and follow-up orders.
- [Nine automated combat scenarios](../tools/army-pathing-test.cjs) passed. Twelve-minute headless simulations completed on Standard and Grand Canyon. Grand Canyon's implementation and map tests are documented in the [separate map handoff](codex-grand-canyon-handoff.md).

[Military movement commit](https://github.com/tadellsworth/RoboticPlanet/commit/9107b7421af9763dc3c91dd6fd0a7c6d98ed2b37)

### General audit review

- Reviewed the existing simulation, browser smoke, help, and save service checks. Found that the README's Saving section still says 20 seconds, while the game and the quick-start section use one-minute checkpoints.
- Recommended auditing save and recovery first, then whether players can diagnose stalled work. Other candidates are first-session onboarding, phone and desktop controls, map and difficulty checks, late-game performance, and multiplayer reconnects. These are proposed audits.

### Multiplayer reconnect audit

- Tested two browser clients against the local relay. Short socket interruptions, host and guest computer takeovers, and reloading into a running match on the default map recovered. Compared stocks, in-flight cargo, pending order execution, and Uplink progress at the same game ticks.
- Reproduced a Huge-map snapshot failure that can stop the match, reloads that wait on paused or finished games, the loss of the saved seat after **Cancel**, both clients waiting after simultaneous reloads, a silently discarded offline order, and a host-disconnect countdown that reaches zero early.
- Recorded reproduction steps, recommended fixes, and remaining coverage in the [multiplayer reconnect audit](multiplayer-reconnect-audit.md).

### Stalled jobs and failed orders audit

- Exercised factory diagnostics, freight dispatch, worker assignment, Fuel guidance, and map commands in local Chromium. Reproduced misleading delivery predictions for isolated Haulers, contradictory road and delivery messages, missing or incorrect staffing guidance, and a success message for an unreachable Warbot move.
- Recorded the positive controls, reproduction steps, and proposed fixes in the [stalled jobs and failed orders audit](stalled-jobs-audit.md).

### Huge-map reconnect fix

- The sender now splits a large snapshot once and passes each framed piece directly to the existing socket queue. Added a regression check for the size boundary, escaped characters, queued frames, and reassembly.
- A guest reloaded and rejoined a Huge match on the local relay. Both clients agreed on inventory, cargo, a pending order, and Uplink progress after the two-piece snapshot.

### Save and recovery audit

- Restored the one-minute checkpoint from the Defeat screen while a Hauler carried Ore, a Worker was building, and a Warbot was moving. All three jobs resumed and matched uninterrupted play. Also imported a save generated by the original base revision and checked **Continue** after reloading.
- Reproduced two gaps. Reloading after defeat hides access to the stored checkpoints. Loading a save with blocked browser storage can announce success while keeping the previous **Continue** save.
- Corrected the README's autosave cadence and recorded the evidence and proposed fixes in the [save and recovery audit](save-recovery-audit.md).

### Save recovery fixes

- Added **Restore checkpoint** to the main menu when recent solo checkpoints exist. It names the planet and asks before restoring. The menu reads the existing IndexedDB history, so checkpoints already stored before this fix can be recovered after refreshing the Defeat screen.
- Imports and checkpoint restores now warn when the loaded game is playable and the browser could not update **Continue**. The warning and pause menu point to **Save → File**.
- Phone-sized Chromium checks covered cancel and confirm after defeat and reload, in-progress jobs, blocked browser writes, older file import, and **Continue**. Updated the in-game help, illustrated guide, and README.

### Order feedback and paused multiplayer recovery

- Direct ground orders now warn when armed Warbots have no route and report the reachable part of a split squad. **Why idle?** identifies isolated road carriers, avoids promising an unassigned delivery, and shows disconnection ahead of a delivery reservation. Verified both original cases and their reachable controls in Chromium.
- A reloaded multiplayer client can receive the current snapshot while the match stays paused. Cancel preserves the player's seat for a later retry. Two browsers against the local relay verified the frozen tick, the queued order after resuming, and a successful retry with the original seat.

### First 15 minutes audit

- Completed **Touchdown** with touch controls and ran a Standard Colony through 15 game minutes with Active Murmur. Both openings got Fiber from field to base after fixing an unconnected placement.
- Recorded where fresh players can miss the tutorial, where freeform landing and dusk could give a clearer next step, and where the touch briefing still shows keyboard-only directions. [First 15 minutes audit](first-15-minutes-audit.md)

### Phone and desktop controls audit

- Checked mouse, keyboard, and emulated touch drawing, zooming, selection, and undo at five viewport sizes. Reproduced warning replacement on phones in landscape and a first tap that opens a rally flag where it overlaps a Warbot. [Controls audit](controls-audit.md)

### Map fairness and difficulty audit

- Scanned 250 seeded maps across every preset and paired 12 Easy and Hard openings. All tested starts had the four basic deposits on connected terrain, and all naval starts had a potential reachable shore. Some Small maps had no Trade Posts, and four three-colony Four Isles cases placed only one Uplink. [Map fairness audit](map-fairness-audit.md)

### Late-game performance audit

- Profiled 14 browser samples with 297 live units, road and rail freight, combat, and a checkpoint write per sample. In the phone-sized stress run, Auto had 19 frame gaps over 50 ms across two repeats. Saver had none, and both kept the intended simulation pace. [Performance audit](late-game-performance-audit.md)

### Gemini and Codex audit synthesis

- Saved the three original Gemini reports under `docs/audits/gemini/` and compared them with the current game rules and prior branch tests. The [combined audit handoff](audit-synthesis.md) links the evidence, corrects outdated premises, and lists the startup, memory, combat, and economy checks that remain for review.

### Two-rival late-game stalemate audit

- Ran 16 seeded AI matches. All ten Standard matches finished, including two with no water. Chokepoint Wardens kept making some goods after Warbot and trade counts flattened from minute 42 to 45, then one side won before minute 48.
- On Islands seed 21, both AIs could afford a replacement Mine and still had Ore deposits, but their placement rule required two deposits near one candidate. An isolated experiment allowing one deposit from minute 45 restored Alloy and military production. The match still lacked ferries and was open at minute 55. On Islands seed 17, the leader's Foundry idled while saving for a crossing. Recorded the baselines and experiment in the [late-game stalemate audit](ai-stalemate-audit.md).

### Seeded stalemate and fairness fixes

- Updated `codex/working-branch` to `d56b30e` before fixing the seeded AI stalls. Hollow Medium seed 11 finished at 35:29 after the AI learned to retire disconnected sites waiting indefinitely for planned roads. [Tests and rationale](ai-stalemate-fixes.md)
- Restricted the smaller finishing storm to bases with light gun cover. Reproduced the undersized storms on the earlier revision. The current Hollow Small seed 25 retained its Colony 2 win at 24:04. [Tests and rationale](ai-stalemate-fixes.md#2-hollow-small-seed-25)
- Restored isolated Ore mining and prioritized the first naval crossing for Ore-poor island colonies. Islands Medium seed 21 finished in 20:53 after four landings. Seeds 2, 5 and 17 kept their finish times and winners. [Tests and rationale](ai-stalemate-fixes.md#3-islands-crossings)
- Removed attacks aimed at allies, added AI defense for allied territory, rotated 2v2 turn priority, and balanced neutral Trade Post access across 60 starts. In 12 paired games Team 1 wins moved from 9 to 6. [Tests and rationale](ai-stalemate-fixes.md#4-2v2-fairness)

### Mission text and curriculum

- Shortened six goal hints, preserved Harbour and Airlift's step-by-step highlights, and moved King of the Hill into War before Final Descent. The mission data check covers the 110-character limit, building targets, affected controls, and saved mission IDs.


### Freight, salvage, and night lighting

- Restricted Cargo Plane freight to a finished, owned Trade Terminal. Old or interrupted drops cannot spawn freight on open ground. Airlift now teaches a Worker parachute drop in its final goal.
- Hid redundant Oil Pump pipe shortcuts beside a Refinery or Fuel Tank and when the route was already planned.
- Softened road-vehicle exhaust, brake lights, and air brakes. Exhaust tops out at 48 active puffs and the air-brake audio has a global 1.8-second gap.
- Gave idle Haulers first call on their colony’s dismantled crates, with idle Workers handling reachable leftovers after their regular tasks.
- Reduced the Command Base beacon’s height limit from 33% to 16% of the view. Always day still uses the illuminated mast without a sky beam.
- Checked the night rendering of the building and vehicle catalog. Centered multi-tile light pools, drew Mass Driver coil effects at building depth, tightened darkness and destruction checks, and added local structure, vehicle, and gantry markers.

### Pause menu, the Deep, and restore points

- **Rival difficulty** applies to every computer rival in a custom game and shows a toast. Multiplayer checks the host's player seat when the order runs, including when two people share a colony or the host changes. Verified that both peers reached the same simulation hash, non-host orders were rejected, and a disconnected player's colony was left alone.
- The Deep's local packs escalate below 75%, two-thirds, and one-third armor. Its pulse strengthens and its rumble drops in pitch with each tier. All five Hollow matches ended before and after the change. Medium 11, 12 and 25 finished with identical results. Small 21 finished 23 seconds sooner with the same winner and Small 25 finished at 40:26 with the opposite winner. [Match results](deep-surge-retest.md)
- Solo games keep up to five minute-by-minute restore points in browser storage. The menu labels them by age, asks for confirmation, and hides them in multiplayer. **Continue** still opens older single autosaves. Chromium play confirmed the difficulty toast, restore confirmation and cancellation, quota trimming, and legacy Continue.
- Updated the README, in-game help, and illustrated guide for each feature. The existing mission goals still cover their authored challenges.


### Hollow ground-army stalemates

- Compared the ground-army revisions with the current working branch. The traces found depleted local Ore, trips for too little Fuel to help production, and a march minimum that could keep a smaller winning army at home.
- Hollow rivals can mine a lone accessible Ore vein, keep key Workers on the job when useful charge is unavailable, and launch a smaller final push when the force can beat the defenders. The four-minute road-site release remains in effect.
- All six named Hollow and Islands games finished within an hour. The report records the times and winners and the Normal Standard seed 11 comparison for every ordered pair of doctrines. [Ground-army retest](hollow-ground-army-retest.md)
- The Standard matrix exposed an Architect trying to launch a warhead from its Command Base while under siege. The AI now requires a ready Missile Silo for that order. All 25 Standard matchups finished after the fix.

### Unit recycling and spare Workers

- Synced the upstream Arrival City changes and kept both its lighting and the working branch's night-light fixes.
- Recycle orders choose the nearest Foundry the unit can reach. Refunds still go into the Foundry and are available for production, spending or pickup. Maglev Pods use their guides and are excluded from the recycle action.
- Rivals wait for genuinely idle Workers and keep their staffing and builder reserve. Starting a recycle order releases the old job, freight reservations, and any Ammo delivery or convoy escort assigned to that unit.
- Added `tools/recycle-test.js` for ownership, routing, refunds, AI limits, job cleanup, exact timing, save continuation and lockstep. Help coverage, mission data and lint passed. A Chromium game verified the button, cancellation and refund.

### Arterial Express tutorial

- Added Arterial after Blacktop in Roads and Traffic. The colony has a stocked Roadworks, a Paver, a Freight Truck, and a survey Depot. The goals mark a 16-tile Express pair, connect both side ramps, surface the lanes, and complete 2, 3, or 4 Freight Truck deliveries by difficulty.
- The delivery goal counts actual loaded travel along Express. The headless Hard run also verified that an earlier delivery along the ordinary service road earns no credit.
- Played Normal in Chromium from the mission picker and briefing through the recorded campaign victory. Verified the sign gantry and the three qualifying deliveries. The mission data, help coverage and lint checks passed.

### Immense maps

- Added Immense to Custom Game and the shared size preset used by Observer and multiplayer. Standard is 84×118. Existing shape and seat limits still apply.
- Scaled Ringfall and the Hollow's nests and reserves. Added more Oases resource sites, larger Four Isles land pads, and paired fallback Trade Posts on two-player island maps. The whole-map canvas uses a smaller backing buffer on the largest layouts while close views still use HD chunks.
- Allowed more travel time before rivals recall long marches. Verified all 117 sampled layouts, saved planets, and save/load and split-snapshot multiplayer rejoin. [Performance and match results](immense-validation.md)

### Rival mining of Ring drizzle

- Outposts score scarce neutral drops they can claim. Ore Mines and Crystal Taps score unworked deposits they can reach on foot and accept a single surviving tile. Site affordability, roads and enemy fire still constrain placement.
- Tested 12 paired Medium, Normal Versus games with two balanced rivals, a 60-minute cap, the Murmur and Planetary events off, and the Ring drizzle on. The benchmark counted only units removed by gatherers from tagged drizzle tiles.
- Ore mined rose from 38/810 landed to 158/960, and Crystal rose from 46/288 to 108/336. Mean duration went from 22:36 to 22:56, including each capped game at 60 minutes. Undecided games stayed at 1/12.

| Map | Seed | Before | After | Drizzle Ore | Drizzle Crystal |
| --- | ---: | --- | --- | ---: | ---: |
| Long haul | 11 | 28:09, Colony 2 | 28:09, Colony 2 | 0 → 0 | 3 → 3 |
| Long haul | 21 | 13:10, Colony 2 | 13:10, Colony 2 | 0 → 0 | 0 → 0 |
| Long haul | 25 | 60:00, undecided | 60:00, undecided | 34 → 30 | 35 → 59 |
| Long haul | 37 | 38:51, Colony 1 | 26:24, Colony 1 | 0 → 15 | 8 → 0 |
| Lakes | 11 | 15:00, Colony 1 | 15:00, Colony 1 | 0 → 0 | 0 → 0 |
| Lakes | 21 | 17:15, Colony 1 | 17:15, Colony 1 | 0 → 0 | 0 → 0 |
| Lakes | 25 | 13:52, Colony 2 | 13:52, Colony 2 | 4 → 4 | 0 → 0 |
| Lakes | 37 | 12:51, Colony 1 | 12:51, Colony 1 | 0 → 0 | 0 → 0 |
| Standard | 11 | 16:46, Colony 2 | 16:46, Colony 2 | 0 → 0 | 0 → 0 |
| Standard | 21 | 19:23, Colony 1 | 34:29, Colony 1 | 0 → 79 | 0 → 46 |
| Standard | 25 | 17:34, Colony 1 | 19:11, Colony 1 | 0 → 30 | 0 → 0 |
| Standard | 37 | 18:20, Colony 1 | 18:05, Colony 1 | 0 → 0 | 0 → 0 |

### Optional second biome on Immense

- Added the Second biome control to Custom Game and Observer setup, including multiplayer host settings. Single-biome play is the default. A seeded transition blends terrain, mixes plant varieties and appears on the planet preview and minimap.
- Checked selection, play, save and reload, and Saved planets in Chromium. The automated Immense check covers mixed-biome save validation and multiplayer fingerprints.
- Set new mixed-biome planets to about 65% primary and 35% secondary land, measured at the midpoint of the transition. Saved the boundary with the game so terrain changes cannot shift it.
- Compared current Standard Immense with temporary 112×156 and 120×168 two-player maps. [Size probe results](immense-validation.md#optional-second-biome-and-two-player-size-probes)

### Planetary maps

- Added Planetary for solo and two-colony games in Custom Game and Observer, including multiplayer host settings. Standard is 120×168 and other shapes preserve their proportions within the same tile budget. For three or four colonies the largest available size is Immense.
- Carried over the optional 65/35 mixed-biome setup, with the primary biome setting weather. Validated compatible map layouts, saves, Saved planets and multiplayer snapshot rejoin. [Planetary release checks](immense-validation.md#planetary-release-checks)

### Grand Canyon river basins

- Reworked the gorge into alternating narrow passages and broader river basins. The river branches around two fertile islands, with meadows on the banks and rocky outcrops on the higher shelves.
- Tested 126 layouts across the six sizes and three terrain settings. Both rims have access by ramps and fords, and ships have a continuous river. Verified the map through Custom Game in Chromium.
- Narrowed the two natural descents on each rim to one ramp per terrace. The switchback and side-canyon trail each work with the other closed. Kept a continuous footpath along the banks where the wide bends meet the narrows. The committed regression test covers 126 layouts, and a second 576-layout sweep also passed.

### Keyboard shortcut sheet

- Added the in-game shortcut sheet on `/` and **Keys** in the pause menu. Kept `?` on **How to play**. The sheet draws its map, Build, Paths and panel entries from the live bindings and pauses only single-player games.
- Updated the first mission briefing, in-game help, README and Field Manual, and marked the polish item complete in IDEAS.
- Verified binding coverage and exercised the live keyboard dispatcher in Chromium. Checked 1366×768 and ultrawide layouts, the touch pause menu, solo pause and resume, and that a loopback multiplayer session kept advancing without sending a pause order. Help coverage, mission data, lint and the single-file build passed.

### Map symmetry

- Fixed neutral site placement and Trade Post deposit relocation on Long Haul 2v2, Crossroads and the other exact-symmetry Versus layouts. Placement now works in complete sets of corresponding tiles. A cramped layout can still have one shared neutral site, such as the central relay on Four Isles.
- Superseded when merged with the Trade Post clearing fix: the posts and Uplinks keep their original placement (Long Haul 2v2's centre post and half-turn pairs, the middle Uplink), and only the clearing keeps the symmetry, moving each deposit with its twins (`clearCalmGround`). The site checks in the map test follow those layouts.
- Added a map regression test for every supported size and player count. It checks deterministic rebuilds, mixed biomes and Ring drizzle on the target maps, and accounts for the deliberately richer spare corner on three-player quarter maps.

### Bison, deer and wildebeest redraws

- Gave Steamwells bison, the forest deer and Long Grass wildebeest distinct anatomy, walk and run cycles, and grazing poses. Refined the deer's grazing neck after reviewing the enlarged comparison.
- Checked head-up and grazing poses and the herd silhouettes at game scale in Chromium. Updated the art guide and README.

### Blackwater and Bloom wildlife redraws

- Gave Blackwater alligators a broad snout, raised scutes, articulated feet and a flexing tail.
- Redrew the Bloom’s hinge-back, switchtail and sailwing around shared plum plates and amber eyes. Each has a distinct gait or flight silhouette.
- Checked the new renderers in Blackwater, the Bloom and the Hollow in Chromium. Verified the sailwing’s shadow and compared the before and after art at game scale.

### Shoals crabs and Hollow wildlife

- Added red shore crabs with pincers and a sideways walk. Small groups stick to open ground along the Shoals’ beaches.
- Redrew the Hollow’s blind crawler and gave its cave sailwing a dedicated model. The Hollow still uses the existing hinge-back.
- Verified crabs spawning and moving along a generated Shoals beach in Chromium. Checked the Hollow sprites at game scale and the cave sailwing’s shadow.

### Foxes, geese, turtles and Cinderlands insects

- Redrew red and Arctic foxes with distinct ear, muzzle and coat proportions. Updated geese on the water and in migrating flocks, and gave turtles a domed shell with distinct scutes and rim.
- Redrew the ember moth with patterned forewings and hindwings, and the ash beetle with six articulated legs and a warm seam between its wing cases.
- Verified the renderers and goose flight shadow in Chromium. Captured comparisons at close-up and game scale.

### Heron, owl and lizard redraws

- Redrew the Blackwater heron’s wading, fishing and flight poses. Distinguished the woodland owl’s ear tufts from the snowy owl’s round head and kept eyeshine aligned with the face as each turns.
- Gave the rock lizard jointed legs, splayed feet and a tapering tail that flexes while it darts.
- Checked the before-and-after poses at game scale in Chromium, including bird shadows and the owl head turn.

### Dolphin, gull and hare redraws

- Redrew dolphin breaches with a continuous pitch, a flexing tail and a splash fixed at reentry.
- Gave gulls distinctive flight, landing and standing poses. Redrew hares with a crouch-to-bound motion and separate dry-biome and Polar Caps coats.
- Verified the marine scheduler and game-scale artwork in Chromium, including dolphin launch and entry phases and the gull shadow.

### Dusk bat redraw

- Replaced the dusk bat’s generic flight shape with jointed wing membranes, a tail web and a distinct head. Gave each bat its own turn rhythm and linked its wing asymmetry to the bank angle.
- Verified on a generated Rust map in Chromium with dusk lighting, including natural spawning, finite motion and game-scale rendering.

### Hawks, vultures, crows and ravens

- Replaced the shared bird silhouette with distinct wing and tail profiles, including a hawk’s rusty fan, fingered vulture wings, a crow’s fan tail and a raven’s wedge tail. Each uses its own flap and glide cadence. Updated the perched crow too.
- Verified the flight and shadow silhouettes in Chromium and made before-and-after views at close-up and game scale.

## November 25, 2026

- Synced the working branch from main at `f7f35be`. Knocked-out megastructures now show the seize warning without repeated attack alerts while enemies hold them. **Wreck it** attacks continue to warn. [Alert fix](https://github.com/tadellsworth/RoboticPlanet/commit/875813e36cfc06d6ca6c6551da368aeb344343f8)
- Rival Maglev raids prefer a reachable pylon in the middle third of a long line. In the headless test the band cut the line, left both Terminals standing, and came home. [Maglev fix](https://github.com/tadellsworth/RoboticPlanet/commit/6f60ba4a2bc2e7ee823e821ed223bb037ffe512b)
- Rivals plan roads to seized megastructures and prioritize their commissioning fees. In the headless test a rival connected a seized Lance, delivered its goods and brought it online. [Recommissioning fix](https://github.com/tadellsworth/RoboticPlanet/commit/a39b0b54eeb292d133349e3d4cdd0b8d75302a74)
- Drop Outpost and deployed Crawler panels now fit without vertical scrolling at 1440×900 in the desktop Command Deck layout. The browser measured 5 px of overflow before and 0 px after. [Panel fix](https://github.com/tadellsworth/RoboticPlanet/commit/572588d07f8fc8a7b3bc16cf12ab09397345e1bd)
- The Workforce audit found identical counts in nine seeded two-colony games across all three revisions, for 584 completed builds on each revision. [Seed-by-seed staffing results](workforce-ai-audit.md)
- Verified with the megastructure, transit, Workforce, Workforce lockstep, help, mission data and lint checks, and built the single-file game.
