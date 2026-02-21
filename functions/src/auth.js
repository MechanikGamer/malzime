const crypto = require("crypto");

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 Minuten

/**
 * Erstellt einen HMAC-signierten Admin-Token.
 * Format: {expires}.{signature}
 * Der Token ist an eine bestimmte Action gebunden (z.B. "boost", "reset").
 */
function createAdminToken(action, secret, ttlMs = DEFAULT_TTL_MS) {
  const expires = Date.now() + ttlMs;
  const payload = `${action}.${expires}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${expires}.${signature}`;
}

/**
 * Validiert einen HMAC-signierten Admin-Token.
 * Prueft: Format, Ablaufzeit, Action-Bindung, Signatur (timing-safe).
 */
function verifyAdminToken(token, action, secret) {
  if (!token || typeof token !== "string") return false;

  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return false;

  const expiresStr = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);

  const expires = Number(expiresStr);
  if (isNaN(expires) || Date.now() > expires) return false;

  const payload = `${action}.${expiresStr}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

module.exports = { createAdminToken, verifyAdminToken, DEFAULT_TTL_MS };
