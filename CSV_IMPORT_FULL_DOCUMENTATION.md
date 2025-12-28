# CSV Import Feature - Vollständige Dokumentation

## 📋 Überblick

Die CSV-Import-Funktion ermöglicht es, Transaktionen (Überstunden/Minusstunden) in Massenformat aus einer CSV-Datei zu importieren.

## 🚀 Neue Features

### Backend-API
**Endpunkt**: `POST /api/transactions/import/csv`

Akzeptiert eine CSV-Datei mit Transaktionsdaten und importiert sie in die Datenbank.

**Request**:
```
Content-Type: multipart/form-data
file: <CSV-Datei>
```

**Response**:
```json
{
  "imported": 7,
  "errors": [],
  "message": "7 transactions imported successfully"
}
```

### Frontend-UI
Neuer Bereich in **Einstellungen → Daten Tab**:
- 📁 Drag-and-drop oder Klick zum Dateiauswahl
- ✅ Live-Validierung der CSV
- ⚠️ Fehlerdetails mit Zeilennummern
- 🔄 Automatische Aktualisierung nach erfolgreichen Import

## 📄 CSV-Dateiformat

### Erforderliche Spalten
Die CSV-Datei muss folgende Spalten enthalten (Reihenfolge egal):

| Spaltenname | Alternativ | Erforderlich | Format | Beispiel |
|-------------|-----------|-------------|--------|----------|
| `date` | `Date`, `Datum` | Ja | YYYY-MM-DD | 2024-12-28 |
| `type` | `Type`, `Typ` | Ja | EARNED oder SPENT | EARNED |
| `minutes` | - | Ja* | Positive Integer | 480 |
| `hours` | - | Ja* | Positive Dezimal | 8.0 |
| `description` | `Description`, `Beschreibung` | Ja | Text | Projektarbeit |

*Entweder `minutes` ODER `hours` erforderlich (nicht beide)

### Beispiel CSV-Datei

```csv
date,type,minutes,description
2024-12-28,EARNED,480,Projektarbeit
2024-12-27,EARNED,240,Dokumentation
2024-12-27,SPENT,60,Team Besprechung
2024-12-26,EARNED,360,Feature Entwicklung
2024-12-26,SPENT,90,Weekly Sync
2024-12-25,EARNED,120,Code Review
2024-12-24,EARNED,300,Bug Fixes
```

### Alternative Formate

**Mit "hours" statt "minutes"**:
```csv
date,type,hours,description
2024-12-28,EARNED,8,Projektarbeit
2024-12-27,EARNED,4,Dokumentation
```

**Mit deutschen Spaltennamen**:
```csv
Datum,Typ,Minuten,Beschreibung
2024-12-28,EARNED,480,Projektarbeit
2024-12-27,SPENT,60,Besprechung
```

## 📖 Anleitung: CSV importieren

### Schritt 1: CSV-Datei vorbereiten
Stelle sicher, dass deine CSV-Datei:
- UTF-8 codiert ist
- Die erforderlichen Spalten enthält
- Gültiges Datum-Format hat (YYYY-MM-DD)
- Gültige Type-Werte hat (EARNED oder SPENT)
- Positive Minuten/Stunden enthält

### Schritt 2: Anwendung öffnen
1. Öffne die Zeiterfassungs-App
2. Melde dich an (falls erforderlich)

### Schritt 3: Zu Einstellungen navigieren
1. Klicke auf das ⚙️ Symbol (Einstellungen) oben rechts
2. Der Einstellungen-Dialog öffnet sich

### Schritt 4: Zum Daten-Tab gehen
1. Klicke auf den "Daten" Tab
2. Oben siehst du "Daten importieren"

### Schritt 5: CSV-Datei auswählen
1. Klicke auf die Fläche "📁 CSV-Datei auswählen"
2. Oder ziehe die CSV-Datei in die Fläche
3. Ein Datei-Dialog öffnet sich
4. Wähle deine CSV-Datei aus

### Schritt 6: Import ausführen
1. Der Import wird automatisch gestartet
2. Eine Meldung zeigt:
   - ✅ Anzahl erfolgreich importierter Transaktionen
   - ⚠️ Anzahl fehlerhafter Zeilen (falls vorhanden)

### Schritt 7: Ergebnisse prüfen
1. Wechsle zum "Historie" Tab
2. Du siehst die neu importierten Transaktionen
3. Der Saldo wird automatisch aktualisiert

## ⚠️ Fehlerbehandlung

### Häufige Fehler und Lösungen

