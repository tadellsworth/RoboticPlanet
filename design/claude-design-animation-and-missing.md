# Terrafall: Claude Design prompts for building animation, and the missing art

Two parts. **Part 1** fills the gaps: art the game still draws in code or with an older flat image. **Part 2** brings
the buildings to life: smoke from chimneys, steam from vents, flare-stack flames, and moving parts while a building
is working.

Use the **same Claude Design chat and 3D renderer** as the 3D buildings and the day/night kit, so camera, light and pad
match. Every building image is a **512 × 512 transparent PNG, anchor [0.5, 0.615], scale 1.4** (unless noted), like
the rest. Send the results back as zips with the exact file names given, and Claude Code wires them in.

---

## Part 1: missing art

### 1A. The Pulse Turret by day (most important)

The morning, evening and night sets of the 3D Pulse Turret already exist (`art/tod/<time>/buildings/turret@T.png`
and `turret-head-0…15@T.png`), but there is **no daytime version**. So the game still draws the old flat top-down
turret, and the new charge-up sheets (`turret-charge-0…15`, made to sit on the 3D head) can't be used.

```
Render the Pulse Turret by day, from the same scene as its morning, evening and night versions (pulseturret.js),
with the same camera, pad, anchor [0.5, 0.615] and scale 1.4, under plain day light (as the other day buildings):
- turret@0.png and turret@1.png: the base alone (pad and plinth, no gun head), cyan #38d4ff and red #ff5a6e.
- turret-head-0@0.png … turret-head-15@0.png and the same @1: the twin-barrel gun head alone, in 16 directions
  (0 right, then clockwise on screen: 4 down toward the viewer, 8 left, 12 up), on the same canvas so each stacks
  exactly on the base.
512 x 512 transparent PNGs, file names exactly as above, so they match the night set and the turret-charge sheets.
```

### 1B. Walls and Gates by day

The day/night kit also has 3D Wall and Gate pieces for morning, evening and night, but none by day, so the game
draws Walls and Gates in code.

```
Render the Wall and Gate kit by day, from the same scenes and camera as their morning, evening and night versions,
both teams (@0 cyan, @1 red), same file names as the night set:
wall-n, wall-e, wall-s, wall-w, wall-hub-ew, wall-hub-ns, wall-post,
gate-ew-open, gate-ew-closed, gate-ns-open, gate-ns-closed.
Include the kit's notes on how the pieces join (which piece goes where for a straight run, a corner, a tee, an end).
```

### 1C. Smaller pieces still drawn in code

These have prompts already. Paste the matching section of `ART_GUIDE.md` (Batches 2 to 5) into Claude Design:

| Pieces | Where the prompts are |
|---|---|
| Goods icons (14, 64 × 64): fiber, stone, ore, crystal, alloy, chip, crude, fuel, cement, asphalt, ammo, warhead, uranium, fissile | ART_GUIDE Batch 2 (uranium and fissile: same style, glowing green and yellow-green) |
| Resources: `crop` (Bio Farm energy crops), `oil` (oil seep), `uranium` (green deposit) | ART_GUIDE Batches 4 and the Nuclear race notes |
| Ground: `fertile`, `slope`, `cliff` (128 × 128) | ART_GUIDE Batch 2 |
| Markers: `missile` (in flight, nose right), `rally` (flag), `oneway` (arrow) | ART_GUIDE Batch 3 |
| Weapon effects: muzzle flash, tracer, bullet impact, sparks, smoke, explosion, debris, electric arc, collapse dust cloud, and the ground marks (pockmarks, burns, scorch, rubble) | `design/claude-design-effects-and-defences.md`, **Part A** (prompts A01 to A14) |

---

## Part 2: animated buildings

### How the game will use it

- **Emitters** (smoke, steam, flame, sparks, dust): the game sends rising puffs from fixed points on each building,
  such as chimney tops, vents and flare stacks, **while the building is working**. Faster when it's busy, none when
  it's stopped. It needs only the points (2A) and a few small particle sheets (2B).
- **Working loops**: short loops of frames, played while the building works, showing only the parts that change
  (2C). Examples: a furnace glow that flickers, spinning fans, a turning kiln drum, a bobbing pumpjack.
- No morning, evening or night versions are needed for these: the game darkens the moving parts itself, and the
  glows and flames are light.

### 2A. Emitter points (one file, no images)

