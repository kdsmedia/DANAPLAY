import crypto from 'node:crypto';

// HTTP-safe wrapper: throws an ApiError with status code.
export class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Success response helper
export function ok(res, data = {}, status = 200) {
  return res.status(status).json({ success: true, data });
}

// Hash a postback payload with HMAC-SHA256 using shared secret
export function hmacSign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function hmacVerify(payload, signature, secret) {
  if (!signature) return false;
  const expected = hmacSign(payload, secret);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
  } catch {
    return false;
  }
}

// Constant-ish safe string compare for simple tokens
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
