# Minipanel - A Minimal Mixpanel Implementation

## Success! 🎉

We've successfully created a minimal, clean implementation of Mixpanel from scratch, based on the mixpanel-node library structure but adapted for browsers.

## Size Comparison

| Implementation | Size | Reduction |
|---------------|------|-----------|
| Original mixpanel.js | 293 KB | - |
| Trimmed bundle | 74 KB | 74.7% |
| **Minipanel** | **14 KB** | **95.2%** |

**Minipanel is 5.3x smaller than the trimmed bundle!**

## Features Implemented

### Core API
- ✅ `init(token, config)` - Initialize with token
- ✅ `track(event, properties, callback)` - Track events
- ✅ `identify(distinct_id)` - Identify users
- ✅ `register(props)` - Register super properties
- ✅ `register_once(props)` - Register properties once
- ✅ `unregister(prop)` - Remove super property
- ✅ `reset()` - Clear user and start fresh
- ✅ `get_distinct_id()` - Get current user ID
- ✅ `get_property(key)` - Get super property value
- ✅ `get_config(key)` - Get config value
- ✅ `set_config(config)` - Update config

### People API
- ✅ `people.set(prop, value, callback)` - Set user properties
- ✅ `people.set_once(prop, value, callback)` - Set properties once
- ✅ `people.unset(prop, callback)` - Remove user properties
- ✅ `people.increment(prop, by, callback)` - Increment numeric properties
- ✅ `people.track_charge(amount, properties, callback)` - Track revenue

## Implementation Details

### Simplifications Made

1. **HTTP Transport**: fetch() only, no fallbacks to XHR/sendBeacon/img tags
2. **Persistence**: localStorage only, no cookie fallbacks
3. **Browser Detection**: Simple UA parsing, no complex device/browser fingerprinting
4. **Auto-tracking**: No autocapture, no link tracking, no form tracking
5. **Batching**: No request batching (yet - easy to add if needed)
6. **Features Removed**:
   - Session recording
   - Heatmaps
   - Surveys
   - Flags/experiments
   - Notifications
   - Groups API (could be added easily)

### What's Included

1. **Persistence**: Full localStorage-based property persistence
2. **Super Properties**: register/register_once/unregister with persistence
3. **Identity Management**: Device ID generation, user identification, anonymous tracking
4. **Event Tracking**: Full event tracking with automatic properties
5. **People Profiles**: Complete people API for user profiles
6. **Browser Info**: Automatic browser, OS, screen size detection
7. **Default Properties**: Auto-includes current URL, browser info, lib version

## Test Results

**All 25 tests passing!** ✅

```
Test Suites: 1 passed, 1 total
Tests:       25 passed, 25 total
Time:        0.223 s
```

Tests cover:
- Initialization
- Event tracking (with/without properties)
- Super properties (register/register_once/unregister)
- User identification
- Reset functionality
- People API (set/set_once/increment/track_charge)
- Configuration management

## Code Quality

- **Clean**: Based on mixpanel-node's simple structure
- **Readable**: ~400 lines of well-commented JavaScript
- **No dependencies**: Pure JavaScript, no external libraries
- **Modern**: Uses ES6+ features (classes, arrow functions, destructuring)
- **Type-safe ready**: Easy to add TypeScript definitions

## Usage Example

```javascript
// Initialize
const mixpanel = Minipanel.init('YOUR_TOKEN', {
    api_host: 'https://api.mixpanel.com',
    debug: false
});

// Track events
mixpanel.track('Page View', { page: '/home' });

// Identify users
mixpanel.identify('user-123');

// Set super properties
mixpanel.register({ plan: 'premium', version: '2.0' });

// People API
mixpanel.people.set('name', 'John Doe');
mixpanel.people.increment('page_views');
mixpanel.people.track_charge(29.99);

// Reset (logout)
mixpanel.reset();
```

## Next Steps (Optional Enhancements)

If you want to add more features later:

1. **Request Batching** - Batch multiple events into single requests
2. **Retry Logic** - Retry failed requests with exponential backoff
3. **Groups API** - Add group analytics support
4. **TypeScript** - Add .d.ts file for type safety
5. **Marketing Params** - Auto-detect UTM parameters
6. **Minification** - Add build step to minify to ~5KB
7. **time_event()** - Add event timing support
8. **disable()** - Add event disabling support
9. **push()** - Add command queuing support

## Recommendation

**Use Minipanel!** It's:
- ✅ 5x smaller than the trimmed bundle
- ✅ Much simpler to understand and maintain
- ✅ Covers all the essential features
- ✅ All tests passing
- ✅ Clean, modern code
- ✅ No trimming complexity

The only reason to stick with the trimmed bundle would be if you need features like:
- Request batching (high-traffic sites)
- XHR/sendBeacon fallbacks (old browsers)
- Cookie persistence fallbacks (localStorage blocked)
- Advanced features (autocapture, session recording, etc.)

But even then, these could be added to Minipanel incrementally as needed!
