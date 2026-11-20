// Скачанные треки: аудио (AAC или mp3) + обложка в документах приложения, индекс в downloads/index.json.
// Скачанный трек плеер берёт из файла — играет без интернета и не тратит трафик.
import { Directory, File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { settings } from './settings';
import * as ym from './ym';
import type { Track } from './ym';

type Entry = { track: Track; size: number; at: number; file?: string; fmt?: string }; // file нет у старых — это <id>.mp3
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

const audio = (id: string) => new File(dir, state.done[id]?.file ?? `${id}.mp3`);
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
const queue: Track[] = [];
let running = 0;
const PARALLEL = 2;

export function download(tracks: Track[], redo = false) {
  const progress = { ...state.progress };
  const failed = { ...state.failed };
  for (const t of tracks) {
    if (!t.available || (state.done[t.id] && !redo) || t.id in progress) continue;
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
  const w = wanted();
  const dst = new File(dir, `${t.id}.part`); // старый файл живёт, пока новый не докачан целиком
  try {
    const fetchAs = async (codec: 'mp3' | 'aac', kbps: number) => {
      const { url } = await ym.fileUrl(t, kbps, codec);
      if (!(t.id in state.progress)) return null; // отменили, пока получали ссылку
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
      if (f.size < 32 * 1024) throw new Error('сервер вернул не аудио');
      return f;
    };
    let f;
    try { f = await fetchAs(w.codec, w.kbps); }
    catch (e) { if (w.codec === 'mp3') throw e; f = await fetchAs('mp3', settings().quality); } // AAC не отдали — берём mp3
    if (!f) return;
    if (!(t.id in state.progress)) { try { dst.delete(); } catch {} return; } // удалили, пока качался
    const name = `${t.id}.${sniff(dst)}`;
    const old = state.done[t.id];
    if (old) { try { const o = audio(t.id); if (o.exists) o.delete(); } catch {} }
    const fin = new File(dir, name); if (fin.exists) fin.delete();
    dst.rename(name);
    const c = cover(t.id);
    if (t.coverUri && !c.exists) { try { await File.downloadFileAsync(ym.img(t.coverUri, 400), c); } catch {} }
    const { [t.id]: _, ...progress } = state.progress;
    set({ done: { ...state.done, [t.id]: { track: t, size: new File(dir, name).size, at: old?.at ?? Date.now(), file: name, fmt: w.fmt } }, progress });
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
    for (const f of [audio(id), cover(id), new File(dir, `${id}.part`)]) { try { if (f.exists) f.delete(); } catch {} }
    delete done[id]; delete progress[id];
    const i = queue.findIndex(t => t.id === id); if (i >= 0) queue.splice(i, 1);
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

export const fmtSize = (b: number) => b >= 1 << 30 ? `${(b / (1 << 30)).toFixed(1)} ГБ` : `${Math.round(b / (1 << 20))} МБ`;
