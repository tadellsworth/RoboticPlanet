# Late-game rival attacks and reinforcements

November 26, 2026. Replayed the two long cases from the [four-colony audit](four-colony-ai-audit.md), then sampled 1v1s on working-branch revision `50bb4de`. All games were Medium Versus with the default Rust biome, Active Murmur, Capture victory, Megastructures and Nuclear Race on, and Planetary Events off. Difficulty was Normal and doctrine was Balanced except where shown. Times are simulation minutes.

## Four-colony replays

| Map and seed | Earlier revision `572588d` | Current revision `50bb4de` | Final pair since, earlier / current |
| --- | --- | --- | --- |
| Standard 25 | Colony 3 at 64.56 | Undecided at 75.00, Colonies 1 and 4 alive | 26.85 / 47.99 |
| Crossroads 21 | Colony 4 at 56.33 | Colony 1 at 35.32 | 17.19 / 16.99 |

- **Standard 25.** In the earlier game, Colony 3 produced zero army units between the minute-30 and minute-40 checks while Foundries waited for Chips. It resumed production and launched four base storms from 48.47 onward. In the current game the final pair started at 47.99 and the first base storm between them came at 73.37, with six units from Colony 1. Both sides kept producing units during the duel. At minute 70 they had 11 and 8 armed units, but only 1 and 3 qualified as ordinary rally candidates at the opposing base. Both were trying to assemble 12. Colony 1's measured building hits stayed at 52 from minute 50 to the cap. Colony 4 continued smaller raids and dealt some building damage. Their home areas shared a ground zone, which establishes broad connectivity. The trace does not establish why every unit failed individual rally eligibility or whether the last storm would have eventually connected.
- **Crossroads 21.** The earlier finalists were still attacking at minute 53 and the winner stormed with ten at minute 55.38. In the current game Colony 4 last launched a ground attack at 20.94 and added no army units from minute 25 through minute 35. All three Foundries showed missing inputs and zero incoming Alloy or Chips at the 25-, 30- and 35-minute checks. Two captured Foundries had zero Alloy in their hoppers despite 11 Alloy and 5 Chips available on their freight network. The original Foundry had no supply of either on its network. The trace shows both an isolated Foundry and a delivery problem on the connected network. It does not identify the precise dispatch decision responsible for the latter. At minute 30 all 11 surviving units were armed and garrisoned, and only three qualified for an ordinary rally toward the enemy base. Colony 1 stormed with six at 34.10.

These comparisons span multiple commits. They do not isolate one change as the reason a seed finished sooner or later.

## 1v1 results

| Map and seed | Rival settings | Colony 1 stance | Winner | Time |
| --- | --- | --- | --- | ---: |
| Standard 11 | Normal, Balanced | Regular AI | Colony 1 | 25.65 |
| Standard 25 | Normal, Balanced | Regular AI | Colony 1 | 42.37 |
| Long haul 21 | Normal, Balanced | Regular AI | Colony 2 | 23.81 |
| Crossroads 21 | Normal, Balanced | Regular AI | Colony 1 | 12.52 |
| The Hollow 11 | Normal, Balanced | Regular AI | Colony 2 | 32.39 |
| Standard 11 | Normal, Balanced | Hold from minute 12 | Colony 2 | 56.54 |
| Long haul 21 | Normal, Balanced | Hold from minute 18 | Colony 2 | 47.35 |
| Standard 25 | Hard, Warden | Hold scheduled at minute 18, match ended before switch | Colony 2 | 15.78 |
| Standard 25 | Hard, Warden | Hold from minute 10 | Colony 2 | 21.29 |

Colony 2 used its regular AI in every game. The hold variant suppresses Colony 1's normal offensive decisions after the switch while keeping its economy, staffing and local defense. Orders already issued can continue. This models a defending opponent, and it does not reproduce human planning or an actual match save. Both replays with extra input telemetry reproduced the original results.

