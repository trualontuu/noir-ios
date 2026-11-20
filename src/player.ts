// Движок воспроизведения. Очередь держим сами (queue), а в нативный AudioPlaylist (AVQueuePlayer)
// кладём уже готовые ссылки на текущий трек и пару следующих: переход на следующий трек
// делает iOS сама, даже с выключенным экраном, а JS в фоне только дозаправляет очередь.
// Скачанные треки идут из файла, остальные — по подписанной ссылке Яндекса.
import { createAudioPlaylist, setAudioModeAsync, type AudioPlaylist, type AudioPlaylistStatus } from 'expo-audio';
import { useSyncExternalStore } from 'react';
import * as dl from './downloads';
import { settings } from './settings';
import * as pool from './wavePool';
import * as ym from './ym';
import type { Track, WaveSession } from './ym';

const AHEAD = 2;           // сколько следующих треков держать с готовой ссылкой
const WAVE_REFILL = 3;     // когда в волне осталось меньше — просим ещё
const LUFS_REF = -9;       // как в десктопе: опорный уровень, громкие треки приглушаются

export type Repeat = 'off' | 'all' | 'one';

export type PlayerState = {
  queue: Track[];
  index: number;           // индекс в queue, -1 — ничего не играет
  playing: boolean;
  buffering: boolean;
  wave: boolean;
  offline: boolean;        // волна играет из запаса, без интернета
  shuffle: boolean;
  repeat: Repeat;
  error: string | null;
};

let state: PlayerState = { queue: [], index: -1, playing: false, buffering: false, wave: false, offline: false, shuffle: false, repeat: 'off', error: null };
const subs = new Set<() => void>();
function set(p: Partial<PlayerState>) { state = { ...state, ...p }; subs.forEach(f => f()); }
const subscribe = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; };

export const getState = () => state;
export const usePlayer = () => useSyncExternalStore(subscribe, getState);
/** Подписка на часть состояния: компонент перерисуется, только когда изменится выбранное значение. */
export const usePlayerSel = <T,>(sel: (s: PlayerState) => T) => useSyncExternalStore(subscribe, () => sel(state));

// Время трека живёт отдельно: оно меняется 4 раза в секунду, и на него подписаны только полоса прогресса и пара подписей.
export type Progress = { time: number; duration: number; at: number };
let prog: Progress = { time: 0, duration: 0, at: 0 };
const progSubs = new Set<() => void>();
function setProg(time: number, duration: number) { prog = { time, duration, at: Date.now() }; progSubs.forEach(f => f()); }
export const getProgress = () => prog;
export const useProgress = () => useSyncExternalStore(cb => { progSubs.add(cb); return () => { progSubs.delete(cb); }; }, getProgress);
export const current = (): Track | null => state.queue[state.index] ?? null;
pool.setCurrentGetter(() => current()?.id);
/** Перерисовать подписчиков (лайк, загрузка) без смены состояния плеера. */
export const touch = () => set({});

let pl: AudioPlaylist | null = null;
let base = 0;              // queue[base] лежит в pl под индексом 0
let gen = 0;               // поколение очереди: старые асинхронные подгрузки после смены очереди выбрасываются
let wave: WaveSession | null = null;
let source: Track[] = [];  // исходный порядок списка — для «выключить перемешивание» и повтора
let lastTime = 0;
let userSkip = false;
let filling = false;
let lockActive = false;
let building = false;      // пока пересобираем очередь, события смены трека от натива игнорируем
let seekTo: number | null = null;  // после перемотки натив ещё немного присылает старое время — держим новое
let seekUntil = 0;
let baseVol = 1;           // громкость по LUFS
let fadeInAt = 0, fadeInMs = 0;    // нарастание в начале трека / после паузы
let ticker: ReturnType<typeof setInterval> | null = null;
let stallSince = 0;

/** Похоже на «нет сети», а не на проблему с конкретным треком. */
const isNet = (e: any) => e instanceof TypeError || /network|timed out|offline|internet|связ/i.test(String(e?.message ?? e));

/**
 * Пропала сеть посреди волны: всё, что после текущего трека, заменяем запасом волны.
 * skipCurrent — текущий трек тоже не доиграет (он не скачан), сразу переходим к запасу.
 */
function goOffline(skipCurrent: boolean): boolean {
  const have = new Set(state.queue.slice(0, state.index + 1).map(t => t.id));
  const spare = pool.offlineQueue().filter(t => !have.has(t.id));
  if (!spare.length) { set({ error: 'Нет связи. Включи «Волну без интернета» в настройках, чтобы играть без сети' }); return false; }
  wave = null;
  if (skipCurrent) { playList([...state.queue.slice(0, state.index), ...spare], state.index, null, true, true); return true; }
  trimAhead();
  set({ queue: [...state.queue.slice(0, state.index + 1), ...spare], offline: true, error: null });
  setTimeout(fill, 0);
  return true;
}

