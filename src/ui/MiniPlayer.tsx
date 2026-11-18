import { Image } from 'expo-image';
import { router } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import * as dl from '../downloads';
import * as player from '../player';
import * as remote from '../remote';
import * as ym from '../ym';
import { Heart } from './Heart';
import { Icon } from './Icon';
import { FadeIn, Tap } from './motion';
import { C, useTheme } from './theme';

/** Плашка над таб-баром (iOS 26: в стекле, при прокрутке сжимается в строку рядом с вкладками). */
export function MiniPlayer() {
  const placement = NativeTabs.BottomAccessory.usePlacement();
  const st = player.usePlayer();
  const host = remote.useRemote().host;
  const th = useTheme();
  const t = st.queue[st.index];
  const inline = placement === 'inline';

  if (!t) {
    // на телефоне тихо, а на компьютере играет — плашка становится пультом
    if (host?.state?.title) {
      const s = host.state;
      return (
        <Pressable style={s_.row} onPress={() => router.push('/remote')}>
          {!inline && <Image source={s.cover} style={s_.cover} transition={250} />}
          <View style={s_.text}>
            <Text style={s_.title} numberOfLines={1}>{s.title}</Text>
            {!inline && <Text style={s_.sub} numberOfLines={1}><Text style={{ color: th.accent }}>● </Text>{host.name}</Text>}
          </View>
          <Tap hitSlop={10} onPress={remote.toggle} style={s_.btn} haptic="light" scale={0.8}>
            <Icon name={s.playing ? 'pause.fill' : 'play.fill'} size={20} />
          </Tap>
          {!inline && <Tap hitSlop={10} onPress={remote.next} style={s_.btn} haptic="light" scale={0.8}><Icon name="forward.fill" size={20} /></Tap>}
        </Pressable>
      );
    }
    return (
      <Pressable style={s_.row} onPress={() => player.playWave()}>
        <Icon name="dot.radiowaves.left.and.right" size={18} color={C.dim} />
        <Text style={[s_.title, { color: C.dim }]}>Включить «Мою волну»</Text>
      </Pressable>
    );
  }

  return (
    <Pressable style={s_.row} onPress={() => router.push('/player')}>
      {!inline && <Image source={dl.coverSrc(t, 100)} style={s_.cover} cachePolicy="memory-disk" transition={{ duration: 300, effect: 'cross-dissolve' }} />}
      <FadeIn key={t.id} dy={4} style={s_.text}>
        <Text style={[s_.title, { color: th.glow ? th.accent : C.fg }]} numberOfLines={1}>{ym.fullTitle(t)}</Text>
        {!inline && <Text style={s_.sub} numberOfLines={1}>{t.artists}</Text>}
      </FadeIn>
      {!inline && <Heart track={t} size={19} />}
      <Tap hitSlop={10} onPress={player.toggle} style={s_.btn} haptic="light" scale={0.8}>
        {st.buffering && !st.playing ? <ActivityIndicator color={C.fg} /> :
          <Icon name={st.playing ? 'pause.fill' : 'play.fill'} size={20} />}
      </Tap>
      {!inline && (
        <Tap hitSlop={10} onPress={player.next} style={s_.btn} haptic="light" scale={0.8}>
          <Icon name="forward.fill" size={20} />
        </Tap>
      )}
      {!inline && <MiniProgress color={th.glow ? th.accent : C.fg} />}
    </Pressable>
  );
}

/** Тонкая полоска прогресса по низу плашки — едет сама, сверяется с плеером. */
function MiniProgress({ color }: { color: string }) {
  const p = player.useProgress();
  const playing = player.usePlayerSel(x => x.playing);
  const k = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const dur = p.duration;
    if (!dur) { k.setValue(0); return; }
    const real = Math.min(1, (p.time + (playing ? (Date.now() - p.at) / 1000 : 0)) / dur);
    k.stopAnimation();
    k.setValue(real);
    if (playing) Animated.timing(k, { toValue: 1, duration: (1 - real) * dur * 1000, easing: Easing.linear, useNativeDriver: true }).start();
  }, [Math.round(p.time / 5), p.duration, playing]); // пересинхронизация раз в ~5 с, без дёрганий
  return (
    <View pointerEvents="none" style={s_.track}>
      <Animated.View style={[s_.fill, { backgroundColor: color, transform: [{ scaleX: k }] }]} />
    </View>
  );
}

const s_ = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  cover: { width: 36, height: 36, borderRadius: 8, backgroundColor: C.tile },
  text: { flex: 1, minWidth: 0 },
  title: { color: C.fg, fontSize: 15, fontWeight: '600' },
  sub: { color: C.dim, fontSize: 12.5 },
  btn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  track: { position: 'absolute', left: 22, right: 22, bottom: 2, height: 2, borderRadius: 1, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)' },
  fill: { height: '100%', width: '100%', transformOrigin: 'left' },
});
