import { C } from './theme';

/**
 * Стеки вкладок без системной шапки: каждая страница рисует свою (TopBar из motion.tsx),
 * поэтому обложка и свечение начинаются от самого верха, без пустой полосы.
 * Свайп от края «назад» остаётся.
 */
export const stackOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: C.bg },
  animation: 'default',
  fullScreenGestureEnabled: true,
} as const;

export const detailOptions = {} as const;

/** Поиску системная шапка нужна ради строки поиска. */
export const searchHeader = {
  headerShown: true,
  headerTransparent: true,
  headerBlurEffect: 'systemChromeMaterialDark',
  headerTintColor: C.fg,
  headerLargeTitle: true,
  headerLargeTitleShadowVisible: false,
  headerShadowVisible: false,
  title: 'Поиск',
} as const;
