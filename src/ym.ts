// Яндекс Музыка через неофициальное API — порт Yandex/Ym.cs из десктопного Noir.
// Токен хранится только на этом телефоне (Keychain через expo-secure-store).
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const CLIENT_ID = '23cabbbdc6cd418abb4b39c32c41195d';
const CLIENT_SECRET = '53bc75238f0c4d08a118e51fe9203300';
const SIGN_SALT = 'XGRlBW9FXlekgbPrRHuSiA';
const API = 'https://api.music.yandex.net';
const OAUTH = 'https://oauth.yandex.ru';
const TOKEN_KEY = 'noir.yandex';

export type Track = {
  id: string;
  albumId: string;
  title: string;
  version?: string;
  artists: string;
  artistRefs: { id: string; name: string }[];
  album: string;
  durationMs: number;
  coverUri: string;
  available: boolean;
  lufs?: number;
  /** Цвета обложки от Яндекса: средний (фон) и акцент. */
  colors?: { average: string; accent: string };
};

export type Playlist = {
  kind: string;
  owner: string;
  title: string;
  trackCount: number;
  coverUri: string;
};

export type Artist = { id: string; name: string; coverUri: string; genre: string };
export type Album = { id: string; title: string; year: string; coverUri: string; type: string; artists: string; artistRefs: { id: string; name: string }[]; trackCount: number };

export type WaveSession = { id: string; batchId: string; seeds: string[] };

export const trackKey = (t: Track) => (t.albumId ? `${t.id}:${t.albumId}` : t.id);
export const fullTitle = (t: Track) => (t.version ? `${t.title} (${t.version})` : t.title);

/** Обложка нужного размера: "avatars.yandex.net/.../%%" → https://.../400x400 */
export const img = (uri: string, px: number) =>
  !uri ? '' : uri.startsWith('http') ? uri : 'https://' + uri.replace('%%', `${px}x${px}`);

export const fmtTime = (sec: number) => {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

// ---------------------------------------------------------------- состояние входа
let token: string | null = null;
export let uid = '';
export let login = '';
/** Токен для пульта: ретранслятор по нему узнаёт аккаунт (сам токен нигде не хранит). */
export const authToken = () => token;
export const liked = new Set<string>();

export const loggedIn = () => token != null;

export async function loadToken(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!raw) return false;
    const p = JSON.parse(raw);
    token = p.token; uid = p.uid ?? ''; login = p.login ?? '';
    return !!token;
  } catch { return false; }
}

async function saveToken() {
  await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify({ token, uid, login }));
}

/** Подписчики на выход из аккаунта (корневой экран показывает вход). */
export const onLogout = new Set<() => void>();

export async function logout() {
  token = null; uid = ''; login = ''; liked.clear();
  try { await SecureStore.deleteItemAsync(TOKEN_KEY); } catch {}
  onLogout.forEach(f => f());
}

export const tracksWord = (n: number) => {
  const a = n % 10, b = n % 100;
  return `${n} ${a === 1 && b !== 11 ? 'трек' : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 'трека' : 'треков'}`;
};

export type DeviceCode = { userCode: string; url: string; code: string; interval: number; expiresIn: number };

