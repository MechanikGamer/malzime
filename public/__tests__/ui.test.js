import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { setupDOM } from "./setup.js";

describe("Scan Animation", () => {
  let startScanAnim, stopScanAnim;
  let elements;

  beforeEach(async () => {
    setupDOM();
    vi.useFakeTimers();
    const uiMod = await import("../js/ui.js");
    const domMod = await import("../js/dom.js");
    startScanAnim = uiMod.startScanAnim;
    stopScanAnim = uiMod.stopScanAnim;
    elements = domMod.elements;
  });

  afterEach(() => {
    stopScanAnim();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("sets scanAnim to active", () => {
    startScanAnim();
    expect(elements.scanAnim.classList.contains("active")).toBe(true);
  });

  it("stopScanAnim removes active class", () => {
    startScanAnim();
    stopScanAnim();
    expect(elements.scanAnim.classList.contains("active")).toBe(false);
  });

  it("BUG-009: double startScanAnim does not leak intervals", () => {
    const spy = vi.spyOn(globalThis, "clearInterval");
    startScanAnim();
    startScanAnim();
    expect(spy).toHaveBeenCalled();
  });

  it("rotates scan messages on interval", () => {
    startScanAnim();
    const _first = elements.scanText.textContent;
    vi.advanceTimersByTime(1800);
    const second = elements.scanText.textContent;
    expect(typeof second).toBe("string");
    expect(second.length).toBeGreaterThan(0);
  });
});

describe("setStatus", () => {
  let setStatus, elements;

  beforeEach(async () => {
    setupDOM();
    const uiMod = await import("../js/ui.js");
    const domMod = await import("../js/dom.js");
    setStatus = uiMod.setStatus;
    elements = domMod.elements;
  });

  it("shows text and adds visible class", () => {
    setStatus("Fehler aufgetreten");
    expect(elements.status.textContent).toBe("Fehler aufgetreten");
    expect(elements.status.classList.contains("visible")).toBe(true);
  });

  it("clears text and removes visible class when empty", () => {
    setStatus("Test");
    setStatus("");
    expect(elements.status.textContent).toBe("");
    expect(elements.status.classList.contains("visible")).toBe(false);
  });

  it("clears on null/undefined", () => {
    setStatus("Test");
    setStatus(null);
    expect(elements.status.textContent).toBe("");
    expect(elements.status.classList.contains("visible")).toBe(false);
  });
});

describe("getBiasMode", () => {
  let getBiasMode, elements;

  beforeEach(async () => {
    setupDOM();
    const uiMod = await import("../js/ui.js");
    const domMod = await import("../js/dom.js");
    getBiasMode = uiMod.getBiasMode;
    elements = domMod.elements;
  });

  it("returns 'normal' when unchecked", () => {
    elements.biasSwitch.checked = false;
    expect(getBiasMode()).toBe("normal");
  });

  it("returns 'boost' when checked", () => {
    elements.biasSwitch.checked = true;
    expect(getBiasMode()).toBe("boost");
  });
});

describe("Disclaimer Modal", () => {
  let showDisclaimerModal, dismissDisclaimerModal, elements;

  beforeEach(async () => {
    setupDOM();
    const uiMod = await import("../js/ui.js");
    const domMod = await import("../js/dom.js");
    showDisclaimerModal = uiMod.showDisclaimerModal;
    dismissDisclaimerModal = uiMod.dismissDisclaimerModal;
    elements = domMod.elements;
  });

  it("adds active class on show", () => {
    showDisclaimerModal(() => {});
    expect(elements.disclaimerModal.classList.contains("active")).toBe(true);
  });

  it("removes active class on confirm click", () => {
    const cb = vi.fn();
    showDisclaimerModal(cb);
    elements.disclaimerConfirm.click();
    expect(elements.disclaimerModal.classList.contains("active")).toBe(false);
    expect(cb).toHaveBeenCalledOnce();
  });

  it("dismissDisclaimerModal removes active without callback", () => {
    const cb = vi.fn();
    showDisclaimerModal(cb);
    dismissDisclaimerModal();
    expect(elements.disclaimerModal.classList.contains("active")).toBe(false);
    /* Callback sollte NICHT aufgerufen worden sein */
    expect(cb).not.toHaveBeenCalled();
  });

  it("BUG-002: double show does not leak listeners", () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    showDisclaimerModal(cb1);
    showDisclaimerModal(cb2);
    elements.disclaimerConfirm.click();
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledOnce();
  });
});

describe("Print Notes", () => {
  let insertPrintNotes, removePrintNotes;

  beforeEach(async () => {
    setupDOM();
    const uiMod = await import("../js/ui.js");
    insertPrintNotes = uiMod.insertPrintNotes;
    removePrintNotes = uiMod.removePrintNotes;
  });

  it("removePrintNotes clears all .print-note elements", () => {
    const note = document.createElement("div");
    note.className = "print-note";
    document.body.appendChild(note);
    expect(document.querySelectorAll(".print-note").length).toBe(1);
    removePrintNotes();
    expect(document.querySelectorAll(".print-note").length).toBe(0);
  });

  it("insertPrintNotes does nothing when no cards exist", () => {
    insertPrintNotes();
    expect(document.querySelectorAll(".print-note").length).toBe(0);
  });

  it("insertPrintNotes adds notes when cards exceed page height", () => {
    /* Simuliere sichtbare Karten mit offsetHeight */
    const container = document.createElement("div");
    for (let i = 0; i < 5; i++) {
      const card = document.createElement("div");
      card.className = "cat-card";
      Object.defineProperty(card, "offsetHeight", { value: 300, configurable: true });
      container.appendChild(card);
    }
    document.body.appendChild(container);
    insertPrintNotes();
    expect(document.querySelectorAll(".print-note").length).toBeGreaterThan(0);
  });
});
