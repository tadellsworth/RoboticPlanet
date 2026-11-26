# Warbot order and pathing audit

November 25, 2026. Audited working-branch revision `3e8c494` using deterministic headless scenarios. The order scenarios go through the same `command` handler as a map click. The Bulwark scenario runs the normal shield assignment before evaluating firing cover.

## Findings in priority order

| Finding | Reproduction | Proposed change |
| --- | --- | --- |
| A new ground move can follow an old Hunt | Hunt a Warbot on tile (23, 20), then order a ground move to (23, 21). The move reports one unit sent, but it reuses the adjacent hunt flag. When the enemy moves four tiles east, the flag follows it to (27, 20). | Keep plain move flags separate from Hunt, Attack and other special flags. Test that a new move leaves other units on their original Hunt and respects the selected destination. |
| Some orders acknowledge unreachable ground | Put a river across the entire map with no crossing, then order a Warbot across it. Move correctly reports zero sent and one blocked. Hunt, Attack and Station each report one sent. Station is canceled on the next unit update and releases its garrison reservation. | Reuse reachability validation for Hunt, Attack and Station. Preserve the old assignment for unreachable units and allow an attack when the target can be hit from the near side or reached through a breach. |
| A Warbot cannot step from outside an empty Bulwark shield into firing cover | A Warbot just ahead of the shield can keep its shot from a nearby reachable firing position. The shield has zero assigned units, but the proposed position is rejected because the Warbot isn't a current member. With membership granted in the same fixture, the cover step succeeds. | Check whether the Warbot would qualify at the proposed position, keeping the six-unit cap and the nearest-unit priority when resolving hits. Test an empty shield and a full shield. |

The first case can explain a unit changing direction immediately after a new command. The third leaves a firing unit exposed next to an available shield. These are separate behaviors with separate reproductions.

## Controls and limits

On empty ground, 12 Warbots on the same start tile shared one initial route search to a target 14 tiles away. The tracked lead unit entered the destination tile after advancing 13.5 tiles with zero backward steps. The existing regression cases for short combat detours, rejecting long chases, choosing a close threat, blocked-step facing, explicit marches, and repair and reload behavior passed when run independently.

The existing `tools/army-pathing-test.cjs` stops at its Bulwark firing-cover assertion. That fixture builds the shield list without rebuilding its membership. The new audit reproduces the cover failure with membership calculated exactly as the simulation does, so the failure also occurs in live play for a unit starting just outside an empty shield. The audit did not benchmark full battles, ferry or airship transfer, or Planetary maps.

## Reproduce

```sh
node tools/army-order-audit.cjs
node tools/army-pathing-test.cjs
```

On the fix revision, both commands verify the corrected behavior. The regression cases include a second Warbot that remains on its Hunt, an unreachable unit that keeps its task during a mixed Station order, an in-range shot across water, and a Warbot that moves into an empty shield but leaves a full shield alone.
