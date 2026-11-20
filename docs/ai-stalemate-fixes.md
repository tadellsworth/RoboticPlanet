# AI stalemates and 2v2 fairness fixes

November 19, 2026. Baseline `d56b30e`. All matches are headless, with computer colonies on Normal difficulty, default terrain and resources, and Capture victory. The Hollow uses Active Murmur. The other maps use Murmur Off. Colony 1 is player 0 in the simulation. A result marked open reached the test cap with no winner.

## 1. Hollow Medium seed 11

At minute 25 the second colony could afford a replacement Oil Pump and the AI could find a site. A Crystal Tap site had occupied a build slot for over 18 minutes and an Outpost for over nine. Neither had begun construction, received a delivery, or connected to storage. The road planner returned zero new tiles and five and seven pending tiles respectively. `aiRoads` exempted pending roads from its four-minute timeout, so those sites held their slots indefinitely. Both colonies ran low on Fuel. This repro exposed a construction and supply failure. It did not require any rival to build an Express lane.

The AI now retires an unlinked site with no work started or materials in transit after four minutes if it is waiting on a road already on the books. It uses the existing site avoidance cooldown. At the minute-25 checkpoint, the Crystal Tap was retired. It stayed in place when the same check had an incoming delivery reserved. No persistent state was added.

| Match | Before | After |
| --- | --- | --- |
| Hollow Medium, seed 11 | Open at 75:00 | 35:29, Colony 2 |
| Hollow Medium, seed 12 | Open at 60:00 | 42:13, Colony 2 |
| Hollow Small, seed 21 | 30:44, Colony 1 | 27:02, Colony 1 |
| Hollow Small, seed 25 | 24:04, Colony 2 | 24:04, Colony 2 |
| Standard Medium, seed 64 | 15:58, Colony 1 | 15:58, Colony 1 |
| Crossroads Small, seed 1, four rivals free for all | 34:33, Colony 4 | 34:33, Colony 4 |
| Crossroads Small, seed 3, 2v2 | 28:01, Team 2 | 20:07, Team 1 |
| Long haul Medium, seed 11 | 30:56, Colony 2 | 30:56, Colony 2 |

The 2v2 winner changed in this seed. Team fairness is measured separately in the fourth fix.

## 2. Hollow Small seed 25

The current baseline already wins this seed for Colony 2 in just over 24 minutes. To reproduce the failure, I also ran the revision that introduced the old storm rule (`d947f83`). It was open at 75 minutes. In that run Colony 2 repeatedly stormed a base whose defence estimate was 33 to 41 with groups as small as 17 to 24. Its field-army advantage kept qualifying for the smaller storm even though the defending guns were intact.

The smaller storm is now reserved for light gun cover. A fortified base requires the estimated full force. When the AI cannot gather that force, it can wait for more units or pursue a cheaper fort. A test with 24 available units and an estimate of 34 confirmed that heavy guns block the order and the lightly defended control can still make a storm. The fix reuses existing military state.

| Match | Before | After |
| --- | --- | --- |
| Hollow Small, seed 25 | 24:04, Colony 2 | 24:04, Colony 2 |
| Hollow Medium, seed 11 | 35:29, Colony 2 | 35:29, Colony 2 |
| Standard Medium, seed 64 | 15:58, Colony 1 | 15:58, Colony 1 |
| Crossroads Small, seed 1, four-colony free for all | 34:33, Colony 4 | 34:33, Colony 4 |
| Crossroads Small, seed 3, 2v2 | 20:07, Team 1 | 20:07, Team 1 |
| Long haul Medium, seed 11 | 30:56, Colony 2 | 30:56, Colony 2 |
| Hollow Small, seed 25, historical `d947f83` | Open at 75:00 | Open at 75:00 |

On the historical revision, replaying with the narrower rule withheld the 24-unit storm at minute 32. The old game still reached its test cap. A separate trial that also tightened assembly at the staging flag introduced a new 55-minute stall on the current seed.

## 3. Islands crossings

Medium seed 21 opened with six Ore deposits per home island, compared with 11 to 18 in the other three test seeds. The baseline reached 55 minutes without a Ferry or a landing on either side. Colony 1 had made only 16 Ore and had no Port. Colony 2 had made 44 Ore and had two Ports and 16 military units, but its Foundry and other jobs competed with the shipyard for scarce parts. The AI's two-deposit Mine rule stranded reachable Ore. Allowing a lone deposit restored Ore production, but that trial still had no Ferries at the cap.

An Ore-starved island colony can now put a Mine within walking distance of one deposit if there is no valid site with two. When all enemies are separated by water and the home island has at most the six deposits normally needed by three Mines, the AI can give its first Port an extra build slot and prioritize parts for its Ferry. A bomber Airfield waits for that crossing. I reviewed air supply as well. The AI's Airfield plan orders a bomber, so it would not open a freight route across the gap. In seed 21 the Ferry made four landing runs and Colony 1 captured the enemy Command Base.

A trial that gave first-Ferry priority to every island colony opened seed 21 but left seeds 5 and 17 past their usual finish times. The Ore-reserve check limits that trade-off.

