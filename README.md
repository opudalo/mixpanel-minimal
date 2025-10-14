# Mixpanel Minimal - Trimming Toolkit

A sophisticated multi-pass toolkit for trimming unused code from the Mixpanel JavaScript library. Reduces file size by **73%+** (from 293 KB to 78 KB) while preserving only the functionality you need.

## Quick Start

```bash
# 1. Configure which methods to keep
node tools/extract-methods.js

# 2. Edit trim-config.json to mark methods as true (keep) or false (remove)

# 3. Run the trimming process
node tools/trim.js

# Output will be in src/trimmed/mixpanel-trimmed-6.cjs.js
```

## Results

- **Original size:** 293.46 KB
- **Trimmed size:** 78.01 KB
- **Reduction:** 73.42% (215.45 KB saved)

## How It Works

The trimmer uses a **9-pass pipeline** with recursive dead code elimination to progressively remove unused functionality:

### Pass 0: Remove Unused _init Code
**Purpose:** Surgical removal of specific unused initialization code (explicit, upfront modifications)

Removes 5 code blocks from `MixpanelLib.prototype._init`:
1. `this._batch_requests` assignment
2. `if (this._batch_requests) { ... }` block (batch request initialization)
3. `this._gdpr_init()` call
4. Feature flags and autocapture block (`this.flags = new FeatureFlagManager(...)` through `this.autocapture.init()`)
5. `this._check_and_start_session_recording()` call

**Removed:** 9 statements (58 lines)

**Output:** `mixpanel-trimmed-0.cjs.js`

---

### Pass 0.5: Initial Cleanup and Modernization
**Purpose:** Remove redundant code and modernize legacy patterns

- **Remove self-assignments:** Eliminates patterns like `_['info'] = _.info` and `_['JSONEncode'] = _.JSONEncode`
- **Remove unused assignments:** Removes hardcoded unused variables (NPO, NpoPromise, PromisePrototype)
- **Replace Promise polyfill:** Converts legacy promise implementation to `var PromisePolyfill = Promise`
- **Modernize underscore utility:** Replaces 190+ lines of IE5 workarounds with modern 42-method implementation using native APIs

**Key improvements:**
- Replaces complex Promise polyfill (~300 lines) with native Promise
- Modernizes DOM methods: `querySelectorAll` replaces 190 lines of IE5 workarounds
- Modernizes event registration: `addEventListener` replaces 67 lines of legacy code

**Output:** `mixpanel-trimmed-0.5.cjs.js`

---

### Pass 1: Remove Configured Methods
**Purpose:** Remove methods explicitly marked for removal in configuration

- Reads `trim-config.json` to identify methods to remove
- Removes `ClassName.prototype.methodName` assignments
- Removes object methods from public API objects (MixpanelPeople, etc.)
- Tracks removed methods for reporting

**Configuration format:**
```json
{
  "methods": {
    "MixpanelLib": {
      "track": true,      // Keep this method
      "alias": false,     // Remove this method
      "set_group": false  // Remove this method
    }
  }
}
```

**Output:** `mixpanel-trimmed-1.cjs.js`

---

### Pass 2: Remove Comments Before Removed Methods
**Purpose:** Clean up orphaned comments left after method removal

- Re-parses Pass 0.5 output (includes _init cleanup)
- Identifies and removes leading comments attached to removed methods
- Ensures clean output without orphaned documentation

**Output:** `mixpanel-trimmed-2.cjs.js`

---

### Pass 3: Remove Unused Private Methods
**Purpose:** Eliminate private methods (starting with `_`) that are never called

**Process:**
1. Find all private method declarations (`ClassName.prototype._methodName`)
2. Count references to each private method:
   - `this._methodName()` calls
   - `someVar._methodName()` calls
   - String literal references (bracket notation)
3. Remove methods with 0 references

**Example:** If `_gdpr_init()` was removed in Pass 0.5, this pass cleans up its internal helper methods.

**Output:** `mixpanel-trimmed-3.cjs.js`

---

### Pass 4: Recursive Unused Variable/Function Removal
**Purpose:** Iteratively remove unused top-level variables and functions until no more can be removed

**Detection Strategy:**
- Finds all top-level declarations (functions, variables)
- Counts references to each declaration:
  - **Excludes:** Property names in `obj.property` (not a variable reference)
  - **Excludes:** Left-hand side of assignments `var = value` (not a use)
  - **Excludes:** String literals in same statement `win['varName']` (self-reference)
  - **Includes:** Function calls, variable reads, function references as arguments
