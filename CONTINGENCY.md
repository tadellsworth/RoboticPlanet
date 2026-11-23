# Contingency: design plan

A replayable planet-conquest campaign, apart from the Main Campaign (CAMPAIGN.md). You conquer Ithaca I territory by
territory on a turning globe, and each fight is a short Terrafall match. Inspired by Galactic Conquest in Star Wars
Battlefront II, but the name, look and rules are ours. Drafted Nov 21 2026. Items marked **(owner)** are already
decided; items marked **[open]** wait for the owner. The idea's first notes are in IDEAS.md, under Contingency.

## The fiction

Contingency starts at T+1 (2235). The Accord has just been ruled void, and every vanguard's sealed orders open:
*secure Ithaca I for us.* Each run is one way those orders could have played out. **One turn is one year on the
Arrival clock**, so a full run goes from T+1 to T+31, which is the present day in the rest of the game. The last turn's
report reads "Arrival clock: T+31." It's a quiet echo of every normal match, and the game never explains it.

**Voice.** Turn reports are written in the colony's log voice (LORE.md, Your colony's voice). Each rival speaks in
its doctrine's lines. Nothing ever states Earth's fate. Probability of contact drops a little each turn and is never
shown as zero.

## Factions

**Decided (owner, Nov 21):** you pick one of the four vanguard callsigns, and that gives you a perk and one card only your
callsign has. Each of the other three callsigns gets a random rival doctrine, shown on the globe, or you can set them
in Advanced. Doctrine also decides how each rival plays the globe (see Rival AI). The two ideas in IDEAS combine
cleanly this way: a callsign says who sent you, and a doctrine says how a rival thinks.

| Callsign | Perk (every battle) | Its own card |
| --- | --- | --- |
| COBALT | Roads cost 25% less and are built 25% faster | **Road Standard:** the battle starts with your base already linked to its nearest Stone and Ore by road |
| VERMILION | Ore Mines and Smelters work 15% faster | **Foundry Surge:** for the first 5 minutes the Bot Foundry builds at double speed |
| VIRIDIAN | Bio Farms and Agribots work 20% faster | **Reseed:** a territory loses all its Murmur and grows +1 income for 3 turns |
| TYRIAN | Trade Posts give 20% better rates | **Ledger Credit:** buy any card at half price this turn |

## The globe

**The map is LORE.md's atlas (approved Nov 21).** The territories, their land borders and the sea crossings are in
`tools/atlas/` and listed below.

- **What it is.** The turning Ithaca I from the main menu (js/menuplanet.js), which you can now spin and tap. Its
  surface is cut into **28 territories** grouped by region. Borders are drawn in faint atlas lines with region names,
  and each territory is tinted by its owner's color.
- **Layout.** Fixed region areas, but each run deals out the territories' resources, specials and home starts from the
  run's seed. So the Rust is always red desert, but its Uplink or Ore field can be in a different place.

