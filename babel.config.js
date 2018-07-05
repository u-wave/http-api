module.exports = (api) => {
  api.cache.never();

  return {
    plugins: [
      '@babel/plugin-syntax-object-rest-spread',
      '@babel/plugin-proposal-optional-catch-binding',
      '@babel/plugin-proposal-class-properties',
      '@babel/plugin-transform-flow-comments',
    ],
  };
};