export async function startLogin(): Promise<DeviceCode> {
  const id = Array.from({ length: 10 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
  const r = await fetch(OAUTH + '/device/code', {
    method: 'POST', headers: formHeaders,
    body: form({ client_id: CLIENT_ID, device_id: id, device_name: 'Noir (iPhone)' }),
  });
  const e = await r.json();
  return {
    userCode: e.user_code ?? '', url: e.verification_url || 'https://ya.ru/device', code: e.device_code ?? '',
    interval: e.interval ?? 5, expiresIn: e.expires_in ?? 300,
  };
}

/** Ждёт, пока пользователь введёт код на ya.ru/device. signal — чтобы отменить. */
export async function waitLogin(dc: DeviceCode, signal: { cancelled: boolean }): Promise<boolean> {
  const until = Date.now() + dc.expiresIn * 1000;
  while (Date.now() < until && !signal.cancelled) {
    await sleep(Math.max(2, dc.interval) * 1000);
    if (signal.cancelled) return false;
    let d: any;
    try {
      const r = await fetch(OAUTH + '/token', {
        method: 'POST', headers: formHeaders,
        body: form({ grant_type: 'device_code', code: dc.code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
      });
      d = await r.json();
    } catch { continue; }
    if (d.access_token) {
      token = d.access_token;
      await loadAccount();
      await saveToken();
      return true;
    }
    if (d.error !== 'authorization_pending' && d.error !== 'slow_down') return false;
  }
  return false;
}

export async function loadAccount() {
  const res = await get('/account/status');
  uid = String(res.account.uid);
  login = res.account.login || res.account.displayName || '';
}

// ---------------------------------------------------------------- разбор
export function parseTrack(e: any): Track | null {
  if (!e || typeof e !== 'object' || e.id == null) return null;
  const refs = Array.isArray(e.artists)
    ? e.artists.map((a: any) => ({ id: String(a.id ?? ''), name: a.name ?? '' })).filter((a: any) => a.name) : [];
  const al = Array.isArray(e.albums) && e.albums.length > 0 ? e.albums[0] : null;
  return {
    id: String(e.id),
    albumId: al?.id != null ? String(al.id) : '',
    title: e.title ?? '',
    version: e.version || undefined,
    artists: refs.map((a: any) => a.name).join(', '),
    artistRefs: refs,
    album: al?.title ?? '',
    durationMs: e.durationMs ?? 0,
    coverUri: e.coverUri || e.ogImage || '',
    available: e.available !== false,
    lufs: typeof e.r128?.i === 'number' ? e.r128.i : undefined,
    colors: e.derivedColors?.average ? { average: e.derivedColors.average, accent: e.derivedColors.accent || e.derivedColors.average } : undefined,
  };
}

function parseArtist(a: any): Artist {
  return {
    id: String(a.id ?? ''), name: a.name ?? '',
    coverUri: a.cover?.uri || a.ogImage || '',
    genre: Array.isArray(a.genres) && a.genres.length ? String(a.genres[0]) : '',
  };
}

function parseAlbum(a: any): Album {
  const refs = Array.isArray(a.artists) ? a.artists.map((x: any) => ({ id: String(x.id ?? ''), name: x.name ?? '' })).filter((x: any) => x.name) : [];
  return {
    id: String(a.id ?? ''), title: a.title ?? '', year: a.year ? String(a.year) : '',
    coverUri: a.coverUri || a.ogImage || '', type: a.type ?? '',
    artists: refs.map((x: any) => x.name).join(', '), artistRefs: refs, trackCount: a.trackCount ?? 0,
  };
}

const results = <T,>(res: any, key: string, parse: (e: any) => T | null): T[] =>
  (res?.[key]?.results ?? []).map(parse).filter((x: T | null): x is T => x != null);

function parsePlaylist(p: any): Playlist {
  const c = p.cover ?? {};
  let cover = c.uri || (Array.isArray(c.itemsUri) && c.itemsUri[0]) || p.ogImage || '';
  return {
    kind: String(p.kind), owner: String(p.owner?.uid ?? uid), title: p.title ?? '',
    trackCount: p.trackCount ?? 0, coverUri: cover,
  };
}

// ---------------------------------------------------------------- библиотека
export async function likes(): Promise<Track[]> {
  const res = await get(`/users/${uid}/likes/tracks`);
  const ids: { id: string; albumId: string }[] = res.library.tracks.map((t: any) => ({ id: String(t.id), albumId: String(t.albumId ?? '') }));
  liked.clear();
  ids.forEach(x => liked.add(x.id));
  return tracks(ids.map(x => (x.albumId ? `${x.id}:${x.albumId}` : x.id)));
}

/** Полные данные треков пачками, порядок сохраняется. */
export async function tracks(keys: string[]): Promise<Track[]> {
  const map = new Map<string, Track>();
  for (let i = 0; i < keys.length; i += 250) {
    const res = await post('/tracks', { 'track-ids': keys.slice(i, i + 250).join(','), 'with-positions': 'false' });
    for (const e of res) { const t = parseTrack(e); if (t) map.set(t.id, t); }
  }
  return keys.map(k => map.get(k.split(':')[0])).filter((t): t is Track => !!t);
}

export async function playlists(): Promise<Playlist[]> {
  const res = await get(`/users/${uid}/playlists/list`);
  return res.map(parsePlaylist);
}

export async function playlistTracks(p: Playlist): Promise<Track[]> {
  const res = await get(`/users/${p.owner}/playlists/${p.kind}`);
  const list: Track[] = [];
  const missing: string[] = [];
  for (const item of res.tracks ?? []) {
    const t = item.track ? parseTrack(item.track) : null;
    if (t) list.push(t);
    else if (item.id != null) missing.push(item.albumId ? `${item.id}:${item.albumId}` : String(item.id));
  }
  if (missing.length) list.push(...(await tracks(missing)));
  return list;
}

export type SearchResult = { tracks: Track[]; artists: Artist[]; albums: Album[]; playlists: Playlist[] };

/** Поиск сразу по всему одним запросом, как в десктопе. */
export async function search(text: string): Promise<SearchResult> {
  const res = await get('/search?type=all&page=0&nocorrect=false&text=' + encodeURIComponent(text));
  return {
    tracks: results(res, 'tracks', parseTrack),
    artists: results(res, 'artists', parseArtist),
    albums: results(res, 'albums', parseAlbum),
    playlists: results(res, 'playlists', parsePlaylist),
  };
}

export type ArtistInfo = { artist: Artist; popular: Track[]; albums: Album[]; singles: Album[]; similar: Artist[] };

export async function artistPage(id: string): Promise<ArtistInfo> {
  const [b, a] = await Promise.all([
    get(`/artists/${id}/brief-info`),
    get(`/artists/${id}/direct-albums?page=0&page-size=100&sort-by=year`).catch(() => null),
  ]);
  const all: Album[] = (a?.albums ?? b.albums ?? []).map(parseAlbum);
  return {
    artist: parseArtist(b.artist),
    popular: (b.popularTracks ?? []).map(parseTrack).filter(Boolean) as Track[],
    albums: all.filter(x => x.type !== 'single'),
    singles: all.filter(x => x.type === 'single'),
    similar: (b.similarArtists ?? []).map(parseArtist),
  };
}

export async function albumPage(id: string): Promise<{ album: Album; tracks: Track[] }> {
  const r = await get(`/albums/${id}/with-tracks`);
  const tracks: Track[] = [];
  for (const vol of r.volumes ?? []) for (const e of vol) { const t = parseTrack(e); if (t) tracks.push(t); }
  return { album: parseAlbum(r), tracks };
}

export async function setLike(t: Track, like: boolean) {
  await post(`/users/${uid}/likes/tracks/` + (like ? 'add-multiple' : 'remove'), { 'track-ids': trackKey(t) });
  if (like) liked.add(t.id); else liked.delete(t.id);
}

export const dislike = (t: Track) => post(`/users/${uid}/dislikes/tracks/add-multiple`, { 'track-ids': trackKey(t) });

// ---------------------------------------------------------------- Моя волна
export const WAVE_MOODS = [
  { id: '', label: 'Любое' },
  { id: 'active', label: 'Бодрое' },
  { id: 'fun', label: 'Весёлое' },
  { id: 'calm', label: 'Спокойное' },
  { id: 'sad', label: 'Грустное' },
] as const;

export const WAVE_DIVERSITY = [
  { id: '', label: 'Как обычно' },
  { id: 'favorite', label: 'Любимое' },
  { id: 'discover', label: 'Незнакомое' },
  { id: 'popular', label: 'Популярное' },
] as const;

/** Сцены волны как в десктопе (Audio/Playback.cs). */
export const WAVE_SCENES = [
  { id: '', label: 'Обычная' },
  { id: 'cs2', label: 'CS2' },
  { id: 'road', label: 'В дороге' },
] as const;

export function waveSeeds(mood: string, diversity: string, scene = ''): string[] {
  if (scene === 'cs2') return ['user:onyourwave', 'mood:aggressive', 'mood:energetic'];
  // своя «В дороге»: спокойный клауд-рэп от трека Chris Travis — Nemo и похожих артистов (Chris Travis, Xavier Wulf, BONES, Black Kray)
  if (scene === 'road') return ['track:70488875', 'artist:3155103', 'artist:3179415', 'artist:3365796', 'artist:3142877'];
  const s = ['user:onyourwave'];
  if (diversity) s.push('settingDiversity:' + diversity);
  if (mood) s.push('settingMoodEnergy:' + mood);
  return s;
}

const sequence = (res: any): Track[] =>
  (res.sequence ?? []).map((i: any) => parseTrack(i.track)).filter((t: Track | null): t is Track => !!t && t.available);

export async function waveStart(seeds: string[]): Promise<{ session: WaveSession; tracks: Track[] }> {
  const res = await postJson('/rotor/session/new', { seeds, includeTracksInResponse: true });
  return { session: { id: res.radioSessionId ?? '', batchId: res.batchId ?? '', seeds }, tracks: sequence(res) };
}

export async function waveMore(s: WaveSession, recent: Track[]): Promise<Track[]> {
  const res = await postJson(`/rotor/session/${s.id}/tracks`, { queue: recent.map(trackKey) });
  if (res.batchId) s.batchId = res.batchId;
  return sequence(res);
}

/** trackStarted / trackFinished / skip / like / dislike — волна по ним подстраивается. */
export async function waveFeedback(s: WaveSession, type: string, t: Track, playedSeconds = 0) {
  if (!s.id) return;
  const ev: any = { type, timestamp: new Date().toISOString(), trackId: trackKey(t) };
  if (type !== 'trackStarted') ev.totalPlayedSeconds = Math.round(playedSeconds * 10) / 10;
  try { await postJson(`/rotor/session/${s.id}/feedback`, { event: ev, batchId: s.batchId }); } catch {}
}

// ---------------------------------------------------------------- поток
/** Прямая ссылка на mp3 (подписанная, живёт ограниченное время). */
export async function streamUrl(t: Track, maxKbps = 320): Promise<string> {
  const res: any[] = await get(`/tracks/${trackKey(t)}/download-info`);
  let mp3 = res.filter(v => v.codec === 'mp3');
  if (!mp3.length) mp3 = res;
  const pick = mp3.filter(v => v.bitrateInKbps <= maxKbps).sort((a, b) => b.bitrateInKbps - a.bitrateInKbps)[0]
    ?? mp3.sort((a, b) => a.bitrateInKbps - b.bitrateInKbps)[0];
  const r = await fetch(pick.downloadInfoUrl, { headers: { Authorization: 'OAuth ' + token } });
  if (!r.ok) throw new Error('download-info ' + r.status);
  const xml = await r.text();
  const tag = (n: string) => xml.match(new RegExp(`<${n}>([^<]*)</${n}>`))?.[1] ?? '';
  const host = tag('host'), path = tag('path'), ts = tag('ts'), s = tag('s');
  const sign = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5, SIGN_SALT + path.slice(1) + s);
  return `https://${host}/get-mp3/${sign}/${ts}${path}`;
}

// ---------------------------------------------------------------- HTTP
export class AuthError extends Error {}

const formHeaders = { 'Content-Type': 'application/x-www-form-urlencoded' };
const form = (kv: Record<string, string>) =>
  Object.entries(kv).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function headers(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { 'X-Yandex-Music-Client': 'YandexMusicAndroid/24023621', 'Accept-Language': 'ru', ...extra };
  if (token) h.Authorization = 'OAuth ' + token;
  return h;
}

async function send(path: string, init: RequestInit): Promise<any> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(API + path, { ...init, signal: ctl.signal });
    if (r.status === 401 || r.status === 403) throw new AuthError('Яндекс не принял вход');
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    const d = await r.json();
    return d.result !== undefined ? d.result : d;
  } finally { clearTimeout(timer); }
}

const get = (path: string) => send(path, { headers: headers() });
const post = (path: string, kv: Record<string, string>) => send(path, { method: 'POST', headers: headers(formHeaders), body: form(kv) });
const postJson = (path: string, body: object) =>
  send(path, { method: 'POST', headers: headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
