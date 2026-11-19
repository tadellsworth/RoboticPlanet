# Hauler supplier ranking experiment

Tested against RoboticPlanet commit `a815e7c`. The benchmark runs the game's dispatcher, pathfinder, movement, road traffic, and ferry boarding against fixed layouts. It substitutes the supplier ranking in memory.

## Time to deliver all 12 Ore

Each layout has two Haulers and two suppliers. Each strategy runs six paired starts per layout with the same stock, fleet, and traffic. Values are medians in **game seconds**. The CSV also records time to first delivery, time to six Ore, units delivered at 45, 90, and 120 seconds, and dispatch timing.

| Scenario | Current ranking | Estimated time with traffic history | Estimated time with live traffic and search cap |
| --- | ---: | ---: | ---: |
| Clear roads | 27.0 | 27.0 | 27.0 |
| Near supplier with a road detour | 83.7 | 64.6 | 64.6 |
| Longer asphalt route | 27.0 | 26.5 | 26.2 |
| Sustained traffic | 50.9 | 35.0 | 40.9 |
| Heavy traffic | 55.4 | 35.0 | 35.0 |
| Traffic clears before dispatch | 29.3 | 33.0 | 29.3 |
| Ferry at the opposite dock | 81.4 | 39.7 | 39.7 |
| Ferry at the departure dock | 76.6 | 39.7 | 39.7 |
| Ferry faster than the road detour | 81.4 | 81.4 | 81.4 |

The two live-traffic versions produced identical delivery times and supplier choices in all 54 paired runs. The history-only estimate still steered Haulers away after the road cleared, costing 3.7 seconds. The live-traffic check recovered that time. The estimates kept the ferry choice when the road detour was longer. In both cases with a faster local supplier, the capped estimate delivered all 12 Ore within 45 seconds. The current ranking delivered four.

## One burst of 24 assignments

Fifteen depots request goods simultaneously, five suppliers have stock, and 24 Haulers are idle. All 24 receive assignments in every trial. Timing is dispatch wall-clock time in milliseconds on the development Mac (Node.js on arm64), with 12 starts per strategy. Extra searches are pathfinder calls made by the estimator.

| Strategy | Median extra searches | Median ms | Range ms |
| --- | ---: | ---: | ---: |
| Current distance ranking | 0 | 3.29 | 3.08–10.16 |
| Estimated time with live-traffic check | 192 | 40.46 | 39.63–46.75 |
| Estimated time with live-traffic check and cap | 32 | 9.16 | 8.70–10.05 |

## Recommendation and limits

The capped live-traffic variant is the candidate for a crowded-colony play-test. It estimates the empty and loaded legs using the game's existing routes, pavement speeds, ferry positions, and boarding queues. It checks up to four suppliers per request and stops extra pathfinding after 32 searches per dispatch pass. It applies its road congestion estimate when multiple vehicles are nearby. When the budget runs out, the dispatcher continues with its distance ranking.

These are controlled tests of Haulers carrying dry goods. The burst measures assignment count and dispatcher cost. Sustained throughput on a live colony with mixed carriers and larger maps is a further benchmark.

## Reproduce

```sh
node tools/benchmarks/haul-eta.cjs
node tools/benchmarks/haul-eta.cjs burst distance,eta-guarded,eta-guarded-budget 12
```

The runner emits one JSON object per trial. [Individual results and timings](haul-eta-results.csv) include the initial pilot runs, the paired delivery trials, and the dispatch bursts.
