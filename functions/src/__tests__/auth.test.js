/* Tests for auth.js — HMAC-based admin tokens */

const { createAdminToken, verifyAdminToken, createNonce, verifyNonce, NONCE_TTL_MS } = require("../auth");

describe("createAdminToken", () => {
  test("returns token in format expires.signature", () => {
    const token = createAdminToken("boost", "test-secret");
    expect(token).toMatch(/^\d+\.[a-f0-9]{64}$/);
  });

  test("token expires in the future", () => {
    const token = createAdminToken("boost", "test-secret");
    const expires = Number(token.split(".")[0]);
    expect(expires).toBeGreaterThan(Date.now());
  });

  test("different actions produce different signatures", () => {
    const t1 = createAdminToken("boost", "test-secret");
    const t2 = createAdminToken("reset", "test-secret");
    expect(t1.split(".")[1]).not.toBe(t2.split(".")[1]);
  });

  test("different secrets produce different signatures", () => {
    const t1 = createAdminToken("boost", "secret-a");
    const t2 = createAdminToken("boost", "secret-b");
    expect(t1.split(".")[1]).not.toBe(t2.split(".")[1]);
  });
});

describe("verifyAdminToken", () => {
  const SECRET = "test-secret-123";

  test("validates a valid token", () => {
    const token = createAdminToken("boost", SECRET);
    expect(verifyAdminToken(token, "boost", SECRET)).toBe(true);
  });

  test("rejects expired token", () => {
    const expired = createAdminToken("boost", SECRET, -1000);
    expect(verifyAdminToken(expired, "boost", SECRET)).toBe(false);
  });

  test("rejects token with wrong action", () => {
    const token = createAdminToken("boost", SECRET);
    expect(verifyAdminToken(token, "reset", SECRET)).toBe(false);
  });

  test("rejects token with wrong secret", () => {
    const token = createAdminToken("boost", SECRET);
    expect(verifyAdminToken(token, "boost", "wrong-secret")).toBe(false);
  });

  test("rejects null/undefined/empty token", () => {
    expect(verifyAdminToken(null, "boost", SECRET)).toBe(false);
    expect(verifyAdminToken(undefined, "boost", SECRET)).toBe(false);
    expect(verifyAdminToken("", "boost", SECRET)).toBe(false);
  });

  test("rejects malformed token without dot", () => {
    expect(verifyAdminToken("nodot", "boost", SECRET)).toBe(false);
  });

  test("rejects token with invalid expires", () => {
    expect(verifyAdminToken("notanumber.abc123", "boost", SECRET)).toBe(false);
  });

  test("rejects token with wrong signature length", () => {
    const token = createAdminToken("boost", SECRET);
    const expires = token.split(".")[0];
    expect(verifyAdminToken(`${expires}.tooshort`, "boost", SECRET)).toBe(false);
  });

  test("rejects non-string input", () => {
    expect(verifyAdminToken(42, "boost", SECRET)).toBe(false);
    expect(verifyAdminToken({}, "boost", SECRET)).toBe(false);
  });
});

/* ── Nonce (SEC-001) ── */

describe("createNonce / verifyNonce", () => {
  const SECRET = "test-secret-123";

  test("creates a valid nonce that can be verified", () => {
    const nonce = createNonce("boost", SECRET);
    expect(verifyNonce(nonce, "boost", SECRET)).toBe(true);
  });

  test("nonce has shorter TTL than admin token", () => {
    expect(NONCE_TTL_MS).toBeLessThan(30 * 60 * 1000);
    expect(NONCE_TTL_MS).toBe(5 * 60 * 1000);
  });

  test("nonce expires within 5 minutes", () => {
    const nonce = createNonce("boost", SECRET);
    const expires = Number(nonce.split(".")[0]);
    const diff = expires - Date.now();
    expect(diff).toBeLessThanOrEqual(NONCE_TTL_MS);
    expect(diff).toBeGreaterThan(0);
  });

  test("rejects nonce with wrong action", () => {
    const nonce = createNonce("boost", SECRET);
    expect(verifyNonce(nonce, "reset", SECRET)).toBe(false);
  });

  test("rejects nonce with wrong secret", () => {
    const nonce = createNonce("boost", SECRET);
    expect(verifyNonce(nonce, "boost", "wrong")).toBe(false);
  });
});
