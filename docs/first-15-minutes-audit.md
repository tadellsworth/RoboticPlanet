# First 15 minutes audit

November 19, 2026. Used fresh local Chromium profiles with a touch-sized viewport for **Touchdown** and a desktop viewport for **Custom Game → Colony**. The test used the normal menus, build controls, map taps or clicks, and **Lay road**. It selected valid map tiles programmatically and advanced game ticks between actions.

## What worked

- **Touchdown** highlighted **Build**, showed a **Build here** confirmation on touch, and recognized the Harvester site before it was finished. When the site had no road, its panel named the problem and showed a **Lay road** button with the cost. The scene produced 8 Fiber and completed the Normal mission at 1:45 game time. The results offered **Next mission**.
- In a Standard Colony on Planet #43199, a deliberately disconnected Harvester offered a seven-tile road for 1.4 Cement. The road was built, the Harvester was staffed, and Fiber was produced in the first in-game minute. Command Base Fiber rose from 16 at 1:00 to 28 at 3:00. At 15:00 the colony was still running.
- With Active Murmur enabled, the Colony displayed a warning before the first night and later identified tunnel exits near the Command Base and the Harvester. The warning remained available in the messages list.

## Usability findings

| Priority | Observed experience | Proposed improvement |
| --- | --- | --- |
| High | The fresh main menu's primary **Play** action is set to a Normal Versus game with Active Murmur. The coached landing starts through **Missions → Touchdown** in the secondary links. | Give fresh players a visible **Learn to play** or **Start tutorial** choice beside **Play**. Route it to Touchdown. |
| High | The Custom Colony briefing explains the Murmur, Trade Posts, and Uranium. It gives no short first-build sequence. The first dusk warning says to bring bots in and man the guns. A colony that has only built its first production site has little guidance on how to get defenses online. | Give the freeform landing a short recommendation such as Harvester → road → Fiber. When defenses are missing near dusk, name one reachable next action, such as building and supplying a Pulse Turret. Explain what the player needs before pointing them to the build tool. |
| Medium | On a touch-sized screen, Touchdown's briefing still says “Space pauses, H finds your base,” and shows keyboard letters in its build sequence. The touch path itself worked. | Give touch players the actual tap targets in the briefing. Keep mouse and keyboard shortcuts in the desktop briefing. |
| Lower | Immediately after placing an unconnected site, its opened road panel briefly said **Linked to storage** before the first dispatch update switched it to **No road to storage**. | Initialize the road status when placing the site or display “Checking road access” until the first check. |

The run covered the first production and delivery loop, recovery from a missing road, and notice of the first Murmur night on one seed. It did not measure how long a human beginner takes or test the entire early production chain, defenses, real phones, other map seeds, or first-session Versus balance.
