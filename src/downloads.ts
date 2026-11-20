// Скачанные треки: аудио (AAC или mp3) + обложка в документах приложения, индекс в downloads/index.json.
// Скачанный трек плеер берёт из файла — играет без интернета и не тратит трафик.
// Отдельно — «запас волны» (pool.json): треки «Моей волны», скачанные заранее, чтобы волна играла
// без сети. В «Скачанных» они не видны; прослушанные заменяются свежими, когда есть интернет.
import { Directory, File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import * as lyr from './lyrics';
import { settings } from './settings';
import * as ym from './ym';
import type { Track } from './ym';

type Entry = { track: Track; size: number; at: number; file?: string; fmt?: string; played?: boolean }; // file нет у старых — это <id>.mp3
type State = {
  done: Record<string, Entry>;          // id → скачанный трек
  progress: Record<string, number>;     // id → 0..1, пока качается (в очереди — 0)
  failed: Record<string, string>;
  pool: Record<string, Entry>;          // запас волны
  poolBusy: Record<string, number>;     // запас волны, который сейчас качается
};

const dir = new Directory(Paths.document, 'downloads');
const indexFile = new File(dir, 'index.json');
const poolFile = new File(dir, 'pool.json');

let state: State = { done: {}, progress: {}, failed: {}, pool: {}, poolBusy: {} };
try {
  dir.create({ idempotent: true, intermediates: true });
  if (indexFile.exists) state.done = JSON.parse(indexFile.textSync());
  if (poolFile.exists) state.pool = JSON.parse(poolFile.textSync());
} catch {}

const subs = new Set<() => void>();
function set(p: Partial<State>) { state = { ...state, ...p }; subs.forEach(f => f()); }
export const useDownloads = () => useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, () => state);

const entry = (id: string): Entry | undefined => state.done[id] ?? state.pool[id];
const audio = (id: string) => new File(dir, entry(id)?.file ?? `${id}.mp3`);
const cover = (id: string) => new File(dir, `${id}.jpg`);
const part = (id: string) => new File(dir, `${id}.part`);
const save = () => { try { indexFile.write(JSON.stringify(state.done)); } catch {} };
const savePool = () => { try { poolFile.write(JSON.stringify(state.pool)); } catch {} };
const del = (fs: File[]) => { for (const f of fs) { try { if (f.exists) f.delete(); } catch {} } };

export const isDownloaded = (id: string) => !!state.done[id];
/** Локальный файл трека (скачанный или из запаса волны), если он на месте. */
export function localUri(t: Track): string | null {
  if (!entry(t.id)) return null;
  const f = audio(t.id);
  return f.exists ? f.uri : null;
}
/** Обложка: локальная у скачанных (для офлайна), иначе из сети. */
export function coverSrc(t: Track, px: number): string {
  if (entry(t.id)) { const c = cover(t.id); if (c.exists) return c.uri; }
  return ym.img(t.coverUri, px);
}

/** Формат загрузок по настройке: кодек, потолок кбит/с и метка для индекса. */
function wanted() {
  const q = settings().dlQuality;
  return q === 'mp3' ? { codec: 'mp3' as const, kbps: settings().quality, fmt: `mp3-${settings().quality}` }
    : { codec: 'aac' as const, kbps: q === 'aac128' ? 128 : 192, fmt: q };
}

/** Сколько скачанных лежит не в текущем формате (их можно пережать). */
export function outdated(): string[] {
  const f = wanted().fmt;
  return Object.values(state.done).filter(e => (e.fmt ?? 'mp3-320') !== f).map(e => e.track.id);
}

/** Тип файла по первым байтам: MP4/M4A, ADTS AAC или mp3. AVPlayer выбирает декодер по расширению. */
function sniff(f: File): string {
  try {
    const h = f.open(); const b = h.readBytesSync(12); h.close();
    if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'm4a'; // ftyp
    if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return 'mp3';                 // ID3
    if (b[0] === 0xff && (b[1] & 0xf6) === 0xf0) return 'aac';                            // ADTS
  } catch {}
  return 'mp3';
}

