const mp = require('../src/trimmed/mixpanel-trimmed-7.cjs.js');

console.log('=== Trimmed Bundle Exports ===\n');
console.log('Top-level keys:', Object.keys(mp).slice(0, 20));
console.log('Total keys:', Object.keys(mp).length);
console.log('\n=== Key Exports ===');
console.log('Has _:', !!mp._);
console.log('Has Config:', !!mp.Config);
console.log('Has init:', typeof mp.init);
console.log('Has track:', typeof mp.track);
console.log('Has identify:', typeof mp.identify);

if (mp._) {
  console.log('\n=== _ (underscore) methods ===');
  console.log('_.keys:', Object.keys(mp._).slice(0, 30));
  console.log('Total _ methods:', Object.keys(mp._).length);
}

console.log('\n=== Checking for specific exports tests need ===');
console.log('extract_domain:', typeof mp.extract_domain);
console.log('generateTraceparent:', typeof mp.generateTraceparent);
console.log('batchedThrottle:', typeof mp.batchedThrottle);
console.log('document:', !!mp.document);
console.log('window:', !!mp.window);

// Check if functions are in _ object
console.log('\n=== Checking _ object for missing functions ===');
console.log('_.info:', !!mp._.info);
if (mp._.info) {
  console.log('_.info methods:', Object.keys(mp._.info));
}
console.log('_.UUID:', typeof mp._.UUID);
console.log('_.isBlockedUA:', typeof mp._.isBlockedUA);

// Check the actual mixpanel instance methods
console.log('\n=== MixpanelLib instance methods ===');
const instance = mp;
const proto = Object.getPrototypeOf(instance);
if (proto && proto !== Object.prototype) {
  const allMethods = Object.getOwnPropertyNames(proto);
  console.log('Total methods:', allMethods.length);
  console.log('\nAll methods:');
  allMethods.forEach((m, i) => {
    if (typeof proto[m] === 'function' && !m.startsWith('_')) {
      console.log(`  ${m}`);
    }
  });

  console.log('\nPublic API methods (likely kept):');
  const publicMethods = allMethods.filter(m => typeof proto[m] === 'function' && !m.startsWith('_'));
  publicMethods.forEach(m => console.log(`  - ${m}`));
}
