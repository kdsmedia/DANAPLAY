import { nanoid } from 'nanoid';

export const uid = (prefix = '') => prefix + nanoid(20);

// Generate a human-readable referral code: 3 letters + 4 digits
export function generateReferralCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I,O
  const digits = '0123456789';
  let code = '';
  for (let i = 0; i < 3; i++) code += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 4; i++) code += digits[Math.floor(Math.random() * digits.length)];
  return code;
}

// Validate Indonesian phone: starts with 08, 10-13 digits total
export function isValidPhone(phone) {
  return /^08[0-9]{8,11}$/.test(phone);
}

// DANA number == Indonesian phone format
export function isValidDanaNumber(num) {
  return /^08[0-9]{8,11}$/.test(num);
}

export function pointsToRupiah(points, pointsPerRupiah) {
  return Math.floor(points / pointsPerRupiah);
}

export function rupiahToPoints(rupiah, pointsPerRupiah) {
  return Math.floor(rupiah * pointsPerRupiah);
}

export function formatRupiah(amount) {
  return 'Rp' + Number(amount).toLocaleString('id-ID');
}

export function formatPoints(points) {
  return Number(points).toLocaleString('id-ID') + ' Poin';
}

// Campaign/user timezone-aware date. We treat all dates as Asia/Jakarta by default.
export function todayInTz(tz = 'Asia/Jakarta') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

export function nowIso() {
  return new Date().toISOString();
}

/**
 * Parse a stored timestamp into a Date, tolerating both ISO-with-Z (toISOString)
 * and SQLite datetime('now') which is "YYYY-MM-DD HH:MM:SS" interpreted as UTC.
 * Adding 'Z' only when there is no timezone designator.
 */
export function parseDate(value) {
  if (value instanceof Date) return value;
  if (typeof value !== 'string' || !value) return new Date(NaN);
  // Has explicit timezone (Z or +/-HH:MM) -> parse as-is.
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value)) return new Date(value);
  // SQLite format "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS" -> treat as UTC.
  return new Date(value.replace(' ', 'T') + 'Z');
}
