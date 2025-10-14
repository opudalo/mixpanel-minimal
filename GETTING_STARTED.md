# Getting Started with Mixpanel Minimal

## Step 1: Setup

1. **Place your Mixpanel file**
   ```bash
   # Copy your mixpanel.cjs.js file to the project
   cp /path/to/your/mixpanel.cjs.js src/original/
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

## Step 2: Configure Your Methods

Edit `methods-to-keep.json` to specify which Mixpanel methods you actually use:

```json
{
  "methods": [
    "init",
    "track",
    "identify",
    "reset",
    "register"
  ],
  "peopleMethods": [
    "set",
    "increment"
  ]
}
```

Look at `example.ts` for a reference of common Mixpanel methods and their usage.

## Step 3: Trim the File

Based on your configuration, trim the Mixpanel file:

```bash
# Basic trimming (keeps essential methods)
node tools/trim.js

# Aggressive trimming (removes more code)
node tools/trim.js --aggressive

# Keep specific additional methods
node tools/trim.js --keep track_links,track_forms,set_config
```

This creates `src/trimmed/mixpanel-trimmed.cjs.js`

## Step 4: Verify with ESLint

Open the trimmed file in VSCode or run ESLint to identify any remaining unused code:

```bash
# Check for unused code
npm run lint

# Focus on unused variables
npm run lint:unused
```

## Step 5: Build & Compare

Build optimized versions and compare sizes:

```bash
# Build all formats
npm run build

# Generate size comparison report
npm run size
```

## Step 6: Use in Your Project

### For Vite Projects

```javascript
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      'mixpanel-browser': '/path/to/mixpanel-minimal/dist/mixpanel-minimal.esm.js'
    }
  }
});
```

### For Webpack Projects

```javascript
// webpack.config.js
module.exports = {
  resolve: {
    alias: {
      'mixpanel-browser': path.resolve(__dirname, 'mixpanel-minimal/dist/mixpanel-minimal.min.js')
    }
  }
};
```

### Direct Import

```javascript
// Use the trimmed version directly
import mixpanel from './mixpanel-minimal/dist/mixpanel-minimal.esm.js';

// Or for CommonJS
const mixpanel = require('./mixpanel-minimal/dist/mixpanel-minimal.min.js');
```

## Tips for Maximum Size Reduction

1. **Be Specific with Methods**: Only keep methods you actually use
2. **Use Aggressive Mode**: If you're confident about your usage patterns
3. **Check Dependencies**: Some methods depend on others - the tool handles this automatically
4. **Test Thoroughly**: After trimming, test all Mixpanel functionality in your app
5. **Iterate**: You can always add methods back if needed

## Common Method Groups

### Basic Analytics
```bash
node tools/trim.js --keep init,track,identify,reset
```

### E-commerce
```bash
node tools/trim.js --keep init,track,identify,people,track_charge,register
```

### Advanced Features
```bash
node tools/trim.js --keep init,track,identify,people,group,track_links,track_forms,set_config
```

## Troubleshooting

### "Method not found" errors after trimming
- Add the method to `methods-to-keep.json`
- Or use the `--keep` flag when trimming: `node tools/trim.js --keep method_name`

### File size not reducing much
- Try `--aggressive` mode for more aggressive removal
- Review your `methods-to-keep.json` - you might be keeping too many methods
- Check the ESLint output for unused code within the trimmed file

### Build errors
- Ensure you have all dependencies installed: `npm install`
- Check that the original mixpanel.cjs.js file is valid JavaScript
- Try with `--no-sourcemap` if source map generation fails

## Next Steps

- Set up CI/CD to automatically trim on builds
- Create a custom configuration file for your project
- Contribute improvements back to the project!