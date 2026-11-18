# Terrafall: megastructure design sheets (a package for Gemini)

## How to use this (for the owner)

1. Open a new Gemini chat. Paste **PART 1** (the context pack) first, then type: *"Read this carefully. Reply only with: ready."*
2. Paste the **batch prompts** from PART 2 one at a time (Batch 0, then A, B, C). Wait for each batch to finish before sending the next.
3. Bring the sheets back to Claude: paste them into the chat, or save them as `.md` files and tell Claude where they are. Claude reviews each one against what the engine can do (cheap: it reads a design, it does not build it) and flags conflicts. Nothing is built until you approve it.

Gemini has no access to the game's code. Everything it needs is in PART 1. If it asks for numbers that are not here, tell it to propose them and mark them "tuning guess".

---

# PART 1: CONTEXT PACK (paste this first)

You are helping design late-game "megastructures" for **Terrafall**, a real-time strategy game that runs in a web browser. You are producing **design sheets only**: documents, no code. A programmer will later check each sheet against the game engine and build the ones the owner approves.

## 1. The game in brief

- A strategy game on a fictional planet, **Ithaca I**, in the year 2165. Players command a **Command Base**, a robot colony dropped from orbit. A match is called a *terrafall* (a landfall from Terra).
- You build an economy (gather resources, haul them by road, make goods), build defences, and build an army of **warbots**. Computer-run rival colonies (2 to 4 colonies in a match) do the same. A match lasts about 15 to 45 minutes; on large maps it can go longer.
- **Modes:** Colony (economy and survival), Versus (computer rivals, victory by capturing Command Bases, or holding Uplinks, or Domination of land), Observer (watch computer colonies fight), Missions (a tutorial campaign), and **multiplayer** (several people, in sync: see constraints).
- **Victory:** *Capture* (take every other Command Base: capturing a base hands you everything it built), *Domination* (hold most of the land for long enough), *Uplinks* (hold two of three neutral relay towers for a set time).
- Units are robots only. Workers build and gather; Haulers carry goods on roads; Freight Trucks, Road Trains and Freight Trains carry more; ships and aircraft exist. **Every building needs a road to storage** or Haulers cannot bring it materials.
- A building under construction is a *site*: goods are delivered to it and it builds only as far as the goods that have arrived.

## 2. Lore and tone (follow this; it is the game's heart)

**The pitch:** Earth's great powers were tearing their world apart, so each sent robot vanguards to other star systems to find and prepare a new home. Four vanguards landed on Ithaca I. It is 2165. The colony ships were due 31 years ago and never came: the powers destroyed each other, and Earth with them. The robots suspect, but their orders have no end date. They keep working, and they carry their makers' war on, forever, over a home no one will ever live in. "Terrafall" also means: Terra fell.

