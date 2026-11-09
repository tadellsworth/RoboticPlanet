# Terrafall: the final Claude Design prompt

Everything that still uses drawn placeholder art: the Crawler (rolling treads, a spinning sensor dish and a full
deploy and pack-up sequence), the Freight Train (spinning roof fans, headlights, brake lights and exhaust, cars
that roll round curves), the Rail Station and track, a 3D bridge kit for water and rail, the Viaduct, the Sky
islands cliffs and canyon floor, the Ropeway and Road Train, the Research Lab, creature nests and creatures, the
empty Silos and the trader ship.

**How to use it:** one Claude Design chat. Attach `smelter.png` and `truck@0-f0.png` from the game's `art/`
folder, paste the master brief, then paste the prompts below one at a time, in order. Check the first Crawler
frame and the first bridge tile in the game before doing the rest. Export WebP or PNG with the exact names given,
zip each group, and send the zips to Claude Code to wire in. The full asset checklist is at the end.

## 1. Master brief (paste first)

```
I'm making the last set of sprites and tiles for Terrafall, a top-down sci-fi colony and logistics strategy game
for phones and desktop: robots build a mining colony on a dusty orange-brown alien planet, move goods by road,
rail, ropeway and bridge, and fight rival colonies. Attached are two finished assets as the style anchors: the
Smelter (a building) and the Freight Truck (a vehicle). Everything new must look like it belongs with them:
realistic, pre-rendered 3D models, like detailed miniatures photographed in warm sunlight. Materials: weathered
painted steel in gunmetal, warm grey and faded off-white, riveted panels, concrete, hydraulics, cable runs,
yellow-and-black hazard stripes, a little dust and rust. One glowing team-colour accent per asset.

There are three kinds of image. Never mix their cameras:
1. BUILDINGS (stations, nests, the Lab): the Smelter's camera, a high three-quarter view looking down at about
   55-60 degrees, square-on. Warm sun from the top-left, a short soft shadow down-right onto the pad. 512x512
   transparent; the foundation pad sits on the bottom edge (about 4% margin) and spans about 75% of the width.
2. VEHICLES and CREATURES (Crawler, train cars, Road Train, creatures): the Freight Truck's camera, an
   orthographic view looking STRAIGHT DOWN, the vehicle facing RIGHT (its front at the right), centred, with NO
   drop shadow and no ground (the game draws the shadow and turns the sprite to face where it drives). Soft sun
   from the top-left. 256x256 transparent unless I say otherwise.
3. TILES (track, bridges, viaducts, cliffs): straight down like the vehicles, lit like the buildings. Each is a square that
   repeats on a grid, so anything that crosses an edge must cross at exactly the position I give, to join the
   next tile. 256x256.

Team colours: player cyan #38d4ff, rival coral red #ff5a6e. For every team asset make the cyan version first,
then "the same image with every cyan accent changed to red #ff5a6e" (@0 and @1). The game recolours a third,
green team itself.

Animation: each frame is a separate image with an identical canvas, framing and lighting. Only the moving parts
change, and the last frame must loop smoothly back into the first. Driving frames are named -f0, -f1...;
one-off sequences -d0, -d1...; overlays (lights, glows, dust) are separate transparent layers with the same
framing that the game fades in and out.

Readability: a map tile is only 30-45 pixels wide on a phone. Bold silhouettes, a few large details, strong
lit-versus-shaded contrast, the team accent visible at that size. No text, logos, letters or people.
```

## 2. Crawler

_vehicle camera, 512×512: it is huge, 1.5 by 1 tiles on the map_

