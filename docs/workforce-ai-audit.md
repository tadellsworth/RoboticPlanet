# Rival construction after the Workforce update

November 25, 2026. The new Worker staffing rules did not change the construction count in any of the nine tested matchups. Total completed builds were **584 on each revision**, and each colony’s count and match end time matched across all three revisions.

The baseline is the parent of the Workforce update (`032902b`). The other runs used the initial Workforce update (`338a912`) and the synced main revision with the follow-ups (`f7f35be`). Each game used two AI colonies on Medium with Normal difficulty, Balanced doctrines, The Rust, default terrain and resources, Active Murmur, Capture victory, Nuclear Race and Megastructures on. Planetary Events and Great Uplink victory were off.

Counts are cumulative construction completions, including Ramps, from the game’s built counter. Each pair lists Colony 1 and Colony 2. Four games ended before minute 20, so those rows show the count at victory.

| Map | Seed | Before Workforce | Initial Workforce | After follow-ups | Sample (min) | Winner if ended |
| --- | ---: | --- | --- | --- | ---: | --- |
| Standard | 11 | 29 / 34 | 29 / 34 | 29 / 34 | 18.59 | Colony 1 |
| Standard | 21 | 30 / 32 | 30 / 32 | 30 / 32 | 20.00 | — |
| Standard | 25 | 33 / 34 | 33 / 34 | 33 / 34 | 16.40 | Colony 2 |
| Long haul | 11 | 31 / 32 | 31 / 32 | 31 / 32 | 20.00 | — |
| Long haul | 21 | 33 / 29 | 33 / 29 | 33 / 29 | 20.00 | — |
| Long haul | 25 | 44 / 31 | 44 / 31 | 44 / 31 | 20.00 | — |
| Crossroads | 11 | 27 / 31 | 27 / 31 | 27 / 31 | 20.00 | — |
| Crossroads | 21 | 38 / 29 | 38 / 29 | 38 / 29 | 19.32 | Colony 1 |
| Crossroads | 25 | 37 / 30 | 37 / 30 | 37 / 30 | 15.05 | Colony 1 |

The sample covers opening and midgame construction on these maps. The Workforce behavior tests and the two-device lockstep test also passed. The latter compared 118 fingerprints through a reconnect with no differences.

## Reproduce the comparison

```sh
node tools/ai-baseline-audit.js "Long haul" 21 2 20 032902b
node tools/ai-baseline-audit.js "Long haul" 21 2 20 338a912
node tools/ai-baseline-audit.js "Long haul" 21 2 20 f7f35be
```
