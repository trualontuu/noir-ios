import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, FlatList, PanResponder, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as dl from '../downloads';
import * as lyr from '../lyrics';
import * as player from '../player';
import * as remote from '../remote';
import { EqBars } from '../ui/EqBars';
import { Icon } from '../ui/Icon';
import { Heart } from '../ui/Heart';
import { FadeIn, Tap, useDismissPan, useSpring } from '../ui/motion';
import { useNav } from '../ui/nav';
import { useTrackMenu } from '../ui/TrackRow';
import { C, useTheme } from '../ui/theme';
import * as ym from '../ym';

/** Полноэкранный плеер: размытая обложка фоном, как в десктопном Noir. */
export default function Player() {
  const st = player.usePlayer();
  const th = useTheme();
  const nav = useNav();
  const menu = useTrackMenu();
  const d = dl.useDownloads();
  const host = remote.useRemote().host;
  const ins = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const dismiss = useDismissPan(height);
  const t = st.queue[st.index];
  const [mode, setMode] = useState<'cover' | 'queue' | 'lyrics'>('cover');
  const toggleMode = (m: 'queue' | 'lyrics') => setMode(v => v === m ? 'cover' : m);
  const coverScale = useSpring(st.playing ? 1 : 0.86, { bounciness: 9 });

  if (!t) {
    return <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}><Text style={s.sub}>Ничего не играет</Text></View>;
  }
  const saved = !!d.done[t.id];
  const prog = d.progress[t.id];
  const cover = width - 56;

  return (
    <Animated.View {...dismiss.handlers} style={[s.root, dismiss.style]}>
      <Image source={dl.coverSrc(t, 400)} style={StyleSheet.absoluteFill} blurRadius={60} transition={{ duration: 600, effect: 'cross-dissolve' }} />
      <LinearGradient colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.92)']} style={StyleSheet.absoluteFill} />

      <View style={[s.body, { paddingTop: ins.top + 6, paddingBottom: ins.bottom + 10 }]}>
        <View style={s.grabber} />
        <View style={s.top}>
          <Tap onPress={() => router.back()} hitSlop={14} style={s.topBtn}><Icon name="chevron.down" size={20} color={C.fg} /></Tap>
          <Text style={s.from} numberOfLines={1}>{st.wave ? 'МОЯ ВОЛНА' : t.album.toUpperCase()}</Text>
          <Tap onPress={() => menu(t)} hitSlop={14} style={s.topBtn}><Icon name="ellipsis" size={20} color={C.fg} /></Tap>
        </View>

        {mode === 'queue' ? <Queue accent={th.accent} /> : mode === 'lyrics' ? <LyricsView track={t} accent={th.accent} /> : (
          <View style={s.coverWrap}>
            <Animated.View style={{ transform: [{ scale: coverScale }] }}>
              <SwipeCover uri={dl.coverSrc(t, 1000)} size={cover} width={width} />
            </Animated.View>
          </View>
        )}

        <View style={s.meta}>
          <FadeIn key={t.id} dy={6} style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.title} numberOfLines={1}>{ym.fullTitle(t)}</Text>
            <Pressable onPress={() => t.artistRefs[0] && nav.artist(t.artistRefs[0].id, t.artistRefs[0].name)}>
              <Text style={s.sub} numberOfLines={1}>{t.artists}</Text>
            </Pressable>
          </FadeIn>
          <Tap hitSlop={10} haptic="light" scale={0.85} onPress={() => saved ? dl.remove([t.id]) : dl.download([t])}>
            {prog != null ? <Text style={s.prog}>{Math.round(prog * 100)}%</Text> :
              <Icon name={saved ? 'arrow.down.circle.fill' : 'arrow.down.circle'} size={26} color={saved ? th.accent : C.fg} />}
          </Tap>
          <Heart track={t} size={28} />
        </View>

        <Progress accent={th.accent} />

        <View style={s.controls}>
          <Tap hitSlop={12} haptic="select" onPress={() => player.setShuffle(!st.shuffle)} style={s.side} disabled={st.wave}>
            <Icon name="shuffle" size={21} color={st.wave ? 'rgba(255,255,255,0.15)' : st.shuffle ? th.accent : C.dim} />
          </Tap>
          <Tap hitSlop={12} haptic="light" scale={0.8} onPress={player.prev}><Icon name="backward.fill" size={32} /></Tap>
          <PlayButton accent={th.accent} onAccent={th.onAccent} playing={st.playing} buffering={st.buffering} />
          <Tap hitSlop={12} haptic="light" scale={0.8} onPress={player.next}><Icon name="forward.fill" size={32} /></Tap>
          <Tap hitSlop={12} haptic="select" onPress={player.cycleRepeat} style={s.side} disabled={st.wave}>
            <Icon name={st.repeat === 'one' ? 'repeat.1' : 'repeat'} size={21}
              color={st.wave ? 'rgba(255,255,255,0.15)' : st.repeat !== 'off' ? th.accent : C.dim} />
          </Tap>
        </View>

        <View style={s.bottom}>
          {st.wave ? (
            <Tap hitSlop={12} haptic="light" onPress={() => player.dislike(t).catch(() => {})}><Icon name="hand.thumbsdown" size={20} color={C.dim} /></Tap>
          ) : <View style={{ width: 20 }} />}
          <Tap hitSlop={12} haptic="light" onPress={() => router.push('/remote')} style={s.device}>
            <Icon name={host ? 'hifispeaker.2.fill' : 'hifispeaker.2'} size={18} color={host ? th.accent : C.dim} />
            {host && <Text style={[s.deviceText, { color: th.accent }]} numberOfLines={1}>{host.name}</Text>}
          </Tap>
          <View style={s.right}>
            <Tap hitSlop={12} haptic="select" onPress={() => toggleMode('lyrics')}>
              <Icon name="quote.bubble" size={21} color={mode === 'lyrics' ? th.accent : C.dim} />
            </Tap>
            <Tap hitSlop={12} haptic="select" onPress={() => toggleMode('queue')}>
              <Icon name="list.bullet" size={21} color={mode === 'queue' ? th.accent : C.dim} />
            </Tap>
            <Tap hitSlop={12} haptic="light" onPress={() => router.push('/share' as any)}>
              <Icon name="square.and.arrow.up" size={20} color={C.dim} />
            </Tap>
          </View>
        </View>
        {!!st.error && <Text style={s.err} numberOfLines={2}>{st.error}</Text>}
      </View>
    </Animated.View>
  );
}