```
THE CRAWLER: a colossal tracked mobile base, part mining crawler-transporter, part sci-fi command vehicle, seen
straight down and facing right. Two enormous tread units run the full length of both sides: wide steel track
plates with chunky grousers, with the drive sprockets and idler wheels showing at the ends. Between them a long
armoured hull: a raised command cab at the RIGHT (front) end with a wraparound tinted window band, a flat cargo
deck in the middle with stacked containers and cargo bay hatches, two folded charging arms clamped along the
sides, and a short folded sensor mast with a dish near the back. Weathered off-white and gunmetal, hazard
stripes on the corners, cyan #38d4ff running lights along the hull and on the cab roof. It fills about 90% of
the canvas width and 60% of its height, centred.

a) Driving frames crawler@0-f0 to f7: the treads crawl forward. Each frame moves every track plate forward
   (to the right) by exactly 1/8 of the gap between plates, and the sprockets and idlers turn to match, so f7
   loops into f0. Add a slight weight-shift: on f2 and f6 the hull sits one pixel further back and lower, as if
   the suspension settles over the plates. Nothing else changes.
b) Overlays, same framing, transparent everywhere else:
   - crawler-dish: only the sensor dish and its mast head, seen from above. Put the mast's pivot at canvas pixel
     (180, 256) and say so: the game spins this layer slowly on that point while the Crawler drives.
   - crawler-lights: only the light: two warm headlight pools spreading ahead of the cab past the right edge,
     and an amber rotating-beacon glow on the cab roof. Bright on transparent, so it can be added on top.
   - crawler-dust: a soft red-brown dust plume streaming back from the rear of both treads toward the left edge.
c) Deploy sequence crawler-deploy@0-d0 to d9, same camera and framing (the game plays it over about two
   seconds when the Crawler stops, and backwards when it packs up):
   d0 identical to crawler@0-f0.
   d1-d3 four heavy hydraulic outrigger legs swing out diagonally from the hull's corners and stamp down on round
         foot pads; small dust puffs burst at the pads on d3.
   d4 the hull lifts a little on its jacks: draw it very slightly larger and crisper, with darker contact
         shadows round the four foot pads.
   d5-d6 the side cargo panels fold down and out like wings, opening storage racks and four charging bays whose
         pads glow cyan.
   d7 the two charging arms swing out over the bays.
   d8 the sensor mast telescopes up and its dish opens (it reads as rising because the dish grows a little and
         its shadow on the deck lengthens toward the bottom-right).
   d9 fully deployed: identical to crawlerbase@0.
d) crawlerbase@0: the deployed Crawler as a standing base: outriggers planted, wings open with containers in the
   racks, four lit charging bays, mast up with a cyan beacon. Keep the vehicle camera (straight down, facing
   right) so the game can turn it to the way the Crawler was parked.
Then the team versions in red #ff5a6e (@1) of the frames, the deploy sequence and the base. The dish, lights and
dust layers are shared.
```

## 3. Freight Train

_vehicle camera; each car is its own sprite so the train bends round curves_

```
THE FREIGHT TRAIN: a locomotive and two kinds of wagon, each a separate 256x256 sprite seen straight down and
facing right, about 80% of the canvas wide and 40% tall (0.62 by 0.32 tiles in the game), centred. Each car has
a coupler at both ends exactly on the horizontal centre line, so the cars line up nose to tail. Keep every car
symmetric about that centre line: the game rolls each car along the curve of the track and rocks it a little on
curves.

a) Locomotive freight-loco@0-f0 to f3: a heavy modern freight locomotive from directly above: a long roof with two
   big round radiator fans under grilles, a folded pantograph, an exhaust hatch, walkways with yellow handrails
   down both sides, and a sloped nose at the RIGHT with a wide dark windscreen and twin headlights. Cyan #38d4ff
   livery band along both sides and across the nose. Frames: both roof fans turn a quarter of the way between
   their blades each frame, and the bogie side-frames peeking out under the walkways shift by a quarter of a
   wheel turn, so f3 loops into f0.
b) Overlays for the locomotive, same framing, transparent elsewhere:
   - freight-loco-lights: two long soft headlight beams spreading ahead of the nose off the right edge, warm white.
   - freight-loco-brake: red brake and marker lights at the rear (left) end with a faint glow.
   - freight-loco-exhaust: a thin heat shimmer and smoke wisp rising from the exhaust hatch, drifting toward the
     bottom-right.
c) Wagons, no frames, empty (the game draws the load on them):
   - freight-wagon-flat@0: a long flat container car with low end bulkheads and stake pockets along the sides.
     Leave the deck empty and tell me the pixel rectangle of the empty deck.
   - freight-wagon-hopper@0: an open-topped ore hopper with ribbed sides and a dark empty interior. Tell me the
     pixel rectangle of the opening.
   Both with a cyan stripe along each side. The game alternates them along the train.
Then all of them again in red #ff5a6e (@1). The overlays are shared.
```

## 4. Rail Station

_building camera_

