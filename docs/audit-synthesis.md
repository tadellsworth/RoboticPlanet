# Terrafall audit synthesis

November 19, 2026. Review handoff for Claude on `codex/working-branch`. Compared the three Gemini reports with the code and test records at `42db3e6`. The original reports are preserved in full. This review used existing test results and a source check.

| Gemini report | Review priority |
| --- | --- |
| [Asset Pipeline & Memory Management](audits/gemini/asset_pipeline_memory_audit.md) | Keep active for startup and long-session memory measurements. Biome loading already works on demand. |
| [Code Architecture & Performance](audits/gemini/code_architecture_performance_audit.md) | Keep as reference. Revisit pathfinding bursts and allocation churn if profiling identifies them. |
| [Combat & Economics](audits/gemini/terrafall_balance_audit_report.md) | Keep active as a playtest agenda. Verify the matchups and economic trade-offs before changing rules. |

## Asset loading and rendering

- **Measured in the branch audit.** With 297 live units and 59 freight jobs in the Huge Crossroads fixture, the two phone-sized Auto samples spent 36.5–39.5 ms at the 95th percentile drawing a frame and 3.7–4.3 ms in simulation. Saver reduced drawing to 4.7–5.0 ms while reducing canvas resolution and effects and capping rendering at 30 FPS. These were short, warmed-up, software-rendered Chromium samples. The result gives a starting point for the frame-rate investigation on actual phones. [Performance audit and timings](late-game-performance-audit.md)
- **Already present.** The renderer loads most biome art when the biome is shown in setup or played. Most Murmur art has its own conditional loader. The packaged build groups assets into core, biome, and Murmur bundles. The regular browser build still schedules core art as individual images. [Renderer and art loaders](../js/render.js) · [Packaged build](../tools/build-single.js)
- **Still open.** Compare time until first input and time until core art is ready in a cold and warm run on a physical phone. Record the request count, transferred bytes, and image decode time. Switch through a fixed sequence of biome previews and matches more than once and see whether memory levels off. A sprite sheet may reduce requests, but the main renderer uses Canvas 2D. The report's WebGL batching argument gives no measured gain for this renderer. Profile frame pacing and asset decode separately before testing packing or changing animation timing.

## Simulation, routing, and allocations

- **Fixed-step simulation and recovery.** The game already advances the simulation at 30 Hz and has a headless runner. Two-client relay tests exercised lockstep recovery, including a Huge snapshot split across frames and a paused rejoin. A large checkpoint cost 5.5–7.5 ms synchronously in the stress sample. That is a reason to measure any proposed per-tick state copy before using it for rendering. [Game loop](../js/main.js) · [Headless runner](../tools/headless-sim.js) · [Reconnect audit](multiplayer-reconnect-audit.md) · [Performance audit](late-game-performance-audit.md)
- **Routing and dispatch.** The branch already checks alternate reachable suppliers, recovers interrupted deliveries, reuses same-tick squad paths, and uses a track-only breadth-first search with cached connectivity for trains. The 24-assignment Hauler benchmark measured median dispatch costs of 3.29 ms for the current dispatcher, 9.16 ms with the capped travel-time estimator, and 40.46 ms with the uncapped estimator. The capped candidate improved delivery time in the controlled congestion and ferry tests. It remains in the benchmark harness. [Routing code](../js/world.js) · [Simulation](../js/sim.js) · [Hauler benchmark](../tools/benchmarks/haul-eta.md)
- **Still open.** Record per-tick route searches and durations when a busy crossing breaks, a large squad gets an order, and an Active Murmur pack changes targets. Look for browser garbage-collection pauses during a long fight. Use those traces to decide if time-slicing, a rail junction graph, a shared flow field, or projectile pooling addresses a measured cost. For any routing change, repeat the freight, Murmur, army order, and multiplayer recovery scenarios so responsiveness and determinism get checked too. [Prior freight and Murmur verification](working-branch-log.md) · [Army order scenarios](../tools/army-pathing-test.cjs)

## Combat and economy hypotheses

