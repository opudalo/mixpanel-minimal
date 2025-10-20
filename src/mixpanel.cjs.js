/**
 * Mixpanel Minimal - Trimmed Version (Pass 8)
 * Generated: 2025-10-15T18:44:25.527Z
 * Original size: 293.46 KB
 * Removed 187 unused methods
 * Removed 0 prototype aliases
 * Removed 0 exports
 *
 * Kept methods: 
 */

'use strict';

var Config = {
  DEBUG: false,
  LIB_VERSION: '2.71.0'
};
var win;
if (typeof window === 'undefined') {
  var loc = {
    hostname: ''
  };
  win = {
    crypto: {
      randomUUID: function () {
        throw Error('unsupported');
      }
    },
    navigator: {
      userAgent: '',
      onLine: true
    },
    document: {
      createElement: function () {
        return {};
      },
      location: loc,
      referrer: ''
    },
    screen: {
      width: 0,
      height: 0
    },
    location: loc,
    addEventListener: function () {},
    removeEventListener: function () {}
  };
} else {
  win = window;
}
var MAX_RECORDING_MS = 24 * 60 * 60 * 1000;
var ArrayProto = Array.prototype,
  slice = ArrayProto.slice,
  navigator = win.navigator,
  document$1 = win.document,
  windowOpera = win.opera,
  screen = win.screen,
  userAgent = navigator.userAgent;
