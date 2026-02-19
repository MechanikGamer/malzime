# E-Mail-Benachrichtigung bei Cloud Function Fehlern

## Was ist das?

Wenn die Cloud Function abstuerzt (z.B. Speicherfehler, API-Timeout), wirst du per E-Mail benachrichtigt. So erfaehrst du von Problemen sofort statt nach Tagen.

## Einrichtung (einmalig)

### Schritt 1: E-Mail-Kanal erstellen

1. Oeffne: https://console.cloud.google.com/monitoring/alerting/notifications?project=malzime
2. Scroll runter zum Bereich **Email** (steht unter Webhooks, SMS usw.)
3. Klick rechts daneben auf **"Add New"**
4. **Email Address:** deine E-Mail-Adresse (z.B. malziland@gmail.com)
5. **Display Name:** `malziME Alerts` (frei waehlbar, nur ein Label fuer dich)
6. Klick **"Save"**

### Schritt 2: Alert Policy erstellen

1. Oeffne: https://console.cloud.google.com/monitoring/alerting?project=malzime
2. Klick oben auf **"+ Create policy"**

#### Metrik waehlen

3. Klick auf **"Messwert auswaehlen"**
4. Links unter **AKTIVE RESSOURCEN** klick auf **"Cloud Function"**
5. In der mittleren Spalte klick auf **"Function"**
6. In der rechten Spalte klick auf **"Executions"**
7. Klick unten auf **"Anwenden"**

#### Filter setzen

8. Klick auf **"Filter hinzufuegen"**
9. Klick auf das Dropdown **"Filter"** (links) — ein Suchfeld oeffnet sich
10. Klick auf **"status"** (unter Messwertlabels)
11. Klick **"Ok"**
12. Jetzt siehst du drei Felder: Filter = status, Vergleichsoperator = "=", Wert
13. Im Feld **"Wert"** tippe `error`
14. Klick auf **"Fertig"**

#### Trigger konfigurieren

15. Scroll runter und klick **"Next"**
16. **Condition Type:** "Threshold" (ist schon ausgewaehlt)
17. Im Feld **"Grenzwert"** tippe `0.001` (entspricht ca. 3-4 Fehlern pro Stunde)
18. Klick **"Next"**

#### Benachrichtigung und Name

19. Klick auf das Dropdown **"Benachrichtigungskanaele"** und waehle **"malziME Alerts"**
20. Im Feld **"Betreffzeile der Benachrichtigung"** tippe: `malziME Cloud Function Errors`
21. Scroll ganz nach unten zum Feld **"Richtlinienname"** und tippe: `malziME Cloud Function Errors`
22. Klick auf **"Richtlinie erstellen"** (blauer Button ganz unten)

### Was passiert dann?

- Wenn die Cloud Function zu oft fehlschlaegt, bekommst du eine E-Mail
- Die E-Mail enthaelt: Fehlername, Haeufigkeit, Link zur Console
- Keine Nutzerdaten in der E-Mail (kein Foto, kein Profil, keine IP)

### Datenschutz

- Kein externer Dienst — Google Cloud Monitoring ist Teil der bestehenden Infrastruktur
- Die E-Mail geht von Google direkt an dich
- Kompatibel mit dem Datenschutztext (keine zusaetzlichen personenbezogenen Daten)
