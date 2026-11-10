# Ideas waiting their turn

Notes on features we've talked about but not built yet. (The nuclear race, desktop RTS controls, road maintenance
and biomes started here and are now in the game.)

## Held for later

- Multiplayer, and exporting/importing saves between devices.

## Open balance questions (from the November audit)

Measured, but left for a decision rather than changed:

- **Fuel is plentiful.** One Fuel charges 2½ batteries (`FUEL_ENERGY` 250), so colonies make about half again
  the Fuel they burn and a Refinery is rarely needed for Fuel (its Crude still makes Asphalt). At 150, AI colonies
  burned about what they made (42 made, 43 used by minute 15) with no more flat batteries.
- **Outposts are open doors.** Any player's bots walk through an Outpost (`passTile`), so one on a wall line or a
  Chokepoint pass is a hole in it. Option: only the owner passes; enemies break it like a Gate.
- **Viaduct bridgeheads can't be shut.** Anyone can cross a Viaduct, so a bridgehead is also the rival's way in.
  Option: abutments act like Gates.
- **A nuke all but wins.** It leaves the Command Base at 1 armor with its garrison dead, and nothing evacuates.
  Option: leave it a third of its armor, or have garrisons and bots flee the blast ring during the 30 s warning.
- **Walls stop wildlife completely** (Colony): Brutes can't break Walls or Gates.
- **Smelter recipe.** Tried 2 Ore + 1 Fiber → 2 Alloy to ease Fiber; on Standard maps Ore then ran short
  (Smelters waited for Ore 56–88% of the time) and games stalled, so the 1 + 1 recipe stays.
- **Road Train wear.** Per good moved it wears roads the least (`WEAR_TRAIN` 8 for 30 goods).
