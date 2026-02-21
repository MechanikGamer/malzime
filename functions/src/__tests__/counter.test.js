/* Tests for counter.js — Rolling window analysis counter */

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

const {
  checkAndIncrement,
  incrementTotals,
  getStats,
  boostLimit,
  resetCounter,
  filterRecent,
  calcRetrySeconds,
} = require("../counter");

beforeEach(() => {
  jest.clearAllMocks();
  mockDoc.mockReturnValue({ get: mockGet, update: mockUpdate, set: mockSet });
});

/* ── filterRecent ── */

describe("filterRecent", () => {
  const WINDOW = 60 * 60 * 1000;

  test("filters out timestamps older than window", () => {
    const now = Date.now();
    const arr = [now - 90 * 60 * 1000, now - 30 * 60 * 1000, now - 5 * 60 * 1000];
    expect(filterRecent(arr, now, WINDOW)).toHaveLength(2);
  });

  test("handles Firestore timestamps with toMillis", () => {
    const now = Date.now();
    const arr = [{ toMillis: () => now - 5 * 60 * 1000 }, { toMillis: () => now - 90 * 60 * 1000 }];
    expect(filterRecent(arr, now, WINDOW)).toHaveLength(1);
  });

  test("returns empty array for null/undefined input", () => {
    expect(filterRecent(null, Date.now(), WINDOW)).toEqual([]);
    expect(filterRecent(undefined, Date.now(), WINDOW)).toEqual([]);
  });
});

/* ── calcRetrySeconds ── */

describe("calcRetrySeconds", () => {
  const WINDOW = 60 * 60 * 1000;

  test("returns 0 when under limit", () => {
    expect(calcRetrySeconds([Date.now()], 500, Date.now(), WINDOW)).toBe(0);
  });

  test("returns seconds until oldest entry ages out at exact limit", () => {
    const now = Date.now();
    const recent = [now - 50 * 60 * 1000, now - 10 * 60 * 1000]; // 2 entries
    const result = calcRetrySeconds(recent, 2, now, WINDOW);
    // oldest is 50 min ago, ages out in 10 min = 600s
    expect(result).toBeGreaterThanOrEqual(599);
    expect(result).toBeLessThanOrEqual(601);
  });

  test("returns seconds until pivot entry ages out when over limit", () => {
    const now = Date.now();
    // 3 entries, limit 2 → need 2nd oldest (index 1) to age out
    const recent = [now - 55 * 60 * 1000, now - 50 * 60 * 1000, now - 10 * 60 * 1000];
    const result = calcRetrySeconds(recent, 2, now, WINDOW);
    // pivot is index 1 (50 min ago), ages out in 10 min = 600s
    expect(result).toBeGreaterThanOrEqual(599);
    expect(result).toBeLessThanOrEqual(601);
  });
});

/* ── checkAndIncrement ── */

describe("checkAndIncrement", () => {
  test("allows request when under limit", async () => {
    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    mockRunTransaction.mockImplementation(async (fn) => {
      const tx = { get: jest.fn(), set: jest.fn(), update: jest.fn() };
      tx.get.mockResolvedValue({
        exists: true,
        data: () => ({
          recentAnalyses: [tenMinAgo, tenMinAgo + 1000],
          limit: 500,
          windowMinutes: 60,
        }),
      });
      return fn(tx);
    });

    const result = await checkAndIncrement();
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(3);
    expect(result.hourlyTotal).toBe(3);
    expect(result.retryAfterSeconds).toBe(0);
  });

  test("rolling window filters out old entries automatically", async () => {
    const now = Date.now();
    mockRunTransaction.mockImplementation(async (fn) => {
      const tx = { get: jest.fn(), set: jest.fn(), update: jest.fn() };
      tx.get.mockResolvedValue({
        exists: true,
        data: () => ({
          recentAnalyses: [now - 90 * 60 * 1000, now - 30 * 60 * 1000, now - 5 * 60 * 1000],
          limit: 500,
          windowMinutes: 60,
        }),
      });
      return fn(tx);
    });

    const result = await checkAndIncrement();
    expect(result.hourlyTotal).toBe(3); // 2 recent + 1 new (old one filtered out)
  });

  test("blocks when at limit and returns retryAfterSeconds", async () => {
    const now = Date.now();
    const recent = Array.from({ length: 500 }, (_, i) => now - i * 1000);
    mockRunTransaction.mockImplementation(async (fn) => {
      const tx = { get: jest.fn(), set: jest.fn(), update: jest.fn() };
      tx.get.mockResolvedValue({
        exists: true,
        data: () => ({ recentAnalyses: recent, limit: 500, windowMinutes: 60 }),
      });
      return fn(tx);
    });

    const result = await checkAndIncrement();
    expect(result.allowed).toBe(false);
    expect(result.count).toBe(500);
    expect(result.hourlyTotal).toBe(500);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  test("sets justReached when count hits limit exactly", async () => {
    const now = Date.now();
    const recent = Array.from({ length: 499 }, (_, i) => now - i * 1000);
    mockRunTransaction.mockImplementation(async (fn) => {
      const tx = { get: jest.fn(), set: jest.fn(), update: jest.fn() };
      tx.get.mockResolvedValue({
        exists: true,
        data: () => ({ recentAnalyses: recent, limit: 500, windowMinutes: 60 }),
      });
      return fn(tx);
    });

    const result = await checkAndIncrement();
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(500);
    expect(result.justReached).toBe(true);
  });

  test("unblocks automatically when entries age out", async () => {
    const now = Date.now();
    // 500 entries, but 499 are older than 60 min → only 1 recent
    const recent = [
      now - 5 * 60 * 1000, // recent
      ...Array.from({ length: 499 }, (_, i) => now - (61 + i) * 60 * 1000), // old
    ];
    mockRunTransaction.mockImplementation(async (fn) => {
      const tx = { get: jest.fn(), set: jest.fn(), update: jest.fn() };
      tx.get.mockResolvedValue({
        exists: true,
        data: () => ({ recentAnalyses: recent, limit: 500, windowMinutes: 60 }),
      });
      return fn(tx);
    });

    const result = await checkAndIncrement();
    expect(result.allowed).toBe(true);
    expect(result.hourlyTotal).toBe(2); // 1 recent + 1 new
  });

  test("works after admin reset (empty recentAnalyses)", async () => {
    mockRunTransaction.mockImplementation(async (fn) => {
      const tx = { get: jest.fn(), set: jest.fn(), update: jest.fn() };
      tx.get.mockResolvedValue({
        exists: true,
        data: () => ({ recentAnalyses: [], limit: 500, windowMinutes: 60 }),
      });
      return fn(tx);
    });

    const result = await checkAndIncrement();
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(1);
    expect(result.hourlyTotal).toBe(1);
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
      tx.get.mockResolvedValue({ exists: true, data: () => ({ recentAnalyses: [] }) });
      return fn(tx);
    });

    const result = await checkAndIncrement();
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(500);
  });
});

