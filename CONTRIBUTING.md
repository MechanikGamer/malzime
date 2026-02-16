# Contributing — malziME

Danke fuer dein Interesse! malziME ist ein Open-Source-Lern-Tool und freut sich ueber Beitraege.

## Schnellstart

```bash
git clone https://github.com/malziland/malzime.git
cd malzime

# Backend-Dependencies
cd functions && npm install && cd ..

# Frontend-Tests + Linting (Vitest, ESLint, Prettier)
npm install

# Lokal starten
firebase emulators:start --only functions,hosting
```

Detaillierte Anleitung: [`docs/SETUP.md`](docs/SETUP.md)

## Pull Requests

1. Fork das Repo und erstelle einen Feature-Branch (`git checkout -b feature/mein-feature`)
2. Aenderungen machen
3. Tests laufen lassen:
   - Backend: `cd functions && npm test`
   - Frontend: `npm run test:frontend`
4. Lint + Format pruefen:
   - Backend: `cd functions && npm run lint && npm run format:check`
   - Frontend: `npm run lint:frontend && npm run format:frontend:check`
5. Cache-Buster in `index.html` hochzaehlen bei Frontend-Aenderungen
6. Pull Request erstellen

## Code-Stil

- JavaScript, 2 Spaces Einrueckung
- Frontend: Vanilla JS ES Modules, kein Framework, kein Build-Schritt
- Backend: CommonJS (`require`/`module.exports`)
- Dateinamen: `kebab-case.js`
- UI-Sprache: Deutsch (du-Form)
- Nie "kaukasisch" verwenden — stattdessen "europaeisch" oder "mitteleuropaeisch"

## Privacy-Regeln (WICHTIG)

Diese Regeln sind nicht verhandelbar:

- **GPS verlässt nie den Browser.** Keine Ausnahmen.
- **Keine externen Scripts.** Alles muss self-hosted sein.
- **Keine Tracking-Cookies, Analytics oder Werbung.**
- **Keine Speicherung von Bildern oder Profilen.**
- **Kein Firebase SDK im Frontend.**
- **dateTimeOriginal wird nicht an Gemini gesendet.** (Verleitet zu falschen Altersschaetzungen.)

## Was wir suchen

- Bessere Prompt-Qualitaet (realistischere/lehrreichere Profile)
- Neue Demo-Datensaetze fuer Workshops
- Barrierefreiheit (a11y) Verbesserungen
- Uebersetzungen (aktuell nur Deutsch)
- Bug-Reports und Edge-Cases
- Performance-Optimierungen

## Was wir NICHT wollen

- Tracking oder Analytics jeder Art
- Externe CDN-Abhaengigkeiten
- Build-Schritte oder Bundler fuer das Frontend
- Features die die Privacy-Architektur aufweichen

## Bug Reports

Bitte mit:
- Beschreibung des Problems
- Welches Bild (Typ: Selfie, Landschaft, Meme, etc.) — kein echtes Foto noetig
- Browser und Geraet
- Console-Errors (falls vorhanden)

## Lizenz

Beitraege werden unter der [MIT-Lizenz](LICENSE) veroeffentlicht.
