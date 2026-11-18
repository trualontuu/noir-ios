import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ColorValue } from 'react-native';
import { C } from './theme';

/** SF Symbol — системные иконки iOS. */
export function Icon({ name, size = 22, color = C.fg, weight = 'regular' }: {
  name: SFSymbol; size?: number; color?: ColorValue; weight?: 'regular' | 'medium' | 'semibold' | 'bold';
}) {
  return <SymbolView name={name} size={size} tintColor={color} weight={weight} type="monochrome" style={{ width: size, height: size }} />;
}
