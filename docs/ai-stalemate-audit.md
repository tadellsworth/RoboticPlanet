# Two-rival late-game stalemate audit

November 19, 2026. The owner saw two computer colonies stop making Warbots and attacking around minute 45 on a Standard map with no water. They still gathered resources and the map had Trade Posts. The match's seed and remaining settings are unknown. I compared the [earlier AI stalemate notes](../IDEAS.md#ai-stalemates) with new runs of the working branch at `fe30fd9`. The Islands comparison isolates a separate cause of the same visible symptom.

## Reproduced a stall with usable Ore still in the ground

On Medium Islands, seed 21, both Steward rivals went from minute 10 through minute 55 without producing another Warbot, mining Ore, or smelting Alloy. At minute 45 both had staffed Smelters waiting for Ore and no stored Ore or Alloy. They had produced 194 Crystal each since landing and were still making civilian goods. Their military units remained garrisoned, seven on one side and five on the other. Neither had a Ferry or a Trade Terminal.

The earlier notes describe seed 21 as Ore depletion. Each rival actually had **65 Ore remaining in three scattered deposits on its home island** at minute 45. The normal AI found no site for an affordable replacement Mine. It requires two unworked deposits within a Mine's radius. Allowing one deposit returned a legal site for both rivals immediately, at `(20, 71)` and `(24, 10)`. All other placement rules still applied. [Resource and build planning](../js/ai.js) · [Mine recipe](../js/defs.js)

The three Trade Posts were on other landmasses. Neither rival could find a site for a Terminal with its current road access and both lacked the three Alloy for construction. A map can have Trade Posts well before its colonies have a working trade route. A Terminal needs a route and a convoy to make a sale and bring imports home. [Terminal rules](../js/defs.js) · [Trade dispatch](../js/sim.js)

## Minute-45 intervention

I replayed Islands seed 21 from the same start and let the Mine search accept one deposit from minute 45. The experiment changed that threshold in the headless process and used the normal construction, staffing, and freight code. No goods, units, or buildings were granted. Through minute 45 the recorded production totals matched the baseline.

| Added from minute 45 to 55 | Baseline colony 1 / 2 | One-deposit colony 1 / 2 |
| --- | --- | --- |
| Ore mined | 0 / 0 | 44 / 58 |
| Alloy made | 0 / 0 | 57 / 69 |
| Warbots built | 0 / 0 | 2 / 0 |
| Bulwarks and Torches built | 0 / 0 | 0 / 2 |

Both rivals resumed making Alloy and each built two military units. Neither had a Ferry at minute 55 and the match was still open. The experiment demonstrates an economic recovery and a remaining obstacle to combat across the water.

## Standard maps and working trade routes

All ten Standard runs finished. The two on verified water-free seed 64 ended at **19:00** for two Stewards and **27:45** for two Wardens. Both sides made Trade Terminal sales in both runs. The longest Standard run, Large seed 43199, finished at **37:05**. The two starts in every Standard run shared a walking zone. These runs did not reproduce the reported minute-45 stall on Standard.

Chokepoint seed 83 with two Wardens produced a temporary version of the symptom on connected ground. At minute 42 the two sides had made 30 and 13 Warbots, and had completed five and two trades. The Warbot and trade counts stayed there until minute 45 even as both sides gathered Fiber and produced some Alloy. Neither launched a new direct assault or march in that span. At minute 45 the leader had 12 of its 14 military units garrisoned and a Warbot selected at its Foundry. The other side had five military units, all garrisoned, and its Foundry had an Agribot order with no Chips in its hopper. The leader made three more Warbots and won at **47:40**. This gives a useful control for distinguishing a lull from a deadlock.

## A separate Islands stall with an idle Foundry

On Islands seed 17, each side's Warbot production counter was the same at minutes 20 and 55. The leader kept gathering and held 41 Alloy but had only seven army units and an idle Foundry. A diagnostic replay found the leader repeatedly entered bridge-saving mode. The AI's bridge planner refreshes the flag when it cannot pay for a crossing, and the production planner can then turn off the Foundry. The other colony's Foundry was waiting for Alloy. This case calls for testing a time limit on reserving resources for a crossing with no progress, particularly when the AI already has a Ferry. [Bridge planning and Foundry selection](../js/ai.js)

