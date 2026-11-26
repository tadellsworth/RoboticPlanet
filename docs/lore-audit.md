# Lore and tone audit

Status: In progress. The Hollow opening subtitle has been checked against LORE.md. The remaining player-facing text still needs review.

| Severity | Finding | Location |
| --- | --- | --- |
| Medium | The Hollow opening says there is no daylight below, despite daylight entering through breaches. | `js/voice.js:281`, `LORE.md:224`, `index.html:1767` |

The opening Carrier subtitle says “No daylight below” immediately after the lander goes through a breach. The lore says pale daylight falls through breach shafts, and the game's help says Command Bases land under one. Suggested wording: “Lander through the breach. Light at the shaft. The ground is listening.”