```
A freight Rail Station: a low steel goods shed with a long barrel-vaulted roof, an overhead gantry crane
spanning a loading strip along its front (south) edge with a container hanging from it, stacked containers and
pallets, loading ramps at both ends and a signal mast with a cyan #38d4ff team light. About 1.2 tiles wide at its
pad. The game draws the railway beside it, so no rails in the image. Same camera angle, lighting, materials and
scale as the Smelter. Then the same image with every cyan accent changed to red #ff5a6e.
```

## 5. Rail track tiles

_tiles_

```
RAIL TRACK TILES, 256x256, transparent outside the track bed, seen straight down and lit from the top-left (the
rails cast thin shadows down-right). Standard track on a grey-brown gravel ballast bed: steel rails with a bright
worn top, dark timber sleepers. The ballast bed is 70% of the tile wide and centred; the two rails sit at exactly
33% and 67% across the tile so every tile joins its neighbours.
- rail-straight: running left to right, edge to edge (the game turns it for north-south).
- rail-curve: a 90-degree curve coming in through the left edge and leaving through the bottom edge, at the same
  rail positions.
- rail-tee: straight left to right, with a branch leaving through the bottom edge through a set of points, with
  the switch blades and a small lever box.
- rail-cross: a flat diamond crossing of two lines, left-right and top-bottom.
- rail-end: a buffer stop at the right end (a red-and-white striped buffer beam on a steel frame), track coming in
  from the left.
- rail-level-crossing: the track running left to right across a concrete road that runs top to bottom (the road
  56% of the tile wide), with rubber crossing panels between the rails and white stop lines on the road.
- rail-barrier-up and rail-barrier-down: overlays for the level crossing: a barrier post at each road edge with a
  red-and-white striped arm, raised (seen from above as a short stub at the post) or lowered across its half of
  the road.
- rail-lights-on: only the two red warning lamps on the posts, lit and glowing (the game flashes it while a train
  passes).
```

## 6. Bridges (3D kit)

_tiles: the bridge kit_

```
BRIDGES, 256x256 tiles, transparent wherever there is no bridge, seen straight down, lit from the top-left. A
bridge holds one level all the way across and has to look solid and raised: a thick deck slab, girders showing
below it along its south (bottom) side, railings with posts on both edges, and depth beneath it. The road deck is
56% of the tile wide and centred (its road surface 46%), and joins the next tile edge to edge. Draw no shadow: the
game casts the bridge's shadow onto the water itself.

Make two styles, each as the same set of pieces:
1. bridge-...: a concrete-and-steel girder bridge low over WATER (pale concrete deck, steel girders, short piers).
2. railbridge-...: a riveted steel truss bridge for the railway: its deck carries ballast for the track (no rails:
   the game draws the track on top), with walkways and handrails along both sides.

Pieces for each style:
- -ew: a straight deck running left to right, edge to edge. Its south face shows: the slab edge, then the
  girders (for railbridge, a deep riveted truss).
- -ns: a straight deck running top to bottom, edge to edge. The south face is hidden; show the shaded east side
  of the girders as a narrow strip and a lit edge on the west.
- -end-w, -end-e, -end-n, -end-s: the abutment where the deck meets land on that side: a concrete abutment
  keyed into the shore, the railings ending in squat bollards.
- -ramp-w, -ramp-e, -ramp-n, -ramp-s: the last tile easing down onto lower land on that side: the same deck
  sloping down, with grip grooves across it and the railings stepping down.
- -pier (256x512): the support under one deck tile, from the deck's underside at the top of the image downward.
  bridge-pier: a stout concrete pier meeting the water about a quarter of the way down in a ring of ripples.
  railbridge-pier: a lattice steel trestle meeting the water the same way.
```

## 7. Sky islands cliffs

_ground tiles, opaque and seamless_

