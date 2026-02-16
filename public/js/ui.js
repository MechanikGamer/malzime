import { elements } from "./dom.js";

/* ── Scan-Animation ── */

const scanMessages = [
  "Gesicht erkannt\u2026",
  "Kleidung wird analysiert\u2026",
  "Umgebung wird gescannt\u2026",
  "Marken werden identifiziert\u2026",
  "Emotionen werden gelesen\u2026",
  "Social-Media-Profil wird rekonstruiert\u2026",
  "Kaufverhalten wird berechnet\u2026",
  "Pers\u00f6nlichkeitstyp wird bestimmt\u2026",
  "Werbeprofil wird erstellt\u2026",
  "Manipulations-Vektoren werden berechnet\u2026",
  "Politische Einstellung wird gesch\u00e4tzt\u2026",
  "EXIF-Daten werden extrahiert\u2026",
  "Standort wird trianguliert\u2026",
  "Einkommensstufe wird klassifiziert\u2026",
];

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
  const shuffled = [...scanMessages].sort(() => Math.random() - 0.5);
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

const PRINT_NOTE = "Diese Informationen sind von der KI erfunden \u2013 Nichts davon ist wahr!";

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
      note.textContent = PRINT_NOTE;
      block.parentNode.insertBefore(note, block);
      accumulated = NOTE_HEIGHT + h;
    }
  }
}

export function removePrintNotes() {
  document.querySelectorAll(".print-note").forEach((el) => el.remove());
}