| Region | Territories | Usual specials |
| --- | --- | --- |
| The Rust | 4 | **The Pathfinder's landing site** (orbital launch: the way to Argos), Ore |
| Greenreach | 3 | **Passenger Town** (the empty town: the Arrival City site), Fiber |
| Emberwood | 2 | Fiber, Stone |
| The Long Grass | 3 | a **Trade Post** (neutral, can't be taken) |
| Blackwater | 2 | Ports, oil |
| The Polar Caps | 2 | an **Uplink**, Ore |
| Cinderlands | 3 | **strike sites** (Crystal; extra after a ringfall season) |
| Steamwells | 2 | Fuel |
| The Shoals | 2 | an **Uplink**; reached only from a coastal territory you hold |
| The Bloom | 2 | Crystal; **where the Murmur start** |
| The Hollow | 1 | the Murmur's lair: an optional assault only |
| Argos | 2 | the **lunar relay** (an Uplink); reached only by orbit; no Murmur |

- **Uplinks.** Five sit on the globe, dealt out among the regions above. Four are fixed: Polar Caps, the Shoals, the
  lunar relay and one in the Rust or Greenreach. The fifth is dealt elsewhere each run.
- **Home territories.** Four starts spread around the globe, at least three borders apart. A home territory starts
  fortified (level 2), and losing it costs you a third of your Reserve.

## A turn

Each turn runs in this order:
1. **Income.** You get Reserve (the Carrier's stock) from every territory you hold.
2. **Spend.** You can buy a Command Group, fortify a territory, buy refits (permanent upgrades) or buy cards.
3. **Orders.** You move each Command Group one border at a time. All sides give orders together and reveal them at
   once; no fleets are intercepted mid-move **(owner)**. A Command Group can move to Argos only from a territory with
   orbital launch: the Pathfinder's site or a built Orbital Lift. The Shoals can only be entered from a coastal
   territory.
4. **Battles.** Every contested territory gets a battle. You choose for each one: **Play** or **Auto-resolve**
   **(owner: any battle can be auto-resolved)**. Battles between two rivals are always auto-resolved, and the report
   says who won.
5. **The Murmur spread** (see The Murmur).
6. **Events.** One may roll for the year: a ringfall season (strike sites pay double), a flare year (every battle
   starts with batteries drained), a *Wren* year (Trade Post deals are half price), a dust year in the Rust, or
   nothing.
7. **Report.** The turn's report comes in the log voice.

**Command Groups.** A Command Group is a reserve Command Base with its landing kit. You start with 2, can hold 1 more
for every 6 territories, and can never have more than 5. Each group has a rank from 1 to 5 stars:
- It gains a star when it wins a battle you played, or two wins it auto-resolved.
- It loses a star when it loses a battle and survives, by retreating to a neighboring territory you hold.
- It is destroyed if it has nowhere to retreat.

A higher rank means a bigger starting kit and better auto-resolve odds.

## Battles

Each battle is a normal Terrafall match built from its territory. **(owner: shorter, about 15 to 25 minutes.)**

- **The map.** The biome is the territory's region. The map shape comes from a short list for that region (the Rust:
  Open, Crater or Canyon Maze; Blackwater: River Delta or Lakes; the Shoals: Islands; Cinderlands: Volcano or Fault
  Line; and so on). Battles are played Small or Medium; a home territory is fought on a Large map, with a 35-minute cap (owner, Nov 21). Each battle's seed is fixed by the run, so loading a save
  replays the same map.
- **Who's in it.** Usually 1 vs 1. If two rivals both move into a territory you hold, you fight a three-way battle.
  An ally's Command Group in a neighboring territory can join as your teammate (see Truces and alliances).
- **The kit.** Each side lands with a kit sized by its rank, in the style of the missions' starting kits:
  - goods: 1 star is a basic stock, and 5 stars is about a 10-minute colony's worth;
  - warbots: 4 at 1 star, up to 14 at 5 stars;
  - plus anything its refits add.
  The defender also starts with the territory's **fortifications**:
  - level 1: 2 turrets;
  - level 2: adds walls and a Keep;
  - level 3: adds a Shield Dome site and Mortar Pits.
- **Winning.**
  - **Assault** (attacking a territory someone holds): capture the enemy Command Base, or have them surrender. At 25
    minutes the battle is scored on land held (the Domination count). If the scores are close, the defender wins.
  - **Uplink territories** use Uplinks victory (hold the most for 5 minutes).
  - **Unheld ground with Murmur:** destroy the nests near the landing, or hold for 12 minutes.
  - **The Hollow assault:** destroy the Deep's mound (see The Murmur).
- **Leaving mid-battle.** The battle is saved and the campaign resumes there. You can also **Withdraw**, which counts as
  a loss with a retreat.
- **What carries back.** The winner and loser, how many warbots each side has left (they become rank progress), any
  megastructure finished on the map (see Megastructures) and the fortifications standing at the end.
- **Auto-resolve.** A seeded roll from the run's RNG, so it is deterministic. Each side's strength is its rank ×
  callsign/refit factors × fortification and terrain factors. You see the odds before you choose, and they are tuned
  slightly below what a decent player gets by playing. The winner may lose a star on a close result.

## Reserve: income and spending

| Territory | Reserve a turn |
| --- | --- |
| Plain | 2 |
| Resource (Ore, Fiber, Fuel, Crystal) | 3 |
| Uplink | 3 |
| Pathfinder's landing site, Passenger Town | 4 |
| Infested by the Murmur | −1 per level |

**Supply lines.** Every resource type you hold adds that good to every battle's starting stock. Holding a Steamwells
territory, for example, means every battle starts with extra Fuel. This is why grabbing a varied spread of territory
pays off.

| Buy | Cost |
| --- | --- |
| A Command Group (lands at 1 star in a territory you hold) | 14 |
| Fortify a territory one level (up to 3) | 5 |
| A refit (permanent for the run) | 10 to 18 |
| A card (one use) | 4 to 8 |

**Refits:**
- Heavier Kit: +2 warbots in every battle.
- Forward Outpost: battles start with an Outpost built.
- Sealed Research: pick one Research Lab upgrade, done in every battle.
- Foundry Pattern: start with a Bot Foundry.
- Torch Doctrine: Torches do more to the Murmur.
- Orbital Lift Charter: cheaper moves to Argos.

**Cards:**
- **Orbital Drop:** reinforcements land mid-battle, at a spot you choose.
- **Called Ringfall:** a ringfall strike on a spot you choose mid-battle, or a −1 fortification on an adjacent
  territory.
- **Accord Ledger Deal:** a big trade at a Trade Post at old Accord rates.
- **Corvane Flare:** enemy batteries drain at the start of a battle.
- **Silent Running:** one Command Group moves two borders this turn.
- **Each callsign's own card,** listed under Factions.

Cards used mid-battle need sim orders (lockstep) and a small card bar in the battle.

## The Murmur

- **Infestation.** Each territory has an infestation level from 0 to 3. At the start, the Bloom is at 2 and the
  Hollow at 3.
- **Spread.** Every turn, each infested territory can spread +1 to a neighbor no one guards. "Guarded" means a Command
  Group stands there or it's fortified. The chance grows with the **Murmur meter**: every battle fought on the globe
  adds to it, because the war feeds them (LORE.md). Wrecks feed them, so long wars make a third enemy that threatens
  everyone.
- **In battle:**
  - level 0: the Murmur are off;
  - level 1: Quiet;
  - level 2: Active;
  - level 3: Active, with a nest near each landing. At a high meter, or late in a run, the behemoth (the biggest Murmur
    form, which only an army can bring down) appears (owner, Nov 21): the **Harrow**, built (README, "The Harrow"). The
    battle calls `spawnHarrow(x, y, p)` (js/sim.js) for it, at a nest's exit toward the landing.
- **Surges.** A level-3 territory can send a surge into a neighbor someone holds. That's a battle against the Murmur
  only: survive until dawn.
- **Clearing.** Win a battle in a territory, or keep a Command Group there for a turn, and its infestation drops by 1.
- **The Hollow assault.** A late, optional major battle on the Hollow map against the Murmur at full strength.
  Destroying the Deep's mound:
  - brings every territory's infestation to 0;
  - halves the meter;
  - slows the spread for the rest of the run.

  They never go away for good. The report says: "The murmur has stopped. … Faint signal, region unknown." Every rival
  can attempt it too.
- **Argos** never has Murmur.

## Megastructures on the globe

This is where all eight megastructures pay off in the campaign. If you finish a megastructure in a battle and win,
the territory keeps it for the rest of the run, as long as you hold it. Each one gives an effect on the globe, and
the next battle in that territory starts with it already built.

| Megastructure | On the globe |
| --- | --- |
| Lance of Corvane | Every 3 turns, strike a territory 2 borders away: −1 fortification, and its Command Group loses a star |
| Sundering Ray | Every 2 turns, quake a neighbor: −1 Murmur infestation, or −1 enemy fortification |
| Shield Dome | Enemy cards can't touch this territory; defending here, auto-resolve counts as +1 star |
| Arrival City | +3 Reserve a turn; counts as fortification level 3 |
| Orbital Lift | Orbital launch from here (reach Argos), and Orbital Drops cost half |
| Atmosphere Engine | This territory and its neighbors +1 Reserve; the Murmur can't spread into them; rivals' neighboring territories −1 (the storm) |
| Deep Core | +3 Reserve, but +1 Murmur infestation on its neighbors each turn (it draws them) |
| Great Uplink | Counts as two Uplinks toward victory |

## Winning and losing

**(owner: hold most of the Uplinks for a set number of turns, or take every rival's home territory.)**

- **Uplink win:** hold at least 3 of the 5 Uplinks at the end of 3 turns in a row. The rivals know this, and the
  globe shows a countdown.
- **Conquest win:** take every rival's home territory. A rival with no home left fights on in the territories it
  still holds, but it can't buy new Command Groups.
- **The last turn, T+31:** if no one has won by turn 30, the year's report opens **the window**: a last turn in which
  every Uplink territory is fought over. Whoever then holds the most Uplinks wins. A tie goes to whoever holds the
  most territory. This caps a run at about 3 to 6 hours **(owner)**.
- **The T+31 window is decided (owner, Nov 21).**
- **Losing:** you lose when you have no Command Group left and no Reserve to buy one. The report reads: "Reserve
  exhausted. Carrier dark."
- **The win screen:**
  - "Ithaca I secured for the Sponsor. Awaiting colonists. Arrival clock: T+31. Probability of contact: 0.2%. Still
    counting."
  - Then each beaten rival's on-defeat line.
  - Then the run's stats: battles, years, territories, and the Murmur meter at its highest.

## Rival AI on the globe

Each rival's doctrine decides how it moves:

| Doctrine | Strategy |
| --- | --- |
| Herald | Attacks every turn, aims at your nearest territory, ignores the Murmur |
| Warden | Fortifies to level 3 and attacks only where it's sure, holds Uplinks hard |
| Salvager | Hits weakly guarded resource territories, buys cards and Silent Running |
| Steward | Goes for Uplinks, clears the Murmur, and offers you a truce when you're stronger |
| Architect | Builds megastructures, wants Passenger Town (Arrival City), and goes nuclear late (Called Ringfall + Lance) |

Difficulty runs from Settler to Warlord **(owner)**. It sets the battle AI, as in a normal match, plus the rivals'
income on the globe (×0.8 to ×1.3). Advanced options: rival doctrines, the Murmur (off, normal, rampant), events on
or off, the turn cap on or off, and a fixed run seed.

## Truces and alliances (owner, Nov 21: in the first build)

- **Offers.** In the Spend phase, a rival may offer a truce, or you can offer one from a rival's card. A truce lasts 5
  turns. During a truce, neither side moves into the other's territory, and you share a border in peace.
- **Who agrees:**

  | Doctrine | Truces |
  | --- | --- |
  | Steward | Offers one when you're clearly stronger, or when the Murmur meter is high; quotes Accord clauses |
  | Warden | Accepts if you don't border its home |
  | Architect | Accepts only for a price in Reserve |
  | Salvager | Takes your Reserve and may break the truce |
  | Herald | Never agrees: "Arrival in one day. No delay authorised." |

- **Alliance.** A truce kept for 5 turns can become an alliance for the run. Allied Command Groups in a neighboring
  territory join each other's battles as teammates, and allied Uplinks count together toward the Uplink win.
  - Only one alliance at a time.
  - Two allies can't win together: once one Uplink win is near, the alliance ends with a year's notice.
- **Breaking a truce.** Your Command Groups lose a star in morale, and every rival with a truce trusts you less (no
  offers for 5 turns). The report logs it: "Truce breach logged for review by the Accord tribunal."
- **Building it:** stage 7, with the rest of the doctrine writing; the engine (stage 1) keeps truce state from the
  start.

## Saving

There is one Contingency save slot apart from the normal slots. It saves between turns automatically, and during a
battle it uses the normal battle save tied to the run. **Ironman** is optional: one save, with no reloading a lost
battle.

## Screens

- **Main menu:** a Contingency button that opens the run screen: continue, or start a new run (callsign,
  difficulty, Advanced).
- **The globe:**
  - spin it by drag, swipe or arrow keys;
  - tap a territory to open its card: owner, income, specials, fortification, Murmur level, megastructure,
    groups there;
  - drag a group to a neighbor to move it;
  - the top bar shows the Arrival clock, Reserve, the Uplink count and countdown, and the Murmur meter;
  - an End turn button.
- **Spend panel:** groups, fortify, refits and cards.
- **Battle card** (before each battle): the map preview, who's in it, the kit, the odds, and Play or Auto-resolve.
- **Year report:** results in the log voice, the rivals' lines, events and the Murmur's spread.
- **In a battle:** a small card bar, plus the Contingency's battle timer in the corner.
- **Music:** the globe plays the campaign theme (`MOODS.campaign`) at the Contingency stage of its story arc;
  battles play the normal themes.

## Building it (in order)

Each stage gets tested and shipped to `main` before the next starts.

1. **The campaign's engine, with no screens** (`js/contingency.js`):
   - the run state, generating a run from its seed, the territory graph, turns, income, the Murmur spread,
     auto-resolve, rival AI on the globe, win checks and saving;
   - fully deterministic (seeded RNG only).
   - **Test:** play 50 whole runs headless with every battle auto-resolved. Each run must end by T+31, and every
     doctrine and callsign must win some of them.
2. **The globe screen** (`js/contingency-ui.js`; since Nov 2026 the globe drawn as a planet from orbit in WebGL,
   `js/contingency-draw.js`, ART_GUIDE.md: The Contingency globe): territories on the sphere,
   tap and drag orders, panels and reports. Screenshots for the owner before going further.
3. **The bridge to battles:**
   - a territory becomes a new-game setup (biome, shape, size, rivals and doctrines, difficulty, victory, the 25-minute
     cap, the kit, pre-built fortifications and megastructures, the Murmur level);
   - when the battle ends, its result goes back to the globe;
   - Withdraw;
   - resuming a battle from the run's save.
   - **Check:** play-test battles to make sure they last 15 to 25 minutes.
4. **Reserve and its spending:** refits, cards, and the in-battle card orders (Orbital Drop, Called Ringfall, Corvane
   Flare) as lockstep orders with checkSave.
5. **The Murmur layer:** surges and the Hollow assault.
6. **Megastructures on the globe.**
7. **Callsign perks and cards,** events, endings and the year reports' writing (LORE tone). Ironman.
8. **Docs and balance:**
   - a How to play section `hs-contingency`, the guide, the README and IDEAS;
   - a short first-turn walkthrough inside Contingency (the Missions stay the tutorial for the matches themselves);
   - AI-vs-AI runs for balance.

**Later:** 2 to 4 players on the same globe, as allies or against each other **(owner)**. The engine keeps everything
in orders and seeded state from the start so that this is possible later.

## Decided Nov 21, and still open

Decided: callsigns with a perk and their own card, plus random rival doctrines; orders revealed together with no
interception; the T+31 window; truces and alliances in the first build.
Battle size: Small or Medium, and Large for home territories (35-minute cap). Nothing is open.

## The atlas: the territories and their links (Nov 21)

| Region | Territories |
| --- | --- |
| The Rust | Pathfinder's Landing, Redwash Flats, Dustgate, Ironbluff |
| Greenreach | Passenger Town, Tallpine, Stillwater |
| Emberwood | Goldleaf, Foxford |
| The Long Grass | Herdway, Ledger Post, Windsweep |
| Blackwater | the Delta, Heron Reach |
| The Polar Caps | Northcap, Southcap |
| Cinderlands | Ringfall Basin, Ashfield, Cinder Rift |
| Steamwells | Geyser Field, the Terraces |
| The Shoals | Palm Keys, Lantern Reef |
| The Bloom | Violet Reach, Bloom Edge |
| The Hollow | the Hollow (beneath Violet Reach) |
| Argos | Lunar Relay, Silent Crater |

**Land borders** are drawn from the map. The Tallpine isthmus and the Delta's shallows reach Lantern Reef on foot.
**Sea crossings** need a Port, so you must hold a coastal territory:

| From | To | Across |
| --- | --- | --- |
| Dustgate, Passenger Town | Palm Keys | the Warm Sea |
| Windsweep, Ledger Post | Geyser Field, Ringfall Basin | the Narrows |
| Heron Reach | Cinder Rift | the Grey Sound |
| Bloom Edge, Violet Reach | Goldleaf, Redwash Flats, Ironbluff | the Long Sea, where the map wraps |

**Orbit links:** Pathfinder's Landing (and any Orbital Lift) reaches Argos.