```
SKY ISLANDS CLIFFS: on this map the islands are towering mesas standing over a canyon floor far below (three
to five levels down), with sheer rock walls all round and no slopes. 256x256 tiles, seen straight down and lit
from the top-left like the rest.
- cliff-tall: the sheer wall seen just below a mesa's southern rim, filling the whole tile: the top edge is the
  rim (a lit, crumbly red-brown lip), then a vertical face of banded sedimentary strata (rust, ochre and
  dark-brown bands running straight across so the tile repeats left to right, a few vertical cracks and narrow
  ledges), darkening as it goes down.
- cliff-tall-2: the next tile further down the same wall, continuing the strata from cliff-tall's bottom edge,
  darker still, ending in a band of deep shadow and a little scree where the wall meets the canyon floor.
- cliff-foot-w, cliff-foot-e: thin overlays (transparent elsewhere) of the soft shadow a mesa throws on the floor
  beside its west and east walls.
- canyon-floor: the canyon floor itself: the same planet ground as everywhere else, but in deep shade (darker,
  a little cooler), with scattered scree, dust drifts and a few fallen boulders. It must tile seamlessly in every
  direction.
Optional biome versions, the same images retinted: -jungle (darker rock, moss and hanging vines on the walls,
a lush shaded floor), -polar (blue-grey rock with ice streaks, snow on the rims and drifts on the floor).
```

## 8. Viaduct

_tiles and a building_

```
VIADUCT: a level concrete-and-steel bridge straight across a dry valley or canyon between two clifftops, carrying
a road (or a railway) high over the ground below, where other traffic passes underneath.
- viaduct-abutment@0 and @1 (256x256, straight down, lit from the top-left): the end of a Viaduct: a heavy
  concrete abutment block keyed into the clifftop, the deck starting out of it toward the RIGHT edge (the game
  turns it to face the span), squat bollards where the railings end, and a small team-colour lamp (cyan
  #38d4ff; then red #ff5a6e).
- viaduct-deck-ew, viaduct-deck-ns (256x256, transparent): one tile of the deck: a pale concrete road deck 56% of
  the tile wide, railings with posts on both edges, and on the east-west piece the deck's slab edge and a steel
  girder showing along its south side. A rail version of each (-rail) with ballast instead of the road surface.
- viaduct-pier (256x512, transparent): one tall tapered concrete pier from the deck's underside at the top down to
  a footing on the ground at the bottom, lit on its left, with formwork lines across it. The game stretches it to
  the height of the drop.
```

## 9. Ropeway and Road Train

_The Ropeway pieces use the BUILDING camera from the master brief, the Road Train the VEHICLE camera; attach `truck@0-f0` and `truck@1-f0` for the Road Train._

### `ropeway@0.png`, `ropeway@1.png`

```
A ropeway station: a slim steel lattice pylon tower on a small concrete footing pad, rising to about 80% of the image
height, with a large grooved bull wheel mounted at the very top for the haul cable, a small machine house with the drive
motor and a team-coloured status light at the foot of the tower, and a short loading platform with railings and
yellow-and-black hazard stripes. The bull wheel's centre must sit on the image's horizontal centre line, about 10% from
the top edge: the game attaches the cable there. Slimmer than the production buildings (about 1.1 tiles wide at its
pad). Team light cyan #38d4ff; then "Same image, but change every cyan accent to red #ff5a6e".
Same camera angle, lighting, materials and scale as the Smelter.
```

### `gondola@0.png`, `gondola@1.png`

```
A small cargo gondola for the same ropeway, seen at the same three-quarter angle and lighting as the buildings: a grip
clamp at the very top centre of the image (about 8% from the top edge, where the cable passes), a short steel hanger
arm down from it, and below that an open-topped steel cargo cabin with a team-colour stripe (cyan #38d4ff; then the
same in red #ff5a6e) and a small crate rack. 256x256 transparent PNG, the cabin about 45% of the width, no shadow
and no ground (it hangs in the air).
```

### Road Train

```
A Road Train for the same game, matching the attached Freight Truck exactly in camera, lighting, scale and style:
a realistic 3D model with an orthographic camera looking straight down, facing RIGHT, centred on a 256x256
transparent canvas, no drop shadow and no ground.

1. The tractor unit (roadtrain@0-f0 to f3, then the same with every cyan accent changed to red #ff5a6e for @1):
a heavy cab-over-engine prime mover, a little longer than the Freight Truck, with three axles, twin exhaust stacks
behind the cab, a fifth-wheel coupling plate at the back (no bed), and team-colour cyan #38d4ff stripes and roof
lights. 4 driving frames: roll every tyre forward a quarter of the gap between tread blocks each frame so f0 to f3
loop; nothing else changes.

2. The trailer (roadtrain-trailer@0, then @1 in red): a long flatbed trailer with low side rails, two axles at the
rear and a kingpin hitch at the RIGHT end, with a team-colour stripe along each side. Keep the bed empty (the game
draws the crates on it) and tell me the pixel rectangle of the bed inside the rails. The trailer about 60% of the
canvas width, centred.

3. Optional: roadtrain-brake.png, an overlay with the tractor's framing but no tractor in it: two small red brake
lights lit at its back (the left end) with a faint red glow just behind.
```