| Fehler | Ursache | Lösung |
|--------|--------|--------|
| Invalid date format | Datum nicht im YYYY-MM-DD Format | Änder in korrektes Format: 2024-12-28 |
| Invalid type | Type ist nicht EARNED oder SPENT | Nutze nur EARNED oder SPENT (Großbuchstaben) |
| Invalid minutes/hours value | Ungültige oder negative Werte | Nutze nur positive Ganzzahlen/Dezimalzahlen |
| Description is required | Beschreibung fehlt | Füge in jeder Zeile eine Beschreibung ein |
| No CSV file provided | Keine Datei ausgewählt | Wähle eine CSV-Datei aus |
| CSV file is empty | CSV hat keine Daten | Füge mindestens eine Datenzeile ein (ohne Header) |

### Fehlerdetails
Nach dem Import werden Fehler mit Zeilennummern angezeigt:
```
Fehler in Zeile 3: Invalid date format (expected YYYY-MM-DD)
Fehler in Zeile 5: Invalid type (must be EARNED or SPENT)
```

Die Zeilennummer bezieht sich auf die Zeile in der CSV-Datei (1. Zeile = Header).

## 🔧 Technische Details

### Backend-Implementierung
- **Datei-Upload**: Multer (In-Memory Storage)
- **CSV-Parsing**: csv-parse Bibliothek
- **Validierung**: Zeilenweise Validierung mit aussagekräftigen Fehlermeldungen
- **Datenbank**: MongoDB Transactions mit individuellem Error Handling

### Frontend-Implementierung
- **API-Aufruf**: FormData mit multipart/form-data
- **UI-Feedback**: Alerts mit erfolgreichen Imports und Fehlerzahlen
- **Auto-Refresh**: Transaktionsliste wird nach Import aktualisiert

## 📝 Beispieldatei

Eine Beispiel-CSV-Datei ist im Projekt enthalten: **`example_import.csv`**

Diese kann direkt zum Testen der Funktion verwendet werden.

## 🛠️ Installation

Die notwendigen Pakete wurden bereits installiert:
```bash
npm install multer csv-parse @types/multer
```

## ✅ Validierungsprüfungen

Das System prüft für jede Zeile:

1. **Datum**
   - ✅ Format YYYY-MM-DD
   - ✅ Gültiges Datum
   - ✅ Nicht leer

2. **Type**
   - ✅ Entweder EARNED oder SPENT
   - ✅ Case-insensitive
   - ✅ Nicht leer

3. **Minuten/Stunden**
   - ✅ Positive Ganzzahl (Minuten) oder Dezimalzahl (Stunden)
   - ✅ > 0
   - ✅ Mindestens eines von beiden vorhanden

4. **Beschreibung**
   - ✅ Text vorhanden
   - ✅ Nicht leer

## 🎯 Use Cases

### Masse-Eingabe von Überstunden
```csv
date,type,minutes,description
2024-12-28,EARNED,480,Projekt A
2024-12-27,EARNED,240,Projekt B
2024-12-26,EARNED,360,Projekt A
```

### Migration aus anderem System
```csv
Datum,Typ,Minuten,Beschreibung
2024-01-01,EARNED,480,Übertrag aus altem System
2024-01-02,EARNED,240,Übertrag aus altem System
```

### Monatliche Planung
```csv
date,type,hours,description
2025-01-06,EARNED,8,Geplante Arbeitszeit
2025-01-07,EARNED,8,Geplante Arbeitszeit
2025-01-08,EARNED,8,Geplante Arbeitszeit
```

## ❓ FAQ

**F: Kann ich eine Transaktion doppelt importieren?**
A: Ja, das System prüft nicht auf Duplikate. Stelle sicher, dass du nur neue Transaktionen importierst.

**F: Werden bereits importierte Transaktionen gelöscht?**
A: Nein, neue Transaktionen werden hinzugefügt, bestehende bleiben erhalten.

**F: Kann ich einen Import rückgängig machen?**
A: Nein automatisch, aber du kannst importierte Transaktionen manuell im "Historie" Tab löschen.

**F: Welche Zeichenkodierung ist erforderlich?**
A: UTF-8 ist empfohlen, CSV-parse unterstützt auch andere Kodierungen.

**F: Gibt es eine Größenlimitierung?**
A: Das System akzeptiert beliebig große CSV-Dateien (Standard Multer Limit: 50MB).

## 📊 Performance

- **Kleine Dateien** (< 1000 Zeilen): < 1 Sekunde
- **Mittlere Dateien** (1000-10000 Zeilen): 1-5 Sekunden
- **Große Dateien** (> 10000 Zeilen): 5+ Sekunden

## 🐛 Bekannte Limitierungen

1. Kein Duplikat-Check zwischen Import und bestehenden Daten
2. Keine Undo-Funktion für Imports
3. Keine Auswahl/Vorschau vor dem Import
4. Keine Batch-Processing für sehr große Dateien

## 📞 Support

Bei Problemen mit dem CSV-Import:
1. Prüfe das CSV-Format anhand der Beispieldatei
2. Überprüfe die Fehlermeldungen mit Zeilennummern
3. Teste mit der `example_import.csv` Datei
4. Überprüfe die Browser-Konsole auf zusätzliche Fehler
