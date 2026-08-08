const crypto = require('node:crypto');

const MAX_AGE_MS = 1000 * 60 * 60 * 2; // 2시간

function sign(secret, timestamp) {
  return crypto.createHmac('sha256', secret).update(String(timestamp)).digest('hex');
}

function createAdminToken() {
  const secret = process.env.SESSION_SECRET;
  const timestamp = Date.now();
  return `${timestamp}.${sign(secret, timestamp)}`;
}

function verifyAdminToken(token) {
  if (!token) return false;
  const secret = process.env.SESSION_SECRET;
  const [timestampStr, sig] = token.split('.');
  if (!timestampStr || !sig) return false;

  const timestamp = Number(timestampStr);
  if (!Number.isFinite(timestamp)) return false;
  if (Date.now() - timestamp > MAX_AGE_MS) return false;

  const expected = Buffer.from(sign(secret, timestamp));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

module.exports = { createAdminToken, verifyAdminToken, MAX_AGE_MS };
