/**
 * Minipanel - A minimal Mixpanel client for browsers
 *
 * Features:
 * - track(), identify(), reset()
 * - register(), register_once(), unregister() - superproperties
 * - people.set(), set_once(), unset(), increment(), track_charge()
 *
 * ES6 Module
 */

const VERSION = '1.0.0';

const DEFAULT_CONFIG = {
    api_host: 'https://api.mixpanel.com',
    debug: false,
    persistence_name: null, // will default to 'mp_' + token
};

/**
 * Generate a UUID v4
 */
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Utility functions
 */
const includes = (str, needle) => str.indexOf(needle) !== -1;

const extend = (...args) => Object.assign({}, ...args);

/**
 * Truncate string values in an object to a maximum length
 * (Mixpanel limits string values to 255 characters)
 */
const truncate = (obj, length) => {
    if (typeof obj === 'string') {
        return obj.slice(0, length);
    } else if (Array.isArray(obj)) {
        return obj.map(val => truncate(val, length));
    } else if (obj !== null && typeof obj === 'object') {
        const ret = {};
        for (const [key, val] of Object.entries(obj)) {
            ret[key] = truncate(val, length);
        }
        return ret;
    }
    return obj;
};

/**
 * Browser detection utilities (from mixpanel-js)
 */
const browserInfo = {
    browser: function (user_agent, vendor, opera) {
        vendor = vendor || '';
        if (opera || includes(user_agent, ' OPR/')) {
            if (includes(user_agent, 'Mini')) {
                return 'Opera Mini';
            }
            return 'Opera';
        } else if (includes(user_agent, 'Edge') || includes(user_agent, 'Edg/')) {
            return 'Microsoft Edge';
        } else if (includes(user_agent, 'Chrome')) {
            return 'Chrome';
        } else if (includes(user_agent, 'CriOS')) {
            return 'Chrome iOS';
        } else if (includes(user_agent, 'FxiOS')) {
            return 'Firefox iOS';
        } else if (includes(vendor, 'Apple')) {
            if (includes(user_agent, 'Mobile')) {
                return 'Mobile Safari';
            }
            return 'Safari';
        } else if (includes(user_agent, 'Android')) {
            return 'Android Mobile';
        } else if (includes(user_agent, 'Firefox')) {
            return 'Firefox';
        } else if (includes(user_agent, 'Gecko')) {
            return 'Mozilla';
        } else {
            return '';
        }
    },

    browserVersion: function (userAgent, vendor, opera) {
        const browser = browserInfo.browser(userAgent, vendor, opera);
        const versionRegexs = {
            'Microsoft Edge': /Edge?\/(\d+(\.\d+)?)/,
            Chrome: /Chrome\/(\d+(\.\d+)?)/,
            'Chrome iOS': /CriOS\/(\d+(\.\d+)?)/,
            Safari: /Version\/(\d+(\.\d+)?)/,
            'Mobile Safari': /Version\/(\d+(\.\d+)?)/,
            Opera: /(Opera|OPR)\/(\d+(\.\d+)?)/,
            Firefox: /Firefox\/(\d+(\.\d+)?)/,
            'Firefox iOS': /FxiOS\/(\d+(\.\d+)?)/,
            'Android Mobile': /android\s(\d+(\.\d+)?)/,
            Mozilla: /rv:(\d+(\.\d+)?)/
        };
        const regex = versionRegexs[browser];
        if (regex === undefined) {
            return null;
        }
        const matches = userAgent.match(regex);
        if (!matches) {
            return null;
        }
        return parseFloat(matches[matches.length - 2]);
    },

    os: function (user_agent) {
        if (/Windows/i.test(user_agent)) {
            return 'Windows';
        } else if (/(iPhone|iPad|iPod)/.test(user_agent)) {
            return 'iOS';
        } else if (/Android/.test(user_agent)) {
            return 'Android';
        } else if (/Mac/i.test(user_agent)) {
            return 'Mac OS X';
        } else if (/Linux/.test(user_agent)) {
            return 'Linux';
        } else if (/CrOS/.test(user_agent)) {
            return 'Chrome OS';
        } else {
            return '';
        }
    },

    device: function (user_agent) {
        if (/iPad/.test(user_agent)) {
            return 'iPad';
        } else if (/iPhone/.test(user_agent)) {
            return 'iPhone';
        } else if (/Android/.test(user_agent)) {
            return 'Android';
        } else {
            return '';
        }
    },

    referringDomain: function (referrer) {
        const split = referrer.split('/');
        if (split.length >= 3) {
            return split[2];
        }
        return '';
    }
};

/**
 * Get default event properties
 */