async function ensure(): Promise<AudioPlaylist> {
  if (pl) return pl;
  await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' });
  pl = createAudioPlaylist({ updateInterval: 250 });
  pl.addListener('playlistStatusUpdate', onStatus);
  pl.addListener('trackChanged', onTrackChanged);
  return pl;
}

function onStatus(s: AudioPlaylistStatus) {
  if (s.currentTime > 0) lastTime = s.currentTime;
  if (s.didJustFinish && wave && current()) ym.waveFeedback(wave, 'trackFinished', current()!, lastTime);
  if (!pausing && (s.playing !== state.playing || s.isBuffering !== state.buffering)) set({ playing: s.playing, buffering: s.isBuffering });
  // онлайн-волна застряла в загрузке дольше 10 с (пропала сеть) — переходим на запас
  if (s.isBuffering && state.wave && !state.offline && !dl.localUri(current() ?? ({ id: '' } as Track))) {
    if (!stallSince) stallSince = Date.now();
    else if (Date.now() - stallSince > 10000) { stallSince = 0; goOffline(true); }
  } else stallSince = 0;
  let time = s.currentTime;
  if (seekTo != null) {
    if (Date.now() < seekUntil && Math.abs(time - seekTo) > 1.2) time = seekTo;
    else seekTo = null;
  }
  setProg(time, s.duration || (current()?.durationMs ?? 0) / 1000);
  if (s.playing && !ticker) ticker = setInterval(tick, 100);
  else if (!s.playing && ticker) { clearInterval(ticker); ticker = null; }
}

/**
 * Плавный переход: последние N секунд трек затихает, следующий нарастает.
 * Нативная очередь играет один трек за раз, поэтому это затухание + нарастание, а не наложение.
 */
function tick() {
  if (!pl || pausing) return;
  const t = current();
  const cf = settings().crossfade;
  const now = Date.now();
  const time = prog.time + (state.playing ? (now - prog.at) / 1000 : 0);
  const dur = prog.duration || (t?.durationMs ?? 0) / 1000;
  let k = 1;
  const hasNext = state.index + 1 < state.queue.length && state.repeat !== 'one';
  if (cf > 0 && hasNext && dur > cf * 3) k = Math.min(k, Math.max(0, (dur - time) / cf));
  if (fadeInMs > 0) {
    const g = (now - fadeInAt) / fadeInMs;
    if (g >= 1) fadeInMs = 0; else k = Math.min(k, Math.max(0, g));
  }
  const v = baseVol * (k * k * (3 - 2 * k)); // сглаженная кривая — на слух ровнее линейной
  if (Math.abs(pl.volume - v) > 0.004) pl.volume = v;
}

function fadeIn(ms: number) {
  fadeInAt = Date.now(); fadeInMs = ms;
  if (pl) pl.volume = 0;
}

function onTrackChanged({ previousIndex, currentIndex }: { previousIndex: number; currentIndex: number }) {
  if (building || currentIndex < 0 || base + currentIndex >= state.queue.length) return;
  const prev = state.queue[base + previousIndex];
  if (wave && prev && previousIndex !== currentIndex) {
    const finished = !userSkip && prev.durationMs > 0 && lastTime >= prev.durationMs / 1000 - 3;
    ym.waveFeedback(wave, finished ? 'trackFinished' : 'skip', prev, lastTime);
  }
  const cf = settings().crossfade;
  fadeIn(userSkip || cf === 0 ? 250 : Math.min(3000, cf * 500));
  userSkip = false;
  lastTime = 0;
  seekTo = null;
  set({ index: base + currentIndex, error: null });
  setProg(0, (current()?.durationMs ?? 0) / 1000);
  started();
  fill();
}

/** Новый трек пошёл: локскрин, громкость, отзыв волне. */
function started() {
  const t = current();
  if (!t || !pl) return;
  const meta = { title: ym.fullTitle(t), artist: t.artists, albumTitle: t.album, artworkUrl: ym.img(t.coverUri, 600) };
  if (!lockActive) {
    pl.setActiveForLockScreen(true, meta, { showNextTrack: true, showPreviousTrack: true });
    lockActive = true;
  } else pl.updateLockScreenMetadata(meta);
  applyVolume();
  if (wave) ym.waveFeedback(wave, 'trackStarted', t);
  dl.markPlayed(t.id);
  if (state.offline) pool.refresh();
}

