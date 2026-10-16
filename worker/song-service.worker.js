// GD level song lookup (Cloudflare Worker).
//
//   GET  /info/<newgrounds song id>   -> {id, name, artist, size, url}
//   POST /level  (body = level file)  -> same JSON, with the song ID read from the level
//   GET  /audio/<song id>             -> streams the song's audio (supports Range/seeking)
//   GET  /search?q=&type=&page=       -> level search (GD's getGJLevels21), parsed to JSON
//   GET  /users?q=&page=              -> user search (getGJUsers20), parsed to JSON
//   GET  /download/<level id>         -> a level's data, ready to open in the viewer
//
// Accepts .gdlvl (base64url(gzip(plist))), .gmd (plain plist XML), and ZIP-based exports (.gmd2).
// The audio is passed straight through from Newgrounds; nothing is stored here.

const GD_SONG_INFO = 'http://www.boomlings.com/database/getGJSongInfo.php';
const SECRET = 'Wmfd2893gb7';
const MAX_UPLOAD = 5_000_000;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
  });
}

// ---------- song lookup ----------

// Returns {song} on success or {error, status} on failure.
async function getSong(songId) {
  let text;
  try {
    const r = await fetch(GD_SONG_INFO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': '' },
      body: 'songID=' + songId + '&secret=' + SECRET,
    });
    if (!r.ok) return { error: 'upstream returned ' + r.status, status: 502 };
    text = await r.text();
  } catch (e) {
    return { error: 'could not reach the Geometry Dash servers', status: 502 };
  }
  if (!text || text.startsWith('-')) {
    return { error: 'Song not found, or its artist has disabled it for Geometry Dash.', status: 404 };
  }

  const parts = text.split('~|~');
  const map = {};
  for (let i = 0; i + 1 < parts.length; i += 2) map[parts[i]] = parts[i + 1];

  let url = '';
  try { url = decodeURIComponent(map['10'] || ''); } catch (e) { /* handled below */ }
  let host = '';
  try { host = new URL(url).hostname; } catch (e) { /* handled below */ }
  if (!/(^|\.)ngfiles\.com$/.test(host) && !/(^|\.)newgrounds\.com$/.test(host)) {
    return { error: 'No Newgrounds link for that song.', status: 404 };
  }
  url = url.replace(/^http:\/\//, 'https://'); // the viewer may be served over https

  return { song: { id: Number(songId), name: map['2'], artist: map['4'], size: map['5'], url } };
}

async function lookupSong(songId, origin) {
  const r = await getSong(songId);
  if (r.error) return json({ error: r.error }, r.status);
  // Absolute streaming URL the page can put straight into an <audio> tag.
  return json({ ...r.song, stream: origin + '/audio/' + r.song.id });
}