- Uses Babel's scope binding to distinguish shadowed variables from actual references

**Recursive Fixed-Point Iteration:**
```
Iteration 1: Removed 72 declarations
Iteration 2: Removed 19 declarations  // Variables that depended on Iter 1 removals
Iteration 3: Removed 10 declarations  // Variables that depended on Iter 2 removals
Iteration 4: Removed 8 declarations
Iteration 5: Removed 3 declarations
Iteration 6: Removed 0 declarations   // Fixed point reached
```

**Why recursive?**
- Removing one variable may make others unused (cascading effect)
- Continues until no more variables can be removed
- Safety limit of 10 iterations prevents infinite loops

**Output:** `mixpanel-trimmed-4.cjs.js`

---

### Pass 5: Strip All Comments
**Purpose:** Remove all remaining comments for final size optimization

- Removes all comment types (single-line `//`, multi-line `/* */`, JSDoc `/** */`)
- Prepares clean code for final optimization passes
- No functional changes, only formatting cleanup

**Output:** `mixpanel-trimmed-5.cjs.js`

---

### Pass 5.5: Remove Unused Constructors (Recursive)
**Purpose:** Programmatically find and remove unused constructor functions and standalone functions

**Detection Process:**

1. **Find PascalCase constructors** (e.g., `RequestBatcher`, `FeatureFlagManager`)
   - Function declarations: `function RequestBatcher() { ... }`
   - Variable assignments: `var RequestBatcher = function() { ... }`

2. **Check for instantiation**
   - Searches for `new ConstructorName()` usage
   - Marks constructors never instantiated as unused

3. **Find camelCase standalone functions** (e.g., `resolve`, `notify`, `optIn`)
   - Only top-level functions
   - Excludes private functions (starting with `_`)

4. **Check for function calls/references**
   - **Excludes:** Property names in `obj.resolve()` (not a function reference)
   - **Excludes:** Recursive calls within function's own body
   - Uses Babel's scope binding to verify actual references
   - Checks if function is:
     - Called directly: `functionName()`
     - Passed as argument: `callback(functionName)`
     - Referenced: `var ref = functionName`

5. **Remove unused items and orphaned code**
   - Remove constructor declarations
   - Remove `Constructor.prototype.method = ...` assignments
   - Remove `safewrapClass(Constructor)` calls
   - Remove `_.inherit(Child, Parent)` calls
   - Remove `_.extend(Constructor.prototype, ...)` calls

**Recursive Iteration Example:**
```
Iteration 1: Removed 54 items
  - Autocapture, FeatureFlagManager, DomTracker, LinkTracker, FormTracker
  - RequestBatcher, MixpanelGroup
  - resolve, reject, optIn, optOut, notify, notifyIsolated, schedule, isThenable
  - 38 orphaned prototype methods

Iteration 2: Removed 10 items
  - RequestQueue (only used by RequestBatcher, removed in Iter 1)
  - 9 orphaned prototype methods

Iteration 3: Removed 8 items
  - SharedLock, LocalStorageWrapper (only used by RequestQueue)
  - 6 orphaned prototype methods

Iteration 4: Removed 0 items  // Fixed point reached
```

**Key Insight:** Functions like `resolve` had references like `chain.resolve(ret)` which look like function calls but are actually method calls on the `chain` object. The detection correctly identifies these as property accesses, not function references.

**Output:** `mixpanel-trimmed-5.5.cjs.js`

---

### Pass 6: Final Cleanup (Recursive)
**Purpose:** Run unused variable/function removal again to catch cascading removals after Pass 5.5

After Pass 5.5 removes constructors, many helper variables become unused:
- Variables only referenced by removed constructors
- Configuration objects for removed features
- Utility functions only used by removed code

**Recursive Iteration:**
```
Iteration 1: Removed 16 declarations
Iteration 2: Removed 3 declarations
Iteration 3: Removed 1 declarations
Iteration 4: Removed 0 declarations  // Fixed point reached
```

**Examples of removed variables:**
- `schedulingQueue` - only used by removed promise polyfill
- `cycle` - only used by promise scheduling
- `setImmediate` - only used by `timer` variable
- `toString` - unused local reference to `Object.prototype.toString`
- `hasOwnProperty` - unused local reference to `Object.prototype.hasOwnProperty`

**Output:** `mixpanel-trimmed-6.cjs.js` (final output)

---

## Configuration

### trim-config.json

Controls which methods to keep or remove:

