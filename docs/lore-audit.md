# Lore and tone audit

Status: In progress. The Hollow opening subtitle has been checked against LORE.md. The remaining player-facing text still needs review.

| Severity | Finding | Location |
| --- | --- | --- |
| Medium | The Hollow opening says there is no daylight below, despite daylight entering through breaches. | `js/voice.js:281`, `LORE.md:224`, `index.html:1767` |
| Medium | Capture narration says the defeated colony's robots report for duty, but those robots shut down. | `js/defs.js:2517`, `js/defs.js:2519`, `js/sim.js:7688`, `js/sim.js:7746` |

The opening Carrier subtitle says “No daylight below” immediately after the lander goes through a breach. The lore says pale daylight falls through breach shafts, and the game's help says Command Bases land under one. Suggested wording: “Lander through the breach. Light at the shaft. The ground is listening.”

A targeted case-insensitive search for literal claims that Earth or humanity is gone, destroyed, dead or extinct did not find a player-facing confirmation. This is only a keyword search: it cannot rule out paraphrases or contradictions elsewhere in the mission, description, guide, victory and toast text, which remain unverified.

**Medium — captured robots.** The narrator's `captured` and `changed` lines at `js/defs.js:2517`–`2519` say the defeated robots report to their captor. In `eliminate` (`js/sim.js:7688`) every surviving robot of that colony is killed; its surviving buildings change hands. Suggested replacements: “Command authority transferred. Their buildings are under our control.” and “Command core changed hands. {old}'s buildings now report to {by}.” These retain the clipped machine voice and describe the outcome actually implemented. The message is also used for surrender; the elimination path still shuts down those robots.