- **Out of Ammo, Standard 25.** At minutes 25, 30 and 35, Colonies 1 and 2 had seven and six army units respectively. All were unarmed in dry garrisons. Both had zero available Ammo and both Armories were waiting for Alloy. Neither side launched a colony-targeted attack or registered additional ground building hits between minutes 25 and 40. The production rule in `aiThink` deliberately switches Foundries out of army mode once the unarmed count reaches the greater of four units or one-third of the army. That is useful while Ammo is coming, but in this replay the entire standing army was unusable for three consecutive samples. Some units had rearmed by minute 40. Colony 1 stormed with six at 41.47.
- **Out of replacements, Standard 11.** Colony 2 last launched a ground attack at 19.20. From minute 20 to 25 its surviving army went from seven to two, with no new units. Its Foundry waited for Chips and colony Chip stock stayed at zero at both checks. Over the same interval Colony 1's cumulative army production went from 20 to 34 before a seven-unit storm at 24.53.
- **The rival can recover against a defender, but with long gaps.** On Standard 11 with a hold at minute 12, Colony 2 went from 25.77 to 36.90 without launching a new attack on Colony 1. It recovered from five armed units at minute 35 to nineteen at minute 40 and ultimately stormed with seventeen. On Long haul 21 with a hold at minute 18, Colony 2 produced no army units from minute 25 to 30 and had zero ordinary rally candidates at minute 30 despite seven armed units. Its last successful storm of eleven launched at 45.07. The Hard Warden ended both Standard 25 runs before minute 22, so those runs do not test its late-game behavior.

## Ammo recovery follow-up

Rival freight dispatch now gives the next batch of Alloy and Cement for built Ammo Plants, and the first reloads for dry garrisons, priority when at least four units and at least a third of the army are waiting unarmed in garrison. Fuel and Crystal weapons do not trigger the rule. Emergency Fuel Station and Repair Station deliveries still come first. Priorities are calculated from the current simulation state and use the existing freight and reloading systems.

On Standard 25 in 1v1, the first new attack after minute 20 launched at **30.53**, down from **41.47**. At the minute-30 check, Colonies 1 and 2 had seven and two armed robots respectively, up from zero each. Colony 1 fell back to zero armed at minute 35 and had five at minute 40. This fixes part of the prolonged Ammo drought. A rival can still run low again, and Colony 2 did not launch a new attack after minute 20 in this replay. The winner stayed the same and the full match ran 3.16 minutes longer.

| Map and seed | Setup | Before | After |
| --- | --- | --- | --- |
| Standard 11 | 1v1 | Colony 1 at 25.65 | Colony 1 at 25.65 |
| Standard 25 | 1v1 | Colony 1 at 42.37 | Colony 1 at 45.53 |
| Long haul 21 | 1v1 | Colony 2 at 23.81 | Colony 2 at 23.81 |
| Crossroads 21 | 1v1 | Colony 1 at 12.52 | Colony 1 at 12.52 |
| The Hollow 11 | 1v1 | Colony 2 at 32.39 | Colony 2 at 32.39 |
| Standard 11 | 1v1, Colony 1 holds from minute 12 | Colony 2 at 56.54 | Colony 2 at 51.76 |
| Long haul 21 | 1v1, Colony 1 holds from minute 18 | Colony 2 at 47.35 | Colony 2 at 43.97 |
| Crossroads 21 | Four colonies | Colony 1 at 35.32 | Colony 1 at 35.32 |
| Standard 25 | Four colonies | Undecided at 75.00 | Colony 1 at 52.44 |

All nine runs finished. On four-colony Standard 25, the finalists started their duel at 47.09 and the first base storm between them launched at 48.03. Before the fix, the duel started at 47.99 and the first storm launched at 73.37. To reproduce these runs, use the commands below and replace `50bb4de` with `-` to run the current checkout.

The dispatch regression uses one Hauler and competing Foundry and Ammo Plant orders. It checks that the rival delivers only the next batch first, redirects ready Ammo to the waiting garrison, and makes the same dispatch with the same seed and state hash. A smaller shortage and an identical human-controlled setup both keep the normal delivery order.

