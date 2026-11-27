# Do Standard-map rivals keep fighting?

Tested November 27, 2026 against the simulation on the working branch at `86ab2103`. The first ten regular Standard games all finished by 30.26 simulation minutes. That is encouraging for ordinary matches, but only one of those games reached minute 30. Games against a defender provide a separate test of whether a surviving rival can exploit a lead.

## First fix to test

**A Fiber reserve for construction can starve the military economy while the Smelter already has its ingredients.** On Standard seed 11 against a defender, Settler's last recorded hit on a colony building was at 14.64. At 26.39 the Fiber conservation rule paused its only Smelter. A replay of the pause call recorded two Fiber in general supply, two more inside the Smelter and six Ore in its hopper. At minutes 30, 35 and 40 it was still paused while its Foundry waited for Alloy. At minute 40 the Smelter held six Ore and six Fiber, the Mine was full, and the colony had zero available Alloy. At minute 75 its two surviving army robots were unarmed. It had produced just three army robots over the entire game.

The pause uses `playerGoods`, which excludes ingredients already loaded into production hoppers. The reserve protects Fiber for building, but stopping the Smelter also prevents it from consuming Fiber already committed to smelting. Test permitting a loaded batch to finish when usable Alloy is exhausted, while reserving undelivered Fiber for construction. Verify both recovery of Alloy production and completion of a Fiber-starved construction site. This explains the measured production interruption. An outright win for Settler against the much larger defender is a separate question. See `js/ai.js:774–788` and `js/sim.js:1191–1199`.

## Two other reproducible decision problems

1. **A colony can recognize a winning opportunity and then wait for reinforcements it cannot build.** When both colonies run out of parts, the outer decision allows a march with four armed robots against two. The march planner then reapplies a floor of twice the enemy army plus two. In an isolated call to the actual planner with four eligible attackers, two enemies, a local target requirement of two and no covering guns, it requested eight attackers and sent none. This applies to Pioneer and above. It matters when the target is beyond ordinary attack range. A nearby target can be attacked by a different path. Carry the depleted-economy decision through target selection while preserving the real garrison, gun and wall checks. Add paired tests for an exposed target and one covered by heavy guns. See `js/ai.js:1257`, `1420`, `1435`, `4124`, `4159` and `4182`.
2. **Weather targeting can keep resetting the deadline for a base assault.** Both the Atmospheric Engine and the ground march use the colony's `stormT`. An isolated call to the real weather routine at simulation second 1800 moved an existing assault timestamp from 1700 to 1800, even when it found no useful weather target. Repeated checks can make the army keep waiting for an ideal assault instead of switching to a cheaper fort after four minutes. A march can also clear the weather timer. Give the two decisions independent clocks and test that repeated weather evaluations leave the assault deadline intact. This interaction is confirmed in code and the isolated probe. Its frequency in ordinary matches was not measured. See `js/ai.js:3049–3058` and `4151–4153`.

## What was measured

Each level played seeds 11 and 25 in a two-colony Standard duel. A third run per level repeated seed 11 with Colony 1 put on hold at minute 12. Colony 2 continued running its ordinary AI. One Colonist Long haul duel provides a map comparison. All used Medium size, Balanced doctrine, Versus, Capture victory, active Murmur, nuclear race and megastructures enabled, events disabled, and a 75-minute cap.

The hold is a repeatable defensive opponent. Its economy and local defenders keep running, but the passive flag also skips later decisions such as choosing new trade contracts. It does not simulate a skilled human fortifying and counterattacking. Results describe these seeds and this doctrine. Short wins do not exercise late-game recovery.

To reproduce any regular row, run `TERRAFALL_PRESSURE_TRACE=1 node tools/late-attack-audit.js Standard 11 2 75 - normal balanced` with the corresponding shape, seed and difficulty. Append `12` for a hold. The difficulty keys in ascending order are `easy`, `medium`, `normal`, `hard` and `warlord`.