/** Обложка, которую можно смахнуть влево/вправо — следующий/предыдущий трек. */
function SwipeCover({ uri, size, width }: { uri: string; size: number; width: number }) {
  const dx = useRef(new Animated.Value(0)).current;
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderMove: (_, g) => dx.setValue(g.dx),
    onPanResponderRelease: (_, g) => {
      const dir = g.dx < -90 || g.vx < -0.6 ? -1 : g.dx > 90 || g.vx > 0.6 ? 1 : 0;
      if (!dir) { Animated.spring(dx, { toValue: 0, useNativeDriver: false, bounciness: 10 }).start(); return; }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.timing(dx, { toValue: dir * width, duration: 170, easing: Easing.in(Easing.quad), useNativeDriver: false }).start(() => {
        if (dir < 0) player.next(); else player.prev();
        dx.setValue(-dir * width * 0.7);
        Animated.spring(dx, { toValue: 0, useNativeDriver: false, speed: 14, bounciness: 7 }).start();
      });
    },
    onPanResponderTerminate: () => Animated.spring(dx, { toValue: 0, useNativeDriver: false }).start(),
  }), [width]);
  return (
    <Animated.View {...pan.panHandlers} style={{
      transform: [{ translateX: dx }, { rotate: dx.interpolate({ inputRange: [-width, 0, width], outputRange: ['-8deg', '0deg', '8deg'] }) }],
      opacity: dx.interpolate({ inputRange: [-width, 0, width], outputRange: [0.3, 1, 0.3] }),
    }}>
      <Image source={uri} style={[s.cover, { width: size, height: size }]} transition={{ duration: 300, effect: 'cross-dissolve' }} cachePolicy="memory-disk" />
    </Animated.View>
  );
}

