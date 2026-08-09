// Attribution provider abstraction.
// Real providers (Adjust, AppsFlyer, Tenjin, etc.) deliver server-to-server postbacks.
// In development we use the Mock provider which simulates events for testing the engine.
// NEVER claim an install was verified unless a real provider postback arrived.

import config from '../config/index.js';

/** @typedef {{
 *   campaignUserId: string,
 *   eventType: string,
 *   eventId: string,
 *   eventTime: string,
 *   metadata?: object
 * }} AttributionEvent */

class MockAttributionProvider {
  constructor() {
    this.name = 'mock';
    this.mode = 'MOCK / DEVELOPMENT';
  }
  // Mock provider does not initiate anything; it just exposes a dev endpoint to simulate events.
  async verifyPostbackAuth(/* req */) { return true; }
  description() {
    return 'MOCK attribution provider. Simulated events only. No real install verification is claimed.';
  }
}

class AdjustAttributionProvider {
  constructor() {
    this.name = 'adjust';
    this.mode = 'PRODUCTION';
  }
  // Adjust posts to our URL with a signature header (X-Adjust-Signature) computed with SDK secret.
  async verifyPostbackAuth(req) {
    const sig = req.headers['x-adjust-signature'];
    const raw = req.rawBody || '';
    if (!sig) return false;
    // Adjust uses HMAC-SHA256 with the SDK secret over the raw body
    const { hmacVerify } = await import('../utils/http.js');
    return hmacVerify(raw, sig, config.attributionPostbackSecret);
  }
  description() {
    return 'Adjust attribution (production). Verify X-Adjust-Signature HMAC with ATTRIBUTION_POSTBACK_SECRET.';
  }
}

class AppsFlyerAttributionProvider {
  constructor() {
    this.name = 'appsflyer';
    this.mode = 'PRODUCTION';
  }
  async verifyPostbackAuth(req) {
    // AppsFlyer Protect: verify AF-Signature header + optional IP allowlist.
    const sig = req.headers['af-signature'];
    const { hmacVerify } = await import('../utils/http.js');
    let ok = false;
    if (sig) ok = hmacVerify(req.rawBody || '', sig, config.attributionPostbackSecret);
    if (!ok && config.attributionTrustedIps.length) {
      ok = config.attributionTrustedIps.includes(req.ip);
    }
    return ok;
  }
  description() {
    return 'AppsFlyer attribution (production). Verify AF-Signature HMAC and/or trusted IP allowlist.';
  }
}

export function getAttributionProvider() {
  switch (config.attributionProvider) {
    case 'adjust': return new AdjustAttributionProvider();
    case 'appsflyer': return new AppsFlyerAttributionProvider();
    case 'mock':
    default: return new MockAttributionProvider();
  }
}

// Map raw partner event names to our canonical event types.
export function normalizeEventType(raw) {
  const map = {
    install: 'INSTALL', installed: 'INSTALL',
    first_open: 'FIRST_OPEN', firstopen: 'FIRST_OPEN', open: 'FIRST_OPEN',
    app_open: 'APP_OPEN',
    daily_active: 'DAILY_ACTIVE', daus: 'DAILY_ACTIVE', session: 'DAILY_ACTIVE',
    game_session: 'GAME_SESSION',
    level_reached: 'LEVEL_REACHED', level: 'LEVEL_REACHED',
    task_completed: 'TASK_COMPLETED',
    campaign_completed: 'CAMPAIGN_COMPLETED',
    uninstall: 'UNINSTALL', uninstalled: 'UNINSTALL',
  };
  return map[String(raw).toLowerCase()] || String(raw).toUpperCase();
}
