// Настройки приложения: JSON-файл в документах приложения (не секрет, поэтому не Keychain).
import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';

export type Settings = {
  colorMode: 'mono' | 'cover';   // как ColorMode в десктопе: строгий ч/б или тон текущей обложки
  normalize: boolean;            // ровная громкость по LUFS
  quality: 128 | 192 | 320;      // качество потока и загрузок, кбит/с
  waveScene: '' | 'cs2' | 'road';
  waveMood: string;
  waveDiversity: string;
  crossfade: 0 | 3 | 6 | 10;     // плавный переход между треками, секунд
};

const defaults: Settings = { colorMode: 'cover', normalize: true, quality: 320, waveScene: '', waveMood: '', waveDiversity: '', crossfade: 6 };
const file = new File(Paths.document, 'settings.json');

let s: Settings = (() => {
  try {
    const v: Settings = file.exists ? { ...defaults, ...JSON.parse(file.textSync()) } : defaults;
    if (!['', 'cs2', 'road'].includes(v.waveScene)) v.waveScene = ''; // «CS2 + фонк» убрана
    return v;
  } catch { return defaults; }
})();
const subs = new Set<() => void>();

export const settings = () => s;
export const useSettings = () => useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, settings);

export function setSettings(p: Partial<Settings>) {
  s = { ...s, ...p };
  subs.forEach(f => f());
  try { file.write(JSON.stringify(s)); } catch {}
}