```json
{
  "methods": {
    "MixpanelLib": {
      // Keep these core methods
      "track": true,
      "identify": true,
      "register": true,
      "init": true,

      // Remove these unused methods
      "alias": false,
      "set_group": false,
      "add_group": false,
      "get_group": false,
      "remove_group": false,
      "track_with_groups": false,
      "track_pageview": false
    },
    "MixpanelPeople": {
      "set": true,
      "set_once": true,
      "increment": true,
      "append": true,

      // Remove unused methods
      "union": false,
      "track_charge": false,
      "clear_charges": false,
      "delete_user": false
    }
  }
}
```

**Method selection strategies:**

1. **Commented out = Remove:** Methods not listed in config are automatically removed
2. **Explicit false = Remove:** Methods marked `false` are removed
3. **Explicit true = Keep:** Methods marked `true` are preserved

### Generating Configuration

```bash
# Extract all available methods from the library
node tools/extract-methods.js

# This creates trim-config.json with all methods set to true
# Edit the file to mark unused methods as false
```

---

## Detection Algorithms

### Unused Variable Detection

The trimmer uses sophisticated AST analysis to distinguish real variable references from false positives:

#### ❌ NOT a Reference

```javascript
// Property access (not a variable reference)
var toString = Object.prototype.toString;
obj.toString();  // ← "toString" is a property name, not the variable

// Left-hand side of assignment (not a use)
var schedulingQueue;
schedulingQueue = function() { ... };  // ← Target of assignment, not a use

// String literal in same statement (self-reference)
var setImmediate = win['setImmediate'];  // ← 'setImmediate' string doesn't count
```

#### ✅ IS a Reference

```javascript
// Function call
var myFunc = function() { ... };
myFunc();  // ← Real use

// Function reference as argument
callback(myFunc);  // ← Real use

// Variable read
var result = myVar;  // ← Real use

// But NOT inside its own body (recursive calls don't count as external uses)
function resolve(msg) {
  function inner() {
    resolve.apply(this, args);  // ← Internal recursion, doesn't count
  }
}
```

### Scope Binding Analysis

Uses Babel's scope binding system to handle shadowed variables:

```javascript
var toString = ObjProto.toString;  // ← Top-level declaration

function foo() {
  var toString = 'local';  // ← Shadows top-level
  console.log(toString);   // ← References local, not top-level
}

// Only counts references that bind to the top-level declaration
```

---

## Command Line Options

```bash
node tools/trim.js [options]

Options:
  -i, --input <file>      Input Mixpanel file (default: ./src/original/mixpanel.cjs.js)
  -o, --output <file>     Output trimmed file (default: ./src/trimmed/mixpanel-trimmed.cjs.js)
  -m, --methods <file>    Methods config file (default: ./methods-to-keep.json)
  -k, --keep <methods>    Additional methods to keep (comma-separated)
  -v, --verbose           Verbose output (shows all decisions)
  -d, --dry-run           Preview what would be removed without modifying files
  -h, --help              Display help information
```

### Examples

```bash
# Verbose mode (see all removal decisions)
node tools/trim.js --verbose

# Dry run (preview changes without modifying files)
node tools/trim.js --dry-run

# Custom input/output files
node tools/trim.js -i ./custom-input.js -o ./custom-output.js

# Keep additional methods via CLI
node tools/trim.js -k "track,identify,register"
```

---

## File Structure

```
mixpanel-minimal/
├── tools/
│   ├── trim.js              # Main trimming orchestrator (multi-pass pipeline)
│   ├── extract-methods.js   # Generates trim-config.json from original library
│   ├── _.js                 # Modern underscore utility implementation
│   ├── debug-resolve.js     # Debug script for analyzing function references
│   └── debug-variables.js   # Debug script for analyzing variable references
│
├── src/
│   ├── original/
│   │   ├── mixpanel.cjs.js           # Original Mixpanel library (293 KB)
│   │   └── mixpanel-prettified.cjs.js # Formatted original for comparison
│   │
│   └── trimmed/
│       ├── mixpanel-trimmed-0.cjs.js     # Pass 0: Remove _init code
│       ├── mixpanel-trimmed-0.5.cjs.js   # Pass 0.5: Cleanup + modernization
│       ├── mixpanel-trimmed-1.cjs.js     # Pass 1: Remove configured methods
│       ├── mixpanel-trimmed-2.cjs.js     # Pass 2: Remove comments
│       ├── mixpanel-trimmed-3.cjs.js     # Pass 3: Remove private methods
│       ├── mixpanel-trimmed-4.cjs.js     # Pass 4: Recursive cleanup
│       ├── mixpanel-trimmed-5.cjs.js     # Pass 5: Strip all comments
│       ├── mixpanel-trimmed-5.5.cjs.js   # Pass 5.5: Remove constructors
│       └── mixpanel-trimmed-6.cjs.js     # Pass 6: Final cleanup (78 KB) ✨
│
├── trim-config.json         # Configuration: which methods to keep/remove
├── README.md               # This file
└── package.json
```

