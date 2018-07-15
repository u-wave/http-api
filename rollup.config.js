import babel from 'rollup-plugin-babel';
import nodeResolve from 'rollup-plugin-node-resolve';
import esModuleInterop from 'rollup-plugin-es-module-interop';
import isBuiltinModule from 'is-builtin-module';

const pkg = require('./package.json');

const external = Object.keys(pkg.dependencies);

process.env.BABEL_ENV = 'rollup';

export default {
  input: 'src/index.js',
  output: [{
    file: pkg.main,
    exports: 'named',
    format: 'cjs',
    sourcemap: true,
  }, {
    file: pkg.module,
    format: 'es',
    sourcemap: true,
  }],
  external: id => isBuiltinModule(id) || external.some(m => id.split('/')[0] === m),
  plugins: [
    esModuleInterop(),
    babel(),
    nodeResolve(),
  ],
};
