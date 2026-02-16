import { describe, it, expect, beforeEach } from "vitest";
import { setupDOM } from "./setup.js";

describe("Render helpers", () => {
  let elements, _escapeHtml;

  beforeEach(async () => {
    setupDOM();
    const domMod = await import("../js/dom.js");
    elements = domMod.elements;
    _escapeHtml = domMod.escapeHtml;
  });

  describe("EXIF labels", () => {
    it("render module exports EXIF_LABELS with German names", async () => {
      /* renderPrivacyRisks nutzt EXIF_LABELS intern — wir testen indirekt über den Output */
      const { renderCurrentMode } = await import("../js/render.js");

      const mockData = {
        profiles: {
          normal: {
            categories: { alter: { label: "Alter", value: "25", confidence: 0.8 } },
            ad_targeting: [],
            manipulation_triggers: [],
            profileText: "Test-Profil",
          },
          boost: null,
        },
        privacyRisks: [],
        exif: { make: "Apple", model: "iPhone 15 Pro" },
        meta: { requestId: "test", mode: "multimodal" },
      };

      renderCurrentMode(mockData);

      /* EXIF-Karte sollte gerendert sein */
      expect(elements.privacy.innerHTML).toContain("Apple");
      expect(elements.privacy.innerHTML).toContain("iPhone 15 Pro");
      expect(elements.privacy.innerHTML).toContain("Kamera-Hersteller");
    });
  });

  describe("GPS Map rendering", () => {
    it("does not render map when no GPS data", async () => {
      const { renderCurrentMode } = await import("../js/render.js");

      const mockData = {
        profiles: {
          normal: {
            categories: { alter: { label: "Alter", value: "25", confidence: 0.8 } },
            ad_targeting: [],
            manipulation_triggers: [],
            profileText: "Test",
          },
          boost: null,
        },
        privacyRisks: [],
        exif: {},
        meta: { requestId: "test", mode: "multimodal" },
      };

      renderCurrentMode(mockData);
      expect(elements.gpsMap.innerHTML).toBe("");
    });
  });

  describe("Blocked response", () => {
    it("renders blockedReason when profiles is null", async () => {
      const { renderCurrentMode } = await import("../js/render.js");

      const mockData = {
        profiles: null,
        blockedReason: "Bild wurde blockiert.",
        privacyRisks: [],
        exif: {},
        meta: { requestId: "test", mode: "blocked" },
      };

      renderCurrentMode(mockData);
      expect(elements.simulation.innerHTML).toContain("Bild wurde blockiert.");
    });
  });

  describe("Animal mode", () => {
    it("hides data value for animal profiles", async () => {
      const { renderCurrentMode } = await import("../js/render.js");

      const mockData = {
        profiles: {
          normal: {
            categories: { art: { label: "Tierart", value: "Hund", confidence: 0.9 } },
            ad_targeting: ["Hundefutter"],
            manipulation_triggers: ["Leckerli-Werbung"],
            profileText: "Wuff!",
          },
          boost: null,
        },
        privacyRisks: [],
        exif: {},
        meta: { requestId: "test", mode: "animal" },
      };

      renderCurrentMode(mockData);
      expect(elements.dataValue.innerHTML).toBe("");
    });
  });
});