---

## Technical Details

### AST Manipulation

Built with Babel's parser and transformer:
- **@babel/parser:** Parses JavaScript into AST (Abstract Syntax Tree)
- **@babel/traverse:** Traverses and analyzes AST nodes
- **@babel/generator:** Generates JavaScript code from modified AST
- **@babel/types:** Creates and validates AST nodes

### Recursive Fixed-Point Algorithm

Many passes use recursive iteration:
1. Apply transformation
2. Count removals
3. If removals > 0, repeat from step 1
4. If removals = 0, fixed point reached (stop)
5. Safety limit: max 10 iterations

This ensures complete removal of cascading dependencies.

### Scope Binding Analysis

Uses Babel's `path.scope.getBinding()` to:
- Distinguish between variable declarations and references
- Handle shadowed variables correctly
- Identify variable scope boundaries
- Track variable usage across nested functions

---

## Performance

### Execution Time
- **Total trimming time:** ~5-10 seconds
- **Pass 4 (recursive):** ~2-3 seconds (6 iterations)
- **Pass 5.5 (recursive):** ~1-2 seconds (4 iterations)
- **Pass 6 (recursive):** ~1 second (4 iterations)

### Size Reduction by Pass

```
Original:      293.46 KB (100%)
Pass 0:        ~291 KB   (0.8% reduction)   - Remove _init code (explicit surgical removal)
Pass 0.5:      ~278 KB   (5.3% reduction)   - Modernization (cleanup + modernize)
Pass 1:        ~220 KB   (25.0% reduction)  - Remove configured methods
Pass 2:        ~215 KB   (26.7% reduction)  - Remove comments
Pass 3:        ~210 KB   (28.4% reduction)  - Remove private methods
Pass 4:        ~195 KB   (33.5% reduction)  - Recursive cleanup (6 iterations)
Pass 5:        ~190 KB   (35.2% reduction)  - Strip comments
Pass 5.5:      ~80 KB    (72.7% reduction)  - Remove constructors (4 iterations)
Pass 6:        78.01 KB  (73.4% reduction)  - Final cleanup (4 iterations)
```

The biggest size reduction comes from Pass 5.5 (removing unused constructors) which eliminates entire feature modules like feature flags, autocapture, session recording, and batch request handling.

---

## Troubleshooting

### "No valid binding" errors
- Ensure your `trim-config.json` is valid JSON
- Check that method names match exactly (case-sensitive)

### "Cannot find module" errors
```bash
npm install @babel/parser @babel/traverse @babel/generator @babel/types
```

### Output file is larger than expected
- Check if you're keeping too many methods in `trim-config.json`
- Run with `--verbose` to see what's being kept and why

### Variable still appears as unused
The detection is conservative. Variables are kept if:
- They're in the reserved names list (`module`, `exports`, `window`, `document`, `console`, `MixpanelLib`, `Mixpanel`, `mixpanel`, `init_type`)
- They're PascalCase constructors with any references
- The detector found any ambiguous references (false positive prevention)

---

## Contributing

Found a bug or want to improve the trimmer? Here's how:

1. **Debug a specific detection issue:**
   ```bash
   # For function reference analysis
   node tools/debug-resolve.js

   # For variable reference analysis
   node tools/debug-variables.js
   ```

2. **Run in verbose mode:**
   ```bash
   node tools/trim.js --verbose > trimming-log.txt
   ```

3. **Test with dry-run first:**
   ```bash
   node tools/trim.js --dry-run
   ```

---

## License

This trimming toolkit is provided as-is for educational and optimization purposes. The Mixpanel library itself is subject to Mixpanel's original license terms.

---

## Credits

Built with:
- [Babel](https://babeljs.io/) - JavaScript parser and transformer
- [Prettier](https://prettier.io/) - Code formatter
- [Chalk](https://github.com/chalk/chalk) - Terminal styling
- [Commander](https://github.com/tj/commander.js) - CLI framework
