// Packs the game into one self-contained HTML file (dist/terrafall.html): CSS, scripts and any
// custom art listed in art/art-manifest.js are all inlined. Handy for sharing the game as a
// single file or hosting it anywhere. Usage: node tools/build-single.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let html = read('index.html');

// Inline custom art as data URIs.
const manifestSrc = read('art/art-manifest.js');
const sandbox = {};
vm.runInNewContext(manifestSrc.replace('const ART_MANIFEST', 'this.ART_MANIFEST'), sandbox);
const manifest = sandbox.ART_MANIFEST || {};
const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
// The newer biomes' art goes in a bundle of its own beside the page (dist/biome-<b>.js, loaded when that
// biome is wanted: see ensureBiomeArt), so the page stays small; its manifest entries stay, without the data.
const LAZY_BIOMES = ['jungle', 'polar', 'autumn', 'savanna', 'swamp', 'volcanic', 'lunar', 'alien', 'springs', 'tropical', 'hollow']; // (as js/render.js: every biome but the Desert)
const lazyBiomeOf = (key) => LAZY_BIOMES.find((b) => key.endsWith('-' + b) || key.startsWith('plant-' + b + '-')) || null;
// The Murmur's art goes in a bundle of its own too (dist/murmur.js: the day art and each time of day's re-lit set,
// loaded in a game with the Murmur: see ensureMurmurArt), its manifest entries likewise left without the data.
const murmurArtKey = (key) => /^(scuttler|brute|leech|spitter|sapper|harrow)-|^fx-spit/.test(key); // (as js/render.js: MURMUR_ART)
// The atlas landmarks' art likewise (dist/landmarks.js: loaded in a Contingency battle with a landmark: ensureLandmarkArt).
const lmArtKey = (key) => /^lm-/.test(key); // (as js/landmarks.js: LANDMARK_ART)
// Every other image goes in one of four bundles beside the page too (dist/art-<group>.js: buildings, bots, effects, and
// the rest: tiles, resources, roads, rail, bridges, the canyon, pipes, markers and the Desert's biome art), all loaded as
// the page starts (see loadArt), so the page holds the code alone and can't fill up again as art is added.
const ART_GROUPS = ['buildings', 'bots', 'effects', 'other'];
const artGroupOf = (src) => { const d = src.split('/')[0]; return ART_GROUPS.includes(d) ? d : 'other'; };
const inlined = {}, biomeData = {}, murmurData = { day: {}, morning: {}, evening: {}, night: {} }, lmData = { day: {}, morning: {}, evening: {}, night: {} }, artData = {};
for (const key of Object.keys(manifest)) {
  const entry = typeof manifest[key] === 'string' ? { src: manifest[key] } : { ...manifest[key] };
  const file = path.join(root, 'art', entry.src);
  if (!fs.existsSync(file)) { console.warn('missing art file, skipped:', entry.src); continue; }
  const data = `data:${mime[path.extname(file).toLowerCase()] || 'image/png'};base64,${fs.readFileSync(file).toString('base64')}`;
  const lb = lazyBiomeOf(key);
  if (lb) { (biomeData[lb] = biomeData[lb] || {})[key] = data; entry.src = ''; } else if (lmArtKey(key)) { lmData.day[key] = data; entry.src = ''; } else if (murmurArtKey(key)) { murmurData.day[key] = data; entry.src = ''; } else { (artData[artGroupOf(entry.src)] = artData[artGroupOf(entry.src)] || {})[key] = data; entry.src = ''; }
  inlined[key] = entry;
}
let biomeBytes = 0, artBytes = 0;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
for (const g of ART_GROUPS) {
  const js = `window.ART_DATA = window.ART_DATA || {};\nwindow.ART_DATA[${JSON.stringify(g)}] = ${JSON.stringify(artData[g] || {})};\n`;
  fs.writeFileSync(path.join(root, 'dist', `art-${g}.js`), js);
  artBytes += js.length;
}
for (const b of LAZY_BIOMES) {
  const js = `window.BIOME_DATA = window.BIOME_DATA || {};\nwindow.BIOME_DATA[${JSON.stringify(b)}] = ${JSON.stringify(biomeData[b] || {})};\n`;
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist', `biome-${b}.js`), js);
  biomeBytes += js.length;
}

const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const code = scripts.map((src) => (src === 'art/art-manifest.js'
  ? `const ART_MANIFEST = ${JSON.stringify(inlined)};`
  : read(src))).join('\n;\n');

