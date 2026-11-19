# Late-game performance audit

November 19, 2026. Profiled a controlled 20-minute Huge Crossroads stress fixture on Planet #43199. It started with 56 buildings, 297 live units, 59 active freight jobs, and 76 units fighting or engaged. Freight included Haulers, Freight Trucks, Tankers, Road Trains, and one loaded Freight Train. Every sample started from the same snapshot and camera. The lighting setting changed the view while the simulation fixture stayed the same.

The test used local headless Chromium with software rendering on a Mac. It ran two roughly 2.6-second samples per setting after warm-up, then triggered a checkpoint through the normal save code. The ranges below are the two measured 95th percentiles. A frame gap measures time between game frames. The simulation and drawing columns measure time spent in those stages.

| Viewport and settings | Frame gap, ms | Drawing, ms | Simulation, ms |
| --- | ---: | ---: | ---: |
| Desktop 1280 × 760, Auto day, 1× | 33.4 | 8.6–9.6 | 1.5–2.4 |
| Desktop, Auto night, 1× | 50.0 | 9.3–9.5 | 1.5–1.6 |
| Desktop, Auto night, 3× | 33.4 | 8.2–8.5 | 3.0–3.7 |
| Desktop, Ultra night, 3× | 33.4 | 8.4–8.6 | 2.6–2.8 |
| Desktop, Saver night, 3× | 33.4 | 7.4 | 2.9–3.0 |
| Phone-sized 390 × 844, Auto night, 3× | 50.1–66.6 | 36.5–39.5 | 3.7–4.3 |
| Phone-sized, Saver night, 3× | 33.4 | 4.7–5.0 | 3.3 |

## Findings

- **The phone-sized rendering workload was the largest cost.** Auto drew to a 780 × 1688 canvas and logged 19 frame gaps above 50 ms across its two samples. Saver used a 390 × 844 canvas and logged none above 50 ms. Saver caps rendering at 30 FPS and reduces effects. The observed improvement includes both changes. A follow-up should isolate canvas pixel count and visual effects on real hardware.
- **Fast-forward increased simulation cost and sustained the target pace here.** The phone-sized 3× samples advanced 2.54–2.56 game seconds per wall second, close to the game's target of 2.55. Dispatcher-call p95 was at most 1.1 ms in the collected windows. The render stage and browser frame gaps are the first targets suggested by this fixture.
- **Checkpoint persistence took 5.5–7.5 ms synchronously.** The serialized save was about 629,000–645,000 characters. IndexedDB history completion took 3.6–226.6 ms wall time. That includes asynchronous completion, so it is separate from the synchronous cost. Keep measuring large saves on slower devices before treating the history latency as a gameplay hitch.

These are short stress samples on one software-rendered browser, with a constructed freight and combat fixture. Physical phones, hardware acceleration, naturally developed colonies, sea and air freight, and long-session memory growth remain open.

[Per-run timings](late-game-performance-results.csv)
