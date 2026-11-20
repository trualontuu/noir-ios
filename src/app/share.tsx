import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import * as dl from '../downloads';
import * as lyr from '../lyrics';
import * as player from '../player';
import { Icon } from '../ui/Icon';
import { Tap } from '../ui/motion';
import { C, useTheme } from '../ui/theme';
import * as ym from '../ym';

const W = 360, H = 640; // карточка 9:16, сохраняется в 1080×1920

/** Карточка трека для сторис: обложка, название и цвет плеера — картинкой в «Поделиться». */
export default function ShareCard() {
  const t = player.usePlayerSel(s => s.queue[s.index]);
  const th = useTheme();
  const ins = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const card = useRef<React.ComponentRef<typeof View>>(null);
  const [bg, setBg] = useState<'cover' | 'color'>('cover');
  const [withLine, setWithLine] = useState(true);
  const [busy, setBusy] = useState(false);
  const { l } = lyr.useLyrics(t);
  const lines = useMemo(() => (l?.lines ?? []).filter(x => x.text.trim()), [l]);
  // строчка: та, что звучит сейчас; тап по ней в карточке — следующая
  const [pick, setPick] = useState<number | null>(null);
  const nowIdx = useMemo(() => {
    const p = player.getProgress();
    const i = lyr.lineAt(lines, p.time);
    return Math.max(0, i);
  }, [lines]);
  const line = lines.length ? lines[(pick ?? nowIdx) % lines.length].text : null;

  if (!t) return <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}><Text style={s.dim}>Ничего не играет</Text></View>;

  const k = Math.min((width - 48) / W, (height - ins.top - ins.bottom - 210) / H);

  const share = async () => {
    if (busy) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const uri = await captureRef(card, { format: 'png', width: 1080, height: 1920, result: 'tmpfile' });
      await Share.share({ url: uri });
    } catch {}
    setBusy(false);
  };

  return (
    <View style={[s.root, { paddingTop: ins.top + 8, paddingBottom: ins.bottom + 12 }]}>
      <View style={s.top}>
        <Tap onPress={() => router.back()} hitSlop={14} style={s.topBtn}><Icon name="xmark" size={17} color={C.fg} /></Tap>
        <Text style={s.head}>Карточка для сторис</Text>
        <View style={{ width: 34 }} />
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: W * k, height: H * k }}>
          <View style={{ width: W, height: H, transform: [{ scale: k }], transformOrigin: 'top left' }}>
            <View ref={card} collapsable={false} style={s.card}>
              {bg === 'cover' ? (
                <>
                  <Image source={dl.coverSrc(t, 400)} style={StyleSheet.absoluteFill} blurRadius={40} />
                  <LinearGradient colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.85)']} style={StyleSheet.absoluteFill} />
                </>
              ) : (
                <LinearGradient colors={[th.accent, mix(th.accent, 0.35), '#050505']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
              )}
              <Text style={s.logo}>noir</Text>
              <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 34 }}>
                <Image source={dl.coverSrc(t, 1000)} style={s.cover} />
                <Text style={s.title} numberOfLines={2}>{ym.fullTitle(t)}</Text>
                <Text style={s.artist} numberOfLines={1}>{t.artists}</Text>
                {withLine && !!line && (
                  <Pressable onPress={() => { Haptics.selectionAsync(); setPick(i => ((i ?? nowIdx) + 1) % lines.length); }}
                    style={[s.quote, { borderLeftColor: bg === 'cover' ? th.accent : '#fff' }]}>
                    <Text style={s.quoteText} numberOfLines={3}>{line}</Text>
                  </Pressable>
                )}
              </View>
              <View style={s.foot}>
                <View style={[s.dot, { backgroundColor: bg === 'cover' ? th.accent : '#fff' }]} />
                <Text style={s.footText}>сейчас играет</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={s.opts}>
        <Seg items={[['cover', 'Обложка'], ['color', 'Цвет']]} value={bg} onPick={v => setBg(v as any)} accent={th.accent} onAccent={th.onAccent} />
        {lines.length > 0 && (
          <Seg items={[['1', 'Со строчкой'], ['0', 'Без']]} value={withLine ? '1' : '0'} onPick={v => setWithLine(v === '1')} accent={th.accent} onAccent={th.onAccent} />
        )}
      </View>
      {withLine && lines.length > 0 && <Text style={s.hint}>Тапни по строчке на карточке — возьмётся следующая</Text>}

      <Tap onPress={share} haptic="medium" scale={0.96} style={[s.btn, { backgroundColor: th.accent }]}>
        {busy ? <ActivityIndicator color={th.onAccent} /> : (
          <>
            <Icon name="square.and.arrow.up" size={18} color={th.onAccent} />
            <Text style={[s.btnText, { color: th.onAccent }]}>Поделиться</Text>
          </>
        )}
      </Tap>
    </View>
  );
}

function Seg({ items, value, onPick, accent, onAccent }: { items: [string, string][]; value: string; onPick: (v: string) => void; accent: string; onAccent: string }) {
  return (
    <View style={s.seg}>
      {items.map(([v, label]) => {
        const on = v === value;
        return (
          <Pressable key={v} style={[s.segItem, on && { backgroundColor: accent }]} onPress={() => { Haptics.selectionAsync(); onPick(v); }}>
            <Text style={[s.segText, on && { color: onAccent, fontWeight: '600' }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Цвет, затемнённый к чёрному: k=1 — исходный, 0 — чёрный. */
function mix(hex: string, k: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#111';
  const n = parseInt(m[1], 16);
  const c = (sh: number) => Math.round(((n >> sh) & 255) * k).toString(16).padStart(2, '0');
  return `#${c(16)}${c(8)}${c(0)}`;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 20 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  topBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  head: { color: C.fg, fontSize: 16, fontWeight: '700' },
  dim: { color: C.dim, fontSize: 15 },
  card: { width: W, height: H, borderRadius: 28, overflow: 'hidden', backgroundColor: '#000' },
  logo: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.8, marginTop: 30, marginLeft: 34, opacity: 0.9 },
  cover: { width: W - 68, height: W - 68, borderRadius: 18, backgroundColor: '#111', marginBottom: 22 },
  title: { color: '#fff', fontSize: 27, fontWeight: '800', letterSpacing: -0.5 },
  artist: { color: 'rgba(255,255,255,0.7)', fontSize: 17, marginTop: 4 },
  quote: { marginTop: 18, borderLeftWidth: 3, paddingLeft: 12, paddingVertical: 2 },
  quoteText: { color: '#fff', fontSize: 16, fontWeight: '600', fontStyle: 'italic', lineHeight: 22 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 34, marginBottom: 30 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  footText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  opts: { flexDirection: 'row', gap: 10, marginTop: 16 },
  seg: { flex: 1, flexDirection: 'row', backgroundColor: C.sel, borderRadius: 10, padding: 3 },
  segItem: { flex: 1, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segText: { color: C.fg, fontSize: 14 },
  hint: { color: C.dim, fontSize: 12, textAlign: 'center', marginTop: 8 },
  btn: { height: 52, borderRadius: 26, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  btnText: { fontSize: 17, fontWeight: '700' },
});
