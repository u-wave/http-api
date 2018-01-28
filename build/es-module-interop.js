const interopDefault = `
  function _interopDefault(ex) {
    return ex && ex.__esModule ? ex.default : ex;
  }
`.trim().replace(/\s+/g, ' ');

// Fix for importing non-transpiled CommonJS modules that have a
// `.default` export.
export default () => ({
  name: 'es-module-interop',
  transformBundle(code, options) {
    if (options.format !== 'cjs') {
      return null;
    }
    return {
      code: code.replace(
        /\nfunction _interopDefault (.*?)\n/,
        () => `\n${interopDefault.replace(/\n */g, ' ')}\n`
      ),
      map: null,
    };
  },
});
