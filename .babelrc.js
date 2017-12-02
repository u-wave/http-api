module.exports = (api) => {
  api.cache.never();

  return {
    presets: [
      ['@babel/preset-env', {
        targets: {
          node: 6,
        },
      }],
    ],
    plugins: [
      '@babel/plugin-proposal-object-rest-spread',
      '@babel/plugin-proposal-class-properties',
      '@babel/plugin-transform-flow-comments',
    ],
  };
};