function getDefaultProperties() {
    const userAgent = navigator.userAgent;
    const vendor = navigator.vendor || '';
    const windowOpera = window.opera;

    return {
        $os: browserInfo.os(userAgent),
        $browser: browserInfo.browser(userAgent, vendor, windowOpera),
        $referrer: document.referrer,
        $referring_domain: browserInfo.referringDomain(document.referrer),
        $device: browserInfo.device(userAgent),
        $current_url: window.location.href,
        $browser_version: browserInfo.browserVersion(userAgent, vendor, windowOpera),
        $screen_height: window.screen?.height,
        $screen_width: window.screen?.width,
        mp_lib: 'minipanel',
        $lib_version: VERSION,
    };
}

/**
 * Persistence layer using localStorage
 */
class Persistence {
    constructor(config) {
        this.config = config;
        this.name = config.persistence_name;
        this.props = {};
        this.load();
    }

    load() {
        try {
            const data = localStorage.getItem(this.name);
            if (data) {
                this.props = JSON.parse(data);
            }
        } catch (e) {
            if (this.config.debug) {
                console.error('Error loading persistence:', e);
            }
        }
    }

    save() {
        try {
            localStorage.setItem(this.name, JSON.stringify(this.props));
        } catch (e) {
            if (this.config.debug) {
                console.error('Error saving persistence:', e);
            }
        }
    }

    properties() {
        return {...this.props};
    }

    register(props) {
        Object.assign(this.props, props);
        this.save();
    }

    register_once(props) {
        const newProps = {};
        for (const [key, value] of Object.entries(props)) {
            if (!(key in this.props)) {
                newProps[key] = value;
            }
        }
        if (Object.keys(newProps).length > 0) {
            Object.assign(this.props, newProps);
            this.save();
        }
    }

    unregister(prop) {
        delete this.props[prop];
        this.save();
    }

    clear() {
        this.props = {};
        try {
            localStorage.removeItem(this.name);
        } catch (e) {
            if (this.config.debug) {
                console.error('Error clearing persistence:', e);
            }
        }
    }
}

/**
 * People API
 */
class People {
    constructor(mixpanel) {
        this.mixpanel = mixpanel;
    }

    set(prop, to, callback) {
        const distinct_id = this.mixpanel.get_distinct_id();
        if (!distinct_id) {
            if (this.mixpanel.config.debug) {
                console.error('people.set() called before identify');
            }
            callback && callback(new Error('No distinct_id'));
            return;
        }

        let data;
        if (typeof prop === 'object') {
            callback = to;
            data = {
                $set: prop,
                $token: this.mixpanel.token,
                $distinct_id: distinct_id
            };
        } else {
            data = {
                $set: { [prop]: to },
                $token: this.mixpanel.token,
                $distinct_id: distinct_id
            };
        }

        this.mixpanel._send_request('/engage', data, {}, callback);
    }

    set_once(prop, to, callback) {
        const distinct_id = this.mixpanel.get_distinct_id();
        if (!distinct_id) {
            if (this.mixpanel.config.debug) {
                console.error('people.set_once() called before identify');
            }
            callback && callback(new Error('No distinct_id'));
            return;
        }

        let data;
        if (typeof prop === 'object') {
            callback = to;
            data = {
                $set_once: prop,
                $token: this.mixpanel.token,
                $distinct_id: distinct_id
            };
        } else {
            data = {
                $set_once: { [prop]: to },
                $token: this.mixpanel.token,
                $distinct_id: distinct_id
            };
        }

        this.mixpanel._send_request('/engage', data, {}, callback);
    }

    unset(prop, callback) {
        const distinct_id = this.mixpanel.get_distinct_id();
        if (!distinct_id) {
            if (this.mixpanel.config.debug) {
                console.error('people.unset() called before identify');
            }
            callback && callback(new Error('No distinct_id'));
            return;
        }

        const props = Array.isArray(prop) ? prop : [prop];
        const data = {
            $unset: props,
            $token: this.mixpanel.token,
            $distinct_id: distinct_id
        };

        this.mixpanel._send_request('/engage', data, {}, callback);
    }

    increment(prop, by, callback) {
        const distinct_id = this.mixpanel.get_distinct_id();
        if (!distinct_id) {
            if (this.mixpanel.config.debug) {
                console.error('people.increment() called before identify');
            }
            callback && callback(new Error('No distinct_id'));
            return;
        }

        let $add = {};
        if (typeof prop === 'object') {
            callback = by;
            $add = prop;
        } else {
            if (typeof by === 'function') {
                callback = by;
                by = 1;
            }
            $add[prop] = by || 1;
        }

        const data = {
            $add: $add,
            $token: this.mixpanel.token,
            $distinct_id: distinct_id
        };

        this.mixpanel._send_request('/engage', data, {}, callback);
    }

