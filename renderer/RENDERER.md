# Terrafall renderer

This folder is the complete setup behind the Terrafall art. It covers every 3D sprite: buildings, the Command Base, defences, the Pulse Turret, walls and gates, streetlamps, robots and vehicles, bridges, track, the Ropeway and the Generator. It also has the Python that finishes the sprites, the 2D effect sheets, and the terrain renderer. Run it from this folder as it is.

**Checked:** I re-rendered a sample of 161 files from this folder, covering every scene, part, compose setting and finishing step. 159 came out pixel for pixel identical to the files I shipped. The other 2 differ only by the known random grime texture in two scenes. Details are in [What was checked](#what-was-checked) at the end.

## What's here

| Path | What it is |
|---|---|
| `run.js`, `index.html`, `chrome.js` | The runner. It serves this folder, opens `index.html?b=<scene>&…` in headless Chrome, and saves the passes. |
| `lib.js` | The shared scene kit: camera, sun, sky light, materials, modelling helpers, time of day, the glow pass and marks. |
| `b/*.js` | One scene per sprite (list below). `worklib.js`, `milkit.js`, `robkit.js`, `missile.js` and `nuke.js` are shared helpers the scenes import. |
| `compose.py`, `compose_any.py`, `compose2.py` | Add bloom from the glow pass and downsample 2×. |
| `walls/` | The wall and gate renderer: `run.js`, `index.html`, `wlib.js`, `b/wall.js`, `b/gate.js`, `compose_walls.py`, and `layout.py` (test layouts). |
| `post/` | Python that finishes renders: light overlays, the Pulse Cannon effects, working-loop embers, lamp heads, time-of-day extras, headlights and emitter points. |
| `fx/` | The 2D effect library (`fxlib.py`) and the sheets made with it: explosion, fuel blast, smoke, steam, flare and exhaust. |
| `terrain/` | The pure-Python terrain renderer: ground, water, rock, cliffs, plants and canyon tiles. `tex.py` is also used by `fx/fxlib.py`. |
| `preview/` | The review videos and mock-ups. These don't ship. |
| `tools/` | `catalogue.py` writes `jobs.txt`; `rerender.py` rebuilds and checks files; `points.py` writes the point files; `check-webgl.js` reports your Chrome and WebGL. |
| `jobs.txt` | The exact job and finishing steps for every delivered file: 1,567 lines. |
| `example/smelter.png` | The shipped day Smelter. The walkthrough below renders it again. |

### Scenes in `b/`

| Group | Scenes |
|---|---|
| Production buildings | smelter, harvester, quarry, mine, tap, fab, foundry, depot, grower, site, charger, biofarm, oilpump, refinery, cement, asphalt, roadworks, ramp, repairbay, lab, generator |
| Military and nuclear | silo, missilefactory, ammoplant (the shared `missile.js`), nreactor, nsilo (the shared `nuke.js`), nukeblast |
| Command Base and outposts | hq (the Command Base, shipped as `lander@T`), outpost. `commandbase.js` is the older compound version, kept for reference and not shipped. |
| Defences | pulseturret (base, heads, charge mask), bunker, disruptor, mortar (`milkit.js` holds sandbags and frames) |
| Rail and roads | station, rail (track tiles), bridge (water, sky and rail bridges), streetlamp, pipe (pipeline tiles) |
| Ropeway | ropeway (the station), gondola |
| Vehicles | truck, tanker, roadtrain, freight (loco and wagons), crawler, trader |
| Robots | rob_worker, rob_hauler, rob_agribot, rob_paver, rob_warbot (the shared `robkit.js`) |
| Wildlife | creature (scuttler, brute), nest |
| Other | icon (the app-icon hero render) |
| Walls (in `walls/b/`) | wall, gate |

## Install

1. **Node 18 or newer.** Node 22.23.4 was used. Then run:
   ```
   npm ci
   ```
   This installs exactly what `package-lock.json` pins:
   - `three@0.160.0`;
   - `puppeteer-core@23.11.1`, which brings `@puppeteer/browsers@2.6.1`.
2. **Chrome for Testing 153.0.8010.12.** This is the browser every image was rendered with. Run:
   ```
   npm run install-chrome          # = npx @puppeteer/browsers install chrome@153.0.8010.12 --path ./chrome
   ```
   - The runners look for Chrome in this order:
     1. `$CHROME`;
     2. the copy in `./chrome`;
     3. `/usr/bin/google-chrome`.
   - Run `node tools/check-webgl.js` to confirm. It should report:
     ```
     version  Chrome/153.0.8010.12
     webgl    ... "renderer":"ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)"
     ```
   - WebGL runs in software through SwiftShader. That's what makes the renders repeatable. The flags are `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
   - A different Chrome build can move pixels slightly. A GPU will too.
3. **Python 3.13** (3.13.18 was used). Then run:
   ```
   pip install -r requirements.txt     # numpy 2.5.3, Pillow 12.3.0, scipy 1.18.1
   ```
4. **ffmpeg** (6.1.1 was used). You only need it for the preview videos.

### What gets downloaded, and from where

Nothing is loaded from a CDN when rendering. `index.html` maps `three` to `/node_modules/three/...`, which `run.js` serves locally.

Install fetches only:

| What | From |
|---|---|
| npm packages | the npm registry (`registry.npmjs.org`), at the versions and integrity hashes in `package-lock.json` |
| Chrome | `https://storage.googleapis.com/chrome-for-testing-public/153.0.8010.12/linux64/chrome-linux64.zip` (on a Mac or Windows, `@puppeteer/browsers` picks the matching platform zip) |

## Render one sprite, start to finish

Take the day Smelter as an example.

```
node run.js out/try 'smelter:#ff8a1e::smelter'
python3 compose.py out/try smelter
```

1. `run.js` loads `b/smelter.js` with `?accent=%23ff8a1e`. `lib.js` builds the scene, adds the shared pad and frames the camera. It then renders two passes at 2× size, 1024 × 1024:
   - `out/try/smelter.beauty.png`: the lit render on a transparent background.
   - `out/try/smelter.glow.png`: only the glowing parts, drawn flat in their glow colour, with everything else black.
2. `run.js` also writes `out/try/smelter.geom.json`, which holds:
   - the anchor point;
   - the pad's top corners;
   - how much empty space is left on each side;
   - any named marks the scene placed, in 0–1 image coordinates.
3. `compose.py` blooms the glow pass and adds it to the beauty pass. It then averages 2 × 2 pixels down to the final `out/try/smelter.png` (512 × 512). It also writes a `sheet-smelter.png` contact sheet: the sprite on sand, plus a 50 px phone-size copy.
4. Check the result against the shipped file:
   ```
   python3 tools/rerender.py '^art/buildings/smelter.png$' --shipped example
   ```
   It should print `compared 1: 1 identical`.

## Job syntax

**Main runner:** `node run.js <outDir> '<job>' ['<job>' ...]`. A job has the form `scene:accent:team:outName:extra`.

| Field | Meaning |
|---|---|
| `scene` | The file in `b/`, without `.js`. |
| `accent` | The building's accent colour (`#ff8a1e`). Leave it empty to use the scene's default. |
| `team` | The team colour: `#38d4ff` for the player (`@0`), `#ff5a6e` for the rival (`@1`). Empty means `#38d4ff`. |
| `outName` | The base name of the output files. |
| `extra` | A query string passed to the scene, such as `f=2&tod=night`. |

Quote each job in the shell, because it contains `#` and `&`.

Parameters the scenes read:

| Parameter | Used by | Meaning |
|---|---|---|
| `tod=morning\|evening\|night` | `lib.js` (every scene) | The time of day. Leave it out (or use `day`) for the day art. |
| `f=k` | vehicles, robots, creatures, nukeblast, working loops | The frame number. Drive frames roll the wheels or tracks a quarter pitch each. Working loops have 8 frames, and the blast has 24 (with `n=24`). |
| `part=` | many | Renders one layer:<br>• the turret and mortar: `base`, `head`, `charge`;<br>• the disruptor: `pulse`;<br>• smelter, refinery, oilpump and generator: `work`, plus `base` for the oilpump;<br>• truck and tanker: `brake`, `boost`;<br>• roadtrain: `brake`, `trailer`;<br>• freight: `flat`, `hopper`, `brake`, `heads`;<br>• robots: `brake`;<br>• crawler: `dish`. |
| `rot=k&n=N` | pulseturret, mortar heads | Head direction k of N. 0 is right (east), then clockwise on screen. |
| `empty=1` | silo, nsilo | The silo with its missile gone. |
| `d=k` | crawler | Deploy frame 1–9. Frame 9 is the deployed base. |
| `c=scuttler\|brute` | creature | Which creature. |
| `s=1..3` | nest | Nest size. |
| `piece=` | rail, bridge, pipe | The tile piece (pipe: straight, corner, tee, cross, end, raised). Rail also has `lights-on`; bridges also have `lamp`. |
| `style=water\|sky\|rail` | bridge | The bridge type. |
| `kind=road\|asphalt`, `lit=1` | streetlamp | Which lamp, and whether to render only the lit head. |
| `mk=[[name,x,y,z],…]` | `lib.js` | Extra marks at world points, reported in `geom.json`. `post/emitters.py` uses this. |

**Walls runner:** `node walls/run.js <outDir> 'scene:outName:query'`, for example:
```
node walls/run.js out/w 'wall:wall-post@0:piece=post&team=%2338d4ff&frames=6&tod=day'
```
- `piece` is `post`, `n`, `e`, `s`, `w`, `hub-ew` or `hub-ns` for walls, and `ew-closed`, `ew-open`, `ns-closed` or `ns-open` for gates.
- `team` must be URL-encoded (`%23` for `#`).
- `frames=6` asks for the six spark passes.
- The runner always adds `ortho=1&nopad=1`.

## The output files

| File | What it is |
|---|---|
| `<name>.beauty.png` | The lit render at 2× the final size, on a transparent background. |
| `<name>.glow.png` | The glow pass at the same size. Emissive parts are flat in their glow colour; everything else is black. |
| `<name>.<extra>.png` | Any extra pass a scene snaps with `L.snap()`. |
| `<name>.geom.json` | Where things land in the image (in 0–1 image coordinates):<br>• `anchor`: the pad's top centre;<br>• `padTop`: the pad's four top corners;<br>• `margins`: the empty space on each side;<br>• `marks`: named points the scene placed. |
| `<name>.solid.png`, `<name>.spark-fN.png` | Walls only: the arm-shadow pass and the six spark passes. |
| `<name>.png` | The finished sprite, written by compose. |
| `<name>.spark-N.png` | Walls only: the finished spark frames. They ship as `<name>-spark-fN.png`. |

### Canvases

| Kind | Final size | Camera |
|---|---|---|
| Buildings, defences, heads, overlays, working loops | 512 | Perspective, 20° field of view, looking down at 57°, square-on. Framed so the pad's front edge spans 75 % of the width and sits at 96 % of the height. |
| Walls and gates | 512 | The same 57° view, orthographic, no pad |
| Streetlamps | 256 | Orthographic 57°. The foot is at (128, 234). |
| Freight Truck and Tanker | 384 | Straight down, facing right, 10 world units across |
| Robots, Road Train, train cars, gondola, creatures, trader | 256 | Straight down, 10 units across |
| Crawler | 512 | Straight down, 20 units across |
| Rail tiles | 256 | Straight down |
| Pipe tiles | 256 | Straight down |
| Bridges | 512, or 512 × 1024 for piers, towers and the lamp | The 57° view |
| Nuke blast | 512 | The 57° view, no pad |
| App icon | 2048 render | Its own camera, no pad |

## How compose works

Every compose script follows the same steps:

1. Premultiply the beauty pass.
2. Blur the glow pass twice, once tight and once wide.
3. Add the blurs as light.
4. Raise alpha under the glow so the bloom shows on a transparent background.
5. Average down 2×.
6. Un-premultiply.

The scripts differ in their options:

| Script | Use | Options |
|---|---|---|
| `compose.py` | 1024 → 512 buildings | `--glow k` scales the bloom (the Disruptor uses `0.4`, so its coils stay ice blue). The blur radii are fixed at 7 and 22. |
| `compose_any.py` | Any size | `--b1`, `--b2` set the blur radii, `--glow` the strength. |
| `compose2.py` | Bridges | `--b1`, `--b2`, plus `--haze`, which fades the bottom of sky and rail piers into the chasm. |
| `walls/compose_walls.py` | Walls and gates | It also:<br>• corrects the arm shadows using the post (`--post wall-post@T`);<br>• turns the spark passes into white-hot frames with a team-coloured halo (`--team`, `--frames`). |

The compose options are part of each image's recipe. `jobs.txt` gives them for every file.

## Times of day

`tod=morning|evening|night` keeps the camera, framing, anchor and frames, and changes only the light:

- **Light set-up:** the sun's colour, strength and direction, the sky and ground light, the fill light, the reflection strength and the exposure. The values are in the `TODS` table at the top of `lib.js`.
- **Shadows:** a wider shadow camera, for the long low-sun shadows.
- **Lights on:** in the evening and at night, every glowing part adds a point light, so it lights the pad around it. Window glass glows warm, and tail-light lenses switch on.

With `tod` left out, or set to `day`, `lib.js` takes exactly the old day path, so day renders don't change. This is what "day parity" means.

A few things don't get a time-of-day render:

- **Light overlays** (brake, boost, sparks, lit lamp heads, the charge and laser effects, `rail-lights-on`, `skybridge-tower-lamp`). The day file serves every time of day.
- **Ground, resources and smoke.** The game tints these in code with the `grade_multiply`/`grade_add` values in `art/tod/shared/time-of-day.json`.

`post/tod_post.py <time> <art/tod/<time>>` finishes a time-of-day folder:

- it copies the Crawler's `f0` to deploy frame `d0`, and `d9` to `crawlerbase`;
- it adds the dust puffs to deploy frame `d3`, graded for that time;
- it names the 16-direction turret heads and copies their even frames to the 8-direction set.

## How the effects are made

There are three kinds of effect.

**Overlays registered to a render.** A scene places named marks in 3D (`L.mark`). The runner projects them into `geom.json`, and Python draws on exactly those pixels:

- `post/defence_overlays.py fire`: the Bunker's muzzle flashes, from the `gun0`/`gun1` marks.
- `post/defence_overlays.py pulse`: the Disruptor's pulse glow and arcs, from the `part=pulse` render and its coil marks.
- `post/pulsefx.py`: the Pulse Cannon effects, from the 16 `part=charge` renders (a white mask of the coils and tips, with marks):
  - 8 charge frames per direction;
  - the laser and hit sheets;
  - `pulse-muzzles.json`.
- `post/lamps_post.py`: the lit lamp heads (the 3D lens plus glow) and the optional light pools.
- `post/post_loops.py embers`: the embers on `smelter-work-0…7`.
- `post/truck_overlays.py`, `robot_overlays.py`, `roadtrain_overlays.py`, `freight_overlays.py` and `crawler_overlays.py`: brake ground spill, boost dust, headlights, exhaust wisps, and the Crawler's lights and dust.

**2D sheets, drawn in Python.** `fx/fxlib.py` has a small particle painter:

- `Canvas.puff`: soft noise-shaped clouds, lit from the top-left;
- `streak` and `blob`: glowing streaks and spots;
- `finish`: bloom, plus a premultiplied downsample.

Its noise comes from `terrain/tex.py`. The scripts that use it are:

- `fx/explosion.py`;
- `fx/particles.py`: chimney smoke, steam, black smoke and the flare;
- `fx/exhaust.py`: light and heavy truck exhaust.
- `fx/fuelblast.py`: the fuel blast (`fx-fuel-blast`: a Tanker or Refinery going up), 16 frames in a 4 x 4 grid.

Each writes into the folder you give it (default `out/fx`). Every sheet has a transparent background, and its grid reads left to right, then top to bottom.

**Point files, read off the renders.** These scripts write the JSON files the game uses to place effects:

- `tools/points.py` writes `exhaust-points.json`, `generator-points.json`, `defences-points.json` and `streetlamps.json` from the renders' marks.
- `post/emitters.py` re-renders the animated buildings with `mk=` points and writes `building-emitters.json`.
- `post/headlights.py` draws the evening and night headlight beams, three times the vehicle's size, from the lamp positions and the day robot sprites. `tanker-headlights.png` is a copy of `truck-headlights.png`.

## jobs.txt, and re-rendering everything

`jobs.txt` has one line per delivered file, tab-separated: `file  renderer  jobs  finish`. `tools/catalogue.py` writes it.

- **`file`**: where the file sits in the game's art folder. Day art is at `art/<group>/<name>`; morning, evening and night are at `art/tod/<time>/<group>/<name>`.
- **`renderer`**: `main` (`run.js`), `walls` (`walls/run.js`), or `-` (Python only).
- **`jobs`**: one or more jobs, space-separated. Some files need several renders, for example the laser needs all 16 charge renders.
- **`finish`**: the steps after rendering, separated by ` | `:
  - a compose command, with the options to use;
  - `none`, meaning the raw pass is used;
  - one or more scripts. In these, `{raw}` is the render folder, `{fin}` the finished-file folder, `{art}` the art folder being rebuilt, and `{tod}` the time of day.

Where one render serves several files, the line names the render's output: for example, `crawler-deploy@T-d0` uses the `crawler@T-f0` job, and the 8-direction night turret heads use the 16-direction jobs.

`tools/rerender.py` does all of this for you:

```
python3 tools/rerender.py '^art/buildings/'                         # rebuild every day building into out/rerender/art/
python3 tools/rerender.py 'tod/night/units/' --shipped ~/game/art   # rebuild and compare with your shipped files
python3 tools/rerender.py --list 'crawler'                           # just show the lines
```

- **Steps:** it renders each time of day into `out/rerender/raw/<time>/`, composes, runs the finishing steps, and copies every file to `out/rerender/<file>`.
- **Missing inputs:** it pulls in what a selection needs, such as the wall post for the arm shadows.
- **Resuming:** it skips renders that already exist, so a stopped run carries on where it left off. `--force` re-renders anyway.
- **Comparing:** with `--shipped DIR`, it finds each shipped file under `DIR` (by its path, then by its name in the right time-of-day folder) and compares it pixel by pixel. It writes `out/rerender/report.tsv` and exits with code 1 if anything differs.

Everything is about 1,290 renders. They take 8–20 s each on a 2-core machine, so a full rebuild takes several hours. Run sections at a time if you prefer.

## Checking day parity

The day art was rendered before time of day existed, so the check is whether today's `lib.js` still renders the shipped day images exactly. Point the checker at your game's art folder:

```
python3 tools/rerender.py '^art/(buildings|units|rail|bridges)/' --shipped <game>/art
```

- **Expected result:** every file prints as `identical` (max difference 0), apart from the three scenes listed under "Not bit-for-bit" below.
- **If everything differs a little:** check `node tools/check-webgl.js` first. A different Chrome, or a GPU, is the usual cause.
- **If only one scene differs:** that scene changed.

## Previews

The scripts in `preview/` build the review videos and mock-ups from a shipped art folder:

- `exhaust_preview.py`;
- `generator_preview.py`;
- `pulse_preview.py`;
- `streetlamps_mock.py`;
- `defences_sheet.py`;
- `post/post_loops.py preview`.

Set `TERRAFALL_ART` to the folder. It's laid out like the game: `art/<group>/`, `art/tod/<time>/<group>/` and `art/tiles/ground.png`, which `terrain/terrain_desert.py` also makes. The scripts write to `out/preview/`. The videos need ffmpeg.

## Terrain

`terrain/` is a separate pure-Python renderer, built on `tex.py` (noise, normals, lighting) and `r3d.py` (a small software ray-marcher for the plants). Run each script from this folder. Each writes into `out/art/…` (the canyon tiles go to `out/canyon/`):

| Script | Makes |
|---|---|
| `terrain_desert.py [ground\|water\|rock]` | the desert tiles |
| `terrain_biomes.py [ground-jungle …]` | jungle and polar ground, water, rock and cliffs |
| `plants_desert.py`, `plants_jungle.py`, `plants_polar.py [1-6]` | the plants |
| `canyon.py out/canyon` | the canyon tiles |

## Not included, and known gaps

- **Files with no generating script:**
  - `art/tod/shared/light-pool.png` and `art/tod/shared/time-of-day.json` were written by hand during the day/night work, and no script was kept. The shipped files are the source.
  - `art/markers/nuclear-missile.png`, the top-down projectile, was rendered with a scene that wasn't kept.
- **Not bit-for-bit:** `charger.js`, `roadworks.js` and `commandbase.js` use `Math.random()` for one grime texture:
  - the Charging Station's ground stains;
  - the Roadworks' asphalt speckle;
  - the old Command Base's scuffs.

  Re-renders match everywhere except in that grime. Switching to the seeded `L.rnd()` would make them repeatable, but it would also change the shipped look slightly, so I left them alone. `commandbase.js` isn't shipped.
- **App icon:** `icon.js` is here, and `jobs.txt` has its 2048 px render. The store sizes were cut from it by hand.
- **Superseded art:** `jobs.txt` gives the current version of each file. Earlier versions were replaced and aren't listed:
  - the Freight Truck before it got exhaust stacks;
  - the first 8-direction day turret heads;
  - the first set of day walls.

  The spark frames still come from the original walls kit, and they re-render the same.
- **Where the nuke blast and icon files go:** `jobs.txt` names them by the folders the scripts write (`nuke-blast/…`, `icon/…`). Where they sit in your game wasn't recorded here.
- **Not packed:** `node_modules/` and `./chrome` (run `npm ci` and `npm run install-chrome`), and the rendered art itself, apart from `example/smelter.png`.
- **The Chrome download:** I couldn't fetch the Chrome zip from this workspace, because the network is restricted. The browser these renders came from reports itself as Chrome for Testing 153.0.8010.12, which is the build `npm run install-chrome` asks for.

## In a Claude Code cloud session

The game's repository keeps this folder as `renderer/`. A cloud session already has the right Node (22.23.4), Python
(3.13.18), numpy and Pillow, and its pre-installed Playwright browser is Chrome for Testing 153.0.8010.12, which
`chrome.js` finds by itself. To set up:

```
cd renderer
npm ci
pip install scipy==1.18.1
node tools/check-webgl.js        # Chrome/153.0.8010.12, SwiftShader
```

Checked there (November): the walkthrough Smelter, the Generator (day, night and a working-loop frame), the Freight
Truck and the Tanker (day and night) all re-render with the same outline and alpha as the shipped files, and colour
within a level or two (a mean difference under 0.11 of a level, a handful of pixels up to 12): SwiftShader's
floating point varies a little between processors (that machine has AVX-512). Two renders on the same machine are
byte-identical. The 2D effect sheets (`fx-exhaust`, `fx-exhaust-heavy`) are pixel for pixel identical.

## What was checked

I unpacked the zip into an empty folder, ran `npm ci`, and ran the walkthrough above. The Smelter came out identical to `example/smelter.png`.

I then used `tools/rerender.py --shipped` to compare against every shipped file still in this workspace. That's 1,479 of the 1,567 files in `jobs.txt`; the rest were delivered in earlier sessions. I re-rendered a sample of 161, covering every scene, every `part=`, all four times of day, every compose setting and every finishing script:

| | Files compared | Pixel for pixel identical |
|---|---|---|
| Day buildings: the original 12, military, nuclear, lab, station, ropeway, nest, Generator and defences | 25 | 25 |
| Day gun heads: turret 16-direction, mortar 8- and 16-direction | 3 | 3 |
| Working loops, including the Smelter embers, plus the Bunker fire and Disruptor pulse overlays | 15 | 15 |
| Pulse Cannon: 16 charge sheets, laser, hit and muzzle points | 19 | 19 |
| Rail and bridges, including `rail-lights-on`, the tower lamp and hazed piers | 6 | 6 |
| Day vehicles, wildlife and overlays: truck and tanker brake/boost, Road Train, freight lights/brake/exhaust, Crawler frames, dish, lights, dust and deploy d0/d3/base | 25 | 25 |
| Walls and gates, with spark frames | 5 | 5 |
| Streetlamps: unlit, lit heads and pools | 6 | 6 |
| 2D sheets: explosion, smoke, steam, black smoke, flare, exhaust | 7 | 7 |
| Point files: emitters, exhaust, generator, defences, streetlamps | 5 | 5 |
| Headlights (`art/tod/shared`) | 10 | 10 |
| Morning, evening and night: buildings, 16- and 8-direction turret heads, mortar head, vehicles, robots, Crawler d3 dust and base, tiles, walls | 31 | 29 |
| Terrain: desert ground, jungle water, polar plant, canyon lip | 4 | 4 |
| **Total** | **161** | **159** |

- **The two that differ:** the night Charging Station and the night Roadworks. They differ only in the `Math.random()` grime described above: the Roadworks by at most 3 levels, the Charging Station by more, in its ground stains.
- **Previews:** `preview/exhaust_preview.py` and `preview/generator_preview.py` ran against a folder of the shipped art and produced their videos.
- **Not compared here:** I couldn't compare the day robots and their overlays, 11 day buildings, the nuke blast or the icon, because those files were delivered in earlier sessions and aren't in this workspace. Run `tools/rerender.py --shipped <game>/art` on them to check.
