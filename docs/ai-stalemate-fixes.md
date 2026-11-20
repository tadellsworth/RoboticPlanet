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
