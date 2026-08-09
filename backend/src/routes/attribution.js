import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ApiError, ok } from '../utils/http.js';
import { getAttributionProvider, normalizeEventType } from '../providers/attribution.js';
import { processAttributionEvent } from '../services/campaignEngine.js';
import { audit } from '../services/audit.js';
import { getDb } from '../db/index.js';

const router = Router();

// Partner postback endpoint. Accepts JSON with our session identifiers.
// Auth: provider.verifyPostbackAuth (HMAC signature or trusted IP). Mock provider allows all in dev.
const postbackSchema = z.object({
  trackingSession: z.string().optional().nullable(),
  campaignUserId: z.string().optional().nullable(),
  clickId: z.string().optional().nullable(),
  campaignId: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
  eventType: z.string().min(1),
  eventId: z.string().min(1),  // required for idempotency
  eventTime: z.string().optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
});

router.post('/postback', asyncHandler(async (req, res) => {
  const provider = getAttributionProvider();
  const authorized = await provider.verifyPostbackAuth(req);
  if (!authorized) throw new ApiError(401, 'Unauthorized postback');

  const parsed = postbackSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid postback payload', parsed.error.flatten());
  const p = parsed.data;

  // Resolve campaign_user via tracking session OR (campaignId+userId) OR clickId
  let campaignUserId = p.campaignUserId;
  let trackingSession = p.trackingSession;
  if (!campaignUserId && !trackingSession) {
    const db = getDb();
    if (p.clickId) {
      const cu = db.prepare(`SELECT id, tracking_session_id FROM campaign_users WHERE click_id = ?`).get(p.clickId);
      if (cu) { campaignUserId = cu.id; trackingSession = cu.tracking_session_id; }
    }
    if (!campaignUserId && p.campaignId && p.userId) {
      const cu = db.prepare(`SELECT id, tracking_session_id FROM campaign_users WHERE campaign_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1`).get(p.campaignId, p.userId);
      if (cu) { campaignUserId = cu.id; trackingSession = cu.tracking_session_id; }
    }
  }
  if (!campaignUserId && !trackingSession) {
    throw new ApiError(404, 'Cannot resolve enrollment from provided identifiers');
  }

  const eventType = normalizeEventType(p.eventType);
  const result = processAttributionEvent({
    trackingSessionId: trackingSession,
    campaignUserId,
    eventType,
    eventId: p.eventId,
    eventTime: p.eventTime || new Date().toISOString(),
    metadata: p.metadata || {},
  });

  audit({ actorType: 'system', action: 'POSTBACK_RECEIVED',
    targetType: 'campaign_user', targetId: campaignUserId,
    details: { provider: provider.name, eventType, eventId: p.eventId, result }, ip: req.ip });

  return ok(res, { provider: provider.name, mode: provider.mode, eventType, result });
}));

// Provider info (for admin/debug)
router.get('/info', (req, res) => {
  const provider = getAttributionProvider();
  return ok(res, { provider: provider.name, mode: provider.mode, description: provider.description() });
});

export default router;
