const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  mode: 'production',
  entry: {
    original: './src/original/mixpanel.cjs.js',
    trimmed: './src/trimmed/mixpanel-trimmed.cjs.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
    library: {
      name: 'mixpanel',
      type: 'umd',
      export: 'default'
    },
    globalObject: 'this'
  },
  module: {
    rules: [
      {
        test: /\.cjs\.js$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                modules: false,
                targets: {
                  browsers: ['last 2 versions', 'ie >= 11']
                }
              }]
            ],
            plugins: [
              '@babel/plugin-transform-modules-commonjs'
            ]
          }
        }
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                modules: false
              }]
            ]
          }
        }
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.cjs.js', '.json'],
    mainFields: ['main', 'module', 'browser']
  },
  optimization: {
    usedExports: true,
    sideEffects: false,
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          parse: {
            ecma: 8
          },
          compress: {
            ecma: 5,
            warnings: false,
            dead_code: true,
            drop_console: true,
            drop_debugger: true,
            unused: true,
            collapse_vars: true,
            reduce_vars: true,
            inline: true,
            pure_funcs: ['console.log', 'console.info', 'console.debug'],
            passes: 3,
            keep_fargs: false,
            unsafe_math: true,
            unsafe_methods: true,
            unsafe_proto: true,
            unsafe_regexp: true
          },
          mangle: {
            safari10: true,
            properties: false,
            reserved: ['mixpanel', 'init', 'track', 'identify', 'reset', 'people', 'group', 'track_links', 'track_forms']
          },
          format: {
            comments: false
          }
        },
        extractComments: false,
        parallel: true
      })
    ]
  },
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      reportFilename: '../reports/webpack-bundle-report.html',
      openAnalyzer: false,
      generateStatsFile: true,
      statsFilename: '../reports/stats.json',
      statsOptions: {
        source: false,
        reasons: true,
        orphanModules: true,
        usedExports: true,
        providedExports: true
      }
    })
  ],
  stats: {
    usedExports: true,
    providedExports: true,
    optimizationBailout: true,
    orphanModules: true
  },
  devtool: 'source-map'
};

// Export a Vite-compatible analyzer config
module.exports.viteConfig = {
  build: {
    rollupOptions: {
      input: {
        original: path.resolve(__dirname, 'src/original/mixpanel.cjs.js'),
        trimmed: path.resolve(__dirname, 'src/trimmed/mixpanel-trimmed.cjs.js')
      },
      output: {
        format: 'es',
        entryFileNames: '[name]-vite.js'
      },
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        annotations: true,
        preset: 'smallest'
      }
    }
  }
};