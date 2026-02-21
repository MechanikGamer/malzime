# Changelog

Alle relevanten Aenderungen an malziME werden hier dokumentiert.

Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [1.2.1] — 2026-02-21

### Sicherheit

- **HMAC-basierte Admin-Tokens**: ntfy-Action-URLs enthalten keine Klartext-Secrets mehr — stattdessen kurzlebige HMAC-SHA256-signierte Tokens (30 Min gueltig, aktionsgebunden, timing-safe)
- **Admin CORS-Whitelist**: Admin-Endpunkte verwenden jetzt dieselbe Domain-Whitelist wie der Analyse-Endpunkt (statt `cors: true`)
- **Boost-Cap**: Maximaler Boost auf 500 begrenzt (statt 10.000)
- **HTML-Escaping**: Admin-Bestaetigungsseite escaped jetzt alle dynamischen Werte
- **ADMIN_SECRET rotiert**: Neues Zufalls-Secret gesetzt

### Bugfixes

- **Counter-Cleanup**: `getStats()` schreibt veraltete `recentAnalyses`-Eintraege zurueck nach Firestore (verhindert unbegrenztes Wachstum)
- **Demo-Daten Privacy**: GPS-Koordinaten und `dateTimeOriginal` aus Server-seitigen Demo-Exif-Daten entfernt — widerspricht sonst der Privacy-Architektur
- **stats.js i18n**: Alle hardcoded deutschen Strings durch `t()`-Aufrufe ersetzt, `Intl.NumberFormat` verwendet erkannte Sprache statt `"de"`

### Verbesserungen

- **i18n-Guardian erweitert**: Prueft jetzt automatisch alle HTML-Dateien auf fehlende Locale-Keys (nicht nur index.html)
- **stats.html i18n**: Alle statischen Texte mit `data-i18n`-Attributen versehen

### Tests

- **77 neue Tests**: HMAC-Auth (10), Admin-Endpunkte (14), Stats-Frontend (41), Demo-Privacy (1), Rate-Limit-Boundary (1), Notify HMAC (6), npm audit fix
- **Testabdeckung**: 186 Backend + 125 Frontend Tests

## [1.2.0] — 2026-02-21

### Features

- **Stundenlimit mit rollendem Fenster**: Echtes rollendes 60-Minuten-Fenster basierend auf einem `recentAnalyses`-Array in Firestore. Alte Eintraege fallen automatisch heraus — sobald genug Eintraege altern, ist das System sofort wieder frei (kein starrer Countdown). Konfigurierbares Limit (Standard: 500/Stunde, zentral in `config.js`). Fail-open bei Firestore-Fehlern.
- **Oeffentliche Stats-Seite**: Neue Seite unter `/stats` mit Live-Status, Gesamtzaehler, Zeitraum-Statistiken (Heute, Woche, Monat) mit Durchschnittswerten und Limit-Balken. Vollstaendig anonym — keine personenbezogenen Daten.
- **Limit-Banner auf Hauptseite**: Wenn das Stundenlimit erreicht ist, erscheint ein auffaelliger Banner mit Live-Countdown und Link zur Stats-Seite. Upload- und Demo-Bereich werden ausgegraut. Automatischer Reload nach Ablauf. Banner erscheint auch beim Neuladen der Seite (nicht erst nach Upload-Versuch).
- **Admin-Endpunkte**: `/api/admin/boost` (+100 Analysen) und `/api/admin/reset` (Zaehler zuruecksetzen) mit Token-Authentifizierung via ADMIN_SECRET (Bearer-Header oder Query-Parameter). Bestaetigungsseite im Dark-Theme mit Auto-Redirect zu Stats.
- **ntfy Push-Benachrichtigungen**: Automatischer Push auf self-hosted ntfy wenn das Limit erstmals erreicht wird. Action-Buttons in der Benachrichtigung fuer Boost, Reset und Stats — oeffnen jeweils eine Bestaetigungsseite im Browser.
- **Auto-Refresh bei Limit-Aufhebung**: Limit-Banner prueft alle 30 Sekunden ob das Limit per Boost oder Reset aufgehoben wurde und laedt die Seite automatisch neu.

### Datenschutz

- **Datenschutzseite ergaenzt**: Neuer Absatz zum Analyse-Zaehler (nur aggregierte Zahlen, keine Nutzer- oder Bilddaten) + Cloud Firestore in der Dienste-Tabelle
- **Counter speichert nur anonyme Timestamps**: Das rollende Fenster speichert Zeitpunkte der Analysen — kein Bezug zu einzelnen Nutzern, keine IP-Adressen, keine Bildinhalte

