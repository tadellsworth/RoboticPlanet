# Economy audit, November 26 2026

Four asks from the owner: why Chips and Crystal run short late in Long haul games, why the Architect rival is weak,
the Mass Driver's two open questions ("do whatever you recommend to make the Mass Driver a competitive option but
also balanced so it isn't too good"), and a rule for rivals and terraforming. The "before" revision is `598b37d`.

New headless tools for this pass:

- `tools/economy-audit.js MAP SEED 2|4 MINUTES [doctrines] [git-ref]`: one computer-only Versus game traced every
  5 minutes (or `TERRAFALL_EVERY` seconds): each colony's Ore, Fiber, Alloy, Crystal, Chip and Fuel stock and output,
  its Mines, Smelters, Taps and Chip Fabs and what they wait for, its Bot Foundry, the Ore and Crystal left in its land
  and in no one's, its robots and sites, its Trade Terminal's route, and what spent its Chips, Crystal, Alloy and Fuel.
- `tools/freight-compare.js [distance] [vehicles] [minutes]`: one far store served five ways (below).
- `tools/mega-fee-audit.js MAP SEED TYPE MINUTE`: a rival handed a seized megastructure, under three Foundry rules.

## 1. Chips and Crystal late on Long haul

### Measured

Ten computer-only games at `598b37d` (Normal, Medium, Murmur Active, nukes and megastructures on, 60-minute cap):
Long haul seeds 3, 11, 15, 21, 25 and 31 (two Stewards) and Long Haul 2v2 seeds 3, 11, 15 and 21 (four).

| | Before |
| --- | --- |
| Ore, Alloy, Chips, Crystal made a colony-minute from minute 15 to the end | 4.95, 6.39, 2.29, 1.88 |
| Mines, Smelters, Chip Fabs at work, typical colony after 20 minutes | 0 to 2, 1, 1 |
| Crystal left in no one's land at the last sample (2-player / 4-player) | 136 to 476 / 781 to 918 |
| Ore left in the colonies' own land at the last sample | 0 to 685 a colony (most over 100) |
| Chip Fab samples "Waiting for Alloy" / "Waiting for Crystal" from 20 minutes | 33–100% / 0–50% |
| Chips spent | 90% or more by the Bot Foundry (`produce`); buildings 1 to 21 a game |

### Root cause

