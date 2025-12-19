module.exports = {
  presets: ['module:@react-native/babel-preset', 'nativewind/babel'],
  plugins: [
    [
      'module-resolver',
      {
        alias: {
          '@assets': './src/assets',
          '@components': './src/components',
          '@features': './src/features',
          '@localization': './src/localization',
          '@navigation': './src/navigation',
          '@services': './src/services',
          '@theme': './src/theme',
          '@utils': './src/utils',
          '@src': './src',
        },
      },
    ],
    'react-native-worklets/plugin',
  ],
};
