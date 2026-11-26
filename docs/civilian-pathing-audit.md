# Worker and transport route audit

November 25, 2026. Tested deterministic scenarios on Standard Medium with a supplied enemy Pulse Turret and controlled road, rail and cliff layouts.

| Scenario | Result |
| --- | --- |
| Worker, Hauler, Freight Truck, Tanker and Road Train on a ground delivery | All five used the safe 41-step detour when it was available. The four vehicles stopped when the turret covered their only road. |
| Freight Truck returning to park after a turret came online | The parking task previously bypassed the danger check on its existing route. It now stops when its only route becomes unsafe. |
| Ramp beside a river with a distant crossing | Before the fix, dispatch chose a Worker three tiles away by straight line that had to walk 40 steps. A second Worker had an 8-step approach. Automatic dispatch and Call a builder now choose the 8-step route. Ramp approach selection also rejects work tiles under gun coverage, and nearby paving Workers are compared by their routes. |
| Freight Train with track through turret range | The rail planner still returns a route through the covered track. Road safety rules do not apply to trains. This is the most direct remaining safety gap in the scenarios tested. |

The road tests check routing and replanning against an actual supplied turret. They do not measure vehicle losses in a full battle. Ship, ferry and aircraft movement use separate navigation and danger rules and were outside the controlled scenarios. Cargo dispatch still favors nearby vehicles by straight-line distance after checking network reachability. A winding road can make a more distant vehicle the faster pickup, so arrival-time ranking is a separate performance follow-up.

Run `node tools/civilian-pathing-audit.cjs` for the fixtures. The rail case records current behavior for follow-up.