/** Большая кнопка: иконка меняется с «подпрыгиванием». */
function PlayButton({ accent, onAccent, playing, buffering }: { accent: string; onAccent: string; playing: boolean; buffering: boolean }) {
  const pop = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    pop.setValue(0.6);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 14 }).start();
  }, [playing]);
  return (
    <Tap onPress={player.toggle} haptic="medium" scale={0.9} style={[s.play, { backgroundColor: accent, shadowColor: accent }]}>
      {buffering && !playing ? <ActivityIndicator color={onAccent} size="large" /> : (
        <Animated.View style={{ transform: [{ scale: pop }] }}>
          <Icon name={playing ? 'pause.fill' : 'play.fill'} size={34} color={onAccent} />
        </Animated.View>
      )}
    </Tap>
  );
}

/**
 * Полоса прогресса. Между редкими событиями от плеера ползунок едет сам (нативная анимация до конца трека),
 * а сверяется с реальным временем, только если разошёлся больше чем на 0.3 с — поэтому не дёргается.
 * Протяжка: полоса утолщается, время показывает, куда отпустишь; после отпускания не прыгает назад.
 */
function Progress({ accent }: { accent: string }) {
  const p = player.useProgress();
  const playing = player.usePlayerSel(x => x.playing);
  const [w, setW] = useState(1);
  const [drag, setDrag] = useState<number | null>(null);
  const k = useRef(new Animated.Value(0)).current;
  const x0 = useRef(0);
  const sync = useRef<{ t0: number; at: number; dur: number } | null>(null);
  const grow = useSpring(drag != null ? 1 : 0, { speed: 30, bounciness: 4 });
  const dur = p.duration;
  const live = p.time + (playing ? (Date.now() - p.at) / 1000 : 0);

  useEffect(() => {
    if (drag != null || !dur) { if (!dur) k.setValue(0); return; }
    const now = Date.now();
    const real = Math.min(dur, p.time + (playing ? (now - p.at) / 1000 : 0));
    if (!playing) {
      sync.current = null;
      k.stopAnimation();
      Animated.timing(k, { toValue: real / dur, duration: 120, useNativeDriver: true }).start();
      return;
    }
    const s0 = sync.current;
    if (s0 && s0.dur === dur && Math.abs(s0.t0 + (now - s0.at) / 1000 - real) < 0.3) return; // идём ровно
    k.stopAnimation();
    k.setValue(real / dur);
    Animated.timing(k, { toValue: 1, duration: Math.max(0, (dur - real) * 1000), easing: Easing.linear, useNativeDriver: true }).start();
    sync.current = { t0: real, at: now, dur };
  }, [p, playing, drag, dur]);

  const at = (x: number) => Math.max(0, Math.min(1, x / w)) * dur;
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: e => { x0.current = e.nativeEvent.locationX; const v = at(x0.current); k.stopAnimation(); k.setValue(v / (dur || 1)); setDrag(v); Haptics.selectionAsync(); },
    onPanResponderMove: (_, g) => { const v = at(x0.current + g.dx); k.setValue(v / (dur || 1)); setDrag(v); },
    onPanResponderRelease: (_, g) => { const v = at(x0.current + g.dx); sync.current = null; player.seek(v); setDrag(null); },
    onPanResponderTerminate: () => { sync.current = null; setDrag(null); },
  }), [w, dur]);
  const shown = drag ?? live;

  return (
    <View>
      <View
        style={s.barHit}
        onLayout={e => setW(e.nativeEvent.layout.width)}
        {...pan.panHandlers}
      >
        <Animated.View style={[s.bar, { transform: [{ scaleY: grow.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }] }]}>
          <Animated.View style={[s.barFill, { backgroundColor: drag != null ? accent : 'rgba(255,255,255,0.92)', transform: [{ scaleX: k }] }]} />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[s.knob, {
          backgroundColor: drag != null ? accent : '#fff',
          transform: [
            { translateX: k.interpolate({ inputRange: [0, 1], outputRange: [-7, w - 7] }) },
            { scale: grow.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.15] }) },
          ],
        }]} />
      </View>
      <View style={s.times}>
        <Text style={[s.time, drag != null && { color: C.fg }]}>{ym.fmtTime(shown)}</Text>
        <Text style={s.time}>-{ym.fmtTime(Math.max(0, dur - shown))}</Text>
      </View>
    </View>
  );
}

