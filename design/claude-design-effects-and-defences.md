# Terrafall: Claude Design prompts for weapon effects and the new defences

Two sets of art, each in **its own Claude Design chat**:

- **Part A: weapon effects** (13 animated sprite sheets): muzzle flashes, tracers, bullet impacts, sparks, smoke,
  explosions, flying debris, electric arcs, the collapse dust cloud, and ground marks (bullet pockmarks, laser
  burns, scorch marks, rubble).
- **Part B: the new defences**: the Bunker, Disruptor Tower and Mortar Pit, each in your cyan and the rival's red,
  plus the Mortar's tube in 8 directions.

The game already draws all of these in code, so there's no rush and no order you have to follow. Each piece of art
replaces its code drawing as soon as it's wired in. Export each image with the exact file name given (PNG or WebP),
zip each part, and send the zips to Claude Code to wire into the game.

## Part A: weapon effects

**How to use it:** open a new Claude Design chat, attach `game-screenshot.png` (so it sees the ground colour and
how small things are), paste the effects brief, then the prompts one at a time. Make **fx-explosion** first and
send it to Claude Code to check in the game before doing the rest.

**Rules that matter for every sheet**

- **Transparent background, not black.** Effects packs are often made on black for "additive glow". Here a black
  background shows as black boxes in the game. Fire and sparks are bright and opaque; smoke and dust are
  semi-transparent with soft, feathered edges.
- **A grid of equal frames**, read left to right, then row by row, with no borders, gaps or numbers. The game plays
  the frames once, so the **last frame should have faded to almost nothing**.
- **Exact sizes**: each prompt gives the frame size and the grid. If the grid comes out uneven, ask for the frames as
  separate images instead (for example `fx-explosion-00.png` to `fx-explosion-15.png`): Claude Code will pack them.
- **Directional effects** (`fx-muzzle`, `fx-tracer`, `fx-arc`) point **right**; the game turns them. The tracer and
  arc are **stretched** to the length of each shot, so keep their detail even along their length.
- **Ground marks** (`decal-…`) are a row of **variants**, not an animation: the game picks one at random for each mark.

**Specs**

| Key | What | Frame size | Frames (grid) | Plays over | How it's placed | On screen |
|---|---|---|---|---|---|---|
| `fx-muzzle` | Gun muzzle flash (Warbots, Bunker, and pointing up for the Mortar) | 256×128 | 4 (4×1) | 0.1 s | **points right**; the barrel's end is the middle of the left edge; turned to face each shot | 0.55 tiles long (Mortar 0.9) |
| `fx-tracer` | Bullet streak from the gun to the target | 512×64 | 3 (1×3) | 0.12 s | **points right**: gun at the left edge, target at the right; **stretched** to the shot's length | as long as the shot, ½ tile thick |
| `fx-impact` | Dust kicked up where a round hits the ground | 128×128 | 8 (4×2) | 0.55 s | the hit point is the centre | ⅔ tile |
| `fx-spark` | Sparks where a round hits a building | 128×128 | 6 (6×1) | 0.35 s | the hit point is the centre | 1 tile |
| `fx-smoke` | Smoke: gun smoke, blast smoke columns, missile and shell trails, burning | 256×256 | 16 (4×4) | 0.9 – 3 s | the source sits **⅔ of the way down**, centred; the smoke rises and spreads within the frame | 0.4 – 3 tiles |
| `fx-explosion` | The fireball of every blast | 256×256 (or 512×512) | 16 (4×4) | 0.6 s | ground zero sits **⅔ of the way down**, centred | 1.2 tiles (a robot), 2.3 (a mortar shell), 3.3 (a building), 6.6 (a missile) |
| `fx-debris` | Chunks of metal and concrete thrown out by a blast | 256×256 | 12 (4×3) | 0.9 s | the blast point is the centre; chunks fly up and out and fall back round it | 1.4 – 3 tiles |
| `fx-arc` | The Disruptor's electric arc | 512×128 | 6 (1×6) | 0.3 s | **points right**: the bolt must touch the middle of the left edge (the orb) and of the right edge (the robot); **stretched** to the distance | as long as the arc, ½ tile thick |
| `fx-dustcloud` | Dust billowing out as a building collapses | 256×256 (or 512×512) | 16 (4×4) | 2.2 s | the building's foot sits **⅔ of the way down**, centred | 2.2 tiles (the Command Base 3.5) |
| `decal-pock` | Bullet pockmarks in the ground | 64×64 | 4 variants (4×1) | fades over 25 s | centred on the hit | ¼ tile |
| `decal-burn` | Laser burn on the ground (Pulse Turret) | 64×64 | 4 variants (4×1) | fades over 30 s | centred | ⅓ tile |
| `decal-scorch` | Blast scorch mark | 256×256 | 4 variants (4×1) | fades over 35 – 70 s | centred | 0.8 – 3.4 tiles |
| `decal-rubble` | The ruins left where a building stood | 256×256 | 4 variants (2×2) | fades over 90 s | centred on the building's pad | 1.2 tiles (the Command Base 1.9) |

