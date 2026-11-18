import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { C } from './theme';

/** Размытая обложка за контентом, как фон страниц в десктопном Noir. Снизу уходит в чёрный. */
export function Glow({ uri, height = 520, strength = 0.55 }: { uri?: string | null; height?: number; strength?: number }) {
  if (!uri) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height, bottom: undefined }]}>
      <Image source={uri} style={[StyleSheet.absoluteFill, { opacity: strength }]} blurRadius={70} contentFit="cover" transition={500} />
      <LinearGradient colors={['rgba(10,10,10,0.15)', 'rgba(10,10,10,0.55)', C.bg]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
    </View>
  );
}
