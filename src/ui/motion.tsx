// Общая «физика» интерфейса: пружинящие нажатия, появление, шапка, которая проступает при прокрутке.
// Всё на Animated с нативным драйвером — анимации идут в UI-потоке и не дёргаются, когда занят JS.
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { C } from './theme';

const APressable = Animated.createAnimatedComponent(Pressable);

/** Кнопка, которая чуть проседает под пальцем и пружинит обратно. */
export function Tap({ style, scale = 0.94, haptic, onPress, children, ...rest }: Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>; scale?: number; haptic?: 'light' | 'medium' | 'select'; children?: ReactNode;
}) {
  const v = useRef(new Animated.Value(1)).current;
  const to = (x: number) => Animated.spring(v, { toValue: x, useNativeDriver: true, speed: 40, bounciness: x === 1 ? 10 : 0 }).start();
  return (
    <APressable
      {...rest}
      onPressIn={e => { to(scale); rest.onPressIn?.(e); }}
      onPressOut={e => { to(1); rest.onPressOut?.(e); }}
      onPress={e => {
        if (haptic === 'select') Haptics.selectionAsync();
        else if (haptic) Haptics.impactAsync(haptic === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      style={[style, { transform: [{ scale: v }] }]}
    >
      {children}
    </APressable>
  );
}

/** Появление снизу с проявлением; delay — для лесенки из нескольких блоков. */
export function FadeIn({ delay = 0, dy = 14, style, children }: { delay?: number; dy?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Значение, которое пружинит к target при каждой его смене (для масштаба обложки, кнопок и т.п.). */
export function useSpring(target: number, cfg: { speed?: number; bounciness?: number } = {}) {
  const v = useRef(new Animated.Value(target)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: target, useNativeDriver: true, speed: cfg.speed ?? 14, bounciness: cfg.bounciness ?? 8 }).start();
  }, [target]);
  return v;
}

/** Прокрутка для «живой» шапки: передать onScroll в список, scrollY — в TopBar и параллакс. */
export function useScrollY() {
  const y = useRef(new Animated.Value(0)).current;
  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { y } } }], { useNativeDriver: true });
  return { y, onScroll };
}

/**
 * Смахнуть вниз — закрыть полноэкранное окно (плеер, пульт): экран едет за пальцем,
 * отпустил ниже трети или резко — закрывается, иначе пружинит обратно.
 * Горизонтальные жесты (свайп обложки, ползунки) не перехватывает.
 */
export function useDismissPan(height: number) {
  const y = useRef(new Animated.Value(0)).current;
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 10 && g.dy > Math.abs(g.dx) * 1.6,
    onPanResponderMove: (_, g) => y.setValue(Math.max(0, g.dy)),
    onPanResponderRelease: (_, g) => {
      if (g.dy > height / 3 || g.vy > 1.1) {
        Animated.timing(y, { toValue: height, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => router.back());
      } else Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
    },
    onPanResponderTerminate: () => Animated.spring(y, { toValue: 0, useNativeDriver: true }).start(),
  })).current;
  const style = {
    transform: [{ translateY: y }, { scale: y.interpolate({ inputRange: [0, height], outputRange: [1, 0.9], extrapolate: 'clamp' }) }],
    // при протяжке экран чуть уменьшается, как карточка; углы — по форме экрана айфона
    borderRadius: 44,
    overflow: 'hidden' as const,
  };
  return { handlers: pan.panHandlers, style };
}

export const BAR_H = 48;

/**
 * Верхняя панель поверх контента: кнопка «назад» и справа — что передали.
 * Пока страница не прокручена — прозрачная, потом проступает стекло и заголовок.
 */
export function TopBar({ y, title, back = true, right, showAt = 160 }: {
  y: Animated.Value; title?: string; back?: boolean; right?: ReactNode; showAt?: number;
}) {
  const top = useSafeAreaInsets().top;
  const bg = y.interpolate({ inputRange: [showAt - 60, showAt], outputRange: [0, 1], extrapolate: 'clamp' });
  const titleIn = y.interpolate({ inputRange: [showAt - 20, showAt + 30], outputRange: [0, 1], extrapolate: 'clamp' });
  return (
    <View pointerEvents="box-none" style={[s.bar, { paddingTop: top, height: top + BAR_H }]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: bg }]}>
        <BlurView tint="systemChromeMaterialDark" intensity={80} style={StyleSheet.absoluteFill} />
        <View style={s.hair} />
      </Animated.View>
      <View style={s.barRow} pointerEvents="box-none">
        {back ? (
          <Tap onPress={() => router.back()} hitSlop={10} style={s.circle} haptic="light">
            <BlurView tint="dark" intensity={50} style={[StyleSheet.absoluteFill, { borderRadius: 18, overflow: 'hidden' }]} />
            <Icon name="chevron.left" size={17} />
          </Tap>
        ) : <View style={{ width: 36 }} />}
        <Animated.Text numberOfLines={1} style={[s.title, { opacity: titleIn, transform: [{ translateY: titleIn.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }]}>
          {title ?? ''}
        </Animated.Text>
        <View style={{ minWidth: 36, alignItems: 'flex-end' }}>{right}</View>
      </View>
    </View>
  );
}

/** Круглая кнопка на стекле — для правой части TopBar. */
export function GlassButton({ icon, onPress }: { icon: any; onPress: () => void }) {
  return (
    <Tap onPress={onPress} hitSlop={10} style={s.circle} haptic="light">
      <BlurView tint="dark" intensity={50} style={[StyleSheet.absoluteFill, { borderRadius: 18, overflow: 'hidden' }]} />
      <Icon name={icon} size={18} />
    </Tap>
  );
}

/** Крупный заголовок страницы в контенте (вместо системной шапки). */
export function PageTitle({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View style={s.pageHead}>
      <Text style={s.pageTitle}>{children}</Text>
      {right}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  hair: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.08)' },
  barRow: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10 },
  circle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.25)' },
  title: { flex: 1, color: C.fg, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  pageHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 },
  pageTitle: { color: C.fg, fontSize: 34, fontWeight: '800', letterSpacing: -1 },
});
