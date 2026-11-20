// «Волна без интернета»: держим N треков «Моей волны» скачанными заранее.
// Прослушанные выкидываем и докачиваем свежие, когда есть сеть: при открытии приложения
// (не чаще раза в 30 минут), при старте волны онлайн, при смене настройки и на каждом треке,
// пока волна играет из запаса (без сети — попытка раз в 2 минуты: как появится интернет, докачаем).
import { AppState } from 'react-native';
import * as dl from './downloads';
import { settings } from './settings';
import * as ym from './ym';
import type { Track } from './ym';

let busy = false;
let lastAt = 0;   // последнее удачное обновление
let lastTry = 0;  // последняя попытка (без сети пробуем раз в 2 минуты)
let rounds = 0;    // сколько раз подряд добирали после завершения загрузок
let currentId: () => string | undefined = () => undefined;

/** player сообщает, что сейчас играет — этот трек из запаса не удаляем. */
export const setCurrentGetter = (f: () => string | undefined) => { currentId = f; };

export async function refresh(force = false) {
  const n = settings().offlineWave;
  const cur = currentId();
  if (!n) {
    const ids = dl.poolTracks().map(e => e.track.id).filter(id => id !== cur);
    if (ids.length) dl.dropPool(ids);
    return;
  }
  if (busy || (!force && (Date.now() - lastAt < 30 * 60e3 || Date.now() - lastTry < 2 * 60e3))) return;
  busy = true;
  lastTry = Date.now();
  try {
    const all = dl.poolTracks();
    const played = all.filter(e => e.played && e.track.id !== cur).map(e => e.track.id);
    let keep = all.filter(e => !played.includes(e.track.id));
    const extra = keep.length > n ? keep.slice(0, keep.length - n).map(e => e.track.id).filter(id => id !== cur) : [];
    keep = keep.filter(e => !extra.includes(e.track.id));
    if (extra.length) dl.dropPool(extra);
    const need = n - keep.length - dl.poolPending();
    if (need <= 0) { lastAt = Date.now(); return; }

    // сначала убеждаемся, что сеть есть: без неё прослушанные не трогаем — их ещё можно слушать по второму кругу
    const s = settings();
    const { session, tracks } = await ym.waveStart(ym.waveSeeds(s.waveMood, s.waveDiversity, s.waveScene));
    if (played.length) dl.dropPool(played);
    const fresh = (t: Track) => t.available && !dl.isDownloaded(t.id) && !dl.inPool(t.id);
    const got: Track[] = tracks.filter(fresh);
    // волна отдаёт ~5 треков за раз (часть — повторы или уже скачанные): просим, пока не наберём,
    // но бросаем, если 3 раза подряд ничего нового
    let last = tracks.slice(-5), empty = 0;
    for (let i = 0; i < 40 && got.length < need && empty < 3; i++) {
      const more = await ym.waveMore(session, last);
      const before = got.length;
      for (const t of more) if (fresh(t) && !got.some(x => x.id === t.id)) got.push(t);
      if (more.length) last = more.slice(-5);
      empty = got.length > before ? 0 : empty + 1;
    }
    dl.fillPool(got.slice(0, need));
    lastAt = Date.now();
  } catch {
    // нет сети или аккаунта — попробуем в следующий раз
  } finally { busy = false; }
}

/** Треки запаса для игры без сети: сначала не слышанные, потом остальные, каждая часть перемешана. */
export function offlineQueue(): Track[] {
  const all = dl.poolTracks();
  const fresh = shuffled(all.filter(e => !e.played).map(e => e.track));
  const old = shuffled(all.filter(e => e.played).map(e => e.track));
  return [...fresh, ...old];
}

function shuffled<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

// загрузки запаса закончились, а до нужного числа не дотянули (повторы, ошибки) — добираем ещё,
// но не больше 3 раз подряд, чтобы не крутиться, если волне больше нечего предложить
dl.onPoolIdle(() => {
  const n = settings().offlineWave;
  if (!n) return;
  if (dl.poolTracks().filter(e => !e.played).length >= n) { rounds = 0; return; }
  if (rounds >= 3) return;
  rounds++;
  setTimeout(() => refresh(true), 3000);
});

// открыли приложение — освежаем запас (сама функция не чаще раза в 30 минут)
AppState.addEventListener('change', s => { if (s === 'active') refresh(); });
setTimeout(() => refresh(), 8000); // первый запуск: даём приложению войти в аккаунт
