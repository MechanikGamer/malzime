import { elements, escapeHtml } from "./dom.js";
import { state } from "./state.js";
import { getBiasMode } from "./ui.js";

/* ── Aktuellen Modus rendern (aus gecachten Daten) ── */

export function renderCurrentMode(data) {
  const mode = getBiasMode();
  const profiles = data.profiles;

  if (!profiles) {
    /* Blockiert — Fehlermeldung anzeigen */
    renderSimulation(
      data.blockedReason || "Die Analyse konnte nicht abgeschlossen werden. Versuch es mit einem anderen Foto."
    );
    elements.facts.innerHTML = "";
    elements.targeting.innerHTML = "";
    elements.dataValue.innerHTML = "";
    elements.exportPdf.style.display = "none";

    renderPrivacyRisks(data);
    renderGpsMap(data);
    return;
  }

  const profile = profiles[mode] || profiles.normal || profiles.boost || {};

  /* Prüfe ob das Profil tatsächlich Inhalt hat */
  const hasContent =
    (profile.profileText && profile.profileText.trim()) ||
    (profile.categories && Object.keys(profile.categories).length > 0);

  if (!hasContent) {
    renderSimulation(
      "Die KI hat ein leeres Profil zurückgeliefert. Versuch es mit einem anderen Foto oder wechsle den Modus."
    );
    elements.facts.innerHTML = "";
    elements.targeting.innerHTML = "";
    elements.dataValue.innerHTML = "";
    elements.exportPdf.style.display = "none";

    renderPrivacyRisks(data);
    renderGpsMap(data);
    return;
  }

  renderSimulation(profile.profileText || "");
  renderPrivacyRisks(data);
  renderGpsMap(data);
  renderCategories(profile);
  renderAdTargeting(profile);
  const isAnimal = data.meta?.mode === "animal";
  if (isAnimal) {
    elements.dataValue.innerHTML = "";
  } else {
    renderDataValue(profile);
  }
  elements.exportPdf.style.display = "inline-flex";
}

/* ── Rendering: Kategorie-Karten ── */

function renderCategories(profile) {
  const categories = profile.categories || {};
  const entries = Object.entries(categories);

  if (entries.length === 0) {
    elements.facts.innerHTML = "";
    return;
  }

  elements.facts.innerHTML = entries
    .map(([key, cat]) => {
      const pct = Math.round((cat.confidence || 0) * 100);
      const cls = pct >= 70 ? "high" : pct >= 40 ? "med" : "low";
      return `
        <div class="cat-card" data-key="${escapeHtml(key)}">
          <div class="cat-head">
            <span class="cat-label">${escapeHtml(cat.label)}</span>
            <span class="cat-conf ${cls}">${pct}%</span>
          </div>
          <p class="cat-value">${escapeHtml(cat.value)}</p>
          <div class="conf-track"><div class="conf-bar ${cls}" style="width:${pct}%"></div></div>
        </div>
      `;
    })
    .join("");
}

/* ── Rendering: Werbung + Manipulation ── */

function renderAdTargeting(profile) {
  const ads = profile.ad_targeting || [];
  const triggers = profile.manipulation_triggers || [];

  if (ads.length === 0 && triggers.length === 0) {
    elements.targeting.innerHTML = "";
    return;
  }

  let html = '<div class="target-stack">';

  if (ads.length > 0) {
    html += `
      <div class="target-card">
        <h3>Diese Werbung w\u00fcrdest du sehen</h3>
        <div class="tag-cloud">
          ${ads.map((ad) => `<span class="tag">${escapeHtml(ad)}</span>`).join("")}
        </div>
      </div>
    `;
  }

  if (triggers.length > 0) {
    html += `
      <div class="target-card warn">
        <h3>So w\u00fcrde man dich manipulieren</h3>
        <ul class="trigger-list">
          ${triggers.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}
        </ul>
      </div>
    `;
  }

  html += "</div>";
  elements.targeting.innerHTML = html;
}

/* ── Rendering: Privacy-Risiken + EXIF ── */

const EXIF_LABELS = {
  make: "Kamera-Hersteller",
  model: "Kamera-Modell",
  dateTimeOriginal: "Aufnahmedatum",
};

