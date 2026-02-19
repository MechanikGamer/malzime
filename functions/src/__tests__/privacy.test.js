const { buildPrivacyRisks } = require("../privacy");

describe("buildPrivacyRisks", () => {
  test("returns empty array for clean input", () => {
    const risks = buildPrivacyRisks({ ocrText: "", exif: {}, labels: [] });
    expect(risks).toEqual([]);
  });

  test("detects address in OCR text", () => {
    const risks = buildPrivacyRisks({ ocrText: "Musterstraße 12", exif: {}, labels: [] });
    expect(risks).toContain("privacy.address");
  });

  test("detects school reference", () => {
    const risks = buildPrivacyRisks({ ocrText: "Grundschule Nord", exif: {}, labels: [] });
    expect(risks).toContain("privacy.address");
  });

  test("detects phone number", () => {
    const risks = buildPrivacyRisks({ ocrText: "0732 12345678", exif: {}, labels: [] });
    expect(risks).toContain("privacy.phone");
  });

  test("ignores watermark text for phone detection", () => {
    const risks = buildPrivacyRisks({ ocrText: "Shutterstock 123456789", exif: {}, labels: [] });
    expect(risks).not.toContain("privacy.phone");
  });

  test("detects license plate from labels", () => {
    const risks = buildPrivacyRisks({ ocrText: "", exif: {}, labels: ["Kennzeichen", "Auto"] });
    expect(risks).toContain("privacy.licensePlate");
  });

  test("detects license plate from OCR pattern", () => {
    const risks = buildPrivacyRisks({ ocrText: "LL-AB 1234", exif: {}, labels: [] });
    expect(risks).toContain("privacy.licensePlate");
  });
});