### Dokumentation

- **Stats-Link im Footer**: Alle Seiten (Hauptseite, Impressum, Datenschutz, Stats) haben jetzt einen Stats-Link und konsistente Startseite-Links im Footer
- **AGENTS.md, docs/SETUP.md, docs/SELF-HOSTING.md**: Neue Dateien und Endpunkte dokumentiert, Testanzahlen aktualisiert

## [1.1.1] — 2026-02-20

### Verbesserungen

- **Concurrency**: Cloud Function verarbeitet jetzt bis zu 20 gleichzeitige Anfragen pro Instanz (statt 1) — bessere Performance bei vielen Workshop-Teilnehmern
- **Quota-Fehlermeldung**: Wenn die Google-API ueberlastet ist, zeigt die App eine verstaendliche Meldung statt eines kryptischen Fehlers
- **Datenwert-Rechner**: Schluessel in der Gewichtungstabelle korrigiert — `politisch` wird jetzt korrekt mit 0.11 statt 0.06 gewichtet
- **Scan-Animation**: Fallback wenn i18n-Laden fehlschlaegt (zeigt Ellipsis statt leerem Text)
- **Deploy-Script**: Cache-Busting jetzt sekundengenau statt stuendlich — verhindert Cache-Probleme bei mehreren Deploys am selben Tag

### Dokumentation

- **docs/SETUP.md**: Testanzahl, RAM-Angabe und CI/CD-Abschnitt korrigiert
- **docs/SELF-HOSTING.md**: RAM-Angabe, CI/CD-Abschnitt und Nominatim-Dokumentation korrigiert
- **Datenschutzseite**: Logging-Beschreibung praezisiert (genutztes Modell, Antwortlaenge erwaehnt)

## [1.1.0] — 2026-02-19

### Features

- **Demo-Fotos fuer Workshops**: 3 anklickbare Stock-Fotos (Selfie Wien, Cafe Salzburg, Wanderung Hallstatt) mit eingebetteten Fake-EXIF-Daten (GPS, Kamera, Datum). Loesung fuer Workshops, in denen Teilnehmer kein eigenes Foto hochladen moechten. Bilder werden echt von der KI analysiert — kein vorgefertigtes Ergebnis.
- **i18n-System**: Alle UI-Texte, Gemini-Prompts und Tier-Profile in Locale-Dateien ausgelagert
  - Frontend: `public/locales/de.json` (alle UI-Strings via `data-i18n`-Attribute)
  - Backend: `functions/src/locales/de/prompts.js` (Gemini-Prompts) + `de/animals.js` (Tierprofile)
  - Sprachcode wird vom Client an den Server gesendet (`lang`-Parameter)
  - Spracherkennung: `?lang=`-URL-Parameter > Browser-Sprache > Default (de)
- **i18n-Guardian-Tests**: Automatische Pruefung dass keine hardcoded Strings in HTML, JS oder Backend stehen (Frontend + Backend)

### Barrierefreiheit

- **Safari Keyboard-Navigation**: Explizites `tabindex="0"` auf allen interaktiven Elementen (Buttons, Inputs, Links) — Safari ueberspringt ohne dieses Attribut standardmaessig alles ausser Text-Inputs
- **Subpages Safari-fix**: Datenschutz- und Impressum-Seite ebenfalls mit `tabindex="0"` auf allen Links
- **File-Input Overlay behoben**: `position: relative` auf `.file-drop` verhindert, dass der unsichtbare File-Input andere Buttons ueberlagert
- **A11y-Tests gegen echte HTML**: Tests lesen die echte `index.html` statt einer Kopie — kein Drift zwischen Test und Produktion moeglich
- **Farbkontrast verbessert**: Muted-Farbe von `#6b7280` auf `#9ca3af` angehoben — erfuellt jetzt WCAG AA (5.38:1 statt 3.84:1)
- **Skip-to-Content Link**: Unsichtbarer Link fuer Tastatur-Nutzer — erscheint beim ersten Tab-Druck, springt zum Hauptinhalt
- **Toggle-Switch per Tastatur**: Bias-Toggle ist jetzt per Tab erreichbar und mit Leertaste umschaltbar
- **Upload-Feld per Tastatur**: Datei-Upload ist per Tab erreichbar, Enter/Leertaste oeffnet den Datei-Dialog
- `aria-live="polite"` auf Status, Scan-Animation und Ergebnis-Bereich — Screenreader lesen Aenderungen vor
- **Disclaimer-Modal**: Focus-Trap, Escape zum Schliessen, Focus-Wiederherstellung, `role="dialog"` + `aria-modal`
- **Bias-Toggle**: `aria-label` fuer Screenreader
- **Info-Tooltips**: Per Tastatur (Tab + Enter/Space) erreichbar, `role="button"`
- **Dekorative SVGs**: Mit `aria-hidden="true"` vor Screenreadern versteckt
- **Reduzierte Bewegung**: `prefers-reduced-motion` deaktiviert alle Animationen fuer bewegungsempfindliche User

