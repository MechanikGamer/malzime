// Tests for index.js — the main analyze handler
// We test the exported Cloud Function by mocking all dependencies.

jest.mock("firebase-admin/app", () => ({
  initializeApp: jest.fn(),
}));

jest.mock("firebase-functions/v2/https", () => ({
  onRequest: jest.fn((opts, handler) => handler),
}));

const mockAnalyzeWithVision = jest.fn();
jest.mock("../vision", () => ({
  analyzeWithVision: mockAnalyzeWithVision,
}));

const mockDescribeImage = jest.fn();
const mockBuildDescriptionFromLabels = jest.fn();
const mockGenerateBothProfiles = jest.fn();
jest.mock("../gemini", () => ({
  describeImage: mockDescribeImage,
  buildDescriptionFromLabels: mockBuildDescriptionFromLabels,
  generateBothProfiles: mockGenerateBothProfiles,
}));

const mockBuildPrivacyRisks = jest.fn();
jest.mock("../privacy", () => ({
  buildPrivacyRisks: mockBuildPrivacyRisks,
}));

const mockCheckRateLimit = jest.fn();
const mockGetClientIp = jest.fn();
jest.mock("../middleware", () => ({
  checkRateLimit: mockCheckRateLimit,
  getClientIp: mockGetClientIp,
}));

const mockParseMultipart = jest.fn();
const mockParseJsonBody = jest.fn();
jest.mock("../upload", () => ({
  parseMultipart: mockParseMultipart,
  parseJsonBody: mockParseJsonBody,
}));

// Load the handler after mocking
const { analyze } = require("../index");

/* SEC-009: Gültiger JPEG-Header für Magic-Byte-Check */
const VALID_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const VALID_JPEG_B64 = VALID_JPEG.toString("base64");

function mockReq(overrides = {}) {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: {},
    ip: "127.0.0.1",
    ...overrides,
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status: jest.fn(function (code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function (data) {
      this.body = data;
    }),
  };
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetClientIp.mockReturnValue("127.0.0.1");
  mockCheckRateLimit.mockReturnValue(true);
  mockBuildPrivacyRisks.mockReturnValue([]);
});

