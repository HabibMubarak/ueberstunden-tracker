# CSV Import mit Vorschau & Bearbeitung

## 🎯 Neue Features

### 1. **Drag & Drop Upload**
- CSV-Datei direkt in die Upload-Zone ziehen
- Oder klicken zum Datei-Dialog öffnen
- Visuelle Rückmeldung während des Hoverns (blau leuchtend)
- Loading-Anzeige während des Imports

### 2. **Import-Vorschau Modal**
Nach dem Auswählen einer CSV-Datei wird ein Vorschau-Modal angezeigt mit:

#### Überblick
- ✅ Anzahl gültiger Transaktionen
- ⚠️ Anzahl Transaktionen mit Fehlern
- Farb-Kodierung (Grün = OK, Rot = Fehler)

#### Für jede Transaktion:
- **Auswahl-Checkbox**: Transaktionen ab/anwählen (nur gültige)
- **Bearbeitbare Felder**:
  - 📅 Datum (YYYY-MM-DD)
  - 📊 Typ (EARNED/SPENT Dropdown)
  - ⏱️ Minuten (direkte Eingabe)
  - 🕐 Stunden (automatisch von Minuten berechnet und editierbar)
  - 📝 Beschreibung (Freitext)

#### Fehlerhafte Einträge
- Zeigen Fehlermeldung statt Eingabefelder
- Können nicht ausgewählt werden
- Zeigen die Zeilennummer der CSV

### 3. **Live-Validierung**
Während der Bearbeitung wird jede Änderung validiert:
- Datum-Format (YYYY-MM-DD)
- Typ (EARNED oder SPENT)
- Positive Minuten/Stunden
- Nicht-leere Beschreibung
- Automatische Deaktivierung bei Fehlern

### 4. **Bestätigung & Import**
- Nur gültige, ausgewählte Transaktionen werden importiert
- Knopf deaktiviert, wenn keine Transaktionen ausgewählt
- Fortschritts-Anzeige während des Imports
- Erfolgs-/Fehlermeldung nach dem Import
- Automatische Aktualisierung der Transaktionsliste

## 📋 Workflow

### Schritt 1: CSV-Datei auswählen
```
1. Settings (⚙️) öffnen
2. "Daten" Tab auswählen
3. CSV-Datei in "Daten importieren" Bereich ziehen ODER klicken
```

### Schritt 2: Vorschau prüfen und bearbeiten
```
Das Vorschau-Modal zeigt:
- Alle Zeilen aus der CSV
- Farb-Kodierung: Grün (OK) / Rot (Fehler)
- Bearbeitbare Felder für jede Transaktion
```

### Schritt 3: Transaktionen selektieren
```
- Fehlerhafte Zeilen sind automatisch deaktiviert
- Gültige Zeilen haben Checkboxen
- Ein-/Ausschalten einzelner Transaktionen
```

### Schritt 4: Änderungen vornehmen (Optional)
```
Beliebige Felder bearbeiten:
- Datum korrigieren
- Typ wechseln (EARNED ↔ SPENT)
- Minuten/Stunden anpassen
- Beschreibung aktualisieren
```

### Schritt 5: Bestätigen & Importieren
```
- "Bestätigen & Importieren" Button klicken
- System importiert ausgewählte Transaktionen
- Erfolgs-Meldung mit Import-Anzahl
```

## 🎨 UI-Details

### Farb-Kodierung

| Status | Farbe | Bedeutung |
|--------|-------|-----------|
| Gültig & Ausgewählt | 🟢 Grün | Wird importiert |
| Gültig & Abgewählt | ⚪ Grau | Wird nicht importiert |
| Fehler | 🔴 Rot | Wird nicht importiert, Fehler angezeigt |
| Drag-Over | 🔵 Blau | Datei wird erkannt |
| Loading | ⏳ Pulsing | Importierung läuft |

### Eingabefelder

#### Datum
- Format: YYYY-MM-DD
- Date-Picker verfügbar
- Validierung: Gültiges Datum

#### Typ
- Dropdown mit Optionen: EARNED / SPENT
- Kann während Bearbeitung geändert werden

#### Minuten/Stunden
- **Minuten**: Positive Ganzzahl (480 = 8 Stunden)
- **Stunden**: Dezimalzahl (8.5 = 8:30)
- Beide sind miteinander verbunden
- Änderung in Minuten ↔ Änderung in Stunden

#### Beschreibung
- Freitext-Feld
- Erforderlich für gültigen Import

## ✨ Besonderheiten

### Auto-Validierung
- Jede Bearbeitung wird sofort validiert
- Fehler werden rot markiert
- Checkbox wird automatisch deaktiviert bei Fehler

### Minuten ↔ Stunden Konvertierung
```
Stunden → Minuten: 8.5 * 60 = 510 (gerundet)
Minuten → Stunden: 480 / 60 = 8.00
```

### Fehlerbehandlung
```
Ungültiges Datum → "Ungültiges Datum"
Falscher Typ → "Ungültiger Typ"
Negative Minuten → "Ungültige Minuten"
Leere Beschreibung → "Beschreibung erforderlich"
```

## 🔍 Beispiel-Workflow

### CSV-Inhalt
```csv
date,type,minutes,description
2024-12-28,EARNED,480,Projektarbeit
2024-12-27,INVALID,60,Ungültiger Typ
2024-12-26,SPENT,0,Null-Minuten
2024-12-25,EARNED,240,Code Review
```

### Vorschau
```
✅ 2 Transaktionen gültig
⚠️ 2 Fehler

[✓] Zeile 2: 2024-12-28, EARNED, 480min (8.00h), "Projektarbeit"
[✗] Zeile 3: Ungültiger Typ (INVALID oder SPENT erforderlich)
[✗] Zeile 4: Ungültige Minuten (positive Ganzzahl erforderlich)
[✓] Zeile 5: 2024-12-25, EARNED, 240min (4.00h), "Code Review"
```

### Nach Bearbeitung
```
User bearbeitet Zeile 3: Typ → EARNED
User bearbeitet Zeile 4: Minuten → 120

✅ 4 Transaktionen gültig
⚠️ 0 Fehler

Jetzt können alle 4 Transaktionen importiert werden
```

## 🚀 Keyboard Shortcuts (Geplant)
- `Escape` = Modal schließen
- `Enter` (im letzten Feld) = Import starten

## 🐛 Bekannte Limitierungen

1. Keine Undo-Funktion innerhalb des Modals
2. Keine Sortierung der Preview-Zeilen
3. Keine Duplikat-Prüfung mit bestehenden Daten
4. Modal scrollt nicht syncronisiert bei breiten Displays

## 💡 Tipps & Tricks

### CSV vorbereiten
```
Nutze: date, type, minutes (oder hours), description
Ignorierte Spalten werden übersprungen
```

### Schnelle Bearbeitung
- Tab-Taste zum Navigieren zwischen Feldern
- Minuten/Stunden Felder sind verlinkt
- Fehler-Transaktionen sind sofort erkennbar

### Häufige Fehler vermeiden
- Datum: `2024-12-28` (nicht `28.12.2024`)
- Typ: `EARNED` oder `SPENT` (Großbuchstaben)
- Minuten: `480` (nicht `-480`)
- Beschreibung: Mind. 1 Zeichen
