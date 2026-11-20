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

On the historical revision, replaying with the narrower rule withheld the 24-unit storm at minute 32. The old game still reached its test cap. A separate trial that also tightened assembly at the staging flag introduced a new 55-minute stall on the current seed, so the committed change leaves assembly alone.

## 3. Islands crossings

Medium seed 21 opened with six Ore deposits per home island, compared with 11 to 18 in the other three test seeds. The baseline reached 55 minutes without a Ferry or a landing on either side. Colony 1 had made only 16 Ore and had no Port. Colony 2 had made 44 Ore and had two Ports and 16 military units, but its Foundry and other jobs competed with the shipyard for scarce parts. The AI's two-deposit Mine rule stranded reachable Ore. Allowing a lone deposit restored Ore production, but that trial still had no Ferries at the cap.

An Ore-starved island colony can now put a Mine within walking distance of one deposit if there is no valid site with two. When all enemies are separated by water and the home island has at most the six deposits normally needed by three Mines, the AI can give its first Port an extra build slot and prioritize parts for its Ferry. A bomber Airfield waits for that crossing. I reviewed air supply as well. The AI's Airfield plan orders a bomber, so it would not open a freight route across the gap. In seed 21 the Ferry made four landing runs and Colony 1 captured the enemy Command Base. Existing landing and air-supply rules were sufficient for these tests and were left in place.

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