| Match | Before | After |
| --- | --- | --- |
| Islands Medium, seed 21 | Open at 55:00 | 20:53, Colony 1 |
| Islands Medium, seed 2 | 18:38, Colony 2 | 18:38, Colony 2 |
| Islands Medium, seed 5 | 17:38, Colony 1 | 17:38, Colony 1 |
| Islands Medium, seed 17 | 22:37, Colony 1 | 22:37, Colony 1 |
| Standard Medium, seed 64 | 15:58, Colony 1 | 15:58, Colony 1 |
| Crossroads Small, seed 1, four-colony free for all | 34:33, Colony 4 | 34:33, Colony 4 |
| Crossroads Small, seed 3, 2v2 | 20:07, Team 1 | 20:07, Team 1 |
| Long haul Medium, seed 11 | 30:56, Colony 2 | 30:56, Colony 2 |

A seed 21 checkpoint saved at tick 13,800 passed save validation. Running 900 more ticks from the checkpoint and reloading it gave the same state hash at tick 14,700.

## 4. 2v2 fairness

Terrain, resources, Command Base sites and opening stocks matched across teams in a 60-start map scan. It covered Crossroads, Pinwheel, Twin Valleys, Long Haul 2v2 and Four Isles, on Small and Medium with seeds 1, 3, 7, 11, 21 and 83. Trade access was uneven. The closest starting route to the only post in Twin Valleys Small seed 3 cost Team 1 37 travel units and Team 2 26. With a mirrored pair, both teams have a route costing 22. The maximum gap for access to any post fell from 11 to one walking tile of effort across the scan. Four Isles Small seed 11 has no valid post in either version. Long Haul 2v2 retains its shared central post and the existing pairs.

The generic attack planner could pick an ally's building and spend an attack turn assigning troops to it. The fallback naval landing planner could also choose an ally. Both now apply the team hostility rule. A computer ally can send spare Warbots to answer a hostile rally on its teammate's land if its own base is safe and the teammate has no counter already active. A focused check exercised the home alert, insufficient spare troops, a counter already underway, and the successful response.

The tied AI turns previously started with seats 0, 1, 2 and 3 in that order. Team matches now interleave the teams and rotate the first turn using the seed and tick. Unit and building updates alternate direction across ticks. All computer seats in Teams use the same construction-cap rule. The changes use existing save fields. A Crossroads seed 3 checkpoint passed validation and produced the same state hash after reload and replay.

Full-match 2v2 trials used all four Balanced doctrines at Normal difficulty, with Observer victory rules so play continued until a whole team lost. The headless setup used four players, `humans: []`, `teams: true`, `S.watch = true`, and `simStep(1 / 30)` through victory or 70 game minutes.

Across the 12 team games, AI attack orders aimed at an ally fell from 136 to zero. The new ally defense sent 26 counter-groups. Team 1 won 9 games before and 6 after, and Team 2 won 3 before and 6 after.

| 2v2 match | Before | After |
| --- | --- | --- |
| Crossroads Small, seed 3 | 20:07, Team 1 | 19:21, Team 2 |
| Crossroads Small, seed 4 | 20:38, Team 1 | 65:43, Team 2 |
| Crossroads Small, seed 7 | 17:30, Team 2 | 22:35, Team 1 |
| Crossroads Small, seed 8 | 37:47, Team 1 | 25:00, Team 2 |
| Twin Valleys Small, seed 3 | 24:53, Team 1 | 20:29, Team 1 |
| Twin Valleys Small, seed 4 | 19:39, Team 2 | 20:33, Team 2 |
| Twin Valleys Small, seed 7 | 22:42, Team 1 | 33:21, Team 1 |
| Twin Valleys Small, seed 8 | 19:56, Team 2 | 30:15, Team 1 |
| Long Haul 2v2 Medium, seed 9 | 30:56, Team 1 | 50:02, Team 1 |
| Long Haul 2v2 Medium, seed 10 | 25:39, Team 1 | 27:34, Team 1 |
| Long Haul 2v2 Medium, seed 11 | 48:50, Team 1 | 34:37, Team 2 |
| Long Haul 2v2 Medium, seed 12 | 24:44, Team 1 | 19:36, Team 2 |

Crossroads seed 4 took 65:43. Both surviving colonies were still sending attacks near minute 50. Long Haul 2v2 seed 9 took 50:02. All 12 team games finished by the 70-minute cap, and all six controls matched their before results.

| Control match | Before | After |
| --- | --- | --- |
| Standard Medium, seed 64 | 15:58, Colony 1 | 15:58, Colony 1 |
| Crossroads Small, seed 1, four-colony free for all | 34:33, Colony 4 | 34:33, Colony 4 |
| Long haul Medium, seed 11 | 30:56, Colony 2 | 30:56, Colony 2 |
| Islands Medium, seed 21 | 20:53, Colony 1 | 20:53, Colony 1 |
| Hollow Medium, seed 11 | 35:29, Colony 2 | 35:29, Colony 2 |
| Hollow Small, seed 25 | 24:04, Colony 2 | 24:04, Colony 2 |

Both required checks passed for each fix. The fourth fix also passed the army pathing regression checks, the allied defense scenarios and the save replay test.
