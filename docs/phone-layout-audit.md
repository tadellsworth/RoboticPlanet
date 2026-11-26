# Phone layout audit

Status: In progress. Inspected the Custom Game screen and the Gather build tab at 390 × 844 in the in-app browser. The 430 × 932 viewport was also checked for the Terraform, Workforce and Economy panels. Touch emulation, remaining screens and screenshots are unverified.

| Severity | Finding | Location |
| --- | --- | --- |
| Medium | Build tabs are about 31.75 px tall, and All is about 36 px wide, below the requested approximately 40 px touch target at both sizes. | `style.css:433`, `style.css:435`, `style.css:766` |
| Medium | Workforce ladder arrows measure 34 × 34 px at 430 × 932. | `style.css:3925`, `js/workforce.js:425` |
| Medium | Economy tabs measure 31.75 px high at 430 × 932. | `style.css:3953`, `js/economy.js:333` |

At 390 × 844, the browser measured the seven visible tab buttons at 31.75 px high. Their widths were approximately 63, 48, 49, 64, 36, 49 and 92 px. Increase their hit areas to approximately 40 px in both dimensions while keeping every tab reachable. Further touch testing is needed to assess real-device usability.

At 430 × 932 the Workforce up/down controls measured 34 × 34 px and the Economy tabs measured 31.75 px high. Make their touch targets approximately 40 px in each dimension. Terraform controls, Workforce and Economy opened successfully. Measurements used viewport resizing with browser pointer input, so touch emulation remains unverified.