## Foundry follow-up

- **Crossroads 21, four colonies:** At minute 30 Colony 4 had two staffed Foundries on a captured road network with 11 Alloy and 5 Chips. None of its Haulers could make the trip on that network. The original Foundry was on a separate network with neither part. Dispatch had treated both captured Command Bases as home storage, so the existing off-network Worker fallback did not apply.
- **Fix:** A rival short of the next Foundry input can use a spare Worker for one unit on a short local trip if no Hauler or Freight Truck serves that route. The dispatcher checks both walking legs for safety, keeps the existing builder reserve, and uses current world state. The focused regression verifies routing on a split network, usual Hauler preference, the builder reserve, human dispatch and deterministic results.
- **Crossroads replay:** Colony 1 still won, at 30.48 minutes instead of 35.32. Colony 4 made 33 army units by minute 25 and remained at 33 at minute 30, versus 34 at both checkpoints before. The fix closes the local delivery gap, while the replay still shows a late reinforcement gap. The fix cannot move parts between disconnected islands of the road network or replenish exhausted stock.
- **Standard 11, 1v1:** Colony 1 still won at 25.65. The minute-by-minute trace confirmed that Colony 2 burned through local Crystal. Its active Stone-for-Chips contract supplied only small amounts, and sample-time dispatchable Chip stock was zero even while the Foundry had Alloy. The new Crystal Tap was working by minute 23. There was no Warbot replacement from minute 20 through the minute-25 check. This calls for a separate supply fix.
- **Standard 25, 1v1:** Colony 1 still won at 45.53. In a separate trace of the existing Ammo-fix revision, the four-colony Standard 25 winner already had ten armed units in the field at minute 48, including a group holding, units moving to garrisons, escorts and a looter. Ordinary rally counted only three additional garrison slots. Both sides' occupied garrisons were in the target ground zone at the minute-48 through minute-52 checks. The winner launched two storms in the final duel and finished at 52.44. This replay gives no basis for lowering the defense reserve.

## Crystal, Ammo and returning troops

### Crystal and Chips

The reserve forecast counted Crystal under enemy fire, although Taps avoided those tiles. At the normal construction limit, the urgent Trade Terminal and emergency supply building rules could also block each other. The forecast now counts safe deposits, either urgent job can qualify for the extra slot, and a shortage makes the trade planner weigh how much Crystal or how many Chips a shipment actually brings back.

On Standard 11, Colony 2 went from zero new army units during minutes 20–25 to 13. It gained 19 Chips over that interval versus five before, as measured by the simulation's made-goods counter, which includes trade. It still used a Stone-for-Chips route, so the improvement in this replay cannot be attributed to upgrading its contract. Its last rival-building hit moved from 19.49 to 26.33, with separate contact episodes beginning at 21.30 and 23.66. The small replay set does not establish a general balance change.

### Sustained Ammo

On the original Standard 25 1v1, Colony 1 dealt building damage in four episodes, beginning at 12.78, 30.83, 42.70 and 45.45. During the second Ammo drought the colony made no Alloy between the minute-31 and minute-36 snapshots. Cement sat in the Ammo Plant hopper, and there was no Alloy in the hopper or incoming at minutes 32–36. The Smelter reported waiting for Ore at all six samples even though the colony showed 6–7 Ore in stock. Its hopper held at most one Ore, short of the two it needs. The earlier rearm priority can redirect available Alloy. This spell was upstream of the Ammo Plant, and the trace does not establish whether the Ore had a safe freight route. A trial that let two dry Warbots trigger emergency priority for a small army produced identical traces on the revised Standard 25 and Standard 11 replays. The existing threshold stays in place.

### Returning troops

