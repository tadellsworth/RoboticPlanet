# Economy balance audit

November 26, 2026. First pass on the resource bottleneck and recovery checks in [IDEAS](../IDEAS.md#economy-balance-audit-to-do). The remaining three audits and the road-link recovery scenario are on the to-do list.

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