### A1. Effects brief (paste first)

_attach game-screenshot.png_

```
I'm making animated visual-effects sprite sheets for Terrafall, a mobile strategy game on a dusty orange-brown
alien planet, run by robots. The game is seen from a high three-quarter overhead camera, like a detailed
miniature: realistic, gritty industrial sci-fi, not cartoony. The effects should match: like real film VFX
(gunfire, dust, fire, black smoke, sparks), simplified into bold, readable shapes because each one is only a few
dozen pixels wide on a phone.

Every sheet is a grid of equal frames read left to right, then top to bottom, on a TRANSPARENT background (not
black): fire and sparks in bright, opaque colours, smoke and dust semi-transparent with soft, feathered edges.
Light comes from the top-left. The animation plays once and its last frame has faded to almost nothing. No text,
no frame borders, no numbers, no ground or background.

Palette: the fire is white-hot yellow at the core, orange, then deep red at the edges; smoke is dark charcoal
grey to brown-grey; dust is the colour of the planet's rust-ochre sand (#b8743f to #d9a066); metal debris is
gunmetal grey with a few hot orange edges.
```

### A2. fx-explosion → export as `fx-explosion.png`

```
An explosion sprite sheet: 16 frames of 256x256 in a 4x4 grid (1024x1024 overall). Ground zero is centred
horizontally, two thirds of the way down each frame. Frame 1: a small white-hot flash. Frames 2-5: a fireball
bursts up and out, yellow-white core, orange and red edges, flecks of burning debris. Frames 6-10: the fire rolls
upward into a mushrooming ball, darkening at the edges into thick black smoke. Frames 11-16: the fire dies, leaving
a rising, thinning cloud of dark smoke that fades to nothing. Fill most of the frame at its biggest, without
touching the edges.
```

### A3. fx-muzzle → export as `fx-muzzle.png`

```
A gun muzzle-flash sprite sheet: 4 frames of 256x128 in one row (1024x128). The gun barrel's end is at the middle
of each frame's left edge and the flash fires to the right, seen from above. Frame 1: a sharp, bright white-yellow
star-shaped burst with a cone of flame reaching two thirds of the frame. Frame 2: slightly bigger, orange at the
tips, with two small side flares. Frame 3: breaking up into orange tongues and a puff of grey smoke. Frame 4: a
faint wisp of smoke, nearly gone.
```

### A4. fx-tracer → export as `fx-tracer.png`

```
A bullet-tracer sprite sheet: 3 frames of 512x64 stacked in one column (512x192). Each frame is a thin glowing
streak running the full width of the frame, through the vertical middle, about 6 pixels thick: hot yellow-white at
the right end (the bullet's head), fading through orange to transparent at the left. Frame 1: the full streak.
Frame 2: the tail half gone, the head still bright. Frame 3: only a faint short glint at the right end.
```

### A5. fx-impact → export as `fx-impact.png`

