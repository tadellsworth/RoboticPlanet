# Phone layout audit

Status: In progress. Inspected the Custom Game screen, all build tabs, Army, pause, How to play, Workforce, Economy, a Command Base and a Bot Foundry order list in the in-app browser; the coverage is not yet complete at both sizes. Touch emulation and remaining screens are unverified.

| Severity | Finding | Location |
| --- | --- | --- |
| Medium | Robot-count labels are clipped in the top bar at 390 × 844. | `style.css:101`, `style.css:3122`, `index.html` (`#pop`) |
| Medium | The selected restore point's age is cut off at 390 × 844. | `style.css:606`, `index.html:650`, `js/ui.js:2273` |
| Unverified | Small controls measured with a mouse may be larger under the phone's coarse-pointer rules. | `style.css:1162`, `style.css:433`, `js/workforce.js:425`, `js/economy.js:333` |

**Medium — clipped robot labels.** In the 390 × 844 browser viewport, the top bar's robot-count labels were visibly clipped, including the start of Workers and the end of Warbots. The population element uses overflow hidden. Let the counts and labels fit, wrap, or use deliberately shortened labels without losing their meaning.

**Medium — restore point age truncated.** At 390 × 844, the selected restore-point label showed “3:00 in game · just n” rather than the complete “just now” shown in the accessible text. Allow the selected label enough width or use a shorter format so that the age is readable without opening the list.

**Unverified — touch target sizes.** With mouse pointer input at 390 × 844, the build tabs measured 31.75 px high, and at 430 × 932 Workforce arrows measured 34 × 34 px and Economy tabs 31.75 px high. However, `style.css:1162` applies 44 px minimum heights to several controls when the pointer is coarse. These mouse measurements alone do not establish that the corresponding phone targets are too small. Verify the affected selectors with actual touch emulation before treating them as defects. Terraform controls, Workforce, Economy, Army, pause and How to play opened; the remaining requested panels and screenshots still require inspection.

At both 390 × 844 and 430 × 932, each of the seven build tabs (Gather, Make, Move, Defend, All, Mega and Terraform) was opened in the in-app browser. The main `#sheet-body` had equal client and scroll widths for each tab, so this check found no horizontal overflow of that container. This does not establish that every card, touch target or nested element is unobscured, and the test used a mouse pointer rather than touch emulation.

Screenshots (in-app browser, mouse pointer; not touch emulation):

- [Terraform and clipped robot labels, 390 × 844](phone-audit-shots/terraform-390.jpg)
- [Pause and truncated restore-point age, 390 × 844](phone-audit-shots/pause-390.jpg)
- [Workforce, 430 × 932](phone-audit-shots/workforce-430.jpg)
- [Economy, 430 × 932](phone-audit-shots/economy-430.jpg)
- [Army, 430 × 932](phone-audit-shots/army-430.jpg)
- [Selected Command Base, 430 × 932](phone-audit-shots/command-base-430.jpg)
- [How to play, 430 × 932](phone-audit-shots/help-430.jpg)
- [Custom Game setup, 390 × 844](phone-audit-shots/setup-390.jpg)
- [Bot Foundry order list, 390 × 844](phone-audit-shots/foundry-orders-390.jpg)
- [Bot Foundry order list, 430 × 932](phone-audit-shots/foundry-orders-430.jpg)