### Dokumentation

- **Screenshots**: Desktop- und Mobil-Screenshot in `docs/screenshots/` fuer README
- **README**: Screenshots, Lighthouse-/License-/Node.js-/Firebase-Badges, CI/CD-Abschnitt aktualisiert
- **Error-Alerting-Doku**: Anleitung fuer E-Mail-Benachrichtigungen bei Cloud-Function-Fehlern (`docs/ERROR-ALERTING.md`)
- **Good First Issues**: 2 Issues auf GitHub fuer externe Contributors (Tier-Easter-Eggs, English Translation)

### Sicherheit

- **CSP gehaertet**: `style-src 'unsafe-inline'` entfernt — alle Inline-Styles durch CSS-Klassen ersetzt
- **Dependabot**: Monatliche automatische Pruefung auf unsichere Dependencies (npm + GitHub Actions)
- **npm audit in CI**: Backend-Dependencies werden bei jedem Push auf bekannte Sicherheitsluecken geprueft
- **gitleaks in CI**: Automatischer Scan nach versehentlich committeten Secrets (API-Keys, Tokens) bei jedem Push
- **Lighthouse CI**: Automatischer Lighthouse-Audit bei jedem Push mit Budget-Pruefung (Performance >= 90, Rest = 100)

### Tooling

- **Deploy-Script**: `scripts/deploy.sh` — automatisches Cache-Busting (`?v=YYYYMMDDHH`) + Deploy in einem Schritt

### Bugfixes

- **Memory-Limit**: Cloud Function von 256 auf 512 MiB erhoeht — behebt Abstuerze bei groesseren Bildern

### Datenschutz

- **Datenschutzseite praezisiert**: Klarstellung dass anonymisierte Fehlerzusammenfassungen (ohne personenbezogene Daten) zur Fehlerbehebung bestehen bleiben

## [1.0.0] — 2026-02-16

Erster oeffentlicher Release.

### Features

- **KI-Analyse**: Foto hochladen, Gemini erstellt fiktives Persoenlichkeitsprofil
- **Zwei Modi**: Serioese Analyse (sachlich) und Beast Mode (uebertrieben-provokant)
- **Datenwert-Rechner**: Zeigt was ein Profil fuer Datenbroker wert ist
- **Privacy-Check**: Erkennt ungewollt preisgegebene Informationen (Telefonnummern, Adressen, Kennzeichen)
- **EXIF-Analyse**: Versteckte Kamera-Metadaten (client-seitig extrahiert, GPS verlässt nie den Browser)
- **GPS-Karte**: Aufnahmeort auf Leaflet-Karte (nur lokal im Browser)
- **Tier-Easter-Egg**: Tierfotos bekommen ein lustiges Spass-Profil
- **PDF-Export**: Ergebnisse als PDF speichern
- **Demo-Modus**: Vorbereitete Profile fuer Workshops ohne echte Fotos
- **Disclaimer-Modal**: Pflicht-Hinweis vor Ergebnisanzeige

### Sicherheit

- Magic-Byte-Validierung (JPEG, PNG, WebP, GIF)
- Content Security Policy mit strikter Whitelist
- HSTS mit Preload
- Rate Limiting (200/10min pro IP)
- Honeypot-Feld + Timing-Check
- Prompt-Injection-Schutz (XML-Tag-Isolation)

### Privacy

- Keine Speicherung von Bildern oder Profilen
- Keine externen Scripts (Fonts, Leaflet, exifr self-hosted)
- Kein Tracking, keine Cookies, keine Analytics
- GPS bleibt immer im Browser
