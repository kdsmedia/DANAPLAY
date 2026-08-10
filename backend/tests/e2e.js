// End-to-end integration test for DANAPLAY backend.
// Run: node tests/e2e.js
import { getDb, closeDb } from '../src/db/index.js';
import { runMigrations } from '../src/db/schema.js';
import { seed } from '../src/db/seed.js';
import app from '../src/server.js';

let pass = 0, fail = 0;
const assert = (cond, msg) => { if (cond) { pass++; console.log('  ✅', msg); } else { fail++; console.log('  ❌', msg); } };

async function req(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(`http://localhost:${process.env.PORT || 12000}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

async function main() {
  runMigrations();
  seed();
  await new Promise(r => setTimeout(r, 300));
  console.log('\n=== E2E TESTS ===\n');

  // Fetch demo user's real referral code (seed generates it dynamically)
  const db0 = getDb();
  const demoUser = db0.prepare(`SELECT referral_code FROM users WHERE phone='081234567890'`).get();
  const demoReferralCode = demoUser.referral_code;

  console.log('[Auth] Duplicate phone blocked');
  let r = await req('POST', '/api/auth/register', { body: { name: 'Budi Dup', phone: '081234567890', password: 'password123' } });
  assert(r.status === 409, 'duplicate phone rejected with 409');

  console.log('[Auth] Register with referral');
  r = await req('POST', '/api/auth/register', { body: { name: 'Sari Test', phone: '081122334455', password: 'password123', referralCode: demoReferralCode } });
  assert(r.status === 201, 'register ok 201');
  const token = r.json.data.token;
  assert(r.json.data.user.points_balance === 0, 'starts at 0 points');

  console.log('[Auth] Invalid referral rejected');
  r = await req('POST', '/api/auth/register', { body: { name: 'Bad Ref', phone: '081000000002', password: 'password123', referralCode: 'NOPE1234' } });
  assert(r.status === 400, 'invalid referral rejected');

  console.log('[Auth] Weak password rejected');
  r = await req('POST', '/api/auth/register', { body: { name: 'Weak', phone: '081000000003', password: '123' } });
  assert(r.status === 400, 'weak password rejected');

  console.log('[Auth] Wrong password');
  r = await req('POST', '/api/auth/login', { body: { phone: '081122334455', password: 'wrongpass' } });
  assert(r.status === 401, 'wrong password 401');

  console.log('[Campaigns] List active');
  r = await req('GET', '/api/campaigns', { token });
  assert(r.status === 200 && r.json.data.items.length >= 2, 'campaigns returned');
  const abc = r.json.data.items.find(c => c.title === 'GAME ABC');
  assert(abc && abc.milestones.length === 4, 'GAME ABC has 4 milestones');
  const totalReward = abc.milestones.reduce((s, m) => s + m.reward_points, 0);
  assert(totalReward === 1000000, 'total reward 1.000.000');

  console.log('[Campaign] Click creates tracking session');
  r = await req('POST', `/api/campaigns/${abc.id}/click`, { token });
  assert(r.status === 200 && r.json.data.trackingSessionId, 'tracking session created');
  assert(r.json.data.status === 'CLICKED', 'status CLICKED (no reward yet)');
  const ts = r.json.data.trackingSessionId;
  const balanceAfterClick = (await req('GET', '/api/points/balance', { token })).json.data.points;
  assert(balanceAfterClick === 0, 'NO reward for click only');

  console.log('[Campaign] Duplicate active enrollment blocked');
  r = await req('POST', `/api/campaigns/${abc.id}/click`, { token });
  assert(r.status === 409, 'duplicate enrollment blocked');

  console.log('[Attribution] INSTALL postback (idempotent)');
  r = await req('POST', '/api/attribution/postback', { body: { trackingSession: ts, eventType: 'install', eventId: 'ev-install-1', eventTime: new Date().toISOString() } });
  assert(r.status === 200 && r.json.data.result.processed, 'INSTALL processed');
  r = await req('POST', '/api/attribution/postback', { body: { trackingSession: ts, eventType: 'install', eventId: 'ev-install-1', eventTime: new Date().toISOString() } });
  assert(r.json.data.result.processed === false && r.json.data.result.reason === 'duplicate event_id', 'duplicate INSTALL ignored (idempotent)');
  let bal = (await req('GET', '/api/points/balance', { token })).json.data.points;
  assert(bal === 100000, 'INSTALL milestone rewarded +100.000');

  console.log('[Attribution] FIRST_OPEN -> ACTIVE');
  r = await req('POST', '/api/attribution/postback', { body: { trackingSession: ts, eventType: 'first_open', eventId: 'ev-fo-1', eventTime: new Date().toISOString() } });
  assert(r.json.data.result.statusAfter === 'ACTIVE', 'status ACTIVE after first_open');

  console.log('[Attribution] Same-day dedup: 20 events = 1 active day');
  for (let i = 0; i < 20; i++) {
    await req('POST', '/api/attribution/postback', { body: { trackingSession: ts, eventType: 'daily_active', eventId: 'ev-d0-' + i, eventTime: new Date().toISOString() } });
  }
  const myActive = (await req('GET', '/api/campaigns/my/active', { token })).json.data.items;
  const enrollment = myActive.find(m => m.campaign_id === abc.id);
  assert(enrollment && enrollment.active_days === 1, '20 same-day events counted as 1 active day');

  console.log('[Attribution] 15 distinct days -> milestones + completion');
  const db = getDb();
  const cu = db.prepare(`SELECT * FROM campaign_users WHERE tracking_session_id=?`).get(ts);
  const baseFirstOpen = new Date(Date.now() - 14 * 86400000).toISOString();
  db.prepare(`UPDATE campaign_users SET first_open_at=?, install_at=? WHERE id=?`).run(baseFirstOpen, baseFirstOpen, cu.id);
  db.prepare(`DELETE FROM campaign_active_days WHERE campaign_user_id=?`).run(cu.id);
  db.prepare(`UPDATE campaign_users SET active_days=0, status='ACTIVE' WHERE id=?`).run(cu.id);

  for (let d = 0; d < 15; d++) {
    const evTime = new Date(Date.now() - (14 - d) * 86400000).toISOString();
    await req('POST', '/api/attribution/postback', { body: { trackingSession: ts, eventType: 'daily_active', eventId: 'ev-d-' + d, eventTime: evTime } });
  }
  const finalEnroll = (await req('GET', '/api/campaigns/my/active', { token })).json.data.items.find(m => m.campaign_id === abc.id);
  assert(finalEnroll.status === 'COMPLETED', 'campaign COMPLETED after 15 days');
  assert(finalEnroll.active_days >= 15, 'active_days >= 15');
  assert(finalEnroll.earnedRewards.length === 4, 'all 4 milestone rewards earned');
  bal = (await req('GET', '/api/points/balance', { token })).json.data.points;
  assert(bal === 1000000 + 50000, 'total earned 1.050.000 (campaign 1M + referral bonus 50k)');

  console.log('[Reward] Double reward prevented');
  const beforeBal = bal;
  await req('POST', '/api/attribution/postback', { body: { trackingSession: ts, eventType: 'daily_active', eventId: 'ev-d-replay-99', eventTime: new Date(Date.now() - 5 * 86400000).toISOString() } });
  bal = (await req('GET', '/api/points/balance', { token })).json.data.points;
  assert(bal === beforeBal, 'no extra reward on replay (unique constraint)');

  console.log('[Referral] Bonus paid after invitee first campaign');
  const inviter = (await req('POST', '/api/auth/login', { body: { phone: '081234567890', password: 'password123' } })).json;
  assert(inviter.data && inviter.data.token, 'inviter login ok');
  const inviterBal = (await req('GET', '/api/points/balance', { token: inviter.data.token })).json.data.points;
  assert(inviterBal >= 1250000 + 50000, 'inviter got referral bonus (50k) on top of 1.250.000');

  console.log('[Withdrawal] Denominations gating');
  r = await req('GET', '/api/withdrawals/denominations', { token });
  const denoms = r.json.data.denominations;
  assert(denoms.find(d => d.amount === 200).enabled === true, 'Rp200 enabled (sufficient)');
  assert(denoms.find(d => d.amount === 10000).enabled === false, 'Rp10.000 disabled (insufficient)');

  console.log('[Withdrawal] Custom nominal rejected');
  r = await req('POST', '/api/withdrawals', { token, body: { amount: 250, destination: '081299887766' } });
  assert(r.status === 400, 'custom nominal 250 rejected');

  console.log('[Withdrawal] Invalid DANA number rejected');
  r = await req('POST', '/api/withdrawals', { token, body: { amount: 200, destination: 'abc123' } });
  assert(r.status === 400, 'invalid DANA number rejected');

  console.log('[Withdrawal] Successful payout');
  r = await req('POST', '/api/withdrawals', { token, body: { amount: 200, destination: '081299887766' } });
  assert(r.status === 200 && r.json.data.status === 'COMPLETED', 'withdrawal COMPLETED (mock, not ending 0)');
  bal = (await req('GET', '/api/points/balance', { token })).json.data.points;
  assert(bal === beforeBal - 200000, 'points debited 200.000');

  console.log('[Withdrawal] Failed payout refunds points');
  const balBeforeFail = (await req('GET', '/api/points/balance', { token })).json.data.points;
  r = await req('POST', '/api/withdrawals', { token, body: { amount: 200, destination: '081200000000' } });
  assert(r.status === 200 && r.json.data.status === 'FAILED' && r.json.data.refunded === true, 'withdrawal FAILED + refunded');
  const balAfterFail = (await req('GET', '/api/points/balance', { token })).json.data.points;
  assert(balAfterFail === balBeforeFail, 'points restored after failed payout');

  console.log('[Ledger] Transaction history');
  r = await req('GET', '/api/points/transactions', { token });
  const types = new Set(r.json.data.items.map(t => t.type));
  assert(types.has('EARN') && types.has('REDEEM') && types.has('REFUND'), 'ledger has EARN, REDEEM, REFUND');
  const redeem = r.json.data.items.find(t => t.type === 'REDEEM');
  assert(redeem && redeem.balance_before !== undefined && redeem.balance_after !== undefined, 'ledger has balance_before/after');

  console.log('[Notifications]');
  r = await req('GET', '/api/notifications', { token });
  assert(r.json.data.items.length > 0 && r.json.data.unread >= 0, 'notifications present');

  console.log('[Admin] Dashboard');
  const adminLogin = (await req('POST', '/api/admin/auth/login', { body: { username: 'admin', password: 'admin123' } })).json;
  r = await req('GET', '/api/admin/dashboard', { token: adminLogin.data.token });
  assert(r.status === 200 && r.json.data.totalUsers >= 2, 'admin dashboard returns stats');
  assert(r.json.data.completedCampaigns >= 1, 'dashboard counts completed campaigns');

  console.log('[Security] No transaction delete endpoint');
  r = await req('DELETE', '/api/admin/points/someid', { token: adminLogin.data.token });
  assert(r.status === 404, 'no DELETE on transactions (audit trail preserved)');

  console.log('[Security] Client cannot manipulate balance');
  r = await req('POST', '/api/points/balance', { token, body: { points: 99999999 } });
  assert(r.status === 404, 'no client-side balance mutation endpoint');

  console.log('[Ads] Daily ad task');
  r = await req('GET', '/api/ads/daily', { token });
  assert(r.status === 200 && r.json.data.remaining === r.json.data.limit, 'daily progress starts fresh');
  assert(r.json.data.limit === 50 && r.json.data.rewardPerView === 1000, 'limit 50 / 1000 pts per view');

  r = await req('GET', '/api/ads', { token });
  assert(r.status === 200 && r.json.data.items.length > 0, 'dynamic ad inventory available');

  console.log('[Ads] Skip rejected (no reward)');
  const balBeforeAd = (await req('GET', '/api/points/balance', { token })).json.data.points;
  r = await req('POST', '/api/ads/start', { token });
  assert(r.status === 201 && r.json.data.viewToken, 'ad view session started');
  const skipToken = r.json.data.viewToken;
  r = await req('POST', `/api/ads/view/${skipToken}/complete`, { token });
  assert(r.status === 422 && r.json.success === false, 'completing too fast rejected (no-skip)');
  const balAfterSkip = (await req('GET', '/api/points/balance', { token })).json.data.points;
  assert(balAfterSkip === balBeforeAd, 'no reward on skip');

  console.log('[Ads] Full watch rewarded (idempotent)');
  r = await req('POST', '/api/ads/start', { token });
  const watchToken = r.json.data.viewToken;
  await new Promise(rr => setTimeout(rr, (r.json.data.minWatchSeconds + 1) * 1000));
  r = await req('POST', `/api/ads/view/${watchToken}/complete`, { token });
  assert(r.status === 200 && r.json.data.rewardGranted === 1000, 'full watch grants 1000 pts');
  const balAfterReward = (await req('GET', '/api/points/balance', { token })).json.data.points;
  assert(balAfterReward === balBeforeAd + 1000, 'balance increased by 1000');
  r = await req('POST', `/api/ads/view/${watchToken}/complete`, { token });
  assert(r.status === 200 && r.json.data.alreadyCompleted === true && r.json.data.rewardGranted === 0, 'idempotent: no double reward');

  console.log('[Ads] Cooldown blocks immediate next start');
  r = await req('POST', '/api/ads/start', { token });
  assert(r.status === 429, 'cooldown enforced after rewarded view');

  console.log('[Ads] Ledger records ad reward');
  r = await req('GET', '/api/points/transactions', { token });
  const adTx = r.json.data.items.find(t => t.reference_type === 'ad_view' && t.type === 'EARN');
  assert(adTx && adTx.amount === 1000, 'ad reward in ledger as EARN');

  console.log(`\n=== RESULTS: ${pass} passed, ${fail} failed ===\n`);
  closeDb();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
