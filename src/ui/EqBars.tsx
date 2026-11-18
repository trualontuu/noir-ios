import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

/** Пляшущие полоски у играющего трека (EqBars в десктопе). На паузе стоят. */
export function EqBars({ playing, color, size = 16 }: { playing: boolean; color: string; size?: number }) {
  const bars = useRef([0, 1, 2, 3].map(() => new Animated.Value(0.35))).current;
  useEffect(() => {
    if (!playing) { bars.forEach(b => { b.stopAnimation(); Animated.timing(b, { toValue: 0.3, duration: 200, useNativeDriver: true }).start(); }); return; }
    const loops = bars.map((b, i) => Animated.loop(Animated.sequence([
      Animated.timing(b, { toValue: 1, duration: 280 + i * 90, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(b, { toValue: 0.25 + (i % 2) * 0.15, duration: 260 + i * 70, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ])));
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [playing]);
  const w = Math.max(2, Math.round(size / 6));
  return (
    <View style={[s.row, { height: size, width: size + 2, gap: w / 1.5 }]}>
      {bars.map((b, i) => (
        <Animated.View key={i} style={{ width: w, height: size, borderRadius: w / 2, backgroundColor: color, transform: [{ translateY: size / 2 }, { scaleY: b }, { translateY: -size / 2 }] }} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' } });