Not a supply problem in the ground, and not a demand spike: the deposits outlast the games (hundreds of Ore in the
colonies' own land and hundreds of Crystal in no one's), and the megastructures and late units take a sliver of the
Chips (the Bot Foundry's robots take nine in ten). **The rivals failed to keep their extraction chain going.** A
Steward ran one Mine and one Smelter for most of a 40-minute game, 3 to 5 Ore a minute, with hundreds of Ore in its own
land; its one Chip Fab waited for Alloy a third to all of the time, and its Foundry waited for Chips. Each worked-out
field (an Ore vein holds 24, a cluster 12, a Mine works out its field in 5 to 10 minutes) had to be replaced, and the
replacement waited: the build plan reaches the second Mine and second Smelter only after a dozen other entries, the
rival's two sites were held for minutes by a Reactor, a Trade Terminal or Outposts waiting for Alloy, and the next
fields on Long haul lie far up the narrow map (a long road, a long haul). On the Architect's Standard 11 games the
same: its first Mine and two Harvesters worked out at nine minutes and the new ones stood unbuilt for five, Ore and
Fiber at a standstill. Trade did little: rival Trade Terminals made 0 to 8 runs a game.

### The fix

Two changes, the smallest that moved the numbers:

1. **A chain too thin gets its link first** (`AI_THIN` in `js/ai.js`, every rival, from 6 minutes): another Mine
   while a Smelter waits for Ore with fewer than 2 Mines at work a Smelter (4 at most) and Ore on its land; another
   Smelter while 16 Ore piles up with every Smelter busy (3 at most); another Chip Fab while 16 Crystal piles up with
   every Fab busy (3 at most); another Tap while Crystal runs low with fewer Taps at work than Fabs and one; another
   Harvester while Fiber is under 8 with fewer than 2 cutting. Each goes first, past the usual limit on sites, like a
   starved one. With none cutting, a Harvester site gets high priority, and an idle Harvester is taken down for its
   Fiber after 90 s with too little for a new one (`AI_FIBER_DRY`).
2. **Long haul's Ore and Crystal hold half as much again** (`haulRich` 1.5 on Long haul and Long Haul 2v2, for
   everyone): a colony's near fields last longer before the next, far up the map, is needed. Not abundant: a cluster
   holds 18 instead of 12 (before the map's richness setting), and the drizzle and the frontier's richer fields are as
   they were.

### Before and after

The same ten games on the final revision (the two changes above, the Architect's below and the Mass Driver's, merged
with main's Half underground). Rates are per colony-minute from minute 15 to the last 5-minute sample, Ore / Alloy /
Chips / Crystal:

| Game | Before | After | Rates before | Rates after |
| --- | --- | --- | --- | --- |
| Long haul 3 | colony 2 at 18.9 | colony 1 at 24.4 | (over by 15 min) | 6.7 / 5.9 / 3.2 / 4.9 |
| Long haul 11 | colony 2 at 44.1 | colony 2 at 27.3 | 2.9 / 2.2 / 0.7 / 0.7 | 8.2 / 5.3 / 2.5 / 1.8 |
| Long haul 15 | colony 2 at 34.9 | colony 2 at 26.0 | 4.3 / 7.9 / 2.7 / 3.1 | 5.1 / 8.6 / 2.2 / 1.1 |
| Long haul 21 | colony 1 at 54.7 | colony 2 at 17.1 | 4.7 / 7.2 / 2.6 / 2.9 | (over by 15 min) |
| Long haul 25 | colony 2 at 41.9 | colony 1 at 41.9 | 6.4 / 8.0 / 2.6 / 1.2 | 8.1 / 10.8 / 4.3 / 4.5 |
| Long haul 31 | colony 1 at 25.9 | colony 1 at 32.0 | 4.5 / 6.3 / 2.0 / 1.9 | 8.0 / 10.4 / 3.5 / 4.9 |
| Long Haul 2v2 3 | colony 1 at 49.9 | colony 4 at 33.4 | 5.4 / 5.7 / 2.5 / 2.1 | 5.1 / 7.3 / 2.8 / 3.8 |
| Long Haul 2v2 11 | colony 4 at 49.5 | undecided at 60 | 6.6 / 7.4 / 2.6 / 2.6 | 5.3 / 8.2 / 3.0 / 3.4 |
| Long Haul 2v2 15 | colony 2 at 38.1 | undecided at 60 | 5.1 / 7.6 / 2.5 / 0.7 | 5.1 / 7.0 / 2.5 / 2.6 |
| Long Haul 2v2 21 | colony 3 at 28.8 | colony 3 at 26.1 | 2.2 / 4.5 / 2.2 / 0.7 | 4.1 / 7.8 / 3.3 / 2.5 |

| All ten, from minute 15 (weighted by length) | Before | After |
| --- | ---: | ---: |
| Ore a colony-minute | 4.95 | 5.97 |
| Alloy a colony-minute | 6.39 | 8.14 |
| Chips a colony-minute | 2.29 | 3.03 |
| Crystal a colony-minute | 1.88 | 3.29 |
| Smelters / Chip Fabs / Crystal Taps a colony, from minute 20 | 1.4 / 1.2 / 1.0 | 2.5 / 2.1 / 2.4 |
| Samples with no Chips in stock, from minute 20 | 72% | 53% |

Chips up a third, Crystal three-quarters, Alloy a quarter. Chips still run out often (a rival spends each one as it
is made: the Foundry takes it), but no colony now sits through the late game on one Smelter and one Fab. Intermediate
steps: the `AI_THIN` rule alone (Mine, Smelter, Tap) gave 2.46 Chips and 2.43 Crystal; with the richer Long haul
deposits 2.55 and 3.07; the Chip Fab and Harvester rules took it to 3.0 and 3.3.

The two-player games ended sooner on average (36.7 minutes before, 28.1 after, all decided both times). Two of the four
Long Haul 2v2 games now run to the 60-minute cap (none did before): richer colonies that hold their own; see Open
questions.

## 2. The Architect

### Measured

`tools/doctrine-audit.js`, 40-minute cap, Medium Versus, Normal: the Architect against each other doctrine, both
ways round, on Standard 25 and 11, Long haul 21 and 3 (and against the Steward and the Herald on Islands 3): 36 games
each side. Before is `598b37d`, after `b7f2566` (this pass's AI changes, merged with main).

| Architect | Won | Lost | Undecided |
| --- | ---: | ---: | ---: |
| Before | 10 | 22 | 4 |
| After | 16 | 15 | 5 |

| Map | Before | After |
| --- | --- | --- |
| Standard 25 | 5–3 | 4–4 |
| Standard 11 | 0–8 | 4–4 |
| Long haul 21 | 3–5 | 4–3, 1 undecided |
| Long haul 3 | 2–5, 1 undecided | 4–3, 1 undecided |
| Islands 3 | 0–1, 3 undecided | 0–1, 3 undecided |

| Against | Before | After |
| --- | --- | --- |
| Steward | 2–6, 2 undecided | 4–4, 2 undecided |
| Salvager | 1–7 | 4–3, 1 undecided |
| Warden | 3–4, 1 undecided | 4–3, 1 undecided |
| Herald | 4–5, 1 undecided | 4–5, 1 undecided |

The whole tournament on the two seeds the earlier audits used (Standard 25 and Long haul 21, every pair both ways
round, 40 games), to see where it lands among the five:

| Doctrine | Before (`598b37d`) | After (`b7f2566`) |
| --- | --- | --- |
| Steward | 6–8, 2 undecided | 9–6, 1 undecided |
| Salvager | 7–9 | 9–6, 1 undecided |
| Architect | 8–8 | 8–7, 1 undecided |
| Herald | 10–5, 1 undecided | 7–8, 1 undecided |
| Warden | 7–8, 1 undecided | 4–10, 2 undecided |

(The before column matches the third pass's `ada824f` table exactly: these two seeds hadn't moved since.) The Architect
sits in the middle, not the best. The chain rules help every rival, the ones that grow their economy most of all; the
Warden, which spends early on Walls and Keeps, fell to last on these two seeds (it was 7–8): see Open questions.

### Root causes

Traced with `tools/economy-audit.js Standard 11 2 40 tycoon,balanced` (every 60 s), where it lost all eight:

- **Build order.** Its extra Smelter, Chip Fab and second Tap went in straight after the Ammo Plant, ahead of the
  second Mine, the third Harvester and the Grove Planter. The second Smelter stood "Waiting for Ore" and the Fab
  "Waiting for Alloy" from ten minutes; its bots work 15% faster, so it burned Fiber faster too, and by nine minutes its
  two Harvesters and its Mine had worked out their fields (H 0, M 0) with the new ones unbuilt for five minutes. Ore
  and Fiber stood still from 9 to 14 minutes while the Steward's kept climbing, and its army melted from 8 to 1.
- **Fuel.** At 2 or 3 Fuel through the middle game (the Steward 9 to 18): one Bio Farm until the plan's second, far down
  the list, with its Missiles (a Fuel each), its Generators and its Mass Driver pair wanting it. Its pairs on island
  maps seldom fired: the near end shipped only what the colony held beyond a reserve of 20, and it seldom held 20 of
  anything.
- **Its missile programme** could start saving (the Missile Factory's site first, past its site limit) while its
  chain was broken.

The doctrine weights (army 1.3 from 0.7, econ 1.15) were not the problem; they stay.

### The fix

- Its build plan puts the inputs first: after the Ammo Plant, a third Harvester, a Grove Planter and a second Mine,
  then the second Smelter, a second Bio Farm (its Fuel), and the second Tap and Fab.
- Its missile programme waits for its economy to run: a Mine working its field and a Harvester cutting.
- The chain rules of part 1 (every rival), and the Mass Driver's reserve of 6 for a rival (part 3).

It now wins about half its games against every doctrine but the Herald, which still edges it, and is not the best.

## 3. The Mass Driver

### Against Maglev, rail and trucks on a long haul

`tools/freight-compare.js 40 4 10`: a far store about 40 tiles from home over open land on Long haul (Islands for the
sea crossing), kept asking for Cement (a deep supply order, emptied every second so it never fills), the home end kept
stocked so the line, not the Haulers feeding it, sets the pace; 10 minutes measured once the first goods arrive.

| | Cost | Build | Goods a minute, one way | Fuel a minute | Weak point |
| --- | --- | --- | ---: | ---: | --- |
| Mass Driver line, 37 tiles over land | 20 Cement, 15 Alloy, 8 Chips | 30 s (two sites) | 88 | 0.2 before, **3.2** now | Flak under the arc; the two ends |
| Mass Driver line, 40 tiles across the sea | the same | 30 s | 112 | **4.1** now | the same |
| Maglev, 35 tiles, 11 pylons, 4 pods | 49 Cement, 61 Alloy, 25 Chips | 169 s (a Worker at 3 s a tile) | 117 | 2.2 (its Generators) | any of 11 pylons shot down |
| Rail, 44 tiles of track, 4 Freight Trains | 78 Cement, 35 Alloy, 20 Chips | 24 s (stations; track laid at once) | 118 | not counted | the trains, level crossings |
| Road, 41 tiles, 4 Freight Trucks | 10 Cement, 8 Alloy, 8 Chips, 3 Fiber (and the paving) | 8 s and the road | 48 | 1.2 | the whole road; raiders |
| Road, 41 tiles, 4 Road Trains | 10 Cement, 16 Alloy, 16 Chips, 3 Fiber | 8 s and the road | 49 | 1.0 | the whole road; raiders |

Before this pass the Driver line was the cheapest to build by a factor of three, up in a fifth of the time of a Maglev
line, carried three quarters of what rail or Maglev carry one way (and as much again home), had nothing between its
ends to defend, and ran for nothing: its Generators burned 0.2 Fuel a minute, because a Generator burns only while
something in reach works, and an end works only for its 1.6 s charge. Over land it beat every option but a long
convoy of trucks on cost and most on everything else.

### Decisions (the owner gave the go-ahead)

- **A shot costs half a Fuel** (`MASSDRIVER.shot`: 20 s of its Generator's work, `mdShotPower`). At full rate an end
  now burns about 3 Fuel a minute over land and 4 across the sea: dearer to run than a Maglev line or a truck convoy,
  which is the price of no line to build or defend. Cost, reach, reload, canister and the two-Drivers cap stay.
- **The far end's cap stays 64 a good, each good counted on its own** (question 1). A cap on the whole stock would let
  a pile of one good nothing collects stop the goods the far end does use, the Fuel its own Generator burns first, and
  the line would go dark from the far end. Checked in `tools/massdriver-test.js`: a far end full of Cement still takes
  its Fuel.
- **Fuel ships beyond a reserve of 6** (`fuelReserve`; 20 for the rest), so the far end's Generator keeps the line
  firing home; **a rival ships beyond 6 of everything** (`aiReserve`): its Alloy and Chips never sit in storage, and
  the Architect seldom held Fuel past 20, so its pairs had little to throw.
- **A seized megastructure's fee rests a rival's Foundry in proportion** (question 2; `AI_SEIZE.restFee`, `restMin`):
  45 s for a fee of 18 Alloy and Chips or more, 45 × 18 ÷ the fee for less, none under 6; the Ammo Plant rests at once
  as before. `tools/mega-fee-audit.js`, the megastructure handed to colony 2 at 16 minutes:

| | Fee (Alloy + Chips) | Online after, scaled / fixed 45 s / never | Foundry resting, scaled / fixed |
| --- | ---: | --- | --- |
| Shield Dome, Standard 25 | 9 | 111 / 111 / 111 s | 6 / 52 s |
| Shield Dome, Long haul 21 | 9 | 118 / 123 / 331 s | 18 / 66 s |
| Lance, Standard 25 | 12 | 135 / 129 / 150 s | 58 / 78 s |
| Lance, Long haul 21 | 12 | 143 / 138 / 270 s | 72 / 88 s |
| Lance, Standard 11 | 12 | 257 / 306 / 230 s | 186 / 224 s |
| Orbital Lift, Standard 25 | 18 | 170 / 170 / 188 s | 118 / 118 s |

  A small fee comes in as fast with the Foundry mostly running; a big one keeps the full rest, which on Long haul
  roughly halves the wait against never resting. (The Great Uplink had no room by the Command Base on these maps; the
  Lift on Long haul 21 and the Dome and Lift on Standard 11 weren't online within 8 minutes under any rule.)

## 4. Rivals and terraforming

Recorded in IDEAS under the terraforming entry (the owner's rule, not built): a little, and only where stage 1 clearly
pays in a long game (flattening ground for a building it can't otherwise place, a land bridge to a near island it means
to hold, filling a channel that blocks its way to Ore or Crystal it is short of), one-off jobs from the middle game,
never moats or banks aimed at a rival. Nothing in this audit needed it: rivals ran short for want of Mines kept at
work on the Ore they already held, not for want of room.

## Open questions

- **Long Haul 2v2 runs longer.** Two of the four seeded 2v2 games now reach the 60-minute cap (none did before);
  richer colonies on both sides hold their own. Worth a look with the stalemate tools (`docs/ai-stalemate-audit.md`)
  before anything changes; the two-player games ended sooner (28.1 minutes on average, from 36.7).
- **The Warden** went 7–8 → 4–10 in the two-seed tournament. It may only be these seeds (16 games); a six-seed run would
  tell whether it needs the economy push the Steward had.
- **Chips are still spent as they come**, so a rival's Chip stock reads 0 half the time; the Fab now waits for Alloy
  more than for Crystal (55% and 45% of samples). A further step would be the Chip Fab's own cap (`AI_CAPS`), not more
  Crystal.
- **Trade did little** for any rival: 0 to 8 runs a game, often on a route it can't feed (Cement out with none to
  spare). Not changed here.
- **The rival seldom builds a Mass Driver pair at all** on Islands (none in the Islands 3 games): it needs a foothold on
  another island first. The reserve change makes a pair it has fire; getting a foothold is the Airship/Ferry logic's.
- **Overland Mass Driver lines** are now dearer to run than a truck convoy and still the cheapest to build. If players
  still lean on them over land, the next lever is the overland reload (10 s), not the cost.

## Reproduce

```sh
node tools/economy-audit.js 'Long haul' 21 2 60 - 598b37d          # and seeds 3 11 15 25 31; the working tree without the ref
node tools/economy-audit.js 'Long Haul 2v2' 3 4 60 - 598b37d       # and seeds 11 15 21
node tools/doctrine-audit.js Standard 11 tycoon balanced 40 598b37d # each pair both ways round, five maps
node tools/freight-compare.js 40 4 10
node tools/mega-fee-audit.js 'Long haul' 21 dome 16                 # and lance, lift; Standard 25 and 11
node tools/massdriver-test.js
```
