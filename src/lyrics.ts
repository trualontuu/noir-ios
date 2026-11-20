// Тексты песен из открытой базы LRCLIB (lrclib.net, ключ не нужен) — как в Island на компьютере.
// Найденное (и «не найдено») кэшируется в системном кэше — iOS сама чистит его, когда мало места.
// Для скачанных треков текст заранее не качается: без интернета его нет (так решил пользователь).
import { Directory, File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';
import type { Track } from './ym';

export type Line = { t: number; text: string };
export type Lyrics = { lines: Line[]; plain: string | null; instrumental: boolean };

const dir = new Directory(Paths.cache, 'lyrics');
try { dir.create({ idempotent: true, intermediates: true }); } catch {}
const RETRY_MISSING = 3 * 24 * 3600e3; // «не нашлось» перепроверяем через 3 дня — база пополняется

type CacheEntry = { found: boolean; at: number; synced?: string | null; plain?: string | null; instrumental?: boolean };
const mem = new Map<string, Lyrics | null>();
const inflight = new Map<string, Promise<Lyrics | null>>();

const file = (id: string) => new File(dir, `${id}.json`);

/** Текст трека: память → файл → LRCLIB. null — текста нет. Без сети бросает исключение. */
export function get(t: Track): Promise<Lyrics | null> {
  if (mem.has(t.id)) return Promise.resolve(mem.get(t.id)!);
  let p = inflight.get(t.id);
  if (!p) {
    p = load(t).finally(() => inflight.delete(t.id));
    inflight.set(t.id, p);
  }
  return p;
}

async function load(t: Track): Promise<Lyrics | null> {
  const f = file(t.id);
  try {
    if (f.exists) {
      const c: CacheEntry = JSON.parse(f.textSync());
      if (c.found || Date.now() - c.at < RETRY_MISSING) {
        const l = c.found ? build(c.synced ?? null, c.plain ?? null, !!c.instrumental) : null;
        mem.set(t.id, l);
        return l;
      }
    }
  } catch {}
  const r = await fetchLrclib(t); // нет сети — исключение, ничего не кэшируем
  mem.set(t.id, r?.l ?? null);
  try { f.write(JSON.stringify({ found: !!r, at: Date.now(), synced: r?.synced, plain: r?.l.plain, instrumental: r?.l.instrumental } satisfies CacheEntry)); } catch {}
  return r?.l ?? null;
}

/** Удалить кэш текста вместе с загрузкой. */
export function forget(id: string) {
  mem.delete(id);
  try { const f = file(id); if (f.exists) f.delete(); } catch {}
}

const UA = { 'User-Agent': 'Noir iOS (https://github.com/trualontuu/player)' };

async function fetchLrclib(t: Track): Promise<{ l: Lyrics; synced: string | null } | null> {
  const artist = t.artistRefs[0]?.name ?? t.artists;
  const dur = Math.round(t.durationMs / 1000);
  // 1) точное совпадение с длительностью — самое надёжное
  const q = new URLSearchParams({ artist_name: artist, track_name: t.title });
  if (t.album) q.set('album_name', t.album);
  if (dur > 1) q.set('duration', String(dur));
  const r = await fetch('https://lrclib.net/api/get?' + q, { headers: UA });
  if (r.ok) { const x = fromJson(await r.json()); if (x) return x; }
  // 2) поиск по очищенным названию и исполнителю, ближайший по длительности
  const s = await fetch('https://lrclib.net/api/search?' + new URLSearchParams({ track_name: cleanTitle(t.title), artist_name: cleanArtist(artist) }), { headers: UA });
  if (!s.ok) throw new Error('lrclib ' + s.status);
  const arr: any[] = await s.json();
  let best: any = null, bestScore = Infinity;
  for (const e of Array.isArray(arr) ? arr : []) {
    const synced = typeof e.syncedLyrics === 'string' && e.syncedLyrics.length > 0;
    const plain = typeof e.plainLyrics === 'string' && e.plainLyrics.length > 0;
    if (!synced && !plain) continue;
    const d = typeof e.duration === 'number' && dur > 1 ? Math.abs(e.duration - dur) : 0;
    if (dur > 1 && d > 6) continue; // другая версия трека — тайминги разъедутся
    const score = d + (synced ? 0 : 1000);
    if (score < bestScore) { bestScore = score; best = e; }
  }
  return best ? fromJson(best) : null;
}

function fromJson(e: any): { l: Lyrics; synced: string | null } | null {
  const synced = typeof e?.syncedLyrics === 'string' ? e.syncedLyrics : null;
  const plain = typeof e?.plainLyrics === 'string' ? e.plainLyrics : null;
  const l = build(synced, plain, e?.instrumental === true);
  return l.lines.length || l.plain || l.instrumental ? { l, synced } : null;
}

const TAG = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;

function build(synced: string | null, plain: string | null, instrumental: boolean): Lyrics {
  const lines: Line[] = [];
  for (const raw of (synced ?? '').split('\n')) {
    const tags = [...raw.matchAll(TAG)];
    if (!tags.length) continue;
    const last = tags[tags.length - 1];
    const text = raw.slice(last.index! + last[0].length).trim();
    for (const m of tags) lines.push({ t: Number(m[1]) * 60 + Number(m[2].replace(':', '.')), text });
  }
  lines.sort((a, b) => a.t - b.t);
  return { lines, plain: plain?.trim() || null, instrumental };
}

const JUNK = /\s*[([][^)\]]*(official|video|lyric|audio|клип|remaster|visuali[sz]er|mv|hd|4k|premiere|премьера|live|explicit)[^)\]]*[)\]]/gi;
const FEAT = /\s*[([]?\s*(feat\.?|ft\.?|featuring|при уч\.)\s.*$/i;
const cleanTitle = (s: string) => s.replace(JUNK, '').replace(FEAT, '').replace(/^[\s\-–—]+|[\s\-–—]+$/g, '');
const cleanArtist = (s: string) => s.split(/\s*(?:,|&| x | feat\.? | ft\.? )\s*/i)[0].trim();

/** Хук: текст текущего трека. state: loading / none / offline / ok. */
export function useLyrics(t: Track | undefined) {
  const [v, setV] = useState<{ id?: string; state: 'loading' | 'none' | 'offline' | 'ok'; l: Lyrics | null }>({ state: 'loading', l: null });
  useEffect(() => {
    if (!t) return;
    let alive = true;
    if (mem.has(t.id)) { const l = mem.get(t.id)!; setV({ id: t.id, state: l ? 'ok' : 'none', l }); return; }
    setV({ id: t.id, state: 'loading', l: null });
    get(t).then(l => alive && setV({ id: t.id, state: l ? 'ok' : 'none', l }))
      .catch(() => alive && setV({ id: t.id, state: 'offline', l: null }));
    return () => { alive = false; };
  }, [t?.id]);
  return v.id === t?.id ? v : { state: 'loading' as const, l: null };
}

/** Индекс текущей строки по времени (−1 — до первой). */
export function lineAt(lines: Line[], time: number): number {
  let lo = 0, hi = lines.length - 1, r = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (lines[m].t <= time + 0.25) { r = m; lo = m + 1; } else hi = m - 1; }
  return r;
}
