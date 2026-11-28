# Rival persistence: review of the two codex audits (Nov 27, 2026)

The owner's complaint: rivals "peter out late game and stop fighting". Two audits on `codex/working-branch`
(`docs/standard-rival-persistence-audit.md` at 86ab210 and `docs/warlord-recovery-audit.md` at 34a1bec) made four
findings. This review checks each one against main at 343c23f (after the economy audit, `CRATE_RETRY`, the map
generation changes and terraforming stages 1–5), fixes the real ones in `js/ai.js` (and the one delivery rule in
`js/sim.js`), and measures before and after with the audits' own harness, `tools/late-attack-audit.js`. The codex
branch was not merged.

New test: `node tools/ai-persistence-test.js` (real AI routines on Standard seed 11; it fails on 343c23f).

## Verdicts

| # | Finding | Verdict on main | Fixed |
|---|---|---|---|
| 1 | The Fiber reserve pauses a loaded Smelter | **Still present**, and wider than reported | yes |
| 2 | Depleted-economy march floor sends nobody | **Still present** | yes |
| 3 | `stormT` shared by weather and the ground storm | **Still present** | yes |
| 4 | Unsafe stalled sites hog construction slots (Warlord recovery) | **Mechanism still present**; the hour-long stall does not reproduce on main's seed 11, where the collapse now has other causes | yes (guard), plus Ore trade |

### 1. The Fiber reserve pauses a loaded Smelter

