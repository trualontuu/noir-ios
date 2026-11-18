import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as player from '../player';
import * as remote from '../remote';
import { Icon } from '../ui/Icon';
import { FadeIn, Tap, useDismissPan, useSpring } from '../ui/motion';
import { Slider } from '../ui/Slider';
import { C, useTheme } from '../ui/theme';
import * as ym from '../ym';

/** Пульт: управление Noir на компьютере — пауза, треки, лайк, громкость, перемотка. */
export default function RemoteScreen() {
  const r = remote.useRemote();
  const th = useTheme();
  const ins = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const dismiss = useDismissPan(height);
  const h = r.host;
  const s = h?.state;
  const [, tick] = useState(0);
  const coverScale = useSpring(s?.playing ? 1 : 0.88, { bounciness: 9 });

  useEffect(() => { remote.refresh(); }, []);
  useEffect(() => {
    if (!s?.playing) return;
    const t = setInterval(() => tick(x => x + 1), 500);
    return () => clearInterval(t);
  }, [s?.playing]);

  const onVolume = useCallback((v: number) => remote.setVolume(v), []);
  const onSeek = useCallback((v: number) => { if (s) remote.seek(v * s.duration); }, [s?.duration]);

  const cover = Math.min(width - 96, 320);
  const time = h ? remote.hostTime(h) : 0;

  return (
    <Animated.View {...dismiss.handlers} style={[st.root, dismiss.style]}>
      {!!s?.cover && <Image source={s.cover} style={StyleSheet.absoluteFill} blurRadius={60} transition={{ duration: 600, effect: 'cross-dissolve' }} />}
      <LinearGradient colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.94)']} style={StyleSheet.absoluteFill} />

      <View style={[st.body, { paddingTop: ins.top + 6, paddingBottom: ins.bottom + 16 }]}>
        <View style={st.grabber} />
        <View style={st.top}>
          <Tap onPress={() => router.back()} hitSlop={14} style={st.topBtn}><Icon name="chevron.down" size={20} /></Tap>
          <Text style={st.caption}>ПУЛЬТ</Text>
          <View style={{ width: 34 }} />
        </View>

        <Devices host={h?.name} online={r.online} accent={th.accent} />

        {!r.online ? (
          <Center>
            <ActivityIndicator color={C.dim} />
            <Text style={st.hint}>Подключаюсь…</Text>
          </Center>
        ) : !h ? (
          <Center>
            <Icon name="desktopcomputer" size={54} color={C.faint} />
            <Text style={st.big}>Компьютер не в сети</Text>
            <Text style={st.hint}>Запусти Noir на компьютере с тем же аккаунтом Яндекса — он появится здесь сам.</Text>
          </Center>
        ) : !s || !s.title ? (
          <Center>
            <Icon name="hifispeaker.2" size={54} color={C.faint} />
            <Text style={st.big}>{h.name}: тишина</Text>
            <Tap style={[st.pill, { backgroundColor: th.accent }]} haptic="medium" onPress={remote.wave}>
              <Icon name="dot.radiowaves.left.and.right" size={16} color={th.onAccent} />
              <Text style={[st.pillText, { color: th.onAccent }]}>Включить «Мою волну»</Text>
            </Tap>
          </Center>
        ) : (
          <>
            <View style={st.coverWrap}>
              <Animated.View style={{ transform: [{ scale: coverScale }] }}>
                <Image source={s.cover} style={[st.cover, { width: cover, height: cover }]} transition={{ duration: 300, effect: 'cross-dissolve' }} />
              </Animated.View>
            </View>

            <View style={st.meta}>
              <FadeIn key={s.id || s.title} dy={6} style={{ flex: 1, minWidth: 0 }}>
                <Text style={st.title} numberOfLines={1}>{s.title}</Text>
                <Text style={st.sub} numberOfLines={1}>{s.artist}</Text>
              </FadeIn>
              {!s.sc && <RemoteHeart liked={s.liked} />}
            </View>

            <Slider value={s.duration ? time / s.duration : 0} onDone={onSeek} color="rgba(255,255,255,0.92)" height={4} />
            <View style={st.times}>
              <Text style={st.time}>{ym.fmtTime(time)}</Text>
              <Text style={st.time}>-{ym.fmtTime(Math.max(0, s.duration - time))}</Text>
            </View>

            <View style={st.controls}>
              <Tap hitSlop={12} haptic="light" scale={0.8} onPress={remote.prev}><Icon name="backward.fill" size={32} /></Tap>
              <Tap onPress={remote.toggle} haptic="medium" scale={0.9} style={[st.play, { backgroundColor: th.accent, shadowColor: th.accent }]}>
                <Icon name={s.playing ? 'pause.fill' : 'play.fill'} size={34} color={th.onAccent} />
              </Tap>
              <Tap hitSlop={12} haptic="light" scale={0.8} onPress={remote.next}><Icon name="forward.fill" size={32} /></Tap>
            </View>

            <View style={st.volume}>
              <Tap hitSlop={12} haptic="light" scale={0.8} onPress={() => remote.setVolume(s.volume - 0.1)}><Icon name="speaker.fill" size={15} color={C.dim} /></Tap>
              <View style={{ flex: 1 }}><Slider value={s.volume} onChange={onVolume} color={C.fg} /></View>
              <Tap hitSlop={12} haptic="light" scale={0.8} onPress={() => remote.setVolume(s.volume + 0.1)}><Icon name="speaker.wave.3.fill" size={15} color={C.dim} /></Tap>
              <Text style={st.vol}>{Math.round(s.volume * 100)}</Text>
            </View>
            {!!s.queue && <Text style={st.queue} numberOfLines={1}>{s.queue}</Text>}
          </>
        )}
      </View>
    </Animated.View>
  );
}

