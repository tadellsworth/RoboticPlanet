# Terrafall AI and mission fixes

November 19, 2026 · `codex/working-branch`

The AI work started from the merged Express highways, Mass Driver, and war scars revision `d56b30e`. The branch later picked up Claude’s shared-colony co-op changes in merge `5ea98dc` before the mission edits. The branch is the review destination for all five fixes.

## AI stalemates and team fairness

| Commit | What changed | Key result |
| --- | --- | --- |
| `1f03b30` | The AI retires a disconnected construction site after four idle minutes if it is waiting for a planned road and has no work or deliveries underway. This frees a build slot for reachable projects. | Hollow Medium seed 11 went from open at 75:00 to **35:29, Colony 2**. Hollow Medium seed 12 went from open at 60:00 to **42:13, Colony 2**. |
| `c76c189` | A winning rival needs the estimated full assault force to storm a base under heavy gun cover. The smaller finishing attack remains available under light cover. | Current Hollow Small seed 25 stayed at **24:04, Colony 2**. The historical replay held back an undersized storm and still reached 75:00 without a winner. |
| `7474af6` | Ore-starved island rivals can work one reachable deposit when a two-deposit Mine site is unavailable. On Ore-poor islands, the first Port can get an extra build slot, and first-Ferry parts take priority before a bomber Airfield. | Islands Medium seed 21 went from open at 55:00 without a Ferry to **20:53, Colony 1**, after four landings. Seeds 2, 5, and 17 kept their original finish times and winners. |
| `51b8a43` | Team AI targets enemies and can send spare Warbots against raids on allied land. Tied AI turns rotate and unit and building update order alternates. New team maps use mirrored Trade Posts or a nearly equally reachable shared post where terrain permits. | Across 60 starts, the largest measured trade-access gap fell from 11 to one walking tile of effort. Across 12 matches, friendly attack orders fell from 136 to zero, the AI sent 26 allied counter-groups, and the win split went from **9–3 to 6–6**. |

All 12 revised team matches finished. Crossroads Small seed 4 ran **65:43**, up from 20:38, and Long Haul 2v2 Medium seed 9 ran **50:02**, up from 30:56. The six non-team controls in the final round kept their original durations and winners.

The AI changes are in [js/ai.js](../js/ai.js) and [js/sim.js](../js/sim.js). The [seeded AI test report](ai-stalemate-fixes.md) has before-and-after durations, winners, setup, historical replays, and save checks. Smoke and help-coverage tests passed before each AI push. The final AI fix also passed the army pathing check and focused ally-defense and save-replay checks.

## Mission text, highlights, and order

Commit `8594ed7` updated [js/missions.js](../js/missions.js) and the mission coach in [js/ui.js](../js/ui.js).

- Shortened Harbour goal 4, Airlift goal 4, Hold the Line goal 2, Siege Breakers goal 4, and King of the Hill goals 2 and 3. Every mission hint now fits the 110-visible-character limit.
- Set Harbour goal 4 to target **Port**. The coach still points to the first Port for **Shipyard** and the first supply order, then switches to the new Port once the first has eight Alloy.
- Set Airlift goal 1 to target **Bot Foundry**. When the Crawler rolls out, the coach points to it and highlights **Drive somewhere** and **Deploy here**. Airlift’s hint names both controls. King of the Hill’s first goal also highlights **Lay road**.
- Moved **King of the Hill** into **War** immediately before **Final Descent**, which again closes the campaign. All 33 saved mission IDs were preserved, and each chapter appears in one contiguous block.
- Updated the README, in-game How to Play, and illustrated guide to match the campaign order.

The [headless mission data test](../tools/mission-data-test.js) covers hint lengths, target types, affected controls, the two staged pointers, chapter order, and saved IDs. Run it with `node tools/mission-data-test.js`. It and `node tools/help-coverage-test.js` both passed.

The [working branch log](working-branch-log.md) also records the earlier audits and features from this chat.