**Tone rules:**
- Quiet sadness under a loud war. The robots never mourn or explain themselves; **the world does the storytelling.**
- Machines, not people: robots speak in logs, status lines and protocol. Feeling shows in what they do, never in what they say.
- Objects over speeches: show the silence with things (an Arrival clock counting up, lit welcome signs, empty passenger shelters, cargo lists for children's shoes).
- Dry, not jokey. No winks at the player.
- Imply Earth's fate, never state it. The war is real; "Build. Expand. Annihilate." stays a confident tagline.
- **Night carries the mood**: empty roads lit for traffic that never comes. Every Command Base shines a pale beam into the sky each night, for ships that never come.
- Vocabulary: Arrival, the Sponsor, the Accord, vanguard, Command, colonists, the Silence. **Avoid:** humans on screen, named people, aliens as villains, the word "evil".

**The planet:** Ithaca I is a coral-red world with a bright ring (what is left of a broken moon). **Ringfall** is the ring's pieces falling as meteor showers; they restock the surface with Ore and Crystal. **Ring Crystal** is slightly weightless: rock rich in it floats, which is where the sky islands come from. The star **Corvane** flares often, and flares drain batteries. **Argos** is the surviving moon: a silent, airless field of craters where no native life lives. The **Pathfinder** (the last joint mission of the great powers) built the neutral **Trade Posts** (no-fire zones where a Trade Terminal runs a trade route) and the **Uplinks** (relay towers that talked to home; whoever holds them "speaks for Ithaca I"), and sowed Earth animals and plants from its seed vaults. Neutral AI: the trader ship *Wren*, an Accord supply ship with 31-year-old cargo lists.

**The four colonies:** COBALT (blue), VERMILION (red), VIRIDIAN (green), TYRIAN (purple). Their command AIs follow doctrines: the Steward (balanced), the Warden (turtle: walls and turrets), the Salvager (raider), the Herald (rusher), the Architect (tycoon: builds a big economy, and a city for no one).

**The native life, the Murmur:** always plural, never seen alone, glimpsed not seen. They feed on **charge** (Crystal, batteries, power lines). Their nests sit out in the wilds; by night their tunnels spread toward power and packs come up through exits to raid every colony alike; at dawn they go back down. Forms: the Scuttler (small, fast), Brute (armoured), Leech (drains charge from vehicles and buildings), Spitter (shorts buildings out), Sapper (digs). The war feeds them: they drain power from wrecks. They are nobody's side. There are none on Argos, and none on two map types (Sky islands, Four Isles). Their tunnels grow under old battlefields. **Whether they are only animals is never answered.**

**Biomes:** the Rust (red desert), Greenreach (forest), Emberwood (autumn forest), the Long Grass (savanna), Blackwater (swamp), Hoarfell (polar snow), the Cinderlands (volcanic ash), the Bloom (violet alien growth), Argos (the moon). **The Hollow:** the Murmur's cavern lair under the Bloom, always night, with no aircraft, no missiles, no Trade Posts. Map types include open ground, plateaus and mesas, canyons, islands (ships and Ferries), sky islands (floating mesas: bridges, Viaducts, Ropeways, aircraft).

**Time:** the day-night cycle is 12 minutes: morning 1.5, day 4, evening 1.5, night 3 (about 3.5 with the fades).

## 3. The economy (use these numbers as the scale)

**Goods:** Fiber, Stone, Ore, Crystal, Crude (raw); Cement, Alloy, Chips, Fuel, Asphalt, Ammo, Missile (made); Uranium, Enriched Uranium (a "Nuclear race" setting only).
**Rough recipes:** Cement = Stone baked at a Cement Works; Alloy = Ore + Fiber at a Smelter; Chips = Crystal + Alloy at a Chip Fab; Fuel from a Refinery (Crude) or a Bio Farm; Ammo at an Ammo Plant; a Missile = 2 Alloy + 1 Chip + 1 Fuel (20 s at a Missile Factory); Enriched Uranium = 2 Uranium at a Nuclear Reactor.
**A Command Base starts with:** 16 Fiber, 8 Stone, 8 Alloy, 4 Chips, 4 Crystal, 10 Fuel, 24 Cement, and 10 Workers, 5 Haulers, 4 warbots.

**Existing building costs and toughness (armor = hit points; a warbot's shot does about 2 to a building):**

| Building | Cost | Armor | Build time | Notes |
| --- | --- | --- | --- | --- |
| Outpost | 4 Cement, 2 Fiber | 16 | 12 s | claims land radius 7 |
| Generator | 3 Cement, 2 Alloy | 8 | 10 s | burns 1 Fuel per 40 s; buildings within 4 tiles work a third faster |
| Smelter / Chip Fab | 3 Cement 2 Fiber / 2 Cement 2 Alloy | 8 | 10 s | |
| Bot Foundry | 4 Cement, 3 Alloy, 1 Chip | 10 | 14 s | makes robots |
| Research Lab | 6 Cement, 4 Alloy, 2 Chips | 10 | 14 s | colony-wide upgrades |
| Nuclear Reactor | 6 Cement, 6 Alloy, 3 Chips | 14 | 20 s | Nuclear race only |
| Nuclear Silo | 8 Cement, 6 Alloy, 4 Chips | 18 | 24 s | the **nuclear missile** costs 6 Enriched Uranium + 4 Alloy + 2 Chips, 60 s to assemble, range 40 tiles, 30 s flight, blast radius 6, scorches the ground for 240 s |
| Missile Silo | 5 Cement, 4 Alloy, 2 Chips | 14 | 16 s | holds 2 Missiles, range 22, reloads in 60 s, 24 damage plus splash |
| Keep | 14 Cement, 6 Alloy, 2 Chips | 60 | 24 s | fortified base, room for 25 warbots, cannon range 6 |
| Bunker | 6 Cement, 2 Alloy | 32 | 14 s | |
| Pulse Turret | 3 Cement, 3 Alloy | 12 | 10 s | range 5, uses Crystal |
| Mortar Pit | 5 Cement, 3 Alloy | 14 | 12 s | range 10 |
| Flak Gun | 4 Cement, 3 Alloy | 14 | 10 s | range 7, shoots aircraft |
| Airfield | 10 Cement, 4 Alloy | 16 | 16 s | Cargo Plane, Vulcan Bombers, Airships |
| Command Base | (given) | 30 | | territory radius 8 |

**Scale for megastructures:** the most expensive single item today is the nuclear missile. A megastructure should be a *project*: roughly **10 to 30 times a Keep in goods**, built in several visible stages over several minutes, reachable in a long game by a strong economy (not before about minute 15 to 20), and a big, visible, raidable investment. Give armor in the **100 to 400** range.

**Existing weapons and effects** you can build on or counter: Pulse Turrets, Minigun Nests, Mortar Pits, Disruptor Towers, Flak Guns, Missiles (Command Bases and Keeps are held at a damage floor by missiles and bombs: they must be captured by warbots), nuclear missiles, Vulcan Bombers (bombs 14 damage; napalm burns fertile soil for good), Bulwarks (shield robots), Torches (flame; "scorch the earth"). **Planetary events:** dust storm (bots at two-thirds speed, missiles grounded), Ringfall (6 meteor strikes per colony crater roads and dent buildings, leaving rich Ore or Crystal), solar flare (batteries drain twice as fast), the *Wren*. **Trade Posts** are no-fire zones (nothing there can be attacked).

## 4. Hard constraints on any design

1. **Multiplayer is in lockstep.** Every device runs the same simulation from the same inputs. So: **no hidden randomness**; outcomes follow from game state and a seeded generator. Say how any "random" element is seeded. Anything that only *looks* different (visual and sound) may differ per device.
2. **Computer rivals must use it.** Every sheet must say when the computer would build it, when it would use it, how it would respond when it is threatened, and what it should never do (so it does not waste its economy).
3. **Phone and desktop:** controls must work with one tap on a touch screen; text at least 12 px; a panel with a few big buttons, not hotkeys only.
4. **Prefer existing goods and mechanics.** A new resource needs a strong reason. Say for every sheet which existing mechanics it reuses and which new systems it needs.
5. **Fair and counterable.** Every megastructure needs at least two real counters and a weakness, and must not be able to win a game alone with no counterplay. Nothing may end a game instantly.
6. **Works or is excluded on special maps:** say how it behaves in the Hollow (no aircraft or missiles), on Argos (no air, no Murmur), on islands and sky islands (little land), and on small maps.
7. **No humans on screen, no named people, no aliens as villains.** Lore text is machine logs.

---

# PART 2: THE BATCH PROMPTS (paste one at a time, after the context pack)

## The sheet format (include this in every batch)

For each megastructure, write one Markdown section with exactly these headings, in this order. Use exact numbers (not ranges) unless you mark them *tuning guess*.

1. **Name and one-line pitch**
2. **Role:** weapon, economy, defence, victory, or story; and which kind of player it suits
3. **Lore hook:** two or three sentences in the game's quiet, machine voice
4. **Prerequisites and unlock:** what a colony needs first (a building, goods, a research, a power grid)
5. **Cost and construction:** total goods; the build stages (3 to 5 visible stages, each with its goods and time); footprint in tiles; placement rules (terrain, distance from the Command Base, near water or rock, and so on); how many per colony
6. **How it works:** the exact rules, with numbers (range, damage, cooldowns, charge time, effect radius, power or Fuel drawn, duration). Step by step.
7. **Controls:** what the player taps; the buttons in its panel; what is shown while it works (progress, charge, cooldown)
8. **What everyone sees:** day and night visuals, the build stages, activity effects, sound ideas, and a warning to rivals before anything dangerous happens
9. **Counterplay and weaknesses:** at least two real counters, and what a rival can do to stop it
10. **The Murmur:** how the native life react to it
11. **Events, biomes and maps:** its behaviour under dust storms, Ringfall and solar flares; in each biome where it differs; in the Hollow, on Argos, on islands and on small maps
12. **The computer's use of it:** when it builds, how it uses it, how it responds when threatened, what it must never do
13. **Engine impact:** (a) existing mechanics it reuses, by name; (b) new systems it needs; (c) a rough size: small, medium or large
14. **Balance:** three tuning knobs with a suggested range each, and the main way it could break a game
15. **Open questions for the owner:** three, the most useful ones

Keep each sheet to about 700 to 900 words, and use tables for numbers. Do not write code. After the last sheet of a batch, add a **short comparison table** of that batch's sheets (cost, power, role, build effort).

## Batch 0: the power grid (the dependency)

> Several megastructures need serious electrical power. Design the **power grid** they run on, using the sheet format above for two items: **(1) the Nuclear Power Plant** (burns Enriched Uranium, far more power than a Generator, so Uranium has a use beyond the bomb), and **(2) Power Lines** (pylons laid like roads, carrying power across a colony).
>
> Rules to respect: a colony's megastructures run on the grid and stop when it is cut; ordinary factories on it work faster (**brownouts**, never total shutdowns); the Murmur's Leeches drain power lines at night (lights going dark pylon by pylon); a plant that takes heavy damage melts down (a small fallout zone where nothing works for a while); a rival can cut a line to stop a charging megastructure. State how much power each megastructure draws (invent a "power unit" and use it consistently in every later batch), how the grid overlay is shown, what the rival does in a blackout, and how a game without a Nuclear race (no Uranium) gets power (Fuel or Crystal plants). End with a short table of the draw each of the nine megastructures below should have.

## Batch A: the three likely first builds

> Write sheets for **(1) the Great Uplink**, **(2) the Ring Breaker**, **(3) Arrival City**. Their briefs:
>
> **Great Uplink.** A giant dish array to talk to home, and a new way to win: power it and hold it through a long transmission window to "make contact", while rivals try to wreck or jam it. Ties into the campaign's last mission ("No further instructions"). In free play it is a last-stage victory, with a lore twist on what answers (never confirm human survivors; a faint, wrong signal is fine).
>
> **Ring Breaker** (weapon). A tether-and-thruster station that pulls fragments out of the Ring and drops them where you choose: Ringfall on demand. Every few minutes a strike craters the area and leaves rich Ore or Crystal behind, so it is a weapon and a mine at once. Slow to aim, so the target gets warning. Lore: the colony doing to Ithaca what the Sponsors did to Earth.
>
> **Arrival City.** An arcology built for the colonists: homes, parks, a school, all lit and empty. Production round it goes up (the robots work harder for Arrival), and its land counts double for Domination. At night, a whole lit city for no one. The most emotional of the set: the design should make the player feel it.

## Batch B: the weapons

> Write sheets for **(1) the Lance of Corvane**, **(2) the Sunlance**, **(3) the Seismic Lance**. Their briefs:
>
> **The Lance of Corvane.** A planet-scale laser cannon on the colony's own power, by day or night. It charges for a minute or two before each shot: the colony's lights dim and its factories slow while it does, and a glow climbs the barrel for everyone to see. The beam crosses the whole map in a straight line, cutting through every building in its path, carving a scorched trench, boiling water to steam and breaching Walls; a Command Base holds at a damage floor (like Missiles), so it cannot win a game alone. Counterplay ideas: a Shield Dome takes a shot; buildings spread off the line; wrecking the power feeding it stops the charge; a dust storm scatters the beam. The charging draws the Murmur within reach. Lore: an orbital-defence design from Earth's last years, found in the archives and built again here, aimed at each other.
>
> **The Sunlance.** A field of mirrors focuses Corvane's light into a beam that sweeps a target, burning buildings in a line. By day only; useless in a dust storm; a solar flare overloads and damages it. Night leaves you open, in step with the Murmur. Make sure it feels clearly different from the Lance of Corvane (what each is *for*).
>
> **The Seismic Lance.** A deep drill hammering shockwaves into the ground. Aimed at the Murmur, it collapses tunnel networks across the map and shakes nests; aimed at a rival, it cracks roads and foundations in a radius. The Murmur hear it, and come for it.
>
> For all three, also say how a game's three weapons-megastructures differ so that a player has a real choice, and how a rival's use of each can be answered.

## Batch C: infrastructure and defence

> Write sheets for **(1) the Orbital Lift**, **(2) the Atmosphere Engine**, **(3) the Shield Dome**. Their briefs:
>
> **Orbital Lift.** A space elevator to the colony's Carrier in orbit: bring down its last reserves on demand (robots, Alloy, Chips) and send goods up. Vastly dear; if it falls, the cable comes down across the map in a long line of wreckage. Say what "reserves" the Carrier holds, how fast they refill (the lore says the Carriers' reserves are running out, so this should *run down* across a game), and how it is raided.
>
> **Atmosphere Engine.** A terraforming tower that slowly changes the land round it: no more dust storms in its region, barren ground turned fertile (Bio Farms anywhere near), the Bloom pushed back. Finishing the Pathfinder's work. The Murmur hate it and go for it. Say what changes per biome, how fast, and the visible stages.
>
> **Shield Dome.** A great energy dome over the base, stopping Missiles, bombs, Ringfall and shells while powered. It drains Crystal and power all the time, and warbots can still walk in, so a war on it turns from bombardment into ground assault. Say what it blocks and what it does not, how it fails (overload), and how it interacts with the Lance of Corvane (it absorbs one shot).
>
> After the three sheets, add a **final table comparing all nine megastructures** (cost, power draw, role, unlock, build effort, one-line counter), a **recommended build order** (which to build first, second and third, and why), and the **three combinations that could break the game**.
