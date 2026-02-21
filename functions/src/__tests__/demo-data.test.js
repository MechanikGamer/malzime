const { demoData } = require("../demo-data");

describe("demo-data", () => {
  test("contains demo-1 and demo-2", () => {
    expect(demoData["demo-1"]).toBeDefined();
    expect(demoData["demo-2"]).toBeDefined();
  });

  function validateProfile(profile, label) {
    test(`${label} has required fields`, () => {
      expect(profile).toBeDefined();
      expect(typeof profile.profileText).toBe("string");
      expect(profile.profileText.length).toBeGreaterThan(50);
      expect(typeof profile.categories).toBe("object");
      expect(Array.isArray(profile.ad_targeting)).toBe(true);
      expect(profile.ad_targeting.length).toBeGreaterThanOrEqual(5);
      expect(Array.isArray(profile.manipulation_triggers)).toBe(true);
      expect(profile.manipulation_triggers.length).toBeGreaterThanOrEqual(3);
    });

    test(`${label} categories have label, value, confidence`, () => {
      const cats = profile.categories;
      for (const [_key, cat] of Object.entries(cats)) {
        expect(cat).toHaveProperty("label");
        expect(cat).toHaveProperty("value");
        expect(cat).toHaveProperty("confidence");
        expect(typeof cat.confidence).toBe("number");
        expect(cat.confidence).toBeGreaterThanOrEqual(0);
        expect(cat.confidence).toBeLessThanOrEqual(1);
      }
    });

    test(`${label} has required category keys`, () => {
      const cats = profile.categories;
      const requiredKeys = [
        "alter_geschlecht",
        "herkunft",
        "einkommen",
        "bildung",
        "beziehungsstatus",
        "interessen",
        "persoenlichkeit",
        "charakterzuege",
        "politisch",
        "gesundheit",
        "kaufkraft",
        "verletzlichkeit",
        "werbeprofil",
      ];
      for (const key of requiredKeys) {
        expect(cats).toHaveProperty(key);
      }
    });
  }

  test("exif contains only make and model (no GPS, no dateTimeOriginal)", () => {
    for (const [_id, data] of Object.entries(demoData)) {
      expect(data.exif).not.toHaveProperty("gpsLatitude");
      expect(data.exif).not.toHaveProperty("gpsLongitude");
      expect(data.exif).not.toHaveProperty("dateTimeOriginal");
      expect(data.exif).toHaveProperty("make");
      expect(data.exif).toHaveProperty("model");
    }
  });

  for (const id of ["demo-1", "demo-2"]) {
    describe(id, () => {
      const data = demoData[id] || {};

      test("has labels array", () => {
        expect(Array.isArray(data.labels)).toBe(true);
        expect(data.labels.length).toBeGreaterThan(0);
      });

      test("has exif object", () => {
        expect(data.exif).toBeDefined();
        expect(typeof data.exif).toBe("object");
      });

      test("has separate normalProfile and boostProfile", () => {
        expect(data.normalProfile).toBeDefined();
        expect(data.boostProfile).toBeDefined();
        expect(data.normalProfile).not.toBe(data.boostProfile);
      });

      validateProfile(data.normalProfile, `${id} normalProfile`);
      validateProfile(data.boostProfile, `${id} boostProfile`);
    });
  }
});
