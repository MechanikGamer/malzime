import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

describe("i18n micro module", () => {
  let initI18n, t, getLanguage, applyTranslations;

  beforeEach(async () => {
    vi.resetModules();

    /* navigator.language mocken */
    Object.defineProperty(navigator, "language", { value: "de-AT", configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function loadWithMocks(manifest, strings) {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("manifest.json")) {
        return Promise.resolve({ json: () => Promise.resolve(manifest) });
      }
      return Promise.resolve({ json: () => Promise.resolve(strings) });
    });

    const mod = await import("../js/i18n.js");
    initI18n = mod.initI18n;
    t = mod.t;
    getLanguage = mod.getLanguage;
    applyTranslations = mod.applyTranslations;
  }

  it("initializes with default language from manifest", async () => {
    await loadWithMocks({ languages: ["de"], default: "de" }, { "hero.badge": "SYSTEM AKTIV" });
    await initI18n();
    expect(getLanguage()).toBe("de");
    expect(t("hero.badge")).toBe("SYSTEM AKTIV");
  });

  it("falls back to default when browser language is not available", async () => {
    Object.defineProperty(navigator, "language", { value: "fr-FR", configurable: true });
    await loadWithMocks({ languages: ["de"], default: "de" }, { "hero.badge": "SYSTEM AKTIV" });
    await initI18n();
    expect(getLanguage()).toBe("de");
  });

  it("selects matching browser language when available", async () => {
    Object.defineProperty(navigator, "language", { value: "en-US", configurable: true });
    await loadWithMocks({ languages: ["de", "en"], default: "de" }, { "hero.badge": "SYSTEM ACTIVE" });
    await initI18n();
    expect(getLanguage()).toBe("en");
    expect(globalThis.fetch).toHaveBeenCalledWith("/locales/en.json");
  });

  it("returns key name for missing keys", async () => {
    await loadWithMocks({ languages: ["de"], default: "de" }, {});
    await initI18n();
    expect(t("missing.key")).toBe("missing.key");
  });

  it("replaces placeholders with params", async () => {
    await loadWithMocks({ languages: ["de"], default: "de" }, { "footer.copy": "© {{year}} malziME" });
    await initI18n();
    expect(t("footer.copy", { year: 2026 })).toBe("© 2026 malziME");
  });

  it("replaces multiple occurrences of same placeholder", async () => {
    await loadWithMocks({ languages: ["de"], default: "de" }, { test: "{{x}} und {{x}}" });
    await initI18n();
    expect(t("test", { x: "A" })).toBe("A und A");
  });

  it("returns arrays as-is", async () => {
    const messages = ["Gesicht erkannt…", "Kleidung wird analysiert…"];
    await loadWithMocks({ languages: ["de"], default: "de" }, { "scan.messages": messages });
    await initI18n();
    expect(t("scan.messages")).toEqual(messages);
  });

  it("sets html lang attribute", async () => {
    await loadWithMocks({ languages: ["de"], default: "de" }, {});
    await initI18n();
    expect(document.documentElement.lang).toBe("de");
  });

  it("survives fetch failure gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    const mod = await import("../js/i18n.js");
    await mod.initI18n();
    expect(mod.getLanguage()).toBe("de");
    expect(mod.t("any.key")).toBe("any.key");
  });

  it("applyTranslations sets textContent from data-i18n", async () => {
    await loadWithMocks({ languages: ["de"], default: "de" }, { "hero.title": "Testtitel" });
    await initI18n();

    const el = document.createElement("h1");
    el.setAttribute("data-i18n", "hero.title");
    el.textContent = "Fallback";
    document.body.appendChild(el);

    applyTranslations();
    expect(el.textContent).toBe("Testtitel");

    document.body.removeChild(el);
  });

  it("applyTranslations preserves fallback text when key is missing", async () => {
    await loadWithMocks({ languages: ["de"], default: "de" }, {});
    await initI18n();

    const el = document.createElement("h1");
    el.setAttribute("data-i18n", "missing.key");
    el.textContent = "Deutscher Fallback";
    document.body.appendChild(el);

    applyTranslations();
    expect(el.textContent).toBe("Deutscher Fallback");

    document.body.removeChild(el);
  });

  it("applyTranslations sets alt from data-i18n-alt", async () => {
    await loadWithMocks({ languages: ["de"], default: "de" }, { "preview.alt": "Vorschau" });
    await initI18n();

    const img = document.createElement("img");
    img.setAttribute("data-i18n-alt", "preview.alt");
    img.alt = "Fallback";
    document.body.appendChild(img);

    applyTranslations();
    expect(img.alt).toBe("Vorschau");

    document.body.removeChild(img);
  });

  it("applyTranslations sets innerHTML from data-i18n-html", async () => {
    await loadWithMocks(
      { languages: ["de"], default: "de" },
      { "disclaimer.main": "<strong>malziME</strong> ist ein Lern-Tool." }
    );
    await initI18n();

    const el = document.createElement("div");
    el.setAttribute("data-i18n-html", "disclaimer.main");
    el.innerHTML = "Fallback";
    document.body.appendChild(el);

    applyTranslations();
    expect(el.innerHTML).toBe("<strong>malziME</strong> ist ein Lern-Tool.");

    document.body.removeChild(el);
  });
});
