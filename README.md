# Mixpanel Minimal

> **⚠️ Important Notice**
>
> This is a **quick and dirty implementation** created for a specific use case. It is **not thoroughly tested** to cover all Mixpanel scenarios and edge cases. Consider this an **educational project and starter template** that you should customize for your own needs.
>
> **I do not intend to:**
> - Provide ongoing support for this repository
> - Fix issues or bugs
> - Accept feature requests
> - Maintain compatibility with future Mixpanel versions
>
> **I am using this in production**, but you should thoroughly test it for your specific use case before doing the same. Fork it, modify it, make it your own!

A toolkit for creating minimal Mixpanel implementations through automated trimming or using lightweight Minipanel library.

**Two approaches available:**
1. **Minipanel** - Super minimal implementation (17 KB, 94% smaller)
2. **Trimmer** - Automated tool to trim the official library (74 KB, 75% smaller for our usecase)

---

## 🎯 Motivation & Size Comparison

The official Mixpanel JavaScript library is **293 KB** - far too large for modern web apps that need fast load times. This project offers two solutions:

| Implementation | Size | Reduction | When to Use |
|---------------|------|-----------|-------------|
| **Original mixpanel.js** | 293 KB | - | Need all Mixpanel features |
| **Trimmed (Automated)** | 74 KB | 74.7% | Need specific features, want official code |
| **Minipanel (Recommended)** | **17 KB** | **94.2%** | Need core features only, want clean code |

**Minipanel is 4.4x smaller than the trimmed bundle and 17x smaller than the original!**

### Why Choose Minipanel?

✅ **Tiny** - Just 17 KB (5-6 KB gzipped)
✅ **Miniscule** - Only core Mixpanel features
✅ **Modern** - ES6 modules, no legacy code

### Why Use the Trimmer?

✅ **Flexibility** - Keep only methods you need
✅ **Official code** - Based on Mixpanel's library
✅ **Automated** - 9-pass pipeline handles complexity
✅ **Configurable** - Fine-tune what to keep/remove

---

## 📦 Option 1: Minipanel

### Quick Start

```bash
npm install
npm test  # Verify all tests pass
```

### Usage

```javascript
import { init } from './src/minipanel.js';

// Initialize
const mixpanel = init('YOUR_PROJECT_TOKEN', {
    api_host: 'https://api.mixpanel.com',
    debug: false
});

// Track page views
mixpanel.track('Page View', {
    page: window.location.pathname
});

// Set super properties (included in all events)
mixpanel.register({
    plan: 'premium',
    version: '2.0'
});

// Identify users
mixpanel.identify('user-123');

// People API
mixpanel.people.set({
    $name: 'John Doe',
    $email: 'john@example.com'
});

// Track revenue
mixpanel.people.track_charge(29.99, {
    product: 'Monthly Subscription'
});

// Logout
mixpanel.reset();
```

### API

#### Core Methods

```javascript
const mixpanel = init(token, config);

// Event tracking
mixpanel.track(event_name, properties, callback);
mixpanel.identify(distinct_id);
mixpanel.reset();

// Super properties (included in all events)
mixpanel.register(properties);
mixpanel.register_once(properties);
mixpanel.unregister(property_name);

// Getters
mixpanel.get_distinct_id();
mixpanel.get_property(key);
mixpanel.get_config(key);

// Config
mixpanel.set_config(config);
```

#### People API

```javascript
// User profile updates
mixpanel.people.set(prop, value, callback);
mixpanel.people.set_once(prop, value, callback);
mixpanel.people.unset(prop, callback);
mixpanel.people.increment(prop, by, callback);
mixpanel.people.track_charge(amount, properties, callback);
```

### Technical Details

