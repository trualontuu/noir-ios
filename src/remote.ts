// Пульт для десктопного Noir (как Spotify Connect): телефон и компьютер подключены к ретранслятору
// Noir Connect (Cloudflare, папка connect/), комната — аккаунт Яндекса. Компьютер шлёт своё состояние,
// телефон — команды. Подключаемся, только пока приложение на экране.
import { AppState } from 'react-native';
import { useSyncExternalStore } from 'react';
import * as ym from './ym';

const URL_WS = 'wss://noir-connect.raspisanie-mfszc.workers.dev/ws?role=remote';

export type HostState = {
  playing: boolean;
  title: string;
  artist: string;
  cover: string;      // ссылка на обложку
  liked: boolean;
  sc: boolean;        // SoundCloud — без лайка
  time: number;       // секунды на момент отправки
  duration: number;
  volume: number;     // 0..1
  queue: string;      // откуда играет
  id: string;         // id трека
};

export type Remote = {
  online: boolean;                           // связь с ретранслятором
  host: { name: string; state: HostState | null; at: number } | null;   // компьютер в сети
};

let st: Remote = { online: false, host: null };
const subs = new Set<() => void>();
function set(p: Partial<Remote>) { st = { ...st, ...p }; subs.forEach(f => f()); }
export const getRemote = () => st;
export const useRemote = () => useSyncExternalStore(cb => { subs.add(cb); return () => { subs.delete(cb); }; }, getRemote);

let ws: WebSocket | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;
let ping: ReturnType<typeof setInterval> | null = null;
let delay = 1000;
let active = false;
let listening = false;

function connect() {
  const token = ym.authToken();
  if (!active || ws || !token) return;
  // RN на iOS умеет заголовки у WebSocket — токен не светится в адресе
  const sock = new (WebSocket as any)(URL_WS, null, { headers: { Authorization: 'OAuth ' + token } }) as WebSocket;
  ws = sock;
  sock.onopen = () => {
    delay = 1000;
    set({ online: true });
    ping = setInterval(() => { try { sock.send('ping'); } catch {} }, 25000);
  };
  sock.onmessage = e => {
    if (e.data === 'pong') return;
    let m: any;
    try { m = JSON.parse(String(e.data)); } catch { return; }
    if (m.type === 'host') {
      if (!m.online) set({ host: null });
      else set({ host: { name: m.name || 'Компьютер', state: m.state ?? st.host?.state ?? null, at: Date.now() } });
    }
  };
  sock.onclose = () => {
    if (ping) { clearInterval(ping); ping = null; }
    if (ws === sock) ws = null;
    set({ online: false });
    if (active) { retry = setTimeout(connect, delay); delay = Math.min(delay * 2, 20000); }
  };
  sock.onerror = () => { try { sock.close(); } catch {} };
}

function disconnect() {
  if (retry) { clearTimeout(retry); retry = null; }
  const w = ws; ws = null;
  try { w?.close(); } catch {}
  set({ online: false });
}

/** Включить пульт (вызывается из корневого layout после входа). */
export function start() {
  if (active) return;
  active = true;
  connect();
  if (listening) return;
  listening = true;
  AppState.addEventListener('change', s => {
    if (!ym.authToken()) return;
    if (s === 'active') { active = true; connect(); }
    else { active = false; disconnect(); }
  });
}

export function stopAll() { active = false; disconnect(); set({ host: null }); }

function send(m: object) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(m));
}

/** Команда компьютеру. Состояние на экране меняем сразу, не дожидаясь ответа. */
function cmd(name: string, extra: object = {}, optimistic?: Partial<HostState>) {
  send({ cmd: name, ...extra });
  const h = st.host;
  if (h?.state && optimistic) set({ host: { ...h, state: { ...h.state, time: hostTime(h), ...optimistic }, at: Date.now() } });
}

/** Текущее время на компьютере с поправкой на прошедшее время. */
export function hostTime(h: NonNullable<Remote['host']>) {
  const s = h.state;
  if (!s) return 0;
  return Math.min(s.duration, s.time + (s.playing ? (Date.now() - h.at) / 1000 : 0));
}

export const toggle = () => cmd('toggle', {}, { playing: !st.host?.state?.playing, time: st.host ? hostTime(st.host) : 0 });
export const next = () => cmd('next');
export const prev = () => cmd('prev');
export const like = () => cmd('like', {}, { liked: !st.host?.state?.liked });
export const wave = () => cmd('wave');
export const setVolume = (v: number) => cmd('volume', { v: Math.max(0, Math.min(1, v)) }, { volume: Math.max(0, Math.min(1, v)) });
export const seek = (t: number) => cmd('seek', { t }, { time: t });
export const refresh = () => send({ cmd: 'state' });
