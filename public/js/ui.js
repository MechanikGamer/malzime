import { elements } from "./dom.js";
import { t } from "./i18n.js";

/* ── Scan-Animation ── */

let scanInterval = null;

export function setStatus(text) {
  if (!text) {
    elements.status.textContent = "";
    elements.status.classList.remove("visible");
    return;
  }
  elements.status.textContent = text;
  elements.status.classList.add("visible");
}

export function getBiasMode() {
  return elements.biasSwitch.checked ? "boost" : "normal";
}

export function startScanAnim() {
  stopScanAnim(); /* BUG-009: alten Intervall aufräumen bevor neuer startet */
  elements.scanAnim.classList.add("active");
  let idx = 0;
  const messages = t("scan.messages");
  const shuffled = [...(Array.isArray(messages) ? messages : [])].sort(() => Math.random() - 0.5);
  elements.scanText.textContent = shuffled[0];
  scanInterval = setInterval(() => {
    idx = (idx + 1) % shuffled.length;
    elements.scanText.textContent = shuffled[idx];
  }, 1800);
}

export function stopScanAnim() {
  elements.scanAnim.classList.remove("active");
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
}

/* ── Disclaimer-Modal ── */

let currentDisclaimerHandler = null;

export function showDisclaimerModal(onConfirm) {
  /* Alten Handler entfernen falls Modal bereits offen (BUG-002: Listener-Leak) */
  if (currentDisclaimerHandler) {
    elements.disclaimerConfirm.removeEventListener("click", currentDisclaimerHandler);
  }

  elements.disclaimerModal.classList.add("active");

  currentDisclaimerHandler = function handleConfirm() {
    elements.disclaimerModal.classList.remove("active");
    elements.disclaimerConfirm.removeEventListener("click", currentDisclaimerHandler);
    currentDisclaimerHandler = null;
    onConfirm();
  };

  elements.disclaimerConfirm.addEventListener("click", currentDisclaimerHandler);
}

export function dismissDisclaimerModal() {
  if (currentDisclaimerHandler) {
    elements.disclaimerConfirm.removeEventListener("click", currentDisclaimerHandler);
    currentDisclaimerHandler = null;
  }
  elements.disclaimerModal.classList.remove("active");
}

/* ── PDF-Export Hilfsfunktionen ── */

export function insertPrintNotes() {
  removePrintNotes();

  /* Alle sichtbaren Karten sammeln */
  const blocks = [...document.querySelectorAll(".cat-card, .meta-card, .target-card")].filter(
    (el) => el.offsetHeight > 0
  );

  if (blocks.length === 0) return;

  /* Höhen messen, dann Hinweise einfügen wo Seitenumbrüche wahrscheinlich sind */
  const PAGE_HEIGHT = 880;
  const NOTE_HEIGHT = 40;
  let accumulated = 200; /* Disclaimer + etwas Vorschau auf Seite 1 */

  for (const block of blocks) {
    const h = block.offsetHeight + 16;
    accumulated += h;

    if (accumulated > PAGE_HEIGHT) {
      const note = document.createElement("div");
      note.className = "print-note";
      note.textContent = t("print.note");
      block.parentNode.insertBefore(note, block);
      accumulated = NOTE_HEIGHT + h;
    }
  }
}

export function removePrintNotes() {
  document.querySelectorAll(".print-note").forEach((el) => el.remove());
}
