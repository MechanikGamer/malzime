/* Tests for counter.js — Firestore-based analysis counter */

const mockGet = jest.fn();
const mockSet = jest.fn();
const mockUpdate = jest.fn();
const mockRunTransaction = jest.fn();
const mockDoc = jest.fn();

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    doc: mockDoc,
    runTransaction: mockRunTransaction,
  }),
  FieldValue: {
    increment: (n) => ({ __increment: n }),
  },
}));

jest.mock("../config", () => ({
  HOURLY_LIMIT: 500,
  HOURLY_WINDOW_MINUTES: 60,
}));

const { checkAndIncrement, incrementTotals, getStats, boostLimit, resetCounter } = require("../counter");

beforeEach(() => {
  jest.clearAllMocks();
  mockDoc.mockReturnValue({ get: mockGet, update: mockUpdate, set: mockSet });
});

describe("checkAndIncrement", () => {
  test("allows request and increments counter when under limit", async () => {
    mockRunTransaction.mockImplementation(async (fn) => {
      const tx = { get: jest.fn(), set: jest.fn(), update: jest.fn() };
      tx.get.mockResolvedValue({
        exists: true,
        data: () => ({ count: 50, hourlyTotal: 50, limit: 1000, windowMinutes: 60, limitReachedAt: null }),
      });
      return fn(tx);
    });

    const result = await checkAndIncrement();
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(51);
    expect(result.hourlyTotal).toBe(51);
    expect(result.retryAfterSeconds).toBe(0);
  });

  test("allows the last analysis at limit and sets limitReachedAt", async () => {
    mockRunTransaction.mockImplementation(async (fn) => {
      const tx = { get: jest.fn(), set: jest.fn(), update: jest.fn() };
      tx.get.mockResolvedValue({
        exists: true,
        data: () => ({ count: 999, hourlyTotal: 999, limit: 1000, windowMinutes: 60, limitReachedAt: null }),
      });
      return fn(tx);
    });

    const result = await checkAndIncrement();
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(1000);
    expect(result.hourlyTotal).toBe(1000);
    expect(result.justReached).toBe(true);
  });

  test("blocks when over limit", async () => {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    mockRunTransaction.mockImplementation(async (fn) => {
      const tx = { get: jest.fn(), set: jest.fn(), update: jest.fn() };
      tx.get.mockResolvedValue({
        exists: true,
        data: () => ({
          count: 1000,
          hourlyTotal: 1000,
          limit: 1000,
          windowMinutes: 60,
          limitReachedAt: { toMillis: () => fiveMinAgo },
        }),
      });
      return fn(tx);
    });

    const result = await checkAndIncrement();
    expect(result.allowed).toBe(false);
    expect(result.count).toBe(1000);
    expect(result.hourlyTotal).toBe(1000);
    expect(result.retryAfterSeconds).toBeGreaterThan(3200);
  });

  test("blocks when limitReachedAt is within window", async () => {
    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    mockRunTransaction.mockImplementation(async (fn) => {
      const tx = { get: jest.fn(), set: jest.fn(), update: jest.fn() };
      tx.get.mockResolvedValue({
        exists: true,
        data: () => ({ count: 1000, limit: 1000, windowMinutes: 60, limitReachedAt: { toMillis: () => tenMinAgo } }),
      });
      return fn(tx);
    });

    const result = await checkAndIncrement();
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(3000);
  });

  test("resets counter when window has expired", async () => {
    const twoHoursAgo = Date.now() - 120 * 60 * 1000;
    mockRunTransaction.mockImplementation(async (fn) => {
      const tx = { get: jest.fn(), set: jest.fn(), update: jest.fn() };
      tx.get.mockResolvedValue({
        exists: true,
        data: () => ({
          count: 1000,
          hourlyTotal: 1000,
          limit: 1000,
          windowMinutes: 60,
          limitReachedAt: { toMillis: () => twoHoursAgo },
        }),
      });
      return fn(tx);
    });

    const result = await checkAndIncrement();
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(1);
    expect(result.hourlyTotal).toBe(1);
  });

  test("allows after admin reset when count >= limit but limitReachedAt cleared", async () => {
    mockRunTransaction.mockImplementation(async (fn) => {
      const tx = { get: jest.fn(), set: jest.fn(), update: jest.fn() };
      tx.get.mockResolvedValue({
        exists: true,
        data: () => ({ count: 500, hourlyTotal: 500, limit: 500, windowMinutes: 60, limitReachedAt: null }),
      });
      return fn(tx);
    });

    const result = await checkAndIncrement();
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(1);
    expect(result.hourlyTotal).toBe(501);
  });

  test("initializes document when it does not exist", async () => {
    mockRunTransaction.mockImplementation(async (fn) => {
      const tx = { get: jest.fn(), set: jest.fn(), update: jest.fn() };
      tx.get.mockResolvedValue({ exists: false, data: () => ({}) });
      return fn(tx);
    });

    const result = await checkAndIncrement();
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(1);
    expect(result.hourlyTotal).toBe(1);
  });

  test("fail-open on Firestore error", async () => {
    mockRunTransaction.mockRejectedValue(new Error("Firestore unavailable"));

    const result = await checkAndIncrement();
    expect(result.allowed).toBe(true);
    expect(result.error).toBe("Firestore unavailable");
  });

  test("uses default limit when not set in document", async () => {
    mockRunTransaction.mockImplementation(async (fn) => {
      const tx = { get: jest.fn(), set: jest.fn(), update: jest.fn() };
      tx.get.mockResolvedValue({ exists: true, data: () => ({ count: 5 }) });
      return fn(tx);
    });

    const result = await checkAndIncrement();
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(500);
  });
});