describe("analyze handler", () => {
  /* ── HTTP Method ── */
  test("rejects non-POST requests with 405", async () => {
    const req = mockReq({ method: "GET" });
    const res = mockRes();
    await analyze(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.body.error).toBe("Method not allowed");
  });

  /* ── Rate Limiting ── */
  test("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue(false);
    const req = mockReq();
    const res = mockRes();
    mockParseJsonBody.mockReturnValue({ imageBase64: "AAAA" });
    await analyze(req, res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.body.error).toBe("Rate limit exceeded");
  });

  /* ── Honeypot ── */
  test("returns 403 when honeypot is filled", async () => {
    mockParseJsonBody.mockReturnValue({
      website: "i-am-a-bot",
      imageBase64: VALID_JPEG_B64,
      mimeType: "image/jpeg",
    });
    const req = mockReq();
    const res = mockRes();
    await analyze(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.error).toBe("Forbidden");
  });

  /* ── Demo Path ── */
  test("returns demo data for known demoImageId", async () => {
    mockParseJsonBody.mockReturnValue({ demoImageId: "demo-1" });
    const req = mockReq();
    const res = mockRes();
    await analyze(req, res);

    expect(res.body.meta.mode).toBe("demo");
    expect(res.body.meta.demoId).toBe("demo-1");
    expect(res.body.profiles).toBeDefined();
    expect(res.body.profiles.normal).toBeDefined();
    expect(res.body.profiles.boost).toBeDefined();
    expect(res.body.profiles.normal.categories).toBeDefined();
    expect(res.body.profiles.normal.ad_targeting).toBeDefined();
    expect(res.body.profiles.normal.manipulation_triggers).toBeDefined();
    expect(res.body.profiles.normal.profileText).toBeDefined();
  });

  test("does not use demo path for unknown demoImageId", async () => {
    mockParseJsonBody.mockReturnValue({
      demoImageId: "nonexistent-demo",
      imageBase64: VALID_JPEG_B64,
      mimeType: "image/jpeg",
    });

    mockAnalyzeWithVision.mockResolvedValue({
      labels: ["Person", "Smile"],
      landmarks: [],
      ocrText: "",
      ocrTextRaw: "",
      faces: [],
      objects: [],
    });
    mockDescribeImage.mockResolvedValue("A person smiling");
    mockGenerateBothProfiles.mockResolvedValue({
      normal: {
        categories: { alter: { label: "Alter", value: "test", confidence: 0.5 } },
        ad_targeting: [],
        manipulation_triggers: [],
        profileText: "test",
      },
      boost: {
        categories: { alter: { label: "Alter", value: "test", confidence: 0.5 } },
        ad_targeting: [],
        manipulation_triggers: [],
        profileText: "test",
      },
    });

    const req = mockReq();
    const res = mockRes();
    await analyze(req, res);

    expect(res.body.meta.mode).toBe("multimodal");
  });

  /* ── Validation ── */
  test("returns 400 when no image provided", async () => {
    mockParseJsonBody.mockReturnValue({});
    const req = mockReq();
    const res = mockRes();
    await analyze(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toBe("Missing image");
  });

  test("returns 400 for invalid MIME type", async () => {
    mockParseJsonBody.mockReturnValue({
      imageBase64: VALID_JPEG_B64,
      mimeType: "application/pdf",
    });
    const req = mockReq();
    const res = mockRes();
    await analyze(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toContain("Invalid file type");
  });

  test("returns 413 for oversized base64 input", async () => {
    // Create a string that estimates to > 6MB
    const hugeBase64 = "A".repeat(9 * 1024 * 1024); // ~6.75MB decoded
    mockParseJsonBody.mockReturnValue({
      imageBase64: hugeBase64,
      mimeType: "image/jpeg",
    });
    const req = mockReq();
    const res = mockRes();
    await analyze(req, res);
    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.body.error).toBe("File too large");
  });

  test("returns 400 for invalid base64 characters (BUG-013)", async () => {
    mockParseJsonBody.mockReturnValue({
      imageBase64: "!!!INVALID_BASE64!!!",
      mimeType: "image/jpeg",
    });
    const req = mockReq();
    const res = mockRes();
    await analyze(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toBe("Invalid image data");
  });

  /* SEC-009: Magic-Byte-Validierung */
  test("returns 400 when magic bytes don't match any image format (SEC-009)", async () => {
    const fakeBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
    mockParseJsonBody.mockReturnValue({
      imageBase64: fakeBuffer.toString("base64"),
      mimeType: "image/jpeg",
    });
    const req = mockReq();
    const res = mockRes();
    await analyze(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toBe("Invalid image data");
  });

  test("accepts valid MIME types: jpeg, png, webp, gif", async () => {
    for (const mime of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
      jest.clearAllMocks();
      mockGetClientIp.mockReturnValue("127.0.0.1");
      mockCheckRateLimit.mockReturnValue(true);
      mockBuildPrivacyRisks.mockReturnValue([]);

      mockParseJsonBody.mockReturnValue({
        imageBase64: VALID_JPEG_B64,
        mimeType: mime,
      });
      mockAnalyzeWithVision.mockResolvedValue({
        labels: ["Person"],
        landmarks: [],
        ocrText: "",
        ocrTextRaw: "",
        faces: [],
        objects: [],
      });
      mockDescribeImage.mockResolvedValue("A person");
      mockGenerateBothProfiles.mockResolvedValue({
        normal: {
          categories: { a: { label: "A", value: "v", confidence: 0.5 } },
          ad_targeting: [],
          manipulation_triggers: [],
          profileText: "",
        },
        boost: null,
      });

      const req = mockReq();
      const res = mockRes();
      await analyze(req, res);

      expect(res.statusCode).toBe(200);
    }
  });

  /* ── Person/Animal Keyword Detection ── */
  test("detects animal-only labels and returns Easter egg profile", async () => {
    mockParseJsonBody.mockReturnValue({
      imageBase64: VALID_JPEG_B64,
      mimeType: "image/jpeg",
    });
    mockAnalyzeWithVision.mockResolvedValue({
      labels: ["Dog", "Animal", "Pet", "Grass"],
      landmarks: [],
      ocrText: "",
      ocrTextRaw: "",
      faces: [],
      objects: [],
    });

    const req = mockReq();
    const res = mockRes();
    await analyze(req, res);

    expect(res.body.meta.mode).toBe("animal");
    expect(res.body.profiles).toBeDefined();
    expect(res.body.profiles.normal).toBeDefined();
    expect(res.body.profiles.boost).toBeDefined();
    expect(res.body.profiles.normal.profileText).toContain("Hund");
  });

  test("detects cat and returns cat-specific profile", async () => {
    mockParseJsonBody.mockReturnValue({
      imageBase64: VALID_JPEG_B64,
      mimeType: "image/jpeg",
    });
    mockAnalyzeWithVision.mockResolvedValue({
      labels: ["Cat", "Kitten", "Whiskers"],
      landmarks: [],
      ocrText: "",
      ocrTextRaw: "",
      faces: [],
      objects: [],
    });

    const req = mockReq();
    const res = mockRes();
    await analyze(req, res);

    expect(res.body.meta.mode).toBe("animal");
    expect(res.body.profiles.normal.categories.alter.value).toContain("9 Leben");
    expect(res.body.profiles.normal.categories.beruf.value).toContain("Ignorieren");
  });

  test("detects bird and returns bird-specific profile", async () => {
    mockParseJsonBody.mockReturnValue({
      imageBase64: VALID_JPEG_B64,
      mimeType: "image/jpeg",
    });
    mockAnalyzeWithVision.mockResolvedValue({
      labels: ["Bird", "Parrot", "Feather"],
      landmarks: [],
      ocrText: "",
      ocrTextRaw: "",
      faces: [],
      objects: [],
    });

    const req = mockReq();
    const res = mockRes();
    await analyze(req, res);

    expect(res.body.meta.mode).toBe("animal");
    expect(res.body.profiles.normal.categories.beruf.value).toContain("Sänger");
  });

  test("person + animal labels → analyzes as person (not animal)", async () => {
    mockParseJsonBody.mockReturnValue({
      imageBase64: VALID_JPEG_B64,
      mimeType: "image/jpeg",
    });
    mockAnalyzeWithVision.mockResolvedValue({
      labels: ["Person", "Dog", "Smile", "Pet"],
      landmarks: [],
      ocrText: "",
      ocrTextRaw: "",
      faces: [],
      objects: [],
    });
    mockDescribeImage.mockResolvedValue("A person with a dog");
    mockGenerateBothProfiles.mockResolvedValue({
      normal: {
        categories: { a: { label: "A", value: "v", confidence: 0.5 } },
        ad_targeting: [],
        manipulation_triggers: [],
        profileText: "",
      },
      boost: null,
    });

    const req = mockReq();
    const res = mockRes();
    await analyze(req, res);

    expect(res.body.meta.mode).toBe("multimodal");
  });

  test("no person and no animal labels → proceeds to Gemini (no strict check)", async () => {
    mockParseJsonBody.mockReturnValue({
      imageBase64: VALID_JPEG_B64,
      mimeType: "image/jpeg",
    });
    mockAnalyzeWithVision.mockResolvedValue({
      labels: ["Landscape", "Mountain", "Sky"],
      landmarks: [],
      ocrText: "",
      ocrTextRaw: "",
      faces: [],
      objects: [],
    });
    mockDescribeImage.mockResolvedValue("A mountain landscape");
    mockGenerateBothProfiles.mockResolvedValue({
      normal: {
        categories: { a: { label: "A", value: "v", confidence: 0.5 } },
        ad_targeting: [],
        manipulation_triggers: [],
        profileText: "",
      },
      boost: null,
    });

    const req = mockReq();
    const res = mockRes();
    await analyze(req, res);

    // Should NOT return animal mode, and should proceed to Gemini
    expect(res.body.meta.mode).toBe("multimodal");
    expect(mockDescribeImage).toHaveBeenCalled();
  });

  /* ── Age Label Filtering ── */
  test("filters age labels (toddler, baby, infant, newborn) before profile generation", async () => {
    mockParseJsonBody.mockReturnValue({
      imageBase64: VALID_JPEG_B64,
      mimeType: "image/jpeg",
    });
    mockAnalyzeWithVision.mockResolvedValue({
      labels: ["Person", "Child", "Toddler", "Baby", "Smile"],
      landmarks: [],
      ocrText: "",
      ocrTextRaw: "",
      faces: [],
      objects: [],
    });
    mockDescribeImage.mockResolvedValue("A child smiling");
    mockGenerateBothProfiles.mockResolvedValue({
      normal: {
        categories: { a: { label: "A", value: "v", confidence: 0.5 } },
        ad_targeting: [],
        manipulation_triggers: [],
        profileText: "",
      },
      boost: null,
    });

    const req = mockReq();
    const res = mockRes();
    await analyze(req, res);

    // generateBothProfiles should receive filtered labels (without Toddler, Baby)
    expect(mockGenerateBothProfiles).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.arrayContaining(["Toddler", "Baby"]),
      expect.any(Object),
      expect.any(Array),
      expect.any(Function)
    );
    // But "Person", "Child", "Smile" should remain
    expect(mockGenerateBothProfiles).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(["Person", "Child", "Smile"]),
      expect.any(Object),
      expect.any(Array),
      expect.any(Function)
    );
  });

  /* ── Toddler still counts as person indicator BEFORE filtering ── */
  test("Toddler label counts as person indicator even though it gets filtered later", async () => {
    mockParseJsonBody.mockReturnValue({
      imageBase64: VALID_JPEG_B64,
      mimeType: "image/jpeg",
    });
    // Only "Toddler" and "Dog" — Toddler is in PERSON_KEYWORDS AND AGE_LABELS
    mockAnalyzeWithVision.mockResolvedValue({
      labels: ["Toddler", "Dog"],
      landmarks: [],
      ocrText: "",
      ocrTextRaw: "",
      faces: [],
      objects: [],
    });
    mockDescribeImage.mockResolvedValue("A toddler with a dog");
    mockGenerateBothProfiles.mockResolvedValue({
      normal: {
        categories: { a: { label: "A", value: "v", confidence: 0.5 } },
        ad_targeting: [],
        manipulation_triggers: [],
        profileText: "",
      },
      boost: null,
    });

    const req = mockReq();
    const res = mockRes();
    await analyze(req, res);

    // Person detected (via Toddler) → NOT animal mode, proceed to Gemini
    expect(res.body.meta.mode).toBe("multimodal");
  });

  /* ── EXIF Handling ── */
  test("passes clientExif to privacy risks and response", async () => {
    const clientExif = { make: "Apple", model: "iPhone 15 Pro" };
    mockParseJsonBody.mockReturnValue({
      imageBase64: VALID_JPEG_B64,
      mimeType: "image/jpeg",
      exif: clientExif,
    });
    mockAnalyzeWithVision.mockResolvedValue({
      labels: ["Person"],
      landmarks: [],
      ocrText: "",
      ocrTextRaw: "",
      faces: [],
      objects: [],
    });
    mockDescribeImage.mockResolvedValue("A person");
    mockGenerateBothProfiles.mockResolvedValue({
      normal: {
        categories: { a: { label: "A", value: "v", confidence: 0.5 } },
        ad_targeting: [],
        manipulation_triggers: [],
        profileText: "",
      },
      boost: null,
    });

    const req = mockReq();
    const res = mockRes();
    await analyze(req, res);

    expect(res.body.exif).toEqual(clientExif);
    expect(mockBuildPrivacyRisks).toHaveBeenCalledWith(expect.objectContaining({ exif: clientExif }));
  });

  /* ── SEC-006: clientExif Validierung ── */
  test("strips unknown keys from clientExif (SEC-006)", async () => {
    mockParseJsonBody.mockReturnValue({
      imageBase64: VALID_JPEG_B64,
      mimeType: "image/jpeg",
      exif: { make: "Apple", model: "iPhone", evil: "payload", __proto__: "hack", nested: { deep: true } },
    });
    mockAnalyzeWithVision.mockResolvedValue({
      labels: ["Person"],
      landmarks: [],
      ocrText: "",
      ocrTextRaw: "",
      faces: [],
      objects: [],
    });
    mockDescribeImage.mockResolvedValue("A person");
    mockGenerateBothProfiles.mockResolvedValue({
      normal: {
        categories: { a: { label: "A", value: "v", confidence: 0.5 } },
        ad_targeting: [],
        manipulation_triggers: [],
        profileText: "",
      },
      boost: null,
    });

    const req = mockReq();
    const res = mockRes();
    await analyze(req, res);

    /* Only make, model, dateTimeOriginal should pass through */
    expect(res.body.exif).toEqual({ make: "Apple", model: "iPhone" });
    expect(res.body.exif.evil).toBeUndefined();
    expect(res.body.exif.nested).toBeUndefined();
  });

  test("truncates long EXIF values (SEC-006)", async () => {
    const longString = "A".repeat(200);
    mockParseJsonBody.mockReturnValue({
      imageBase64: VALID_JPEG_B64,
      mimeType: "image/jpeg",
      exif: { make: longString, model: "ok" },
    });
    mockAnalyzeWithVision.mockResolvedValue({
      labels: ["Person"],
      landmarks: [],
      ocrText: "",
      ocrTextRaw: "",
      faces: [],
      objects: [],
    });
    mockDescribeImage.mockResolvedValue("A person");
    mockGenerateBothProfiles.mockResolvedValue({
      normal: {
        categories: { a: { label: "A", value: "v", confidence: 0.5 } },
        ad_targeting: [],
        manipulation_triggers: [],
        profileText: "",
      },
      boost: null,
    });

    const req = mockReq();
    const res = mockRes();
    await analyze(req, res);

    expect(res.body.exif.make.length).toBe(100);
    expect(res.body.exif.model).toBe("ok");
  });

  test("rejects non-string EXIF values (SEC-006)", async () => {
    mockParseJsonBody.mockReturnValue({
      imageBase64: VALID_JPEG_B64,
      mimeType: "image/jpeg",
      exif: { make: 12345, model: true },
    });
    mockAnalyzeWithVision.mockResolvedValue({
      labels: ["Person"],
      landmarks: [],
      ocrText: "",
      ocrTextRaw: "",
      faces: [],
      objects: [],
    });
    mockDescribeImage.mockResolvedValue("A person");
    mockGenerateBothProfiles.mockResolvedValue({
      normal: {
        categories: { a: { label: "A", value: "v", confidence: 0.5 } },
        ad_targeting: [],
        manipulation_triggers: [],
        profileText: "",
      },
      boost: null,
    });

    const req = mockReq();
    const res = mockRes();
    await analyze(req, res);

    expect(res.body.exif).toEqual({});
  });

  /* ── Describe Fallback ── */
  test("uses label-based fallback when Gemini describe returns null", async () => {
    mockParseJsonBody.mockReturnValue({
      imageBase64: VALID_JPEG_B64,
      mimeType: "image/jpeg",
    });
    mockAnalyzeWithVision.mockResolvedValue({
      labels: ["Person", "Outdoor"],
      landmarks: [],
      ocrText: "",
      ocrTextRaw: "",
      faces: [],
      objects: [],
    });
    mockDescribeImage.mockResolvedValue(null); // Safety filter blocked
    mockBuildDescriptionFromLabels.mockReturnValue("Im Bild erkannte Elemente: Person, Outdoor.");
    mockGenerateBothProfiles.mockResolvedValue({
      normal: {
        categories: { a: { label: "A", value: "v", confidence: 0.5 } },
        ad_targeting: [],
        manipulation_triggers: [],
        profileText: "",
      },
      boost: null,
    });

    const req = mockReq();
    const res = mockRes();
    await analyze(req, res);

    expect(mockBuildDescriptionFromLabels).toHaveBeenCalled();
    expect(mockGenerateBothProfiles).toHaveBeenCalled();
  });

  /* ── Blocked Response ── */
  test("returns blocked response when both describe and profile fail", async () => {
    mockParseJsonBody.mockReturnValue({
      imageBase64: VALID_JPEG_B64,
      mimeType: "image/jpeg",
    });
    mockAnalyzeWithVision.mockResolvedValue({
      labels: ["Person"],
      landmarks: [],
      ocrText: "",
      ocrTextRaw: "",
      faces: [],
      objects: [],
    });
    mockDescribeImage.mockResolvedValue(null);
    mockBuildDescriptionFromLabels.mockReturnValue("Im Bild: Person.");
    mockGenerateBothProfiles.mockResolvedValue({ normal: null, boost: null });

    const req = mockReq();
    const res = mockRes();
    await analyze(req, res);

    expect(res.body.profiles).toBeNull();
    expect(res.body.blockedReason).toBeDefined();
    expect(res.body.meta.mode).toBe("blocked");
  });

  test("returns blocked with safety_filter reason when describe returns null and no fallback works", async () => {
    mockParseJsonBody.mockReturnValue({
      imageBase64: VALID_JPEG_B64,
      mimeType: "image/jpeg",
    });
    mockAnalyzeWithVision.mockResolvedValue({
      labels: [],
      landmarks: [],
      ocrText: "",
      ocrTextRaw: "",
      faces: [],
      objects: [],
    });
    mockDescribeImage.mockResolvedValue(null);
    mockBuildDescriptionFromLabels.mockReturnValue(null);

    const req = mockReq();
    const res = mockRes();
    await analyze(req, res);

    expect(res.body.profiles).toBeNull();
    expect(res.body.blockedReason).toBeDefined();
  });

  /* ── Successful multimodal flow ── */
  test("returns full profile on successful multimodal analysis", async () => {
    mockParseJsonBody.mockReturnValue({
      imageBase64: VALID_JPEG_B64,
      mimeType: "image/jpeg",
    });
    mockAnalyzeWithVision.mockResolvedValue({
      labels: ["Person", "Outdoor"],
      landmarks: [],
      ocrText: "",
      ocrTextRaw: "",
      faces: [],
      objects: [],
    });
    mockDescribeImage.mockResolvedValue("A person standing outdoors");
    mockBuildPrivacyRisks.mockReturnValue(["Privacy risk 1"]);
    mockGenerateBothProfiles.mockResolvedValue({
      normal: {
        categories: { alter: { label: "Alter & Geschlecht", value: "Du bist männlich, ca. 30", confidence: 0.8 } },
        ad_targeting: ["Produkt 1"],
        manipulation_triggers: ["Trigger 1"],
        profileText: "Du bist ein Test.",
      },
      boost: {
        categories: { alter: { label: "Alter & Geschlecht", value: "Männlich, 30", confidence: 0.9 } },
        ad_targeting: ["Produkt 2"],
        manipulation_triggers: ["Trigger 2"],
        profileText: "Du bist ein Test-Boost.",
      },
    });

    const req = mockReq();
    const res = mockRes();
    await analyze(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.meta.mode).toBe("multimodal");
    expect(res.body.profiles.normal.categories.alter.value).toContain("männlich");
    expect(res.body.profiles.boost.profileText).toContain("Boost");
    expect(res.body.privacyRisks).toEqual(["Privacy risk 1"]);
    expect(res.body.meta.requestId).toBeDefined();
  });

  /* ── Animal Easter Egg Response Structure ── */
  test("animal response has correct structure (normal + boost with all fields)", async () => {
    mockParseJsonBody.mockReturnValue({
      imageBase64: VALID_JPEG_B64,
      mimeType: "image/jpeg",
    });
    mockAnalyzeWithVision.mockResolvedValue({
      labels: ["Cat", "Animal", "Fur"],
      landmarks: [],
      ocrText: "",
      ocrTextRaw: "",
      faces: [],
      objects: [],
    });

    const req = mockReq();
    const res = mockRes();
    await analyze(req, res);

    const { profiles } = res.body;
    expect(profiles.normal.categories).toBeDefined();
    expect(profiles.normal.ad_targeting).toBeInstanceOf(Array);
    expect(profiles.normal.manipulation_triggers).toBeInstanceOf(Array);
    expect(typeof profiles.normal.profileText).toBe("string");
    expect(profiles.boost.categories).toBeDefined();
    expect(profiles.boost.ad_targeting).toBeInstanceOf(Array);
    expect(profiles.boost.manipulation_triggers).toBeInstanceOf(Array);
    expect(typeof profiles.boost.profileText).toBe("string");
  });

  /* ── Expanded animal keywords ── */
  test("detects guinea pig / rodent as animal", async () => {
    mockParseJsonBody.mockReturnValue({
      imageBase64: VALID_JPEG_B64,
      mimeType: "image/jpeg",
    });
    mockAnalyzeWithVision.mockResolvedValue({
      labels: ["Rodent", "Guinea pig", "Grass"],
      landmarks: [],
      ocrText: "",
      ocrTextRaw: "",
      faces: [],
      objects: [],
    });

    const req = mockReq();
    const res = mockRes();
    await analyze(req, res);

    expect(res.body.meta.mode).toBe("animal");
  });

  /* ── Multipart fallback ── */
  test("falls back to multipart parsing when not JSON", async () => {
    mockParseJsonBody.mockReturnValue(null);
    mockParseMultipart.mockResolvedValue({
      fields: {},
      file: {
        buffer: VALID_JPEG,
        mimeType: "image/jpeg",
        filename: "test.jpg",
        size: VALID_JPEG.length,
      },
    });
    mockAnalyzeWithVision.mockResolvedValue({
      labels: ["Person"],
      landmarks: [],
      ocrText: "",
      ocrTextRaw: "",
      faces: [],
      objects: [],
    });
    mockDescribeImage.mockResolvedValue("A person");
    mockGenerateBothProfiles.mockResolvedValue({
      normal: {
        categories: { a: { label: "A", value: "v", confidence: 0.5 } },
        ad_targeting: [],
        manipulation_triggers: [],
        profileText: "",
      },
      boost: null,
    });

    const req = mockReq({ headers: { "content-type": "multipart/form-data" } });
    const res = mockRes();
    await analyze(req, res);

    expect(mockParseMultipart).toHaveBeenCalled();
    expect(res.body.meta.mode).toBe("multimodal");
  });

  /* ── Describe error fallback ── */
  test("handles describe error gracefully and falls back to labels", async () => {
    mockParseJsonBody.mockReturnValue({
      imageBase64: VALID_JPEG_B64,
      mimeType: "image/jpeg",
    });
    mockAnalyzeWithVision.mockResolvedValue({
      labels: ["Person"],
      landmarks: [],
      ocrText: "",
      ocrTextRaw: "",
      faces: [],
      objects: [],
    });
    mockDescribeImage.mockRejectedValue(new Error("Vertex AI down"));
    mockBuildDescriptionFromLabels.mockReturnValue("Im Bild: Person.");
    mockGenerateBothProfiles.mockResolvedValue({
      normal: {
        categories: { a: { label: "A", value: "v", confidence: 0.5 } },
        ad_targeting: [],
        manipulation_triggers: [],
        profileText: "",
      },
      boost: null,
    });

    const req = mockReq();
    const res = mockRes();
    await analyze(req, res);

    expect(mockBuildDescriptionFromLabels).toHaveBeenCalled();
    expect(res.body.meta.mode).toBe("multimodal");
  });

  /* ── Profile generation error ── */
  test("returns blocked when profile generation throws", async () => {
    mockParseJsonBody.mockReturnValue({
      imageBase64: VALID_JPEG_B64,
      mimeType: "image/jpeg",
    });
    mockAnalyzeWithVision.mockResolvedValue({
      labels: ["Person"],
      landmarks: [],
      ocrText: "",
      ocrTextRaw: "",
      faces: [],
      objects: [],
    });
    mockDescribeImage.mockResolvedValue("A person");
    mockGenerateBothProfiles.mockRejectedValue(new Error("Gemini error"));

    const req = mockReq();
    const res = mockRes();
    await analyze(req, res);

    expect(res.body.profiles).toBeNull();
    expect(res.body.blockedReason).toBeDefined();
    expect(res.body.meta.mode).toBe("blocked");
  });

  /* ── Generic animal (not dog/cat/bird specific) ── */
  test("returns generic animal profile for unrecognized animal type", async () => {
    mockParseJsonBody.mockReturnValue({
      imageBase64: VALID_JPEG_B64,
      mimeType: "image/jpeg",
    });
    mockAnalyzeWithVision.mockResolvedValue({
      labels: ["Reptile", "Lizard", "Animal"],
      landmarks: [],
      ocrText: "",
      ocrTextRaw: "",
      faces: [],
      objects: [],
    });

    const req = mockReq();
    const res = mockRes();
    await analyze(req, res);

    expect(res.body.meta.mode).toBe("animal");
    expect(res.body.profiles.normal.profileText).toContain("Tier");
  });
});
