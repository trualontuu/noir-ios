import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as upd from '../../../updates';
import { ActionSheetIOS, Animated, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BAR_H, TopBar, useScrollY } from '../../../ui/motion';
import * as dl from '../../../downloads';
import * as player from '../../../player';
import { setSettings, useSettings } from '../../../settings';
import { C, R, useTheme } from '../../../ui/theme';
import * as ym from '../../../ym';

/** Настройки — те же, что в десктопном Noir, без того, что на телефоне не нужно. */
export default function Settings() {
  const s = useSettings();
  const th = useTheme();
  const d = dl.useDownloads();
  const count = Object.keys(d.done).length;
  const u = upd.useUpdateState();
  const top = useSafeAreaInsets().top;
  const { y, onScroll } = useScrollY();

  const logout = () => ActionSheetIOS.showActionSheetWithOptions(
    { title: ym.login, message: 'Скачанные треки останутся на телефоне', options: ['Выйти из аккаунта', 'Отмена'], destructiveButtonIndex: 0, cancelButtonIndex: 1, userInterfaceStyle: 'dark' },
    async i => { if (i === 0) { player.stop(); await ym.logout(); } },
  );
  const clear = () => ActionSheetIOS.showActionSheetWithOptions(
    { title: `Удалить все скачанные (${dl.fmtSize(dl.totalBytes())})?`, options: ['Удалить', 'Отмена'], destructiveButtonIndex: 0, cancelButtonIndex: 1, userInterfaceStyle: 'dark' },
    i => { if (i === 0) dl.removeAll(); },
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
    <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ paddingBottom: 160, paddingTop: top + BAR_H }}>
      <Text style={st.h1}>Настройки</Text>
      <Group title="Цвета">
        <Segment value={s.colorMode} accent={th} items={[['mono', 'Чёрно-белый'], ['cover', 'По обложке']]} onPick={v => setSettings({ colorMode: v as any })} />
        <Text style={st.hint}>«По обложке» — кнопки и свечение фона в тон играющего трека.</Text>
      </Group>

      <Group title="Звук">
        <Row label="Ровная громкость" hint="Громкие треки приглушаются до общего уровня (LUFS)">
          <Switch value={s.normalize} onValueChange={v => { setSettings({ normalize: v }); player.applyVolume(); }} trackColor={{ true: th.accent }} />
        </Row>
        <Text style={st.label}>Качество, кбит/с</Text>
        <Segment value={String(s.quality)} accent={th} items={[['128', '128'], ['192', '192'], ['320', '320']]} onPick={v => setSettings({ quality: Number(v) as any })} />
        <Text style={st.hint}>Для потока и для новых загрузок.</Text>
        <Text style={st.label}>Плавный переход, сек</Text>
        <Segment value={String(s.crossfade)} accent={th} items={[['0', 'Выкл'], ['3', '3'], ['6', '6'], ['10', '10']]} onPick={v => setSettings({ crossfade: Number(v) as any })} />
        <Text style={st.hint}>Конец трека затихает, следующий плавно нарастает.</Text>
      </Group>

      <Group title="Загрузки">
        <Row label="Скачано" hint={count ? `${ym.tracksWord(count)} · ${dl.fmtSize(dl.totalBytes())}` : 'Пока ничего'} />
        {count > 0 && <Pressable onPress={clear}><Text style={[st.action, { color: C.danger }]}>Удалить все загрузки</Text></Pressable>}
      </Group>

      <Group title="Аккаунт">
        <Row label="Яндекс" hint={ym.login || 'вход выполнен'} />
        <Pressable onPress={logout}><Text style={[st.action, { color: C.danger }]}>Выйти</Text></Pressable>
      </Group>

      <Group title="Приложение">
        <Row label={`Noir ${Constants.expoConfig?.version ?? ''}`} hint={upd.currentLabel()} />
        {u.ready ? (
          <Pressable onPress={upd.restart}><Text style={[st.action, { color: th.accent }]}>Обновление готово — перезапустить</Text></Pressable>
        ) : upd.supported() ? (
          <Pressable onPress={() => upd.check(true)} disabled={u.checking}>
            <Text style={[st.action, { color: th.accent }]}>{u.checking ? 'Проверяю…' : 'Проверить обновления'}</Text>
          </Pressable>
        ) : null}
        {!!u.error && <Text style={st.hint}>{u.error}</Text>}
      </Group>

      <Text style={st.foot}>Noir — неофициальный клиент Яндекс Музыки.</Text>
    </Animated.ScrollView>
    <TopBar y={y} title="Настройки" showAt={50} />
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={st.gTitle}>{title}</Text>
      <View style={st.group}>{children}</View>
    </View>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children?: React.ReactNode }) {
  return (
    <View style={st.row}>
      <View style={{ flex: 1 }}>
        <Text style={st.label}>{label}</Text>
        {!!hint && <Text style={st.hint}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

function Segment({ value, items, onPick, accent }: { value: string; items: [string, string][]; onPick: (v: string) => void; accent: { accent: string; onAccent: string } }) {
  return (
    <View style={st.seg}>
      {items.map(([v, label]) => {
        const on = v === value;
        return (
          <Pressable key={v} style={[st.segItem, on && { backgroundColor: accent.accent }]} onPress={() => { Haptics.selectionAsync(); onPick(v); }}>
            <Text style={[st.segText, on && { color: accent.onAccent, fontWeight: '600' }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  h1: { color: C.fg, fontSize: 34, fontWeight: '800', letterSpacing: -1, paddingHorizontal: 20, marginBottom: 4 },
  gTitle: { color: C.dim, fontSize: 12, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase', paddingHorizontal: 32, marginBottom: 8 },
  group: { marginHorizontal: 16, padding: 14, borderRadius: R.l, backgroundColor: C.tile, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { color: C.fg, fontSize: 16 },
  hint: { color: C.dim, fontSize: 13, marginTop: 2 },
  action: { fontSize: 16, paddingVertical: 4 },
  seg: { flexDirection: 'row', backgroundColor: C.sel, borderRadius: 10, padding: 3 },
  segItem: { flex: 1, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segText: { color: C.fg, fontSize: 15 },
  foot: { color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 28 },
});
