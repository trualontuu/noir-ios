// Кнопки громкости айфона управляют громкостью компьютера (как Spotify Connect).
// Работает, пока на телефоне ничего не играет, компьютер в сети и приложение на экране.
// Приём: системную громкость держим на середине; каждое нажатие сдвигает её на шаг —
// этот сдвиг переносим на компьютер и возвращаем ползунок телефона на середину.
// При выходе из режима громкость телефона возвращается к прежней.
import { useEffect } from 'react';
import { AppState, NativeModules } from 'react-native';
import type { VolumeManager as VM } from 'react-native-volume-manager';
import * as player from './player';
import * as remote from './remote';

const MID = 0.5;

// Нативный модуль есть только в сборках с 0.4.0: в старой сборке (обновление по воздуху) просто ничего не делаем.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- грузим только если модуль есть в сборке
const VolumeManager: typeof VM | null = NativeModules.VolumeManager ? require('react-native-volume-manager').VolumeManager : null;

export function useHardwareVolume() {
  const hostOnline = remote.useRemote().host != null;
  const localPlaying = player.usePlayerSel(s => s.index >= 0 && s.playing);
  const on = hostOnline && !localPlaying && VolumeManager != null;

  useEffect(() => {
    if (!on || !VolumeManager) return;
    let saved: number | null = null;
    let sub: { remove(): void } | null = null;
    let alive = true;
    let target = remote.getRemote().host?.state?.volume ?? 0.5;

    const start = async () => {
      if (AppState.currentState !== 'active') return;
      try {
        await VolumeManager.setActive(true);
        saved = (await VolumeManager.getVolume()).volume;
        if (!alive) return;
        VolumeManager.showNativeVolumeUI({ enabled: false });
        await VolumeManager.setVolume(MID, { showUI: false });
        sub = VolumeManager.addVolumeListener(({ volume }) => {
          const d = volume - MID;
          if (Math.abs(d) < 0.01) return; // это мы сами вернули на середину
          const cur = remote.getRemote().host?.state?.volume ?? target;
          target = Math.max(0, Math.min(1, cur + d));
          remote.setVolume(target);
          VolumeManager.setVolume(MID, { showUI: false });
        });
      } catch {}
    };
    const stop = () => {
      sub?.remove(); sub = null;
      VolumeManager.showNativeVolumeUI({ enabled: true });
      if (saved != null) { VolumeManager.setVolume(saved, { showUI: false }); saved = null; }
    };

    start();
    const app = AppState.addEventListener('change', s => { if (s === 'active') { if (!sub) start(); } else stop(); });
    return () => { alive = false; app.remove(); stop(); };
  }, [on]);
}
