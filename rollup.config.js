import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import { visualizer } from 'rollup-plugin-visualizer';

export default [
  // Development build with visualization
  {
    input: 'src/trimmed/mixpanel-trimmed.js',
    output: {
      file: 'dist/mixpanel-minimal.js',
      format: 'umd',
      name: 'mixpanel',
      sourcemap: true
    },
    plugins: [
      nodeResolve(),
      commonjs(),
      visualizer({
        filename: 'reports/bundle-analysis.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
        template: 'treemap' // or 'sunburst', 'network'
      })
    ],
    treeshake: {
      moduleSideEffects: false,
      propertyReadSideEffects: false,
      annotations: true,
      correctVarValueBeforeDeclaration: false,
      unknownGlobalSideEffects: false,
      preset: 'smallest' // Most aggressive tree-shaking
    }
  },

  // Production minified build
  {
    input: 'src/trimmed/mixpanel-trimmed.js',
    output: {
      file: 'dist/mixpanel-minimal.min.js',
      format: 'umd',
      name: 'mixpanel',
      sourcemap: true
    },
    plugins: [
      nodeResolve(),
      commonjs(),
      terser({
        compress: {
          dead_code: true,
          drop_debugger: true,
          drop_console: true,
          unused: true,
          collapse_vars: true,
          reduce_vars: true,
          inline: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug'],
          passes: 3
        },
        mangle: {
          properties: false,
          reserved: ['mixpanel', 'init', 'track', 'identify', 'reset', 'people']
        },
        format: {
          comments: false
        }
      })
    ],
    treeshake: {
      moduleSideEffects: false,
      propertyReadSideEffects: false,
      annotations: true,
      correctVarValueBeforeDeclaration: false,
      unknownGlobalSideEffects: false,
      preset: 'smallest'
    }
  },

  // ESM build for better tree-shaking in modern bundlers
  {
    input: 'src/trimmed/mixpanel-trimmed.js',
    output: {
      file: 'dist/mixpanel-minimal.esm.js',
      format: 'es',
      sourcemap: true
    },
    plugins: [
      nodeResolve(),
      commonjs()
    ],
    treeshake: {
      moduleSideEffects: false,
      propertyReadSideEffects: false,
      annotations: true,
      correctVarValueBeforeDeclaration: false,
      unknownGlobalSideEffects: false,
      preset: 'smallest'
    }
  }
];