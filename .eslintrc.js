module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    commonjs: true,
    es6: true
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'script' // CommonJS, not modules
  },
  plugins: [
    'unused-imports'
  ],
  extends: [
    'eslint:recommended'
  ],
  rules: {

    // UNUSED CODE DETECTION - MAXIMUM VISIBILITY
    'no-unused-vars': ['warn', {
      vars: 'all',
      varsIgnorePattern: '^_',
      args: 'all',
      argsIgnorePattern: '^_',
      ignoreRestSiblings: false,
      caughtErrors: 'all',
      caughtErrorsIgnorePattern: '^_'
    }],

    // Unused imports
    'unused-imports/no-unused-imports': 'off', // Turn off for CommonJS
    'unused-imports/no-unused-vars': ['warn', {
      vars: 'all',
      varsIgnorePattern: '^_',
      args: 'all',
      argsIgnorePattern: '^_'
    }],

    // Dead code patterns
    'no-unreachable': 'warn',
    'no-dead-code': 'off',
    'no-unused-expressions': ['warn', {
      allowShortCircuit: false,
      allowTernary: false,
      allowTaggedTemplates: false
    }],
    'no-useless-assignment': 'off',

    // Function-related
    'no-useless-call': 'warn',
    'no-useless-concat': 'warn',
    'no-useless-constructor': 'warn',
    'no-useless-return': 'warn',
    'no-lone-blocks': 'warn',
    'no-empty-function': 'off',

    // Object/Array patterns
    'no-unused-properties': 'off', // This isn't a real rule, but would be nice
    'no-useless-computed-key': 'warn',
    'no-useless-rename': 'warn',

    // CommonJS specific
    'no-unused-modules': 'off', // Not available without plugin

    // Prototype patterns - custom checks
    'no-extend-native': 'warn',
    'no-proto': 'warn',

    // Variable shadowing (helps find duplicate definitions)
    'no-shadow': 'off', // Disabled - too many false positives with CommonJS
    'no-shadow-restricted-names': 'warn',

    // Helps identify code that can be removed
    'no-undef': 'error',
    'no-undef-init': 'warn',
    'no-undefined': 'off',

    // Disable rules that conflict with CommonJS patterns
    'no-global-assign': 'off',
    'no-native-reassign': 'off',
    'strict': 'off',

    // Console and debugger
    'no-console': 'off',
    'no-debugger': 'warn',

    // Complexity warnings (high complexity often means dead code)
    'complexity': ['warn', { max: 20 }],
    'max-depth': ['warn', 4],
    'max-nested-callbacks': ['warn', 3],
    'max-statements': ['warn', 50],
    'max-lines-per-function': ['warn', {
      max: 200,
      skipBlankLines: true,
      skipComments: true
    }]
  },

  // Special overrides for the trimmed file
  overrides: [
    {
      files: ['src/trimmed/*.js', 'src/trimmed/*.cjs.js'],
      rules: {
        // Even stricter for trimmed files
        'no-unused-vars': ['error', {
          vars: 'all',
          args: 'all',
          caughtErrors: 'all'
        }],
        'no-unused-expressions': 'error',
        'complexity': ['error', { max: 15 }]
      }
    },
    {
      files: ['src/original/*.js', 'src/original/*.cjs.js'],
      rules: {
        // More lenient for original file
        'no-unused-vars': ['warn', {
          vars: 'local',
          args: 'none'
        }],
        'complexity': 'off',
        'max-lines-per-function': 'off',
        'max-statements': 'off'
      }
    }
  ],

  // Ignore patterns
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'coverage/',
    '*.min.js',
    'tools/*.js' // Our tools are fine
  ]
};
