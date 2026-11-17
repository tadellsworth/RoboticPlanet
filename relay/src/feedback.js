/*
 * Player feedback: the game's "Send feedback" form posts here, and each report becomes an issue in a private GitHub
 * repository, labelled by type (bug, idea, balance, other) and "from-game". A bug report can bring the player's
 * current game (a save file): it is committed to saves/ in the same repository and linked from the issue, so the
 * bug can be replayed exactly. A picture of the map (a JPEG the game makes of its map canvas) goes to shots/ the same
 * way, shown in the issue.
 *
 *   POST /feedback   JSON { type, text, contact?, meta?, save?, shot?, website? }
 *     type     'bug' | 'idea' | 'balance' | 'other'
 *     text     what the player wrote (3 to 5000 characters)
 *     contact  optional: an email or name to reply to (up to 200 characters)
 *     meta     optional: { version, device, screen, mode, map, seed, time, ... } added by the game (small)
 *     save     optional: the save file (JSON text, up to 8 MB)
 *     shot     optional: a picture of the map, as a data: URL of a JPEG, PNG or WebP (up to 1 MB of text)
 *     website  a field people can't see: anything in it marks a bot, and the report is dropped
 *   → 200 { ok: true, n: <issue number> } | 4xx/5xx { ok: false, why }
 *
 * Settings (Cloudflare secrets, sent by .github/workflows/relay.yml from the GitHub repository's Actions secrets):
 *   FEEDBACK_TOKEN  a fine-grained GitHub token for that repository only: Issues and Contents, read and write
 *   FEEDBACK_REPO   "owner/name" of the private repository the reports go to
 *   FEEDBACK_API    (tests only) another address for the GitHub API
 * Without the first two, the form says feedback isn't set up yet.
 *
 * Abuse: at most 5 reports an hour and 20 a day from one address (the Gate Durable Object, by a hash of the address),
 * size limits, the hidden field, and every "@" in what players write is broken up so no one can be pinged by it.
 */

const TYPES = { bug: 'Bug', idea: 'Idea', balance: 'Balance', other: 'Other' };
const MAX_TEXT = 5000, MAX_CONTACT = 200, MAX_META = 4000, MAX_SAVE = 8 << 20, MAX_SHOT = 1 << 20;
const SHOT = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const PER_HOUR = 5, PER_DAY = 20;

export const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

function reply(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...CORS } });
}

/** Text from a player, safe to put in an issue: no pings, no hidden markup tricks, trimmed. */
function tame(s, max) {
  return String(s || '').replace(/\r\n?/g, '\n').replace(/@/g, '@​').replace(/<!--/g, '&lt;!--').trim().slice(0, max);
}