/**
 * Текст песни: текущая строка яркая и держится в верхней трети, прошедшие тускнеют.
 * Тап по строке — перемотка к ней. Если прокрутил сам — 4 секунды не мешаем.
 */
function LyricsView({ track, accent }: { track: ym.Track; accent: string }) {
  const { state, l } = lyr.useLyrics(track);
  const p = player.useProgress();
  const playing = player.usePlayerSel(x => x.playing);
  const sc = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const ys = useRef<number[]>([]);
  const [h, setH] = useState(400);
  const userAt = useRef(0);
  const [, force] = useState(0);
  // между событиями плеера (4 р/с) досчитываем время сами, чтобы строка менялась вовремя
  useEffect(() => {
    if (!playing || !l?.lines.length) return;
    const id = setInterval(() => force(x => x + 1), 120);
    return () => clearInterval(id);
  }, [playing, l]);
  const time = p.time + (playing ? (Date.now() - p.at) / 1000 : 0);
  const lines = l?.lines ?? [];
  const cur = lyr.lineAt(lines, time);

  useEffect(() => {
    if (cur < 0 || Date.now() - userAt.current < 4000) return;
    const y = ys.current[cur];
    if (y != null) sc.current?.scrollTo({ y: Math.max(0, y - h * 0.3), animated: true });
  }, [cur, h]);

  if (state !== 'ok' || !l) {
    const msg = state === 'loading' ? null : state === 'offline' ? 'Нет связи — текст появится, когда будет интернет' : 'Текста для этого трека нет';
    return (
      <View style={s.lyrEmpty}>
        {msg ? <Text style={s.lyrMsg}>{msg}</Text> : <ActivityIndicator color={C.dim} />}
      </View>
    );
  }
  if (!lines.length) {
    return (
      <ScrollView style={{ flex: 1, marginTop: 10 }} contentContainerStyle={{ paddingVertical: 20 }} showsVerticalScrollIndicator={false}>
        <Text style={s.lyrPlain}>{l.instrumental ? 'Инструментал ♪' : l.plain}</Text>
        {!l.instrumental && <Text style={s.lyrNote}>Текст без синхронизации</Text>}
      </ScrollView>
    );
  }
  return (
    <FadeIn style={{ flex: 1, marginTop: 6 }} dy={14}>
      <ScrollView ref={sc} onLayout={e => setH(e.nativeEvent.layout.height)} showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => { userAt.current = Date.now(); }} onMomentumScrollEnd={() => { userAt.current = Date.now(); }}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: h * 0.6 }}>
        {lines.map((ln, i) => (
          <Pressable key={i} onLayout={e => { ys.current[i] = e.nativeEvent.layout.y; }}
            onPress={() => { Haptics.selectionAsync(); userAt.current = 0; player.seek(ln.t); }}>
            <Text style={[s.lyrLine, i === cur ? { color: C.fg } : i < cur ? { color: 'rgba(242,242,242,0.38)' } : null,
              i === cur && { textShadowColor: accent, textShadowRadius: 18 }]}>
              {ln.text || '♪'}
            </Text>
          </Pressable>
        ))}
        <Text style={s.lyrNote}>LRCLIB</Text>
      </ScrollView>
    </FadeIn>
  );
}

