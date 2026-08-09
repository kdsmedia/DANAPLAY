// Payout (DANA) provider abstraction.
// Real DANA Disbursement API integration goes here. In development we use the Mock provider
// which simulates success/failure. NEVER claim a transfer succeeded unless a real provider did it.

import config from '../config/index.js';

/** @typedef {{ status: 'COMPLETED'|'FAILED'|'PROCESSING', providerReference?: string, failureReason?: string }} PayoutResult */

class MockPayoutProvider {
  constructor() {
    this.name = 'mock';
    this.mode = 'MOCK / DEVELOPMENT';
  }
  /**
   * @param {{ amount: number, destination: string, reference: string }} payload
   * @returns {Promise<PayoutResult>}
   */
  async send(payload) {
    // Simulate processing delay & ~10% deterministic failure based on destination last digit.
    await new Promise(r => setTimeout(r, 300));
    const last = payload.destination.slice(-1);
    if (last === '0') {
      return { status: 'FAILED', failureReason: 'Mock: simulated payout failure (destination ending in 0).' };
    }
    return { status: 'COMPLETED', providerReference: 'MOCK-' + payload.reference };
  }
  async checkStatus(providerReference) {
    return { status: providerReference?.startsWith('MOCK') ? 'COMPLETED' : 'PROCESSING' };
  }
  description() {
    return 'MOCK payout provider. No real money is moved. Destinations ending in 0 simulate failure for refund testing.';
  }
}

class DanaApiPayoutProvider {
  constructor() {
    this.name = 'dana_api';
    this.mode = 'PRODUCTION';
  }
  /**
   * Calls DANA Disbursement API. Requires DANA_API_KEY, DANA_MERCHANT_ID, DANA_API_BASE_URL.
   * Implement signature per DANA API spec (HMAC-SHA256 over canonical request).
   */
  async send({ amount, destination, reference }) {
    if (!config.danaApiKey || !config.danaApiBaseUrl) {
      throw new Error('DANA API not configured: set DANA_API_KEY and DANA_API_BASE_URL');
    }
    // Example request shape (adapt to DANA's actual spec):
    // const body = { merchantId: config.danaMerchantId, amount, destination, partnerReference: reference };
    // const signature = hmacSign(JSON.stringify(body), config.danaApiKey);
    // const res = await fetch(config.danaApiBaseUrl + '/v1/disbursements', {
    //   method: 'POST', body: JSON.stringify(body),
    //   headers: { 'Content-Type': 'application/json', 'X-Signature': signature }
    // });
    // const data = await res.json();
    // return { status: data.status, providerReference: data.disbursementId, failureReason: data.error };
    throw new Error('DANA production integration not yet wired. Configure provider and implement send().');
  }
  async checkStatus(/* providerReference */) {
    throw new Error('DANA production integration not yet wired.');
  }
  description() {
    return 'DANA Disbursement API (production). Requires DANA_API_KEY, DANA_MERCHANT_ID, DANA_API_BASE_URL. NOT yet active.';
  }
}

export function getPayoutProvider() {
  switch (config.payoutProvider) {
    case 'dana_api': return new DanaApiPayoutProvider();
    case 'mock':
    default: return new MockPayoutProvider();
  }
}
