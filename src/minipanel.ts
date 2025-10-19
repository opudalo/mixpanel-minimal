/**
 * Minipanel - A minimal Mixpanel client for browsers
 *
 * Features:
 * - track(), identify(), reset()
 * - register(), register_once(), unregister() - superproperties
 * - people.set(), set_once(), unset(), increment(), track_charge()
 *
 * TypeScript Module
 */

const VERSION = '1.0.0';

export interface MinipanelConfig {
    api_host?: string;
    debug?: boolean;
    persistence_name?: string | null;
}

const DEFAULT_CONFIG: Required<MinipanelConfig> = {
    api_host: 'https://api.mixpanel.com',
    debug: false,
    persistence_name: null,
};

export interface Properties {
    [key: string]: any;
}

export interface EventProperties extends Properties {
    $os?: string;
    $browser?: string;
    $browser_version?: number | null;
    $device?: string;
    $current_url?: string;
    $referrer?: string;
    $referring_domain?: string;
    $screen_height?: number;
    $screen_width?: number;
    mp_lib?: string;
    $lib_version?: string;
    time?: number;
    distinct_id?: string;
    $insert_id?: string;
    token?: string;
}

export interface PeopleProperties {
    [key: string]: any;
    $name?: string;
    $email?: string;
    $phone?: string;
    $avatar?: string;
}

export type MixpanelCallback = (response: any) => void;

export interface MixpanelPeople {
    set(prop: string, to: any, callback?: MixpanelCallback): void;
    set(properties: PeopleProperties, callback?: MixpanelCallback): void;
    set_once(prop: string, to: any, callback?: MixpanelCallback): void;
    set_once(properties: PeopleProperties, callback?: MixpanelCallback): void;
    unset(prop: string | string[], callback?: MixpanelCallback): void;
    increment(prop: string, by?: number, callback?: MixpanelCallback): void;
    increment(properties: Record<string, number>, callback?: MixpanelCallback): void;
    track_charge(amount: number, properties?: Properties, callback?: MixpanelCallback): void;
}

export interface MinipanelInstance {
    token: string;
    config: Required<MinipanelConfig>;
    people: MixpanelPeople;
    track(event_name: string, properties?: Properties, callback?: MixpanelCallback): void;
    identify(distinct_id: string): void;
    register(props: Properties): void;
    register_once(props: Properties): void;
    unregister(prop: string): void;
    reset(): void;
    get_distinct_id(): string;
    get_property(prop: string): any;
    get_config(key: keyof MinipanelConfig): any;
    set_config(config: Partial<MinipanelConfig>): void;
}

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
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
const includes = (str: string, needle: string): boolean => str.indexOf(needle) !== -1;

const extend = (...args: any[]): any => Object.assign({}, ...args);

/**
 * Truncate string values in an object to a maximum length
 * (Mixpanel limits string values to 255 characters)
 */
