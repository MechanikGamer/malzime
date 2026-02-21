/* Tests for admin handler in index.js */

jest.mock("firebase-admin/app", () => ({
  initializeApp: jest.fn(),
}));

const TEST_SECRET = "test-admin-secret-xyz";

jest.mock("firebase-functions/params", () => ({
  defineSecret: jest.fn((name) => {
    const secret = () => {};
    secret.value = () => {
      if (name === "ADMIN_SECRET") return TEST_SECRET;
      return "";
    };
    secret.name = name;
    return secret;
  }),
}));

jest.mock("firebase-functions/v2/https", () => ({
  onRequest: jest.fn((_opts, handler) => handler),
}));

const mockBoostLimit = jest.fn().mockResolvedValue();
const mockResetCounter = jest.fn().mockResolvedValue();
const mockGetStats = jest.fn().mockResolvedValue({
  current: { count: 100, limit: 500, limitActive: false, retryAfterSeconds: 0, hourlyTotal: 100 },
  totals: { today: 10, week: 50, month: 200, year: 500, allTime: 1000 },
});

jest.mock("../counter", () => ({
  checkAndIncrement: jest.fn(),
  incrementTotals: jest.fn(),
  getStats: (...args) => mockGetStats(...args),
  boostLimit: (...args) => mockBoostLimit(...args),
  resetCounter: (...args) => mockResetCounter(...args),
  filterRecent: jest.fn(),
  calcRetrySeconds: jest.fn(),
}));

jest.mock("../notify", () => ({ notifyLimitReached: jest.fn() }));
jest.mock("../middleware", () => ({ checkRateLimit: jest.fn(), getClientIp: jest.fn() }));
jest.mock("../upload", () => ({ parseMultipart: jest.fn(), parseJsonBody: jest.fn() }));
jest.mock("../vision", () => ({ analyzeWithVision: jest.fn() }));
jest.mock("../privacy", () => ({ buildPrivacyRisks: jest.fn() }));
jest.mock("../gemini", () => ({
  describeImage: jest.fn(),
  buildDescriptionFromLabels: jest.fn(),
  generateBothProfiles: jest.fn(),
  isQuotaError: jest.fn(),
}));
jest.mock("../animal", () => ({
  classifyLabels: jest.fn(),
  buildAnimalProfiles: jest.fn(),
  AGE_LABELS: [],
}));
jest.mock("../i18n", () => ({
  resolveLanguage: jest.fn(),
  loadPrompts: jest.fn(),
}));

const { createAdminToken } = require("../auth");
const { admin } = require("../index");

function mockReq(overrides = {}) {
  return {
    method: "GET",
    headers: {},
    query: {},
    body: {},
    path: "/boost",
    ...overrides,
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    htmlBody: null,
    status: jest.fn(function (code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function (data) {
      this.body = data;
    }),
    type: jest.fn(function () {
      return this;
    }),
    send: jest.fn(function (html) {
      this.htmlBody = html;
    }),
  };
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockBoostLimit.mockResolvedValue();
  mockResetCounter.mockResolvedValue();
  mockGetStats.mockResolvedValue({
    current: { count: 100, limit: 500, limitActive: false, retryAfterSeconds: 0, hourlyTotal: 100 },
    totals: { today: 10, week: 50, month: 200, year: 500, allTime: 1000 },
  });
});

