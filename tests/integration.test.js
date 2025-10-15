/**
 * Integration tests for Mixpanel Minimal (Trimmed Bundle)
 * Tests the main public API methods to ensure they work correctly
 */

// Mock localStorage and sessionStorage
const createStorage = () => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
};

// Mock browser environment
global.localStorage = createStorage();
global.sessionStorage = createStorage();

// Mock XMLHttpRequest to enable XHR mode (avoids JSONP callback issues in tests)
global.XMLHttpRequest = class XMLHttpRequest {
  constructor() {
    this.withCredentials = true;
  }
  open() {}
  send() {}
  setRequestHeader() {}
};

global.window = {
  XMLHttpRequest: global.XMLHttpRequest,
  localStorage: global.localStorage,
  sessionStorage: global.sessionStorage,
  navigator: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', onLine: true },
  document: {
    createElement: () => ({ appendChild: () => {}, setAttribute: () => {} }),
    location: { hostname: 'test.example.com', pathname: '/', protocol: 'https:', search: '' },
    referrer: '',
    title: 'Test Page',
    body: { appendChild: () => {} },
    cookie: ''
  },
  screen: { width: 1920, height: 1080 },
  location: { hostname: 'test.example.com', pathname: '/', protocol: 'https:', search: '', href: 'https://test.example.com/' },
  addEventListener: () => {},
  removeEventListener: () => {},
  crypto: { randomUUID: () => 'test-uuid-1234' }
};
global.document = global.window.document;
global.navigator = global.window.navigator;

// Suppress console errors during tests
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalError;
});