export function applyVolume() {
  const t = current();
  // Телефон не умеет громче 1.0, поэтому только приглушаем то, что громче опорного уровня.
  baseVol = !settings().normalize || t?.lufs == null ? 1 : Math.max(0.3, Math.min(1, Math.pow(10, (LUFS_REF - t.lufs) / 20)));
  if (pl && !fadeInMs && !pausing) pl.volume = baseVol;
}

/** Дозаправка: готовые ссылки на AHEAD треков вперёд; в волне — новые треки, при повторе — список заново. */
async function fill() {
  if (filling || !pl) return;
  filling = true;
  const g = gen;
  try {
    const left = state.queue.length - state.index - 1;
    if (wave && left < WAVE_REFILL) {
      const recent = state.queue.slice(Math.max(0, state.index - 4), state.index + 1);
      const more = await ym.waveMore(wave, recent);
      if (g !== gen) return;
      const have = new Set(state.queue.map(t => t.id));
      set({ queue: [...state.queue, ...more.filter(t => !have.has(t.id))] });
    } else if (!wave && state.repeat === 'all' && left < AHEAD && source.length) {
      set({ queue: [...state.queue, ...(state.shuffle ? shuffled(source) : source)] });
    }
    while (g === gen && pl.trackCount - (state.index - base) - 1 < AHEAD && base + pl.trackCount < state.queue.length) {
      if (!(await addAt(base + pl.trackCount, g))) break;
    }
  } catch (e: any) {
    if (g !== gen) return;
    if (state.wave && !state.offline && isNet(e) && (filling = false, goOffline(false))) return;
    set({ error: e?.message ?? String(e) });
  } finally { filling = false; }
}

/** Кладёт в нативную очередь трек queue[i]. Недоступный трек выкидывает из очереди. */
async function addAt(i: number, g: number): Promise<boolean> {
  const t = state.queue[i];
  try {
    const uri = dl.localUri(t) ?? await ym.streamUrl(t, settings().quality);
    if (g !== gen) return false;
    pl!.add({ uri, name: ym.fullTitle(t) });
    return true;
  } catch (e) {
    if (e instanceof ym.AuthError || isNet(e)) throw e; // без сети треки не выкидываем
    if (g !== gen) return false;
    const q = state.queue.slice(); q.splice(i, 1);
    set({ queue: q, index: i < state.index ? state.index - 1 : state.index });
    return i < q.length;   // следующий трек встал на это место — пробуем его
  }
}

/** Убрать из нативной очереди всё после текущего (без перезапуска текущего трека) — перед перестановкой очереди. */
function trimAhead() {
  if (!pl) return;
  const cur = state.index - base;
  while (pl.trackCount - 1 > cur) pl.remove(pl.trackCount - 1);
}

/** Играть список с позиции start. */
export async function playList(tracks: Track[], start = 0, session: WaveSession | null = null, keepSource = false, offline = false) {
  const p = await ensure();
  const g = ++gen;
  wave = session;
  let list = tracks.filter(t => t.available);
  let at = Math.max(0, list.indexOf(tracks[start]));
  if (!session && !keepSource) {
    source = list;
    if (state.shuffle) { // как ShuffleRest в десктопе: выбранный трек первым, остальное перемешано заранее
      const first = list[at];
      list = [first, ...shuffled(list.filter((_, i) => i !== at))];
      at = 0;
    }
  }
  building = true;
  p.clear();
  base = at;
  userSkip = false;
  set({ queue: list, index: at, wave: !!session || offline, offline, error: null, buffering: true });
  setProg(0, (list[at]?.durationMs ?? 0) / 1000);
  seekTo = null;
  try {
    while (g === gen && p.trackCount === 0 && base < state.queue.length) {
      if (await addAt(base, g)) break;
    }
  } catch (e: any) {
    if (g === gen) building = false;
    if (g === gen && session && isNet(e) && goOffline(false)) { playList(state.queue, state.index, null, true, true); return; }
    set({ error: e?.message ?? String(e), buffering: false }); return;
  }
  finally { if (g === gen) building = false; }
  if (g !== gen || p.trackCount === 0) return;
  set({ index: base });
  p.loop = state.repeat === 'one' ? 'single' : 'none';
  fadeIn(250);
  p.play();
  started();
  fill();
}

