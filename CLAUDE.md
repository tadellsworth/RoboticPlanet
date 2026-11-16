# Working on Terrafall

Standing rules from the owner, for every change to the game:

- **Keep the in-game How to play current.** It is the `#screen-help` block in `index.html` (a contents list with
  jump links at the top, then one `<section id="hs-…">` per topic). Any change that adds, removes or alters something
  a player sees or does (a building, robot, rule, number, key, button, map, mode) updates the matching section in
  the same commit. `node tools/help-coverage-test.js` fails when a
  buildable building or available robot is not mentioned there, or when a contents link has no section.
- **Keep the Missions current.** The Missions (`js/missions.js`) are the tutorial: they start with the very basics and
  teach every mechanic chapter by chapter. A new mechanic gets a goal in a fitting mission (or a new mission), and a
  changed one gets its hints and texts fixed. Each goal's `hint` names the real buttons and keys, and its `ui` selector
  lights up the button it needs.
- **Keep the docs current:** README.md (the reference), the how-to-play guide (`how-to-play.html`: edit
  `tools/guide/template.html`, then `python3 tools/guide/build.py`), ART_GUIDE.md for art, IDEAS.md for open questions.
- **The story is canon in LORE.md** (the owner's lore bible: Ithaca I, the four vanguards, the Murmur, the Silence).
  Text that touches the setting (briefings, flavor lines, names) follows its tone and vocabulary; don't contradict it,
  and never state Earth's fate outright. Changes to the canon come from the owner.
- Commit and push to both the working branch and `main`; never open pull requests.
- Never put model names in commits or code.

Layout: plain browser JS, no build step for development (`index.html` loads `js/*.js`); `node tools/build-single.js`
writes the one-file build in `dist/`. Simulation: `js/sim.js` (deterministic, multiplayer lockstep), map:
`js/world.js`, rival AI: `js/ai.js`, interface: `js/ui.js`, sound: `js/audio.js`, numbers: `js/defs.js`.
