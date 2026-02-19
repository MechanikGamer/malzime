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
let previouslyFocused = null;
let currentKeyHandler = null;

export function showDisclaimerModal(onConfirm) {
  /* Alten Handler entfernen falls Modal bereits offen (BUG-002: Listener-Leak) */
  if (currentDisclaimerHandler) {
    elements.disclaimerConfirm.removeEventListener("click", currentDisclaimerHandler);
  }
  if (currentKeyHandler) {
    document.removeEventListener("keydown", currentKeyHandler);
  }

  previouslyFocused = document.activeElement;
  elements.disclaimerModal.classList.add("active");
  elements.disclaimerConfirm.focus();

  currentDisclaimerHandler = function handleConfirm() {
    closeModal();
    onConfirm();
  };

  currentKeyHandler = function handleKey(e) {
    if (e.key === "Escape") {
      closeModal();
      return;
    }
    /* Focus-Trap: Tab bleibt im Modal */
    if (e.key === "Tab") {
      e.preventDefault();
      elements.disclaimerConfirm.focus();
    }
  };

  elements.disclaimerConfirm.addEventListener("click", currentDisclaimerHandler);
  document.addEventListener("keydown", currentKeyHandler);
}

function closeModal() {
  elements.disclaimerModal.classList.remove("active");
  if (currentDisclaimerHandler) {
    elements.disclaimerConfirm.removeEventListener("click", currentDisclaimerHandler);
    currentDisclaimerHandler = null;
  }
  if (currentKeyHandler) {
    document.removeEventListener("keydown", currentKeyHandler);
    currentKeyHandler = null;
  }
  if (previouslyFocused) {
    previouslyFocused.focus();
    previouslyFocused = null;
  }
}

export function dismissDisclaimerModal() {
  closeModal();
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