var _ = {
  trim: function (str) {
    return str.trim();
  },
  each: function (obj, iterator, context) {
    if (obj == null) return;
    if (Array.isArray(obj)) {
      obj.forEach(iterator, context);
    } else {
      for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          iterator.call(context, obj[key], key, obj);
        }
      }
    }
  },
  bind: function (func, context) {
    return func.bind.apply(func, [context].concat(Array.prototype.slice.call(arguments, 2)));
  },
  extend: function (obj) {
    Array.prototype.slice.call(arguments, 1).forEach(function (source) {
      for (var prop in source) {
        if (source[prop] !== undefined) {
          obj[prop] = source[prop];
        }
      }
    });
    return obj;
  },
  map: function (arr, callback, context) {
    return Array.prototype.map.call(arr, callback, context);
  },
  toArray: function (iterable) {
    if (!iterable) return [];
    if (Array.isArray(iterable)) return Array.from(iterable);
    return Array.from(iterable);
  },
  keys: function (obj) {
    return obj ? Object.keys(obj) : [];
  },
  values: function (obj) {
    return obj ? Object.values(obj) : [];
  },
  include: function (obj, target) {
    if (obj == null) return false;
    return obj.indexOf(target) !== -1;
  },
  includes: function (str, needle) {
    return str.indexOf(needle) !== -1;
  },
  isArray: Array.isArray,
  isFunction: function (f) {
    return typeof f === 'function';
  },
  isArguments: function (obj) {
    return Object.prototype.toString.call(obj) === '[object Arguments]';
  },
  isObject: function (obj) {
    return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
  },
  isEmptyObject: function (obj) {
    if (!_.isObject(obj)) return false;
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        return false;
      }
    }
    return true;
  },
  isUndefined: function (obj) {
    return obj === undefined;
  },
  isString: function (obj) {
    return typeof obj === 'string';
  },
  isDate: function (obj) {
    return obj instanceof Date;
  },
  isNumber: function (obj) {
    return typeof obj === 'number' && !isNaN(obj);
  },
  isElement: function (obj) {
    return !!(obj && obj.nodeType === 1);
  },
  inherit: function (subclass, superclass) {
    subclass.prototype = Object.create(superclass.prototype);
    subclass.prototype.constructor = subclass;
    subclass.superclass = superclass.prototype;
    return subclass;
  },
  timestamp: function () {
    return Date.now();
  },
  formatDate: function (d) {
    function pad(n) {
      return n < 10 ? '0' + n : n;
    }
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds());
  },
  encodeDates: function (obj) {
    _.each(obj, function (v, k) {
      if (_.isDate(v)) {
        obj[k] = _.formatDate(v);
      } else if (_.isObject(v)) {
        obj[k] = _.encodeDates(v);
      }
    });
    return obj;
  },
  strip_empty_properties: function (p) {
    var ret = {};
    _.each(p, function (v, k) {
      if (typeof v === 'string' && v.length > 0) {
        ret[k] = v;
      }
    });
    return ret;
  },
  truncate: function (obj, length) {
    if (typeof obj === 'string') {
      return obj.slice(0, length);
    } else if (Array.isArray(obj)) {
      return obj.map(function (val) {
        return _.truncate(val, length);
      });
    } else if (_.isObject(obj)) {
      var ret = {};
      _.each(obj, function (val, key) {
        ret[key] = _.truncate(val, length);
      });
      return ret;
    }
    return obj;
  },
  JSONEncode: function (obj) {
    return JSON.stringify(obj);
  },
  JSONDecode: function (str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return null;
    }
  },
  utf8Encode: function (string) {
    string = (string + '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    var utftext = '',
      start,
      end;
    var stringl = 0,
      n;
    start = end = 0;
    stringl = string.length;
    for (n = 0; n < stringl; n++) {
      var c1 = string.charCodeAt(n);
      var enc = null;
      if (c1 < 128) {
        end++;
      } else if (c1 > 127 && c1 < 2048) {
        enc = String.fromCharCode(c1 >> 6 | 192, c1 & 63 | 128);
      } else {
        enc = String.fromCharCode(c1 >> 12 | 224, c1 >> 6 & 63 | 128, c1 & 63 | 128);
      }
      if (enc !== null) {
        if (end > start) {
          utftext += string.substring(start, end);
        }
        utftext += enc;
        start = end = n + 1;
      }
    }
    if (end > start) {
      utftext += string.substring(start, string.length);
    }
    return utftext;
  },
  base64Encode: function (data) {
    if (!data) return data;
    if (typeof btoa === 'function') {
      try {
        return btoa(_.utf8Encode(data));
      } catch (e) {}
    }
    var b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    var o1,
      o2,
      o3,
      h1,
      h2,
      h3,
      h4,
      bits,
      i = 0,
      ac = 0,
      enc = '',
      tmp_arr = [];
    data = _.utf8Encode(data);
    do {
      o1 = data.charCodeAt(i++);
      o2 = data.charCodeAt(i++);
      o3 = data.charCodeAt(i++);
      bits = o1 << 16 | o2 << 8 | o3;
      h1 = bits >> 18 & 0x3f;
      h2 = bits >> 12 & 0x3f;
      h3 = bits >> 6 & 0x3f;
      h4 = bits & 0x3f;
      tmp_arr[ac++] = b64.charAt(h1) + b64.charAt(h2) + b64.charAt(h3) + b64.charAt(h4);
    } while (i < data.length);
    enc = tmp_arr.join('');
    switch (data.length % 3) {
      case 1:
        enc = enc.slice(0, -2) + '==';
        break;
      case 2:
        enc = enc.slice(0, -1) + '=';
        break;
    }
    return enc;
  },
  UUID: function () {
    try {
      return win['crypto']['randomUUID']();
    } catch (err) {
      var uuid = new Array(36);
      for (var i = 0; i < 36; i++) {
        uuid[i] = Math.floor(Math.random() * 16);
      }
      uuid[14] = 4;
      uuid[19] = uuid[19] &= -5;
      uuid[19] = uuid[19] |= 1 << 3;
      uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
      return _.map(uuid, function (x) {
        return x.toString(16);
      }).join('');
    }
  },
  isBlockedUA: function (ua) {
    var BLOCKED_UA_STRS = ['ahrefsbot', 'ahrefssiteaudit', 'amazonbot', 'baiduspider', 'bingbot', 'bingpreview', 'chrome-lighthouse', 'facebookexternal', 'petalbot', 'pinterest', 'screaming frog', 'yahoo! slurp', 'yandex', 'adsbot-google', 'apis-google', 'duplexweb-google', 'feedfetcher-google', 'google favicon', 'google web preview', 'google-read-aloud', 'googlebot', 'googleweblight', 'mediapartners-google', 'storebot-google'];
    ua = ua.toLowerCase();
    for (var i = 0; i < BLOCKED_UA_STRS.length; i++) {
      if (ua.indexOf(BLOCKED_UA_STRS[i]) !== -1) {
        return true;
      }
    }
    return false;
  },
  HTTPBuildQuery: function (formdata, arg_separator) {
    var use_val,
      use_key,
      tmp_arr = [];
    if (_.isUndefined(arg_separator)) {
      arg_separator = '&';
    }
    _.each(formdata, function (val, key) {
      use_val = encodeURIComponent(val.toString());
      use_key = encodeURIComponent(key);
      tmp_arr[tmp_arr.length] = use_key + '=' + use_val;
    });
    return tmp_arr.join(arg_separator);
  },
  getQueryParam: function (url, param) {
    try {
      var urlObj = new URL(url, window.location.href);
      var value = urlObj.searchParams.get(param);
      return value || '';
    } catch (e) {
      param = param.replace(/[[]/g, '\\[').replace(/[\]]/g, '\\]');
      var regexS = '[\\?&]' + param + '=([^&#]*)',
        regex = new RegExp(regexS),
        results = regex.exec(url);
      if (results === null || results && typeof results[1] !== 'string' && results[1].length) {
        return '';
      } else {
        var result = results[1];
        try {
          result = decodeURIComponent(result);
        } catch (err) {
          console.error('Skipping decoding for malformed query param: ' + result);
        }
        return result.replace(/\+/g, ' ');
      }
    }
  },
  cookie: {
    get: function (name) {
      var nameEQ = name + '=';
      var ca = document.cookie.split(';');
      for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
          c = c.substring(1, c.length);
        }
        if (c.indexOf(nameEQ) === 0) {
          return decodeURIComponent(c.substring(nameEQ.length, c.length));
        }
      }
      return null;
    },
    parse: function (name) {
      var cookie;
      try {
        cookie = _.JSONDecode(_.cookie.get(name)) || {};
      } catch (err) {}
      return cookie;
    },
    set_seconds: function (name, value, seconds, is_cross_subdomain, is_secure, is_cross_site, domain_override) {
      var cdomain = '',
        expires = '',
        secure = '';
      if (domain_override) {
        cdomain = '; domain=' + domain_override;
      } else if (is_cross_subdomain) {
        var domain = extract_domain(document.location.hostname);
        cdomain = domain ? '; domain=.' + domain : '';
      }
      if (seconds) {
        var date = new Date();
        date.setTime(date.getTime() + seconds * 1000);
        expires = '; expires=' + date.toGMTString();
      }
      if (is_cross_site) {
        is_secure = true;
        secure = '; SameSite=None';
      }
      if (is_secure) {
        secure += '; secure';
      }
      document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/' + cdomain + secure;
    },
    set: function (name, value, days, is_cross_subdomain, is_secure, is_cross_site, domain_override) {
      var cdomain = '',
        expires = '',
        secure = '';
      if (domain_override) {
        cdomain = '; domain=' + domain_override;
      } else if (is_cross_subdomain) {
        var domain = extract_domain(document.location.hostname);
        cdomain = domain ? '; domain=.' + domain : '';
      }
      if (days) {
        var date = new Date();
        date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
        expires = '; expires=' + date.toGMTString();
      }
      if (is_cross_site) {
        is_secure = true;
        secure = '; SameSite=None';
      }
      if (is_secure) {
        secure += '; secure';
      }
      var new_cookie_val = name + '=' + encodeURIComponent(value) + expires + '; path=/' + cdomain + secure;
      document.cookie = new_cookie_val;
      return new_cookie_val;
    },
    remove: function (name, is_cross_subdomain, domain_override) {
      _.cookie.set(name, '', -1, is_cross_subdomain, false, false, domain_override);
    }
  },
  dom_query: function (query) {
    if (_.isElement(query)) {
      return [query];
    } else if (_.isObject(query) && !_.isUndefined(query.length)) {
      return query;
    } else {
      return document.querySelectorAll(query);
    }
  },
  register_event: function (element, type, handler, oldSchool, useCapture) {
    if (!element) {
      console.error('No valid element provided to register_event');
      return;
    }
    element.addEventListener(type, handler, !!useCapture);
  },
  localStorage: null,
  sessionStorage: null,
  info: null
};
var _testStorageSupported = function (storage) {
  var supported = true;
  try {
    var key = '__mplss_' + cheap_guid(8),
      val = 'xyz';
    storage.setItem(key, val);
    if (storage.getItem(key) !== val) {
      supported = false;
    }
    storage.removeItem(key);
  } catch (err) {
    supported = false;
  }
  return supported;
};
var _localStorageSupported = null;
var localStorageSupported = function (storage, forceCheck) {
  if (_localStorageSupported !== null && !forceCheck) {
    return _localStorageSupported;
  }
  return _localStorageSupported = _testStorageSupported(storage || win.localStorage);
};
var _sessionStorageSupported = null;
var sessionStorageSupported = function (storage, forceCheck) {
  if (_sessionStorageSupported !== null && !forceCheck) {
    return _sessionStorageSupported;
  }
  return _sessionStorageSupported = _testStorageSupported(storage || win.sessionStorage);
};
function _storageWrapper(storage, name, is_supported_fn) {
  var log_error = function (msg) {
    console.error(name + ' error: ' + msg);
  };
  return {
    is_supported: function (forceCheck) {
      var supported = is_supported_fn(storage, forceCheck);
      if (!supported) {
        console.error(name + ' unsupported');
      }
      return supported;
    },
    error: log_error,
    get: function (key) {
      try {
        return storage.getItem(key);
      } catch (err) {
        log_error(err);
      }
      return null;
    },
    parse: function (key) {
      try {
        return _.JSONDecode(storage.getItem(key)) || {};
      } catch (err) {}
      return null;
    },
    set: function (key, value) {
      try {
        storage.setItem(key, value);
      } catch (err) {
        log_error(err);
      }
    },
    remove: function (key) {
      try {
        storage.removeItem(key);
      } catch (err) {
        log_error(err);
      }
    }
  };
}
_.localStorage = _storageWrapper(win.localStorage, 'localStorage', localStorageSupported);
_.sessionStorage = _storageWrapper(win.sessionStorage, 'sessionStorage', sessionStorageSupported);
var CAMPAIGN_KEYWORDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'utm_source_platform', 'utm_campaign_id', 'utm_creative_format', 'utm_marketing_tactic'];
var CLICK_IDS = ['dclid', 'fbclid', 'gclid', 'ko_click_id', 'li_fat_id', 'msclkid', 'sccid', 'ttclid', 'twclid', 'wbraid'];
_.info = {
  campaignParams: function (default_value) {
    var kw = '',
      params = {};
    _.each(CAMPAIGN_KEYWORDS, function (kwkey) {
      kw = _.getQueryParam(document$1.URL, kwkey);
      if (kw.length) {
        params[kwkey] = kw;
      } else if (default_value !== undefined) {
        params[kwkey] = default_value;
      }
    });
    return params;
  },
  clickParams: function () {
    var id = '',
      params = {};
    _.each(CLICK_IDS, function (idkey) {
      id = _.getQueryParam(document$1.URL, idkey);
      if (id.length) {
        params[idkey] = id;
      }
    });
    return params;
  },
  marketingParams: function () {
    return _.extend(_.info.campaignParams(), _.info.clickParams());
  },
  searchEngine: function (referrer) {
    if (referrer.search('https?://(.*)google.([^/?]*)') === 0) {
      return 'google';
    } else if (referrer.search('https?://(.*)bing.com') === 0) {
      return 'bing';
    } else if (referrer.search('https?://(.*)yahoo.com') === 0) {
      return 'yahoo';
    } else if (referrer.search('https?://(.*)duckduckgo.com') === 0) {
      return 'duckduckgo';
    } else {
      return null;
    }
  },
  searchInfo: function (referrer) {
    var search = _.info.searchEngine(referrer),
      param = search != 'yahoo' ? 'q' : 'p',
      ret = {};
    if (search !== null) {
      ret['$search_engine'] = search;
      var keyword = _.getQueryParam(referrer, param);
      if (keyword.length) {
        ret['mp_keyword'] = keyword;
      }
    }
    return ret;
  },
  browser: function (user_agent, vendor, opera) {
    vendor = vendor || '';
    if (opera || _.includes(user_agent, ' OPR/')) {
      if (_.includes(user_agent, 'Mini')) {
        return 'Opera Mini';
      }
      return 'Opera';
    } else if (/(BlackBerry|PlayBook|BB10)/i.test(user_agent)) {
      return 'BlackBerry';
    } else if (_.includes(user_agent, 'IEMobile') || _.includes(user_agent, 'WPDesktop')) {
      return 'Internet Explorer Mobile';
    } else if (_.includes(user_agent, 'SamsungBrowser/')) {
      return 'Samsung Internet';
    } else if (_.includes(user_agent, 'Edge') || _.includes(user_agent, 'Edg/')) {
      return 'Microsoft Edge';
    } else if (_.includes(user_agent, 'FBIOS')) {
      return 'Facebook Mobile';
    } else if (_.includes(user_agent, 'Whale/')) {
      return 'Whale Browser';
    } else if (_.includes(user_agent, 'Chrome')) {
      return 'Chrome';
    } else if (_.includes(user_agent, 'CriOS')) {
      return 'Chrome iOS';
    } else if (_.includes(user_agent, 'UCWEB') || _.includes(user_agent, 'UCBrowser')) {
      return 'UC Browser';
    } else if (_.includes(user_agent, 'FxiOS')) {
      return 'Firefox iOS';
    } else if (_.includes(vendor, 'Apple')) {
      if (_.includes(user_agent, 'Mobile')) {
        return 'Mobile Safari';
      }
      return 'Safari';
    } else if (_.includes(user_agent, 'Android')) {
      return 'Android Mobile';
    } else if (_.includes(user_agent, 'Konqueror')) {
      return 'Konqueror';
    } else if (_.includes(user_agent, 'Firefox')) {
      return 'Firefox';
    } else if (_.includes(user_agent, 'MSIE') || _.includes(user_agent, 'Trident/')) {
      return 'Internet Explorer';
    } else if (_.includes(user_agent, 'Gecko')) {
      return 'Mozilla';
    } else {
      return '';
    }
  },
  browserVersion: function (userAgent, vendor, opera) {
    var browser = _.info.browser(userAgent, vendor, opera);
    var versionRegexs = {
      'Internet Explorer Mobile': /rv:(\d+(\.\d+)?)/,
      'Microsoft Edge': /Edge?\/(\d+(\.\d+)?)/,
      Chrome: /Chrome\/(\d+(\.\d+)?)/,
      'Chrome iOS': /CriOS\/(\d+(\.\d+)?)/,
      'UC Browser': /(UCBrowser|UCWEB)\/(\d+(\.\d+)?)/,
      Safari: /Version\/(\d+(\.\d+)?)/,
      'Mobile Safari': /Version\/(\d+(\.\d+)?)/,
      Opera: /(Opera|OPR)\/(\d+(\.\d+)?)/,
      Firefox: /Firefox\/(\d+(\.\d+)?)/,
      'Firefox iOS': /FxiOS\/(\d+(\.\d+)?)/,
      Konqueror: /Konqueror:(\d+(\.\d+)?)/,
      BlackBerry: /BlackBerry (\d+(\.\d+)?)/,
      'Android Mobile': /android\s(\d+(\.\d+)?)/,
      'Samsung Internet': /SamsungBrowser\/(\d+(\.\d+)?)/,
      'Internet Explorer': /(rv:|MSIE )(\d+(\.\d+)?)/,
      Mozilla: /rv:(\d+(\.\d+)?)/,
      'Whale Browser': /Whale\/(\d+(\.\d+)?)/
    };
    var regex = versionRegexs[browser];
    if (regex === undefined) {
      return null;
    }
    var matches = userAgent.match(regex);
    if (!matches) {
      return null;
    }
    return parseFloat(matches[matches.length - 2]);
  },
  os: function () {
    var a = userAgent;
    if (/Windows/i.test(a)) {
      if (/Phone/.test(a) || /WPDesktop/.test(a)) {
        return 'Windows Phone';
      }
      return 'Windows';
    } else if (/(iPhone|iPad|iPod)/.test(a)) {
      return 'iOS';
    } else if (/Android/.test(a)) {
      return 'Android';
    } else if (/(BlackBerry|PlayBook|BB10)/i.test(a)) {
      return 'BlackBerry';
    } else if (/Mac/i.test(a)) {
      return 'Mac OS X';
    } else if (/Linux/.test(a)) {
      return 'Linux';
    } else if (/CrOS/.test(a)) {
      return 'Chrome OS';
    } else {
      return '';
    }
  },
  device: function (user_agent) {
    if (/Windows Phone/i.test(user_agent) || /WPDesktop/.test(user_agent)) {
      return 'Windows Phone';
    } else if (/iPad/.test(user_agent)) {
      return 'iPad';
    } else if (/iPod/.test(user_agent)) {
      return 'iPod Touch';
    } else if (/iPhone/.test(user_agent)) {
      return 'iPhone';
    } else if (/(BlackBerry|PlayBook|BB10)/i.test(user_agent)) {
      return 'BlackBerry';
    } else if (/Android/.test(user_agent)) {
      return 'Android';
    } else {
      return '';
    }
  },
  referringDomain: function (referrer) {
    var split = referrer.split('/');
    if (split.length >= 3) {
      return split[2];
    }
    return '';
  },
  currentUrl: function () {
    return win.location.href;
  },
  properties: function (extra_props) {
    if (typeof extra_props !== 'object') {
      extra_props = {};
    }
    return _.extend(_.strip_empty_properties({
      $os: _.info.os(),
      $browser: _.info.browser(userAgent, navigator.vendor, windowOpera),
      $referrer: document$1.referrer,
      $referring_domain: _.info.referringDomain(document$1.referrer),
      $device: _.info.device(userAgent)
    }), {
      $current_url: _.info.currentUrl(),
      $browser_version: _.info.browserVersion(userAgent, navigator.vendor, windowOpera),
      $screen_height: screen.height,
      $screen_width: screen.width,
      mp_lib: 'web',
      $lib_version: Config.LIB_VERSION,
      $insert_id: cheap_guid(),
      time: _.timestamp() / 1000
    }, _.strip_empty_properties(extra_props));
  },
  people_properties: function () {
    return _.extend(_.strip_empty_properties({
      $os: _.info.os(),
      $browser: _.info.browser(userAgent, navigator.vendor, windowOpera)
    }), {
      $browser_version: _.info.browserVersion(userAgent, navigator.vendor, windowOpera)
    });
  },
  mpPageViewProperties: function () {
    return _.strip_empty_properties({
      current_page_title: document$1.title,
      current_domain: win.location.hostname,
      current_url_path: win.location.pathname,
      current_url_protocol: win.location.protocol,
      current_url_search: win.location.search
    });
  }
};
var cheap_guid = function (maxlen) {
  var guid = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
  return maxlen ? guid.substring(0, maxlen) : guid;
};
var SIMPLE_DOMAIN_MATCH_REGEX = /[a-z0-9][a-z0-9-]*\.[a-z]+$/i;
var DOMAIN_MATCH_REGEX = /[a-z0-9][a-z0-9-]+\.[a-z.]{2,6}$/i;
var extract_domain = function (hostname) {
  var domain_regex = DOMAIN_MATCH_REGEX;
  var parts = hostname.split('.');
  var tld = parts[parts.length - 1];
  if (tld.length > 4 || tld === 'com' || tld === 'org') {
    domain_regex = SIMPLE_DOMAIN_MATCH_REGEX;
  }
  var matches = hostname.match(domain_regex);
  return matches ? matches[0] : '';
};
var NOOP_FUNC = function () {};
var JSONStringify = null,
  JSONParse = null;