/** «Далее»: текущий и следующие треки очереди, тап — перейти. */
function Queue({ accent }: { accent: string }) {
  const st = player.usePlayer();
  const rest = st.queue.slice(st.index, st.index + 60);
  return (
    <FadeIn style={{ flex: 1, marginTop: 10 }} dy={20}>
      <Text style={s.qHead}>Далее{st.wave ? ' · Моя волна' : ''}</Text>
      <FlatList
        data={rest}
        keyExtractor={(t, i) => t.id + ':' + i}
        renderItem={({ item, index }) => (
          <Tap scale={0.97} style={[s.qRow, index === 0 && s.qCur]} onPress={() => index > 0 && player.jump(st.index + index)}>
            <Image source={dl.coverSrc(item, 100)} style={s.qCover} cachePolicy="memory-disk" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.qTitle, index === 0 && { color: accent }]} numberOfLines={1}>{ym.fullTitle(item)}</Text>
              <Text style={s.qSub} numberOfLines={1}>{item.artists}</Text>
            </View>
            {index === 0 ? <EqBars playing={st.playing} color={accent} /> : <Text style={s.time}>{ym.fmtTime(item.durationMs / 1000)}</Text>}
          </Tap>
        )}
      />
    </FadeIn>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  body: { flex: 1, paddingHorizontal: 28 },
  grabber: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: 4 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, gap: 12 },
  topBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  from: { flex: 1, color: 'rgba(242,242,242,0.7)', fontSize: 12, fontWeight: '700', letterSpacing: 1.5, textAlign: 'center' },
  coverWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cover: { borderRadius: 18, backgroundColor: C.tile, shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 34, shadowOffset: { width: 0, height: 18 } },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 16 },
  title: { color: C.fg, fontSize: 23, fontWeight: '800', letterSpacing: -0.3 },
  sub: { color: 'rgba(242,242,242,0.6)', fontSize: 17, marginTop: 3 },
  prog: { color: C.fg, fontSize: 13, fontVariant: ['tabular-nums'], width: 34, textAlign: 'center' },
  barHit: { paddingVertical: 16, marginTop: 10, justifyContent: 'center' },
  bar: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  barFill: { height: '100%', width: '100%', transformOrigin: 'left' },
  knob: { position: 'absolute', left: 0, width: 14, height: 14, borderRadius: 7, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -6 },
  time: { color: 'rgba(242,242,242,0.5)', fontSize: 12, fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  side: { width: 36, alignItems: 'center' },
  play: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.45, shadowRadius: 22, shadowOffset: { width: 0, height: 6 } },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingHorizontal: 8 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  lyrEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  lyrMsg: { color: 'rgba(242,242,242,0.55)', fontSize: 15, textAlign: 'center' },
  lyrLine: { color: 'rgba(242,242,242,0.28)', fontSize: 27, fontWeight: '800', letterSpacing: -0.4, lineHeight: 34, paddingVertical: 7 },
  lyrPlain: { color: 'rgba(242,242,242,0.85)', fontSize: 20, fontWeight: '700', lineHeight: 30 },
  lyrNote: { color: 'rgba(242,242,242,0.3)', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 18 },
  device: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 180 },
  deviceText: { fontSize: 13, fontWeight: '600' },
  err: { color: C.danger, fontSize: 12, textAlign: 'center', marginTop: 6 },
  qHead: { color: C.fg, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  qRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 12 },
  qCur: { backgroundColor: 'rgba(255,255,255,0.08)' },
  qCover: { width: 44, height: 44, borderRadius: 8, backgroundColor: C.tile },
  qTitle: { color: C.fg, fontSize: 15, fontWeight: '500' },
  qSub: { color: 'rgba(242,242,242,0.55)', fontSize: 13 },
});
