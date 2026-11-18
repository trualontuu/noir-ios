import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as dl from '../../downloads';
import * as player from '../../player';
import * as remote from '../../remote';
import { setSettings, useSettings } from '../../settings';
import { Glow } from '../../ui/Glow';
import { Icon } from '../../ui/Icon';
import { FadeIn, Tap, useScrollY, useSpring } from '../../ui/motion';
import { useNav } from '../../ui/nav';
import { TrackRow, useRowProps } from '../../ui/TrackRow';
import { CoverWall } from '../../ui/CoverWall';
import { C, useTheme } from '../../ui/theme';
import * as ym from '../../ym';

/** «Моя волна» — как главная страница десктопного Noir. */
export default function Wave() {
  const ins = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const st = player.usePlayer();
  const s = useSettings();
  const th = useTheme();
  const t = st.wave ? st.queue[st.index] : undefined;
  const nextUp = st.wave ? st.queue.slice(st.index + 1, st.index + 8) : [];
  const row = useRowProps(st.queue);
  const size = Math.min(width - 72, 340);
  const { y, onScroll } = useScrollY();
  const coverScale = useSpring(st.wave && st.playing ? 1 : t ? 0.9 : 1, { bounciness: 10 });
  const host = remote.useRemote().host;
  const nav = useNav();
  const [lists, setLists] = useState<ym.Playlist[]>([]);
  useEffect(() => { ym.playlists().then(setLists).catch(() => {}); }, []);
  // фон: обложка волны, иначе — то, что играет на телефоне или компьютере
  const anyCur = st.queue[st.index];
  const glowUri = t ? dl.coverSrc(t, 200) : anyCur ? dl.coverSrc(anyCur, 200) : host?.state?.cover || null;
  const wall = lists.filter(p => p.coverUri).map(p => ym.img(p.coverUri, 200));

  const pick = (p: Parameters<typeof setSettings>[0]) => {
    Haptics.selectionAsync();
    setSettings(p);
    if (st.wave) player.playWave(); // волна уже играет — перезапускаем с новым характером
  };

  const main = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (st.wave && t) player.toggle(); else player.playWave();
  };

  return (
    <View style={s_.root}>
    <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: y.interpolate({ inputRange: [-200, 0, 600], outputRange: [0, 0, -300], extrapolate: 'clamp' }) }] }]}>
      <Glow uri={glowUri} height={ins.top + size + 420} strength={t ? 0.85 : 0.55} />
    </Animated.View>
    <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ paddingTop: ins.top + 8, paddingBottom: 160 }}>
      <View style={s_.head}>
        <Text style={s_.logo}>noir</Text>
      </View>

      <View style={{ alignSelf: 'center', width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {/* до старта волны — плывущая стена обложек твоих плейлистов */}
        {!t && <View style={{ position: 'absolute' }}><CoverWall size={size} covers={wall} /></View>}
        {t ? (
          <Animated.View style={{ transform: [{ scale: coverScale }] }}>
            <Tap onPress={main} onLongPress={() => router.push('/player')} scale={0.96} style={[s_.cover, { width: size, height: size }]}>
              <Image source={dl.coverSrc(t, 600)} style={StyleSheet.absoluteFill} transition={{ duration: 450, effect: 'cross-dissolve' }} cachePolicy="memory-disk" />
              <View style={[s_.playBtn, { backgroundColor: th.accent }]}>
                {st.buffering && !st.playing ? <ActivityIndicator color={th.onAccent} /> :
                  <Icon name={st.playing ? 'pause.fill' : 'play.fill'} size={26} color={th.onAccent} />}
              </View>
            </Tap>
          </Animated.View>
        ) : (
          <Tap onPress={main} haptic="medium" scale={0.9} style={[s_.bigPlay, { backgroundColor: th.accent, shadowColor: th.accent }]}>
            {st.buffering ? <ActivityIndicator color={th.onAccent} size="large" /> : <Icon name="play.fill" size={38} color={th.onAccent} />}
          </Tap>
        )}
      </View>

      <Text style={s_.caption}>МОЯ ВОЛНА</Text>
      <Pressable onPress={() => t && router.push('/player')}>
        <FadeIn key={t?.id ?? 'none'} dy={8}>
          <Text style={s_.title} numberOfLines={1}>{t ? ym.fullTitle(t) : 'Бесконечный поток'}</Text>
          <Text style={s_.artist} numberOfLines={1}>{t ? t.artists : 'под твой вкус'}</Text>
        </FadeIn>
      </Pressable>
      {!!st.error && <Text style={s_.err}>{st.error}</Text>}

      <Chips items={ym.WAVE_SCENES} value={s.waveScene} accent={th} onPick={id => pick({ waveScene: id as any })} center />

      <View style={{ opacity: s.waveScene ? 0.35 : 1 }} pointerEvents={s.waveScene ? 'none' : 'auto'}>
        <Text style={s_.h2}>Характер</Text>
        <Chips items={ym.WAVE_DIVERSITY} value={s.waveDiversity} accent={th} onPick={id => pick({ waveDiversity: id })} />
        <Text style={s_.h2}>Настроение</Text>
        <Chips items={ym.WAVE_MOODS} value={s.waveMood} accent={th} onPick={id => pick({ waveMood: id })} />
      </View>

      {nextUp.length > 0 && (
        <View style={s_.next}>
          <Text style={s_.nextHead}>Далее</Text>
          {nextUp.map((x, i) => <FadeIn key={x.id} delay={i * 40} dy={8}><TrackRow {...row(x, st.index + 1 + i)} onPress={() => player.jump(st.index + 1 + i)} /></FadeIn>)}
        </View>
      )}

      {lists.length > 0 && (
        <FadeIn delay={150}>
          <Text style={s_.shelfHead}>Твои плейлисты</Text>
          <FlatList
            horizontal showsHorizontalScrollIndicator={false} data={lists} keyExtractor={p => p.owner + ':' + p.kind}
            contentContainerStyle={{ gap: 14, paddingHorizontal: 20 }}
            renderItem={({ item: p }) => (
              <Tap style={{ width: 140 }} scale={0.95} onPress={() => nav.playlist(p)}>
                <Image source={ym.img(p.coverUri, 300)} style={s_.shelfCover} cachePolicy="memory-disk" transition={200} />
                <Text style={s_.shelfTitle} numberOfLines={1}>{p.title}</Text>
                <Text style={s_.shelfSub} numberOfLines={1}>{ym.tracksWord(p.trackCount)}</Text>
              </Tap>
            )}
          />
        </FadeIn>
      )}
    </Animated.ScrollView>
    </View>
  );
}

