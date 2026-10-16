// GD level and user search (Cloudflare Worker). Deploy this as its own worker and paste its URL into the viewer's "Online levels" dialog.
//
//   GET /search?q=<text>&type=0&page=0   -> level search (GD's getGJLevels21), parsed to JSON
//   GET /users?q=<name>&page=0           -> user search (getGJUsers20), parsed to JSON
//   GET /download/<level id>             -> a level's data ({..., levelString}), which the viewer opens
//
// Nothing is stored here; each call is forwarded to the Geometry Dash servers.

const SECRET = 'Wmfd2893gb7';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
  });
}
// ---------- level and user search (GD's own database endpoints; request fields and keys as the game uses them) ----------
const GD_DB = 'http://www.boomlings.com/database/';
const GAME_VERSION = 22, BINARY_VERSION = 45;

async function gdPost(endpoint, fields) {
  const body = new URLSearchParams({ gameVersion: GAME_VERSION, binaryVersion: BINARY_VERSION, ...fields, secret: SECRET }).toString();
  let r;
  try {
    r = await fetch(GD_DB + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': '' }, body });
  } catch (e) { return { error: 'could not reach the Geometry Dash servers', status: 502 }; }
  const text = (await r.text()).trim();
  if (!r.ok) return { error: 'upstream returned ' + r.status, status: 502 };
  if (!text || text === '-1' || text === '-2') return { empty: true, text };
  return { text };
}
// "1:a:2:b" -> {1:'a', 2:'b'}
function kv(str, sep = ':') {
  const p = str.split(sep), m = {};
  for (let i = 0; i + 1 < p.length; i += 2) m[p[i]] = p[i + 1];
  return m;
}
const LENGTHS = ['Tiny', 'Short', 'Medium', 'Long', 'XL', 'Platformer'];
const DEMON = { 3: 'Easy Demon', 4: 'Medium Demon', 0: 'Hard Demon', 5: 'Insane Demon', 6: 'Extreme Demon' };
const DIFF = { 0: 'N/A', 10: 'Easy', 20: 'Normal', 30: 'Hard', 40: 'Harder', 50: 'Insane' };
function b64text(s) {
  try { const b = s.replace(/-/g, '+').replace(/_/g, '/'); return new TextDecoder().decode(Uint8Array.from(atob(b + '='.repeat((4 - (b.length % 4)) % 4)), (c) => c.charCodeAt(0))); } catch (e) { return ''; }
}
function levelFromKv(m) {
  const stars = Number(m['18'] || 0);
  let difficulty = DIFF[Number(m['9'] || 0)] || 'N/A';
  if (m['25'] === '1') difficulty = 'Auto';
  else if (m['17'] === '1') difficulty = DEMON[Number(m['43'] || 0)] || 'Demon';
  return {
    id: Number(m['1']), name: m['2'], description: b64text(m['3'] || ''), version: Number(m['5'] || 1), playerID: m['6'],
    difficulty, stars, downloads: Number(m['10'] || 0), likes: Number(m['14'] || 0), length: LENGTHS[Number(m['15'] || 0)] || '?',
    song: m['35'] && m['35'] !== '0' ? { custom: true, id: Number(m['35']) } : { custom: false, track: Number(m['12'] || 0) },
    twoPlayer: m['31'] === '1', coins: Number(m['37'] || 0), epic: ['1', '2', '3'].includes(m['42']), original: Number(m['30'] || 0), objects: Number(m['45'] || 0),
  };
}

// GET /search?q=<text>&type=0&page=0&diff=-&len=-   (type: 0 search, 1 most downloaded, 2 most liked, 3 trending, 4 recent, 5 by user, 6 featured, 7 magic, 11 awarded, 16 hall of fame)
async function searchLevels(sp) {
  const fields = {
    type: sp.get('type') || '0', str: sp.get('q') || '', diff: sp.get('diff') || '-', len: sp.get('len') || '-',
    page: sp.get('page') || '0', total: '0', uncompleted: '0', onlyCompleted: '0', featured: sp.get('featured') || '0',
    original: sp.get('original') || '0', twoPlayer: sp.get('twoPlayer') || '0', coins: sp.get('coins') || '0',
  };
  const r = await gdPost('getGJLevels21.php', fields);
  if (r.error) return json({ error: r.error }, r.status);
  if (r.empty) return json({ levels: [], total: 0, page: Number(fields.page) });
  const [levelsRaw, creatorsRaw, , pageRaw] = r.text.split('#');
  const creators = {};
  for (const c of (creatorsRaw || '').split('|')) { const p = c.split(':'); if (p[0]) creators[p[0]] = { name: p[1], accountID: p[2] }; }
  const levels = levelsRaw.split('|').filter(Boolean).map((e) => {
    const l = levelFromKv(kv(e));
    const c = creators[l.playerID] || {};
    return { ...l, author: c.name || '?', accountID: c.accountID };
  });
  const [total, offset, per] = (pageRaw || '').split(':').map(Number);
  return json({ levels, total: total || levels.length, page: Math.floor((offset || 0) / (per || 10)) });
}

// GET /users?q=<name>&page=0
async function searchUsers(sp) {
  const r = await gdPost('getGJUsers20.php', { str: sp.get('q') || '', total: '0', page: sp.get('page') || '0' });
  if (r.error) return json({ error: r.error }, r.status);
  if (r.empty) return json({ users: [], total: 0 });
  const [usersRaw, pageRaw] = r.text.split('#');
  const users = usersRaw.split('|').filter(Boolean).map((e) => {
    const m = kv(e);
    return { name: m['1'], userID: Number(m['2']), stars: Number(m['3'] || 0), demons: Number(m['4'] || 0), creatorPoints: Number(m['8'] || 0), secretCoins: Number(m['13'] || 0), accountID: Number(m['16'] || 0), userCoins: Number(m['17'] || 0) };
  });
  const [total] = (pageRaw || '').split(':').map(Number);
  return json({ users, total: total || users.length });
}

// GET /download/<levelID>  ->  {id, name, ..., levelString}  (levelString is the game's base64url(gzip) level data, i.e. the plist's k4)
async function downloadLevel(id) {
  const r = await gdPost('downloadGJLevel22.php', { levelID: id });
  if (r.error) return json({ error: r.error }, r.status);
  if (r.empty) return json({ error: 'Level not found.' }, 404);
  const m = kv(r.text.split('#')[0]);
  if (!m['4']) return json({ error: 'The server did not return level data.' }, 404);
  return json({ ...levelFromKv(m), levelString: m['4'] });
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'GET') return json({ error: 'not found' }, 404);
    const { pathname, searchParams } = new URL(request.url);
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
    if (path === '/') return new Response('GD level search service. GET /search?q=, /users?q=, /download/<id>.', { headers: CORS });
    if (path === '/search') return searchLevels(searchParams);
    if (path === '/users') return searchUsers(searchParams);
    const dl = path.match(/^\/download\/(\d{1,10})$/);
    if (dl) return downloadLevel(dl[1]);
    return json({ error: 'not found' }, 404);
  },
};