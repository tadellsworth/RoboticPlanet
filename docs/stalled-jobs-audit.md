# Stalled jobs and failed orders audit

November 19, 2026. Tested [working-branch commit `43c3170`](https://github.com/tadellsworth/RoboticPlanet/commit/43c3170221c6b0be3bdf35342ced4081aab2cda6).

Follow-up on November 19. Fixed the two high-priority findings and the conflicting road warning. Local browser tests verified a split squad, a squad with no route, an isolated Hauler, and a cut road with an Ore delivery still reserved. The Worker guidance finding is open.

The most misleading feedback came from two actions the game acknowledged as moving forward. A factory predicted a delivery that dispatch could not assign, and a Warbot reported moving toward a destination it could not reach.

## Confirmed findings

| Priority | Reproduction and observed feedback | Proposed fix |
| --- | --- | --- |
| High | Give a staffed Smelter a road to Ore storage. Leave the only Hauler idle on a separate road network. **Why idle?** says “A Hauler should bring Ore soon.” After five game seconds of dispatch attempts it still had no job. Joining the road networks let dispatch assign it immediately. | Use the same carrier eligibility and network checks as dispatch. Point to the disconnected Hauler or road network. Reserve “on the way” for an assigned delivery. |
| High | Select an armed Warbot and issue a move to walkable ground across water with no crossing. The game plants a rally and says “1 warbot moving to hold that ground.” After ten simulated seconds the Warbot was still on its starting tile with the order active. A move on its own side worked. Right-clicking the water itself gave only generic targeting instructions. | Report “No route” for a blocked move. For a mixed squad, report how many units have a route. If a blocked order is kept for later, show that it is waiting and explain what can open the route. |
| Medium | Cut the only road between the freight route endpoints just after dispatch reserves Ore for a factory. While that reservation is held, the panel can say both “2 Ore are on the way” and “No road to storage.” The road panel correctly identified the one missing tile and its Cement cost. Reconnecting the road cleared the disconnected status. | Show interrupted or rerouting delivery status alongside the road warning. Reuse the carrier's current trip state so the diagnosis can distinguish an active detour from a loading reservation whose route is blocked. |
| Medium | With zero Workers, a factory's **Why idle?** correctly says to order more. **Call a worker** instead says to build a road, ramp, or bridge. With one able but isolated Worker, the factory gives no additional diagnosis, and the supply-chain trace predicts a free Worker should be on the way. **Call a worker** did recognize the unreachable case. Adding a reachable Worker in the zero-Worker fixture produced the expected confirmation and staffing assignment. | Share the staffing diagnosis between the panel and the button. Distinguish no Workers, no eligible Workers, all suitable Workers blocked, and a Worker assigned to the trip. |

## Verification

- Ran controlled browser fixtures against the actual dispatch loop, building panels, **Call a worker** button, and map command handler in local headless Chromium. No page errors were recorded. The map fixtures made each route and stock level explicit.
- A separate UI fixture for a recharging Worker with no fueled station showed the Fuel Station cause and a **Build a Bio Farm** action where no Fuel producer existed. This exercised the displayed guidance with controlled recharge state.
- Scope covered road freight, staffing, recharge guidance, and Warbot movement. Freight by rail, sea, Maglev, and air, and latency during multiplayer orders, need their own player-facing checks.

## Code for follow-up

- [Freight and staffing diagnoses](../js/insight.js#L79-L126) and [carrier reachability](../js/sim.js#L2985-L2990).
- [Call a worker](../js/sim.js#L3142-L3174) and [its button feedback](../js/ui.js#L6569-L6575).
- [Move order acceptance](../js/sim.js#L7710-L7721), [command results](../js/orders.js#L233-L256), and [the move confirmation](../js/ui.js#L2526-L2560).
