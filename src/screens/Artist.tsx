import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as player from '../player';
import { Glow } from '../ui/Glow';
import { Icon } from '../ui/Icon';
import { BAR_H, FadeIn, Tap, TopBar, useScrollY } from '../ui/motion';
import { useNav } from '../ui/nav';
import { TrackRow, useRowProps } from '../ui/TrackRow';
import { C, useTheme } from '../ui/theme';
import * as ym from '../ym';

/** Страница артиста: популярные треки, альбомы, синглы, похожие. */
export default function Artist() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const nav = useNav();
  const th = useTheme();
  const [info, setInfo] = useState<ym.ArtistInfo | null>(null);
  const [err, setErr] = useState('');
  const [all, setAll] = useState(false);
  const top = useSafeAreaInsets().top;
  const { y, onScroll } = useScrollY();
  const popular = info?.popular ?? [];
  const row = useRowProps(popular);

  useEffect(() => { ym.artistPage(id).then(setInfo).catch(e => setErr(e?.message ?? 'Не загрузилось')); }, [id]);

  const cover = info?.artist.coverUri ? ym.img(info.artist.coverUri, 600) : null;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
    <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: y.interpolate({ inputRange: [-200, 0, 600], outputRange: [0, 0, -300], extrapolate: 'clamp' }) }] }]}>
      <Glow uri={cover} height={top + 480} strength={0.75} />
    </Animated.View>
    <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ paddingTop: top + BAR_H, paddingBottom: 160 }}>
      <View style={s.head}>
        <Animated.View style={{
          opacity: y.interpolate({ inputRange: [0, 220], outputRange: [1, 0.1], extrapolate: 'clamp' }),
          transform: [
            { translateY: y.interpolate({ inputRange: [-200, 0, 260], outputRange: [-100, 0, 100], extrapolate: 'clamp' }) },
            { scale: y.interpolate({ inputRange: [-200, 0, 260], outputRange: [1.3, 1, 0.8], extrapolate: 'clamp' }) },
          ],
        }}>
          {cover ? <Image source={cover} style={s.avatar} transition={300} /> : <View style={[s.avatar, s.empty]}><Icon name="person.fill" size={60} color={C.faint} /></View>}
        </Animated.View>
        <FadeIn delay={60} style={{ alignItems: 'center' }}>
          <Text style={s.h1}>{info?.artist.name ?? name ?? ''}</Text>
          <Tap style={[s.play, { backgroundColor: th.accent }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); popular.length && player.playList(popular, 0); }}>
            <Icon name="play.fill" size={16} color={th.onAccent} /><Text style={[s.playText, { color: th.onAccent }]}>Популярное</Text>
          </Tap>
        </FadeIn>
      </View>
      {!!err && <Text style={s.err}>{err}</Text>}
      {!info && !err && <ActivityIndicator color={C.dim} style={{ marginTop: 30 }} />}

      {popular.length > 0 && <Text style={s.h2}>Популярные треки</Text>}
      {(all ? popular : popular.slice(0, 5)).map((t, i) => <FadeIn key={t.id} delay={i < 5 ? 120 + i * 40 : 0} dy={8}><TrackRow {...row(t, i)} /></FadeIn>)}
      {popular.length > 5 && (
        <Pressable onPress={() => setAll(v => !v)}><Text style={[s.more, { color: th.accent }]}>{all ? 'Свернуть' : 'Показать все'}</Text></Pressable>
      )}

      <Shelf title="Альбомы" items={info?.albums ?? []} onOpen={a => nav.album(a.id, a.title)} />
      <Shelf title="Синглы и EP" items={info?.singles ?? []} onOpen={a => nav.album(a.id, a.title)} />

      {(info?.similar.length ?? 0) > 0 && <Text style={s.h2}>Похожие</Text>}
      <FlatList
        horizontal showsHorizontalScrollIndicator={false} data={info?.similar ?? []} keyExtractor={a => a.id}
        contentContainerStyle={{ gap: 14, paddingHorizontal: 16 }}
        renderItem={({ item: a }) => (
          <Tap style={{ width: 100, alignItems: 'center' }} onPress={() => nav.artist(a.id, a.name)}>
            <Image source={ym.img(a.coverUri, 200)} style={s.simAvatar} cachePolicy="memory-disk" transition={200} />
            <Text style={s.cardTitle} numberOfLines={1}>{a.name}</Text>
          </Tap>
        )}
      />
    </Animated.ScrollView>
    <TopBar y={y} title={info?.artist.name ?? name ?? ''} showAt={260} />
    </View>
  );
}

/** Горизонтальная полка альбомов (и в поиске тоже). */
export function Shelf({ title, items, onOpen }: { title: string; items: ym.Album[]; onOpen: (a: ym.Album) => void }) {
  if (!items.length) return null;
  return (
    <>
      <Text style={s.h2}>{title}</Text>
      <FlatList
        horizontal showsHorizontalScrollIndicator={false} data={items} keyExtractor={a => a.id}
        contentContainerStyle={{ gap: 14, paddingHorizontal: 16 }}
        renderItem={({ item: a }) => (
          <Tap style={{ width: 140 }} scale={0.95} onPress={() => onOpen(a)}>
            <Image source={ym.img(a.coverUri, 300)} style={s.albumCover} cachePolicy="memory-disk" transition={200} />
            <Text style={s.cardTitle} numberOfLines={1}>{a.title}</Text>
            <Text style={s.cardSub} numberOfLines={1}>{a.year || a.artists}</Text>
          </Tap>
        )}
      />
    </>
  );
}

const s = StyleSheet.create({
  head: { alignItems: 'center', paddingTop: 4, paddingBottom: 6 },
  avatar: { width: 190, height: 190, borderRadius: 95, backgroundColor: C.tile },
  empty: { alignItems: 'center', justifyContent: 'center' },
  h1: { color: C.fg, fontSize: 30, fontWeight: '800', marginTop: 16, letterSpacing: -0.6, textAlign: 'center', paddingHorizontal: 20 },
  play: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 22, borderRadius: 22, marginTop: 16 },
  playText: { fontSize: 16, fontWeight: '600' },
  h2: { color: C.fg, fontSize: 21, fontWeight: '700', paddingHorizontal: 16, marginTop: 26, marginBottom: 10 },
  more: { fontSize: 15, paddingHorizontal: 16, paddingVertical: 10 },
  err: { color: C.danger, fontSize: 13, padding: 16 },
  albumCover: { width: 140, height: 140, borderRadius: 12, backgroundColor: C.tile },
  simAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: C.tile },
  cardTitle: { color: C.fg, fontSize: 14, fontWeight: '500', marginTop: 7 },
  cardSub: { color: C.dim, fontSize: 13, marginTop: 1 },
});
