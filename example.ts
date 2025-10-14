/**
 * Example file showing which Mixpanel methods we actually use
 * The usage-tracker will scan this to determine what to keep
 */

import mixpanel from 'mixpanel-browser';

// Initialize Mixpanel
export function initAnalytics() {
  mixpanel.init('YOUR_TOKEN', {
    debug: false,
    track_pageview: true,
    persistence: 'localStorage'
  });
}

// Track events
export function trackEvent(eventName: string, properties?: Record<string, any>) {
  mixpanel.track(eventName, properties);
}

// Identify users
export function identifyUser(userId: string) {
  mixpanel.identify(userId);
}

// Set user properties
export function setUserProperties(properties: Record<string, any>) {
  mixpanel.people.set(properties);
}

// Track revenue
export function trackPurchase(amount: number, properties?: Record<string, any>) {
  mixpanel.track('Purchase', {
    amount,
    ...properties
  });

  mixpanel.people.track_charge(amount, properties);
}

// Reset on logout
export function logout() {
  mixpanel.reset();
}

// Register super properties (persist across all events)
export function setSuperProperties(properties: Record<string, any>) {
  mixpanel.register(properties);
}

// Time events
export function startTimer(eventName: string) {
  mixpanel.time_event(eventName);
}

// Increment user properties
export function incrementUserProperty(property: string, value: number = 1) {
  mixpanel.people.increment(property, value);
}

// Set once (only if not already set)
export function setUserPropertyOnce(properties: Record<string, any>) {
  mixpanel.people.set_once(properties);
}

// Get distinct ID
export function getUserId(): string {
  return mixpanel.get_distinct_id();
}

// Opt out of tracking
export function optOut() {
  mixpanel.opt_out_tracking();
}

// Opt back in
export function optIn() {
  mixpanel.opt_in_tracking();
}

// Check if opted out
export function isOptedOut(): boolean {
  return mixpanel.has_opted_out_tracking();
}

// Get property
export function getProperty(propertyName: string): any {
  return mixpanel.get_property(propertyName);
}

/**
 * Methods we're using:
 * - init
 * - track
 * - identify
 * - reset
 * - register
 * - time_event
 * - get_distinct_id
 * - get_property
 * - opt_out_tracking
 * - opt_in_tracking
 * - has_opted_out_tracking
 * - people.set
 * - people.set_once
 * - people.increment
 * - people.track_charge
 */