**Request Handling:**
- POST requests with form-encoded body
- Base64-encoded JSON payload
- Automatic string truncation to 255 chars (Mixpanel's limit)
- Endpoints: `/track/` for events, `/engage/` for people

**Persistence:**
- localStorage only
- Key format: `mon_<token>`
- Stores: distinct_id, $device_id, $user_id, super properties

**Auto-Properties:**
Every event automatically includes:
```javascript
{
  $os: "Mac OS X",
  $browser: "Chrome",
  $browser_version: 120,
  $device: "iPhone",
  $current_url: "https://...",
  $referrer: "https://...",
  $referring_domain: "google.com",
  $screen_height: 1080,
  $screen_width: 1920,
  mp_lib: "minipanel",
  $lib_version: "1.0.0",
  time: 1234567890.123,
  distinct_id: "$device:uuid-here",
  $insert_id: "unique-id",
  token: "your-token"
}
```

**Browser Detection:**
- Browsers: Chrome, Safari, Firefox, Edge, Opera, Mobile Safari, Chrome iOS, Firefox iOS, Android Mobile, Samsung Internet
- OS: Windows, macOS, Linux, Chrome OS, iOS, Android
- Devices: iPhone, iPad, iPod Touch, Android

### Identity Management

**Before identify():**
```javascript
// Auto-generates device ID on init
mixpanel.track('Page View');
// → Sent with distinct_id: "$device:abc-123"
```

**After identify():**
```javascript
mixpanel.identify('user-456');
// → Sends $identify event linking device ID to user ID
// → All future events sent with distinct_id: "user-456"
// → Mixpanel merges all pre-login events into user profile
```

**People API requires identify():**
```javascript
// This will fail with error
mixpanel.people.set({ email: 'user@example.com' });

// Must identify first
mixpanel.identify('user-123');
mixpanel.people.set({ email: 'user@example.com' });  // ✅ Works
```

### What's NOT Included

These features were intentionally removed to keep the bundle small:

- ❌ Batching (can be added if needed)
- ❌ XHR/sendBeacon/img fallbacks (fetch-only)
- ❌ Cookie persistence fallback (localStorage-only)
- ❌ Session recording
- ❌ Heatmaps
- ❌ Surveys
- ❌ A/B testing / feature flags
- ❌ Autocapture
- ❌ Link/form tracking
- ❌ Groups API
- ❌ Alias functionality
- ❌ GDPR opt-out flows
- ❌ People API queuing (must call identify() before People API)

---

## 🛠 Option 2: Automated Trimmer

Use this if you need specific features from the official library or want more control over what's included.

### Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure which methods to keep
node tools/extract-methods.cjs

# 3. Edit trim-config.json - set methods to true (keep) or false (remove)

# 4. Run the trimmer
node tools/trim.cjs

# Output: src/trimmed/mixpanel-trimmed-7.cjs.js (74 KB)
```

### How the Trimmer Works

The trimmer uses an **8-pass pipeline** with recursive dead code elimination:

**Pass 0: Remove Unused _init Code** (Optional - likely specific to original use case)
- Surgical removal of specific initialization code from _init and reset methods
- Removes: batch requests, GDPR, feature flags, autocapture, session recording
- **Note:** This pass is specific to the original use case. Most users should skip or customize this.
- Output: `mixpanel-trimmed-0.cjs.js`

**Pass 1: Remove All Comments**
- Strip all comments early for cleaner subsequent passes
- Output: `mixpanel-trimmed-1.cjs.js`

**Pass 2: Cleanup & Modernization**
- Remove self-assignments (e.g., `_['info'] = _.info`)
- Remove unused assignments (`NPO`, `NpoPromise`, `PromisePrototype`)
- Replace Promise polyfill with native `Promise`
- Modernize underscore utility (use native DOM APIs)
- Output: `mixpanel-trimmed-2.cjs.js`

**Pass 3: Remove Configured Methods**
- Remove methods marked as `false` in `trim-config.json`
- Remove `ClassName.prototype.methodName` assignments
- Output: `mixpanel-trimmed-3.cjs.js`

**Pass 4: Remove Unused Private Methods** (Recursive)
- Find private methods (starting with `_`) with 0 references
- Remove unused internal helpers
- Iterates until fixed-point reached
- Output: `mixpanel-trimmed-4.cjs.js`

**Pass 5: Remove Unused Variables & Write-Only Variables** (Recursive)
- Remove unused top-level variables/functions
- Remove write-only variables (assigned but never read)
- Continues until no more can be removed
- Output: `mixpanel-trimmed-5.cjs.js`

**Pass 6: Remove Unused Constructors** (Recursive)
- Find PascalCase constructors never instantiated with `new`
- Remove standalone functions never called
- Remove orphaned prototype methods
- Recursive iteration for cascading removals
- Output: `mixpanel-trimmed-6.cjs.js`

**Pass 7: Final Cleanup** (Recursive)
- Final pass of unused variable/function removal
- Catches variables that became unused after Pass 6
- Output: `mixpanel-trimmed-7.cjs.js` ✨

### Configuration

Edit `trim-config.json`:

```json
{
  "methods": {
    "MixpanelLib": {
      "track": true,      // Keep
      "identify": true,   // Keep
      "alias": false,     // Remove
      "set_group": false  // Remove
    },
    "MixpanelPeople": {
      "set": true,         // Keep
      "increment": true,   // Keep
      "track_charge": false // Remove
    }
  }
}
```

### Command Line Options

```bash
node tools/trim.cjs [options]

Options:
  -i, --input <file>      Input file (default: ./src/original/mixpanel.cjs.js)
  -o, --output <file>     Output file (default: ./src/trimmed/mixpanel-trimmed.cjs.js)
  -m, --methods <file>    Methods config (default: ./trim-config.json)
  -k, --keep <methods>    Additional methods to keep (comma-separated)
  -v, --verbose           Verbose output
  -d, --dry-run           Preview without modifying files
  -h, --help              Display help
```

**Examples:**

```bash
# Verbose mode (see all decisions)
node tools/trim.cjs --verbose

# Dry run (preview changes)
node tools/trim.cjs --dry-run

# Custom input/output
node tools/trim.cjs -i ./custom.js -o ./output.js

# Keep additional methods
node tools/trim.cjs -k "track,identify,register"
```

### Important Notes

**Pass 0 is Optional:**
- Pass 0 removes specific initialization code that was relevant to the original use case
- **Most users should skip Pass 0** or customize it for their needs
- The trimmer is a **starter template** - tune it to your requirements

**This is a Starting Point:**
- The configuration and passes are designed for the original use case
- You'll likely need to adjust `trim-config.json` and pass logic
- Test thoroughly after trimming
- Iterate and refine based on your needs

### Troubleshooting

**"No valid binding" errors**
- Check `trim-config.json` is valid JSON
- Verify method names match exactly (case-sensitive)

**"Cannot find module" errors**
```bash
npm install @babel/parser @babel/traverse @babel/generator @babel/types
```

**Output larger than expected**
- Check if keeping too many methods in config
- Run with `--verbose` to see what's being kept
- Review which constructors/features are still included

**Variable still appears unused**
- Detection is conservative
- Reserved names are kept: `module`, `exports`, `window`, `document`, etc.
- Check with `--verbose` to see why it's being kept

---

## 📁 Project Structure

```
mixpanel-minimal/
├── src/
│   ├── minipanel.js              # Minipanel implementation (17 KB) ⭐
│   ├── original/
│   │   └── mixpanel.cjs.js       # Original Mixpanel library (293 KB)
│   └── trimmed/
│       └── mixpanel-trimmed-*.cjs.js  # Trimmer outputs
│
├── tests/
│   └── minipanel.test.js         # Minipanel tests (27 passing)
│
├── tools/
│   ├── trim.cjs                  # Trimmer orchestrator
│   ├── extract-methods.cjs       # Generate trim-config.json
│   ├── _.cjs                     # Modern utility implementation
│   └── debug-*.js                # Debug scripts
│
├── trim-config.json              # Trimmer configuration
├── jest.config.js                # Jest configuration (ES6 modules)
├── package.json
└── README.md
```

---

## 🧪 Testing

```bash
# Run Minipanel tests
npm test

# All tests should pass:
# Test Suites: 1 passed
# Tests:       27 passed
```

**Test Coverage:**
- Initialization (3 tests)
- Event tracking (3 tests)
- Identity management (2 tests)
- Super properties (5 tests)
- Property getters (2 tests)
- Configuration (1 test)
- People API (5 tests)
- Data truncation (2 tests)
- Reset functionality (2 tests)
- Distinct ID (2 tests)

---

## 🚀 Production Usage

### For Vite Projects

```javascript
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      'mixpanel-browser': '/path/to/mixpanel-minimal/src/minipanel.js'
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
      'mixpanel-browser': path.resolve(__dirname, 'mixpanel-minimal/src/minipanel.js')
    }
  }
};
```

### Direct Import

```javascript
// ES6 Module
import { init } from './src/minipanel.js';

