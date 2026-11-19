# Terrafall Game Balance Audit: Combat & Economics

This audit synthesizes the deterministic simulation rules, unit properties, and logistical constraints defined in the game's codebase to identify structural imbalances. Achieving a StarCraft-caliber competitive environment requires smoothing binary counters, ensuring distinct roles for each logistics tier, and decoupling critical resource bottlenecks.

## I. Combat Systems & Unit Synergy

The combat loop currently suffers from a "siege vacuum" and highly volatile hit-point thresholds that make engagements all-or-nothing.

### The Siege Vacuum & Torch Over-Performance
With the Howitzer (`BOTS.rocket`) currently disabled via `BOTS_OFF`, the game lacks a dedicated long-range siege option until late-game Missiles come online. This forces players to rely heavily on the Torch for base-breaking, which vastly out-scales standard infantry.
* **Warbot Inefficiency:** Warbots deal `1` damage to walls per shot and carry `10` ammo. A Warbot must expend its entire payload to deal `10` damage, requiring four full trips (or four bots) just to break a single `40 HP` Wall.
* **Torch Dominance:** A Torch ticks every `0.2s`, dealing `0.8` building damage multiplied by `1.6` against forts/walls. This yields `6.4` sustained DPS to fortifications. In the `12s` its fuel tank lasts, a single Torch inflicts `76.8` damage—nearly double the HP of a Wall, at a cost of only `2 Alloy, 2 Chips`.
* **Recommendation:** Re-enable the Howitzer to restore a `13`-range siege dynamic that forces defenders to sally out. Simultaneously, reduce the Torch's fort multiplier from `1.6` to `1.2`, repositioning it as an anti-swarm/anti-infantry unit rather than a premier wall-breaker.

### Binary Shield Interactions
The Bulwark provides `50` frontal shield HP with a regeneration rate of `4/s` after `2.5s` of not being hit.
* Against a standard Pulse Turret (`3.07 DPS`), a single Bulwark can absorb damage almost indefinitely, allowing a small deathball to walk through static defenses entirely unpunished.
* Conversely, the Disruptor Tower drains `14` shield per pulse (`2.5s` cooldown) and jams guns for `2s`. This completely shuts down the Bulwark in seconds.
* **Recommendation:** Lower Bulwark shield regeneration to `2.5/s` to prevent indefinite stalling against basic static defenses, while reducing the Disruptor's shield drain to `8–10` per pulse so Bulwark pushes aren't instantly invalidated by a single tower.

### Air vs. Anti-Air Volatility
The Vulcan Bomber deals exactly `14` direct damage to buildings. By coincidence, the primary counters—Flak Guns and Missile Silos—both have exactly `14 HP`. 
* **Recommendation:** Increase Flak Gun and Missile Silo armor to `16` or `18`. A single bomber should severely cripple its dedicated counter, but it should not be able to one-shot the very building designed to stop it before the Flak Gun can fire its shells.

## II. Economic & Logistics Engineering

The Terrafall economy is highly interconnected, but certain resource dependencies and logistical upgrades overwrite one another rather than providing situational trade-offs.

### The Crystal Death Spiral
In Terrafall, Fiber and Stone can be gathered infinitely, but Ore and Crystal are finite nodes. 
* Crystal is a hard bottleneck for three critical systems: **Unit Production** (Chips require Crystal), **Upgrades** (Research Labs burn Crystal per tech), and **Basic Defense** (Pulse Turrets use Crystal for ammo).
* If a player is contained and their local Crystal clusters run dry before the next `Ringfall` event (`5-8` minute gap), they lose the ability to build units *and* the ability to fire their basic turrets. 
* **Recommendation:** Change Pulse Turret ammo from `crystal` to `ammo` (Alloy + Cement), or reduce the Chip cost formula. Alternatively, introduce a slow, infinite fallback for Crystal to prevent total defensive collapse.

### Logistics Tiering 
* **The Rail Dominance:** Freight Trains completely outclass Road Trains. They carry nearly twice the cargo (`56` vs `30`), travel `2.5x` faster, require no fuel, and cause zero wear to their tracks. Road Trains, meanwhile, strip Asphalt back to plain dirt in just `125` passes.
* **Recommendation:** Increase the cost of rail track to at least `0.5 Alloy` per tile to make rail a heavy mid-game investment. Add a slight energy upkeep to rail stations so they aren't entirely isolated from the fuel grid.

### Chain Reactions in the Energy Grid
Fuel Tanks store up to `120` Crude/Fuel and act as pipeline hubs to adjacent Refineries (`10 HP`) and Tankers (`8 HP`). 
* If a full Fuel Tank is destroyed, it instantly destroys all adjacent Refineries and Tankers, which then trigger their own secondary explosions, vaporizing the entire grid.
* **Recommendation:** Increase Refinery armor from `10` to `15` to survive a primary fuel tank explosion, forcing the attacker to commit more resources to achieve a cascading wipeout.

## III. Map Scaling & Doctrine Multipliers

* **The Fixed Population Bottleneck:** The global unit cap is locked at `90`. Because `Huge` maps are `4x` larger than `Small` maps, the logistical footprint required to move goods scales up drastically. On large maps, the limit leaves almost no supply for an army. Dynamic scaling of the unit cap based on map size would preserve combat depth.
* **Compounding Economic Doctrines:** The `Architect (tycoon)` doctrine grants a blanket `1.15x` multiplier to gathering, production, and construction. If a game goes past the 10-minute mark, the Architect mathematically overshadows all other doctrines because their superior economy scales exponentially into defenses and missiles. Tuning Architect down to `1.08x` or limiting the bonus to specific sectors will flatten the late-game disparity.