## 10. Research Lab, creature nests, creatures, empty Silos and the trader ship

_Buildings and nests use the BUILDING camera, the creatures the VEHICLE camera. For the empty Silos attach `silo@0.png`, `silo@1.png`, `nuclear-silo@0.png` and `nuclear-silo@1.png`._

### `lab.png`

```
A Research Lab: a compact high-tech science station on the usual concrete and steel pad. A white-and-graphite
observatory-style dome with a horizontal glowing band of windows, a small satellite dish and an antenna mast on
the roof, a bank of server racks with blinking lights on one side and a sample bay with glass canisters on the
other. Cleaner and more precise than the industrial buildings, but still a little dusty. Accent colour: violet
#b98cff glow in the window band and canisters. Size class: about 1.35 tiles, like the production buildings.
Same camera angle, lighting, materials and scale as the Smelter.
```

### `nest-1.png`, `nest-2.png`, `nest-3.png`

```
A creature nest on the alien planet, in three growth stages, as three separate images with identical framing.
It is organic, not built: a low mound of hardened dark purple-brown resin and fused rock, ribbed and knobbly
like a termite mound crossed with a beetle shell, with three or four dark burrow holes, and a sticky purple
creep spreading over the sand around its base. Clusters of pale glowing green eggs sit in hollows on the mound.
No foundation pad: the mound's base sits on the bottom edge (about 4% margin) and spans about 75% of the width,
like the buildings' pads. Same camera angle and lighting as the Smelter.
Stage 1: small and low, a few eggs. Stage 2: bigger, with bony spikes starting to grow and more eggs.
Stage 3: large and menacing, tall jagged spikes, many glowing eggs, a faint green glow from the burrows.
Make it read as hostile and alive at 50 pixels wide: a strong dark silhouette with the green eggs as the accent.
```

### Creatures

```
Creature sprites for the same game. Two alien creatures that raid the robot colony. Render each as a realistic
3D model with an orthographic camera looking straight down and a soft sun from the top-left, like the robots in
my game: seen from directly above, facing RIGHT (head at the right), centred on a 256x256 transparent canvas.
No drop shadow and no ground: the game draws the shadow. The game turns each sprite round its centre to face
where it walks, so keep the body centred.

For each creature make 4 walking frames (f0 to f3): the legs step forward a quarter of a stride each frame so
f0, f1, f2, f3 loop smoothly back to f0. Nothing else may change between frames.

Scuttler (scuttler-f0 to f3): small and quick, about the size of a large dog next to the robots. A low beetle-
like body with a glossy dark purple carapace (#55306a, lighter ridges), six thin jointed legs splayed out to the
sides, short mandibles at the front and two small glowing magenta-pink eyes (#ff5fd2). The body fills about 45% of
the canvas width with the legs reaching to about 65%.

Brute (brute-f0 to f3): big, slow and armoured, about twice the Scuttler's size. A heavy six-legged creature with
thick overlapping brown-bronze armour plates (#6b4430), pale bony spikes along its back and sides, big crushing
mandibles and two glowing amber eyes (#ffb347). The body fills about 70% of the canvas width.

Both should be clearly creatures, not robots, and read at 20-30 pixels wide: bold silhouettes, the glowing eyes
as the accent.
```

### Empty Silos

```
Attached are four building images from my game: a Missile Silo and a Nuclear Silo, each in two team versions.
Make a copy of each that is exactly the same image, pixel for pixel, except that the missile is gone: the launch
pit is empty and dark inside, and its glowing ring and rim continue all the way round where the missile used to
hide them. Keep the canvas, framing, lighting and everything else identical, so the two images can be swapped in
place. Name them silo-empty@0, silo-empty@1, nuclear-silo-empty@0 and nuclear-silo-empty@1.
```

### `trader-ship.png`

