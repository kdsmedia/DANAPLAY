import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from './config/index.js';
import { runMigrations } from './db/schema.js';
import { ApiError, asyncHandler, ok } from './utils/http.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import pointsRoutes from './routes/points.js';
import campaignRoutes from './routes/campaigns.js';
import attributionRoutes from './routes/attribution.js';
import withdrawalRoutes from './routes/withdrawals.js';
import referralRoutes from './routes/referrals.js';
import notificationRoutes from './routes/notifications.js';
import adminAuthRoutes from './routes/adminAuth.js';
import adminRoutes from './routes/admin.js';

// Run migrations on boot
runMigrations();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const app = express();
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "script-src": ["'self'", "'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "https:"],
      "connect-src": ["'self'"],
    },
  },
  crossOriginResourcePolicy: false,
}));

// Capture raw body for HMAC verification (attribution postback)
app.use('/api/attribution/postback', express.json({ limit: '256kb', verify: (req, _res, buf) => { req.rawBody = buf.toString(); } }));
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(morgan(config.isProd ? 'combined' : 'dev'));

// Trust proxy for accurate req.ip behind reverse proxy
app.set('trust proxy', 1);

// Global rate limiter
app.use('/api', rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
}));

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.authRateLimitMax,
  standardHeaders: true,
  message: { success: false, error: 'Too many auth attempts, please try again later.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/admin/login', authLimiter);

// Health
app.get('/health', (req, res) => ok(res, {
  status: 'ok', service: 'danaplay-backend',
  attributionProvider: config.attributionProvider,
  payoutProvider: config.payoutProvider,
  pointsPerRupiah: config.pointsPerRupiah,
}));

// Static: mobile app (PWA)
app.use('/mobile', express.static(path.resolve(ROOT, 'mobile'), {
  index: 'index.html',
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) res.setHeader('Cache-Control', 'no-cache');
  },
}));
app.get('/mobile', (req, res) => res.redirect('/mobile/'));
app.get('/', (req, res) => res.redirect('/mobile/'));

// Static: admin panel
app.use('/admin', express.static(path.resolve(ROOT, 'admin'), {
  index: 'index.html',
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) res.setHeader('Cache-Control', 'no-cache');
  },
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/attribution', attributionRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin', adminRoutes);

// 404
app.use((req, res) => res.status(404).json({ success: false, error: 'Not found' }));

// Error handler
app.use((err, req, res, next) => {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ success: false, error: err.message, details: err.details || undefined });
  }
  // Idempotency / business errors with code
  if (err.code === 'INSUFFICIENT_BALANCE') {
    return res.status(400).json({ success: false, error: 'Saldo poin tidak mencukupi' });
  }
  console.error('[ERROR]', err);
  const msg = config.isProd ? 'Internal server error' : err.message;
  res.status(500).json({ success: false, error: msg });
});

const server = app.listen(config.port, () => {
  console.log(`🚀 DANAPLAY backend running on http://localhost:${config.port}`);
  console.log(`   Attribution provider: ${config.attributionProvider}`);
  console.log(`   Payout provider: ${config.payoutProvider}`);
  console.log(`   Points/Rupiah: ${config.pointsPerRupiah}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));

export default app;
