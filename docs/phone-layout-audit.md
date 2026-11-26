# Phone layout audit

Status: In progress. Inspected the Custom Game screen and the Gather build tab at 390 × 844 in the in-app browser. Touch emulation and the remaining screens, screenshots, and 430 × 932 are unverified.

| Severity | Finding | Location |
| --- | --- | --- |
| Medium | Build tabs are about 31.75 px tall, and All is about 36 px wide, below the requested approximately 40 px touch target. | `style.css:433`, `style.css:435`, `style.css:766` |

At 390 × 844, the browser measured the seven visible tab buttons at 31.75 px high. Their widths were approximately 63, 48, 49, 64, 36, 49 and 92 px. Increase their hit areas to approximately 40 px in both dimensions while keeping every tab reachable. Further touch testing is needed to assess real-device usability.