/** Все скачанные, новые сверху. */
export const list = () => Object.values(state.done).sort((a, b) => b.at - a.at).map(e => e.track);
export const totalBytes = () => Object.values(state.done).reduce((n, e) => n + e.size, 0);

// ---------------------------------------------------------------- очередь загрузок
type Job = { t: Track; pool: boolean };
const queue: Job[] = [];
let running = 0;
const PARALLEL = 2;

export function download(tracks: Track[], redo = false) {
  const progress = { ...state.progress };
  const failed = { ...state.failed };
  const pool = { ...state.pool };
  let done = state.done;
  for (const t of tracks) {
    if (!t.available || (done[t.id] && !redo) || t.id in progress) continue;
    if (pool[t.id] && !done[t.id]) { // уже лежит в запасе волны — просто переносим в «Скачанные»
      done = { ...done, [t.id]: { ...pool[t.id], played: undefined, at: Date.now() } };
      delete pool[t.id];
      continue;
    }
    progress[t.id] = 0;
    delete failed[t.id];
    queue.push({ t, pool: false });
  }
  const moved = done !== state.done;
  set({ progress, failed, pool, done });
  if (moved) { save(); savePool(); }
  pump();
}

function pump() {
  queue.sort((a, b) => Number(a.pool) - Number(b.pool)); // свои загрузки — вперёд запаса волны
  while (running < PARALLEL && queue.length) {
    const j = queue.shift()!;
    running++;
    (j.pool ? onePool(j.t) : one(j.t)).finally(() => { running--; pump(); });
  }
}

/** Качает файл трека в <id>.part (AAC, при неудаче — mp3). null — отменили. */
async function fetchFile(t: Track, dst: File, alive: () => boolean, onK: (k: number) => void): Promise<File | null> {
  const w = wanted();
  const fetchAs = async (codec: 'mp3' | 'aac', kbps: number) => {
    const { url } = await ym.fileUrl(t, kbps, codec);
    if (!alive()) return null; // отменили, пока получали ссылку
    if (dst.exists) dst.delete();
    let last = 0;
    const task = File.createDownloadTask(url, dst, {
      onProgress: ({ bytesWritten, totalBytes }) => {
        const k = totalBytes > 0 ? bytesWritten / totalBytes : 0;
        if (k - last > 0.04) { last = k; onK(k); }
      },
    });
    const f = await task.downloadAsync();
    if (!f) throw new Error('загрузка прервана');
    if (f.size < 32 * 1024) throw new Error('сервер вернул не аудио');
    return f;
  };
  try { return await fetchAs(w.codec, w.kbps); }
  catch (e) { if (w.codec === 'mp3') throw e; return await fetchAs('mp3', settings().quality); } // AAC не отдали — берём mp3
}

/** Докачанный .part → <id>.<расширение по сигнатуре> + обложка. Возвращает имя файла. */
async function finish(t: Track, dst: File): Promise<string> {
  const name = `${t.id}.${sniff(dst)}`;
  del([new File(dir, name)]);
  dst.rename(name);
  const c = cover(t.id);
  if (t.coverUri && !c.exists) { try { await File.downloadFileAsync(ym.img(t.coverUri, 400), c); } catch {} }
  return name;
}

async function one(t: Track) {
  const dst = part(t.id); // старый файл живёт, пока новый не докачан целиком
  try {
    const f = await fetchFile(t, dst, () => t.id in state.progress, k => set({ progress: { ...state.progress, [t.id]: k } }));
    if (!f) return;
    if (!(t.id in state.progress)) { del([dst]); return; } // удалили, пока качался
    const old = state.done[t.id];
    if (old) del([audio(t.id)]);
    const name = await finish(t, dst);
    const { [t.id]: _, ...progress } = state.progress;
    set({ done: { ...state.done, [t.id]: { track: t, size: new File(dir, name).size, at: old?.at ?? Date.now(), file: name, fmt: wanted().fmt } }, progress });
    save();
  } catch (e: any) {
    del([dst]);
    const { [t.id]: _, ...progress } = state.progress;
    set({ progress, failed: { ...state.failed, [t.id]: e?.message ?? 'ошибка' } });
  }
}

