# Terrafall: Claude Design prompts for the Fuel update

The Fuel update added a vehicle, a building, pipelines and a new explosion. The game draws them all in code for now
(a Freight Truck with a steel tank on its bed, a small engine block, grey pipe lines). These prompts replace them.

Use the **same Claude Design chat and 3D renderer** as the Freight Truck and the 3D buildings, so camera, light and pad
match. Send the results back as zips with the exact file names given, and Claude Code wires them in.

---

## 1. The Tanker (a vehicle, like the Freight Truck)

```
Render a Tanker from the same scene, camera and scale as the Freight Truck (truck@0-f0.png): the same cab and
chassis, but carrying a long rounded steel fuel tank (silver-grey, with two strap bands, a ladder, a filler hatch on
top and a small orange hazard diamond on the back), instead of the flatbed. It faces right (nose to the right of the
image, as the truck does); the game rotates it.
- tanker@0-f0.png … tanker@0-f3.png: four driving frames (wheels turning), cyan #38d4ff team stripe along the tank.
- tanker@1-f0.png … tanker@1-f3.png: the same in red #ff5a6e.
- tanker-brake.png: overlay, the rear brake lights glowing (shown while it slows).
- tanker-boost.png: overlay, dust from the rear wheels and motor glow (shown while it speeds up).
384 x 384 transparent PNGs, the vehicle in the same place on the canvas as the truck, so the two line up.
```

## 2. The Generator (a building)

```
Render a Generator in the 3D building set (same camera, pad and light; 512 x 512 transparent PNG, anchor
[0.5, 0.615], scale 1.4, like the other buildings): a squat diesel generator on the pad, an engine block with
cooling fins, two short exhaust stacks, a big coil housing on one side with a glowing yellow core, thick cables
running out to the pad's edges, and a small fuel tank. Team colour on panels.
- generator@0.png (cyan #38d4ff) and generator@1.png (red #ff5a6e), by day.
- The same for morning, evening and night, as the other buildings (art/tod/<time>/buildings/generator@T.png).
- generator-work-0.png … generator-work-7.png: an 8-frame working loop on the same canvas: only the parts that
  change, the coil's glow pulsing and a heat shimmer over the stacks. Everything else transparent.
Also add the Generator to building-emitters.json if that's being made: black smoke from both stacks (size 0.7).
```

## 3. Pipe pieces (map tiles)

```
Pipeline pieces for a top-down map of 128 x 128 px tiles (the same scale as the road and rail tiles): a steel pipe
about 20 px thick (light grey with a highlight along the top and a dark outline), running along the middle of the
tile, with a bolted flange every tile. Transparent background, so the ground or road shows through.
- pipe-straight.png: running left to right, edge to edge.
- pipe-corner.png: entering from the left, turning down.
- pipe-tee.png: left, right and down.
- pipe-cross.png: all four sides.
- pipe-end.png: entering from the left, ending in a cap at the middle.
- pipe-raised.png: left to right, lifted on two small steel posts with a shadow under it (it crosses a road or
  railway track here).
- pipe-stub.png: from the left edge to the middle, ending in a coupling (where the pipe joins a building).
The game turns each piece to fit. Also a team band: pipe-band@0.png and pipe-band@1.png, a 24 px collar in cyan
#38d4ff and red #ff5a6e, centred, to go over joints.
```

## 4. The fuel blast (an effect sheet)

```
fx-fuel-blast.png: a sprite sheet, 8 frames of 256 x 256 (8 x 1), transparent background (not black): a fuel
explosion seen from above at a slight angle. A white-yellow flash, a rolling orange fireball with black smoke curling
off its edges, then a dark smoke cloud that rises and thins out, the last frame faded to nothing. Bigger and dirtier
than the building-explosion sheet; the game scales it to the blast's size (1 to 2.5 tiles across).
oil-scorch.png: a ground mark, 128 x 128, transparent: a black oily burn with a glossy sheen, ragged edges.
```

**Installed:** the Tanker, the Generator (with its working loop and smoke), the exhaust smoke, and (rendered with
the renderer in `renderer/`) the pipe pieces (`renderer/b/pipe.js`; no stub or team band: pipe joins buildings by
running under them) and the fuel blast (`renderer/fx/fuelblast.py`, 16 frames in a 4 x 4 grid). Still to make:
`oil-scorch`. New art can now be made with the Terrafall design system:
https://claude.ai/artifact/GAdLBz6kefeJeTRz57TTV7

**Order to make them in:** the Tanker first (it's on every map from the start), then the pipe pieces, the Generator,
and the fuel blast.