```
A bullet-impact sprite sheet: 8 frames of 128x128 in a 4x2 grid (512x256). A round hitting sandy ground, seen from
above at a steep angle, centred: a small sharp spray of sand and grit thrown up and outward, a few pebbles flying,
then a little cloud of rust-ochre dust that spreads, settles and fades. Frame 1 is a bright little puff; the last
frame is nearly transparent.
```

### A6. fx-spark → export as `fx-spark.png`

```
A sparks sprite sheet: 6 frames of 128x128 in one row (768x128). A bullet striking armoured steel, centred: a
shower of bright yellow-white sparks bursting outward in thin streaks, with a small white flash at the centre in
the first frame. The sparks fly further and fall slightly with each frame, turn orange, then go out.
```

### A7. fx-smoke → export as `fx-smoke.png`

```
A smoke sprite sheet: 16 frames of 256x256 in a 4x4 grid (1024x1024). The smoke comes from a point centred
horizontally, two thirds of the way down each frame. Frame 1: a small, dense grey puff. It billows, grows and rises
toward the top of the frame, drifting a little to the right, turning from dark charcoal to lighter brown-grey and
more transparent, and breaks up into wisps that are gone by frame 16. Soft and volumetric, lit from the top-left.
```

### A8. fx-debris → export as `fx-debris.png`

```
A debris sprite sheet: 12 frames of 256x256 in a 4x3 grid (1024x768). From the centre of the frame, 8 to 10 jagged
chunks of broken concrete, twisted gunmetal plate and a few glowing hot fragments are thrown up and out in all
directions, tumbling, then fall back down and land in a rough ring round the centre, the hot ones cooling from
orange to grey. Each chunk casts a tiny soft shadow. Nothing leaves the frame. Fade them out over the last 3 frames.
```

### A9. fx-arc → export as `fx-arc.png`

```
An electric-arc sprite sheet: 6 frames of 512x128 stacked in one column (512x768). Each frame is a jagged,
branching lightning bolt running the full width, from the middle of the left edge to the middle of the right edge,
ice blue (#8fd8ff) with a white-hot core and a soft blue glow round it, with a few small side forks. Each frame is a
different random bolt shape (it flickers). Frames 5 and 6 get thinner and dimmer.
```

### A10. fx-dustcloud → export as `fx-dustcloud.png`

```
A building-collapse dust-cloud sprite sheet: 16 frames of 256x256 in a 4x4 grid (1024x1024). The base of a
collapsing building is centred horizontally, two thirds of the way down. Thick billowing clouds of rust-ochre dust
and grey concrete powder roll outward along the ground in both directions and churn upward, with a few chunks of
rubble tumbling in it; at its biggest it fills most of the frame. Then it slowly thins, settles and fades,
transparent by frame 16.
```

### A11. decal-pock → export as `decal-pock.png`

```
Four small ground-mark variants in one row, each 64x64 (256x64 overall): bullet pockmarks in sandy ground, seen
from above at a steep three-quarter angle. Each variant is a cluster of 2 to 4 small dark craters with a lighter
rim of thrown-up sand, in a different arrangement each time. Transparent background, soft edges.
```

### A12. decal-burn → export as `decal-burn.png`

```
Four small ground-mark variants in one row, each 64x64 (256x64 overall): laser burns on sandy ground, seen from
above at a steep three-quarter angle: a glassy, blackened oval with a faint dark-brown scorched halo and a thin wisp
of a fading orange edge. Each variant a little different in shape. Transparent background, soft edges.
```

### A13. decal-scorch → export as `decal-scorch.png`

```
Four ground-mark variants in one row, each 256x256 (1024x256 overall): a blast scorch mark on sandy ground, seen
from above at a steep three-quarter angle, so it's an oval about three quarters as tall as wide: a shallow dark
crater in the middle, charred black ground, radiating streaks of soot and blown sand, fading softly to transparent
at the edges. Each variant a different irregular shape.
```

### A14. decal-rubble → export as `decal-rubble.png`