function formatExifValue(key, value) {
  if (key === "dateTimeOriginal" && value) {
    try {
      const d = new Date(value);
      return d.toLocaleString("de-AT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (_) {
      /* date parse failed — show raw value */
    }
  }
  return String(value);
}

function renderPrivacyRisks(data) {
  const risks = data.privacyRisks || [];
  const exif = data.exif || {};
  const exifEntries = Object.entries(exif).filter(([k]) => k !== "gpsLatitude" && k !== "gpsLongitude");

  const hasCamera = exif.make || exif.model;
  if (risks.length === 0 && (!hasCamera || exifEntries.length === 0)) {
    elements.privacy.innerHTML = "";
    return;
  }

  let html = '<div class="privacy-stack">';

  if (hasCamera && exifEntries.length > 0) {
    html += `
      <div class="meta-card">
        <h3>Versteckte Daten in deinem Foto</h3>
        <table class="meta-table">
          ${exifEntries.map(([k, v]) => `<tr><td>${escapeHtml(EXIF_LABELS[k] || k)}</td><td>${escapeHtml(formatExifValue(k, v))}</td></tr>`).join("")}
        </table>
      </div>
    `;
  }

  if (risks.length > 0) {
    html += `
      <div class="meta-card warn">
        <h3>Das hast du ungewollt verraten</h3>
        <ul>${risks.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>
      </div>
    `;
  }

  html += "</div>";
  elements.privacy.innerHTML = html;
}

/* ── Rendering: GPS-Karte ── */

async function renderGpsMap(data) {
  const exif = data.exif || {};

  if (state.gpsMapInstance) {
    state.gpsMapInstance.remove();
    state.gpsMapInstance = null;
  }
  elements.gpsMap.innerHTML = "";

  if (exif.gpsLatitude == null || exif.gpsLongitude == null) return;
  if (typeof L === "undefined") return;

  const lat = exif.gpsLatitude;
  const lng = exif.gpsLongitude;

  try {
    /* Geocoding wurde bereits beim EXIF-Parsen gestartet (parallel zur Analyse).
       GPS verlässt nie den Server — Nominatim wird direkt vom Browser aufgerufen. */
    const address = state.pendingGeocode ? await state.pendingGeocode : null;
    state.pendingGeocode = null;

    elements.gpsMap.innerHTML = `
      <div class="map-wrapper">
        <h3>Hier wurdest du geortet</h3>
        <div id="gpsMapLeaflet"></div>
      </div>
    `;

    state.gpsMapInstance = L.map("gpsMapLeaflet").setView([lat, lng], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      referrerPolicy: "origin",
    }).addTo(state.gpsMapInstance);

    const popupText = address
      ? `<strong>Dein Standort</strong><br>${escapeHtml(address)}`
      : `<strong>Dein Standort</strong><br>${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    L.marker([lat, lng]).addTo(state.gpsMapInstance).bindPopup(popupText).openPopup();
  } catch (_err) {
    /* BUG-015: Leaflet-Fehler abfangen statt Unhandled Promise Rejection */
    elements.gpsMap.innerHTML = "";
  }
}

/* ── Rendering: Profil-Verdict ── */

function renderSimulation(text) {
  if (!text) {
    elements.simulation.innerHTML = "";
    return;
  }

  elements.simulation.innerHTML = `
    <div class="verdict">
      <div class="verdict-head">
        <svg class="verdict-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4m0 4h.01M3.6 19.8h16.8a1.2 1.2 0 001.04-1.8L13.04 4.2a1.2 1.2 0 00-2.08 0L2.56 18a1.2 1.2 0 001.04 1.8z"/></svg>
        <h3>So denkt die KI \u00fcber dich</h3>
      </div>
      <p class="verdict-text">${escapeHtml(text)}</p>
    </div>
  `;
}

/* ── Rendering: Datenwert-Rechner ── */

const DATA_VALUE_MAP = {
  alter: 0.04,
  geschlecht: 0.02,
  herkunft: 0.06,
  einkommen: 0.14,
  bildung: 0.07,
  beruf: 0.09,
  persoenlichkeit: 0.05,
  politik: 0.11,
  gesundheit: 0.16,
  beziehung: 0.07,
  kaufkraft: 0.13,
  religion: 0.08,
  sexualitaet: 0.1,
  interessen: 0.05,
  emotionen: 0.06,
  verletzlichkeit: 0.15,
  wohnort: 0.08,
  familienstand: 0.04,
  fitness: 0.06,
  ernaehrung: 0.07,
};
const DATA_VALUE_DEFAULT = 0.06;
const USERS_GLOBAL = 2_000_000_000;

function computeDataValue(profile) {
  const categories = profile.categories || {};
  const entries = Object.entries(categories);
  if (entries.length === 0) return null;

  let total = 0;
  const breakdown = [];

  for (const [key, cat] of entries) {
    const baseVal = DATA_VALUE_MAP[key] || DATA_VALUE_DEFAULT;
    const conf = cat.confidence || 0.5;
    const val = baseVal * conf;
    total += val;
    breakdown.push({ label: cat.label, value: val, confidence: conf });
  }

  /* Bonus für ad_targeting und manipulation_triggers */
  const ads = profile.ad_targeting || [];
  const triggers = profile.manipulation_triggers || [];
  total += ads.length * 0.02;
  total += triggers.length * 0.04;

  breakdown.sort((a, b) => b.value - a.value);

  return { perUser: total, global: total * USERS_GLOBAL, breakdown };
}

function formatEuro(val) {
  if (val >= 1_000_000_000_000) return (val / 1_000_000_000_000).toFixed(1).replace(".", ",") + " Billionen \u20ac";
  if (val >= 1_000_000_000) return (val / 1_000_000_000).toFixed(1).replace(".", ",") + " Milliarden \u20ac";
  if (val >= 1_000_000) return (val / 1_000_000).toFixed(1).replace(".", ",") + " Millionen \u20ac";
  return val.toFixed(2).replace(".", ",") + " \u20ac";
}

function renderDataValue(profile) {
  const result = computeDataValue(profile);
  if (!result) {
    elements.dataValue.innerHTML = "";
    return;
  }

  const top5 = result.breakdown.slice(0, 5);
  const maxVal = top5[0]?.value || 1;
  const RESALES_PER_YEAR = 90;
  const personalYearly = result.perUser * RESALES_PER_YEAR;
  const AD_PLATFORMS_YEARLY = 50;
  const totalYearly = personalYearly + AD_PLATFORMS_YEARLY;

  elements.dataValue.innerHTML = `
    <div class="dv-card">
      <div class="dv-header">
        <svg class="dv-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
        </svg>
        <h3>Dein Datenwert</h3>
      </div>
      <div class="dv-hero-value">${result.perUser.toFixed(2).replace(".", ",")} \u20ac</div>
      <p class="dv-subtitle">So viel ist dein Profil f\u00fcr Datenbroker wert \u2014 bei einem einzelnen Verkauf.</p>

      <div class="dv-explain">
        <h4>Was bedeutet das?</h4>
        <p>Datenbroker sind Firmen, die Informationen \u00fcber dich sammeln und an andere Unternehmen weiterverkaufen. Die ${result.perUser.toFixed(2).replace(".", ",")} \u20ac sind der Preis, den ein einzelner Datensatz \u00fcber dich auf diesem Markt kostet \u2014 also das, was aus <strong>einem einzigen Foto</strong> \u00fcber dich herausgelesen werden kann.</p>
        <p>Klingt wenig? Das Problem: Dein Profil wird nicht einmal verkauft, sondern <strong>immer wieder</strong>. Datenbroker verkaufen die gleichen Daten an dutzende verschiedene K\u00e4ufer \u2014 Versicherungen, Werbefirmen, Arbeitgeber, politische Kampagnen. Im Schnitt wird dein Profil rund <strong>${RESALES_PER_YEAR} Mal pro Jahr</strong> weiterverkauft.</p>
      </div>

      <div class="dv-scale">
        <div class="dv-scale-row">
          <span class="dv-scale-label">\u00d7 ${RESALES_PER_YEAR} Weiterverk\u00e4ufe pro Jahr</span>
          <span class="dv-scale-value">${new Intl.NumberFormat("de-DE").format(Math.round(personalYearly))} \u20ac pro Jahr</span>
        </div>
      </div>

      <div class="dv-explain dv-explain-highlight">
        <h4>Zwei M\u00e4rkte verdienen an deinen Daten</h4>
        <p>Es gibt nicht nur einen Weg, mit deinen Daten Geld zu verdienen \u2014 es gibt zwei komplett getrennte M\u00e4rkte:</p>
        <p><strong>1. Datenbroker</strong> \u2014 Firmen wie Acxiom, Oracle oder Datalogix kaufen und verkaufen Datens\u00e4tze \u00fcber dich. Dein Profil wird im Schnitt ${RESALES_PER_YEAR} \u00d7 pro Jahr weiterverkauft. Das ergibt ca. <strong>${personalYearly.toFixed(0)} \u20ac pro Jahr</strong> allein durch den Handel mit deinen Daten.</p>
        <p><strong>2. Werbeplattformen</strong> \u2014 Meta, Google und TikTok verkaufen deine Daten nicht direkt, sondern nutzen sie intern, um dir personalisierte Werbung zu zeigen. Damit verdienen sie zusammen ca. <strong>${AD_PLATFORMS_YEARLY} \u20ac pro Jahr</strong> an dir.</p>
        <p>Zusammen ergibt das \u00fcber <strong>${Math.round(totalYearly)} \u20ac pro Jahr</strong>, die mit deinen Daten verdient werden.</p>
      </div>

      <div class="dv-scale">
        <div class="dv-scale-row">
          <span class="dv-scale-label">Datenbroker (Weiterverkauf)</span>
          <span class="dv-scale-value">ca. ${personalYearly.toFixed(0)} \u20ac pro Jahr</span>
        </div>
        <div class="dv-divider"></div>
        <div class="dv-scale-row">
          <span class="dv-scale-label">Meta (Werbung)</span>
          <span class="dv-scale-value">ca. 23 \u20ac pro Jahr</span>
        </div>
        <div class="dv-scale-row">
          <span class="dv-scale-label">Google (Werbung)</span>
          <span class="dv-scale-value">ca. 15 \u20ac pro Jahr</span>
        </div>
        <div class="dv-scale-row">
          <span class="dv-scale-label">TikTok (Werbung)</span>
          <span class="dv-scale-value">ca. 12 \u20ac pro Jahr</span>
        </div>
        <div class="dv-divider"></div>
        <div class="dv-scale-row">
          <span class="dv-scale-label"><strong>Gesamt pro Jahr</strong></span>
          <span class="dv-scale-value"><strong>\u00fcber ${Math.round(totalYearly)} \u20ac</strong></span>
        </div>
      </div>

      <div class="dv-scale">
        <div class="dv-scale-row">
          <span class="dv-scale-label">\u00d7 2 Milliarden Nutzer weltweit</span>
          <span class="dv-scale-value">${formatEuro(result.global)}</span>
        </div>
        <div class="dv-scale-row">
          <span class="dv-scale-label">Globaler Datenbroker-Markt</span>
          <span class="dv-scale-value">278 Milliarden Dollar pro Jahr</span>
        </div>
      </div>

      <div class="dv-explain">
        <h4>Was hei\u00dft \u201e376 \u00d7 pro Tag\u201c?</h4>
        <p>Der Werbemarkt funktioniert anders als der Datenbroker-Markt. Jedes Mal, wenn dir auf Instagram, TikTok oder Snapchat eine Werbung angezeigt wird, findet im Hintergrund eine <strong>Echtzeit-Auktion</strong> statt. Firmen bieten um das Recht, dir genau diese Werbung zu zeigen. Daf\u00fcr wird dein Profil \u00fcbermittelt \u2014 Alter, Interessen, Standort, Verhalten \u2014 alles in Millisekunden.</p>
        <p>Das passiert bei europ\u00e4ischen Nutzer:innen durchschnittlich <strong>376 Mal am Tag</strong>. Jede einzelne Auktion ist nur <strong>Bruchteile eines Cents</strong> wert \u2014 aber \u00fcber das ganze Jahr summiert sich das auf die ca. 50 \u20ac, die Plattformen an dir verdienen.</p>
      </div>

      <div class="dv-explain">
        <h4>Und was ist mit meinen Fotos auf Snapchat oder Instagram?</h4>
        <p>Dieses Tool analysiert <strong>ein einzelnes Foto</strong>. Aber auf deinem Snapchat oder Instagram liegen vielleicht hunderte oder tausende Bilder. Jedes einzelne enth\u00e4lt Informationen: Wo du warst, mit wem, was du getragen hast, wie du dich gef\u00fchlt hast. Zusammen ergibt das ein extrem detailliertes Profil \u00fcber dein ganzes Leben.</p>
        <p>Plattformen wie Meta werten nicht nur deine Fotos aus, sondern <strong>alles</strong>: Wie lange du ein Bild anschaust, was du likest, wem du folgst, wann du online bist, wo du dich befindest. Daraus entsteht ein Profil mit <strong>tausenden Datenpunkten</strong> \u2014 viel mehr als dieses Tool aus einem Foto zeigen kann.</p>
      </div>

      <div class="dv-breakdown">
        <h4>Wertvollste Datenpunkte aus deinem Foto</h4>
        ${top5
          .map(
            (item) => `
          <div class="dv-bar-row">
            <span class="dv-bar-label">${escapeHtml(item.label)}</span>
            <div class="dv-bar-track">
              <div class="dv-bar-fill" style="width:${Math.round((item.value / maxVal) * 100)}%"></div>
            </div>
            <span class="dv-bar-val">${item.value.toFixed(2).replace(".", ",")} \u20ac</span>
          </div>
        `
          )
          .join("")}
      </div>

      <p class="dv-footnote">Profilwert basiert auf Datenbroker-Preisen (Duke University 2023, netzpolitik.org Databroker Files 2024). Weiterverkaufsh\u00e4ufigkeit: abgeleitet aus Marktvolumen (Grand View Research 2024: 278 Mrd. $) und Einzelverkaufswert. Umsatz pro Nutzer: Meta Jahresbericht 2024 (ARPU Europa: 23,14 \u20ac), Alphabet Jahresbericht 2024, ByteDance Sch\u00e4tzung 2024. Echtzeit-Daten-Broadcasts: ICCL Reports 2022/2023.</p>
    </div>
  `;
}
