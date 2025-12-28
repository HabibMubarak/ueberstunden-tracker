# Überstunden-Guthaben-Tracker

Single Page Application zum Verwalten von angesammelten und abgezogenen Arbeitsstunden.

## Schnellstart (Windows PowerShell)

1. Docker MongoDB starten:

```powershell
cd "c:\Users\user\Arbeitsplatz\Zeiterfassung"; docker compose up -d
```

2. Abhängigkeiten installieren:

```powershell
cd .\backend; npm install; cd ..\frontend; npm install
```

3. Umgebungsvariablen anlegen:

- Backend: `c:\Users\user\Arbeitsplatz\Zeiterfassung\backend\.env`

```
PORT=4000
MONGODB_URI=mongodb://localhost:27017/ueberstunden
```

- Frontend: `c:\Users\user\Arbeitsplatz\Zeiterfassung\frontend\.env`

```
VITE_API_URL=http://localhost:4000/api
```

4. Entwicklung starten (zwei Terminals empfohlen):

```powershell
cd .\backend; npm run dev
```

```powershell
cd .\frontend; npm run dev
```

Frontend läuft unter `http://localhost:5173`, Backend unter `http://localhost:4000`.

## API (Backend)

- `GET /api/transactions` – Liste aller Transaktionen (sortiert)
- `POST /api/transactions` – Neue Transaktion anlegen
  - Body: `{ date: string (YYYY-MM-DD), type: 'EARNED'|'SPENT', hours: number, description: string }`
- `POST /api/transactions/import/csv` – CSV-Datei importieren
  - Body: `multipart/form-data` mit `file` (CSV)
  - CSV-Spalten: `date`, `type`, `minutes` (oder `hours`), `description`
  - Beispiel CSV:
    ```
    date,type,minutes,description
    2024-12-28,EARNED,480,Projektarbeit
    2024-12-27,SPENT,120,Besprechung
    ```
- `GET /api/transactions/balance` – Aktueller Gesamtsaldo
- `DELETE /api/transactions/:id` – Transaktion löschen
- `PUT /api/transactions/:id` – Transaktion aktualisieren (Body kann `date`, `type`, `minutes`, `description` enthalten)

## CSV Import

### Mit Vorschau & Bearbeitung

Die Anwendung bietet einen **erweiterten CSV-Import mit interaktiver Vorschau**:

1. **Datei auswählen**: Drag & Drop oder Klick in der "Daten importieren" Box
2. **Vorschau anzeigen**: Modal mit allen Transaktionen aus der CSV
3. **Bearbeiten**: Jedes Feld direkt im Modal editierbar
4. **Selektieren**: Einzelne Transaktionen ab/anwählen
5. **Bestätigen**: Ausgewählte Transaktionen importieren

#### Features
- ✅ Live-Validierung während der Bearbeitung
- 📁 Drag-and-drop Upload
- 🔴 Fehler-Hervorhebung mit Zeilennummern
- ✏️ Direktes Editieren aller Felder
- 🔄 Minuten ↔ Stunden Konvertierung
- 📋 Farbcodierte Vorschau (Grün/Rot)

### CSV-Formatanforderungen

### Vorbereitung der CSV-Datei

Die CSV-Datei sollte folgende Spalten enthalten (Spaltenreihenfolge beliebig):

| Spalte | Erforderlich | Format | Beispiel |
|--------|-------------|--------|----------|
| `date` | Ja | `YYYY-MM-DD` | `2024-12-28` |
| `type` | Ja | `EARNED` oder `SPENT` | `EARNED` |
| `minutes` | Ja* | Integer (Minuten) | `480` |
| `hours` | Ja* | Dezimalzahl (Stunden) | `8.5` |
| `description` | Ja | Text | `Projektarbeit` |

*Entweder `minutes` ODER `hours` erforderlich

### Import durchführen

1. Öffne die Anwendung und melde dich an
2. Klicke auf ⚙️ (Einstellungen)
3. Wähle den Tab "Daten"
4. Im Bereich "Daten importieren" klickst du auf "CSV-Datei auswählen"
5. Wähle deine CSV-Datei aus
6. Das System prüft die Daten und importiert korrekte Einträge
7. Fehlerhafte Zeilen werden angezeigt (z.B. ungültige Daten)

### Beispiel CSV-Datei

Siehe [example_import.csv](example_import.csv) für ein funktionierendes Beispiel.

## Hinweise

- Laufender Saldo und monatliche Übersicht werden im Frontend berechnet.
- UI ist Mobile-First mit Tailwind CSS.
- Bei CSV-Import werden ungültige Zeilen übersprungen und Fehler angezeigt.

