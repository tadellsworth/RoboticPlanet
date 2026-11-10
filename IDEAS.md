# Ideas waiting their turn

Notes on features we've talked about but not built yet. (The nuclear race, desktop RTS controls, road maintenance
and biomes started here and are now in the game.)

## Held for later

- Multiplayer, and exporting/importing saves between devices.
- **Fuel, after the Tanker update.** Built: Tankers, explosions with chain reactions, Crude pipelines, the Generator
  and trucks burning Fuel (see the README). Still open: Fuel pipelines (only Crude flows today), a Generator that
  explodes too, and the AI using oil more (it mostly lives on Bio Farms: about one colony in four builds a Refinery).
- **Ships and ports (for a new water-heavy map).** A map shape that is mostly sea, where shipping is the way to
  move things between islands:
  - **Port:** a new building on the shore, where ships load and unload. It works as storage, like a Rail Station,
    so goods come and go by road.
  - **Container ships:** bulk goods between ports, like Freight Trains at sea.
  - **Ferries:** carry robots and trucks (Freight Trucks, Road Trains, Tankers) across to another port.
  - **Tanker ships:** Crude and Fuel between ports (liquids still only travel by tanker).
  - **Expensive bridges:** on this map, long bridges cost so much that ships are the better choice. Short hops
    stay bridgeable. For example, the cost per tile could rise steeply past a few tiles of open water.
  - **To think through:** how ships move (open water only, their own routes, docking time); whether raiders or
    turrets can sink them, and whether a tanker ship explodes like a Tanker; what each ship and the Port cost; how
    the AI plans ports and shipping; and how ferries pick who boards.

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
