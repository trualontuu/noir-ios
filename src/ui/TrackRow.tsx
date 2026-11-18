import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { memo } from 'react';
import { ActionSheetIOS, Pressable, StyleSheet, Text, View } from 'react-native';
import * as dl from '../downloads';
import * as player from '../player';
import * as ym from '../ym';
import type { Track } from '../ym';
import { EqBars } from './EqBars';
import { Icon } from './Icon';
import { useNav } from './nav';
import { C, R, useTheme } from './theme';

type Props = { track: Track; current: boolean; playing: boolean; liked: boolean; onPress: () => void; index?: number };

/** Меню трека по долгому нажатию (и по «…» в плеере). */
export function useTrackMenu() {
  const nav = useNav();
  return (t: Track) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const liked = ym.liked.has(t.id);
    const saved = dl.isDownloaded(t.id);
    const items: [string, () => void][] = [
      ['Играть следующим', () => player.playNext(t)],
      [liked ? 'Убрать из «Мне нравится»' : 'Мне нравится', () => player.like(t).catch(() => {})],
      [saved ? 'Удалить загрузку' : 'Скачать', () => saved ? dl.remove([t.id]) : dl.download([t])],
    ];
    if (t.artistRefs[0]?.id) items.push(['К артисту', () => nav.artist(t.artistRefs[0].id, t.artistRefs[0].name)]);
    if (t.albumId) items.push(['К альбому', () => nav.album(t.albumId, t.album)]);
    items.push(['Не нравится', () => player.dislike(t).catch(() => {})]);
    ActionSheetIOS.showActionSheetWithOptions(
      { options: [...items.map(i => i[0]), 'Отмена'], cancelButtonIndex: items.length, destructiveButtonIndex: items.length - 1, title: ym.fullTitle(t), message: t.artists, userInterfaceStyle: 'dark' },
      i => items[i]?.[1](),
    );
  };
}

export const TrackRow = memo(function TrackRow({ track: t, current, playing, liked, onPress, index }: Props) {
  const menu = useTrackMenu();
  const th = useTheme();
  const d = dl.useDownloads();
  const saved = !!d.done[t.id];
  const prog = d.progress[t.id];
  return (
    <Pressable onPress={onPress} onLongPress={() => menu(t)} style={({ pressed }) => [s.row, current && s.cur, pressed && { backgroundColor: C.tile }]}>
      {index != null ? <Text style={s.num}>{index + 1}</Text> : null}
      {index == null && <Image source={dl.coverSrc(t, 100)} style={s.cover} transition={150} cachePolicy="memory-disk" recyclingKey={t.id} />}
      <View style={s.text}>
        <Text style={[s.title, !t.available && s.off, current && { color: th.accent }]} numberOfLines={1}>{ym.fullTitle(t)}</Text>
        <View style={s.subRow}>
          {saved && <Icon name="arrow.down.circle.fill" size={12} color={C.dim} />}
          {prog != null && <Text style={s.prog}>{Math.round(prog * 100)}%</Text>}
          <Text style={s.sub} numberOfLines={1}>{t.artists}</Text>
        </View>
      </View>
      {liked && <Icon name="heart.fill" size={13} color={C.heart} />}
      {current ? <EqBars playing={playing} color={th.accent} /> : <Text style={s.dur}>{ym.fmtTime(t.durationMs / 1000)}</Text>}
    </Pressable>
  );
});

/** Свойства строк + общий обработчик: нажатие играет список с этого трека. */
export function useRowProps(list: Track[], session: ym.WaveSession | null = null) {
  const st = player.usePlayer();
  const cur = st.queue[st.index];
  return (t: Track, i: number): Props => ({
    track: t,
    current: cur?.id === t.id,
    playing: st.playing,
    liked: ym.liked.has(t.id),
    onPress: () => {
      Haptics.selectionAsync();
      if (cur?.id === t.id) { player.toggle(); return; }
      player.playList(list, i, session);
    },
  });
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 7 },
  cur: { backgroundColor: 'rgba(255,255,255,0.04)' },
  cover: { width: 48, height: 48, borderRadius: R.s, backgroundColor: C.tile },
  num: { width: 24, color: C.faint, fontSize: 15, textAlign: 'center', fontVariant: ['tabular-nums'] },
  text: { flex: 1, minWidth: 0 },
  title: { color: C.fg, fontSize: 16, fontWeight: '500' },
  off: { color: C.faint },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  sub: { color: C.dim, fontSize: 13.5, flexShrink: 1 },
  prog: { color: C.dim, fontSize: 12, fontVariant: ['tabular-nums'] },
  dur: { color: C.faint, fontSize: 13, fontVariant: ['tabular-nums'], minWidth: 34, textAlign: 'right' },
});
