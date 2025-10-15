// Check how disable() and set_config() work

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

// Load library
const mixpanel = require('../src/trimmed/mixpanel-trimmed-7.cjs.js');

// Init
mixpanel.init('test-token', {
  api_host: 'https://api.test.com',
  debug: true,
  batch_requests: false,
  persistence: 'localStorage'
});

console.log('\n=== Testing disable() behavior ===\n');

// Check config before disable
console.log('1. Initial config:');
console.log('   opt_out_tracking:', mixpanel.get_config('opt_out_tracking'));
console.log('   has_opted_out_tracking:', mixpanel.has_opted_out_tracking?.());

// Call disable
console.log('\n2. After calling disable():');
mixpanel.disable();
console.log('   opt_out_tracking:', mixpanel.get_config('opt_out_tracking'));
console.log('   has_opted_out_tracking:', mixpanel.has_opted_out_tracking?.());

// Try to re-enable with set_config
console.log('\n3. After set_config({ opt_out_tracking: false }):');
mixpanel.set_config({ opt_out_tracking: false });
console.log('   opt_out_tracking:', mixpanel.get_config('opt_out_tracking'));
console.log('   has_opted_out_tracking:', mixpanel.has_opted_out_tracking?.());

// Check if track() is called after re-enabling
console.log('\n4. Testing if _send_request is called after re-enable:');
let sendCalled = false;
const originalSend = mixpanel._send_request;
mixpanel._send_request = function(...args) {
  sendCalled = true;
  console.log('   _send_request CALLED!');
  // Call callback if provided
  if (typeof args[3] === 'function') {
    args[3]({ status: 1 });
  }
  return true;
};

mixpanel.track('Test Event', {}, (response) => {
  console.log('   Track callback invoked with:', response);
});

setTimeout(() => {
  console.log('\n5. Final check:');
  console.log('   sendCalled:', sendCalled);
  process.exit(0);
}, 100);
