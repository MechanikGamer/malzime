const { RATE_LIMIT, RATE_WINDOW_MS } = require("./config");

const rateState = new Map();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 60 * 1000;

function getClientIp(req) {
  /* SEC-001: req.ip wird von Express/Firebase korrekt aus dem Load-Balancer-Header
     geparst. Manuelles x-forwarded-for-Parsing ist spoofbar (Angreifer setzt
     eigenen Wert als ersten Eintrag). */
  return req.ip || "unknown";
}

function cleanupExpired() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of rateState) {
    if (now > entry.resetAt) rateState.delete(key);
  }
}

function checkRateLimit(key) {
  cleanupExpired();
  const current = Date.now();
  const entry = rateState.get(key);
  if (!entry || current > entry.resetAt) {
    rateState.set(key, { count: 1, resetAt: current + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count += 1;
  return true;
}

module.exports = { getClientIp, checkRateLimit };