```
A small boxy cargo spaceship hovering in the air, seen from above at the same three-quarter angle and lighting
as the buildings: a battered white-and-orange hull, two stubby thruster pods glowing pale blue underneath, a
cargo hatch with a winch on its belly and blinking landing lights. 256x256 transparent PNG, the ship filling
about 75% of the width, no shadow and no ground (it floats; the game draws its shadow).
```

## Asset checklist

| Key | Size | What |
|---|---|---|
| `crawler@0-f0` … `f7`, `crawler@1-f0` … `f7` | 512×512 | Crawler driving frames (8, treads rolling), facing right, no shadow |
| `crawler-dish` | 512×512 | Sensor dish layer the game spins (team-neutral) |
| `crawler-lights`, `crawler-dust` | 512×512 | Headlight and beacon glow; dust plume behind the treads |
| `crawler-deploy@0-d0` … `d9`, `@1-…` | 512×512 | Deploy sequence (played backwards to pack up) |
| `crawlerbase@0`, `crawlerbase@1` | 512×512 | The deployed Crawler (vehicle camera, facing right) |
| `freight-loco@0-f0` … `f3`, `@1-…` | 256×256 | Locomotive driving frames, facing right, no shadow |
| `freight-loco-lights`, `-brake`, `-exhaust` | 256×256 | Locomotive overlays |
| `freight-wagon-flat@0/@1`, `freight-wagon-hopper@0/@1` | 256×256 | Wagons, facing right, no shadow, empty |
| `station@0`, `station@1` | 512×512 | Rail Station (building camera) |
| `rail-straight`, `rail-curve`, `rail-tee`, `rail-cross`, `rail-end` | 256×256 | Track tiles, transparent outside the ballast |
| `rail-level-crossing`, `rail-barrier-up`, `rail-barrier-down`, `rail-lights-on` | 256×256 | Level crossing and its barrier overlays |
| `bridge-…`, `railbridge-…` (`-ew`, `-ns`, `-end-w/e/n/s`, `-ramp-w/e/n/s`) | 256×256 | The bridge kit in two styles |
| `bridge-pier`, `railbridge-pier` | 256×512 | Piers below a deck tile |
| `cliff-tall`, `cliff-tall-2`, `canyon-floor` | 256×256, opaque | Sky islands: tall cliff walls and the canyon floor |
| `cliff-foot-w`, `cliff-foot-e` | 256×256 | Shadow at the foot of a mesa's side walls |
| `…-jungle`, `…-polar` | same | Optional biome versions of the cliff tiles |
| `viaduct-abutment@0/@1` | 256×256 | Viaduct end (faces right; the game turns it) |
| `viaduct-deck-ew`, `viaduct-deck-ns` (+ `-rail`) | 256×256 | One tile of Viaduct deck |
| `viaduct-pier` | 256×512 | A tall concrete pier, stretched to the drop |
| `ropeway@0`, `ropeway@1` | 512×512, transparent | Ropeway station (team versions) |
| `gondola@0`, `gondola@1` | 256×256, transparent | A gondola hanging from the cable (team versions) |
| `roadtrain@0-f0` … `f3`, `roadtrain@1-f0` … `f3` | 256×256, transparent | Road Train tractor unit, driving frames, facing right, no shadow |
| `roadtrain-trailer@0`, `roadtrain-trailer@1` | 256×256, transparent | Flatbed trailer, facing right, no shadow |
| `roadtrain-brake` | 256×256, transparent | Brake-light overlay for the tractor (optional) |
| `lab` | 512×512, transparent | Research Lab (one version: the game adds the team bar) |
| `nest-1`, `nest-2`, `nest-3` | 512×512, transparent | Creature Nest at levels 1, 2 and 3 |
| `scuttler-f0` … `scuttler-f3` | 256×256, transparent | Scuttler walking frames, facing right, no shadow |
| `brute-f0` … `brute-f3` | 256×256, transparent | Brute walking frames, facing right, no shadow |
| `silo-empty@0`, `silo-empty@1` | 512×512, transparent | Missile Silo with no missile in it (team versions) |
| `nukesilo-empty@0`, `nukesilo-empty@1` | 512×512, transparent | Nuclear Silo with no missile in it (team versions) |
| `trader-ship` | 256×256, transparent | Optional: the trader ship that hovers over a Command Base during a Planet event |
