// Обновления «по воздуху» (EAS Update, канал production). При запуске и при возврате в приложение
// проверяем, нет ли нового JS; если есть — скачиваем в фоне и предлагаем перезапуск.
import * as Updates from 'expo-updates';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

type State = { checking: boolean; ready: boolean; error: string | null; lastCheck: number };
let state: State = { checking: false, ready: false, error: null, lastCheck: 0 };
const subs = new Set<() => void>();
function set(p: Partial<State>) { state = { ...state, ...p }; subs.forEach(f => f()); }
export const useUpdateState = () => useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, () => state);

/** Обновления работают только в собранном приложении (не в Expo Go и не в режиме разработки). */
export const supported = () => !__DEV__ && Updates.isEnabled;

export async function check(force = false) {
  if (!supported() || state.checking || state.ready) return;
  if (!force && Date.now() - state.lastCheck < 10 * 60 * 1000) return; // не чаще раза в 10 минут
  set({ checking: true, error: null, lastCheck: Date.now() });
  try {
    const r = await Updates.checkForUpdateAsync();
    if (r.isAvailable) {
      await Updates.fetchUpdateAsync();
      set({ ready: true });
    }
  } catch (e: any) { set({ error: e?.message ?? 'не удалось проверить' }); }
  set({ checking: false });
}

export const restart = () => Updates.reloadAsync();

/** Подключается один раз в корне: проверка при запуске и при возвращении в приложение. */
export function useAutoUpdates() {
  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', s => { if (s === 'active') check(); });
    return () => sub.remove();
  }, []);
}

/** Какая версия JS сейчас запущена — для экрана настроек. */
export function currentLabel(): string {
  if (!supported()) return 'режим разработки';
  if (Updates.isEmbeddedLaunch || !Updates.createdAt) return 'из установки';
  const d = Updates.createdAt;
  return `обновление от ${d.toLocaleDateString('ru-RU')} ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
}
