# Terrafall

A colony and logistics strategy game that runs in the browser, on phones and on desktop widescreens. Your robots land
on a dusty alien planet: gather resources, link them into supply chains with a network of roads, build more robots and
spread across the map. Roads are the heart of the game: Haulers only drive on them, so where your roads go decides
how goods move.

- **Versus:** race a rival AI colony across the planet. Capture its Command Base to win (about 20–40 minutes), or pick a
  faster **Victory** on the new-game screen: **Domination** (hold most of the land for 3 minutes) or **Uplinks** (hold
  neutral relay towers for a total of 5 minutes). A rival that's clearly beaten surrenders.
  The rival is **Settler**, **Pioneer**, **Colonist**, **Commander** or **Warlord** (easiest to hardest; `DIFFICULTY` in
  `js/defs.js`; the keys stay `easy`, `medium`, `normal`, `hard`, so old saves, settings and multiplayer setups keep
  their level, and `warlord` is the fifth: mult 1.6, grace 100 s, threshold 3, 4 sites, thinks every 1 s, 12 more of
  every good; `diffAtLeast(k)` counts it as Hard wherever the code asks for Hard or Normal and up, raids every 90 s
  in `RAID_GAP`). Notes below that say Easy, Medium, Normal or Hard mean those keys: Settler, Pioneer, Colonist and
  Commander. The rival has a **doctrine**
  (Rival doctrine: the Steward, balanced, by default, or Random, the Warden (turtle), Salvager (raider), Herald (rusher)
  or Architect (tycoon); with three or four players one for each rival if you like; see below).
  **Players: Free-for-all · 3** adds a second rival (red and green): a round planet with the three starts 120° apart
  (player 0's third is generated and turned round onto the others, resources placed tile for tile so each third
  has as many). Capturing a Command Base hands over everything its owner built (`eliminate`); the last colony
  standing wins. Standard, Islands, Crater, Plateaus and Sky islands maps (`ffa: true` in `SHAPE_PRESETS`), and The Wheel and
  Three Mesas, which are made for three (`minPlayers: 3`); the green team's
  art is the red team's recoloured at run time (`recolorArt`), and each AI fights its nearest rival (`rivalOf`).
  Standard also takes four (`players: 4`, `std4`): like Passenger Town, the Walking Factory and The Dam, it turns into a
  four-quarter map with four (`quadMap`; a colony in each corner, plain Standard terrain, no `crossShape4`), and stays round
  with three. With four players (Crossroads, Pinwheel, Four Isles, Twin Valleys, Standard and the other maps that take four), **Teams: 2 vs 2** puts the two western colonies
  against the two eastern ones; on **Long Haul 2v2** (made for it: picking it turns Teams on) the two southern colonies
  against the two northern ones (see Multiplayer).
- **Colony:** no rival. Settle the planet at your own pace, with colonization milestones and an optional ladder of
  **Colony goals** (see Colony goals, Records and achievements below). Free play has the full
  building roster, missiles and nuclear silos included, to experiment with, plus the **Research Lab**.
- **Horde** (Custom Game, Mode: Horde; alone or co-op in multiplayer, below; `HORDE` in `js/defs.js`, the Horde section of `js/sim.js`,
  `hordeTopLine`/`hordeObjective`/`showHordeOver` in `js/ui.js`): pure survival on **Long haul** (locked; Large by default).
  A Colony game underneath (`opts.horde: { level, goal }` → `S.horde`), with no nests and no nightly tunnels: at the far
  end (the absent colony's landing spot) **the Maw** (`BDEFS.maw`, armor 600, a nest for `isNestB`: guards, alarm, and
  `deepSurgeTier`'s bursts as it cracks) with four huge tunnel mouths (`burrow`s with `b.maw`, dug open again each wave).
  A countdown between waves (`hordeGap`: `levels[k].gap` [first, less each wave, least]) on the top bar ("Wave 7 in 1:40 ·
  23 up") and the Goal card (what's coming, new kinds marked). Waves are **cumulative** (`hordeWave`): each kind joins at
  its wave (`kinds`: Scuttlers 1, Brutes 4, Leeches and Spitters 7, Sappers 10) and stays, growing (`base + per × (n −
  from)`, times the level's `mult` and `1 + ramp × (n − 1)`, capped per kind by `cap`, except on Warlord, `uncapped`: its
  waves grow without end, about 330 by wave 20, 650 by 30, 1,100 by 40); every 5th is a boss wave (× 1.25, led by a
  Harrow whose health grows with the wave, `hordeHarrowHp`; two from wave 15 on Commander and Warlord). The queue
  (`S.horde.q`) comes out of the mouths a few at a time (`hordeSpawn`, every `pace` s), at most `room` (110) up at once,
  at most `queueMost` (400; a level's `queue`, Warlord's 1,500: `hordeQueueMost`) waiting, and any more held over in
  `S.horde.over` (counts by kind, `hordeHeld`) to join the next wave's queue, never dropped;
  down three lanes of waypoints (`hordeLanes`, `hordeMarch`); from wave 8 side tunnels open on the flanks partway down
  (`hordeSide`, `side.share` of each wave). The waves route through Walls, Gates, Outposts and Keeps (`routeOpts` breach)
  and bite through them (`hordeBreach`); Spitters go for guns (`murmurSpitStep` with `t.p`), Sappers dig under the first
  defences they meet, Leeches drink a Fuel Station or Generator (`hordeLeech`). A wave cleared drops salvage crates by the
  front line (`hordeSalvage`). Lost when the Murmur batter the Command Base to `fall` (it takes `baseTakes` of their
  blows; a Harrow's floor for it is `fall` too). Won by clearing wave `HORDE.waves` (Fixed) or wrecking the Maw
  (`hordeMawDown`); Endless (and Warlord, always) never ends on the count, and the best wave per level is kept on the
  device (`terrafall.hordeBest`, UI only). A computer-run colony in Horde builds guns and an army (`S.horde` in
  `js/ai.js`). `node tools/horde-test.js [level] [minutes] [seed] [fixed|endless] [--noai] [--fort] [--pair]` plays one headless.
  **Co-op Horde** (multiplayer; `mpHordeSettings` in `js/mpui.js`, the host's Waves and Goal as `settings.horde`, newGame's
  `opts.horde.pair`/`crew`): **side by side** (`pair`, the default for two): the host and the first partner each run a
  colony, allies (`S.teams` [0, 0, 1, 1]) in the south-west and south-east places of **Long Haul 2v2**, the other two
  places empty, the Maw midway across the north end; the Murmur take their own slot (`S.wildSlot`, as in Versus, player
  1 being a colony). `S.horde.ps` [0, 1], `HORDE.lanes` lanes per colony across its half (`H.laneP`: whose), the queue
  spread over all of them, a boss wave's Harrows one per colony (`hordeLaunch`), messages to both (`hordeSay`), salvage
  per colony (`hordeSalvageAt`, only to colonies standing); a Command Base battered down while its partner's stands is
  **down** (`hordeFall`, `FALLEN` below: watching, its robots idle, the waves still at it) and back once the partner's
  armed warbots hold the ruin (`hordeRetake`); lost when **both** are down (`H.lostP`, `H.falls`). Waves × `HORDE.pair.mul` (1.8; the
  kinds' caps too), `pair.room` (160) up at once, the Maw's guards × `pair.guards`. **One colony together** (the host
  taps the partner across: shared colony co-op, `S.crew`, on Long haul): waves × `1 + HORDE.crew.per` (0.3) per extra
  person, at most `crew.most`. Further people in the lobby share the host's colony. `S.horde.mul` (saved, checked) holds
  the scale (`hordeWaveNow`); `hashState` covers the waves. `node tools/horde-lockstep-test.js [pair|crew|teams|both|all] [minutes]`
  plays co-op Horde (and `teams`, a 2 vs 2 game of two people) on two headless devices through a stand-in relay, both
  giving orders, with a reload and rejoin, and checks their fingerprints every second; `pair` and `teams` also play out
  a fallen ally on a script (fall, refused orders, help command, a reload while down, the retake, own orders again; Teams:
  both fall and the team loses). `node tools/horde-test.js ... --pair [--fallonly]` checks the same headless first.
- **Fallen allies** (`FALLEN` in `js/defs.js`; the "fallen allies" section of `js/sim.js` after `eliminate`): in a game
  with teams (`fallTeams`: `S.teams`, not a mission or a Contingency battle) a colony whose Command Base falls while a
  teammate stands (`teamStands`, `canFallDown`) is **down**: `P.out` as any fallen colony plus `P.down` `{ t, by }`
  (`isDown`). `applyOrder` takes no order from an out colony (but `rivalDifficulty`). **Teams**: `eliminate` (a capture,
  not a nuke or surrender) hands everything to the captor as ever, but marks each building `b.was` (the base too, at the
  captor's already) and leaves the colony's roads, pipes, lights and overpasses its own (plans dropped); a computer
  captor keeps `FALLEN.prizeKeep` warbots in the base (`keepW`). A teammate capturing that base back (`captureBuilding`)
  calls `reinstate`: every building marked its own still standing comes back from whoever holds it, the base at
  `FALLEN.armor` of its armor, and `FALLEN.crew` robots step out (`FALLEN.hordeCrew` in Horde), with `FALLEN.goods` in its store. **Horde** (side by side): `hordeFall` (the base stays
  at `HORDE.fall`, the colony keeps everything: dispatch skips an out colony, so its robots idle; guns and warbots still
  fight), `hordeRetake` once a second: a partner's armed warbots within `FALLEN.retake.r` of the base and no Murmur that
  close fill `b.hRet` (`b.hBy` whose; `secs` s; Murmur stop it, nobody runs it back `decay` a second), drawn as a ring
  (`drawFallenBase` in `js/render.js`; in Teams a pulsing ring in the fallen colony's colour round its held base). The
  team loses only when the last stands no more (`teamFallen` clears the others' `down`; `eliminate`'s end check counts a
  down person as still in). **Help command** (`ORDERS.lend(p, q, on)`, only from p's own people): the fallen colony's
  `P.help` = the survivor's; `mpOrderCol` (`js/lockstep.js`) sends a person's orders to the colony they help, and
  `fallenTick` (`js/mpui.js`) switches that device's `ME` to it (and back when they're back or it's taken back: the
  banner's button, `fallenBanner`). A down person's device still rejoins after a drop. AI (`js/ai.js`): a fallen
  ally's base held by the enemy scores first in a rival's attack and march choice; in co-op Horde `aiRetakeRuin` sends
  armed warbots to hold the ruin. UI: the banner, the Goal card's `fallenGoalLine`, the Horde top bar, the body's
  `fallen` class (no build bar or panel buttons). `P.down`, `P.help`, `b.was`, `b.hRet`, `b.hBy` are in `hashState` and
  `checkSave`; the log's `back` event is in the end report.
- **The Murmur** in every game (the setting **The Murmur**: Off, Quiet or Active, Active by default, never on Lunar):
  native creatures, nobody's side, whose nests sit out in the wilds and whose tunnels spread toward power every night,
  packs coming up through their exits to raid every colony alike (see The Murmur below).
- **Missions:** the tutorial campaign (`MISSIONS` in `js/missions.js`): hand-picked planets, each with its own goals
  and Easy, Normal and Hard levels, that teach the game one idea at a time in seven chapters, in order: **First Steps**
  (a building and its road, Stone and Cement, batteries, the first Alloy), **Growing the Colony** (ending with *Rain*, an Atmosphere Engine), **Roads and
  Traffic** (including **Arterial**, an Express pair with on-ramps and Freight Truck deliveries), **Industry and Trade**, **Sea and Sky** (all Colony games, so the economy is learned in peace), then
  **First Contact** (the Murmur's nests, their cavern lair the Hollow, their craft, other forms and hunt on Active (*What Comes Up*), terraforming under an endless dust storm and in the Bloom (*Seed Vault*, *Under the Bloom*), a passive rival, stripping Passenger Town for salvage past its old sentries (*Passenger Town*), a dam to shore up and a rival's to burst (*The Dam*), a border war, a chokepoint against a Herald, and the Sundering Ray striking the deep under a colony the tunnels have reached and holding the night the Murmur answer (*Something Keeps Time*), and the Harrow brought down by an army before it reaches the Generators (*The Harrow*)) and **War** (Ammo and
  repairs, trade convoys, escorts and convoy raids against a Salvager, Torches, Bulwarks and missiles against a Warden, the Nuclear race, the megastructures (*Aimed the Other Way*: a Shield Dome, Arrival City and its bonus, the Orbital Lift (a drop called down, a load sent up), the Lance of Corvane, one shot down a row of depots), a greened valley held against a Herald's Torches (*Landing Zone*), a Steward's Storm Front over your base broken and one sent back (*Overcast*), the Uplinks, and the final assault with Keeps and bombers). **King of the Hill**, just before **Final Descent**,
  is an Uplinks race for three on The Wheel against two rivals of random doctrine (Normal ones on Hard; `victory:
  'uplinks'`: missionOptions sets `S.victory` and calls `placeUplinks`; goals: hold an Uplink, hold two at once, win
  the race; a rival winning it loses the mission with `M.why = 'uplinks'`). All of them are open
  from the start. Missions have the rivals' five levels, Settler to Warlord (`MISSION_DIFFS` is `DIFF_ORDER`; a
  mission's `diff` is its index, Colonist the default); values tuned on the old three levels stay written
  `[Settler, Colonist, Commander]` and `mPick` reads them for five (Pioneer between the first two, Warlord half a step
  past Commander, a rival level up; a five-long array sets each level), `mLimit` the clock (Pioneer has Settler's,
  Warlord Commander's), and the Command Base starts with ×1.5, 1.25, 1, 0.75 or 0.6 of its goods. Finishing one ticks it
  off at that level (saved by its `id`, so a reworked mission keeps its ticks; `loadCampaign` moves ticks from the old
  Easy, Normal and Hard onto Settler, Colonist and Commander once, marking the save `lv: 5`, and a game saved in a
  mission before then loads at the matching level, `lv5`), and the list marks the first unfinished one **Next up**. A mission is plain data: `chapter`, `brief`, `intro`
  lines for the briefing card, the planet (`seed`, `size`, `rough`, `biome`, `shape`, `players`), the rival (`rival`
  level per difficulty, `style`, `rivalBonus`, `passive`), `limit` (minutes per difficulty), switches for what
  missions otherwise leave out (`war`, `lab`, `events`, `wildlife`, `nuke`), `pressOn` (the rival's trade convoys keep to
  schedule whatever comes: Convoy's), `layout(m, W)` to edit the generated map
  (`placeField`, `placeFertile`, `mapTiles`, `mirrored`), `setup(S, diff)` and up to four `goals`. Built-in goal kinds
  count buildings, goods made, bots made or owned, road tiles, one-way tiles, lights, land, Outposts and the capture;
  any other goal counts itself with `count(P, S)` and its own `text` (bridge tiles, a Ramp up a ledge, research done,
  trades, nests cleared, minutes held, a nuclear launch). Each goal's `hint` names the real buttons and keys and its
  `ui` selector lights up the button it needs (`missionCoach` in `js/ui.js`; with `at`, a ring pulses on the building
  whose panel holds it: a type, or a function naming the very building or robot, or `{ e, ui }` with the buttons for
  that step, as Airlift's Crawler and Harbour's two Ports; a hint that says "Trade Post" rings the nearest post). Steps already taken stay dark (Build while its menu is open, the card while placing that
  building: then **Build here** lights, as Paths' **Build** does once a sketch is drawn), a lit button below the fold of
  a panel is scrolled into view once, and a `built` goal whose site is already going up (`goalSites`) says to wait for
  it, or to **Lay road** to a site with none (`siteNeedsRoad`), instead of asking for another (its own `wait` text if
  it has one). From the second mission on, setup puts down the colony the earlier missions taught:
  `kit(S, types, workers)` builds each type where the rival AI would (`aiFindSpot`), finished and road-joined (`KIT6`:
  Harvester, Quarry, Cement Works, Fuel Station, Ore Mine, Crystal Tap, Smelter, Chip Fab, Bot Foundry; `KIT7` adds a
  Bio Farm, `KIT8` a Grove Planter, from Pipe Dreams on, so the Smelter doesn't burn the Harvester's groves dry; an
  Agribot comes for each Bio Farm and Grove Planter past the one you land with), and `preBuild` puts down one building where the mission wants it; custom goals count tiles with
  `ownTiles(test)`. Goals once met stay met (`M.got`) unless they say `hold`. **Capture lock:** while any goal other
  than capturing the rival Command Base is open, that base holds at 1 armor against you (`captureLocked`, applied in
  `hitBuilding`; its panel says to finish the other goals first), so winning too soon can't lose a mission.
- **Contingency** (`js/contingency.js`, the engine; `js/contingency-ui.js`, the screens; CONTINGENCY.md, the plan): a
  replayable campaign on the globe of Ithaca I, opened by the main menu's **Contingency** button (`openContingency`, the
  one way in, for the menu's Campaigns area to take over). One turn is one year on the Arrival clock, T+1 to T+31. The
  atlas is `js/contingency-atlas.js`, written by `tools/atlas/contingency_table.py` from what `tools/atlas/atlas.py`
  leaves in `tools/atlas/out/` (run atlas.py first): 28 territories (`CONT_TERR`: id, name, region, lon, lat), the land
  borders where atlas cells touch (`CONT_LAND`), the sea crossings (`CONT_SEA`, CONTINGENCY.md's table, plus the Shoals'
  own channel), the way down to the Hollow from Violet Reach (`CONT_BELOW`), orbit from Pathfinder's Landing to Argos
  (`CONT_ORBIT`; an Orbital Lift adds its own) and a 256 × 128 territory map of the globe (`CONT_CELLS`, run-length
  rows). **The engine** keeps the whole run in one plain object (it is the save) and rolls only from its own seeded
  generator (`contRand`: mulberry32, its state `run.rng` in the run; lint treats it as a simulation file), so the same
  seed and choices replay exactly. `contNewRun(opts)` deals it: your callsign (side 0) and the other three with doctrines
  (random and different, or set), resources per region (`CONT_REGION_RES`), the fifth Uplink (four are fixed: Northcap,
  Stillwater, Lantern Reef, the Lunar Relay), four homes at least three borders apart (fortified to 2), two 1-star
  Command Groups each, the Murmur at 2 in the Bloom, 3 in the Hollow and 1 under every surface Uplink. A turn's phases
  (`run.phase`): `plan` (income in, `contBuyGroup`, `contFortify`, `contBuyRefit`, `contBuyCard`, `contUseCard`,
  `contOrder`, truce offers `contOfferTruce` / `contAnswer` / `contBreakTruce`), then `contEndTurn` (the rivals spend
  and order, `contAiPlan` by doctrine in `CONT_AI`; all moves at once, `contMoves`; a battle for every contested
  territory), `battles` (yours wait for `contAutoResolve` or `contBattleResult`), `murmur` (`contMurmurSpread`:
  spread into unguarded neighbours at `CONT.spread` × the meter, growth on unheld ground, surges from level 3 and at a
  transmitting side's Uplinks), `surges`, and `report` (`contYearEnd`: megastructures act, truces run down, the next
  year's event, the win checks `contCheckWin`, the report in the log voice `contReport`); `contAdvance` moves on until
  the person has something to do. Auto-resolve (`contOdds`) weighs each side's strength (`contPower`: kit warbots by
  rank, Heavier Kit, fortification ×(1 + 0.15 a level), home, cold or island or lunar ground, an ally next door,
  refits, supply lines, a battle card, the difficulty for rivals and `CONT.playedEdge` 0.92 for yours) to the power
  2.2. Saving: `contSave` / `contLoad` (JSON with an FNV checksum and a shape check: a corrupt save is refused), kept
  as **campaigns**: up to `CONT.slots` (5) runs on this device, each under `terrafall.contingency.slot.<id>`, with an
  index (`terrafall.contingency.slots`: the active campaign, and a line each: seed, callsign, difficulty, year,
  territories, Ironman, a battle under way, last played; `contSlots`, `contSlotInfo`). `contStore` and `contRestore`
  work on the active campaign (`contSlotUse`, `contSlotNew`, `contSlotDelete`, `contSlotRun`); the old single save
  (`terrafall.contingency`) becomes campaign 1 the first time the index is read. A battle's match carries its campaign
  (`S.contingency.slot`), and `contBattleOver` makes that campaign active again (or the one with its run's seed) before
  the result goes back. The match saves in the normal game save; when another campaign's battle would overwrite one
  there, `contPlayBattle` keeps it beside its campaign (`terrafall.contingency.slot.<id>.battle`) and puts it back when
  that campaign plays on (`contBattleWaiting` shows Resume). Files: `contFileText` / `contFromFile`
  (`{ terrafall, kind: 'contingency', save }`; an Ironman campaign is never written to or read from one). **The
  Campaigns screen** (`cgSlotsSheet`) is the first sheet `openContingency()` shows (the new-run sheet when there are
  none; `openContingency(true)`, after a battle, goes straight back to its campaign): Continue, Delete (confirmed), Save
  to file, New campaign (`cgReplace` first when every slot is taken), Load from file (`#cg-import-file`, `cgImport`);
  the globe's top bar has **Campaigns** (`#cg-camps`, `cgToCampaigns`). Headless test: `lh/cg-slots-test.js`. **The screens** draw
  Ithaca I as a planet seen from orbit (`js/contingency-draw.js`, only when something changes; turned by drag, swipe,
  wheel or the arrow keys): over the stars (`#cg-stars`), a WebGL canvas just round the globe (`#cg-gl`, `cglRender`:
  one fragment shader samples `art/globe/ithaca-2048.webp`, or `ithaca-4096.webp` once the globe is over `CGL.hdAt`
  device px across, for a soft terminator from the upper-left light, the sea's glint off the picture's land mask, the
  clouds, the haze at the limb and the halo; at `CGL.moveDpr` while it turns, sharp again when it stops); without
  WebGL, on a software renderer (`WEBGL_debug_renderer_info`: SwiftShader, llvmpipe...), when the first
  `CGL.slowChecks` full draws average over `CGL.slowMs` (50 ms), or from a page opened as a file, the globe is shaded
  per pixel instead for the rest of the session (`cgDraw2d`: the same 2048 picture and clouds read as pixels, up to
  `CGL.flatMax` px across, `CGL.flatMove` while it turns, made again only when the view or tints change). The clouds
  are a layer of their own drifting slowly east over the ground (`cglCloud`: `CGL.cloudDrift`, a lap in about 18 minutes,
  by the page's clock, still with reduce motion on): in WebGL only `#cg-gl` is drawn again, each `CGL.cloudStep` device
  px of drift (at most every `cloudMinMs`); per pixel the shaded planet is kept without them (`CGS.f2`) and they are laid
  over it again (`cglClouds2d`) every `flatCloudMs` at most, `flatCloudRows` rows a frame, so no frame takes long. Each
  owner's territories are tinted (a soft fill, stronger at the edge, painted onto a 1024 × 512 picture of the globe by
  `cglTint` when owners, the pick or the targets change) and outlined in their colour with a dark casing, the picked
  territory in white and the move or weapon targets in yellow (dashed for a weapon), and the borders on land are thin
  pale lines, a little stronger between regions (`cglLines`): all smooth lines from `js/contingency-globe.js`
  (`CONT_RINGS`, `CONT_BORDERS`, written by `tools/atlas/globe_borders.py`), and a tap picks the territory whose
  outline holds it (`cglPick`). Markers for Uplinks, homes, groups, forts and the Murmur, Argos as a little cratered
  moon beside it (`cglMoon`) with its two halves, and the orders as arcs; a group is moved by Move and a tap, or by dragging its
  pill (or its territory's marker) onto a neighbour (`cgDown` picks it up, `cgUp` gives the order); a territory card (`cgCard`), the Spend panel, the battle
  card (its odds, a battle card to play, Play or Auto-resolve), the year report, offers, the end, and the new-run
  screen (callsign, difficulty, Advanced: doctrines, Murmur, events, turn cap, Ironman, seed). **The layout** (the
  Command Deck look: ART_GUIDE.md, "Command Deck interface"; its CSS is the Contingency block of `style.css`): the top
  bar (`#cg-top`, filled by `cgSync`: callsign, Arrival clock with "ends T+31" when the turn cap is on, Reserve and its
  income a year, the Uplinks as five diamonds `#cg-uppips`, the Murmur meter as 20 segments `#cg-meter`) and the foot
  (`#cg-foot`: Spend, Report, the orders listed by group in `#cg-orders`, the year and phase `#cg-phase`, End turn) are
  glass panels; the territory card docks on the right (a sheet across the bottom under 760 px). `cgSheet` gives
  `#cg-sheet` a class per kind (`cg-sheet-spend`, `cg-sheet-battle`...); Spend and the report (`CG_DOCK`) dock on the
  left from 1000 px (`cg-dock`), and `cgResize` centres the globe between the docked panels and sets `--cg-top` and
  `--cg-foot` for the CSS; `cgFlags` marks which columns are taken (`cg-carded`, `cg-docked`) so the walkthrough and
  the weapons strip go in a free one. The battle card sits under its territory (`cgPlaceBattle` turns the globe so it
  is just above the card), ringed in red by `cgReticle`; `cgBezel` draws the orbit ring with the view's centre. The panels
  wear the player's callsign colour (`--c` on `#screen-contingency`). The campaign theme plays
  at Contingency's place in the story (`MUSIC.loreLevel`). **The bridge to battles** (`js/contingency-battle.js`):
  `contBattleSetup` (engine) turns a battle into a setup: the region's biome and a map type from `CONT_REGION_SHAPES`
  (a free-for-all one for three sides), Small or Medium (Large at a home), a 25-minute cap (35 at a home), Uplinks
  victory on an Uplink territory, the Murmur at the territory's level (Colony mode, held until dawn, `TOD_LEN`: 12 minutes,
  when the Murmur are the only enemy, a surge too; the Hollow on its own map, won by its mound), the seats (you first) with
  their warbots, rank, refits and supply lines. `contPlayBattle` starts it with newGame (`contBattleOptions`: `setup`
  lands each kit with `contKit`, builds the defender's turrets, Keep, Mortar Pits and megastructure with `preBuild` at
  `aiFindSpot`, its line of Wall (`contWalls`) and its Shield Dome site (`placeSite`), and sets `S.contingency`: the run and battle, the seats' sides, the cap, the hold, the defender's seat,
  and `look`, each seat in its callsign's colour, which `lookTick` applies); `contBattleCheck` runs from `simStep` every
  30 ticks (the cap scored on land held, a close count going to the defender; the hold; the Hollow's mound; the Harrow
  six minutes in where the Murmur are at full strength late in a run). `showGameOver` hands a Contingency battle to
  `contBattleOver`, which sends the winner, its warbots left, a megastructure it finished and the fortifications
  standing to `contBattleResult` and returns to the globe; **Withdraw** (`#p-withdraw`, `contWithdraw`) is a loss with a
  retreat. The battle saves as any game does; its battle card's Play (or Continue) resumes it (`contSavedBattle`).
  **Cards in a battle** (plan stage 4): `S.contingency.hands` (each seat's in-battle cards, `CONT_IN_BATTLE`: Orbital
  Drop, Called Ringfall, Corvane Flare, the one played on the battle card first), `used` and `pre`, validated by
  `checkSave`; played through the order `contCard` (js/orders.js → `contPlayCard`: 6 warbots on open ground round the
  spot, five `meteorImpact`s round it, or every rival robot's battery down to 20), the computer's from `contAiCards`
  (the Flare at 4 minutes, the Drop by its base at 5, the Ringfall on its foe's at 7). Road Standard lays road from the
  base toward its nearest Stone and Ore at the start (`contRoadStandard`); Foundry Surge doubles the seat's Foundries'
  work for 5 minutes (`contWork`, in `produce`); a flare year starts everyone's batteries at 40. The bar (`#cg-bar`,
  `contBarTick` from `uiTick`) shows the clock and the cards; Drop and Ringfall aim at a tapped tile (`#cg-aim-pad` over the map: a drag still pans) or at the
  crosshair in the view's middle (Here, `#cg-aim`). Sealed Research seals one Research Lab upgrade, picked when it's
  fitted (`side.sealed`, set done on the seat's player in `contKit`); Torch Doctrine makes that seat's Torches do ×1.5
  to the Murmur (`contTorch` in `torchFire`). In a battle against the Murmur alone the top bar's clock reads the time to
  dawn and the nests left, or the Deep's mound (`contTopLine`).
  On the battle's end the cards played leave the run's hand, and a battle-card one unplayed goes back.
  **Ironman** (`run.opts.ironman`, carried into the match as `S.contingency.ironman`; `contIronman`, `contIronmanSave`):
  the battle keeps only the autosave for Continue: `checkpointTick` writes no restore points, `showCheckpoints` offers
  none and `restoreCheckpoint` refuses one, `canSaveSlot` and `cloudCanSave` say no, File and Slots are hidden in the
  pause menu (which says why: `CONT_IRONMAN_NO`), `loadSlot` and `loadSaveText` refuse an Ironman battle's save, and a
  battle begun can't be auto-resolved instead (`contAutoResolve`).
  In a battle the goal card says what wins it (`contObjective`, from `objectiveText`; `objectiveStep` gives no Colony
  steps) and a battle against the Murmur shows no Colony milestones (`checkMilestones` is skipped); clearing every
  nest wins one, as does the hold.
  The first turn of a run shows a four-step walkthrough (`cgCoach`, `#cg-coach`: turning the globe, moving a group,
  Spend and the Uplinks, End turn and the battles), moved on by Next or by the first order, ended by Skip or End turn
  and remembered on the device (`terrafall.contingency.coach`). The main menu's Campaigns card reads the line of the
  campaign last played from `contingencyMenuLine()` ("Year T+7 · COBALT · 11 of 28 territories · 2 Uplinks · 3 campaigns").
  A kit's warbots come in waves (`CONT_WAVES`): 4 with the base (6 for the defender), the rest half at 3 minutes and
  half at 6 (`S.contingency.waves`, `waveN`, checked by `checkSave`), so a high rank doesn't flatten a landing in the
  first minutes. Battle length: `lh/contingency-length-test.js` plays battles through the bridge with the computer on
  every side (autoplay) and reports how long each lasts.
  **The Murmur in play** (stage 5): a surge is a Colony-mode battle with the Murmur at least Active, held until dawn
  (one turn of the day, `TOD_LEN`, the night last); the Hollow assault is played on the Hollow map, won when the
  Deep's mound falls, and when the mound's own Harrow bursts out (`harrowMound`, under `HARROW.mound` of its armor)
  `contBattleCheck` sends its twin the other way (`S.contingency.twin`); the Harrow comes up six minutes into a
  full-strength battle late in a run or with the meter at 60+ (`spawnHarrow` at the nest nearest your landing).
  Headless test: `lh/contingency-murmur-test.js`.
  **The writing** (stage 7, LORE.md's log voice; `contReport`, `contEnding`, `CONT_EVENTS[k].line` the forecast and
  `.now` the year itself): a report runs the year's event, then headed parts ('§' lines: our lines, long-range
  listening, open channels, standing), next year's forecast and the odds of contact. The ending: "Ithaca I secured for
  the Sponsor. Awaiting colonists. Arrival clock: T+n. Probability of contact: x%. Still counting." (0.2% at T+31),
  "Reserve exhausted. Carrier dark.", or the rival that speaks for Ithaca I; each beaten rival's on-defeat line (its
  doctrine's `voice.surrender`); the run's numbers. Nothing names Earth's fate (`lh/contingency-test.js` checks).
  **Megastructures on the globe** (stage 6, `contYearEnd`, `contIncomeOf`, `contFortOf`, `contPower`, `contUseCard`,
  `contMovesFrom`, `contCardCost`, `contMurmurSpread`, `contUplinks`): the Lance strikes an enemy territory two
  borders away every 3 years (−1 fortification, its groups −1 star); the Sundering Ray quakes a neighbour every 2
  (−1 Murmur, or −1 enemy fortification). Yours are aimed in the Spend phase (`contWeaponReady`, `contWeaponTargets`,
  `contAim` into `run.aims`, checked by `contValid`; `cgWeapons` and `cgPickTarget` on the globe, the range lit by
  `cgTargets`, the aim a red arc); Skip, a pick no longer in range, or a rival's weapon uses `contWeaponAuto` (the
  most fortified target; the Ray the Murmur first); the report logs the shot (", as ordered"); the Shield Dome turns enemy cards and both
  weapons away and adds a star's warbots to its defender; Arrival City +3 Reserve and fortification 3; the Orbital
  Lift launches to Argos and back and halves Orbital Drops; the Atmosphere Engine +1 here and in your neighbours,
  −1 in a rival's, and stops the Murmur spreading in; the Deep Core +3, and +1 Murmur next door each year; the Great
  Uplink counts twice. One finished in a played battle is kept (`contBattleOver` → `contSetMega`) and built at the start
  of the next battle there; taking the territory wrecks it, unless the winner seized it in a played battle
  (`contBattleOver`'s `keepMega` → `contTake`): then it carries over intact. Headless test: `lh/contingency-mega-test.js`.
  **The atlas's landmarks** (`js/landmarks.js`; LORE.md, The atlas): a battle in a territory with one (`LM_AT`,
  `contLandmark`) gets it from its setup, before the kits land (`lmSetup`): outward from the middle of the line between
  the sides (`lmMiddle`) to the first spot where its tiles are open ground clear of everything (posts, Uplinks, nests,
  roads, tides, lava, tunnels), what blocks the way on level ground with a ring of open ground round it, 7 tiles from
  every base (then 5, then a compact shape: `lmShape`'s `small`), and every tile either base reached before is still
  reachable (`lmReach`); deterministic from the map and the battle's seed. `S.landmarks` (`id`, `x`, `y`, `v`, `solid`
  rock under its art, `area` nothing built: `lmNoBuild` in `canPlace` and `canRoad`, `water`, `rock`, and a geyser's `on`,
  a wreck's `hatch`, `hold`, `got`) is saved, checked (`lmCheckSave`) and hashed. Solid tiles are drawn as the ground
  under the art (`pillarAt`). The pieces: the Pathfinder's hull (5 × 2, blocks), Passenger Town (8 houses on a street,
  or 4 in the compact one; its lawns the garden's deer graze: `lmGarden`; the welcome sign lit at night), the Ring
  Shard Spire (3 × 3, blocks; Crystal round its foot at `LM_CRYSTAL` 1.5×), the Long Falls (a 5 × 2 cliff of rock, its
  pool and stream, which can be bridged), the Stone Forest (pillars never side by side; robots among them take
  `LM_COVER` 0.75 of the damage: `lmCover` in `damageBot`), Glass Lake (ice: crossed, not built on), the Clock Geyser
  (`LM_GEYSER`: from 45 s, every 90 s for 8 its vent turns to rock, `terrainChanged`, and robots within a tile and a
  half are scalded 4 a second and pushed off the vent: `lmTick`), the Breach Fields (shafts, blocking), Silent Crater
  (Argos: a floor not built on, its peak blocks), Ledger Post and Spring Market (the Trade Post nearest the middle,
  named: `lmPostName`), and three wrecks (3 × 2, the hatch below): one of your robots within a tile of the hatch for
  `LM_WRECK_HOLD` (20) s recovers its log (`got` 1; `lmUiTick` opens it, `lmKeepLog` keeps it for the Lore guide's
  atlas page, `#lore-logs`); `contBattleOver` puts it in `run.logs` (checked by `contValid`) and the year's report,
  won or lost, and a later battle there has `got` 2. Hover or tap: `lmSheet`; the names in faded atlas lettering zoomed
  out and over the one hovered (`lmLabels`). Art: `lm-*` keys, loaded only in a battle with a landmark
  (`ensureLandmarkArt`; one-file: `dist/landmarks.js`), ART_GUIDE Batch 32. Headless test:
  `lh/contingency-landmark-test.js`.
  Browser test: `lh/contingency-bridge-test.js`. Headless test: `lh/contingency-test.js` in the test kit (50
  whole runs auto-resolved, determinism, saves).
- **Observer mode:** the computer plays every colony (two to four, each with the doctrine you pick, with Custom Game's map,
  victory, level, rules and challenge options) while you
  look on at up to 8×, with a scout report on what each is doing and a camera that follows the fighting; nothing is
  saved (see Observer mode below).
- **Scout reports:** in your own games, a message now and then on what a computer rival is up to (massing for a push on
  your east Outpost, a band heading for your north road, a storm forming), once as it starts, with Go to the place.
- **Blueprints** (off by default; pause menu → Settings → Blueprints): keep a block of your buildings and the roads between them on the device, and place it again elsewhere
  with a ghost that turns; every site and road is planned at once.

Before each game, the new-game screen picks the mode, players and rival, the **map shape** (Standard, Long haul,
Chokepoint, Islands, Crater, Plateaus, Sky islands, Rift, Ring valley, Oases, Crossroads, Lakes, Tidal flats, River delta,
Volcano, Fault line, Canyon maze, Grand Canyon (two players; `grandCanyonShape` in js/world.js), Passenger Town (two to four players; `townSetup` in js/world.js), The Walking Factory (two to four players; `walkerSetup` in js/world.js), The Dam (two to four players; `damShape` in js/world.js), The Ring (two players; `ringMap` in js/world.js) or The Hollow, and for three or four players only The Wheel, Three Mesas, Pinwheel, Four Isles, Twin
Valleys and Long Haul 2v2: cards in groups, each with a sketch and a line on it) and the **map size** (Small through
Planetary). On Standard, Huge is 60×84 tiles, Immense is 84×118, and Planetary is 120×168. Planetary supports up to
two colonies, including solo Colony play. Long and wide shapes preserve their proportions within the 20,160-tile
Planetary budget. Matches with three or four colonies can use Immense.
With Planetary events enabled, Immense Ringfall targets up to nine sites per colony's share, and Planetary up to
eleven (six at smaller sizes). On Immense and Planetary, rivals allow extra time for long marches. With a fixed map
type and surface biome, the optional **Second biome** blends ground textures and plants along a winding transition.
The primary biome covers about 65% of the land and sets weather and world rules. Argos and the Hollow use their own
scenery (The Ring is always on Argos's, whatever the Biome setting). The second biome also travels with saved planets and multiplayer setups. Oases has five oases per side at
Immense and seven at Planetary. Immense Four Isles has larger home and central islands. The Hollow has richer Ore
and Oil deposits at the two largest sizes, and up to ten nest sites per side at Planetary. **More settings** (a collapsible section, its summary listing whatever isn't the default) holds the planet
number, the **biome** (named for its region of Ithaca I, `BIOMES[k].name`, with its kind of ground under it, `kind`: the
Rust (red desert), Greenreach (forest), the Polar Caps (polar snow), Emberwood, the Long Grass, Blackwater, Cinderlands, Steamwells (geothermal basin), the Shoals (tropical islands), the
Bloom and Argos, the moon; scenery only, with plants that roads and buildings clear), the
**terrain** (Flat, Gentle, Rolling, Rugged, Mountainous), the **resources** (Scarce to Abundant; Normal is
`RESOURCE_PRESETS` density 0.78, amount 0.8, which was Sparse until everything was lowered a notch: older saves,
saved planets and missions move up one, `resLevelUp`), the **rival doctrine** (one for all, or one for each rival),
and switches for the **Nuclear race** (on by default), **Megastructures** (on by default: the Lance of Corvane, the Sundering Ray, the
Shield Dome, Arrival City, the Orbital Lift, the Deep Core, the Atmosphere Engine and the Great Uplink; `S.settings.mega`, `megaOn`; missions keep their own, `mega` in a mission; a save from before it loads with them off), the **Great Uplink win** (beside Victory, off by default, Versus only: a second way to win alongside any Victory, teams too; greyed out without Megastructures or on the Hollow; `UI.menu.upwin`, `S.settings.upWin`, `gupWinOn`; carried in the lobby's and lockstep's settings and in Observer mode; a mission's `upWin`; a save from before it loads with it off), **Planetary events** (off by default), **The Murmur** (Off, Quiet or
Active, Active by default, for Versus and Colony; shown Off and greyed on Lunar; a map type's `murmur` sets it when picked),
**Day and night** (Always day isn't offered while the Murmur are on) and **Unlimited resources** (a testing switch: `unlimitedTopUp` keeps your Command Base at
`UNLIMITED_STOCK` of every good and fills whatever your buildings are waiting for, once a second). Resources come in separate
fields: your landing zone has a little of everything, and the rich fields beyond it are worth fighting for. None lie on a
Trade Post's ground (its no-fire zone, where nothing but a Trade Terminal can be built): a deposit the map put there is
moved just off it, the same kind and amount (`clearCalmGround`; see the Trade Terminal row).

**Grand Canyon** has rocky shelves below the rims, then a canyon floor that opens into broad, fertile bends.
The river splits around two low islands and rejoins at the ends. Each rim has two single-lane natural descents,
a switchback and a side-canyon trail. Fords link the banks on foot, and Ports can use the continuous channel
(ships sail the river, but it is a heights map, not a naval one: `river`, so no Naval badge and no Shoals biome).
Players can cut additional ramps or build crossings through Paths.

**Passenger Town** (`SHAPE_PRESETS` `city`, under Divided, two to four players; LORE.md's empty town in Greenreach) is
a flat map with the Pathfinder's town filling the middle. `townSetup` (js/world.js) lays a grid of blocks
(`TOWN.blockX` 4 to 6 tiles wide, `blockY` 3 to 5 deep) with 2-tile streets between, by the map's symmetry:
**two** colonies, a band across the map with a street down and across the middle, kept `TOWN.clear` rows short of each
base, laid on the south half and turned half round onto the north, tile for tile; **four** (a square map, `quadMap`), a
square town `TOWN.ring.four` of the map's side across (`townQuad`), each colony on an edge a little left of its middle
(generateMap's `edge4`: its starter fields stay in its own quarter), the town square in the middle with the one civic
tower, laid on the south-west quarter and turned a quarter at a time, tile for tile (2 vs 2: allies side by side);
**three** (the round planet), a round town, `TOWN.ring.three` of the way to each base in front of it and
`TOWN.ring.lobe` further between them (`townEdge`), the grid clipped to that outline: as fair as a grid allows, the first
third's block roles, sentries (`TOWN.sentry.per` a third), caches and arcades matched on the others by where they turn to,
and each third's salvage scaled to the mean. **The avenues** (`S.town.av`) are old Accord roads laid at setup (`S.road`,
surface `TOWN.avenue`: 1, plain road speed, `S.wown` -1: no one's until a colony's land takes them, `wayOwner`): with
two, the middle street from end to end; with four, the street in front of each base right across the town (a #); with
three, from the middle to each colony's side (straight down the middle street, the others 120° round, two tiles wide).
No building or arcade stands on one; they wear, are torn up and are removed like any road. Each block is the civic hall
(nearest the middle, with a sentry), the civic tower (the next; with four, the one in the town square), the school, a
parking lot with car hulks (`TOWN.lots`, 10%), a plaza (5%) or split into walk-up flats, shopfronts, apartment blocks
and towers (`TOWN_KINDS`). The buildings are rock under their art (they block robots, roads, tunnels and building:
`townRuinAt` in canPlace and canRoad; drawn as street by `pillarAt`). Street segments are then closed by covered
arcades (`TOWN.close`, 40% of them tried) as long as every street tile stays reachable and the bases joined, so the
streets are a maze. A Trade Post lands in the town only on a square or a parking lot, never by a sign (`townPostOk`).
`S.town` holds it all (saved, checked by checkSave, hashed): the rectangle (and a round town's `rad`, `lobe`), the
blocks' spans, signs, plazas, avenue tiles and the buildings `{ id, x, y, w, h, k, v, hgt, g (salvage left), n0, cache,
sen, scd, by, gone }` (`townIn`: a tile in the town). Saves from before the avenues load as they were (no `av`).
**Strip for salvage** (a building's panel, key S; the `townStrip` order sets bit p of `r.by`): dispatch's step 5b
(`townRun`) sends the colony's idle Workers, up to `townCrew` (1 to `TOWN.crew` 3 by size), to open tiles beside it
that no danger covers (`hotFor`); each strips a unit every `TOWN.unit` (4) s (`townDoStrip`: Cement, then Alloy, then
Chips, the most left first) and sets every `TOWN.pile` (4) down beside it as crates that never rot (`addLoot`, keep,
`dismantled` = the colony: its Haulers get first call; idle Workers carry them too; `townRun` keeps one Worker back
while its crates wait). Salvage is `TOWN.perTile` (0.6 Cement, 0.25 Alloy, 0.06 Chips) a tile times the kind's `mult`
(0.8 shops to 1.8 the civic tower) plus a few Chips in the school, hall and tower; a car is 2 Alloy. A Medium town holds
about 200 Cement, 90 Alloy and 20 Chips a side with two colonies, 120 Cement, 55 Alloy and 15 Chips with three, 115
Cement, 50 Alloy and 13 Chips with four. Stripped bare (`townFall`) a building's tiles turn to open ground
(`terrainChanged`), a cache (`TOWN.cacheShare` 15%) spills out, and its lot is drawn cleared. Robots beside a standing
building take `TOWN.cover` (0.75) of the damage (`townCover`, in damageBot). **Sentries** (`TOWN.sentry`: the civic
hall's and one more each side) stand on the roof and shoot the nearest robot of any colony, or Murmur creature, within
`range` (3.2) of the building every second for `dmg` (2.5), not on a Trade Post's ground; every armed army robot within
`back` (3.4) shoots back, `hit` (1.2) a second off its `hp` (40), and a Murmur creature within a tile of the building
claws at it, `TOWN.murmur` (0.5) of its bite a second (`townTick`, three times a second). Its reach is in everyone's danger map
(bit 2), so robots that don't fight keep out of it; a guarded building can't be ordered stripped. A rival (`aiTown` in
js/ai.js) orders one building at a time stripped, up to `TOWN.ai.max` (2), every `TOWN.ai.every` (20) s: the unguarded
one nearest the line from its base to its enemy's within `TOWN.ai.reach` of its land, the richer the better.
The look (js/city.js; ART_GUIDE.md, Batch 33): the buildings are rendered sprites (`renderer/b/town.js`, a look for
each kind and lot size, by day, at night and stripped twice: `townState` maps the eighths of `townStep` onto them), loaded
only for this map (`ensureTownArt`: `art/town/town-art.js` and the pictures of the lots in play; one-file:
`dist/town.js`), morning and evening made from day and night; of a lot's looks the one nearest the building's `hgt`
(so `TOWN_KINDS` heights are the art's); a building whose picture covers one of your robots (or one selected) fades
(`townHides`: the robot drawn before it, a point of its body on the building's solid pixels, `townSprite` and
`artMask`, so never its neighbour); a tap picks a building by its picture too, upper floors and roof included, the
one in front where they overlap (`townAtTap`; a robot drawn in front of it first). The ground, shadows (one
layer), lamps, sentries, haze and the name are drawn in code. The mission **Passenger Town** (First Contact)
teaches it (and joining a road to the avenue). `node tools/city-test.js [--games n minutes] [--only k]` checks the
layouts for two, three and four (symmetry and fairness, joined, the avenues, the Trade Posts), stripping, sentries (and
the Murmur), the save (and an older one) and AI games with two, three and four colonies.

**The Walking Factory** (`SHAPE_PRESETS` `walker`, under Open ground, two to four players; flat) is an old Accord mobile
works dormant in a cradle at the middle of the map. `walkerSetup` (js/world.js) lays its **yard** round the middle (its
loop of radius `R`, `WALKER.ring` of the way to a base, at least `WALKER.min` and `WALKER.gap` short of a base's landing
zone, plus `WALKER.yard` tiles either side and everything inside: bare, level ground, no deposits; `walkerYard`), opens a
lane `WALKER.lane` wide from each base to it, and keeps it clear of building (`canPlace`), Trade Posts, Uplinks and Murmur
nests. Four colonies take a corner each of a square map (`quadMap`, turned 90°), three a round planet, two the usual half
turn. The rules (js/sim.js, `walkerTick`): armed robots within `WALKER.deck` (2.8) tiles of its middle are aboard
(`walkerAboard`, `walkerCrew`); from `WALKER.wake` (240) s into a game (at once in a mission: `walkerWakeAt`) one side (a colony, or a team) alone aboard claims it in `WALKER.capture` (15) s for one
robot, `WALKER.more` faster for each more (at most `WALKER.most` times), and an enemy's hold has to be taken down to
nothing first (`walkerLost`); two sides aboard: contested (`hot`), nothing changes; a claim nobody finished fades. Claimed
(`walkerTaken`), it wakes and walks out a spur toward its holder's base, then round its loop at `WALKER.speed` tiles a
second for good, turning toward each new holder (`walkerTurn`). Held and not contested, a Warbot every `WALKER.every`
(50) s (`walkerBuild`; at most `WALKER.kids` alive per holder, never past the robot limit), on its holder's riding flag.
A rally flag planted on its deck (an order to move there, a rally, its Warbots': `walkerFlag` in `sendToRally` and
`orderMove`) gets `walker` and moves with it every step, so the robots holding it ride along. Its holder's robots aboard
recharge (`WALKER.charge`) and get a round of Ammo every `WALKER.ammo` s. It can't be harmed. State: `S.walker` (see
`walkerSetup`), hashed and checked in saves (`checkSave`). The rival AI (`aiWalker`, js/ai.js) keeps guards on deck while
it holds it (`WALKER.ai.guards` by difficulty, two more per enemy aboard) and sends a band (`WALKER.ai.band` at least) to
claim or retake it. The look (js/walker.js): the yard, its worn ruts and footprints (at `WALKER_LOOK.reach`, 3.35 tiles
either side of the loop, where the art's feet come down) and the cradle with the ground; the rendered sprite (ART_GUIDE,
The Walking Factory: `art/walker`, loaded only on this map by `ensureWalkerArt`), straight down, centred on its deck
(under the robots aboard) and turned to its heading (eased round for the eye, `walkerFace`; the sim's `h` is untouched),
one of six walk frames by `od` (tiles walked; a leg cycle a 1.3 tiles) or its rest frame while dormant, for the time of
day, with its holder's parts (a white layer) tinted to the holder's colour, or dim Accord amber; the chute's foot glowing
as the next Warbot nears, its stacks' smoke sorted with the items (while the art loads, or if it fails, the old drawing
in code: legs, hull, deck, stacks, crane and a pennant); on top, the deck's ring, the claim's arc, the next
Warbot's countdown, CONTESTED, its name and state. Tapped: its panel (`walkerSheet`) with **Send warbots aboard** (`E`:
the rally order, four warbots, to its deck). The mission **The Walking Factory** (First Contact) teaches it.

**The Dam** (`SHAPE_PRESETS` `dam`, under Heights and depths, two to four players; the owner's idea from IDEAS.md) is a
flat map (`flat`) with a raised shelf and the Pathfinder's reservoirs laid over it by `damShape` (js/world.js, at the
end of `generateMap`, so the new-game preview shows it). Each colony has a frame (`damFrames`: u from the middle toward
its base, v across), the map's own turn (the half turn for two, a quarter turn for four, a third for three), so
whatever is laid out by (u, v) in every frame is the same on every side, to the bit for two and four (four colonies:
`quadMap`, each base at the middle of an edge, generateMap's `edge4`). In each frame: a shelf one level up from behind
the middle to `rim` (`DAM.rim` of the way to the base, at least `DAM.room` short of it), `DAM.shelf` of that way wide
each side (6 to 11 tiles), wobbling; a lake (water at level 1) on it whose throat reaches the front edge, where the dam
(`DAM.gap` each side of the middle: 5 or 6 tiles of rock under its art, `pillarAt`) closes a notch between two crags,
two more crags making a short gorge below; a two-tile ramp at each front corner; a rich Crystal field each side of the
lake. Ground the cliffs cut off becomes crag. Then each dam's flood: open low ground from the gorge down the valley by
4-way steps, within a fan (`DAM.spread` a tile), at most the dam-to-base distance less a tile, never within `DAM.keep`
of the Command Base; each tile with its distance from the dam's foot (`fd`, hundredths), and the river (`chan`: the
middle two tiles to `DAM.chan` of the way, ending in a pool). `S.dam` = `{ v, ver, d: [{ k (whose valley), hp, by, mend
(bit p: colony p's orders), hitT, hitBy, broke (-1 or when), brokeBy, fi, ri, li (flood, recede and drain progress), x0
y0 x1 y1, tiles, gap, lake (far shore first), stream, flood, fd, chan, wet }] }`: saved, checked by checkSave, hashed.
The `ford` layer is always made on this map. **Rules** (sim.js, three times a second, `damTick`): the `damOrder` order
(panel: Demolish the dam D, Shore it up U; one clears the other) sets the bits. Every armed army robot of a colony with
the wreck bit within `DAM.reach` (3) of the dam's face takes `DAM.hit` (1) a second off its `DAM.hp` (400); a Howitzer
within `DAM.siegeReach` (6), `DAM.siege` (3) (rivals' times their difficulty's mult). Its colony is told when it is
first hit, everyone at half and a quarter (`damHurt`). **Blasts** (`damBlast`, the owner's call of Nov 23 2026): a
Missile (`missileImpact`) landing on a foe's dam or within `DAM.blast.on` (1) of its face takes `DAM.missile` (160, two
fifths), `DAM.blast.edge` (half) of that out to the Missile's splash (2.2); a nuclear blast within `NUKE.radius` bursts
it outright; a bomb within `BOMBER.splash`, `DAM.bomb` (12); Mortar and Howitzer shells don't (a Howitzer wrecks one
only ordered, above). A colony's own blasts and its allies' never hurt the dam over its valley. A Missile aimed at a
dam tile goes for the dam, never a robot by it (`missileDamAt` in `fireMissileAt`; the aim banner says so), and its
colony is warned. **Shoring up**: dispatch's step 5b (`damRun`) sends up to `DAM.crew` (3)
free Workers of a colony with the mend bit to stand within 2 tiles of it; each mends `DAM.mend` (2.5) a second, only
once nothing has hit it for `DAM.calm` (6) s and no foe is within `CRATE_SAFE`; full, the order ends. Tiles of a dam:
no road, tunnel or building (`damAt` in canRoad and canPlace). Selected robots tapped on a dam stand within reach of it
(`ORDERS.command`). **The breach** (`damBreak`, at 0): the gap tiles become a rubble ramp at the shelf's level (a way up
from the gorge to the lakebed), the rest of the wall stands. **The flood** (`damFlood`): the front runs at `DAM.speed`
(3.5) tiles a second over `flood` (`damFloodReach`): a robot it reaches takes `DAM.botHit` (4), on the river it is
carried to the nearest dry bank the flood won't reach; a building loses `DAM.hurt` (half) of its full armour, on the
river all of it (wrecked; a Command Base kept at 1); crops and Stalks wash away; road, track, pipes and plans on the
river wash out; open ground goes under as shallows (`ford`: robots wade at FORD_SLOW; bridgeable). After `DAM.stay`
(60) s the plain goes down over `DAM.recede` (20), the far end first, `DAM.silt` of it left fertile; the river stays
as shallows. The lake drains between `DAM.drain` (3 and 30 s), the far shore first, to a muddy bed (level 1) with a
stream of shallows down its middle and `DAM.bed` of it rich Ore or Crystal. Every change goes through `damChanged`
(`terrainChanged`, routes over changed tiles dropped). **The rival** (`aiDam` in js/ai.js, every `DAM.ai.every` s):
guards its own dam (or an ally's) when foes' army robots come within `DAM.ai.watch` or a foe hit it in the last 10 s,
a band on a flag within reach of the face (`aiDamSpot`), called back after a quiet minute; shores it up when hurt and
quiet; from `DAM.ai.from` (7 min; twice that on Easy), with `DAM.ai.army` armed robots to spare and at least
`DAM.ai.worth` foe buildings in the flood's way (none of its own), orders a foe's dam wrecked and sends up to 16 to
stand at it, again after two minutes if the band is gone; with a ready Silo in range (and not held back by an ally) it
fires a Missile at the dam's middle too, one every `DAM.ai.missile` (90) s at most. The look (js/dam.js): the concrete wall drawn in code (crest,
valley face with a spillway gate and a trickle, cracks spreading as it weakens, seeping below half, chips while hit, a
strength bar while hurt, your order as a dashed outline; burst, rubble and the lake pouring through), the flood under
the robots (water spreading with a foaming front and streaks running down the valley, then wet silt), the lakebed's mud.
The mission **The Dam** (First Contact) teaches it.

**The Ring** (`SHAPE_PRESETS` `asteroids`, under Heights and depths, two players; flat, `noMurmur`; the owner's idea from IDEAS.md) is a map
in space: asteroids with nothing between them. `ringMap` (js/world.js, called first by `generateMap`, as `hollowMap` is) lays it
out whole and point-symmetric, every tile made to its twin and the outline noise read at each tile's canonical place, so both
colonies get the same to the bit (`tools/map-symmetry-test.js` checks it). The map is 1.15 × 1.45 times the size's (46 × 82 at
Medium). From the bottom: a **home asteroid** (`homeRx` a third of the width, `homeRy` a fifth, its Command Base a little below
its middle), **stepping stones** along the middle line, and the **middle rock** at the centre (its own twin; `midRx` a fifth of the
width). The space between neighbours is `RING.gap` (3½ to 6 tiles: a Viaduct spans one more), so the chain is a few stones of
half-height 3.3 to 5.5 chosen to fit the rows (none on Small, one on Medium and Large, two or three on Huge and up). A **side rock**
lies to each side of the middle rock on the middle row, the same distance from both colonies, and from 40 tiles wide a **resource
rock** beside each stone. Outlines wobble; two rocks never come nearer than `gap - 1.2` (about 2.3 tiles); specks under 14 tiles go.
Every rock is flat ground (level 0, no ramps), its rim (any ground tile beside space) clear of deposits, crags and fertile soil so a
Viaduct can start or land anywhere on it, with a few crags in from the rim (never near a base or the middle) and the middle 5 × 5 of
every stone and side rock bare (a Trade Post or an Uplink can stand there). **The space** is `T_CHASM` (the Rift's and old Sky bridge
chasm tile) that `voidTile` (defs.js: `T_CHASM` on a Ring map) makes unlike water or a canyon: `bridgeable` refuses it, `canRoad`
refuses it (so no road, Sky bridge, pipe or track over it), `computeTerritory` leaves it no one's (borders stop at an asteroid's
rim), `addLoot` lets crates that fall into it go, a plane that crashes into it only explodes (`wreckGround`) and a Viaduct
(`viaductBlocked`: no `dip` test needed beyond `T_CHASM`) or a Ropeway spans it; a robot on a span that comes down goes back to the
end it set out from, as anywhere. Airdrops, Drop Outposts, Mooring Masts and every building need ground (`T_GROUND`), so
nothing can be put into space: `airdropBlocked` refuses a drop over it. Flight is as anywhere (Ring Crystal keeps craft aloft, LORE.md): Cargo
Plane drops, Airships and Masts, Vulcan Bombers, Missiles. There are no ships or Ferries (no water).
**Look and rules**: `newGame` sets the biome to Lunar whatever the Biome setting (and drops the second biome), so Argos's art, cliffs
(the canyon wall under each rim) and rules hold: silent (no Murmur, which `noMurmur` also says), no weather, no Arrival City or Atmosphere Engine
(`worldBan`), no Crystal from the Deep Core; the new-game Biome row reads *set by the map: The Ring* (`biomeForced` in js/ui.js,
the Observer's setup too). Planetary events run but **no dust storm** (`updateEvents`; the Endless dust storm challenge does nothing there);
Ringfall, solar flares and the Wren come. **Economy**: Argos's, with **more oil** than any other map (`RING.oil`: three fields of four
seeps on each home asteroid, two of three on the middle rock (and its twin) and one of three on every side and resource rock, at
least ten times a standard map's) so Fuel (Oil Pump, Refinery) is never short; the starter fields are the standard colony's (the same
offsets from the Command Base) and richer ones lie further out, each home asteroid is topped up to `RING.stone` Stone, and Ore, Crystal, Stalk and
Stone hold `RING.mul` (1.25) times the usual. **Trade Posts and Uplinks** use the usual rules (`placePosts`, `placeUplinks`) and land on
the middle rock and the two side rocks (three Posts) and on the middle rock and the stones (Uplinks), all reachable by span. **The rival**
crosses with Viaducts only (`aiBridge` → `aiViaductSpot`; the void is no sea to bridge): it builds no aircraft or Airships, and the map is laid out so every gap on the way is
short enough (the longest span the sides' chain needs is 4 to 7 tiles, `RING.gap`). **The look** (js/ring.js, display only): the space
behind the map (`ringSpace`, drawn instead of the off-map land, `R.void`): a deep sky with faint nebulae, three layers of stars that
drift slowly and slide a little as the view pans (the farther, the less), Corvane's glow in a corner, Ithaca I large and turning (about nine
minutes a turn) with its Ring round it, Argos turning small beside it (both made once, procedurally, from noise, and turned by sampling
a couple of times a second: no image files), and a streak of ringfall now and then. The asteroids stay put. The land is clipped (`ringClipLand`) when the
day and night light is graded over it, so the space keeps its own light. A void tile is left clear in the map's bake (`drawVoidTile`)
but for the canyon-wall art of Argos under an asteroid's southern rim, two tiles of it fading into the dark; the other sides have the
canyon's crumbled lip art. Graphics Saver draws one star layer and nothing moves; reduced motion holds everything still; no planet tilt,
frost or night sky on the land (`R.void` in js/nature.js). The map picker's card is a schematic from the flags; Custom Game and Observer
list it like any map. State: none beyond the map (`S.settings.shape`). Measured (rival vs rival, Normal, Balanced both, Medium and Large, four seeds each, 45-minute cap): 5 of 8 games undecided, against 8 of 8 on Sky islands; Domination and Uplinks both play out (Domination won at 34 minutes, an Uplink held and its clock run).

**Challenge modifiers** (the setup's Challenge section, and the host's settings in multiplayer): switches mixed freely
(`MODS`, `MOD_ORDER` in `js/defs.js`), remembered on the device with the other settings (`botfall.settings`, `mods`) and
kept in the game's settings (`S.settings.mods`, cleaned by `modList`; newGame leaves out Rival head start in Colony), so
every device plays them alike and saves keep them. **Half Fuel**: Refineries and energy crops make Fuel at
`MODS.fuel.rate` speed (`modFuelRate`, in `produce` and `growStalks`). **Endless dust storm**: the planetary events run
(`S.events`) with the first one a dust storm `MODS.dust.at` seconds in that never ends (`S.event.endless`, `t1` =
`DUST_ENDLESS`), so no other event comes. **Rival head start**: each computer colony lands with `START_STOCK` again and
4 Workers, 2 Haulers and 2 warbots more (`modsSetup`, from newGame). **Scarce Crystal**: Crystal clusters and every
Command Base's Crystal halved at the landing. **Fragile robots**: `damageBot` multiplies by `MODS.fragile.takes` (1.5).
**No turrets**: the `place` order refuses Pulse Turrets, Minigun Nests, Mortar Pits and Disruptor Towers to people
(`modNoBuild`; the Build menu leaves them out), while the computer places its own. The ones on show on the setup's
planet card (`syncPvMods`, ◆ on each with a badge), the summary under Start, one line of the briefing (`modsBriefing`,
`MODS[k].brief`), the pause menu (`#p-mods`) and the lobby's summary.

Terrafall is an original game in the colony-logistics genre. It contains no code, art, sound or data from
any other game.

## Play it

- **Hosted:** the game lives at https://terrafall.app (and www.terrafall.app), served by GitHub Pages under a custom
  domain; the old https://tadellsworth.github.io/RoboticPlanet/ forwards there. (A fork without a domain is at
  `https://<your-user>.github.io/<repo>/` once Pages is enabled, see below.) Saves are kept per address, so a save made
  on the old address moves over by Download save file and Load a save file. Link previews (`og:` and `twitter:` tags,
  `icons/og-image.jpg`), `robots.txt` and `sitemap.xml` point at the domain. On a phone, open it and use **Add to Home Screen**: it runs
  full-screen like an app and works offline. The service worker (`sw.js`) asks the server for a newer copy of every file
  each time the game is opened; art already checked since then comes straight from its cache (the day-and-night sets
  are let go and loaded again every few minutes), and cached art waits at most `ART_WAIT` (3 s) for a slow server.
- **Locally:** from this folder run a static server and open the address it prints:

  ```bash
  python3 -m http.server 8000
  ```

- **Single file:** `node tools/build-single.js` writes `dist/terrafall.html`, the whole game in one file you
  can open directly or send to someone.

In a game with computer colonies, use **Rival difficulty** in the pause menu. Settler, Pioneer, Colonist, Commander and Warlord
apply to all computer colonies from that point in the match (`rivalDifficultyTargets` in `js/orders.js`). In multiplayer only the
host can send the `rivalDifficulty` order (the row is hidden for everyone else), which takes effect on the same turn for
everyone, and every player gets a message naming who changed it. Changing the setting updates `S.difficulty` (which `aiLevel`
and the rest of the AI read) and each computer colony's `mult` and think time, without changing stock already on the
map. `S.diffLow` keeps the easiest level the rivals were at this game (hashed and saved): records and achievements go by
it, so switching to Hard for the last minute of a win earns no Hard win. Hidden and refused where the level is fixed
(`rivalDifficultyFixed`): Missions (the level picked in the mission list), Contingency battles (Ironman or not) and
Observer mode.

Solo games keep up to five minute-by-minute restore points on this device. Pick a point under **Restore points** in the pause menu (each listed by its game time and how long ago it was kept) and choose **Restore** to confirm. The same history is available after defeat or from the main menu. **Continue** also saves when you leave.
Besides the autosave there are five named **save slots** (pause menu **Save → Slots**, main menu **Saved games**), and
the main menu's **Continue** card names what it will resume: the newest of them all.

## How to play

The full illustrated guide is **[how-to-play.html](how-to-play.html)** (open it in a browser; once GitHub
Pages is on it is at `…/how-to-play.html` next to the game; the in-game How to play links to it, except in the
single-file build, which has no page beside it). In the game, **How to play** (main menu and pause menu)
opens on its contents; tapping a topic shows that one section, with a bar above it that stays put (Contents, a picker
for any section, ‹ ›) and Previous / Next at its end (`helpPage` in `js/ui.js`). The short version:

| Building | Does |
|---|---|
| Harvester | A worker cuts teal stalk groves into **Fiber** |
| Quarry | A worker breaks boulders into **Stone**; with none left it cuts Stone from a rock face in reach, or digs it (never runs out) |
| Ore Mine | A worker digs **Ore** from dark veins, two at a time (`dig`) |
| Crystal Tap | A worker taps violet clusters for **Crystal** |
| Grove Planter | A worker plants new stalk groves |
| Smelter | 2 Ore + 2 Fiber → 3 **Alloy** (15 s; it keeps 6 of each on hand, `hopper`) |
| Chip Fab | Crystal + Alloy → **Chip** |
| Bot Foundry | Alloy + Chip → a new **Worker**, **Warbot**, **Bulwark**, **Torch**, **Skirmisher**, **Arc Caster** or **Railgunner** (and the vehicles) |
| Outpost | Holds a wide ring of land (buildings inside it can't be cut off; defences can go there) and garrisons Warbots |
| Pulse Turret | Turns to aim and shoots enemy bots, 5 tiles out, 5 a shot every 1.3 s, armor 20 (12 and 4 a shot before the November 2026 balance pass); uses Crystal as ammo (3 Cement, 3 Alloy) |
| Bunker | A pillbox for 2 warbots who fire out (3½ tiles) with their own Ammo; armor 40 (was 32); claims no land; wrecked, not captured |
| Disruptor Tower | 4 Cement, 3 Alloy (no Crystal since the November 2026 balance pass). A pulse every 2½ s jams enemy robots' guns within 4½ tiles for 2 s (`jam`) and drains 10 battery; kills nothing itself; 1 Fuel per 4 pulses |
| Minigun Nest | 2 Cement, 2 Alloy (1 Alloy before the November 2026 balance pass: six of them were the cheapest wall of fire in the game). Spins up and hoses the nearest enemy robot within 3½ tiles, twelve rounds a second, pinning what it hits; Ammo, 60 rounds each |
| Mortar Pit | Shells where enemies bunch up, 3–10 tiles out: 6 damage, 3 within 1½ tiles, up to 6 robots a shell (`most`); 3 shells per Ammo |
| Keep | 14 Cement, 6 Alloy, 2 Chips: a fortified base with a roof cannon (Crystal, 6 tiles) that houses 25 warbots, 6 of them firing from cover (`slots`, 4 tiles); claims land; roads pass through it like an Outpost (`passTile`); captured, not wrecked. Within 7 tiles (`KEEP.aura`) Walls/Gates take damage ÷1.5 and mend after 8 s quiet, and defences get +1 range and ×0.8 reload (`auraRange`, `auraRate`); 16 tiles apart. AI: one (a Warden up to three) |
| Bulwark (Foundry, 3 rounds of parts) | Shield robot (`BULWARK`, `shieldBlock`, `bulwarkTick`): a frontal shield (±1.0 rad) soaks 40 damage from shots at it or at the 6 of its owner's robots nearest it within 2.1 tiles behind its line (`BULWARK.coverMax`, `shieldCovers`: by distance, then id, rebuilt each step with `SHIELDS` into `w.covIds`; the rest behind it get no cover; selected, it rings them faintly), regenerates 4/s after 2.5 s without a hit, fails for 8 s when worn out (back at 35%; it was 50, 6 s and 2.6 rad/s before the Skirmisher, Arc Caster and Railgunner); shells, bombs, Missiles and blasts from above, and fire from the side or behind, get past; a Disruptor pulse drains 14. Turns (1.8 rad/s) to face the robot it fights, else the nearest armed enemy: two coming from different sides get round it. Twin blasters, 1 a shot every 0.9 s, no Ammo. Leads its group (`escortMove`, `formPlace`, `FORM`): warbots and Torches on the same attack or flag each take a place in its lee (Torches at its back, warbots in rows of 3, 0.6 tiles apart, 1.05 tiles behind and 0.6 more a row, square to its heading) and keep pace with it (no faster than it goes, a little faster the further off their place), until it's within 2.6 tiles of the goal, they can already shoot the target, it's fighting a robot, or it hasn't got a tile nearer in 4 s (held up): then they fight as usual. (They used to stop dead whenever they got ahead of it: the squad stuttered, bunched to 0.1 tiles apart, and stood idle while it fought.) 30 health |
| Torch (Foundry, 2 rounds of parts) | Flamethrower robot (`TORCH`, `torchFire`): every 0.2 s a cone (±0.5 rad, 1.9 tiles) does 0.35 to each enemy robot in it (a facing shield stops only half of it, `shieldPass` 0.5, and that half burns the shield twice as fast, `shieldMul` 2) and 0.8 to the building it burns, ×1.6 to defences, Walls and Gates (a Wall in about 6 s); a 12 s tank, one Fuel a fill (`reloadArmy`, `fuelPoint`, task `refill`); explodes with fuel aboard (`BLAST.torch`). **Scorch the earth** (its panel, X; the selection bar with Torches selected; the `scorch` order, `orderScorch`): with its tank at least `scorchMin` (90%) full it walks to a patch of fertile soil (`scorchTileWhy`), stops within `scorchReach` (1.3) tiles, sprays its whole tank into it over `scorch` (3) s (task `scorch`, `doScorch`) and the soil burns for good (`scorchSoil`); then it refills (`scorchDone`). A group takes a patch each, nearest Torch first, within `scorchSpread` (3) tiles of the one tapped. 18 health |
| Skirmisher (Foundry, 1 round) | Fast flanker (`SKIRM`, `skirmFlank`, `skirmShoot`): speed 1.55, 9 health (10 before the November 2026 balance pass), reach 1.3. A foe behind an enemy Bulwark's shield (`shieldAt`) it runs round to a spot 0.8 of its reach off the foe, 0.6 rad past the edge of the shield's arc (the side it's on; a pack splits by id), shooting anything open on the way. 2 a shot every 0.75 s (Ammo, as a warbot), ×2 on a Bulwark, ×1.5 on a Railgunner, Arc Caster or Howitzer, ×1.5 on robots that aren't army. It hunts those kinds within 4.5 tiles first (`armyPick`). Dash (`u.dashT`, `speedMul`): ×2.2 speed for 0.9 s, every 6 s, setting off round a shield or closing on a foe over 2.5 tiles off |
| Arc Caster (Foundry, 2 rounds) | Chain lightning (`ARC`, `arcFire`, `arcHit`): 12 health, speed 0.85, reach 2. Every 1.7 s a bolt: 2.6 to its target, then to the nearest enemy robot within 1.7 tiles of the last one hit, up to 3 jumps, ×0.75 each. A Bulwark's shield in the way takes ×3 the bolt; what's left once it fails gets through. Buildings 1.5 (×1.2 defences). Capacitors (`u.gel`, `botTank`): 10 bolts, refilled 5 a Crystal at storage (`fuelPoint`, `reloadArmy`, the Torch's refill). Picks the foe with most others packed round it |
| Railgunner (Foundry, 3 rounds) | Piercing long gun (`RAIL`, `railAct`, `railFire`): 16 health, speed 0.7, reach 5. Charges 0.8 s (`u.rc`, aim kept in `u.rcX/rcY`: it fires where the target was, so a quick robot can dodge), then a slug along that line out to its reach: 10 to the first enemy robot within 0.4 of it, ×0.6 each after, up to 4; a Bulwark's shield in the way takes the slug and passes 80% of it on, and a Bulwark takes ×1.7. Reload 5 s. Closer than 1.6 tiles: a sidearm, 1 every 1.1 s. Buildings from 5.5 tiles (`RAIL.bldReach`; was 4.5), out of a Pulse Turret's 5: 4 (×1.5 defences). Ammo: 4 slugs, 2 an Ammo (`botMag`, `botAmmoShots`). Picks Bulwarks, then the toughest in reach |
| Howitzer (Foundry; **switched off for now**: `BOTS_OFF` in `js/defs.js`) | Mobile siege launcher (`ROCKET`): parks 4–11 tiles from a building and fires 4 rockets (5 each, splash 2 to buildings, 4 to robots), reloads 4 Ammo at a garrison or storage; a Command Base or Keep stops at `missileFloor` (anything else it can knock out); hurt below 60% it goes to a Repair Station within `ROCKET.repairReach` (30) tiles; 14 hp. AI builds 1–3 and hunts the enemy's  A new one rolls off the Foundry to a post (`u.post`) it returns to after reloading; `u.stance` `hold` fires only on orders, otherwise it shells what comes in reach of its post without moving |
| Depot | Extra storage, shortens hauling trips; give it supply orders to stock it as a forward base |
| Maglev Terminal | 8 Cement, 6 Alloy, 3 Chips, one tile: storage at the end of a **Maglev line**, or a hub of up to three (Paths → Maglev: see Maglev lines below); its Pod bay builds Maglev Pods; a Generator within 4 tiles powers it |
| Maglev Pylon | Not built by hand: one every 3 tiles along a Maglev line (over a road or track too, its feet at the side: the way stays open), 24 armour like a Wall; shot down it cuts the line until a Worker rebuilds it |
| Mass Driver | 12 Cement, 10 Alloy, 5 Chips, two tiles (east-west or north-south, R turns it as you place it): storage at one end of a line to its **Catcher** 12–50 tiles away (or one way to an Outpost or Keep): canisters of 16 goods fly both ways over anything, every 8 s from each end across a gap (10 s when a robot could walk between the ends), supplied automatically; a Catcher takes 2 Drivers at most; each end fires only with a Generator within 4 tiles; it can throw a **Catcher kit** (the Catcher's cost) to open ground 12–50 tiles away, which assembles itself in 20 s and claims 3 tiles of land (see Mass Drivers below) |
| Catcher | 8 Cement, 5 Alloy, 3 Chips, one tile: storage at the other end of a Mass Driver's line: it catches canisters and throws them back; out on an island it stocks what the buildings round it need and sends home what they can spare |
| Mooring Mast | 6 Cement, 3 Alloy, one tile: storage at one end of an **Airship line** (Link two: see Airships and Mooring Masts below); keeps 8 Fuel for its Airships, by Tanker or pipeline |
| Trade Terminal | A standing trade route, docked within 2 tiles of a neutral Trade Post (`S.posts`, `TRADE_POST`, `placePosts`: placed fairly between the colonies at the start, one more than there are colonies, two in Colony; `nearPost`), one per post per colony, out past the usual reach; a rival's land round a post keeps you out. 8 Cement, 3 Alloy. One route per Terminal (`b.route` `{ give, get }`, the `tradeRoute` order, `setTradeRoute`): send one good, bring back another, until changed. The post's ledger takes one run per Terminal every `TERMINAL.every` (120 s: `b.tnext`, its window); the Terminal asks for its run (`syncTerminalOrders`: a supply order of `routeLot`) a trip ahead of the window (`terminalLead`: `TERMINAL.lead`, 60 s, at first, then the last trip's time and 15 s, `b.lead`). A convoy (a Road Train from storage holding the whole run, or a Freight Train where track runs beside it; never Haulers or Freight Trucks) brings `TERMINAL.lot` (15) of the good, waits at the dock if early (task `dock`, inside the Terminal), and the run is made (`terminalRun`): it takes home what was bought, and anything else spare there, in a mixed load (`convoyHome`; `convoyAtDock`). Bought Fuel or Crude goes by Tanker (logistics step 4e) or Fuel by pipeline to storage (`updatePipes`). The **market board** (`sellPrice`, `buyPrice`): a good sells for its worth (`TRADE_VALUE`) × `TERMINAL.sell` and costs its worth × `TERMINAL.buy`, raw goods (`TRADE_RAW`: Stone, Fiber, Ore, Crystal, Crude) 0.35 and 0.75, made goods 0.575 and 1, Fuel `fuelMarkup` (1.5) dearer; a run brings back lot × sell(give) × `terminalBonus` (+1.5%/tile beyond 16 from the Command Base, max +25%) ÷ buy(get), its fraction carried to the next run (`b.tfrac`). 15 Stone → 2.4 Alloy, 15 Cement → 2 Alloy, 15 Alloy → 16.9 Crystal; a rich good goes out in fewer so a run brings back at most `carryBack` (30). No raw good for a raw good, no made good for its ingredients (`TRADE_MADE_FROM`), Cement only for made goods (`TRADE_MADE`), Crude and Fuel only bought (`tradePairWhy`). Each run sold of a good knocks `TERMINAL.sat` (0.1) off its sell price for that colony (`P.trade.sat`, down to `satMin` 0.5), and each second it gets back `recover` (0.3%) of the gap (`tradeRecover`: about half in four minutes): one route on a good settles near 0.7, two drive it to the floor. Its goods can't be spent until a convoy takes them home (`terminalSpare`, never `supplyOf`). A convoy flies a gold pennant (`u.trade`, the Terminal's id, while it carries for it; `drawTradeFlag`), its lane is kept (`b.lane`, the path out) and drawn on the minimap with the convoys as gold dots, its owner is alerted when it's hit (`convoyHit`, every 20 s at most) and told when it's lost (`convoyLost`: the cargo spills as crates, `dropCarried`). Warbots holding a rally flag go after an enemy convoy passing within `TERMINAL.hunt` (6) tiles of it, wherever it is (`convoyNear`), not only in their own land as with other civilians, and raiders leave a rival's convoy lane be (`convoyLanes`: no road torn up there) to lie in wait for its convoys. A convoy with its escort near (`escorted`) doesn't give way to enemy warbots (`gunShy`); an unescorted one turns back like any hauler. (In a mission with `pressOn`, Convoy, the rival's Road Trains press on: `convoysPress` takes them off `gunShy`, so they never turn back and set out from a besieged Command Base, its run taken from storage enemy warbots are at.) **Escort** (`b.escort`, the `tradeEscort` order): `TERMINAL.escort` (2) armed warbots from the nearest garrisons within `escortReach` (24) tiles (the Command Base keeps its last) ride along with each convoy (task `escort`, `doEscort`: kept beside it as it drives), get off to fight armed enemies near it (the convoy holds back while they do, and at the start of a trip waits half a minute at most for them to get on: `convoyHolds`), wait beside the Terminal at the dock, and walk back once it's home. A Terminal holds no land round itself (`civClaims`: every other finished civilian building holds `CIV_CLAIM` tiles), so the post's ground stays open to everyone's roads; it still reaches out for building like one (`reachMap`). (It used to hold its ring, and as nothing on the post's ground can be attacked, a rival's shut roads out of there for good.) **No-fire zone** (`calmAt`, `TRADE_POST.calm` 3 tiles round the pad): nothing targets anything there (`nearestEnemyBot`, turrets, Minigun Nests, Mortar Pits, Disruptor Towers, Flak, warbots, Howitzers, the Murmur), nothing there fires out, and no damage lands there (`damageBot` but for Ringfall and the ground giving way, `hitBuilding`, `rocketHit`, `bombHit`, Missiles, nukes), but for a Trade Terminal's construction site: enemy robots can wreck one there like any site, by an attack order, `sendAttack` or a flag held beside it (`calmShield`: only a finished building there is spared; bombs, shells and Missiles still spare the site; warbots used to fire at one for ever, the owner's call, Nov 2026); and only a Terminal (or a Ramp) can be built there (`canPlace`: an Outpost or Wall there would be a door no enemy could ever break), so **no deposit lies there** either, where nothing could ever mine it (the owner's call, Nov 2026: `clearCalmGround`, at the start of a game once the posts, Uplinks and a mission's setup are in, and as a save loads, moves each one, the same kind and amount, to the nearest open tile just off the ground, `calmSpill`/`calmSpillOk`, on the same land if it can, the edge of the ground first; on a new Versus planet made from the seed the map's own symmetry is kept (`uplinkOrbit`: the half turn, the quarter turns, Long Haul 2v2's two mirrors, the three-way turn): a deposit moves with its twins on every other colony's side, whether or not they lie on a post's ground (most posts have no twin), to a tile and its twins, one on a line of symmetry staying on it, so every side stays the same tile for tile while the posts and Uplinks keep their places (Long Haul 2v2's centre post, the middle Uplink); an Energy crop just goes; no dice, the same on every device and on a rejoin), Ringfall's pieces that would land there lie just off it (`meteorImpact`), the drizzle keeps off it (`drizzleOk`), Grove Planters and Bio Farms plant nothing there (`findPlantSpot`, `findCropSpot`), and the Hollow's falling rock (`rockfall`) has no posts to mind; warbots can't be sent at a Terminal there, and bombs, napalm, Missiles and nukes can't be aimed at it. The rival docks a Terminal from `AI_TRADE_AT` (8 minutes; an Architect 7) and runs a route with Escort on (`aiTrade`); the *Wren* keeps its one-off deals. |
| Ramp | Planned in Paths: cuts a slope into a one-level cliff so bots can climb it; counts as road |
| Fuel Station | Recharges bots' batteries, four at a time; burns **Fuel** |
| Bio Farm | A worker plants energy crops on fertile soil and harvests them into **Fuel** |
| Oil Pump | Built on an oil seep; a worker pumps **Crude** until it runs dry (no stock limit unless you set one) |
| Refinery | Crude → **Fuel**, one for one (stops at 30 unless you change its stock limit); explodes when destroyed |
| Fuel Tank | Gather tab (T), 5 Cement + 2 Alloy: storage for **Crude and Fuel only**, up to 120 together (`tank`); **Keep at least** N Fuel / Crude (its supply orders, `b.keep`, shown on tanks since Nov 21 2026); the hub of an oil bloc: feeds up to 4 neighbours, a pipeline with one on it moves twice as much; a far bigger blast when destroyed full |
| Generator | Burns a Fuel every 40 s to make factories, Refineries, Oil Pumps and the Foundry within 4 tiles work a third faster |
| Cement Works | 1 Stone → 2 **Cement**, the main building material (stops at 40 unless you change its stock limit) |
| Asphalt Plant | Crude + Cement → 2 **Asphalt** |
| Roadworks | Takes two Pavers. They lay planned road first (twice a Worker's rate, outside the road crew limit), then pave and maintain the roads you mark for asphalt (or every joined road), nearest first (1 Asphalt covers 4 tiles), and lay Express lanes (1 Asphalt and a quarter Alloy a tile) |
| Ammo Plant | Alloy + Cement → 3 **Ammo**; warbots reload it in the Command Base and Outposts, 5 shots per Ammo (Versus) |
| Missile Factory | 2 Alloy + Chip + Fuel → **Missile** (20 s each; Versus) |
| Missile Silo | Fires Missiles at rival buildings, ground or units (locks on) up to 22 tiles away; holds 2, reloads in 60 s (Versus; 25 s until Nov 2026, the owner's call) |
| Repair Station | Fixes damaged bots three at a time; 1 **Alloy** repairs 12 health (Versus) |
| Nuclear Reactor | 2 Uranium → 1 **Enriched Uranium** (Nuclear race) |
| Nuclear Silo | 6 Enriched Uranium + 4 Alloy + 2 Chips → one nuclear missile; fires 40 tiles (Nuclear race) |
| Lance of Corvane | 40 Cement, 30 Alloy, 15 Chips, 10 Crystal, 3 × 3 tiles, one per colony (Megastructures): aimed at any spot, it charges 90 s (45 s on a Reactor, `LANCE.reactorCharge`; reload 4 min, 3 on a Reactor, `reactorReload`) and fires a beam across the whole map: a 2-tile core (`LANCE.width`) that destroys everything it touches, and a 1-tile scorched edge either side (`LANCE.edge`) that takes half the armor or health (`edgeDmg`) of what's there and destroys nothing; needs 2 Generators with Fuel or a Reactor within 4 tiles (see Megastructures below); with both, the Generators unless Use Reactor is on (`b.lUseR`, the order `lanceReactor`; a rival switches it on once it has chosen the Lance over the nukes); the charge's source and length are kept (`b.lSrc`, `b.lTime`; an older save's charge takes 90 s) |
| Sundering Ray | 50 Cement, 30 Alloy, 12 Chips, 8 Crystal, 3 × 3 tiles, armor 90, one per colony (Megastructures), from 18 minutes in, everywhere (on Argos a Quake weapon only): winds up 60 s (40 on a Reactor; reload 5 min, 4) on 2 Generators with Fuel within 4 tiles or a Reactor with 1 Uranium a blow, then a ripple through the ground: Strike the Deep (anywhere, with the Murmur on) caves in every tunnel in a 16-tile circle, seals its exits for 2 nights, takes a third off its nests and stops their next raid; a Quake (within 30 tiles) takes 40% of full armor off every building in a 5-tile circle (never below 10%; a Command Base or Keep 20%), cracks their foundations (half speed until repaired), roads, track and Walls, stuns robots; a Shield Dome doesn't stop it; the Murmur come for it the next night (see Megastructures below) |
| Shield Dome | 30 Cement, 24 Alloy, 12 Chips, 20 Crystal, 2 × 2 tiles, one per colony (Megastructures): a dome 9 tiles round it that stops Missiles, nukes, bombs, shells, Ringfall, canisters and a Lance shot from outside; 100 strength; a Crystal every 20 s and a Generator within 4 tiles; can be turned off (30 s to come back up) |
| Arrival City | 60 Cement, 30 Alloy, 15 Chips, 24 Fiber, 4 × 4 tiles, one per colony (Megastructures), from 12 minutes in, not on Argos: +20% work for factories, gatherers and builders within 8 tiles; holds 6 tiles of land that count twice in Domination; never destroyed (knocked out at 0, then seized by warbots at its walls for 40 s, as any megastructure: see Megastructures below); a Fuel a minute at night for its lights (see Megastructures below) |
| Great Uplink | 50 Cement, 40 Alloy, 30 Chips, 24 Crystal, 3 × 3 tiles, armor 120, one per colony, only with the Great Uplink win on (and Megastructures), not in Colony or the Hollow: Begin transmission from 25 minutes in, with 3 Generators with Fuel within 4 tiles (a Fuel every 30 s each while it transmits), or a Nuclear Reactor and 1 Generator (a Uranium every 4 minutes); Stand down loses the transmission; 8 minutes of transmission make contact and win the game for its colony and team; an enemy warbot within 3 tiles jams it, and jammed or unpowered its clock runs back at half speed (see Megastructures below) |
| Deep Core | 60 Cement, 40 Alloy, 20 Chips, 10 Crystal, 3 × 3 tiles, armor 100, one per colony (Megastructures), from 20 minutes in: a winding tower over a shaft that goes deeper while it has power (a Generator within 4 tiles, a Fuel a minute, or a Reactor, no Uranium): 6 Ore a minute; after 6 minutes 8 Ore and 3 Crystal; 10 minutes later 10 Ore, 4 Crystal and a Uranium every 4 minutes; never runs dry; 30 of each in its hoppers for Haulers; the Murmur raid it the night after each stage, and its open shaft is their exit once it's destroyed (see Megastructures below) |
| Atmosphere Engine | 50 Cement, 40 Alloy, 24 Chips, 30 Crystal, 20 Fiber, 4 × 4 tiles, armor 100, one per colony (Megastructures), from 20 minutes in, not on Argos or in the Hollow: a cooling-tower shell venting a plume that changes the land round it while it has power (2 Generators within 4 tiles, a Fuel a minute from each, or a Reactor, a Uranium every 6 minutes): Calm at once (8 tiles, no dust storm), Rain after 6 minutes (12 tiles, the ground fertile, the Bloom held), Green 10 minutes later (16 tiles, crops a quarter faster, the Bloom withering), Garden 12 minutes after that (20 tiles, groves, no Bloom, no Murmur exit). The land changes for everyone in its circle, but the calm and the faster crops are its owner's (and allies'); from Rain enemy robots in it wade through mud at half speed, and while it has power enemy Torches can't burn there. From Rain its **Storm Front** (panel, F): a 5-tile storm set anywhere clear of its own circle and of other Engines' (moved a minute after), while it has power: enemy robots 60% speed, sites 60%, guns 75% reach under it; from Green their crops stop and wither after 3 minutes; at the Garden lightning on one of their buildings about once a minute (15% armor, never below 30%). No storm in any Engine's circle; it ends when its Engine falls. The Murmur go for it first; Sappers the night after each stage. Destroyed, the land stays changed; its hold fades over 10 minutes |
| Orbital Lift | 60 Cement, 44 Alloy, 26 Chips, 20 Crystal, 3 × 3 tiles, one per colony (Megastructures), not in the Hollow: calls a climber down from the Carrier (6 Warbots and 2 Bulwarks, 6 Workers and 2 Freight Trucks, 30 Alloy or 18 Chips; 45 s; then 6 minutes), 6 drops in the Carrier's reserve; 30 goods sent up put a drop back and make the next drop half again bigger (up to double); 2 Fuel a climb from a Generator within 4 tiles; destroyed by an enemy, its cable falls along the fall line set with R when placing (see Megastructures below) |
| Research Lab | Researches colony-wide upgrades with Chips, Crystal and Alloy (Colony) |
| Ropeway | Placed in Paths: two stations joined by a cable straight across cliffs, water or rock; light bots ride it |
| Viaduct | Placed in Paths: a level bridge straight across a valley between two clifftops; every bot crosses it |

**Aiming a defence** (focus fire: the `focus` order, `ORDERS.focus` in `js/orders.js`; `focusWhy`, `setFocus`,
`updateFocus`, `focusTarget` in `js/sim.js`). A Pulse Turret, Minigun Nest, Mortar Pit, Flak Gun, Bunker or Keep
(`canFocus`) can be locked onto one enemy in its reach (`focusReach`: a Keep's the further of its cannon's and its gun
slots'; a Mortar's 3-tile blind zone counts): its panel's **Aim** (`T`, then tap the enemy), or with a mouse a
right-click on the enemy while its panel is open (Shift+right-click: every defence of yours that reaches it, in one
order: the order takes a list of up to 64 ids). `b.focus` is the enemy's id; while it's in reach the defence fires at
it and nothing else (the Keep's cannon and its slots alike, a Bunker's warbots). Out of reach (walked off, indoors, a
plane landed) the defence picks its own targets and `b.focusOut` holds when it lost it: back within `FOCUS_GRACE` (4 s)
the lock picks up again, otherwise it's dropped; dead, captured or no longer a foe, it's dropped at once (and a captured
defence loses its old owner's aim). Turrets, Nests, Bunkers and Keeps aim at robots and vehicles on the ground, a Flak
Gun only at aircraft in the air, a Mortar Pit at a robot or an enemy building (each shell does `mortar.bld`, 3, to it,
through `rocketHit`, on top of its usual splash on robots). A Disruptor Tower pulses at everything: it has no aim. A
pick out of reach or of the wrong kind is refused with a reason (the order gives back `{ n, why }`). Both fields are in
`hashState`, saves and `checkSave`. Drawn by `drawFocusAim`: a red reticle on each enemy one of yours is locked onto
(faint while it's out of reach), a dashed line from the defence whose panel is open, and while aiming its reach and a
ring round every enemy it can take. The rivals don't use it: their defences pick their own targets as before.
Selecting several buildings at once isn't a thing in the game; Shift+right-click stands in for it. The armored
Freight Train's guns pick their own targets (a train isn't a building and passes by too fast to aim).

- **Cement builds the colony.** Nearly every building costs Cement, and so does every road. Only the Quarry (2 Fiber)
  and the Cement Works (4 Stone, 2 Fiber) are built from raw materials, so you can always restart. Stone goes into
  Cement (2 per Stone) and new Cement Works. You land with 24 Cement, 8 Stone, 16 Fiber, 8 Alloy, 4 Chips, 4 Crystal and 10 Fuel.
- **Stock limits:** tap a production building and set when it stops: once you have that much of its product it takes
  no more inputs and its worker goes off to other jobs until it's needed again. By default the Cement Works stops at
  40, the Refinery and Oil Pump at 30, the Ammo Plant at 24, the Asphalt Plant at 20, the Chip Fab at 10 and the Missile
  Factory at 4 (so Chips and Ammo don't swallow the Foundry's Alloy); the rest have no limit until you set one.
  Gatherers and Bio Farms have none (they make no recipe): pause them if their goods pile up.

- **Workers and Haulers:** Workers run buildings (one inside each production building), go out to cut, dig and mine
  (the nearest node in reach, unless the walk there is over `NODE_DETOUR` (1.75) times the straight line: then the
  shortest walk of the four nearest, `findNode`, `routeCost`),
  and build construction sites. They can go anywhere, but off the road they move at 40% speed, except while out
  gathering for their building. **Haulers** move every good between buildings (except Crude and Fuel: see Tankers),
  two at a time, and **only drive on roads**. A factory less than a Hauler's load short of an input, with more than
  its next batch in hand or on the way, waits to be topped up (`dispatch`), so Haulers carry full loads instead of one
  unit after every batch. If every Hauler is lost, workers carry goods slowly until the Foundry
  makes more. **Agribots** run Bio Farms and Grove Planters, **Pavers** run the Roadworks (two each: they lay planned road and asphalt) and **Warbots** fight. You
  start with 10 Workers, 5 Haulers, a Tanker and an Agribot (plus 4 Warbots in Versus).
- **Who gets a worker** (`dispatch` step 2, the same for rivals): player priority (`prioRank`) first; then a building
  that can work now before one that would only sit waiting (`stallWhy`: short of an input counting what's on its way,
  output or store full with no pickup booked, a Quarry resting on plenty of Stone, a Foundry stopped or at the bot
  limit); then by what the economy needs (`goodsWanted`, `needRank`): a good under `WANT_LOW` (12) in hand that a
  factory (staffed or not) or a site is held up for makes its producers (`madeGoods`: what a factory makes, what a
  gatherer gathers) first, by how many wait for it, ahead of the Foundry, so the chain is walked back by itself (Foundry
  waits for Chips → Chips wanted → the Chip Fab waits for Crystal → Crystal wanted → the Crystal Tap is staffed first);
  a producer only of goods held at `RICH_STOCK` (150) or more goes last; then `staffPriority` (Foundry first) and age.
  While wanted-good producers outnumber the workers left to run buildings, a worker leaves a building that only makes
  rich goods (not one set to High) for them. **Stalled operators:** a worker that has sat `STALL_FREE` (25) s inside a
  building that can't work (`b.stallSince`, `noteStall`), with nothing on the way to change that, is sent off (the
  longest stuck first) while a site or repair waits for a builder with nobody idle, or a building that could work has
  nobody to run it within the `MIN_FREE_WORKERS` kept free. Its building is `benched`: nobody is sent back while
  `stallWhy` still holds (`benchHolds`); its panel reads e.g. *Waiting for Chip (its worker went to help elsewhere; one
  comes back once it can work)*. Call a worker clears it. A site with its goods in and no builder has **Call a builder**
  (`callBuilder`, through the same `callWorker` order). `siteReady` decides whether a site draws a builder: more than 1%
  beyond what's built, or all its goods in and not finished (a Maglev Terminal at 99% with everything delivered once
  never did). Measured on a player's save (27 min, 12 Workers for ~60
  staffed buildings, 7 of them parked in stalled buildings for up to 11 minutes; no Crystal Tap staffed, so the Chip
  Fab waited on Crystal for 7 minutes), the next 10 minutes made 41 Crystal (was 0), 33 Chips (was 7), 81 Alloy (78)
  and 22 Cement (28), and 28 Fiber instead of 93 more on top of 318 in store; the same sites finished.
- **The Workforce panel** (`js/workforce.js`; Shift+W, the top bar's Workers count, or Workforce in Your robots): your
  Workers counted by activity (building, running, stuck/waiting, carrying, paving, charging, free: `wfWhat`, which also
  words each one, *In the Chip Fab, waiting for Crystal for 3:20*), tap a count to list them a page at a time and a line
  to jump to that Worker; **Problems** (`wfProblems`): sites with goods in and no builder, buildings that want a Worker
  and why not, goods short (`goodsWanted`) with their makers; and the **priority ladder** of job types (`WF_ROWS` in
  defs.js: Building sites, Repairs (mend, magfix, capshaft, dammend too), Bot Foundries, Crystal Taps, Ore Mines,
  Harvesters, Quarries, Smelters, Chip Fabs, Cement Works, Oil and Fuel, Asphalt Plants, Ammo and Missiles, Research
  Labs, Other buildings, Paving). While it's open `drawWorkerView` draws each Worker's line to its job in its
  activity's colour and `wfDrawWants` a slashed worker over each building wanting one. Settings live in
  `P.wf = { order?, rows?: { row: { min?, cap?, pin? } } }` (saved, checked by `checkSave`, in `hashState` only when set)
  and change only by orders: `wfOrder` (a list: Manual; null: Back to Auto), `wfPreset` (`WF_PRESETS`: economy, war,
  build), `wfRow` (min, cap, pin), `wfRebalance`, and `keepStaff` (a building's Keep staffed). The player's own three
  presets (Save as preset 1/2/3, named, `WF_MINE_KEY` in localStorage: device only, never in the game) hold
  `wfSettings(p)` (order or null, rows); loading one sends `wfPresetOrders(p, preset)`, the same `wfOrder`/`wfRow`
  orders as by hand (anything odd in a stored preset reads as no setting), so lockstep games agree; `hashState` hashes
  the rows in `WF_KEYS` order whatever order they were set in. With no `P.wf` (every
  rival, and any player who never touched it) `dispatch` runs exactly as before (seeded AI games hash the same).
  With it, `wfSetup` gives the pass the row counts (`wfCounts`, by each Worker's job: `wfJob`): **Manual** runs steps 1
  (sites), 1a–1d (repairs), 2 (staff, one row at a time, the usual `staffQueue` order within) and 6 (paving,
  `stepPave`) in the player's row order; **kept free for building** (`wfKeepFree`): `minFree` is at most Building
  sites' cap (0: none), and 1 on a Manual ladder without Building sites on top; **caps** stop new jobs and release a
  staffed row's extra Workers (least useful first, never Keep staffed); **minimums** come first each pass (they run even
  with nobody idle), a free Worker per missing job, or up to `WF_MIN_TAKE` (2) a pass moved off donor buildings (one in
  it or on its way; stalled, then plenty, then a lower row; never a pinned row, a row at its minimum, Keep staffed or a
  triage last link); **pins** and Keep staffed are left alone by the free-for-building release, the stalled-operator
  release, the plenty release and Rebalance (`wfHolds`); a stock limit's release still lets their Worker go (it can't
  work) but marks the building `wfBack`, and dispatch gives it a Worker first (before minimums and sites, only its
  row's cap holding it) once it has room; the plenty release on Manual only
  takes from rows no higher than the top waiting one. `wfAutoOrder` gives the panel the order Auto uses (sites, repairs,
  rows by their best building's `prioRank`, `needRank`, `staffPriority`, paving) with why; `wfRebalance(p, dry)` frees
  Workers (stalled first, `benched`; then plenty; Manual: rows below the top waiting row) until there's one free per
  waiting job past the kept-free few, the dry run telling the panel how many it would move. Tests:
  `tools/workforce-test.js` and `tools/workforce-lockstep-test.js`.
- **Construction sites** are built only as far as the goods delivered so far (`siteFrac`); a free Worker comes once
  some are in (`dispatch` step 1, `roadToSites`). A builder that runs out **waits at the site** if a carrier is bringing
  goods it still needs and is due within `SITE_WAIT.eta` (35 s: `siteInbound`, the rest of a Hauler's, truck's, train's,
  ship's, crate-carrying Worker's or supply plane's route at its road speed), and builds on when they're in (task
  phase `wait`, `t.waitT`, `t.via`; the site reads *Waiting for goods (a Hauler on its way)*). It gives up after
  `SITE_WAIT.max` (45 s), when nothing it needs is due soon any more (the carrier lost or sent elsewhere), or with
  enemies within `SITE_WAIT.foes` (8) tiles or on the danger map; any order of yours takes it off too. Otherwise it goes
  to other jobs and a builder is sent when more arrive, as before. (Before, a builder always walked off and came back:
  in `worker-wait-test.js`, a Bunker 18 road tiles from home with one Hauler went up in 51 s instead of 60.)
- **Interrupted deliveries.** Dispatch considers alternate suppliers and checks the carrier's network against both
  endpoints. Trains and ships pick up on a platform or dock that reaches the delivery point. The dispatcher reserves
  stock once the pickup route is found, and the carrier checks the delivery route before loading. A blocked route
  releases the incoming reservation and lets the carrier take its existing load to reachable storage or wait for an
  opening. Freight Trains check for removed track and use a detour if one is available. Workers, Haulers, trucks and
  ships use reachable charging or fuel stops when deciding whether to wait for a top-up.
- **Every building needs a road to storage.** Your Command Base starts with a ring of road around it; join each building and construction
  site to that network (or to a Depot on it), or Haulers can't bring it materials or collect its goods. A red road badge
  marks buildings with no road (the Goal card's red line counts only those with no road planned to them either:
  `cutOffUnplanned`, `roadOnItsWay` in `js/ui.js`): tap one and press **Lay road** to plan the shortest route (shown dashed; of the
  routes as short, the one with fewest bends: `roadSearch` pays `ROAD_TURN` 0.05 a turn, as the rival's roads do), or plan your
  own. Placement keeps a side of every building open for a road.
- **Planning roads:** in Paths, dragging and tapping only sketch a road (and tapping a road marks it to take up; a
  drag that starts on planned road or track of yours and goes on along it calls the plan off tile by tile instead,
  `planErasable` / `eraseTile`: sketched tiles drop out, waiting ones are marked to call off at Build, cost back; one
  that leaves it for open ground draws on from there, and built road is never touched by a drag);
  the banner, at the top of the screen, shows the cost, with **Undo**, **Clear** and **Build**. On an upright phone the
  banner (and every mode's banner) is docked across the bottom in place of the tools: the line is up to three lines,
  the tools are behind one button, **Tool: Roads ▾** (the tool in use; it drops the word Tool where Route to leaves
  it too narrow, `toolFit`), that opens all of them at once as a grid over the map, the one in use lit, and shuts when
  one is picked (`toolPicker`; a touch elsewhere shuts it too, and one on the map does nothing more), with Route to,
  Traffic and Done beside it and Undo, Clear, Build and Done in the row below; a mission goal that lights a Paths
  tool lights the Tool button while that tool isn't the one in use (`coachTarget`). On a phone on its side the tools
  are one row to swipe along (an end with more tools beyond it fades out, `segEdges`). **How it works** is a tab on
  the banner's edge that opens as a card over the map. Sketching up to the edge
  of the map scrolls it on under the finger (`paintScroll`), and a tap just above the docked banner glides the map up
  so the banner's new row doesn't cover it (`planInView`). Nothing is spent until
  Build. Building closes Paths, straight back to the map; leaving Paths any other way drops an unbuilt sketch.
  Arrows and Junctions still act at once. **Ramps** are planned in Paths too (tap the foot or top of a one-level
  cliff, or just drag a road or track up it: `dragCliff`) and count as road once built.
- **Roads through Outposts:** an Outpost can stand on a road, and its tile joins the road network. Like a Gate it only
  lets its owner's bots through (`passTile`); an armed enemy warbot breaks in (`breachable`), which captures it.
  So connectivity is worked out per player (`roadNet(who)`, `roadLikeFor`): an Outpost, Keep, Gate or Ropeway station
  joins roads only for its owner, and a building anyone can't pass blocks the road under it, exactly as `findPath` has
  it; `buildingNets`, `botNets`/`botGroups`, `pileNets`, `onHomeNet`, `roadRouteTo` and `roadReach` all use the
  owner's view, so nothing counts as linked that a hauler can't drive. An overpass is two straight roads in all of
  them (`tileNets`, `laneComp`: see Junctions below), as in `findPath`. Each player's networks are numbered from
  `(who + 1) * RN_SPAN`, so ferry-line groups (`netGroups`) never mix players up; `roadNet()` (everyone's at once) is
  for drawing roads and junctions. A capture (or a colony knocked out) bumps `S.roadVer`.
  Bots follow roads round corners (no diagonal shortcuts on or off a road).
- **Your robots:** tap the robot counter in the top bar for every robot by type and what they're doing, and the
  spare Workers (`workersWanted`, `spareBots`) with **Recycle spare Workers**.
- **Recycling** (`js/sim.js`, the recycling section; `RECYCLE_SHARE` and `RECYCLE_KEEP` in `js/defs.js`): a robot's
  panel has **Recycle this unit** (**Delete**), a selection of warbots **Recycle these N units** on the selection bar
  (a second tap to confirm; Undo), and Your robots **Recycle spare Workers** (orders `recycle`, `unrecycle`,
  `recycleSpare`). The robot drops what it was doing (a load goes down in crates), heads for the nearest finished Bot
  Foundry it can reach (road vehicles need a connected road route: `recycleFoundry`) with task `recycle`, and there stands
  at the Foundry while it is taken apart: `RECYCLE_TIME` (2 s) for each round of parts (`recycleTime`; `task.t` counts
  them, `recyclingNow`; a Worker or Warbot 2 s, a Crawler 12 s), sparks flying and the robot fading as it goes, the
  Foundry carrying on with its own work and taking apart any number at once. It can be shot meanwhile, and a damaged
  robot gives back as much as a sound one. Then `recycleBot`: `RECYCLE_SHARE` (half) of its parts, 1 Alloy and 1 Chip a round, rounded down, Alloy
  first (`recycleYield`: a Worker or Warbot 1 Alloy, a Freight Truck, Tanker or Torch 1 Alloy and 1 Chip, a Crawler 3
  and 3, its goods left in crates), goes into that Foundry's stock, and its place under the robot limit is free; a
  ring, sparks, the goods floating up and a clank. Its status reads *Going to be recycled*, then *Being taken apart at
  the Bot Foundry (n s)*; **Keep this unit**
  (`stopRecycle`) or any other order calls it off; its Foundry wrecked, captured or dismantled on the way, it stops
  where it is (`releaseBotsFrom`). A Worker or Hauler that takes cover from enemy warbots on the way (`takeCover`) sets
  off again once they've gone (`u.recycleTo`), and isn't given other work meanwhile. Robots on their way don't count in
  `dispatch` (free workers, Haulers, Tankers) and `callWorker` passes them over. Planes, ships, Freight Trains, Maglev Pods and the Murmur can't be recycled
  (`recyclable`). The refund can be used at the Foundry or carried to the rest of the colony. Spare Workers: past
  one for each building that takes a Worker (sites too) and
  `MIN_FREE_WORKERS` + `RECYCLE_KEEP` (4) free for building; picked idle first, never one running a building.
- **Bot Foundry build order:** its panel lists every bot type with ▲ ▼ arrows to move it up or down (`b.order`,
  `foundryList`, `moveFoundryOrder`), and a choice of **Take turns** (one of each ordered type in turn, in the list's
  order) or **Top of the list first** (`b.omode = 'first'`: every bot of the top ordered type before the next). The
  type being built is highlighted. The AI keeps the default order, taking turns.
- **Roads** cost Cement (1 Cement paves 5 tiles), paid when you build the plan. Planned tiles show dashed
  until free workers pave them: 1.5 s a tile (3 s through resources), so long highways take planning and spare workers.
  **Road crew** (`ROAD_CREW`, `ROAD_CREWS`, `roadCrew`, `PAVER_LAY`, `PAVE_LEAVE` in `js/defs.js` and `js/sim.js`; Nov
  2026): no more than a colony's road crew of Workers lay planned road at once, 3 unless set (`P.roadCrew`: 2, 3, 5 or
  0 for no limit, the Roads and Bridges tools' **Road crew** row in Paths, order `roadCrew`; in `hashState` and saves,
  an older save loading with 3), so a long road no longer takes twenty Workers off building to crawl along behind its
  end in a blob. A Worker laying road goes to a construction site within `PAVE_LEAVE` (10) tiles that waits for a
  builder, its materials in, unless a free Worker is as near (`roadToSites`): building beats roads. A Roadworks takes
  two **Pavers** (`BDEFS.roadworks.crews`), and they lay planned road too, `PAVER_LAY` (2) times a Worker's rate (0.75 s
  a tile, bridges and tunnels at half their time), outside the limit: from inside their Roadworks they take the tile
  the paving order gives them (`nextPaveTile`), carry on along it while the next tile is within 12 and their charge
  lasts (`paverGo`, `paverNext`, `paverLay`), and only then lay or resurface asphalt and Express lanes. New road comes
  first because it's paid for already and no use until it's down, where asphalt only makes a working road faster; a
  Paver's tile is never taken over by a Worker. Measured on a 30-tile road from home with 28 Workers (18 free), after
  30 s: before, 18 Workers on it and 10 tiles down; with a crew of 3, 12 tiles down and 25 Workers free; with the
  crew and a Roadworks' two Pavers, 23. Rivals have the same setting and build no Roadworks; they choose **No limit**
  (`aiRoadCrew`): every road a rival plans is to a site waiting on it, and building-beats-roads still takes its Workers
  to sites first. Held to 3 (or 5 while it had Workers to spare), a rival's planned road on Long haul stood two to five
  times as long (an average 15 tiles waiting against 6) and Hollow games that used to end ran to 75 minutes.
  **Paving order** (`paveMap`, `nextPaveTile`): a planned road grows out from the network its workers belong to (home's,
  the roads joined to a Command Base on their ground; or, for workers posted on a foothold, the roads joined to its
  stores and garrisons), one joined tile after another, so each stretch is usable as soon as it's down. A tile joins
  beside road on that network (or on a road leaving a finished building on it) or beside such a building; a site at
  the far end doesn't count. A stretch whose far end touches the player's road or a finished building of its (off the
  network too: paveMap's `tail`) grows from that end as well, so a crew works a long road from both ends, each end usable
  as it grows. A bridge or tunnel is built from the road beside it on that network: the home side. The tile goes to the free worker nearest it, and a worker still walking out from far
  off hands its tile over to one `PAVE_TAKE` (8) tiles nearer. A tile being paved counts as down already, so a second
  worker takes the next tile just past it (still growing outward, never past a bridge or tunnel going up), or another
  end or another road up to `PAVE_QUEUE` (8) tiles further off, so a crew spreads out rather than queue behind one tile. Before it sets off, a worker reckons up the walk there (its route, by road and off-road speeds), the paving and
  the walk back to the nearest charger it can reach (`paveShort`); if that would take it below `BATTERY.critical`
  (+2), it charges first (unless it's charged to 95% already, or there's nowhere to charge). A stretch of plan that
  joins nothing (laid out on its own) is still built: from its end nearest home (an end of the stretch, or a tile
  beside road or a building), inward, after a joined tile up to `PAVE_ALONE` (12) tiles further off; a bridge or tunnel
  out from bare ground (the rival's bridges) as soon as a joined tile would be. Measured on roads of 30 to 34 tiles
  from home to a far site on four maps (two with a bridge), one to three workers starting at home, by the far end or
  spread along it (36 runs): workers ran flat 58 times before and never since; the first 10 tiles from home were down
  in 57 s on average (98 s before) and the whole road in 141 s (193 s; sooner in 25 of the 36). Slower: three workers
  spread from home to the far end (112 s against 92), who used to pave from both ends at once. A worker that just found no way somewhere (walled in on the Wall it built,
  say: `u.failUntil`) sits out the next building and paving rounds, and isn't counted as soon free (`nearSoon`), so
  the others still come; a tile nobody can reach is skipped for a while (`paveSkip`). Calling off a planned tile refunds it. Roads double a bot's speed. Dragging
  plans roads round resources; tap a boulder, grove, ore or crystal tile to clear it for a road at 3× the Cement. A Roadworks' Pavers
  upgrade roads to asphalt (2.75×) with Asphalt, driving out along the roads joined to its Roadworks, however far.
- **Paving and road wear:** Paths → **Pave** (E): drag along roads to mark them for asphalt (drag over marked road to
  clear it). Roadworks pave the marked roads joined to them (or, set to *Every joined road*, everything; the AI builds no Roadworks). Every bot driving onto asphalt wears it (`WEAR_BOT`, Freight Trucks `WEAR_TRUCK`, three times as much): past
  half worn it slows bots (to 2.3× when nearly through), at `REPAVE_AT` a Paver resurfaces marked road, and worn
  through it drops back to plain road. On a busy trunk road that's every 8–10 minutes. Tap any of your roads to see its
  wear and mark it. Removing a road refunds its Cement.
- **Express highways** (`PAVE[3]`, `EXPRESS`, `laneSpeed` in `js/defs.js`; built Nov 2026 from the design sheet's
  direction A, the Expressway, on B's mechanics): a road tier above asphalt, `S.pave` 3, a one-way motorway lane a tile
  wide (always one-way: `setRoadDir` refuses two-way on it). Paths → **Express** (Shift+E, beside Pave): a drag lays a
  **pair** (the dragged tiles the drag's way, the lane on their left back, the outer lane filling a 2×2 bend:
  `expressLanes` in `js/ui.js`), Shift-drag or the banner's **Single lane** one lane. Over your own roads it upgrades in
  place; elsewhere the base is a planned road (Cement) with the lane's direction noted in `S.xdir` until Workers lay it
  (`layRoad`), when it turns one-way and marked `S.paveMark` 2 (1 is the asphalt mark; `paveWant`). The Roadworks'
  Pavers then surface it exactly as it paves asphalt, nearest first (`findPaveSpot`, `needsPaving`), paid from the
  Roadworks' stock as it reaches each tile: 1 Asphalt, and a quarter Alloy when it first goes up (`expressShort`,
  `expressPay`; Haulers bring the Roadworks Alloy once any lane is marked, `expressMarked`). Speeds (`expressSpeed`):
  Road Trains 5.5× (2× asphalt), Freight Trucks and Tankers 4.5×, warbots and the Paver at asphalt speed; Haulers,
  Workers, Agribots and Crawlers never drive along one: `findPath` (`opts.lane`, from `routeOpts`) lets a barred bot
  step onto a lane only across its direction (an overpass, a ramp), never along it, so keep an ordinary road for them.
  Wear as asphalt (same counters, slows past half, resurfaced at `REPAVE_AT`, 1 Asphalt); worn through it drops to
  asphalt, lights out (`wearRoad`). The step across between a pair's two carriageways (two one-way tiles side by side, same axis) is no junction
  (`sideLane` in `js/world.js`, Nov 21 2026: before, every tile of a two-way lane slowed traffic as a junction). An
  ordinary road touching a lane's side is a ramp (a junction: give way); where a
  road crosses a lane (four roads on a lane tile) an overpass is planned for its owner (`expressJoins`, from `layRoad`
  and the paths order; the sketches count them, `draftOverpasses`); lanes never cross each other, nor a lane only planned (`S.xdir`: the paths order and
  `expressDrag` refuse the crossing tile). A lane runs under a Maglev pylon as a road does. The art is drawn in
  code (`drawExpress` in `js/render.js`: median, barrier, amber and white lines, cat's-eyes, hazard aprons at ramps,
  ends narrowing onto a road; `laneMate` finds the partner lane); at night `drawRoadGlow` lights the cat's-eyes and a
  strip in the owner's colour along the median, and `streetLamps` puts the asphalt lamps on the median. Sign gantries (render-only, `expressGantries`/`drawGantry` in
  js/render.js): one every `GANTRY_GAP` (14) tiles along a straight stretch of a pair, never over an overpass or a bend, a
  steel lattice beam across both carriageways with a blank green board over each lane on its oncoming side, lit at night. Under
  `EXPRESS.minLen` (8) tiles the tool says it's too short to pay. Rivals build none yet; raiders tear lanes up like roads.
  Allowed in the Hollow. **Arterial** in Roads and Traffic has two prepared strips, a stocked Roadworks and a survey
  Depot. Mark the pair, close both side gaps, let the Paver surface it, then use the Depot’s Cement supply order.
  The mission counts completed Freight Truck deliveries that actually travelled along Express. `hashState` covers
  `S.pave`, `S.paveMark`, `S.xdir` and Arterial’s delivery progress.
- **Bridges and tunnels:** a road dragged out over water (or a canyon) in Roads carries on as a bridge, and through
  rocky crags as a tunnel, so there's no need to switch tools. The **Bridges** tool in Paths plans them too:
  a bridge costs 2 Cement and half an Alloy a tile (cheaper than a Viaduct span: Islands live on bridges), a tunnel 3 Cement and 1 Alloy (`CROSS` in `js/defs.js`;
  `bridgeable`; a Sky bridge over the old `T_CHASM` canyons, 3 Cement and half an Alloy, survives for old saves). Workers build them out from the shore or rock face (6–9 s a tile), and
  they join land on any level. A bridge is drawn as one level span at the height of the highest clifftop it lands on
  (`deckLevel` in `js/render.js`), ramping down at a lower end; its piers, end towers and suspension cables reach past
  the tile, so `drawBridgeRigging` draws them each frame over the map. Lay road routes use them only when going round is much longer.
  A bridge can be pushed out over water past your border, a tile at a time from your land or a bridge (`bridgeHead`).
  Like a Viaduct's far end, where a bridge comes ashore on no-one's land the ground within `VIA_CLAIM` (3) tiles of the
  landing is claimed for whoever's land the bridge runs out from (`computeTerritory` traces each bridge from its owner's
  border or shore; land only, never water or anyone's land), so an Outpost can go on the new island, even right at the
  end of the bridge. Territory is recomputed whenever a bridge tile is built or removed.
- **Plans that wait for goods** (`settlePlans`, `S.planQ` in `js/sim.js`): anything you plan in Paths (road, bridge and
  tunnel tiles, track, Walls, Gates, Ramps, traffic lights and overpasses) and Viaducts can be planned without the goods.
  Planning the same thing again moves it to the back of the queue, once (`queuePlan`). Each joins a queue, oldest
  first, and `settlePlans` (once a second, and right after you plan) pays for what it can from storage; a good an
  older plan is still waiting for isn't spent on a newer one. Road tiles waiting for their goods are flagged in
  `S.owe` (workers pave only paid tiles: `planList` vs `planAll`), track waiting to go down in `S.railPlan`, and
  store-paid sites (`prepaid` Walls, Gates and Viaducts, and every Ramp planned in Paths, `b.fromStore`) take their goods a
  unit at a time (`payInto`) and are built as far as their goods go. Calling off an unpaid tile gives nothing back; a
  half-paid site gives back what it holds. The computer still pays up front (`canPlace` keeps its check for AI players).
  Dragging a road or track across a one-level cliff plans a Ramp there (`dragCliff`: on whichever side can take one,
  preferring a tile with no road or track yet; two levels or more, or no room, says so in the banner). The Ramp is the
  road on its tile, and the track over one waits in the queue until it's finished. Ramps don't count against
  `MAX_SITES` (they're part of a path), so a plan never quietly loses its Ramp when six buildings are going up.
- **Junctions, traffic lights and overpasses:** where three or four roads meet, bots slow down and give way to traffic
  already crossing. Switch the Paths banner to **Junctions** and tap a junction to put up a traffic light (1 Alloy): it
  lets one direction through at a time, switching when traffic waits the other way. On a busy crossing a light moves
  half as many goods again or more, while on a quiet one it costs a few percent (a light switches as soon as nobody is
  coming on green; `LIGHT_MIN_GREEN` only holds while green traffic is still coming). Tap the light again for an **overpass** (4 Cement,
  3 Alloy), only on a crossing of four roads (`isCrossing`: `roadNet().junc` holds 3 or 4): the east-west road passes over
  the north-south one and nobody slows or waits, but **nobody turns there**. `findPath` only steps onto an overpass
  straight on, as one move from the tile before it to the tile after it (across overpasses in a row, every step paid
  for, the overpass tiles kept in the path); a route may still start or end on one. `roadNet` gives the tile two
  labels, `comp` for its east-west road and `compV` for its north-south one (see `tileNets`, `laneComp`), so roads that
  only meet at an overpass are separate networks, and `roadSearch`, Route to (`routeSearch`) and the zones
  (`computeZones`) go straight across too. A route planned before the overpass went up and turning on it is planned
  again (`routeCheck`). On a T-junction the second tap clears the light and says why (`OVER_T_WHY`); an overpass left on
  one (a crossing that lost a road, or an older save) becomes a traffic light (`overToLight`, the rest of its cost
  refunded) and a planned one a planned light. Tap again to clear it. Short of goods, a tap
  plans the light or overpass instead (`S.junPlan`, a `'j'` entry in `S.planQ`): it's paid all at once when the goods
  are in (oldest plans first) and goes up then; a light already standing keeps working while its overpass waits, and its
  Alloy counts toward it (`junPlanCost`). Calling a plan off gives nothing back; the AI pays up front.
- **Traffic map:** **Traffic map** in the Paths banner (or **T**) tints each road green to red by how busy it has been
  over the last minute and rings the spots where bots stand waiting. How busy each road has been (`HEAT.flow`, `countTraffic`)
  is kept in the save (`S.heat`): the AI picks its raids by it (`aiRaid`), and a loaded game must raid the same.
- **Goods flow map:** **Goods flow** beside it in the Paths banner (or **Shift+T**; one of the two maps at a time,
  `setRoadMap`) draws what each road and track tile has carried over about the last minute: a line along the road,
  wider the more goods went over it (five widths, `GFLOW_STEPS`: past 2, 5, 12 and 25 goods a minute), coloured by the
  good most of them were (`GOOD[g].color`), on a dark edge, red where bots stand in a jam (`HEAT.jam`, only read). A
  dashed ring in a good's colour marks a factory of yours idle for want of it (`flowStarved`), and the banner's key
  (`goodsFlowKey`) lists the goods on the move and how many factories wait. It is display only and outside `S`
  (`R.gf`, not saved, never read by a rule): `sampleGoodsFlow` (in `render`, every few frames, while a game is on) adds
  the goods aboard each of your moving robots times the distance it went since the last look to its tile's count for
  each good (a `Float32Array`, tiles × goods), and twice a second `fadeGoodsFlow` lets them fade with a time constant of
  a minute of game time (`GFLOW_FADE`) and works out each tile's total and main good. Only tiles in view are drawn, one
  stroke per good and width.
- **Long hauls:** tap a Depot and set **supply orders** (how much of each good to keep there). Goods come from your other
  storage, and anything nearby then draws on the Depot. A garrison that is storage too (the Command Base, a Drop Outpost,
  a Crawler) holds its own `ammoStock` back from supply orders and from other such garrisons (`ammoHeld`, `keepSupply`). Who carries what (see the comment above `TRUCK_MIN_DIST` in
  `js/defs.js` and `dispatch` in `js/sim.js`): **Haulers** (2) do runs under `TRUCK_MIN_DIST` (12) tiles. **Freight
  Trucks** (8; 2 Alloy and 2 Chips at the Foundry) do the long runs from any building, with a full load (a far
  factory gets up to `LONG_BUFFER` of each input), and storage to storage. With trucks around, Haulers take a long run
  only when the far building is about to run dry, and a far producer waits for a truck until its output is nearly
  full. A truck takes a supply order only for `TRUCK_KEEP_LOAD` (4) goods or more (or half the order, if smaller),
  unless the store has run dry. "Long" means 12+ tiles across plus down (`farApart`), as roads follow the grid. **Trunk runs** (`trunkRuns`): a store 12+ tiles from the Command Base sends home, in bulk, the goods nothing
  nearer to it uses (beyond its supply orders and `EXPORT_RESERVE`), by truck or Road Train only. **Road Trains**
  (30; 4 Alloy and 4 Chips) only do storage-to-storage runs 12+ tiles long, with `TRAIN_MIN_LOAD` (18) or more (any load
  without trucks). Trucks leave those loads to a Road Train that can get there (`roadTrainFor`): trunk loads build up
  to `TRAIN_MIN_LOAD`, and a supply order of twice that or more waits for a train load until the Depot is down to a
  third. **Backhauls** (`backhaul`): a truck or Road Train that delivers to far storage takes home what's waiting there
  (the trunk-run goods) instead of driving back empty. Measured on a 30-tile asphalt run with 2 trucks and a Road Train:
  missed supply at the far Depot fell from 63 to 11 uses in 10 minutes; trucks alone brought home 178 goods instead of 24. On plain road a Road Train runs at `TRAIN_ROAD` (35%); it takes corners slowly, holds `TRAIN_LEN` of
  queue behind it and wears the road by `WEAR_TRAIN`.
  On a straight asphalt trunk road one Road Train moves 1.5–1.75× what two trucks do; on plain road about the same or less.
  Idle trucks spread out: each store keeps one waiting, and spare trucks park at the nearest Depot (or Command Base)
  with none. Trucks are slower than Haulers on concrete (80%) and slow to accelerate, but fastest of all on asphalt.
  An audit of 35-minute autopilot games: trucks were busy 18–60% before these rules and 76–92% after, Haulers made
  about half as many long trips, and about a quarter more goods moved.
- **Ropeways** (`ROPE_*` in `js/defs.js`; `ropeLink`, `placeRopeway`, `ropewayAcross`): two stations 3–14 tiles apart
  joined straight across anything. Placed from Paths, not the Build menu: the **Ropeways** tool (**Shift+Y**), two taps
  (`ropewayTap`, the `link` order), like the Viaducts tool below. The near station is the construction site (it takes the whole cost); when it's built
  the far one goes up (`b.link` both ways). To the pathfinder a ride is an extra edge between the station tiles
  (`ROPE_COST` × a paved road of that length); zones and the road network join across it (`roadNet().comp`), but not for
  trucks (`compT`, `truckLinked`, `routeOpts.noRope`). Riders move at `ROPE_SPEED` (`u.ride`) and are drawn in gondolas.
- **Viaducts** (`VIA_*` in `js/defs.js`; `viaductBlocked`, `placeViaduct`, `viaductAcross` in `js/sim.js`; `viaLink` in
  `js/world.js`): two abutment buildings joined straight across lower ground, like a Ropeway's stations but level and
  open to every bot. Placed from Paths, not the Build menu: the **Viaducts** tool (**Shift+V**) starts the same two-tap
  placement a building card does (`enterPlaceMode`, `viaductTap`, the `link` order: `R.mode` is `'place'`), with the
  Paths tools kept on show (`crossingTools`, `pathsSeg`) and a road plan sketched in Paths kept meanwhile
  (`setMode(mode, keepPlan)`, `UI.planKept`): Cancel or the Viaduct placed goes back to it. (Their `BDEFS` stay: old
  saves and the AI build Viaducts through the sim; the AI never builds a Ropeway.) Paid up front (`prepaid`, its cost per site in `b.cost`, read with `siteCost`), built in
  `VIA_TIME` seconds a tile spanned (`b.buildTime`). To the pathfinder it's an edge between the abutment tiles at
  plain-road cost; zones, both road networks (`comp` and `compT`) and the railway (`railNbrs`) join across it. A bot
  out on the deck drives as if on the abutment it left (`moveAlong`), so the ground below is untouched and its traffic
  passes underneath. The deck, piers and girders are drawn each frame (`drawViaductDeck`). On Sky islands both ends must be
  mesa tops (level 3+), so a Viaduct never reaches the floor or its low rises. A far end may land on
  no-one's land or in a rival's (a bridgehead); `computeTerritory` keeps a Viaduct while either end stands in its
  owner's land (or the abutment is on no-one's), and takes it down once neither does. When one comes down, `offDeck`
  moves any bot on its deck to the nearer end (a civilian bot drops its order there, its load put down in crates; a
  warbot plans its way again), and a bot whose route jumps a Viaduct or Ropeway that's gone drops the
  route and its order (`moveAlong`). `roadSearch` crosses Viaducts, so roads (and the AI's) reach sites on far mesas,
  and `wouldBlock` / `canPlace` treat Outposts and Viaduct ends as walkable. A far end claims the no-one's ground
  within `VIA_CLAIM` (3) tiles, never anyone's land, so a new mesa can take an Outpost. A bot out on a deck keeps
  `u.deck` (the two ends) until it reaches one, so a new order or a chase starts from the deck, not the ground below.
- **Air: Airfields, the Cargo Plane and air drops** (every map). An **Airfield** (10 Cement, 4 Alloy; Build → Move) is
  a hangar with a runway `RUNWAY_LEN` (5) tiles long running straight out from it (`runwayDir`: the first of east, west,
  south, north with open, level ground of yours; kept in `b.rwy`, and nothing else goes on it: `runwayAt`). It is storage
  like a Depot. A **Cargo Plane** (6 rounds, built in the Airfield's hangar: `BDEFS.airfield.yard`, `updateYard`; `AIRFIELD_HOLDS`: one per Airfield, two Vulcan Bombers; orders past that wait as spares, built when one is lost, and the hangar builds the next type ordered meanwhile (`nextYardKind`; spare Cargo Planes used to hold up every bomber ordered there); the panel shows `hangarCount`) is based there (`u.home`, parked at the runway head). One load a flight (`u.mission`), dropped by parachute
  (`S.drops`, `AIR_DROP_FALL` s to come down): a **Drop Outpost** kit (6 Cement, 3 Alloy, paid from storage: a small
  outpost on any open ground nobody else holds; `terr` 4, garrison 2, `ammoStock` 4, storage, a 2-slot Fuel charger),
  two robots (Warbots from garrisons as for a march, or idle Workers, who board at the Airfield: the `board` task and
  `ferryWait`, as for a Ferry) anywhere, the enemy's land too, or up to 8 goods (`u.cargo`) for a place **supplied by
  air** (`b.airSupply`: any building with needs, construction sites too; a Drop Outpost and sites in its land have it
  on). Its supply orders then come by plane only, once one is based at an Airfield, not by Hauler (`dispatch`), until a
  road from home reaches the place (`onHomeNet`: a road, not a ferry line, the sea or a Rail Station's conveyor): then
  it switches itself off in `dispatch`, Drop Outposts and sites in their land too, and Haulers supply it (a finished
  building's owner is told; a site goes over quietly). Where a road from home already reaches, the `airSupply` order
  can't switch it on (its On button is greyed out, `airSupplyRoad`). A building that changes hands loses it (it was its
  old owner's choice), a Drop Outpost apart. Only the places switched to it are looked at. The
  places take turns (`airSupplyRun`: the one served longest ago, `c.airAt`, or run dry of something, first; `c.airIn`
  is when crates last landed there). A
  supply drop comes down as a crate for every few goods (`d.crates`), swaying under team parachutes, and lands in front of
  the building with a puff of dust, its parachute collapsing out flat beside it, before it's taken in (`crateland`;
  art from `renderer/b/airdrop.js`: chute-fall, chute, crate-drop, chute-flat). Each place is served from its nearest
  Airfield with a plane (`airBaseNear`); that Airfield keeps what they're
  short of (`airWant`, up to `AIR_KEEP` of each) plus `AIRFIELD_FUEL` (12) Fuel for its planes (`airKeep`), and haulers
  (Tankers, for the Fuel) bring it.
  A flight (`flyStep`): it rolls down the runway from its head gathering speed (`ROLL_ACCEL`), lifts off at the far end,
  climbs (`PLANE_CLIMB` s) and turns at up to `PLANE_TURN` (never circling a spot it can't turn onto: `steerPlane`), drops
  over the spot, flies a circuit round to line up with the runway (`headHome`), comes down on final, touches down at the
  far end and brakes (`ROLL_BRAKE`) back to the head. It burns `PLANE_BURN` of its tank a second (a full tank is about
  45 s of flight; `sortieFuel`, `planeReach`: it checks its range before it takes off); one Fuel at the Airfield puts
  back `PLANE_FILL[type]` of it (`planeFill`, `fuelPlane`): 20 for a Cargo Plane, whose long round trip so takes 4 to 6
  Fuel, 40 for a bomber. Short of the Fuel for a flight it waits at the Airfield and says so (`M.noFuel`: how much
  more). Each of your planes shows a fuel gauge over it (`drawPlane`) and in its panel; the Airfield's panel shows its
  Fuel against `AIRFIELD_FUEL` and about how many flights that covers (`airFuelText`, `typicalFlight`: a round trip of
  `AIR_TYPICAL` (30) tiles each way, a bomber's charge on top). With no Airfield left it comes down in the field and
  flies to the next one built. Only Flak Guns hurt aircraft in the air (`damageBot` passes them by). Off the road network, within `FOOT_CARRY` (12) tiles,
  Workers carry goods by hand between buildings no Hauler reaches (a Drop Outpost's goods to a site beside it).
  Warbots posted to a cut-off post (`secluded`: supplied by air, or where they can't walk to the Command Base) stay with
  it: they recharge and reload there, go for repairs, rally flags and attacks only within `SECLUDED_REACH` (16) of it,
  and dropped beside a garrison of yours they're posted to it.
  The AI never flies Cargo Planes.
- **Airships and Mooring Masts** (every map but the Hollow; `BOTS.airship`, `BDEFS.mast`, `AIRSHIP`). A **Mooring Mast**
  (6 Cement, 3 Alloy; Build → Move, key T) is a one-tile store. Two make a **line**: the `mastLine` order
  (`setMastLine`, `mastLineWhy`: both built, at least `AIRSHIP.minDist` (8) tiles apart, a Mast on one line at most;
  `b.line` on both ends, `mastPartner`) from a Mast's panel, **Link to another Mast** (key L, then a tap on the other:
  the `mastlink` mode) or **Unlink**; the line is drawn dashed between the mooring cups while either Mast or one of its
  Airships is selected (`drawMastLine`). An **Airship** (9 rounds of Alloy and Chips, built in an Airfield's hangar: no
  hangar spot, `airfieldRoom`) serves the line its home Mast (`u.home`) is on: with exactly one line a new one goes there
  by itself (`shipFindLine`), otherwise its panel's **Line** buttons (`shipLine` order, `setShipLine`); `AIRSHIP.perLine`
  (2) to a line. Unarmed, 40 hit points, at half a Cargo Plane's speed, 24 goods and 6 seats.
  Moored, it is inside its Mast, its nose at the mooring cup and its body back along the line (`shipMooring`,
  `AIRSHIP.nose`); it swings round when its Mast is linked anew. A crossing (`flyShip`): it rises off over `climb` (5) s,
  turning about at `turn`, flies straight over anything, slows and settles onto the other Mast over the last `settle` tiles
  (`u.alt`, so flak and the air layer treat it as any aircraft: `u.flight` is `{ ph: 'air', to, from }`), swings round to
  lie along the line and moors (`shipArrive`). Its tank drains `burn` (0.9) a second in the air; one Fuel puts back
  `PLANE_FILL.airship` (20); it fills up at either Mast (`fuelPlane`), and waits for Fuel there (`u.noFuel`, a message)
  before a crossing it can't make (`shipLegFuel`). Each Mast of a line with an Airship keeps `mastFuel` (8) Fuel
  (`mastFuelKeep`, in `needsOf` and kept back by `keepSupply`): Tankers bring it, or a pipeline. A Mast is a Fuel user to
  the pipes (`fuelUser`; a burner in `updatePipes`, not a source in `fuelSources`): **Pipe Fuel to it** runs pipe to the
  nearest Refinery, Bio Farm, storage or Fuel pipe (`pipeToFuel`); piped Fuel fills it up to what it keeps, it never hands
  its own out, and Fuel is relayed on through it like any Fuel user's (`fuelPipes`), and Tankers leave it be meanwhile
  (`fuelByPipe`).
  **Goods** reuse the rail plan (`railPlan`): a line's two Masts are its stations (`bulkLinked`), the one nearer the
  Command Base its home (`b.home`, `farStation`), and while an Airship serves the line (`airLines`) the far Mast stocks what
  the buildings within `STATION_REACH` of it need (`b.auto`; by road, touching it, or off the roads within `FOOT_CARRY` on
  the same ground, `footNear`; Fuel too, for a far side's chargers), the home Mast keeps that for it, and a far Mast's keep
  comes by Airship only (Haulers and trucks leave it, `dispatch`; nor do trunk runs truck its spare goods home). A trip's
  mixed load (`shipLoad`): what the other Mast keeps and is short of, from what this one can spare (all it holds when it
  is the nearer to the Command Base), and from a far Mast its spare goods for home (`spareForHome`, the backhaul: dry
  goods first, then Crude and Fuel; Fuel and Crude both fly, the owner's call, but never the Fuel a Mast keeps). It
  sets out once that fills `fill` (half) of the hold, with anything once the other side is down to a third of something
  it keeps, with `least` (4) after `wait` (75) s, or with riders aboard; otherwise it crosses empty to fetch a load or
  riders waiting at the other Mast, unless another of the line's Airships is there or on its way. Goods in the air count
  in the Mast's `inc` (`u.cargo`, `u.cargoTo`) and are lost if it is (`shipLost`). Off the roads, a building's output is
  carried by hand to a Mast on a line close by (`storeFor`).
  **Riders**: Workers and Warbots take a line in their routes (`airLink`, `airLines`; `findPath` joins a line's Masts at
  `routeCost` × the straight distance plus `routeBoard` tiles; `computeZones` joins their areas; `routeOpts.noAir` keeps
  Haulers and vehicles off), wait at the Mast (`ferryWait` with `air`), board (six seats; it waits `boardWait` s for
  more) and get off at the other Mast to carry on (`unloadFerry`). Flak shoots it down through `hitAircraft`; its riders
  go down with it. Drawn by `drawAirship` (from `drawPlane`, from a falling wreck's stand-in too): `AIRSHIP_ART`, 3 tiles
  across, a touch bigger as it climbs, hanging at the cup moored (the sim moors it there, `AIRSHIP.lift` up the screen
  from the Mast's tile, so it rises off and settles in place), its fans spinning in code, its shadow
  (`airship-shadow`) down-sun, a pool of team light under it at night. The rival AI builds no Masts or Airships (its flak
  shoots at them). The mission **Mooring Lines** (Sea and Sky) and the colony goal *Mooring lines* teach it.
- **Maglev lines** (every map, the Hollow too; `BDEFS.magterm`, `BDEFS.magpylon`, `BOTS.magpod`, `MAGLEV`). A **Maglev
  Terminal** (8 Cement, 6 Alloy, 3 Chips; Build → Move, key G) is a one-tile store whose conveyors join the buildings
  touching it (as a Rail Station's: `stationLinks`, `feedPreview`). The **line** is a Paths tool, **Maglev** (**Shift+M**,
  or **Plan a line from here** / **Add a line from here (hub)** on a Terminal's panel): two taps (`maglevTap`, the
  `magLine` order, `placeMagLine`), a finished Terminal of yours with a line to spare and then the far end, `MAGLEV.min`
  (6) to `max` (40) tiles away in any direction: a clear spot where the far Terminal goes up, a Terminal site of yours
  (the line's cost goes onto it) or a finished Terminal (then the line's site is a pylon site on the first spot,
  `s.magFar`). The far end is previewed on hover and tap (`maglevPreview`, `R.ropeEnd`, `drawMaglevPreview`): the band
  (red and dashed past the first blocked spot) and every pylon spot ringed in its colour (`MAG_SPOT`: green a pylon, blue
  one over a road or track, yellow one shifted a tile with a tick back to its spot, white dashed a gap spanned, red with a
  cross where nothing can stand), the first blocked spot's reason written beside it (`magLabel`) and in the banner ("No
  line this way: a Depot stands where a pylon must go (9 tiles out)."). A far end tapped on a road or building snaps to a
  good tile beside it. **Bends** (`MAGLEV.bends` 4, the `magLine` order's `bends`, `b.magBends` on the line's key end,
  in order from it; `magPathOf`, `magSpotsPath`, `magBendsWhy`, `magBendTry`): tap a spot on the way and **Bend here** in
  the banner (`maglevBendButtons`, `UI.ropeBends`; **Undo bend**); each straight stretch `seg` (3) to `max` tiles,
  `maxBent` (60) in all, turning at most `turn` (120°) at a bend; a bend is a pylon spot of its own on the bend tile
  (never shifted: blocked there, the line can't bend there); the line's cost and build time go by its length along the
  bends. **Edit bends** on a built line (a Terminal's panel, by each line: `openMagEdit`, `UI.magEdit`, `maglevEditTap`,
  `maglevEditShow`; the `magRebend` order, `placeMagRebend`): pick a bend and put it elsewhere, Remove bend, add one by
  tapping near the line (it goes on the stretch passing nearest), Straighten; checked as a new line is (`magEditCheck`,
  the same messages). With a mouse a bend's diamond can also be dragged (`magBendGrab` via `mapGrab`/input.js `onGrab`,
  `UI.bendDrag`; the hand cursor over a diamond, `cursorTick`): the preview follows tile by tile, `magEditCheck` run only
  when the pointer reaches a new tile (about 0.02 ms, 1.3 ms with the banner); letting go on a good tile puts the bend
  there as a second tap would, on a bad one or with Esc (`maglevDragCancel`) it goes back, and a drag that never leaves
  the tile is a tap. A finger keeps tap-to-pick and tap-to-place (its drags pan). UI only: Build sends the same order. It's a construction job: a pylon site on the first new pylon spot (`s.magEdit`, `s.magFrom` the
  key end, `s.magFar`, the new `s.magBends`/`s.magLayout`; the key end's `b.magEditSite`), built by a Worker at the key
  Terminal, costing only the length added and each new pylon's footing (`MAGLEV.cost` a tile, and once a pylon); the
  old guideway runs meanwhile (the new path drawn dashed with its progress). From 90% no pod sets out on the line or
  passes through onto it (`magEditHold`) and the switch-over waits until none runs on it (`magEditBusy`), so no pod is
  ever on a guideway that moves. At the switch-over (`magEditDone`, `magEditApply`) the pylons on the new path stay
  (renumbered), new ones go up, the rest come down (`p.magGone`: not a cut), and they and any length taken off come
  back as crates by the key Terminal, as a dismantled building's goods do; a repair under way is called off; a lost
  Terminal at either end calls the job off. With no new pylon needed (a bend taken out, say) it's done at once.
  **Route with bends** (`magRouteBend`): a bend beside the straight way, or a jog of two, the shortest that
  works, offered first when a straight line can't go (blocked, or 40 to 60 tiles). **Route via a hub** (`magRouteVia`, `magRouteWhy`, `placeMagRoute`; the `magLine` order with the
  hub's tile): where a straight line can't go (a blocked stretch, or more than `max` tiles, up to twice that), the tool
  looks along and beside the straight line for the shortest pair of lines through a new hub Terminal and offers it; the
  order plans the first line to the hub, and the hub's site carries the far end (`s.magNext`), planned from the hub by
  `magLineDone` once it stands. Pylon spots (`magSpotsAt`, `magSpotsChecked`): every `spacing` (3) tiles from the line's
  **key end**, none within 2 of the other; a spot over a road or track is kept there (`sp.road`, `magOverWay`: drawn as a portal over the
  way, `drawMagPortal`, two legs on the kerb, `magPylonOffset`, either side of the deck and a striped crossbeam under
  it; `passTile` lets every road user through, so the road works under it), and a blocked one shifts to a free shoulder tile (`sp.moved`). Its footing can't occupy a building,
  another line's pylon, slope, oil seep, runway, Trade Post or Uplink, scorched ground or a rival's land (`magSpotWhy`);
  a boulder or grove there is cleared when the pylon goes up (`magClearSpot`); a chasm or rock under a spot is `skip`
  (the span goes over) unless the spot before it was skipped too, so a line crosses a gap of at most `gap` (6) tiles.
  The far Terminal's tile must be clear ground, not a road or track (`magFarBlocked`). It costs `MAGLEV.cost` a tile (1
  Alloy, ½ Chip, 1 Cement, Chips rounded up: `magLineCost`), prepaid from storage like a Viaduct (`fromStore`,
  `queuePlan`); the Worker builds the site standing at the Terminal it was planned from (`siteWorkAt`, `assignBuild`),
  `time` (3) s a tile plus the Terminal's own build time, and the pylons go up one by one as it gets along
  (`magBuildStep`, buildings of type `magpylon` with `b.k` and `b.line` the key Terminal's id); `completeBuilding` opens
  the line (`magLineDone`, `magJoin`).
  **Hubs and networks.** A Terminal is on up to `MAGLEV.hub` (3) lines: `b.line`, then `b.magMore` (`magLinkIds`,
  `magLinked`, `magPartners`; `magPartner` is the first). Each line has a **key end** (`magKey`: `b.magNear` on it, the
  line's other end in its `b.line`) that numbers the pylons, carries their id (`p.line`), holds their layout
  (`b.magLayout`) and the repair job (`b.magFix`; `magKeyPartner`, `magLines`). A Terminal keys one line at most
  (`magKeyBusy`), so a pylon's `p.line` names its line: a line planned from a Terminal that keys one already is keyed at
  its far end (`s.magKey`: the pylons are counted from there, and still go up from the near end as the Worker gets
  along), and two finished Terminals that both key a line can't be joined ("join them through a new Terminal"). Lines
  joined at hubs make a **network** (`magNet`). Its pods serve all of it (`linePods`: their home is any of its
  Terminals; `magPodCap`: `perLine` for each line), built at any of its Terminals; a pod at a hub picks the line with
  the biggest load worth taking (the first in the hub's order on a tie: `podAtTerminal`), so goods cross the network
  in one run: nearing a hub (`u.thruTo`, planned 4 tiles out: `podThroughPlan`) a pod that holds goods a Terminal
  beyond it is short of (by the rail plan's tree), or, heading home, goods the hub doesn't keep, passes through without
  stopping (`podThrough`, at `corner` of its top speed): those stay aboard, the rest is unloaded there, it tops up with
  what the hub holds for the next line, and `b.magThrough` counts it; with nothing to carry on it docks as before. It
  never waits at a hub for a line. The rail plan makes each network (and Terminals of two lines touching: a conveyor,
  `b.magRelay`, `magRelaySwap`) a tree from its Terminal nearest the Command Base (`magRelayPlan`): every other
  Terminal's home is the one before it, so `shipLoad` lends a parent's goods to its child and sends a child's spare goods
  home to its parent, and each Terminal's demand rolls up to its parent (`railPlan`), so a hub keeps what the Terminals
  beyond it want. Cancelling a new line site takes its pylons down (`magLineCancel`). Pylons claim no land (`civClaims`).
  **Pods** (`BOTS.magpod`: 16 goods, mixed, no riders; speed 3 × a Freight Train's, 4 × its acceleration and braking)
  are built at a Terminal's **Pod bay** (its yard: two rounds of `BOTS.magpod.round`, 2 Alloy and 1 Chip, so 4 and
  2 each), up to the network's cap (`magPodRoom`, `yardOpen`). Docked, a pod is inside its Terminal (`u.home`); running,
  `u.magFrom` and `u.magTo` are the two ends of the line it's on, `u.magS` how far along the line's path it is from
  `magFrom` and `u.x, u.y` its place there (`movePod`, `magLinePts`, `magPathAt`: accelerating and braking hard, slowing
  to 0.6 of its top speed round a bend of 30° or more and to `corner` (0.35) round one of 75° or more, arriving
  `podArrive`; a save from before `magS` places it by its position, `magPathProject`). Loads reuse the rail plan exactly as
  the Airship's do (`railPlan` counts the Terminals as a line's stations, `bulkLinked`; the far Terminal stocks what the
  buildings round it need, `magRunning` standing in for a train on the line; `shipLoad` picks the mixed load,
  `spareForHome` the backhaul; a pod sets out at `fill` (half) of its hold, with anything once the far side runs low,
  with `least` (2) after `wait` (60) s, or crosses empty to fetch a load waiting at the other end unless another pod is
  there or on its way: `podAtTerminal`, dwelling `dwell` (2.5) s). Goods on a pod count in the destination's `inc`
  (`u.cargo`, `u.cargoTo`) and are lost with it (`podLost`); `b.magGot` counts what arrived (the mission and the colony
  goal). Pods are never haulers (`isIdleWorker`).
  **Power** (`magPowered`): a Generator of the owner's within its radius (4) of the Terminal with Fuel in it (or energy
  left), not turned off nor cut by the Murmur; a line runs at speed with both its ends powered and no solar flare
  (`magPairPowered`, `flareOn`; `magLinePowered`: every line of a Terminal). A Terminal on a line counts as something in
  reach working to its Generator (`updateGenerator`; `b.working` while a pod runs to or from it), so the Generator burns
  Fuel for the line. Without power the pods run at `WORKER_SPEED` (`u.crawl`) and the guideway's night glow dims. The
  Murmur: a running Terminal is worth a Generator to their tunnels (`chargeWorth`) and is on their cut list
  (`murmurPlan`); a cut Terminal is unpowered.
  **Shot down**: a pylon is a building with a Wall's armour (24), so warbots, Howitzers, bombers, Missiles and the
  rival's guns hit it as any building; the guideway can't be shot. `destroyBuilding` → `magPylonDown`: pods on its line
  (`podOnLine`) within `spacing` tiles of the pylon (the two spans it carried) are lost with their loads (a small blast),
  pods heading across the break turn back (`podReverse`: their load goes back into the Terminal they left), and the cut
  (`magCut`: standing spots with no pylon; `magPairCut`, `magLineCut`) stops the pods using that line (the Terminals'
  status and panel say so). **Repair**: the key Terminal's `b.magFix` (`updateMagTerm`): once `spacing` tiles' worth of
  goods is paid from storage, a Worker from the end nearer the break (`magFixEnd`, `assignMagFix`, task `magfix`) walks
  there, rides out of sight (`doMagFix`) and the pylon stands again after `repair` (20) s.
  **A Terminal lost** (`destroyBuilding` → `magTermDown`): each of its lines is **suspended**, not lost: the guideway and
  pylons stand, and the Terminal at the other end keeps it (`b.magMissing`, then `b.magMissMore`; `magMiss`): the lost
  one's tile, whether it was the key (`near`), and then its id (`key`: the pylons keep carrying it) and their layout.
  Pods heading for it turn back with their loads (`podReverse`), pods docked in it go to a Terminal it was joined to,
  and none set out on a suspended line; a line whose other end was lost already comes down with it. It's drawn broken
  (an amber dashed stripe down the deck, the lost Terminal's outline pulsing on its tile, no glow) and the survivor's
  panel says so, with **Rebuild the missing Terminal**: the `magLine` order to the lost tile plans a Terminal site there
  (`magRebuildSite`), at a Terminal's ordinary cost (on its old foundation at half a Terminal's cost, rounded up:
  `magRebuildCost`, the owner's call; the guideway is free; a Terminal built there by hand costs the whole price), and when it stands every line that ended on that tile joins it
  again (`magRebuilt`, `magReconnect`: if the lost end was the key, the new Terminal takes the pylons and layout over).
  A Terminal built there by hand does the same. A Terminal with a suspended line may still start another (it counts
  among its three). A save from before kept the lost key's pylons on the survivor (`near` with no `key`): still read so.
  **Drawn** by `drawMaglevShadows` (the bands' shadows on the ground, `MAG_SHADOW` of the deck height down-sun, before
  the buildings) and `drawMaglevs` (after the buildings and robots, under the air): the pylon sprites (`magpylon@T`, a
  `B3D` building with no pad; squashed or stretched so its head stays under the band, `MAG_LEVEL` 0.3 a level of ground
  against the line's ends), the fallen pylon (`magpylon-cut@T`) in each cut, a straight band of the guideway tile
  (`magdeck@T`, one tile running east, repeated: `magBand`) from dock to dock `MAGLEV.head` (0.464) tiles up the screen
  (the Terminal art's `head` mark; a pylon's head is `MAGLEV.deck`, 0.343, over its foot), split at every cut
  (`magSpans`), its night glow in the team colour (`magGlow`, dim unpowered), the pods (`magpod@T` loaded, `magpod-empty@T`
  with the hatch shut) turned along their line at deck height with a shadow below (`drawMagPod`), one docked at each
  Terminal, a repair pod riding out, a suspended line broken, a line going up as far as it's got with the rest dashed,
  and the placement preview (`drawMaglevPreview`, both lines of a Route via a hub with the hub labelled). Everything is
  in `S` and hashed (`hashState`: the lines and hubs, keys, pods, sites, repairs and suspended lines) and checked on
  load (`checkSave`); nothing is baked. The Architect (`aiMaglev`, `AI_MAGLEV`) builds one line from its twelfth minute on Normal and up: from a Terminal by
  its Command Base to its far working cluster (a Depot or Outpost 24 tiles out or more with three working buildings round
  it, no Rail Station there), straight or with bends, once it holds the line's goods and 30 Alloy and 15 Chips besides
  (rare: it spends them as it makes them), then a Generator by each end and two pods; the other doctrines build none
  (IDEAS.md has the measurements). The mission **Phase 2** (Industry and
  Trade: its last goal a hub) and the colony goal *Phase 2* teach it.
- **Mass Drivers** (every map but the Hollow; `BDEFS.mdriver`, `BDEFS.catcher`, `MASSDRIVER`; the owner's look A, "Coil
  Ramp"; two-way, automatic, 50 tiles and 16-good canisters since Nov 26 2026). A **Mass Driver** (12 Cement, 10 Alloy, 5
  Chips; Build → Move, key V) and a **Catcher** (8 Cement, 5 Alloy, 3 Chips; key C) are stores, and both are **ends** of
  a line (`mdEnd`): each fires and catches. The Driver is **two tiles** (`def.long`): its own tile and the one east
  (`b.mdAxis` 'ew') or south ('ns') of it (`longTile`), set as it's placed (R or the banner's Turn: `UI.mdAxis`,
  `mdTurn`; the `place` and `moveBuilding` orders take the axis); `S.bAt` holds it on both (`longClaim`, `longRelease`,
  `setLongAxis`), so the second tile blocks the way and building and a tap there picks it; `canPlace` checks both tiles
  (level, the same rules each); `touching` looks round both, so conveyors join buildings at either; its door is its own
  tile; it's drawn over the middle of the two (`bCentre`); a save from before the two tiles lays it east-west. On the
  Driver's panel **Aim** (`startMdAim`, mode `mdaim`, `mdAimTap`, the `mdAim` order, `setMdAim`, `mdAimWhy`) sets
  `b.mdTo`: a Catcher of yours `min` (12) to `max` (50) tiles away, or an Outpost or Keep (`forts`, `mdFortType`) to
  keep supplied one way (`mdCatcher` gives the far end). A Catcher takes `drivers` (2) Drivers at most (`mdDriversOf`: the first two built; `mdAimWhy` refuses a third,
  "That Catcher already takes 2 Mass Drivers") and fires to each in turn (`mdPartners`; `b.mdNext`). **The plan** (`mdPlan`, from `dispatch` every 2 s, nothing for a player with no ends):
  the end farther from the Command Base is the far end (`mdIsFar`, `b.mdFar`); it keeps what the buildings round it need
  (`b.auto`, worked out as a far Rail Station's in `railPlan`: within `STATION_REACH`, nearer it than the Command Base
  by `STATION_NEARER`, touching it, by road or on foot (`footNear`); twice a working building's fill, a site's lack;
  Fuel too, never Crude), and Haulers leave its keep to the canisters (`dispatch`). Each end ships to each partner
  (`b.mdAuto`: {partner id: {good: n}}) what that partner lacks (`mdLack`: its keep, its supply orders, or a fort's
  `needsOf`, less what's in flight, `mdFlying`); a far end adds what it can spare going home (`spareForHome`, not what
  the other end sends it: `mdSends`). **Goods list** (`b.mdSend`, on either end; `mdSend`/`mdReserve`/`mdAuto` orders:
  up to `goods` (3), no Crude, each with the reserve kept home, `reserve` 20, ±`reserveStep` 10) overrides an end's plan
  (not toward a fort). The near end's goods to send (`mdSendGoods`) are a standing supply order (`needsOf` → `mdWant`):
  Haulers bring what the colony holds beyond the reserve (`tickTotal` less `mdHeld`), up to `hopper` (32) (or what it
  ships); that stock is for its canisters (`supplyOf` less `mdHold`). A far end ships what it holds (`mdAvail`:
  `keepSupply`). Conveyors (`mdConveyor`, every `feed` s): the near end takes the goods it sends from a Command Base or
  Depot touching it and from the factories touching it that make them; every end feeds the factories and sites touching
  it (Fuel to a Generator); a far end takes the output of the factories touching it. **Firing** (`updateMassDriver`):
  with power and a partner, once it has `load` (16) goods for one (or `partMin` 4, or the whole of a smaller need, after
  `partWait` 20 s) it charges (`b.mdFire`, `b.mdAt`, `charge` 1.6 s; `b.working`, so its Generator burns Fuel) and fires
  (`mdLaunch`: a unit of each good in turn), a shot every `reload` (8) s from each end, or `reloadLand` (10) s when a robot could walk from one end to the other (`mdOverland`: the two ends in one area of `walkZones`, the walking areas of `zoneFill` without the Ropeway, Viaduct, ferry and Airship links; `mdReload`; the owner, Nov 26 2026: then it is a shortcut over land, not a crossing; each end's panel shows its Rate and why) (6 s and 10/8/4 and 6/4/2 costs before the Nov 26 2026 balance pass, when a line out-carried a 4-pod Maglev line for a quarter of its cost). **Power**: no Fuel of its own; an
  end fires only with a Generator in reach (`magPowered`), and waits loaded without one (it still catches). **Canisters**
  (`S.cans`: id, owner, from, to, goods, t, dur, ends, hp): fly `flightMin` (2) to `flight` (4) s by range in an arc
  `arc` (6) tiles high at full range (`canPos`, `canAlt`); land in their end (`updateCans`: its stock, `mdGot`,
  `mdCaught`), or, that gone, as crates on its tile (`canDown`, `addLoot`). **Flak**: an enemy Flak Gun with no aircraft
  in reach targets the nearest canister in the air (`canNear`, leading it; not in the first and last `low` of its
  flight), and its bursts take `hp` (4) off canisters in the splash (`canFlak`): a canister burst falls as crates where it
  was. Saves keep `S.cans` and the ends' fields (`checkSave`); `hashState` hashes both; a save from before (a one-way
  Driver, often with a goods list) loads as a two-way pair, its list kept as the Driver's override. **Catcher kit**
  (Nov 26 2026): the Driver's panel **Throw a Catcher kit** (`startMdAim(b, true)`, `UI.mdKit`, the `mdKit` order,
  `setMdKit`, `mdKitWhy`) pays the Catcher's cost from storage (`payRoad`; called off before it flies, `refundRoad`)
  and sets `b.mdKit` (the tile); the Driver charges for it before anything else (`b.mdAt` 0) and throws it
  (`mdLaunchKit`: a canister with `kit` 1, no end, `to` 0) to open, empty ground `min`–`max` tiles off that no one else
  holds, not within `kitClaim` + 1 of a Trade Post, whose ring cuts no rival off (`mdKitGround`, `ringOverRival`). It
  lands (`mdKitLand`) as a Catcher site on its tile (or the nearest that will take it within 2; none, its goods fall as
  crates) holding its cost, `b.kitT` 1: it assembles itself over `kitBuild` (20) s, no Worker needed (`updateBuilding`),
  then claims `kitClaim` (3) tiles of land (`b.claim`, a military claim as a Port founded by sea has); the Driver is
  aimed at it. Flak bursts a kit as any canister (`canDown`: "A Catcher kit was shot down"). **Far end full**: what a
  far end has room for (`mdRoom`: `full` (64) of a good, or its keep if more, less what it holds and what's in flight)
  caps every load toward it (`mdAvail`), so a goods list to a far end nothing collects from stops; the near end's status
  and panel say "Far end full" (`mdFullGoods`). **The rival** (`aiMassDriver`, `AI_MDRIVER`; Medium and up, one pair,
  the Architect from 600 s, the others from 900 s, every 20 s): on a map of islands, mesas or canyons (`aiMdMap`:
  Islands, Sky islands, Four Isles, Canyon maze, Grand Canyon) to its nearest fort or store 16–52 tiles out on ground its
  robots can't walk to (another `walkZones` area: over a Viaduct, a landing's), elsewhere only to one no link or road
  reaches; with the goods for both ends and a spare, a Driver site 3–9 tiles from its Command Base facing it, a
  Generator by it, and a Catcher site by the foothold (`aiMdFarSpots`) when its Workers and Haulers get there (the same
  `S.zone`), else a Catcher kit once the Driver stands; then it aims the Driver, and `mdPlan` runs the line. Lost, it
  tries again after 300 s. Not in the Hollow (`worldBan`). **Drawn**: the Driver's art points along its tiles toward its far end
  (`mdriver-<dir>@T`, e/w lying east-west, n/s north-south, `mdDir`; framed wide, `MD_FRAME`), the Catcher's arms swing
  in as one lands (`catcher-closed@T`, `mdArmsIn`); `drawMassDrivers` (in the air layer) lights the coils in sequence
  while it charges, with arcs crackling up the rail from the breech, the shot's flash, a faint guidance beam while a
  canister flies (from the muzzle or the cradle, to the cradle, the muzzle or a fort's roof: `mdPort`), the canister (a
  stubby gunmetal cargo container, ribbed, with corner castings, a team-colour band and an amber running light, holding
  its heading) with its streak and shadow, the coils' faint glow after dark, and the aiming preview (the reach, your
  Catchers and forts ringed, the arc to the one under the pointer); a Catcher charging gathers a glow and arcs in its
  funnel and flashes as it fires (`drawCatcherLamps`), and a Driver catching one flashes at its muzzle; `MD_ART` holds
  the renders' marks. Sounds: `mdcharge`, `mdlaunch` (the crack and the whistle), `mdcatch`, `mdburst`, `mdthud`. The
  mission **The Schedule** (Industry and Trade) teaches it: the line, power at both ends, Auto and a goods list, and
  the camp's spare coming home. `node tools/massdriver-test.js` checks both ways, Auto, 50 tiles over the sea on
  Islands, Outpost resupply, Flak, an old save, the Catcher kit (refusals, a save in flight, self-assembly, its land,
  Flak), Far end full and a rival's pair. Measured over 30 tiles (kept loaded): 160 goods a minute each way
  (the one-way Driver before: 72; a Maglev line with 4 pods: about 120).
- **Vulcan Bombers** (Versus; `BOTS.bomber`, `BOMBER`): built in an Airfield's hangar, two to a hangar. A sortie
  (`orderStrike`, `strikeBlocked`: parked, in reach of a full tank) loads `BOMBER.ammo` (6) Ammo at its Airfield (which
  keeps that much a bomber, `airKeep`) and `BOMBER.fuel` (3) Fuel on top of what its tank needs (`tankFuel`; it takes
  off only with all of it there, none taken till then, and says what it waits for; till it takes off the `strikeCancel` order,
  `cancelStrike`, calls the strike off from the Airfield's or the Army panel, the Ammo it loaded going back), flies out like a Cargo Plane and over the target drops one bomb
  (`bombDrop`; a vehicle on the move is led, and a target that's gone sends it home): `damage` 14 to the building aimed at
  (a Command Base or Keep held at `missileFloor`, see `captureOnly`), `splashBld` 4 to others and `botDamage` 8 to robots within `splash` 1.3, double on a
  vehicle hit squarely (a Tanker explodes). Home again it rearms for `rearm` 25 s (`bomberOnGround`); a bomb it didn't
  drop goes back into Ammo (the sortie's Fuel is spent). Flak Guns shoot it down. The AI (not a Warden) builds an Airfield from 22 minutes with its Ammo
  Plant running, one bomber, and a sortie at most every `AI_BOMB_GAP` (240) s at the most valuable building or loaded
  Tanker no Flak covers (`aiBomber`, `AI_BOMB_VALUE`). With the Airfield it puts up one more Fuel maker, decided once
  (`P.airFuel`): a Refinery while its Oil Pumps outnumber its Refineries, else a Bio Farm where there's soil its farms
  don't work, else a Refinery (and a pump) on oil; it goes up even with Fuel in stock.
  A Viaduct's deck can be bombed: a tap on a deck tile (`crossingAtTap` / `viaductOver`, which also make a tap on a deck
  or a Ropeway's cable select its nearer end) sends the `strike` order with that tile; the mission keeps it
  (`u.mission.deck`), the bomber flies there (`strikeAim`) and the bomb (`m.deck`) falls on it. It counts against the
  span: `damage` off the end nearer it, or the other end if that's the weaker (`deckBombEnd`), so two bombs anywhere on
  a deck bring it down (an end's `armor` is 24, and one end falling takes the other). The check that holds a bomb when
  those already falling will finish the target reckons a Viaduct as a span (`spanDoomed`).
- **Napalm** (`NAPALM`, the bomber's other payload): picking a bomber's target the strike banner's **Payload** switch
  (`strikeSeg`, keys B and N, `UI.strikeKind`) chooses Bomb or Napalm; a building's panel has **Napalm** beside **Bomb
  it**, and any fertile soil or crop tile **Napalm it** (`napalmSection`, `refreshNapalmSection`: whenever you have a
  Vulcan Bomber, whoever farms it; on your own (`soilHolder`) it reads **Napalm your own farmland**, and greyed out
  the hint says why: rearming, out on sorties, out of reach) (`napalmFromPanel`). The `napalm` order (`orderNapalm`,
  `napalmBlocked`: parked, any `T_GROUND` tile in reach) makes a `strike` mission with `napalm: 1` and the tile (`x`,
  `y`, no target). On the ground it takes no Ammo but `NAPALM.fuel` (3) Fuel on top of `BOMBER.fuel` and its tank
  (`bomberOnGround`: it waits, saying so, until all of it is there; `u.napalmLoad` goes back into the Airfield if it
  lands with it). Over the tile it drops a canister (`napalmDrop`, a `bomb` missile with `napalm`), and where it lands
  (`napalmImpact`) every tile within `radius` 1.5 (`napalmTiles`: the tile and the eight round it) has its crops and
  stalk groves burned and its fertile soil scorched for good (`scorchSoil`), and a fire (`S.fires`, `updateFires`,
  `napalmBurn`, every `tick` 0.5 s, saved with the game) burns for `burn` 6 s: `bot` 0.6 a second to enemy robots on
  those tiles and `bld` 0.6 a second to enemy buildings (`bombHit`, so forts stop at their floor). The aiming overlay
  (`drawNapalmPick`) shows the bomber's reach and the soil it would burn (`napalmSoil`). The AI (`aiNapalmSpot`, in
  `aiBomber`) napalms an enemy that gets its Fuel from Bio Farms (`AI_NAPALM_FARMS` (2) or more at work, no Oil Pump that
  isn't dry) while its own Fuel is at least `AI_NAPALM_FUEL` (12), at most every `AI_NAPALM_GAP` (480) s, on the tile
  round one of its farms (no Flak covering it) where it scorches the most soil, `AI_NAPALM_SOIL` (3) patches at least.
- **Scorched earth** (`scorchSoil`): fertile soil burned by napalm or a Torch loses `S.fert` for good and is marked in
  `S.burnt` (tile → 1, saved; `burntSoil`), drawn as charred black earth (`drawBurnt`, a dark tile on the minimap) and
  repainted at once (`markDirty`); a crop on it burns; soil under a building is spared. The burner's tally:
  `stats.scorched`, and `stats.scorchedFoe` when the soil was a foe's (`soilHolder`: the owner of the nearest Bio Farm
  whose fields reach it, else the land's). A Bio Farm with no soil left says its fields were burned (`burntIn`).
  `hashState` covers `S.fert` and the fires.
- **Forts taken out** (`fortTaken`, `stats.forts`: Siege Breakers' "Take out {n} Walls or turrets"): a foe's built
  defence (`DEFENCE_TYPES` but the Silos) counts for whoever took it out, by any means: robots shooting, burning or
  capturing it (`captureBuilding`), or a Missile (direct or its blast), a nuclear one, a bomb, napalm or a Howitzer's
  shell wrecking it. Missiles and bombs used not to count. Played headless with the AI on your side plus the hints'
  steps (three starts each), every game is still won, and the goal comes a little sooner where it came last: on
  average 15:02 to 13:06 on Easy, 24:40 to 23:44 on Normal, 27:00 to 25:02 on Hard, the mission 20.8 to 18.9, 27.0 to
  26.1 and 30.1 to 28.4 minutes. The hints alone (no AI) play the same as before.
- **Flak Guns** (4 Cement, 3 Alloy; Build → Defend; Versus): a twin anti-aircraft gun (`def.flak`, `updateFlak`). It
  tracks the nearest enemy aircraft in the air within 7 tiles (`aircraftNear`; never one on the ground, never a robot)
  and every `reload` s fires a salvo of `salvo` shells, each led to where the plane will be when it gets there (shell
  `speed`) give or take `scatter` tiles (`S.flak`, `updateFlakShells`); a burst hurts every enemy aircraft within
  `splash` (`hitAircraft`, `damage` at the middle). One Ammo is `shells` (8) shells. A Cargo Plane gets through one
  quick pass over a gun hurt and is mended at its Airfield; a few guns bring it down (what it carried is lost) and it
  falls burning and crashes, leaving its wreck (see **Aircraft shot down**). Bursts are drawn in the air layer
  (`drawFlakBurst`: a flash and fragments, then a ragged black puff that drifts and fades). The AI puts up two Flak
  Guns by its Command Base once a rival has an Airfield or aircraft.
- **Aircraft shot down** (`hitAircraft`, `AIR_CRASH` in `js/defs.js`, keyed by type; a type with no entry falls as
  `plane`): the wreck falls (`S.drops` kind `wreck`, `dur` = `fall`: Cargo Plane 7.5 s, Vulcan Bomber 6.5, Airship 11)
  along `crashPath`: on the way it was flying, its heading turning through `turn` radians (`d.spin`'s way, from
  `hash2`) and `glide` tiles of ground covered in all (Cargo Plane 7, bomber 8.5 in a tighter turn, Airship 2.4),
  slowing as it drops; worked out in `CRASH_STEPS` (24) even steps with the game's own trig (`dcos`, `dsin`), so every
  device brings it down on the same spot, kept inside the map. `crashLand` (from `landDrop`): a fireball where it hits
  (`blast`) and two more as its tanks go up, the wreck skidding on `skid` tiles and slewing round (`slew`), fires along
  the hull burning `fire` s (45, 35, 75), long scorch marks; the `aircrash` sound, heard far off by its owner, whoever
  shot it down and the land's owner (`aircrashnear`, on screen only, for anyone else). Harmless, as before: nothing is
  damaged. On open ground (`wreckGround`: ground, no building or site, road, track, pipe, lava, Trade Post or Uplink)
  the wreck stays for the rest of the game in **`S.wrecks`** (`{ id, type, owner, x, y, a (heading), t (when),
  tiles }`: the tiles its hull lies across, `len` tiles long), saved and hashed
  (`hashState`), at most `WRECK_MAX` (32), the oldest going first. Into water, lava or a chasm it's gone. It blocks
  nothing (paths, building and placing never look at it); `clearWrecks` (every 10 steps) lets a wreck go once a
  building or site, road, track or pipe is on one of its tiles, or the ground there changes (the tide in: `setTide`).
  `checkSave` checks a save's wrecks. Drawn: the fall by `drawCrashUnder` (first in the air layer: the fire's light
  on the ground, the shadow, every smoke trail, a crashed one's for `trail` s after) and `drawWreck` (`crashNow`: its
  height, a plane losing it slowly then diving, the Airship settling; its roll and pitch as squeezes, the Airship's
  back breaking; the body drawn by `drawPlane` into its own canvas, charred, `crashBody`; flames from `CRASH_LOOK`'s
  places as they catch, smoke rolling off them, `CRASH_LOOK` `pieces` breaking away, tumbling down on their own
  smoke), with the `planefall` or `blimpfall` sound (`falling` in `js/audio.js`: engines failing and the wind rising,
  or the Airship's groan, lasting to the crash: `sfx`'s `dur`). The wreck on the ground is drawn with the remains
  (`js/ambient.js`: see **Cloud shadows, remains and beacons**).
- **Ships and Ports** (naval maps only: Islands and Lakes, `naval` in `SHAPE_PRESETS`, `navalMap`; `NAVAL_ON` switches them
  off everywhere): a **Port** (8 Cement, 3 Alloy; Build → Move) is storage on land beside water at least `SEA_MIN` (20)
  tiles big (`portDocks`; `seaNet` labels the bodies of water). Building on other islands: `buildZones` lets you build in the Command Base's zone and any where you hold a built store
  or garrison (a Drop Outpost, an Outpost, a Port). A Ferry founds a Port (`orderFoundPort`, `PORT_FOUND`: 12 Cement, 4 Alloy
  loaded at its Port, up to 4 Workers) on an empty shore nobody holds; it claims `claim` 4 tiles (`b.claim`, read by
  `computeTerritory`), and the Ferry heads home running a ferry line to it. A Ferry under your orders (`f.manual`:
  `orderSail`, `embarkWarbots`, `orderBoardFerry` with `v.embarkOn`, `disembark`, then `ferryBack`) sails anywhere, takes
  warbots aboard off a beach within `FERRY_REACH` and puts them ashore beside it; meanwhile it doesn't serve its line
  (`ferryLines`), and a line with no Ferry or no far Port puts its waiting passengers off again (`unloadFerry`). Warbots
  aboard stay aboard when the Port or Airfield they left from is lost (`releaseBotsFrom`, `aboardHold`).
  Ships are built at a Port's shipyard (`BDEFS.port.yard`, `updateYard`,
  `YARD`: a round of 1 Alloy + 1 Chip every 8 s, haulers bring `YARD.hopper` of each, asked for like a factory's inputs and
  as urgently as a Bot Foundry's, and held there for it: `yardHeld`, which `supplyOf` keeps every other request off;
  until Nov 23 2026 a supply order, which a colony feeding its Foundry by conveyor never filled, and the Foundry's
  Haulers took the parts back out, so a rival's bomber was almost never finished) and put to sea there (`launchFromYard`); they sail open water by `seaRoute` (8-way A*, never cutting a corner of land, under
  bridges) and move like trains. They burn Fuel under way (`SHIP_BURN`, a tank of 100 like a truck's) and fill up from a
  Port's Fuel when they tie up below `SHIP_REFUEL` (each Port with ships keeps `PORT_FUEL`, 4, which haulers bring;
  running low, an idle ship sails to a Port with Fuel, `findFuel`; empty, it crawls at half speed); they're mended
  while tied up (`SHIP_MEND`). **Container Ships** (40
  goods) and **Tanker Ships** (40 Crude or Fuel) take the dispatch role `'sea'` (`shipAt`): a Port's supply orders are
  filled by ship from another Port on its water, and a far Port sends its spare goods home to the Port nearest the
  Command Base, `SHIP_MIN_LOAD` (8) or more. A sunk ship's load goes down with it; a Tanker Ship explodes like a Tanker.
  A **Ferry** serves a ferry line (`b.ferryTo` on both Ports, `setFerryLine`): `ferryLink` makes the line a link in its
  owner's routes (`findPath`, at `FERRY_COST` times the distance plus `FERRY_BOARD`) and joins the zones at its ends. A
  bot whose route crosses waits in the Port (`u.ferryWait`, `ferryPassenger`), boards (six seats, `seatsFor`: a truck
  two, a Road Train three), sails and carries on from the far Port (`updateFerry`, `unloadFerry`); it gives up after
  `FERRY_GIVEUP` s. One Ferry works a line (`lineFerry`: the oldest free one based at either end); any others based
  there wait tied up at their Port as spares, for beach landings and founding Ports (the Port panel offers a spare
  first, `portFerry`), and take the line over if its Ferry is sent off. (Every Ferry based there used to work it, so a
  second one bought was never free.) **Beach landings** (`orderLanding`, `doLanding`): a Ferry tied up at a Port takes up to six armed
  warbots (free ones first, then stationed ones) and lands them on any shore tile it can reach, where they hold a rally
  flag; `LANDING_GATHER` s after the order it sails with whoever is aboard. A Ferry sunk with bots aboard takes them
  down. Turrets, Bunkers, Mortar Pits and Missiles hit ships; warbots don't chase them (`nearestEnemyBot` with `land`).
  The rival builds a Port once its Foundry runs, a Ferry with a fair army, and every few minutes lands six warbots
  beside whichever enemy building it can reach that's least guarded (`aiNaval`). An island colony that has
  run out of working Mines can use a single reachable Ore deposit. When its home island is short on Ore and its
  enemies are across the water, the first Port can use an extra build slot and its first Ferry gets priority for
  parts before the rival starts a bomber Airfield. Against a rival across the water
  (Medium and up, in missions too), once it has a decisive lead (half as many warbots again and four more) or a landing
  is held back by the guns over the beach, it lands a band instead (`aiBeach`, `P.beach`, `AI_BEACH`): it picks the
  rival's Command Base if it has the warbots to take it, or else the fort it takes fewest to take, and a beach out of
  the guns' reach near it (off the rival's land where it can be: warbots standing about there run their batteries
  down), orders a second Ferry, and brings load after load until the band is strong enough, then goes in at the gun
  covering the target first; it goes with seven tenths of that after four minutes or when its batteries run low, and
  calls the band off after seven minutes, or once it has lost two in five of what it sent. Later (after 15 minutes) it builds a
  second Port out toward the enemy, gives it supply orders (Cement and Ammo) and orders a Container Ship to keep it stocked
  (not while its Ferry is on order: a yard builds a Container Ship first, and short of Alloy the Ferry waited half an
  hour). The art is top-down like the trucks
  (`renderer/b/ship.js`, `renderer/b/port.js`), drawn two tiles wide with a wake under way (`drawShip`); a ship tied
  up is drawn at its Port's dock. On naval maps a bridge tile costs more the further it is from shore (`bridgeMul`:
  `BRIDGE_NEAR` 2 tiles at the usual price, then `BRIDGE_STEP` 1.5 times more for each tile further).
- **Freight rail** (`RAIL_*` in `js/defs.js`; the rail section of `js/world.js`; `layRail`, `deliverTrain` in
  `js/sim.js`): track is a tile layer (`S.rail`), laid instantly from the Paths **Rail** tool (`RAIL_COST` a tile, mostly
  Cement with a quarter of an Alloy, paid through the same credit as road Cement; `RAIL_BRIDGE_COST` over water,
  `RAIL_TUNNEL_COST` through rock: a Rail drag carries straight on over water and through crags, `drawRailTunnel`). Track
  joins where a road would (`railStep` uses `canStep`): on one level, or a level up or down over a Ramp (natural or
  built in Paths), where trains drop to `RAIL_GRADE` (0.55) of their speed and brake for it in advance (`driveSpeed`);
  rail bridges join any level, and a Viaduct with track on both abutments joins its ends (`railNbrs`). Dragging track
  across a one-level cliff with no Ramp says to build one there. Rail Stations stand beside the track and build Freight Trains in their rail yard (the same `updateYard`; the Foundry
  builds neither ships nor trains, and orders for them in an older save move to a yard);
  their platforms are the track tiles next to them (`railPlatforms`), and `railNet` groups stations by line. Freight
  Trains (56 goods) take the dispatch role `'rail'`: trunk runs from a far station to the home station and supply orders
  between stations on one line, `RAIL_MIN_LOAD` (10) or more; `railRoute` plans along the track. Road bots wait at a
  level crossing while a train is near (`trainNear`, `RAIL_CROSS_HOLD`). Trains never need charging.
- **Which carrier** (`fleet-bench`: a far store full of Stone, 12 rounds of parts of each fleet, goods home in 8 min):

  | Distance | Trucks ×6, road | Road Trains ×3, road | Trucks ×6, asphalt | Road Trains ×3, asphalt | Freight Trains ×2, rail |
  |---|---|---|---|---|---|
  | 16 | 1200 | 1170 | 1512 | 2250 | 2996 |
  | 28 | 776 | 720 | 1128 | 1860 | 2016 |
  | 40 | 576 | 540 | 888 | 1560 | 1680 |

  Four trucks and a Road Train on plain road do worst of all (the Road Train holds up the trucks). The rail line ran
  15% longer than the road in these tests (it went round obstacles), and costs `RAIL_COST` a tile plus two stations.
  The Freight Trains were measured at 6 rounds of parts each; they're 5 now, so two cost 10 rounds, not 12.
- **Crawlers** (`updateCrawler`, `deployCrawler`, `packCrawler`): a slow tracked bot that drives off-road and deploys
  into the `crawlerbase` building (store, 4-slot charger burning its Fuel, Outpost territory, garrison 4). Packing up
  turns it back into a bot carrying the store's goods (`u.cargo`); if it's destroyed on the move they spill as loot.
- **Dismantled crates:** idle Haulers take reachable crates before their regular jobs. Workers can carry the remainder
  when Haulers cannot take it, after construction, staffing and other local Worker jobs. Not a rival's: it dismantles
  every gatherer that runs dry and every stuck site, so its crates wait their turn behind the goods its sites need.
- **Driving:** bots accelerate away from stops and brake for corners, junctions, red lights and the end of a trip
  (`BOT_ACCEL`, `BOT_BRAKE`, `BOT_CORNER` in `js/defs.js`; trucks have their own, slower values).
- **Frontier riches:** boulders, ore, crystal and oil hold more the further they are from the bases, up to 2.2× in the
  middle of the map; rich deposits sparkle. **Map shape: Long haul** on the new-game screen makes a narrow, long planet
  (75% as wide, 170% as long) with the bases far apart; **Chokepoint** walls the middle of the map off with a ragged belt of
  crags (2 to 5 tiles deep, rough outcrops in front) and one to three narrow channels winding through it to a gallery
  along the middle line, different every game (`chokeBand`; the mouths are kept in `S.choke`, see `chokePass`).
  **Islands** (a taller map) puts each base on its own island, with two or three medium islands in the middle (by the
  seed: a facing pair, or one in the middle and a pair out to the sides; one on a Small map; for a free-for-all, three
  between the homes out toward the rim, sized to leave as much sea as a two-way map, round an islet in the middle) and
  a couple of little islets, at least `ISLE_GAP` (4) tiles of sea apart (5 to 10 bridge tiles), so a crossing is a
  long, dear bridge (`bridgeMul`) or a ship; the AI bridges toward its rival (`aiBridge`) and makes beach landings
  (`aiNaval`: its landed warbots march on once the beach is clear, of what the warbots holding the flag would shoot
  (`RALLY_REACH2`, about 3 tiles, as in `holdRally`), idle ones across the water go after the nearest
  enemy building there, and once a rival's army is nearly gone (the weakest one, in a free-for-all) it lands by that
  rival's Command Base; warbots stranded across the water out of Ammo don't stop its Foundry, as unarmed ones at home
  do). Specks of land under 8 tiles go under.
  On Islands and Sky islands each home island (or mesa) is topped up to `HOME_STONE` (300) Stone with a boulder field
  near the base, since Cement comes from Stone alone and every crossing costs Cement; on Sky islands boulders also
  get `SKY_RES_MUL` like the other mesa deposits.
  **Crater** sinks a crater one cliff below a rim in the middle, its floor holding rich fields (and Uranium in a
  Nuclear race), with one natural ramp in from each side. **Plateaus** stands each base on the top level, with a
  terrace one level down all round and only two natural slopes off it. Both force at least three levels.
  **Crossroads** (`cross`, `minLevels: 3`; its layout is `CM` in `generateMap`) stands a mesa in each corner of the
  planet, its top `CR_TOP` (2) levels above the lowland (0) and ringed by a terrace a level down about two tiles wide,
  its inner corner rounded and its outline wobbling with noise (less where the arms are narrow, so they stay open). The
  lowland between the mesas is a cross, an arm along each middle line from the edge of the planet to the plaza: open
  ground, no water anywhere, crags only away from the cliffs and the ways (each slope, the way on from its foot and down
  the middle of each arm: `crLane`), and on rougher terrain a few low hills a level up (none on Flat), kept off the
  ways and clear of the mesas and the plaza. The levels are the map's own, whatever the Terrain setting (`crBand`: 2 on
  a mesa's top, 1 on its terrace). Each mesa has three slopes down, three lanes wide with a ramp at both steps (every
  other ramp on its cliffs is cleared, as on Plateaus): one off each inner face, across the middle of its straight part,
  toward the corner across that arm (the two facing slopes meet head on), and one off the rounded corner toward the
  plaza. A crag-free rim along every mesa's top joins its slopes. With three or four the bottom-left quarter is laid
  out and turned onto the others, so the free mesa with three is a mesa like the rest; with two (a narrower planet) the
  bottom half holds the base's mesa and a smaller free one beside it, the arm between them right of the middle, turned
  half round onto the top. A colony's richer fields lie down in the lowland in front of its slopes (Ore and Crystal
  past its two faces, Oil by the corner slope's foot), and the free mesas' rich fields on their tops, so expanding
  means coming down.
  Five more shapes are for two players (laid over the finished terrain by `shapeExtras`, each tile with its twin, from
  the shape's own random numbers so laying one again gives the same map): **Rift** cuts a chasm (`T_CHASM`, 4–8 tiles
  across) along the middle line, crossed only by natural rock arches, a pair with their twins and sometimes one down the
  middle (a Sky bridge is the slow way to open another); **Ring valley** fills the middle with a massif too steep to
  climb, a valley running round it on each side (a long tunnel is the only shortcut; the massif stops short of each
  landing zone, so the starter fertile field is never buried); **Oases** is a barren,
  crag-strewn waste with nothing worth having outside the home ground and a few rich oases (three a side and one in the
  middle, fertile with two fields each) joined by narrow, winding passes; **Crossroads** (a wider map; its mesas are
  below) dries the planet out, clears the crags off its mesas' cliffs and its ways and lays an open plaza with the
  richest fields in the middle, the bases on two opposite corner mesas and the other two mesas rich and unclaimed;
  **Lakes** scatters many small lakes between the bases (the
  `naval` flag marks it, with Islands, for the ships to come). Each shape lists `links`, the places its base must reach
  by land (each arch, both valleys, the plaza and the outer ends of Crossroads' arms), and `linkBase` opens the cheapest way to each one
  round the shape's own barrier (`wall`: a ford or a cut through crags, two tiles wide, only where there's no way
  round), so the twin of every link reaches the other base and no river or crag can cut a way across off.
  **Sky islands** (`sky: true`) lays out a home island per side, a small middle one, a chain of stepping-stone
  mesas from each home island to the middle (so the sides can always meet) and a jittered grid of islands between
  (14-tile cells in 2-player, 12 in 3-player; about 11 mesas, or 13–16 with three sides; the same for every side; canyons
  kept narrow by `SKY_GAP`, so the typical Viaduct spans 4 tiles and the route between bases never needs one over 6), then turns the sea into a canyon floor at level 0 and lifts every
  island into a mesa (home islands +3 levels, the rest +4; small ones flattened to one level), so every drop is 3+ levels: no Ramp can
  reach the floor, only a Ropeway. The outermost rim of every mesa is kept clear of resources (moved up to 3 tiles inland)
  and crags so a Viaduct can start or land anywhere on it (with two players worked out on one half and copied to each
  tile's twin, so the map stays point-symmetric). Each home mesa is topped up to at least 10 Ore and 8 Crystal tiles (a
  compact field 5–7 tiles out, placed the same for every side), and Ore, Crystal and Stalk on the mesas hold
  `SKY_RES_MUL` (1.8) times the usual amount, since half the fields fall into the canyons (`richRes` scales its mark to
  match). The floor gets low rises, rock formations, plants and a thin scatter of boulders and ore. Viaducts
  cross between the clifftops; the AI finds one with `aiViaductSpot` (only spans that bring it closer to its rival),
  puts an Outpost on each mesa it lands on, and rests its Ammo Plant and Chip Fab (and, with a fair army, its Foundry)
  while it saves the Alloy for the next span. (`T_CHASM`, the old bottomless canyon, is kept for old saves and is the Rift's chasm.)
- **The Hollow** (`hollow: true`; LORE.md, The Hollow) is the Murmur's cavern lair, a two-player map with its own
  generator (`hollowMap`, called first thing by `generateMap`) and its own look: `newGame` sets the biome to `hollow`
  whatever the Biome setting (`BIOMES.hollow`, not in `BIOME_ORDER`, so the picker never offers it; the Biome row says the
  map sets it), drawn with its own art (`art/biomes/hollow`, keys ending `-hollow`, loaded only when it's played:
  `LAZY_BIOMES`, `dist/biome-hollow.js` in the single file; ART_GUIDE Batch 16), and it is always night there (`alwaysNight` on the map type: `todForced` in `js/daynight.js`,
  looks only). `murmur: 'active'` is for the Murmur's night system. The map starts as solid rock (`T_ROCK`, level 1) and
  every change is made to a tile and its half-turn twin together (`put`), so both sides are exactly the same: a home
  cavern round each base (its landing ground kept round), a **chasm hall** between home and the middle split across by
  a two-row chasm (`T_CHASM`) with one natural rock arch, a west and an east cavern (a black lake fed by a slow river,
  far under `SEA_MIN`, in the west one), a **flank cavern** on the middle line at each side (each the twin of the other),
  the **cathedral** in the middle, two side chambers, and winding passages between them (2 tiles wide, 3 from Medium
  up). Anything the base can't walk to afterwards is joined by the cheapest way through rock or water (a sliver is
  filled in; `joinAll`). `S.hollow` keeps what the game needs: `breaches` ([{x, y, r, home}]: one over each Command
  Base, radius `HOLLOW.breach.home`, and `HOLLOW.contested` (4) in the flank caverns, two each, radius `open`), `masses`,
  the Murmur's nest sites (`nests`, twin pairs, `HOLLOW.nests` a side by size, 4 to 7; `deep`, the middle of the
  cathedral) and `pillars` (single rock tiles with open floor all round, so they never close a way: a ring round the
  Deep's mound and more by the Terrain setting). **No Trade Posts or Uplinks** (LORE.md: the Pathfinder, which built
  them, never mapped the Hollow): `placePosts` places none, `worldBan` greys the Trade Terminal out with a reason, the
  rival plans no Terminal where there is no post (so it never waits on trade for Crystal), and `newGame` turns an
  Uplinks game on this map into Capture (the menu greys the Uplinks choice out and says so; a Random pick that lands
  here says so in a message).
  - **Breach shafts.** Drawn as a pool of daylight on the night-graded ground: under its soft mask (`breach-light-hollow`)
    the baked ground shows as by day, warmed (`drawBreachLight`, `drawDayGround`), with a little pale gold on top; and a
    column of pale gold (`breach-beam-hollow`) rising toward the top of the screen with motes drifting down it
    (`drawBreachShafts`), gold on the minimap.
  - **Its look** (ART_GUIDE Batch 16): the cave wall's face along every floor tile under rock (`hollowWall`), rock
    darker toward the middle of a mass (`hollowRockDark`), each floating Crystal mass and side chamber
    (`S.hollow.chambers`, from `hollowMap`) laid over the tiles under it and drawn with each of them (`hollowDecorTile`),
    the pillars (`drawPillar`) and the Deep's mound (`drawMound`) as night renders, and a faint light along the lakes'
    shores, the chasms' lips and the walls' feet in the night glow map (`hollowTileGlow`).
    **Ringfall** falls only through them (`hollowRingfall`, from `meteorPlan`): `METEOR_HITS` strikes a side, a share
    `HOLLOW.ringfall.contested` (2 in 3) through the contested breaches on that side, each with its twin; each leaves up
    to `HOLLOW.ringfall.tiles` (4) deposits `HOLLOW.ringfall.rich` (1.5) times a Ringfall deposit's amount.
  - **Bloom veins** (`R_VEIN`, `RES[R_VEIN]`: 4 Fiber, 3 s to cut): on the cavern floors in fields and along the walls
    (16% of floor tiles beside rock, away from home). A Harvester gathers them there (`gatherRes`: R_VEIN for a Harvester
    in the Hollow, so `gatherTypes`, `canPlace`, the AI and the panels all go by it). A vein cut to nothing stays a vein
    with `S.grow` 0 and grows back over `VEIN.regrow` (150 s, `growStalks`; `findNode` skips it meanwhile; `veinFull`).
    Cutting one stamps the Harvester (`b.veinT`) where the Murmur are in the game (`wildOn`), and for `VEIN.lure` (120 s)
    `veinLure` draws them to it: a night pack's `murmurPrey` scores it 6 higher, from up to `VEIN.reach` (8) tiles further
    out, and the tunnels' `murmurGoals` count it 2 more charge. No stalks or fertile soil: `worldBan` bars Grove Planters and Bio Farms (and Airfields and Trade Terminals) with a
    reason for `canPlace`, and the build menu greys them out (`ownedText`). Fuel comes from the oil seep in every home
    cavern (on Small maps, two: the side caverns there are too cramped for more oil within reach). A Worker lands in the Agribot's place.
  - **Floating Crystal**: a platform two levels up (level 3) in a pocket of chasm, worn back until only chasm touches it,
    one in each chasm hall and from Medium up one in each east cavern; its Crystal holds `HOLLOW.crystal` (2.5) times a
    cluster's (frontier richness on top). Reached by Ropeway, a Sky bridge or a Viaduct (level 1 to 3 is within
    `VIA_RISE`). The rival AI runs a Ropeway out to an unreached one (`aiRopeway`: from 5 minutes in, once it has a Bot
    Foundry, saving for it like a bridge (`P.bridgeNeed`) when its land's Crystal runs low or from 8 minutes), and puts a
    Crystal Tap there as anywhere.
  - **Side chambers**: two rows of three crates of Alloy (3–5) or Chips (1–2) each (`HOLLOW.relics`), laid with
    `addLoot(..., keep)` so they never rot (`LOOT_KEEP`).
  - **Ceiling tremors** (`TREMOR`, `S.tremor`, `updateTremor`, a map event like the Volcano's): the first at 210 s, then
    every 100–150 s, dust for 10 s (`drawTremors` in `js/weather.js`, and a rumble). Every second tremor drops rock
    (`rockSpot`: open ground 3–18 tiles from player 0's base on its own side, clear of the breaches, and its twin; a
    mission can aim one with `S.tremor.aim`): dust trickles there for `TREMOR.warn` (8 s) with a ring on the ground,
    then `rockfall` takes `TREMOR.damage` (4) armor off every building within `TREMOR.r` (1.6) tiles (never below 1;
    `b.rocked`), `TREMOR.botDamage` (3) off robots, and leaves a boulder where the ground is clear. No dust storms or
    solar flares (`updateEvents` leaves them out; Ringfall and the *Wren* take turns).
  - **The Murmur**: the most nests of any map, and at the centre the Deep's mound (`BDEFS.mound`: 160 armor, level
    `HOLLOW.deep.level` (3) from the start, `HOLLOW.deep.guards` more guards, `HOLLOW.deep.loot`; `placeHollowNests`,
    drawn by `drawMound`: the Burrow's level 4 art). Wrecking it (`clearNest`) spills its hoard and puts every other nest back to level 1 (its
    growth clock too). The nests come with the Murmur setting like everywhere else (the map's own default is `murmur:
    'active'`; `murmurStart` calls `placeHollowNests` instead of `placeNests`/`placeNestsVersus`), owned by the Murmur's
    slot (`wildOwner`) in Versus as in Colony; Quiet keeps half the pairs (rounded up) and the mound, Off none (the
    menu warns that the Hollow is their lair). They dig tunnels and open exits like any nest (`isNestB` counts the
    mound as a nest everywhere), the night windows are surges. The Deep spouts more Murmur the nearer it is to death (`DEEP_SURGES`, `deepSurgeTier`):
    below 75%, 50% and 25% of its armor its own packs come out of the mound (two every 32 seconds, three every 24,
    four every 16, every third a Brute from the second step), while fewer than 5, 8 or 12 are out, counting those out
    after a shooter on its alarm (`MURMUR.alarm`), so the alarm and the bursts never stack past the cap; and its
    tunnels hold 1, 2 or 3 more exits at once, opened every 20, 15 or 10 s instead of 25 (`deepExitsDue`, also topped
    up at once when it drops a step mid-surge), with packs 1.25, 1.5 or 1.75 times as big up through them (`deepPack`,
    in `murmurWave` and the craft waves; still within `murmurRoom`). Under 12% it makes its last stand once
    (`DEEP_LAST`, `deepLastStand`, `b.deepLast`): 10 Scuttlers and 3 Brutes out of the mound and 2 up through each of
    its exits, after its alarm's shooter or the nearest colony, and every colony is told. Its violet pulses grow
    stronger and each burst rumbles deeper (`deepSurgeAt`/`deepSurgeTier`), and
    `veinLure` still pulls packs and tunnels toward a lured colony's veins (`murmurPrey`, `murmurGoals`). In Colony,
    `murmurExitCap` keeps the exits open at once to what a Standard Colony map of the same size could have by that
    night: `colonyNests()` (its nest count) times the exits a nest has opened by night n, up to `maxExits` (Huge,
    Active: 12 the first night, 18 after); an exit due past the cap waits for one to be collapsed. Versus has no cap.
  - **No aircraft or missiles** (`worldBan`: no Airfield, Missile Factory, Missile Silo or Nuclear Silo; `nukeOn` is off
    there, so no Nuclear race; the AI plans none of them, `aiMissilePlan`) and **no Ports** (`canPlace` says the lakes are too small).
  - The rival AI: its build plan swaps Bio Farms for Oil Pumps and Grove Planters for more Harvesters, fuel trouble
    brings an Oil Pump and Refinery, its roads bridge the chasms (Sky bridges) where that's shorter, and `aiRopeway`
    (in the Hollow `roadSearch` carries road reach across a colony's own Ropeways, so a Tap on the mass counts as
    joined up). Nest sites keep 9 tiles from the masses: guards there would keep the gatherers off the Crystal for
    good. The rival lives with the Murmur here as anywhere (`aiMurmur`: exits collapsed, nests struck between surges),
    and builds as near the nests as `aiNestClear()` lets it, or it runs out of Ore. A fifth to four fifths of a map's
    Ore, and up to half its oil, lies within that many tiles of a nest (more on Small maps), so once its own run low it
    clears the nests sitting on them first (`aiNestRiches`, see The Murmur).
    With parts scarce and a clear lead, a rival can gather a smaller armed force for the final push if it can
    beat the guns and garrison: four armed warbots and twice the enemy's army and two more, below its usual attack
    threshold (with no parts its army never grows to that, and it sat out the end of the game). This holds on any map,
    and on a **dead planet**, the enemy out of parts as well (`deadPlanet`, `aiThink`), with more armed warbots than the
    enemy's whole army, two at least, its attack threshold comes down to what it has (two fewer, two at least: the
    landings of `aiNaval` and `aiBeach` too, four warbots spare or the threshold), and a lead of two is enough for the
    final push (Islands seed 21: the Ore ran out on every island by minute 40 and neither colony ever attacked again). At low Fuel, key industry Workers keep working if the available charge would not
    repay the trip. An Ore-starved rival can mine a single accessible vein and ignores distant, unclaimed veins
    when judging which nests to clear.
    **Oil first** (oil is the only Fuel here): with an Oil Pump at work, or `AI_OIL_CRUDE` (5) Crude in storage, and no
    Refinery, the Refinery comes first after the opening and is started as soon as the Cement is there, its Alloy
    delivered first (as a turret's is: `oilFirst` in `aiThink`). Its Oil Pumps go to the seeps nearest home: a tile
    further off costs a spot `AI_HOLLOW_PUMP_FAR` (0.8) of its score (0.3 elsewhere).
- **Maps for three or four only** (`minPlayers` in `SHAPE_PRESETS`: the player choice can't go below it, Random only
  picks them for three or four, and Colony games on them leave the other colonies empty). **The Wheel** (`wheel`, three):
  rock spokes run out along the lines between the thirds from a raised hub (the only ground on the top level, the
  richest fields) to a rim road of open ground round the outside; the hub's cliff has one ramp up from each third
  (`tryRamp` from the middle toward each base, the others cleared). **Three Mesas** (`mesas`, three): each third is a
  mesa at level 3 (`mesaE`, from the sides of the third and the basin's edge), with terraces at 2 and 1 round it and
  the canyon floor at 0: a basin in the middle holding the riches and a narrow canyon along each line between the
  thirds, where neighbouring mesas come 9 tiles apart (a Viaduct's span). Every cliff is a mesa's, so all the ramps
  are cleared and one way down is laid from each base straight toward the basin, a ramp at each step, two lanes where
  the ground allows. The four-quarter maps (`quad4`, turned a quarter at a time like Crossroads, for three or four):
  **Pinwheel** (`pinwheelShape`) draws one curved ridge (from the plaza out to a few tiles short of the edge, curling
  round by about 70° near the plaza) and `put` lays it on all four quarters; **Four Isles** (`isles4`, `islands`, `flat`)
  cuts the bottom-left quarter into a home island, a quarter of the rich middle island and the islets on the lines to
  its neighbours (where there's room for the sea round them), and in a team game (`cfg.teams`) lays a two-tile sandbar of
  fords from each island to its ally's (half-turn twins: west pair and east pair); **Twin Valleys** (`twin`, four only)
  is the plain four-quarter terrain with a rock spine 4–6 tiles wide down the middle column, laid after the turns with
  its half-turn twin (`orbit` is the half turn there too), crossed by a south pass and its north twin with rich fields at
  each end, the ways from each base to its pass and up its valley carved open. The Trade Posts on Twin Valleys (whose
  middle is a mountain) fall back to being about as near the two nearest colonies (`placePosts`), and its Uplinks are
  two half-turn pairs. **Long Haul 2v2** (`haul4`, four only, `haul4Map`; not a four-quarter map) is the Long haul
  planet as long and 1.6 times as wide (`w: 1.2, h: 1.7`: 36×72 Small, 48×96 Medium, 60×120 Large, 72×142 Huge, the width
  kept even), standing upright, with two colonies side by side at each end: south-west and south-east (players 0 and 1,
  a team in 2 vs 2), north-east and north-west (2 and 3), allies about 21 tiles apart (17 on Small). The bottom-left
  quarter is generated (the plain terrain, a little sparser in scattered fields, `areaK` × 0.75) and mirrored left to
  right and end to end onto the others (`mirror4`; `orbit` is the tile with its three mirror images, so ramps and
  everything laid with `put` stay the same for all four). Its own fields: the "beyond" fields squeezed into the
  colony's half of the width and stretched up the map, five more strung along the middle stretch (Crystal, Ore,
  Boulders, Oil, Ore, from about a fifth to three fifths of the way from the middle line to the base row), and Ore,
  Crystal and Oil round a plaza of open, level ground at the very centre (`haul4Shape`, the ground round it kept within a
  level, a way to it from the base carved open). The frontier riches peak there, so the rich deposits crowd the middle third
  of the length (on a Medium map about four times as many as in each end third). Its Trade Posts: the first on the plaza, the rest in pairs, each with its half-turn twin
  (down the middle line between allies, or out at the flanks of the middle line), so both teams have the same; its
  Uplinks: the middle and one for each colony, mirrored both ways; meteor showers fall mirrored both ways too.
  **Teams: 2 vs 2** starts on when it's picked (`teamDefault`: in the map picker, a saved planet, or on loading
  remembered settings), and can be turned off for a free-for-all of four.
- **Three players, the same in every third:** the terrain is turned from player 0's third onto the others, and turned
  again after the specks and slopes are smoothed (a patch just under the 10-tile limit in one third could be just over
  it in another); the ramps are laid in player 0's third and turned onto the others (`turned`: the nearest tile at the
  foot of the same step), then any ground that lost its way up or down gets a ramp back, the same in every third. Each
  third now has about as many ramps (within a tile or two; it used to vary up to two to one).
- **Fortresses** (`fortressHome`, Three Mesas and Plateaus): a colony's home ground counts as one while no more than six
  ramp tiles lead off it. From 10 minutes in (`AI_FORTRESS_SPAN_AT`), with twice the goods to spare, the computer spans a
  canyon with a Viaduct straight onto a rival's fortress, out of its guns' reach (`aiFortressSpan`; at most two onto
  one fortress), so its attacks needn't all come up the one ramp the rival's turrets hold.
- **Shooting across a canyon:** a warbot that can't close in shoots from up to `WARBOT_RANGE_BLOCKED` (2.2) across
  a building or cliff, and up to `WARBOT_RANGE_GAP` (3.6) from a clifftop across lower ground (`overGap`: a narrow
  canyon with no rock, water or building in the line), so garrisons facing each other across a Sky islands canyon
  fight instead of standing off.
- **Loitering:** a warbot standing still in another player's territory for more than `BATTERY.waitGrace` (15 s) drains
  `BATTERY.warbotWait` a second; once flat it gives up its attack, or leaves its rally flag, to recharge at home.
- **Raids:** armed warbots holding a rally flag in enemy land with nothing to fight tear up enemy roads (not bridges or
  tunnels, which only a Missile can crater, nor a rival's trade convoy lane, where they lie in wait instead) near the flag,
  one tile per 12 warbot-seconds. The rival raids your busiest road clear of your defences every few minutes (Easy
  rarely, Hard often; a Salvager far more) once it has warbots to spare: out of reach of every gun (Pulse Turrets, Minigun
  Nests, Bunkers, Mortar Pits, Disruptor Towers, Keeps: `aiDefReach`, plus 3½ tiles for the raiders' spread) and of
  garrisons with two armed warbots in them, by a way in that crosses no gun's reach (`aiRouteHot`: the best four
  stretches are tried in turn). A raid's clock (`RAID_TIME`) starts when the first raider reaches the flag (`P.raid.at`;
  until then it has two seconds a tile from home and half a minute), and the band comes home early when the enemy
  army within 5 tiles of it outnumbers it. The rival answers your raids (`aiCounterRaid`) only when it can send a third
  more warbots than the flag has; enemy warbots standing on its land under no flag (a landing whose flag came down, a
  band that can't walk home across the water: `aiStrays`, not ones on an attack; on its home island, when theirs is
  another, those in a garrison they planted there too) get the same answer, the group nearest its Command Base first,
  counted by those that can still shoot (one out of Ammo needs one warbot spare, and three go). Every other raid (`P.raidN`), with a Torch of its own ready in a garrison, it picks a
  road within `AI_SCORCH_NEAR` (6) tiles of an enemy Bio Farm instead and sends a Torch along (`aiRaidTorch`); a Torch on
  a raid with a full tank burns the nearest patch of an enemy farm's soil within `AI_SCORCH_REACH` (8) tiles that no gun
  covers (`aiRaidScorch`), refills and comes back to the flag (`u.resume`). Missiles crater the roads where they land.
  **Maglev lines** (`aiMagCut`, `AI_MAGCUT`; Medium and up): in place of every other raid, at most once every five
  minutes, a band of the raid's size (one more if it can spare it) goes for a building of a foe's line that carries
  goods (pods on it), out of every gun's reach and the garrisons a raid keeps clear of, with fewer armed warbots than
  the band within 8 tiles of it, forts or out (each counting against it). On a line at least 12 tiles long, the band
  prefers a pylon in the middle third. If it can't safely reach a target, it tries the next one. Its flag goes beside
  the target and the band shoots it first (`rally.target`); once it's down the flag comes in and the raid is over (`P.magCutT`,
  `P.magCuts`).
- **Direct Warbot orders:** Move uses the clicked tile and cannot inherit a nearby hunt flag. Move, Hunt, Attack and Station validate each unit before changing its task or reserving garrison space. Units already in firing range can take an Attack or Hunt order. A Warbot can step into a Bulwark’s available cover while keeping its shot.
- **Warbot movement:** warbots don't queue in road traffic, give way at junctions or stop at red lights (they still wait
  for trains), and nobody queues behind one, so a squad marching along a road or massing at a Gate it means to break
  down all keeps going (and all shoot). Chasing a foe, a warbot goes straight only when the whole line to it is
  walkable (`clearLine`); otherwise it follows a route (`viaT`: committed for 1.5 s, re-planned only when the foe moves
  off its end), gives up on foes that are only reachable the long way round (more than 3 times the distance) or not at
  all (left alone for 12 s, unless they come within shooting reach), and squads holding one spot edge apart
  (`spreadOut`) instead of stacking on a single point. On the march (not in a fight) warbots, Bulwarks and Torches
  plan round enemy guns: a tile an enemy gun reaches (`dangerMap` bit 1, the map civilians keep clear of) costs
  `COVER_COST` (4) more (`routeOpts` sets `opts.cover`, see `findPath`), so a short detour beats walking through it.
  A nearby armed foe that can be hit takes priority over a quarry out of reach. Detours belong to the current
  target, and a long chase is rejected before moving. Torches advance into flame range before firing. Warbots
  and Torches take nearby Bulwark cover when there is a firing position under the active shield. Auto-repair
  waits for an opening and starts only once a route exists. Manual marches and resupply trips keep their orders.
  (A rival's warbots keep the older rules: badly hurt, they pull out for repairs even mid-fight, and on the way to
  resupply they fight what they meet. Its army lives on being mended.)
  The danger maps (`DANGER`, `updateDanger`: worked out every 15 ticks and once a second) keep what they were worked
  out from in the game (`S.dng`: each gun's disc as `[id, owner, type, x, y, R]` and each foe's spots as `[owner, x,
  y, R]`; the Murmur's gun cover likewise, `S.mgn`, for `murmurGunMap`): a game loaded part way through those 15
  ticks rebuilds the same maps from them (`dangerMap` → `updateDanger(true)`) instead of from where things stand after
  loading, so a save plays on exactly as the game would have (it could part ways before). Saved; `checkSave` checks
  them; not in `hashState`.
- **Safe routes for goods carriers** (the owner's Volcano report, Nov 23 2026: the rival joined its road to the far end
  of his, the short way to his far sites ran through its base, and his Haulers and trucks drove in and were shot). A
  civilian's route already paid `DANGER_COST` (24) a tile for the danger map (`findPath` with `avoidFor`), but with no
  way round it drove through, and a route planned before a gun went up or was loaded was never looked at again. Now a
  goods carrier at work (`safeHaul`: `gunShy` robots, so Haulers, Freight Trucks, Tankers, Road Trains, Workers and
  Pavers, the rival AI's too; not one running for cover or on a task in `SAFE_FREE`) whose route still runs into a
  gun's reach (`hotStep`: `dangerMap` bit 1, past the first `SAFE_POCKET` (4) tiles out of a reach it starts in) is
  searched again with that ground closed (`safeRoute`, `findPath` `opts.safe`; only then, so it costs nothing on a
  peaceful map). With no way round, it waits (`noSafeRoute`): the route isn't tried for `NOSAFE_WAIT` (10 s), nor
  is a job at the building there handed out (`unreachUntil`), the building's panel says *No safe route: enemy
  defences in the way* (`b.noSafe`, in `hashState`) and its owner is told (every 45 s at most, `P.safeMsgAt`). Once a
  second (`dangerSweep`) a carrier on its way whose route ahead now runs into a gun is flagged (`u.rv = -1`) so
  `routeCheck` plans again, round it, or stops it where it is and drops the job (`haltUnsafe`: a load aboard stays,
  for `stashCarry`). The danger map is the cached one (per player, every 15 ticks), never rebuilt per search. Enemy
  warbots stay a cost and `foeSweep`'s turning back; how far robots keep from one is its real reach now (`foeReach`:
  a Railgunner's 5 tiles + 1.7, not `FOE_SHY` for all). Freight Trains also avoid covered track (`railRoute`), replan if guns cover a queued route, and release the delivery reservation while keeping cargo aboard if no safe detour exists.
- **Haulers turning back from the Murmur on a road** (the owner, Nov 26 2026; `SHY_ROAD`, `murmurShy`, `shyRoadWait`,
  `aiRoadGuard`). A carrier whose way runs near enemy warbots or creatures turns back (`foeSweep`, `takeCover`) and the
  building it was going to waits `SHY_WAIT` (5 s) before another job there is handed out (`unreachUntil`, `reachable`).
  The output pickups (`dispatch` step 4) now ask too: they never did, so on Standard seed 25 (`d9bf339`) a Hauler was
  sent to one Mine every few seconds and each turned back from the same Scuttlers (102 times). Turning back from the
  Murmur, each turn-back that comes once the last wait is over (`b.shyN`, `b.shyAt`, `b.shyX`/`b.shyY`: where the
  creature was; in `hashState`) doubles the wait, 5, 10, 20, 40 s at most, and a pickup or delivery there starts it
  again (not storage, which carriers reach by every road). From two in a row, for 60 s after the last, the panel's
  status says *Haulers turning back: Murmur near the road* with the wait, and the "Why idle?" and the Economy panel's
  bottlenecks name it (`haulWhy`, `outWhy`). A rival (`aiMurmur`, by day, with its army at its attack threshold and
  `AI_NEST_SPARE` more) sends `AI_ROAD_GUARD.n` (3) warbots to a rally flag where they last turned back, one flag at
  a time for `AI_ROAD_GUARD.hold` (90) s (`P.roadRally`).
- **Cargo pickups:** after the usual capacity and network checks, dispatch compares estimated travel times when multiple carriers are eligible. The estimate uses their routes and travel speeds, including road surface and direction. It is reused for that carrier and pickup for the current dispatch pass. It does not predict traffic queues or boarding waits.
- **Marching together** (the owner's rule, November 2026 balance pass; `marchTogether`, `paceContact`, `PACE_CONTACT`):
  army robots sent together (`orderMove`, `orderAttack`, `sendAttack`, `sendToRally`; the player's and the rival's,
  not orders with `hurry`) move at the slowest one's speed: each faster one's task carries `pace`, the share of its own
  speed that matches (applied in `speedMul`, counted in `walkTime`). It ends, robot by robot, on contact: a fight, a
  hit in the last 2 s, enemy land under it, within `PACE_CONTACT` (6) tiles of its target or flag, or an armed foe that
  close; then each fights at its own speed. In the task, so a new order ends it and a save keeps it. (Audit: with
  every army robot at one speed, the W+S+A+R mix went from −.27 to −.02 at 24 parts.)
- **Setting off together:** an attack or rally flag that draws warbots from several garrisons (`sendAttack`,
  `sendToRally`: the Army panel's orders and the rival's marches, not its raids, counter-raids or hunts) times each
  one's walk along its route (`paceSquad`, `walkTime`), and the nearer ones wait where they stand for the difference
  (`task.wait`, at most `PACE_MAX` 45 s, not under `PACE_MIN` 2 s) so the squad arrives together; one shot at while it
  waits goes at once, and one whose target falls or changes hands meanwhile (an ally took it, say) stops waiting and
  drops it at once (as an attack does: crates, the fort, or the next building near by). Selected warbots sent
  directly, and orders given with `hurry`, go at once. Army units ordered
  together share their route searches (`squadRoute`: the routes planned in the same tick, by start tile, goal, owner,
  kind, armed and fighting; each gets a copy), and a squad on its way to a flag makes for the flag tile itself until
  it is within 4 tiles, then for its own spot round it, so a 20-warbot order costs one search, not twenty.
- **Routes looked over again** (`routeCheck`, from `moveAlong`): when the roads change or a building is put up
  (`routeVer`: `S.roadVer` and the newest building), a moving bot looks over the rest of its route. One that now
  crosses water or rock (a bridge or tunnel gone) plans again at once, and with no other way drops its job there (a
  load goes down in crates) instead of driving on over open water; a civilian bot also plans again when a new building
  stands on its route, or (road-bound) when its road was taken up and the way round is quicker than crawling across
  the gap (`GAP_DETOUR`). Fighting units' routes are only cleared, so they plan their own way again.
- **Traffic:** bots queue on roads, each waiting behind the bot ahead of it going the same way. On two-way roads each
  direction keeps to its own side, but passing oncoming traffic slows bots down. Switch the Paths banner to **Arrows** and
  drag along a road to point it the way you drag (tap a road to turn its arrow). The arrows turn at once, but each drag
  or tap is remembered as a stroke, so **Undo** turns them back (`draftUndo`, op `dir`); a drag that starts off your
  roads moves the map instead (`roadPaintStarts`), so a habitual pan doesn't turn every road it crosses. One-way loops
  keep busy routes flowing; going the wrong way up a one-way road is allowed but crawls.
- **The Economy panel** (`js/economy.js`; tap a good in the top bar, or Y; I and the pause menu's Statistics open it on
  History, from the pause menu paused to plan; it replaced the Goods panel and, in a game, the Statistics screen). Display
  only (`ecData`, worked out at most twice a second; a seeded game hashes the same with it open). Three tabs:
  **This good** (a picker of the goods in play): on hand now and a line of the last 10 minutes (`S.hist`),
  made and used a minute (`goodRates`: the last two minutes), the net with *empty in m:ss*; its chain both ways
  (`ecChainSet`: up to the raw goods, down to where it ends) as a small diagram; **Made by** / **Used by**, every
  building with its state (`ecState`: working, waiting for an input, output full, unstaffed, no road, stopped, from its
  status, `stallWhy` and `wantsStaff`), problems first, a page at a time, tap to go there; and its top problems.
  **Whole economy**: every good a node (stock, made and used a minute; red when something waits and you have none,
  amber when it runs out within 5 minutes) in columns by how far it is from the raw goods, links from each input to
  its output for each kind of factory you have and on to four ends (Building sites, Robots, Upkeep, Guns), width by the
  estimated flow a minute (the output's made rate times the recipe, shared among its makers; the ends get what's left
  of the used rate), red where a consumer waits for that good; beside it the **Bottlenecks** (`ecProblems`, worst first,
  the colony's shortage from `insightColony` leading): buildings waiting for a good, with `goodWhy`'s cause and a chain
  (`ecChain`: *Chips short ← Chip Fab waits ← Crystal short ← 2 Crystal Taps unstaffed*), makers with their output full
  (`outWhy`), makers with no road, a good used faster than it's made and out within 8 minutes, makers of a short good
  unstaffed. **History**: the Statistics graphs (`renderStats(into)`), three across. **Quick actions**, only beside the
  problem they fix and only when they'd apply: Make more Haulers (`foundryOrder` 3 Haulers, where Haulers are too few or
  all busy and a Foundry is under the robot limit), Prioritise this (`wfOrder`: the row of the first unstaffed maker
  down the chain to the top of the ladder, Manual), Build a maker (Build, with it picked to place), and **Join the roads**
  for a split road network (`ecSplit`: you hold the good, but on roads that don't join those of a building waiting for
  it, directly or behind the maker of a good you're out of; Make more Haulers is never offered there). It runs
  `roadJoinRoute(owner, a, b)` (world.js: Route to's `routeTree` from every tile of a's network to the cheapest tile
  of b's, a Ramp of yours still being built counting as the road it will be, so a join already planned isn't planned
  twice; it returns the tiles to lay, the Ramp tiles, the cost and how many tiles on the way are planned already, or
  `{ why }`), then closes the panel, opens Paths on Roads with Route to on and that plan sketched (the same Build /
  Clear / Undo as any route; Build sends `ORDERS.paths`), glides the map to it between the banner and the tools, and
  outlines the gap in red with each tile dashed (`ecDrawJoin`). Already planned: a toast and the outline for six
  seconds. No way: a toast saying why and what would (a bridge, a Ramp, a Viaduct, a Port and Ferry, Route to). On
  This good the problem shows the gap's cost instead of the button, and the outline stays on the map (found once, a
  moment after the tab shows it, and again only when roads, plans, land or buildings change: `ecJoinFor`). While it's open the
  map draws the goods carried over the last minute (`R.gf`, the Goods flow map's counts) as lines along the roads with a
  dash running along, in each good's colour, and a ring on each building that makes or uses goods in its state's colour
  (`ecDrawFlow`, `ecDrawStates`); on This good only that good's. On a desktop it sits to the right and never scrolls
  (the lists page; Bottlenecks drop their last lines into *and N more* while it would: `ecFit`).
- **Why idle? (the bottleneck finder, `js/insight.js`):** a factory that isn't making anything (the Bot Foundry first,
  the Smelter, every factory with a recipe) shows **Why idle?** under its status (`whyIdle`, `refreshWhy`), worked out
  for the open panel only, once a second. It follows the missing input back down the chain and stops at the first real
  cause (`goodWhy`, `makerWhy`, `siteWhy`, at most three links down): is any in storage (then: no road, no Hauler or
  Tanker, storage no road joins to it, enemy guns, disconnected road carriers or reachable carriers busy: `haulWhy`)? Is there a building that makes it,
  and is it paused, cut off, under enemy guns, unstaffed (no free Worker: `workerWhy`), waiting for its own input
  (asked again, a link down), with no road, or for a gatherer out of deposits in reach (`insLeft`: none left, all on a
  rival's land, or all under guns; "ran dry N minutes ago" from `b.dryAt`, set in `updateDepleted`)? With none, is one
  going up (and why it isn't done), was one destroyed (from `S.log`), and are all `MAX_SITES` sites taken? A **Show**
  button opens the culprit's panel, **Build** places the missing building. The panel holds still: the box shows once the
  building has waited `WHY_DELAY` (3) seconds (a panel opened on an idle building shows it at once), the room it took
  stays while the panel is open, and a factory's progress bar stays, empty, while it waits. A Bot Foundry waiting on
  Chips used to move its buttons up to 120 px several times a minute. **The colony's shortage**
  (`insightColony`, once a second): the good gone longest without while something waits for it (`P.dry`, below), the
  Foundry's first; its counter in the top bar is ringed red (`.res-chip.starved`) and the Economy panel's
  Bottlenecks lead with it. Display only: it never asks the danger map unless it is current (`insGuns`), so it
  can't change when the simulation works it out.
- **The end announced (`overFlare(word, kick, tone, done)`, `js/ui.js`; `#o-flare` in `#screen-over`; the `.o-flare`
  rules at the end of `style.css`):** every end screen (`showGameOver`, `showMissionOver`, `showHordeOver`, `watchOver`)
  shows itself through it: the word (`#o-title`, VICTORY / DEFEAT / CONTACT, COMPLETE / FAILED, HELD / OVERRUN, GAME
  OVER) flares in over the dimmed map in the main menu title's look (Chakra Petch, the coral gradient, its glow) with a
  streak, a shine and a soft flash (`tone` 'win'; 'loss': grey, slower, a vignette, the map desaturated; 'neutral':
  Observer, no flash), holds ~1.9 s (2.3 s a loss), then a FLIP transition carries it onto the heading's own text box
  (a Range's rect) as the card fades in (`.flaring`, `.settling`); `#o-kicker` under the heading says how. A tap or a
  key (capture phase) skips to the dashboard, its buttons dead for 250 ms so the tap can't press one;
  `prefers-reduced-motion` only fades. `done`: Contingency's battles, the word in the Command Deck's blue (`.blue`, no
  card), then `contBattleOver`. Sound: `sfx('flare')` / `flareDown` beside `win` / `lose`, then the end's music
  (`musicCue(tone, story)`) and the Command core's spoken line (`voiceEnding`), neither for Contact (`gupSilence`). UI only.
- **The end's music (`musicCue`, `cueMood`, `MOODS.victory` / `defeat` / `victoryC` / `defeatC`, `cueMelody` in
  `js/audio.js`):** film-score cues (rescored Nov 26 2026 after the owner listened: grand, not cute; crushing, not
  light), each scored bar by bar (`cue`: each bar's chord `c`, parts `L`, the horns' dynamic `v`, `hold` to let its
  chords ring that many bars, one-off hits `fx`, lead notes `mel` [step, semitones over the key an octave up, length] and
  a low line `low` [step, semitones over the key two octaves down, length]), then a quiet loop on its `progs` /
  `arrange` at `settle` of its level (from loop bar `settleAt`). Its own orchestra, at the end of the file: `mHorn` (low
  brass: saws and a square a note, scooped into pitch, the filter blaring open, vibrato, spread; `hornVoicing` keeps the
  chord low and wide; `soft` for the loop), `mHornLead` (the heroic solo horn, an octave under for weight), `mTimp` /
  `mTimpRoll` (timpani, a roll swelling over a bar), `mTaiko`, `mBoom` (a sub boom into the soft clipper), `mSwell` (a
  cymbal swell into the next bar; dark, a low hollow one), `mDarkBrass` / `mDarkLead` (detuned saws driven into the
  clipper, sour and distorted), `mSubDrone` (a beating sub pedal), `mCollapse` (something huge falling far off: boom,
  rumble, a metal groan, rubble), `mKnell` (a low funeral bell). fx: 'roll', 'swell', 'swellDark', 'hit' (crash, impact,
  boom), 'boom', 'collapse', 'knell', 'crush' (the final blow: a huge boom, a collapse, a distorted cluster), and the
  older 'riser', 'toll', 'thud'. **Victory** (A, 76 bpm, 7 bars, about 22 s): Am, F, G (i–♭VI–♭VII) under a timpani roll,
  low horns and the timpani's march, the horn's call rising (E, A B C, D B D E), a cymbal swell into A MAJOR with a crash,
  sub boom, the big drums and the choir, the horn on C♯ E A (the Picardy third); F, G again with a roll and a swell, home
  on A major held two bars, wide; then a calm, proud loop (A, F, G, A in soft horns and pads, a timpani stroke a chord).
  **Defeat** (D, 54 bpm, 5 bars, about 22 s): a sub pedal on low D throughout; a collapse far off; distorted low brass
  on chords with a minor second ground in (Dm, E♭ over D, B♭ diminished, A♭: the tritone), the bass sinking a semitone
  at a time (D C♯ C B B♭ A), the dark brass sighing down (E♭ D, C♯ B♭, A♭ G), the choir an octave down, a funeral knell,
  more collapses, a dark swell, then the final blow, held, decaying into a cold, empty drone; the loop is the pedal, a far
  choir on Dm and E♭ and now and then something falling a long way off. `victoryC` / `defeatC` are Contingency's, in the
  campaign theme's key (D): the same climb (Dm, B♭, C into D major, 80 bpm, the tune's opening D A B♭ A on the horn) and
  the same descent (58 bpm, the tune twisted, its fifth flattened to A♭, on the dark brass; the Murmur's knock in its
  loop). `musicCue` dips the music bus
  to silence, makes the cue's first bar the next step (`MUSIC.next`, `MUSIC.step`) and `musicSetMood` swells it in over
  2.2 s; `musicMood` returns it (`cueMood`) while its game's end screen is up, or for Contingency (`keep`) until it has
  played out over the globe (`until`); leaving it fades out (`musicFades`: out of a cue it fades, the next swells in).
  It follows the Music volume like the rest.
- **The machine voice (`js/voice.js`):** spoken lines in an invented language with subtitles; not text-to-speech but a
  small formant synthesizer in Web Audio (`voiceRender(ac, dest, text, preset, t0)`, any context, an
  OfflineAudioContext too). The source: a glottal pulse wave (a `PeriodicWave`, harmonics falling as n^-0.75, all in
  phase: buzzy, nasal), a quieter saw and a square an octave down (the sub, also straight through a 220 Hz low-pass for
  weight), gated by the voicing; four parallel band-pass formants (`VOX_FORMANTS`, F1–F4, scaled by `fscale`) gliding to
  each vowel or voiced consonant (m n r v z d g); one noise band-pass set per consonant (`VOX_NOISE`: hisses for s sh kh
  z v, a closure then a crisp click and burst for the stops k t d g p). Then the machine: a nasal peak at 1.25 kHz, a
  band limit, a short metallic comb (a delay with feedback), an amplitude ring at `ringHz`, a little bit-crush, a soft
  clip, a dark reverb (`voxKit`: low-passed noise decaying, energy held to one). Two presets
  (`VOICE_PRESETS`): **cinematic** (64 Hz, slow, measured: a syllable about 0.26 s, long pauses at full stops, the pitch
  drifting down and falling at each full stop, a 3.3 s reverb at 0.3 wet (it was 5.5 s at 0.42: "tone it down a touch", the owner, Nov 26 2026), over a low drone on D that swells in before it speaks and
  a deep boom as it opens) for the opening and ending lines; **droid** (96 Hz, quick and even, flat pitch, narrow 290 Hz
  to 3.4 kHz radio band, sharper formants, a stronger comb and ring, a 1.2 s metal room at 0.1 wet, a radio squelch in and out) for short callouts
  later (`VOICE_CALLOUTS`). **The tongue** (`voxParse`, `voxWord`): each English word becomes its machine word of one to
  three syllables ((onset) vowel (coda) from `VOX_ONSET` / `VOX_VOWEL` / `VOX_CODA`, the first stressed: longer and
  higher), from a generator seeded with the English word (`voxHash`, `voxRng`), so a word always comes out the same and
  a line always sounds the same. **The lines** (`VOICE_LINES`, LORE.md's voice; Earth's fate never said): the openings,
  the Carrier in orbit (`voiceOpening`, from `showBriefing`: `versus`, `many` (a free-for-all), `teams`, `colony`,
  `argos`, `hollow`, `horde` (the Maw), `mission`, `contingency`); the endings, your Command core (`voiceEnding`, from
  `overFlare`: `victory`, `defeat`, `held`, `overrun`, `complete`, `failed`, `contWon`, `contLost`). `voiceSay(key,
  delay, opts)` plays one on its own bus into the master at the Effects volume (`VOICE.lvl`), ducks the music under it
  (`AUDIO.musicDuck`), and shows the subtitle (`#voice-sub`, `voiceCaption`: the speaker, the machine words lighting up
  as each is said (`.said`), the English; at the foot of the screen, or at the top for an ending, `.top`); without sound
  (Effects at 0, audio locked) the subtitle alone. A tap on the subtitle skips it (`voiceStop`); it stops with its game
  (quit, or another one started) unless `keep` (Contingency's ending, over the globe). Not under test automation unless
  `window.BOTFALL_VOICE`, not for an Observer. **Settings → Voice lines** (`#p-voice`, `setVoiceOn`, `botfall.voice` in
  localStorage, on by default). Local display only: nothing reaches the simulation or the lockstep.
- **Post-game report (`gameReport`, on the end screen, `#o-report`; missions too):** the moments that mattered
  (`reportMoments`, the dozen weightiest, in order): your first robot and first defence, the first attack each way,
  runs of buildings lost or taken, every shortage of 45 s or more and how long it lasted (still going at the end
  too), Command Bases falling and surrenders, and the deciding moment (the last big run of losses before the fall, the
  fall itself, or the Domination or Uplinks hold); where your goods were lost (buildings destroyed or taken, their
  materials and the goods inside, goods on robots destroyed, crates still lying on your land); and one **Next time,
  try** tip chosen from what happened (`reportTip`: an early rush, no defences, the longest shortage, raided supply
  roads, heavy losses, or a harder rival after a win). It reads **`S.log`**, the game's story, written by the
  simulation with one-line hooks (`logEvent`, `logFirst`, `noteLost`, `noteGone`, `logTick` in `js/sim.js`): kinds
  `bot`, `def`, `hit`, `lost` (a run of losses, each within `LOG_RUN` 60 s of the last), `dry` (`LOG_GOODS`, checked
  every 2 s: none on hand while a factory, a Fuel Station or a site waits for it; `LOG_DRY`) and `out`, capped at
  `LOG_MAX` (60: past it the smallest run of losses or shortage goes; firsts stay), saved, the same on every device, and
  left out of `hashState`. A building is lost when it goes without `b.gone` (set when it is dismantled, moved, packed
  up or a Ramp is finished); a fort captured is noted in `captureBuilding`. Totals that mustn't shrink with the cap
  are in `P.stats` (`lostBld`, `lostMat`, `lostIn`, `lostAboard`); open shortages in `P.dry`. A save from before the
  log starts it where it was loaded (`S.logFrom`).
- **Ammo:** warbots carry 10 shots (each Ammo is 5: `AMMO_SHOTS`; a Railgunner's 2 slugs of its 4) and reload in your Command Base and Outposts, which haulers stock from an Ammo Plant.
  A rival with a Bot Foundry and no working charging building can give one replacement Fuel Station an emergency
  build slot. The station uses normal placement, construction and Fuel deliveries.
  Rivals exclude Crystal deposits under fire when estimating local reserves. An urgent Trade Terminal and a missing
  supply building can both qualify for an extra construction slot, and the rival weighs how many Chips or Crystal a
  contract will actually bring back during a shortage.
  A rival Foundry short of its next part can get a one-unit delivery from a nearby spare Worker if its road network
  has no Hauler or Freight Truck to serve the trip. The Worker uses safe routes and leaves the building reserve free.
  When many of a rival’s Warbots are unarmed in garrison, it prioritizes the next batch of Alloy and Cement for its Ammo Plants and sends the first reloads to the waiting troops.
  A reload fills to full (`reloadAmmo`): the spare shots of an Ammo it opened earlier (`u.ammoCr`, fewer than one
  Ammo's worth) go in first, then a whole Ammo from the garrison if it's still short, and what of that doesn't fit
  becomes its spare. No Ammo is made or lost: every Ammo taken is all its shots, loaded or spare (both lost with the
  robot, as loaded shots always were). The same in every garrison, Bunkers and Keeps included (their warbots reload
  inside after every shot). Out of
  ammo, a warbot can't fight at all: it heads back to a garrison to reload, and only armed warbots answer orders.
  On an attack, one that runs dry while the target stands and squad-mates are still on it goes to reload at a garrison
  with Ammo within `RELOAD_REACH` (16) tiles (a Torch: refills where Fuel is kept) and comes back, once per attack
  (`startReload`, `task.reload`, `task.trips`), so attacks no longer melt away at the wall.
  A rival's empty warbot sitting in a garrison with no Ammo and none on the way (an Outpost no road reaches yet)
  goes to reload where there is some and keeps away from that one for 90 s; yours stay where you posted them.
- **Rival boost (hidden):** tap the clock three times quickly, or press **`**, to give a rival a supply drop, 4 armed
  Warbots or 3 Workers at its Command Base (`BOOST` in `js/defs.js`, `boostRival` in `js/sim.js`), for a game you're
  winning too easily. The game pauses while it's open.
- **Repairs:** nothing heals by itself. Damaged bots go to a Repair Station (workers below 60% health, warbots below
  70% once their garrison is quiet; Colony free play too), which uses 1 Alloy per 12 health. A warbot below 35%
  (`REPAIR_RETREAT`) on an attack, a rally flag or a sortie pulls out of the fight for repairs when a Repair Station can
  fix it (otherwise it fights on), but not while it stands where an enemy gun reaches (`gunCovers`: walking out hurt
  through the guns killed more than it saved), takes no new fights on the way (`u.retreat`), and goes back to its attack or flag
  once mended (`u.resume`, `resumeAfterRepair`; the flag stays up meanwhile, and Recall cancels the return). Haulers keep up to 3 Alloy
  in it, and an empty one gets the first Alloy that reaches storage (like an empty Fuel Station's Fuel). To fix a building, tap it and press **Repair**:
  you pay 1 Cement for every 6 missing armor and a free worker restores it.
- **Statistics:** (the Economy panel's History tab in a game; its own screen at the end and in Observer mode) graphs over time of bots, land, goods, **Economy size**
  (Output: goods made a minute, from the running total `made`; Buildings: finished non-military buildings, `econ`;
  Workers and vehicles, `civ`) and, with war on, **Military size** (Army, `war`; Defences: forts and guns, `def`),
  every colony a line (`recordHistory`), then how busy each kind of building was over the game; each building's panel
  shows its recent busy time.
- **Terrain levels:** the planet has terraces at different heights (lighter ground is higher). Bots
  can't climb cliffs; they use slopes at narrow passes, so some routes are long. Pave busy routes with
  Paths (slopes too) and build a **Ramp** (Paths, Ramps) on the top or at the foot of a cliff to open your own way up or down. Worker assignment compares safe route lengths to the Ramp tile and the work tiles across the cliff (`rampApproach`, `rampSides`), so a Ramp down off a plateau is built from the top, and its foot can even be ground no bot can reach yet. Buildings can't be placed where they
  would block the only way through a pass.
- **Placement undo:** for `SITE_UNDO` (10) seconds after you place a building (the `place` order notes `b.placedAt`,
  game time) an **Undo** chip shows at the foot of the map (`siteUndoTick`, `#undo-site`), and **Ctrl+Z** / **Cmd+Z**
  on the map does the same (outside Paths, whose Ctrl+Z stays its own Undo). It is an order (`undoSite`, the last in
  the table): only the sender's own site, not finished, placed with `place` (not a move) no more than 10 s ago by the
  game's clock, so every device agrees. Unlike Dismantle, nothing is left in crates: what was delivered or paid into
  the site, a Hauler's load on its way to it and a Cargo Plane's load for it go straight into the storage nearest it,
  the way a road's Cement is refunded (`undoSite` in `js/sim.js`; crates only if you have no storage at all). In
  multiplayer the chip goes a little early, by the order delay (`siteUndoLead`). Placing several sites in a row, Undo
  takes back the newest, then the one before while its 10 s last. `b.placedAt` is dropped when the site is finished.
- **Priorities:** tap a building or construction site and set it to Low, Normal or High. High-priority
  buildings get workers and goods first; low ones are served last and lose their worker first when
  workers run short. A priority set on a construction site ends when it's built (back to Normal). **Pause** frees a building's worker entirely. A Generator, Mortar Pit or Pulse Turret can be **turned off** (`pausable`, `setPaused`): it burns no Fuel, or holds its fire, and nothing more is hauled to it until it's back on.
- **Storage:** tap your Command Base or a Depot. *Fill first* makes haulers bring finished goods there before
  any other storage; *Empty out* takes nothing new and moves what it holds elsewhere (handy before
  demolishing it). You can also switch individual goods off for that building.
- **Minimap:** tap or drag it to jump around (its picture, `minimapDetail`: the land with its relief and shores, roads as light lines, borders as lines in each colony's colour, deposits as dots); red pulses mark buildings under attack; warbots are dots in a pale shade of
  their colony's colour (`MM_WARBOT`: every rival its own). The × hides it (on a touch screen it is a 44 px tab hanging
  under the minimap, so a finger-sized button isn't lying over the map).
- **Sharp map:** the map is baked once at 32 px a tile for zoomed-out views; zoomed in, the part on screen is baked
  again in 8×8-tile chunks at 64 or 128 px a tile (a few per frame, least recently seen dropped: off-screen ones give way
  to keep the lot under `HD_TOTAL` pixels and four screens' worth; the whole-map bake isn't drawn under chunks that
  cover it), `bakeMap` reuses its canvases and runs again only when art the map is drawn from arrives (`bakedArt`; at most
  every 2 s while more is coming, and at launch once that art is in or after `BAKE_WAIT`), and big art images keep half-size copies so they shrink cleanly (`drawMapLayer`, `artMip` in `js/render.js`).
- **Batteries:** bots drain their battery walking, working and fighting, and recharge only at a Fuel Station (or,
  for warbots, inside an Outpost). The Command Base doesn't charge anyone and you land without a Fuel Station, so
  build the first one straight away (it runs on the 10 Fuel you land with). A flat battery means half speed and half power.
  A factory's worker goes to recharge at `BATTERY.low`, or below `IDLE_TOP` (60) while its factory has nothing for
  it to do (`standingBy`: short of an input with none on the way, or full with no pickup coming), so the walk costs
  no working time. Fuel Stations burn Fuel (one Fuel is
  two full charges, `FUEL_ENERGY`). A Bio Farm makes about
  2–3 Fuel a minute (its Agribot keeps up with about 4 or 5 fertile tiles: more soil than that doesn't make more); an Oil Pump and Refinery up to 10 a minute until the seep runs dry (both stop at 30 by default).
  A dry Oil Pump shows a crossed-out oil drop over it, frees its worker and says so once: demolish it (any Crude
  still in a demolished building goes to storage). Harvesters, Ore Mines, Crystal Taps and Bio Farms do the
  same with their own resource crossed out when nothing is left in reach (and go back to work if groves regrow).
  A Quarry never runs dry (`bedrock` in its definition): out of boulders, its worker cuts Stone from the nearest
  rock face in reach (`rockFace`: ground against a crag or a cliff; 8 s a Stone, about 4 a minute) or, with none,
  digs it at the Quarry (20 s, about 2½ a minute), against about 8 a minute from boulders. It rests while the colony
  has `bedrock.rest` (40) Stone or more, so renewable Stone only flows when it's needed.
- **Moving buildings:** tap Move on one of your finished buildings (`movable`: not the Command Base or Outposts, which
  hold your land, nor Walls, Gates, Ramps, Viaducts, Ropeways or a deployed Crawler), then the new spot. `startMove`
  puts a site of the same kind there that costs nothing (`siteFrac` treats it as fully supplied); workers put it
  together in its build time while the old one keeps working, and `finishMove` hands over its goods, settings and
  work in hand (`MOVE_KEEPS`: orders and parts, a Silo's reload, a finished nuclear missile), its armor as it stood, a
  Port's ferry line and stationed warbots, then takes the old one down quietly. Calling the move off, demolishing either
  end or losing the old one takes the site down (`cancelMove`), so no building comes free.
- **Saved planets:** **Save** beside the planet number (More settings), or **Save this planet** in the pause menu, keeps
  the seed and the settings that shape the map (shape, size, terrain, resources, biome, players) on this device
  (`terrafall.planets` in localStorage, newest first, up to 40). Tap one in Saved planets to set the menu to it; ×
  forgets it (`savedPlanets`, `renderPlanets` in `js/ui.js`). A saved planet, or a remembered menu setting, that this
  version doesn't offer (from another version, or damaged) is left out or falls back to its default (`planetOk`,
  `checkMenuSettings`): one used to stop the game booting, and a planet's seed was shown as markup.
- **Alloy** (balance audit, AI games): Alloy income was set by how much Ore reached the Smelters, not how many Smelters
  there were. A Smelter eats Ore much faster than a Mine worker, who walks out and back for every Ore, can bring it, so
  extra Smelters just sat idle. Now a Smelter makes 3 Alloy from 2 Ore and 2 Fiber (the same 12 a minute flat out, a
  third less Ore per Alloy), keeps 6 of each on hand, and a Mine worker digs two Ore a trip: about 50 to 80% more Alloy
  by the 20-minute mark. Two or three Ore Mines keep a Smelter busy; a Smelter waiting for Ore says so.
- **Fuel, Tankers and pipelines:** Crude and Fuel are liquids (`LIQUID` in `js/defs.js`): only **Tankers** carry them
  (10 at a time, near or far; `take(…, g)` in `dispatch` hands every liquid job to a Tanker that can reach it). Haulers
  carry a liquid only when no Tanker can get there (none left, or none on that road network), one at a time, so nothing
  locks up. Every colony lands with a Tanker; order more at the Bot Foundry (2 rounds of parts, like a Freight Truck).
  A Tanker on a factory run brings it a full buffer (`LONG_BUFFER`), so a Refinery isn't kept waiting.
  **Fuel is dangerous** (`BLAST`, `fuelBlast` in `js/sim.js`): a Tanker destroyed with a load explodes (0.7 tiles
  across, up to 1.3 when full: 4½ damage to robots, 3 to buildings, half at the edge, anyone's), and so does a
  Refinery wrecked by warbots, a missile or a nuke (1.5 to 2.4 tiles: 6 and 5); its Crude and Fuel burn instead of
  spilling as crates. Loaded Tankers and Refineries caught in a blast go up a moment later (a chain reaction). Forts
  never fall to a blast (they keep 1 armor). Demolishing a Refinery is safe.
  **Pipelines** (Paths → **Pipes**, K) carry Crude and Fuel. Drag from an Oil Pump to a Refinery and the pipe routes itself
  (`pipeRoute`: inside your border, over roads and track, under buildings if it must, up cliffs, across water on stilts
  and bored through rock at `PIPE_CROSS_COST` (1.2 Cement) a tile, weighed by price so it goes round only when that's
  cheaper, with few bends); tap a
  pump to pipe it to the nearest Refinery, or **Pipe every Oil Pump** in the banner; an Oil Pump's panel has a one-tap
  **Pipe it in** too (to the nearest Refinery or Fuel Tank). Pipe costs 0.3 Cement a tile (`PIPE_COST`), laid at once when you tap Build (or as
  the Cement comes in). A pipe joins every building it runs under or beside; each second each line moves up to 4 Crude
  (`updatePipes`) from its pumps to its Refineries (which keep up to 6) and Asphalt Plants, then into storage on it, and
  from storage on it to its Refineries. A piped pump never waits for a Tanker. **Fuel** moves the same way, up to 4 a
  second: from the Refineries and Bio Farms on a line (`fuelMaker`) to what burns it there (`fuelUser`: Fuel Stations,
  Generators, Flame Towers, the Missile Factory, and Mooring Masts, which take only the Fuel they keep for their
  Airships and give none out) up to what each asks for, then into storage; and from storage to what
  burns it. Lines joined through something that burns Fuel count as one (its tank passes Fuel on). What's made on a line
  with storage never waits for a Tanker (`pipedFuel`); on a line with only burners a Tanker takes just a full output's
  surplus (`fuelLine`); and nothing on a line with somewhere Fuel is made, or storage holding some, is sent Fuel by
  Tanker (`fuelByPipe`), unless it has sat empty for `PIPE_DRY` (20 s). Tap a Fuel Station or Generator in Pipes, or
  **Pipe Fuel to it** on its panel, to pipe it to the nearest storage, Refinery or Bio Farm (`pipeToFuel`); the rival
  pipes its own Fuel Stations and Generators that are within 10 tiles. Raiders cut pipe (it counts like a road
  for them), missiles and fuel blasts break it; broken pipe is planned again at once and relaid when it's paid for.
  **Fuel Tank** (`fueltank`: `tank: 120`, `store`, `explodes`; Gather tab, T; 5 Cement, 2 Alloy): the hub of an **oil
  bloc**. Storage for Crude and Fuel only (`storeTakes`: liquids, never past its cap, counting what's on the way:
  `tankRoom`; `storeAccepts` leaves it out, so no other good is ever sent there, and it takes no supply orders). A pump's
  **Pipe it in** (`pipeToRefinery`) runs to the nearest Refinery or Fuel Tank. It appears when there are new pipe tiles to plan and no adjacent Refinery or Fuel Tank to take Crude directly. A line with a Fuel Tank
  on it moves `PIPE_RATE_TANK` (8) Crude and 8 Fuel a second instead of 4, and fills its Fuel Tanks before other storage
  (`updatePipes`). It takes part in feed links (below): it feeds Crude, and Fuel, to up to `FEED_MAX_TANK` (4) neighbours
  that use them, and takes in by conveyor only what a neighbour makes (an Oil Pump's Crude, a Refinery's Fuel; a
  Refinery's own Crude stays). Tankers and trucks fill up there like at any storage. Destroyed with Crude and Fuel in it,
  it goes up in `BLAST.fueltank` (1 tile, up to 3.8 when full; 8 damage to robots, 7 to buildings), setting off
  Refineries, other Fuel Tanks and loaded Tankers in it; its panel shows how full it is and how big the blast would be
  now. The rival puts one up by its pumps once it has `AI_FUEL_TANK_PUMPS` (1) Oil Pump at work, a Refinery and a Foundry
  (`aiSearchSpot` places it like a Refinery, near its pumps, and touching a Refinery where it can: `AI_FEED`), and its
  bombers rate it highly (`AI_BOMB_VALUE`).
  **Trucks burn Fuel** (`TRUCK_BURN`): Freight Trucks, Road Trains and Tankers have a fuel tank instead of a battery,
  draining as they drive (a full tank lasts about 4 minutes of driving, a Road Train's under 3); low, they fill up at the
  nearest storage or Fuel Station holding Fuel (one Fuel fills the tank). With no Fuel anywhere they crawl at half
  speed. A **Generator** (Build → Make) burns a Fuel every 40 s while anything in its reach is working, and makes every
  factory, Refinery, Oil Pump and Foundry within 4 tiles work a third faster. Selected (or while you place one) it
  shows its reach as an amber ring, with corner brackets and a lightning badge on every building it powers
  (`drawRanges`, `drawBoosted`).
- **Feed links** (`FEED_TIME`, `FEED_MAX`, `FEED_BOOST`; `feedTargets`, `feedStep`): a production building passes
  what it makes straight to a neighbour (any of the 8 tiles round it) that uses it, one good every 2 s a link, by a
  short raised conveyor (a pipe for Crude and Fuel), with no Hauler, and a building being fed works a tenth faster.
  Each producer feeds at most two neighbours (side by side before corners); storage and walls never take part (but a
  Fuel Tank does: see Fuel, Tankers and pipelines), and a
  Refinery also passes Crude on from its intake. So Mine → Smelter → Chip Fab → Foundry, Quarry → Cement Works,
  Smelter + Cement Works → Ammo Plant, Refinery → Asphalt Plant → Roadworks, Missile Factory → Silo work as blocks.
  Haulers leave a fed factory's input to the conveyor: they bring only its next round's worth of that good
  (`feedHaul`), never drive it over from the touching producer, and that producer keeps back for its neighbours what
  they still need instead of sending it to storage (`feedHold`; not while it is paused or cut off).
  Placing a building shows the links it would make as green arrows (`feedPreview`); a building's panel lists what it
  feeds and what feeds it; the belts are drawn over the gap between buildings, a crate riding across with each good
  (`drawFeeds`, `drawFeedLink`). The AI puts its factories beside their suppliers (`AI_FEED` in `aiSearchSpot`).
  **Smoke:** trucks emit faint diesel puffs, with at most 48 active at once, and working buildings smoke and steam from their chimneys (`vehicleSmoke`, `buildingSmoke` in
  `js/render.js`; the points are in `art/emitters.js`). The Generator plays its working loop (`generator-work-0…7`).
  Balance (`fuelprobe.js` AI games over every map shape, 45 minutes): colonies use a bit over half the Fuel they make,
  Fuel Stations stand dry about 2% of the time and trucks run empty almost never; trucks take about a tenth of the
  Fuel, a Generator a fifth where there is one.
- **Ways to win** (`VICTORY`, `S.victory`, `S.endHow`; Versus only, not missions): **Capture** is the default.
  **Surrender** (`SURRENDER`, `checkSurrender`): in any mode, 12 minutes in, a rival down to 40% of its best (buildings,
  warbots counting double) against a colony 4× as strong, or with nothing to rebuild with, gives up after about 40 s and
  everything it had changes hands as if captured. **Keep playing** (`keepPlaying`, `S.endless`): after a victory against
  the computer (not multiplayer, not missions) the end screen can carry on with the same game: no one wins again (no
  surrender, Domination or Uplinks count, and the last rival falling ends nothing), but losing your own colony still
  ends it. **Domination** (`DOM`, `updateDomination`, `domShare`): hold 60% of the
  land anyone holds with one rival (half with two, 45% with three) and a fifth of the planet for 3 minutes straight.
  **Uplinks** (`UPLINK`, `placeUplinks`, `updateUplinks`): 3 to 5 neutral towers (`S.uplinks`) placed by the map's own
  symmetry (180° for two, 120° for three, quarter turns on the four-quarter maps, the half turn on Twin Valleys, mirrored both ways on Long Haul 2v2), so every colony has the same, using a travel-effort
  map (`travelCost`) to keep them fair; on Sky islands only on mesa tops. Each belongs to the colony whose land covers it,
  and an armed enemy warbot within 2.5 tiles jams it. From `UPLINK.online` (8 min) the colony holding at least half of
  them and more than anyone else runs its clock (`S.upClock`, kept when it stops); 5 minutes in all wins. The AI plays
  for the Uplinks rather than the Command Base (`aiUplinks`): it pushes Outposts toward free ones (`aiUplinkGap`, a pull
  in `aiSearchSpot`; Keeps too), bridges or viaducts across to one it can't walk to (`aiCrossTarget`), holds its own
  (garrison priority High at the forts there, a guard flag of 2 to 4 warbots beside each from 90 s before they come
  online, two more per jammer, and a Bunker right beside each that skips the queue), and sends attacks, marches,
  bombers and missiles at the forts holding a rival's Uplinks (`holdsUplink`), even ahead of a crushed rival's
  Command Base, jamming them while that rival's clock runs (`aiJamUplink`).
- **Army orders:** tap **Army**, then a rival building to attack it with warbots or a missile, or open
  ground to send warbots there to hold the area under a rally flag. An Attack on a building no garrison is in reach of
  plants a flag beside it that targets it (`assault` sets `rally.target`): the warbots there shoot it first
  (`holdRally`), and once it falls or changes hands the flag comes down (`followRallies`; a flag following an enemy robot, a person's right-click hunt, moves on to the next enemy robot within `HUNT_CHAIN` (7) tiles of the kill when its quarry falls, `huntNext`, nearest first, and with none left it stays as a hold flag where the kill was; a rival's hunters come home as before), so they carry off the crates
  that spilled out and come home, as after any attack. Tap the flag to call them back, or press
  **Recall all** in the Army banner (**C** on a computer) to end every attack and rally flag at once, and call in
  warbots out picking up crates (`FIELD_TASKS`: attack, defend, hold, loot; `warbotsOut` counts the same). Each is
  sent home at once (`callBack`: repair first if it badly needs it, else `goGarrison`), marching (`u.march`), and
  leaves crates be for `RECALL_NO_LOOT` (60) s (`u.noLoot`, see `lootNear`); one already carrying a crate brings it
  in, marching. (A rival's recalled warbots just drop what they were doing, as before.) Under a finger
  Recall all asks for a second tap within 3 seconds (`recallAllTap`: the button says how many come home).
- **Army Groups** (`S.agroups`, the Army Groups section of `js/sim.js`; orders `agNew`, `agAdd`, `agLeave`, `agName`,
  `agSize`, `agPrio`, `agHome`, `agOrder`, `agResume`, `agDisband`; cards and panel at the end of `js/ui.js`): up to
  `AGROUP.max` (6) standing armies a person, each `{ id, owner, n (badge 1-6, colour AGROUP.colors), name, home ({ b } an
  Outpost, Keep or Command Base, or { x, y }), size (target, 1 to AGROUP.maxSize 40), ord { k, pts, r, g, at, t, done },
  paused, flag }`, a player's in priority order. A unit belongs to one (`u.grp`; army units only, `isArmy`). Each group
  holds its own rally flag (`r.grp`; never reused by an order looking for a flag at a place, `!q.grp`; kept by
  `cleanRallies` while the group lives) and its units hold it like any flag (`holdRally`). `agTick` (every 10 ticks)
  moves the flag by the order (`AG_ORDERS[k].aim`, the list the panel reads, so a new order slots in there): **hold** at
  home (`agHomeXY`; beside a building, the badge's own spot, `agBeside`), **defend** at the circle's middle with
  `r.rad` (one of `AGROUP.radii`; `warbotAct` scans and leashes by it instead of `SORTIE_REACH`), **patrol** 2-3 points
  and **attack** 1-5 waypoints (`agRoute`: on to the next once 60% of those on the flag are within 3.5 tiles and none is
  fighting for `AGROUP.dwell` 3 s; an attack also needs no enemy building within `RALLY_REACH2` nor armed robot within 5,
  and holds at its last, `ord.done`), **follow** 2.5 tiles behind the other group's units (`agFollowXY`; no cycles). Free
  units of the group (`agFree`: not being mended, refilled, recycled, aboard or reloading in a garrison) are put back on
  its flag (`agJoin`: `marchTogether`, `paceSquad`). A direct order (`command`, `undoCommand`, `scorch`) to a unit of a
  group pauses it (`agManual`, `g.paused`) until **Back to order** (`agResume`); **Recall all** and a flag's Call them
  back pause it too (`agRecall`), its flag staying. Garrisons never hand a group's unit out (`takeArmed`,
  `stationWarbots`); Ferries don't board them unless selected. **Reinforcements** (`agPickFor` in `spawnFromFoundry`):
  the Reserve (the old way: the rally point, else the Command Base) while the garrisons' keeps aren't covered by the
  Command Base's free warbots (with no rally point set); else the first group by priority under its size that the
  Foundry's zone reaches, as a recruit (`u.grpNew`) that waits at the Reserve until `AGROUP.batch` (3) are ready or as many
  as the group lacks, or `AGROUP.batchWait` (30) s (`agBatch`), then marches out (`u.grpGo` until within 4 tiles:
  `P.stats.agJoined`). In `hashState` (only when there are groups, or a unit has `u.grp`), saves and `checkSave`.
  Keys: Alt/⌥ + 1-6 selects a group (twice: the camera to it), with Shift its panel; Ctrl/⌘/Shift + 1-9 (and Alt + 7-9)
  still save control groups. Cards (`#agcards`, `refreshAgCards`): tap selects, again jumps, right-click or a 550 ms hold
  opens the panel (`openAgSheet`), a drag onto the map or minimap gives an Attack order to that tile (`agSendTo`); map
  picks for points and home (`R.mode` `agpick`, `agPickTap`, `agPickDone`); plans drawn by `drawAgPlans` in `js/render.js`.
- **Army Groups, stage 2** (sim.js "Army Groups, stage 2"; orders `agOrder` with a Raid's `rep`, `agBeh`, `agRaidRep`;
  numbers in `AGROUP.raid`, `AGROUP.rets`, `AGROUP.stances`, `AGROUP.aggLeash`, `AGROUP.hitHold`, `AGROUP.beh`).
  **Raid** (`AG_ORDERS.raid`, `agRaid`; panel key **R**, its area picked like Defend area's, 8 tiles to start): `g.ord`
  keeps `at` (0 going in and striking, 1 pulling out, 2 resting at home), the target (`tk` 'b' building, 'u' robot,
  'road' tile; `tg`), `t`, `n0`, `n`, `hits`, `why` (`AG_RAID_WHY`), `rep` (1 Repeat, 0 Once then hold: `done`), and
  for the AI a forming-up spot `sx, sy`. `agRaidPick` takes the best economy target in the circle (factories 7, Depots
  6, mines and the like 5, Haulers and trucks 5, Workers 3, roads 2, junctions 3; less for armor, distance and armed
  foes near) that no enemy gun covers (`gunCovers`, the danger map) and where armed foes don't outnumber the group;
  never defences (`agRaidValue`). The flag goes to it with `r.target` (they shoot it first), `r.follow` (they chase
  it) or `r.raid` (they tear the road up, `sabotageRoads`); `followRallies` leaves group flags alone. `r.safe`: a
  group unit on that flag, marching, routes with `opts.safe` (the goods carriers' way round the guns' reach; with no
  way round, `squadRoute` falls back to the usual dear-through-cover route), both ways. It pulls out (`agRaidOut`:
  flag home, units marching, `u.march`) on losses (40% of `n0`), armed foes within 7 tiles of the target
  outnumbering its armed units there, average health under 35%, half out of Ammo, 120 s at the targets, or nothing
  safe left; at home it rests until 70% health (10 to 60 s), then raids again or holds. **Behaviours** (`g.beh`
  `{ ret, rel, st }`, `agBeh`, defaults `AGROUP.beh` 25/on/def): Retreat when weak (`warbotAct`: a group unit on its
  flag below `ret`% goes to a Repair Station, close fight or not, and comes back by `u.resume`; 0 never; groups
  ignore `REPAIR_RETREAT`); Reload rotation (`agRotate` in `agTick` sends the lowest on Ammo, a third or less left,
  `agReloadOk` holds back `holdRally`'s own Ammo and tank runs, so at most a third (at least 1) are away at once,
  `agAwayReload`; each fills up); Stance (`warbotAct`, `holdRally`): `agg` adds `AGROUP.aggLeash` (7) tiles to the
  leash and the flag's reach, scans that much further and anywhere, and hits buildings 3 tiles further; `def` as
  stage 1; `hold` (`agHoldFire`): no new targets, no buildings, crates or roads until one of the group was hit in the
  last `AGROUP.hitHold` (5) s (`g.hitT`, kept by `agTick`); not on a Raid. **Command view** (`drawCommandView`,
  `cmdViewOn` in render.js; `toggleCmdView`, `cmdGrab` in ui.js): at zoom `CMDV.z` (13) or less, or with `UI.cmdView`
  (**Tab**, the minimap's `#mm-cmd`; Tab or Esc again restores the camera), a banner per group (badge, count, health
  bar, order word) over its units, a line and arrow to its flag, and every group's plan (`drawAgPlans`), all drawn on
  the map canvas from one pass over the robots; the banners' rectangles (`UI.cmdIcons`) are hit-tested by `mapGrab`
  (input.js `onGrab`, now for a mouse too): a drag drops an Attack there (`agSendTo`), a tap opens the panel.
  **Rivals** (ai.js): `aiGroupRaid` sends each raid but a Torch's farm raid as a "Raiders" group on Raid (that road
  first, `AI_RAID_RAD` 8, Once; a Salvager's forms up at its staging spot), broken up once home (`aiRaid`); and
  `aiHomeGuard` brings the Command Base's home guard out under siege as a "Home Guard" group on Defend area (8 tiles;
  not a Salvager), broken up 30 s after. New state in `hashState`, saves and `checkSave` (`g.beh`, `g.hitT`, the
  raid's fields, `r.safe`). Tests: `army-groups2-test.js` (the test kit).
- **Saving:** solo games keep up to five restore points about a game minute apart in localStorage
  (`terrafall.restorePoints.v1`: the newest first, each `{ time, json, at }`, `at` the real time it was kept; a full
  storage drops the oldest until the rest fit). The pause menu's **Restore points** item (`#p-checkpoint-group`,
  `showCheckpoints`) lists them as "14:00 in game · 3 min ago" (`checkpointLabel`; game minutes for a point kept before
  `at`), says when the first comes while there is none, and is hidden in multiplayer, watching and Ironman. Pick one
  and choose **Restore** in the pause menu or on the game-over screen, then confirm. The main menu opens the
  latest solo history after a reload, and **Continue** still opens older single autosaves. If storage is tight, the
  game keeps fewer points. Multiplayer hides restore points. Switching away or closing the tab also
  updates the save used by **Continue**. The pause menu says when it last saved, and a failed
  save (storage full or blocked) is reported once. A long game's save is about 250–300 KB. Saves live in that browser
  only: **Download save file** (pause menu, `downloadSave`: through the artifact `downloads` capability in claude.ai,
  an ordinary download elsewhere) writes `terrafall-<mode>-<date>-<time>.json` (`saveFileText`: the save with when and
  what), and **Load a save file** (main menu, More, `importSaveFile`) loads one, a bare save too. A save is checked before it is used
  (`checkSave` in `js/world.js`: unknown building, robot, good, biome, map type, mission or event, map layers of the wrong
  size, owners or places off the map, or a name holding `<`, `>` or `"`; in text those three are swapped for look-alikes
  that can't make markup, so nothing in a save can run script in the panels; a multiplayer catch-up is checked the same
  way). One that fails is refused and changes nothing; if
  Continue can't load this device's save, the menu says so. A loaded file becomes this device's save only once its game
  is running (`enterLoaded`), and the save it replaced is kept as a backup (`SAVE_BACKUP_KEY`, `botfall.save.bak`).
  If the browser refuses the new resume save, the loaded game still plays and the warning points to **Save → File**.
- **Save slots and the Continue card** (`js/qol.js`, `#screen-saves`): the autosave (`SAVE_KEY`, Continue's) plus `SLOTS`
  = 5 manual slots, each a whole save under `terrafall.slot.<n>`, with one small index (`SAVE_META_KEY`,
  `terrafall.saveMeta.v1`: per save its name, real date saved, map or mission, mode and game time) so the list never parses
  a save. `saveGame` (js/world.js) calls `noteAutoSaved` after writing the autosave, to date its line; an autosave from an
  earlier version with no line gets one the first time it's listed (dated "earlier"). **Saved games** (pause menu **Save →
  Slots**, main menu **Saved games**) lists the Autosave and Slot 1–5: name a slot and **Save here** / **Save over**
  (confirmed; not in multiplayer, Observer mode or a finished game), **Load** (through `loadSaveText`, so a loaded slot
  becomes the autosave and the old autosave the backup; from a game it asks first) and **Delete**. The main menu's
  **Continue** card (`syncContinue`) shows the newest save's line and resumes it (`continueNewest`). A slot that doesn't fit
  in storage says so and nothing changes.
- **Camera spots** (`js/qol.js`): **Shift+F1–F4** keeps the view (x, y and zoom) as spot 1–4, **F1–F4** goes back; under a
  finger the 1–4 pips at the minimap's foot (tap an empty one to keep the view, a lit one to go there, hold to keep the
  view there instead). Kept in `S.camSpots`, an interface-only field saved with the game like `S.checkpointRun` (no rule
  reads it, `hashState` leaves it out; a save's values are checked before use); in multiplayer in `QOL.spots`, this tab only.
- **Recent alerts** (`qolAlert`, `jumpAlert`): the last 8 warnings with a place; **J** goes to the newest, and again within
  5 s to the one before, round the list, with a line in the middle of the screen (`qolFlash`) naming it.
- **Goods a minute and warnings** (`qolHudTick`, with the HUD every quarter second): `playerGoods` sampled once a game
  second over the last 60 s gives each good's net change a minute, shown after its count on a wide screen (hidden on a
  phone, where a tap opens the Economy panel and its rates) and in the counter's tooltip. A good whose producers' output
  stores (`def.out`, storage aside) hold 90% or more of what they can for 20 s gets an amber ring and a message with Go
  (at most every 3 minutes a good; it clears below 75%). At 90% of the robot limit the robot counter turns amber with
  the count against the limit, with a message at 90% and another at the limit.
- **Polish round 2** (`js/polish.js`, interface only but for Surrender):
  - **Reach rings**: pointing at any colony's defence (a building with `range` or `missile`) draws its `drawRanges` ring
    at 55%; an armed robot hovered, the robot whose panel is open and the picked army (up to 12) get a faint ring of
    `unitReach` (an army robot's `range` or `WARBOT_RANGE`, a Howitzer's `ROCKET.range` with `ROCKET.min` dashed). A
    building picked or being placed keeps its own rings as before. None in photo mode.
  - **Health bars** (`hpBar` in `js/render.js`, used by every robot, ship, plane, critter and building bar): shown while
    damaged, green over 60%, amber over 30%, red below; what's picked always shows one (faint when whole). The Settings
    switch **Health bars** (`R.hpBars`, `terrafall.hpbars`, on by default) hides the rest.
  - **+N popups** (`samplePops`, `drawGoodsPops`): twice a second your built storage and producers in view are diffed
    (storage: every good; a producer: its `make`/`out` goods); gains add up per building, and each building shows at
    most one popup every 2.5 s (its top two goods, "+3 ▪"), 7 at once, 1.8 s each. Not on Graphics Saver, zoomed out
    below 16 px a tile, in photo or Observer mode.
  - **?** in a building's or robot's panel title (`panelHelp`, from `openSheet`): How to play at `helpTopic(type)`:
    `TOPIC_FIX`, else the section naming it most (bold counts triple); other panels use `PANEL_TOPICS`.
  - **Idle** (bottom bar in a war, **,**): `idleArmy` (your army robots and Howitzers out in the open with no task or
    a `hold`/`park` one, not fighting or moving) grouped within 5 tiles, biggest first; each press picks the next group
    (`selectBots`) and centres on it. The badge counts them (`polishHudTick`).
  - **Surrender** (pause menu, tap twice; Versus only, not missions or Observer): the order `surrender` (js/orders.js)
    gives the colony up to `surrenderTo(p)` (`beatenBy`, as a computer rival's surrender) through `surrender`/`eliminate`,
    so in multiplayer it lands on every device on the same tick; the end screen reads "You surrendered to …".
  - **Rematch** (end screen): `UI.lastGame` holds the options `startNewGame` used (or the mission and difficulty) for the
    game being played; Rematch calls `startNewGame(opts)` again (no new random pick), or `startMission`. Hidden in
    multiplayer, Observer mode, after a loaded game and after a lost or final mission (Try again / Play it again).
- **The Daily Planet** (`js/polish3.js`): the main menu's amber card at the top of the rail (`m-daily`, its date short by `dailyShort`) starts the day's game: `dailySetup(date)`
  turns the UTC date (`dailyDate`, YYYY-MM-DD) into ordinary `startNewGame` options by a hash of it (map type of the
  ones taking two or three colonies, players, biome, ground, resources, three different doctrines, seed, planetary
  events; Versus on Normal, no challenge modifiers), so the game itself stays a plain one. A win's time is kept per day
  in `terrafall.daily` (`{ tries, wins, best }`, the last 60 days; not with Boosts) by `dailyOver` on the end screen,
  which also says so; Rematch reuses the same options and counts too. No online leaderboard.
- **Cloud saves** (`js/cloud.js`, `#screen-cloud`): **Save to the cloud** (pause menu, `cloudSave`; hidden in multiplayer
  and Observer mode) gzips `saveFileText()` in the browser (`CompressionStream`) and sends it to the relay's `POST /save`,
  or `PUT /save/<code>` with the key when this device already has a code for this game (`terrafall.cloud` in
  localStorage: `{ code, key, at, game }`; **New code** posts a fresh one and deletes the old). The dialog shows the code
  (`XXXXX-XXXXX`), the link `https://terrafall.app/#save=<code>` (`cloudLink`) with a QR code of it made offline by
  `qrSvg` (`js/qr.js`), Copy link, Share and the expiry. **Load from a code** (main menu, More, `cloudLoad`) and opening a
  `#save=` link (`cloudFromLink`: at start, on `hashchange` and from `launchQueue`, so an open installed app takes it
  too; it asks first, then clears the address) fetch `GET /save/<code>` and load it as Load a save file does
  (`loadSaveText`, shared with `importSaveFile`).
- **Send feedback** (`js/feedback.js`, `#screen-feedback`): the small **Feedback** pill beside **Lore** at the foot of the
  main menu, and **Send feedback** in the pause menu, open a short form: the kind (**Bug**, **Idea**, **Balance** or
  **Other**), the message (3 to 5,000 characters, with a counter), an optional email or name (up to 200), a hidden
  honeypot field (`website`) and, only while a game is running, **Attach my current game** and **Attach a picture of the
  map** (each ticked for a Bug, unticked for the others until the player sets it). It posts JSON to the relay's
  `/feedback` (`feedbackUrl`: `relayUrl()` with `wss:` as `https:`, see Multiplayer, The relay): `{ type, text,
  contact?, meta, save?, shot?, website }`. `meta` (`feedbackMeta`, kept under 4,000 characters of JSON) is the build
  (`feedbackBuild`: index.html's `terrafall-build` tag, `dev` in the repository, which the publishing workflow stamps
  with the commit's short hash and the date, e.g. `1902487 2026-11-17`, and `tools/build-single.js` the same with
  `one-file`), the game's version (`gameVersion`, the fingerprint the lobby compares), the browser's user agent, the window's size, pixel ratio and touch or mouse and, from a game: mode (or
  mission and its difficulty), map type, biome, size, seed, players, the rival difficulty (Versus), game time and the
  last five messages (`UI.msgLog`). `save` is `saveFileText()`, the file Download save file writes, left out (and the
  thanks say so) if it is over 8 MB. `shot` (`feedbackShot`) is the map's canvas (`R.canvas`: no panels or menus) at
  most 1,600 px on its long side as a JPEG data URL under 1 MB (a lower quality if need be). The form says in one line
  what is sent. **Sending…** holds the button; on 200 it
  thanks the player with the report's number ("Report #n is filed.") and empties the text; 503 `off` (feedback not set up
  on the relay yet), 429 (too many reports), no connection and any other error each get their own words, and the text is
  never lost (it stays through closing the form too). It is only interface: it sends no order, doesn't change
  `UI.paused` (opened over the pause menu the game stays paused; a multiplayer game runs on under its menu as always) and
  takes every key pressed in it, so no hotkey fires while typing. Esc, Back or a phone's Back close it (on the main menu
  opening adds a history entry, as the Lore guide does; in a game `escapeKey` closes it first).
- **Photo mode** (`js/photo.js`, `#photo-bar`): **Photo mode** in the pause menu, or **Shift+P** (`photoEnter`), hides the
  whole interface (`body.photo`) and stands the game still (`UI.paused`; a multiplayer game runs on), and taps and drags
  on the map only move it (`inputSwap` gives `INPUT` handlers that select, order and paint nothing). A small toolbar
  fades after `PHOTO_IDLE` (3.2 s) left alone and comes back at a tap on the map, a mouse move or a key: **Time of day**
  (a slider over the 12-minute cycle; it sets `TOD.over`, which `todNow` and `todFrame` show instead of the game's
  clock: looks only, `S` and `S.time` don't change, the narrator's nightfall line ignores it, and it is let go on
  exit), **Borders** (`R.terrOff`: the land's tint and border lines) and **Minimap** (both off unless switched on,
  kept on this device in `terrafall.photo`), **Save picture** and **Exit**. The map is drawn by `photoRender`, which
  sets aside the selection, range rings, a Paths plan, a building being placed and the hover marks only for the
  drawing, with `R.clean = 2` (render.js leaves out badges, health bars and paused and cut-off signs). **Save picture**
  (`photoSave`) draws the map once more at the screen's full resolution (`devicePixelRatio`, up to 3 and
  `PHOTO_MAX_PX` pixels: `R.dpr` may be lower while the game runs), adds the minimap if it shows and a small
  Terrafall mark bottom right (`photoMark`), and offers `terrafall-<seed>-<date>-<time>.png` (`toBlob`) the way
  Download save file does: the artifact `downloads` capability in claude.ai, else an `<a download>` link
  (`plainDownload`, which takes a Blob too). Esc, Shift+P, **Exit** or a phone's Back (`escapeKey`) leave it, back
  to the pause menu if it was opened from there; everything set aside comes back as it was.
- **Observer mode** (`js/watch.js`, `#screen-watch`, `#watch-card`): **Observer** (`#m-watch`, in the main menu's **More**) opens a setup card
  (`openWatch`, built once by `buildWatch`, kept up to date by `syncWatch`), laid out like Custom Game's (sections **Match**,
  **Planet**, **Rules**, **Challenge**, `.m-sec`, with the summary and Start observing in a bar that stays in view) and
  built from its parts: `segChoice`/`markSeg` (the choice rows), `hoverInfo` (each section's line), `shapePickRow`/
  `biomePickRow` and `openPicker(kind, ctx)` (the map type and biome pickers, picking for `watchPickCtx`), `randomShape`,
  `terrainInfo`, `resourceInfo`, `MURMUR_INFO`, `VICTORY`, `MODS`. The setup (`watchSetup`, kept on this device in
  `terrafall.watch`; what an older one lacks comes as Observer mode always had it): `n` colonies (2, or the map type's
  `minPlayers` to `maxPlayers`; Random: as asked), `teams` (2 vs 2 with four, Capture only: `watchTeams`), `victory`
  (Capture, Domination, Uplinks; no Uplinks in the Hollow: `watchVictory`), `diff` (Normal by default; `humans: []`
  gives every colony, player 0 too, the level's head start and pace: `WATCH_DIFF_INFO`), `docs` (each colony's doctrine
  or Random: one no other colony has), `shape`/`shapeRnd`, `biome`/`biomeRnd` (Random by default; with the Murmur on, a
  random biome is never Argos, `watchBiome`), `size`, `rough`, `rich`, `seed` (a saved planet picked from Custom Game's
  saved planets, or null: a new planet each game; changing the map's settings drops it), `nuke` (on), `events` (off, as
  before), `murmur` (`w-murmur`: Off, Quiet or Active, Active by default; none on Argos or a map type without room for
  nests: `watchMurmur`) and `mods` (`WATCH_MODS`: every challenge modifier but No turrets, which only binds people; Rival
  head start gives every colony the head start). Left out: Mode (always Versus), Unlimited resources (a player's own
  colony), the device's Time of day, Weather and Graphics (set in the pause menu, they apply to a watched game too).
  The scout report has nightfall, dawn and a nest or the Deep's mound wrecked as news (whoever has the most warbots
  round it named as the wrecker), and with Domination or the Uplinks who takes or loses the lead (`watchEvents`).
  **Start observing** (`watchStart`) is a normal game in which the computer plays every colony: `newGame` with
  `humans: []` (each gets the rival's difficulty settings and doctrine; COBALT's doctrine is set straight after, since
  `newGame` gives player 0 the Steward) and the setup's options. `ME`
  stays 0, a colony the computer plays like the rest (as in the menu's backdrop game), for what this device shows and
  hears; `S.watch` has the game play on to the last colony standing (`eliminate`: a game with nobody in it otherwise
  ends when COBALT falls), and `playerName` says COBALT, not You. Nothing is saved: `saveGame` and `autoSave` never save
  a game whose player 0 the computer plays, and `clearSave` isn't called, so the player's own save stays as it was
  (Download save file is hidden). The HUD keeps the clock, the speed (`WATCH_SPEEDS`: 1×, 2×, 4×, 8×; `speedList`) and the
  pause menu (**Back to the menu**, Photo mode, Statistics); the minimap works; goods, the goal, the tools and the
  selection are hidden (`body.watching`). Taps and drags select and order nothing (`inputSwap`), and only the keys that
  move the map, pause, change speed, show the minimap, Statistics or How to play reach the game (F follows the
  action). `R.clean = 1` leaves out the marks render.js draws for this device's own colony. **The Scout report**
  (`watchReport`, once a second by the clock; its title folds it away to the colonies' line) lists each colony by doctrine ("the Warden", or "the blue Warden" when
  two share one) with its warbots, then up to two lines: news first for 15 s (a Command Base taken, a surrender, a
  nuclear launch: `watchEvents`), then the busiest colonies, read from the computer's own plans in `js/ai.js` without
  touching them (`rivalPlans`, which the scout reports of your own games read too, put in words by `watchDoing`: `P.stormOn` storming or forming up to storm a Command Base, `P.march` and `P.siegeAt` a
  march and its target, `P.homeCall` under attack at home, Missiles and bombers in flight, `P.raid` a band raiding a
  colony's road, named by its compass point from that colony's Command Base, `P.pushOn` a Warden's big push,
  `P.massFor` massing for a push; when quiet, an opening line for its doctrine or what it has built). The game's own
  messages are for a colony's player ("your Command Base"), so they're dropped. **The camera** (`watchCamera`) glides to
  the busiest fighting (`watchSpot`: warbots in a fight, buildings just hit, shells and missiles landing, in 10-tile
  cells; a spot keeps the camera while it's half as busy as the busiest), else the biggest band on the move, else each
  Command Base in turn; once the map is moved by hand it stays (**Follow the action**, or F, takes it back). The end
  (`watchOver`, from `showGameOver`) says who won (a team: both colonies) and how, and when each colony fell, with
  **Observe another** (the same setup, on a new planet unless a saved one was picked) and **Main menu**; `toMenu` ends Observer mode (`watchEnd`).
  Taps open the panel of the building or robot there (`watchTap`, `WATCH_INPUT.onTap`; tapping the same spot again steps
  to the next, as in a game), to look at only: while watching, style.css hides every button, field and switch in a
  panel (`body.watching #sheet-body`), no key presses one (`sheetKeyButton` finds none showing), and the owner line names
  the colony and its doctrine (`ownerLabel`); a tap turns Follow off, so what was tapped stays in view.
  On a phone (under 700 px wide) the Challenge section folds away under **More options** (`w-more`, `syncWatchMore`: it
  says how many challenges are on); planetary events default to off there (the owner's call).
- **Scout reports** (`js/scout.js`): in your own games (not Colony, not Observer), `scoutTick` (from `uiTick`, once a
  second by the clock) reads each enemy computer rival's plans with `rivalPlans` (the Observer's reading, above) and
  `scoutNews` turns them into news, each with a key: a storm of your (or your ally's) Command Base forming up (and
  `stormgo` as it goes in), a march on one of your forts (`P.siegeAt`'s building), a band raiding your road (named by
  its compass point from your Command Base), massing for a push on one of your forts, a Warden's big push, and a
  rival pulling back to hold its base while 3 of your warbots are within 12 tiles of it; of the other rivals of a
  free-for-all only their storms and marches. A piece of news is told once while it lasts (`SCOUT.news`: it's over
  once it hasn't been seen for `SCOUT_OVER` s), once it has lasted `SCOUT_DELAY` (6 game seconds; a storm going in, 2),
  at least `SCOUT_GAP` (15 s) after the last report, the most important first; massing and pulling back are told again
  after `SCOUT_AGAIN` (300 s) if they go on, and massing is one piece of news however its aim moves between colonies
  (`quiet` while it isn't you). Fair: bands are counted as the map shows them (warbots out in the open, `watchBand`),
  an army's size is "about" (`scoutAbout`, from the warbot count Statistics shows), and the number a rival waits for
  (`P.massFor.need`) is never told. It's a `toast` (Go to the place, kept in the message list) starting "Scouts:".
  **Scout reports** (a switch in the pause menu's Settings), kept on the device (`terrafall.scouts`). Display only.
- **Mouse cursor** (`js/cursor.js`): with a mouse (`any-pointer: fine`), the game draws its own cursors at start-up,
  sharp at 1× and 2× (`drawCursorImage`; `image-set` where the browser takes it): the owner's pick, "Midnight", in the app
  icon's colours (navy, coral, cream; flat, no glow): a navy arrow with a cream rim and three thin coral stripes across
  its tail; the arrow coral (shaded like the planet, its stripes navy) over what takes a click; a cream frame for
  placing and painting; a coral reticle for attacking and aiming, a cream one for landings and air drops; four cream
  arrows while a drag moves the map. `buildCursorSheet` reads every
  cursor rule in the page's stylesheets and asks it again under `html.tf-cur` with ours in its place (pointer → lit,
  crosshair → frame, default → arrow; the rest, such as not-allowed, stay the system's), so new styles need nothing
  here; text fields keep the I-beam. The map's cursor follows what's under the mouse (`cursorTick`, from `render`, a
  look every 0.1 s): lit over any building or one of your robots, the coral reticle over a rival's with warbots picked
  (`canvas#game[data-cur]`). **Custom cursor** (a switch in the pause menu's Settings, shown only with a mouse), kept
  on the device (`botfall.cursor`). Display only.
- **Blueprints** (`js/blueprint.js`): off unless switched on (`bpOn`, `terrafall.blueprints.on`, the `#p-blueprints` Settings switch; off hides the `#build-bp` card and the box chip). Kept on the device (`terrafall.blueprints`, up to `BP_MAX` = 8, newest first,
  each `{ name, b: [[type, dx, dy]...], r: [[dx, dy]...] }` round its middle; `bpList` drops anything damaged). Saving:
  **Build → Blueprints** (`openBlueprints`, the `#build-bp` card shown on every tab) → **New blueprint** enters mode
  `bppick` (`UI.bpPick`: tap your buildings to pick or drop them, a mouse drag boxes several, `onSelectBox`), or with a
  mouse a selection box that catches no warbots but buildings of yours offers the `#bp-offer` chip for 8 s
  (`bpBoxOffer`); `bpFrom` keeps the buildings the Build menu places (and Walls and Gates, up to `BP_PIECES` = 30) and
  your roads, laid or planned, within a tile of them. Named after its commonest building ("Smelter block"); the name
  is edited in the list, and ✕ twice deletes. Placing: mode `bpplace` (`UI.bpPlace`: the ghost starts mid-screen,
  follows the mouse, `bpHover`, or goes where a finger taps; R or **Rotate** turns it, `bpTurn`). `bpEval` checks each
  piece with `canPlace` (and `canRoad` for roads) twice a second or when it moves: red can't go, red and dashed past
  `MAX_SITES` (Walls and Gates don't count), drawn by `drawBlueprint` (called from render.js). **Place here** (or a
  click, or a second tap on the spot: `bpPlaceNow`) sends a `place` order for every building that fits and one
  `paths` order with the new road tiles, then a message says how many went down, how many the site limit held back and
  why the rest couldn't go. No new order.
- **A failed frame never stops the game:** `frame` books the next frame before running this one and catches its errors
  (reported once each to the console), and each stage of a frame (simulation, camera, drawing, interface, sound) runs
  on its own (`stage` in `js/main.js`): one that keeps failing during a game says so once and pauses saving
  (`UI.saveHold`), so the last good save is still there to reload. A Missile Silo's placement preview used to throw (`siloReady` on a stand-in
  with no stock), which stopped the drawing loop: the game froze when you went to place one. An art image that fails
  to download is tried once more a moment later (`loadImg`), and one that still fails draws nothing or the shape drawn
  in code: a missing canyon lip, Viaduct tower, Freight Train wagon or crossing barrier no longer makes the map throw
  (a Rift or Sky islands map could not start).
- **The menu's backdrop:** the planet turning (see **Wind, water, sky and the planet view**); under it an AI-vs-AI demo game plays on, drawn whenever the planet isn't showing. It opens 150 s into its game, fast-forwarded
  a slice each frame (`DEMO_WARM`, at most `WARM_MS` of a frame, in daylight: `TOD.dayHold`), so the page never waits
  for it at launch or on Save and quit (it ran all 4,500 steps at once: seconds on a phone).
- **Gates on track:** a Gate can stand across railway track (`canPlace`; a wall line crossing track puts one there,
  `wallKind`), and track can be laid through your own Gate (`railBlocked`). Your trains run straight through it (rail
  routes ignore it; it's `passTile` for its owner); enemy robots can't walk through.
- **Wall to Gate:** a built Wall's panel has **Make it a Gate** (`wallToGate`): it becomes a Gate where it stands, for
  the difference in cost (1 Cement and 2 Alloy, `gateUpgradeCost`, paid from storage), keeping its share of armor.
- **Through traffic:** an Outpost or Gate a road runs through counts as the best road leading into it, never worn
  (`throughPave`), for speed and route planning, so it never slows the traffic going through: asphalt on either side
  makes it asphalt (Freight Trucks and Road Trains keep their speed).
- **Crates and loot:** goods inside any building that's wrecked, blown up, lost or demolished spill out as a crate
  pile on its tile (`dropLoot`, called by `destroyBuilding`; up to `LOOT_MAX`), and a robot destroyed with a load
  drops it (`dropCarried`). On a player's own land its Haulers (a Freight Truck for a big pile; workers with no
  Haulers) collect piles and take them to storage (`dispatch` step 4d, `doCrate`) while no enemy robot or gun is
  within `CRATE_SAFE` tiles (`foesNear`). Idle or victorious warbots nearby carry one crate each to their side's
  nearest garrison and go back for more (`doLoot`; none where their side has no garrison on that ground, `lootNear`:
  stranded across the water they picked a crate up and put it back every tick); a rival's stays home instead while its colony, with a decisive lead,
  gathers an army it already has for a march or a storm (`lootHeld`: `P.massFor` with `lead` and as many armed warbots
  as it takes, or `P.stormOn`), since only garrisoned warbots can be sent (`aiSpare`), and on the Hollow, whose cleared
  nests' hoards never rot, half its army shuttled crates while it "massed"; one without the lead or short of the
  warbots keeps looting (the crates may be the Alloy it lives on), but while it masses for a march with the warbots
  it needs no more than a quarter of its armed army goes on carrying (`LOOT_MASS_SHARE`: in an even Hollow war 11 of a
  Steward's 26 shuttled crates for half an hour while it massed for 15 it never had at home, and a 27-minute game ran
  to 71). A player's warbots holding a flag (not the rival's) carry home piles within `FLAG_LOOT` (8)
  tiles of it once no enemy robot (the Murmur too) or gun is as near, up to half the squad at a time, and go back to the
  flag after (`flagLoot`, `flagPile`, `u.resume`); they used to stand beside a nest's hoard and leave it to rot. Crates
  left at an Outpost (`b.loot`) are hauled on to storage, and its panel lists them as Salvage (with a warning if no road
  joins it to storage).
  Piles on claimed land stay; on no-one's land they rot after `LOOT_TIME`. Claims on a pile are recounted from the
  bots' tasks every second (`updateLoot`), so a run called off never leaves a pile looking taken.
- **Walls and Gates (Versus):** in Paths, **Walls** (**X**) sketches a wall line: a Wall on each tile (5 Cement, 40
  armor) and a Gate where it crosses a road (6 Cement + 2 Alloy, 32 armor; tap a planned Wall to make it a Gate).
  They're `prepaid` (paid from storage on Build, no Hauler or road, outside the site limit). A Worker builds a Wall
  from beside it on the home side (`wallStands`: the free neighbour nearest the Command Base by walking, or a Wall
  site there, the inner row of a double wall, which then waits for the outer row), so nobody is left on top of it,
  walled out; a site with neither is built from its own tile. (Not the rival's: its lines always keep a Gate,
  `aiWallGate`, `aiTurtleWalls`, so its builders build on the tile as before.) Walls block every bot;
  Gates let their owner's bots and road through (`passTile(t, who)`). Armed enemy warbots plan through a Wall or
  Gate as if it were `BREACH_COST + armor` tiles long, so they go round a short way or stop and shoot through
  (`breachHit`); a bot whose route gets walled off re-plans (`blockedStep`). An order whose squad can't shoot
  through the walls on its routes says so to the player who gave it (`squadBreach`, `breachCheck`: the armor to shoot
  away against what the squad carries, `breachShots`, counting one reload near the wall for an attack, see
  `startReload`; a Bulwark never runs dry); the rival can ask before it orders (`attackBreach(owner, target, count, all)`
  gives `{ need, shots, sent }`), and `sendToRally` returns it as `breach`. On Chokepoint maps the AI walls the mouth
  of each channel on its side on every difficulty but Easy (a Warden on Easy too: `aiWalls`). Its Gate goes on a mouth
  tile its bots can walk to from the Command Base without going through another mouth, and get on from to the middle
  of the map with Walls on the rest (`aiWallGate`, walking the ground with `aiFlood`): an existing Gate, its road
  through, or the middle tile and outwards. The middle tile (or the road) could be a spur beside the one tile that
  leads on, and the Wall there shut the colony's own warbots in. A mouth no Gate keeps open is left unwalled, and a
  Wall of its own that shuts one (an older save) comes down; mouths with every piece up are looked at again every 30 s
  (`P.gateChk`).
- **Garrisons and posts** (yours, `usesPosts`; the AI spreads its own to the front as before): every warbot belongs
  somewhere. `u.post` is the Outpost or Bunker it was stationed at; with none it belongs to the Command Base. All your
  warbots stay at the Command Base until you station some: tap an Outpost and **Station here** (how many; from the
  Command Base first, `stationSources`), select warbots and order them in (`orderStation`), or set the Outpost's
  **Keep** (`keepAt`; 0 unless set, per garrison `b.keepW` Auto/0/1/2/4 or for every Outpost in the Army banner
  `P.keepW`): `stockPost` keeps that many posted there, sent from the Command Base and replaced when lost. Wherever a
  warbot goes (a sortie, a rally flag, an attack, repairs, a loot run), it comes back to its post (`goGarrison`).
  Attacks, rally flags and beach landings draw first on the Command Base (which keeps its own Keep, 1), then on warbots
  stationed at Outposts, nearest first (`spareArmed`/`takeArmed` with `posted`): they go, and come back to their post
  when recalled; their Outpost isn't restocked while they're out (`postedAt` counts them). They sortie to defend their
  own Outpost too. Only stocking another garrison (Station here, Keep) leaves stationed warbots where they are
  (`freeToGo`). A Wall standing alone is drawn as a full section with a pillar at each end, across whatever it plugs
  (`drawBarrierArt`). **Send them back to the Command Base** (`unstation`) releases an
  Outpost's warbots and sets its Keep to 0. A Bunker always keeps its two (stocked the same way). **Your robots** (the
  population chip) lists where your warbots are (`warbotGroups`: at the Command Base, in Outposts, heading home,
  attacking, on a rally flag, guarding, being repaired, carrying loot, or standing with nowhere to go), and **Show**
  takes you to each in turn. Garrison priority (High/Low) still orders the AI's and any warbot with nowhere else to go. A garrison's panel shows how
  many are inside and what kinds (`garrisonMix`: "3 Warbots, 1 Bulwark, 1 Torch").
- **Guards** (`garrisonDefense`): enemy warbots near a garrison bring out one more guard than there are of them, and
  the guards fight foes within `SORTIE_REACH` (6.5) of it. A guard lets a foe go (and leaves it alone 12 s) once it's
  more than `SORTIE_LEASH` (9) tiles from the fort and out of the guard's reach, so a passer-by can't lead the guards
  off into its own side's guns. A fort with no enemy at its own walls also answers for the buildings round it: where
  enemy warbots (or creatures) are hitting one of its owner's buildings within `AREA_DEFENCE` (14) tiles
  (`P.raided`, set in `hitBuilding`), it sends one guard more than there are raiders, never its last armed warbot
  (`task.ax`/`ay`: the guards' leash is measured from there, the spot follows the raid, and they go home after
  `AREA_QUIET` (6) quiet seconds). A squad on a rally flag outside rival land guards the ground round it the same
  way (foes within 6.5 tiles of the flag, leash 9).
- **Rival doctrines** (the lore's command doctrines, LORE.md; `PERSONALITIES` in `js/defs.js`, each player's `style`,
  applied by `aiStyle`/`aiLevel` in `js/ai.js`; the keys stay the old style words): each scales the difficulty's grace
  period, attack threshold, army growth and raid rate (the attack threshold stays between 3 and `AI_THRESHOLD_MAX`, 9:
  an Easy Warden's came to 11, more than its army ever grew to). The **Steward** (`balanced`) is the plain AI with a little more of everything (Nov 26 2026: `econ` 1.1, `army` 1.15, `armyFrom` 0.8; as the plain AI it won 4 of 16 doctrine games, its economy lasting but its army never catching up; see docs/economy-balance-audit.md). The **Warden** (`turtle`):
  rare raids, a square ring of Walls and Gates six tiles round its Command Base (`aiTurtleWalls`: once it has
  `AI_TURTLE_KEEP` (3) Outposts, the side facing its rival first, at most `AI_TURTLE_WALLS` (12) pieces standing,
  Chokepoint mouths included; with the Murmur Active not before `AI_TURTLE_ACTIVE`, 20 minutes, and its `army` 1.15
  there, `AI_ACTIVE_STYLE` over its doctrine in `aiStyle`: the parity pass of Nov 2026, when it won 3 of 16 on Active
  against 7 on Quiet, their Sappers breaking the ring its Cement went into; with it, 7 of 16), up to three Keeps from seven minutes (its first waits for 3 turrets and 3 Outposts),
  four Pulse Turrets (one every six minutes) and three front guns, no bombers, and its big push (`aiPush`, `push`): before
  16 minutes (`AI_PUSH_AT`) with twice its attack threshold and a fifth as many again as its rival's army and two more
  (`AI_PUSH_EARLY`); from then on with its threshold and two more than its rival's (after a push, as many as that push
  took less two). For four minutes (`P.pushOn`) its home guard is two, its Keeps hold two and its Outposts none, and the
  march takes all it can gather, its threshold at least; never while its base is threatened. Between pushes it marches
  as the plain rule says. (Balance pass of Nov 2026, the owner's wish for a medium-strong Warden: it won 3 of 16 AI
  games while it marched only on a push, kept a third of its army at home until then and put up six turrets, each
  ahead of its economy, with its first at two and a half minutes; 7 of 16 as it is. Walls and Keeps kept, the home
  third alone cost it about four wins.) Every doctrine fortifies (`AI_FORT`, `aiFort`):
  up to `turrets` Pulse Turrets, one more every `every` seconds (round the Command Base on the side facing the rival,
  spread apart), a Minigun Nest or Bunker by its fort nearest the rival every six minutes from about ten minutes in (up to
  `front`, through `P.defWant`), and with chance `walls` (decided once a game from the seed) an arc of Wall seven tiles
  out on the side facing the rival, two pieces every 30 s from nine minutes, up to 16 (`aiFortWalls`); Easy halves it all.
  Opening fixes: a Harvester down to its last couple of stalks it can cut (ripe, on its own side, out of enemy guns:
  `aiGathers`) doesn't count as cutting, and with none cutting and none
  on the way a new one goes up past the usual limit on sites (Alloy-starved sites could otherwise hold every slot while
  the Smelters wait for Fiber); a new gatherer's spot is scored by what it could really work there (`aiUsableRes`: not a
  rival's groves across the border, nor ground under enemy guns, and a grove still growing at half), where it used to
  go up beside the other colony's grove and cut next to nothing; and until its first Bot Foundry has its Alloy, the Ammo Plant and (with Chips enough for
  the Foundry) the Chip Fab rest, so they don't eat the Alloy the Foundry needs (`forFoundry`). With no stalks left to
  cut and Fiber under 6, groves come first (`groveFirst`): a Bio Farm gives its Agribot to a Grove Planter (placed by a
  Harvester, or else near home) until a Harvester has stalks again, since without Fiber there's no Alloy for another
  Agribot. Bio Farms go by the patch (`aiFarmClaims`, `aiFarmSoil`): each of its farms claims the nearest
  `AI_FARM_TILES` (5) fertile tiles it can farm, a new farm counts only the tiles none claims, a site with fewer than
  `AI_FARM_MIN` (3) isn't used, and the best unworked patch wins (so one farm a patch, two on a big one; before, farms
  crowded onto small patches, several sharing three or four tiles). Fuel first too: with Fuel under 6 for half a minute (`P.fuelLow`) a Bio Farm goes first (never while one
  waits for its Agribot; at most two plus one for every 15 robots), an Oil Pump once the Bot Foundry is up (oil costs
  Alloy), and a Refinery for a pump that has none; without it the Fuel Stations went dry around minute 10 and the
  workers crawled, which in turn starved the Fiber, Ore and Alloy. Low for `AI_FUEL_DRY` (60 s) with no Bio Farm that
  has soil and no Refinery with a working pump (`aiFuelSource`), it is dry (`P.fuelDry`): its Trade Terminal's route
  brings Fuel (after a Crystal one, before Chips), and dry for `AI_FUEL_TRADE` (3 minutes) its Terminal goes first,
  past the usual limit on sites. Down to fewer than `AI_FEW` (8) workers after the first
  minute (a raid got the rest), it triages until it has as many as its staffed buildings want and two more
  (`AI_ENOUGH` 10 at least, `AI_PLENTY` 16 at most): its open sites are called off and only a missing link of the
  chain that makes bots (`AI_CHAIN`) is started, every staffed building rests but the links the next robot waits for
  (the Foundry while it has a part of each kind, or always with more than three workers; the Chip Fab while Chips are
  short; the Smelter while Alloy is short; a Mine while Alloy and Ore both are; and a gatherer short of its good), so
  the few workers go down the chain to the link that can work, and the Foundry makes workers alone, a Hauler first
  when it has none and three workers (`P.triage`). With no Hauler left, one worker stays free to carry, and a link
  that holds a round of its inputs, with room for what it makes (`hasRound`), takes even that one until the round
  is used (`dispatch`). Without it a colony left with one to three workers carried, or ran a Smelter piling up Alloy
  with no Chips, and never made another. At the bot limit (90 in Versus) it
  keeps room for the army it wants (`aiWantArmy`, but no more than `AI_ARMY_ROOM`, two fifths of the limit): workers
  stop where they would eat into that room, the Foundry makes warbots, and Haulers, trucks and other helpers aren't
  ordered (but a first Tanker); warbots past what it wants leave `AI_WORKER_ROOM` (6) places for workers. Without it a
  colony that had taken a lot of buildings made workers to staff them all until the limit was full, and never fielded
  an army again (a 2 v 2 game ran past an hour). With less room than that army wants (and outside Colony), it scraps
  its extras (`AI_SCRAP`, `aiScrap`): Freight Trucks, Tankers, Road Trains and Agribots past the ones it uses (trucks
  for its far Depots, Tankers for its Fuel runs and one more, a Road Train for a Terminal or a far Depot, Agribots for
  its farms and Grove Planters, sites too, and one more) that have stood idle two minutes (or any with nothing to do
  while it has three or more past those), then Workers past the ones its buildings call for and 4 more, then Haulers
  past the ones it wants and 2 more (4 at least), go to its Foundry to be recycled, at most 4 on their way at once and
  never one at work, carrying goods, fighting, or in transit on another vehicle. Spare Workers must be idle
  for two minutes, or one minute during a parts shortage. Its Foundry fills the freed places with warbots. It scraps the same
  spares when it's starved (no Alloy or no Chips for a minute and a half, `P.dry`, with under one a minute being made;
  short of Chips, only vehicles, which give Chips back), on every level, Easy too (the owner's call), and on
  Medium and up one vehicle, Agribot or Hauler idle five
  minutes at a time while its Foundry waits for the parts it would give back. A kind it has scrapped isn't ordered
  again for five minutes (`P.scrapT`). **Crystal** (every robot takes a Chip, every Chip a Crystal) runs short
  by how long what's left would last, in stock and in the ground on its land, at the rate its Chip Fabs burn it
  (`goodRates`; under `AI_CRYSTAL_MINS`, 10 minutes, counting at least `AI_CRYSTAL_BURN`, 4 a minute, once it has a
  Foundry), not only by the clusters left (`P.short`, by tiles, came only once the last three were all there was,
  too late to do anything). Short, with Crystal no-one holds within `AI_CRYSTAL_REACH` (20) tiles of a fort of its own
  on the same ground, its Outposts head for it (the nearest pulls the next one its way); forts holding Crystal are worth more to attack
  (`crystalHeld`); its Trade Terminal (from `AI_TRADE_AT`, 8 minutes, as every rival's) goes past the usual limit on
  sites, and it orders the Road Train for it straight away (it takes four Chips: once the Crystal had gone there were none left
  to make it). Running low (`P.crLow`: short, or under 10 in stock with the Taps bringing in less than the Fabs use),
  it puts up Crystal Taps first wherever clusters are left on its land, up to `AI_CRYSTAL_TAPS` (4), even with every
  worker busy, and they get a worker first (with no Tap at all, on a lone cluster too, any map: a Turtle's last
  clusters were single ones on Standard seed 11, and its Chips ran dry for the last half hour); its Smelters rest while it holds `AI_ALLOY_PILE` (40) Alloy, until it's
  down to half (`b.alloyRest`: the Alloy in hand buys Crystal at the Terminal, a made good for a raw one at three-quarters
  of its worth, and their workers go to the Taps); and at the Terminal (`aiTrade`) a route that brings Crystal, or else
  Chips, comes first, it never sends Crystal, and a route under way that brings neither is changed for one
  (`tradeShortest`: Crystal, then Chips, count as what it's shortest of while it runs low, whatever lies in the ground on
  its land, which can be land out by the enemy's guns it can't work). Otherwise its route brings what it's shortest of
  (`TRADE_SHORT`) for a good it has `TRADE_KEEP` and a run to spare of (never Chips), the better the rate the better; two
  Terminals run different routes; Escort is on in a war. A route with no run for `AI_TRADE_STALL` (5 minutes) is changed
  for another, and every `AI_TRADE_REVIEW` (5 minutes) for one clearly better. Before, in long 2 v 2 games the colony
  left on the losing side took Alloy for Stone while its Foundry stood idle for want of Chips, Alloy piling up, and the
  game ran to an hour. **Ore running dry** (`P.oreLow`, `AI_ORE_FIELD`, `AI_ORE_REACH`): from `AI_ORE_AT` (15 minutes), with a Bot Foundry up, under 4
  Ore in stock and no Mine of its own working 3 deposits or more (one on the last node or two of a field counts as dry),
  a Mine on fresh Ore is starved for (`starved`: first in the plan, past the usual limit on sites, with no spare worker,
  high priority, on a lone deposit too); with no spot for one on its land (`P.noSpot.mine`), Ore counts as short
  (`P.short`) and its Outposts head for the Ore no-one holds, out of the guns' reach, within `AI_ORE_REACH` (30) tiles
  of the spot (a chain of them); its Trade Terminal buys Ore, or else Alloy, first. A megastructure's site doesn't
  count against its usual limit on sites (`megaSites`, `aiSiteCount`; it still does when placing the next
  megastructure): Arrival City and the Deep Core, saved up for as long as they take, held both of a rival's usual two
  sites from 20 minutes on and nothing else was built again, no Mine on the Ore lying in its own land, so Standard
  Large for four on Flat, Scarce ground (seed 2) ended with two colonies at 0 Ore and the game ran past an hour (now about
  24 minutes). A link of the chain that makes robots lost once the opening is done (its Smelter, Chip Fab or Bot
  Foundry wrecked, none going up) is put back the same way, first and past the limit. Its Missile Factory and Silos come
  only through `aiMissilePlan` (not the plain build plan, where a Hard rival put a factory up four minutes in), one
  site at a time, and the factory rests while no built Silo has room for another Missile. It walks its best spots for a
  gatherer (`walkRes`: only nodes within three times the reach on foot count), so it never puts a Harvester at the foot
  of a cliff below groves fifty tiles away by the ramp. Its forts (`rearGarrison`): one counts as behind the
  lines, free to send its last warbot on a march, when no rival building is within 18 tiles, or when every one that
  near has another fort of ours, with someone in it, at least 4 tiles nearer to it. Its Viaducts (Sky islands): not
  into the enemy's guns, nor for four minutes where one was just knocked down (`P.viaLost`). Under an enemy gun
  (`aiClearGuns`): a factory, gatherer or Fuel Station a gun has covered for over a minute doesn't count in its build
  plan (`aiShut`), so another goes up out of reach. It sends a squad that can win (`aiGunNeed`), and a new one only when
  it can win with half of those still at the gun counted, never a few at a time into one being shot down (before, two
  went to join one left of a squad the gun had cut down). When the gun has stood for two and a half minutes with no new
  warbot for two (the gun may be over the Chip Fab the Foundry needs), every warbot goes, the Command Base's last one
  too (`attackAvailable(p, t, 'every')`), if that gives it a real chance (enough but for the margin of one), or its Bot
  Foundry is shut down anyway (none at work: it's that or nothing).
  **Attacks into defences** (`aiGuards`, `aiFire`, `guardsNear`, `aiSpare`, `aiSquad`): before any attack the rival
  counts, in warbots, the defences that would fire on the squad at its target (their reach plus two tiles): a Pulse Turret
  or Mortar Pit 3 (a Mortar's shells burst among a squad bunched on its way in), a Minigun Nest or Disruptor Tower 2, a
  Bunker 2 for each armed warbot in it, a Keep 3 and 1.3 for each manned gun slot and 1 for each warbot past them (they
  come out), a quarter more for a defence in a Keep's aura, the armed warbots of any other garrison close enough to
  sortie, and its owner's armed warbots in the field within 7 (not a Flak Gun, nor a gun that is cut off or switched
  off; a gun out of ammo still counts). A Bulwark at the head of the squad takes `AI_SHIELD_TAKES` (2.25, about a Pulse
  Turret; never more than three quarters of a gun) off the strongest gun firing straight at it (not a Mortar's shells or
  a Disruptor's pulse); the rival's Bulwarks, then Torches, leave a garrison first (`lead` on `sendAttack` and
  `sendToRally`, see `takeArmed`). A construction site or a fort shot down to a quarter of its armor takes the usual
  band (2, or the threshold) or one more than its guards; anything else its garrison ×1.3 + 2 + its guards; a gun its
  own fire too (`aiGunNeed`); never fewer than the threshold for a finished building; and with guards worth
  `AI_HEAVY` (5) or more and no Bulwark in the squad, a third more (`aiBare`: fire from several sides adds up faster than
  the count says). So clearing a lone Minigun Nest over its buildings takes 3 warbots, or a Bulwark and 1; a building
  beside a nest and a Pulse Turret takes 10 (5 with a Bulwark). With the squad for
  it, an attack on a building a gun covers goes at the gun first (`aiFirstGun`): warbots on an attack shoot back only at
  robots, so sent at the building they stood hitting it while the gun shot them down; and the squad on a flag it plants
  (a march, a flag beside a gun it is clearing, an Uplink jam) goes for the gun covering the flag first (`r.first`, see
  `holdRally`), then on as usual. Without, it attacks what it can take
  (an unguarded target scores a little higher), or waits and gathers: the best target the guns held back is marked
  (`P.soften`) for its Howitzers (`P.siegeAt`), its Missiles (+6) and its bomber, and the Foundry orders a Bulwark if it
  has none (`P.shieldWant`, whatever the size of its army). Marches (more for the guns at the flag), Howitzer hunts
  (none until there are enough for the guns round it), Uplink jams (five and the guns) and beach landings (not onto a
  beach covered by more than the boatload less two) count them the same way. Measured in the sim on open ground: two
  warbots beat a lone nest with the lead at 5 of 12 health, a Bulwark and a warbot kill it in about 14 s untouched;
  two warbots die to a Pulse Turret, three sent at the building beside one all die, three at the turret lose one.
  **The army's mix** (`aiAnswers`, `AI_ANSWERS`): once its army is up, beside the Bulwarks and Torches, each doctrine
  wants one of each answer for every so many warbots (Steward: a Skirmisher per 6, an Arc Caster and a Railgunner per 8;
  Warden: Railgunners per 6, up to 2; Salvager: Skirmishers per 2, up to 7; Herald: few, it masses warbots; Architect: a
  Skirmisher per 6, Arc Casters and Railgunners per 5). Against a rival with 2 Bulwarks or more, or 18 robots in its
  army, it adds Arc Casters (up to 3) and Railgunners (one a Bulwark, up to 2); against Railgunners and Arc Casters,
  Skirmishers; against 4 Skirmishers or more, no more Skirmishers of its own and one Bulwark at most. The answers are
  half its army at most; an Arc Caster only with 3 Crystal in hand, a Railgunner with 4 Ammo.
  **Against a blob** (`aiBlob`, `AI_BLOB`: a rival with 2 Bulwarks or more and 12 robots in its army): Mortar Pits (their
  shells come down over shields) by its fort nearest that rival's Command Base, aimed out along the way the blob would
  come, one every 3 minutes, up to 4 from this and 4 in all (2 and 3 before the November 2026 balance pass) (`P.blobMortAt`, `P.blobMortN`, through `P.defWant` with
  `blob`: its site goes past the usual limit on sites and up as soon as the Cement is there, and waits up to
  `AI_BLOB.wait` (6 min) for its Alloy: `blobFirst`); and one
  Howitzer more for its attacks (`wantRockets`, at most 3; the Howitzer is switched off for now).
  **Marches, storms and the home guard** (Medium and up; `aiMarch`, `aiStorm`, `aiStage`, `aiBattles`): nothing goes
  for five minutes within 8 tiles of where an attack or march lost more than half its warbots, unless half as many
  again go (`P.fights`, `P.beaten`); an attack whose squad couldn't shoot through the walls on its way (`attackBreach`)
  isn't sent, nor tried there again for a minute (every level). With nothing in reach, a big army (twice the attack
  threshold) marches on the enemy fort that takes the fewest to beat (`aiTakeNeed`: what an attack on it counts, and
  never less than the plain march, twice the threshold and the guns at the flag; plus 0.15 a tile from home), with that
  many and two more (14 to 22), Bulwarks at its head and at the gun covering the flag first (`r.first`); with fewer it
  masses: the army target rises (`P.massFor`, `aiWantArmy`), its Outposts with no enemy near keep no warbot back
  (`keepW` 0), the spot is softened (`P.soften`) and a Bulwark ordered (`P.shieldWant`), until it marches. With a
  decisive lead (half as many again as the enemy's army, and four more) the next march is a storm of the enemy Command
  Base (`P.stormOn`): up to 30 warbots (or what the base takes and two more, when that is more and it can gather them;
  it used to stop at 30 whatever the base took, and a base behind enough guns was never stormed) form up under a flag about 9 tiles out, on the side it comes from, where the
  fewest enemy guns reach with three tiles to spare (`aiStage`, on `DANGER.guns`); once three in five stand there the
  flag moves beside the base and they go in at the gun covering it first (`r.first`, the next one as each falls), then
  the base. It masses for it up to four minutes (`P.stormT`) and calls it off when under two in five are left armed.
  Against a crushed rival (twice its army and two more), it can storm a lightly defended base with a smaller force.
  It still wants at least eight warbots, twice the enemy's whole army and two more, and three in five of its armed
  army outside Bunkers (or the full count, if that is less). Heavy gun cover requires the full estimated force.
  If it cannot gather that many, it looks for a cheaper fort to take or a way to soften the defences. In the last fight of a free-for-all (three or four colonies, one rival left) that storm
  draws on every garrison, front forts, Keeps and the Command Bases it took too (`aiSpare` with 'storm',
  `sendToRally` with rear 'all'; its own Command Base keeps its home guard): the colony that won the earlier fights
  holds two or three colonies' forts, nearly all in reach of the last rival and each keeping warbots back, and on a
  small Crossroads the last two sat out the clock. An Easy rival marches as the plain rule says, and in an Uplinks game the forts holding the
  enemy's Uplinks still come first. The home guard (`P.homeGuard`, through `keepAt` and `homeGuarded`): while four or
  more enemy warbots stand within 12 tiles of its base, or the base was hit in the last half minute (`P.homeCall`),
  about a third of its army (2 to 8) stays in its Command Base and up to 3 in each Keep, out of every attack, raid and
  march, the rear's too, and new and idle warbots go there first (`goGarrison`); otherwise 2, and the usual one when no
  enemy army can walk to its base (on an island). A Salvager keeps the usual one, threatened or not (its doctrine's
  thin home guard: with two its first raid waited for a fifth warbot, four minutes late). With twice its rivals' warbots and two more its Outposts keep none
  back. A Normal or Hard rival (a Warden on any level) answers an army parked on its land, or within 14 tiles of its
  Command Base, with a Mortar Pit: four or more enemy warbots there, while no other defence is on order, put one by its
  fort nearest them, 7 to 10 tiles from where they stand (`P.defWant.ax`/`ay`, see `aiSearchSpot`), up to three, one at
  most every three minutes (`P.parkAt`). It remembers where its civilians were shot down (`noteDanger`, `P.danger`):
  for 3 minutes, 3 more for each further death within 3 tiles, up to 15, its workers neither build, mend nor pave
  within `DANGER_R` (4) tiles of the spot (or of where the one shot was going) and it puts no site there (`dangerAt`).
  The danger map sees the guns that can fire now; this sees one that fires now and then, such as a Pulse Turret out of
  the map while it waits for its next Crystal. Nor does it build for five minutes within 4 tiles of where a building
  or site of its own was destroyed by force (`destroyBuilding` adds a `P.avoid` entry with `r2` 16).
  Once it's ready to march it orders a Bulwark for every five warbots (two, three against a dug-in rival) and a Torch
  for every four (three, four), only with Fuel for Torches. The **Salvager** (`raider`): raids three times as often from early on,
  keeping none back: its band of three (`raidSize`) goes as soon as it has three to send (`raidKeep` 0), and may take a
  rear fort's last warbot. Its raids (`harass`) go for the busiest road by the most of its rival's working buildings
  (half as much again for each within 3 tiles, up to four), clear of every manned fort by 10 tiles and of the rival's
  warbots in the field by 8, and the band forms up on the way out of the rival's land (`aiRaidStage`: the first tile back
  toward home 4 tiles clear of it, `P.raid.to`) before its flag moves on to the road, so the rival's warbots aren't
  waiting there (they answer a flag on their land). Its favourite of all is the road its rival's trade convoys run (the
  lanes of its Terminals, `aiConvoyLanes`: three times the score, and the raid waits a minute longer there for a convoy,
  `P.raid.convoy`), out of the guns' reach and never on a Trade Post's ground. Its attacks put a working building, Fuel
  Station or Depot that little guards ahead of a fort. The **Herald** (`rusher`): the fastest-growing army, raids now and then, few turrets. The **Architect** (`tycoon`): its bots work 15%
  faster (`econ`), it builds extra Smelters and Chip Fabs (and a second Crystal Tap), turns them into an army that grows
  from early on (`army` 1.3, `armyFrom` 0.7, `grace` 1.0: it won 6 of 16 AI games at 0.9 and 1.15, 8 as it is) and goes for Missile Silos (up to
  three) once its Bot Foundry runs: its programme (`aiMissilePlan`) starts from eight minutes (`AI_MISSILE_FROM`) once its army is no more
  than `AI_MISSILE_GAP` (4) behind its rival's (four at least; two ahead, as it was, put its Silos at 24 minutes on
  average under pressure: November 2026 balance pass) and two workers to spare (none, once the Missile Factory stands); the Missile Factory and then each Silo (the next once
  the ones it has hold a Missile each) go down as soon as the Cement is there, one past its site limit, its first Ammo
  Plant and turret still going ahead; while one of those sites still waits for Alloy or Chips its Ammo Plant rests
  (with 4 Ammo in hand: `aiMissileShort`), and its Arrival City waits (`aiMissileFirst`: the City's site goes down
  only once a Silo stands, or from `AI_MISSILE_CITY`, 18 minutes, and a City site already going up loses its high
  priority while a missile site waits; its 30 Alloy used to go first and the Silos stood at 22.6 minutes on average);
  its Bot Foundry rests for such a site for `AI_MISSILE_REST` (45) s at most, with its army no more than two behind
  its rival's (resting it whenever it had three warbots more than its rival, it never pulled ahead: 5 wins of 16; for
  as long as a site waited, 3 to 4; for 90 s, 5), the factory rests while no Silo has room or its army is more than two behind its rival's, and from
  `AI_ALL_IN` (28 minutes) it rests for good. Its Silos stand back from the border, nearest home with six of its
  rival's buildings in reach (`aiSearchSpot`). On Normal and Hard its Missiles go at what its rival lives on
  (`aiMissileWorth`, by `AI_BOMB_VALUE`), then any other working building, and at a fort only when its warbots in reach
  could follow; nothing worth less, a Wall say, gets one. Under siege (`P.homeCall`) the doctrines answer in their own
  ways: a Salvager raids at once, a Warden starts no push, and an Architect on Normal or Hard fires its Missiles into the
  biggest knot of enemy warbots within 12 tiles of its Command Base (`aiMissileKnot`). The new-game screen's **Rival doctrine** chips set every computer player's (`UI.menu.style`: 0 Random, then
  `PERSONALITY_ORDER`); with three or four players **Each rival** (a dropdown per colour) sets each computer player's own
  (`UI.menu.styles`, by player slot 0 to 3, null: as the chips), and in multiplayer the host picks each computer place's
  in the lobby (sent round with the settings as `styles`, by player slot, so a choice stays with its colony when people
  come and go or the teams change, and every device deals the same; the lobby lists exactly the places the game will
  have, `mpCpuSlots`: people away at the start get none). `newGame` takes `styles`, one per computer player in player
  order (`mpOnStart` turns the lobby's by-slot list into that), over `style` (all of them); Random deals one no other
  computer player has, picked from the seed after the named ones are taken out. Saves keep each player's `style`. Each
  doctrine's `quote`, `play` (what it builds first, when and how it attacks, how it defends: what headless games on
  Normal show, not the earliest the code allows, since a rival only attacks what it outnumbers) and `weak` are the
  setup's in-depth description (`docInfo`/`docHTML`). With a mouse, pointing at a doctrine (or focusing it) shows it in
  the line under the doctrines, which keeps the height of the longest so nothing moves. On a touch screen (`canHover`)
  the line is a sentence (`docShortHTML`) with **How it plays** until a tap opens the whole of it, and nothing is held for
  it; while the rivals have doctrines of their own, a first tap on a chip only shows it (`UI.docPeek`, a dashed chip) and
  a second gives it to them all. The lobby's line (`mpDocNote`) is shorter still, a few words per doctrine (`tag`), with
  How it plays for the rest: with a mouse it is always there and sized to the longest; on a touch screen it opens with a
  tap on a row and closes with another. Missions use the Steward unless they name one (Hold the Line's Herald, Convoy's Salvager, Siege Breakers' Warden). The
  briefing (`doctrineLines`, multiplayer too), the rival Command Base's panel and the Boosts menu name it, as
  "Warden (turtle)" (`docLabel`).
  A mission's scripted rival (`P.bold`: Hold the Line's Herald, which also lands with a Bulwark) makes its assault
  whatever the guns: that mission is about holding it.
- **The rival's economy** (`aiThink` in `js/ai.js`): on every difficulty its Smelters rest while Fiber is nearly gone
  and a site is short of it, or while a building it wants can't be started for lack of it (`P.fiberWait`): a busy
  Smelter used to burn every Fiber the Harvesters cut, and nothing that costs Fiber could go up. A site no road reaches
  yet doesn't count (it can't take any), and with no Harvester cutting they start again once there are 6 Fiber and
  nothing waits for it, where they used to stay off while the Fiber a cut-out grove still gave piled up. On Medium,
  Normal and Hard (`smart`; an Easy rival keeps the old habits) its Depots out toward the front (12 tiles or more from
  the Command Base) keep Cement and Ammo and take in no Ore, Crystal, Stone or Fiber (`reject`): a Depot among the far
  Mines used to collect their whole output, a long run from the Smelters waiting for it. Its Bot Foundry rests to save
  for a Missile Factory or Silo (`aiMissilePlan`) only while the army isn't well behind and the colony has the workers
  and the Haulers its buildings call for (an Architect by its rival's army: see Rival doctrines): with the army alone to
  go by, it stood off up to two fifths of a war game while buildings waited for workers. A rival with one site at a time
  (Easy) puts the plan's opening, up to its first Bot Foundry (`AI_OPENING`), ahead of every other ask from six minutes
  in (`AI_EASY_OPENING`) until its Foundry is under way: expansion Outposts, a spare gatherer and the Ammo Plant used
  to take its only slot first, the Outposts then waited minutes for their roads, and most Easy rivals never built a
  Smelter or a robot. (Its first minutes go as before, so it still opens slower than a Normal rival.) On every
  difficulty, once its Bot Foundry stands, with no Mine (or no Crystal Tap) at work, none on the way and under 4 Ore
  (or Crystal) in store, one goes up first, past the usual limit on sites (`starved`): a gatherer counts as at work
  while it has a node it can go to, on no rival's land and out of enemy guns (`aiGathers`), and a site as on the way
  for 150 s or once a road reaches it. Sites stuck where its robots won't go (their road through ground where they were
  shot, see `noteDanger`) used to hold every place while the last field ran dry, and two rivals could sit at 0 Chips
  with a few warbots each for 20 minutes.
- **The rival's roads and Ramps** (`aiRoads`, `aiRampCut` in `js/ai.js`): where its road to a site would run the long
  way round a one-level cliff (8 tiles or more), or no slope leads there at all, it cuts up to two Ramps instead, as
  Route to does in Paths, when that way (each Ramp counted as 6 tiles) is at most 60% of the long road and 6 tiles
  shorter. The site's road waits for the Ramps (`P.rampWait`, 3 minutes at most) and then takes the short way. It
  cuts none for a Ramp, and none onto its own plateau or mesa home (`fortressHome`). It used to run a road forty
  tiles round a low cliff to a site eight tiles away, and gave up sites no slope led to. A site waiting four minutes
  with no construction or incoming deliveries can be abandoned even when the missing road is already on the books.
  That frees a build slot for work the colony can reach.
- **The rival's opening** (Medium, Normal and Hard, a mission's rival too: `AI_OPEN_FIRST`, `P.opened` in `js/ai.js`):
  its Bot Foundry goes up straight after its first Fuel Station (it lands with what the Foundry costs), and the rest of
  the plan's opening (two Harvesters, a Quarry, a Cement Works, a Mine, a Crystal Tap, a Smelter, a Chip Fab) comes
  before every other ask until each of them has stood once (what it can't place yet, a Mine with no Ore on its land, is
  passed over for the rest). Meanwhile its Foundry counts the opening's buildings as wanting a Worker each, so it makes
  Workers for them, not warbots, and doesn't rest for the Ammo Plant. Tenth in the plan, the Foundry used to wait
  behind Outposts toward what was short and their long roads, spare gatherers, Bio Farms and the Ammo Plant, then for a
  Worker of its own once the buildings before it had taken every one: on Long haul both rivals sat at their ten landing
  Workers until minute 10 to 15. Now the first robot comes about half a minute in. In missions it reaches every rival
  of Medium and up (a mission's `rival` level for the difficulty): Hold the Line's on every level; Supply Lines',
  Convoy's, Siege Breakers', Final Descent's and King of the Hill's on Normal and Hard; Live Fire's, Border Dispute's
  and Chain Reaction's on Hard. Played headless before and after (the AI on your side plus the hints' steps, three
  times or more for each mission and level it reaches), each is still won: a passive rival is weaker early, since its
  Foundry makes Workers first (Live Fire on Hard went from one win in three to three); Siege Breakers on Hard takes
  about 30 minutes instead of 22 (its 45-minute clock stands); Final Descent on Normal and Hard is a real war now,
  where the old rival's army was gone by minute 10 (six wins in seven on each: one lost on Hard, one still open at 41
  minutes on Normal); Hold the Line's Herald hits a colony that only follows the hints a minute or two sooner on Easy
  and Normal (about 8½ and 7½ minutes in). Easy rivals are as they were. Convoy, played the same way, was won on Hard at
  about 9 to 12 minutes, so its Hard clock went from 40 minutes to 13; with the Grove Planter in its kit since, Hard was
  won in only 2 of 7 such runs, so its Hard rival is Medium, as on Normal: 4 of 4 won, at 9 to 11 minutes (see IDEAS). On Warlord it keeps that Medium rival with 16 minutes on the clock (its own five-long values, the balance audit of Nov 22 2026: with a Normal rival and 13 minutes none of three runs was won; now 4 of 5, at 11 to 13½ minutes). No mission's rival is across the water, so none makes beach landings (`aiBeach`) yet;
  Harbour's briefing tells of them.
- **The story** (LORE.md is canon; text and presentation only, nothing in it changes a rule). **Callsigns**
  (`CALLSIGNS`, `callsign(p, colour)`): players are named COBALT (player 0, blue), VERMILION (red), VIRIDIAN (green) and
  TYRIAN (purple) wherever the game used to say "the Red rival" (`playerName`: 'You', a person's name in multiplayer,
  'VERMILION (ally)' for a team-mate, 'Murmur' for the Murmur's slot), with the colour where it helps find them
  ("VERMILION (red) to the north"); the setup's Each rival dropdowns and the lobby's computer places are named so too.
  **The narrator** (`NARRATOR`, `narrate(p, key, x, y, every)` in `js/world.js`): your Command AI's dry lines, as toasts
  of kind `narr` (italic, a grey edge): the first road (`layRoad`), the first nightfall (`nightfallLine`, UI-side, with
  the day/night cycle on), the first Uplink taken, a rival Command Base captured (or one changing hands between two
  others), and the landing line on the briefing card (`landingLog`: "Terrafall complete... Landing site: the Rust.")
  and the end screen's last line (`#o-log`: the region secured, or lost on the Uplinks, "another colony speaks for Ithaca
  I", or on land, "settlement priority lost"), and the *Wren*'s arrival, each visit. **Doctrine voices** (`PERSONALITIES[k].voice`, `doctrineVoice(p, to, what)`):
  a computer rival speaks to the colony it hits, under its callsign, as toasts of kind `voice`, after the alert it goes
  with: when its warbots or raiders hit you (at most every 4 minutes each), when it fires a Missile at you (every 90 s)
  or a nuke your way (every launch: a key of its own), and when it surrenders; the Warden counts the days (`wardenDay`). Lines are picked by `hash2` of the time and the
  players, never the game's RNG; what has been said is kept in `S.lore` (saved with the game, left out of `hashState`),
  so nothing here can split a multiplayer game. A save from before the narrator gets `S.lore` filled in on loading (the
  first road, Uplink and nightfall already said), the first nightfall is only said in the first game day, and a
  multiplayer resync keeps this device's own nightfall key. Never in missions (`loreDue`), which keep their own texts
  (the *Wren*'s arrival line included). A story toast never counts towards the toast limit or pushes a warning out: it
  goes in under a newer warning (a phone on its side shows only the newest) and gives way only to a newer story line,
  the lines of one moment (a surrender's last words and the narrator's line after them) staying together.
  **Regions** (`BIOMES[k].region`, `regionName`): the Rust, Greenreach, the Polar Caps, Emberwood, the Long Grass, Blackwater,
  Cinderlands, Steamwells, the Shoals and the Bloom, regions of Ithaca I, and Argos, its moon (Lunar), as flavour only (briefing, landing message, loading lines): the
  setup keeps the plain biome names. **Panel flavour** (`FLAVOR`, `flavorLine`): one quiet italic line at the foot of
  every building's and robot's panel (and the Trade Post's and Uplink's), below every button; the Command Base's is its
  Arrival clock (`ARRIVAL_CLOCK`), shown under its name. **Loading lines** (`SPLASH_LINES`, picked at first paint by an
  inline script in `index.html`, which keeps its own copy): one under the splash bar, which now stays about 2 s.
  **The Lore guide** (`#screen-lore`, `openLore`/`closeLore`/`initLore` in `js/ui.js`): the small **Lore** button in the
  main menu's bottom row (beside **Feedback**) opens the colony's archive, LORE.md told in eleven pages (Terrafall, The Arrival clock,
  Ithaca I, The atlas, The regions, The four vanguards, The doctrines, Neutral ground, The Murmur, Accord standards, Your colony),
  in the archive's own voice: Earth's fate is never stated, only hinted (an unreviewed second reading of "terrafall",
  "no ark construction update on file after T−14", the *Wren*'s waystation last answering at T−2). It pages like the How
  to play, on the same code (`pagerInit`/`pagerShow`, `HELP_PAGER` and `LORE_PAGER`): it opens on its first page, which
  lists the rest; a picker stays on top, Previous / Next end each page, ← → turn them; Esc, Back or a phone's Back
  closes it (opening adds a history entry; closing takes it back). While it's open the music is the campaign theme, The
  Long Silence (`musicLore`; see Sound). Its pictures are `data-src` until it first opens,
  then all fetched at once, so the service worker keeps them for offline play, and `tools/build-single.js` puts them in a
  bundle beside the page (`dist/lore.js`, fetched when the guide first opens, so the page stays under 16 MB):
  `art/lore/ithaca.webp` (Ithaca I from orbit, the Ring, Argos and Corvane: `renderer/b/lore_planet.js` and
  `renderer/post/lore_planet.py`), `art/lore/atlas.webp` (the atlas, LORE.md: The atlas, made by `tools/atlas/atlas.py`;
  on The atlas page a tap enlarges it over the whole screen to pan with a finger, a tap or Esc closing it, as does a page
  turn: `.lore-zoom` in `initLore`), `art/lore/region-<biome>.webp` (each region's ground, shot from the game),
  `art/lore/murmur-<class>.webp` (night renders of the Murmur built to LORE.md's art brief, `renderer/b/murmur_moles.js`
  with `hero=1`, cropped by `renderer/post/murmur_lore.py`), and the game's own Command Base, Trade Post, Uplink
  and *Wren* art. The Ithaca I page's catalog plate and the callsign emblems are inline SVG. Only the Scuttler and the
  Brute are met in the game so far, so the Leech, Spitter and Sapper are on file as "sighted".
- **The Murmur** (players' name for the wildlife; `WILD` and `MURMUR` in `js/defs.js`, the wildlife section of `js/sim.js`).
  **The setting** (`S.settings.murmur`, `murmurLevel()`: 'off', 'quiet' or 'active'; `opts.murmur` to `newGame`; unset,
  the map type's own `SHAPE_PRESETS[shape].murmur` outside a hand-made map, else off; an older Colony `opts.wildlife` is
  Active; the new-game Rules' Off / Quiet / Active, `UI.menu.murmur`, remembered on the device, Active by default, an old
  saved `wild: 0` reading as Off; sent with the multiplayer settings, `mpGameOpts`; shown on the planet card, the summary,
  the briefing and the pause menu). In missions only where one asks (`murmur: 'quiet'|'active'`, or the older `wildlife:
  true` as Active), as The Murmur (id `bughunt`) does. `murmurStart(level)` brings them into a game: `S.wildlife`, their
  owner slot (`wildOwner()`: Colony's empty second slot, `WILD_OWNER`; in Versus a slot of their own appended after the
  colonies, `S.wildSlot`, `absent` and `wild`, so `nColonies()` counts colonies without it), the tunnel layer and the
  nests. **None on a silent biome** (`BIOMES.lunar.silent`, `murmurGround`): on Lunar, Argos the moon, there are no nests
  and no raids in any mode; the setup shows Off, greyed (the saved setting is kept for other biomes), and an old Lunar
  save that has nests keeps them. **Nor on Sky islands or Four Isles** (`noMurmur` on their `SHAPE_PRESETS`, `murmurShape`):
  no nest ever found ground there, and the dusk warning came every night with nothing after it; the setup greys it the
  same way. Wherever no nest stands (none placed, or all wrecked) there is no dusk warning (`murmurTick`). Internally the creatures are `wildlife`, the nests type `'nest'`, tunnel exits type
  `'burrow'`; players see "the Murmur", "Murmur Nest", "Tunnel Exit", Scuttler and Brute. **Nobody's side**: the slot is
  `absent`, so it never counts for capture, surrender, Domination, the Uplinks or teams (`foes` with every colony; `isWild`).
  - **Nests.** Colony: one per `WILD.perTiles` tiles (3–8, `colonyNests`, `placeNests`), at least 16 tiles from the landing site.
    Versus (`placeNestsVersus`): sets of nests following the map's own symmetry (`uplinkOrbit`, each set one nest a
    colony), up to `MURMUR[level].orbits` (Active 2, Quiet 1), one set a `perTiles` of map for two colonies; on open ground a
    colony can walk to, at least `max(MURMUR.minBase, a fifth of the map across)` from every Command Base, at least
    `MURMUR.offRoute` (6) tiles off the shortest walks between the Command Bases (and their twins: the wars between the
    colonies aren't decided by which side of the way a nest landed), 12 tiles apart, by Crystal and rich deposits
    ("strike sites"); crowded out, a little closer, but only to have one set. Each keeps
    `guards + level` Scuttlers on guard (they go for what comes within 7 tiles of the nest in Colony, within `GUARD_VERSUS`
    (3) in Versus, and robots keep that far clear of them: `foeReach`; a nest beside a colony's way to its fields stopped
    a rival's economy dead; in Versus the ground kept clear is that circle round the nest and a tile more, drawn once for
    all its guards in `updateDanger`, not a circle round each guard, which reached 5 to 6 tiles out over roads they
    never bite on, so Haulers on them turned back for good: the balance audit of Nov 22 2026) and grows a level every
    `WILD.grow` s (to 3). The rival builds no nearer a nest than
    `aiNestClear()` tiles (`aiSearchSpot`): `AI_NEST_CLEAR` (8) in Colony, `AI_NEST_CLEAR_VS` (6) in Versus, where the
    guards only reach 3 (on the Hollow the Ore off a colony's home ground can all lie that near nests), and in Versus its
    roads keep out of that guarded circle where there's a way round (`roadNestAvoid`: `ROAD_NEST_AVOID`, 30 tiles' cost
    a tile; on Standard Large seed 31 on Active both rivals' only roads to their Crystal ran past nests, were never
    driven, and 6 of 8 games there ran to the cap). Nests send
    nothing by day (`updateNest` keeps the guards up and grows the nest), **in Colony as in Versus** (the owner's call,
    Nov 2026: Colony's daytime raids are gone; packs come only at night, through the exits).
    **A nest fights back** (`MURMUR.alarm`; `nestAlarm`, `nestRally`, `murmurAvenge`; the owner's call of Nov 23 2026):
    hit from out of its guards' reach (`guardKeep`: 7 in Colony, `GUARD_VERSUS` in Versus; a colony building at any
    distance, since the guards never go for buildings on their own), by a warbot, Railgunner, Torch or Arc Caster
    (`hitBuilding`'s `src`), a gun or Bunker shooting its guards (`damageBot` with a source point: `nestShooterAt`), a
    Mortar Pit's shell among them (`shellImpact`), a Missile on or by it (the Silo), the nest raises an alarm on the
    shooter (b.alT until `alarm.last` (20) s after the latest hit, b.alId; the nearer shooter first; its colony told,
    b.alMsg, at most every `alarm.tell` s), only within `alarm.leash` (16) tiles of the nest. Once a second while it's on
    (`updateNest`) its guards, by day or night, and at night the plain packs up within `alarm.packR` (10) tiles (a raid
    with no role or focus: never a strike's, hunt's or form's) take `{ type: 'avenge', target, n, g }`: they bite what
    gets in their way and then the shooter, a robot or a building (to 1 armor; a Wall in the way when walled off), never
    anything in the air or at sea (`nestFoe`; a robot inside a building means the building). The shooter gone, out of the
    leash, or 20 quiet seconds, the guards go back on guard and the packs back to their raid (`murmurAvengeEnd`); none
    goes further than the leash and 3 tiles. Howitzers and bombers can't hurt the Murmur, so never stir them. Avenging
    guards still count as the nest's guards (`nestGuarding`). Hashed and checked in saves.
  - **Nights** (`murmurNight(t)`: `todNameAt` of the game clock, `TOD_CYCLE` in `js/defs.js`, never the display setting,
    so every device agrees; on a map type with `alwaysNight`, the Hollow, the same windows are **surges**, with a silent
    lull, `murmurLull`, `SURGE_LULL` (60 s) before each). `murmurTick`, once a second: `MURMUR.warn` (40 s) before
    nightfall the dusk warning ("The Murmur are stirring", or "The ground has gone silent"); at nightfall
    (`murmurNightfall`, night `n`) each live nest's network sets out along `branches` branches (`murmurGoals`: power
    within `MURMUR.reach` first, by `chargeWorth`: Generators, Fuel Stations and chargers, Refineries 3, storage holding
    10 Crystal and Fuel 2, any other colony building 1), digging `tiles` that night (up to `cap` in all) over its first
    two minutes (`murmurGrow`, `murmurDig`: a tile at a time toward the goal, wandering a little, stopping 6 tiles short
    of it, under any ground, roads, buildings and Walls, not water, chasms, rock, lava or the tide); `exits` new exits
    open along it (`murmurOpenExit`: on open ground over a tunnel, not a road, building, resource, ramp or a Trade
    Post's ground, on level open ground all round (`exitRoom`: never in a pass it would plug) that a colony's robots can
    walk to (`murmurReach`), 4 tiles from another exit, clear of collapsed ones still shut, off the nest's own mound, at
    least `exitFromBase` (12) from a Command Base and `exitFromBld` (4) from any colony building, about six from the
    nearest, up to `maxExits` a nest), and `waves` packs come up (`murmurWave`, a minute in and again later): one
    through every exit with something of a colony's within `MURMUR.prey` tiles (`murmurPrey`: charge first, then bots,
    then roads; with two colonies or more a building's charge counts times `murmurFair(owner)`, the colonies' mean charge
    over its colony's own clamped to `MURMUR.fair`, 0.5 to 1, so the richest draws them less and their attacks spread
    more evenly: the owner's call of Nov 23 2026; on where tunnels head too, or up to twice for a lean colony, or with
    the pressure by the colonies' mean power, three Standard Large games on Active ran past 90 minutes), `pack` strong, Brutes from night `brutes`, at most `room` up at once (12, and 6 a colony). Night
    raiders (`task.night`) move on to the next thing near them when there's nothing left where they went
    (`murmurOnward`). At dawn (`murmurDawn`) they go back down: into the nearest exit of their nest within
    `MURMUR.retreat` (16) tiles (task `down`), or dig down where they stand (task `dig`). Each [base, per night after
    the first, most] (`murmurBy`), Quiet then Active: tiles [14, 4, 28] / [28, 8, 56], branches [1, 0.34, 2] / [2, 0.5,
    4], cap [36, 18, 120] / [60, 36, 260], exits [1, 0.25, 1] / [2, 0, 2] (at most 2 / 3 a nest), packs [2, 0.25, 3] /
    [2, 0.5, 5], Brutes from night 4 / 2, waves 1 / 2.
  - **Tunnels** (`S.tun`, a tile layer: a nest's slot in `S.mur.nests` + 1; saved, `TYPED_FIELDS`, and in `hashState`
    with `S.mur` and each nest's branches `b.br`) are drawn as raised ridges of heaved earth with violet root-veins, as
    smooth curves: each run of a network between its forks and ends is one curve through its tiles, each tile's point
    nudged off its middle so the ridges wander and then smoothed so they sweep across the grid instead of stepping
    along it (`tunnelRuns`, `tunnelPoint`, `tunnelRun`), the earth in the ground's own colour, tapering where it's still
    digging. Each layer (shadow, flanks, lit side; the veins' haze, glow and bright thread) is the filled outline of
    every run at once (`fillRuns`, `addRunOutline`), broken where a road, track or cliff lies over it (`runPieces`), so
    nothing beads where pieces meet. Zoomed in they're drawn live at the screen's resolution (`tunnelsLive`: past
    1.25 × `TUN_PX` device pixels a tile); zoomed out, and on the minimap, from layers baked at `TUN_PX` a tile (only
    the `TUN_BLOCK` blocks round tiles that changed when `S.mur.ver` changes: `tunnelLayers`, `bakeTunnels`). Faint
    by day and glowing at night with pulses flowing back to the nest along the curves (`drawTunnelGlow`), violet threads
    on the minimap (`minimapTunnels`); exits are art (`drawBurrow`: `tunnel-exit`, re-lit for the time of day), violet
    rings on the minimap, and collapsed ones a caved-in mound fading as it settles (`drawExitScar`:
    `tunnel-exit-collapsed`).
  - **How they're drawn** (`drawCritter`; art from `renderer/b/murmur_moles.js`). Each form true to the others' size,
    but the Brute shrunk to fit the map (`MURMUR_LOOK`, the sprite's width in tiles): Scuttler 0.62, Spitter 0.73,
    Leech 0.81, Brute 0.82, Sapper 0.9, the Harrow 4.8 (eight walking frames, `L.frames`, and its own takes on the
    poses, `HARROW_POSES`: rearing and the slam, flinching, coming up; its body's motion on the frame, `harrowMotion`:
    breathing as it stands, its weight dipping as it walks, the bite's lunge (the `harrow-bite-f0` frame for half a second
    after a blow, read from `u.cd`), the slam's crouch, rise and impact; it swings round slowly, `L.turn`, through the
    frame's `rface`; the Scuttlers on its back drawn over it, `drawHarrowRiders`; its crater, the slam's broken ground
    (6 tiles, `HARROW_CRACKS`, the slam's reach) and its dead on the ground, `drawHarrowMarks`; its death,
    `HARROW_DEATH`, `drawHarrowDying` and `drawHarrowDeathFx`; its light pool 7.5 tiles, `L.light`; a pulsing violet ring
    on the minimap), with a shadow turned with it. Four walking frames each, and the forms' actions
    as loops timed by `u.poseT` (`MURMUR_POSES`, `murmurFrame`): the Leech feeding (`u.pose` `feed`: the star pulsing,
    the sac swelling), the Spitter spitting (`spit`: wind-up, the spit, recoil, recovering), the Sapper digging in
    (`dig`), under the ground (`under`: only the heave of soil shows) and coming up (`up`: the ground bursting, played
    once). The sprites are rendered hungry; each has a glow image (`<key>-glow`) added over it as bright as it's charged
    (`u.charge`, 0..1; none kept, as in an older save: 0.75), stronger as the light goes, breathing slowly (the Leech's
    quick throb while it drinks, the Spitter's pouches flaring as it winds up, the heave's crystal chips glinting:
    `murmurGlow`). At dusk and night each throws violet light on the ground round it, as bright as it's charged
    (`drawMurmurLights`), and the lamps and the glow of a building a Leech drinks beside dim (`drunkLight`). A Sapper under
    the ground shows only where the colony on this device can see it (`colonySees`: within `SIGHT_R`, 6 tiles, of any of its
    or its allies' buildings, bots or streetlamps; watching with no colony of your own, everywhere), and so does the fresh
    ridge it leaves behind it (`sapperTrails`, `drawFreshRidges`: kept as it goes, drawn like the tunnels; once it's
    through, the sim's tunnel takes over). The Spitter's volley (`addFx('spit', x, y, { tx, ty })`: the shards flying to
    the target, `drawSpitFx`) and its hit (`'spitHit'`: eight frames, turned the way the volley came, `drawSpitHitFx`)
    are effects; a building it has shorted (`b.shortT` > `S.time`) has its gun dark and charge crawling over it
    (`drawHeadDark`, `drawShortArcs`) and no searchlight. Their art loads only in a game with them (`ensureMurmurArt`,
    from `applyBiome`, with their re-lit sets: `MURMUR_TOD_KEYS`, `todMurmurAdd`); in the single file it's a bundle beside
    the page (`dist/murmur.js`). Fields the drawing reads and doesn't find (an older save, a Quiet game) fall back to
    today's walk.
  - **Counterplay.** Turrets, garrisons and warbots treat creatures as enemies; a creature battering a building marks it
    raided (`P.raided`), so forts round it answer (`garrisonDefense`). Warbots **collapse an exit** (`MURMUR.exitArmor`, 30;
    `collapseExit`: gone, nothing opens within 3 tiles for `MURMUR.shut`, 15 min, `S.mur.shut`; `stats.collapsed`) and
    **clear a nest** (`clearNest`: its hoard spills as loot, its creatures scatter, its exits close and its network dies
    back from the tips, `murmurDieback`). Nothing can be built within `WILD.clear` tiles of a nest. The exit's panel says
    what it is, whether its Murmur are up, where its nest is and how to deal with it.
  - **The rival AI** (`aiMurmur`): by night its Command Base keeps two warbots home; it collapses exits within
    `AI_EXIT_NEAR` (12) tiles of its buildings (3 warbots and more for the creatures round it), and by day, with no night
    due and its attack threshold and `AI_NEST_SPARE` (4) more warbots, strikes the nearest nest within `AI_NEST_REACH`
    (26) tiles (`aiMurmurStrike`: from the garrisons in reach, or from further off to a rally flag beside it that comes
    down with it, as the Army's Attack does). **A nest on what it's running out of comes first** (`aiNestRiches`): the
    Ore and oil within `aiNestClear()` tiles of a nest (and of no other), on its own ground or no-one's, count once the
    Ore it can still get at away from every nest is under `AI_NEST_ORE` (150), and the oil under `AI_NEST_OIL` (60)
    where oil is its Fuel (no Bio Farm at work: in the Hollow, always); the nest holding most of what it lacks, within
    `AI_NEST_RICH_REACH` (34) tiles, goes before the nearest, its rear garrisons send every warbot they hold to the flag
    (`rear`, as for a march), and while it hasn't enough it masses for it (`P.massFor`: the army target rises and its
    Outposts give up their keepers). (On the Hollow, once the home Ore and seeps were worked out, everything left lay
    2 to 5 tiles from the flank caverns' nests; striking only the nearest nests, which guarded nothing, both computer
    colonies ran dry of Alloy and Fuel at half an hour with ten warbots each, and Medium seed 11 never ended.)
    The Murmur never call its army home (`wildHit`) or count as an enemy army.
    Where the Murmur cut its power (`P.murCut`, see below) with no gun over it, it wants one Pulse Turret more and
    sites it a couple of tiles from what they cut (`aiMurCut`).
  - **Their craft (Active only; Quiet keeps the plain packs: the owner's call).** `MURMUR.craft` in `js/defs.js`, the
    section after `murmurWave` in `js/sim.js`. Plans (`S.mur.plans`, saved, checked by `checkSave`, in `hashState`): at
    the dusk warning `murmurDusk` makes one for each colony (`murmurPlan(p, n, round)`): the target is the weak spot
    (its building scoring most on charge `chargeWorth`, Bloom-vein lure, being alone, out of every colony gun's reach
    with 3 to spare (`murmurGuns`/`murmurGunAt`: `gunReach` of every colony building, made once a tick), where they fed
    and not where they were killed, within the network's reach). The rally point is outside the colony and close
    to the target. On each wave, the planner checks paths from live exits to the rally and from the rally to the
    objective. A blocked route can send the pack to another rally point or make it withdraw. Unassigned exits may
    send an independent pack if it has a route to nearby prey. A dusk watcher (task `watch`) marks the initial
    approach and goes down after nightfall.
    The first wave can send a feint from a reachable exit after night `feintFrom`. It records armed defenders
    covering the main target. If one of those defenders moves to the feint and overall coverage drops, the main
    pack can go early. A defender who was already there does not trigger the strike. The main pack otherwise
    proceeds once the feint ends or `feintWait` elapses.
    `murmurPlansTick` launches once all are physically at the rally, or after a wait with at least two-thirds
    present. Stragglers go back down. `murmurLaunch` favors cuts to fuelled chargers that lack a backup, working
    generators with dependent factories, and active Maglev Terminals. A Leech, Scuttler or Brute cuts power while
    the main group holds its position (`role: 'cut'`, `murmurCutStep`). When the first cut succeeds, the cutters
    are gone, or `cutWait` expires, Brutes batter the assigned target and Scuttlers spread out to hunt nearby.
    A cut building stays out until dawn or repair (`b.murCut`). Nearby lamps and road glow fade (`murmurDarkAt`).
    A strike that's down to `half` of the number it set out with goes back down (`murmurPullBack`, task `back`).
    If night has enough time left, survivors that reached an exit can regroup for another strike. On the way in and about, night
    creatures route with the guns' cover as a cost (`routeOpts` `coverMap`: `murmurGunMap`, every 15 ticks; findPath
    adds `COVER_COST` there), `murmurPrey` scores what a gun covers 6 a gun lower, and Scuttlers scatter `scatterFor` s
    when `scatterN` armed warbots are within `scatter` tiles (`murmurScatter`, `murmurFlee`; not again for
    `scatterCd`). One killed on Active leaves no blast or fire (`killBot` → `murmurBody`): a body in `S.mur.dead`, which
    the nearest Scuttler or Brute within `dragR` (the Leech, Spitter and Sapper keep to their own work) drags (task `drag`, at `dragSlow`, `u.drag` drawn behind it) down the nearest
    exit (a guard, into its nest); one nobody comes for sinks after `bodyLast` s, and all at dawn. Memory
    (`S.mur.mem`: `kill` and `fed`, each up to `memMost` [x, y, weight], merged within 3 tiles, × `memDecay` each
    nightfall, gone under 0.3; `murmurRemember`, `murmurMem` within `memR`): a creature on a strike killed by a gun or
    warbot (`u.hitX`/`hitY`/`hitT`, set by `damageBot`) adds a `kill` there; a colony robot they kill, or a building
    they cut, a `fed`. Exits open away from the guns and the `kill` memory and toward tonight's rally points; plans and
    `murmurPrey` steer by both. Messages, in the colony's voice: the watcher, `Power lost at your …`, `Contact
    withdrawing underground…`, `The Murmur are up again…`, `Second contact, far side…`. Dawn clears the plans, the
    dark and the dead.
  - **Their other forms (Active only).** `leech`, `spitter`, `sapper` in `BOTS` (wild; `drain`, `spit`, `sap`), numbers in
    `MURMUR.forms`, the section after the craft in `js/sim.js`. From each form's night `from` (a mission can bring them
    sooner: `S.mur.formsFrom`, and `formsAll` for all three whatever the target), a plan's wave brings at most one of
    each from an exit that supplied the main pack (`murmurFormsFor`: the Leech where there's power to cut, the Spitter and
    the Sapper where a gun or Wall of the colony stands within 8 tiles of the target, `murmurDefenceNear`), gathering
    with the pack. At `murmurLaunch`: the Leech takes the cutting (role `cut`): there it feeds (`murmurFeed`, pose
    `feed`, `u.charge` up by `rate` a second; the building is cut and stays dark while it feeds, a Fuel every
    `fuelEvery` s and `bat` a second off each bot charging in it), and full (or its building gone) goes home (task
    `carry`, `murmurCarry`; whatever brings one down, `murmurDeliver`: its nest's `born` moves `grow` × charge s
    back, so it levels sooner). The Spitter (role `spit`, `murmurSpitStep`) goes in with the Brutes for the nearest gun
    or Wall within 12 tiles of the target, stops `range` tiles off, and spits every `every` s while its charge holds
    (`cost`, back at `regen`): pose `spit`, `u.fx`/`u.fy` its target, fx `spit` (`tx`, `ty`) and `spitHit`;
    `murmurSpitHit` takes `damage` armor (a Wall or Gate twice that, and can go; anything else not below 1), marks the
    colony raided, and shorts a gun out (`b.shortT`, `short` s: `shorted(b)`; Pulse Turrets, Minigun Nests and Mortar
    Pits don't fire meanwhile, their panels say so). The Sapper (role `sap`, `murmurSapStep`) digs in where it stands
    (pose `dig`, `dig` s), goes under (pose `under`, `u.under`: `aloft` counts it out of reach, so `damageBot` does
    nothing, and `nearestEnemyBot`, `foeReach` and the guns' and warbots' targets leave it out) straight for a tile by
    the target at `speed`, every tile it passes (that can be tunnelled) becoming its nest's tunnel (`S.tun`, so exits
    can open there), comes up (`up` s, pose `up`: open to a strike, not striking back) and then fights as a Brute
    does. Every form keeps `u.pose` ('walk' otherwise), `u.poseT` and `u.charge` (its glow); saved, checked by
    `checkSave`, in `hashState`. The drawing reads those fields (`drawCritter` with `MURMUR_LOOK`, `murmurFrame`,
    `murmurGlow`; a Sapper underground shows, and can be tapped, only where this device's colony sees it:
    `murmurInSight`; `enemyBotAtTap` never picks one). Repair brings a cut building's power back
    (`doFix` at full armor → `murmurPowerBack`; a cut dents it so it can be repaired; `stats.powerBack`). Kills of
    each kind are counted (`S.mur.slain`). The rival: warbots to a rally flag where an underground Sapper will come up
    (`aiMurmur`, one at a time, called home after 40 s: `P.sapRally`); a shorted gun counts as a place to cover
    (`P.murCut` → `aiMurCut`, another Pulse Turret there). Missions: *What Comes Up* (First Contact).
  - **Bolder as the game goes on (Active only; Quiet is as it was).** `MURMUR.bold` in `js/defs.js`, the section after
    `murmurDeliver` in `js/sim.js`. **Threats** (every game on Active, missions too): an armed robot (`isArmy`, `botArmed`,
    out in the open) within `threatR` (5) tiles of a night creature, or a robot that hit it in the last `hitFor` s, is
    never walked past (`murmurThreat`, from `updateCritter` before anything else of a raid or rally): it weighs its pack
    within `packR` tiles (`w`: a Scuttler 1, a Brute 4, a Leech 0.5, a Spitter 1.5, a Sapper 3) against the armed robots
    within 4 tiles of the robot (health / `robotW`, 4: a warbot 3) and the guns covering it (`gunW` each); with `engage` (1.5) times as much
    it fights it (`task.thr`, until `thrT` or it's dead, inside or out of reach), else it falls back 5 tiles for
    `avoidFor` s (`task.scat`, as the craft's scatter; `task.av` counts it) and comes on again; fallen back `avoidMost`
    times it carries on past it, and hit after that (in the last `hitFor` s) it fights. The Leech, Spitter and Sapper keep to their parts: they turn only
    on a robot that just hit them, and never fall back. Not the watcher, a feeding Leech, a Sapper digging in or under, or one going home. **Pressure**
    (`murmurBold`: Active, and not in a mission unless it sets `bold`): `murmurPressure(p, n)` is 1 for the first nights,
    then from `nightFrom` (3) 1 and `perNight` (0.25) for that night and each after (1.25 on the 3rd, at most `nightMost`, 2.2) times colony p's power
    (`murmurColonyPower`: its finished buildings and twice its armed robots, once a tick) over `powerRef` (40), clamped
    to `powerMin` (0.6) to `powerMost` (1.6) (`murmurPowerMul`), and never under 1: a small or beaten colony draws them
    less, and gets fewer hunting teams. It scales a craft wave's packs (`murmurPack`, Brutes a quarter), how many may be up at
    once (`murmurRoom`: `room` × the mean pressure on the colonies still in), a nest's open exits (`murmurMaxExits`: one
    more from `exitNight` 4, two from `exitNight2` 6; the Hollow's Colony cap follows it) and the waves
    (`murmurWaves`: a third from `waveNight` 4, at 175 s into the night). A creature done at its strike's objective (a
    Brute that battered it to 1, a Scuttler with nothing to catch there for `idle` s) goes on through the colony
    (`murmurLoose`, role `loose`: a Scuttler after the nearest unarmed robot out of the guns' reach within `quarryR` (6) tiles,
    `murmurQuarry`, else `murmurPrey`; `murmurOnward` likewise every 8 s). **The hunt** (`murmurHunt`, from `huntFrom` 4;
    a mission can bring it sooner with `S.mur.huntFrom`): every `huntEvery` (40) s of the night, from 70 s in to 40 s
    before dawn (`S.mur.huntAt`, `huntSeq`), each colony gets `teams` (base 1, half a team a night, at most 4) teams of
    `teamN` × the pressure (a Brute leading from `teamBrute` 5) at its weak points (`murmurWeak`: no gun within reach with
    a tile to spare, no armed robot within 6 tiles, not a Command Base, Wall, Gate or Viaduct nor anything a plan or team
    is after; scored on power they can cut, charge, sites, being alone, the `fed` and `kill` memories), each from a
    different exit within `huntR` (40) tiles of the colony's buildings with a route there (none near, no hunt: the
    counter). A team member (role `hunt`, `murmurHuntStep`): a Scuttler cuts the power there (`murmurCut`), any of them
    bites a site; then it fights as a strike's main pack does. The colony is told once a night (`P.murHunt`). **The
    horde** (`murmurHorde`, from `hordeFrom` 5): a plan in its strike (phase 2) gets `hordeN` × the pressure more
    (every third a Brute) every `hordeEvery` (35) s (`pl.hordeAt`, added to `pl.n0`) up the exit nearest its target with
    a route, until 30 s before dawn; its colony is told once (`pl.hordeMsg`). New state is saved, in `hashState` (only
    when set, so a game on Quiet hashes as before) and checked by `checkSave`. The rival copes as it did: it collapses the
    exits near its land (`aiMurmur`), which is what starves the hunt and the horde. Taught in *What Comes Up* (First
    Contact: `bold`, the hunt from the second night, and a goal to collapse an exit near the colony). Test:
    `lh/murmur-smart-test.js`; measuring: `lh/murmur-smart-measure.js`, `murmur-smart-batch.sh`, `murmur-smart-sum.js`.
  - **The Harrow, the behemoth (rare and late).** `harrow` in `BOTS` (wild, `behemoth`), its numbers in `HARROW` in
    `js/defs.js`, the section after the Sapper's in `js/sim.js` (`spawnHarrow`, `harrowTick`, `harrowSlam`,
    `harrowFurrow`, `harrowBatter`, `harrowPath`, `harrowTarget`, `harrowDied`, `harrowDown`, `harrowMound`,
    `harrowRoll`, `harrowNight`, `harrowMarks`), `aiHarrow` in `js/ai.js`. The biggest of the Murmur, drawn 4.8 tiles
    across (its body about 3.6 by 2.4). **When it comes:** (1) the Hollow: the Deep's mound under `mound` (a quarter) of its
    armor (`updateNest` → `harrowMound`): two burst out of it, 4 tiles out toward each colony's Command Base, one for
    each colony, once a game (`S.mur.hw.mound`); (2) a long game on Active (not the Hollow, not a mission unless it sets
    `harrowRoll`): at the dusk warning of night `rollNight` (6, about 70 minutes in: confirmed by the owner, Nov 21
    2026), one roll from the seed (`hash2(S.seed, …)` < `chance`, 0.5: `S.mur.hw.roll` 2, or 1 for no), and on a
    hit a seeded night in `nights` (6 to 8, `S.mur.hw.night`); at that nightfall (`harrowNight`) it comes up through the
    exit of the nest grown most nearest its colony (or 4 tiles out of the nest), at the colony holding most charge
    (`chargeWorth`), once (`S.mur.hw.done`); (3) `spawnHarrow(x, y, p, { nest, noEscort, quiet })` for missions and the
    campaigns (CAMPAIGN.md, CONTINGENCY.md), and a mission's `S.mission.harrowAt` (*The Harrow*). It needs the Murmur
    in the game (`S.wildlife`); its pack and riders need a nest left. **Coming up** (pose `up`, `up` s): a cave-in
    crater (`S.mur.craters`, drawn `crater` s) crushes what's within 2 tiles (Walls, roads, track and pipes) and stays
    open as a tunnel exit of its nest (a `burrow` with `b.crater`, on the nest's tunnel: packs use it on later nights,
    warbots collapse it like any other; none when no nest is left to own it), and its
    pack (`escort`: 6 Scuttlers, 2 Brutes) comes up raiding the Command Base; every colony is told, its target loudest
    (`sfx('harrow')`), and the music goes to Night Murmurs (`musicMood`). **Its walk** (task `harrow`: `p`, `tb`,
    `ph` 'up' | 'go' | 'slam', `path`/`pi`, `re`, `slamAt`, `born`): at `speed` (Worker × 0.45) along its own route
    (`harrowPath`: A* over open ground and fords only, round cliffs, water and lava, through buildings), to what its
    colony holds the most charge (`harrowTarget`: `charge` per point of `chargeWorth`, the Command Base +2, less `far`
    a tile; re-picked every `repath` s; another colony's when its own has none); what stands on its route it batters
    (`harrowBatter`: `smash` armor every `every` s, a Wall or Gate twice that; it feeds, `feed` health back, on a
    building of charge 3 it wrecks); a Command Base, Keep, megastructure or Arrival City only down to `floor` (half)
    of its armor (`harrowSpares`, `harrowFloor`), then on to the next. A robot within `reach` (2.1) takes `bite` (10) every
    `every` s. **The furrow** (`harrowFurrow`, each tile it enters): its tile and the 8 round it lose their road (not a
    bridge or tunnel), track, pipe and plans, and become its nest's tunnel (`S.tun`). **The slam** (`harrowSlam`,
    `ph` 'slam', pose `slam`: rearing `rear` s, then the blow): every `slamEvery` s with `slamMin` of a colony's robots
    and buildings within `slamR` (3) tiles of a point 1.2 ahead of it: robots take `slamBot` (6) and are stunned
    `stun` (3) s (`stunT`, as a Quake's), Walls and Gates go, other buildings lose `slamBld` (25), roads, track and
    pipes are torn up, `drop` (2) of its `riders` (6) jump off as Scuttlers raiding its target, and the broken ground
    is drawn 20 s (`S.mur.cracks`). **Its hide** (`damageBot`'s `small`): small arms do `small` (a quarter): warbots,
    Bulwarks, a Railgunner's sidearm, Skirmishers, Pulse Turrets, Bunkers, Minigun Nests, a train's guns; the rest in
    full; a Missile `missile` (60). Shots reach its body's edge (`r`, 1.2: `nearestEnemyBot`, `armyInRange`), and
    Howitzers take it on by themselves (`rocketTargetNear`, `rocketTarget` with a bot; a shell within `r` of it does
    `ROCKET.damage × fortMul`). A heavy blow (6 or more) makes it flinch (pose `hurt`). **Dead** (`killBot` →
    `harrowDied`): no body to drag; it dies on screen over about 3.4 s, looks only, timed from the husk's `t`
    (`HARROW_DEATH` in `js/render.js`: staggering, its light stuttering and cracks of light racing over its plates; at
    0.9 s its spires shatter, shards flung out; it topples and at 1.9 s comes down with a thud, a ring of dust and the
    screen shaking, `fxShake`; at 2.8 s its core bursts in a violet flash and shockwave and goes dark; the sound,
    `sfx('harrowdown')`, timed with it), then lies `husk` s (`S.mur.husks`, the dead art), its riders scatter home, a Crystal
    hoard of `loot` (40) spills (`addLoot`), the colony whose army stood nearest is credited (`stats.harrows`), and
    `S.mur.slain.harrow` counts. After `stay` (15 min) up it goes back down (`harrowDown`, a crater). **The rival**
    (`aiHarrow`, at the top of `aiMurmur`): with one going for it or within `aiReach` (30) tiles, one rally flag
    (`P.hwRally`) a few tiles ahead of it on the way to what it's after (by that, once it's within 10), every warbot it
    can spare sent there (the rear too), the flag moved with it until the fight is on, `P.massFor` raised to `aiNeed` + 4,
    and no exit or nest strikes meanwhile; the flag comes down when it's gone. Saved: the task, `u.riders`, a crater exit's `b.crater`, `S.mur.hw`,
    `craters`, `cracks`, `husks` (checkSave; hashState). Mission: First Contact's *The Harrow*. Tests:
    `lh/harrow-test.js` (the kit).
- **Research** (Colony; `TECHS` in `js/defs.js`, `startResearch`/`updateLab` in `js/sim.js`): a Research Lab (staffed)
  researches one upgrade at a time, cost paid on start (Cancel refunds), progress `dt × mult` per staffed Lab. Upgrades:
  Cargo Racks (`botCarry`), Long-life Cells (`drainMul`, and chargers 50% faster; the old Fast Charging upgrade is folded into it), Rapid Paving, Sentry Optics (`turretRange`,
  `shotsPer`), Turbo Motors (`speedMul`), Power Tools (`mult` × 1.15), Nanite Repair (`naniteRepair`).
- **Planetary events** (`EVENTS` in `js/defs.js`, `updateEvents` in `js/sim.js`; new-game option; in missions only with
  `events: true`, as in Trade Winds, whose setup brings the first one forward with `S.nextEvent`): the
  first after 8 minutes, then one every 5–8 minutes (2–3 in a mission, `MISSION_EVENT_GAP`), never one of the last two
  again, most with a 20 s warning. **Dust
  storm**: bots at `DUST_SPEED` (⅔) and every missile grounded (`missileBlocked`, `nukeBlocked`). **Ringfall** (a meteor
  shower, pieces of the planet's Ring; type `'meteor'`):
  `METEOR_HITS` strikes on each colony's share (mirrored with two players, turned with three: `meteorPlan`), each
  cratering roads (re-planned at once if the Cement allows), denting buildings and bots (never below 1 armor) and
  leaving a rich Ore or Crystal deposit (Uranium sometimes in a Nuclear race; a piece that would lie on a Trade Post's
  ground lies just off it instead, `calmSpill`); it ends "Ringfall over. Fresh Ore and
  Crystal in the strike zones. Listen for the Murmur." (its last words only where the Murmur are in the game, never on
  Lunar). **Solar flare**: battery drain ×
  `FLARE_DRAIN` (2). **The *Wren*** (the trader ship, type `'trader'`; its card shows the name in italics,
  `EVENTS.trader.html`, and one of its 31-year-old cargo lists, `WREN_CARGO` by the event's number): 75 s; as a rule it takes raw goods only and brings finished goods only (`traderOffer`:
  the raw good of `WREN_TAKES`, Stone, Fiber, Ore, Crystal or Crude, you hold furthest over `TRADE_KEEP`, for the finished
  good of `WREN_BRINGS`, Cement, Alloy, Chips, Fuel or Ammo with a war on, you hold least of against it) at `TRADE_BONUS`
  (1.3×) its worth. On about one visit in four (`WREN_RAW_CHANCE` 0.25, rolled for each colony in `startEvent` from the
  visit's seed) it makes its older offer instead (`wrenRawOffer`, the offer marked `raw`): the raw good of `TRADE_GET`
  (Ore, Crystal, Stone, or Crude once you have an Oil Pump) your land is closest to running out of (stock plus what's in
  the ground on your land, against `TRADE_LEFT`), for a good of `TRADE_GIVE` you hold well over `TRADE_KEEP` of (never
  Chips, Ammo or Missiles, nor a made good for its own ingredient), at the same 1.3×; with nothing to spare for it, the
  usual offer. The AI takes either deal when `short` (of the finished good it brings, or its land of the raw one). (From
  Nov 18 to Nov 20 2026 it brought finished goods only; the owner brought the raw offer back now and then.)
  An event card under the top bar shows it with a countdown, the Trade button and which kind of deal it is.
- **The Ring drizzle** (`updateDrizzle`, `drizzlePlan`, `drizzleLand` in `js/sim.js`; `DRIZZLE_*` in `js/defs.js`): in
  every game, Planetary events or not (in a mission only with `drizzle: true`; none asks yet), a lone piece of the Ring
  every `DRIZZLE_GAP` (160–240 s, seeded; the first at `DRIZZLE_FIRST`, 710–740 s, once the opening is over) on each colony's share of the planet:
  a spot `DRIZZLE_NEAR` (10–30, further the more tries it takes) tiles from player 0's Command Base, copied onto every
  colony's share as Ringfall's are (`fairShare`, which `meteorPlan` uses too), every copy on open ground no colony holds
  (`drizzleOk`: bare ground, no road, rail, pipe, plan, building, ramp, fertile soil, lava, ford, tide or fault, off a
  Trade Post's ground, an Uplink or a wreck), or none falls this time. None in the Hollow (`drizzleOn`):
  it's underground, where only Ringfall reaches, through the breaches. It leaves `DRIZZLE_TILES` (2) tiles of Ore or Crystal (half and half) at
  `DRIZZLE_RICH` (0.4) times a Ringfall deposit's amount each, or in a Nuclear race now and then (`DRIZZLE_URANIUM`, 10%) a
  single tile of Uranium; no damage, no crater, no war scar, and a Shield Dome doesn't stop it (it never lands in a
  colony's land). The pieces show for `DRIZZLE_FALL` (1.4 s) as a streak in the sky (effect `'drizzle'`, brighter on
  Argos), then a puff and a glow, with a soft whoosh (`sfx('drizzle')`, heard on screen only) and a ring pulsing on the
  minimap for 12 s; no message. None falls while `DRIZZLE_CAP` (6) of its deposits lie unclaimed. (Tuned so computer-vs-computer games end as often as without it: the first version, every 120–200 s from minute 3, cap 8, half a Ringfall deposit, left more of them undecided at an hour.) State: `S.drizzle`
  (`next`, `n`, `spots`, `fall`), saved, checked (`checkSave`) and in `hashState`; a save without it starts the clock
  from when it loads. Rivals give active drizzle deposits extra weight for Outposts, Ore Mines and Crystal Taps when
  that mineral runs low. Outposts prefer neutral drops they can bring inside their border. Gatherers can use a
  single surviving drop tile if their workers have a short walk to it. Existing coverage, enemy fire and road
  access still matter (`aiDrizzleTargets`, `aiSearchSpot`).
  In 12 matched Normal Versus games on Medium Long haul, Lakes and Standard (seeds 11, 21, 25 and 37 on each,
  60-minute cap), rivals mined 158 drizzle Ore and 108 drizzle Crystal, up from 38 and 46. Undecided games stayed at
  1/12 and the mean game length was 22:36 before and 22:56 after, counting the capped game at 60 minutes.
- **Missiles** are built at a Missile Factory (2 Alloy, 1 Chip and 1 Fuel each, 20 seconds) and carried to Missile Silos
  by haulers. A hit does 24 damage, which wrecks most buildings outright, plus 5 to other rival buildings and 9 to bots
  within 2.2 tiles. Only a Command Base or Keep (`captureOnly`) drops no lower than `MISSILE_FLOOR` (35%) of its armor, from Missiles, bombs or rockets alike; warbots have to capture those. Everything else, Outposts and Bunkers included, can be knocked out, and a wrecked fort's garrison walks out alive (`releaseBotsFrom`; a nuke kills it first). A fort under `SORTIE_ARMOR` (25%) sends every armed warbot inside out to fight, and capturing one ejects whoever is left inside instead of killing them.
  A Silo is drawn with its launch pit empty until it's ready to fire (loaded and not reloading; a Nuclear Silo once
  armed), then the missile fades in (`siloRise`; art `silo-empty`, `nukesilo-empty`).
  To fire, tap a Silo and press **Aim missile**: its 22-tile range shows as a red ring; tap any spot inside it (a
  building, open ground, or a rival robot or vehicle on the ground) to see the blast radius, then **Fire**. With no
  building there, a rival robot or vehicle within `MISSILE_LOCK` (0.9) tiles of the tile's middle is the target
  (`missileBotAt`, `m.bot`): the Missile flies to where it stood at launch (no homing: the owner, Nov 21 2026), and at
  impact it takes the full 24 if still within 0.6 tiles; moved off, only the blast can catch it. Not aircraft. (Army → rival building → Fire missile also works.)
  Under a finger the view never zooms out past `AIM_TILE` (20 px a tile; fitting the whole ring on a phone made tiles
  9 px, twenty under a fingertip): tap to drop the crosshair, drag it to adjust (`mapGrab`, a drag that starts on it;
  elsewhere a drag moves the map), and only Fire launches (a second tap on the spot fires only with a mouse). A bomber's
  strike and a Howitzer's target are picked by a tap, ringed, then confirmed on the banner (`pickTarget`).
- **Nuclear race** (new-game option): six small Uranium deposits on each side (`URANIUM_DEPOSITS`, in each colony's half, third or quarter) glow green. An Ore Mine within 4 tiles
  digs Uranium before ore; a Nuclear Reactor enriches it (2 → 1) and a Nuclear Silo assembles a missile from 6 Enriched
  Uranium, 4 Alloy and 2 Chips (60 s), so 12 Uranium a bomb. It flies 30 s (the target is warned and sees the blast
  ring; the **Evacuate** button on the incoming-nuke card, or the AI by itself, sends every robot in the ring plus
  `EVAC_MARGIN` out of it and holds jobs there until the blast: `startEvac`, `evacSweep`, `doFlee`) and wipes out every building, robot and road within 6 tiles, yours included; a Command Base survives with no
  garrison and 1 armor, unless the missile lands on it (within `NUKE.direct`, 2 tiles, of its centre): then it's
  destroyed and that colony is out, what's left of it going to the colony that fired (`eliminate(..., 'nuke')`), so the
  AI aims for a rival's Command Base whenever one is in range. The ground stays scorched for 4 minutes: nothing can be built there. The AI races too.
  Tunables: `NUKE` and `URANIUM_DEPOSITS` in `js/defs.js`.
  - **Radiation** (`RAD` in `js/defs.js`; the rules in `js/sim.js`, "radiation"; the looks and sound in `js/radfx.js`).
    A nuke's fallout (`radAdd(..., 'nuke')` in `nukeImpact`, after `domeCatch`: a nuke a Shield Dome stops leaves none)
    and a Nuclear Reactor destroyed by a foe (`reactorDown` from `destroyBuilding`: by force, and a foe hit its colony in
    the last 2 s, `liftKiller`; dismantled, moved or wrecked by its own side it shuts down safely) leave a zone in
    `S.rads` (`{ id, x, y, r, cr, t0, life, k, o }`): 7 tiles round a nuke for 330 s, 4 round a Reactor for 300 s, its
    radius shrinking linearly to nothing (`cr`, set every half second by `updateRads`, so every reader sees the same
    circle on every device and after a load). In a zone: robots out in the open (not indoors or in the air) lose
    `RAD.hurt` (2%) of their full health a second at its middle, `RAD.edge` (half) of that at its rim (`radDose`): about
    10% walking through a Reactor's, dead in a minute standing at a nuke's middle; buildings work at `RAD.work` (half:
    `radWork` in `produce`, a gatherer's trip and a site going up; the panel says "slowed by radiation"); `findPath`
    adds `RAD.path` a tile (`radMap`) for robots that don't fight (`avoidFor`) and for a rival's army on the march
    (`routeOpts` `rad`), so they go round where it's short and still go in when their job is inside; gatherers, Pavers
    and road crews take no node or tile in one (`radTile`); `canPlace` and `footPlace` refuse a building in one with how
    long until that ground clears (`radWhy`, `radClearIn`); the rival's site search keeps 1.5 tiles clear of one, and
    its nuke aim counts its own buildings in the fallout ring against a target. A breached Reactor leaves a ruin
    (`S.ruins`, `{ id, x, y, t, o }`, up to `RAD.ruins`): drawn among the buildings as the Reactor's art greyed, its stack
    broken and dome holed, smoking, and at night casting a green and blue light column for `RAD.glow` s before it goes
    cold; it goes when something is built, laid or planned on its tile (`ruinTidy`). Zones and ruins are in `hashState`,
    saves and `checkSave`; a save from before has none. On the ground (`drawRadGround`): the grass desaturated grey
    (a plain wash on Saver), a green-yellow haze thickest at the rim with a slow flicker, a dashed ring at the edge and a
    trefoil on its north side; motes drifting up (`RADFX.motes`, by Graphics step), robots in a zone glowing green, and
    on the minimap a ringed disc (`drawRadMinimap`). With a robot selected in a zone, or the camera over one, a faint
    Geiger crackle on the Effects volume (`radGeiger`). Reduce motion: no flicker, drift or creeping ring.
- **Megastructures** (the new-game rule, on by default; IDEAS.md "Megastructures", the owner's look A for each, built
  Nov 2026). Late-game, one per colony (`megaBlocked`), on the Build menu's own **Mega** tab (`BUILD_GROUPS` `mega`,
  `late`: drawn after All, key **6**; L the Lance, Y the Sundering Ray, H the Dome, C Arrival City, O the Orbital Lift, N the Atmosphere Engine, E the Deep Core, U the Great Uplink), all bigger than a tile: `def.foot` (3, 3, 2, 4, 3, 4, 3 or 3)
  is a square of tiles from the building's own tile (its north-west corner, its door) east and south (`footTiles`,
  `footClaim`, `footPlace` for placing: every tile open, level ground of yours, the buildings beside it keeping a side,
  `footBlocks` for not closing a way through; `bCentre` its middle, `footDist` distances to it).
  - **The Lance of Corvane** (`BDEFS.lance`, `LANCE`; key L; 40 Cement, 30 Alloy, 15 Chips, 10 Crystal; 160 s to
    build). Its panel's **Aim the Lance**, then a tap anywhere (the `lanceAim` order, `setLanceAim`; `lanceStop` stands
    it down): it charges for `LANCE.charge` (90) s and fires. Power (`lancePower`): `LANCE.gens` (2) Generators with
    Fuel within `LANCE.reach` (4) tiles of its square (`megaGens`), each burning a Fuel every `genFuel` (30) s while it
    charges, or a Nuclear Reactor there with `uranium` (2) Uranium or an Enriched Uranium in it (`reactorCharge`), taken as the charge starts; losing that power
    mid-charge loses the charge (`lanceStillPowered`). While it charges its owner's lights dim and factories work `slow`
    (a third) slower (`lanceDim`, `P.dimUntil`), every player is told, and a hum rises (`lanceHum` in `js/audio.js`); the
    Murmur are drawn to it (`chargeWorth` 6, `murmurPower`). A dust storm holds the shot. The beam (`lanceFire`,
    `lanceLine`, `lanceTiles`, `lanceTargets`, `lanceBand`) runs from its middle through the aimed tile to the map's
    edge, stopped by the first foe's Shield Dome it enters (which takes it and drops; nothing under a foe's up Dome is
    touched, even beside the line: `lanceDomes`). Its **core** is `width` (2) tiles wide: every building whose footprint
    touches the strip within 1 tile of the line is destroyed (`destroyBuilding`, a Command Base or Keep held at
    `missileFloor`, Arrival City knocked to 0 and down, Murmur nests and exits cleared), every robot within it killed
    (not aircraft aloft), groves and crops burned. Its **scorched edge**, `edge` (1) tile more either side: buildings
    touching it (and not the core) lose `edgeDmg` (half) of their full armor, robots there half their full health, but
    the edge alone destroys nothing (it leaves at least 1; a Command Base or Keep its Missile floor). Nothing on a Trade
    Post's ground is touched. The cut is kept for good (`S.cuts`, up to `cutsMax`, each with its core's width `w`, an
    older save's cuts none: drawn 0.8 wide; drawn as a trench that glows and cools, its edge a fainter scorch, steam over
    water: `drawCuts`, `drawLanceBeams`) and on War scars burns the core's ground to ash with the animals there and
    scorches the edge lighter (`scarTrench`). The aim line (`drawLanceLine`) shows the core as a red band and the edge
    as a fainter orange one, buildings in the core ringed red (yours amber) and those only in the edge ringed dashed. Then `reload` (240) s. Not in the Hollow (`worldBan`).
  - The Lance's gun turns toward its aim at 0.35 rad/s (`updateLance`, `b.aim`); its art has 16 ways, and the render
    turns the nearest one the rest of the way about the turntable (`lanceTwist`), so it points exactly along the shot
    and swings smoothly (Nov 21 2026).
  - **The Shield Dome** (`BDEFS.dome`, `DOME`; key H; 30 Cement, 24 Alloy, 12 Chips, 20 Crystal; 120 s). Up while it
    has power (a Generator with Fuel within `reach` 4) and Crystal (one every `crystal` 20 s, `cap` 6, hauled as its
    ammo): `updateDome`, `b.dUp`. `domeCatch(x, y, by, kind, sx, sy)` in each impact (`missileImpact`, `nukeImpact`,
    `bombImpact` and napalm, `shellImpact` and `rocketImpact` from guns outside it, `meteorImpact`, `rockfall`, a rival
    canister coming down into it in `updateCans`) lets the nearest up Dome of a foe (any Dome for the planet's own) take
    it instead: `domeHit` takes `DOME.cost[kind]` off its 100 strength; unhit for `quiet` (10) s it regains `regen` (1) a
    second; at 0 it drops for `down` (60) s and comes back at `back` (40). Drawn in code (`drawDomes`): a hex lattice on
    the dome's surface, shimmering, flashing where hit, breaking up as it drops. Pausable (`pausable`): turned off it's
    down and burns no Crystal; turned back on (`setPaused`) it stays down for `warm` (30) s, `b.dWarm`, as long as a
    nuke's flight, so it can't be raised on seeing a launch.
  - **Arrival City** (`BDEFS.city`, `CITY`; key C; 60 Cement, 30 Alloy, 15 Chips, 24 Fiber; 200 s; 4 × 4; the owner's
    look A, Nov 2026; its look since Nov 21 the second sheet's A, Four Blocks round a Square). It opens `CITY.at` (12 min; 15 before the November 2026 balance pass) into a free-play game (`cityOpen`; a mission
    with `mega`: at once) and is banned on Argos, the Lunar biome (`worldBan`). **Arrival drive** (`cityBoost(owner, x,
    y)`): its owner's work within `reach` (8) tiles of its middle goes `boost` (20%) faster: `produce` (factories, the
    Oil Pump, the Bot Foundry), the gather/farm/plant timer in `doStaff` and `doBuild`'s site progress; half that while
    it's dark at night for want of Fuel (`dark`), none while it's down. `cityList` caches the finished Cities per tick and
    land change. **Land**: a military-rank claim of `land` (6) tiles round its middle in `computeTerritory` (`cityRing`,
    `cityRingD`), so it is never cut off; in `updateDomination` every tile of every City's ring held by its owner counts
    once more (`cityLand`). **Lights** (`updateCity`): at night (`cityNight`: `murmurNight`, or always on an
    always-night map) a Fuel every `fuel` (60) s (`fuelCap` 6, Tankers bring it, `b.cFuel`); without it `b.cDry` (dark,
    the boost halved); lit it is `working`, so the Murmur see it like a Generator (`murmurPower`, `chargeWorth` 3).
    **Never destroyed**: `captureOnly` takes it in with a `missileFloor` of 0, and every way a building is wrecked holds
    it at 0 instead and calls `cityDown` (`hitBuilding`, `missileImpact` and its splash, `rocketHit`, `bombHit`,
    `nukeImpact`, `lanceFire`; `destroyBuilding` by force as a backstop; `demolish` and the order refuse it; not on a
    fault line that will open, `footPlace`). **Knocked out** (`b.cDown` while dark): seized like any megastructure (see
    **Seizing megastructures** below), with no Demolish it; taken, its land, boost and Domination count change sides
    (`P.stats.cities`, `logEvent` `city`). Saved whole with the building; `hashState` covers owner, down, Fuel and dark
    (the seize state with every megastructure's). Art: `renderer/b/city.js` (`tools/render_city.sh`, `tools/install_city.py`): four prefab panel blocks
    of raw concrete round a square (lawns, deer, a fountain, the Arrival clock on a stele ringed like Ithaca I, an empty
    tram at its stop, WELCOME HOME on the north roof): `city@T`, `city-down@T` (every time of day: dark broken windows,
    cracked and fallen panels, a corner blown out, the C fallen) and four light layers `city-lit-0..3` that
    `drawCity`/`cityLights` add at dusk tier by tier on a timer (`cityLightLevel`: lamps, then the windows floor by
    floor, the top floors, WELCOME HOME, the clock and the Ring last), `city-led` (the LED strips round its roofs, white,
    tinted in the owner's colour once per colour and size: `cityLedTint`; on with the lamps), `city-lit-down` (what still
    burns on the wreck, WEL OME HOME and the clock, flickering; steady on Graphics Saver), a warm pool and
    a wide glow (`drawCityGlow`), its reach and land when placing or selected (`drawRanges`), a ring filling in the
    taker's colour (`drawCityTaking`). Sound: `cityHum` (an empty-city drone on the Ambience volume, near one on screen),
    `cityclock` (its clock striking now and then) and `citychime` (the station chime when it's taken or lit again).
  - **The Orbital Lift** (`BDEFS.lift`, `LIFT`; key O; 60 Cement, 44 Alloy, 26 Chips, 20 Crystal; 220 s; 3 × 3; armor
    90; the owner's look A, the Beacon Cable, Nov 2026). **Fall line**: placed with a direction, `b.lfDir` 0..7
    (`LIFT_DIRS`, east then clockwise; R turns it while placing: `UI.liftDir`, `liftTurn`; the `place` order's axis
    argument carries it, and `liftDir` turns a site's), `liftLen()` tiles (half the map's width for its size: 15, 20, 25,
    30) from beside the pad out (`liftLineTiles`; diagonals as long), all on the map and over no other colony's land, Trade
    Post or Uplink (`liftLineWhy`, in `footPlace`). **Call down** (the `liftCall` order, `liftCall`, `liftCallWhy`): one
    of `LIFT.drops` (Security: 6 Warbots, 2 Bulwarks; Work crew: 6 Workers, 2 Freight Trucks; 30 Alloy; 18 Chips), times
    `liftMul` (1 + `boost` 0.5 per restock, `boostMax` 2); `climb` (45) s down (`b.lfMove` 1, `b.lfT`), every colony told
    as it starts down (`logEvent` `liftCall`), then `liftLand`: robots out round the pad (`liftSpots`), goods into its
    stock as `b.loot` (Haulers take them to storage), `b.lfCd` = `cooldown` (360) s from the landing. The Carrier's
    reserve `b.lfRes` (`reserve` 6) goes down a drop a call. **Restock** (`liftSend`, `liftReserve` orders: `b.lfSend`
    {good: kept home}, up to `goods` 3 of `LIFT_GOODS`): Haulers and Tankers bring what's held beyond the reserve
    (`needsOf`, `liftWant`), touching stores and factories by conveyor (`liftConveyor`); at `load` (30) goods
    (`liftLoaded`) it climbs up (`b.lfMove` 2; never while one comes down; the cooldown runs on), and `liftArrive` puts a
    drop back (`b.lfRes`, up to 6) and adds a restock (`b.lfBoost`). **Power**: each climb burns `fuel` (2) Fuel from
    Generators within `reach` (4) (`liftGens`, `b.lfPaid`); without it the climber waits; a solar flare holds it
    (`eventNow('flare')`); climbing it is `working` (the Murmur: `murmurPower`, `chargeWorth` 3). **Weak**: below `weak`
    (30%) `liftWeak` tells its owner and whoever has land or robots on its line (*Lift cable unstable*, `b.lfWarn`), and
    the line flashes red on the map and minimap. **The fall**: `destroyBuilding` by force calls `liftDown`; a climber on
    it is lost; if a foe hit its colony in the last 2 s (`liftKiller`, from `P.hitBy`) it falls (`liftFall`: `S.liftFalls`
    {id, o, by, ax, ay, d, n, t, k, sp, hit}), else (dismantled, its own side's Lance, the ground) it's reeled in.
    `updateLiftFalls`: `creak` (5) s, then tile k of the line at `sweep` (4) tiles a second (`lunar` half on Argos):
    `liftCrush` (each building and robot once: `f.hit`): `crush` (30) off a building (destroyed at 0; Walls, Gates,
    Viaducts, Ropeways, pylons and sites broken outright; a Keep left at half, a Command Base at `missileFloor`, Arrival
    City down at 0, another megastructure at 35%), robots on the tile killed and those beside it `side` (3) hurt (not
    aircraft aloft or ships), roads (`wreckRoad`), track and plans broken, and the wreckage laid (`liftWreckPile`): War
    scars' scrap of kind 4 (`s.cb`, `s.d` its direction, `s.ft` when it fell), one a tile worth `cut` (1) Alloy, kept even
    with War scars off, never merged or squeezed (`scrapAdd`, `scrapSqueeze`, `scrapTidy`). `liftWreckAt` (a map remade
    as the scrap changes) refuses building and roads there (`canPlace`, `footPlace`, `canRoad`) and halves robots' speed
    (`moveAlong`, `slow`); `salvageRun` cuts it up (with War scars off too; on no one's ground as well as its owner's),
    the pile gone once cut. `scrapHeaps` brings the Murmur's tunnels. Not in the Hollow (`worldBan`). Saved with the
    building (`lfDir`, `lfRes`, `lfBoost`, `lfCd`, `lfMove`, `lfT`, `lfPaid`, `lfLoad`, `lfMul`, `lfSend`, `lfUps`,
    `lfDrops`, `lfWarn`, `lfFeed`) and `S.liftFalls`, all checked by `checkSave`; a save from before has none; `hashState`
    covers them, and the wreckage when War scars are off. Art: `renderer/b/lift.js` (`tools/render_lift.sh`,
    `tools/install_lift.py`): `lift@T` and `lift-down@T` (below 30%) at every time of day, framed as the Lance
    (`LIFT_FRAME`); in code (`js/render.js`, the Orbital Lift): the cable rising up the screen from its foot in a column
    of its owner's light, red warning lights, climber pods (the higher, the smaller; amber windows at night) and the real
    climber (`drawLiftCables`, `drawLiftBeam`, `drawLiftPod`), the shadow along its fall line and the red flash
    (`drawLiftLines`, `drawLiftShadow`; on the minimap too), the line when placing or selected (`drawLiftLine` from
    `drawRanges`), the floodlights' pools, the falling cable (`drawLiftFalling`) and the wreckage baked into the ground
    (`drawCableWreck`), sparking for `sparks` (60) s. Sound (`js/audio.js`): `liftHum` (the cable's held note, a whine
    while a climber moves), `liftclimb`, `liftland`, `liftgroan`, `liftsnap`, `liftimpact`. Its panel: `renderLiftSection`
    (the six lamps, Call down on Z X C V, Restock the Carrier).
  - **The Deep Core** (`BDEFS.deepcore`, `DEEP`; key E (D pans); 60 Cement, 40 Alloy, 20 Chips, 10 Crystal; 300 s; 3 × 3;
    armor 100; the owner's look A, the Headframe, and the sheet's numbers, Nov 21 2026). Opens `DEEP.at` (20 min) into a
    free-play game (`deepOpen`; at once in a mission). `updateDeep`: power from a Nuclear Reactor within `reach` (4) tiles
    (`deepReactor`; no Uranium used) or a Generator there with Fuel (`deepGen`): it takes a Fuel from it every `genFuel`
    (60) s itself (`b.dcFuel`, `b.dcGen`; the Core isn't in the Generator's own reach list, and a Generator feeding one
    runs for it: `deepFeeds` in `updateGenerator`); `b.dcSrc` says which. Without power (or cut by the Murmur, or turned off:
    `pausable`, a raid already called still comes) nothing happens and `b.dcT` (seconds of depth) is kept. Powered it is `working`; above `weak` (half) of its armor `b.dcT`
    grows; `deepStageAt` gives the stage from `stages` [0, 360, 960] (`b.dcStage`; `deepDeeper` on reaching one: told,
    `logEvent` `deep`, `P.stats.deepStage`). It brings up `out[stage - 1]` a minute (6 Ore; 8 Ore, 3 Crystal; 10 Ore, 4
    Crystal, 0.25 Uranium) times the colony's `mult`, half below `weak` (`deepRates`; no Crystal on Argos), into its own
    stock (`b.dcAcc` the fractions; `def.out` 30 of each, Haulers take it as from any producer; full, that good waits),
    counted in `P.stats.deepOre`, `deepCrystal`, `deepUranium`. The Murmur: at work it is `chargeWorth` 3 and adds to
    `murmurPower` like a Generator. A stage reached with the Murmur on and a nest standing sets `b.dcCall` (the stage)
    for night `b.dcCallN` (the next one): `deepWarn` tells its owner at dusk, and `deepCalls` (from `murmurTick`, 50 s into
    that night) sends a pack for it (`raid` with `focus` the Core) of `call` (1.5) times the night's (`MURMUR` `pack`),
    `hollow` (2) times that in the Hollow, from the exit nearest it; at stage 3 first `deepExit` opens a new exit within
    `exitR` (8) tiles of it (open, reachable, `exitRoom`; for good, until collapsed) and `breakers` (2) Brutes more come
    (`logEvent` `deepCall`); at dawn, still standing, `deepHeld` counts `P.stats.deepHeld`. Destroyed by force
    (`destroyBuilding`), its stock is lost (no crates) and so is its depth; with the Murmur on, `deepShaft` puts a tunnel
    exit (`burrow`, `e.shaft` its colony, the nearest nest's) on its middle tile, and that colony's Workers cap it by
    themselves (the worker pass, `deepShaftsFor`, `assignCap`, task `capshaft`, `doCap`: `capCement` (4) Cement taken from
    storage once, `e.capPaid`; `capT` (20) s of work, `e.capT`; `P.stats.shaftsCapped`), or warbots collapse it as any
    exit. Saved with the building (`dcT`, `dcStage`, `dcAcc`, `dcSrc`, `dcFuel`, `dcGen`, `dcGenT`, `dcCall`, `dcCallN`,
    `dcWarn`, `dcHeldN`; on a shaft `shaft`, `capper`, `capT`, `capPaid`); `hashState` covers them. Its panel (the dynamic
    part of the building sheet): the gauge's three lamps and a bar to the next stage, what it brings up, its hoppers, its
    power and the coming call. Art: `renderer/b/deepcore.js` (`tools/render_deepcore.sh`, `tools/install_deepcore.py`):
    `deepcore@T` (the tower without its wheels) at every time of day, framed as the Lift (`DEEP_FRAME`), and the wheels
    alone, `deepcore-work-0`…`7` (through 60 degrees, one set for every team), drawn over it by `drawDeep`: turning at 8
    frames a second while it works, standing where they stopped when not (`DEEP_WHEEL`, looks only). In code
    (`deepLights`, from `DEEP_MARKS`): the violet glow rising out of the shaft from stage 2, brighter and pulsing at stage
    3, faint by day (`deepGlow`), the gauge's lamps (the next one blinking while it works toward it), the floodlit wheels at
    night, and its light pools. Sound (`js/audio.js`): `deepHum` (its winding engine and drill on screen, sinking with each
    stage; the wheels' clank) and `deepstage` (a stage reached). Rivals: `aiDeep` (outside `AI_MEGA_KIND`, so never under
    the cap): any rival, from `DEEP.aiAt` (20 min; it was 30 and waited for its last Ore Mine to run dry until the
    owner's call of Nov 22 2026), with half its Cement and Crystal in hand, by a Generator or Reactor within 14 tiles of its Command Base (else by the Base,
    a Generator then going up beside it; `aiMegaSpot`), the goods of both first; `aiDeepGuard` rallies up to 8 warbots by it before dusk on a call
    night (`P.deepRally`, called back at dawn). The Salvager marches on a foe's stage-3 Core (`aiMarch`).
  - **The Atmosphere Engine** (`BDEFS.atmos`, `ATMOS`; key N (A pans); 50 Cement, 40 Alloy, 24 Chips, 30 Crystal, 20
    Fiber; 360 s; 4 × 4; armor 100; the owner's look A, the Rain Tower, and the sheet's numbers, Nov 21 2026). Opens
    `ATMOS.at` (20 min) into a free-play game (`atmosOpen`; at once in a mission); `worldBan` keeps it off Argos and out of
    the Hollow. `updateAtmos`: power from `gens` (2) Generators with a whole Fuel within `reach` (4) tiles (`atmosGens`;
    it takes a Fuel from each every `genFuel` (60) s itself, `b.aeFuel`, `b.aeGens`, `b.aeGenT`; it isn't in a
    Generator's own reach list, and a Generator feeding it runs for it: `atmosFeeds` in `updateGenerator`), or a Nuclear
    Reactor there with Uranium (`atmosReactor`; a Uranium every `uEvery` (360) s, an Enriched one for two: `b.aeU`,
    `b.aeUr`); `atmosPower`, `b.aeSrc`. Unpowered (or cut by the Murmur) nothing grows. Powered, `b.aeT` (s of power,
    times the colony's `mult`) gives the stage (`atmosStageAt` from `stages` [0, 360, 960, 1680]; `atmosStage` on
    reaching one: told, `logEvent` `atmos`, `P.stats.atmosStage`, the `atmosstage` sound), and its change spreads out
    from its middle at `spread` (0.25) tiles a second to `r` [8, 12, 16, 20] of its stage (`b.aeP`, `atmosReach`).
    The land (`atmosTick`, once a second): `atmosPaint` marks every ground tile in its reach with the stage in `S.green`
    (a sparse map, tile → 1 to 4, kept for good; not on burned soil, lava or the tide), and from Rain sets `S.fert`
    (Bio Farms plant it like any fertile soil; the soil stays when the Engine goes). Green: crops on `S.green` ≥ 3 grow
    `crop` (1.25) times as fast (`growStalks`) when the crop's holder (`soilHolder`) is the owner's or an ally's
    (`atmosOwnAt`); every `wither` (60) s `atmosWither` takes the nearest tile of the Bloom in
    its reach (a tunnel, `S.tun`, or a Bloom vein; `P.stats.atmosWither`). Garden: all of it at once, any tunnel exit
    in it caves in, and every `seedEvery` (20) s `atmosSeed` puts a stalk grove on open Garden ground, `groves` (24) in
    its reach at most (`P.stats.atmosGroves`). Its hold (`atmosHolds`, worked out once a tick; `atmosAt(x, y)` the
    highest stage over a spot; each hold carries its owner `p` and `on`, its power): Calm, no dust storm for its owner
    and allies (`evSpeed(x, y, p)` → `atmosOwnAt`, from `speedMul` and a ship's speed; with no `p`, anyone's); Rain, no
    tunnel dug in (`murmurDig`); Garden, no exit opens (`atmosGardenAt` in `murmurOpenExit` and `deepExit`). Destroyed
    or dismantled (`destroyBuilding` → `atmosGone`), `S.green` and the soil stay, and its hold goes into `S.aeFade`
    ({ x, y, r, st, t0, p }), shrinking to nothing over `fade` (600) s. **The circle is its owner's:** from Rain a
    foe's robots and vehicles in a standing Engine's circle move at `mud` (0.5) speed (`atmosMud` in `speedMul`; not
    the Murmur, aircraft or ships; `atmosFoeAt`), and while it has power (`b.working`) a foe's Torches are rained out
    there (`atmosRainAt`): `scorchTileWhy(t, by)` refuses the tile, and their flames leave no burns (`scarBurn`) or fire.
    **Its Storm Front** (`STORM`): the order `atmosStorm` (`setAtmosStorm`; `atmosStormBlocked`: from Rain, with power,
    on the map, `cd` (60) s after the last, the centre at least its stage's radius + `r` (5) from its middle, not inside
    another standing Engine's reach) sets `b.aeStorm` ([i, j]) and `b.aeStormT`; `atmosStormOff` calls it off. It is up
    while the Engine stands at Rain or later with power (`atmosStormOn`; listed in `atmosHolds` → `atmosStorms`), and
    over a spot for a foe of its owner unless the spot is in any Engine's hold (`stormOver`, `stormOverB`): robots
    `slow` (0.6, `atmosMud`), building sites `build` (0.6, `stormWork` in the builders' progress), guns `range` (0.75:
    `auraRange` takes the rest off `def.range`, so every gun's reach and `gunReach` follow). From Green, `atmosDrought`
    (from `atmosTick`) counts a foe's crops under it (holder by `soilHolder`) in `S.drought` (tile → s, rebuilt each
    second: a crop out from under it starts again); `growStalks` skips them, and at `drought` (180) s they wither (the
    soil stays; `P.stats.droughtCrops`). At the Garden every `boltEvery` (60) s of power (`b.aeBolt`) `stormBolt` picks
    one of the foes' buildings under it with `hash2(b.id, b.aeBoltN, S.seed)` and takes `boltDmg` (0.15) of its armor,
    never below `boltFloor` (0.3) (fx `stormbolt`, sound `stormbolt`, `P.stats.bolts`). Destroyed, `atmosGone` ends it
    and tells the colonies under it. Saved in `aeStorm`, `aeStormT`, `aeBolt`, `aeBoltN` and `S.drought` (checked by
    `checkSave`; a storm only on a Rain Engine, on the map) and hashed. Drawn by `drawAtmosStorms` (a dark cloud turning
    over the spot from `wxCloud` billows, its shadow and dashed rim, rain under it; lit blue-grey at night; it rolls in
    and breaks up over a few seconds) and, aiming, `drawStormAim`; the panel's **Storm Front** button (`sh-storm`, F)
    aims it through `startAim` (anywhere: the Engine's kept-clear circle shown), **Call the storm off** (`sh-stormoff`,
    C); a building of yours under a rival's storm says so on its panel. The Murmur: `chargeWorth` 6 and `murmurPower` +3
    whether it works or not; `atmosLure` puts it first for a pack (`murmurPrey`, from `lure` (20) tiles further out, +40)
    and for an Active strike (`murmurPlan`, +60, from further out); each stage from Rain, with the Murmur on and a nest
    standing, sets `b.aeCall` for the next night (`b.aeCallN`): `atmosWarn` at dusk, and `atmosCalls` (from `murmurTick`,
    50 s into the night) sends `sappers` [0, 1, 2, 2] Sappers from the exit nearest it to dig in under it (`raid`,
    `role: 'sap'`; `logEvent` `atmosCall`). Burned soil (`scorchSoil`) loses its `S.green` (`P.stats.burnedGreen` for the
    burner). Saved with the building (`aeT`, `aeStage`, `aeP`, `aeSrc`, `aeFuel`, `aeGens`, `aeGenT`, `aeU`, `aeUr`,
    `aeWith`, `aeSeed`, `aeCall`, `aeCallN`, `aeWarn`) and in `S.green`, `S.aeFade` (checked by `checkSave`); `hashState`
    covers them, and a mission's `greenPct`, `greenRun`. Its panel: four stage lamps and a bar to the next, its circle,
    its power and the coming Sappers. Placing it shows the four circles and its Generators' reach. Art:
    `renderer/b/atmos.js` (`tools/render_atmos.sh`, `tools/install_atmos.py`): `atmos@T` at every time of day, framed as
    Arrival City (`ATMOS_FRAME`); in code (`drawAtmosPlumes`, from `ATMOS_MARKS`): the plume (puffs rising from the throat
    and drifting east, thinner unpowered), at night lit cyan from the throat, the waist band's glow and the rim lamps'
    blink, and from Rain a drizzle round it at night; its light pools. The changed land is drawn in the ground tiles
    (`drawGreen`: Calm a little cleaner, Rain damp dark earth with sprouts, Green grass, Garden deep grass with flowers and
    young trees). Wildlife (`js/wildlife.js`): a cell with a dozen Garden tiles gets deer and songbirds (`hab.garden`),
    whatever its biome. Sound: `atmosHum` (the air through it on screen; rain from stage 2) and `atmosstage`. Rivals
    (`aiAtmos`): the Steward's main project (`aiMegaMain` → 'atmos', `AI_MEGA_KIND` main) in place of Arrival City when
    `aiAtmosHome` (Planetary events on; until Nov 22 2026 also The Rust and Cinderlands, where it made the Steward the
    strongest doctrine), from `ATMOS.aiAt` (21 min), with half its Cement and
    Crystal and its Fiber in hand, near its Command Base, its 2 Generators going up beside it. The Herald (`aiAtmosBurn`):
    every `burnEvery` (120) s, up to `burnN` (2) of its Torches with full tanks go to scorch the fertile ground nearest a
    foe's Engine at Rain or more, where no gun of the foe's covers it (`P.stats.aeBurnSent`); rained out of a powered
    Engine's circle they go for a Generator feeding it (or its Reactor) instead (`P.stats.aeCutSent`). Any rival with
    an Engine at Rain and power sets its Storm Front (`aiAtmosStorm`, every `AI_STORM.think` (20) s, `aiStormSpot`,
    `aiStormScore`): a warlike one (Herald, Salvager, Warden, or any at Warlord) over the foe's guns when its next attack
    is within `AI_STORM.soon` (75) s, the Steward and the Architect over the foe's farms and crops, otherwise over the
    foe's base; it moves the storm only to a clearly better spot (`P.stormWant`). The rival AI's building
    spots no longer keep Engine-made soil free for farms. Missions: *Rain* (Growing the Colony), *Seed Vault* and
    *Under the Bloom* (First Contact), *Landing Zone* and *Overcast* (War); helpers `aeOwn`, `aeFarms`, `aeKit`, `AE_BUILT`,
    `aeStageGoal`, `aeOpenNear`; a mission's `greenWant` makes `atmosTick` count the greened share of the land
    (`atmosGreened`: stage 3 or more) in `S.mission.greenPct` and the seconds it has held (`greenRun`); Seed Vault's
    hull (`S.mission.hullX`, `hullY`) is drawn by `drawPathfinderHull`, its seed stock four crates of Fiber that never rot.
    *Overcast* (after Landing Zone): a Steward on The Rust with its Engine already at Rain (Green from Colonist) behind
    its base (`ocEngine`), its 2 Generators full and a Tanker, its storm over your Command Base; goals: break it
    (`stormBrokenFor(0)`: no foe Engine standing, or your own Engine's circle over your Command Base), hold the sky
    3, 4 or 5 minutes (`S.mission.stormCalm` makes `atmosTick` count `calmRun`, hashed and checked), and send a Storm
    Front of your own (`P.stats.storms`).
  - **The Great Uplink** (`BDEFS.gup`, `GUP`; key U; 50 Cement, 40 Alloy, 30 Chips, 24 Crystal; 200 s; 3 × 3; armor 120;
    the owner's look A, the Dish Array, Nov 2026). Only in a game with the **Great Uplink win** on (`gupWinOn`:
    `S.settings.upWin`, Megastructures on, Versus, not the Hollow; `megaBlocked` and `worldBan` say why, and the Build menu
    leaves it out otherwise). Its panel's **Begin transmission** (`gupBegin` order and function; `gupBlocked` why not;
    key T: `renderGupSection`) from `GUP.at` (25 min; at once in a mission: `gupOpen`), with `gens` (3) Generators with
    Fuel within `reach` (4) tiles (`megaGens`, `gupPower` 'gen'), each burning a Fuel every `genFuel` (30) s while it
    transmits; or a Nuclear Reactor with Uranium and `rGens` (1) Generator there (`gupReactor`, `gupPower` 'reactor'):
    `gupBurnUranium` takes a Uranium for each `uEvery` (240) s of transmission as the stretch begins (`b.gU` the seconds
    paid for; an Enriched Uranium pays for two), so a whole transmission costs 2 Uranium, a sixth of a nuke (12) on a map
    with about 24; while jammed none is burned. With both, the Generators (`b.gSrc` says which). **Stand down** (the
    `gupStop` order and function, key C) ends a transmission: its progress is lost (a transmission paused and resumed
    would dodge jamming and Fuel for free), every colony is told (`logEvent` `gupStop`); a rival never stands down. `updateGup`: `b.gT` counts up to `hold` (480) s and `gupContact` wins (`S.winner` its owner, `S.endHow`
    `'contact'`; with teams its side). An armed warbot of a foe within `jam` (3) tiles of its square (`gupJammer`,
    `b.gJam`), or no power (`b.gPow`), stops it and runs the clock back at `back` (half) speed, down to 0. Once begun it
    stays on (`b.gOn`) until contact; destroyed, the transmission is lost; taken by another colony (`b.gBy`), or played on
    past a victory (`S.endless`), it stops. Everyone is told as it begins and at `alerts` (4, 2 minutes and 30 s left:
    `gupAlert`, `b.gWarn`); `logEvent` `gup` and `contact`; `P.stats.gupTx`. Working while it transmits: it draws the
    Murmur (`murmurPower`, `chargeWorth` 3). Saved with the building (`gOn`, `gT`, `gBy`, `gJam`, `gPow`, `gWarn`,
    `gBest`, `gU`, `gSrc`), checked by `checkSave`; `hashState` covers them. **The banner** (`updateGupCard`, `#gup-card`): for every
    colony and in Observer mode, the sender's callsign and colour, "transmitting · contact in m:ss", a bar, JAMMED or NO
    POWER; tap to look at it (`gupLive` orders them). **The end screen**: *Contact!*, and under it what answered,
    `GUP_ANSWER` ("Signal acknowledged. Source unidentified. Further instructions to follow."), for winner and loser
    alike; Observer mode's end and the game report (the deciding moment) say so too. Art: `renderer/b/gup.js`
    (`tools/render_gup.sh`, `tools/install_gup.py`): `gup@T` and `gup-down@T` (below 30%) at every time of day, framed
    as the Lance (`GUP_FRAME`); in code (`drawGupSignals`, from `GUP_MARKS`): red rim lights blinking at night; while it
    transmits a glow in its owner's colour swelling in the bowl each `GUP.pulse` (2.4) s (`gupPhase`, on the game's
    clock), a pale beam rising up the screen from the feed horn with the pulse climbing it, a ring spreading over the
    ground; jammed, all of it flickering and broken in red; without power a slow red blink. On the minimap, rings pulsing
    out from it. Sound (`js/audio.js`): `gupbegin` (heard by all), `guppulse` (its slow pulse, with it on screen), in the
    last `echo` (20) s with the Murmur in the game `gupecho` (the ground repeating it back), and at contact `gupSilence`:
    the music falls silent, then one answering tone (`gupanswer`).
  - **The Sundering Ray** (`BDEFS.sunder`, `SUNDER`; key Y, short name Ray; 50 Cement, 30 Alloy, 12 Chips, 8 Crystal;
    240 s; 3 × 3; armor 90; from `SUNDER.at`, 18 minutes, at once in a mission, `sunderOpen`; everywhere, the Hollow
    too). The owner's look B from the design sheet (the Piston Battery; drawn on the sheet as the Seismic Lance, renamed
    Nov 21 2026) as the owner's plan in IDEAS.md has it: a phased array, three hydraulic rams in a concrete block round a
    bore tower over a shot hole, and six ram plates in the ground. Its panel's **Strike the Deep** (F) and **Quake** (Q),
    then a tap (the `sunderAim` order with the blow, `setSunderAim`; `sunderStop` stands it down, the blow lost;
    `sunderReactor` its Use Reactor switch, `b.sUseR`). It winds up `charge` (60) s on `gens` (2) Generators with Fuel
    within `reach` (4) tiles, burning a Fuel every `genFuel` (30) s each, or `reactorCharge` (40) s on a Reactor with
    `uranium` (1) Uranium or an Enriched Uranium, taken as it starts (`sunderPower`, `sunderReactor`, `sunderTime`); lose
    the power and the blow is lost (`sunderStillPowered`). Then `reload` (300) s, `reactorReload` (240) on a Reactor.
    State on the building: `sMode` ('deep' or 'quake'), `sAim`, `sOn`, `sCharge`, `sTime`, `sSrc`, `sReactor`, `sReload`,
    `sShot`, `sLure`. A Quake's aim is fixed for the last `warn` (20) s, when its ring shows for everyone
    (`sunderLocked`); a Quake reaches `range` (30) tiles from the middle of the square, Strike the Deep anywhere but only
    with the Murmur on (`sunderDeepOn`: greyed out on Argos). The blow is a ripple (`sunderFire`, S.sunders: `{ id, o,
    b, m, x0, y0, x1, y1, t, at, f, done }`) running `speed` (10) tiles a second, between `travelMin` (1.5) and
    `travelMax` (6) s on the way, caving in the tunnels a tile either side of its path as it goes
    (`updateSunderWaves`), and landing at `at` (`sunderLand`): every tunnel in its circle caves in (`sunderCave`; the
    nests' own tiles stay, `sunderRoot`), every exit in it collapses. **Strike the Deep** (`deep`, 16 tiles): the circle
    is sealed (`S.mur.seal`, `{ x, y, r, n }`, through night n + `sealNights` (2): `sunderSealed` in `murmurOpenExit`),
    every nest in it loses `nestHit` (a third) of its full armor, never below 1, and sends no raid the next night
    (`b.sQuiet`, skipped by `murmurWave` and `murmurCraftWave`), a Sapper underground in it dies. **Quake** (`quake`, 5
    tiles): every colony building in it (whosever; not on a Trade Post's ground) loses `dmg` (40%) of its full armor,
    never below `floor` (10%) of it (a Command Base or Keep `baseDmg`, 20%), and its foundations crack (`b.crack`: it
    works at `crackWork` (half) speed, in `produce` and the gatherers, until repaired to full; a Wall or Gate takes
    `wallTakes` (2) times the damage, `hitBuilding`); roads and track crack (`S.crk`, a sparse layer like War scars',
    `S.crkN` of them: robots on them at `crackSpeed`, half, `sunderPace` in `speedMul`) until a Worker mends them (the
    dispatcher's step 1c, `sunderMendSpots`, the `mend` task, `doMend`: `mend` (4) s a 3 × 3 patch); robots there are
    stunned `stun` (4) s (`u.stunT`: no moving, no firing), unhurt; aircraft untouched. Nothing calls `domeCatch`: a Shield
    Dome doesn't stop it. In the Hollow each blow brings `rocks` (3) rocks down from the roof inside its circle (the
    tremors' `S.tremor.rock`, a few seconds on). Winding up draws the Murmur like the Lance's charge (`chargeWorth`,
    `murmurPower`); after a blow `b.sLure` is the next night, when every nest within `lure` (40) tiles sends its packs at
    it first (`sunderLure`), `packMul` (1.5) times bigger on Active, as ever on Quiet (`sunderPack`), and its owner is told
    at nightfall. Saved and in `hashState`; `checkSave` checks it all; an older save has none. The art
    (`renderer/b/sunder.js`, `tools/render_sunder.sh`, `tools/install_sunder.py`): the pad and block with the bore tower
    (`sunder@T`), two construction stages (`sunder-site1@T`, `sunder-site2@T`: the footing and shot-hole rig, then the
    block cast and the tower in scaffolding, `drawSunderSite`), and its moving parts each on the same frame
    (`SUNDER_FRAME`): the rams at three heights (`sunder-ram-w|e-0..2`) and the plates seated or raised
    (`sunder-plate-K-0|1`). In code (`js/render.js`, the Sundering Ray, from `SUNDER_MARKS`): winding up, the rams pump
    in turn and the plates drum down the row, faster as it nears the blow (`sunderAnim`, `sunderPhase`), dust off the
    plates, the shot hole glowing, the stacks breathing orange smoke; the blow's flash and the plates slamming in a
    ripple, the far side from the aim first (`sunderOrder`); the ripple's bulge running through the ground with dust and
    a line of cracks behind it, the heave on landing, the cracks spreading through the circle and fading over `scar`
    (300) s (`drawSunderGround`), cracked roads, the Quake's ring (for everyone in its last 20 s; its own side sees the
    aim all the way), cracks on cracked buildings and sparks round stunned robots (`drawSunderAir`); aiming draws the
    circle, a Quake's reach and the tunnels it would cave in (`drawSunderAim`). Sound (`js/audio.js`): `sundercharge`,
    `sunderthud` at every stroke of its rams (heard by everyone, in time with them), `sunderfire`, `sunderquake`.
    Flavor: "Piling rig for the arrival district’s foundations. Something under the district keeps time with it."
    Mission: First Contact's *Something Keeps Time*.
  - **Seizing megastructures** (`MEGA` in `js/defs.js`; the owner's call, Nov 24 2026). Robots that beat one to 0
    (`hitBuilding`: shots, Torches, Arc Casters, Railgunners) don't wreck it: `megaDown` knocks it out (`b.mDown`, armor
    held at 0, its owner kept on paper). Dark (`megaDark`: knocked out, or seized and offline), `updateBuilding` runs
    `megaDarkStep` instead of its work, `ownB` refuses its owner's orders (aim, call, transmit, pause, dismantle, repair),
    the start checks refuse too (`lanceBlocked`, `sunderBlocked`, `gupBlocked`, `liftCallWhy`, `atmosStormBlocked`, for
    the rivals' direct calls), `requestRepair`, `demolish` and Nanite Repair skip it, a Dome is down, an Engine's circle is
    no one's (`atmosHolds`: `p` -1) and Overcast's storm counts as broken (`stormBrokenFor`). `megaReset` loses what it was
    gathering (the Lance's and Ray's charge and aim, the Uplink's transmission, the Lift's climber, boost and restock list,
    the Dome's warm-up and Crystal burning, the Deep Core's Fuel and part-made goods, the Engine's Fuel, Uranium, wither and
    seed clocks and its storm, the City's Fuel) and keeps what it built up (`dcT`/`dcStage`, `aeT`/`aeStage`/`aeP`, the
    Lift's reserve and reload). **Seize clock** (`megaSeize`): armed army robots of one side (not aloft, not inside) within
    `reach` (3) tiles of its walls (`footDist`) and none of a foe's fill `b.mCap` toward `cap` (40) s for `b.mBy`; contested,
    it stops; empty, it runs back `decay` times as fast; a new side starts from 0 (its owner is told). Robots sent to attack
    it stop shooting and stand within reach (`strikeBuilding`: `megaHeldBy`), so an attack or a flag on it holds it. While they seize it, the owner gets a seize warning instead of repeated attack alerts.
    **Seized** (`megaSeized`; its old owner too, retaking it): owner, `noteLost`, `P.stats.captured` and `megaSeized`
    (`cities` for a City), `logEvent` `megaTaken` (`city` for a City), territory and roads redone; offline (`b.mOff`) at
    `armor` (25%) of its armor owing `b.mNeed` = `fee` (a quarter) of its build cost (`megaFee`, rounded up). `needsOf`
    asks Haulers for it; `megaCommission` takes what reaches its stock off the bill; paid (`b.mReady`) it sets `fixLeft` to
    mend it to `online` (50%) of its armor (at least 5 s of work), dispatch's repair step sends a Worker, and `doFix`
    finishing calls `megaOnline` (a Dome warms up again; `logEvent` `megaOn`). **Demolish it** (ORDERS.`megaWreck`,
    `megaWreckOrder`: `b.mWreck`, a bit per colony; not Arrival City): that colony's robots knock it out and shoot on,
    `wreck` (half) of its armor more in `b.mWr`, then `captureBuilding` destroys it, adding `salvage` (a quarter) of its
    build cost to what spills in crates (`dropLoot`). Missiles, nukes, bombs, napalm, Howitzer shells, fuel blasts and the
    Lance's shot destroy one as before (a City: knocked out). The panel (`megaParts` in `js/ui.js`): Knocked out (who is
    seizing it, how long left) or Bring it online (what it still needs), and an enemy one's **Demolish it** / **Seize it
    instead** (`sh-mwreck`, key D); the map (`drawMegaDark` in `js/render.js`) veils it dark, rings its seize reach dashed
    and fills the ring in the seizer's colour with their flag, and blinks an amber lamp while it's knocked out or offline;
    its night lights stay out meanwhile (`megaOut`: `drawMegaArt` draws its graded day art, not its lit night art; no
    `megaNight` layer, pools, beacons or Lift cable lights) and come on again once it's back online. The rivals
    (`aiMegaHold`, `AI_SEIZE` in `js/ai.js`): every 5 s a rival without a seize band out sends one (its own: at least 4
    armed; a foe's within 45 tiles of its base, not ordered wrecked: at least 6, and two for each foe's armed robot within
    8 tiles) under a flag by its walls, called home once it's taken or after 3 minutes; a march near a knocked-out one it is
    seizing stays that much longer (`aiSeizing`); a Lift it marches on for its fall it orders wrecked. A rival plans a
    road to a seized megastructure ahead of ordinary sites when it can afford one, and gives the commissioning fee
    High delivery priority until it is paid. `hashState` covers the seize state. Test: `node tools/mega-seize-test.js`.
  - **The cap on the rivals** (`AI_MEGA_CAP`, `AI_MEGA_KIND`, `aiMegaProjects`, `aiMegaRoom`): a rival builds at most
    one weapon (the Lance, the nukes or the Sundering Ray: the `megaPick` choice counts as the one) and two megastructures in all; a
    Shield Dome (`shield`) never counts, nor does a Deep Core (`aiDeep`, above); the Atmosphere Engine is a main project (`aiAtmos`, above). Its main project is `AI_MEGA_MAIN` by doctrine (Arrival City for the Architect, once its first Silo stands or
    from 18 minutes (`aiMissileFirst`), and the Steward; the Orbital Lift for the Warden, and the Herald from `AI_MEGA.heraldLift`, 19 min; none for the
    Salvager; Arrival City for all in Domination: `aiMegaMain`). `aiLift` places the Lift from `AI_MEGA.liftAt` (15 min)
    once it has a Bot Foundry and half its Cement and Crystal (`aiLiftFunds`), with its line over the fewest of its own
    buildings, toward open ground, never its Command Base (`aiLiftSpot`), and keeps its other buildings off that line
    (`aiOnLiftLine`, in `canPlace`). Built, `aiLiftUse` calls a Security detail when attacked or before a push, Alloy or
    Chips when short (`liftShort`), keeping the last drop for an attack, and sends up what it holds more than `liftSpare`
    (60) of. The Salvager (`aiLiftAmbush`) sends `ambush` warbots to wait at a foe's anchor once a climber starts down.
    `aiMarch` goes for a foe's Lift when its fall would crush enough of the foe's (`aiLiftWorth` ≥ `liftWorth`). With the
    Great Uplink win on, the Steward's main project is the Great Uplink (`aiMegaMain`, `AI_MEGA_KIND.gup` 'main'): `aiGup`
    places it from `AI_MEGA.gupAt` (22 min) once it has a Bot Foundry and half its Cement and Crystal (`aiGupFunds`), near
    its Command Base on the side away from its rival (`aiMegaSpot`), its 3 Generators beside the site at once (their goods first, again as any is lost), and begins
    transmitting once it may with `gupGuard` (6) armed warbots within 14 tiles (`aiArmyNear`). A foe's transmission is
    every rival's first target: `rivalOf` returns the colony furthest along (`gupFoeLive`), `aiJamGup` sends all it can spare,
    garrisons too as for a storm (up to 30), to a flag within 3 tiles of it every `gupJam` (45) s while none is there or on the way (its first target the nearest gun,
    then the Uplink), `aiMarch` takes it as a march target scored 30 better, Missiles score it 40 more, a bomber 30, and
    the Lance weighs a line through it at 14 (`aiLanceWorth`). `aiCity`
    places it from `AI_MEGA.cityAt` (12 min) once it has a Bot Foundry and half the City's Cement and Fiber
    (`aiCityFunds`: its Alloy and Chips never pile up), where its reach covers the most of its factories and gatherers
    near its Command Base (`aiCitySpot`), its site first for goods (`prio` 'high'), never given up. `aiMarch` treats a
    foe's City as a march target like a fort (scored 2 better, 6 in Domination: the prize), its flag going for the City.
  - **Uranium for the late game** (`aiUranium`, `AI_MEGA.reactorAt`, `uReach`): from 13 minutes in a Nuclear race, a
    rival with no Ore Mine on a Uranium deposit and less than 2 Uranium in hand puts a Mine on the deposit nearest its
    Command Base that its land reaches (or an Outpost by the nearest unclaimed one first), every 20 s while it finds
    none; the Mine digs the Uranium first. From then on, with Uranium in hand (or a Mine on a deposit) and no Reactor,
    the Reactor goes first in its plan, past the usual limit on sites (`reactorFirst` in `aiThink`). (Before, the
    Reactor sat tenth in the plan and waited behind every Outpost, Mine and Harvester the colony wanted, with its price
    in hand: in long games both rivals held Uranium from 10 minutes on and never built one, so the choice below almost
    never came up.)
  - **The rivals** (`aiMega` in `js/ai.js`, `AI_MEGA`): from `lanceAt` (15 min; it was 25, then 18, and most games were over by then), in a Nuclear race, with a Reactor
    and Uranium to feed it, a rival picks once (`aiMegaPick`, `P.megaPick`, the reasons in `P.megaWhy`) between the
    Lance and the nukes: its doctrine's lean (`AI_MEGA_LEAN`: Architect +2, Warden +1, Steward 0, Salvager −1, Herald
    −2), +1 for the Lance when its enemy's buildings lie strung out (the best line through them takes 2 or more more than
    the best blast), −1 when they're bunched, +1 when the enemy has a Shield Dome (it swallows a nuke whole), +1 when
    Uranium is scarce (a nuke takes 12, a shot 2); above 0 the Lance (no Nuclear Silo then), else the nukes. The Lance
    only with half its cost in hand (`aiHalfway`; the owner's call of Nov 22 2026: chosen without it, 28 rivals in 160
    games gave up their Silo for a Lance none of them placed): short of that it doesn't choose yet (looked at again every
    `look`, 20 s) and its Nuclear Silo plan goes on, and once a Nuclear Silo stands or is going up it's the nukes. Its Lance
    goes within reach of its Reactor, on the enemy's side of it so its own buildings stay off its lines (`aiMegaSpot`;
    with no room there, on open ground near its Command Base, a Reactor following beside it), and fires along the line through a foe building worth the most
    (`aiLanceWorth`: its foes' buildings and army in the core, 0.3 of that for those only in the scorched edge, its own side's six times over, 5 for dropping a foe's Dome), if worth
    `worth` (6). The Sundering Ray (`aiSunder`, `AI_SUNDER`, kind 'weapon' in `AI_MEGA_KIND`): a Warden picks it as its
    one weapon (`P.megaPick` 'sunder', then no Nuclear Silo) from `pickAt` (15 min), with half its cost in hand and no
    Nuclear Silo of its own standing or going up (as the Lance, since Nov 22 2026), when the Murmur are Active and a
    nest's tunnels reach within `near` (12) tiles of its Command Base (`aiTunnelNear`); it goes up near home
    (`aiMegaSpot`, its goods first) with its 2 Generators going down with the site (again as any is lost), Use Reactor
    off. By day, after a night the Murmur raided it (or with their tunnels that close, or every `every` (2) nights while
    that nest is within 40 tiles of home: `P.sunderNight`), it strikes the deep over the nest closest to home; the night after a blow it keeps `guard` (6) warbots at the Ray (a rally); any rival with a Ray Quakes the spot
    worth the most within reach (`aiQuakeSpot`: a foe's buildings, defences and roads in the circle, its own side's
    taken off, at least `worth` 5) when its next attack is due within the wind-up, so its army arrives while the Walls
    are cracked. From `domeAt`
    (17 min), or at once against a Lance going up, a rival threatened from afar (a Lance, a Missile or Nuclear Silo, an
    Airfield or bombers) puts up a Shield Dome by a Generator nearest its Command Base (a Generator first if it has none),
    once it has half of either one's cost in hand (`aiHalfway`: the site fills as the rest comes in, and is never given
    up); its
    Missiles and nukes pass over targets under a foe's Dome (`aiDomed`).
- **Pace:** the whole game runs at 85% speed (`GAME_PACE` in `js/defs.js`) for a calmer feel; the speed button
  gives 2× and 3×.
- **Ordering bots:** the Bot Foundry only builds the bots you order. Tap it and use +1 or +5 for Workers or
  Warbots (Clear cancels the queue); with nothing queued it sits idle and uses no Alloy or Chips.
- The **Build** menu shows how many of each building you already have, and how many are being built.
- **Demolishing** returns half a building's materials straight to the nearest other storage; anything inside it (a
  Silo's Missiles, a Nuclear Silo's finished missile as its parts, a Depot's whole stock) spills out in crates for the
  Haulers to collect.
- **Land is influence** (`computeTerritory`): military buildings claim their ring (BDEFS `terr`: Command Base 8,
  Outpost 7, Keep 6), every other finished building `CIV_CLAIM` (2) tiles round itself (`civClaims`), and a military
  claim outranks the small ones. You build on your own land or on no-one's within `BUILD_REACH` (10) 8-way steps of
  your buildings, roads or track (`reachMap`, `inReach`, `landRule`), never on a rival's; defences (`DEFENCE_TYPES`)
  only on your own land. Roads, track and pipes run on any ground no rival holds that your bots can reach
  (`reachZone`); roads and track have their own owner (`S.wown`, read through `wayOwner`), so raids, missiles,
  creatures, paving and junctions go by who laid them, not whose land they're on.
- **Warbots march in single file** on roads (`queueRoom`, `WARBOT_GAP`): a warbot on the march falls in behind the next
  warbot of its side in its lane (never behind a truck, nor one that's fighting or breaking down a Gate) and spreads out
  for its last `WARBOT_SPREAD` tiles; off-road tiles cost `WARBOT_OFFROAD` times more when it plans a route, so squads
  keep to the roads. Other traffic still never queues behind a warbot.
- **Rail Stations** can go up before any track: a rail drag over your own station skips its tile, so dragging from one
  station to another lays track that ends beside each.
- **Cut off** (`cutOff`, `crumble`): a finished building whose ground a rival's ring takes stops working (nothing is
  hauled to it, its worker leaves) and loses `armor / CUT_CRUMBLE` (90 s) a second until it's lost (`dropLoot`); it
  recovers if its owner takes the land back. A construction site on a rival's ground is lost at once. A land-claiming
  building can't go where its ring would cover a rival's ordinary building (`ringOverRival`; a Drop Outpost dropped, a
  Port a Ferry founds and a Crawler deploying too): cut-offs come from capture or a fort falling. The AI builds on its own land first and on open ground only when it has no spot at home.
- **Salvage:** a colony out of Stone or Fiber with no Quarry or Harvester that can still work salvages 1 every 20 s from
  its Command Base (up to 6), so it can always rebuild. Meanwhile, in a person's colony with a Quarry or Harvester
  site waiting that a road joins to storage (`P.salvaging`), that good goes only to sites, not to finished buildings (a
  running Smelter would burn the Fiber meant for the Harvester site). Not for a rival, which has its own Fiber rules:
  behind a Harvester site that never got built its Smelters went without for good. Capturing an enemy Outpost takes its land,
  and enemy buildings its ring now covers are cut off (see above).
- **Controls:** drag to pan, pinch or scroll to zoom, tap anything to inspect it. Wheel deltas are normalised and capped
  per event (smooth on a Magic Mouse or trackpad); a Ctrl + wheel pinch zooms faster, a sideways swipe or Shift + wheel
  pans, and Safari's trackpad pinch (`gesture*` events) zooms the map instead of the page. Drawing resolution is capped
  at `RENDER_BUDGET` pixels (about 4K; a 5K iMac at 2× would be four times the work) and `watchFrameRate` lowers it,
  down to 1×, if frames run below ~45 a second and drawing is what's slow (not when the screen or a power-saving mode
  holds a steady beat, such as 30 a second, nor when the simulation is the slow part), and raises it again when there's
  room; the minimap is laid out again whenever it changes. Nothing is drawn under a full screen (the pause menu, Help,
  Statistics, Send feedback, game over) while the game behind it stands still, unless the view, the canvas or the art changes
  (`drawNeeded` in js/main.js), and the demo behind the main menu is drawn 30 times a second (`DEMO_FRAME`).
- **Graphics** (a device setting: `setGfxStep` and the `GFX_LEVELS` table in js/render.js; the pause menu and Custom
  Game's Rules; kept in `localStorage` as `terrafall.graphics`, read once before the first resize, never in the game or
  an order). **Auto**, the default, is all of the above unchanged. **Saver** draws at 1×, runs at most 30 frames a
  second (`frame` in js/main.js), halves sparks, embers, smoke puffs and weather specks (`fxCount`, `wxCount`), and
  drops the city haze and the roads' wide glow at night (the pools under buildings and the road lines stay), and the
  heavier touches of `js/nature.js` (swaying plants, wind in the grass, frost, the aurora, the far-zoom tilt). **High**
  lifts the pixel budget to 21 million (a 6K screen at 2×), switches to the sharper ground chunks as soon as the coarser
  ones would be stretched (`hdLevel`), keeps twice the chunk memory, and draws 1.5× the sparks and smoke. **Ultra**
  draws at the screen's full `devicePixelRatio` (budget 36 million), with twice the effects and weather, a finer city
  haze and robots carrying a light in their colour at night (`drawUnitLights`). On High and Ultra `watchFrameRate` steps
  down once most frames of 1.5 s have been slow (instead of after 120 frames), two steps at once under 25 frames a
  second, and counts frames of up to a second (Auto takes one over 250 ms for a hitch, so a picture too big to draw four
  times a second was never brought down); it climbs back no higher than the step allows.
- **Phones and tablets (touch):** a touch on the map is only ever a touch there: the click a browser makes after it
  is cancelled (`initInput`), so the tap that opens a panel can't also press a button that appears under the finger,
  and a tap on a tile beside a button doesn't press the button. Where panels open across the bottom of the screen
  they open at **half height** (`setSheetSize`), with the goal card out of the way, and the map glides so that what the
  panel is about sits in view above it (`sheetMoved`; the map may scroll further up past its last row for this,
  `R.lift`). Under a finger (`pointer: coarse` in style.css) every button, choice, switch, stepper and slider in a game
  is at least 44 px to press (the goods counters stay 32 px high, so their two rows don't take more off the map), and no
  text in a game is under 12 px. The **grab handle** at the top of the panel drags it to full height, to half, or down to just its title
  strip (further down closes it); a tap on the handle swaps half and full. The Build list, Goods and Your robots open
  at full height, which stops below the goods and the clock. The panel's body scrolls; its handle and close button
  stay put.
- **A phone on its side** (`(orientation: landscape) and (max-height: 519px)` in style.css) has its own layout: the
  goods in one row across the top, the tools as a **rail down the left edge**, panels as a **column down the right**
  (as tall as the screen allows, so no grab handle; the map glides to bring the panel's subject out from under it), a
  mode's banner and the selection bar as a box at the bottom left beside the rail, and only the newest message, at the
  bottom right. The minimap is sized from the short side (`layoutMinimap`: 84 px there, where it got the desktop's 156
  and filled two thirds of the height), and a new game opens at a zoom that fits the short side (`enterGame`).
- **How to play on a touch screen** (`helpForTouch`): the Touch controls card (`#h-touch`) heads the contents page,
  on one screen, and key names are left out (the mouse and keyboard paragraphs and brackets that only name keys are
  marked `.keys` once at start-up, before the section pager is built, by `helpMarkKeys`, and hidden under
  `(pointer: coarse)`).
- **Messages and the goal card** (`toast`, `openMsgSheet`): a message stays for a time that fits its length (3.8 s up
  to 12; a building lost, 8 at least), lets taps through to the map, and has a **Go** chip when it's about a place. The
  last 20 are kept for the messages button beside the folded goal card. On a small screen the goal card folds by
  itself at the first tap on the map and opens again for each new step (unless you fold or open it yourself); folded
  it still counts buildings with no road. In free play the Build list pins the building the step asks for at the top
  (`OBJECTIVES[].build`, `nextBuilds`), and a building with no road to storage has Lay road at the top of its panel.
- **Colony goals, Records and achievements** (`js/goals.js`; display and device only: nothing there changes `S` or
  sends an order, so the save and the lockstep are untouched). `metaTick` (from `uiTick`, once a second of real time)
  reads the game. **Colony goals** (`COLONY_GOALS`, Colony free play): about 16 optional goals in four tiers
  (`GOAL_TIERS`: Groundwork, Long hauls, Across the planet, Accord scale), each counted from `S` by its own `count(P)`
  (a traffic light or overpass, a pipeline joining two buildings, a Generator, a Depot with supply orders, a Research Lab
  upgrade; 30 tiles of asphalt, a Road Train, a Freight Train, a run on a Trade Terminal's route, a Murmur nest; a Ropeway, a
  Viaduct, a Port and a Container Ship, a Cargo Plane delivery, goods flown along an Airship line; goods moved by Maglev pod, three Freight Trains at once, 100 Alloy a minute
  (`goodRates`), 100 robots, every upgrade), with `when` leaving out the ones the planet can't offer (`navalMap`, no
  cliffs, a Cargo Plane in the Hollow, no Murmur, no Trade Posts). A goal met stays met: its flag goes in this game's entry in `terrafall.games`
  (localStorage, `metaStart`: a new game gets an entry keyed by its seed and the time it started on this device; a
  loaded save finds the newest entry for its seed and mode that isn't further on than the save, so goals met before a
  save stay met, and those met before a load bring no second message). The goals button beside the Goal card
  (`#btn-goals`, `goalsHUD`) opens the panel (`openGoalsSheet`, sheet kind `'goals'`): the land milestones, then each
  goal with its count, a hint and a button (`goalAction`: **Show** goes to the nearest building of `at` and opens its
  panel, else the `paths` tool opens, else the Build list on the `build` building's tab with its card ringed). A goal
  met brings a message and a flash of the button. **Records** (`terrafall.records`, `metaRecordsTick`, `metaGameOver`):
  fastest win per map type and rival level, most robots, most buildings (not Walls, Gates or Ramps), longest game and
  most land held, from single-player Versus and Colony games (`metaCounts`: no mission, no multiplayer, no autopilot,
  and never Boosts, rival bans or Unlimited resources at any point, `metaAssisted`). The end screen (`#o-meta`) lists
  the records a game beat (one it set where there was none isn't news, except a first win on a map type and level) and
  the achievements it earned. **Achievements** (`ACHIEVEMENTS`, 32, `terrafall.achievements`): victories from the
  result (a win; on Hard; by Domination; on the Uplinks; a free-for-all; on every map type; each doctrine beaten at
  Medium or harder, and all five; no Pulse Turret site placed, Normal or Hard; **Full escort**, a rival Command Base
  taken with `STORM_MIN` (20) of your armed robots within `STORM_R` of it, counted each second before it fell,
  `metaStormTick`), deeds from any game played without help, multiplayer and missions too (`metaDeeds`: the first
  Ropeway and Freight Train, a nest cleared, every upgrade, the last Colony milestone, every Colony goal), and the
  missions (`metaCampaign`, from `loadCampaign`), and nine for **Horde** (any Horde game without help, alone or co-op:
  `metaHordeTick` once a second, 10 waves cleared, waves 15 and 25 in Endless, and each wave watched from its launch,
  `META.hw`, for a boss wave cleared with no building lost, `stats.lostBld`, or with no army robot up; `metaHordeOver` at
  the end, a Fixed win, Commander or harder, the Maw wrecked, a co-op win). The Records screen's **Horde** table: the
  Endless best wave per level (`terrafall.hordeBest`, co-op's under `coop`) and the fastest Fixed win (`R0.horde`,
  `R0.hordeCoop`). Earned in a game they pop up as a message. **Records** in the main
  menu's **More** (`#m-records` opens `#screen-records`, `openRecords`) shows them all; an earned achievement with
  `lore` has a button that opens the Lore guide on that page (`openLore(id)`). **Forget records and achievements**
  (two taps) clears both. Challenge modifiers don't stop a game counting: records keep the ones on (`mods`, `metaMods`)
  and achievements too (`_mods` in `terrafall.achievements`), both marked ◆ on the Records screen; a win with some on
  earns each one's **challenge badge** (`R0.mods[k]`: wins and the hardest rival, `metaModBadges`, its own row on the
  Records screen and ◆ on the planet card), and a win with a `pace` modifier (Fragile robots) isn't a fastest win.
- **Back and the screen** (`initBack`, `syncWakeLock`): in a game a phone's (or the browser's) Back button steps back
  like Esc instead of leaving the page: it closes the start-of-game card, a screen, a panel or a mode, clears the
  selection, and with nothing open brings up the pause menu (a history entry is added on entering a game and put back
  each time Back takes it; leaving for the main menu removes it). The screen is kept awake (`navigator.wakeLock`) while
  a game runs, and let go when it's paused, over, left or hidden. A long press brings up no browser menu.
- **Warbots by touch** (`touchSelect`, `touchOrder` in js/ui.js): tap one of your warbots or Howitzers to select it
  (tap it again within half a second for all of its kind in view). The selection bar (docked across the bottom in
  place of the tools on an upright phone) says what they're doing and has two rows of buttons that fit without
  scrolling: **All in view**, **Whole army**, **Box** and **Info**, then **Undo**, **Recycle** and **Save as group**
  (where the bar is under 380 px wide a few words go: Recycle 6, Save group 1, Tap again); while it shows, a tap on the map is the order a right-click gives, with a ring and
  **Undo** for 4 seconds (`ORDER_UNDO`; the `undoCommand` order sends each back to what it was doing). A drag or a
  pinch is never an order. **Box** (or a finger held still 350 ms, `LONG_PRESS` in js/input.js, then dragged, where
  you have warbots out) draws a selection box. With a panel open the bar steps aside and taps inspect.
- **Buildings on number keys** (`bldGroups`, `S.bgroups` { key: building id }, beside the robots' `S.groups`): with no
  robots selected and a building of yours open, Ctrl/⌘/Shift + 1–9 (Alt only for 7–9: Alt + 1–6 is the Army Groups') (`saveGroup`) puts it on that key; the key
  (`recallGroup`) opens its panel, twice to jump to it, and the group bar shows it as a chip. A key holds a group of
  robots or one building, and a building one key; both are kept through a multiplayer catch-up (`snap` in js/lockstep.js).
- **Vibration** (`haptic` in js/input.js): under a finger, on a device that can vibrate (`navigator.vibrate`), a short
  buzz says an order went through (a tap-to-order with warbots selected or in the Army banner, a building, Viaduct or
  Ropeway placed, a Paths plan built, Lay road) and marks a warning or alarm from the game (at most one every 2.5 s).
  **Vibration** in the pause menu (shown only on a touch screen that can vibrate) switches it off; it is kept on this
  device (`botfall.haptics`), on by default.
- **The pause menu** (`#screen-pause`; Space, Esc or the button top right): two views in one card (`pauseView` in
  js/ui.js), and it opens on the first each time. The main view: **Resume** and **Plan while paused** (in multiplayer
  **Back to the game**, and **Pause the game for everyone** beside it, with no Plan while paused), a grid of **Settings**, **Statistics**, **Photo mode** and **How to play**,
  the saves under a **Save** label (**This planet**, **File** and **Cloud**: Save this planet, Download save file and
  Save to the cloud, their full names in `aria-label` and `title`), the line on when the game last saved, then
  **Feedback** and **Save & quit**. **Settings** (`#p-setview`; **Back** or Esc returns, and the focus goes to Back on
  the way in and to Settings on the way out): the Music, Effects and Ambience sliders, **Graphics**, a switch each
  (`role="switch"`, `pauseSwitch`) for Voice lines (`#p-voice`, js/voice.js), Full screen, Weather, Scout reports and Vibration where they apply on the device,
  and **Time of day** as a Cycle / Day / Night radio group (Day locked with the Murmur, Cycle and Day on an
  always-night map, with the line under it saying why). A goal's `ui` selector for a pause-menu button lights the
  pause button while the menu is shut, and Settings or Back for a button in the other view (`COACH_OPENERS`). It fits
  without scrolling at 390×664, 844×390 (laid out wider there, Settings in two columns) and on a computer. Settings
  also has **Menu background** (Classic / Planet: see The main menu under Looks). **From the main menu**: the
  **Settings** button (`#m-settings`, a gear, in the bottom row with How to play, Lore, Feedback and More) opens the same view on its own
  over the menu (`openMenuSettings`: `#screen-pause.from-menu`, in the menu's colours); every setting there is a device
  setting, so all apply. **Back** or Esc closes it (`closeMenuSettings`) and the focus returns to the button.
- **Plan while paused** (single player, missions and Contingency battles included; `planPause` in js/ui.js): the pause
  menu's **Plan while paused** (`#p-plan`, hidden in multiplayer and Observer by `mpSyncPauseMenu`), or **Shift+Space**
  (or the **Pause** key) on the map, shuts the menu and leaves `UI.paused` on with `UI.plan` set, so the simulation,
  the clock and time of day stand still while the map takes input: `uiFrozen()` (paused and not planning) is what
  `onMapTap`, `onMapCommand`, `fieldUnits`, the cursor and the reach rings check now. A banner across the top
  (`#plan-banner`: **Paused**, **Menu**, **Resume**; `syncPlanBanner` every frame) and an amber pause button
  (`body.plan-paused`) show it. Orders are applied at once as always in single player (`act`), so a placed site, a
  planned road or a warbot order is in `S` straight away: the next placement's preview and blocked tiles see it, saves
  and restore points keep it, and Haulers and Workers set off when the game resumes (nothing is queued, so lockstep,
  `hashState` and saves are untouched). **Space**, **Resume** on the banner or in the menu resume (clearing `UI.plan`);
  **Esc** steps back and, with nothing open, opens the pause menu. While planning in a mission, a site placed or a road
  laid sets `S.mission.planned`, which the Hot Metal goal *Place a building while paused* counts.
- **Game speed:** the speed chip in the top bar opens 0.75×, 0.875×, 1×, 2× and 3×.
- **Sound** (`js/audio.js`, all Web Audio, no audio files): a generative synthwave score that follows the game (menu,
  building, war when you're attacked or fighting, **Night Murmurs** when the Murmur come close (`MUSIC_MURMUR` (2) of them
  in your land or within `MUSIC_MURMUR_NEAR` (9) tiles of your buildings, lingering 35 s; enemy robots in your land too
  still bring the war music: 70 bpm Phrygian, a whispering choir of filtered noise pitched on the chord (`mWhisper`), a
  slow heartbeat, a bass creeping a semitone, far-off crystal glints; it never cuts in: the theme playing fades out over
  `MUSIC_FADE_OUT` 3 s and Night Murmurs swells in from silence over `MUSIC_FADE_IN` 9 s, and the same back at dawn,
  `musicFades`, `musicRamp`; war, the nuke alarm and the end still cut in at once), and an alarm while a nuke flies; the building music takes turns between
  three themes, `BUILD_THEMES`, every `MUSIC_ROTATE` seconds of play: Lost in a Dream, the main theme (the menu music is a
  slow take on its chords), Night Drive (Dorian, octave bass,
  claps, a plucked lead) and Horizon (half-time, a chord every two bars, an arpeggio in threes)), written a bar at a time from chord
  progressions, arpeggios, bass, drums and short melodies in 8-bar sections. **The war music** takes turns between two
  themes, `WAR_THEMES` (`warTheme`): a game's first fight gets Overdrive (112 bpm Phrygian, sixteenth-note bass,
  four-on-the-floor kick, stabs, the bell lead) and each new fight (war music again after `WAR_GAP` (30) s of game time
  without it) the other one; within a fight it stays the same. **Redline** (`war2`), the second, is darker: relentless
  and threatening, the machines grinding forward. It's built on the buzzy bass, lower and dirtier (`mGrind`: two saws an
  octave under where `mBass` plays and one an octave up, driven hard into the clipper, `boomCurve`, then through a
  resonant low-pass, with a clean sine on the note, all high-passed at 45 Hz; played dry): straight eighths on a pedal,
  the key's root whatever the chords above do, but for a half step up and the tritone (`GRIND`), its filter opening
  slowly over each whole section, 200 Hz to 1.8 kHz, and shut on the next. 104 bpm, D or C♯ Phrygian, a chord every two
  bars over the pedal (the flat second, the diminished chord on the tritone); a straight, heavy drive with no swing
  (`mKickHard` four on the floor, or a pounding half-time: kick, kick, snare, kick), a dry snare with an industrial
  clank (`mClank`), tight closed hats; a low brass swell with a minor second in it (`mBrass`), dissonant stabs on the
  downbeat (`mStabD`), a droning pedal (`mDrone` on the key's root), a cold low lead now and then (`TOLL`, `mCold`: no
  vibrato, no glide), and a noise riser (`mRiser`) into a crash and an impact (`mImpact`) on each new section.
  **The campaign theme**, **The Long Silence** (`campaign`), tells the story's arc from a level (`storyLevel`, 0 to 1)
  instead of the game: `musicStory(level)` sets it (the campaign, planned in CAMPAIGN.md, would raise it chapter by
  chapter, `(mission - 1) / 14`; while set, the theme plays in a game in place of the build themes; `null` ends it), and
  until the campaign exists the **Lore guide** plays it while it's open (`musicLore` from `openLore`/`closeLore`, at
  `LORE_STORY` (0.33), the first murmur, quiet enough to read by). At each 8-bar section the level picks a stage (its
  `stages`, each standing over the theme's own settings: `moodDef`); one key, D, all through, the stages walking the
  modes from the brightest to the darkest, and the same four-bar tune (`STORY_THEME`, played in each stage's scale, so it
  darkens with them): Landfall (0; Lydian, hopeful and wide: a halo of high chords spread across the stereo, `mHalo`, the
  shimmer, the arpeggio in threes, the bell), the colony at work (0.1; Mixolydian, half-time drums), the first murmur
  (0.25; Dorian: the drums fall away, the choir comes in, a heartbeat, the Uplink's call, `mBeacon`, which the ground
  sometimes answers in its rhythm, `mThud`), Contingency (0.4; minor, the main theme's chords, drums back, the bass
  creeping a half step), the Murmur rising (0.68; Phrygian, the climax, on Redline's machinery: its straight, pounding
  drums, four on the floor or the half-time, with the dry snare and clank and tight hats, its low grind on the pedal,
  `mGrind`, under the filter opening over each section, and an impact on each new one; a drone; the tune on a gliding
  saw lead, `mSaw`) and the Silence (0.96: everything stops; suspended chords, every progression ending away from home, two lights
  left, the tune's first bar alone, the choir again, fainter and far off). Bar by bar the level also sets how much of
  the Murmur is heard: the choir grows 15 dB from 0.25 to 0.75 (an octave higher too from 0.6), glints come oftener,
  the heartbeat beats harder, the ground answers oftener, and the road lights (the `lights` arpeggio, eight a bar) go dark
  one by one (`LIGHTS_OUT`). **Now playing** (`nowPlayingTick` in js/ui.js,
  display only): on a computer (a mouse, the wide layout) a card in the bottom left corner names each theme as it starts
  (`MUSIC_TITLES`: the menu's slow take is Lost in a Dream too, the war themes Overdrive and Redline, the Murmur's Night
  Murmurs, the nuke alarm Zero Hour, the campaign theme The Long Silence (not shown over the Lore guide, a full screen), `end`
  and the end cues none) for `NP_SHOW` ms, then fades away (nothing stays in the corner between themes); a title shown in the last `NP_AGAIN` ms (a minute) isn't
  shown again, and nothing shows with the Music at 0, in photo mode, under a full screen (the main menu is fine) or where
  it would run into the tools or the menu's card (a new theme's card waits for room). Effects include radio blips for orders, a
  Pulse Turret's tesla-coil discharge (a short charge whine, then a buzzing arc crackling with sparks: `pulse`), a
  nuke siren and blast, and sounds from the map when on screen (traffic hum, louder where the moving bots bunch up in 5-tile squares, with engines
  going by, warning beeps, toots and robot chirps from the busiest squares; welding, concrete, asphalt, truck air
  brakes and horns, biome wind, jungle birds and insects). Ambience that grows with the colony (`ambienceBeds`): a
  city murmur that rises with the built-up area on screen (and a little with the colony's size; quieter at night),
  far-off horns in a big town, a soft industrial hum under working factories (it and the traffic hum wander in pitch and swell and ease, never one
  steady drone) plus their own one-shots (`WORK_SOUNDS`:
  furnaces, clanks, drills, pump thumps, beeps; the Smelter and the Bot Foundry also press, ratchet and machine), a train's diesel throb and rail clack that quickens with its speed,
  its horn as it pulls out and brakes as it slows, aircraft engines panned to where they fly, with a rival's take-off
  roll, the approach whine and the touchdown chirp, a ship's horn leaving port, the sea's wash (full on the sea maps,
  Islands, Tidal flats and Four Isles; softer on lakes and rivers) and bubbling lava. Under it
  all, **the land's own sounds** (`natureBeds`, `biomeCall`, `nightSounds`; with the wind, the night and the sea they go through a bus of
  their own, `AUDIO.natureBus`, set by the Ambience volume apart from the effects, `NATURE_LEVEL` at full): each biome's bed (`NATURE`: leaves rustling as the wind
  gusts in the forests, grass on the savanna, sand or snow hissing in the desert and at the poles, cicadas in the
  savanna's heat and insects in the forest by day, the swamp's frogs and insects by night, the Bloom's shimmer, brighter
  by night, the ashlands' ground rumbling) and calls now and then (forest birds by day and a night bird's hoot, cicadas
  and far-off calls, frogs, drips and bubbling mud, the Bloom's sliding calls and night chimes, vents hissing, sand
  skittering, wind whistling through rock and rock ticking as it cools at night, ice cracking and groaning, snow
  sliding). Both are loudest out in the wilds and fade as the view fills with a town: `WORLD.wild` is the share of the
  land on screen that isn't built on, paved or laid with track (a third built up is all town), eased so it doesn't jump;
  the calls come every few seconds in the wilds, hardly ever in the streets, more at dawn and fewer in rain or fog.
  **The night** (`nightSounds`, `NIGHT_SET`, Nov 2026): out in the wilds a cricket chorus comes in as dusk deepens (one or
  two first, the rest joining by full night), each cricket its own pitch, pulse count, chirp rate and loudness, singing
  in bouts and falling quiet, another taking its place, so it never loops; a tree cricket's soft trill under them, a
  katydid's rasp far off on the green, warm maps (Greenreach, Blackwater, the Shoals), a cicada's buzz swelling on the
  Long Grass. In the forests (Greenreach, Emberwood) and Blackwater, now and then an owl hooting, a far-off night bird
  (a three-note whistle or a nightjar's churr) and the leaves stirring; in Blackwater peepers by the water, frogs and
  the odd splash; on the Long Grass and in the Rust a few insects and a dry, gusting wind. It follows `WORLD.wild` like
  the beds, goes quiet in a fight (`WORLD.fray`: robots fighting on screen, or a blast a moment ago) and comes back over
  ten seconds or so, thins over War scars and near a nest; rain hushes the insects (the frogs call on), a sandstorm or
  gale too, fog a little. The Hollow, Argos, the poles and the Bloom keep their own nights. It costs at most
  `NIGHT_VOICES` steady voices (made when a night first comes, let go after half a minute of day, their gates
  scheduled a moment ahead on the audio clock) and `NIGHT_SHOTS` calls at once; audio only, nothing in the sim.
  Water: surf breaking on a sea map's shore, little waves lapping at a lake's or a river's banks (quicker on a river
  delta). The ground rumbles near the volcano on a Volcano map, harder once it rumbles its warning and while it erupts,
  and over lava. The weather (`weatherSound`: `weatherAt` while weather is shown, or a planet event's dust storm) is
  heard too: rain, with thunder a moment after each lightning flash the storm shows (the same flashes: `hash2` of the
  seed and the 5-second stretch), the wind blowing up in a sandstorm, blizzard or gale (`STORM_WIND`; fog stills it),
  sand and snow hissing, leaves in a gale, embers ticking as they fall in an ashfall, an aurora's shimmer. Near a Murmur
  nest or tunnel exit, now and then (more at night), a low sound in the ground (`groundMurmur`), and at night (while
  they're up: `murmurNight`) over their tunnels too, more often the more of them are on screen (`WORLD.tun`); on an
  always-night map it goes silent in the lull before a surge (`murmurLull`). Argos is near-silent: only the
  faintest rumble for a wind, no calls, and its frozen pools make no water sounds; the Cinderlands' lakes sound like the
  lava they look like. The mix, measured against the build music at the default volumes (a tap on the music bus and one
  on these voices): a calm wild scene sits about 18 to 22 dB under the music, a storm about 11 to 14 dB under, an
  eruption about 16 dB under, and a town about 25 dB under (the land fades there); thunder and surf peak at least 8 dB
  under the music's peaks. (A drone is a narrow band of noise, so its level number is far higher than a rustle's for
  the same loudness.) Music, Effects and Ambience volumes are in the pause menu (Ambience: the land's own sounds, `AUDIO.amb` on
  `AUDIO.natureBus`, apart from the effects; default 50%, where the owner turned them down to).
- **Briefing at the start:** the messages a new game opens with (where you landed, your goal, the map's notes) come
  together on one card while the game waits paused behind it; it closes by itself after a few seconds (longer for
  more text), or at a tap or key. In multiplayer the game doesn't pause for it.
- **Keyboard shortcut sheet:** press **/** during a game, or tap **Keys** in the pause menu. **/** or **Esc** closes
  it. The sheet pauses single-player games while open, and multiplayer play continues. **?** still opens **How to play**.
- **Command Deck look (the game's interface):** `body.deck` (on by default in `index.html`) dresses the whole in-game
  interface in the Command Deck look in the app icon's coral (ART_GUIDE.md, "Command Deck interface"; the "Command Deck
  in game" block of `style.css`, its `--dk-*` colours; the root `--accent` and `--danger` are coral and magenta-red too,
  and `#screen-contingency` puts back the blue ones for Contingency): near-opaque navy glass panels with coral corner
  brackets and scanlines, labels and buttons in Chakra Petch, numbers in the system monospace, alarm red as a
  magenta-red (`#ff4d8a`) apart from the coral, the Missions' light in cyan. It reskins the top bar, goal card, minimap
  ("Survey"), Army Group cards, tools, messages, panels, selection bar, banners and the screens over a game (pause and
  Settings, Statistics, How to play, Missions, Keys, the end, Boosts, multiplayer, saves); the main menu has its own
  block in the same look (below).
  Markup it adds: the callsign block first in the top bar on a wide screen (`#callsign`: `CALLSIGNS[ME]` in
  `PLAYER_COLORS[ME]`, set in `updateHUD`; in multiplayer each player's own), the robot counter's names under the counts
  (`#pop .pn`), the clock's time of day (`.ck-l`), each message's game time (`.toast[data-t]`, drawn by CSS), a label
  line over each panel's name (`sheetEyebrow`, `SHEET_EYEBROW` in js/ui.js: "Construction · sites 1/6", "Make · Yours",
  "Army group · priority 1 of 3"), and `body[data-sheet]` to light the tool whose panel is open. On an upright phone a
  panel docks above the bottom bar instead of over it (`sheetMoved` measures from the panel's top), and the Army Group
  cards are a row of small cards across the top left (`.agcards.row`, placed in `refreshAgCards`). Without the class the
  old look comes back. On a wide screen the top bar is locked to one 40 px row (two fixed rows of seven goods below
  1270 px): the goods counters are each three digits wide in tabular figures, the rate a minute sits under the number
  out of the flow, and the shortage dot sits inside the counter, so nothing moves as the numbers change; short of room
  the rates go first (their tip keeps them), then the callsign block (below 1600 px). Panels dock below the bar
  (`--hud-top`, `placeMinimap`), and the minimap hides under a docked panel. A long panel (`sheetCols`: its content
  taller than the panel) goes wider, its sections in two columns (`#sheet.cols2`, three, `.cols3`, from 1800 px wide when
  it's very long), the panel's content wrapped in `.sheet-flow` (which lays out as nothing otherwise); Missions take four
  columns, Statistics' charts two across, and the end of a game a two-column dashboard (result and buttons, the report).
  The Foundry's and the yards' orders are one compact line a type (▲ ▼ side by side, the count in grey). The good
  Chips is `chip`, also the top bar buttons' class: `body i.gi.chip` undoes `.chip` for its icon. Second pass
  (`pinSheet`, `foldLong`): a panel's `.sheet-title` is lifted out of the `.sheet-flow` and sticks to the top on a wide
  screen (`--pin-h` is its height), the Army panel's `.ar-orders` sticks under it, and a building's last `.actions` row
  (Pause, Move, Dismantle) or an Army group's `.army-cmds` is moved after the flow as `.sheet-foot` and sticks to the
  bottom. A `p.desc` or `p.hint` over three lines folds to two (`.folded`) with a `.more-btn` (More / Less, remembered
  in `UI.unfolded`). A very long panel takes three columns from 1400 px wide (`long > 1.6`). Build's cards are in tab
  order, each tab's under a `.b-grp` heading; on All on a wide screen (`.build-grid.all`, `body.sheet-build-all`) the
  panel spans the screen above the dock and the cards flow down columns as compact two-line cards; elsewhere the
  grid's CSS `order` keeps the next step, Roads, Blueprints and Walls first. Missions and Keys flow down columns (four
  or five), Statistics' tiles take one row and its charts three across. Under a mouse (`pointer: fine`) a panel's rows
  of controls are compact (buttons 34 px, order rows 30 px); touch keeps 44 px. Third pass (a 1280×720 desktop): a
  panel two columns don't hold takes three from 1200 px wide (decided in the same frame, so nothing jumps); under
  1400 px those span the screen above the dock (solid, the selection bar stepping aside), and on a short screen
  (≤ 820 px tall) a panel three don't hold takes four (`.cols4`). A short screen also packs a panel's name line, rows,
  paragraphs and upgrade cards, Keys (smaller type), Statistics (118 px charts), Missions, Build's All, Settings (two
  columns) and the end of a game (its numbers two pairs a line) tighter; a mouse gets 30 px buttons there, touch
  keeps 44 px.
- **Desktop (RTS controls):** on a wide screen the top bar is one row, the tools sit in a small dock and panels open
  on the right (the Build list three cards across in a wider panel from 1600 px wide). Drag a box to select warbots (Shift adds; a box round a garrison takes its spare warbots), right-click
  ground to hold it, a rival building to attack, or your garrison to station them (with a defence's panel open instead,
  right-click an enemy to aim it there; Shift+right-click, every defence that reaches it). Ctrl/Shift+1–9 saves a control
  group, 1–9 recalls it (twice jumps to it). Pan with **WASD** or the arrow keys, the window edge, or right/middle drag; hover for
  tooltips. Clicking the same spot again steps through what's piled there (a Crawler on a Foundry, workers at a site). A
  tall building is picked by its picture too (`buildingUpperAt`: the solid pixels of its art and turning head above its
  tiles, a Mooring Mast's cup, a Keep's walls; the one in front where they overlap; the Walking Factory's whole sprite,
  `walkerAtTap`; Passenger Town's buildings, `townAtTap`), robots drawn in front of it still first. Keys:
  **B** build, then **1–6** a tab (Gather, Make, Move, Defend, All, Mega; **Tab** steps; a new game opens on Gather, then on the last one used) and the
  letter on a card (`BUILD_KEYS` in js/ui.js: letters are per tab, so every building has one and none needs W, A, S, D or B;
  R is Ore Mine on Gather and Refinery on Make; on All a card shows "2 C"; elsewhere **B R** lays roads, **B X** walls), **R** (or **P**) opens and closes Paths
  and inside it picks a tool (**R** roads, **G** bridges
  and tunnels, **V** ramps, **Shift+V** viaducts, **Shift+Y** ropeways (`PATHS_SHIFT_KEYS`: every plain letter is taken),
  **E** pave, **O** one-way arrows, **L** junctions, **X** walls, **T** traffic map, **Shift+T** goods flow map), **Q** army, **C** recall all warbots, **F** select all warbots, **,** pick idle warbots a group at a time, **Shift+F** a Bot Foundry's Order bots list from anywhere without moving the map (again: the next Foundry, `openFoundryOrders`), **J** latest alert (again: the one before), **F1–F4** a camera spot (**Shift+F1–F4** keeps one),
  **H** base, **I** statistics (Economy: History), **U** robots, **Y** Economy, **[ ]** speed, **+/−** zoom, **M** minimap, **.** a co-op ping under the mouse (`coopPingHere`), **Enter** the banner's main
  button, panel buttons by the key shown on them (`SHEET_KEYS`; **Delete** twice demolishes, and on a robot's panel
  recycles it), **Space** pause, **Shift+Space** (or **Pause**) plan while paused, **Esc** back / clear selection (in Paths it takes back the last stroke; **Ctrl+Z** is Undo there, and on the map, for 10 s after placing a building, it takes the site back), **Alt+Enter**
  full screen (also a top-bar button and a pause-menu item). Chrome opens the installed app in a plain window on a
  computer (it ignores the manifest's `fullscreen`), so the app goes full screen itself on the first click unless you
  left full screen last time; Esc stays the game's key (`navigator.keyboard.lock`; hold it to leave). On a screen wider
  or taller than the map the planet's ground carries on, darkened, past the map's edges (`drawOffMap`).
  Phones and tablets keep the touch controls.

## Custom art

Buildings, bots, resources and ground use custom art made in Claude Design (`art/`, with SVG sources in
`art/source/`). The renderer that made the 3D art (three.js scenes in headless Chrome, plus the compose, effect and
terrain scripts, and `jobs.txt` with the recipe for every shipped file) is in `renderer/`: see `renderer/RENDERER.md`
to render new sprites in the same style. The art rules are in the Terrafall design system
(https://claude.ai/artifact/GAdLBz6kefeJeTRz57TTV7). The production buildings, Depot, Outposts and construction sites use the pre-rendered 3D set
(512×512, each on its own pad, placed by an `anchor` point in `art/art-manifest.js`), as do the Fuel Station, Bio
Farm, Oil Pump, Refinery, Cement Works, Asphalt Plant, Roadworks, Ramp, Ammo Plant, Missile Factory and Missile Silo
(team versions for the military ones), plus the Repair Station, the fortified Command Base, the Nuclear Reactor and
Nuclear Silo. All six robots (Worker, Warbot, Hauler, Agribot, Paver, Freight Truck) have four driving frames per team
plus brake-light and boost overlays (WebP, `driveSet()` in the manifest); the frames advance with the distance driven.
The nuclear missile, its 24-frame detonation sheet and the scorch mark are custom too, and so are the Bunker,
Disruptor Tower and Mortar Pit (with their firing overlays, the Mortar's tube in 16 directions and morning, evening
and night sets), the streetlamps along roads (`streetLamps`: posts sorted with buildings and bots, lit heads and
light pools at dusk and night) and the Pulse Turret's twin violet laser and hit burst (`fx-pulse-laser`,
`fx-pulse-hit`), the 3D Pulse Turret (a base and its gun head in 16 directions, with its violet charge-up,
`turret-charge-0…15`, and the beam leaving the barrel tips in `PULSE_MUZZLES`), the Walls and Gates
(`drawBarrierArt`: the dark Citadel, smooth charcoal stone with bastion towers at the posts, razor wire on insulator
posts along the top with live arcs crackling over it now and then, and steel blast-door Gates that slide open into
the towers, layered per tile), the
Viaduct's abutment tiles (`viaduct-abut-*`) and the working loops of the Oil Pump (its beam nodding over `pump-base`),
Refinery and Smelter, the Hollow's own set, the Murmur's tunnel exits, and Fiber's Reedcane Stalks (an image for each
growth stage, `stalkKey`; their light at night in the night glow map, `resourceGlow`) (ART_GUIDE Batch 16). An oil seep
has no art at all: it is a puddle of crude made in code from its tiles (`js/seep.js`: one glossy black shape across the
seep with a white rim light, sheen and droplets, baked with the ground and gleaming faintly at night; it recedes from a
pump as it is pumped and breaks into pools) (ART_GUIDE Batch 20). The crash sites aircraft leave when they're shot down are rendered too: the broken,
burnt airframes of the Cargo Plane, the Vulcan Bomber and the Airship (`wreck-cargoplane`, `wreck-bomber`,
`wreck-airship`, every time of day, from `renderer/b/wreck.js`; ART_GUIDE Batch 19).
Still to make: goods icons and a few terrain pieces. The biome art is in `art/biomes/` (six plants per biome with their
shadows baked in, and the Jungle and Polar ground, water, rock and cliff), and the Red desert ground, water and rock
are 512×512 (one image per 4×4 tiles, sharp on the zoomed-in map); all WebP to keep the single-file build small. The app icon is in `icons/` (its source: `icons/icon.svg`). Anything without an image falls back to placeholder art drawn in code, so new art can be
added one piece at a time. See **[ART_GUIDE.md](ART_GUIDE.md)** for specs, the style brief and prompts,
including the remaining pieces (Ramp, slope and cliff textures, goods icons).

Work is acted out in code (`workPose`, `drawWorkUnder` and `drawWorkOver` in `js/render.js`): a builder circles its site
welding, sparks flying; a worker paving spreads fresh concrete across the tile (bridge decks and tunnel linings too);
a Paver lays asphalt that steams behind it. **Gathering** (`harvestPose`, `harvestAnim`, `drawHarvest`): a robot stops
at the near edge of what it gathers, facing in (it eases back onto its path as it leaves), and works it with an arm.
It scythes Reedcane in sweeping arcs, flecks of cane flying the way the blade went (Bloom veins shed glowing violet
and teal motes as they're cut); drills Ore a few holes at a time, shaking as the bit bores in, cuttings and sparks
spraying (Uranium's cuttings glow green); breaks boulders and rock faces with a hammer, rearing back between blows,
each blow a flash, chips flung back off the rock and a cloud of dust; and scores Crystal with a cutting beam that
traces across the cluster, glints twinkling and slivers coming away. An Agribot turns from plant to plant, snipping
ripe pods and lifting them back to its hopper as leaves flutter down, or plants a row of three seedlings (crop sprouts,
or Reedcane shoots for the Grove Planter), the soil puffing up as each goes in. The glows brighten at night. It is all
drawn from the render clock and the job's own timer (`harvestTime` matches the simulation's), so nothing of it is in
the simulation; the old up-and-down bob is left for the few jobs without a pose of their own.

Weapon effects are drawn in code: muzzle flashes, tracers, gun smoke, dust kicks and bullet pockmarks round each
target (sparks on buildings), the Disruptor's arcs, and blasts with a fireball, flying debris, smoke and a scorch mark.
A destroyed building shakes, leans and sinks into the ground in a dust cloud, with secondary blasts, and leaves rubble.
Big blasts and quakes near the middle of the screen shake the view (`fxShake`), unless the device is set to reduce
motion (`LESS_MOTION`). Each frame starts from a clean canvas state (no dash offset, line ends or text baseline left
over from the last one), and a train's wagons start again behind it after it drove unseen (`trailOf`).
A Pulse Turret charges for 0.45 s before each shot (`PULSE_CHARGE`; the charge builds while it reloads, so its rate of
fire is unchanged), energy gathering at its muzzle, then fires a thick electric beam wrapped in arcs. At night,
streetlights light every third road tile (`drawStreetLights`): sodium orange over concrete, white over asphalt.
Ground marks fade over a minute or so (at most 350 at once). Each effect can be swapped for a sprite sheet
(`frames` and `cols` in the manifest; `FX_ART` and `DECAL_ART` in `js/render.js`): see ART_GUIDE Batch 15.

## Enabling GitHub Pages

1. In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. The workflow in `.github/workflows/pages.yml` publishes the game on every push to `main` (the development branch
   `claude/elegant-cori-a8yj96` no longer deploys: work reaches the site once it's on `main`). The `github-pages`
   environment must allow `main`: **Settings → Environments → github-pages → Deployment branches and tags**, a Branch
   rule for `main`. To publish right away without a push, open **Actions → Deploy to GitHub Pages → Run workflow**.
   Before uploading it writes the build (the commit's short hash and the date) into `index.html`'s `terrafall-build`
   tag, which feedback reports name (see Send feedback).
3. Installed copies (Add to Home Screen) check for a newer version each time they open with internet, so they update
   by themselves.

(GitHub Pages on a private repository needs a paid GitHub plan; on a public repository it is free.)

### Day and night

The planet turns: morning, day, evening and night, 12 minutes of game time round (`TOD_CYCLE` in `js/defs.js`, read
through `todPhase`), starting at dawn, with half-minute crossfades. It runs on game time, so it pauses with the game and
is saved with it; the clock in the top bar shows a sun (coloured for dawn, day and dusk) or a moon. Turn it off in the
pause menu (Day and night; a display setting kept on the device, `todStored`), except in a game with the Murmur: they
live by the night, so `todMode()` shows the cycle for Always day there (`todForced` 'murmur', `TOD.force` set by
`js/ui.js`) and the pause menu says why under the button. A map type with `alwaysNight` (the Hollow) is night whatever
the setting (`todForced` 'night'), photo mode's slider included. Nothing in the game itself ever asks what the light is:
the Murmur's nights (and the Hollow's surges) come from the game clock (`murmurNight`). Always night stays a choice
with the Murmur on, for its looks only: they still come out at the game clock's nightfall, after the dusk warning (the
pause menu's line under the button says so, as does the new-game Rules' Always night).

- **Re-lit art.** Every 3D sprite (buildings, robots and vehicles, track and bridge pieces: the 207 keys in
  `art/tod/tod-keys.js`) has a morning, evening and night version from the Claude Design day/night kit, at
  `art/tod/<time>/<same path as the day art>` (WebP, the day file's size; the kit's design names, such as cement-works
  for the Cement Works, are installed under the game's). `drawArt` draws the current time's version and fades in the
  next one over a transition (`todVariant`); only the sets in use now and next are loaded (`todFrame`), and a set's
  re-lit and graded copies of each sprite, the green and purple teams' too, are let go with it (`todDropSet`, `todFree`;
  a graded stand-in goes as soon as the re-lit image arrives), and the sprites drawn lately get the coming set's versions
  ready a couple a frame ahead of the change (`todWarm`, `artSeen`). The single-file
  build puts each set in a bundle beside the page (`dist/tod-<time>.js`, loaded when needed); the Murmur's re-lit
  sprites (`MURMUR_TOD_KEYS`) join a set only in a game with them, from their own bundle (`dist/murmur.js`).
- **Graded in code** (`out = in × multiply + add`, values from the kit's `art/tod/shared/time-of-day.json`): the baked
  ground, roads, track, pipes, plants, resources and territory tint (`todGradeGround`), and any sprite without a
  re-lit version or whose set hasn't loaded yet (`todGraded`). Tile art drawn over the graded ground (bridge piers,
  towers and cables, Viaduct decks, level-crossing barriers) goes through `withTod`, like `drawArt`. Light overlays (brake lights, boost glow,
  lamps), the UI and nuke blasts are never graded.
- **Evening and night:** vehicles' headlights (`drawHeadlights`, the kit's overlays at 3× the sprite), a glow in team
  colour under every finished building (`lightPool`, all drawn in one additive pass; small ones along Walls, bigger at Gates), a searchlight
  sweeping ahead of every Pulse Turret's gun as it turns (`drawSearchlight`), and bots' drop shadows lean left at dawn, right at dusk and
  fade at night (`todShadow`).
- **Sunsets and sunrises** (`js/sunset.js`, render only: no sim state, saves or randomness). From 75 s before the day
  turns to evening until night is in (`DUSK_TIMES`, worked out from `TOD_CYCLE`), a golden-hour grade comes in, warms
  through fire colours and deepens to magenta and violet; dawn runs the other way, gentler and cooler. Corvane sets in
  the west and rises in the east, so the ground is lit from that side of the screen and falls into a cool long shade on
  the far side, and robots' drop shadows stretch and turn violet (`duskShadowLength`, `duskShadowRgb`). Each biome has
  its palette and touches (`DUSK_BIOMES`): glints on water, motes (dust, spores, embers, pollen, ice), light shafts (off for now: the owner, Nov 21 2026),
  plant silhouettes (a map of every plant at a few pixels a tile, made a few rows a frame and kept up with the ground:
  `duskSilTiles`), pink fog, heat haze easing off; the Bloom's glow and the Cinderlands' lava wake early (`duskWake`),
  Steamwells' steam is lit gold (`duskSteamRgb`), the tops of the war's smoke columns catch the low sun (`duskSmokeRgb`, read by `wfxSmoke` in js/warfx.js), Argos has a hard terminator sweeping east to west instead (bowed, its middle leading, as on a round world: `D.lineAt`, `duskNightPath`), and the
  Hollow has none. The Ring shows as a faint arc over the top of the view zoomed out. A storm, fog or dust storm mutes
  it. Two passes: `duskGround` after `todGradeGround` (under the buildings, so team colours keep their light) and
  `duskSky` after the sky's beacons (lighter, and fainter zoomed far in). Graphics Saver keeps just the colour grade;
  with reduce motion nothing drifts or twinkles.
Ground light follows each structure’s footprint. Mass Drivers and Catchers have local status lights, and the checked megastructures and newer ground units have lights attached to their own art. Express gantries light their two lanes independently.

- Every building and robot has a re-lit set (lit windows, beacons and team-colour glows; headlights on everything that
  drives), including the 3D Pulse Turret and its heads, every Wall and Gate piece, the Viaduct's abutments and the
  moving parts of the Generator's and Oil Pump's working loops. Light loops (the Smelter's furnace, the Refinery's
  column lights, the turret's charge-up, the walls' sparks) are never graded.

On Active outside missions, working industry near Murmur exits can feed up to two additional Scuttlers per pack
from the second night onward. Existing raid population limits still apply.

### Wildlife

Animals on the map, for looks only (`js/wildlife.js`): the Pathfinder's garden (LORE.md), Earth's animals in the green
regions and, the hardiest, at their edges; small native creatures where the land is strange; nothing on Argos. Nothing in
the game reads them: they live in `FAUNA` (never in `S`, a save or an order), move by the frame's clock with
`Math.random`, and two players needn't see the same ones. They can't be selected or tapped and carry no team colours.

- **Who** (`FAUNA_LIFE`, `FAUNA_KINDS`): deer and foxes in Greenreach and Emberwood, wildebeest and hares on the Long
  Grass, alligators and turtles in Blackwater, hares and arctic foxes in the Polar Caps, lizards and hares in the Rust,
  lizards and ash beetles in Cinderlands, lizards, turtles and red shore crabs on the Shoals, and bison, lizards and turtles in
  Steamwells. Deer, wildebeest and bison have distinct bodies and grazing poses. Gulls cry over the Shoals and
  Steamwells (`gullCry` in js/audio.js), mud pots pop in Steamwells, and a geyser going
  off in view is heard (`geyserSound`, from `drawSpringSteam` in js/ambient.js: render-only, at most one every 1.5 s). Shorebirds,
  songbirds or raptors fly over each region according to the habitat. Look for broad-snouted alligators with paired
  rows of scutes in Blackwater. The Bloom’s armored hinge-backs, twin-tailed switchtails and rib-winged sailwings
  share dark plates and amber eyes. Arctic foxes have shorter ears and a thicker coat than red foxes. Geese show
  white cheek patches on the water and in flight, and turtles have domed, plated shells. Cinderlands ash beetles
  have an ember-colored seam and ember moths show warm bands when they flap. Blackwater herons tuck their necks
  in flight and extend them to fish. Woodland owls have ear tufts, while snowy owls have rounded heads and pale
  barred feathers. Rock lizards dart with splayed feet and a swinging tail. Hares crouch before each bound with
  their ears back, in sandy coats on dry ground and white coats on the Polar Caps. Bats in the Rust make quick,
  banked turns at dusk on dark, scalloped wings. Hawks show broad rust-colored tails, vultures rock on fingered
  wings, crows spread a fan, and ravens trail a wedge-shaped tail. The Hollow has pale, blind crawlers, hinge-backs and cave sailwings with ragged translucent membranes. Argos is airless.
- **Where** (`faunaHab`, `faunaRoster`): seeded 8-tile cells hold local species. A road, railway or building reduces
  usable habitat within and around its footprint. Visible animals move away from new development and the occupied area
  stays quieter. Walkers may cross a road to leave the area. All wildlife remains display-only.
- **When**: by the light on screen (`TOD.state.lights`, so the Time of day setting and photo mode's slider): the day
  animals bed down a few at a time through the evening (each roster entry has its own threshold: `faunaActive`) and the
  night ones come out. Storms keep the birds down; rain puts the fireflies out.
- **The war** (`faunaHear`): new effects in `S.fx` (read only) are heard within `FAUNA_FEAR` tiles: flocks lift and fly
  off the view (with a soft flutter near the camera, `faunaFlutter`), herds bolt, small things hide. The cells round
  the noise stay empty until it has been quiet `FAUNA_QUIET` (40) game seconds; then the animals come back in from off
  the view. They step aside from robots and convoys, and a warbot on the move puts a herd to flight. No carrion birds come to wrecks
  (the owner, Nov 23 2026: robots leave nothing to eat); `faunaCarrion` is no longer called.
- **The Murmur** (read only: `murmurNight`, `dayClock` and `NIGHT_FROM`, the nests, mounds and tunnel exits, the
  packs; `faunaMurmur`): `FAUNA_DREAD` (75) seconds before a Murmur night the day animals within 18 tiles of a nest or
  exit flee from it and the rest bed down early, and `faunaHush` hushes the day calls and the insects' daytime drone in
  `js/audio.js` (`biomeCall`, `natureBeds`). At night the animals and fireflies keep away from the packs, and the moths
  scatter from lights a pack comes near. At dawn the birds fly back in, and `faunaChorus` brings the calls on fast for
  about fifty seconds (Greenreach, Emberwood, the Long Grass, Blackwater: `FAUNA_SONG`). In the Hollow the glow-worms
  go out one by one in the lull before a surge, stay dark near the Murmur through it, and the crawlers hide.
- **Night lights** (`faunaLights`, `faunaGlows`): moths (ember moths on the ashlands, glowing motes over the Bloom)
  circle streetlamps, buildings' lights and the Command Bases.
- **Drawn** from two hooks in `render`: `faunaGround`, before the buildings and robots (walkers and waders seen side on,
  as the three-quarter view shows them, birds perched, tracks in the snow), and `faunaAir`, after the smoke and under
  the aircraft (fliers seen from above with their shadows, and the glows). Colours follow the light (`faunaCol`, from
  `TOD.state`), night animals lifted a little so they still read. Sounds go through `AUDIO.natureBus`, under the
  ambience.
- **Cost**: none on the Saver Graphics step; at most `FAUNA_CAP` (150) animals at Auto, 1.25× on High and 1.5× on Ultra
  (`FAUNA_STEP`), and down to about half that zoomed right out (`faunaCap`), where small ones are drawn plainer.

### The Shoals (tropical coasts) and lava effects

Choose a naval map to enable **the Shoals** (tropical islands) in the biome picker. It uses coral sand, palms,
reef water and pale shallows. Gulls bank on broad, black-tipped wings and tuck in to land. Red crabs sidestep along the beaches. Small waves drift across open water. On naval maps, dolphins arch out of open water and leave a splash where they dive back in. Fish leap and
whales sometimes surface to blow. Frozen water and lava have their own scenery.
The Volcano map type and Cinderlands have drifting highlights on exposed lava and steam vents
along the banks. These effects are drawn in the browser without changing terrain or movement.

### Steamwells (geothermal basin)

Select **Steamwells** under **Custom Game → Planet → Biome**. The geothermal basin has sulfur-stained
limestone textures, mineral bands along lake shores, and six terrain decorations, including steaming
vents and periodic geysers. The mini pools are decorations cleared by construction. The selected
map type still determines water crossings and resource placement. The terrain and Sky islands
cliffs are rendered by `renderer/terrain/terrain_springs.py` and load in their own biome bundle.

### Wind, water, sky and the planet view

The land alive, in `js/nature.js`, for looks only: nothing there changes the game, `S`, saves or orders; what it keeps
(`NAT`) is display-only and made afresh for each game. Anything random comes from the planet's seed (`hash2`), so every
device sees the same land. Hooks in `render`: `natureGround` after the ground is drawn and before the time of day grades
it, `natureLight` after the grade (before the water's ripples), `natureOffMap` from `drawOffMap`, and `natureView` over
the finished frame (before the selection box). Reduced motion stills the sway, the gusts, the twinkles, the waves and the
clouds' drift (`natureCloudTime`).

- **Wind** (`natureWind`): one wind for the map, its way and strength from the same stretches of the weather's clock as
  the clouds' drift (`ambWind`, veering as `ambDrift` does), stronger in a spell of weather. Gusts (`natGust`) roll
  across it downwind: crests `NATFX.wind.gap` tiles apart in patches. Zoomed in past `NATFX.sway` px a tile the
  decorative plants are drawn live (`natPlants`) instead of baked into the sharp chunks (a chunk baked while they sway
  has `noPlants`; `drawPlants` skips it, `natRebake` bakes the ones on screen again one a frame), each leaning with the
  wind and the gust over it, and pushed outward for a moment by a blast near it (`natHear` reads new blasts in `S.fx`).
  (Off for now: the owner, Nov 21 2026.) At any zoom, crests of bent grass with their darker side upwind roll over the grassy land (`natSheen`: a small buffer
  masked to `natVegMask`, one tile a pixel, laid over the view in one draw), and a blast sends a ring of them out.
  Not on Graphics Saver.
- **Wet ground** (`natureWet`): through a rainstorm and for a few minutes after it (`NATFX.wetFor`) the land is darker
  and cooler, roads glossy, puddles in the low spots; at night the wet ground mirrors the streetlamps and the lit
  buildings (`natWetNight`). The spells are the weather's (`weatherAt`), so it needs no state.
- **Frost** (`natureFrost`): on the Polar Caps and Argos, and lightly on Emberwood (toned down: the owner, Nov 21), rime creeps over the land in the last of the night,
  is thickest at dawn and melts by midday, following the time of day as shown. Four layers of crystals, each with more
  than the last; not on open water, not on Saver.
- **The night sky** (`natNightSky`): the Ring's faint silver light on the land, its strength, angle and tint by planet
  (`natRing`), and on the Polar Caps, Argos and the Bloom a slow aurora's light drifting over the ground (not on Saver).
- **Water** (`natWater`): the sun's sparkle by day (thickest up the view, toward the sun), the Ring's band and Argos
  mirrored by night with stars on clear nights (fixed on the view, as reflections are), and small waves lapping along
  the shores (`natShores`). Not on lava or Argos; none of the sky in the Hollow.
- **The planet view** (`natureOffMap`, `natureView`): past the map's edge its own ground carries on, mirrored, faded and
  sinking into a haze of the biome's colour (`NATFX.haze`) that thickens outward. Zoomed far out (below
  `NATFX.tilt.from` times the furthest zoom) the camera tilts a little (`natureTiltAt`, at most `NATFX.tilt.most`): the
  finished frame is redrawn in strips, each row as wide as its distance makes it (a true perspective: straight lines stay
  straight), under a depth haze thicker toward the far side, with a few stars through it at night. `screenToWorld` and
  `worldToScreen` map through the same tilt (`natureUnwarp`, `natureWarpPt`), so taps, clicks, the box select and the
  minimap are as before; the drawing code culls by the flat frame (`viewToWorld`). No tilt on Saver.
- **The main menu's layout** (`#screen-menu` in index.html; `showMenuView`, `renderCampaignHub`, `menuArrowKey` in
  js/ui.js; the "cinematic Command Deck (M2)" block at the end of style.css). One card (`#menu-card`) with four views, in
  the Command Deck look in the app icon's coral (ART_GUIDE.md). **Home** fills the screen over the planet: the
  **TERRA/FALL** title top left (`.logo`, the coral gradient clipped to the text, a soft glow; a status line over it and
  the tagline under it), **Continue** / **Saved games** / restore points / **Rejoin** under the title when they apply;
  one console docked along the bottom (`#m-dock`: **Play** `#m-new` in the coral cell with the setup summed up on it, the
  whole cell its button, then **Campaigns** `#m-campaigns` with the Missions progress (`syncCampaignTile`), **Custom**
  `#m-customise` and **Multiplayer** `#m-multi`); and a bracketed rail on the right (`#m-rail`: the **Daily Planet**
  `#m-daily` in amber, then **How to play** `#m-help`, **Lore** `#m-lore`, **Settings** `#m-settings`, **Feedback**
  `#m-feedback` and **More** `#m-extras`). Below 900 px wide the rail is a column of icons; on an upright screen
  (`max-aspect-ratio: 23/20`, as `mplLayout`) the planet sits across the top, the title under it and Play at the foot
  with the other three under it, the rail of icons beside the planet. `#m-go` (Play / Start with its summary,
  `#m-more-sum`) moves between the dock and Custom Game's bar (`showMenuView`). The planet's marks (`#m-marks`: a ticked
  ring and its name on a leader line, placed by `mplMarks`) show on Home with the Planet background only.
  **Custom Game** (`#m-more`, `'setup'`) is as below. **Campaigns** (`#m-camps`,
  `'camps'`): a card a campaign, a picture from `art/menu/` beside a line in the setting's voice: the **Missions**
  (`#m-missions`, opens `#screen-missions`; `missionsProgress` gives finished / total and Next up, also the Campaigns
  tile's line), the **Main Campaign** (`#m-campaign`, CAMPAIGN.md, *In preparation*: not a button,
  its three acts as a teaser), **Contingency** (`#m-contingency`: calls `openContingency()` once that exists, its status
  line from `contingencyMenuLine()` if that exists too; until then *Coming soon*, which a tap nudges) and a dashed
  **Co-op scenarios** card (*Later*). **More** (`#m-extra`, `'extra'`): **Observer** `#m-watch`, **Records**
  `#m-records`, **Load a save file** `#m-import`, **Load from a code** `#m-cloud` (shown where it works). Every
  destination is two taps from Home at most. Back (`#m-camps-back`, `#m-extra-back`, `#m-back`) or Esc returns Home
  with the focus on the tile or button that opened the view; Esc also closes How to play and the Missions (a mission's
  brief, then the list) over the menu, and Multiplayer's first screen. The arrow keys move the focus between the
  buttons of Home, Campaigns and More by where they sit (`menuArrowKey`; Custom Game keeps its arrows for its choices),
  and Tab goes through them in reading order. Load messages (`menuMsg`, `#m-import-msg`) show above the dock or under
  More. `tools/menu-test.js` checks that every destination opens and Esc / Back return, on a computer and a phone.
- **Custom Game's list and pickers** (`syncSetupRows`, `openSetPop`, `closeSetPop`, `setPopKey`, `syncAdvanced` in
  js/ui.js). A large preview on the left (seed, Save, New planet, saved planets), **Match** and **Planet** as a list of
  rows (`.m-prow`, `data-pop` the id of the setting's control) and **Advanced** (`#m-adv`: Rules and Challenge, folded
  or open by `#m-adv-toggle`, `UI.advOpen`, open at first only on a screen at least 1700 × 1000; folded, `#m-adv-sum` sums it
  up), with Start in a docked bar. Each row shows its value (`setRowValue`: the lit choice, the doctrine or *Each its
  own*) and hides with its control. A row opens `#m-pop`: the row's own control (the radio row, the doctrine chips and
  each rival's dropdown, kept hidden in the row's `.m-ctl`) is moved into it while it's open and moved back on close,
  so every option keeps its handlers, data-info lines and greying out; the Second biome dropdown is shown as a list of
  choices kept in step with it. A popover beside its row on a big screen (`placeSetPop`), a sheet from the bottom under
  a scrim below 700 px wide or 500 tall. A pick closes it (not the doctrine's: each rival can get its own); ← → ↑ ↓
  move the pick through the enabled choices, Enter picks and closes, Esc or a tap outside closes, Tab stays inside, and
  the focus goes back to the row. Map type and Biome keep their card pickers (`openPicker`).
- **The main menu** (`js/menuplanet.js`): Corvane's system behind the menu on its own canvas (`#menu-planet`), the
  menu's edges shaded over it (`#screen-menu::after`). Ithaca I sits large and still in the middle of Home (`mplLayout`:
  left of the rail, between the title and the dock; across the top on an upright screen), its lit side toward you:
  Corvane is behind its left limb, the light fixed from the front, a little left and above (`mplState`), so the thin
  night side on the right shows the colonies' lights. It turns west to east (the land moves to the right), opening with
  the Rust toward you; its face is the atlas (LORE.md: The atlas):
  `art/lore/ithaca-map.webp`, the atlas made small by `tools/atlas/atlas.py` (`menu_map`: 512×256, no labels or borders,
  the regions' colours blended at their seams, the ringfall belt's craters), its alpha the colonies' night lights (towns
  along the coasts and in the territories' hearts; `mplAtlas` reads it; inline as `window.ITHACA_MAP` in the one-file
  build), drawn up smoothly into a 1024 × 512 map, its colour then sharpened from the Contingency globe's
  `art/globe/ithaca-2048.webp` when that comes (`mplHd`; not in the one-file build). The clouds are the globe's
  (`mplClouds`), else made from a fixed seed (`mplMakeMap`, a few rows a frame at launch, at half the map's resolution), and so is a face of its own
  (the old coral patchwork) until the picture comes, at most `MPLANET.atlasWait` seconds, or if it can't be had (a page
  opened from a file, whose canvas can't be read). It is shaded per
  pixel in an image up to `MPLANET.res` (520) across, 300 on Graphics Saver, from its normals (`mplShade`; the light's
  part, which holds still, is worked out once per size in `mplLightPrep`, so a frame only looks up the map and clouds;
  Argos's shadow, where the line from Argos away from the star meets the planet, works it out again there). Corvane's corona, bloom and flares (`mplStar`), the Ring (`mplRing`), Argos (`mplMoon`), the four
  vanguard Carriers (`mplCarriers`), ringfall (`mplRingfall`) and the Wren coming in on its loop (`mplWren`). The war on
  the surface (`mplWarTick`, `mplWarDraw`): fronts near the colonies' lights flicker with bursts and the odd bigger
  boom, leave fires (smoke by day), missiles' lines arc between colonies, a big strike about every half minute (busier since Nov 21 2026: up to 4 fronts, more bursts and missiles), all placed on
  the map and turning with the planet, hidden past the limb; and after `MPLANET.nukeFirst` seconds on the menu, at most
  once every `MPLANET.nukeGap`, a nuclear blast on the night side (`mplNuke`, also `MPL.nukeNow()` for testing).
  Sprites (glows, flashes, the sky) are made once. A dozen frames a second; on Graphics Saver five, the sphere shaded
  every other one, fewer flashes, no ringfall, Wren, drifting stars or lens rings; with reduced motion near-still
  (`MPLANET` time at 3%) with no flashes, just steady fires. Stops while the menu is hidden or the tab is in the
  background. While it shows, the demo game behind the menu plays on but isn't drawn (`menuPlanetCovers` in
  `drawNeeded`). Only with **Menu background** on **Planet**, the default since the cinematic menu (`menuBg` /
  `setMenuBg`, kept on the device as `terrafall.menubg`): on **Classic** the menu shows the demo game through its dimmed
  gradient, the planet's marks hidden and the panels as solid as ever, and the canvas and map aren't even made (`mplMake` runs the first time Planet is wanted); switching to
  Classic stops the frames (`cancelAnimationFrame`) and hides the canvas at once.

### Cloud shadows, remains and beacons

Three touches that keep the world going on without its people, all in `js/ambient.js` and for looks only: nothing there
changes the game, `S`, saves or orders. What they keep is display-only (`R.amb`, made afresh for each game and each
load); they read the game's clock, seed, buildings and effects. Hooks: `drawRemains` after the game's ground marks
(`drawDecals`) and `drawAmbientSky` after the aircraft (`drawAirLayer`) in `render`, and the `beacon` sound in `sfx`.

- **Cloud shadows** (`drawCloudShadows`). By day soft shadows of clouds drift over everything on the ground. The sky is
  a field of cells (`AMB.cloud.cell` tiles), each with a cloud if its hash from the seed is under the cover, each cloud
  a cluster of soft puffs; the wind carries the field (`ambDrift`), each stretch of the weather's clock (`WEATHER.slot`)
  blowing the way a spell in it would (`weatherAt`'s `dir`), faster in a stretch with a spell, veering smoothly between
  stretches. So, like the weather, it comes from the seed and the game clock alone and every device sees the same sky.
  A spell of weather (or a dust storm event) thickens and darkens it (`AMB.thick` by kind); the light fades it out toward
  night (`AMB.sun`). Made in a buffer at an eighth of the screen (a quarter on Ultra) and laid over the view in one draw.
  None on Argos or in the Hollow, none with Weather off, none on Graphics Saver.
- **Remains** (`drawRemains`). The game's own marks of a fight fade in a minute or two (`S.decals`: rubble, scorch; a
  wreck's fire in `S.fx`) and aren't saved. `ambScan` looks through the effects added since the last frame: a building's
  `collapse` with its fire on the same step (destroyed by force; one taken down on purpose only drops its rubble), a
  robot's or vehicle's wreck fire (`killBot`: the robot is found by where it fell and its id). Murmur nests and
  creatures leave nothing (they take their dead with them), nor do ships. Each becomes a
  remains record in `R.amb.ruins` (at most `AMB.ruin.max`, one wreck pile to a tile, only on open ground) that carries the
  rubble on as the game's mark fades (the same pieces from the same seed) and, from its age in game time, grows over by
  biome (`AMB_GROW`): grass, moss and vines in the green biomes, drifting snow in the Polar Caps, sand in the Rust, ash in the
  Cinderlands, violet Bloom veins and nodules (glowing after dark) in the Bloom and the Hollow, only dust on Argos (slower).
  After `AMB.ruin` seconds they go back into the ground; a building or site, road or track on the tile clears them at
  once. Each is drawn from a small picture (`ambSprite`, one per time of day in use, blended across the change as
  `drawArt` blends the re-lit art), made again only when its growth steps on, the zoom needs another size or the wind
  turns, a few a frame; out of view for 20 seconds, its pictures are let go. Kept in `R`, not `S`, so the simulation is
  untouched and nothing new is saved: remains don't outlive a save and load.
- **Aircraft wrecks** (`ambWrecks`, `ambWreckArt`). An aircraft's wreck is the game's own (`S.wrecks`, see **Aircraft
  shot down**), so it outlives a save and load; each is taken in as remains (kind `p`, carrying its wreck as `e.w`)
  from when it came down, and let go when the game lets it go (or the moment `wreckStands` says something is built
  on it). Drawn in `drawRemains`: the burnt ground under it, long down the way it came in and back along its skid,
  fading as it overgrows (`ambWreckBurn`); its broken airframe (`ambWreckArt`: the art `wreck-<type>`, turned to its
  heading and re-lit for the time of day by `drawArt`, its `scale` the frame's width in tiles; an aircraft with no art
  of its own gets its outline broken in two, charred); then the growth over it, in patches along the hull (three, or
  five on the Airship's; a drift of snow, sand, ash or dust in two or three and laid a little thinner so the wreck
  still shows), never going back into the ground (`AMB.ruin.p`: growth from 60 s, full at 20 minutes, slower on
  Argos). A fresh one smoulders (`ambSmoulder`: thin smoke off the hull for `AMB.ruin.smoulder` s, its embers glowing
  after dark for `AMB.ruin.embers` s). After dark every wreck is lit faintly so it shows (`ambWreckNight`, the owner's
  call): a few small flames along the hull, coming in as the embers die and dwindling to one as it overgrows, firelight
  on the ground and the hull, and a red light at one end blinking every 2.4 s. (No carrion birds come to it.)
- **Beacons** (`drawBeacons`). From evening until dawn (`AMB.beam`, faded in over the evening crossfade and out at dawn,
  so never in Always day and always in Always night or the Hollow) every standing, finished Command Base, whoever holds
  it, shines a short beam from its mast, up to four tiles or 16% of the view height, a hint of its owner's colour in it, with a soft halo, light
  on its pad, and a slow pulse every beacon keeps in time (`AMB.pulse`). In the Hollow it goes up its breach (`breachAt`);
  a base under rock would only light the roof. When your own base's beacon comes on in view, a soft low hum
  (`ambHum`, through `sfx('beacon')` and `mapVoice`).

### War scars

The owner's design (Nov 19 2026): over a long war the land between colonies turns from green nature into a World War
One battlefield. Most of it is the simulation's own and in `S` (so saves, multiplayer and every device agree), made from
the game's own blasts and the planet's hash; it is drawn into the baked ground (`paintScars`, `paintScrapTile`,
`drawStump` in `js/render.js`), so a battlefield costs nothing a frame. The War scars section of `js/sim.js` has the rules,
`SCARS` and `SALVAGE` in `js/defs.js` the numbers.

- **The setting** (`S.settings.scars`: `off`, `light` or `full`, **Full by default**). Only in the pause menu's Settings
  (`#p-scars`, `scarsPref` in `js/ui.js`, kept on this device as `botfall.scars`), never on the new-game screen. Each game
  takes it as it starts (`newGame`'s `opts.scars`: Play and Custom Game, missions, Observer, and in multiplayer the
  host's, sent with the lobby settings) and keeps it, so it can't drift between devices; changed during a game it applies
  from the next (the Settings note says so). A save from before the setting plays on with Full from where it is.
- **Craters** (`S.crater`, a byte a tile: the low four bits count shell holes, the high four a big crater's size, its
  reach in eighths of a tile). `scarBlast(x, y, r)` is called where a real explosion lands: a Mortar shell (0.45), a
  robot going up (0.3, a heavy one 0.55), a Howitzer's shell (0.85), a bomb (1.1), a Missile (1.4), a fuel blast (its
  reach × 0.6, at least 0.7) and a crash (the aircraft's `blast`); `scarNuke` a nuclear blast (glass to 0.7 of its reach,
  ash beyond, craters scattered across it). From `SCARS.big` (0.7) up a blast leaves a big crater (another in it churns
  it); below, a shell hole (Full only). Four or more holes in a tile churn into mud. Drawn: a rim of thrown earth round a
  dark bowl, spilling onto the tiles round it (each tile draws its share, clipped); with rain, dark puddles in the big
  ones (`drawScarPuddles`, the only per-frame part). A tile with shell holes is torn earth, browner with each. Craters never slow anything.
- **Scorch and ash** (`S.ash`, a byte a tile: 1 to `SCARS.light` a light scorch that steps back toward grass every
  `SCARS.step` s, about ten minutes in all, redrawn as it passes each third (`scarFade`); `SCARS.good` ash for good;
  `SCARS.glass` a nuclear blast's glass). Blasts scorch their reach and on Full burn their heart (r × 0.55) to ash; a
  Torch's flame lightly scorches the ground it licks (`scarBurn`); napalm burns its 3 × 3 to ash (`scarNapalm`). The
  decorative plants on ash, in a big crater or on a tile with two shell holes are drawn as charred stumps or burnt logs
  (`scarStump`, `drawStump`; `S.decor` is untouched). A Grove
  Planter planting a grove clears the scars of the tile and the eight round it (`scarHeal`).
- **Scrap** (`S.scrap`: piles `{ id, x, y, n (Alloy in it), k (0 bits, 1 hull, 2 heavy wreck, 3 rubble), c (pieces),
  o (owner), a (its turn), cut, w }`, at most `SCARS.scrapMax`). `scarBotDown` (from `killBot`, not quiet ones) and
  `scarBuildingDown` (from `destroyBuilding` by force) add it with `scrapAdd`: on a road, track or building it lands on
  open ground beside it; within 0.6 of a tile of another pile it joins it (graveyards), up to `SCARS.pileMax` Alloy.
  Worth: a Worker's, Hauler's or warbot's 0.5, a Torch's (or anything else of two rounds of parts) 1, a Bulwark's,
  vehicle's, train's, Crawler's or Howitzer's parts / 2 (at least 1.5), a building's 1 + its Alloy cost / 2 (a Command Base's 4 more, at most 6). An aircraft wreck
  (`crashLand`, `S.wrecks`, drawn by `js/ambient.js`) gets a pile linked by `w`, worth parts / 2; cut up, the wreck goes.
  Past the cap the smallest of the oldest forty piles joins its nearest neighbour within 3 tiles (`scrapSqueeze`). Built
  over (a building, road, track or pipe), a pile goes (`scrapTidy`). Murmur creatures leave none (they take their dead),
  ships sink. With scars on, `js/ambient.js` takes in no remains of robots and buildings (the scrap stands for them).
- **Salvage** (`salvageRun`, last of `dispatch`'s jobs, every fourth round; `doSalvage`): an idle Hauler goes for a pile
  on its colony's land with a whole Alloy in it and no enemy within `CRATE_SAFE`, from a road tile on its network within
  `SALVAGE.reach` (2.5) tiles of it; it cuts for `SALVAGE.time` (5) s, takes the whole Alloy up to its load, and goes on to
  storage as a crate run (`stats.salvaged` counts it). A cut pile keeps `cut` and is drawn stripped. The rival AI does the
  same through the same dispatch.
- **The Murmur** (`murmurGoals`, `murmurIndustry`): heaps of 6 Alloy or more in a 10-tile cell (`scrapHeaps`) are goals
  for their tunnels, weighted like a building with charge (up to 2.5, below a Generator's 3); on Active an exit with 10
  Alloy of scrap within 12 tiles adds a Scuttler (inside the usual caps). Deterministic, from `S` only.
- **Animals and bones** (`S.bones`, at most `SCARS.bonesMax`). The fauna is scenery (`js/wildlife.js`), so the deaths
  that leave bones are worked out by the simulation (`scarFauna`): each untouched open tile in a blast's reach (no scar,
  road, building or deposit) had an animal on it with a chance of `SCARS.fauna` (more under trees, more near the middle,
  every tile for a nuke); its bones (small, a deer's or a bison's size) stay. On screen, the animals on the ground in a
  blast are killed (`faunaKilled`: gone at once), the ground the game counts as heavily scarred (`scarDead`) is no
  habitat (`faunaBusy`), and the birdsong and insects thin out as the view fills with battlefield (`faunaScarred`, read by
  `biomeCall` and the drone in `js/audio.js`).
- **The land healing and the war in the air** (`js/warfx.js`, looks only: display state in `R.wfx`, never in `S`, saves
  or the hash). Where no fighting has gone on in a 6-tile cell or the cells round it for `WARFX.heal.quiet` (150 s), its
  scars green again over `WARFX.heal.grow` (480 s, in 6 baked steps, `wfxHeal`): the scorch and ash fade back into the
  ground under them (glass less), churned mud partly, and grass and then flowers come up, thickest on old craters
  (`paintScarHeal`, by biome: `WFX_BLOOM`). A new blast on a tile starts its healing again; fighting nearby only holds
  it. The craters, stumps, scrap and graveyards stay; `S.ash` never changes (the herds still keep off it). A loaded game
  starts healing afresh. Also drawn there, from the game's effects as they're added (`wfxScan`): **smoke columns** from
  buildings burned down, burning wrecks and big blasts, leaning with the clouds' wind, joining when close, lasting a few
  minutes (`WARFX.col`, at most 6/14/20/28 by Graphics step), thinner zoomed in and faint at their foot; **fires** that
  creep up to 2.4 tiles from a wreck over grass already scorched (trees burn higher) and die out, lighting the ground
  and buildings round them at night (`drawLightPool`); **ash and embers** drifting over a fight's 6-tile cells and
  settling over about two minutes; **shockwaves** (a ring of dust and light along the ground, `WARFX.shock`) from blasts of
  reach 1.5 or more (a Missile, Ringfall, a fuel blast, a nuclear blast) and along the Lance's line, with a flash over the
  area (none with reduced motion, and a fainter, slower ring).
- **Burning oil** (`js/warfx.js`, looks only). A building destroyed by force (`collapseFx` marks its collapse effect
  `burn`) that is in `WARFX.oil` burns (`wfxOil`): an Oil Pump for 210 s (its last 35 guttering out) then smoulders 240 s;
  a Refinery 100 s and 140 s; a Fuel Tank 120 s and 160 s. Drawn: a jet of flame from the wellhead (3.4 tiles high for a
  well, lower and wider for a tank), its own black smoke column pouring off the top of the flame (never joined with
  another), blackened ground and the charred wreck (a wellhead stump and fallen beam, a burst tank's shell), embers in
  it for a minute after. At dusk and night two light pools, flickering (`drawWfxOilLight`). Sound: `oilRoar` in
  `js/audio.js`, one voice on the Effects bus for all of them (the loudest on screen, panned to it, a little louder with
  more, at most 1.3×). A building put up on the spot puts it out in 3 s; nothing stops a rebuild.
- **Saves and lockstep.** `crater` and `ash` are saved sparse (`SPARSE_LAYERS`: tile and value pairs), the lists as they
  are; `checkSave` checks them all; `hashState` takes the blast count (`S.scarN`), every pile and the count of bones.
  `scarLevel()` is 0 for Off (no layers: `S.crater` and `S.ash` are null).

## Project layout

```
index.html, style.css     page, HUD and menus
js/util.js                RNG, noise, heap, helpers
js/defs.js                all game data and balance numbers (costs, timings, ranges)
js/world.js               map generation, game state, territory, placement rules, save/load
js/path.js                A* pathfinding
js/sim.js                 simulation: logistics, workers, production, combat
js/ai.js                  rival AI
js/contingency*.js        Contingency: the atlas table and outlines, the campaign's engine, the globe's drawing, its
                          screens and the bridge to battles
js/missions.js            mission campaign: goals, hand-placed map features, progress
js/orders.js              every player action as an order: a name and plain arguments, checked against the player
js/lockstep.js            multiplayer: every device runs the game, only orders travel (see Multiplayer below)
js/net.js                 multiplayer: the connection to the relay (rooms, reconnecting, catching up)
js/mpui.js                multiplayer screens: host, join, the lobby, the in-game banner, pause and leave
js/coop.js                shared colony co-op: the partner's cursor, pings, who-placed-what badges and log lines, roles
js/feedback.js            Send feedback: the form (main menu and pause menu) that posts to the relay's /feedback
js/goals.js               Colony goals, Records and achievements: read from the game, kept on the device (display only)
js/photo.js               photo mode: the interface hidden, a time-of-day slider and Save picture (a PNG of the map)
js/watch.js               Observer mode: computer colonies play while you watch, with a scout report and a camera that follows the fighting
js/scout.js               scout reports in your own games: what a computer rival starts doing, as a message with Go
js/blueprint.js           blueprints: a block of buildings and its roads kept on the device, placed again through orders
js/qol.js                 interface helpers: camera spots, recent alerts (J), goods a minute and warnings, save slots and Continue
js/polish.js              interface helpers: reach rings, health bars switch, +N popups, panel ?, Idle (,), Surrender, Rematch
js/polish3.js             the Daily Planet, multiplayer chat, Ready and colours in the lobby, who's reconnecting
js/charts.js              line and bar charts for the statistics screen
js/economy.js             the Economy panel: each good, the whole supply chain, bottlenecks, History; its map overlay
js/render.js              canvas renderer and placeholder art
js/daynight.js            day and night: the clock, re-lit art sets, grading, headlights, light pools
js/wildlife.js            the wildlife: animals on the map by biome and time of day, scattered by the fighting (looks only)
js/ambient.js             cloud shadows by day, remains that overgrow, the Command Bases' beacons by night (looks only)
js/sunset.js              sunsets and sunrises: each biome's dusk palette, long light, glints, motes, shafts (looks only)
js/warfx.js               the war on the land: smoke columns, creeping fires, ash and embers, shockwaves, the scars healing (looks only)
js/input.js               touch and mouse controls
js/ui.js                  HUD, build menu, info panels, objectives
js/audio.js               synthesized sound effects
js/main.js                boot and main loop
art/art-manifest.js       register custom art here
art/lore/                 the Lore guide's pictures (the planet, the atlas, the regions, the Murmur), and the menu planet's
                          face (ithaca-map.webp, the atlas made small)
art/globe/                the Contingency globe's surface (ithaca-2048.webp, ithaca-4096.webp) and clouds
art/menu/                 the Campaigns cards' pictures: 160 px crops of art/lore/ (inline in the one-file build)
art/town/                 Passenger Town's buildings (renderer/tools/install_town.py; town-art.js lists them): loaded only
                          for that map
tools/atlas/              atlas.py draws the atlas of Ithaca I (LORE.md) and the menu planet's face; globe.py its globe views;
                          globe_texture.py the Contingency globe's surface (art/globe/), globe_borders.py its outlines
tools/headless-sim.js     AI-vs-AI balance test without a browser
tools/smoke-test.js       browser test on a phone-sized screen (Playwright)
tools/menu-test.js        the main menu: every destination opens (two taps at most) and Esc / Back return (Playwright)
tools/build-single.js     bundles the code into dist/terrafall.html, and every picture into bundles beside it (so the page,
                          about 4 MB of code, stays far under its host's 16 MB a file): art-{buildings,bots,effects,other}.js
                          (loaded as the page starts: loadArt), biome-<b>.js (every biome's art but the Desert's, when
                          played: LAZY_BIOMES), murmur.js (the Murmur's, in a game with them), town.js (Passenger Town's buildings, on that map), tod-<time>.js (each time of
                          day's re-lit set) and lore.js (the Lore guide's pictures). Copied without its folder, the page
                          still runs, drawn in code.
relay/                    the multiplayer relay and player feedback: a Cloudflare Worker (deployed by .github/workflows/relay.yml)
```

Plain JavaScript, no build step and no dependencies. Balance tweaks mostly live in `js/defs.js`.

### Multiplayer

Two to four people play one game, each on their own phone, tablet or computer (any mix), with computer rivals
in any places left over. Everyone sees the whole map.

**Playing.** Main menu → **Multiplayer**. One person types their name and taps **Host a game**: the lobby shows a
five-character room code, and **Share** sends it (with a link that opens the game straight to it). The others type
their name and the code and tap **Join**. The host can **Change settings** (the usual new-game screen: map type,
biome, size, rules, how many colonies in all and how hard the computer rivals are), picks each computer place's
**doctrine** from its row in the lobby (pointing at a row, or tapping it, says in a line how that doctrine plays, and
How it plays opens the whole of it) and taps
**Start game**. In the game:

- The menu button (top right) opens the menu without stopping the game; **Pause the game for everyone** pauses all
  of you (anyone can resume). The game runs at one speed for everyone.
- **Your colour and Ready** (`js/polish3.js`, on a relay with the `prefs` cap): each player picks one of the four team
  colours in the lobby (`mp-colors`; one taken by someone else is disabled) and taps **Ready** (`mp-ready`); both go to
  the relay as `prefs {ready, color}` and come back in the lobby's seats. The host's **Start game** waits for everyone
  here to be ready (`mpReadyGate`: a second tap within 5 s starts anyway). At the start the host turns the picks into
  `settings.look` (`mpLook`: by colony, a pick where it's free in seat order, then the usual colours), and every device
  applies it in `mpOnStart` before the game is made (`applyLook`: `PLAYER_COLORS`, `RIVAL_NAMES`, `CALLSIGNS` and
  `TEAM_ART`, so `artFor` picks the team art `@<artTeam(owner)>`). The game itself never reads it (not in `hashState`);
  any other game wears the usual look (`lookTick`).
- **Chat** (`js/polish3.js`): in the lobby (`mp-chat`, relay `chat` cap) and in the game (**Enter**, or the round Chat
  button `btn-chat` on touch; Enter sends, Esc closes, Tab or **All/Team** picks who reads it when you have a teammate
  and a human rival). Lines are plain text (escaped, control characters dropped, 140 characters) sent as `chat
  {text, id, team?, to?}`; the last 40 are kept, the last 6 fade over the map. **Mute** (`terrafall.chatMute`) hides
  the others' lines and counts them on the button. Never an order, never in the game.
- **Pings** (`js/coop.js`) are team-only: they go to the people running your colony and your allies' players
  (`mpTeammates`), never to a rival, and a game with no teammate has none. **Alt+click** on the map or minimap, `.`
  under the pointer, a long press (550 ms) on the minimap, or **Ping** on the bar; three per 5 s (`PING_RATE`).
- If someone's connection drops, the others' games wait for it; after 12 seconds the computer runs that colony.
  The relay's presence (its `lobby` message, in a game too) marks who is reconnecting: the waiting banner says
  *Waiting for Sam (reconnecting)*, and *Sam reconnected.* when they're back (`mpPresence3`). The dropped device shows
  **Reconnecting…** (with the try count) while `net.js` retries by itself, then catches up from the relay's log.
  When the device comes back it catches up and the colony is handed back. A page that reloads (or a phone app that
  was closed) offers **Rejoin multiplayer game** on the main menu, and gets the game from the others. Rejoining a
  paused match keeps it paused. **Cancel** keeps the seat available for another attempt.
- **Leave the game** hands your colony to the computer for the rest of the game. A multiplayer game isn't saved for
  Continue.

**Teams (2 vs 2).** With four colonies in all (Crossroads, Pinwheel, Four Isles, Twin Valleys or Long Haul 2v2), the host can set **Teams: 2 vs 2** in the settings: the
two western colonies (south-west and north-west) play the two eastern ones (on Long Haul 2v2, where picking the map turns
Teams on, the two southern colonies play the two northern ones). The lobby shows the two teams, people
first and then computer players, and the host taps a person to move them to the other team (never more than two a
side). Allies never shoot, shell, raid or capture each other, their turrets and Flak leave each other alone, the
computer only goes after the other team. A computer ally can send spare Warbots against a raid on your land when its
own base is safe, using a garrison that can reach the raid. **Commands for a computer ally** (`js/ally.js`, the Ally panel: the bar's Ally button
or Shift+A, shown only with a computer colony on your team): Attack here (Q, then tap an enemy building, robot or
spot), Defend this area (G, then tap), Help me (H), Hold back (B), Ask for goods (a good's button) and Back to its own
plan (C), to one ally or all. Each is the order `allyCmd(to, kind, i, j, tid)` (`js/orders.js`), so co-op, 2v2 and
multiplayer stay in step; `allyCommand` in `js/ai.js` carries it out at once and answers in the ally's voice
(`ALLY_SAYS`) or says why not (no warbots to spare, ground it can't walk to, nothing of that good to spare, a supply
run still on its way). Attack and Help me: up to 20 spare warbots on a rally flag (`rally.target`/`first` at a
building), called home when it falls or after 150 / 120 s (more on a long march); Defend: half of what it can spare
(2 to 12) for 600 s, topped up every 30 s when down to half; Hold back: 600 s of no Missiles, nukes, marches or raids
(it still answers raids, `aiCounterRaid`), its own rallies recalled; goods: 30% of its stock above 15 (3 to 40, once
a minute per ally) leave its storage on a supply run (`S.allyShips`, 2 tiles/s, 15 to 90 s) to your storage nearest
its Command Base, drawn as a crate crossing the map. State: `P.allyCmd` (`atk`, `def`, `hold`), kept up by
`aiAllyCmds`; both it and `S.allyShips` are in `hashState` and the save. Numbers: `ALLY_CMD` in `js/defs.js`. Teams get mirrored neutral Trade Posts where the terrain
allows. A lone post is shared when both teams can reach it with similar effort. Long Haul 2v2 keeps its central post.
Tied AI turns rotate across teams, and the order in which units and guns act alternates across ticks. A team game is
won by **Capture**: take both enemy Command Bases and both colonies of your team win. A colony captured while its
teammate stands is down, not out, until its team captures the base back (see Fallen allies). Teams also work in a one-person game (Versus, **4 players**: you and a computer
ally against two computer rivals). Rules: `S.teams` (`[0, 0, 1, 1]`), with `foes(p, q)`, `allies(p, q)` and
`teamOf(p)` in `world.js`; without teams `foes` is just `p !== q`.

**Co-op: one colony, two players** (shared control, no fixed roles: the owner's design, Nov 2026). Two people run one
colony against the computer (Versus) or the planet alone (Colony), each on their own device. **Starting one:** Custom
Game → pick Versus or Colony and the rest → **Host a co-op game** (`m-coophost`: opens Multiplayer and hosts at once
when the name is known); the partner joins with the room code or link as usual and is listed as *co-op: shares
Tad's colony*. In the multiplayer settings **Co-op** (`UI.menu.coop`: Own colonies / Share my colony) says whether
people who join share the host's colony, and the host taps a person in the lobby to move them across (`UI.mpCoopOf`;
not with Teams). Colony mode in multiplayer is always co-op (Colony has one colony). Each person picks a **role** in
the lobby (Both, Economy, Military; `terrafall.role` on the device), which only filters which alerts pop up
(`coopQuiet`: Economy keeps the war's news in the message log, Military the colony's everyday news; losses and the
Command Base always pop up), never what they may do.
- **Seats**: the lobby's start (`mpHostStart`) seats the colonies first (the host's colony 0, then anyone with their
  own, then the computer's) and the people sharing the host's colony after them (`settings.coop`, `cols`, `coopCol`,
  `slotsN`); the relay takes up to eight places (`MAX_SLOTS`). Every device then sets `S.crew` (by lockstep player:
  `{ n: name, c: colony }`) from the start message. A person is still one lockstep player (`MP.me`: their own
  packets, drops, rejoins, fingerprints), but `ME` is their colony (`mpCol(p)`): orders are carried out for the colony,
  with the giver passed to `applyOrder(p, name, args, by)` (`ORDER_BY` while it runs), so a construction site it places
  remembers who (`b.by`, set in `addBuilding`, checked by `checkSave`, in `hashState` with `S.crew`). A shared colony
  is the computer's only once every person running it is dropped or gone (`mpSetAI`, `mpCrewOf`); if one leaves or
  drops out, the other keeps playing it. The rivals, victory, surrender and Teams see one colony, as before.
- **The partner's cursor and pings** are not game messages: `cur` (a few times a second, only when it moved) and
  `mark` go through the relay unnumbered and unlogged to the others (`MP.onPeer` → `coopPeer`), never into the game or
  its fingerprint. `.` pings the spot under the mouse, **Ping** on the bar (`btn-ping`, co-op only) the middle of the
  view: rings and a pin on the map and the minimap for 6 s, with the `ping` sound.
- **Who did what** (`MP.onOrder` → `coopOrder`): a partner's site placed, plans, research and dismantling go in the
  message log ("Sam placed a Smelter site"), army orders (moves, attacks, rallies, Missiles) pop up as alerts, and a
  badge with their name shows where their plans and orders went for 5 s. Each construction site has a badge with the
  placer's initial in their colour (`drawCoop`), and its panel says **Placed by**. **Dismantle** on something the
  partner placed less than `COOP_CONFIRM_S` (60 s of game time, from `b.born`) ago says who and asks for the second tap.
- Like any multiplayer game, a co-op game has no Boosts menu and isn't saved for Continue (a save of one, or a
  catch-up, carries `S.crew` and the badges).

**The relay.** The devices talk through a small relay server: `relay/`, a Cloudflare Worker with one Durable Object per
game room, free on Cloudflare's free plan. It's deployed from this repository by the **Deploy multiplayer relay**
workflow (`.github/workflows/relay.yml`, again on every push that changes `relay/`), and runs at
`https://terrafall-relay.tadellsworth.workers.dev` (`RELAY_DEFAULT` in `js/net.js`). A deploy that fails right after
the upload (Cloudflare not yet seeing a Worker it has just been sent: "This Worker does not exist on your account
[code: 10007]") is tried again after half a minute, and once more after a minute. Setting it up on another account:

1. Make a free Cloudflare account (dash.cloudflare.com/sign-up). Open **Workers & Pages** once: it asks you to pick
   your `workers.dev` subdomain.
2. Copy your **Account ID** (on the Workers & Pages overview, on the right).
3. **My Profile → API Tokens → Create Token → Edit Cloudflare Workers → Use template**, pick your account, then
   **Continue to summary → Create Token**, and copy the token (it's only shown once).
4. In this repository: **Settings → Secrets and variables → Actions → New repository secret**: add
   `CLOUDFLARE_API_TOKEN` (the token) and `CLOUDFLARE_ACCOUNT_ID` (the Account ID).
5. **Actions → Deploy multiplayer relay → Run workflow.** When it's done, its summary shows the relay's address,
   `https://terrafall-relay.<your-subdomain>.workers.dev` (opening it says *Terrafall relay: ok*).
6. Put that address in `RELAY_DEFAULT` at the top of `js/net.js` (as `wss://...`) and push: the published game then uses it. (To try
   it before that, open the game with `?relay=<address>` on the end of its web address: that device remembers it.)

The relay runs locally too: `cd relay && npx wrangler dev`, then open the game with `?relay=ws://127.0.0.1:8787`.

**Relay update for polish round 3 (redeploy needed).** The relay now says what it can do in `hello` (`caps:
['chat', 'prefs']`), keeps each seat's `ready` and `color` (the lobby message `prefs`; both are in the lobby's seats),
passes lobby `chat` lines to the others, and in a game passes `chat`, `mark` and `cur` unnumbered and unlogged, to the
players in `to` when given (a team's chat and pings never reach a rival's device); chat is cleaned and limited to 6
lines in 5 s a seat. Run **Deploy multiplayer relay** (or push a change to `relay/`) to put it live. Until then the game
works as before on the old relay: with no `caps` it hides Ready, the colour picker and lobby chat (the host starts as
before, everyone in their usual colours), and in-game chat goes as an ordinary numbered message (the old relay passes
anything in a game on), filtered for the team on each device. Old copies of the game on the new relay ignore the new
fields and messages. Tests: `node relay/test/room.test.mjs`.

**Player feedback.** The relay also takes the game's **Send feedback** form (`js/feedback.js`; see Send feedback above):
`POST /feedback` (`relay/src/feedback.js`, whose header has the exact contract) with JSON `{ type, text, contact?, meta?,
save?, shot?, website? }` answers 200 `{ ok: true, n }`, and each report becomes issue #n in a private GitHub repository,
labelled by type and `from-game`; an attached save is committed to `saves/` there and linked from the issue (load it
with Load a save file to play the bug back), and a picture of the map (a JPEG, PNG or WebP data URL up to 1 MB) to
`shots/`, shown in the issue. CORS is open (`*`). Other answers: 503 `{ why: 'off' }` until it is set up,
429 past 5 reports an hour or 20 a day from one address (counted by a hash of it, never stored), 400 for a text under
3 characters, 413 for a request over 9 MB, 502 if GitHub refuses it. Anything in the hidden `website` field marks a bot:
it is thanked and dropped. Setting it up: add two more Actions secrets, `FEEDBACK_REPO` (the private repository, as
`owner/name`) and `FEEDBACK_TOKEN` (a fine-grained GitHub token for that repository only, with Issues and Contents read
and write), then run **Deploy multiplayer relay** again: its summary says whether player feedback is on. Until then the
form says feedback isn't switched on yet, and keeps what the player wrote.

**Cloud saves.** The relay also keeps the games players save to the cloud (`relay/src/saves.js`, whose header has the
exact contract): `POST /save` (a gzipped save file, at most 256 KB, that gunzips to JSON with `terrafall: 1` and a
`game`) answers 201 `{ code, key, expires }`; `GET /save/<code>` (10 characters of the room-code alphabet, with or
without the dash, any case) the save file as `application/json` with `nosniff`; `PUT` and `DELETE /save/<code>` need
`Authorization: Bearer <key>`. Entries live in one SQLite-backed Durable Object (`Saves`, binding `SAVES`, migration `v3`
in `relay/wrangler.toml`): the gzipped body, a hash of the key, when it was written and its size. An entry expires 30
days after it was last written (dropped when asked for, and swept by a daily alarm). At most 20 writes and 200 reads a
day from one address (by a hash of it), and CORS for terrafall.app and www.terrafall.app (and `http://localhost` for
testing): another site gets 403. Nothing to set up beyond a run of **Deploy multiplayer relay**. Tests:
`node relay/test/saves.test.mjs` (Node 22.13 or later: the Durable Object's storage is played by `node:sqlite`).

**How it works.** Multiplayer is lockstep: every device runs the whole game, and only the players' orders go between
them.

- **Orders** (`js/orders.js`): everything a player does on the screens goes through `act(name, args, callback)` in
  `js/ui.js`, which runs one of the `ORDERS` (place a building, set a priority, send warbots, plan roads...). Each
  takes plain arguments (ids, numbers, tile lists), checks that what it's given belongs to the player who sent it,
  and gives back how it went; the screens say so in the callback. In a single-player game it runs at once.
- **Lockstep** (`js/lockstep.js`): time is cut into turns of 3 ticks (a tenth of a second). An order is sent for a
  turn a little way ahead (each device picks how far from its own round trip to the relay), and a turn starts only
  once every player's orders for it are in, so every device carries them out at the same tick. Once a second each
  device sends a fingerprint of its game (`hashState`); if they ever differ, the host sends its game to the device
  that went astray. A player who goes quiet for 12 seconds (or leaves) has their colony run by the computer, on every
  device from the same turn, until they're back (`rejoin`); a device with no game asks for it (`want`).
- **The relay** (`relay/src/index.js`): seats up to four players per room (up to eight places in a game: co-op
  partners come after the colonies), keeps the lobby, numbers every game message
  and hands it to every device in one order (that shared order is what keeps the decisions above the same
  everywhere), and keeps a log so a dropped connection picks up what it missed. **The connection** (`js/net.js`)
  reconnects by itself and sends big messages (a whole game) in pieces; **the screens** are `js/mpui.js`.
- **The same game everywhere**: no `Math.random` or clocks in the game; exact maths for angles and distances
  (`dsin`, `dcos`, `datan2`, `dhypot` in `js/util.js`, the same on every browser and phone); `ME` is the player at
  this device (messages, sounds, what the screens show), while the rules only ask whether a player is a person or
  the computer (`human`). Saves (and a game sent between devices) are taken at the start of a whole second.

### Testing

```bash
node tools/headless-sim.js 12345 normal 40
```

Optional extra arguments: mode (`versus`/`colony`), map size (0–3), terrain (0–4) and resources (0–4):

```bash
node tools/headless-sim.js 11 normal 45 versus 1 3 2
```

```bash
node tools/headless-sim.js 99 normal 40 colony
```

```bash
node tools/horde-test.js normal 40 4242 fixed --fort
```

```bash
node tools/workforce-test.js
node tools/workforce-lockstep-test.js
```

The Workforce ladder: a colony set up the same way every time (a Colony game the computer plays for 10 minutes, no
rival and the Murmur off, then its raw goods topped up, two finished Cement Works with no stock limit and two building
sites added; `node tools/workforce-test.js [seed] [minutes]`, every check runs on any seed) copied into side-by-side
games with different settings (Auto untouched,
Manual order, caps, minimums, pins and Keep staffed, Rebalance, a save and load, builders kept free, minimums with
nobody free, a pinned factory at its stock limit, the player's own presets), then two devices over the lockstep
changing the settings all game, one reloading halfway, their fingerprints compared every second.

```bash
node tools/massdriver-test.js
```

The Mass Driver line: goods both ways between a Driver and its Catcher, automatic supply of the far end with no goods
list, a 50-tile line across the sea on Islands (allowed on Sky islands and Four Isles, not in the Hollow), a goods list
overriding Auto, an Outpost kept in Ammo, a rival's Flak bursting a canister, an old one-way save loading, and the
measured pace over 30 tiles.

```bash
node tools/smoke-test.js http://localhost:8000/ .
```

```bash
node relay/test/saves.test.mjs
node relay/test/room.test.mjs
```

The first two play complete AI-vs-AI games (or an AI colony) in a few seconds and print the economy
each minute. The smoke test needs Playwright and a running local server. The last two test the relay's cloud saves and its rooms'
chat, Ready and colours (see Multiplayer, Cloud saves).

## Ideas for next steps

See [IDEAS.md](IDEAS.md) for ideas waiting their turn.

- Multiplayer and save export/import
- Custom art for goods icons, menus and effect sprite sheets (ART_GUIDE Batch 15)
