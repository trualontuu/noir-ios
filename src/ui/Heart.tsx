import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { Animated, Easing, Pressable } from 'react-native';
import * as player from '../player';
import * as ym from '../ym';
import { Icon } from './Icon';
import { C } from './theme';

/** Сердечко с «ударом» при лайке. */
export function Heart({ track, size = 26, color = C.fg }: { track: ym.Track; size?: number; color?: string }) {
  player.usePlayer(); // перерисовка после touch()
  const liked = ym.liked.has(track.id);
  const v = useRef(new Animated.Value(1)).current;
  const press = () => {
    Haptics.impactAsync(liked ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(v, { toValue: liked ? 0.75 : 1.4, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 16 }),
    ]).start();
    player.like(track).catch(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  };
  return (
    <Pressable hitSlop={12} onPress={press}>
      <Animated.View style={{ transform: [{ scale: v }] }}>
        <Icon name={liked ? 'heart.fill' : 'heart'} size={size} color={liked ? C.heart : color} />
      </Animated.View>
    </Pressable>
  );
}