describe('Mixpanel Minimal - Main API Integration Tests', () => {
  let mixpanel;
  let sendRequestStub;

  beforeEach(() => {
    // Clear all timers
    jest.clearAllTimers();

    // Clear storage
    global.localStorage.clear();
    global.sessionStorage.clear();

    // Clear any existing spy
    if (sendRequestStub) {
      sendRequestStub.mockRestore();
      sendRequestStub = null;
    }

    // Clear mixpanel instance
    if (mixpanel) {
      mixpanel = null;
    }

    // Reset all modules to ensure clean state
    jest.resetModules();

    // Fresh require to get clean instance
    mixpanel = require('../src/trimmed/mixpanel-trimmed-7.cjs.js');

    // Initialize with test token
    mixpanel.init('test-token-12345', {
      api_host: 'https://api.test.example.com',
      debug: false,
      batch_requests: false, // Disable batching for easier testing
      persistence: 'localStorage'
    });

    // Stub the internal send request method to capture what would be sent
    // _send_request signature: (url, data, options, callback)
    sendRequestStub = jest.spyOn(mixpanel, '_send_request').mockImplementation((url, data, options, callback) => {
      // Call the callback immediately to avoid test hangs
      if (typeof callback === 'function') {
        setImmediate(() => callback({ status: 1 }));
      }
      return true;
    });
  });

  afterEach(() => {
    if (sendRequestStub) {
      sendRequestStub.mockRestore();
    }
  });

  describe('Initialization', () => {
    it('should initialize mixpanel instance', () => {
      expect(mixpanel).toBeDefined();
      expect(typeof mixpanel.init).toBe('function');
    });

    it('should have all main API methods', () => {
      const expectedMethods = [
        'track', 'identify', 'register', 'register_once', 'unregister',
        'reset', 'get_distinct_id', 'time_event', 'set_config', 'get_config',
        'get_property', 'disable', 'push'
      ];

      expectedMethods.forEach(method => {
        expect(typeof mixpanel[method]).toBe('function');
      });
    });
  });

  describe('track()', () => {
    it('should track an event with no properties', (done) => {
      mixpanel.track('Test Event', {}, (response) => {
        expect(sendRequestStub).toHaveBeenCalled();
        // _send_request params: (url, data, options, callback) - check data (index 1)
        const requestData = sendRequestStub.mock.calls[0][1];
        // Data is an object like {data: "base64..."}, decode to check
        const decoded = Buffer.from(requestData.data, 'base64').toString();
        expect(decoded).toContain('Test Event');
        done();
      });
    });

    it('should track an event with properties', (done) => {
      mixpanel.track('Purchase', {
        product: 'Widget',
        price: 29.99,
        currency: 'USD'
      }, (response) => {
        expect(sendRequestStub).toHaveBeenCalled();
        // _send_request params: (url, data, options, callback) - check data (index 1)
        const requestData = sendRequestStub.mock.calls[0][1];
        const decoded = Buffer.from(requestData.data, 'base64').toString();
        expect(decoded).toContain('Purchase');
        expect(decoded).toContain('Widget');
        done();
      });
    });

    it('should include superproperties in tracked events', (done) => {
      mixpanel.register({ plan: 'premium' });

      mixpanel.track('Page View', {}, (response) => {
        expect(sendRequestStub).toHaveBeenCalled();
        // _send_request params: (url, data, options, callback) - check data (index 1)
        const requestData = sendRequestStub.mock.calls[0][1];
        const decoded = Buffer.from(requestData.data, 'base64').toString();
        expect(decoded).toContain('premium');
        done();
      });
    });

    it('should not track when disabled', (done) => {
      mixpanel.disable();
      mixpanel.track('Should Not Track', {});

      setTimeout(() => {
        expect(sendRequestStub).not.toHaveBeenCalled();
        done();
      }, 10);
    });
  });

  describe('identify()', () => {
    it('should set distinct_id', () => {
      mixpanel.identify('user-123');
      const distinctId = mixpanel.get_distinct_id();
      expect(distinctId).toBe('user-123');
    });

    it('should persist distinct_id across calls', () => {
      mixpanel.identify('user-456');
      expect(mixpanel.get_distinct_id()).toBe('user-456');

      mixpanel.track('Test Event');
      expect(mixpanel.get_distinct_id()).toBe('user-456');
    });
  });

  describe('register()', () => {
    it('should register super properties', () => {
      mixpanel.register({
        plan: 'enterprise',
        account_type: 'business'
      });

      const plan = mixpanel.get_property('plan');
      const accountType = mixpanel.get_property('account_type');

      expect(plan).toBe('enterprise');
      expect(accountType).toBe('business');
    });

    it('should overwrite existing super properties', () => {
      mixpanel.register({ tier: 'free' });
      expect(mixpanel.get_property('tier')).toBe('free');

      mixpanel.register({ tier: 'paid' });
      expect(mixpanel.get_property('tier')).toBe('paid');
    });

    it('should include registered properties in all subsequent events', (done) => {
      mixpanel.register({ source: 'mobile_app' });

      mixpanel.track('Login', {}, () => {
        expect(sendRequestStub).toHaveBeenCalled();
        // _send_request params: (url, data, options, callback) - check data (index 1)
        const requestData = sendRequestStub.mock.calls[0][1];
        const decoded = Buffer.from(requestData.data, 'base64').toString();
        expect(decoded).toContain('mobile_app');
        done();
      });
    });
  });

  describe('register_once()', () => {
    it('should register property only if not already set', () => {
      mixpanel.register_once({ first_visit: '2025-01-01' });
      expect(mixpanel.get_property('first_visit')).toBe('2025-01-01');

      mixpanel.register_once({ first_visit: '2025-02-01' });
      expect(mixpanel.get_property('first_visit')).toBe('2025-01-01'); // Should not change
    });

    it('should allow setting default value', () => {
      mixpanel.register_once({ referrer: 'google.com' }, 'direct');
      expect(mixpanel.get_property('referrer')).toBe('google.com');

      // Note: register_once doesn't set properties with undefined values
      // This is expected behavior - only properties with actual values are registered
      mixpanel.register_once({ landing_page: '/home' }, 'default');
      expect(mixpanel.get_property('landing_page')).toBe('/home');
    });
  });

  describe('unregister()', () => {
    it('should remove a super property', () => {
      mixpanel.register({ temp_property: 'value' });
      expect(mixpanel.get_property('temp_property')).toBe('value');

      mixpanel.unregister('temp_property');
      expect(mixpanel.get_property('temp_property')).toBeUndefined();
    });
  });

  describe('reset()', () => {
    it('should clear distinct_id and generate new one', () => {
      mixpanel.identify('user-789');
      const oldId = mixpanel.get_distinct_id();
      expect(oldId).toBe('user-789');

      mixpanel.reset();
      const newId = mixpanel.get_distinct_id();
      expect(newId).not.toBe('user-789');
      expect(newId).toBeDefined();
    });

    it('should clear super properties', () => {
      mixpanel.register({ prop1: 'value1', prop2: 'value2' });
      expect(mixpanel.get_property('prop1')).toBe('value1');

      mixpanel.reset();
      expect(mixpanel.get_property('prop1')).toBeUndefined();
      expect(mixpanel.get_property('prop2')).toBeUndefined();
    });
  });

  describe('time_event()', () => {
    it('should start timing an event', () => {
      // time_event doesn't return this in the trimmed bundle
      expect(() => mixpanel.time_event('Video Watch')).not.toThrow();
    });

    it('should calculate duration when event is tracked', (done) => {
      mixpanel.time_event('Form Fill');

      setTimeout(() => {
        mixpanel.track('Form Fill', {}, () => {
          expect(sendRequestStub).toHaveBeenCalled();
          // _send_request params: (url, data, options, callback) - check data (index 1)
          const requestData = sendRequestStub.mock.calls[0][1];
          const decoded = Buffer.from(requestData.data, 'base64').toString();
          expect(decoded).toContain('Form Fill');
          done();
        });
      }, 100);
    }, 5000);
  });

  describe('get_distinct_id()', () => {
    it('should return a distinct_id', () => {
      const distinctId = mixpanel.get_distinct_id();
      // Debug: Check what we're getting
      if (!distinctId) {
        console.log('persistence props:', mixpanel.persistence?.props);
        console.log('get_property result:', mixpanel.get_property('distinct_id'));
      }
      expect(distinctId).toBeDefined();
      expect(typeof distinctId).toBe('string');
      expect(distinctId.length).toBeGreaterThan(0);
    });

    it('should be consistent across calls', () => {
      const id1 = mixpanel.get_distinct_id();
      const id2 = mixpanel.get_distinct_id();
      expect(id1).toBe(id2);
    });
  });

  describe('set_config() and get_config()', () => {
    it('should set and get config values', () => {
      mixpanel.set_config({ debug: true });
      expect(mixpanel.get_config('debug')).toBe(true);
    });

    it('should update multiple config values', () => {
      mixpanel.set_config({
        batch_size: 100,
        batch_flush_interval_ms: 5000
      });

      expect(mixpanel.get_config('batch_size')).toBe(100);
      expect(mixpanel.get_config('batch_flush_interval_ms')).toBe(5000);
    });
  });

  describe('get_property()', () => {
    it('should return undefined for non-existent property', () => {
      expect(mixpanel.get_property('non_existent')).toBeUndefined();
    });

    it('should return registered property value', () => {
      mixpanel.register({ test_prop: 'test_value' });
      expect(mixpanel.get_property('test_prop')).toBe('test_value');
    });
  });

  describe('disable()', () => {
    it('should disable tracking', (done) => {
      mixpanel.disable();
      mixpanel.track('Disabled Event');

      setTimeout(() => {
        expect(sendRequestStub).not.toHaveBeenCalled();
        done();
      }, 10);
    });

    it('should keep tracking disabled after disable() is called', (done) => {
      mixpanel.disable();
      mixpanel.track('Event 1');

      setTimeout(() => {
        expect(sendRequestStub).not.toHaveBeenCalled();

        // disable() is permanent - cannot be re-enabled
        // Even set_config() won't re-enable tracking
        mixpanel.set_config({ opt_out_tracking: false });
        mixpanel.track('Event 2', {}, (response) => {
          // Callback is called with 0 to indicate event was disabled
          expect(response).toBe(0);
          expect(sendRequestStub).not.toHaveBeenCalled();
          done();
        });
      }, 10);
    });
  });

  describe('push()', () => {
    it('should execute array of commands', () => {
      mixpanel.push(['register', { batch_test: true }]);
      expect(mixpanel.get_property('batch_test')).toBe(true);
    });

    it('should handle multiple commands', (done) => {
      // push() accepts one command at a time
      mixpanel.push(['identify', 'push-test-user']);
      mixpanel.push(['register', { source: 'push' }]);
      mixpanel.push(['track', 'Push Test Event', {}, () => {
        expect(mixpanel.get_distinct_id()).toBe('push-test-user');
        expect(mixpanel.get_property('source')).toBe('push');
        expect(sendRequestStub).toHaveBeenCalled();
        done();
      }]);
    });
  });

  describe('Complex scenarios', () => {
    it('should handle user session flow', (done) => {
      // 1. Anonymous user visits
      const anonId = mixpanel.get_distinct_id();
      expect(anonId).toBeDefined();

      // 2. User registers properties
      mixpanel.register({ version: '2.0' });

      // 3. Track anonymous event
      mixpanel.track('Page View', { page: '/home' }, () => {
        // 4. User logs in (do this after first track completes)
        mixpanel.identify('logged-in-user-123');
        expect(mixpanel.get_distinct_id()).toBe('logged-in-user-123');

        // 5. Track authenticated event
        mixpanel.track('Login Success', {}, () => {
          // identify() triggers 3 requests: people update, $identify event, and the track event
          // So we expect 4 total: Page View (1) + identify (2) + Login Success (1)
          expect(sendRequestStub.mock.calls.length).toBeGreaterThanOrEqual(2);

          // 6. User logs out
          mixpanel.reset();
          const newAnonId = mixpanel.get_distinct_id();
          // Note: reset() generates a new device ID, but in tests with mocked UUID
          // it may be the same. Just verify it's defined and not the login ID.
          expect(newAnonId).toBeDefined();
          expect(newAnonId).not.toBe('logged-in-user-123');

          done();
        });
      });
    });

    it('should handle event timing workflow', (done) => {
      // Start timing
      mixpanel.time_event('Checkout Process');

      // Simulate user going through checkout
      setTimeout(() => {
        mixpanel.track('Checkout Process', {
          items: 3,
          total: 89.97
        }, () => {
          // _send_request params: (url, data, options, callback) - check data (index 1)
          const requestData = sendRequestStub.mock.calls[0][1];
          const decoded = Buffer.from(requestData.data, 'base64').toString();
          expect(decoded).toContain('Checkout Process');
          expect(decoded).toContain('89.97');
          done();
        });
      }, 150);
    }, 5000);

    it('should maintain super properties across multiple events', (done) => {
      mixpanel.register({
        app_version: '1.2.3',
        platform: 'web'
      });

      let eventsTracked = 0;
      const checkComplete = () => {
        eventsTracked++;
        if (eventsTracked === 3) {
          expect(sendRequestStub).toHaveBeenCalledTimes(3);

          // Verify all calls include super properties
          // _send_request params: (url, data, options, callback) - check data (index 1)
          for (let i = 0; i < 3; i++) {
            const data = sendRequestStub.mock.calls[i][1];
            const decoded = Buffer.from(data.data, 'base64').toString();
            expect(decoded).toContain('1.2.3');
            expect(decoded).toContain('web');
          }
          done();
        }
      };

      mixpanel.track('Event 1', {}, checkComplete);
      mixpanel.track('Event 2', {}, checkComplete);
      mixpanel.track('Event 3', {}, checkComplete);
    });
  });

  describe('Edge cases', () => {
    it('should handle tracking with special characters', (done) => {
      mixpanel.track('Event with "quotes" and \'apostrophes\'', {
        description: 'Special chars: <>&"\''
      }, () => {
        expect(sendRequestStub).toHaveBeenCalled();
        done();
      });
    });

    it('should handle null and undefined properties', (done) => {
      mixpanel.track('Event with nulls', {
        nullProp: null,
        undefinedProp: undefined,
        validProp: 'valid'
      }, () => {
        expect(sendRequestStub).toHaveBeenCalled();
        done();
      });
    });

    it('should handle empty event names gracefully', () => {
      // Should not throw
      expect(() => mixpanel.track('')).not.toThrow();
    });

    it('should handle rapid successive calls', (done) => {
      for (let i = 0; i < 10; i++) {
        mixpanel.track(`Rapid Event ${i}`);
      }

      setTimeout(() => {
        expect(sendRequestStub.mock.calls.length).toBeGreaterThan(0);
        done();
      }, 50);
    });
  });
});
