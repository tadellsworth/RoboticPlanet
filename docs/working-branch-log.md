# Robotic Planet working branch log

This log covers the chat that started November 18, 2026, with a GitHub access check. Work from the chat is saved on `codex/working-branch` for review before any integration into `main`. Add dated entries as work is completed, with commit links, verification, and any open follow-up.

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
