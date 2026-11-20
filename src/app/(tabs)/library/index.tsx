import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Animated, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as dl from '../../../downloads';
import * as player from '../../../player';
import { Glow } from '../../../ui/Glow';
import { Icon } from '../../../ui/Icon';
import { FadeIn, GlassButton, PageTitle, Tap, TopBar, useScrollY } from '../../../ui/motion';
import { useNav } from '../../../ui/nav';
import { RemoteCard } from '../../../ui/RemoteCard';
import { C, R, useTheme } from '../../../ui/theme';
import * as ym from '../../../ym';

export default function Library() {
  const nav = useNav();
  const th = useTheme();
  const top = useSafeAreaInsets().top;
  const d = dl.useDownloads();
  const cur = player.usePlayerSel(st => st.queue[st.index]);
  const { y, onScroll } = useScrollY();
  const [lists, setLists] = useState<ym.Playlist[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setBusy(true); setErr('');
    try { setLists(await ym.playlists()); } catch (e: any) { setErr(e?.message ?? 'Нет связи — доступны скачанные треки'); }
    setBusy(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const savedCount = Object.keys(d.done).length;
  const loading = Object.keys(d.progress).length;
  const gear = <GlassButton icon="gearshape" onPress={() => router.push('/library/settings')} />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: y.interpolate({ inputRange: [-200, 0, 400], outputRange: [0, 0, -200], extrapolate: 'clamp' }) }] }]}>
        <Glow uri={cur ? dl.coverSrc(cur, 200) : null} height={480} strength={0.45} />
      </Animated.View>
      <Animated.FlatList
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: top + 8, paddingBottom: 160 }}
        data={lists}
        keyExtractor={p => p.owner + ':' + p.kind}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={C.dim} progressViewOffset={top} />}
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            <PageTitle right={<View style={{ marginTop: 4 }}>{gear}</View>}>Моё</PageTitle>
            <FadeIn delay={0}>
              <Big icon="heart.fill" color={C.heart} title="Мне нравится" sub="Все твои лайки"
                onPress={() => router.push({ pathname: '/library/list', params: { kind: 'likes', title: 'Мне нравится' } })} />
            </FadeIn>
            <FadeIn delay={60}>
              <Big icon="arrow.down.circle.fill" color={th.accent} title="Скачанные"
                sub={loading ? `Скачивается ${loading}…` : savedCount ? `${ym.tracksWord(savedCount)} · ${dl.fmtSize(dl.totalBytes())}` : 'Слушать без интернета'}
                onPress={() => router.push({ pathname: '/library/list', params: { kind: 'downloads', title: 'Скачанные' } })} />
            </FadeIn>
            <FadeIn delay={120}><RemoteCard /></FadeIn>
            {!!err && <Text style={s.err}>{err}</Text>}
            <Text style={s.h2}>Плейлисты</Text>
          </View>
        }
        renderItem={({ item: p, index }) => (
          <FadeIn delay={Math.min(index, 10) * 35} dy={10}>
            <Tap style={s.row} scale={0.97} onPress={() => nav.playlist(p)}>
              <Image source={ym.img(p.coverUri, 200)} style={s.cover} cachePolicy="memory-disk" transition={200} />
              <View style={{ flex: 1 }}>
                <Text style={s.title} numberOfLines={1}>{p.title}</Text>
                <Text style={s.sub}>{ym.tracksWord(p.trackCount)}</Text>
              </View>
              <Icon name="chevron.right" size={14} color={C.faint} />
            </Tap>
          </FadeIn>
        )}
      />
      <TopBar y={y} title="Моё" back={false} right={<BarGear y={y} />} showAt={50} />
    </View>
  );
}

/** Шестерёнка в верхней панели: проявляется, когда заголовок с такой же уехал вверх. */
function BarGear({ y }: { y: Animated.Value }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = y.addListener(({ value }) => setOn(v => (value > 40) === v ? v : !v));
    return () => y.removeListener(id);
  }, [y]);
  const op = y.interpolate({ inputRange: [30, 60], outputRange: [0, 1], extrapolate: 'clamp' });
  return (
    <Animated.View style={{ opacity: op }} pointerEvents={on ? 'auto' : 'none'}>
      <GlassButton icon="gearshape" onPress={() => router.push('/library/settings')} />
    </Animated.View>
  );
}

function Big({ icon, color, title, sub, onPress }: { icon: any; color: string; title: string; sub: string; onPress: () => void }) {
  return (
    <Tap style={s.big} scale={0.97} onPress={onPress} haptic="light">
      <View style={s.bigIcon}><Icon name={icon} size={26} color={color} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>{title}</Text>
        <Text style={s.sub}>{sub}</Text>
      </View>
      <Icon name="chevron.right" size={14} color={C.faint} />
    </Tap>
  );
}

const s = StyleSheet.create({
  big: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 16, padding: 12, borderRadius: R.l, backgroundColor: C.tile,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.06)' },
  bigIcon: { width: 56, height: 56, borderRadius: 14, backgroundColor: C.sel, alignItems: 'center', justifyContent: 'center' },
  h2: { color: C.fg, fontSize: 22, fontWeight: '700', paddingHorizontal: 20, marginTop: 18, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 8 },
  cover: { width: 58, height: 58, borderRadius: 10, backgroundColor: C.tile },
  title: { color: C.fg, fontSize: 16.5, fontWeight: '600' },
  sub: { color: C.dim, fontSize: 13.5, marginTop: 2 },
  err: { color: C.dim, fontSize: 13, paddingHorizontal: 20 },
});
