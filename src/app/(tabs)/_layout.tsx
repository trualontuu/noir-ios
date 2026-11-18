import { NativeTabs } from 'expo-router/native-tabs';
import { MiniPlayer } from '../../ui/MiniPlayer';
import { C, useTheme } from '../../ui/theme';

export default function Tabs() {
  const th = useTheme();
  return (
    <NativeTabs tintColor={th.accent} iconColor={C.dim} labelStyle={{ color: C.dim }} minimizeBehavior="onScrollDown">
      <NativeTabs.BottomAccessory>
        <MiniPlayer />
      </NativeTabs.BottomAccessory>
      <NativeTabs.Trigger name="index" contentStyle={{ backgroundColor: C.bg }}>
        <NativeTabs.Trigger.Icon sf="dot.radiowaves.left.and.right" md="radio" />
        <NativeTabs.Trigger.Label>Волна</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="library" contentStyle={{ backgroundColor: C.bg }}>
        <NativeTabs.Trigger.Icon sf={{ default: 'heart', selected: 'heart.fill' }} md="favorite" />
        <NativeTabs.Trigger.Label>Моё</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="search" role="search" contentStyle={{ backgroundColor: C.bg }}>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
        <NativeTabs.Trigger.Label>Поиск</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
