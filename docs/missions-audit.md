# Missions audit

Status: In progress. Static inventory and existing mission-data checks passed. Goal-by-goal playability and selector behavior remain unverified.

| Severity | Finding | Location |
| --- | --- | --- |
| Medium | Chain Reaction's introduction says a nuclear missile flattens everything, omitting buildings that survive. | `js/missions.js:2210`, `js/sim.js:10813` |
| Unverified | Goal selectors can be present in source without being reachable or visible at the right time. | `js/missions.js:322` |

There are 48 missions and 203 goals. A headless inspection found a hint and nonempty selector for every goal, and each selector's ID occurs somewhere in the HTML or JavaScript. This is a source-presence check, not proof that each selector matches a live, visible element. The existing mission-data test passed, including hint lengths, chapter order and its selected tutorial controls.

The hints contain 273 explicit bold-label/keyboard-key pairs. A static comparison of pairs whose labels exactly match a building definition against `BUILD_KEYS` found no mismatched building letters; this does not validate other phrasing, context, button visibility, or whether the goal can be completed. `tools/mission-data-test.js` additionally exercises the Arterial mission in a headless simulation, but not the full curriculum.

The Earthworks mission includes Flatten and Fill shallows goals (`js/missions.js:1444`). Mass Driver, Express and Workforce have explicit mission goals as well. A full mechanic-by-mechanic coverage comparison and goal reachability audit remain open.

**Medium — nuclear blast description.** Chain Reaction says a nuclear missile flattens everything around its landing point. The blast has exceptions, including buildings on Trade Post ground and Arrival City (`js/sim.js:10813`), as well as the separate Command Base rules. Describe the normal destruction without saying everything is flattened and explain relevant exceptions. This is introductory text, not evidence that the launch goal itself is broken.