/* ── incrementTotals ── */

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

/* ── getStats ── */

describe("getStats", () => {
  test("returns rolling window count as hourlyTotal", async () => {
    const now = Date.now();
    const recentTs = [now - 10 * 60 * 1000, now - 20 * 60 * 1000, now - 90 * 60 * 1000];
    mockDoc.mockImplementation((path) => ({
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () =>
          path === "stats/current"
            ? { recentAnalyses: recentTs, limit: 1000, windowMinutes: 60 }
            : { today: 10, week: 50, month: 200, year: 500, allTime: 1000 },
      }),
    }));

    const result = await getStats();
    expect(result.current.count).toBe(2);
    expect(result.current.hourlyTotal).toBe(2);
    expect(result.current.limit).toBe(1000);
    expect(result.current.limitActive).toBe(false);
    expect(result.totals.allTime).toBe(1000);
  });

  test("returns 0 when recentAnalyses is empty", async () => {
    mockDoc.mockImplementation((path) => ({
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () =>
          path === "stats/current"
            ? { recentAnalyses: [], limit: 500, windowMinutes: 60 }
            : { today: 10, week: 50, month: 200, year: 500, allTime: 1000 },
      }),
    }));

    const result = await getStats();
    expect(result.current.hourlyTotal).toBe(0);
    expect(result.current.count).toBe(0);
    expect(result.current.limitActive).toBe(false);
  });

  test("detects limit as active and calculates retryAfterSeconds", async () => {
    const now = Date.now();
    const recent = Array.from({ length: 500 }, (_, i) => now - i * 1000);
    mockDoc.mockImplementation((path) => ({
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () =>
          path === "stats/current"
            ? { recentAnalyses: recent, limit: 500, windowMinutes: 60 }
            : { today: 10, week: 50, month: 200, year: 500, allTime: 1000 },
      }),
    }));

    const result = await getStats();
    expect(result.current.limitActive).toBe(true);
    expect(result.current.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.current.count).toBe(500);
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
    expect(result.current.hourlyTotal).toBe(0);
    expect(result.current.limit).toBe(500);
    expect(result.totals.allTime).toBe(0);
  });
});

/* ── boostLimit ── */

describe("boostLimit", () => {
  test("increments limit by specified amount", async () => {
    await boostLimit(200);
    expect(mockUpdate).toHaveBeenCalledWith({ limit: { __increment: 200 } });
  });

  test("defaults to 100 when no amount given", async () => {
    await boostLimit();
    expect(mockUpdate).toHaveBeenCalledWith({ limit: { __increment: 100 } });
  });
});

/* ── resetCounter ── */

describe("resetCounter", () => {
  test("clears recentAnalyses and resets limit", async () => {
    await resetCounter();
    expect(mockUpdate).toHaveBeenCalledWith({ recentAnalyses: [], limit: 500 });
  });
});