**Evidence.** The rule (`aiThink`, the Smelter loop after `sitesWantFiber`) still reads `playerGoods`, which skips
hopper contents. On main, Standard 11, Settler, rival on hold at 12 (`TERRAFALL_ECONOMY_TRACE=1 node
tools/late-attack-audit.js Standard 11 2 75 343c23f easy balanced 12`), colony 2's only Smelter was paused at minute 11
holding 6 Ore and 6 Fiber with 3 Alloy in the colony. The rule is also wider than the audit said: once paused it only
wakes at 6 Fiber in storage, so between 3 and 5 it stays off however loaded it is. Standard 7, Settler, hold at 12:
the Smelter sat paused with 6 Ore and 5 Fiber in its hopper, 3 Fiber in storage and 0 Alloy from minute 30 to the
end (76% of the game's samples paused).

On seed 11 the long stall on main is not this pause any more: from minute 13 the Smelter is "Waiting for Fiber" and
Fiber made stops at 28 for the rest of the game. `TERRAFALL_PICKUP_TRACE=1` shows why: a Murmur Scuttler parked about
nine tiles from both Harvesters made their workers turn back (`takeCover`) 101 times in four minutes. That is a
separate problem (in IDEAS).

**Fix.** A Smelter holding a batch (2 Ore and 2 Fiber) while the colony has under 3 Alloy finishes it, whether the
reserve is pausing it now or keeping it off until 6 Fiber: it is unpaused with `b.drain`, and `needsOf` (js/sim.js)
asks nothing for a draining building, so no undelivered Fiber goes into it and the reserve for construction stands.
When the batch is done it rests again. Not one triage rested. `b.drain` is cleared wherever a building changes hands.

### 2. Depleted-economy march floor

**Evidence.** On main the outer rule still lets a dead planet (both colonies out of parts) march with
`max(4, enemyArmy + 2)`, and `aiMarch` still re-applied `crushing ? max(4, enemyArmy * 2 + 2)` as its floor. The
test calls the real planner: four armed warbots in the Command Base against two, the enemy base 43 tiles away, no
guns: `aiMarch(..., finish = 0)` (main's behaviour) sends nobody.

**Fix.** `finish` now carries the band that is enough (`finishAt`) into `aiMarch`, which uses it as its floor and for
the light-guns storm size. `aiTakeNeed` (garrison, guards), the guns over the flag and the breach check still apply.
Test: the exposed base gets a march of 4; the same base with four Pulse Turrets gets none.

### 3. Weather and assault clocks

**Evidence.** `aiAtmosStorm` still set `P.stormT = S.time` on every look, and `aiMarch` reads `P.stormT` as the start
of its four-minute wait for the enemy base (and clears it on every march, so the weather was looked at again at once).
The test: `P.stormT = 1700`, weather looks at 1800 and 1830, and on main `P.stormT` became 1800.

**Fix.** The weather has its own clock, `P.wxT`. Test: after the looks `P.stormT` is still 1700 and `P.wxT` 1800.

### 4. Unsafe stalled sites (Warlord recovery)

**Evidence.** The code paths the audit named still miss a linked site that is unsafe with nothing coming: the
emergency Mine/Tap check counts it "on the way" once a road reaches it, the four-minute road rule needs it unlinked,
and the stale-site rule needs goods the colony doesn't have. But main's seed 11 Warlord hold plays out differently:
colony 2's unsafe sites at minute 10 were gone by 12 (triage, `few`, took them down), and its collapse came from
triage, Mines on spent fields and one Hauler left. A scan of four hold games on main (10-second samples) found
linked, unsafe, stalled sites lasting 6 to 10 minutes on seed 11, unsafe for under half of that time, and none on the
others. A second repro on Standard 25 (Warlord hold, after the fixes) showed a related block: Ore 0 from minute 12,
the replacement Mines and the Terminal "No road to storage yet" with the whole road planned and 11 Workers idle,
because paving skips tiles in danger (in IDEAS: not fixed here).

**Fix.** `aiHotSites` watches each Mine, Crystal Tap, Harvester, Quarry, Depot and Outpost site. One unsafe now,
unsafe at least half the time since anything last came in (goods delivered, construction progress, goods on the
way), for 2 minutes and at least 3 minutes old, is given up, and its spot avoided for 4 minutes (`P.avoid`).
`aiHotStalled` (30 s) keeps such a site from counting as the answer to an Ore or Crystal shortage (`starved`) or as a
site wanting Fiber (`sitesWantFiber`). Haulers' safety checks are unchanged. Tests: a stuck site is given up and its
spot avoided; one with goods on the way, and one whose threat passed and got a delivery, keep their place. In four
regular games after the fix it fired once.

**Ore trade.** Confirmed: `tradeFirst` (the Terminal past the site limit) was Crystal or Fuel only; `aiTrade` already
buys Ore once a Terminal stands (`P.oreLow`). Now `oreLow` puts the first Terminal past the limit as well.

## Measurements

All with `tools/late-attack-audit.js` (Medium, Balanced, Versus, Capture, Murmur active, nuclear race and
megastructures on, events off). Before: 343c23f. After: the fixes on 343c23f (`55ad055`, a measuring branch with the
same AI changes as the commit; the space-expansion merge came in afterwards). Holds put colony 1 on hold at minute 12.
Seeds play out differently after any AI change, so single games move in both directions; look at the spread.

### Settler holds: colony 2 (the one still running its AI)

Army robots produced, Alloy made (m30 / m75), share of samples with a Smelter working / all Smelters paused.

| Seed | Before: produced | Alloy | Smelter work / paused | After: produced | Alloy | Smelter work / paused | Result before → after |
|---:|---|---|---|---|---|---|---|
| 3 | 0 / 1 | 60 / 132 | 15% / 25% | 0 / 0 | 63 / 102 | 12% / 15% | undecided → undecided |
| 7 | 14 / 16 | 102 / 156 | 21% / **76%** | 22 / **49** | 140 / **293** | 41% / 37% | undecided → undecided |
| 11 | 7 / 8 | 48 / 48 | 6% / 16% | 3 / 3 | 45 / 54 | 7% / 34% | undecided → undecided |
| 21 | 22 / – | 105 / – | 56% / 44% | 4 / 80 | 108 / 290 | 45% / 27% | C2 at 35.6 → undecided |
| 25 | 21 / 30 | 135 / 189 | 26% / 19% | 16 / 16 | 117 / 120 | 19% / 6% | undecided → undecided |

Seed 7 is the finding's own case and recovers: production triples after minute 30 and it lands 14 hits. Seed 11 is
Fiber-starved by the Scuttler either way (the extra "paused" is an empty Smelter resting). Seeds 3 and 25 never get
going in either version, for reasons outside these findings.

### Warlord holds

| Seed | Before | After |
|---:|---|---|
| 3 | C1 wins at 5.4 | C1 wins at 5.7 |
| 7 | C1 wins at 6.0 | C1 wins at 7.9 |
| 11 (the audit's) | C1 wins at 72.3. C2: 18 army robots produced by 30, 1 left, 80 Ore mined by 30, 3 orders after 30, longest gap without building hits 27 min | C2 wins at 15.5, before the hold matters |
| 21 | C2 wins at 22.2 | C2 wins at 41.4 |
| 25 | C1 wins at 10.3 | C2 wins at 18.5 |

The audit's seed no longer reaches the recovery phase (the attacker now wins at 15.5), so the recovery fix is covered
by its test and by the Standard 25 repro above.

### Regular games: win, loss and length (no hold, 60–75 minute cap)

Standard seeds 3, 7, 11, 21, 25 at all five difficulties, and Long haul 11 at Colonist and Warlord (27 games).

| Difficulty | Games | C1 / C2 / undecided, before | after | Median length before (min) | after | Mean before | after |
|---|---:|---|---|---:|---:|---:|---:|
| Settler | 5 | 3 / 2 / 0 | 4 / 1 / 0 | 31.9 | 33.4 | 29.4 | 36.3 |
| Pioneer | 5 | 4 / 1 / 0 | 4 / 1 / 0 | 24.5 | 21.4 | 24.9 | 21.0 |
| Colonist | 6 | 2 / 4 / 0 | 3 / 3 / 0 | 20.5 | 24.3 | 24.2 | 22.8 |
| Commander | 5 | 4 / 1 / 0 | 4 / 1 / 0 | 12.0 | 14.2 | 13.0 | 14.5 |
| Warlord | 6 | 4 / 2 / 0 | 3 / 3 / 0 | 10.3 | 14.5 | 14.6 | 15.4 |
| All | 27 | 17 / 10 / 0 | 18 / 9 / 0 | 20.5 | 21.4 | 21.1 | 21.8 |

Every game was still decided, by about the same times; no difficulty swung. (Per game: Standard 3 Settler 32.4 →
54.1 is the longest change; the rest move by a few minutes either way.)

## Checks run

lint, help-coverage, mission-data, map-symmetry, map-audit, terraform 1–5, clear, routes, workforce,
workforce-lockstep, transit, massdriver, mega-seize, army-pathing, civilian-pathing-audit, ai-ammo-recovery,
ai-foundry-recovery, space, the new ai-persistence test, and `node tools/build-single.js`.

## Left open (IDEAS)

- A Murmur Scuttler parked by the Harvesters keeps their workers in (Standard 11, Settler).
- Planned roads through danger are never paved, so replacement sites wait "No road to storage yet" (Standard 25,
  Warlord).
- Triage makes a Hauler only when there is none; a Warlord with one Hauler left kept full Mines for minutes.