const truncate = (obj: any, length: number): any => {
    if (typeof obj === 'string') {
        return obj.slice(0, length);
    } else if (Array.isArray(obj)) {
        return obj.map(val => truncate(val, length));
    } else if (obj !== null && typeof obj === 'object') {
        const ret: any = {};
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
    browser: function (user_agent: string, vendor?: string, opera?: any): string {
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

    browserVersion: function (userAgent: string, vendor?: string, opera?: any): number | null {
        const browser = browserInfo.browser(userAgent, vendor, opera);
        const versionRegexs: Record<string, RegExp> = {
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

    os: function (user_agent: string): string {
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

    device: function (user_agent: string): string {
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

    referringDomain: function (referrer: string): string {
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
function getDefaultProperties(): EventProperties {
    const userAgent = navigator.userAgent;
    const vendor = navigator.vendor || '';
    const windowOpera = (window as any).opera;

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
    private config: Required<MinipanelConfig>;
    private name: string;
    public props: Properties;

    constructor(config: Required<MinipanelConfig>) {
        this.config = config;
        this.name = config.persistence_name!;
        this.props = {};
        this.load();
    }

    load(): void {
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

    save(): void {
        try {
            localStorage.setItem(this.name, JSON.stringify(this.props));
        } catch (e) {
            if (this.config.debug) {
                console.error('Error saving persistence:', e);
            }
        }
    }

    properties(): Properties {
        return {...this.props};
    }

    register(props: Properties): void {
        Object.assign(this.props, props);
        this.save();
    }

    register_once(props: Properties): void {
        const newProps: Properties = {};
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

    unregister(prop: string): void {
        delete this.props[prop];
        this.save();
    }

    clear(): void {
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
class People implements MixpanelPeople {
    private mixpanel: any;

    constructor(mixpanel: any) {
        this.mixpanel = mixpanel;
    }

    set(prop: string | PeopleProperties, to?: any, callback?: MixpanelCallback): void {
        const distinct_id = this.mixpanel.get_distinct_id();
        if (!distinct_id) {
            if (this.mixpanel.config.debug) {
                console.error('people.set() called before identify');
            }
            callback && callback(new Error('No distinct_id'));
            return;
        }

        let cb: MixpanelCallback | undefined = callback;
        let data: any;
        if (typeof prop === 'object') {
            cb = to;
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

        this.mixpanel._send_request('/engage', data, {}, cb);
    }

    set_once(prop: string | PeopleProperties, to?: any, callback?: MixpanelCallback): void {
        const distinct_id = this.mixpanel.get_distinct_id();
        if (!distinct_id) {
            if (this.mixpanel.config.debug) {
                console.error('people.set_once() called before identify');
            }
            callback && callback(new Error('No distinct_id'));
            return;
        }

        let cb: MixpanelCallback | undefined = callback;
        let data: any;
        if (typeof prop === 'object') {
            cb = to;
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

        this.mixpanel._send_request('/engage', data, {}, cb);
    }

    unset(prop: string | string[], callback?: MixpanelCallback): void {
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

    increment(prop: string | Record<string, number>, by?: number | MixpanelCallback, callback?: MixpanelCallback): void {
        const distinct_id = this.mixpanel.get_distinct_id();
        if (!distinct_id) {
            if (this.mixpanel.config.debug) {
                console.error('people.increment() called before identify');
            }
            callback && callback(new Error('No distinct_id'));
            return;
        }

        let cb: MixpanelCallback | undefined = callback;
        let $add: Record<string, number> = {};
        if (typeof prop === 'object') {
            cb = by as MixpanelCallback;
            $add = prop;
        } else {
            if (typeof by === 'function') {
                cb = by;
                by = 1;
            }
            $add[prop] = (by as number) || 1;
        }

        const data = {
            $add: $add,
            $token: this.mixpanel.token,
            $distinct_id: distinct_id
        };

        this.mixpanel._send_request('/engage', data, {}, cb);
    }

    track_charge(amount: number, properties?: Properties | MixpanelCallback, callback?: MixpanelCallback): void {
        const distinct_id = this.mixpanel.get_distinct_id();
        if (!distinct_id) {
            if (this.mixpanel.config.debug) {
                console.error('people.track_charge() called before identify');
            }
            callback && callback(new Error('No distinct_id'));
            return;
        }

        let cb: MixpanelCallback | undefined = callback;
        let props: Properties = {};

        if (typeof properties === 'function') {
            cb = properties as MixpanelCallback;
            props = {};
        } else {
            props = properties || {};
        }

        if (typeof amount !== 'number') {
            amount = parseFloat(amount as any);
            if (isNaN(amount)) {
                if (this.mixpanel.config.debug) {
                    console.error('Invalid amount passed to people.track_charge');
                }
                cb && cb(new Error('Invalid amount'));
                return;
            }
        }

        props.$amount = amount;
        if (props.$time) {
            const time = props.$time;
            if (time instanceof Date) {
                props.$time = time.toISOString();
            }
        }

        const data = {
            $append: { $transactions: props },
            $token: this.mixpanel.token,
            $distinct_id: distinct_id
        };

        this.mixpanel._send_request('/engage', data, {}, cb);
    }
}

/**
 * Main Mixpanel client
 */
function createClient(token: string, config?: MinipanelConfig): MinipanelInstance {
    if (!token) {
        throw new Error('Mixpanel token required');
    }

    const client: any = {
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
    client._send_request = function(endpoint: string, data: any, options: any, callback?: MixpanelCallback): void {
        const cb: MixpanelCallback = callback || function() {};

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
                    cb({ status: 1 });
                } else {
                    const error = new Error('Mixpanel server error: ' + text);
                    if (client.config.debug) {
                        console.error(error);
                    }
                    cb(0);
                }
            })
            .catch(error => {
                if (client.config.debug) {
                    console.error('Mixpanel request error:', error);
                }
                cb(0);
            });
    };

    /**
     * Track an event
     */
    client.track = function(event_name: string, properties?: Properties | MixpanelCallback, callback?: MixpanelCallback): void {
        let cb: MixpanelCallback | undefined = callback;
        let props: Properties = {};

        if (typeof properties === 'function') {
            cb = properties as MixpanelCallback;
            props = {};
        } else {
            props = properties || {};
        }

        // Get all properties
        const all_properties = extend(
            {},
            getDefaultProperties(),
            client.persistence.properties(),
            props,
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

        client._send_request('/track', data, {}, cb);
    };

    /**
     * Identify a user
     */
    client.identify = function(distinct_id: string): void {
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
    client.register = function(props: Properties): void {
        client.persistence.register(props);
    };

    /**
     * Register super properties once
     */
    client.register_once = function(props: Properties): void {
        client.persistence.register_once(props);
    };

    /**
     * Unregister a super property
     */
    client.unregister = function(prop: string): void {
        client.persistence.unregister(prop);
    };

    /**
     * Reset the client (clear distinct_id and super properties)
     */
    client.reset = function(): void {
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
    client.get_distinct_id = function(): string {
        return client.persistence.props.distinct_id;
    };

    /**
     * Get a super property value
     */
    client.get_property = function(prop: string): any {
        return client.persistence.props[prop];
    };

    /**
     * Get config value
     */
    client.get_config = function(key: keyof MinipanelConfig): any {
        return client.config[key];
    };

    /**
     * Set config values
     */
    client.set_config = function(config: Partial<MinipanelConfig>): void {
        Object.assign(client.config, config);
    };

    return client as MinipanelInstance;
}

// Export as ES6 module
export const init = createClient;
export default { init };