    track_charge(amount, properties, callback) {
        const distinct_id = this.mixpanel.get_distinct_id();
        if (!distinct_id) {
            if (this.mixpanel.config.debug) {
                console.error('people.track_charge() called before identify');
            }
            callback && callback(new Error('No distinct_id'));
            return;
        }

        if (typeof properties === 'function') {
            callback = properties;
            properties = {};
        }
        properties = properties || {};

        if (typeof amount !== 'number') {
            amount = parseFloat(amount);
            if (isNaN(amount)) {
                if (this.mixpanel.config.debug) {
                    console.error('Invalid amount passed to people.track_charge');
                }
                callback && callback(new Error('Invalid amount'));
                return;
            }
        }

        properties.$amount = amount;
        if (properties.$time) {
            const time = properties.$time;
            if (time instanceof Date) {
                properties.$time = time.toISOString();
            }
        }

        const data = {
            $append: { $transactions: properties },
            $token: this.mixpanel.token,
            $distinct_id: distinct_id
        };

        this.mixpanel._send_request('/engage', data, {}, callback);
    }
}

/**
 * Main Mixpanel client
 */
function createClient(token, config) {
    if (!token) {
        throw new Error('Mixpanel token required');
    }

    const client = {
        token: token,
        config: extend({}, DEFAULT_CONFIG, config),
    };

    // Set default persistence name
    if (!client.config.persistence_name) {
        client.config.persistence_name = 'mon_' + token;
    }

    // Initialize persistence
    client.persistence = new Persistence(client.config);

    // Initialize device ID if not exists
    if (!client.persistence.props.distinct_id) {
        const device_id = generateUUID();
        client.persistence.register({
            distinct_id: '$device:' + device_id,
            $device_id: device_id
        });
    }

    // Initialize people API
    client.people = new People(client);

    /**
     * Send request to Mixpanel using fetch
     * Uses POST to avoid URL length limits
     */
    client._send_request = function(endpoint, data, options, callback) {
        callback = callback || function() {};

        // Truncate string values to 255 characters (Mixpanel limit)
        const truncated_data = truncate(data, 255);

        const base64Data = btoa(JSON.stringify(truncated_data));
        const url = `${client.config.api_host}${endpoint}/`;
        const body = 'data=' + encodeURIComponent(base64Data);

        if (client.config.debug) {
            console.log('Mixpanel request:', endpoint, truncated_data);
        }

        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body
        })
            .then(response => response.text())
            .then(text => {
                if (text === '1' || text === '"1"') {
                    callback({ status: 1 });
                } else {
                    const error = new Error('Mixpanel server error: ' + text);
                    if (client.config.debug) {
                        console.error(error);
                    }
                    callback(0);
                }
            })
            .catch(error => {
                if (client.config.debug) {
                    console.error('Mixpanel request error:', error);
                }
                callback(0);
            });
    };

    /**
     * Track an event
     */
    client.track = function(event_name, properties, callback) {
        if (typeof properties === 'function') {
            callback = properties;
            properties = {};
        }
        properties = properties || {};

        // Get all properties
        const all_properties = extend(
            {},
            getDefaultProperties(),
            client.persistence.properties(),
            properties,
            {
                token: client.token,
                time: Date.now() / 1000,
                distinct_id: client.get_distinct_id(),
                $insert_id: generateUUID().replace(/-/g, '')
            }
        );

        const data = {
            event: event_name,
            properties: all_properties
        };

        client._send_request('/track', data, {}, callback);
    };

    /**
     * Identify a user
     */
    client.identify = function(distinct_id) {
        const anon_id = client.persistence.props.distinct_id;

        client.persistence.register({
            distinct_id: distinct_id,
            $user_id: distinct_id
        });

        // Send $identify event
        const properties = {
            $anon_distinct_id: anon_id,
            distinct_id: distinct_id
        };
        client.track('$identify', properties);
    };

    /**
     * Register super properties
     */
    client.register = function(props) {
        client.persistence.register(props);
    };

    /**
     * Register super properties once
     */
    client.register_once = function(props) {
        client.persistence.register_once(props);
    };

    /**
     * Unregister a super property
     */
    client.unregister = function(prop) {
        client.persistence.unregister(prop);
    };

    /**
     * Reset the client (clear distinct_id and super properties)
     */
    client.reset = function() {
        client.persistence.clear();
        // Re-initialize with new device ID
        const device_id = generateUUID();
        client.persistence.register({
            distinct_id: '$device:' + device_id,
            $device_id: device_id
        });
    };

    /**
     * Get the current distinct_id
     */
    client.get_distinct_id = function() {
        return client.persistence.props.distinct_id;
    };

    /**
     * Get a super property value
     */
    client.get_property = function(prop) {
        return client.persistence.props[prop];
    };

    /**
     * Get config value
     */
    client.get_config = function(key) {
        return client.config[key];
    };

    /**
     * Set config values
     */
    client.set_config = function(config) {
        Object.assign(client.config, config);
    };

    return client;
}

// Export as ES6 module
export const init = createClient;
export default { init };
