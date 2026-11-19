# Terrafall Audit: Code Architecture & Performance

This audit evaluates the structural health and performance scalability of Terrafall's codebase. Because the game is built to run entirely in the browser while maintaining a complex logistical simulation, optimizing the loop execution and memory footprint is critical for a smooth player experience.

## I. Simulation & Render Decoupling

The presence of `tools/headless-sim.js` is a massive green flag. It proves that the core game state in `js/sim.js` is successfully decoupled from the Canvas/WebGL rendering layer in `js/render.js`.

*   **The Strength:** Determinism. If the simulation relies solely on discrete ticks and integer math (or carefully controlled floats), you can implement robust replay systems, easy reconnects for multiplayer, and lightning-fast AI training.
*   **The Risk:** "Leaky" abstractions. Ensure that *nothing* in `sim.js` queries the DOM, checks window size, or relies on `requestAnimationFrame` deltas. 
*   **Recommendation:** Enforce a strict one-way data flow. `sim.js` should produce a serialized state object (or ArrayBuffer) at the end of each tick. `render.js` should only ever read this state to interpolate animations and draw sprites.

## II. Pathfinding & Computational Load

Logistics-heavy games live and die by their pathfinding algorithms. Terrafall supports "Huge" maps of $60 \times 84$ ($5,040$ tiles).

*   **The Bottleneck:** If all $90$ units (plus trains and enemy swarms) recalculate their A* paths on the exact same tick, the CPU will spike, causing micro-stutters. Pathing across $5,040$ nodes can get computationally expensive, especially when evaluating dynamic obstacles like moving Bulwarks or expanding creep/radiation.
*   **Recommendation 1: Time-Slicing.** Distribute pathfinding requests across multiple ticks. If a Hauler needs a new route, add it to a queue and resolve a maximum of $5$ paths per tick.
*   **Recommendation 2: Flow Fields / Vector Fields.** For swarm units (like the alien `leech`, `spitter`, `brute`) that move en masse toward a base, A* is too slow. Implement a flow field radiating outward from the player's base. Hundreds of swarm units can simply check the grid tile they are standing on to know which direction to walk in $O(1)$ time.
*   **Recommendation 3: Rail Networks as Graphs.** Trains should not use grid-based A*. Pre-calculate the rail network as a node graph (intersections are nodes, tracks are edges). This reduces a $100$-tile journey to a single edge lookup.

## III. Garbage Collection & Object Pooling

JavaScript garbage collection (GC) pauses are the enemy of smooth $60$ FPS web games.

*   **The Issue:** Spawning hundreds of projectiles (Warbot bullets, Torch flames, Pulse Turret lasers) by calling `new Projectile()` and then deleting them creates memory churn. The browser's garbage collector will eventually freeze the game for $10-50$ milliseconds to clean up the dead objects.
*   **Recommendation:** Implement **Object Pools**. Create an array of $500$ pre-allocated projectile objects at the start of the game. When a Pulse Turret fires, grab an inactive object from the pool, set its coordinates, and mark it active. When it hits a target, mark it inactive. This results in zero memory allocations during gameplay, entirely eliminating GC stutters during heavy combat.