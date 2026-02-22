const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const RATE_LIMIT = 200;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const DESCRIBE_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash-001"];
const PROFILE_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash-001"];

const API_TIMEOUT_MS = 45000;

/* ── Globales Stundenlimit ── */
const HOURLY_LIMIT = 500;
const HOURLY_WINDOW_MINUTES = 60;

/* BUG-003: Globales Budget pro Request — verhindert dass die Summe aller
   internen Timeouts das Cloud-Function-Limit (120s) übersteigt. */
const REQUEST_BUDGET_MS = 90000;

/* Laufzeit-Validierung — fehlerhafte Config crasht sofort statt leise falsch zu laufen */
if (HOURLY_LIMIT < 1) throw new Error("Config: HOURLY_LIMIT must be >= 1");
if (RATE_LIMIT < 1) throw new Error("Config: RATE_LIMIT must be >= 1");
if (MAX_UPLOAD_BYTES < 1) throw new Error("Config: MAX_UPLOAD_BYTES must be >= 1");

module.exports = {
  MAX_UPLOAD_BYTES,
  RATE_LIMIT,
  RATE_WINDOW_MS,
  ALLOWED_MIME,
  DESCRIBE_MODELS,
  PROFILE_MODELS,
  API_TIMEOUT_MS,
  REQUEST_BUDGET_MS,
  HOURLY_LIMIT,
  HOURLY_WINDOW_MINUTES,
};
