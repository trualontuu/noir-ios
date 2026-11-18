// Noir Connect — ретранслятор пульта (как Spotify Connect).
// Десктопный Noir подключается как host, телефон — как remote. Комната = аккаунт Яндекса:
// по токену из заголовка спрашиваем у Яндекса uid и кладём соединение в Durable Object этого uid.
// Токен нигде не сохраняется, в памяти держим только sha-256 от него → uid (на 10 минут), чтобы не дёргать Яндекс.

const uidCache = new Map(); // sha256(token) -> { uid, until }

async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

async function uidFor(token) {
  const key = await sha(token);
  const hit = uidCache.get(key);
  if (hit && hit.until > Date.now()) return hit.uid;
  const r = await fetch('https://api.music.yandex.net/account/status', {
    headers: { Authorization: 'OAuth ' + token, 'X-Yandex-Music-Client': 'YandexMusicAndroid/24023621' },
  });
  if (!r.ok) return null;
  const j = await r.json();
  const uid = j?.result?.account?.uid;
  if (!uid) return null;
  uidCache.set(key, { uid: String(uid), until: Date.now() + 10 * 60 * 1000 });
  return String(uid);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/') return new Response('noir connect', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    if (url.pathname !== '/ws') return new Response('not found', { status: 404 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
    const auth = req.headers.get('Authorization') || '';
    const token = auth.startsWith('OAuth ') ? auth.slice(6).trim() : '';
    if (!token) return new Response('no token', { status: 401 });
    const uid = await uidFor(token);
    if (!uid) return new Response('bad token', { status: 401 });
    const role = url.searchParams.get('role') === 'host' ? 'host' : 'remote';
    const name = (url.searchParams.get('name') || '').slice(0, 40);
    const fwd = new URL(req.url);
    fwd.search = `?role=${role}&name=${encodeURIComponent(name)}`;
    const stub = env.ROOM.get(env.ROOM.idFromName(uid));
    return stub.fetch(new Request(fwd, { headers: { Upgrade: 'websocket' } }));
  },
};

/** Комната одного аккаунта. Сокеты гибернируются: пока никто ничего не шлёт, объект не тратит время. */
export class Room {
  constructor(ctx) { this.ctx = ctx; }

  hosts() { return this.ctx.getWebSockets('host'); }
  remotes() { return this.ctx.getWebSockets('remote'); }

  hostInfo() {
    // последний подключившийся компьютер — главный
    const hs = this.hosts();
    const h = hs[hs.length - 1];
    if (!h) return { type: 'host', online: false };
    const a = h.deserializeAttachment() || {};
    return { type: 'host', online: true, name: a.name || 'Компьютер', state: a.state || null };
  }

  async fetch(req) {
    const url = new URL(req.url);
    const role = url.searchParams.get('role');
    const name = url.searchParams.get('name') || '';
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server, [role]);
    server.serializeAttachment({ role, name, state: null });
    if (role === 'remote') server.send(JSON.stringify(this.hostInfo()));
    else this.broadcast(this.remotes(), { type: 'host', online: true, name: name || 'Компьютер', state: null });
    return new Response(null, { status: 101, webSocket: client });
  }

  broadcast(list, msg) {
    const s = typeof msg === 'string' ? msg : JSON.stringify(msg);
    for (const w of list) { try { w.send(s); } catch {} }
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 8000) return;
    const a = ws.deserializeAttachment() || {};
    if (raw === 'ping') { ws.send('pong'); return; }
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (a.role === 'host') {
      if (m.type === 'state') {
        try { ws.serializeAttachment({ ...a, state: m.state }); } catch { /* больше 2 КБ — просто не запоминаем */ }
        this.broadcast(this.remotes(), { type: 'host', online: true, name: a.name || 'Компьютер', state: m.state });
      } else this.broadcast(this.remotes(), m);
    } else {
      // команда с телефона → компьютеру (последнему подключившемуся)
      const hs = this.hosts();
      const h = hs[hs.length - 1];
      if (h) { try { h.send(JSON.stringify(m)); } catch {} }
      else ws.send(JSON.stringify({ type: 'host', online: false }));
    }
  }

  async webSocketClose(ws) {
    const a = ws.deserializeAttachment() || {};
    try { ws.close(1000); } catch {}
    if (a.role === 'host') {
      const left = this.hosts().filter(h => h !== ws);
      if (!left.length) this.broadcast(this.remotes(), { type: 'host', online: false });
    }
  }

  async webSocketError(ws) { await this.webSocketClose(ws); }
}