function Chips({ items, value, onPick, accent, center }: {
  items: readonly { id: string; label: string }[]; value: string; onPick: (id: string) => void; accent: { accent: string; onAccent: string }; center?: boolean;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s_.chips, center && { flexGrow: 1, justifyContent: 'center' }]}>
      {items.map(i => {
        const on = i.id === value;
        return (
          <Tap key={i.id} onPress={() => onPick(i.id)} scale={0.92} style={[s_.chip, on && { backgroundColor: accent.accent, borderColor: accent.accent }]}>
            <Text style={[s_.chipText, on && { color: accent.onAccent, fontWeight: '600' }]}>{i.label}</Text>
          </Tap>
        );
      })}
    </ScrollView>
  );
}

const s_ = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  head: { paddingHorizontal: 22, paddingBottom: 14 },
  logo: { color: C.fg, fontSize: 30, fontWeight: '800', letterSpacing: -1.2 },
  cover: { borderRadius: 24, overflow: 'hidden', backgroundColor: C.tile,
    shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 28, shadowOffset: { width: 0, height: 14 } },
  empty: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.track, borderRadius: 22 },
  playBtn: { position: 'absolute', right: 14, bottom: 14, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  caption: { color: C.dim, fontSize: 13, fontWeight: '700', letterSpacing: 2, textAlign: 'center', marginTop: 26 },
  title: { color: C.fg, fontSize: 28, fontWeight: '800', textAlign: 'center', paddingHorizontal: 24, marginTop: 6, letterSpacing: -0.5 },
  artist: { color: C.dim, fontSize: 17, textAlign: 'center', marginTop: 4, paddingHorizontal: 24 },
  err: { color: C.danger, fontSize: 13, textAlign: 'center', marginTop: 10, paddingHorizontal: 24 },
  h2: { color: C.dim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, paddingHorizontal: 22, marginTop: 24, marginBottom: 10 },
  chips: { gap: 8, paddingHorizontal: 20, marginTop: 18 },
  chip: { paddingHorizontal: 18, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.07)', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  chipText: { color: C.fg, fontSize: 15.5 },
  bigPlay: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.5, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } },
  shelfHead: { color: C.fg, fontSize: 21, fontWeight: '700', paddingHorizontal: 20, marginTop: 30, marginBottom: 12 },
  shelfCover: { width: 140, height: 140, borderRadius: 14, backgroundColor: C.tile },
  shelfTitle: { color: C.fg, fontSize: 14.5, fontWeight: '600', marginTop: 8 },
  shelfSub: { color: C.dim, fontSize: 12.5, marginTop: 1 },
  next: { marginTop: 30, marginHorizontal: 12, paddingVertical: 10, borderRadius: 24, backgroundColor: 'rgba(20,20,20,0.75)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  nextHead: { color: C.fg, fontSize: 20, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 6 },
});