async function sha(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

function base64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function handleFeedback(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return reply(405, { ok: false, why: 'post' });
  if (!env.FEEDBACK_TOKEN || !env.FEEDBACK_REPO) return reply(503, { ok: false, why: 'off' });
  const size = +(request.headers.get('content-length') || 0);
  if (size > MAX_SAVE + MAX_SHOT + 64 * 1024) return reply(413, { ok: false, why: 'big' });
  let f;
  try { f = await request.json(); } catch (e) { return reply(400, { ok: false, why: 'json' }); }
  if (!f || typeof f !== 'object') return reply(400, { ok: false, why: 'json' });
  if (f.website) return reply(200, { ok: true, n: 0 }); // (a bot filled in the hidden field: say thanks, keep nothing)
  const type = TYPES[f.type] ? f.type : 'other';
  const text = tame(f.text, MAX_TEXT);
  if (text.length < 3) return reply(400, { ok: false, why: 'short' });
  // (shown as code in the issue, so an address in it can't ping anyone and stays as typed)
  const contact = String(f.contact || '').replace(/[`\r\n]/g, ' ').trim().slice(0, MAX_CONTACT);
  let meta = {};
  if (f.meta && typeof f.meta === 'object') {
    const m = JSON.stringify(f.meta);
    if (m.length <= MAX_META) meta = f.meta;
  }
  const save = typeof f.save === 'string' && f.save.length <= MAX_SAVE ? f.save : '';
  const shot = typeof f.shot === 'string' && f.shot.length <= MAX_SHOT ? SHOT.exec(f.shot) : null;

  // Rate limit by a hash of the address (the address itself is never stored).
  const who = await sha((request.headers.get('cf-connecting-ip') || 'local') + ':' + (env.FEEDBACK_REPO || ''));
  if (env.GATE) {
    const gate = env.GATE.get(env.GATE.idFromName('feedback'));
    const r = await gate.fetch('https://gate/hit?who=' + who);
    if (r.status === 429) return reply(429, { ok: false, why: 'often' });
  }

  const api = (env.FEEDBACK_API || 'https://api.github.com').replace(/\/$/, '');
  const repo = env.FEEDBACK_REPO;
  const gh = (path, method, body) => fetch(api + path, {
    method,
    headers: {
      authorization: 'Bearer ' + env.FEEDBACK_TOKEN,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'terrafall-feedback',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  // The save file first, so the issue can link to it.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  let saveLine = '';
  if (save) {
    const path = `saves/${stamp}-${who.slice(0, 6)}.json`;
    const r = await gh(`/repos/${repo}/contents/${path}`, 'PUT', { message: `Save file for a ${TYPES[type].toLowerCase()} report`, content: base64(save) });
    saveLine = r.ok ? `**Save file:** [${path}](../blob/HEAD/${path}) (load it in the game: main menu → Load a save file)` : `**Save file:** couldn't be stored (GitHub said ${r.status})`;
  }
  let shotLine = '';
  if (shot) {
    const path = `shots/${stamp}-${who.slice(0, 6)}.${shot[1] === 'jpeg' ? 'jpg' : shot[1]}`;
    const r = await gh(`/repos/${repo}/contents/${path}`, 'PUT', { message: `Picture of the map for a ${TYPES[type].toLowerCase()} report`, content: shot[2] });
    shotLine = r.ok ? `**Picture of the map:** [${path}](../blob/HEAD/${path})\n\n![The map as the player saw it](../blob/HEAD/${path}?raw=true)` : `**Picture of the map:** couldn't be stored (GitHub said ${r.status})`;
  }

  const first = text.split('\n')[0].replace(/\s+/g, ' ').slice(0, 70);
  const rows = Object.entries(meta).slice(0, 30)
    .map(([k, v]) => `| ${tame(k, 40).replace(/\|/g, '/')} | ${tame(typeof v === 'object' ? JSON.stringify(v) : v, 300).replace(/\|/g, '/').replace(/\n/g, ' ')} |`);
  const body = [
    text,
    '',
    '---',
    contact ? `**Contact:** \`${contact}\`` : '**Contact:** none given',
    saveLine,
    shotLine,
    rows.length ? '\n| | |\n|---|---|\n' + rows.join('\n') : '',
    '',
    `\n_Sent from the game's feedback form; sender ${who.slice(0, 8)}._`, // (a blank line first: it would join the table)
  ].filter((l) => l !== '').join('\n');
  const r = await gh(`/repos/${repo}/issues`, 'POST', { title: `[${TYPES[type]}] ${first}`, body, labels: [type, 'from-game'] });
  if (!r.ok) return reply(502, { ok: false, why: 'github', status: r.status });
  const issue = await r.json().catch(() => ({}));
  return reply(200, { ok: true, n: issue.number || 0 });
}

/** Counts reports per sender (in memory: a restart forgets, which only ever lets a few more through). */
export class Gate {
  constructor(state) { this.state = state; this.hits = new Map(); }
  async fetch(request) {
    const who = new URL(request.url).searchParams.get('who') || '';
    const now = Date.now(), day = 86400e3;
    const list = (this.hits.get(who) || []).filter((t) => now - t < day);
    const hour = list.filter((t) => now - t < 3600e3).length;
    if (hour >= PER_HOUR || list.length >= PER_DAY) { this.hits.set(who, list); return new Response('slow down', { status: 429 }); }
    list.push(now);
    this.hits.set(who, list);
    if (this.hits.size > 5000) for (const [k, v] of this.hits) if (!v.some((t) => now - t < day)) this.hits.delete(k);
    return new Response('ok');
  }
}
