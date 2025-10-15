/**
 * Debug test to verify callback behavior
 */

// Mock storage
const createStorage = () => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
};

global.localStorage = createStorage();
global.sessionStorage = createStorage();

// Mock XMLHttpRequest to enable XHR mode (avoids JSONP callback issues)
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
  navigator: { userAgent: 'Mozilla/5.0', onLine: true },
  document: {
    createElement: () => ({ appendChild: () => {}, setAttribute: () => {} }),
    location: { hostname: 'test.com', pathname: '/', protocol: 'https:', search: '' },
    referrer: '',
    title: 'Test',
    body: { appendChild: () => {} },
    cookie: ''
  },
  screen: { width: 1920, height: 1080 },
  location: { hostname: 'test.com', pathname: '/', protocol: 'https:', search: '', href: 'https://test.com/' },
  addEventListener: () => {},
  removeEventListener: () => {},
  crypto: { randomUUID: () => 'test-uuid' }
};
global.document = global.window.document;
global.navigator = global.window.navigator;

describe('Debug - Basic callback test', () => {
  it('should call track callback', (done) => {
    jest.setTimeout(2000);

    // Load library
    const mixpanel = require('../src/trimmed/mixpanel-trimmed-7.cjs.js');

    // Init
    mixpanel.init('test-token', {
      api_host: 'https://api.test.com',
      debug: false,
      batch_requests: false,
      persistence: 'localStorage'
    });

    // Spy on _send_request
    const spy = jest.spyOn(mixpanel, '_send_request').mockImplementation((url, data, options, callback) => {
      console.log('_send_request called with:', { url, hasCallback: typeof callback === 'function' });
      if (typeof callback === 'function') {
        console.log('Calling callback immediately');
        callback({ status: 1 });
      }
      return true;
    });

    console.log('About to call track()');
    mixpanel.track('Test', {}, (response) => {
      console.log('Track callback called!', response);
      expect(spy).toHaveBeenCalled();
      done();
    });

    console.log('track() call completed');
  });
});
