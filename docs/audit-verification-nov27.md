# Audit verification, Nov 27 2026

Five partial audits (docs consistency, missions, keyboard shortcuts, lore, phone layout) were written on
`origin/codex/working-branch`. Each finding was checked against the code on `main` (by symbol; the audits' line
numbers are stale), then fixed if real. Only text, mission hints and selectors, panel key bindings and phone CSS
changed: no game rule or number. `hashState` after two AI-vs-AI games (seed 777, 2 colonies; seed 31, 4 colonies;
hard, 25 minutes, sampled every 5) is identical before and after.

Verdicts: **Confirmed** (true as stated, fixed), **Partly right** (what is actually true is said), **Wrong**.

## Findings

| Audit | Claim | Verdict | Evidence | Fix |
| --- | --- | --- | --- | --- |
| Docs | Help and guide say everything inside a nuclear blast is wiped out, but some buildings survive. | Confirmed | `nukeImpact` (js/sim.js): a Command Base is left at 1 armor, Arrival City is knocked down (`cityDown`), anything on a Trade Post's ground is skipped (`calmB`). The help contradicted its own next paragraph. | `#hs-missiles` in index.html, the guide's nuclear paragraph and README's Nuclear race entry name the three exceptions. |
| Docs | The game-setup tooltip and README overview read as one megastructure per colony in all. | Confirmed (two places) | `megaBlocked` (js/world.js) refuses a second of the same type only. The `#m-mega-row` tooltip and README's Megastructures entry said "one per colony"; README's table rows (one per row, per type) and the help's "one of each per colony" were already right. | Both now say "one of each (type) per colony"; the tooltip's missing comma before "the Deep Core" fixed too. |
| Docs | The guide gives an old Deep Core AI trigger (30 minutes, Ore Mines dry). | Confirmed | `aiDeep` (js/ai.js) waits for `DEEP.aiAt` (1200 s, js/defs.js) and half the Core's Cement and Crystal in hand; the comment records the old rule. The in-game help already said 20 minutes. | Guide: "by a Generator near its Command Base once a game is 20 minutes in and it has half the Core's Cement and Crystal in hand". |
| Docs | The guide's Mass Driver far-end cap omits the larger keep amount. | Confirmed | `mdRoom` (js/sim.js): `max(MASSDRIVER.full, keep) - stock - in flight`. | Guide states the keep exception and that canisters in flight count. |
| Docs | Maglev raid help says a Terminal first, but rivals prefer a middle pylon. | Confirmed | `aiMagCut` (js/ai.js) sorts middle-third pylons of lines `AI_MAGCUT.long` (12 tiles) or longer first, then by score, where a Terminal (`term` 12) beats a pylon (`pylon` 7). The guide said the same and then contradicted itself. | Help and guide: "a pylon in the middle third of a line 12 tiles long or more first, else a Terminal, else another pylon"; the guide's stray duplicate sentence removed. |
| Docs | Capturing help says Outposts can't be knocked down, though missiles can destroy them. | Confirmed | `captureOnly` (js/sim.js) holds only the Command Base, Keeps and Arrival City at `missileFloor`; Outposts are destroyed like any building, as `#hs-missiles` itself says ("wrecks an Outpost"). | The Capturing paragraph now separates the two: Keeps and Command Bases only by capture (missiles stop at about a third of armor, `MISSILE_FLOOR` 0.35), Outposts also wrecked by a Missile or nuke. |
| Docs | The Workforce ladder list omits Other buildings. | Confirmed | `WF_ROWS` (js/defs.js) has `other`; `wfRowOf` (js/sim.js) puts every staffed building not in a named row there. The guide had the same gap. | Help and guide list "Other buildings (every other kind that takes a Worker)". |
| Docs | Nuclear help implies a direct hit destroys any Command Base, one's own or an ally's included. | Confirmed | `nukeImpact` pushes a base to `direct` only when `foes(m.owner, b.owner)`; otherwise it stays at 1 armor. | Help, guide and README say an enemy's Command Base, and that your own or an ally's only drops to 1 armor. The guide also said "lands on a Command Base": now "within 2 tiles" (`NUKE.direct`). |
| Docs | The guide's megastructure summary omits Arrival City's exception. | Confirmed | `captureOnly` includes `def.city`; `missileFloor` is 0 for it and `cityDown` knocks it out; `sh-mwreck` is not offered for it (`openBuildingSheet`). | Guide: "except Arrival City: nothing destroys it, it is only knocked down, and it has no Demolish it". |
| Docs | Reactivation fee rounding (each good rounded up) is not mentioned. | Confirmed | `megaFee` (js/sim.js): `Math.ceil(cost[g] * MEGA.fee)` per good. | Help and guide: "a quarter of each good, rounded up". |
| Missions | Chain Reaction's intro says a nuke flattens everything. | Confirmed | `nukeImpact`, as above. | Intro: "wrecks almost everything ... A direct hit destroys an enemy Command Base." |
| Missions | No Horde mission and no fallen-ally mission. | Confirmed (recommendation) | No mission sets `horde` or teams. Note: `fallTeams` (js/sim.js) is false whenever `S.mission` is set, so a fallen-ally mission needs a code change first. | None (owner's call: see Recommendations). |
| Missions | Cut and Fill's goals only exercise Flatten and Fill shallows, not Raise, Lower or Dig channel. | Partly right | The `levelled` goal counts `stats.tfup + stats.tfdown`, which Raise and Lower produce as well as Flatten (`completeEarthwork`), so those two tools already complete it. Dig channel (`stats.tfdig`) was never asked for. | Added one goal, "Dig 2 tiles of channel" (hint: Terraform → Dig channel, C; selector lights the card and the tool). README and the guide's mission line updated. |
| Missions | Under the Bloom's stage goal highlights the speed button while the hint is about Pulse Turrets. | Confirmed | `aeStageGoal` (js/missions.js) hard-coded `ui: '#btn-speed'`. | `aeStageGoal` takes an optional `ui`; Under the Bloom's lights Build → Defend → Pulse Turret. |
| Missions | Landing Zone's stage goal highlights the speed button while the hint is about guarding Generators. | Confirmed | Same helper. | Hint now names the control (Army, Q → Hold ground, G) and lights the Army button (`#btn-attack`) and `#ar-hold`. Also Seed Vault's stage-2 goal (hint names Generators and speed) now lights the Generator card as well as speed. Rain's (speed only) was right and is unchanged. |
| Missions | Goal selectors may exist in source without being reachable or visible at the right time. | Partly right (not a finding) | A fair caveat on the audit's own static check, with no concrete case. The two real mismatches it found are fixed above; the new selectors are ones other goals already light (`#ar-hold`, `.bcard[data-t='turret']`, `.bcard[data-tf='dig']`). | None. |
| Keys | L on a Maglev Terminal can hit Add a line when Rebuild the missing Terminal is also offered. | Confirmed | `renderMagSection` (js/ui.js) can show both `sh-magrebuild` and `sh-magline` (a Terminal with a missing far end and a free slot); both were L in `SHEET_KEYS`, and `sheetKeyButton` takes the first in table order, which is `sh-magline`. Suffixed ids (`sh-magrebuild1`, a second missing Terminal) have no key. | Rebuild is now **B**. Help and guide show (B) beside it. The suffixed ids still have no key (the first rebuild button does). |
| Keys | Other same-letter panel buttons need a context review. | Partly right | Done (every `SHEET_KEYS` id mapped to the function that renders it): two real clashes, below under "Found while verifying". The rest share a letter only across panels that never show together. | See below. |
| Lore | The Hollow opening says "No daylight below", but daylight falls down the breach shafts. | Confirmed | LORE.md (the Hollow): "The only daylight falls down the breach shafts"; help `#hs-hollow` says the same; `VOICE_LINES.hollow` (js/voice.js). | "Lander through the breach. Daylight only at the shafts. The ground is listening." (The voice is synthesized from the text, so no recording goes stale.) |
| Lore | The capture narration says the beaten colony's robots report for duty, but they shut down. | Confirmed (canon wording) | `eliminate` (js/sim.js) kills every robot of the beaten colony (`killBot`) and hands its built buildings to the captor (also on a surrender, and for a team colony that is only down). The line is quoted verbatim in LORE.md ("Your colony's voice"). | `NARRATOR.captured`: "Command authority transferred. Their buildings report for duty."; `NARRATOR.changed`: "{old}'s buildings now report to {by}."; the Lore screen's log line and a comment in `eliminate` to match. LORE.md is left to the owner (see Recommendations). |
| Phone | Robot-count labels clipped in the top bar at 390 x 844. | Confirmed | Touch emulation (hasTouch, isMobile, 390 x 844): `#pop` content 186 px in a 175 px box, centred (`.chip-btn` `justify-content: center`), so "WORKERS" lost its first letter. At 430 px it fit. | style.css, upright-phone block: `#pop` gap 6 px, padding 6 px, `justify-content: space-between`; labels' letter-spacing 0.06em. Now 185/185 px at 390, still fitting with a 66:40 clock. Screenshots below. |
| Phone | The restore point's age is cut off in the pause menu at 390 x 844. | Confirmed | "3:00 in game · just now" needs 208 px; the select was 218 px less 14 px padding and the arrow. At 430 px it barely fit, and a longer label ("12:00 in game · 12 min ago") would not. | style.css: below 500 px wide `#p-checkpoint-row` wraps, the list on its own line (322 px at 390), Restore under it. |
| Phone | Small touch targets (build tabs 31.75 px, Workforce arrows 34 px, Economy tabs 31.75 px). | Wrong | Under real touch emulation at 390 x 844 and 430 x 932 (`pointer: coarse` matches): build tabs 44 px high, Workforce arrows 44 x 44, Economy tabs 117-131 x 44-46. The audit measured with a mouse pointer, as it said. | None. |

## Found while verifying

| Where | Issue | Fix |
| --- | --- | --- |
| Keys: Trade Terminal panel | A damaged Trade Terminal shows **Repair** (`sh-fixbtn`, `refreshFix`) beside **Escort** (`sh-escort`, `renderTrade`); both were E, and Repair, first in the table, won, so E never toggled Escort there. | Escort is now **O** (escOrt). Help, guide and the Trade mission's hint say O. |
| Keys: incoming-nuke card | **Evacuate** (`nk-evac`, V) sits on the nuke card, outside the panels, but `sheetKeyButton` only ran with a panel open: with none open V opened Ramps instead, though Chain Reaction's intro says "press Evacuate (V)". With the Army panel open, V hit Evacuate rather than **Station** (`nk-evac` comes before `ar-station` in the table); with a Command Base open, V stationed warbots. | `LOOSE_SHEET_KEYS` (js/ui.js): Evacuate's V works with no panel open, and with one open only if that panel has no V button of its own (nor the build menu's tab a card on V). Checked in a browser: V with no panel clicks Evacuate; with the Army panel V is Station. Help and guide show (V); README notes it. |
| Docs | The guide also lacked the Workforce Other buildings row and the friendly-nuke rule (the audit cited the help only). | Fixed with those findings. |
| Design doc | CAMPAIGN.md (the Herald) also says "Its captured robots report for duty". | Not changed (a design note, not player text); listed for the owner. |

## What the audits left unchecked

- Docs: only the passages the audit names were compared; most numbers in index.html, the guide and README are still
  unverified against `js/defs.js`. The audit says so itself.
- Missions: no goal was played through; only start-up (the audit) and data checks (`tools/mission-data-test.js`).
  Selector visibility at the moment a goal is shown is unverified apart from the selectors touched here.
- Keys: build-menu letters against `BUILD_KEYS`, Shift keys, Terraform tool letters and observer keys were listed but
  not checked for clashes with their own contexts; this pass checked panel buttons (`SHEET_KEYS`) only.
- Lore: a keyword search for Earth's fate only; briefings, flavor lines (`flavorLine`), toasts and doctrine voices were
  not read against LORE.md.
- Phone: only the top bar, pause menu, build tabs, Workforce and Economy were measured under touch emulation; panels
  such as Army, the Bot Foundry list, How to play and Custom Game were seen only in the audit's mouse screenshots.
  Landscape phones were not checked.

## Recommendations for the owner

1. A Horde tutorial: no mission teaches waves, side tunnels or the boss cadence (`HORDE`).
2. A fallen-ally mission: it needs `fallTeams` to allow a mission first (it is off whenever `S.mission` is set).
3. LORE.md's "Rival base captured" line ("Their robots report for duty") no longer matches the game, where the
   beaten colony's robots shut down; the game now says "Their buildings report for duty". Confirm or replace it in
   the canon (and CAMPAIGN.md's Herald note).
4. A second missing Terminal's Rebuild button (`sh-magrebuild1`, `sh-magrebuild2`) has no key; only the first has B.

Screenshots (deviceScaleFactor 2, touch emulation): `before-*` and `after-*` of the top bar, pause menu, Economy and
Workforce at 390 and 430 px, kept outside the repository with this pass's scratch files.
