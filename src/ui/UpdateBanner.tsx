import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { restart, useUpdateState } from '../updates';
import { Icon } from './Icon';
import { useTheme } from './theme';

/** Плашка сверху: «Обновление готово — перезапустить». */
export function UpdateBanner() {
  const u = useUpdateState();
  const th = useTheme();
  const top = useSafeAreaInsets().top;
  if (!u.ready) return null;
  return (
    <Pressable onPress={restart} style={[s.pill, { top: top + 6, backgroundColor: th.accent }]}>
      <Icon name="arrow.triangle.2.circlepath" size={15} color={th.onAccent} />
      <Text style={[s.text, { color: th.onAccent }]}>Обновление готово · Перезапустить</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  pill: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, height: 38, borderRadius: 19, zIndex: 100,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  text: { fontSize: 14.5, fontWeight: '600' },
});
