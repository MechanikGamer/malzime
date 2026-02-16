import { describe, it, expect, beforeEach } from "vitest";
import { setupDOM } from "./setup.js";

describe("State", () => {
  let state;

  beforeEach(async () => {
    setupDOM();
    const mod = await import("../js/state.js");
    state = mod.state;
    /* Reset state between tests */
    state.isAnalyzing = false;
    state.requestId = 0;
    state.currentAbortController = null;
    state.pendingGeocode = null;
    state.geocodeAbortController = null;
    state.lastPrepared = null;
    state.lastFile = null;
    state.lastData = null;
    state.gpsMapInstance = null;
  });

  it("starts with isAnalyzing false", () => {
    expect(state.isAnalyzing).toBe(false);
  });

  it("requestId increments correctly", () => {
    expect(++state.requestId).toBe(1);
    expect(++state.requestId).toBe(2);
    expect(++state.requestId).toBe(3);
  });

  it("requestId generation counter isolates requests", () => {
    const id1 = ++state.requestId;
    const id2 = ++state.requestId;
    expect(id1).not.toBe(id2);
    expect(state.requestId).toBe(id2);
    /* Stale check: id1 ist nicht mehr aktuell */
    expect(state.requestId === id1).toBe(false);
  });
});