The [map fairness audit](map-fairness-audit.md) checked 250 maps, 590 starting colonies, and 12 eight-minute Easy and Hard openings. The [branch log](working-branch-log.md) records the Warbot, Torch, and Bulwark order fixes. Those tests cover access to starting deposits, early AI behavior, and order execution. They leave full-match economic balance and combat outcomes open.

| Topic | Current evidence and suggested playtest |
| --- | --- |
| Crystal shortages | Starting Crystal was reachable in every tested colony. Run a contained midgame on Normal and Scarce resources. Record when local Crystal runs out, what happens to Chips, research and turret ammunition, and which recovery routes the player can afford. Check the next Ringfall and any reachable trade before testing a rules change. |
| Siege and Torch | The Howitzer is disabled. The Torch's nominal fortification damage is 6.4 per second while continuously firing in range. Compare the cost and time to breach a wall and a defended wall with Warbots versus Torches. Count approach losses and Ammo or Fuel resupply before evaluating a Torch change or a Howitzer trial. |
| Shields and air defense | The Bulwark waits 2.5 seconds after a hit before its shield regenerates. Pulse Turret hits every 1.3 seconds keep restarting that timer, so the sustained-fire premise needs correction. Compare realistic pushes against supplied Turrets with and without a Disruptor. For air, test a Vulcan run against supplied Flak and check whether the Flak gets a shot before a direct hit. The 14-armor Missile Silo is a strike launcher with a different role from Flak. |
| Freight cost and population | Compare rail versus road from the first construction order through sustained delivery. Include station costs, track and asphalt, Fuel, road repair, delivery time, and vehicle slots at several distances and volumes. The unit cap is 90 **per player** in Versus and 150 in Colony. Measure how many slots freight occupies on large maps before considering a size-based cap. |
| Fuel cascades | A Fuel Tank's initial blast does up to 7 building damage before falloff. The blast separately schedules loaded Refineries and Tankers in range to explode. Raising Refinery armor alone leaves that chain rule in effect. Compare loaded and empty sites at different setbacks, then decide how much exposure an oil hub should have. |
| Rival personalities | The existing notes record Herald beating Steward in 10 of 12 games and the Architect building no Reactor in 10 Nuclear-race games. They also record an Islands stall caused by Ore depletion. Use paired seeds and different victory rules to test the Architect's economy and actual win rate before considering a production adjustment. |

[Unit, building, and economy rules](../js/defs.js) · [Shield and fuel explosion logic](../js/sim.js) · [Earlier balance observations](../IDEAS.md#suggestions-from-the-november-review-not-decided)

## Other working-branch audits

These reports sit alongside the Gemini review and give context for an overall branch review.

| Audit | Changes and remaining work |
| --- | --- |
| [Multiplayer reconnect](multiplayer-reconnect-audit.md) | The branch fixes large snapshots, paused rejoin, and preserving the seat on Cancel. The report also records open cases for simultaneous reloads, finished matches, offline orders, and the countdown. |
| [Stalled jobs and failed orders](stalled-jobs-audit.md) | The branch reports blocked or partially reachable Warbot moves and improves road and delivery feedback. Staffing guidance still needs follow-up across the job panel and **Call a worker**. |
| [Save and recovery](save-recovery-audit.md) | The branch adds main-menu checkpoint restore and warns about failed **Continue** writes after restore or import. The workflow and verification are in the branch log. |
| [First 15 minutes](first-15-minutes-audit.md) and [phone and desktop controls](controls-audit.md) | Findings include tutorial discovery, first-build and dusk guidance, touch briefing copy, landscape warning priority, and overlapping rally flag and unit taps. |
| [Map fairness and difficulty](map-fairness-audit.md) | Some Small maps lack Trade Posts, and some three-colony Four Isles starts have only one Uplink. These are documented findings from the seeded matrix. |
| [Late-game performance](late-game-performance-audit.md) | Saves the timing data and the reproducible stress fixture's conditions. Physical phones, naturally developed colonies, sea and air freight, and long sessions remain open. |

Suggested review order is a short real-phone pass for cold loading, memory, and frame pacing, then paired Crystal and siege playtests. Keep the architecture changes tied to a measured bottleneck. The [working-branch log](working-branch-log.md) links the earlier commits and scenario coverage.
