import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSpring } from './motion';

/**
 * Ползунок 0..1: нажать или тянуть с любого места, во время протяжки полоса толще.
 * onChange — во время протяжки (громкость, не чаще ~12 раз в секунду), onDone — при отпускании (перемотка).
 * Координаты считаем от страницы (pageX), поэтому неважно, на какой внутренний элемент попал палец.
 */
export function Slider({ value, onChange, onDone, color = '#fff', height = 5 }: {
  value: number; onChange?: (v: number) => void; onDone?: (v: number) => void; color?: string; height?: number;
}) {
  const [drag, setDrag] = useState(false);
  const k = useRef(new Animated.Value(value)).current;
  const grow = useSpring(drag ? 1 : 0, { speed: 30, bounciness: 4 });
  const box = useRef({ x: 0, w: 1 });
  const ref = useRef<any>(null);
  const cur = useRef(value);
  const lastSent = useRef(0);
  const cb = useRef({ onChange, onDone });
  cb.current = { onChange, onDone };

  useEffect(() => {
    if (drag) return;
    cur.current = value;
    Animated.timing(k, { toValue: value, duration: 160, useNativeDriver: true }).start();
  }, [value, drag]);

  const at = (pageX: number) => Math.max(0, Math.min(1, (pageX - box.current.x) / box.current.w));
  const move = (pageX: number, force = false) => {
    const v = at(pageX);
    cur.current = v;
    k.setValue(v);
    const now = Date.now();
    if (force || now - lastSent.current > 80) { lastSent.current = now; cb.current.onChange?.(v); }
  };
  const measure = () => ref.current?.measure((_x: number, _y: number, w: number, _h: number, px: number) => { box.current = { x: px, w: Math.max(1, w) }; });

  return (
    <View
      ref={ref}
      style={s.hit}
      onLayout={measure}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={e => {
        const px = e.nativeEvent.pageX;
        measure(); // экран мог сдвинуться (модальное окно) — уточняем координаты
        k.stopAnimation();
        setDrag(true);
        Haptics.selectionAsync();
        move(px, true);
      }}
      onResponderMove={e => move(e.nativeEvent.pageX)}
      onResponderRelease={e => { move(e.nativeEvent.pageX, true); setDrag(false); cb.current.onDone?.(cur.current); }}
      onResponderTerminate={() => setDrag(false)}
    >
      <Animated.View pointerEvents="none" style={[s.bar, { height, borderRadius: height / 2, transform: [{ scaleY: grow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }] }]}>
        <Animated.View style={[s.fill, { backgroundColor: color, transform: [{ scaleX: k }] }]} />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  hit: { paddingVertical: 14, justifyContent: 'center' },
  bar: { backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  fill: { height: '100%', width: '100%', transformOrigin: 'left' },
});
