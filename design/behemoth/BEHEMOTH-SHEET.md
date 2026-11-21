# The behemoth: design sheet (three directions)

For the owner to choose from. Nothing is installed in the game. The art is rendered with the game's own renderer
(`renderer/b/murmur_behemoth.js`, built on the same kit as every other Murmur, `murmur_moleskit.js`) and composed the
way the game draws a map (`renderer/preview/behemoth_mock.py`); the sheets are `renderer/preview/behemoth_sheet.py`.
Sheet images (1500 px wide here; rebuilt at 3000 px by the steps in renderer/RENDERER.md, "The behemoth design sheet"):
`sheet-overview.jpg`, `sheet-A-harrow.jpg`, `sheet-B-maw.jpg`, `sheet-C-bearer.jpg` in this folder.

**The brief (the owner, Nov 21 2026):** a massive endgame unit, the biggest Murmur form, its own art and abilities. The
biggest and scariest-looking Murmur form by far and the most powerful thing on the map: a lone warbot squad or a few
turrets can't kill it; it takes a real army (20+ warbots with Bulwarks, Howitzers, Torches) or a megastructure, a
Missile or a nuke. Bigger than a Command Base, towering in silhouette; it breaks Walls and turrets easily and shrugs off
small arms. Heavy crystal plating, a glowing maw or core, the ground cracking under it, a strong night glow and light
pool, dust and tremors.

**Lore (LORE.md).** Never "evil", never an alien villain: the deepest, oldest thing the war has woken, grown on decades
of charge from the battlefields ("the war feeds them"). It is not the Deep: the Deep is never seen whole, and these are
seen. Like every Murmur it is never alone: it comes with an escort pack (and in the Hollow, two come out together). It is
built to the art brief: fur, skin, soil and stone only; near-black velvet, eaten Crystal split out as geodes and grown
into plate, spade hands, no eyes, the tendril star.

## What all three share

| | |
|---|---|
| Size | The sprite frame is drawn **6 tiles** wide; the animal is about 4.5 × 3 tiles (a Command Base is drawn 2.4, a Brute 0.82, a warbot 0.6) |
| Hit points | 1,100 to 1,500 (a warbot 12, a Brute 24, a Bulwark 30) |
| Hide | Small arms do a **quarter**: warbots, Bulwarks, Skirmishers, Pulse Turrets, Minigun Nests, Bunkers. Heavy hits do full: Railgunner slugs, Howitzer and Mortar shells, Rocket salvos, Torch fire, bombs, Missiles (60), the Lance of Corvane (400); a nuke kills it |
| What it takes | About 20 warbots with 4 Bulwarks, 4 to 6 Railgunners, 2 to 3 Howitzers and Torches: roughly 40 seconds of fire while it fights back. A few turrets and a squad do almost nothing |
| Walls and turrets | Gone in two blows; a Pulse Turret in one slam |
| Night | Its crystal and core burn; a violet light pool about 8 tiles across (the Bearer's 11) |
| Escort | Never alone: a pack comes up with it, and its own Scuttlers if it carries them |

## When it appears (settled by the owner)

All three triggers are confirmed:

1. **The Hollow: the Deep's mound breaks.** When the mound is almost destroyed (proposed: under 25% of its armor, once
   per game), two burst out of it, one heading north and one south, one at each player's colony; on 3 to 4 player maps,
   one for each colony. Proposed: the mound's own raids stop while they're out.
2. **Late in both campaigns.** Main Campaign Act III (missions 11 to 15, CAMPAIGN.md): the natural home is 14, *The Deep*
   (the mound falls), and 15 as the last threat. Contingency: late in a run, or when the Murmur meter is high
   (CONTINGENCY.md: level-3 territories, and the Hollow assault).
3. **Long ordinary games on Active: a 50% chance, once per game.** **Proposed point:** at the dusk warning of **night 6**
   (the sixth Murmur night, about 70 minutes in: a day is 12 minutes, `TOD_LEN`), one roll from the game's seed, so it
   stays deterministic and the same on every device in lockstep. On a hit it comes on a seeded night from 6 to 8, up
   through an exit of the nest that has grown most, aimed at the colony with the most charge (`chargeWorth`), with an
   escort pack. At most one per game. Never on Quiet; never on Lunar or where no nest stands. (Open: night 6 or later;
   whether a second roll comes much later, say night 12.)

---

## A. The Harrow: the walking siege mound

**Fantasy.** A badger-mole the size of a hill, so old the Crystal it has eaten has grown over its back into armour. It
walks straight at the colony and the ground breaks under it.