export async function playWave() {
  const s = settings();
  const spare = pool.offlineQueue();
  set({ buffering: true, error: null });
  try {
    // есть запас — долго сеть не ждём: через 7 секунд играем из него
    const start = ym.waveStart(ym.waveSeeds(s.waveMood, s.waveDiversity, s.waveScene));
    const { session, tracks } = spare.length ? await Promise.race([start, timeout(7000)]) : await start;
    await playList(tracks, 0, session);
    pool.refresh();
  } catch (e: any) {
    if (spare.length && !(e instanceof ym.AuthError)) { await playList(spare, 0, null, false, true); return; }
    set({ error: e?.message ?? String(e), buffering: false });
  }
}

const timeout = (ms: number) => new Promise<never>((_, no) => setTimeout(() => no(new Error('нет связи')), ms));

let pausing: ReturnType<typeof setTimeout> | null = null;

/** Пауза и продолжение без щелчка: короткое затухание / нарастание. */
export function toggle() {
  if (!pl || state.index < 0) return;
  if (pausing) { clearTimeout(pausing); pausing = null; }
  if (state.playing) {
    const p = pl;
    const from = p.volume;
    let i = 0;
    const step = () => {
      i++;
      p.volume = from * Math.max(0, 1 - i / 5);
      if (i < 5) pausing = setTimeout(step, 30);
      else { pausing = null; p.pause(); p.volume = baseVol; }
    };
    set({ playing: false }); // кнопка меняется сразу, не ждём натив
    step();
  } else {
    fadeIn(300);
    set({ playing: true });
    pl.play();
  }
}

export function next() {
  if (!pl || state.index < 0) return;
  if (state.index - base < pl.trackCount - 1) { userSkip = true; pl.next(); }
  else if (state.index + 1 < state.queue.length) jump(state.index + 1);
}

export function prev() {
  if (!pl || state.index < 0) return;
  if (prog.time > 3) { seek(0); return; }
  if (state.index - base > 0) { userSkip = true; pl.previous(); }
  else if (state.index > 0) jump(state.index - 1);
  else seek(0);
}

/** Перейти к треку очереди: нативную очередь пересобираем с этого места. */
export function jump(i: number) {
  if (i < 0 || i >= state.queue.length) return;
  if (wave && current()) ym.waveFeedback(wave, 'skip', current()!, lastTime);
  playList(state.queue, i, wave, true);
}

export function seek(sec: number) {
  if (!pl) return;
  seekTo = sec; seekUntil = Date.now() + 2500;
  pl.seekTo(sec);
  setProg(sec, prog.duration);
}

/** Поставить трек сразу после текущего. Ничего не играет — просто включить. */
export function playNext(t: Track) {
  if (state.index < 0) { playList([t], 0); return; }
  trimAhead();
  const q = state.queue.slice();
  q.splice(state.index + 1, 0, t);
  set({ queue: q });
  fill();
}

export function setShuffle(on: boolean) {
  if (state.wave) return;
  const rest = state.queue.slice(state.index + 1);
  let next: Track[];
  if (on) next = shuffled(rest);
  else { // вернуть исходный порядок: продолжаем список с места текущего трека
    const cur = current();
    const i = cur ? source.findIndex(t => t.id === cur.id) : -1;
    next = i >= 0 ? source.slice(i + 1) : rest;
  }
  trimAhead();
  set({ shuffle: on, queue: [...state.queue.slice(0, state.index + 1), ...next] });
  fill();
}

export function cycleRepeat() {
  const r: Repeat = state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off';
  if (pl) pl.loop = r === 'one' ? 'single' : 'none';
  set({ repeat: r });
  fill();
}

/** Лайк сразу виден в интерфейсе; если Яндекс не принял — откатываем. */
export async function like(t: Track) {
  const on = !ym.liked.has(t.id);
  if (on) ym.liked.add(t.id); else ym.liked.delete(t.id);
  touch();
  try {
    await ym.setLike(t, on);
    if (wave && on && current()?.id === t.id) ym.waveFeedback(wave, 'like', t);
  } catch (e) {
    if (on) ym.liked.delete(t.id); else ym.liked.add(t.id);
    touch();
    throw e;
  }
}

/** Не нравится: дизлайк в Яндекс и сразу следующий трек. */
export async function dislike(t: Track) {
  await ym.dislike(t);
  if (wave) ym.waveFeedback(wave, 'dislike', t, lastTime);
  if (current()?.id === t.id) next();
}

export function stop() {
  gen++;
  wave = null;
  if (pl) { pl.clear(); pl.clearLockScreenControls(); lockActive = false; }
  set({ queue: [], index: -1, playing: false, wave: false, offline: false });
  setProg(0, 0);
}

function shuffled<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}
