import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { setupDOM } from "./setup.js";

describe("Geocoding", () => {
  let startGeocoding, state;

  beforeEach(async () => {
    setupDOM();
    const stateMod = await import("../js/state.js");
    const geoMod = await import("../js/geocoding.js");
    state = stateMod.state;
    startGeocoding = geoMod.startGeocoding;
    state.pendingGeocode = null;
    state.geocodeAbortController = null;
  });

  afterEach(() => {
    if (state.geocodeAbortController) {
      state.geocodeAbortController.abort();
      state.geocodeAbortController = null;
    }
    vi.restoreAllMocks();
  });

  it("sets pendingGeocode promise", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: () => Promise.resolve({ display_name: "Wien, Österreich" }),
    });
    startGeocoding(48.2082, 16.3738);
    expect(state.pendingGeocode).toBeInstanceOf(Promise);
  });

  it("resolves with display_name on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: () => Promise.resolve({ display_name: "Wien, Innere Stadt" }),
    });
    startGeocoding(48.2082, 16.3738);
    const address = await state.pendingGeocode;
    expect(address).toBe("Wien, Innere Stadt");
  });

  it("resolves with null on fetch error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    startGeocoding(48.2082, 16.3738);
    const address = await state.pendingGeocode;
    expect(address).toBeNull();
  });

  it("resolves with null when display_name is missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: () => Promise.resolve({}),
    });
    startGeocoding(48.2082, 16.3738);
    const address = await state.pendingGeocode;
    expect(address).toBeNull();
  });

  it("aborts previous geocoding when called again", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: () => Promise.resolve({ display_name: "Alt" }),
    });
    startGeocoding(48.0, 16.0);
    const firstController = state.geocodeAbortController;

    startGeocoding(47.0, 15.0);
    expect(firstController.signal.aborted).toBe(true);
  });

  it("constructs correct Nominatim URL with de language", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: () => Promise.resolve({ display_name: "Test" }),
    });
    startGeocoding(48.2082, 16.3738);
    const url = fetchSpy.mock.calls[0][0];
    expect(url).toContain("nominatim.openstreetmap.org");
    expect(url).toContain("lat=48.2082");
    expect(url).toContain("lon=16.3738");
    expect(url).toContain("accept-language=de");
  });
});