The last columns show C1/C2. Orders count newly recorded attacks, raids, marches and storms from minute 30 onward, including attacks on Murmur burrows. The contact gap is the longest interval from minute 15 through the end with no recorded hit on an enemy colony building, in minutes. The tracer merges contact runs separated by at most one minute. Neither measure captures every engagement with enemy robots, and a force can still be fighting on an earlier order.

| Map | Seed | Difficulty | Colony 1 | Winner | End (min) | New orders after 30 | Longest building-contact gap after 15 |
|---|---:|---|---|---|---:|---:|---:|
| Standard | 11 | Settler | Regular | C1 | 23.66 | — | 5.9/8.7 |
| Standard | 25 | Settler | Regular | C1 | 18.44 | — | 1.3/3.4 |
| Standard | 11 | Settler | Hold at 12 | Undecided | 75.00 | 3/0 | 41.3/60.0 |
| Standard | 11 | Pioneer | Regular | C2 | 30.26 | 0/0 | 9.5/10.3 |
| Standard | 25 | Pioneer | Regular | C1 | 28.64 | — | 10.5/7.1 |
| Standard | 11 | Pioneer | Hold at 12 | Undecided | 75.00 | 1/20 | 32.8/24.1 |
| Standard | 11 | Colonist | Regular | C1 | 19.98 | — | 2.5/5.0 |
| Standard | 25 | Colonist | Regular | C2 | 23.50 | — | 8.5/3.5 |
| Standard | 11 | Colonist | Hold at 12 | C2 | 27.05 | — | 12.1/4.1 |
| Standard | 11 | Commander | Regular | C2 | 19.20 | — | 4.2/1.7 |
| Standard | 25 | Commander | Regular | C1 | 8.06 | — | —/— |
| Standard | 11 | Commander | Hold at 12 | C2 | 19.90 | — | 4.9/2.6 |
| Standard | 11 | Warlord | Regular | C1 | 14.50 | — | —/— |
| Standard | 25 | Warlord | Regular | C1 | 6.55 | — | —/— |
| Standard | 11 | Warlord | Hold at 12 | Undecided | 75.00 | 3/0 | 27.1/60.0 |
| Long haul | 11 | Colonist | Regular | C2 | 44.07 | 1/2 | 29.1/29.0 |

## Interpreting the matches

- **Pioneer kept fighting.** In the capped defensive run, its cumulative production rose from 16 army robots at minute 30 to 71 at minute 75. It issued 20 attacks or raids after minute 30 and landed 49 building hits between 72.40 and 74.61. The defender still had 42 armed units against its 15 at the cap. This is a failure to overcome a larger defending force, with clear evidence of continued effort.
- **Warlord failed to rebuild after an early defeat.** The attacking colony had only three army units left at minute 10, before the defender was put on hold. It had produced 14 army units by minute 15 and only 16 by minute 75. It ended with zero army, ten Ammo, and zero available Ore, Alloy or Chips. Its Foundry had neither parts on its network nor incoming shipments. Raising aggression cannot help an empty army. Reproduce the recovery problem with this seed and trace access to replacement Ore and Chips, including whether expansion, trade or salvage can supply the Foundry. The precise decision that prevented recovery remains unverified.
- **Long haul showed a different delay.** Colony 2 produced 18 army units by minute 25 and only 19 by minute 40. At the minute-35 sample it had 12 armed units, four available for an ordinary rally toward the enemy base, and a massing target of 22. It eventually launched a ten-unit storm at 41.97 and won at 44.07. A period without building damage alone would have misclassified its raids and buildup as inactivity.

The difficulty schedule keeps calling the AI while the colony is alive. Settler takes a turn roughly every three simulation seconds and Warlord every second, subject to scheduling. The observed collapses concern what the colony can produce and field. A universal attack-frequency increase would do little for the two armies that ran dry. See `js/sim.js:71–85` and `js/defs.js:1888–1894`.
