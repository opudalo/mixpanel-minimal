/**
 * Integration tests for Minipanel
 * ES6 module version
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { init } from '../src/minipanel.js';

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
global.fetch = jest.fn();

global.window = {
  localStorage: global.localStorage,
  sessionStorage: global.sessionStorage,
  navigator: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
  document: {
    location: { hostname: 'test.example.com', pathname: '/', protocol: 'https:', search: '' },
    referrer: '',
    title: 'Test Page',
  },
  screen: { width: 1920, height: 1080 },
  location: { hostname: 'test.example.com', pathname: '/', protocol: 'https:', search: '', href: 'https://test.example.com/' },
  crypto: { randomUUID: () => 'test-uuid-1234' }
};
global.navigator = global.window.navigator;
global.document = global.window.document;
global.btoa = (str) => Buffer.from(str).toString('base64');

describe('Minipanel - Integration Tests', () => {
  let mixpanel;

  beforeEach(() => {
    // Clear storage
    global.localStorage.clear();
    global.sessionStorage.clear();

    // Clear fetch mock
    global.fetch.mockClear();

    // Mock fetch to return success
    global.fetch.mockResolvedValue({
      text: () => Promise.resolve('1')
    });

    // Initialize with test token
    mixpanel = init('test-token-12345', {
      api_host: 'https://api.test.example.com',
      debug: false,
    });
  });

  describe('Initialization', () => {
    it('should initialize mixpanel instance', () => {
      expect(mixpanel).toBeDefined();
      expect(typeof mixpanel.track).toBe('function');
    });

    it('should have all main API methods', () => {
      const expectedMethods = [
        'track', 'identify', 'register', 'register_once', 'unregister',
        'reset', 'get_distinct_id', 'set_config', 'get_config', 'get_property'
      ];

      expectedMethods.forEach(method => {
        expect(typeof mixpanel[method]).toBe('function');
      });
    });

    it('should have people API', () => {
      expect(mixpanel.people).toBeDefined();
      expect(typeof mixpanel.people.set).toBe('function');
      expect(typeof mixpanel.people.set_once).toBe('function');
      expect(typeof mixpanel.people.unset).toBe('function');
      expect(typeof mixpanel.people.increment).toBe('function');
      expect(typeof mixpanel.people.track_charge).toBe('function');
    });
  });

  describe('track()', () => {
    it('should track an event with no properties', (done) => {
      mixpanel.track('Test Event', {}, (response) => {
        expect(global.fetch).toHaveBeenCalled();
        const callArgs = global.fetch.mock.calls[0];
        const callUrl = callArgs[0];
        const callOptions = callArgs[1];
        expect(callUrl).toContain('/track/');
        expect(callOptions.method).toBe('POST');
        expect(callOptions.body).toContain('data=');
        done();
      });
    });

    it('should track an event with properties', (done) => {
      mixpanel.track('Purchase', {
        product: 'Widget',
        price: 29.99
      }, (response) => {
        expect(global.fetch).toHaveBeenCalled();
        done();
      });
    });

    it('should include superproperties in tracked events', (done) => {
      mixpanel.register({ plan: 'premium' });

      mixpanel.track('Page View', {}, (response) => {
        expect(global.fetch).toHaveBeenCalled();
        const callArgs = global.fetch.mock.calls[0];
        const body = callArgs[1].body;
        // Extract data from body: "data=<encoded>"
        const dataMatch = body.match(/data=([^&]+)/);
        const encodedData = decodeURIComponent(dataMatch[1]);
        const decoded = Buffer.from(encodedData, 'base64').toString();
        expect(decoded).toContain('premium');
        done();
      });
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
  });

  describe('register_once()', () => {
    it('should register property only if not already set', () => {
      mixpanel.register_once({ first_visit: '2025-01-01' });
      expect(mixpanel.get_property('first_visit')).toBe('2025-01-01');

      mixpanel.register_once({ first_visit: '2025-02-01' });
      expect(mixpanel.get_property('first_visit')).toBe('2025-01-01'); // Should not change
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

  describe('get_distinct_id()', () => {
    it('should return a distinct_id', () => {
      const distinctId = mixpanel.get_distinct_id();
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

  describe('people.set()', () => {
    it('should set a user property', (done) => {
      mixpanel.identify('user-123');

      mixpanel.people.set('name', 'John Doe', (response) => {
        expect(global.fetch).toHaveBeenCalled();
        const callUrl = global.fetch.mock.calls[global.fetch.mock.calls.length - 1][0];
        expect(callUrl).toContain('/engage/');
        done();
      });
    });

    it('should set multiple user properties', (done) => {
      mixpanel.identify('user-123');

      mixpanel.people.set({ name: 'John', age: 30 }, (response) => {
        expect(global.fetch).toHaveBeenCalled();
        done();
      });
    });
  });

  describe('people.set_once()', () => {
    it('should set a user property once', (done) => {
      mixpanel.identify('user-123');

      mixpanel.people.set_once('first_login', '2025-01-01', (response) => {
        expect(global.fetch).toHaveBeenCalled();
        done();
      });
    });
  });

  describe('people.increment()', () => {
    it('should increment a user property', (done) => {
      mixpanel.identify('user-123');

      mixpanel.people.increment('page_views', 1, (response) => {
        expect(global.fetch).toHaveBeenCalled();
        done();
      });
    });

    it('should increment by 1 by default', (done) => {
      mixpanel.identify('user-123');

      mixpanel.people.increment('page_views', (response) => {
        expect(global.fetch).toHaveBeenCalled();
        done();
      });
    });
  });

  describe('people.track_charge()', () => {
    it('should track a charge', (done) => {
      mixpanel.identify('user-123');

      mixpanel.people.track_charge(29.99, {}, (response) => {
        expect(global.fetch).toHaveBeenCalled();
        const callUrl = global.fetch.mock.calls[global.fetch.mock.calls.length - 1][0];
        expect(callUrl).toContain('/engage/');
        done();
      });
    });
  });

  describe('Data truncation', () => {
    it('should truncate string properties to 255 characters', (done) => {
      const longString = 'a'.repeat(300); // 300 characters

      mixpanel.track('Test Event', { longProp: longString }, (response) => {
        expect(global.fetch).toHaveBeenCalled();
        const callArgs = global.fetch.mock.calls[0];
        const body = callArgs[1].body;
        const dataMatch = body.match(/data=([^&]+)/);
        const encodedData = decodeURIComponent(dataMatch[1]);
        const decoded = Buffer.from(encodedData, 'base64').toString();
        const parsedData = JSON.parse(decoded);

        // String should be truncated to 255 chars
        expect(parsedData.properties.longProp.length).toBe(255);
        expect(parsedData.properties.longProp).toBe('a'.repeat(255));
        done();
      });
    });

    it('should use POST method to avoid URL length limits', (done) => {
      mixpanel.track('Test Event', {}, (response) => {
        expect(global.fetch).toHaveBeenCalled();
        const callArgs = global.fetch.mock.calls[0];
        const callOptions = callArgs[1];

        expect(callOptions.method).toBe('POST');
        expect(callOptions.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
        done();
      });
    });
  });
});
