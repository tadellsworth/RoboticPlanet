#!/usr/bin/env node
// Keeps the in-game How to play (#screen-help in index.html) current with the game: every building a player can
// build and every robot they can make is named in it, every contents link has its section, every section ends with
// a "Back to top" link, and nothing quotes a fixed number of missions. Run: node tools/help-coverage-test.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Set, Map, Array, Object, Number, String };
vm.createContext(ctx);
vm.runInContext(['util.js', 'defs.js'].map((f) => fs.readFileSync(path.join(root, 'js', f), 'utf8')).join('\n') +
  '\n;this.__ = { BDEFS, BOTS, BOTS_OFF, BUILD_MENU };', ctx);
const { BDEFS, BOTS, BOTS_OFF, BUILD_MENU } = ctx.__;

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const a = html.indexOf('<div id="screen-help"'), b = html.indexOf('id="h-close"', a);
if (a < 0 || b < 0) { console.log('FAIL could not find #screen-help in index.html'); process.exit(1); }
const help = html.slice(a, b);
const text = help.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').toLowerCase();

let fails = 0;
const check = (name, ok, info) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || info === undefined ? '' : '  ' + JSON.stringify(info))); };

// Every building in the build menu, and every robot that isn't switched off, by name.
const missingB = BUILD_MENU.filter((t) => BDEFS[t] && !text.includes(BDEFS[t].name.toLowerCase())).map((t) => BDEFS[t].name);
check('every building in the build menu is named', !missingB.length, missingB);
const missingR = Object.keys(BOTS).filter((k) => !BOTS_OFF.has(k) && !BOTS[k].wild && !text.includes(BOTS[k].name.toLowerCase())).map((k) => BOTS[k].name);
check('every robot and vehicle you can make is named', !missingR.length, missingR);

// Contents links and sections.
const ids = new Set([...help.matchAll(/<section[^>]*\sid="([^"]+)"/g)].map((m) => m[1]));
const jumps = [...help.matchAll(/data-jump="([^"]+)"/g)].map((m) => m[1]);
const toc = (help.match(/<nav class="help-toc">([\s\S]*?)<\/nav>/) || [])[1] || '';
const tocIds = [...toc.matchAll(/data-jump="([^"]+)"/g)].map((m) => m[1]);
check('there is a contents list with links', tocIds.length >= 8, tocIds.length);
const broken = jumps.filter((j) => j !== 'hs-top' && !ids.has(j));
check('every jump link has its section', !broken.length, broken);
check('the top of the help has its anchor (hs-top)', /id="hs-top"/.test(help));
const notInToc = [...ids].filter((id) => !tocIds.includes(id));
check('every section is in the contents', !notInToc.length, notInToc);
const sections = [...help.matchAll(/<section[^>]*\sid="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)];
const noTop = sections.filter((m) => !/data-jump="hs-top"/.test(m[2])).map((m) => m[1]);
check('every section ends with a Back to top link', !noTop.length, noTop);

// No fixed count of missions (the campaign grows).
check('no fixed number of missions is quoted', !/\b(eight|8) (set )?(missions|challenges)\b/.test(text));

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
