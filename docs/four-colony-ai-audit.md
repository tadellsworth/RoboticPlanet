# Four-colony finish times on Standard and Crossroads

November 25, 2026. The four-colony games ran on `572588d`, the working branch with the alert, Maglev, recommissioning and panel fixes.

All runs used the Custom Game defaults with a fixed seed and map. Medium, Normal difficulty, Balanced doctrines, The Rust, default terrain and resources, Active Murmur, Capture victory, Nuclear Race and Megastructures on. Planetary Events, Teams and Great Uplink victory were off. Every colony had the same AI starting settings. The observer rule let the match continue until one colony remained.

## Four-colony free-for-all

12 of 12 matches finished by the 75-minute cap. 7 ran past 45 minutes. 0 were still undecided at minute 75.

| Map | Seed | Time (min) | Winner | Eliminations (colony at minute) |
| --- | ---: | ---: | --- | --- |
| Standard | 1 | 52.85 | Colony 2 | 1 at 12.32, 3 at 15.99, 4 at 52.85 |
| Standard | 7 | 29.09 | Colony 4 | 1 at 9.07, 3 at 24.93, 2 at 29.09 |
| Standard | 11 | 40.38 | Colony 3 | 4 at 13.24, 2 at 30.43, 1 at 40.38 |
| Standard | 21 | 54.06 | Colony 4 | 2 at 15.33, 3 at 27.70, 1 at 54.06 |
| Standard | 25 | 64.56 | Colony 3 | 4 at 26.68, 2 at 26.85, 1 at 64.56 |
| Standard | 42 | 45.73 | Colony 1 | 3 at 19.53, 4 at 25.15, 2 at 45.73 |
| Crossroads | 1 | 46.69 | Colony 4 | 3 at 11.81, 1 at 31.62, 2 at 46.69 |
| Crossroads | 7 | 32.09 | Colony 2 | 1 at 8.92, 3 at 22.75, 4 at 32.09 |
| Crossroads | 11 | 22.30 | Colony 1 | 4 at 15.89, 3 at 16.14, 2 at 22.30 |
| Crossroads | 21 | 56.33 | Colony 4 | 2 at 12.95, 1 at 17.19, 3 at 56.33 |
| Crossroads | 25 | 24.46 | Colony 3 | 1 at 14.89, 2 at 21.40, 4 at 24.46 |
| Crossroads | 42 | 55.13 | Colony 2 | 3 at 12.83, 1 at 17.59, 4 at 55.13 |

All seven games that ran past 45 minutes were down to two colonies by minute 31.62. The longest overall was Standard seed 25 at 64.56 minutes. The longest final duel was on Crossroads seed 21. Two colonies remained at minute 17.19, and Colony 4 won at minute 56.33.

## Reproduce a match

```sh
node tools/ai-baseline-audit.js Standard 25 4 75 572588d
node tools/ai-baseline-audit.js Crossroads 21 4 75 572588d
```
