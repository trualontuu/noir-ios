import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Shelf } from '../../../screens/Artist';
import { useNav } from '../../../ui/nav';
import { TrackRow, useRowProps } from '../../../ui/TrackRow';
import { C } from '../../../ui/theme';
import * as ym from '../../../ym';

const EMPTY: ym.SearchResult = { tracks: [], artists: [], albums: [], playlists: [] };

export default function Search() {
  const nav = useNav();
  const [q, setQ] = useState('');
  const [res, setRes] = useState<ym.SearchResult>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const seq = useRef(0);
  const row = useRowProps(res.tracks);

  useEffect(() => {
    const text = q.trim();
    if (!text) { setRes(EMPTY); setErr(''); return; }
    const n = ++seq.current;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await ym.search(text);
        if (n === seq.current) { setRes(r); setErr(''); }
      } catch (e: any) { if (n === seq.current) setErr(e?.message ?? 'Ошибка поиска'); }
      if (n === seq.current) setBusy(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [q]);

  const nothing = !res.tracks.length && !res.artists.length && !res.albums.length;

  return (
    <>
      <Stack.Screen options={{
        headerSearchBarOptions: {
          placeholder: 'Треки, артисты, альбомы', onChangeText: e => setQ(e.nativeEvent.text),
          hideWhenScrolling: false, autoCapitalize: 'none', barTintColor: C.tile, textColor: C.fg, tintColor: C.fg,
        },
      }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardDismissMode="on-drag" style={{ backgroundColor: C.bg }} contentContainerStyle={{ paddingBottom: 150 }}>
        {busy && <ActivityIndicator color={C.dim} style={{ marginVertical: 14 }} />}
        {!busy && nothing && <Text style={s.empty}>{err || (q.trim() ? 'Ничего не нашлось' : 'Найди что угодно из Яндекс Музыки')}</Text>}

        {res.artists.length > 0 && <Text style={s.h2}>Артисты</Text>}
        <FlatList
          horizontal showsHorizontalScrollIndicator={false} data={res.artists} keyExtractor={a => a.id}
          contentContainerStyle={{ gap: 14, paddingHorizontal: 16 }}
          renderItem={({ item: a }) => (
            <Pressable style={{ width: 96, alignItems: 'center' }} onPress={() => nav.artist(a.id, a.name)}>
              <Image source={ym.img(a.coverUri, 200)} style={s.avatar} cachePolicy="memory-disk" />
              <Text style={s.name} numberOfLines={1}>{a.name}</Text>
            </Pressable>
          )}
        />

        {res.tracks.length > 0 && <Text style={s.h2}>Треки</Text>}
        {res.tracks.map((t, i) => <TrackRow key={t.id} {...row(t, i)} />)}

        <Shelf title="Альбомы" items={res.albums} onOpen={a => nav.album(a.id, a.title)} />

        {res.playlists.length > 0 && <Text style={s.h2}>Плейлисты</Text>}
        <FlatList
          horizontal showsHorizontalScrollIndicator={false} data={res.playlists} keyExtractor={p => p.owner + ':' + p.kind}
          contentContainerStyle={{ gap: 14, paddingHorizontal: 16 }}
          renderItem={({ item: p }) => (
            <Pressable style={{ width: 140 }} onPress={() => nav.playlist(p)}>
              <Image source={ym.img(p.coverUri, 300)} style={s.pl} cachePolicy="memory-disk" />
              <Text style={s.name} numberOfLines={1}>{p.title}</Text>
            </Pressable>
          )}
        />
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  empty: { color: C.dim, fontSize: 15, textAlign: 'center', marginTop: 60, paddingHorizontal: 32 },
  h2: { color: C.fg, fontSize: 21, fontWeight: '700', paddingHorizontal: 16, marginTop: 22, marginBottom: 10 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: C.tile },
  pl: { width: 140, height: 140, borderRadius: 10, backgroundColor: C.tile },
  name: { color: C.fg, fontSize: 14, fontWeight: '500', marginTop: 7, textAlign: 'center' },
});
