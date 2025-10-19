/**
 * Type definitions for Minipanel
 * A minimal Mixpanel client for browsers
 */

export interface MinipanelConfig {
    /**
     * Mixpanel API host URL
     * @default "https://api.mixpanel.com"
     */
    api_host?: string;

    /**
     * Enable debug logging to console
     * @default false
     */
    debug?: boolean;

    /**
     * Custom localStorage key name for persistence
     * @default "mon_<token>"
     */
    persistence_name?: string | null;
}

export interface Properties {
    [key: string]: any;
}

/**
 * Event properties that are automatically included with every event
 */
export interface EventProperties extends Properties {
    /** Operating system (e.g., "Mac OS X", "Windows", "iOS") */
    $os?: string;

    /** Browser name (e.g., "Chrome", "Safari", "Firefox") */
    $browser?: string;

    /** Browser version number */
    $browser_version?: number | null;

    /** Device type (e.g., "iPhone", "iPad", "Android") */
    $device?: string;

    /** Current page URL */
    $current_url?: string;

    /** Referrer URL */
    $referrer?: string;

    /** Referring domain */
    $referring_domain?: string;

    /** Screen height in pixels */
    $screen_height?: number;

    /** Screen width in pixels */
    $screen_width?: number;

    /** Library name ("minipanel") */
    mp_lib?: string;

    /** Library version */
    $lib_version?: string;

    /** Event timestamp (seconds since epoch) */
    time?: number;

    /** User identifier */
    distinct_id?: string;

    /** Unique event ID for deduplication */
    $insert_id?: string;

    /** Mixpanel project token */
    token?: string;
}

/**
 * User profile properties for People API
 */
export interface PeopleProperties {
    [key: string]: any;

    /** User's full name */
    $name?: string;

    /** User's email address */
    $email?: string;

    /** User's phone number */
    $phone?: string;

    /** User's avatar URL */
    $avatar?: string;
}

/**
 * Callback function for Mixpanel API requests
 * @param response - Response object with status, or error code (0) on failure
 */
export type MixpanelCallback = (response: any) => void;

/**
 * Mixpanel People API for managing user profiles
 */
export interface MixpanelPeople {
    /**
     * Set a user profile property
     * @param prop - Property name or properties object
     * @param to - Property value (if prop is a string)
     * @param callback - Optional callback function
     * @example
     * mixpanel.people.set('name', 'John Doe');
     * mixpanel.people.set({ name: 'John Doe', email: 'john@example.com' });
     */
    set(prop: string, to: any, callback?: MixpanelCallback): void;
    set(properties: PeopleProperties, callback?: MixpanelCallback): void;

    /**
     * Set a user profile property only if it doesn't already exist
     * @param prop - Property name or properties object
     * @param to - Property value (if prop is a string)
     * @param callback - Optional callback function
     * @example
     * mixpanel.people.set_once('first_login', '2025-01-01');
     */
    set_once(prop: string, to: any, callback?: MixpanelCallback): void;
    set_once(properties: PeopleProperties, callback?: MixpanelCallback): void;

    /**
     * Remove a user profile property
     * @param prop - Property name or array of property names
     * @param callback - Optional callback function
     * @example
     * mixpanel.people.unset('temp_property');
     * mixpanel.people.unset(['prop1', 'prop2']);
     */
    unset(prop: string | string[], callback?: MixpanelCallback): void;

    /**
     * Increment a numeric user profile property
     * @param prop - Property name or properties object with numeric values
     * @param by - Amount to increment by (default: 1)
     * @param callback - Optional callback function
     * @example
     * mixpanel.people.increment('page_views');
     * mixpanel.people.increment('page_views', 5);
     * mixpanel.people.increment({ page_views: 1, clicks: 3 });
     */
    increment(prop: string, by?: number, callback?: MixpanelCallback): void;
    increment(properties: Record<string, number>, callback?: MixpanelCallback): void;

    /**
     * Track a revenue transaction for the user
     * @param amount - Transaction amount
     * @param properties - Optional transaction properties
     * @param callback - Optional callback function
     * @example
     * mixpanel.people.track_charge(29.99, { product: 'Premium Plan' });
     */
    track_charge(amount: number, properties?: Properties, callback?: MixpanelCallback): void;
}

/**
 * Main Minipanel instance
 */
export interface MinipanelInstance {
    /** Mixpanel project token */
    token: string;

    /** Current configuration */
    config: Required<MinipanelConfig>;

    /** People API for managing user profiles */
    people: MixpanelPeople;

    /**
     * Track an event
     * @param event_name - Name of the event to track
     * @param properties - Optional event properties
     * @param callback - Optional callback function
     * @example
     * mixpanel.track('Page View');
     * mixpanel.track('Purchase', { product: 'Widget', price: 29.99 });
     */
    track(event_name: string, properties?: Properties, callback?: MixpanelCallback): void;

    /**
     * Identify a user and link anonymous events to their profile
     * @param distinct_id - Unique user identifier
     * @example
     * mixpanel.identify('user-123');
     */
    identify(distinct_id: string): void;

    /**
     * Register super properties that will be included with every event
     * @param props - Properties to register
     * @example
     * mixpanel.register({ plan: 'premium', version: '2.0' });
     */
    register(props: Properties): void;

    /**
     * Register super properties only if they don't already exist
     * @param props - Properties to register once
     * @example
     * mixpanel.register_once({ first_visit: '2025-01-01' });
     */
    register_once(props: Properties): void;

    /**
     * Remove a super property
     * @param prop - Property name to remove
     * @example
     * mixpanel.unregister('temp_property');
     */
    unregister(prop: string): void;

    /**
     * Reset the client (clear user identity and super properties)
     * Generates a new device ID
     * @example
     * mixpanel.reset(); // Call on logout
     */
    reset(): void;

    /**
     * Get the current distinct_id
     * @returns The current user identifier or device ID
     * @example
     * const userId = mixpanel.get_distinct_id();
     */
    get_distinct_id(): string;

    /**
     * Get a super property value
     * @param prop - Property name
     * @returns The property value or undefined
     * @example
     * const plan = mixpanel.get_property('plan');
     */
    get_property(prop: string): any;

    /**
     * Get a configuration value
     * @param key - Configuration key
     * @returns The configuration value
     * @example
     * const debug = mixpanel.get_config('debug');
     */
    get_config(key: keyof MinipanelConfig): any;

    /**
     * Update configuration values
     * @param config - Configuration object with values to update
     * @example
     * mixpanel.set_config({ debug: true });
     */
    set_config(config: Partial<MinipanelConfig>): void;
}

/**
 * Initialize a Minipanel instance
 * @param token - Mixpanel project token (required)
 * @param config - Optional configuration object
 * @returns Initialized Minipanel instance
 * @example
 * import { init } from './minipanel';
 *
 * const mixpanel = init('YOUR_PROJECT_TOKEN', {
 *   api_host: 'https://api.mixpanel.com',
 *   debug: false
 * });
 *
 * mixpanel.track('Page View');
 * mixpanel.identify('user-123');
 * mixpanel.people.set({ $name: 'John Doe', $email: 'john@example.com' });
 */
export function init(token: string, config?: MinipanelConfig): MinipanelInstance;

export default {
    init: typeof init
};
