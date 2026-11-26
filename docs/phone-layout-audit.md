# Phone layout audit

Status: In progress. Inspected the Custom Game screen and the Gather build tab at 390 × 844 in the in-app browser. The 430 × 932 viewport was also checked for the Terraform, Workforce and Economy panels. Touch emulation, remaining screens and screenshots are unverified.

| Severity | Finding | Location |
| --- | --- | --- |
| Medium | Robot-count labels are clipped in the top bar at 390 × 844. | `style.css:101`, `style.css:3122`, `index.html` (`#pop`) |
| Medium | The selected restore point's age is cut off at 390 × 844. | `style.css:606`, `index.html:650`, `js/ui.js:2273` |
| Unverified | Small controls measured with a mouse may be larger under the phone's coarse-pointer rules. | `style.css:1162`, `style.css:433`, `js/workforce.js:425`, `js/economy.js:333` |

**Medium — clipped robot labels.** In the 390 × 844 browser viewport, the top bar's robot-count labels were visibly clipped, including the start of Workers and the end of Warbots. The population element uses overflow hidden. Let the counts and labels fit, wrap, or use deliberately shortened labels without losing their meaning.

**Medium — restore point age truncated.** At 390 × 844, the selected restore-point label showed “3:00 in game · just n” rather than the complete “just now” shown in the accessible text. Allow the selected label enough width or use a shorter format so that the age is readable without opening the list.

**Unverified — touch target sizes.** With mouse pointer input at 390 × 844, the build tabs measured 31.75 px high, and at 430 × 932 Workforce arrows measured 34 × 34 px and Economy tabs 31.75 px high. However, `style.css:1162` applies 44 px minimum heights to several controls when the pointer is coarse. These mouse measurements alone do not establish that the corresponding phone targets are too small. Verify the affected selectors with actual touch emulation before treating them as defects. Terraform controls, Workforce, Economy, Army, pause and How to play opened; the remaining requested panels and screenshots still require inspection.