describe("incrementTotals", () => {
  test("increments all time periods on same day", async () => {
    const now = new Date();
    const todayDate = now.toISOString().slice(0, 10);
    const monthKey = now.toISOString().slice(0, 7);
    const yearKey = String(now.getFullYear());
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    const weekStart = monday.toISOString().slice(0, 10);

    mockRunTransaction.mockImplementation(async (fn) => {
      const tx = { get: jest.fn(), set: jest.fn() };
      tx.get.mockResolvedValue({
        exists: true,
        data: () => ({
          today: 10,
          todayDate,
          week: 50,
          weekStart,
          month: 200,
          monthKey,
          year: 500,
          yearKey,
          allTime: 1000,
        }),
      });
      return fn(tx);
    });

    await incrementTotals();

    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
  });

  test("resets day counter on new day", async () => {
    let savedData = null;
    mockRunTransaction.mockImplementation(async (fn) => {
      const tx = {
        get: jest.fn(),
        set: jest.fn((_ref, data) => {
          savedData = data;
        }),
      };
      tx.get.mockResolvedValue({
        exists: true,
        data: () => ({
          today: 99,
          todayDate: "2020-01-01",
          week: 50,
          weekStart: "2020-01-01",
          month: 200,
          monthKey: "2020-01",
          year: 500,
          yearKey: "2020",
          allTime: 1000,
        }),
      });
      return fn(tx);
    });

    await incrementTotals();
    expect(savedData.today).toBe(1);
    expect(savedData.allTime).toBe(1001);
  });

  test("does not throw on Firestore error", async () => {
    mockRunTransaction.mockRejectedValue(new Error("DB down"));
    await expect(incrementTotals()).resolves.toBeUndefined();
  });
});

describe("getStats", () => {
  test("returns combined current and totals data", async () => {
    mockDoc.mockImplementation((path) => ({
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () =>
          path === "stats/current"
            ? { count: 42, hourlyTotal: 55, limit: 1000, windowMinutes: 60, limitReachedAt: null }
            : { today: 10, week: 50, month: 200, year: 500, allTime: 1000 },
      }),
    }));

    const result = await getStats();
    expect(result.current.count).toBe(42);
    expect(result.current.hourlyTotal).toBe(55);
    expect(result.current.limit).toBe(1000);
    expect(result.current.limitActive).toBe(false);
    expect(result.totals.allTime).toBe(1000);
  });

  test("hourlyTotal falls back to count when field missing", async () => {
    mockDoc.mockImplementation((path) => ({
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () =>
          path === "stats/current"
            ? { count: 42, limit: 1000, windowMinutes: 60, limitReachedAt: null }
            : { today: 10, week: 50, month: 200, year: 500, allTime: 1000 },
      }),
    }));

    const result = await getStats();
    expect(result.current.hourlyTotal).toBe(42);
  });

  test("calculates retryAfterSeconds when limit is active", async () => {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    mockDoc.mockImplementation((path) => ({
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () =>
          path === "stats/current"
            ? { count: 1000, limit: 1000, windowMinutes: 60, limitReachedAt: { toMillis: () => fiveMinAgo } }
            : { today: 10, week: 50, month: 200, year: 500, allTime: 1000 },
      }),
    }));

    const result = await getStats();
    expect(result.current.limitActive).toBe(true);
    expect(result.current.retryAfterSeconds).toBeGreaterThan(3200);
    expect(result.current.retryAfterSeconds).toBeLessThanOrEqual(3300);
  });

  test("returns null on Firestore error", async () => {
    mockDoc.mockImplementation(() => ({
      get: jest.fn().mockRejectedValue(new Error("DB down")),
    }));

    const result = await getStats();
    expect(result).toBeNull();
  });

  test("returns defaults when documents do not exist", async () => {
    mockDoc.mockImplementation(() => ({
      get: jest.fn().mockResolvedValue({ exists: false, data: () => ({}) }),
    }));

    const result = await getStats();
    expect(result.current.count).toBe(0);
    expect(result.current.limit).toBe(500);
    expect(result.totals.allTime).toBe(0);
  });
});

describe("boostLimit", () => {
  test("increments limit by specified amount and clears limitReachedAt", async () => {
    await boostLimit(200);
    expect(mockUpdate).toHaveBeenCalledWith({ limit: { __increment: 200 }, limitReachedAt: null });
  });

  test("defaults to 100 when no amount given", async () => {
    await boostLimit();
    expect(mockUpdate).toHaveBeenCalledWith({ limit: { __increment: 100 }, limitReachedAt: null });
  });
});

describe("resetCounter", () => {
  test("resets count and limit to default, keeps hourlyTotal", async () => {
    await resetCounter();
    expect(mockUpdate).toHaveBeenCalledWith({ count: 0, limitReachedAt: null, limit: 500 });
  });
});
