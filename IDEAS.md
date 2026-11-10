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
