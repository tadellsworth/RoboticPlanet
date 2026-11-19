## The owner's ideas, filed Nov 19 2026

(To be folded into IDEAS.md, section "Held for later", by a later session. Tasks #327 to #338 track them.)

Roadmap order the owner set: finish the new transit items, **add all the new megastructures and other units, then a
complete game-balance audit** (every unit and building has a defined, useful purpose, nothing over- or underpowered),
and only **then revamp the Missions** (to use the new units) and **then the Main Campaign**. Quick fixes can go any time.

**Quick fixes (small, cheap; do these first when usage is short)**
- **Maglev pods are made only at a Maglev Terminal,** not in the Bot Foundry or any other yard (check the Foundry's order list
  and the Air/Army menus: `BOTS.magpod` must not appear there).
- **No "Pipe to Terminal" button on an Oil Pump with a Refinery right beside it:** the conveyor join to adjacent
  production buildings already feeds it (the button is noise). Show it only when no Refinery or Fuel Tank touches the pump.
- **Tone down the road trucks' smoke and brake noise** (the exhaust puffs on Freight Trucks and Road Trains, and the
  brake squeal in `js/audio.js`): a little quieter and less constant.
- **Dropped goods from a dismantled building go first to Haulers:** crates left by Dismantle are picked up before other
  loose goods (priority in the Hauler's pickup choice, `doLoot`/`lootNear` and the Hauler job order).
- **The main base beacon doesn't go so far up the screen at night:** shorter, dimmer beam (the Command Base's beam in
  `js/daynight.js`/`js/render.js`); it fills too much of the view.
- **Night lights: fewer bugs and less clutter** (the moths, fireflies and lamp insects round lights at night; see
  `js/wildlife.js` `light:` kinds): fewer, smaller, and none on phone/Saver.
- **Change the AI's difficulty mid-game** (a setting on the pause menu; rivals' difficulty is read from `P.diff`;
  lockstep: it must be an order so every device agrees, and a note in a multiplayer game).
- **The Deep spouts more Murmur the nearer it is to death** (the Hollow's mound: raise its exit/pack rate and size as its
  armor falls; `aiMurmur`/the nest code in js/sim.js; a last-stand surge).
- **A rolling autosave to go back to:** the game autosaves every minute after 5 (task #114), but the owner wants a list
  of recent restore points (say the last 5, one a minute) on the pause menu to undo a mistake and try again. Check
  what exists first (`autosave` in js/main.js or js/ui.js) and extend it to keep several slots.

**Maglev follow-ups (medium)**
- **Losing a Terminal doesn't lose the whole line:** today a destroyed Terminal takes the line, its pylons and its pods
  with it (a lot of money in one blow). Instead the line, pylons and pods stay (the pods wait stopped; rebuild the
  Terminal on the same tile and the line resumes), or at least the pylons stay and refund part.
- **Maglev lines can be strung together** (a route of stops): a Terminal may join two lines (a hub), or a line may bend at
  a relay pylon/Terminal, so a route can go round places a straight line can't reach (the owner: pylons can't always go
  where they want). Pods carry on through a hub or change there. See "lines of more than two Terminals" in the Maglev notes.
- **Easier line placement, and pylons over roads:** pylons may stand ON roads (and track), drawn at the side of the road
  so no road has to be taken up and rebuilt; a clearer preview, and nudging a bad pylon spot a tile instead of failing
  the whole line. (Currently a pylon never stands on a road or track: relax that rule; the road stays open.)

**Murmur: a bigger rework (after the megastructures and the audit, before the campaign)**
- **Smarter Murmur:** they sometimes walk straight past robots that then shoot them; fix their threat and target choice
  (avoid or engage, don't ignore armed robots in reach).
- **Late game: an almost unending horde,** growing with the colonies' power (the theme below).
- **A massive endgame unit, a behemoth,** the biggest Murmur form (its own art and abilities).
- **Much smarter, more aggressive planning:** by late game, if you haven't knocked out their tunnels they hunt you and
  sabotage every weak point in your base (the Phase 1+2 "crafty" Murmur is the base to build on).

**Game setup and structure**
- **Megastructures are an enable-able checkbox on game setup,** like Nuclear race (default off?), so games without them stay as
  now. (Applies to the whole megastructure list; the Maglev and Express highway are ordinary buildings, not gated.)
- **A truly global map, a size above Huge,** for those who want an enormous battle, maybe with TWO biomes in it that slowly
  crossfade into each other across the map (a new map type; mind generation time and performance).

**New content**
- **Biome: Boiling Springs.** A geothermal basin: vibrant, mineral-hued hot springs and steaming geysers among
  sulfur-stained limestone terraces (colours: turquoise, ochre, rust-orange, white sinter; steam; its own plants,
  animals, ambience, night glow). A standard biome entry (`BIOMES`, ART_GUIDE, a lazy `biome-*` bundle).
- **Biome: Tropical, selectable on naval maps,** with **sea life on all naval maps:** dolphins, fish that jump, the
  occasional whale spout (render-only scenery like the fauna; never blocks ships).
- **Lava maps: steam vents and livelier lava:** steam plumes and vents on any lava map (Volcano, Cinderlands, Fault Line),
  and animated lava tiles (slow flowing/pulsing, crust cracks, glow) so it looks alive. Render-only, Saver off.
- **Robotic dialogue, spoken at the start of each game and now and then** (generated audio): a robotic language we can't
  understand with subtitles ("Execute directives", "Directive acknowledged", etc.), in the voice of the colony's machines;
  a subtitle line on screen; an Ambience/Voice volume setting and an off switch. Tone per LORE.md (the Accord's orders, the
  contingency orders, COBALT); never states Earth's fate.

**Fauna and the living world** (the owner; pairs with "Fauna: better looks and movement" and "Total war scars the land")
- **Every biome gets at least two land animals and one bird** that move about (check each in `js/wildlife.js`: some have
  only one kind; the Rust has lizards and a hawk).
- **The Bloom: new, stranger creatures** in place of the floating jellyfish-like floaters (the owner doesn't care for
  them): think of weirder native life (design sheet first).
- **The swamp (Blackwater): alligators or turtles.**
- **Rework the deer and the wildebeest/herds** to look more realistic (models and motion).
- **Development pushes animals out:** roads and buildings displace the animals: they leave the land a colony builds on and
  its edges, so habitat shrinks as the colonies grow (and war damage, the war-scars idea). Render-only scenery (animals
  are not in `S`), but the move-away must be steady and cheap.
- **The somber theme** (the owner's direction; for LORE.md when they confirm the wording, since LORE.md is the canon):
  the war is also the suffering of the planet and its animals, a meaningless robot-versus-robot war on behalf of humans
  who will never arrive; and the Murmur were mostly held in homeostasis until the robots came and brought tremendous
  energy to the planet, which feeds the Murmur and makes them ever more dominant. This fits the lore's "the war feeds
  them" and the Leech's power-draining; check wording so it never states Earth's fate outright ("humans who will never
  arrive" hints at it: ask the owner before it goes into LORE.md or the game's text).
