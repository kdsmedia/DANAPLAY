import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const num = (v, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const bool = v => v === 'true' || v === '1';

const config = {
  port: num(process.env.PORT, 12000),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',

  corsOrigin: (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim()).filter(Boolean),

  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  adminJwtExpiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '12h',
  bcryptRounds: num(process.env.BCRYPT_ROUNDS, 10),

  pointsPerRupiah: num(process.env.POINTS_PER_RUPIAH, 1000),
  withdrawalDenominations: (process.env.WITHDRAWAL_DENOMINATIONS || '200,500,1000,2000,5000,10000')
    .split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n > 0),
  passwordMinLength: num(process.env.PASSWORD_MIN_LENGTH, 8),

  attributionProvider: process.env.ATTRIBUTION_PROVIDER || 'mock',
  attributionPostbackSecret: process.env.ATTRIBUTION_POSTBACK_SECRET || 'dev-postback-secret',
  attributionTrustedIps: (process.env.ATTRIBUTION_TRUSTED_IPS || '')
    .split(',').map(s => s.trim()).filter(Boolean),

  payoutProvider: process.env.PAYOUT_PROVIDER || 'mock',
  danaApiBaseUrl: process.env.DANA_API_BASE_URL || '',
  danaApiKey: process.env.DANA_API_KEY || '',
  danaMerchantId: process.env.DANA_MERCHANT_ID || '',
  danaWebhookSecret: process.env.DANA_WEBHOOK_SECRET || '',

  dbPath: process.env.DB_PATH || path.resolve(__dirname, '../../data/danaplay.db'),

  rateLimitWindowMs: num(process.env.RATE_LIMIT_WINDOW_MS, 900000),
  rateLimitMax: num(process.env.RATE_LIMIT_MAX, 300),
  authRateLimitMax: num(process.env.AUTH_RATE_LIMIT_MAX, 10),

  // Daily ad-watching task. 1 view = adRewardPerView points, max adDailyLimit views/day.
  adDailyLimit: num(process.env.AD_DAILY_LIMIT, 50),
  adRewardPerView: num(process.env.AD_REWARD_PER_VIEW, 1000),
  // Minimum watch time (seconds) before an ad can be completed — anti-skip.
  adMinWatchSeconds: num(process.env.AD_MIN_WATCH_SECONDS, 15),
  // Cooldown between views (seconds) — prevents spamming.
  adCooldownSeconds: num(process.env.AD_COOLDOWN_SECONDS, 30),
  // Max seconds an ad view session stays valid before it expires.
  adViewTtlSeconds: num(process.env.AD_VIEW_TTL_SECONDS, 120),
};

export default config;
