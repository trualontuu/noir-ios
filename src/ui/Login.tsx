import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ym from '../ym';
import { C, R } from './theme';

/** Вход как на телевизоре: код с ya.ru/device, пароль приложение не видит. */
export function Login({ onDone }: { onDone: () => void }) {
  const [dc, setDc] = useState<ym.DeviceCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const cancel = useRef({ cancelled: false });

  useEffect(() => () => { cancel.current.cancelled = true; }, []);

  const start = async () => {
    setBusy(true); setErr('');
    cancel.current.cancelled = true;
    const sig = { cancelled: false };
    cancel.current = sig;
    try {
      const code = await ym.startLogin();
      setDc(code);
      await Clipboard.setStringAsync(code.userCode);
      setBusy(false);
      const ok = await ym.waitLogin(code, sig);
      if (sig.cancelled) return;
      if (ok) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onDone(); }
      else { setDc(null); setErr('Код устарел. Попробуй ещё раз.'); }
    } catch (e: any) { setBusy(false); setErr(e?.message ?? 'Нет связи с Яндексом'); }
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.center}>
        <Text style={s.logo}>noir</Text>
        <Text style={s.lead}>Яндекс Музыка в чёрно-белом</Text>
      </View>

      {dc ? (
        <View style={s.box}>
          <Text style={s.hint}>Открой ya.ru/device и введи код</Text>
          <Text style={s.code} selectable>{dc.userCode}</Text>
          <Text style={s.small}>Код уже скопирован</Text>
          <Pressable style={s.btn} onPress={() => Linking.openURL(dc.url)}>
            <Text style={s.btnText}>Открыть ya.ru/device</Text>
          </Pressable>
          <View style={s.wait}><ActivityIndicator color={C.dim} /><Text style={s.small}>Жду подтверждения…</Text></View>
        </View>
      ) : (
        <View style={s.box}>
          {!!err && <Text style={s.err}>{err}</Text>}
          <Pressable style={s.btn} onPress={start} disabled={busy}>
            {busy ? <ActivityIndicator color={C.onAccent} /> : <Text style={s.btnText}>Войти через Яндекс</Text>}
          </Pressable>
          <Text style={s.small}>Неофициальный клиент. Вход хранится только на этом телефоне.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { color: C.fg, fontSize: 64, fontWeight: '800', letterSpacing: -3 },
  lead: { color: C.dim, fontSize: 16, marginTop: 6 },
  box: { gap: 14, paddingBottom: 28, alignItems: 'center' },
  hint: { color: C.fg, fontSize: 17 },
  code: { color: C.fg, fontSize: 44, fontWeight: '700', letterSpacing: 6, fontVariant: ['tabular-nums'] },
  small: { color: C.dim, fontSize: 13, textAlign: 'center' },
  err: { color: C.danger, fontSize: 14 },
  btn: { alignSelf: 'stretch', height: 54, borderRadius: R.m, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: C.onAccent, fontSize: 17, fontWeight: '600' },
  wait: { flexDirection: 'row', gap: 10, alignItems: 'center' },
});
