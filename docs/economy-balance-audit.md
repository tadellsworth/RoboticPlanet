# Economy balance audit

November 26, 2026. First pass on the resource bottleneck and recovery checks in [IDEAS](../IDEAS.md#economy-balance-audit-to-do); a second pass the same day covers the Ore pickup stalls, a road link cut, investment payback, the Mass Driver against Maglev, doctrines and snowballing, Long haul game lengths and the pickup estimate's cost (from [Why Ore pickups stall](#why-ore-pickups-stall) on).

## Resource bottlenecks

One-minute snapshots in the Standard 25 and Long haul 21 controls, from minute 12 to the finish, showed 60 building observations waiting for Alloy, nine waiting for Chips, six waiting for Ore and four waiting for Crystal, across both colonies. The selected buildings showed no explicit Cement wait or empty Fuel Station at those samples. This count covers installed production and charging buildings, so it omits shortages at construction sites and dips between samples. A long wait can account for several observations.

The older Standard 25 replay on `d9bf339` reproduced the Ammo drought at minutes 31–36. At minutes 31–34, the Mine at (8, 31) had 2–6 unreserved Ore and shared the Smelter's freight network. A route preview from the Mine to the Smelter succeeded, but the Mine was in dispatch's temporary unreachable state at all four checks. At minute 35 the Mine's tile was flagged as dangerous. At minute 36 the network had split. At minute 37 the Smelter again had Ore incoming. This narrows the first phase to freight eligibility or pickup trouble and the later phase to danger and road connectivity. The preview covered the delivery leg only. It does not show whether an available Hauler could safely reach the Mine to start the trip or why the cooldown kept being renewed.

## Recovery after losing a building

Medium Versus, Normal, Balanced, both rivals computer-controlled. Each paired run started from the same seed and settings on `ef57e13`. At minute 12 the runner destroyed Colony 1's first completed building of the selected type using the normal destruction routine. Each loss run is independent. Standard had a 38-minute cap and Long haul a 33-minute cap. Recovery times are bounded by one-minute samples.

| Map and seed | Setback | Match result | Recovery |
| --- | --- | --- | --- |
| Standard 25 | Control | Colony 1 at 17.32 | — |
| Standard 25 | Smelter | Undecided at 38.00 | A replacement was built and Alloy output resumed by minute 13. At minute 14 it had added 15 Alloy versus 21 in the control. |
| Standard 25 | Fuel Station | Colony 1 at 26.62 | No completed station at any remaining minute check through minute 26. Fuel in stock rose from 8 at minute 12 to 44 at minute 26. |
| Long haul 21 | Control | Colony 2 at 23.81 | — |
| Long haul 21 | Mine | Colony 2 at 20.97 | A replacement was gathering Uranium by minute 13. The colony's Ore output stayed flat at 50 through the final minute-20 check despite three Mines by minute 16. |
| Long haul 21 | Fuel Station | Colony 2 at 26.99 | No completed station at any remaining minute check through minute 26. Fuel in stock rose from 8 at minute 12 to 34 at minute 26. |

The two Fuel Station runs show the strongest repeated recovery problem. The colony still produced Fuel and continued fighting while it had no sampled charging station. The Mine run shows why restoration should be measured in output as well as buildings rebuilt. The Smelter rebuilt quickly even though its match reached the cap. Match length alone gives a different picture from restoration time.

This pass recorded findings and made no gameplay changes. The strongest follow-up is to check what stops rivals replacing the last working Fuel Station even when Fuel is available. For Ore, capture failed pickup attempts and the source of the unreachable cooldown before changing freight rules.

## Reproduce

```sh
TERRAFALL_ECONOMY_TRACE=1 node tools/late-attack-audit.js Standard 25 2 38 d9bf339
TERRAFALL_ECONOMY_TRACE=1 node tools/late-attack-audit.js Standard 25 2 38 ef57e13
TERRAFALL_ECONOMY_TRACE=1 TERRAFALL_ECONOMY_LOSS=1:smelter:12 node tools/late-attack-audit.js Standard 25 2 38 ef57e13
TERRAFALL_ECONOMY_TRACE=1 TERRAFALL_ECONOMY_LOSS=1:charger:12 node tools/late-attack-audit.js Standard 25 2 38 ef57e13
TERRAFALL_ECONOMY_TRACE=1 node tools/late-attack-audit.js 'Long haul' 21 2 33 ef57e13
TERRAFALL_ECONOMY_TRACE=1 TERRAFALL_ECONOMY_LOSS=1:mine:12 node tools/late-attack-audit.js 'Long haul' 21 2 33 ef57e13
TERRAFALL_ECONOMY_TRACE=1 TERRAFALL_ECONOMY_LOSS=1:charger:12 node tools/late-attack-audit.js 'Long haul' 21 2 33 ef57e13
```

## Fuel Station recovery fix

A rival with a completed Bot Foundry and no usable charging building now treats a replacement Fuel Station as critical construction. It can use an emergency slot and gets high delivery priority. A station site already under construction satisfies the request.

- Standard seed 25: after the minute-12 loss, the first completed, fueled replacement was seen at minute 17. The revised run was undecided at its original 38-minute cap. The earlier loss run ended at 26.62 minutes without a sampled replacement.
- Long haul seed 21: the first completed, fueled replacement was seen at minute 13. The revised run was undecided at its original 33-minute cap. The earlier loss run ended at 26.99 minutes without a sampled replacement.
- The two no-loss controls retained their winners and times, 17.32 and 23.81 minutes respectively.

## Opening fairness spot check

Long haul seed 21, Medium Versus, Normal, both Balanced, on `7c7930a`. Both colonies had completed a Fuel Station by the minute-1 check. The table shows the first one-minute checkpoint with positive cumulative production and the totals by minute 12. Starting stock is excluded.

| Good | Colony 1 first by | Colony 2 first by | Colony 1 total at 12 | Colony 2 total at 12 |
| --- | ---: | ---: | ---: | ---: |
| Fuel | 4 min | 5 min | 30 | 27 |
| Alloy | 5 min | 5 min | 60 | 54 |
| Chips | 7 min | 7 min | 20 | 25 |

Fuel appeared one sample earlier for Colony 1. Alloy and Chips first appeared at the same checkpoints, and each colony led in at least one good by minute 12. This spot check covers one seed, with opening route costs and other starts still to audit. Replay with `TERRAFALL_ECONOMY_TRACE=1 node tools/late-attack-audit.js 'Long haul' 21 2 12 7c7930a`.

### Islands seed 21

Medium Versus, Normal, both Balanced, revision `b9cdfd5`. The replay had a 12-minute cap and ended at minute 9.29 with Colony 1 winning. Compare the minute-9 checkpoint, the last one with both colonies alive.

| Metric | Colony 1 | Colony 2 |
| --- | ---: | ---: |
| First Fuel by | 4 min | 4 min |
| First Alloy by | 6 min | 5 min |
| First Chips by | 7 min | 7 min |
| Fuel / Alloy / Chips produced by minute 9 | 29 / 33 / 14 | 28 / 33 / 11 |
| Net road tiles added by minute 9 | 98 | 73 |
| Gross Cement charged through the road payment routine by minute 9 | 22.9 | 18.1 |
| Completed Ramps at minute 9 | 0 | 0 |

Colony 1 built 25 more road tiles and paid 4.8 more Cement through the infrastructure payment routine. Colony 2 started Alloy one checkpoint sooner, but the total was even at minute 9. There was no observed Ramp cost difference. This measures what each AI built and paid, and does not isolate the terrain cost of equivalent routes. The payment routine also serves some non-road infrastructure and the trace counts gross charges before refunds.

The production timing can be reproduced with `TERRAFALL_ECONOMY_TRACE=1 node tools/late-attack-audit.js Islands 21 2 12 b9cdfd5`. This spot check used temporary observers on `payRoad` and the owned road grid for the infrastructure figures.

## Why Ore pickups stall

`TERRAFALL_PICKUP_TRACE=1` (added to `tools/late-attack-audit.js`) records every time a goods carrier or worker gives up a trip for safety, the building it was going to, and what it gave way to. A building's "unreachable" cooldown (`b.unreachUntil`) is set in exactly two places: `noSafeRoute` (no way round an enemy gun, 10 s) and `takeCover` (enemy warbots or the Murmur near the way ahead, 5 s).

Standard seed 25, 38-minute cap, Normal, Balanced:

| Revision | Result | Trips given up | To the Murmur | To enemy warbots | To guns |
| --- | --- | ---: | ---: | ---: | ---: |
| `d9bf339` (the Ammo drought) | Undecided at 38 | 1,154 | 1,005 | 149 | 0 |
| `81f7823` (main before this pass) | Colony 1 at 17.32 | 400 | 292 | 108 | 0 |

On `d9bf339`, trips to Mines were given up 239 times, most in two bursts (minutes 22–23 and 30–34). Colony 1's Mine at (8, 31), the one the first pass found in the unreachable state at minutes 31–34, accounts for 102 Hauler turn-backs on the way to it, every one from Murmur Scuttlers 6–11 tiles off its route (never at the Mine itself, never a gun). Each turn-back put the Mine on its 5-second cooldown, and the next Hauler sent turned back the same way. So the Ore stall was the Murmur roaming by the Haulers' road, not freight eligibility, the road network or the route estimate. `takeCover` works as designed (keep 6 tiles from a creature); the cost is that nobody clears the creatures off a supply road. The owner chose both: see [Murmur on supply roads](#murmur-on-supply-roads) in the third pass.

## Losing a key road link

`TERRAFALL_ROAD_CUT=colony:minute` takes up the middle three road tiles of the colony's longest road from its Command Base to a Mine or Smelter (as if bulldozed) and records when the two are joined by road again and when the three tiles are road again. `81f7823`, Medium Versus, Normal, Balanced, cut at minute 12.

| Map and seed | Cut | Link cut | Joined again | Tiles back | Output after | Result (control) |
| --- | --- | --- | --- | --- | --- | --- |
| Long haul 21 | Colony 1 | Mine, 20-tile road | 12.73 | 12.73 | Ore 54 vs 58 at minute 13, level again by 15; Alloy 142 vs 133 at 22 | Colony 2 at 30.72 (23.81) |
| Long haul 21 | Colony 2 | Mine, 20-tile road | 12.35 | 12.35 | no visible dip | Undecided at 33 (23.81) |
| Standard 25 | Colony 2 | Smelter, 7-tile road | 12.18, by another road | never | Alloy kept rising (97 at minute 13 to 115 at 16), then flat as it lost the war | Colony 1 at 18.30 (17.32) |
| Standard 25 | Colony 1 | none: no Mine or Smelter 6+ road tiles out | — | — | — | — |

The rival relays a cut road in 20–45 seconds and output dips for at most a minute. A bare cut is not a lasting setback. The match results moved because any change at minute 12 reshuffles the rest of a deterministic game. A cut under enemy guns or with raiders standing on it, where Workers won't go, is the harder case and was not run.

## Investment payback

`tools/doctrine-audit.js` measures each production building's output per building per minute from minute 6 to the end of each game (all 40 doctrine games below, averaged over every building standing each minute, so idle, starved and unstaffed time counts) and divides its build cost by that output. Both are in raw-material units: a gathered good is 1, Cement 0.5, Alloy 1.33, Chips 2.33, Fuel 1, Ammo 0.61 (what went into one).

| Building | Output a minute, measured | Cost (raw units) | Pays back in |
| --- | ---: | ---: | ---: |
| Smelter | 6.5 Alloy | 3.5 | 24 s |
| Chip Fab | 3.0 Chips | 3.7 | 31 s |
| Ore Mine | 3.7 Ore | 3 | 49 s |
| Refinery | 6.6 Fuel | 6 | 55 s |
| Quarry | 2.2 Stone | 2 | 55 s |
| Oil Pump | 3.4 Crude | 3.7 | 64 s |
| Crystal Tap | 2.2 Crystal | 3 | 82 s |
| Cement Works | 7.0 Cement | 6 | 103 s |
| Ammo Plant | 1.5 Ammo | 4.2 | 280 s |

Every production building repays its cost within two minutes of its own output, the Ammo Plant within five. A building's price never limits growth; Workers, inputs and freight do. The Ammo Plant's slow payback reflects how rarely it runs: it makes Ammo only when Ammo is wanted.

For the long links, the cost of a line, not its output, is what decides. Over 30 tiles a Maglev line with four pods costs about 46 Cement, 58 Alloy, 29 Chips and moves about 120 goods a minute each way. A Mass Driver line moved 160 a minute each way for 16 Cement, 12 Alloy, 6 Chips at any reach up to 50 tiles. It has been tuned (below). The road, Truck, Express and rail comparison on routes suited to each is still to do.

## Mass Driver against Maglev

| | Mass Driver line (before) | Mass Driver line (now) | Maglev line, 30 tiles |
| --- | --- | --- | --- |
| Cost | 16 Cement, 12 Alloy, 6 Chips | 20 Cement, 15 Alloy, 8 Chips | about 46 Cement, 58 Alloy, 29 Chips with 4 pods; more the longer it is |
| Goods a minute each way | 160 | 120 (118 measured over 30 tiles) | about 120 |
| Reach | 12–50 tiles, any gap | 12–50 tiles, any gap | 6–40 tiles a line; a chasm or deep water up to 6 tiles; bends, hubs, networks |
| Set-up | two buildings | two buildings | a Worker builds it out at 3 s a tile (90 s for 30) |
| Weak point | enemy Flak under the arc | the same | any pylon shot down cuts it |

The Driver line did everything a Maglev line does point to point, for a quarter of the cost, with more reach and nothing to defend between the ends. Now each end fires every 8 s (it was 6) and the ends cost a little more. It still carries about as much as a 30-tile Maglev line for about a third of the cost. It remains the only way over a gap a Maglev line can't span, while Maglev keeps its networks and hubs. `tools/massdriver-test.js` checks 100–130 a minute each way over 30 tiles of sea. The owner's decision (third pass, below): over land a robot can walk, each end fires every 10 s (96 a minute measured over 30 tiles, from 118), and a Catcher takes two Drivers at most.

## Doctrines and snowballing

40 computer-only games, `81f7823`, Medium Versus, Normal, Murmur active, 40-minute cap: every pair of the five doctrines, each with sides swapped, on Standard seed 25 and Long haul seed 21. `tools/doctrine-audit.js` sets both colonies' doctrines (newGame makes colony 1 a Steward in a computer-only game).

| Doctrine | Won | Lost | Undecided |
| --- | ---: | ---: | ---: |
| Herald (rusher) | 11 | 4 | 1 |
| Salvager (raider) | 10 | 6 | 0 |
| Architect (tycoon) | 8 | 8 | 0 |
| Warden (turtle) | 6 | 9 | 1 |
| Steward (balanced) | 4 | 12 | 0 |

- **The Herald is the strongest rival against other rivals**, more so than the Salvager. On Standard 25 it won 7 of 8, three times by minute 10 (as colony 1 it took a Steward's and a Warden's Command Base at 9:00, and a Salvager's at 10:18). On the longer Long haul map it was 4–2 with one undecided. Its early wave beats rivals that don't garrison early. A player can still hold it with a garrison and a turret, as its own description says. Whether it is too strong against a human is for play-testing; no change was made.
- **The Steward is the weakest** (4–12). It is the default rival, so most players meet it.
- **Doctrine mattered more than side.** In 12 of the 19 swapped pairs with two results, the same doctrine won from both sides. In 6 more, colony 1 won both games, a side lean on these two seeds (25 of 39 decided games went to colony 1). The opening spot check above found no clear lean on Long haul 21, so this lean is in the middle game. It needs more seeds before anything moves.
- **An early lead helps but doesn't decide.** The colony that had made more by minute 10 won 24 of 37 games (65%). By minute 15 that rose to 22 of 32 (69%). The bigger army at minute 10 won 25 of 35 (71%). About one game in three was turned around.

## Long haul game lengths after the late-game AI merge

Long haul, two players, Medium Versus, Normal, Balanced, 40-minute cap, eight seeds, on `288eb8f` (main just before the merge `b274301`) and `81f7823` (current main), with `tools/ai-baseline-audit.js`.

| Seed | Before | After |
| --- | --- | --- |
| 21 | undecided at 40 | colony 2 at 23.81 |
| 3 | colony 2 at 29.33 | colony 1 at 30.94 |
| 7 | colony 2 at 32.97 | colony 2 at 20.54 |
| 11 | colony 2 at 22.06 | colony 2 at 24.31 |
| 15 | colony 2 at 19.04 | undecided at 40 |
| 19 | colony 2 at 26.49 | colony 2 at 31.66 |
| 25 | colony 2 at 24.82 | colony 2 at 31.22 |
| 31 | undecided at 40 | undecided at 40 |

Two of eight games went undecided both before and after. The decided games averaged 25.8 minutes before and 27.1 after, and the medians, counting undecided games as 40, were 27.9 and 31.1. Games went longer on four seeds and shorter on two, and seed 21 now finishes. This is about three minutes longer on average, within the seed-to-seed spread, with no new kind of stall, so no change was made. The undecided seed 15 game (traced to 45 minutes) is a late Chip drought on both sides. Both Foundries were mostly "Waiting for Chip" from minute 20, and colony 1 had no Ammo in stock from minute 26. Colony 1's storms of 13, 8, 10 and 6 warbots were worn down on the long road. The before-merge stalls look the same: Chips at 0 on both sides at 40 minutes. The late Chip and Crystal supply on Long haul is the thing to look at next.

## The cargo pickup estimate's cost

The merge review flagged `cargoPickupTime` (a route search per eligible carrier per pickup each dispatch pass). The owner's crowded save `bc3fa232` (minute 56.7, 121 bots, 27 Haulers, 139 buildings) ran 240 game seconds headless. It made 52 estimate calls, taking 14 ms of 70.7 s, which is 0.02%. In the same window `findPath` ran 2,136 times for 1,052 ms. The estimate runs only when more than one carrier is eligible, and results are kept for the dispatch pass. It is not a real cost, so it was left alone.

## Reproduce this pass

```sh
TERRAFALL_ECONOMY_TRACE=1 TERRAFALL_PICKUP_TRACE=1 node tools/late-attack-audit.js Standard 25 2 38 d9bf339
TERRAFALL_ECONOMY_TRACE=1 TERRAFALL_ROAD_CUT=1:12 node tools/late-attack-audit.js 'Long haul' 21 2 33 81f7823
node tools/doctrine-audit.js Standard 25 rusher balanced 40 81f7823      # each pair, both ways round
node tools/ai-baseline-audit.js 'Long haul' 15 2 40 288eb8f              # and 81f7823; seeds 3 7 11 15 19 21 25 31
TERRAFALL_PRESSURE_TRACE=1 node tools/late-attack-audit.js 'Long haul' 15 2 45 81f7823
node tools/massdriver-test.js
```

## Third pass: the owner's decisions

November 26, 2026, the same day: the owner's calls on the second pass. The Herald stays as it is. Doctrine games are `tools/doctrine-audit.js` as before (Medium Versus, Normal, Murmur Active, 40-minute cap, every pair both ways round); the revisions are `2f13f2a` (main before this pass), `34bc575` (the freight and Mass Driver changes below, no Steward change) and `ada824f` (this pass).

### Murmur on supply roads

Two changes, for every colony. **Turn-backs back off**: each time carriers turn back from the Murmur on the way to a building, once its last wait is over, the wait before another is sent doubles (5, 10, 20, then 40 s at most), and a pickup or delivery there starts it again (storage excepted: carriers reach it by every road). The building's status then says *Haulers turning back: Murmur near the road*, and so do the Economy panel's bottlenecks and "Why idle?". Tracing it showed why the 5-second wait never helped a Mine: **the output pickups (`dispatch` step 4) never asked whether a building was waiting**, so a Hauler was sent every few seconds into the same Scuttlers. They ask now. **A rival guards the road**: by day, with its army at its attack threshold and four more, it sends three warbots to a rally flag where its carriers last turned back, for 90 s (`aiRoadGuard`). Sent any time, the squad cost a Steward its Command Base on Standard 25 (its army was 7 instead of 10 when the rival marched at minute 10), hence the conditions.

`TERRAFALL_PICKUP_TRACE=1 node tools/late-attack-audit.js Standard 25 2 38`, `d9bf339` (the Ammo drought) against `d9bf339` with this pass's freight changes applied. The changed game ends at 28.5 minutes (colony 1 wins), so both are compared over the first 28 minutes:

| Standard 25, first 28 minutes | `d9bf339` | with the changes |
| --- | ---: | ---: |
| Carrier trips given up to the Murmur | 668 | 492 |
| ...on the way to Mines | 138 | 79 |
| Hauler pickups at Mines turned back | 69 | 20 |
| Turn-backs at the Mine at (8, 31) | 48 | 0 |
| Ore made, colony 1 / colony 2 | 130 / 137 | 148 / 122 |
| Alloy made, colony 1 / colony 2 | 159 / 134 | 187 / 141 |

On current main (`2f13f2a` against `ada824f`'s freight changes, first 17 minutes, the shorter game's length) Murmur turn-backs fell from 292 to 253, with no Mine stalls in either.

### Mass Driver: overland lines and two Drivers a Catcher

When a robot could walk from one end to the other (the two ends in one walking area: roads, bridges and ramps count, Ropeways, Viaducts, ferries and Airships don't), each end fires every 10 s instead of 8: then it's a shortcut over land, not a crossing. Over water, a chasm or cliffs it stays 8 s. A Catcher takes two Drivers at most; aiming a third at it is refused ("That Catcher already takes 2 Mass Drivers, the most one can"). Each end's panel shows its rate and why. Measured by `tools/massdriver-test.js` over 30 tiles both ways at once: over land 118 goods a minute each way before, 96 now; across the sea on Islands 118, unchanged.

### The Steward

**Why it lost.** Traced games (`late-attack-audit`, a per-minute probe of army, goods, sites and foundries) showed the same story: its economy kept pace, often ahead (Long haul 21 against the Warden it had made 1,902 raw units to 1,608 by minute 40) but its army never caught up. It played the plain difficulty: army growth 1.0 from minute 4, where the Salvager grows 1.15 from minute 2.8, the Herald 1.35 from 1.6 and the Architect 1.3 from 2.8 with bots 15% faster. Against a Herald its army was 7 at minute 7 to the Herald's 14, and a march at minute 8 took its Command Base at about 9:00 (in three runs of that pairing). Late on, its Ore ran out (its Mines' veins worked out round minute 15–20) and its Alloy and Chips with it, while a Nuclear Reactor, a Keep and Arrival City waited for them; its army fell from 20 to 6 (Long haul 21 against the Architect).

**The change** (`PERSONALITIES.balanced`): its bots work 10% faster (`econ` 1.1), its army grows 15% faster (`army` 1.15) and starts a minute sooner (`armyFrom` 0.8). Nothing else: it still builds, defends and attacks in good measure, raids now and then, offers truces in Contingency and builds Arrival City from minute 12. Steward games only, Standard 25 and Long haul 21 (16 games):

| Steward variant | Won | Lost | Undecided |
| --- | ---: | ---: | ---: |
| Plain, `2f13f2a` | 4 | 12 | 0 |
| Plain, `34bc575` (the freight changes) | 5 | 10 | 1 |
| econ 1.08, army 1.15 from 0.8 | 6 | 8 | 2 |
| econ 1.12, army 1.15 from 0.8 | 9 | 6 | 1 |
| econ 1.08, army 1.25 from 0.7 | 9 | 7 | 0 |
| **econ 1.1, army 1.15 from 0.8 (shipped)** | 6 | 8 | 2 |

Any change reshuffles a deterministic game, so 16 games swing by two or three either way; the 6-seed table below is the better measure. The army-heavy variant went 0–4 against the Salvager and 4–0 against the Architect, so the shipped one leans on the economy, the all-rounder's way.

**The tournament, before and after.** All 40 games of Standard 25 and Long haul 21:

| Doctrine | Before (`2f13f2a`) | After (`ada824f`) |
| --- | --- | --- |
| Herald | 11–3, 1 undecided | 10–5, 1 undecided |
| Salvager | 10–6 | 7–9 |
| Architect | 7–8 | 8–8 |
| Warden | 6–9, 1 undecided | 7–8, 1 undecided |
| Steward | 4–12 | 6–8, 2 undecided |

| Steward against | Before | After |
| --- | --- | --- |
| Warden | 1–3 | 0–3 |
| Salvager | 0–4 | 2–2 |
| Herald | 1–3 | 1–2 |
| Architect | 2–2 | 3–1 |

And on six seeds (Standard 25, 11 and 19, Long haul 21, 3 and 11; 120 games, `ada824f`):

| Doctrine | Won | Lost | Undecided |
| --- | ---: | ---: | ---: |
| Herald | 30 | 13 | 5 |
| Salvager | 28 | 17 | 3 |
| Steward | 20 | 22 | 6 |
| Warden | 17 | 25 | 6 |
| Architect | 13 | 31 | 4 |

The Steward lands in the middle: 3–7 against the Warden, 4–6 against the Salvager, 5–6 against the Herald and 8–3 against the Architect. The Architect, 8–8 on the first two seeds, is 5–23 on the four new ones: worth a look in a later pass (its Missile Factory and Silos come at the cost of its army).

### Side lean

The 120 games above: colony 1 won 50, colony 2 58, 12 undecided. By seed:

| Seed | Colony 1 | Colony 2 | Undecided |
| --- | ---: | ---: | ---: |
| Standard 25 | 16 | 4 | 0 |
| Standard 11 | 6 | 13 | 1 |
| Standard 19 | 7 | 11 | 2 |
| Long haul 21 | 8 | 10 | 2 |
| Long haul 3 | 8 | 10 | 2 |
| Long haul 11 | 5 | 10 | 5 |

Of the 48 swapped pairs with two results, 30 went to the same doctrine both ways, 8 to colony 1 both ways and 10 to colony 2 both ways. **No consistent lean**: Standard 25 favours colony 1 (14–6 before this pass too, and in every Steward variant), the other seeds lean the other way or not at all. The starts are exact point mirrors on all six seeds (the Command Bases, every deposit within 15 tiles and the nearest Murmur nests and exits at the same distances), so Standard 25's lean is in how its games unfold, not the map. One ordering difference remains in two-colony games, noted for whoever looks next: Teams games alternate which side's units and buildings update first each tick and interleave the AI turns (`simStep`, the 2v2 fairness fix in [ai-stalemate-fixes](ai-stalemate-fixes.md#4-2v2-fairness)); a 1v1 game always updates colony 1 first and lets colony 1's AI think first on a tie. Nothing was changed for it.

### Reproduce

```sh
node tools/doctrine-audit.js Standard 25 balanced rusher 40 ada824f      # each pair, both ways round, six seeds
TERRAFALL_PICKUP_TRACE=1 TERRAFALL_ECONOMY_TRACE=1 node tools/late-attack-audit.js Standard 25 2 38 d9bf339
TERRAFALL_ECONOMY_TRACE=1 node tools/late-attack-audit.js Standard 25 2 26 2f13f2a normal rusher   # a Steward's Ore running out
node tools/massdriver-test.js
node tools/civilian-pathing-audit.cjs     # the turn-back waits
```
