import { elements } from "./dom.js";
import { state } from "./state.js";
import { prepareImage } from "./exif.js";
import { startGeocoding } from "./geocoding.js";
import { setStatus, startScanAnim, stopScanAnim, showDisclaimerModal } from "./ui.js";
import { renderCurrentMode } from "./render.js";

const PAGE_LOADED_AT = Date.now();
const MIN_INTERACTION_MS = 2000;
/* BUG-006: Relative URL nutzt Firebase Hosting Rewrite (/analyze → function:analyze).
   Keine hardcoded Domain — funktioniert auf allen Deployments. */
const ANALYZE_URL = "/analyze";
const FETCH_TIMEOUT_MS = 60000;

export async function analyzeImage() {
  if (state.isAnalyzing) return;
  state.isAnalyzing = true;

  /* BUG-001/002: Jeder Analyse-Lauf bekommt eine eindeutige ID.
     Stale catch/finally/Callbacks prüfen ob sie noch "aktuell" sind. */
  const myId = ++state.requestId;

  setStatus("");
  elements.facts.innerHTML = "";
  elements.privacy.innerHTML = "";
  elements.gpsMap.innerHTML = "";
  elements.targeting.innerHTML = "";
  elements.dataValue.innerHTML = "";
  elements.simulation.innerHTML = "";
  elements.exportPdf.style.display = "none";

  startScanAnim();

  const file = state.lastFile || elements.fileInput.files[0];
  if (!file) {
    stopScanAnim();
    setStatus("Bitte zuerst ein Bild ausw\u00e4hlen.");
    state.isAnalyzing = false;
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    stopScanAnim();
    setStatus("Datei zu gro\u00df. Max 20 MB.");
    state.isAnalyzing = false;
    return;
  }

  /* Honeypot — Bots füllen unsichtbare Felder aus */
  const hp = document.getElementById("website");
  if (hp && hp.value) {
    stopScanAnim();
    state.isAnalyzing = false;
    return;
  }

  /* Mindest-Interaktionszeit — kein Mensch lädt in < 2s hoch */
  if (Date.now() - PAGE_LOADED_AT < MIN_INTERACTION_MS) {
    const remaining = MIN_INTERACTION_MS - (Date.now() - PAGE_LOADED_AT);
    await new Promise((r) => setTimeout(r, remaining));
  }

  /* BUG-001: timeoutId VOR try deklarieren → im catch/finally erreichbar */
  let timeoutId;
  try {
    /* Bild komprimieren + EXIF extrahieren (client-seitig) */
    if (!state.lastPrepared) {
      state.lastPrepared = await prepareImage(file);
    }

    /* BUG-012: Nach prepareImage prüfen ob inzwischen ein neuer Lauf gestartet wurde
       (handleNewFile setzt isAnalyzing=false + neuen requestId) */
    if (state.requestId !== myId) return;

    /* Geocoding sofort starten wenn GPS vorhanden — läuft parallel zur Analyse */
    if (state.lastPrepared.gps) {
      startGeocoding(state.lastPrepared.gps.latitude, state.lastPrepared.gps.longitude);
    }

    /* BUG-001: Lokale Controller-Variable — Timeout referenziert nicht state */
    const controller = new AbortController();
    state.currentAbortController = controller;
    timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(ANALYZE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: state.lastPrepared.imageBase64,
        exif: state.lastPrepared.exif,
        mimeType: "image/jpeg",
        filename: "upload.jpg",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    state.currentAbortController = null;
    stopScanAnim();

    /* BUG-002: Prüfen ob dieser Lauf noch aktuell ist */
    if (state.requestId !== myId) return;

    if (!response.ok) {
      let msg = "Da ist etwas schiefgelaufen. Versuch es nochmal.";
      if (response.status === 429) {
        msg = "Zu viele Anfragen aus eurem Netzwerk. Wartet kurz und versucht es gleich nochmal.";
      } else if (response.status === 413) {
        msg = "Das Bild ist zu gro\u00df. Bitte ein kleineres Foto verwenden.";
      } else if (response.status === 400) {
        msg = "Das hat nicht geklappt. Ist das wirklich ein Foto? Versuche JPEG oder PNG.";
      } else if (response.status >= 500) {
        msg = "Der Server hat gerade ein Problem. Wartet einen Moment und versucht es nochmal.";
      }
      try {
        const t = await response.text();
        const p = JSON.parse(t);
        if (p.code === "file_too_large") msg = "Das Bild ist zu gro\u00df. Bitte ein kleineres Foto verwenden.";
        if (p.code === "missing_image") msg = "Kein Bild erkannt. Bitte ein Foto ausw\u00e4hlen.";
      } catch (_) {
        /* response parse failed — use default msg */
      }
      setStatus(msg);
      return;
    }

    const data = await response.json();

    /* Client-seitige Daten injizieren — GPS und dateTimeOriginal verlassen nie den Browser */
    if (!data.exif) data.exif = {};
    if (state.lastPrepared.gps) {
      data.exif.gpsLatitude = state.lastPrepared.gps.latitude;
      data.exif.gpsLongitude = state.lastPrepared.gps.longitude;
    }
    if (state.lastPrepared.dateTimeOriginal) {
      data.exif.dateTimeOriginal = state.lastPrepared.dateTimeOriginal;
    }

    /* BUG-002: Guard in Modal-Callback — stale Daten nicht übernehmen */
    showDisclaimerModal(() => {
      if (state.requestId !== myId) return;
      state.lastData = data;
      renderCurrentMode(data);
      setStatus("");
    });
  } catch (err) {
    /* BUG-002: Stale catch darf UI des neuen Laufs nicht überschreiben */
    if (state.requestId !== myId) return;
    stopScanAnim();
    if (err.name === "AbortError") {
      setStatus("Die Analyse dauert zu lange. Versuch es nochmal oder nimm ein anderes Foto.");
    } else if (err.message === "read_failed") {
      setStatus("Das Bild konnte nicht gelesen werden. Versuch ein anderes Foto.");
    } else if (err.message === "image_decode_failed") {
      setStatus("Das Bildformat wird nicht unterst\u00fctzt. Versuch JPEG oder PNG.");
    } else if (!navigator.onLine) {
      setStatus("Keine Internetverbindung. Bitte pr\u00fcfe dein WLAN.");
    } else {
      setStatus("Verbindung zum Server fehlgeschlagen. Pr\u00fcfe dein Internet und versuch es nochmal.");
    }
  } finally {
    /* BUG-001: Timeout immer aufräumen */
    clearTimeout(timeoutId);
    /* BUG-002: Nur eigenen isAnalyzing-Flag zurücksetzen */
    if (state.requestId === myId) state.isAnalyzing = false;
  }
}
