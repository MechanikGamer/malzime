# Changelog

Alle relevanten Aenderungen an malziME werden hier dokumentiert.

Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

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
