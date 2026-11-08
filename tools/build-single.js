// Packs the game into one self-contained HTML file (dist/botfall.html): CSS, scripts and any
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

const icon = `data:image/svg+xml;base64,${Buffer.from(read('icons/icon.svg')).toString('base64')}`;
html = html
  .replace(/<link rel="manifest"[^>]*>\n/, '')
  .replace(/<link rel="apple-touch-icon"[^>]*>\n/, '')
  .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="${icon}" type="image/svg+xml">`)
  .replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${read('style.css')}</style>`)
  .replace(/(<script src="[^"]+"><\/script>\n?)+/, () => `<script>\nwindow.BOTFALL_NO_SW = true;\n${code.replace(/<\/script/g, '<\\/script')}\n</script>\n`);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'botfall.html');
fs.writeFileSync(out, html);
console.log(`wrote ${path.relative(root, out)} (${Math.round(html.length / 1024)} KB, ${Object.keys(inlined).length} custom art files)`);