**Counters (new):** the colony itself: its roads, track and pipes and the defence lines built across them. Every Accord
standard assumes the ground stays put; the Harrow breaks it.

**Look.** The Brute's build at hill size: a vast barrel chest and shoulder hump, a low wedge head, coarse near-black
velvet. A mantle of banded geode plate over the whole back, split down the spine where a ridge of crystal spires stands
out; the core glows violet-white through seams in the plate; heavy rind plates on the neck, shoulders and flanks.
Spade hands the size of a Hauler. Under the star the jaws hang open on a throat lit violet-white. Its furrow is a heaved
ridge with lit veins, drawn like the tunnels.

**Poses rendered:** walking (key; frames 1 and 3), rearing (the wind-up), the slam (the ground breaking in a ring of lit
cracks, slabs heaved up, dust and clods in the air), dying (rolled over, the light gone, spires broken off beside it),
coming up out of the ground (for the mound).

| Ability | First guess |
|---|---|
| Hit points | 1,400 |
| Speed | Worker speed × 0.45 |
| Melee | A hand: 12 to a robot, 10 armor off a building, every 1.5 s |
| **Slam** (signature) | Every 9 s when 4+ targets are within 3 tiles: rears (1.2 s, the tell), slams. Within 3 tiles robots take 8 and are thrown and stunned 3 s; buildings lose 25 armor; roads, track, pipes and Walls are torn out |
| **Furrow** (passive) | The tiles it walks over (3 wide) lose their road, track or pipe; the path becomes a Murmur tunnel ridge (exits can open on it) |
| Regrowth | 2 HP a second for each Generator, Fuel Station or charger it wrecked in the last minute |

**Counterplay (what it takes to kill it).** A real army in the open in front of it, spread out (the slam punishes a tight
blob): Bulwarks to soak, Railgunners and Howitzers from beyond 3 tiles, Torches on the flanks. Start the fight early with
Howitzers and Rocket trucks; Walls only buy seconds. A Missile, a Bomber sortie, the Lance of Corvane, a nuke; the
Sundering Ray's Quake stuns it 6 s.

**Rival AIs.** It's visible coming: the rival masses every warbot on a rally flag ahead of its path, outside 3 tiles,
Bulwarks in front (`aiBehemoth`, new), pulls its Haulers off the roads in its path and rebuilds the road after it. A
Warden adds Howitzers; a Salvager lets it pass and raids what it broke.

**In the colony's voice.**
- "Seismic contact, surface. Mass exceeds the Command Base. Heading: here."
- "Road segments 14 to 31: not reporting. Rebuilding to passenger standard."
- Tooltip: "The roads were built for buses. It does not use them."

## B. The Maw: the burrowing leviathan

**Fantasy.** Never all above the ground. Only the heave of the soil gives it away, and then the ground in the middle of
the colony falls in and something comes up through it.

**Counters (new):** the colony's foundations. Everything robots build stands where it was put; Walls, turret lines and
distance mean nothing. (The Sapper goes under a wall; the Maw goes under the whole colony, to the richest spot.)

**Look.** A Sapper grown for a century, only its front half ever above the ground: a skull under a wedge of banded geode
rind with a crest of crystal, shoulders plated in rind, spires down the spine, two hands wider than a road gripping
the rim of its crater, the jaws thrown wide under an enormous star on a throat lined with glowing crystal. Moving, it
is a long dome of soil splitting at the head of a ridge as wide as a road, the cracks lit from below.

**Poses rendered:** surfaced (key), moving under the ground (the heave), bursting up (the signature, also out of the
mound), dying (its head down on the rim).

| Ability | First guess |
|---|---|
| Hit points | 1,100 (nothing reaches it under the ground) |
| Speed | Under the ground Worker speed × 0.7; surfaced it does not move |
| **Cave-in** (signature) | Comes up under the place with the most charge in reach. 15 s before: lamps flicker, a ring of cracks, "Seismic contact". Within 3 tiles: buildings lose 60% of full armor (Command Base or Keep 30%), robots take 10 and are stunned 4 s, roads, track and Walls gone |
| Surfaced | 40 s at the crater: a hand sweep every 2 s (10 to every robot within 2.5 tiles), a bite for 15 armor; then down and up somewhere else (at most 3 times a night) |
| Its crater | A tunnel exit (armor 60) until warbots collapse it |

