# Self-Hosting — Eigene malziME-Instanz aufsetzen

Diese Anleitung erklaert Schritt fuer Schritt, wie du eine eigene Instanz von malziME auf deinem eigenen Firebase-Projekt betreibst — mit deiner eigenen Domain und deiner eigenen Abrechnung.

**Zeitaufwand:** ca. 30–60 Minuten (je nach Google Cloud Erfahrung).

---

## Voraussetzungen

- [Node.js](https://nodejs.org/) 24+
- [Firebase CLI](https://firebase.google.com/docs/cli): `npm i -g firebase-tools`
- Ein Google-Konto mit Kreditkarte (fuer Google Cloud Abrechnung)
- Git

## 1. Repo forken und klonen

```bash
# Fork auf GitHub erstellen, dann:
git clone https://github.com/DEIN-USERNAME/malzime.git
cd malzime
```

## 2. Google Cloud Projekt erstellen

1. Gehe zu [console.cloud.google.com](https://console.cloud.google.com)
2. Erstelle ein neues Projekt (z.B. `mein-malzime`)
3. Aktiviere die Abrechnung fuer das Projekt

### APIs aktivieren

Im Google Cloud Console unter **APIs & Services > Library** diese beiden APIs aktivieren:

- **Cloud Vision API** — fuer Texterkennung und Label-Erkennung
- **Vertex AI API** — fuer Gemini (Bildbeschreibung + Profilgenerierung)

> **Wichtig**: Die EU Vision API (`eu-vision.googleapis.com`) unterstuetzt nur `TEXT_DETECTION` und `LABEL_DETECTION`. Andere Features wie `FACE_DETECTION` oder `OBJECT_LOCALIZATION` wuerden den gesamten API-Call crashen.

## 3. Firebase Projekt erstellen

1. Gehe zu [console.firebase.google.com](https://console.firebase.google.com)
2. Klicke auf **Projekt hinzufuegen**
3. Waehle das Google Cloud Projekt aus Schritt 2 (Firebase verknuepft sich damit)
4. Hosting aktivieren (unter **Build > Hosting**)

```bash
firebase login
firebase use --add   # Deine neue Projekt-ID waehlen
```

## 4. Dependencies installieren

```bash
# Backend
cd functions && npm install && cd ..

# Frontend-Tests + Linting
npm install
```

## 5. Anpassungen — Was du aendern musst

Hier sind alle Stellen die du fuer deine eigene Instanz anpassen musst.

### 5a. Backend: CORS + Origin-Check

**Datei:** `functions/src/index.js`

Die CORS-Konfiguration (Zeile 18) und die Origin-Pruefung (Zeile 44–49) enthalten die erlaubten Domains. Ersetze sie mit deinen eigenen:

```js
// Zeile 18 — CORS-Konfiguration:
cors: [
  "https://DEINE-DOMAIN.com",
  "https://www.DEINE-DOMAIN.com",
  "https://DEIN-PROJEKT.web.app",
  "https://DEIN-PROJEKT.firebaseapp.com"
],

// Zeile 44–49 — Origin-Pruefung (gleiche Domains):
const allowedOrigins = [
  "https://DEINE-DOMAIN.com",
  "https://www.DEINE-DOMAIN.com",
  "https://DEIN-PROJEKT.web.app",
  "https://DEIN-PROJEKT.firebaseapp.com",
];
```

Falls du keine eigene Domain hast, reichen die Firebase-Defaults:
```js
cors: ["https://DEIN-PROJEKT.web.app", "https://DEIN-PROJEKT.firebaseapp.com"],
```

### 5b. Backend: Projekt-ID Fallback

**Datei:** `functions/src/gemini.js` (Zeile 83)

```js
// Vorher:
const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "malzime";

// Nachher — deine Projekt-ID:
const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "DEIN-PROJEKT";
```

> Normalerweise wird die Projekt-ID automatisch erkannt. Der Fallback greift nur in seltenen Faellen.

### 5c. Frontend: Nominatim User-Agent

**Datei:** `public/js/geocoding.js` (Zeile 17)

Nominatim (OpenStreetMap Geocoding) verlangt einen eindeutigen User-Agent:

```js
// Vorher:
headers: { "User-Agent": "malzime-workshop-demo/1.0" },

// Nachher — dein Projektname:
headers: { "User-Agent": "DEIN-PROJEKT-NAME/1.0" },
```

### 5d. Frontend: Meta-Tags + Impressum + Datenschutz

Diese Dateien enthalten malziME-spezifische Inhalte (Domain, Firma, Kontakt) die du durch deine eigenen ersetzen musst:

| Datei | Was aendern |
|-------|------------|
| `public/index.html` | `<title>`, `<meta>` (description, author, canonical, OG-Tags, Twitter Cards), Structured Data (JSON-LD), Footer, Buy-Me-a-Coffee-Link |
| `public/impressum.html` | Kompletter Inhalt — dein eigenes Impressum |
| `public/datenschutz.html` | Kompletter Inhalt — deine eigene Datenschutzerklaerung |
| `public/og-image.png` | Eigenes Social-Media-Vorschaubild (1200x630px empfohlen) |
| `public/site.webmanifest` | App-Name und -Beschreibung |

> **Rechtlich wichtig**: Impressum und Datenschutzerklaerung muessen auf dein Unternehmen/deine Person zugeschnitten sein. Kopiere nicht einfach die malziland-Texte.

### 5e. CI/CD (optional, nur bei GitHub Actions)

**Datei:** `.github/workflows/deploy.yml` (Zeile 70, 73)

```yaml
# Zeile 70 — Hosting Deploy:
projectId: DEIN-PROJEKT

# Zeile 73 — Functions Deploy:
run: npx firebase-tools deploy --only functions --project DEIN-PROJEKT --force
```

Benoetigtes GitHub Secret:
- `FIREBASE_SERVICE_ACCOUNT` — Service Account JSON deines Projekts

### 5f. Locale-Dateien (optional)

Die UI-Texte, Gemini-Prompts und Tier-Profile liegen in Locale-Dateien:

| Dateien | Inhalt |
|---------|--------|
| `public/locales/de.json` | Alle Frontend-UI-Strings |
| `functions/src/locales/de/prompts.js` | Gemini-Prompts (System-Prompts, Labels, Schema) |
| `functions/src/locales/de/animals.js` | Tier-Easter-Egg-Profile |

Wenn du die Texte anpassen oder eine neue Sprache hinzufuegen willst:
- Frontend: Kopiere `de.json` nach `XX.json`, uebersetze die Werte, trage den Code in `manifest.json` ein
- Backend: Erstelle `functions/src/locales/XX/prompts.js` + `XX/animals.js`, trage den Code in `manifest.json` ein
- Testen mit `?lang=XX` in der URL

### 5g. Spenden-Button (optional)

**Datei:** `.github/FUNDING.yml`

Ersetze `malzime` mit deinem eigenen Buy-Me-a-Coffee-Username, oder entferne die Datei.

---

## 6. Lokal testen

Fuer lokale Entwicklung muessen die Google Cloud APIs authentifiziert sein:

```bash
gcloud auth application-default login
```

Dann den Emulator starten:

```bash
firebase emulators:start --only functions,hosting
```

Oeffne http://localhost:5000 — die App sollte funktionieren.

> **Tipp**: Im Emulator brauchen die Vision und Vertex AI APIs trotzdem Internet-Zugang — sie laufen nicht lokal.

## 7. Deploy

```bash
# Alles deployen
firebase deploy --only functions,hosting
```

Deine Instanz ist jetzt unter `https://DEIN-PROJEKT.web.app` erreichbar.

### Eigene Domain verbinden (optional)

1. Firebase Console > Hosting > **Benutzerdefinierte Domain hinzufuegen**
2. DNS-Eintraege bei deinem Domain-Anbieter setzen
3. CORS-Liste in `functions/src/index.js` um deine Domain erweitern
4. Neu deployen: `firebase deploy --only functions`

---

## Checkliste

Bevor du live gehst:

- [ ] CORS-Liste und Origin-Check enthalten deine Domains
- [ ] Impressum und Datenschutzerklaerung sind auf dich zugeschnitten
- [ ] Meta-Tags (OG, Twitter, canonical) zeigen auf deine Domain
- [ ] User-Agent in geocoding.js enthaelt deinen Projektnamen
- [ ] Eigenes OG-Image erstellt
- [ ] Locale-Dateien angepasst (falls gewuenscht)
- [ ] Tests laufen: `cd functions && npm test` und `npm run test:frontend`
- [ ] Lokal getestet: Bild hochladen funktioniert

## Kosten

### Was pro Analyse passiert

| API | Aufrufe | Was |
|-----|---------|-----|
| **Vision API** | 1 Call, 2 Features | TEXT_DETECTION + LABEL_DETECTION |
| **Gemini 2.5 Flash** | 3 Calls | 1x Bildbeschreibung (multimodal) + 2x Profil (normal + boost, parallel) |
| **Cloud Functions** | 1 Invocation | ~5–15 Sekunden, 256 MB RAM |

### Preise (Stand Februar 2026, Vertex AI Standard Tier)

| Posten | Preis | Kostenlos/Monat |
|--------|-------|-----------------|
| Vision API (pro Feature) | $1.50 / 1.000 Bilder | Erste 1.000 Bilder pro Feature |
| Gemini 2.5 Flash Input | $0.30 / 1 Mio. Tokens | — |
| Gemini 2.5 Flash Output | $2.50 / 1 Mio. Tokens | — |
| Firebase Hosting | $0.15 / GB Transfer | 10 GB/Monat |
| Cloud Functions | nutzungsbasiert | 2 Mio. Aufrufe/Monat |

### Rechenbeispiel: Workshop mit 30 Teilnehmer:innen

| Posten | Rechnung | Kosten |
|--------|----------|--------|
| Vision API | 60 Units (innerhalb Frei-Kontingent) | **$0.00** |
| Gemini Input | ~150.000 Tokens | **$0.05** |
| Gemini Output | ~150.000 Tokens | **$0.38** |
| Cloud Functions + Hosting | minimal | **$0.00** |
| **Gesamt** | | **~$0.43** |

Bei kleinen Workshops (unter 1.000 Bilder/Monat) ist die Vision API kostenlos. Hauptkostentreiber ist Gemini Output (~90% der Kosten).

Neue Google Cloud Konten erhalten **$300 Startguthaben**. Die vollstaendige Kostenaufstellung mit Preistabellen findest du in [`docs/SETUP.md`](SETUP.md#kosten).

## Fragen?

Oeffne ein [Issue auf GitHub](https://github.com/malziland/malzime/issues) — wir helfen gerne.
