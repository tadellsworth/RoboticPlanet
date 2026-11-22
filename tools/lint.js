#!/usr/bin/env node
'use strict';
/*
 * Terrafall lint: the mechanical mistakes this project keeps making, found without a model. Run from the repository
 * root: `node tools/lint.js`. Exit code 1 if anything is found.
 *
 *  1. A global name defined twice. All the scripts share one scope, so the second definition silently replaces the first.
 *  2. Hidden randomness or clocks in the simulation files (util, defs, world, path, sim, ai, missions, orders, and
 *     Contingency's engine, whose runs replay from their seed): every
 *     device in a multiplayer game must compute the same thing. Use the seeded helpers (rnd/hash2/dsin...) there.
 *     A line that says `lint-ok` in a comment is let through (a display-only use).
 */
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'js');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort();
const SIM = new Set(['util.js', 'defs.js', 'world.js', 'path.js', 'sim.js', 'ai.js', 'missions.js', 'orders.js', 'contingency-atlas.js', 'contingency.js']);
const BANNED = [[/\bMath\.random\s*\(/, 'Math.random'], [/\bDate\.now\s*\(/, 'Date.now'], [/\bperformance\.now\s*\(/, 'performance.now'], [/\bnew Date\s*\(/, 'new Date']];
const KNOWN_DUPLICATES = new Set(['roundRect']); // (two harmless copies, one per canvas helper)
const problems = [];
const seen = new Map();

for (const f of files) {
  const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n');
  lines.forEach((line, i) => {
    const m = /^(?:async\s+)?(?:function\*?\s+([A-Za-z0-9_$]+)|(?:const|let|var)\s+([A-Za-z0-9_$]+))/.exec(line);
    if (m) {
      const name = m[1] || m[2];
      if (seen.has(name) && !KNOWN_DUPLICATES.has(name)) problems.push(`duplicate global "${name}": ${f}:${i + 1} and ${seen.get(name)}`);
      else seen.set(name, `${f}:${i + 1}`);
    }
    if (!SIM.has(f) || /lint-ok/.test(line)) return;
    const code = line.replace(/\/\/.*$/, '').replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '""');
    for (const [re, label] of BANNED) if (re.test(code)) problems.push(`${label} in a simulation file: ${f}:${i + 1}: ${line.trim().slice(0, 100)}`);
  });
}
if (problems.length) { console.log(problems.join('\n')); console.log(`\n${problems.length} problem${problems.length > 1 ? 's' : ''}.`); process.exit(1); }
console.log(`lint: ${files.length} files, no problems.`);
