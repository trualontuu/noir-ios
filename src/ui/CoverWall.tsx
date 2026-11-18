import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { C } from './theme';

/**
 * Стена обложек для пустой «Волны»: три ряда обложек медленно плывут в разные стороны,
 * сверху мягкое затемнение. Ряд — два одинаковых отрезка подряд, поэтому цикл бесшовный.
 */
export function CoverWall({ size, covers, radius = 24 }: { size: number; covers: string[]; radius?: number }) {
  const tile = Math.round(size / 2.6);
  const gap = 8;
  if (!covers.length) return <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: C.tile }} />;
  // каждому ряду — свой сдвиг по списку, чтобы ряды не повторяли друг друга
  const row = (i: number) => {
    const n = Math.max(4, Math.ceil(size / (tile + gap)) + 1);
    return Array.from({ length: n }, (_, k) => covers[(k * 3 + i * 5) % covers.length]);
  };
  return (
    <View style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', backgroundColor: C.tile }}>
      <View style={{ transform: [{ rotate: '-8deg' }, { scale: 1.25 }], marginTop: -tile * 0.25, gap }}>
        {[0, 1, 2].map(i => <Row key={i} items={row(i)} tile={tile} gap={gap} dir={i % 2 ? 1 : -1} speed={38000 + i * 9000} />)}
      </View>
      <LinearGradient colors={['rgba(10,10,10,0.15)', 'rgba(10,10,10,0.35)', 'rgba(10,10,10,0.75)']} style={StyleSheet.absoluteFill} />
    </View>
  );
}

function Row({ items, tile, gap, dir, speed }: { items: string[]; tile: number; gap: number; dir: 1 | -1; speed: number }) {
  const x = useRef(new Animated.Value(0)).current;
  const len = items.length * (tile + gap);
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(x, { toValue: 1, duration: speed, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [speed]);
  const tx = x.interpolate({ inputRange: [0, 1], outputRange: dir < 0 ? [0, -len] : [-len, 0] });
  return (
    <Animated.View style={{ flexDirection: 'row', gap, transform: [{ translateX: tx }] }}>
      {[...items, ...items].map((u, k) => (
        <Image key={k} source={u} style={{ width: tile, height: tile, borderRadius: 12, backgroundColor: C.sel }} cachePolicy="memory-disk" transition={300} />
      ))}
    </Animated.View>
  );
}
