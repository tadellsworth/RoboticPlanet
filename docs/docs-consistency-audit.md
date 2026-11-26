# Documentation consistency audit

Status: In progress. This is a confirmed finding from the nuclear blast text. The remaining numbers and rules have not yet been comprehensively checked.

| Severity | Finding | Location |
| --- | --- | --- |
| Medium | The help and guide say everything inside the blast is destroyed, but the simulation preserves some buildings. | `index.html:1387`, `how-to-play.html:785`, `js/sim.js:10813` |
| Medium | The overview implies a colony can build only one megastructure in total. | `index.html:399`, `README.md:3235`, `js/world.js:2897` |

The in-game help and guide say every building inside the blast is wiped out. The simulation leaves a Command Base at one armor unless a qualifying direct hit destroys it, knocks Arrival City down rather than destroying it, and spares buildings on Trade Post ground. The next paragraph of the in-game help explains the Command Base exception, so the earlier absolute statement is also internally inconsistent. Replace the absolute wording with the general blast effect and identify the surviving exceptions.

**Medium — megastructure limit.** The setup description at index.html:399 and overview at README.md:3235 say “one per colony.” The placement check at js/world.js:2897 limits one of each type. State “one of each type per colony” in the overview.
