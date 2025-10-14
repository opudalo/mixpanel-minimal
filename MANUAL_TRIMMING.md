# Manual Trimming Guide

## 🎯 VSCode is Now Configured For Manual Dead Code Detection

### What's Changed

1. **TypeScript Disabled** - No more TypeScript errors on .cjs.js files
2. **JavaScript Linting Enhanced** - Focus on unused variables and functions
3. **Visual Indicators** - Dead code is now more visible with:
   - Gray/faded text for unused variables
   - Red borders on unnecessary code
   - Orange warnings in the gutter
   - Reference counts above each function

### How to Use

## 1. Open Your Trimmed File

```bash
# First run the automatic trim
npm run trim

# Open in VSCode
code src/trimmed/mixpanel-trimmed.cjs.js
```

## 2. Look for Visual Cues

In VSCode, you'll see:

- **Grayed out text** = Unused variables or functions
- **0 references** above functions = Not called anywhere
- **Yellow underlines** = ESLint warnings for dead code
- **Strikethrough text** = Deprecated code

## 3. Use the Dead Code Finder

```bash
# Find potentially dead code
npm run find-dead

# Get detailed analysis
npm run find-dead:verbose

# See exactly where things are used
node tools/find-dead-code.js --context
```

This will show you:
- Functions with 0 references
- Variables that are defined but never used
- Prototype aliases pointing to removed methods
- Estimated lines you can remove

## 4. ESLint for Unused Code

```bash
# Check the trimmed file for unused code
npm run lint:trimmed

# See all unused variables
eslint src/trimmed/mixpanel-trimmed.cjs.js --rule 'no-unused-vars: error'
```

## 5. Manual Removal Tips

### Safe to Remove:
✅ Functions with "0 references" in VSCode
✅ Prototype assignments like: `Lib.prototype['removed_method'] = Lib.prototype.removed_method`
✅ Variables that are grayed out
✅ Empty function bodies
✅ Duplicate method definitions

### Be Careful With:
⚠️ Methods starting with `_` (may be internal)
⚠️ Methods called dynamically (via strings)
⚠️ Constructor and init methods
⚠️ Methods referenced in comments or strings

### Quick Patterns to Search For:

```javascript
// Search for these patterns to find dead code:

// 1. Prototype aliases for removed methods
prototype['track_links']
prototype['track_forms']

// 2. Empty functions
function name() {}

// 3. Unused variables (will be grayed in VSCode)
var unused =

// 4. Duplicate assignments
exports.removed =
module.exports.removed =

// 5. Methods only used in their own definition
function selfReferencing() {
  selfReferencing; // Only reference is here
}
```

## 6. Test After Each Removal

```bash
# After removing code, check syntax
node -c src/trimmed/mixpanel-trimmed.cjs.js

# Run ESLint to find new issues
npm run lint:trimmed

# Check size reduction
npm run size
```

## 7. Aggressive Manual Trimming

For maximum reduction:

1. Remove all methods not in `methods-to-keep.json`
2. Remove all prototype aliases
3. Remove all empty functions
4. Remove all debug/test code
5. Remove all comments (if not needed)

## Keyboard Shortcuts in VSCode

- `Cmd+Shift+P` → "Go to References" - See where something is used
- `F12` - Go to definition
- `Shift+F12` - Show all references
- `Cmd+K Cmd+I` - Show hover information
- `Cmd+.` - Quick fix (remove unused)

## The Goal

Your file should only contain:
- Methods listed in `methods-to-keep.json`
- Required internal/helper functions
- Necessary initialization code
- Module exports

Everything else can likely be removed!