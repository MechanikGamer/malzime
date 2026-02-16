const { buildPrivacyRisks } = require("../privacy");

describe("buildPrivacyRisks", () => {
  test("returns empty array for clean input", () => {
    const risks = buildPrivacyRisks({ ocrText: "", exif: {}, labels: [] });
    expect(risks).toEqual([]);
  });

  test("detects address in OCR text", () => {
    const risks = buildPrivacyRisks({ ocrText: "Musterstraße 12", exif: {}, labels: [] });
    expect(risks.length).toBeGreaterThan(0);
    expect(risks[0]).toMatch(/Adresse|schulbezogen/);
  });

  test("detects school reference", () => {
    const risks = buildPrivacyRisks({ ocrText: "Grundschule Nord", exif: {}, labels: [] });
    expect(risks.some((r) => r.includes("schulbezogen") || r.includes("Adresse"))).toBe(true);
  });

  test("detects phone number", () => {
    const risks = buildPrivacyRisks({ ocrText: "0732 12345678", exif: {}, labels: [] });
    expect(risks.some((r) => r.includes("Telefonnummer"))).toBe(true);
  });

  test("ignores watermark text for phone detection", () => {
    const risks = buildPrivacyRisks({ ocrText: "Shutterstock 123456789", exif: {}, labels: [] });
    expect(risks.some((r) => r.includes("Telefonnummer"))).toBe(false);
  });

  test("detects license plate from labels", () => {
    const risks = buildPrivacyRisks({ ocrText: "", exif: {}, labels: ["Kennzeichen", "Auto"] });
    expect(risks.some((r) => r.includes("Kennzeichen"))).toBe(true);
  });

  test("detects license plate from OCR pattern", () => {
    const risks = buildPrivacyRisks({ ocrText: "LL-AB 1234", exif: {}, labels: [] });
    expect(risks.some((r) => r.includes("Kennzeichen"))).toBe(true);
  });
});
