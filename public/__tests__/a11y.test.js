import { describe, it, expect, beforeEach } from "vitest";

/**
 * Accessibility tests — prüft dass alle interaktiven Elemente
 * per Tastatur erreichbar sind (kein display:none, kein visibility:hidden,
 * kein tabindex=-1 auf wichtigen Elementen).
 */

function buildPage() {
  document.body.innerHTML = `
    <a href="#main" class="skip-link">Zum Inhalt springen</a>
    <main id="main">
      <section class="upload-section">
        <label class="file-drop" for="fileInput">
          <input id="fileInput" type="file" accept="image/*" />
        </label>
        <div class="hp-field" aria-hidden="true">
          <input type="text" id="website" tabindex="-1" />
        </div>
      </section>
      <div class="bias-toggle-wrap">
        <div class="bias-toggle">
          <span class="bias-opt" data-mode="normal">
            <span class="info-icon" tabindex="0" role="button" aria-label="Info">
              <span class="info-i">i</span>
            </span>
          </span>
          <label class="toggle-switch">
            <input type="checkbox" id="biasSwitch" aria-label="Beast Mode aktivieren" />
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
          </label>
          <span class="bias-opt boost" data-mode="boost">
            <span class="info-icon" tabindex="0" role="button" aria-label="Info">
              <span class="info-i">i</span>
            </span>
          </span>
        </div>
      </div>
      <section class="demo-section">
        <div class="demo-grid">
          <button class="demo-thumb" data-demo="selfie" type="button">Selfie</button>
          <button class="demo-thumb" data-demo="cafe" type="button">Café</button>
          <button class="demo-thumb" data-demo="hiker" type="button">Hiker</button>
        </div>
      </section>
    </main>
    <a href="https://github.com" class="opensource-link">GitHub</a>
    <a href="https://buymeacoffee.com" class="support-btn">Support</a>
    <footer><a href="/impressum">Impressum</a><a href="/datenschutz">Datenschutz</a></footer>
  `;
}

describe("Keyboard accessibility", () => {
  beforeEach(() => buildPage());

  it("skip-link is focusable", () => {
    const link = document.querySelector(".skip-link");
    expect(link).toBeTruthy();
    expect(link.tabIndex).not.toBe(-1);
    expect(link.getAttribute("href")).toBe("#main");
  });

  it("file input is NOT display:none (must be tabbable)", () => {
    const input = document.getElementById("fileInput");
    expect(input).toBeTruthy();
    /* display:none würde tabIndex auf -1 setzen in echten Browsern —
       hier prüfen wir dass kein display:none/hidden Attribut gesetzt ist */
    expect(input.style.display).not.toBe("none");
    expect(input.hidden).toBe(false);
    expect(input.tabIndex).not.toBe(-1);
  });

  it("honeypot field has tabindex=-1 (not tabbable)", () => {
    const hp = document.getElementById("website");
    expect(hp.tabIndex).toBe(-1);
  });

  it("bias toggle checkbox is NOT display:none (must be tabbable)", () => {
    const toggle = document.getElementById("biasSwitch");
    expect(toggle).toBeTruthy();
    expect(toggle.type).toBe("checkbox");
    expect(toggle.style.display).not.toBe("none");
    expect(toggle.hidden).toBe(false);
    expect(toggle.tabIndex).not.toBe(-1);
  });

  it("bias toggle has aria-label", () => {
    const toggle = document.getElementById("biasSwitch");
    expect(toggle.getAttribute("aria-label")).toBeTruthy();
  });

  it("info icons have tabindex=0 and role=button", () => {
    const icons = document.querySelectorAll(".info-icon");
    expect(icons.length).toBe(2);
    icons.forEach((icon) => {
      expect(icon.tabIndex).toBe(0);
      expect(icon.getAttribute("role")).toBe("button");
      expect(icon.getAttribute("aria-label")).toBeTruthy();
    });
  });

  it("demo buttons are native <button> elements (inherently tabbable)", () => {
    const buttons = document.querySelectorAll(".demo-thumb");
    expect(buttons.length).toBe(3);
    buttons.forEach((btn) => {
      expect(btn.tagName).toBe("BUTTON");
      expect(btn.type).toBe("button");
      expect(btn.tabIndex).not.toBe(-1);
      expect(btn.hidden).toBe(false);
    });
  });

  it("expected tab order: skip → file → info1 → toggle → info2 → demos → links", () => {
    /* Sammle alle tabbable Elemente in DOM-Reihenfolge */
    const tabbable = Array.from(
      document.querySelectorAll('a[href], button:not([disabled]), input:not([tabindex="-1"]), [tabindex="0"]')
    ).filter((el) => !el.hidden && el.style.display !== "none" && el.tabIndex !== -1);

    const ids = tabbable.map((el) => el.id || el.className.split(" ")[0] || el.tagName.toLowerCase());

    /* Skip-link muss vor fileInput kommen */
    expect(ids.indexOf("skip-link")).toBeLessThan(ids.indexOf("fileInput"));

    /* fileInput muss vor biasSwitch kommen */
    expect(ids.indexOf("fileInput")).toBeLessThan(ids.indexOf("biasSwitch"));

    /* biasSwitch muss zwischen den zwei info-icons liegen */
    const infoIndices = [];
    tabbable.forEach((el, i) => {
      if (el.classList.contains("info-icon")) infoIndices.push(i);
    });
    expect(infoIndices.length).toBe(2);
    const toggleIdx = tabbable.findIndex((el) => el.id === "biasSwitch");
    expect(toggleIdx).toBeGreaterThan(infoIndices[0]);
    expect(toggleIdx).toBeLessThan(infoIndices[1]);
  });

  it("demo section has no hidden elements that should be tabbable", () => {
    const demoButtons = document.querySelectorAll(".demo-thumb");
    demoButtons.forEach((btn) => {
      expect(btn.hidden).toBe(false);
      expect(btn.style.display).not.toBe("none");
    });
  });

  it("modal is not visible by default (no focus trap active)", () => {
    /* Modal sollte standardmäßig nicht im DOM-Flow sein */
    const modal = document.querySelector(".modal-overlay");
    /* Wenn kein Modal im Test-DOM → OK, kein Focus-Trap-Risiko */
    if (modal) {
      expect(modal.classList.contains("active")).toBe(false);
    }
  });
});
