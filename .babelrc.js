module.exports = (api) => {
  api.cache.never();

  return {
    presets: [
      ['env', {
        targets: {
          node: 6,
        },
      }],
    ],
    plugins: [
      'transform-object-rest-spread',
      'transform-class-properties',
      'transform-export-extensions',
      'transform-flow-comments',
    ],
  };
};
