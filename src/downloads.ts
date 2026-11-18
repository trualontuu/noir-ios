// Скачанные треки: mp3 + обложка в документах приложения, индекс в downloads/index.json.
// Скачанный трек плеер берёт из файла — играет без интернета и не тратит трафик.
import { Directory, File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { settings } from './settings';
import * as ym from './ym';
import type { Track } from './ym';

type Entry = { track: Track; size: number; at: number };
type State = {
  done: Record<string, Entry>;          // id → скачанный трек
  progress: Record<string, number>;     // id → 0..1, пока качается (в очереди — 0)
  failed: Record<string, string>;
};

const dir = new Directory(Paths.document, 'downloads');
const indexFile = new File(dir, 'index.json');

let state: State = { done: {}, progress: {}, failed: {} };
try {
  dir.create({ idempotent: true, intermediates: true });
  if (indexFile.exists) state.done = JSON.parse(indexFile.textSync());
} catch {}

const subs = new Set<() => void>();
function set(p: Partial<State>) { state = { ...state, ...p }; subs.forEach(f => f()); }
export const useDownloads = () => useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, () => state);

const audio = (id: string) => new File(dir, `${id}.mp3`);
const cover = (id: string) => new File(dir, `${id}.jpg`);
const save = () => { try { indexFile.write(JSON.stringify(state.done)); } catch {} };

export const isDownloaded = (id: string) => !!state.done[id];
/** Локальный файл трека, если он скачан и на месте. */
export function localUri(t: Track): string | null {
  if (!state.done[t.id]) return null;
  const f = audio(t.id);
  return f.exists ? f.uri : null;
}
/** Обложка: локальная у скачанных (для офлайна), иначе из сети. */
export function coverSrc(t: Track, px: number): string {
  if (state.done[t.id]) { const c = cover(t.id); if (c.exists) return c.uri; }
  return ym.img(t.coverUri, px);
}

/** Все скачанные, новые сверху. */
export const list = () => Object.values(state.done).sort((a, b) => b.at - a.at).map(e => e.track);
export const totalBytes = () => Object.values(state.done).reduce((n, e) => n + e.size, 0);

// ---------------------------------------------------------------- очередь загрузок
const queue: Track[] = [];
let running = 0;
const PARALLEL = 2;

export function download(tracks: Track[]) {
  const progress = { ...state.progress };
  const failed = { ...state.failed };
  for (const t of tracks) {
    if (!t.available || state.done[t.id] || t.id in progress) continue;
    progress[t.id] = 0;
    delete failed[t.id];
    queue.push(t);
  }
  set({ progress, failed });
  pump();
}

function pump() {
  while (running < PARALLEL && queue.length) {
    const t = queue.shift()!;
    running++;
    one(t).finally(() => { running--; pump(); });
  }
}

async function one(t: Track) {
  const dst = audio(t.id);
  try {
    const url = await ym.streamUrl(t, settings().quality);
    if (!(t.id in state.progress)) return; // отменили, пока получали ссылку
    if (dst.exists) dst.delete();
    let last = 0;
    const task = File.createDownloadTask(url, dst, {
      onProgress: ({ bytesWritten, totalBytes }) => {
        const k = totalBytes > 0 ? bytesWritten / totalBytes : 0;
        if (k - last > 0.04) { last = k; set({ progress: { ...state.progress, [t.id]: k } }); }
      },
    });
    const f = await task.downloadAsync();
    if (!f) throw new Error('загрузка прервана');
    if (t.coverUri) { try { const c = cover(t.id); if (c.exists) c.delete(); await File.downloadFileAsync(ym.img(t.coverUri, 400), c); } catch {} }
    const { [t.id]: _, ...progress } = state.progress;
    set({ done: { ...state.done, [t.id]: { track: t, size: f.size, at: Date.now() } }, progress });
    save();
  } catch (e: any) {
    try { if (dst.exists) dst.delete(); } catch {}
    const { [t.id]: _, ...progress } = state.progress;
    set({ progress, failed: { ...state.failed, [t.id]: e?.message ?? 'ошибка' } });
  }
}

export function remove(ids: string[]) {
  const done = { ...state.done };
  const progress = { ...state.progress };
  for (const id of ids) {
    delete done[id]; delete progress[id];
    const i = queue.findIndex(t => t.id === id); if (i >= 0) queue.splice(i, 1);
    for (const f of [audio(id), cover(id)]) { try { if (f.exists) f.delete(); } catch {} }
  }
  set({ done, progress });
  save();
}

export const removeAll = () => remove(Object.keys(state.done));

export const fmtSize = (b: number) => b >= 1 << 30 ? `${(b / (1 << 30)).toFixed(1)} ГБ` : `${Math.round(b / (1 << 20))} МБ`;
