const baseConfig = require('./app.json');

const SENTRY_ORG = process.env.SENTRY_ORG ?? 'ahommrich';
const SENTRY_PROJECT = process.env.SENTRY_PROJECT ?? 'react-native';

const plugins = baseConfig.expo.plugins.map((plugin) => {
  if (plugin !== '@sentry/react-native/expo') return plugin;

  return [
    '@sentry/react-native/expo',
    {
      organization: SENTRY_ORG,
      project: SENTRY_PROJECT,
    },
  ];
});

module.exports = {
  expo: {
    ...baseConfig.expo,
    plugins,
  },
};
