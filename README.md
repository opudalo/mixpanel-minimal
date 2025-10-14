# Mixpanel Minimal 🚀

> Reduce your Mixpanel SDK bundle size by up to 80% by removing unused methods

A powerful toolkit for analyzing and trimming the Mixpanel JavaScript SDK to create minimal, optimized builds containing only the methods you actually use.

## The Problem

The Mixpanel JavaScript SDK is comprehensive but large (~10,000 lines). Most projects only use a fraction of its functionality, yet ship the entire library to users. This increases bundle size, load times, and parsing overhead.

## The Solution

Mixpanel Minimal provides automated tools to:
- ✂️ Remove unused methods from the SDK based on your configuration
- 📉 Reduce bundle size by 50-80% in typical applications
- 🔍 Visualize bundle composition with detailed reports
- 🎯 Support for CommonJS (.cjs.js) files used with Vite

## Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/mixpanel-minimal.git
cd mixpanel-minimal

# Install dependencies
npm install

# Place your mixpanel.cjs.js file in src/original/
cp /path/to/your/mixpanel.cjs.js src/original/

# Edit methods-to-keep.json to specify which methods you use
nano methods-to-keep.json

# Trim the Mixpanel file based on your config
npm run trim

# Compare sizes
npm run size
```

## Features

### ✂️ Simple Configuration
Just edit `methods-to-keep.json` to specify which Mixpanel methods you actually use:

```json
{
  "methods": [
    "init",
    "track",
    "identify",
    "reset"
  ],
  "peopleMethods": [
    "set",
    "increment"
  ]
}
```

### 🎯 Automatic Trimming
Removes unused methods while preserving functionality:

```bash
node tools/trim.js --aggressive --keep track_links,track_forms
```

Options:
- Aggressive mode for maximum reduction
- Additional methods via command line
- Preserve comments and source maps
- Handles both main methods and people.* methods

### 📊 Bundle Analysis
Multiple ways to analyze and visualize your bundle:

```bash
# Size comparison report
npm run size

# Detailed code analysis
node tools/analyze.js --verbose

# Webpack bundle analyzer
npm run analyze:bundle
```

### 🛠 VSCode Integration

Open the project in VSCode to get:
- Automatic highlighting of unused code
- ESLint integration for dead code detection
- Code lens showing method references
- Quick actions for code removal

## Configuration

### ESLint Configuration

The project includes comprehensive ESLint rules for detecting:
- Unused variables and functions
- Dead code paths
- Unreachable code
- Side effects in initialization

### Build Configuration

Multiple build targets are configured:
- **UMD**: Universal module for browsers
- **ESM**: ES modules for modern bundlers
- **Minified**: Production-ready builds

## Vite / CommonJS Compatibility

Working with Vite and CommonJS files (.cjs.js)? No problem! The toolkit handles:
- CommonJS to ESM transformation
- Vite-compatible bundle generation
- Source map preservation

## Usage Examples

### Basic Workflow

```bash
# 1. Edit your methods configuration
nano methods-to-keep.json

# 2. Analyze current Mixpanel file
node tools/analyze.js

# 3. Trim based on your configuration
node tools/trim.js

# 4. Compare sizes
npm run size
```

### Advanced Options

```bash
# Aggressive trimming with additional methods
node tools/trim.js \
  --aggressive \
  --keep track_links,track_forms \
  --verbose

# Use a custom methods config file
node tools/trim.js \
  --methods ./my-custom-methods.json \
  --verbose
```

## Size Reduction Examples

Typical reductions achieved:

| Project Type | Original | Trimmed | Reduction |
|-------------|----------|---------|-----------|
| Basic Analytics | 850 KB | 180 KB | 78% |
| E-commerce | 850 KB | 280 KB | 67% |
| Full Features | 850 KB | 420 KB | 51% |

## API Reference

### Trimmer

```javascript
const trimmer = new MixpanelTrimmer({
  inputFile: './src/original/mixpanel.cjs.js',
  outputFile: './src/trimmed/mixpanel-trimmed.cjs.js',
  methodsFile: './methods-to-keep.json',
  aggressive: true,
  verbose: true
});

await trimmer.trim();
```

### Methods Configuration

```json
{
  "methods": ["init", "track", "identify"],
  "peopleMethods": ["set", "increment"]
}
```

## Project Structure

```
mixpanel-minimal/
├── src/
│   ├── original/       # Place your mixpanel.cjs.js here
│   └── trimmed/        # Generated trimmed versions
├── tools/
│   ├── analyze.js      # Code structure analyzer
│   ├── trim.js         # Automatic trimming tool
│   └── size-report.js  # Size comparison
├── methods-to-keep.json # Configuration for methods to keep
├── example.ts          # Example showing method usage
├── reports/            # Generated analysis reports
└── dist/              # Built bundles
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

- [ ] Support for more frameworks (Angular, React Native)
- [ ] Incremental trimming based on usage patterns
- [ ] Cloud-based analysis service
- [ ] Webpack/Rollup plugin
- [ ] TypeScript definitions generation
- [ ] Method dependency graph visualization

## License

MIT - see [LICENSE](LICENSE) file for details

## Acknowledgments

- Built with tools from the JavaScript AST ecosystem
- Inspired by the need for smaller, faster web applications
- Not affiliated with Mixpanel, Inc.

## Support

- 🐛 [Report bugs](https://github.com/yourusername/mixpanel-minimal/issues)
- 💡 [Request features](https://github.com/yourusername/mixpanel-minimal/issues)
- 📖 [Read the docs](https://github.com/yourusername/mixpanel-minimal/wiki)

---

Made with ❤️ for developers who care about bundle size