```
Four ground-mark variants in a 2x2 grid, each 256x256 (512x512 overall): the flattened ruins of a destroyed
industrial building, seen from the same high three-quarter camera as the buildings: a low heap of broken concrete
slabs, twisted rebar and steel beams, crushed pipes and a few scorched gunmetal panels with faded hazard stripes,
grey dust over everything, lit from the top-left. Low, almost flat: no wall stands higher than a robot. Neutral
colours, no team colour, no glow. Transparent background, the heap filling about 85% of the frame.
```

## Part B: Bunker, Disruptor Tower and Mortar Pit

**How to use it:** use the same Claude Design chat as the earlier 3D buildings if you still have it, or a new one.
Attach `smelter.png` (the style anchor) and `outpost@0.png` (so the three read as the same military family), paste
the building style brief, then the prompts one at a time. Each is a **512×512 PNG with a transparent background**,
the foundation pad on the bottom edge like the other 3D buildings.

The Mortar's 8 tube images must line up: the round base plate at the bottom of the tube stays in exactly the same
spot in all eight, or the tube will wobble as it turns. Directions are as seen on screen: down is toward the viewer.

**Specs**

| Key | What | Needed? |
|---|---|---|
| `bunker@0`, `bunker@1` | Bunker | yes |
| `bunker-fire@0`, `bunker-fire@1` | Overlay: muzzle flashes at its firing slit, flashed as it shoots | optional |
| `disruptor@0`, `disruptor@1` | Disruptor Tower | yes |
| `disruptor-pulse` | Overlay: coils and orb lit up, faded in and out with each pulse (one version: the pulse colour is the same for every team) | optional |
| `mortar@0`, `mortar@1` | Mortar Pit, the pit and sandbags with **no tube** | yes |
| `mortar-head-0` … `mortar-head-7` | The tube on its own in 8 directions, swapped as it aims (one set, no team colour; or 16 directions, `-0` … `-15`) | yes, with the pit |

### B1. Building style brief (paste first)

_attach smelter.png + outpost@0.png_

```
I'm making building sprites for Terrafall, a mobile colony-logistics strategy game on a dusty orange-brown alien
planet. Every building should look like a realistic, pre-rendered 3D industrial model: like a detailed miniature
photographed in warm sunlight. Each one is a compact robotic industrial facility standing on a square concrete
and steel foundation pad.

Camera: a high three-quarter view looking down at about 55-60 degrees, square-on to the viewer (not turned to a
diagonal), so the roof and the front face are both visible. Use exactly the same camera for every building.

Lighting: warm sun from the top-left, soft ambient fill, a short soft shadow falling down-right onto the pad. No
shadow beyond the pad.

Materials: weathered painted steel in gunmetal, warm grey and faded off-white; ribbed and riveted panels;
concrete; pipes, ducts, vents and cable runs; catwalks with railings; yellow-and-black hazard stripes; a little
dust and rust on the edges. Each building has one accent light colour that matches what it makes; I'll give it
with each building.

Format: 512x512 PNG with a transparent background. The foundation pad sits on the bottom edge (about 4% margin)
and spans about 75% of the width; the structure rises upward from it, and nothing touches the top or the sides.
No ground around the pad, no text, no logos, no people or robots.

Readability: it is shown at about 50 pixels wide on a phone, so give it a strong, distinctive silhouette, chunky
forms, clear contrast between lit and shaded faces, and a few large details rather than many tiny ones.
```

### B2. Bunker (yours, cyan) → export as `bunker@0.png`

```
A Bunker: a low, squat reinforced-concrete pillbox for two robots, on the usual concrete and steel foundation pad.
Thick sloped walls of weathered grey concrete with chipped edges and rust-streaked steel plates bolted over them,
a flat armoured roof with a small sensor dome and a periscope, and one long horizontal firing slit across the front
(south) face, dark inside. Concrete blocks and a few sandbags banked against the corners, yellow-and-black hazard
stripes along the roof edge. Team colour cyan #38d4ff in two small status lights on the roof and a thin light strip
just above the firing slit. It should hug the ground: lower and wider than the Outpost, about two thirds of its
height. Size class: about 1.2 tiles. Same camera angle, lighting, materials and scale as the Smelter.
```

