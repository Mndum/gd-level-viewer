// Song lookup service for the level viewer (Cloudflare Worker).
//
// A web page cannot ask Geometry Dash's servers for a song by itself (they reject browser requests),
// so this makes that one small lookup and returns {id, name, artist, size, url}. The viewer then
// streams the audio straight from Newgrounds. This service never downloads, stores or proxies audio.

const GD_SONG_INFO = 'http://www.boomlings.com/database/getGJSongInfo.php';
const SECRET = 'Wmfd2893gb7';
const CORS = { 'Access-Control-Allow-Origin': '*' };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
  });
}

export default {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/') return new Response('GD song lookup service. Use /info/<newgrounds song id>.', { headers: CORS });

    const m = path.match(/^\/info\/(\d{1,9})$/);
    if (!m) return json({ error: 'not found' }, 404);

    let text;
    try {
      const r = await fetch(GD_SONG_INFO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': '' },
        body: 'songID=' + m[1] + '&secret=' + SECRET,
      });
      if (!r.ok) return json({ error: 'upstream returned ' + r.status }, 502);
      text = await r.text();
    } catch (e) {
      return json({ error: 'could not reach the Geometry Dash servers' }, 502);
    }
    if (!text || text.startsWith('-')) {
      return json({ error: 'Song not found, or its artist has disabled it for Geometry Dash.' }, 404);
    }

    const parts = text.split('~|~');
    const map = {};
    for (let i = 0; i + 1 < parts.length; i += 2) map[parts[i]] = parts[i + 1];

    let url = '';
    try { url = decodeURIComponent(map['10'] || ''); } catch (e) { /* handled below */ }
    let host = '';
    try { host = new URL(url).hostname; } catch (e) { /* handled below */ }
    if (!/(^|\.)ngfiles\.com$/.test(host) && !/(^|\.)newgrounds\.com$/.test(host)) {
      return json({ error: 'No Newgrounds link for that song.' }, 404);
    }
    url = url.replace(/^http:\/\//, 'https://');   // the viewer may be served over https

    return json({ id: Number(m[1]), name: map['2'], artist: map['4'], size: map['5'], url });
  },
};
