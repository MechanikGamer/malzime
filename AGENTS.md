# Repository Guidelines

## Project Structure & Module Organization

```
public/              Firebase Hosting SPA (Vanilla JS, kein Build-Schritt)
  index.html         Hauptseite (Cache-Busting: ?v=YYYYMMDDNN an CSS/JS)
  app.js             Entry Point (ES Module)
  js/                Frontend-Module
    api.js           API-Client (fetch, AbortController, Stale-Guard)
    dom.js           DOM-Helpers (escapeHtml, sanitize)
    exif.js          Client-seitige EXIF-Extraktion (exifr)
    geocoding.js     Nominatim Reverse Geocoding (client-seitig)
    render.js        Ergebnis-Rendering (Profile, EXIF, Karte, Datenwert)
    state.js         Globaler State (requestId, isAnalyzing)
    ui.js            UI-Komponenten (Disclaimer-Modal, Maintenance-Modal, Scan-Animation, Bias-Toggle, Limit-Banner)
    demo.js          Demo-Foto-Initialisierung (Click-Handler fuer Stock-Fotos)
    stats.js         Stats-Seite: Fetch /api/stats, Limit-Balken, Countdown
    i18n.js          i18n Micro-Modul (initI18n, t, getLanguage, applyTranslations)
  locales/           Frontend-Locale-Dateien
    manifest.json    Verfuegbare Sprachen + Default
    de.json          Deutsche UI-Strings (Keys fuer alle data-i18n-Elemente)
  __tests__/         Vitest Frontend-Tests
  styles.css         Dark-Theme CSS + Print Styles + Self-hosted @font-face
  impressum.html     Impressum
  datenschutz.html   Datenschutzerklaerung
  stats.html         Oeffentliche Nutzungsstatistik
  fonts/             Self-hosted: Inter + JetBrains Mono (woff2)
  lib/leaflet/       Self-hosted: Leaflet 1.9.4 (JS, CSS, Marker-Images)
  lib/exifr/         Self-hosted: exifr lite ESM (Browser EXIF-Parsing)

functions/src/       Firebase Cloud Functions 2nd Gen (Node 24, europe-west1)
  index.js           HTTP-Handler: orchestriert Module, Tier-Check, Magic-Byte-Validierung
  config.js          Konstanten, Modell-Listen (Gemini 2.5 Flash), Limits, HOURLY_LIMIT (500)
  counter.js         Firestore-Zaehler: Stundenlimit, Totals, Stats, Boost, Reset
  notify.js          ntfy Push-Benachrichtigungen bei Limit-Erreichung
  animal.js          Personen-/Tier-Erkennung (Word-Boundary-Matching) + Easter-Egg-Profile
  middleware.js       Rate Limiting (IP-basiert, 200/10min), IP-Extraktion
  upload.js          Multipart + JSON Body Parsing
  vision.js          Google Cloud Vision API (EU-Endpoint, TEXT + LABEL_DETECTION)
  privacy.js         Privacy-Risiko-Erkennung aus OCR/Labels
  gemini.js          Vertex AI Gemini: Bildbeschreibung (multimodal) + Profilgenerierung (text)
  auth.js            HMAC-basierte Admin-Token + Nonces (createAdminToken, verifyAdminToken, createNonce, verifyNonce)
  domains.js         Zentrale CORS-/Origin-Whitelist (ALLOWED_ORIGINS)
  i18n.js            Backend-Locale-Loader (loadPrompts, loadAnimals, resolveLanguage)
  locales/           Backend-Locale-Dateien
    manifest.json    Verfuegbare Sprachen + Default
    de/prompts.js    Deutsche Gemini-Prompts (System-Prompts, Labels, JSON-Schema)
    de/animals.js    Deutsche Tier-Easter-Egg-Profile
  __tests__/         Jest Unit-Tests

docs/                Setup-Dokumentation
.github/             CI/CD Workflows (ci.yml, deploy.yml)
```

## Build, Test, and Development Commands

