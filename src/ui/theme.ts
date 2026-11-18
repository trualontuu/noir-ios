// Палитра десктопного Noir (App.xaml): серый интерфейс, обложки цветные.
// В режиме «по обложке» акцент и свечение фона берутся из цветов обложки, которые отдаёт Яндекс.
import { usePlayerSel } from '../player';
import { useSettings } from '../settings';

export const C = {
  bg: '#0A0A0A',
  side: '#0E0E0E',
  tile: '#141414',
  sel: '#1E1E1E',
  line: '#1C1C1C',
  track: '#2A2A2A',
  fg: '#F2F2F2',
  dim: '#8C8C8C',
  faint: '#4A4A4A',
  accent: '#F2F2F2',
  onAccent: '#0A0A0A',
  danger: '#E5484D',
  heart: '#FF3B5C',
};

export const R = { s: 6, m: 12, l: 20 };

export type Theme = { accent: string; onAccent: string; glow: string | null };

const MONO: Theme = { accent: C.accent, onAccent: C.onAccent, glow: null };

/** Текущий акцент: ч/б или тон обложки играющего трека. */
export function useTheme(): Theme {
  // подписка только на цвета текущей обложки — пауза и буфер тему не трогают
  const colors = usePlayerSel(st => st.queue[st.index]?.colors);
  const mode = useSettings().colorMode;
  if (mode !== 'cover' || !colors) return MONO;
  return themeFor(colors);
}

const cache = new Map<string, Theme>();
function themeFor(c: { average: string; accent: string }): Theme {
  const key = c.accent + c.average;
  let th = cache.get(key);
  if (!th) {
    const accent = readable(c.accent);
    th = { accent, onAccent: luminance(accent) > 0.45 ? '#0A0A0A' : '#FFFFFF', glow: c.average };
    cache.set(key, th);
  }
  return th;
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map(v => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Акцент должен читаться на почти чёрном фоне: слишком тёмный осветляем. */
function readable(hex: string): string {
  let [r, g, b] = rgb(hex);
  for (let i = 0; i < 12 && luminance(`#${hex2(r)}${hex2(g)}${hex2(b)}`) < 0.32; i++) {
    r = Math.min(255, r + (255 - r) * 0.18); g = Math.min(255, g + (255 - g) * 0.18); b = Math.min(255, b + (255 - b) * 0.18);
  }
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}
const hex2 = (v: number) => Math.round(v).toString(16).padStart(2, '0');

/** Цвет с прозрачностью: '#rrggbb' + альфа 0..1. */
export const alpha = (hex: string, a: number) => hex + hex2(a * 255);
