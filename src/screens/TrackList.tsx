import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Animated, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as dl from '../downloads';
import * as player from '../player';
import { Glow } from '../ui/Glow';
import { Icon } from '../ui/Icon';
import { BAR_H, FadeIn, Tap, TopBar, useScrollY } from '../ui/motion';
import { useNav } from '../ui/nav';
import { TrackRow, useRowProps } from '../ui/TrackRow';
import { C, useTheme } from '../ui/theme';
import * as ym from '../ym';

type Params = { kind?: string; owner?: string; title?: string; cover?: string; id?: string };

/**
 * Список треков с шапкой-обложкой: «Мне нравится» (kind=likes), «Скачанные» (kind=downloads),
 * плейлист (owner+kind) или альбом (mode="album", id).
 */
export default function TrackList({ mode }: { mode?: 'album' }) {
  const p = useLocalSearchParams<Params>();
  const nav = useNav();
  const th = useTheme();
  const d = dl.useDownloads();
  const top = useSafeAreaInsets().top;
  const { y, onScroll } = useScrollY();
  const [tracks, setTracks] = useState<ym.Track[] | null>(null);
  const [album, setAlbum] = useState<ym.Album | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const offline = p.kind === 'downloads';
  const list = offline ? dl.list() : tracks;
  const row = useRowProps(list ?? []);

  const load = useCallback(async () => {
    if (offline) return;
    setBusy(true); setErr('');
    try {
      if (mode === 'album') { const r = await ym.albumPage(p.id!); setAlbum(r.album); setTracks(r.tracks); }
      else if (p.kind === 'likes') setTracks(await ym.likes());
      else setTracks(await ym.playlistTracks({ owner: p.owner!, kind: p.kind!, title: p.title ?? '', trackCount: 0, coverUri: '' }));
    } catch (e: any) { setErr(e?.message ?? 'Не загрузилось'); }
    setBusy(false);
  }, [p.id, p.kind, p.owner, mode]);
  useEffect(() => { load(); }, [load]);

  const title = album?.title ?? p.title ?? '';
  const coverUri = useMemo(() => {
    if (album?.coverUri) return ym.img(album.coverUri, 600);
    if (p.cover) return ym.img(p.cover, 600);
    return list?.[0] ? dl.coverSrc(list[0], 600) : null;
  }, [album, p.cover, list?.[0]?.id]);

  const all = list ?? [];
  const savedCount = all.filter(t => d.done[t.id]).length;
  const loading = all.filter(t => t.id in d.progress).length;

  const play = (shuffle: boolean) => {
    if (!all.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (player.getState().shuffle !== shuffle) player.setShuffle(shuffle);
    player.playList(all, shuffle ? Math.floor(Math.random() * all.length) : 0);
  };

  const downloadAll = () => {
    if (offline || savedCount === all.length) {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: 'Удалить скачанные треки этого списка?', options: ['Удалить', 'Отмена'], destructiveButtonIndex: 0, cancelButtonIndex: 1, userInterfaceStyle: 'dark' },
        i => { if (i === 0) dl.remove(all.map(t => t.id)); },
      );
    } else { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); dl.download(all); }
  };

  const sub = album
    ? [album.artists, album.year].filter(Boolean).join(' · ')
    : list ? ym.tracksWord(list.length) + (offline ? ` · ${dl.fmtSize(dl.totalBytes())}` : '') : '';

  // обложка: при оттягивании вниз растёт, при прокрутке уезжает медленнее контента и гаснет
  const coverAnim = {
    opacity: y.interpolate({ inputRange: [0, 260], outputRange: [1, 0.15], extrapolate: 'clamp' }),
    transform: [
      { translateY: y.interpolate({ inputRange: [-200, 0, 300], outputRange: [-100, 0, 110], extrapolate: 'clamp' }) },
      { scale: y.interpolate({ inputRange: [-200, 0, 300], outputRange: [1.25, 1, 0.82], extrapolate: 'clamp' }) },
    ],
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: y.interpolate({ inputRange: [-200, 0, 600], outputRange: [0, 0, -300], extrapolate: 'clamp' }) }] }]}>
        <Glow uri={coverUri} height={top + 520} strength={0.7} />
      </Animated.View>
      <Animated.FlatList
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: top + BAR_H, paddingBottom: 160 }}
        data={all}
        keyExtractor={(t, i) => t.id + ':' + i}
        initialNumToRender={14}
        windowSize={9}
        refreshControl={offline ? undefined : <RefreshControl refreshing={busy && !!tracks} onRefresh={load} tintColor={C.dim} progressViewOffset={top + BAR_H} />}
        ListHeaderComponent={
          <View style={s.head}>
            <Animated.View style={coverAnim}>
              {coverUri ? <Image source={coverUri} style={s.cover} transition={300} cachePolicy="memory-disk" />
                : <View style={[s.cover, s.coverEmpty]}><Icon name={offline ? 'arrow.down.circle' : 'heart.fill'} size={56} color={offline ? C.faint : C.heart} /></View>}
            </Animated.View>
            <FadeIn delay={60}>
              <Text style={s.h1} numberOfLines={2}>{title}</Text>
              {album?.artistRefs[0] ? (
                <Pressable onPress={() => nav.artist(album.artistRefs[0].id, album.artistRefs[0].name)}><Text style={[s.sub, { color: th.accent }]}>{sub}</Text></Pressable>
              ) : <Text style={s.sub}>{sub}</Text>}
            </FadeIn>
            <FadeIn delay={120} style={s.btns}>
              <Tap style={[s.btn, { backgroundColor: th.accent }]} onPress={() => play(false)}>
                <Icon name="play.fill" size={16} color={th.onAccent} /><Text style={[s.btnText, { color: th.onAccent }]}>Слушать</Text>
              </Tap>
              <Tap style={s.btn} onPress={() => play(true)}>
                <Icon name="shuffle" size={16} /><Text style={s.btnText}>Вперемешку</Text>
              </Tap>
              <Tap style={s.round} onPress={downloadAll} hitSlop={6} scale={0.88}>
                {loading > 0 ? <ActivityIndicator color={C.fg} size="small" /> :
                  <Icon name={offline || (all.length > 0 && savedCount === all.length) ? 'arrow.down.circle.fill' : 'arrow.down.circle'} size={22} />}
              </Tap>
            </FadeIn>
            {loading > 0 && <Text style={s.note}>Скачивается {loading}…</Text>}
            {!!err && <Text style={s.err}>{err}</Text>}
            {!list && !err && <ActivityIndicator color={C.dim} style={{ marginTop: 30 }} />}
            {offline && all.length === 0 && <Text style={s.note}>Здесь будут скачанные треки. Скачать можно из меню трека (долгое нажатие) или кнопкой ↓ у плейлиста.</Text>}
          </View>
        }
        renderItem={({ item, index }) => (
          index < 14
            ? <FadeIn delay={160 + index * 25} dy={8}><TrackRow {...row(item, index)} index={mode === 'album' ? index : undefined} /></FadeIn>
            : <TrackRow {...row(item, index)} index={mode === 'album' ? index : undefined} />
        )}
      />
      <TopBar y={y} title={title} showAt={300} />
    </View>
  );
}

const s = StyleSheet.create({
  head: { alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, paddingTop: 6 },
  cover: { width: 240, height: 240, borderRadius: 16, backgroundColor: C.tile, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 22, shadowOffset: { width: 0, height: 10 } },
  coverEmpty: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.track },
  h1: { color: C.fg, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 18, textAlign: 'center' },
  sub: { color: C.dim, fontSize: 15, marginTop: 5, textAlign: 'center' },
  btns: { flexDirection: 'row', gap: 10, marginTop: 20, alignSelf: 'stretch' },
  btn: { flex: 1, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  round: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  btnText: { color: C.fg, fontSize: 16, fontWeight: '600' },
  note: { color: C.dim, fontSize: 13, marginTop: 12, textAlign: 'center' },
  err: { color: C.danger, fontSize: 13, marginTop: 12 },
});