if (typeof JSON !== 'undefined') {
  JSONStringify = JSON.stringify;
  JSONParse = JSON.parse;
}
JSONStringify = JSONStringify || _.JSONEncode;
JSONParse = JSONParse || _.JSONDecode;
var SET_ACTION = '$set';
var SET_ONCE_ACTION = '$set_once';
var UNSET_ACTION = '$unset';
var ADD_ACTION = '$add';
var APPEND_ACTION = '$append';
var UNION_ACTION = '$union';
var REMOVE_ACTION = '$remove';
var DELETE_ACTION = '$delete';
var apiActions = {
  set_action: function (prop, to) {
    var data = {};
    var $set = {};
    if (_.isObject(prop)) {
      _.each(prop, function (v, k) {
        if (!this._is_reserved_property(k)) {
          $set[k] = v;
        }
      }, this);
    } else {
      $set[prop] = to;
    }
    data[SET_ACTION] = $set;
    return data;
  },
  unset_action: function (prop) {
    var data = {};
    var $unset = [];
    if (!_.isArray(prop)) {
      prop = [prop];
    }
    _.each(prop, function (k) {
      if (!this._is_reserved_property(k)) {
        $unset.push(k);
      }
    }, this);
    data[UNSET_ACTION] = $unset;
    return data;
  },
  set_once_action: function (prop, to) {
    var data = {};
    var $set_once = {};
    if (_.isObject(prop)) {
      _.each(prop, function (v, k) {
        if (!this._is_reserved_property(k)) {
          $set_once[k] = v;
        }
      }, this);
    } else {
      $set_once[prop] = to;
    }
    data[SET_ONCE_ACTION] = $set_once;
    return data;
  },
  union_action: function (list_name, values) {
    var data = {};
    var $union = {};
    if (_.isObject(list_name)) {
      _.each(list_name, function (v, k) {
        if (!this._is_reserved_property(k)) {
          $union[k] = _.isArray(v) ? v : [v];
        }
      }, this);
    } else {
      $union[list_name] = _.isArray(values) ? values : [values];
    }
    data[UNION_ACTION] = $union;
    return data;
  },
  append_action: function (list_name, value) {
    var data = {};
    var $append = {};
    if (_.isObject(list_name)) {
      _.each(list_name, function (v, k) {
        if (!this._is_reserved_property(k)) {
          $append[k] = v;
        }
      }, this);
    } else {
      $append[list_name] = value;
    }
    data[APPEND_ACTION] = $append;
    return data;
  },
  remove_action: function (list_name, value) {
    var data = {};
    var $remove = {};
    if (_.isObject(list_name)) {
      _.each(list_name, function (v, k) {
        if (!this._is_reserved_property(k)) {
          $remove[k] = v;
        }
      }, this);
    } else {
      $remove[list_name] = value;
    }
    data[REMOVE_ACTION] = $remove;
    return data;
  },
  delete_action: function () {
    var data = {};
    data[DELETE_ACTION] = '';
    return data;
  }
};
var MixpanelPeople = function () {};
_.extend(MixpanelPeople.prototype, apiActions);
MixpanelPeople.prototype._init = function (mixpanel_instance) {
  this._mixpanel = mixpanel_instance;
};
MixpanelPeople.prototype._send_request = function (data, callback) {
  data['$token'] = this._get_config('token');
  data['$distinct_id'] = this._mixpanel.get_distinct_id();
  var device_id = this._mixpanel.get_property('$device_id');
  var user_id = this._mixpanel.get_property('$user_id');
  var had_persisted_distinct_id = this._mixpanel.get_property('$had_persisted_distinct_id');
  if (device_id) {
    data['$device_id'] = device_id;
  }
  if (user_id) {
    data['$user_id'] = user_id;
  }
  if (had_persisted_distinct_id) {
    data['$had_persisted_distinct_id'] = had_persisted_distinct_id;
  }
  var date_encoded_data = _.encodeDates(data);
  if (!this._identify_called()) {
    this._enqueue(data);
    if (!_.isUndefined(callback)) {
      if (this._get_config('verbose')) {
        callback({
          status: -1,
          error: null
        });
      } else {
        callback(-1);
      }
    }
    return _.truncate(date_encoded_data, 255);
  }
  return this._mixpanel._track_or_batch({
    type: 'people',
    data: date_encoded_data,
    endpoint: this._mixpanel.get_api_host('people') + '/' + this._get_config('api_routes')['engage'],
    batcher: this._mixpanel.request_batchers.people
  }, callback);
};
MixpanelPeople.prototype._get_config = function (conf_var) {
  return this._mixpanel.get_config(conf_var);
};
MixpanelPeople.prototype._identify_called = function () {
  return this._mixpanel._flags.identify_called === true;
};
MixpanelPeople.prototype._enqueue = function (data) {
  if (SET_ACTION in data) {
    this._mixpanel['persistence']._add_to_people_queue(SET_ACTION, data);
  } else if (SET_ONCE_ACTION in data) {
    this._mixpanel['persistence']._add_to_people_queue(SET_ONCE_ACTION, data);
  } else if (UNSET_ACTION in data) {
    this._mixpanel['persistence']._add_to_people_queue(UNSET_ACTION, data);
  } else if (ADD_ACTION in data) {
    this._mixpanel['persistence']._add_to_people_queue(ADD_ACTION, data);
  } else if (APPEND_ACTION in data) {
    this._mixpanel['persistence']._add_to_people_queue(APPEND_ACTION, data);
  } else if (REMOVE_ACTION in data) {
    this._mixpanel['persistence']._add_to_people_queue(REMOVE_ACTION, data);
  } else if (UNION_ACTION in data) {
    this._mixpanel['persistence']._add_to_people_queue(UNION_ACTION, data);
  } else {
    console.error('Invalid call to _enqueue():', data);
  }
};
MixpanelPeople.prototype._is_reserved_property = function (prop) {
  return prop === '$distinct_id' || prop === '$token' || prop === '$device_id' || prop === '$user_id' || prop === '$had_persisted_distinct_id';
};
var SET_QUEUE_KEY = '__mps';
var SET_ONCE_QUEUE_KEY = '__mpso';
var UNSET_QUEUE_KEY = '__mpus';
var ADD_QUEUE_KEY = '__mpa';
var APPEND_QUEUE_KEY = '__mpap';
var REMOVE_QUEUE_KEY = '__mpr';
var UNION_QUEUE_KEY = '__mpu';
var MixpanelPersistence = function (config) {
  this['props'] = {};
  this.campaign_params_saved = false;
  if (config['persistence_name']) {
    this.name = 'mp_' + config['persistence_name'];
  } else {
    this.name = 'mp_' + config['token'] + '_mixpanel';
  }
  var storage_type = config['persistence'];
  if (storage_type !== 'cookie' && storage_type !== 'localStorage') {
    console.critical('Unknown persistence type ' + storage_type + '; falling back to cookie');
    storage_type = config['persistence'] = 'cookie';
  }
  if (storage_type === 'localStorage' && _.localStorage.is_supported()) {
    this.storage = _.localStorage;
  } else {
    this.storage = _.cookie;
  }
  this.load();
  this.update_config(config);
  this.upgrade();
  this.save();
};
MixpanelPersistence.prototype._add_to_people_queue = function (queue, data) {
  var q_key = this._get_queue_key(queue),
    q_data = data[queue],
    set_q = this._get_or_create_queue(SET_ACTION),
    set_once_q = this._get_or_create_queue(SET_ONCE_ACTION),
    unset_q = this._get_or_create_queue(UNSET_ACTION),
    add_q = this._get_or_create_queue(ADD_ACTION),
    union_q = this._get_or_create_queue(UNION_ACTION),
    remove_q = this._get_or_create_queue(REMOVE_ACTION, []),
    append_q = this._get_or_create_queue(APPEND_ACTION, []);
  if (q_key === SET_QUEUE_KEY) {
    _.extend(set_q, q_data);
    this._pop_from_people_queue(ADD_ACTION, q_data);
    this._pop_from_people_queue(UNION_ACTION, q_data);
    this._pop_from_people_queue(UNSET_ACTION, q_data);
  } else if (q_key === SET_ONCE_QUEUE_KEY) {
    _.each(q_data, function (v, k) {
      if (!(k in set_once_q)) {
        set_once_q[k] = v;
      }
    });
    this._pop_from_people_queue(UNSET_ACTION, q_data);
  } else if (q_key === UNSET_QUEUE_KEY) {
    _.each(q_data, function (prop) {
      _.each([set_q, set_once_q, add_q, union_q], function (enqueued_obj) {
        if (prop in enqueued_obj) {
          delete enqueued_obj[prop];
        }
      });
      _.each(append_q, function (append_obj) {
        if (prop in append_obj) {
          delete append_obj[prop];
        }
      });
      unset_q[prop] = true;
    });
  } else if (q_key === ADD_QUEUE_KEY) {
    _.each(q_data, function (v, k) {
      if (k in set_q) {
        set_q[k] += v;
      } else {
        if (!(k in add_q)) {
          add_q[k] = 0;
        }
        add_q[k] += v;
      }
    }, this);
    this._pop_from_people_queue(UNSET_ACTION, q_data);
  } else if (q_key === UNION_QUEUE_KEY) {
    _.each(q_data, function (v, k) {
      if (_.isArray(v)) {
        if (!(k in union_q)) {
          union_q[k] = [];
        }
        _.each(v, function (item) {
          if (!_.include(union_q[k], item)) {
            union_q[k].push(item);
          }
        });
      }
    });
    this._pop_from_people_queue(UNSET_ACTION, q_data);
  } else if (q_key === REMOVE_QUEUE_KEY) {
    remove_q.push(q_data);
    this._pop_from_people_queue(APPEND_ACTION, q_data);
  } else if (q_key === APPEND_QUEUE_KEY) {
    append_q.push(q_data);
    this._pop_from_people_queue(UNSET_ACTION, q_data);
  }
  console.log('MIXPANEL PEOPLE REQUEST (QUEUED, PENDING IDENTIFY):');
  console.log(data);
  this.save();
};
MixpanelPersistence.prototype._pop_from_people_queue = function (queue, data) {
  var q = this['props'][this._get_queue_key(queue)];
  if (!_.isUndefined(q)) {
    _.each(data, function (v, k) {
      if (queue === APPEND_ACTION || queue === REMOVE_ACTION) {
        _.each(q, function (queued_action) {
          if (queued_action[k] === v) {
            delete queued_action[k];
          }
        });
      } else {
        delete q[k];
      }
    }, this);
  }
};
MixpanelPersistence.prototype._get_queue_key = function (queue) {
  if (queue === SET_ACTION) {
    return SET_QUEUE_KEY;
  } else if (queue === SET_ONCE_ACTION) {
    return SET_ONCE_QUEUE_KEY;
  } else if (queue === UNSET_ACTION) {
    return UNSET_QUEUE_KEY;
  } else if (queue === ADD_ACTION) {
    return ADD_QUEUE_KEY;
  } else if (queue === APPEND_ACTION) {
    return APPEND_QUEUE_KEY;
  } else if (queue === REMOVE_ACTION) {
    return REMOVE_QUEUE_KEY;
  } else if (queue === UNION_ACTION) {
    return UNION_QUEUE_KEY;
  } else {
    console.error('Invalid queue:', queue);
  }
};
MixpanelPersistence.prototype._get_or_create_queue = function (queue, default_val) {
  var key = this._get_queue_key(queue);
  default_val = _.isUndefined(default_val) ? {} : default_val;
  return this['props'][key] || (this['props'][key] = default_val);
};
var init_type;
var mixpanel_master;
var INIT_MODULE = 0;
var INIT_SNIPPET = 1;
var IDENTITY_FUNC = function (x) {
  return x;
};
var PRIMARY_INSTANCE_NAME = 'mixpanel';
var PAYLOAD_TYPE_BASE64 = 'base64';
var PAYLOAD_TYPE_JSON = 'json';
var DEVICE_ID_PREFIX = '$device:';
var USE_XHR = win.XMLHttpRequest && 'withCredentials' in new XMLHttpRequest();
var ENQUEUE_REQUESTS = !USE_XHR && userAgent.indexOf('MSIE') === -1 && userAgent.indexOf('Mozilla') === -1;
var sendBeacon = null;
if (navigator['sendBeacon']) {
  sendBeacon = function () {
    return navigator['sendBeacon'].apply(navigator, arguments);
  };
}
var DEFAULT_API_ROUTES = {
  track: 'track/',
  engage: 'engage/',
  groups: 'groups/',
  record: 'record/',
  flags: 'flags/'
};
var DEFAULT_CONFIG = {
  api_host: 'https://api-js.mixpanel.com',
  api_hosts: {},
  api_routes: DEFAULT_API_ROUTES,
  api_extra_query_params: {},
  api_method: 'POST',
  api_transport: 'XHR',
  api_payload_format: PAYLOAD_TYPE_BASE64,
  app_host: 'https://mixpanel.com',
  autocapture: false,
  cdn: 'https://cdn.mxpnl.com',
  cross_site_cookie: false,
  cross_subdomain_cookie: true,
  error_reporter: NOOP_FUNC,
  flags: false,
  persistence: 'cookie',
  persistence_name: '',
  cookie_domain: '',
  cookie_name: '',
  loaded: NOOP_FUNC,
  mp_loader: null,
  track_marketing: true,
  track_pageview: false,
  skip_first_touch_marketing: false,
  store_google: true,
  stop_utm_persistence: false,
  save_referrer: true,
  test: false,
  verbose: false,
  img: false,
  debug: false,
  track_links_timeout: 300,
  cookie_expiration: 365,
  upgrade: false,
  disable_persistence: false,
  disable_cookie: false,
  secure_cookie: false,
  ip: true,
  opt_out_tracking_by_default: false,
  opt_out_persistence_by_default: false,
  opt_out_tracking_persistence_type: 'localStorage',
  opt_out_tracking_cookie_prefix: null,
  property_blacklist: [],
  xhr_headers: {},
  ignore_dnt: false,
  batch_requests: true,
  batch_size: 50,
  batch_flush_interval_ms: 5000,
  batch_request_timeout_ms: 90000,
  batch_autostart: true,
  hooks: {},
  record_block_class: new RegExp('^(mp-block|fs-exclude|amp-block|rr-block|ph-no-capture)$'),
  record_block_selector: 'img, video, audio',
  record_canvas: false,
  record_collect_fonts: false,
  record_heatmap_data: false,
  record_idle_timeout_ms: 30 * 60 * 1000,
  record_mask_text_class: new RegExp('^(mp-mask|fs-mask|amp-mask|rr-mask|ph-mask)$'),
  record_mask_text_selector: '*',
  record_max_ms: MAX_RECORDING_MS,
  record_min_ms: 0,
  record_sessions_percent: 0,
  recorder_src: 'https://cdn.mxpnl.com/libs/mixpanel-recorder.min.js'
};
var DOM_LOADED = false;
var MixpanelLib = function () {};
var create_mplib = function (token, config, name) {
  var instance,
    target = name === PRIMARY_INSTANCE_NAME ? mixpanel_master : mixpanel_master[name];
  if (target && init_type === INIT_MODULE) {
    instance = target;
  } else {
    if (target && !_.isArray(target)) {
      console.error('You have already initialized ' + name);
      return;
    }
    instance = new MixpanelLib();
  }
  instance._cached_groups = {};
  instance._init(token, config, name);
  instance['people'] = new MixpanelPeople();
  instance['people']._init(instance);
  if (!instance.get_config('skip_first_touch_marketing')) {
    var utm_params = _.info.campaignParams(null);
    var initial_utm_params = {};
    var has_utm = false;
    _.each(utm_params, function (utm_value, utm_key) {
      initial_utm_params['initial_' + utm_key] = utm_value;
      if (utm_value) {
        has_utm = true;
      }
    });
    if (has_utm) {
      instance['people'].set_once(initial_utm_params);
    }
  }
  Config.DEBUG = Config.DEBUG || instance.get_config('debug');
  if (!_.isUndefined(target) && _.isArray(target)) {
    instance._execute_array.call(instance['people'], target['people']);
    instance._execute_array(target);
  }
  return instance;
};
MixpanelLib.prototype._init = function (token, config, name) {
  config = config || {};
  this['__loaded'] = true;
  this['config'] = {};
  var variable_features = {};
  if (!('api_payload_format' in config)) {
    var api_host = config['api_host'] || DEFAULT_CONFIG['api_host'];
    if (api_host.match(/\.mixpanel\.com/)) {
      variable_features['api_payload_format'] = PAYLOAD_TYPE_JSON;
    }
  }
  this.set_config(_.extend({}, DEFAULT_CONFIG, variable_features, config, {
    name: name,
    token: token,
    callback_fn: (name === PRIMARY_INSTANCE_NAME ? name : PRIMARY_INSTANCE_NAME + '.' + name) + '._jsc'
  }));
  this['_jsc'] = NOOP_FUNC;
  this.__dom_loaded_queue = [];
  this.__request_queue = [];
  this.__disabled_events = [];
  this._flags = {
    disable_all_events: false,
    identify_called: false
  };
  this.request_batchers = {};
  this['persistence'] = this['cookie'] = new MixpanelPersistence(this['config']);
  this.unpersisted_superprops = {};
  var uuid = _.UUID();
  if (!this.get_distinct_id()) {
    this.register_once({
      distinct_id: DEVICE_ID_PREFIX + uuid,
      $device_id: uuid
    }, '');
  }
  this._init_tab_id();
};
MixpanelLib.prototype._init_tab_id = function () {
  if (this.get_config('disable_persistence')) {
    console.log('Tab ID initialization skipped due to disable_persistence config');
  } else if (_.sessionStorage.is_supported()) {
    try {
      var key_suffix = this.get_config('name') + '_' + this.get_config('token');
      var tab_id_key = 'mp_tab_id_' + key_suffix;
      var should_generate_new_tab_id_key = 'mp_gen_new_tab_id_' + key_suffix;
      if (_.sessionStorage.get(should_generate_new_tab_id_key) || !_.sessionStorage.get(tab_id_key)) {
        _.sessionStorage.set(tab_id_key, '$tab-' + _.UUID());
      }
      _.sessionStorage.set(should_generate_new_tab_id_key, '1');
      this.tab_id = _.sessionStorage.get(tab_id_key);
      win.addEventListener('beforeunload', function () {
        _.sessionStorage.remove(should_generate_new_tab_id_key);
      });
    } catch (err) {
      this.report_error('Error initializing tab id', err);
    }
  } else {
    this.report_error('Session storage is not supported, cannot keep track of unique tab ID.');
  }
};
MixpanelLib.prototype._loaded = function () {
  this.get_config('loaded')(this);
  this._set_default_superprops();
  this['people'].set_once(this['persistence'].get_referrer_info());
  if (this.get_config('store_google') && this.get_config('stop_utm_persistence')) {
    var utm_params = _.info.campaignParams(null);
    _.each(utm_params, function (_utm_value, utm_key) {
      this.unregister(utm_key);
    }.bind(this));
  }
};
MixpanelLib.prototype._set_default_superprops = function () {
  this['persistence'].update_search_keyword(document$1.referrer);
  if (this.get_config('store_google') && !this.get_config('stop_utm_persistence')) {
    this.register(_.info.campaignParams());
  }
  if (this.get_config('save_referrer')) {
    this['persistence'].update_referrer_info(document$1.referrer);
  }
};
MixpanelLib.prototype._dom_loaded = function () {
  _.each(this.__dom_loaded_queue, function (item) {
    this._track_dom.apply(this, item);
  }, this);
  if (!this.has_opted_out_tracking()) {
    _.each(this.__request_queue, function (item) {
      this._send_request.apply(this, item);
    }, this);
  }
  delete this.__dom_loaded_queue;
  delete this.__request_queue;
};
MixpanelLib.prototype._track_dom = function (DomClass, args) {
  if (this.get_config('img')) {
    this.report_error("You can't use DOM tracking functions with img = true.");
    return false;
  }
  if (!DOM_LOADED) {
    this.__dom_loaded_queue.push([DomClass, args]);
    return false;
  }
  var dt = new DomClass().init(this);
  return dt.track.apply(dt, args);
};
MixpanelLib.prototype._prepare_callback = function (callback, data) {
  if (_.isUndefined(callback)) {
    return null;
  }
  if (USE_XHR) {
    var callback_function = function (response) {
      callback(response, data);
    };
    return callback_function;
  } else {
    var jsc = this['_jsc'];
    var randomized_cb = '' + Math.floor(Math.random() * 100000000);
    var callback_string = this.get_config('callback_fn') + '[' + randomized_cb + ']';
    jsc[randomized_cb] = function (response) {
      delete jsc[randomized_cb];
      callback(response, data);
    };
    return callback_string;
  }
};
MixpanelLib.prototype._send_request = function (url, data, options, callback) {
  var succeeded = true;
  if (ENQUEUE_REQUESTS) {
    this.__request_queue.push(arguments);
    return succeeded;
  }
  var DEFAULT_OPTIONS = {
    method: this.get_config('api_method'),
    transport: this.get_config('api_transport'),
    verbose: this.get_config('verbose')
  };
  var body_data = null;
  if (!callback && (_.isFunction(options) || typeof options === 'string')) {
    callback = options;
    options = null;
  }
  options = _.extend(DEFAULT_OPTIONS, options || {});
  if (!USE_XHR) {
    options.method = 'GET';
  }
  var use_post = options.method === 'POST';
  var use_sendBeacon = sendBeacon && use_post && options.transport.toLowerCase() === 'sendbeacon';
  var verbose_mode = options.verbose;
  if (data['verbose']) {
    verbose_mode = true;
  }
  if (this.get_config('test')) {
    data['test'] = 1;
  }
  if (verbose_mode) {
    data['verbose'] = 1;
  }
  if (this.get_config('img')) {
    data['img'] = 1;
  }
  if (!USE_XHR) {
    if (callback) {
      data['callback'] = callback;
    } else if (verbose_mode || this.get_config('test')) {
      data['callback'] = '(function(){})';
    }
  }
  data['ip'] = this.get_config('ip') ? 1 : 0;
  data['_'] = new Date().getTime().toString();
  if (use_post) {
    body_data = 'data=' + encodeURIComponent(data['data']);
    delete data['data'];
  }
  _.extend(data, this.get_config('api_extra_query_params'));
  url += '?' + _.HTTPBuildQuery(data);
  var lib = this;
  if ('img' in data) {
    var img = document$1.createElement('img');
    img.src = url;
    document$1.body.appendChild(img);
  } else if (use_sendBeacon) {
    try {
      succeeded = sendBeacon(url, body_data);
    } catch (e) {
      lib.report_error(e);
      succeeded = false;
    }
    try {
      if (callback) {
        callback(succeeded ? 1 : 0);
      }
    } catch (e) {
      lib.report_error(e);
    }
  } else if (USE_XHR) {
    try {
      var req = new XMLHttpRequest();
      req.open(options.method, url, true);
      var headers = this.get_config('xhr_headers');
      if (use_post) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
      _.each(headers, function (headerValue, headerName) {
        req.setRequestHeader(headerName, headerValue);
      });
      if (options.timeout_ms && typeof req.timeout !== 'undefined') {
        req.timeout = options.timeout_ms;
        var start_time = new Date().getTime();
      }
      req.withCredentials = true;
      req.onreadystatechange = function () {
        if (req.readyState === 4) {
          if (req.status === 200) {
            if (callback) {
              if (verbose_mode) {
                var response;
                try {
                  response = _.JSONDecode(req.responseText);
                } catch (e) {
                  lib.report_error(e);
                  if (options.ignore_json_errors) {
                    response = req.responseText;
                  } else {
                    return;
                  }
                }
                callback(response);
              } else {
                callback(Number(req.responseText));
              }
            }
          } else {
            var error;
            if (req.timeout && !req.status && new Date().getTime() - start_time >= req.timeout) {
              error = 'timeout';
            } else {
              error = 'Bad HTTP status: ' + req.status + ' ' + req.statusText;
            }
            lib.report_error(error);
            if (callback) {
              if (verbose_mode) {
                var response_headers = req['responseHeaders'] || {};
                callback({
                  status: 0,
                  httpStatusCode: req['status'],
                  error: error,
                  retryAfter: response_headers['Retry-After']
                });
              } else {
                callback(0);
              }
            }
          }
        }
      };
      req.send(body_data);
    } catch (e) {
      lib.report_error(e);
      succeeded = false;
    }
  } else {
    var script = document$1.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.defer = true;
    script.src = url;
    var s = document$1.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(script, s);
  }
  return succeeded;
};
MixpanelLib.prototype._execute_array = function (array) {
  var fn_name,
    alias_calls = [],
    other_calls = [],
    tracking_calls = [];
  _.each(array, function (item) {
    if (item) {
      fn_name = item[0];
      if (_.isArray(fn_name)) {
        tracking_calls.push(item);
      } else if (typeof item === 'function') {
        item.call(this);
      } else if (_.isArray(item) && fn_name === 'alias') {
        alias_calls.push(item);
      } else if (_.isArray(item) && fn_name.indexOf('track') !== -1 && typeof this[fn_name] === 'function') {
        tracking_calls.push(item);
      } else {
        other_calls.push(item);
      }
    }
  }, this);
  var execute = function (calls, context) {
    _.each(calls, function (item) {
      if (_.isArray(item[0])) {
        var caller = context;
        _.each(item, function (call) {
          caller = caller[call[0]].apply(caller, call.slice(1));
        });
      } else {
        this[item[0]].apply(this, item.slice(1));
      }
    }, context);
  };
  execute(alias_calls, this);
  execute(other_calls, this);
  execute(tracking_calls, this);
};
MixpanelLib.prototype._encode_data_for_request = function (data) {
  var encoded_data = JSONStringify(data);
  if (this.get_config('api_payload_format') === PAYLOAD_TYPE_BASE64) {
    encoded_data = _.base64Encode(encoded_data);
  }
  return {
    data: encoded_data
  };
};
MixpanelLib.prototype._track_or_batch = function (options, callback) {
  var truncated_data = _.truncate(options.data, 255);
  var endpoint = options.endpoint;
  var batcher = options.batcher;
  var should_send_immediately = options.should_send_immediately;
  var send_request_options = options.send_request_options || {};
  callback = callback || NOOP_FUNC;
  var request_enqueued_or_initiated = true;
  var send_request_immediately = _.bind(function () {
    if (!send_request_options.skip_hooks) {
      truncated_data = this._run_hook('before_send_' + options.type, truncated_data);
    }
    if (truncated_data) {
      console.log('MIXPANEL REQUEST:');
      console.log(truncated_data);
      return this._send_request(endpoint, this._encode_data_for_request(truncated_data), send_request_options, this._prepare_callback(callback, truncated_data));
    } else {
      return null;
    }
  }, this);
  if (this._batch_requests && !should_send_immediately) {
    batcher.enqueue(truncated_data).then(function (succeeded) {
      if (succeeded) {
        callback(1, truncated_data);
      } else {
        send_request_immediately();
      }
    });
  } else {
    request_enqueued_or_initiated = send_request_immediately();
  }
  return request_enqueued_or_initiated && truncated_data;
};
MixpanelLib.prototype._run_hook = function (hook_name) {
  var ret = (this['config']['hooks'][hook_name] || IDENTITY_FUNC).apply(this, slice.call(arguments, 1));
  if (typeof ret === 'undefined') {
    this.report_error(hook_name + ' hook did not return a value');
    ret = null;
  }
  return ret;
};
var instances = {};
var extend_mp = function () {
  _.each(instances, function (instance, name) {
    if (name !== PRIMARY_INSTANCE_NAME) {
      mixpanel_master[name] = instance;
    }
  });
  mixpanel_master['_'] = _;
};
var override_mp_init_func = function () {
  mixpanel_master['init'] = function (token, config, name) {
    if (name) {
      if (!mixpanel_master[name]) {
        mixpanel_master[name] = instances[name] = create_mplib(token, config, name);
        mixpanel_master[name]._loaded();
      }
      return mixpanel_master[name];
    } else {
      var instance = mixpanel_master;
      if (instances[PRIMARY_INSTANCE_NAME]) {
        instance = instances[PRIMARY_INSTANCE_NAME];
      } else if (token) {
        instance = create_mplib(token, config, PRIMARY_INSTANCE_NAME);
        instance._loaded();
        instances[PRIMARY_INSTANCE_NAME] = instance;
      }
      mixpanel_master = instance;
      if (init_type === INIT_SNIPPET) {
        win[PRIMARY_INSTANCE_NAME] = mixpanel_master;
      }
      extend_mp();
    }
  };
};
var add_dom_loaded_handler = function () {
  function dom_loaded_handler() {
    if (dom_loaded_handler.done) {
      return;
    }
    dom_loaded_handler.done = true;
    DOM_LOADED = true;
    ENQUEUE_REQUESTS = false;
    _.each(instances, function (inst) {
      inst._dom_loaded();
    });
  }
  function do_scroll_check() {
    try {
      document$1.documentElement.doScroll('left');
    } catch (e) {
      setTimeout(do_scroll_check, 1);
      return;
    }
    dom_loaded_handler();
  }
  if (document$1.addEventListener) {
    if (document$1.readyState === 'complete') {
      dom_loaded_handler();
    } else {
      document$1.addEventListener('DOMContentLoaded', dom_loaded_handler, false);
    }
  } else if (document$1.attachEvent) {
    document$1.attachEvent('onreadystatechange', dom_loaded_handler);
    var toplevel = false;
    try {
      toplevel = win.frameElement === null;
    } catch (e) {}
    if (document$1.documentElement.doScroll && toplevel) {
      do_scroll_check();
    }
  }
  _.register_event(win, 'load', dom_loaded_handler, true);
};
function init_as_module(bundle_loader) {
  init_type = INIT_MODULE;
  mixpanel_master = new MixpanelLib();
  override_mp_init_func();
  mixpanel_master['init']();
  add_dom_loaded_handler();
  return mixpanel_master;
}
function loadThrowError(src, _onload) {
  throw new Error('This build of Mixpanel only includes core SDK functionality, could not load ' + src);
}
var mixpanel = init_as_module(loadThrowError);
module.exports = mixpanel;