async function onePool(t: Track) {
  const dst = part(t.id);
  const alive = () => t.id in state.poolBusy && !state.done[t.id];
  try {
    const f = await fetchFile(t, dst, alive, k => set({ poolBusy: { ...state.poolBusy, [t.id]: k } }));
    if (!f || !alive()) { del([dst]); return; }
    const name = await finish(t, dst);
    set({ pool: { ...state.pool, [t.id]: { track: t, size: new File(dir, name).size, at: Date.now(), file: name, fmt: wanted().fmt } } });
    savePool();
  } catch {
    del([dst]);
  } finally {
    const { [t.id]: _, ...poolBusy } = state.poolBusy;
    set({ poolBusy });
    if (!Object.keys(poolBusy).length) idleHooks.forEach(f => f());
  }
}

export function remove(ids: string[]) {
  const done = { ...state.done };
  const progress = { ...state.progress };
  for (const id of ids) {
    if (!state.pool[id]) del([audio(id), cover(id), part(id)]);
    lyr.forget(id);
    delete done[id]; delete progress[id];
    const i = queue.findIndex(j => !j.pool && j.t.id === id); if (i >= 0) queue.splice(i, 1);
  }
  set({ done, progress });
  save();
}

export const removeAll = () => remove(Object.keys(state.done));

/**
 * Перекачать скачанные в текущем формате. Каждый трек заменяется только после
 * успешной загрузки нового файла — без сети старый просто остаётся.
 */
export function convert() {
  const ids = outdated();
  if (!ids.length) return;
  download(ids.map(id => state.done[id].track), true);
}

// ---------------------------------------------------------------- запас волны
export const poolTracks = () => Object.values(state.pool).sort((a, b) => a.at - b.at);
export const poolBytes = () => Object.values(state.pool).reduce((n, e) => n + e.size, 0);
export const inPool = (id: string) => !!state.pool[id];
export const poolPending = () => Object.keys(state.poolBusy).length;
const idleHooks = new Set<() => void>();
/** Вызывается, когда очередь загрузок запаса опустела. */
export const onPoolIdle = (f: () => void) => { idleHooks.add(f); };

/** Трек из запаса прозвучал — при следующем обновлении его заменит свежий. */
export function markPlayed(id: string) {
  const e = state.pool[id];
  if (!e || e.played) return;
  set({ pool: { ...state.pool, [id]: { ...e, played: true } } });
  savePool();
}

/** Убрать из запаса (файлы удаляются, если трек не в «Скачанных»). */
export function dropPool(ids: string[]) {
  const pool = { ...state.pool };
  const poolBusy = { ...state.poolBusy };
  for (const id of ids) {
    if (!state.done[id]) del([audio(id), cover(id), part(id)]);
    delete pool[id]; delete poolBusy[id];
    const i = queue.findIndex(j => j.pool && j.t.id === id); if (i >= 0) queue.splice(i, 1);
  }
  set({ pool, poolBusy });
  savePool();
}

/** Докачать в запас эти треки (то, чего ещё нет ни в запасе, ни в «Скачанных»). */
export function fillPool(tracks: Track[]) {
  const poolBusy = { ...state.poolBusy };
  for (const t of tracks) {
    if (!t.available || state.done[t.id] || state.pool[t.id] || t.id in poolBusy) continue;
    poolBusy[t.id] = 0;
    queue.push({ t, pool: true });
  }
  set({ poolBusy });
  pump();
}

export const fmtSize = (b: number) => b >= 1 << 30 ? `${(b / (1 << 30)).toFixed(1)} ГБ` : `${Math.round(b / (1 << 20))} МБ`;
