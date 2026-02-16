const { buildDescriptionFromLabels } = require("../gemini");

// We only test the pure functions from gemini.js here.
// describeImage and generateBothProfiles depend on Vertex AI and are integration-tested.

describe("buildDescriptionFromLabels", () => {
  test("builds description from labels only", () => {
    const vision = { labels: ["Person", "Outdoor", "Smile"], objects: [], faces: [], landmarks: [], ocrText: "" };
    const exif = {};
    const result = buildDescriptionFromLabels(vision, exif);
    expect(result).toBe("Im Bild erkannte Elemente: Person, Outdoor, Smile.");
  });

  test("includes objects when present", () => {
    const vision = { labels: ["Dog"], objects: ["Person", "Car"], faces: [], landmarks: [], ocrText: "" };
    const exif = {};
    const result = buildDescriptionFromLabels(vision, exif);
    expect(result).toContain("Erkannte Objekte: Person, Car.");
  });

  test("includes face descriptions with emotions", () => {
    const vision = {
      labels: ["Person"],
      objects: [],
      faces: [
        { emotions: ["fröhlich"], hasHeadwear: false, confidence: 0.9 },
        { emotions: ["traurig", "überrascht"], hasHeadwear: true, confidence: 0.85 },
      ],
      landmarks: [],
      ocrText: "",
    };
    const exif = {};
    const result = buildDescriptionFromLabels(vision, exif);
    expect(result).toContain("Erkannte Gesichter (2)");
    expect(result).toContain("Person 1");
    expect(result).toContain("Emotion: fröhlich");
    expect(result).toContain("Person 2");
    expect(result).toContain("trägt Kopfbedeckung");
  });

  test("includes landmarks", () => {
    const vision = { labels: ["Building"], objects: [], faces: [], landmarks: ["Eiffel Tower"], ocrText: "" };
    const exif = {};
    const result = buildDescriptionFromLabels(vision, exif);
    expect(result).toContain("Erkannte Orte/Sehenswürdigkeiten: Eiffel Tower.");
  });

  test("includes OCR text", () => {
    const vision = { labels: [], objects: [], faces: [], landmarks: [], ocrText: "Musterstraße 12" };
    const exif = {};
    const result = buildDescriptionFromLabels(vision, exif);
    expect(result).toContain('Im Bild lesbarer Text: "Musterstraße 12".');
  });

  test("includes camera make and model from EXIF", () => {
    const vision = { labels: ["Photo"], objects: [], faces: [], landmarks: [], ocrText: "" };
    const exif = { make: "Canon", model: "EOS R5" };
    const result = buildDescriptionFromLabels(vision, exif);
    expect(result).toContain("Aufgenommen mit: Canon EOS R5.");
  });

  test("includes only make when model is missing", () => {
    const vision = { labels: ["Photo"], objects: [], faces: [], landmarks: [], ocrText: "" };
    const exif = { make: "Apple" };
    const result = buildDescriptionFromLabels(vision, exif);
    expect(result).toContain("Aufgenommen mit: Apple.");
  });

  test("does NOT include dateTimeOriginal (privacy)", () => {
    const vision = { labels: ["Photo"], objects: [], faces: [], landmarks: [], ocrText: "" };
    const exif = { make: "Canon", dateTimeOriginal: "2024:07:12 09:42:10" };
    const result = buildDescriptionFromLabels(vision, exif);
    expect(result).not.toContain("2024");
    expect(result).not.toContain("dateTimeOriginal");
  });

  test("returns null when no data at all", () => {
    const vision = { labels: [], objects: [], faces: [], landmarks: [], ocrText: "" };
    const exif = {};
    const result = buildDescriptionFromLabels(vision, exif);
    expect(result).toBeNull();
  });

  test("combines all parts with spaces", () => {
    const vision = {
      labels: ["Person", "Dog"],
      objects: ["Ball"],
      faces: [{ emotions: ["fröhlich"], hasHeadwear: false, confidence: 0.9 }],
      landmarks: ["Alpen"],
      ocrText: "Hallo",
    };
    const exif = { make: "Sony", model: "A7III" };
    const result = buildDescriptionFromLabels(vision, exif);

    // All parts should be present
    expect(result).toContain("Im Bild erkannte Elemente: Person, Dog.");
    expect(result).toContain("Erkannte Objekte: Ball.");
    expect(result).toContain("Erkannte Gesichter (1)");
    expect(result).toContain("Erkannte Orte/Sehenswürdigkeiten: Alpen.");
    expect(result).toContain('Im Bild lesbarer Text: "Hallo".');
    expect(result).toContain("Aufgenommen mit: Sony A7III.");
  });

  test("handles empty objects/faces arrays", () => {
    const vision = { labels: ["Dog"], objects: [], faces: [], landmarks: [], ocrText: "" };
    const exif = {};
    const result = buildDescriptionFromLabels(vision, exif);
    expect(result).not.toContain("Erkannte Objekte");
    expect(result).not.toContain("Erkannte Gesichter");
  });

  test("handles face with no emotions and no headwear", () => {
    const vision = {
      labels: ["Person"],
      objects: [],
      faces: [{ emotions: [], hasHeadwear: false, confidence: 0.7 }],
      landmarks: [],
      ocrText: "",
    };
    const exif = {};
    const result = buildDescriptionFromLabels(vision, exif);
    expect(result).toContain("Person 1");
    expect(result).not.toContain("Emotion");
    expect(result).not.toContain("Kopfbedeckung");
  });
});
