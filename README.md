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
- `GET /api/transactions/balance` – Aktueller Gesamtsaldo
- `DELETE /api/transactions/:id` – Transaktion löschen
- `PUT /api/transactions/:id` – Transaktion aktualisieren (Body kann `date`, `type`, `hours`, `description` enthalten)

## Hinweise

- Laufender Saldo und monatliche Übersicht werden im Frontend berechnet.
- UI ist Mobile-First mit Tailwind CSS.