// ---------- audio streaming proxy ----------
// Only ever fetches the Newgrounds URL that GD's servers return for a song ID, so it
// can't be pointed at arbitrary sites. Forwards Range so seeking works in <audio>.
async function streamSong(songId, request) {
  const r = await getSong(songId);
  if (r.error) return json({ error: r.error }, r.status);

  const headers = { Referer: 'https://www.newgrounds.com/', 'User-Agent': 'Mozilla/5.0' };
  const range = request.headers.get('Range');
  if (range) headers.Range = range;

  let upstream;
  try {
    upstream = await fetch(r.song.url, { method: request.method, headers });
  } catch (e) {
    return json({ error: 'could not reach Newgrounds' }, 502);
  }
  const type = upstream.headers.get('Content-Type') || '';
  if ((!upstream.ok && upstream.status !== 206) || !type.startsWith('audio/')) {
    return json({ error: 'Newgrounds did not return audio (status ' + upstream.status + ')' }, 502);
  }

  const out = new Headers(CORS);
  for (const h of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges', 'ETag', 'Last-Modified']) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }
  out.set('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
  out.set('Cache-Control', 'public, max-age=86400');
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

// ---------- level file reading ----------

async function inflate(bytes, format) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// .gdlvl is URL-safe base64 of a gzip ("H4sI..." is the gzip header in base64)
function fromBase64Url(str) {
  const b64 = str.trim().replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// Minimal ZIP reader: returns the text of every entry.
async function unzipTexts(buf) {
  const v = new DataView(buf);
  const u8 = new Uint8Array(buf);
  const dec = new TextDecoder();
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return [];

  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out = [];
  for (let n = 0; n < count && p + 46 <= buf.byteLength; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true);
    const size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const raw = u8.subarray(start, start + size);
    try {
      out.push(dec.decode(method === 8 ? await inflate(raw, 'deflate-raw') : raw));
    } catch (e) { /* skip entry */ }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

// Find the custom song ID (k45) in whatever the exporter produced.
async function songIdFromUpload(buf) {
  const u8 = new Uint8Array(buf);
  const dec = new TextDecoder();
  let texts;

  if (u8[0] === 0x50 && u8[1] === 0x4b) {            // ZIP (e.g. .gmd2)
    texts = await unzipTexts(buf);
  } else if (u8[0] === 0x1f && u8[1] === 0x8b) {     // raw gzip
    texts = [dec.decode(await inflate(u8, 'gzip'))];
  } else {
    let text = dec.decode(buf);
    if (text.trimStart().startsWith('H4sI')) {       // .gdlvl: base64url(gzip(xml))
      text = dec.decode(await inflate(fromBase64Url(text), 'gzip'));
    }
    texts = [text];                                  // plain .gmd XML otherwise
  }

  for (const t of texts) {
    const m = t.match(/<k>k45<\/k>\s*<i>(\d{1,9})<\/i>/) ||
              t.match(/"k45"\s*:\s*"?(\d{1,9})"?/);
    if (m) return m[1];
  }
  return null;
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
// ---------- routes ----------

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const { pathname, searchParams, origin } = new URL(request.url);
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname; // ignore trailing slash

    if (path === '/') {
      return new Response('GD song lookup v3 (audio proxy). GET /info/<id>, GET /audio/<id>, POST a level file to /level.', { headers: CORS });
    }

    const info = path.match(/^\/info\/(\d{1,9})$/);
    if (info && request.method === 'GET') return lookupSong(info[1], origin);

    // /audio/<id>, /audio/<id>.mp3 or /audio?id=<id>
    const audio = path.match(/^\/audio\/(\d{1,9})(?:\.mp3)?$/) ||
                  (path === '/audio' && /^\d{1,9}$/.test(searchParams.get('id') || '')
                    ? [null, searchParams.get('id')] : null);
    if (audio && (request.method === 'GET' || request.method === 'HEAD')) return streamSong(audio[1], request);

    if (path === '/level' && request.method === 'POST') {
      let buf;
      try {
        const type = request.headers.get('Content-Type') || '';
        if (type.includes('multipart/form-data')) {
          const file = (await request.formData()).get('file');
          if (!file || typeof file === 'string') return json({ error: 'send the level as a "file" field' }, 400);
          buf = await file.arrayBuffer();
        } else {
          buf = await request.arrayBuffer();
        }
      } catch (e) {
        return json({ error: 'could not read the upload' }, 400);
      }
      if (buf.byteLength > MAX_UPLOAD) return json({ error: 'file too large' }, 413);

      let songId;
      try {
        songId = await songIdFromUpload(buf);
      } catch (e) {
        return json({ error: 'could not read that level file' }, 400);
      }
      if (!songId) {
        return json({ error: 'No custom song found in this level (it may use an official GD song).' }, 404);
      }
      return lookupSong(songId, origin);
    }

    if (request.method === 'GET') {
      if (path === '/search') return searchLevels(searchParams);
      if (path === '/users') return searchUsers(searchParams);
      const dl = path.match(/^\/download\/(\d{1,10})$/);
      if (dl) return downloadLevel(dl[1]);
    }

    return json({ error: 'not found' }, 404);
  },
};
