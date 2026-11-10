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
const inlined = {};
for (const key of Object.keys(manifest)) {
  const entry = typeof manifest[key] === 'string' ? { src: manifest[key] } : { ...manifest[key] };
  const file = path.join(root, 'art', entry.src);
  if (!fs.existsSync(file)) { console.warn('missing art file, skipped:', entry.src); continue; }
  entry.src = `data:${mime[path.extname(file).toLowerCase()] || 'image/png'};base64,${fs.readFileSync(file).toString('base64')}`;
  inlined[key] = entry;
}

const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const code = scripts.map((src) => (src === 'art/art-manifest.js'
  ? `const ART_MANIFEST = ${JSON.stringify(inlined)};`
  : read(src))).join('\n;\n');

// Day and night: each time's re-lit sprites go in a bundle beside the page (dist/tod-<time>.js, loaded
// when that time comes round); the headlights and light pool are small enough to go inline.
const todKeys = (() => { const sb = {}; vm.runInNewContext(read('art/tod/tod-keys.js').replace('const TOD_KEYS', 'this.TOD_KEYS'), sb); return sb.TOD_KEYS || []; })();
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
}
const todShared = {};
for (const f of fs.readdirSync(path.join(root, 'art/tod/shared'))) {
  if (f.endsWith('.webp')) todShared[f.replace('.webp', '')] = `data:image/webp;base64,${fs.readFileSync(path.join(root, 'art/tod/shared', f)).toString('base64')}`;
}

const icon = `data:image/png;base64,${fs.readFileSync(path.join(root, 'icons/favicon-32.png')).toString('base64')}`;
html = html
  .replace(/<link rel="manifest"[^>]*>\n/, '')
  .replace(/<link rel="apple-touch-icon"[^>]*>\n/, '')
  .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="${icon}" type="image/png">`)
  .replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${read('style.css')}</style>`)
  .replace(/(<script src="[^"]+"><\/script>\n?)+/, () => `<script>\nwindow.BOTFALL_NO_SW = true;\nwindow.TOD_BUNDLE = true;\nwindow.TOD_SHARED = ${JSON.stringify(todShared)};\n${code.replace(/<\/script/g, '<\\/script')}\n</script>\n`);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'terrafall.html');
fs.writeFileSync(out, html);
console.log(`wrote ${path.relative(root, out)} (${Math.round(html.length / 1024)} KB, ${Object.keys(inlined).length} custom art files) and dist/tod-{morning,evening,night}.js (${Math.round(todBytes / 1024)} KB)`);
