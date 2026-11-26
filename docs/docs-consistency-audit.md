# Documentation consistency audit

Status: In progress. Confirmed findings and targeted checks are recorded below; the remaining numbers and rules have not yet been comprehensively checked.

| Severity | Finding | Location |
| --- | --- | --- |
| Medium | The help and guide say everything inside the blast is destroyed, but the simulation preserves some buildings. | `index.html:1387`, `how-to-play.html:785`, `js/sim.js:10813` |
| Medium | The overview implies a colony can build only one megastructure in total. | `index.html:399`, `README.md:3235`, `js/world.js:2897` |
| Medium | The guide describes an older Deep Core AI trigger. | `how-to-play.html:772`, `js/defs.js:1330`, `js/ai.js:2948` |
| Medium | The Mass Driver guide omits the larger supply-order cap. | `how-to-play.html:492`, `js/sim.js:21375` |
| Medium | Maglev raid help says rivals target a Terminal first, although they prefer a middle pylon on a long line. | `index.html:1218`, `js/ai.js:3662`, `js/ai.js:3672` |
| Medium | The capturing help says Outposts cannot be knocked down, while missiles and other blasts can destroy them. | `index.html:1309`, `index.html:1378`, `js/sim.js:10548` |
| Low | The Workforce ladder list omits its Other buildings row. | `index.html:1027`, `js/defs.js:2480` |
| Medium | Nuclear instructions imply a direct hit destroys any Command Base, including one's own or an ally's. | `index.html:1388`, `how-to-play.html:785`, `js/sim.js:10822` |
| Medium | The guide's megastructure destruction summary omits Arrival City's exception. | `how-to-play.html:771`, `index.html:1412`, `js/sim.js:10548` |
| Low | Megastructure reactivation help does not say each fee component rounds up. | `index.html:1411`, `how-to-play.html:771`, `js/sim.js:22112` |

The in-game help and guide say every building inside the blast is wiped out. The simulation leaves a Command Base at one armor unless a qualifying direct hit destroys it, knocks Arrival City down rather than destroying it, and spares buildings on Trade Post ground. The next paragraph of the in-game help explains the Command Base exception, so the earlier absolute statement is also internally inconsistent. Replace the absolute wording with the general blast effect and identify the surviving exceptions.

**Medium — megastructure limit.** The setup description at index.html:399 and overview at README.md:3235 say “one per colony.” The placement check at js/world.js:2897 limits one of each type. State “one of each type per colony” in the overview.

**Medium — Deep Core timing.** The guide at how-to-play.html:772 says rivals begin after 30 minutes and once Ore Mines run dry. The AI check at js/ai.js:2948 uses DEEP.aiAt, set to 20 minutes in js/defs.js:1330, along with build availability and resources. Update the guide to describe the actual timing and prerequisites.

**Medium — Mass Driver far-end cap.** The guide at how-to-play.html:492 says a far end stops filling at 64 of a good. The in-game help at index.html:1233 and mdRoom at js/sim.js:21375 allow the configured keep amount when it exceeds 64, accounting for stock and incoming canisters. State the larger-keep exception in the guide.

**Medium — Maglev raid target preference.** The same help paragraph at `index.html:1218` first says a raid can target a pylon in the middle of a long line, then says the rival chooses a Terminal first. `aiMagCut` sorts eligible middle-third pylons ahead of other targets at `js/ai.js:3662`–`3672`; it can fall back to other pylons or Terminals when needed. Replace the Terminal-first claim with the actual preference and safety conditions.

**Medium — Outpost capture and destruction.** `index.html:1309` says Outposts must be captured, not knocked down, without qualifying the weapon. The missile section at `index.html:1378` says missiles can wreck them; `captureOnly` in `js/sim.js:10548` protects Command Bases, Keeps and Arrival City, not Outposts, from the relevant blast-destruction path. Explain that warbots capture Outposts while missiles and other qualifying blasts can destroy them.

