# Missions audit

Status: In progress. Static inventory and existing mission-data checks passed. Goal-by-goal playability and selector behavior remain unverified.

| Severity | Finding | Location |
| --- | --- | --- |
| Unverified | Goal selectors can be present in source without being reachable or visible at the right time. | `js/missions.js:322` |

There are 48 missions and 203 goals. A headless inspection found a hint and nonempty selector for every goal, and each selector's ID occurs somewhere in the HTML or JavaScript. This is a source-presence check, not proof that each selector matches a live, visible element. The existing mission-data test passed, including hint lengths, chapter order and its selected tutorial controls.

The Earthworks mission includes Flatten and Fill shallows goals (`js/missions.js:1444`). Mass Driver, Express and Workforce have explicit mission goals as well. A full mechanic-by-mechanic coverage comparison and goal reachability audit remain open.
