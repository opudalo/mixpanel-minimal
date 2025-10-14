// Modern _ utility (2025)
var _ = {
  // String methods
  trim: function (str) {
    return str.trim();
  },
  // Core iteration
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
  // Function binding
  bind: function (func, context) {
    return func.bind.apply(func, [context].concat(Array.prototype.slice.call(arguments, 2)));
  },
  // Object extension
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
  // Array methods
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
  // Type checking
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
  // Inheritance
  inherit: function (subclass, superclass) {
    subclass.prototype = Object.create(superclass.prototype);
    subclass.prototype.constructor = subclass;
    subclass.superclass = superclass.prototype;
    return subclass;
  },
  // Date/Time
  timestamp: function () {
    return Date.now();
  },
  formatDate: function (d) {
    function pad(n) { return n < 10 ? '0' + n : n; }
    return d.getUTCFullYear() + '-' +
           pad(d.getUTCMonth() + 1) + '-' +
           pad(d.getUTCDate()) + 'T' +
           pad(d.getUTCHours()) + ':' +
           pad(d.getUTCMinutes()) + ':' +
           pad(d.getUTCSeconds());
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
  // Data manipulation
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
      return obj.map(function(val) { return _.truncate(val, length); });
    } else if (_.isObject(obj)) {
      var ret = {};
      _.each(obj, function (val, key) {
        ret[key] = _.truncate(val, length);
      });
      return ret;
    }
    return obj;
  },
  // JSON (use native)
  JSONEncode: function (obj) {
    return JSON.stringify(obj);
  },
  JSONDecode: function (str) {
    try {
      return JSON.parse(str);
    } catch(e) {
      return null;
    }
  },
  // Base64 encoding - use native when available, fallback for compatibility
  utf8Encode: function (string) {
    string = (string + '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    var utftext = '', start, end;
    var stringl = 0, n;
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

    // Try native btoa first
    if (typeof btoa === 'function') {
      try {
        return btoa(_.utf8Encode(data));
      } catch(e) {
        // fallback to manual implementation
      }
    }

    // Fallback implementation
    var b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    var o1, o2, o3, h1, h2, h3, h4, bits, i = 0, ac = 0, enc = '', tmp_arr = [];
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
  // UUID generation
  UUID: function () {
    try {
      // use native Crypto API when available
      return win['crypto']['randomUUID']();
    } catch (err) {
      // fall back to generating our own UUID
      var uuid = new Array(36);
      for (var i = 0; i < 36; i++) {
        uuid[i] = Math.floor(Math.random() * 16);
      }
      uuid[14] = 4; // set bits 12-15 of time-high-and-version to 0100
      uuid[19] = uuid[19] &= -5; // set bit 6 of clock-seq-and-reserved to zero
      uuid[19] = uuid[19] |= 1 << 3; // set bit 7 of clock-seq-and-reserved to one
      uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
      return _.map(uuid, function(x) {
        return x.toString(16);
      }).join('');
    }
  },
  // User agent blocking
  isBlockedUA: function (ua) {
    var BLOCKED_UA_STRS = [
      'ahrefsbot', 'ahrefssiteaudit', 'amazonbot', 'baiduspider', 'bingbot',
      'bingpreview', 'chrome-lighthouse', 'facebookexternal', 'petalbot',
      'pinterest', 'screaming frog', 'yahoo! slurp', 'yandex',
      'adsbot-google', 'apis-google', 'duplexweb-google', 'feedfetcher-google',
      'google favicon', 'google web preview', 'google-read-aloud', 'googlebot',
      'googleweblight', 'mediapartners-google', 'storebot-google'
    ];
    ua = ua.toLowerCase();
    for (var i = 0; i < BLOCKED_UA_STRS.length; i++) {
      if (ua.indexOf(BLOCKED_UA_STRS[i]) !== -1) {
        return true;
      }
    }
    return false;
  },
  // HTTP query building
  HTTPBuildQuery: function (formdata, arg_separator) {
    var use_val, use_key, tmp_arr = [];
    if (_.isUndefined(arg_separator)) {
      arg_separator = '&';
    }
    _.each(formdata, function(val, key) {
      use_val = encodeURIComponent(val.toString());
      use_key = encodeURIComponent(key);
      tmp_arr[tmp_arr.length] = use_key + '=' + use_val;
    });
    return tmp_arr.join(arg_separator);
  },
  // Query param extraction
  getQueryParam: function (url, param) {
    // Modern approach using URLSearchParams when possible
    try {
      var urlObj = new URL(url, window.location.href);
      var value = urlObj.searchParams.get(param);
      return value || '';
    } catch(e) {
      // Fallback for invalid URLs or older browsers
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
        } catch(err) {
          console.error('Skipping decoding for malformed query param: ' + result);
        }
        return result.replace(/\+/g, ' ');
      }
    }
  },
  // Cookie management - keep original implementation (complex browser-specific)
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
      } catch(err) {
        // noop
      }
      return cookie;
    },
    set_seconds: function (name, value, seconds, is_cross_subdomain, is_secure, is_cross_site, domain_override) {
      var cdomain = '', expires = '', secure = '';
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
      var cdomain = '', expires = '', secure = '';
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
  // Modern DOM query - replaces 190 lines of IE5 workarounds!
  dom_query: function (query) {
    if (_.isElement(query)) {
      return [query];
    } else if (_.isObject(query) && !_.isUndefined(query.length)) {
      return query;
    } else {
      return document.querySelectorAll(query);
    }
  },
  // Modern event registration - replaces 67 lines of IE5 workarounds!
  register_event: function (element, type, handler, oldSchool, useCapture) {
    if (!element) {
      console.error('No valid element provided to register_event');
      return;
    }
    element.addEventListener(type, handler, !!useCapture);
  },
  // These will be filled in from the original code
  localStorage: null,
  sessionStorage: null,
  info: null
};
