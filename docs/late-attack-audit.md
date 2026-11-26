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

## Suggested fixes and checks

1. Start with Ammo recovery. When a significant share of the army is unarmed, trace which Armory or garrison needs supplies. Prioritize delivering available Alloy to Armories, and replenishing Alloy when none is available. Check for practical resupply or rearm routes for troops in dry garrisons. Use Standard 25 to verify that both sides can get armed again sooner and resume pressure.
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
