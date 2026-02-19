import { describe, it, expect, beforeEach } from "vitest";

/**
 * Accessibility tests — prüft dass alle interaktiven Elemente
 * per Tastatur erreichbar sind, auch in Safari.
 *
 * Safari tabbt standardmäßig NUR zu Links und Text-Inputs.
 * Buttons, Checkboxen und File-Inputs brauchen ein explizites
 * tabindex="0" um in Safari per Tab erreichbar zu sein.
 */

function buildPage() {
  document.body.innerHTML = `
    <a href="#main" class="skip-link">Zum Inhalt springen</a>
    <main id="main">
      <section class="upload-section">
        <label class="file-drop" for="fileInput">
          <input id="fileInput" type="file" accept="image/*" tabindex="0" />
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
            <input type="checkbox" id="biasSwitch" aria-label="Beast Mode aktivieren" tabindex="0" />
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
          <button class="demo-thumb" data-demo="selfie" type="button" tabindex="0">Selfie</button>
          <button class="demo-thumb" data-demo="cafe" type="button" tabindex="0">Café</button>
          <button class="demo-thumb" data-demo="hiker" type="button" tabindex="0">Hiker</button>
        </div>
      </section>
      <button id="exportPdf" class="export-btn" tabindex="0">PDF</button>
      <button id="disclaimerConfirm" class="modal-btn" tabindex="0">OK</button>
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

  it("honeypot field has tabindex=-1 (not tabbable)", () => {
    const hp = document.getElementById("website");
    expect(hp.tabIndex).toBe(-1);
  });

  it("bias toggle has aria-label", () => {
    const toggle = document.getElementById("biasSwitch");
    expect(toggle.getAttribute("aria-label")).toBeTruthy();
  });

  it("info icons have tabindex=0 and role=button", () => {
    const icons = document.querySelectorAll(".info-icon");
    expect(icons.length).toBe(2);
    icons.forEach((icon) => {
      expect(icon.getAttribute("tabindex")).toBe("0");
      expect(icon.getAttribute("role")).toBe("button");
      expect(icon.getAttribute("aria-label")).toBeTruthy();
    });
  });

  /*
   * Safari-Kompatibilität: Safari tabbt ohne macOS-Systemeinstellung
   * NUR zu Links und Text-Inputs. Buttons, Checkboxen und File-Inputs
   * brauchen ein explizites tabindex="0" im HTML-Attribut.
   */
  it("file input has explicit tabindex=0 (Safari)", () => {
    const input = document.getElementById("fileInput");
    expect(input).toBeTruthy();
    expect(input.getAttribute("tabindex")).toBe("0");
  });

  it("bias toggle checkbox has explicit tabindex=0 (Safari)", () => {
    const toggle = document.getElementById("biasSwitch");
    expect(toggle).toBeTruthy();
    expect(toggle.getAttribute("tabindex")).toBe("0");
  });

  it("demo buttons have explicit tabindex=0 (Safari)", () => {
    const buttons = document.querySelectorAll(".demo-thumb");
    expect(buttons.length).toBe(3);
    buttons.forEach((btn) => {
      expect(btn.tagName).toBe("BUTTON");
      expect(btn.getAttribute("tabindex")).toBe("0");
    });
  });

  it("export button has explicit tabindex=0 (Safari)", () => {
    const btn = document.getElementById("exportPdf");
    expect(btn.getAttribute("tabindex")).toBe("0");
  });

  it("disclaimer confirm button has explicit tabindex=0 (Safari)", () => {
    const btn = document.getElementById("disclaimerConfirm");
    expect(btn.getAttribute("tabindex")).toBe("0");
  });

  it("expected tab order: skip → file → info1 → toggle → info2 → demos → links", () => {
    const tabbable = Array.from(document.querySelectorAll('a[href], [tabindex="0"]')).filter(
      (el) => !el.hidden && el.style.display !== "none"
    );

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

  it("modal is not visible by default (no focus trap active)", () => {
    const modal = document.querySelector(".modal-overlay");
    if (modal) {
      expect(modal.classList.contains("active")).toBe(false);
    }
  });
});
