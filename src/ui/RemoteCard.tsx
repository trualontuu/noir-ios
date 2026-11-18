import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import * as remote from '../remote';
import { EqBars } from './EqBars';
import { Icon } from './Icon';
import { FadeIn, Tap } from './motion';
import { C, R } from './theme';

/** «Играет на компьютере» — появляется, когда десктопный Noir в сети. Тап — пульт. */
export function RemoteCard() {
  const h = remote.useRemote().host;
  if (!h) return null;
  const s = h.state;
  return (
    <FadeIn>
      <Tap style={st.card} scale={0.97} haptic="light" onPress={() => router.push('/remote')}>
        {s?.cover ? <Image source={s.cover} style={st.cover} transition={250} /> :
          <View style={[st.cover, st.empty]}><Icon name="desktopcomputer" size={24} color={C.dim} /></View>}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={st.where}>
            <Icon name="desktopcomputer" size={11} color={C.dim} />
            <Text style={st.whereText} numberOfLines={1}>{s?.title ? (s.playing ? 'Играет на ' : 'Пауза на ') + h.name : h.name + ' в сети'}</Text>
          </View>
          <Text style={st.title} numberOfLines={1}>{s?.title || 'Пульт для компьютера'}</Text>
          {!!s?.artist && <Text style={st.sub} numberOfLines={1}>{s.artist}</Text>}
        </View>
        {s?.title ? (
          <Tap hitSlop={10} haptic="medium" scale={0.85} onPress={remote.toggle} style={st.btn}>
            {s.playing ? <EqBars playing color={C.fg} /> : <Icon name="play.fill" size={18} />}
          </Tap>
        ) : <Icon name="chevron.right" size={14} color={C.faint} />}
      </Tap>
    </FadeIn>
  );
}

const st = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 16, padding: 12, borderRadius: R.l,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)' },
  cover: { width: 56, height: 56, borderRadius: 12, backgroundColor: C.sel },
  empty: { alignItems: 'center', justifyContent: 'center' },
  where: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  whereText: { color: C.dim, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  title: { color: C.fg, fontSize: 16, fontWeight: '600', marginTop: 2 },
  sub: { color: C.dim, fontSize: 13.5, marginTop: 1 },
  btn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
});
