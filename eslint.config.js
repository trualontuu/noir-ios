// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'connect/*', 'source/*'],
  },
  {
    rules: {
      // Правила для React Compiler, а он в проекте выключен. Анимации на Animated держат значения
      // в useRef(new Animated.Value()).current — это штатный приём RN, а не ошибка.
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      // Animated-значения и стабильные функции в зависимостях не нужны.
      'react-hooks/exhaustive-deps': 'off',
    },
  },
]);