// Day and night: each time's re-lit sprites go in a bundle beside the page (dist/tod-<time>.js, loaded
// when that time comes round); the headlights and light pool are small enough to go inline.
const [todKeys, murmurTodKeys, lmTodKeys] = (() => { const sb = {}; vm.runInNewContext(read('art/tod/tod-keys.js').replace('const TOD_KEYS', 'this.TOD_KEYS').replace('const MURMUR_TOD_KEYS', 'this.MURMUR_TOD_KEYS').replace('const LANDMARK_TOD_KEYS', 'this.LANDMARK_TOD_KEYS'), sb); return [sb.TOD_KEYS || [], sb.MURMUR_TOD_KEYS || [], sb.LANDMARK_TOD_KEYS || []]; })();
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
let todBytes = 0;
for (const t of ['morning', 'evening', 'night']) {
  const data = {};
  for (const key of todKeys) {
    const e = manifest[key], src = e && (typeof e === 'string' ? e : e.src);
    const file = src && path.join(root, 'art/tod', t, src.replace(/\.(png|webp)$/, '.webp'));
    if (file && fs.existsSync(file)) data[key] = `data:image/webp;base64,${fs.readFileSync(file).toString('base64')}`;
  }
  const js = `window.TOD_DATA = window.TOD_DATA || {};\nwindow.TOD_DATA[${JSON.stringify(t)}] = ${JSON.stringify(data)};\n`;
  fs.writeFileSync(path.join(root, 'dist', `tod-${t}.js`), js);
  todBytes += js.length;
  for (const key of lmTodKeys) {
    const e = manifest[key], src = e && (typeof e === 'string' ? e : e.src);
    const file = src && path.join(root, 'art/tod', t, src.replace(/\.(png|webp)$/, '.webp'));
    if (file && fs.existsSync(file)) lmData[t][key] = `data:image/webp;base64,${fs.readFileSync(file).toString('base64')}`;
  }
  for (const key of murmurTodKeys) {
    const e = manifest[key], src = e && (typeof e === 'string' ? e : e.src);
    const file = src && path.join(root, 'art/tod', t, src.replace(/\.(png|webp)$/, '.webp'));
    if (file && fs.existsSync(file)) murmurData[t][key] = `data:image/webp;base64,${fs.readFileSync(file).toString('base64')}`;
  }
}
const murmurJs = `window.MURMUR_DATA = ${JSON.stringify(murmurData)};\n`;
fs.writeFileSync(path.join(root, 'dist', 'murmur.js'), murmurJs);
const lmJs = `window.LANDMARK_DATA = ${JSON.stringify(lmData)};\n`;
fs.writeFileSync(path.join(root, 'dist', 'landmarks.js'), lmJs);
const todShared = {};
for (const f of fs.readdirSync(path.join(root, 'art/tod/shared'))) {
  if (f.endsWith('.webp') && f !== 'light-pool.webp') todShared[f.replace('.webp', '')] = `data:image/webp;base64,${fs.readFileSync(path.join(root, 'art/tod/shared', f)).toString('base64')}`;
}

// The Lore guide's pictures (#screen-lore: data-src, made each img's src when the guide first opens) go in a
// bundle of their own beside the page (dist/lore.js, loaded when the guide first opens: see openLore).
let loreBytes = 0, loreN = 0;
const loreData = {};
for (const m of html.matchAll(/data-src="(art\/[^"]+)"/g)) {
  const src = m[1], file = path.join(root, src);
  if (loreData[src]) continue;
  if (!fs.existsSync(file)) { console.warn('missing Lore image, skipped:', src); continue; }
  const d = fs.readFileSync(file); loreBytes += d.length; loreN++;
  loreData[src] = `data:${mime[path.extname(file).toLowerCase()] || 'image/png'};base64,${d.toString('base64')}`;
}
fs.writeFileSync(path.join(root, 'dist', 'lore.js'), `window.LORE_DATA = ${JSON.stringify(loreData)};\n`);

// Passenger Town's buildings (art/town: the list, town-art.js, and its pictures) go in a bundle of their own beside the
// page (dist/town.js, loaded for a Passenger Town map: see ensureTownArt in js/city.js).
let townBytes = 0;
{
  const sb = { window: {} };
  vm.runInNewContext(read('art/town/town-art.js'), sb);
  const A = sb.window.TOWN_ART, data = {};
  for (const f of fs.readdirSync(path.join(root, 'art/town'))) if (f.endsWith('.webp')) data[f.replace('.webp', '')] = `data:image/webp;base64,${fs.readFileSync(path.join(root, 'art/town', f)).toString('base64')}`;
  const js = `window.TOWN_ART = ${JSON.stringify({ ...A, data })};\n`;
  fs.writeFileSync(path.join(root, 'dist', 'town.js'), js);
  townBytes = js.length;
}