```
For each of these buildings, mark in the renderer (L.mark) every point where smoke, steam, flame, sparks or dust
should come out, and export them in pixels of its 512 x 512 canvas as building-emitters.json:
{ "smelter": [ { "kind": "smoke", "px": [x, y], "size": 1.0 }, ... ], ... }
kind is one of: smoke (grey-brown industrial smoke from a chimney), black (thick black smoke), steam (white,
fading fast), flame (a flare-stack flame), sparks (welding sparks), dust (rock dust).
size is how big the puffs are, 1 = a normal chimney.
Buildings and what each gives off:
- smelter: smoke from the tall stack (1.2); sparks at the furnace mouth.
- fab (Chip Fab): steam from the roof vents (small, 0.6).
- foundry (Bot Foundry): sparks inside the open bay; steam from a vent.
- refinery: flame at the top of the flare stack; steam from the column.
- kiln (Cement Works): smoke from the kiln stack (1.2); dust where the drum feeds.
- tarworks (Asphalt Plant): black smoke from the stack; steam over the tar tank.
- munitions (Ammo Plant): steam from vents.
- armory (Missile Factory): steam from vents.
- reactor (Nuclear Reactor): a big white steam plume from the cooling tower (2.5).
- charger (Charging Station): none (it has a working loop instead).
- quarry: dust at the crusher.  mine: dust at the drill head.
- roadworks: steam from the asphalt tank.
- lander@0 (Command Base): steam from the engine vents (small).
```

### 2B. Particle sheets (4 small sprite sheets)

```
Four looping-free particle sprite sheets, transparent background (not black), grids read left to right then top to
bottom, the last frame faded to nothing:
- fx-chimney-smoke.png: 16 frames of 128 x 128 (4 x 4). One puff of grey-brown industrial smoke: starts small and
  dense at the bottom centre, billows up and out, drifts a little right, thins and fades. Soft, lit from the top-left.
- fx-steam.png: 12 frames of 128 x 128 (4 x 3). A white steam puff: quicker, lighter and more see-through than the
  smoke, rising and vanishing.
- fx-black-smoke.png: 16 frames of 128 x 128 (4 x 4). Thick sooty black smoke, as the first but darker and heavier.
- fx-flare.png: 8 frames of 128 x 256 (8 x 1), a LOOP (no fade): a gas flare flame flickering at the top of a
  stack, white-yellow core, orange edges, base at the bottom centre.
The puff's starting point (where it leaves the chimney) is the bottom centre of each frame.
```

### 2C. Working loops

Each loop is **8 frames** on the building's own 512 × 512 canvas and anchor, named `<building>-work-0.png` …
`-7.png`, played at about 8 frames a second while the building works. Show **only the parts that move or change**,
in exactly the same place as on the building image. Leave everything else transparent so it stacks on top.

When a part moves away from where the building image shows it (a pumpjack beam, a crane), render the building
**without that part** as `<building>-base.png`, and the part in its 8 positions as the loop (like the Mortar Pit and
its tube).

```
Working loops for these buildings, 8 frames each, same canvas and anchor as the building:
- smelter-work: the furnace mouth's glow flickering, brighter and dimmer, with a few embers.
- fab-work: the rooftop cooling fans spinning; the circuit-pattern lights rippling.
- foundry-work: the assembly arms in the bay moving through a weld, with the weld flash.
- kiln-work: the long kiln drum turning (its bands and bolts rotate).
- refinery-work: the column lights blinking slowly (the flame comes from fx-flare).
- pump-base + pump-work: the Oil Pump without its walking beam, and the beam and horse-head nodding up and down
  through one stroke.
- mine-work: the drilling rig's drill string turning.
- quarry-work: the crusher's hammer rising and falling.
- harvester-work: the cutting saw spinning.
- tap-work (Crystal Tap): a pulse of violet light running up the conduits.
- charger-work: the charging lights pulsing round, as if power flows to a robot.
- lab-work (Research Lab): the scanner dish turning.
- grower-work and farm-work: misting sprays over the seedlings and crops.
- lander@0-work and lander@1-work (Command Base): the radar dish turning and the beacon blinking (team colours).
Glows and lights in these loops are light: one version, no time-of-day versions needed.
```

**Order to make them in:** 1A (the turret, so the charge-up glow can go in), 2A and 2B (smoke from every factory,
one small set of files), then the 2C loops a few at a time, starting with the Smelter, Refinery, Oil Pump and
Nuclear Reactor.
