const { analyzeWithVision } = require("../vision");

// Mock the Vision API client
jest.mock("@google-cloud/vision", () => {
  const mockAnnotateImage = jest.fn();
  return {
    ImageAnnotatorClient: jest.fn(() => ({
      annotateImage: mockAnnotateImage,
    })),
    __mockAnnotateImage: mockAnnotateImage,
  };
});

const { __mockAnnotateImage: mockAnnotateImage } = require("@google-cloud/vision");

beforeEach(() => {
  mockAnnotateImage.mockReset();
});

describe("analyzeWithVision", () => {
  const fakeBuffer = Buffer.from("fake-image");

  test("returns labels from labelAnnotations", async () => {
    mockAnnotateImage.mockResolvedValue([
      {
        labelAnnotations: [{ description: "Person" }, { description: "Outdoor" }, { description: "Smile" }],
        textAnnotations: [],
        landmarkAnnotations: [],
      },
    ]);

    const result = await analyzeWithVision(fakeBuffer);
    expect(result.labels).toEqual(["Person", "Outdoor", "Smile"]);
  });

  test("returns OCR text from first textAnnotation", async () => {
    mockAnnotateImage.mockResolvedValue([
      {
        labelAnnotations: [],
        textAnnotations: [{ description: "Hello World\nLine 2" }, { description: "Hello" }],
        landmarkAnnotations: [],
      },
    ]);

    const result = await analyzeWithVision(fakeBuffer);
    expect(result.ocrText).toBe("Hello World\nLine 2");
  });

  test("filters watermark OCR text (shutterstock, getty, etc.)", async () => {
    mockAnnotateImage.mockResolvedValue([
      {
        labelAnnotations: [],
        textAnnotations: [{ description: "shutterstock_12345\nSome other text" }],
        landmarkAnnotations: [],
      },
    ]);

    const result = await analyzeWithVision(fakeBuffer);
    expect(result.ocrText).toBe("");
    expect(result.ocrTextRaw).toBe("shutterstock_12345\nSome other text");
  });

  test("filters iStock watermarks case-insensitively", async () => {
    mockAnnotateImage.mockResolvedValue([
      {
        labelAnnotations: [],
        textAnnotations: [{ description: "iStock by Getty Images" }],
        landmarkAnnotations: [],
      },
    ]);

    const result = await analyzeWithVision(fakeBuffer);
    expect(result.ocrText).toBe("");
  });

  test("returns empty ocrText when no textAnnotations", async () => {
    mockAnnotateImage.mockResolvedValue([
      {
        labelAnnotations: [],
        textAnnotations: [],
        landmarkAnnotations: [],
      },
    ]);

    const result = await analyzeWithVision(fakeBuffer);
    expect(result.ocrText).toBe("");
    expect(result.ocrTextRaw).toBe("");
  });

  /* EU Vision API liefert nie faceAnnotations/localizedObjectAnnotations.
     faces und objects sind immer leere Arrays. */
  test("always returns empty faces and objects (EU endpoint limitation)", async () => {
    mockAnnotateImage.mockResolvedValue([
      {
        labelAnnotations: [{ description: "Person" }],
        textAnnotations: [],
        faceAnnotations: [{ joyLikelihood: "VERY_LIKELY", detectionConfidence: 0.95 }],
        localizedObjectAnnotations: [{ name: "Person" }],
        landmarkAnnotations: [],
      },
    ]);

    const result = await analyzeWithVision(fakeBuffer);
    expect(result.faces).toEqual([]);
    expect(result.objects).toEqual([]);
  });

  test("returns landmarks", async () => {
    mockAnnotateImage.mockResolvedValue([
      {
        labelAnnotations: [],
        textAnnotations: [],
        landmarkAnnotations: [{ description: "Eiffel Tower" }],
      },
    ]);

    const result = await analyzeWithVision(fakeBuffer);
    expect(result.landmarks).toEqual(["Eiffel Tower"]);
  });

  test("handles null/undefined annotations gracefully", async () => {
    mockAnnotateImage.mockResolvedValue([
      {
        labelAnnotations: null,
        textAnnotations: null,
        landmarkAnnotations: null,
      },
    ]);

    const result = await analyzeWithVision(fakeBuffer);
    expect(result.labels).toEqual([]);
    expect(result.ocrText).toBe("");
    expect(result.faces).toEqual([]);
    expect(result.objects).toEqual([]);
    expect(result.landmarks).toEqual([]);
  });

  test("handles missing annotations keys gracefully", async () => {
    mockAnnotateImage.mockResolvedValue([{}]);

    const result = await analyzeWithVision(fakeBuffer);
    expect(result.labels).toEqual([]);
    expect(result.ocrText).toBe("");
    expect(result.faces).toEqual([]);
    expect(result.objects).toEqual([]);
    expect(result.landmarks).toEqual([]);
  });

  test("returns fallback on API error", async () => {
    mockAnnotateImage.mockRejectedValue(new Error("API quota exceeded"));

    const result = await analyzeWithVision(fakeBuffer);
    expect(result.labels).toEqual([]);
    expect(result.ocrText).toBe("");
    expect(result.faces).toEqual([]);
    expect(result.objects).toEqual([]);
    expect(result.landmarks).toEqual([]);
  });

  test("filters null/undefined descriptions from labels", async () => {
    mockAnnotateImage.mockResolvedValue([
      {
        labelAnnotations: [{ description: "Dog" }, { description: null }, { description: "" }, { description: "Cat" }],
        textAnnotations: [],
        landmarkAnnotations: [],
      },
    ]);

    const result = await analyzeWithVision(fakeBuffer);
    expect(result.labels).toEqual(["Dog", "Cat"]);
  });

  test("returns fallback when Vision API times out", async () => {
    jest.useFakeTimers();

    mockAnnotateImage.mockImplementation(() => new Promise(() => {})); // never resolves

    const promise = analyzeWithVision(fakeBuffer);
    jest.advanceTimersByTime(45000);

    const result = await promise;
    expect(result.labels).toEqual([]);
    expect(result.ocrText).toBe("");
    expect(result.faces).toEqual([]);
    expect(result.objects).toEqual([]);

    jest.useRealTimers();
  });
});
