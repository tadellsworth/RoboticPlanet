# Ideas waiting their turn

Notes on features we've talked about but not built yet. (The nuclear race, desktop RTS controls, road maintenance
and biomes started here and are now in the game.)

## Held for later

- **More map shapes** (Rift, Ring valley, Oases, Crossroads and Lakes are now in the game; each would be a
  `SHAPE_PRESETS` entry with its own step in `shapeExtras`, mirrored for fairness like the others):
  - **Terraces:** the land climbs in steps toward a summit in the middle, a ramp or two per step, the richest fields
    (and a Nuclear race's Uranium) on top. Whoever holds the high ground sees and shoots down onto the rest.
  - **Twin rivers:** two rivers run the length of the map, splitting it into three lanes joined by shallow fords
    that bots wade slowly (and that a Planet event can flood). Bridges are worth their price here.
- **You against up to three rivals, on Crossroads.** Crossroads was built for it: four quarters, one base in each,
  meeting at the plaza. Needs a four-way symmetric layout (the map turned a quarter round instead of a half), a
  fourth team colour, and the AI picking among three rivals (it already does among two in a free-for-all). The same
  layout would suit multiplayer later.
- Multiplayer, and exporting/importing saves between devices.
- **Fuel, after the Tanker update.** Built: Tankers, explosions with chain reactions, Crude pipelines, the Generator
  and trucks burning Fuel (see the README). Still open: Fuel pipelines (only Crude flows today), a Generator that
  explodes too, and the AI using oil more (it mostly lives on Bio Farms: about one colony in four builds a Refinery).
- **Ships, after the first version** (Ports, Container Ships, Tanker Ships, Ferries and beach landings are in the game):
  a gunboat or patrol boat to escort ships and shell the shore; the rival using Container Ships and ferry lines
  (today it only builds a Port and makes beach landings).
- **Air (after ships).** An **Airfield**, a **strike bomber** for precision strikes (a smaller, faster, cheaper hit
  than a Missile, on a building you pick, or on a moving target such as a Tanker on the road, which then explodes),
  and an **anti-aircraft gun** to shoot it down. Aircraft burn Fuel like ships and trucks (refuelling at the Airfield). To think through: what
  the bomber costs and carries, how far it flies and how long it takes to rearm, how the AA gun trades with turrets
  and walls, and how the AI uses both.
  More aircraft worth weighing once the first three work: a **fighter** (shoots down bombers and escorts its own,
  so the air war isn't only AA guns), a **transport helicopter** (drops a few warbots anywhere, like a beach landing
  but over walls and cliffs, slower and fragile), a **cargo plane** (fast, small loads between Airfields, dear in
  Fuel, for a cut-off island or an Outpost under siege), a **gunship / attack drone** (circles a spot and
  shoots warbots there for a while; close support rather than one strike), and a **radar station** (warns of
  incoming aircraft and lets AA guns fire further). A recon plane only matters if the map ever gets fog of war.
- **Graphics polish (after air).** Go over every building, robot, terrain tile, effect and icon against the design
  system and bring anything rough or out of style up to the same finish.

## AI stalemates (seen while checking Road Trains, November)

About a quarter of fresh-seed AI-vs-AI games still run the full hour without a winner (6 of 8 decisive, the same before
and after the Road Train change). In the ones looked at, late in the game both rivals' Smelters sit "Waiting for Ore"
while 75–100 Ore lies in storage, so Alloy, then Ammo, run short and armies stall with warbots out of Ammo. Worth a
look: why Ore in storage doesn't reach the Smelters (distance, haulers, trucks, or the AI's placement).

## Open balance questions (from the November audit)

Measured, but left for a decision rather than changed:

- **Fuel is still plentiful.** One Fuel charges 2½ batteries (`FUEL_ENERGY` 250). With trucks burning Fuel and
  Generators, AI colonies use a bit over half what they make (58% across 25 colonies, against 59% before, when Fuel
  had fewer uses: Bio Farms now get their Agribot first, so more is made). If Fuel should be scarcer, the levers are
  `FUEL_ENERGY`, `TRUCK_BURN` and the Generator's `perFuel`.
- **Viaduct bridgeheads can't be shut.** Anyone can cross a Viaduct, so a bridgehead is also the rival's way in.
  Option: abutments act like Gates.
- **A nuke still leaves the Command Base at 1 armor.** Robots can now evacuate the blast ring (and the AI does), so
  the garrison survives to come back and defend it; leaving the Base a third of its armor is still an option.
- **Walls stop wildlife completely** (Colony): Brutes can't break Walls or Gates.
- **Smelter recipe.** Tried 2 Ore + 1 Fiber → 2 Alloy to ease Fiber; on Standard maps Ore then ran short
  (Smelters waited for Ore 56–88% of the time) and games stalled, so the 1 + 1 recipe stays.
- **Road Train wear.** Per good moved it wears roads the least (`WEAR_TRAIN` 8 for 30 goods).
- **Sky islands AI-vs-AI can stall.** With forts harder to crack (missile floor, sorties, captured garrisons that
  survive), wars between two AIs last longer. On Sky islands, about 3 seeds in 8 then ran past 50 minutes: the
  Viaducts joining the two sides get shot down, both sides run short of Cement (Stone runs out on the mesas),
  and every new crossing is destroyed as soon as it's up. (The old rules ended those wars first, at 23–49 min.)
  It doesn't affect a game against you, but the AI could be smarter about guarding or replacing its crossings.
  Closed Outposts (enemies must break in) make long AI wars a little more likely: in a 13-game batch, 3 ran to the
  time cap. In each, both AIs keep one warbot in every one of their 15–20 forts and never have enough spare to march;
  the AI could pull more from forts far from the front.