## Reproduction

All baseline runs used two Normal computer rivals in Versus with Capture victory, Rolling terrain, and Murmur and planetary events off. Resources were Normal unless specified. The headless simulation sampled one-minute snapshots starting at minute 10 and stopped on a winner or minute 55. Samples included mined and manufactured goods, Warbot production, army and garrison size, combat orders, foundry inputs, and Trade Terminal routes and sales. A run at the test cap is still unfinished in the game.

The stock runner outputs one line per minute. These commands reproduce the original Islands case and the water-free Standard Steward match.

```sh
node tools/headless-sim.js 21 normal 55 versus 1 2 2 3
node tools/headless-sim.js 64 normal 55 versus 1 2 2 0
```

| Map and size | Seed | Resources | Rivals | Trade Posts | Outcome |
| --- | ---: | --- | --- | ---: | --- |
| Standard, Small | 21 | Scarce | Steward / Warden | 2 | Won at 17:52 |
| Standard, Medium | 7 | Normal | Warden / Warden | 3 | Won at 22:00 |
| Standard, Medium | 19 | Normal | Steward / Warden | 3 | Won at 15:41 |
| Standard, Medium | 21 | Normal | Steward / Steward | 3 | Won at 18:20 |
| Standard, Medium, no water | 64 | Normal | Steward / Steward | 3 | Won at 19:00 |
| Standard, Medium, no water | 64 | Normal | Warden / Warden | 3 | Won at 27:45 |
| Standard, Medium | 83 | Normal | Steward / Steward | 3 | Won at 22:48 |
| Standard, Medium | 107 | Normal | Steward / Steward | 2 | Won at 14:04 |
| Standard, Large | 2 | Scarce | Warden / Warden | 3 | Won at 23:54 |
| Standard, Large | 43199 | Normal | Steward / Steward | 2 | Won at 37:05 |
| Chokepoint, Medium | 83 | Normal | Warden / Warden | 2 | Won at 47:40 after a production lull |
| Islands, Medium | 2 | Normal | Steward / Steward | 1 | Won at 13:14 |
| Islands, Medium | 5 | Normal | Steward / Steward | 3 | Won at 43:25 with both sides trading |
| Islands, Medium | 17 | Normal | Steward / Steward | 1 | Still open at 55:00, leader's Foundry idle |
| Islands, Medium | 21 | Normal | Steward / Steward | 3 | Still open at 55:00 with or without the intervention |
| Sky islands, Medium | 2 | Normal | Steward / Steward | 3 | Still open at 55:00, Warbot production continued after 45:00 |

The test runner starts player 0 as a Steward. For a Warden mirror I set player 0's doctrine to `turtle` before the first tick and used that doctrine for player 1 at setup. The other matches used the normal autoplay setup.

## Review priorities

1. Test an emergency one-deposit Mine fallback when Ore stock is low and no existing or pending Mine can cover the shortfall. Prefer a normal site if one exists. Retain reachable, safe, and affordable placement checks and rank isolated deposits by how much Ore they offer. Use seed 21 to test the economy recovery and several healthy games to check for extra redundant Mines.
2. Test whether a colony can establish a convoy before its critical inputs run out. Probe for an accessible Terminal site and a carrier when there is still enough Alloy and Chips to build them. Verify that the route imports the missing material and that the goods reach the Foundry or Ammo Plant. A post on a neighboring island requires a different recovery plan.
3. When stock and Warbot production look healthy, check how many armed units the AI can actually send, which targets it can reach, and what it lacks to cross or breach a defense. The earlier [Sky islands and garrison notes](../IDEAS.md#balance-decisions) already cover examples of those separate blockers.

For a diagnosis of the reported match, a save from around minute 45 would preserve the AI queues, stock, staffing, army orders, and exact trade routes. The seed and setup settings can reproduce the start.
