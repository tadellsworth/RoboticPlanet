# Terrafall Audit: Asset Pipeline & Memory Management

This audit analyzes Terrafall's art assets and loading strategies. The repository features an incredibly rich variety of distinct environments and units, backed by thousands of individual `.webp` and `.png` files orchestrated by `art-manifest.js`.

## I. HTTP Overhead and Network Payload

The `art/` directory is vast. Bots alone have distinct frames for idle, movement, boosting, braking, and directional facing (e.g., `agribot@0-f0.webp` through `f3`, `crawler-deploy`, `sapper-under`).

*   **The Constraint:** Browsers limit the number of concurrent HTTP requests (usually $6$ per domain). If `art-manifest.js` asks the browser to download $500$ separate tiny `.webp` files when the game boots, the player will experience a long loading screen due to connection overhead, not file size.
*   **Recommendation: Sprite Atlases (Texture Packing).** Group your individual frames into larger sprite sheets (e.g., $1024 \times 1024$ or $2048 \times 2048$ images). You only need one HTTP request for a "Logistics Bots" sheet and one for a "Combat Bots" sheet. You can generate a JSON file map that tells `render.js` the $X, Y$, width, and height of each frame within the atlas.

## II. VRAM & GPU Memory Fragmentation

While `.webp` is fantastic for reducing the download size over the network (saving bandwidth), it is heavily compressed.

*   **The Reality:** When an image is uploaded to the GPU for rendering in WebGL or Canvas, it must be uncompressed into raw RGBA pixels. A $256 \times 256$ image always takes up roughly $256$ KB of VRAM, regardless of whether the `.webp` was $2$ KB or $20$ KB.
*   **The Risk:** Loading thousands of individual textures fragments the GPU memory and forces the renderer to constantly bind and unbind different textures, which is the most expensive operation in graphics programming.
*   **Recommendation:** Sprite Atlases solve this issue as well. Binding a single large texture atlas allows the GPU to render hundreds of different bots in a single draw call (batching), drastically improving rendering performance.

## III. Lazy Loading & Biome Segregation

Terrafall boasts an impressive $10+$ biomes (`alien`, `autumn`, `desert`, `hollow`, `jungle`, `lunar`, etc.).

*   **The Inefficiency:** If a player launches a match on a `volcanic` map, downloading and holding the `polar` snow textures and `swamp` plants in memory is a massive waste of RAM.
*   **Recommendation:** Update `art-manifest.js` to support lazy-loading by category. Load the core UI and unit assets globally, but only fetch the specific biome's sprite atlas after the map seed is generated. If the map features a transition (e.g., `savanna` bleeding into `desert`), you load those two specific atlases. 

## IV. Animation Frame Optimization

You have distinct animations for complex states like `sapper-dig` and `spitter-spit`, which add fantastic juice to the game.

*   **Recommendation:** Ensure your animation logic in `render.js` is tied to the simulation tick rate, but interpolated. If the simulation runs at $10$ ticks per second, but the monitor runs at $60$ Hz, you don't want the animations to look choppy. Decouple the animation frame advancement from the game tick to ensure smooth visual feedback, even if the underlying logic is updating less frequently.