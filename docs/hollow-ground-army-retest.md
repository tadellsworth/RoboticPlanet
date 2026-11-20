# Ground-army AI stalemate retest

The reported ground-army revision was `a2dd057`. The latest upstream base for this run was `b685c67`, with the Railgunner tuning. The working branch baseline was `a25e769`, which already included that upstream history and the working-branch fixes. The working branch's existing changes can shift a match well before a late-game stall, so results for the three starting revisions are recorded separately.

## What stalled

- **Hollow Medium 11.** At minute 25 on the upstream build both colonies had two Ore and zero Alloy in stock. The colonies had 11 and eight combat units, but could each spare only one armed unit from garrisons for a rally by the opposing Command Base. The army count overstated what could actually march. The four-minute site release still frees construction slots, but does not solve that combination of parts and garrison shortages.
- **Hollow Medium 12.** At minute 20 on the upstream build the colonies still had 56 and 27 Ore, respectively. Both were at zero Fuel, Alloy and Chips. Their Smelters and oil industry repeatedly showed Workers recharging or travelling back to work. A staffed Worker could leave for a station with too little usable charge to make the round trip worthwhile. With the recovery check, at the same mark in the working-branch trial, Colony 1 had 12 Fuel and 24 combat units.
- **Hollow Small 21.** At minute 20 on the latest upstream build, both colonies had zero Ore and Alloy. The leader had eight combat units, six armed, against one. The usual Normal march gate still required ten, and the existing garrison calculation kept much of the army back. By minute 30 the leader was down to three units.

## Changes

- **Ore.** A starving Hollow colony can work a single vein once it cannot find a conventional two-vein Mine. When the last working Mine runs dry, distant neutral Ore outside local build reach no longer suppresses attempts to clear a nest sitting on a useful resource.
- **Fuel and production.** Workers in the AI's Oil Pumps, Refineries, Smelters and Chip Fabs keep working at reduced speed if their expected share of charge will not cover travelling there and back with a useful battery level.
- **Assaults.** When parts production stalls and the AI has at least twice the opponent's army plus two armed units, it can plan a march below the usual minimum. A safe home base lets a storm draw armed units from more non-base garrisons. The home guard, gun cover and breach checks still apply. The road-site release delay and unit balance are unchanged.
- **Missiles.** The Standard matrix reproduced a separate Architect error. At 21:38 in the mirror match, an Architect under siege tried to fire a warhead from its Command Base. Its defensive missile orders now require a ready Missile Silo. All nine Architect matchups were rerun after the guard.
- No new simulation or save fields. The required help, mission data and lint checks pass. Targeted fixtures verified one-vein siting, the distant Ore estimate, and what a staffed Worker does with scarce and plentiful charge. A save-and-replay check matched the continuation hash.

The trial with the Ore and Fuel changes alone left Hollow Medium seed 25 open beyond an hour. The assault change let the leader finish that game at 33:38. The full trial also kept the Small seed 25 and Islands seed 21 finishes.

## Match results

Two computer colonies at Normal difficulty, with the stated seed and the default terrain and resource settings. The Hollow cases use Active Murmur and two Balanced rivals (Stewards). Islands and Standard use their surface baseline with the Murmur off. Each run advances at 30 ticks per game second to a winner or a 75-minute cap. The slots in the tables are one-based. The Standard map is Medium. Its matrix covers all 25 ordered pairs because the build has a fifth style, the Salvager.

The named cases use the repository headless setup with `autoplay: true`. The Standard cases use the Observer setup with `humans: []` and `S.watch = true`. The first colony gets its chosen doctrine and economy multiplier before the first tick, as it does in Observer mode. Both test sets use Capture victory and leave nuclear weapons, random events and challenge modifiers off.

| Map | Seed | Original ground army | Latest upstream | Working branch before | After |
| --- | ---: | --- | --- | --- | --- |
| Hollow Medium | 11 | Open at 75:00 | Open at 75:00 | 31:23, Colony 2 | 37:36, Colony 2 |
| Hollow Medium | 12 | Open at 75:00 | Open at 75:00 | 34:22, Colony 2 | 42:50, Colony 2 |
| Hollow Medium | 25 | 16:04, Colony 2 | 16:04, Colony 2 | 13:06, Colony 2 | 33:38, Colony 1 |
| Hollow Small | 21 | Open at 75:00 | Open at 75:00 | 29:06, Colony 1 | 21:12, Colony 1 |
| Hollow Small | 25 | 20:30, Colony 1 | 20:28, Colony 2 | 40:26, Colony 2 | 31:55, Colony 2 |
| Islands Medium | 21 | 14:23, Colony 1 | 14:23, Colony 1 | 17:06, Colony 2 | 17:06, Colony 2 |

| Colony 1 | Colony 2 | Before | After |
| --- | --- | --- | --- |
| Steward | Steward | 16:04, Colony 2 | 16:04, Colony 2 |
| Steward | Warden | 22:13, Colony 2 | 22:13, Colony 2 |
| Steward | Salvager | 17:12, Colony 2 | 17:12, Colony 2 |
| Steward | Herald | 17:54, Colony 2 | 17:54, Colony 2 |
| Steward | Architect | 32:51, Colony 2 | 32:51, Colony 2 |
| Warden | Steward | 15:23, Colony 2 | 15:23, Colony 2 |
| Warden | Warden | 20:14, Colony 2 | 20:14, Colony 2 |
| Warden | Salvager | 8:00, Colony 2 | 8:00, Colony 2 |
| Warden | Herald | 11:04, Colony 2 | 11:04, Colony 2 |
| Warden | Architect | 24:44, Colony 2 | 24:44, Colony 2 |
| Salvager | Steward | 16:08, Colony 1 | 16:08, Colony 1 |
| Salvager | Warden | 16:11, Colony 1 | 16:11, Colony 1 |
| Salvager | Salvager | 18:23, Colony 1 | 18:23, Colony 1 |
| Salvager | Herald | 15:48, Colony 1 | 15:48, Colony 1 |
| Salvager | Architect | 14:13, Colony 1 | 14:13, Colony 1 |
| Herald | Steward | 15:54, Colony 2 | 15:54, Colony 2 |
| Herald | Warden | 8:16, Colony 1 | 8:16, Colony 1 |
| Herald | Salvager | 10:19, Colony 1 | 10:19, Colony 1 |
| Herald | Herald | 14:12, Colony 2 | 14:12, Colony 2 |
| Herald | Architect | 18:11, Colony 1 | 18:11, Colony 1 |
| Architect | Steward | 18:28, Colony 2 | 18:28, Colony 2 |
| Architect | Warden | 16:59, Colony 2 | 16:59, Colony 2 |
| Architect | Salvager | 9:21, Colony 2 | 9:21, Colony 2 |
| Architect | Herald | 25:16, Colony 2 | 25:16, Colony 2 |
| Architect | Architect | Simulation crash at 21:38 | 33:59, Colony 2 |

Standard results without winners: 1 before (one simulation crash, zero timeouts), 0 after. The 16-match subset without the Salvager has the same counts.
