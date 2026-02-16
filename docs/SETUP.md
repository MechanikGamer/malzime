# Setup — malziME

## Voraussetzungen

- Node.js 24+
- Firebase CLI: `npm i -g firebase-tools`
- Google Cloud Projekt mit aktivierter Abrechnung
- Firebase Projekt verknuepft mit dem GCP Projekt

## 1. Firebase Projekt konfigurieren

```bash
firebase login
firebase use --add   # Projekt-ID waehlen
```

## 2. Google Cloud APIs aktivieren

Im [Google Cloud Console](https://console.cloud.google.com):

- **Cloud Vision API** — Texterkennung + Label-Erkennung
- **Vertex AI API** — Gemini Multimodal (Bildbeschreibung + Profilerstellung)

Region: `europe-west1` (Belgien, EU)

**Wichtig**: Die EU Vision API (`eu-vision.googleapis.com`) unterstuetzt nur `TEXT_DETECTION` und `LABEL_DETECTION`. Andere Features wie `FACE_DETECTION` oder `OBJECT_LOCALIZATION` sind nicht verfuegbar und wuerden den gesamten API-Call crashen.

## 3. Dependencies installieren

```bash
# Backend
cd functions && npm install && cd ..

# Frontend-Tests + Linting (Vitest, ESLint, Prettier)
npm install
```

## 4. Umgebungsvariablen

Kopiere `functions/.env.example` nach `functions/.env` und passe die Werte an:

```bash
cp functions/.env.example functions/.env
```

| Variable | Standard | Beschreibung |
|----------|----------|--------------|
| `VERTEX_LOCATION` | `europe-west1` | Vertex AI Region |
| `GCLOUD_PROJECT` | (auto-detect) | Google Cloud Projekt-ID |

Fuer den EU-Endpoint der Vision API: In `functions/src/vision.js` wird `eu-vision.googleapis.com` verwendet.

## 5. Lokal testen

```bash
firebase emulators:start --only functions,hosting
```

Dann: http://localhost:5000

**Hinweis**: Fuer die lokale Entwicklung muss `gcloud auth application-default login` ausgefuehrt werden, damit die Vertex AI und Vision APIs funktionieren.

## 6. Tests ausfuehren

```bash
# Backend (Jest)
cd functions && npm test

# Frontend (Vitest + jsdom)
npm run test:frontend
```

**Backend (113 Tests):** HTTP-Handler, Tier-Erkennung, Config, Demo-Daten, Middleware (Rate Limiting), Privacy-Risiken, Upload-Parsing, Vision API, Magic-Byte-Validierung.
**Frontend (48 Tests):** DOM-Helpers, State, Scan-Animation, Disclaimer-Modal, Geocoding, Render-Pipeline, API-Integration.

## 7. Linting + Formatting

```bash
# Backend
cd functions && npm run lint
cd functions && npm run format:check

# Frontend
npm run lint:frontend
npm run format:frontend:check
```

CI prueft Lint + Format automatisch bei jedem Push und Pull Request.

## 8. Deploy

```bash
# Alles
firebase deploy --only functions,hosting

# Nur Frontend (nach CSS/JS-Aenderungen)
firebase deploy --only hosting

# Nur Backend (nach Functions-Aenderungen)
firebase deploy --only functions
```

**Wichtig**: Nach Frontend-Aenderungen den Cache-Buster in `public/index.html` hochzaehlen:
```html
<link rel="stylesheet" href="./styles.css?v=2026021608" />
<!-- ... -->
<script type="module" src="./app.js?v=2026021608"></script>
```

Format: `?v=YYYYMMDDNN` (Datum + laufende Nummer)

## Kosten

### Was pro Analyse passiert

| API | Aufrufe | Was |
|-----|---------|-----|
| **Vision API** | 1 Call, 2 Features | TEXT_DETECTION + LABEL_DETECTION |
| **Gemini 2.5 Flash** | 3 Calls | 1x Bildbeschreibung (multimodal) + 2x Profil (normal + boost, parallel) |
| **Cloud Functions** | 1 Invocation | ~5–15 Sekunden, 256 MB RAM |

Thinking ist deaktiviert (`thinkingBudget: 0`) fuer Kostenreduktion.

### Preise (Stand Februar 2026, Vertex AI Standard Tier)

| Posten | Preis | Kostenlos/Monat |
|--------|-------|-----------------|
| Vision API (TEXT_DETECTION) | $1.50 / 1.000 Bilder | Erste 1.000 Bilder |
| Vision API (LABEL_DETECTION) | $1.50 / 1.000 Bilder | Erste 1.000 Bilder |
| Gemini 2.5 Flash Input | $0.30 / 1 Mio. Tokens | — |
| Gemini 2.5 Flash Output | $2.50 / 1 Mio. Tokens | — |
| Firebase Hosting | $0.15 / GB Transfer | 10 GB/Monat |
| Cloud Functions | nutzungsbasiert | 2 Mio. Aufrufe/Monat |

### Rechenbeispiel: Workshop mit 30 Teilnehmer:innen

| Posten | Rechnung | Kosten |
|--------|----------|--------|
| Vision API | 30 Bilder × 2 Features = 60 Units (innerhalb Frei-Kontingent) | **$0.00** |
| Gemini Input | 30 × ~5.000 Tokens = ~150.000 Tokens | **$0.05** |
| Gemini Output | 30 × ~5.000 Tokens = ~150.000 Tokens | **$0.38** |
| Cloud Functions | 30 Aufrufe × ~10s | **$0.00** |
| Firebase Hosting | Statische Dateien, wenige MB | **$0.00** |
| **Gesamt** | | **~$0.43** |

Bei kleinen Workshops (unter 1.000 Bilder/Monat) ist die Vision API komplett kostenlos. Der Hauptkostentreiber ist Gemini Output.

### Tipp fuer neue Google Cloud Konten

Neue Konten erhalten $300 Startguthaben — damit lassen sich tausende Analysen durchfuehren.

## Privacy-Architektur

Die Privacy-Architektur ist ein Kernbestandteil des Projekts:

1. **EXIF im Browser**: Die Library exifr (self-hosted unter `public/lib/exifr/`) parsed Metadaten client-seitig
2. **GPS bleibt lokal**: GPS-Koordinaten werden nie an den Server gesendet. Geocoding (Nominatim) wird direkt vom Browser aufgerufen
3. **Server bekommt**: Komprimiertes Bild (max 1280px, JPEG 0.82) + Kamera-Hersteller/Modell. Kein GPS, kein dateTimeOriginal.
4. **Keine Speicherung**: Bilder werden im RAM verarbeitet und sofort verworfen
5. **Keine externen Scripts**: Fonts, Leaflet und exifr sind self-hosted. Kein CDN, kein Google Fonts, kein Firebase SDK im Frontend
6. **Bot-Schutz ohne Tracking**: Rate Limiting (IP-basiert), Honeypot-Feld, Timing-Check. Kein reCAPTCHA.

## CI/CD

GitHub Actions Workflows:
- **`ci.yml`** — Tests + Lint + Format bei jedem Push und Pull Request
- **`deploy.yml`** — Tests + Lint + Format + Deploy auf Firebase bei Push auf `main`

Benoetigtes GitHub Secret:
- `FIREBASE_SERVICE_ACCOUNT` — Service Account JSON (fuer Hosting + Functions Deploy)

## Eigene Instanz aufsetzen (Fork)

Falls du malziME auf deinem eigenen Firebase-Projekt betreiben willst: [`docs/SELF-HOSTING.md`](SELF-HOSTING.md) enthaelt eine vollstaendige Schritt-fuer-Schritt-Anleitung mit allen Stellen die angepasst werden muessen (CORS, Domains, Impressum, CI/CD, etc.).

## Hinweise

- Rate Limits sind in-memory (pro Cloud Functions Instanz). Fuer High-Scale: externe Loesung (Redis/Firestore) verwenden
- Logs enthalten nur Request-ID, Status und Modell-Info — keine Bilddaten
- Safety-Filter von Google blockieren die Bildbeschreibung bei Kinderfotos. Der Code hat einen mehrstufigen Fallback: alternativer Prompt, dann Vision-API-Labels
- Alters-Labels der Vision API (Toddler, Baby, Infant, Newborn) werden gefiltert, da sie unzuverlaessig sind
