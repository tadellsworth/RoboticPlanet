# Map fairness and difficulty audit

November 19, 2026. Ran 250 headless Versus map starts across all 25 presets and 590 colony starts. The matrix used seeds 1, 2, 7, 19, 21, 83, 107, 1101, 43199, and 91382 in that order for every preset. It cycled all four sizes and five terrain settings, used Scarce resources every third case and Normal otherwise, and alternated Murmur settings and Tropical on eligible naval cases. Tested the preset's supported player counts with the Uplinks victory selected where available.

## Map starts

- All 590 starts had Fiber, Stone, Ore, and Crystal on connected terrain. The furthest nearest deposit in each category was about 5.4, 5.7, 8.1, and 9 tiles away respectively, measured in straight-line distance. This checked terrain connections and deposit presence. Building footprints and road costs need separate playtests.
- All 130 naval starts had a potential shore tile on connected terrain with water large enough for a Port. In 26, the Port could not be placed at setup and required expansion. All 20 Grand Canyon starts were in that group, consistent with the high rims. The other six were River delta starts.
- All ten Grand Canyon starts had three Trade Posts and three or four Uplinks, with every objective on foot-accessible terrain from both starts. Island and Sky islands objectives often require ships or crossings by design. The Hollow uses Capture in place of Uplinks.

## Findings

| Priority | Observed result | Proposed improvement |
| --- | --- | --- |
| High | 43 of 240 maps outside the Hollow placed fewer than two Trade Posts. That includes 34 with zero. Most cases were Small maps, with 41 of 72 Small cases placing fewer than two. Standard, seed 21, Small, Gentle, Normal resources, and Active Murmur reproduced zero posts. | Add a fallback trade-pad placement pass for constrained maps or tell the player before launching when there will be no trade sites. Keep the fallback reachable from playable terrain. |
| Medium | Four of ten Four Isles cases offered only one Uplink, below the game mode's stated range of three to five. All four used three colonies. Reproduce with seed 21 on Small, Gentle, Normal resources, and the desert biome. The estimated travel effort to that one objective was 47.5, 43.5, and 42.5. | Preserve the intended multi-site race with valid fallback placements, or state the one-objective rule before match start. |
| Follow-up | The largest difference in estimated effort to a winning set of Uplinks was 13 on Twin Valleys seed 1101, with both teams having one closer start and one further start. Three Mesas seed 107 had efforts of 65, 71, and 76.5 across its three starts. | Play those openings before tuning. The placement estimate assigns crossing costs. It does not model how quickly a new colony can afford to build them. |

## Easy and Hard openings

Ran 12 eight-minute opening scenarios, with seeds 21 and 43199 on each of Standard, Islands, and Grand Canyon. The player used the same scripted Harvester, Ore Mine, and Smelter opening with no defenses. Murmur was off to isolate the rival. The player placed all three sites and made Alloy in every run.

| Rival difficulty | Median completed rival buildings | Median rival army units | Player losses by 8:00 |
| --- | ---: | ---: | ---: |
| Easy | 13 | 4 | 0 of 6 |
| Hard | 22 | 10.5 | 1 of 6 |

Hard Grand Canyon seed 21 defeated the undefended player at roughly 7:35. These runs verify the difficulty contrast under one opening. They leave defensive response, longer balance, and human play on other presets open.
