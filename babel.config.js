module.exports = (api) => {
  api.cache.never();

  return {
    plugins: [
      '@babel/plugin-syntax-object-rest-spread',
      // TODO actually use this once eslint is updated to v5
      '@babel/plugin-proposal-optional-catch-binding',
      '@babel/plugin-proposal-class-properties',
      '@babel/plugin-transform-flow-comments',
    ],
  };
};