On the baseline Standard 25 final duel, individual garrison-return and convoy escort orders appeared for at most two consecutive one-minute samples. After the Crystal change, the longest garrison-return streak was one sample and the longest escort streak was two. In both replays the longest rally hold was three samples, and one Warbot was seen looting over three consecutive samples. These snapshots cannot distinguish repeated loot trips from one slow trip. The existing logic sends escorts home when the convoy ends and stops repeat looting when a storm is forming. There was no persistent stranded return order in either trace, so order rules stayed as they were.

On the baseline final duel, Colony 1's first building damage against the remaining rival came about 2.05 minutes after the duel began. On the revised final duel, Colony 2 dealt damage 4.34 minutes after it began, then began its next damage episode 2.69 minutes after the previous one ended. These are different finalists, so compare the gaps as observations rather than an isolated effect of logistics.

| Map and seed | Colonies | Before `d9bf339` | With Crystal changes |
| --- | ---: | --- | --- |
| Standard 11 | 2 | Colony 1 at 25.65 | Colony 2 at 26.33 |
| Standard 25 | 2 | Colony 1 at 45.53 | Colony 1 at 17.32 |
| Long haul 21 | 2 | Colony 2 at 23.81 | Colony 2 at 23.81 |
| The Hollow 11 | 2 | Colony 2 at 32.39 | Colony 2 at 32.39 |
| Standard 25 | 4 | Colony 1 at 52.44 | Colony 2 at 26.08 |
| Crossroads 21 | 4 | Colony 1 at 30.48 | Colony 1 at 31.40 |

Set `TERRAFALL_PRESSURE_TRACE=1` before the runner command to sample every minute and include production totals, Armory and Smelter inputs, trade routes, armed field orders, and building damage episodes. Episodes group positive rival-building hits no more than one minute apart. They omit combat that hits only units and damage paths outside the instrumented function. Replay the old Standard 25 1v1 with `d9bf339` to observe the second Ammo drought. The revised match finishes before that interval.

## Suggested fixes and checks

1. If a rival still stays dry, trace whether it can produce or import Alloy and whether the garrison has a practical resupply or rearm route. Use Standard 25 to verify that both sides can sustain pressure after the first reload.
2. Triage starving Foundries. Distinguish no stock, disconnected stock and connected stock with no scheduled delivery. Prefer a viable Foundry when replacing losses, or repair the network serving the one the rival already has. Check Standard 11 and the captured Foundries on Crossroads 21.
3. When a rival has a sustained lead, trace which armed units are reserved, assigned or unreachable before changing rally thresholds. Preserve the defense reserve and try a concentrated attack only when a useful force can assemble and reach its target. Standard 25 four-player is the regression case, with the other seeds kept as controls against weaker defense or longer games.

## Reproduce

The headless trace runs the real simulation and reports successful raid, attack and rally decisions, not their arrival. The hit counter covers positive calls through the building-damage function and excludes effects that bypass it. Inventory, garrisons, Foundry inputs and rally eligibility are sampled every five minutes.

```sh
node tools/late-attack-audit.js Standard 25 4 75 572588d
node tools/late-attack-audit.js Standard 25 4 75 50bb4de
node tools/late-attack-audit.js Crossroads 21 4 75 572588d
node tools/late-attack-audit.js Crossroads 21 4 75 50bb4de
node tools/late-attack-audit.js Standard 11 2 65 50bb4de
node tools/late-attack-audit.js Standard 25 2 65 50bb4de
node tools/late-attack-audit.js 'Long haul' 21 2 65 50bb4de
node tools/late-attack-audit.js Crossroads 21 2 65 50bb4de
node tools/late-attack-audit.js 'The Hollow' 11 2 65 50bb4de
node tools/late-attack-audit.js Standard 11 2 65 50bb4de normal balanced 12
node tools/late-attack-audit.js 'Long haul' 21 2 65 50bb4de normal balanced 18
node tools/late-attack-audit.js Standard 25 2 65 50bb4de hard turtle 18
node tools/late-attack-audit.js Standard 25 2 65 50bb4de hard turtle 10
```