### B3. Bunker (rival, red) → export as `bunker@1.png`

```
The same Bunker again, identical in every way, except every cyan #38d4ff accent light is now coral red
#ff5a6e: the rival team's version. Same canvas, same position, same lighting. Nothing else changes.
```

### B4. Bunker firing overlay (optional) → export as `bunker-fire@0.png`

```
Now only the muzzle flashes, on their own: two bright yellow-white muzzle flashes with a few orange sparks bursting
out of the firing slit of the Bunker you just made, one left of centre and one right of centre, where its two gun
barrels would be. Same 512x512 canvas and exactly the same position as the Bunker, so the two images stack
perfectly. Transparent everywhere else: no bunker, no pad, no shadow.
```

### B5. Bunker firing overlay, rival (optional) → export as `bunker-fire@1.png`

```
The same muzzle-flash overlay again for the red Bunker: identical flashes, same canvas and position.
(If the flashes have no cyan in them, this can be an exact copy.)
```

### B6. Disruptor Tower (yours, cyan) → export as `disruptor@0.png`

```
A Disruptor Tower: an electromagnetic pulse emitter on the foundation pad. A slim armoured mast of dark graphite
steel rises from a heavy octagonal base packed with capacitor banks, cable bundles and a small cooling fan. Three
stacked copper-and-steel induction coils wrap the mast, smaller toward the top, with ceramic insulators between
them, and a glass-and-steel orb crowns it. Warning stripes on the base. The coils and the orb glow a soft electric
ice blue #8fd8ff (the pulse colour, the same for every team); team colour cyan #38d4ff in a light band around the
base. Taller and thinner than the other buildings, with a strong vertical silhouette, on the usual pad. Size class:
about 1.3 tiles. Same camera angle, lighting, materials and scale as the Smelter.
```

### B7. Disruptor Tower (rival, red) → export as `disruptor@1.png`

```
The same Disruptor Tower again, identical in every way, except every cyan #38d4ff accent light is now coral red
#ff5a6e: the rival team's version. Same canvas, same position, same lighting. Nothing else changes.
The ice-blue coils and orb stay ice blue: only the team-colour band changes.
```

### B8. Disruptor pulse overlay (optional) → export as `disruptor-pulse.png`

```
Now only the pulse glow, on its own: the three coils and the orb of the Disruptor Tower you just made, lit up
blindingly bright ice blue fading to white at the core, with a soft blue halo round them and a few thin electric arcs
jumping between the coils. Same 512x512 canvas and exactly the same position as the tower, so the two images stack
perfectly. Transparent everywhere else: no tower body, no pad, no shadow.
```

### B9. Mortar Pit, no tube (yours, cyan) → export as `mortar@0.png`

```
A Mortar Pit, without its gun: a round, sunken artillery emplacement on the foundation pad. A ring of stacked
sandbags and concrete blocks around a dug-in pit, ammunition crates stacked against the inside wall, a small
rangefinder on a tripod and a few spent shell casings on the floor. In the middle of the pit leave a round steel
turntable plate empty: the mortar tube sits there. Accents: team colour cyan #38d4ff on a small signal lamp and a
stripe on the crates, and a warm amber #ffb347 lamp on the rangefinder. Low and wide: the sandbag ring is barely
higher than the Bunker. Size class: about 1.3 tiles. Same camera angle, lighting, materials and scale as the Smelter.
```

### B10. Mortar Pit, no tube (rival, red) → export as `mortar@1.png`

```
The same Mortar Pit (still with no tube) again, identical in every way, except every cyan #38d4ff accent light is now coral red
#ff5a6e: the rival team's version. Same canvas, same position, same lighting. Nothing else changes.
The amber rangefinder lamp stays amber.
```

### B11. Mortar tube pointing right → export as `mortar-head-0.png`

