# Missions audit

Status: In progress. Static inventory and existing mission-data checks passed. Goal-by-goal playability and selector behavior remain unverified.

| Severity | Finding | Location |
| --- | --- | --- |
| Medium | Chain Reaction's introduction says a nuclear missile flattens everything, omitting buildings that survive. | `js/missions.js:2210`, `js/sim.js:10813` |
| Low | The tutorial has no Horde mission and no mission teaching a fallen ally's return. | `js/missions.js:322`, `js/missions.js:2599`, `js/defs.js:2345`, `js/defs.js:2383` |
| Medium | Under the Bloom's stage goal tells players to build Pulse Turrets but highlights the speed control instead. | `js/missions.js:322`, `js/missions.js:1657` |
| Unverified | Goal selectors can be present in source without being reachable or visible at the right time. | `js/missions.js:322` |

There are 48 missions and 203 goals. A headless inspection found a hint and nonempty selector for every goal, and each selector's ID occurs somewhere in the HTML or JavaScript. This is a source-presence check, not proof that each selector matches a live, visible element. The existing mission-data test passed, including hint lengths, chapter order and its selected tutorial controls.

The hints contain 273 explicit bold-label/keyboard-key pairs. A static comparison of pairs whose labels exactly match a building definition against `BUILD_KEYS` found no mismatched building letters; this does not validate other phrasing, context, button visibility, or whether the goal can be completed. `tools/mission-data-test.js` additionally exercises the Arterial mission in a headless simulation, but not the full curriculum.

An additional headless smoke check initialized every mission at Settler, Colonist and Warlord (144 starts), checked that its goal-state count matched its definition, and advanced three simulation ticks. All 144 starts completed without an exception. This verifies startup only: it does not prove that the goals can be reached or completed, or that their controls are accessible.

The Earthworks mission includes Flatten and Fill shallows goals (`js/missions.js:1444`). Mass Driver, Express and Workforce have explicit mission goals as well. A full mechanic-by-mechanic coverage comparison and goal reachability audit remain open.

**Medium — nuclear blast description.** Chain Reaction says a nuclear missile flattens everything around its landing point. The blast has exceptions, including buildings on Trade Post ground and Arrival City (`js/sim.js:10813`), as well as the separate Command Base rules. Describe the normal destruction without saying everything is flattened and explain relevant exceptions. This is introductory text, not evidence that the launch goal itself is broken.

**Low — untaught modes and recovery.** The mission definitions use Colony or Versus, not Horde, and no mission sets up Teams and its fallen-ally recovery (`js/missions.js:322`–`2447`, with options passed at `js/missions.js:2599`). Horde waves and side tunnels (`js/defs.js:2345`) and the fallen-ally return (`js/defs.js:2383`) are therefore not taught by a mission. Consider a Horde holdout tutorial and a team recovery goal. Cut and Fill introduces all five Terraform tools in its briefing, but its required goals only exercise Flatten and Fill shallows (`js/missions.js:1429`–`1452`); it does not require Raise, Lower or Dig channel. Whether other mechanics also lack instruction remains unverified.

**Medium — unrelated highlighted control.** Under the Bloom's second goal (`js/missions.js:1657`) says to keep the Generators fed and ring the Engine with Pulse Turrets. Its `aeStageGoal` helper (`js/missions.js:322`) supplies only `#btn-speed`, even though that hint does not tell the player to change speed; it does not highlight the Build, Defend or Pulse Turret controls named by the hint. Highlight the controls for the instruction, or change the hint and selector together so the glowing control is relevant. Landing Zone's stage goal uses the same speed-only helper with a hint to feed and guard its Generators (`js/missions.js:2356`), so its highlighted control likewise does not match that hint.