- `cd functions && npm install` — install backend dependencies
- `npm install` (root) — install frontend test/lint dependencies (Vitest, ESLint, Prettier)
- `cd functions && npm test` — run Jest backend unit tests (222 tests)
- `npm run test:frontend` — run Vitest frontend unit tests (128 tests)
- `cd functions && npm run lint` — ESLint backend
- `cd functions && npm run format:check` — Prettier backend
- `npm run lint:frontend` — ESLint frontend
- `npm run format:frontend:check` — Prettier frontend
- `firebase emulators:start --only functions,hosting` — local dev
- `firebase deploy --only functions,hosting` — deploy all
- `firebase deploy --only hosting` — deploy frontend only
- `firebase deploy --only functions` — deploy backend only

## Coding Style & Naming Conventions

- JavaScript with 2-space indentation
- Filenames: `kebab-case.js` for modules
- Exports: named exports via `module.exports = { ... }`
- Frontend: vanilla JS ES modules, no build step, no framework
- Sprache in Profilen und UI: Deutsch (du-Form, kein Passiv)
- Nie "kaukasisch" verwenden — stattdessen "europaeisch" oder "mitteleuropaeisch"
- Neue UI-Strings gehoeren in `public/locales/de.json` (nicht hardcoded in HTML/JS)
- Neue Prompt-Texte gehoeren in `functions/src/locales/de/prompts.js`
- Neue Tier-Profile gehoeren in `functions/src/locales/de/animals.js`
- i18n-Guardian-Tests pruefen dass keine hardcoded Strings in HTML/JS/Backend stehen

## Testing Guidelines

- Jest for backend unit tests in `functions/src/__tests__/`
- Vitest + jsdom for frontend unit tests in `public/__tests__/`
- Run backend: `cd functions && npm test`
- Run frontend: `npm run test:frontend`
- Backend: test pure functions (privacy, config, middleware, upload)
- Frontend: test DOM helpers, state, UI components, geocoding, render, API integration
- API-dependent modules (vision, gemini) tested via integration/manual

## Privacy-Architektur (KRITISCH)

- EXIF wird client-seitig extrahiert (exifr im Browser)
- GPS verlässt NIEMALS den Browser — Nominatim wird direkt vom Client aufgerufen
- Server bekommt nur: komprimiertes Bild + Kamera-Metadaten (make, model) OHNE GPS, OHNE dateTimeOriginal
- Keine externen Scripts: Alles self-hosted (Fonts, Leaflet, exifr). Kein CDN, kein reCAPTCHA, kein Firebase SDK
- Bot-Schutz: Rate Limiting (IP) + Honeypot + Timing-Check
- CSP: nur 'self' + OpenStreetMap Tiles + Cloud Functions Endpoint + Nominatim

## Security & Configuration

- Use `functions/.env` for local config (see `functions/.env.example`)
- Never commit secrets or API keys
- CSP headers configured in `firebase.json`
- Honeypot field for bot protection
- Prompt-Injection-Schutz: User-Daten in XML-Tags isoliert + escapeXml() auf dynamische Inhalte
- Admin-Aktionen: GET zeigt Bestaetigungsseite, POST+Nonce fuehrt Mutation aus (SEC-001)

## EU Vision API Einschraenkungen

- `eu-vision.googleapis.com` unterstuetzt NUR: `TEXT_DETECTION`, `LABEL_DETECTION`
- NICHT unterstuetzt: `FACE_DETECTION`, `OBJECT_LOCALIZATION` (crashen den gesamten Call!)
- Alters-Labels ("Toddler", "Baby", etc.) werden in index.js gefiltert (unzuverlaessig)

## Agent-Specific Instructions

- Keep changes focused and incremental
- Always run `cd functions && npm test` after backend changes
- Always run `npm run test:frontend` after frontend changes
- Run `cd functions && npm run lint && npm run format:check` before committing backend changes
- Run `npm run lint:frontend && npm run format:frontend:check` before committing frontend changes
- Update cache-buster `?v=YYYYMMDDNN` on CSS/JS when editing frontend files
- Both profiles (normal + boost) are generated in parallel — changes to prompts affect `gemini.js`
- Bei Aenderungen an der Architektur oder neuen Features: README.md, AGENTS.md, CHANGELOG.md, docs/SETUP.md und docs/SELF-HOSTING.md aktualisieren
- Bei neuen Features: Dokumentation und Anleitungen mitliefern
- dateTimeOriginal wird NICHT an Gemini gesendet (verleitet zu falschen Altersschaetzungen)
- Describe-Prompt: kein konkretes Alter nennen, nur physische Merkmale beschreiben
