// Test user session flow in isolation

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
  debug: false,
  batch_requests: false,
  persistence: 'localStorage'
});

let sendRequestCount = 0;

// Spy on _send_request
const originalSend = mixpanel._send_request;
mixpanel._send_request = function(url, data, options, callback) {
  sendRequestCount++;
  console.log(`_send_request call #${sendRequestCount}:`, { url, hasCallback: typeof callback === 'function' });
  if (typeof callback === 'function') {
    setImmediate(() => {
      console.log(`  Calling callback for request #${sendRequestCount}`);
      callback({ status: 1 });
    });
  }
  return true;
};

console.log('\n=== Testing user session flow ===\n');

// 1. Anonymous user visits
const anonId = mixpanel.get_distinct_id();
console.log('1. Anonymous distinct_id:', anonId);

// 2. User registers properties
mixpanel.register({ version: '2.0' });
console.log('2. Registered property');

// 3. Track anonymous event
console.log('3. Tracking Page View...');
mixpanel.track('Page View', { page: '/home' }, (response) => {
  console.log('   Page View callback called!', response);
  console.log('   sendRequestCount after Page View:', sendRequestCount);

  // 4. User logs in
  mixpanel.identify('logged-in-user-123');
  const loginId = mixpanel.get_distinct_id();
  console.log('4. After identify, distinct_id:', loginId);

  // 5. Track authenticated event
  console.log('5. Tracking Login Success...');
  mixpanel.track('Login Success', {}, (response2) => {
    console.log('   Login Success callback called!', response2);
    console.log('   sendRequestCount after Login Success:', sendRequestCount);
    console.log('   Expected: 2, Got:', sendRequestCount);

    // 6. User logs out
    mixpanel.reset();
    const newAnonId = mixpanel.get_distinct_id();
    console.log('6. After reset, new distinct_id:', newAnonId);
    console.log('   Different from original?', newAnonId !== anonId);
    console.log('   Different from login?', newAnonId !== 'logged-in-user-123');

    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  });
});

setTimeout(() => {
  console.log('\n❌ Test timed out after 3 seconds');
  console.log('sendRequestCount:', sendRequestCount);
  process.exit(1);
}, 3000);