// CommonJS (if using trimmed version)
const mixpanel = require('./src/trimmed/mixpanel-trimmed-6.cjs.js');
```

---

## 🎓 Technical Details

### AST Manipulation (Trimmer)

Built with Babel's parser and transformer:
- **@babel/parser** - Parse JavaScript into AST
- **@babel/traverse** - Traverse and analyze AST nodes
- **@babel/generator** - Generate JavaScript from modified AST
- **@babel/types** - Create and validate AST nodes

### Unused Code Detection

**NOT a reference:**
```javascript
// Property access
obj.toString();  // "toString" is property, not variable

// Assignment target
schedulingQueue = function() { ... };  // Not a use

// Self-reference in same statement
var setImmediate = win['setImmediate'];  // String doesn't count
```

**IS a reference:**
```javascript
// Function call
myFunc();

// Function argument
callback(myFunc);

// Variable read
var result = myVar;
```

### Scope Binding Analysis

Uses Babel's scope binding to handle shadowed variables:

```javascript
var toString = ObjProto.toString;  // Top-level

function foo() {
  var toString = 'local';  // Shadows top-level
  console.log(toString);   // References local, not top-level
}
```

---

## 📊 Performance

### Trimmer Execution Time
- **Total:** ~5-10 seconds
- **Pass 4 (recursive):** ~1-2 seconds
- **Pass 5 (recursive):** ~2-3 seconds
- **Pass 6 (recursive):** ~1-2 seconds
- **Pass 7 (recursive):** ~1 second

### Size Reduction by Pass (Trimmer)

```
Original:      293 KB (100%)
Pass 0:        ~291 KB (0.8% reduction)    - Remove _init code
Pass 1:        ~290 KB (1.0% reduction)    - Strip comments
Pass 2:        ~275 KB (6.1% reduction)    - Modernization
Pass 3:        ~220 KB (24.9% reduction)   - Remove configured methods
Pass 4:        ~210 KB (28.3% reduction)   - Remove private methods
Pass 5:        ~195 KB (33.4% reduction)   - Remove unused variables
Pass 6:        ~80 KB (72.7% reduction)    - Remove unused constructors
Pass 7:        74 KB (74.8% reduction) ✨  - Final cleanup
```

The biggest reduction comes from Pass 6 (removing unused constructors), which eliminates entire feature modules like batching, feature flags, autocapture, and session recording.

---

## 🤝 Contributing

This is a **starter toolkit** that you should customize for your needs:

1. **Adjust trim-config.json** - Select methods relevant to your use case
2. **Modify Pass 0** - Customize or skip the initial _init cleanup
3. **Add/remove passes** - Tailor the pipeline to your requirements
4. **Test thoroughly** - Verify all functionality you need still works

**Debug tools:**
```bash
# Debug function references
node tools/debug-resolve.js

# Debug variable references
node tools/debug-variables.js

# Verbose trimming log
node tools/trim.cjs --verbose > log.txt

# Preview changes
node tools/trim.cjs --dry-run
```

---

## 📝 License

This toolkit is provided as-is for educational and optimization purposes. The Mixpanel library itself is subject to Mixpanel's original license terms.

---

## 💡 Recommendations

**For most projects: Use Minipanel**
- ✅ 17 KB (94% smaller)
- ✅ All essential features
- ✅ Clean, modern code
- ✅ No build complexity

**Use the Trimmer if you need:**
- Specific features not in Minipanel
- Official Mixpanel code
- Fine-grained control over included methods
- Features like batching, XHR fallbacks, etc.

**Either way, you'll save 200+ KB compared to the original! 🎉**