**Counterplay.** Keep an army parked by the Generators and storage at night (it always goes for the richest spot);
pre-aim Howitzers and Mortar Pits there; kill it in its 40 seconds (20 warbots, Railgunners, Torches round the crater);
spread the colony out. The Sundering Ray (Strike the Deep) forces it up early, in the open, stunned 10 s.

**Rival AIs.** Keeps an army at its richest building by night once a Maw is up; at the cracks it pulls robots out of
the ring, then piles in for the 40 seconds; rebuilds a little more spread out.

**In the colony's voice.**
- "Ground radar: one return, very large, rising. Recommend: be elsewhere."
- "Settlement under the Smelter: 2.1 metres. The building was rated for ringfall."
- Tooltip: "Everything we build stands where we put it. It has noticed."

## C. The Bearer: the carrier

**Fantasy.** The naked mole-rat's colony carried on one back: Scuttlers ride in glowing cells and are born as it goes,
and wherever it stands the colony's lights go out as it draws the charge in.

**Counters (new):** charge at scale. The Leech cuts one building; the Bearer drains a whole district (chargers,
Generators, turrets and the robots' own batteries) and turns it into more Murmur.

**Look.** A vast swollen mole-rat, low and wide, short thick legs, a small heavy head and an enormous star; its back and
rump a comb of geode cells cracked open and lined with glowing crystal, Scuttlers curled in them; charge sacs of
stretched skin veined violet along both flanks.

**Poses rendered:** walking (key; frames 1 and 3), the draw (threads of charge pulled in from every side), birth
(Scuttlers climbing out and running), dying (sacs slack, cells dark and empty), coming up out of the ground.

| Ability | First guess |
|---|---|
| Hit points | 1,500 |
| Speed | Worker speed × 0.4 |
| Hide | As the others; Arc Caster lightning **heals** it; Torch fire does half again |
| **Draw** (signature) | Within 7 tiles every colony building is cut as a Leech cuts; Pulse Turrets, Bunkers and Disruptor Towers fire at half rate; robots lose charge 4 × as fast; it regains 3 HP a second while anything in reach has charge |
| **Brood** | While drawing, a Scuttler every 10 s (every third a Leech), at most 12 alive; 6 ride with it from the start |
| Melee | 8 to a robot, 8 armor off a building, every 2 s |

**Counterplay.** Meet it before its field reaches your power; Railgunners and Howitzers outrange it; Torches for the
brood; enough army for two fights at once; no Arc Casters. Turning buildings off does nothing (it drinks what's stored).

**Rival AIs.** Pulls robots out of the 7 tiles while the brood is up, fights from beyond the field with Railgunners and
Howitzers, builds no Arc Casters while one is out; an Architect turns far Generators off and leans on Fuel at its core.

**In the colony's voice.**
- "Charge draw across sector 4. Source: one. Lights out in a ring, centred on nothing we can see."
- "Contacts multiplying inside the dark. Count unreliable."
- Tooltip: "It carries them. The Lab would like to know who carried it."

---

## Recommendation: A, the Harrow, with two borrowings

- **The clearest endgame fight.** You see it coming (its furrow, its light), it comes at you, and it needs an army in
  front of it: the owner's "takes a real army" exactly. The biggest silhouette and the brightest spine of the three, so
  it reads from the camera and on a phone.
- **It suits the confirmed triggers best.** Out of the Deep's mound it walks north and south to each colony, a march both
  players can see and prepare for; in Act III and Contingency it's a set piece; in a long Active game it gives the
  warning a 50% surprise needs.
- **Its counter is new:** no form attacks the roads and track the robots depend on.
- **Borrow from C:** Scuttlers riding in its spine crack, dropping off when it slams (never alone, no extra unit to manage).
- **Borrow from B:** its coming-up: the cave-in and crater when it leaves the mound or a nest.
- The Maw is the most frightening but can feel unfair twice a game (unseen until it lands in your core). The Bearer is
  the richest mechanically but overlaps the Leech and makes a slow, long fight.

## Open questions

1. Which direction (or which mix)?
2. The numbers: 1,100 to 1,500 HP with small arms at a quarter is about 40 seconds for a 20-warbot army with heavy
   support. Harder or softer?
3. The Active-game roll: night 6 (about 70 minutes), once per game. Later, or a second roll late on?
4. The mound trigger: at 25% of the mound's armor? Do the mound's raids stop while they're out?
5. Should a dead behemoth leave something (a crystal hoard, like a nest's, or a crater that stays an exit)?
6. Name: Harrow, Maw, Bearer (none collides with a game term; "bearer" appears only in the relay code's
   `Authorization: Bearer`).
