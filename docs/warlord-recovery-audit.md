# Why Warlord stopped building an army on Standard

**The colony lost both working Ore Mines. Its replacement Mine sat on a road that haulers correctly refused to use because hostile units covered the site. The construction planner kept counting that blueprint as a solution to the Ore shortage.** Buildings continued going up intermittently, while military production effectively stopped.

## Evidence from Standard seed 11

Medium Standard, Balanced doctrine, Warlord, Capture victory, two computer colonies. Colony 1 switched to a defensive hold at minute 12. Colony 2 is the rival under examination. Both had Warlord's starting bonuses before the hold. Times are simulation minutes. The ordinary duel on this seed ended in a Colony 1 victory at 14.50, so the hold let us observe what the losing side did with an extra hour.

| Minute | Colony 2 observation |
|---:|---|
| 10 | Two completed Mines both reported enemies nearby. Only two army robots remained armed. |
| 12 | Both Mines were gone from its completed buildings. Replacement Mine 309 at (26, 21) had a road to base, with two Fiber and two Cement assigned for delivery. Its Trade Terminal site had no road to storage. |
| 15 | Mine 309 still had no materials. The delivery reservations had cleared. The site was road-connected, but the simulation marked it unsafe because hostile units were nearby. |
| 20 | The Mine remained unsafe with no deliveries or progress. The base itself held 151 Fiber and 45 Cement. The colony had 16 Workers and six Haulers. Its Mine, Tap, Depot and Outpost sites were all unsafe. The planner recognized low Ore, counted four open sites against a cap of four, and identified zero emergency gatherer builds. |
| 25–30 | By 25 the army was gone. At 30 the Foundry had one Alloy, zero Chips, no incoming parts and no spare parts on its freight network. Mining remained at the same cumulative 74 Ore as at minute 12. |
| 75 | Cumulative building completions rose from 36 at minute 15 to 49. Military production rose only from 14 to 16 over the same hour. No army survived. The Foundry had neither parts nor an incoming shipment. |

### Where the decisions disagree

- Freight dispatch excludes unsafe buildings before assigning deliveries (`js/sim.js:1980`). This protects civilians. A site can be physically connected to the Command Base and still be ineligible for a single delivery.
- The emergency Mine/Tap check treats a site as viable if it is recent **or** its `unlinked` flag is false. It does not check danger or actual delivery progress (`js/ai.js:725–736`). Mine 309 passed that check long after its reservations vanished.
- The road-repair loop focuses on sites outside the home network. Its four-minute abandonment rule requires an unlinked site (`js/ai.js:4580–4607`). The other stale-site check looks for missing goods with zero colony stock (`js/ai.js:529–540`). The Mine fell between these checks because it was connected and materials were plentiful. Its blueprint and the other unfinished sites consumed construction capacity (`js/ai.js:861–869`).
- Trade did not rescue the colony during the initial collapse. Its first Terminal was still unconnected at minute 12 and absent from the construction list by 15. At minute 20 the planner's urgent-trade flag was false despite low Ore. The Terminal planning rule gives special priority to imminent Crystal or Fuel shortages (`js/ai.js:584–590`), while the contract selector can request Ore only after a Terminal exists (`js/ai.js:3863–3869`).

### Difficulty verification

Warlord has the largest work multiplier (1.6), shortest base grace period (100 seconds), lowest base attack threshold (three), most normal construction slots (four), fastest decision interval (one second) and largest starting-stock bonus (+12 per starting good). Both computer players receive these settings in this scenario (`js/defs.js:1888–1894`, `js/world.js:3024–3028,3047,3122`, `js/sim.js:74–84`). It is the highest configured level. One Warlord losing to another cannot establish its win rate against a human or a lower difficulty.

### Replay and diagnostic controls

The ordinary trace can be reproduced with `TERRAFALL_ECONOMY_TRACE=1 node tools/late-attack-audit.js Standard 11 2 75 - warlord balanced 12`. The additional observations above sampled the construction planner after each decision and recorded site IDs, danger, road connectivity, deliveries, inventories and worker counts at one-minute checkpoints. Measurements used the working-branch simulation at `34a1bec`.

Each seed-11 replay started identically and used the same defensive hold. The two interventions below began at minute 15 and ran to minute 30 in temporary test harnesses. Attack decisions, difficulty and unit costs stayed the same.

| Colony 2 result at minute 30 | Original | Release unsafe sites | Supply Ore and Crystal |
|---|---:|---:|---:|
| Completed buildings, cumulative | 36 | 44 | 48 |
| Ore mined, cumulative | 74 | 143 | 165 |
| Crystal gathered, cumulative | 36 | 78 | 98 |
| Army robots produced, cumulative | 14 | 31 | 65 |
| Army alive / armed | 0 / 0 | 8 / 7 | 27 / 24 |
| Hits on enemy colony buildings, cumulative | 0 | 10 | 21 |

**Release unsafe sites.** Once a minute, Colony 2 abandoned Mine, Tap, Depot and Outpost sites more than three minutes old that were currently unsafe, with no construction progress and nothing incoming. Each abandoned location went on the existing placement-avoidance list for four minutes. The test provided no goods and ordered no attacks. The AI resumed extraction, rebuilt its army and issued an attack on an enemy Mine at 29.64. This establishes that releasing this group of stalled sites was sufficient for recovery on this seed. It does not establish that removing Mine 309 alone would be sufficient or that a three-minute timeout is optimal.

**Supply Ore and Crystal.** A separate diagnostic supplied six Ore and six Crystal per minute to Colony 2's Command Base from minute 15. Its economy processed those raw inputs and its normal AI resumed attacks. This isolates raw-material access as a bottleneck. Free goods would mask the problem in gameplay.

**Map control.** On Standard seed 21 with otherwise identical settings, Colony 2 won at 11.79, before the scheduled hold. That run verifies Warlord can finish an early advantage. It provides no evidence about recovery after a defeat.

**Recommended change.** Make an unsafe site earn its place in the recovery plan through recent delivery or construction progress. If danger persists and progress stops, try a safe alternative and avoid immediately choosing the same location. Preserve sites with active deliveries or a brief threat, and keep haulers' safety checks. Use seed 11 to test for renewed extraction, military production and contact with the opponent, alongside games where a temporarily threatened site should survive. The interventions above establish recovery through minute 30 only.