// The Contingency globe's surface (art/globe/: js/contingency-draw.js) goes in two bundles beside the page too: globe.js
// (the 2048 picture and the clouds, fetched when Contingency first opens) and globe-hd.js (the 4096 one, only on a big or
// sharp screen).
let globeBytes = 0;
for (const [file, names] of [['globe.js', ['ithaca-2048.webp', 'ithaca-clouds.webp']], ['globe-hd.js', ['ithaca-4096.webp']]]) {
  const data = {};
  for (const n of names) data['art/globe/' + n] = `data:image/webp;base64,${fs.readFileSync(path.join(root, 'art/globe', n)).toString('base64')}`;
  const js = `window.GLOBE_DATA = Object.assign(window.GLOBE_DATA || {}, ${JSON.stringify(data)});\n`;
  globeBytes += js.length;
  fs.writeFileSync(path.join(root, 'dist', file), js);
}

// The build number (index.html's terrafall-build tag, "dev" in the repository): this commit's short hash and the date,
// as the publishing workflow writes it, marked as the one-file build (Send feedback names it).
let build = '';
try { build = require('child_process').execSync('git rev-parse --short=7 HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { build = ''; }
build = `${build || 'dev'} ${new Date().toISOString().slice(0, 10)} one-file`;
html = html.replace('<meta name="terrafall-build" content="dev">', `<meta name="terrafall-build" content="${build}">`);

// The menu planet's face (art/lore/ithaca-map.webp, the atlas made small: js/menuplanet.js) is small enough to go inline.
const ithacaMap = `data:image/webp;base64,${fs.readFileSync(path.join(root, 'art/lore/ithaca-map.webp')).toString('base64')}`;
// ...and so are its clouds (the Contingency globe's, art/globe/ithaca-clouds.webp, 13 KB).
const ithacaClouds = `data:image/webp;base64,${fs.readFileSync(path.join(root, 'art/globe/ithaca-clouds.webp')).toString('base64')}`;

// The main menu's Campaigns pictures (art/menu/: small crops of the Lore guide's art) are small enough to go inline too.
html = html.replace(/src="(art\/menu\/[a-z0-9-]+\.webp)"/g, (m, src) => `src="data:image/webp;base64,${fs.readFileSync(path.join(root, src)).toString('base64')}"`);

const icon = `data:image/png;base64,${fs.readFileSync(path.join(root, 'icons/favicon-32.png')).toString('base64')}`;
html = html
  .replace(/<link rel="manifest"[^>]*>\n/, '')
  .replace(/<link rel="apple-touch-icon"[^>]*>\n/, '')
  .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="${icon}" type="image/png">`)
  .replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${read('style.css')}</style>`)
  .replace(/(<script src="[^"]+"><\/script>\n?)+/, () => `<script>\nwindow.BOTFALL_NO_SW = true;\nwindow.TOD_BUNDLE = true;\nwindow.BIOME_BUNDLE = true;\nwindow.ART_BUNDLE = ${JSON.stringify(ART_GROUPS)};\nwindow.MURMUR_BUNDLE = true;\nwindow.LANDMARK_BUNDLE = true;\nwindow.TOWN_BUNDLE = true;\nwindow.GLOBE_BUNDLE = true;\nwindow.LORE_BUNDLE = true;\nwindow.ITHACA_MAP = ${JSON.stringify(ithacaMap)};\nwindow.ITHACA_CLOUDS = ${JSON.stringify(ithacaClouds)};\nwindow.TOD_SHARED = ${JSON.stringify(todShared)};\n${code.replace(/<\/script/g, '<\\/script')}\n</script>\n`);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'terrafall.html');
fs.writeFileSync(out, html);
console.log(`wrote ${path.relative(root, out)} (${Math.round(html.length / 1024)} KB, ${Object.keys(inlined).length} custom art files, ${loreN} Lore pictures) and dist/lore.js (${Math.round(loreBytes / 1024)} KB) and dist/tod-{morning,evening,night}.js (${Math.round(todBytes / 1024)} KB) and dist/art-{buildings,bots,effects,other}.js (${Math.round(artBytes / 1024)} KB) and dist/biome-*.js (${Math.round(biomeBytes / 1024)} KB) and dist/murmur.js (${Math.round(murmurJs.length / 1024)} KB) and dist/landmarks.js (${Math.round(lmJs.length / 1024)} KB) and dist/town.js (${Math.round(townBytes / 1024)} KB) and dist/globe{,-hd}.js (${Math.round(globeBytes / 1024)} KB)`);
