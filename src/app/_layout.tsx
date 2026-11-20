import { DarkTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Login } from '../ui/Login';
import { C } from '../ui/theme';
import { UpdateBanner } from '../ui/UpdateBanner';
import { useAutoUpdates } from '../updates';
import { useHardwareVolume } from '../hardwareVolume';
import * as remote from '../remote';
import * as ym from '../ym';

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: C.bg, card: C.bg, text: C.fg, primary: C.fg, border: C.line } };

export default function Root() {
  const [ready, setReady] = useState<'wait' | 'login' | 'in'>('wait');
  useAutoUpdates();
  useHardwareVolume();

  useEffect(() => {
    const out = () => { remote.stopAll(); setReady('login'); };
    ym.onLogout.add(out);
    ym.loadToken().then(async ok => {
      if (!ok) return setReady('login');
      setReady('in');
      remote.start();
      try { await ym.loadAccount(); } catch (e) { if (e instanceof ym.AuthError) await ym.logout(); }
    });
    return () => { ym.onLogout.delete(out); };
  }, []);

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      {ready === 'wait' ? <View style={{ flex: 1, backgroundColor: C.bg }} /> :
        ready === 'login' ? <Login onDone={() => { setReady('in'); remote.start(); }} /> : (
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="player" options={{ presentation: 'transparentModal', animation: 'slide_from_bottom', contentStyle: { backgroundColor: 'transparent' } }} />
            <Stack.Screen name="share" options={{ presentation: 'modal', contentStyle: { backgroundColor: C.bg } }} />
            <Stack.Screen name="remote" options={{ presentation: 'transparentModal', animation: 'slide_from_bottom', contentStyle: { backgroundColor: 'transparent' } }} />
          </Stack>
        )}
      <UpdateBanner />
    </ThemeProvider>
  );
}
