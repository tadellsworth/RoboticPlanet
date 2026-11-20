# Immense map validation

Immense is 84×118 tiles on Standard, compared with Huge at 60×84. Every shape uses its existing proportions and player limits. Versus and Colony keep their existing defaults.

## Generation and compatibility

`node tools/immense-map-test.js` checks 117 Immense layouts across the 25 shapes using seeds 11, 21 and 37. It checks the starting stock and access to Ore and Stone, exact symmetry of those opening deposits on mirrored layouts, clear ground at Trade Posts and Uplinks, and Ringfall. Three-way rotation rounds to the tile grid. The comparison found more total deposit resources at Immense than Huge in all 117 layouts, with a median increase of about 72%. Uplinks follow the existing victory rules, so they are absent in Teams and in the Hollow. The Hollow also has no Trade Posts.

Oases has five resource sites per side. Four Isles has more land on its main islands and enough shore space for four outer Uplinks and one in the middle on the tested layouts. On two-player island maps, paired home-island Trade Posts can substitute for a shared post if the generator cannot find a fair shared site. The Hollow has up to nine nests per side and 50% more Ore and Oil per deposit than it would have at the usual deposit amounts. Ringfall targets up to nine sites per colony's share. The Murmur is excluded from that division of the map.

The automated check generated the same 146×146 Teams game on two peers and verified identical simulation fingerprints on a save/load and after lockstep rejoin. The transport split and reassembled the 1.1 MB snapshot in the test. A minute-30 Long Haul 2v2 save was 1.36 MB raw and about 89 KB gzipped. Chromium testing covered Custom Game, road construction, Save & quit, Continue after refreshing the page, and restoring Immense and its seed from Saved planets.

## Performance

On the published build, a matched Standard seed 11 run reached 30 game minutes at both sizes, with two balanced Normal rivals, no Murmur and no Planetary events. The matches developed different armies, so the numbers describe the whole match workload, including those different fights.

| Standard seed 11 | Huge | Immense |
| --- | ---: | ---: |
| Headless wall time | 93 s | 90 s |
| Mean simulation tick | 1.72 ms | 1.67 ms |
| 95th percentile simulation tick | 4.19 ms | 3.80 ms |
| Browser simulation tick, zoomed out, median / p95 | 2.0 / 4.1 ms | 1.5 / 4.1 ms |
| Browser frame interval, zoomed out, median / p95 | 33.4 / 50.0 ms | 33.3 / 50.0 ms |

The browser used the same 30-minute checkpoint method and Chromium settings as the stress comparison below.

Long Haul 2v2, seed 11, Normal, four balanced rivals, no Murmur or Planetary events. Each run reached 30 game minutes and neither had a winner at that checkpoint. Timings are from an Apple M1 with other tests running. The 30-minute headless fixtures were recorded before the distance-based march recall change.

| Headless | Huge (72×142) | Immense (100×200) |
| --- | ---: | ---: |
| Wall time | 234 s | 354 s |
| Mean simulation tick | 4.33 ms | 6.56 ms |
| Median simulation tick | 3.57 ms | 3.97 ms |
| 95th percentile simulation tick | 11.27 ms | 22.09 ms |

The browser resumed both fixtures at minute 30 and measured about 5.5 seconds in each view. Chromium ran with software graphics at 1280×800, DPR 1, Auto graphics. The frame interval includes scheduling and drawing. Draw and minimap are measured CPU times.

| Browser after minute 30 | Huge median / p95 | Immense median / p95 |
| --- | ---: | ---: |
| Frame interval at base | 33.4 / 83.3 ms | 50.0 / 100.0 ms |
| Frame interval zoomed out | 33.3 / 50.1 ms | 33.4 / 50.1 ms |
| Browser simulation tick zoomed out | 5.2 / 8.2 ms | 7.9 / 18.6 ms |
| Drawing zoomed out | 15.7 / 20.2 ms | 17.6 / 21.1 ms |
| Minimap zoomed out | 0.3 / 0.8 ms | 0.4 / 1.2 ms |

The slower ticks in large fights include repeated army route searches. The minimap took little time. The whole-map canvas now stays at or below 4,096 pixels on either side, with HD chunks still used for close views. On Immense Long Haul 2v2 this reduces the primary map canvas from 6,400×3,200 to 4,000×2,000 pixels, or from about 82 MB to 32 MB of raw RGBA pixels. Both sizes missed a sustained 60 FPS in software Chromium. No player count or shape was disabled.

## Normal rival games

All seats used the balanced doctrine. The Hollow had Active Murmur. Other maps had the Murmur off, and Planetary events were off for all runs. A match was capped at 75 simulated minutes.

| Immense map | Seed | Setup | Time | Result |
| --- | ---: | --- | ---: | --- |
| Standard | 11 | Two rivals | 30:27 | Colony 1 |
| Standard | 37 | Two rivals | 19:57 | Colony 2 |
| Islands | 21 | Two rivals | 14:59 | Colony 1 |
| Crossroads | 19 | Four-player free-for-all | 37:28 | Colony 2 |
| The Hollow | 12 | Two rivals, Active Murmur | 75:00 | Undecided |
| The Hollow | 25 | Two rivals, Active Murmur | 75:00 | Undecided |

Both Hollow seeds reached the cap. On seed 12, local Fuel and Chips ran out and both colonies still held their bases with six army units apiece. The longer travel allowance did not solve the Hollow economy stalemate. In Long Haul 2v2 rivals sent marches across the map before minute 30. The fixed recall timer was shorter than the travel time of a shield-led formation across a map that can be 200 tiles long. Immense now adds travel time to the recall deadline for targets more than 60 tiles away. At minute 30, the retest had one direct attack order and all four colonies were still in play. The benchmark fixture before the change had no direct attack orders at that point. The updated match still had no winner at minute 40.

Before the travel allowance, Colony 2 took 52:26 to win the Crossroads game. Standard seed 11 still had the same winner and went from 28:38 to 30:27.

## Optional second biome and two-player size probes

On an Immense surface map, choose a specific map shape and primary biome to enable Second biome. The seed sets the orientation and bends of the transition. Terrain textures, decorations and overview colors show both regions. The primary biome supplies the world rules and weather. The choice round-trips through saves and Saved planets, and the lockstep test uses a mixed-biome game on both peers.

To gauge headroom for a future larger two-player tier, three Standard seed 11 Normal observer simulations ran for 20 game minutes on an Apple M1. The two larger dimensions were temporary test presets. All three games were still in play at minute 20. The browser resumed each checkpoint with Rust and Greenreach scenery at 1280×800 in software Chromium with Auto graphics.

| Standard dimensions | Tiles | Mean simulation tick | p95 simulation tick | p95 browser frame interval, zoomed out |
| --- | ---: | ---: | ---: | ---: |
| 84×118 | 9,912 | 0.89 ms | 2.33 ms | 33.4 ms |
| 112×156 | 17,472 | 0.97 ms | 2.23 ms | 33.4 ms |
| 120×168 | 20,160 | 1.07 ms | 2.78 ms | 33.4 ms |

At 120×168 the p99 tick rose to 11.65 ms, compared with 6.15 ms at 84×118 and 5.77 ms at 112×156. These runs measure early and midgame on one Standard seed. A future desktop two-player tier could start near 112×156, with its dimensions checked by shape. The 120×168 candidate still needs late-game, long-map and mobile testing.