/** Где играет: этот телефон или компьютер (как список устройств в Spotify). */
function Devices({ host, online, accent }: { host?: string; online: boolean; accent: string }) {
  const local = player.usePlayerSel(x => x.index >= 0);
  return (
    <View style={st.devices}>
      <View style={[st.device, !host && st.deviceOn]}>
        <Icon name="iphone" size={15} color={!host ? accent : C.dim} />
        <Text style={[st.deviceText, !host && { color: C.fg }]}>Этот iPhone{local ? ' · играет' : ''}</Text>
      </View>
      <View style={[st.device, !!host && st.deviceOn]}>
        <Icon name="desktopcomputer" size={15} color={host ? accent : C.faint} />
        <Text style={[st.deviceText, !!host && { color: C.fg }]} numberOfLines={1}>{host ?? (online ? 'Компьютер не в сети' : '…')}</Text>
        {!!host && <Pulse color={accent} />}
      </View>
    </View>
  );
}

/** Зелёная точка «в сети», которая мягко пульсирует. */
function Pulse({ color }: { color: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={{ width: 8, height: 8 }}>
      <Animated.View style={[st.dot, { backgroundColor: color, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }] }]} />
      <View style={[st.dot, { backgroundColor: color }]} />
    </View>
  );
}

function RemoteHeart({ liked }: { liked: boolean }) {
  const v = useRef(new Animated.Value(1)).current;
  return (
    <Pressable hitSlop={12} onPress={() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Animated.sequence([
        Animated.timing(v, { toValue: liked ? 0.75 : 1.4, duration: 110, useNativeDriver: true }),
        Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 16 }),
      ]).start();
      remote.like();
    }}>
      <Animated.View style={{ transform: [{ scale: v }] }}>
        <Icon name={liked ? 'heart.fill' : 'heart'} size={28} color={liked ? C.heart : C.fg} />
      </Animated.View>
    </Pressable>
  );
}

const Center = ({ children }: { children: React.ReactNode }) => <FadeIn style={st.center}>{children}</FadeIn>;

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  body: { flex: 1, paddingHorizontal: 28 },
  grabber: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: 4 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  topBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  caption: { color: 'rgba(242,242,242,0.7)', fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
  devices: { flexDirection: 'row', gap: 8, marginTop: 10 },
  device: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, height: 40, paddingHorizontal: 12, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)' },
  deviceOn: { backgroundColor: 'rgba(255,255,255,0.12)' },
  deviceText: { flex: 1, color: C.dim, fontSize: 13.5, fontWeight: '600' },
  dot: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 12 },
  big: { color: C.fg, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  hint: { color: C.dim, fontSize: 15, textAlign: 'center', lineHeight: 21 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, paddingHorizontal: 20, borderRadius: 23, marginTop: 8 },
  pillText: { fontSize: 16, fontWeight: '600' },
  coverWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cover: { borderRadius: 18, backgroundColor: C.tile },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 4 },
  title: { color: C.fg, fontSize: 23, fontWeight: '800', letterSpacing: -0.3 },
  sub: { color: 'rgba(242,242,242,0.6)', fontSize: 17, marginTop: 3 },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -6 },
  time: { color: 'rgba(242,242,242,0.5)', fontSize: 12, fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', marginTop: 16 },
  play: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.45, shadowRadius: 22, shadowOffset: { width: 0, height: 6 } },
  volume: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  vol: { color: C.dim, fontSize: 12, fontVariant: ['tabular-nums'], width: 26, textAlign: 'right' },
  queue: { color: C.faint, fontSize: 12.5, textAlign: 'center', marginTop: 6 },
});