describe("admin handler", () => {
  /* ── Auth ── */

  test("returns 403 without any auth", async () => {
    const req = mockReq({ path: "/boost" });
    const res = mockRes();
    await admin(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.error).toBe("Forbidden");
  });

  test("returns 403 with invalid Bearer token", async () => {
    const req = mockReq({
      path: "/boost",
      method: "POST",
      headers: { authorization: "Bearer wrong-token" },
    });
    const res = mockRes();
    await admin(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("returns 403 with expired HMAC token", async () => {
    const expired = createAdminToken("boost", TEST_SECRET, -1000);
    const req = mockReq({ path: "/boost", query: { hmac: expired } });
    const res = mockRes();
    await admin(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("returns 403 with HMAC for wrong action", async () => {
    const token = createAdminToken("reset", TEST_SECRET);
    const req = mockReq({ path: "/boost", query: { hmac: token } });
    const res = mockRes();
    await admin(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  /* ── Boost with valid auth ── */

  test("boost with valid Bearer (POST) returns JSON", async () => {
    const req = mockReq({
      path: "/boost",
      method: "POST",
      headers: { authorization: `Bearer ${TEST_SECRET}` },
    });
    const res = mockRes();
    await admin(req, res);
    expect(res.json).toHaveBeenCalled();
    expect(res.body.ok).toBe(true);
    expect(res.body.action).toBe("boost");
    expect(mockBoostLimit).toHaveBeenCalled();
  });

  test("boost with valid HMAC (GET) returns HTML", async () => {
    const token = createAdminToken("boost", TEST_SECRET);
    const req = mockReq({ path: "/boost", query: { hmac: token } });
    const res = mockRes();
    await admin(req, res);
    expect(res.type).toHaveBeenCalledWith("html");
    expect(res.send).toHaveBeenCalled();
    expect(res.htmlBody).toContain("Boost");
    expect(mockBoostLimit).toHaveBeenCalled();
  });

  /* ── Reset with valid auth ── */

  test("reset with valid Bearer (POST) returns JSON", async () => {
    const req = mockReq({
      path: "/reset",
      method: "POST",
      headers: { authorization: `Bearer ${TEST_SECRET}` },
    });
    const res = mockRes();
    await admin(req, res);
    expect(res.json).toHaveBeenCalled();
    expect(res.body.ok).toBe(true);
    expect(res.body.action).toBe("reset");
    expect(mockResetCounter).toHaveBeenCalled();
  });

  test("reset with valid HMAC (GET) returns HTML", async () => {
    const token = createAdminToken("reset", TEST_SECRET);
    const req = mockReq({ path: "/reset", query: { hmac: token } });
    const res = mockRes();
    await admin(req, res);
    expect(res.type).toHaveBeenCalledWith("html");
    expect(res.send).toHaveBeenCalled();
    expect(res.htmlBody).toContain("Reset");
    expect(mockResetCounter).toHaveBeenCalled();
  });

  /* ── Boost cap ── */

  test("boost amount is capped at 500", async () => {
    const req = mockReq({
      path: "/boost",
      method: "POST",
      headers: { authorization: `Bearer ${TEST_SECRET}` },
      body: { amount: 9999 },
    });
    const res = mockRes();
    await admin(req, res);
    expect(mockBoostLimit).toHaveBeenCalledWith(500);
  });

  test("boost default amount is 100", async () => {
    const req = mockReq({
      path: "/boost",
      method: "POST",
      headers: { authorization: `Bearer ${TEST_SECRET}` },
    });
    const res = mockRes();
    await admin(req, res);
    expect(mockBoostLimit).toHaveBeenCalledWith(100);
  });

  /* ── Unknown action ── */

  test("returns 404 for unknown action", async () => {
    const req = mockReq({
      path: "/unknown",
      method: "POST",
      headers: { authorization: `Bearer ${TEST_SECRET}` },
    });
    const res = mockRes();
    await admin(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  /* ── HTML escaping ── */

  test("HTML in boost response is escaped", async () => {
    mockGetStats.mockResolvedValue({
      current: { count: 100, limit: 600, limitActive: false, retryAfterSeconds: 0, hourlyTotal: 100 },
      totals: { today: 10, week: 50, month: 200, year: 500, allTime: 1000 },
    });
    const token = createAdminToken("boost", TEST_SECRET);
    const req = mockReq({ path: "/boost", query: { hmac: token } });
    const res = mockRes();
    await admin(req, res);
    expect(res.htmlBody).not.toContain("<script>");
    expect(res.htmlBody).toContain("Boost");
  });

  /* ── Error handling ── */

  test("returns 500 on internal error", async () => {
    mockBoostLimit.mockRejectedValue(new Error("DB failure"));
    const req = mockReq({
      path: "/boost",
      method: "POST",
      headers: { authorization: `Bearer ${TEST_SECRET}` },
    });
    const res = mockRes();
    await admin(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  /* ── Path variations ── */

  test("handles /api/admin/boost path", async () => {
    const req = mockReq({
      path: "/api/admin/boost",
      method: "POST",
      headers: { authorization: `Bearer ${TEST_SECRET}` },
    });
    const res = mockRes();
    await admin(req, res);
    expect(res.body.ok).toBe(true);
    expect(res.body.action).toBe("boost");
  });

  test("handles /api/admin/reset path", async () => {
    const req = mockReq({
      path: "/api/admin/reset",
      method: "POST",
      headers: { authorization: `Bearer ${TEST_SECRET}` },
    });
    const res = mockRes();
    await admin(req, res);
    expect(res.body.ok).toBe(true);
    expect(res.body.action).toBe("reset");
  });
});