```
Now only the mortar itself, on its own: a heavy, stubby mortar tube of dark gunmetal on a bipod and a round base
plate, tilted steeply up at about 60 degrees, its muzzle leaning to the right, with a sight on the side and a scuffed
hazard stripe round the muzzle. Put it on the same 512x512 transparent canvas, in exactly the position where it sits
on the empty turntable of the pit you just made, so the two images stack perfectly. Nothing else in the image: no
pit, no pad, no shadow on the ground. Same camera, lighting and scale as before.
```

### B12. Mortar tube 1: down-right → export as `mortar-head-1.png`

```
The identical mortar, turned on its turntable so the muzzle leans down-right (toward the viewer, to the right).
Same canvas, same position on the turntable, same lighting from the top-left: only the mortar has turned, the light
has not. The round base plate stays in exactly the same spot as in mortar-head-0.
```

### B13. Mortar tube 2: straight down → export as `mortar-head-2.png`

```
The identical mortar, turned on its turntable so the muzzle leans straight down (toward the viewer).
Same canvas, same position on the turntable, same lighting from the top-left: only the mortar has turned, the light
has not. The round base plate stays in exactly the same spot as in mortar-head-0.
```

### B14. Mortar tube 3: down-left → export as `mortar-head-3.png`

```
The identical mortar, turned on its turntable so the muzzle leans down-left (toward the viewer, to the left).
Same canvas, same position on the turntable, same lighting from the top-left: only the mortar has turned, the light
has not. The round base plate stays in exactly the same spot as in mortar-head-0.
```

### B15. Mortar tube 4: straight left → export as `mortar-head-4.png`

```
The identical mortar, turned on its turntable so the muzzle leans straight left.
Same canvas, same position on the turntable, same lighting from the top-left: only the mortar has turned, the light
has not. The round base plate stays in exactly the same spot as in mortar-head-0.
```

### B16. Mortar tube 5: up-left → export as `mortar-head-5.png`

```
The identical mortar, turned on its turntable so the muzzle leans up-left (away from the viewer, to the left).
Same canvas, same position on the turntable, same lighting from the top-left: only the mortar has turned, the light
has not. The round base plate stays in exactly the same spot as in mortar-head-0.
```

### B17. Mortar tube 6: straight up → export as `mortar-head-6.png`

```
The identical mortar, turned on its turntable so the muzzle leans straight up (away from the viewer).
Same canvas, same position on the turntable, same lighting from the top-left: only the mortar has turned, the light
has not. The round base plate stays in exactly the same spot as in mortar-head-0.
```

### B18. Mortar tube 7: up-right → export as `mortar-head-7.png`

```
The identical mortar, turned on its turntable so the muzzle leans up-right (away from the viewer, to the right).
Same canvas, same position on the turntable, same lighting from the top-left: only the mortar has turned, the light
has not. The round base plate stays in exactly the same spot as in mortar-head-0.
```

## Asset checklist

**Part A, weapon effects** (zip these together):

- `fx-explosion.png`
- `fx-muzzle.png`
- `fx-tracer.png`
- `fx-impact.png`
- `fx-spark.png`
- `fx-smoke.png`
- `fx-debris.png`
- `fx-arc.png`
- `fx-dustcloud.png`
- `decal-pock.png`
- `decal-burn.png`
- `decal-scorch.png`
- `decal-rubble.png`

**Part B, defences** (zip these together; the overlays are optional):

- `bunker@0.png`
- `bunker@1.png`
- `bunker-fire@0.png` (optional)
- `bunker-fire@1.png` (optional)
- `disruptor@0.png`
- `disruptor@1.png`
- `disruptor-pulse.png` (optional)
- `mortar@0.png`
- `mortar@1.png`
- `mortar-head-0.png`
- `mortar-head-1.png`
- `mortar-head-2.png`
- `mortar-head-3.png`
- `mortar-head-4.png`
- `mortar-head-5.png`
- `mortar-head-6.png`
- `mortar-head-7.png`