**Low — missing Workforce row.** The exhaustive-sounding list at `index.html:1027` leaves out Other buildings, which is present in `WF_ROWS` at `js/defs.js:2480` and the README's ladder description at `README.md:707`. Include it so players can find the catch-all priority.

**Medium — friendly nuclear direct hits.** The help at `index.html:1388` and guide at `how-to-play.html:785` say a direct hit destroys a Command Base, without limiting the statement to an enemy. `nukeImpact` requires `foes(m.owner, b.owner)` at `js/sim.js:10822`; a non-enemy base is left at one armor instead. Say that a qualifying direct hit destroys an enemy Command Base, and describe the friendly-base outcome.

**Medium — Arrival City's destruction exception.** The guide's megastructure summary at `how-to-play.html:771` says missiles, nukes, bombs and other listed weapons destroy a megastructure without identifying the City exception. Built Arrival City is protected by `captureOnly` (`js/sim.js:10548`) and is knocked out instead of destroyed by a nuclear strike (`js/sim.js:10823`); the in-game help explicitly calls out its exception at `index.html:1412`. Add that exception to the guide's summary.

**Low — reactivation rounding.** The help and guide describe a fee of a quarter of build cost, but `megaFee` (`js/sim.js:22112`) rounds each good up separately. A player calculating the cost of a building with a non-multiple-of-four component can therefore expect too little. Say “a quarter of each component, rounded up.”

## Checks performed and remaining coverage

| Area | Checked against code | Result / limit |
| --- | --- | --- |
| Terraforming | `TERRA` (`js/defs.js:564`); in-game help `index.html:1114`–`1117`; guide `how-to-play.html:544`; README `README.md:809`–`843` | The stated work times, Stone costs/yields, 48-tile plan maximum and original-shore six-tile fill reach agree in the passages checked. Placement edge cases remain unverified. |
| Mass Driver | `MASSDRIVER` (`js/defs.js:396`), `mdRoom` (`js/sim.js:21375`); help `index.html:1229`–`1239`; guide `how-to-play.html:492`; README `README.md:1247`–`1285` | Range, kit cost and assembly, normal cargo capacity and far-end cap were checked; the guide omits the higher keep exception listed above. Other dispatch conditions remain unverified. |
| Horde | `HORDE` (`js/defs.js:2345`); help `index.html:1698`–`1712`; guide `how-to-play.html:227` | Checked wave kinds, boss cadence, side tunnels, co-op multiplier, cap, warning and retake clock. Detailed wave arithmetic and all difficulty combinations remain unverified. |
| Fallen allies | `FALLEN` (`js/defs.js:2383`); help `index.html:1601`–`1605`; guide `how-to-play.html:591` | Checked crew, supplies, retake radius and timer. State transitions and all multiplayer cases remain unverified. |
| Megastructure capture | `MEGA` (`js/defs.js:1227`), `megaFee` (`js/sim.js:22112`), `captureOnly` (`js/sim.js:10548`); help `index.html:1408`–`1412`; guide `how-to-play.html:771` | Checked seizure radius, clock, fractions, rounding and City exception. Other weapon-specific outcomes remain unverified. |
| Workforce and Economy | `WF_ROWS` (`js/defs.js:2465`), `js/economy.js:28`, `js/economy.js:140`; help `index.html:1027`, `index.html:973` | Checked ladder names, Economy tabs and ten-minute graph window. Priority edge cases and individual bottleneck calculations remain unverified. |
| Nuclear sequence | `NUKE_LAUNCH`, `NUKE` (`js/defs.js:1155`), `nukeImpact` (`js/sim.js:10800`); help `index.html:1387`–`1388`; guide `how-to-play.html:785` | Checked flight, launch lead, blast radius and direct-hit exceptions. Every evacuation and radiation edge case remains unverified. |

These targeted checks do not yet amount to a comparison of every number and rule across all three documents. The remaining sections of the documents are unverified and must not be treated as clean solely because they do not appear in the findings table.
