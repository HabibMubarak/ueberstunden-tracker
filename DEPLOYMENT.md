# Überstunden-Tracker - Cloud Deployment Guide

## 1. MongoDB Atlas einrichten (Datenbank)

1. Gehe zu https://www.mongodb.com/cloud/atlas/register
2. Erstelle kostenloses Konto
3. **Create Deployment** → **M0 FREE**
4. Wähle Region (z.B. Frankfurt/Europe)
5. **Create Deployment**
6. **Database Access** → **Add New Database User**:
   - Username: `ueberstunden-user`
   - Password: (generiere sicheres Passwort, speichere es!)
7. **Network Access** → **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`)
8. **Database** → **Connect** → **Drivers** → **Node.js**
9. Kopiere Connection String: `mongodb+srv://ueberstunden-user:<password>@cluster0.xxxxx.mongodb.net/ueberstunden?retryWrites=true&w=majority`
10. Ersetze `<password>` mit dem echten Passwort

## 2. Backend auf Render deployen

1. Gehe zu https://render.com und melde dich an (mit GitHub)
2. **New** → **Web Service**
3. **Public Git repository** → Gib deine GitHub-Repo-URL ein (siehe unten wie du sie erstellst)
   - ODER: Verbinde dein GitHub-Konto und wähle das Repo aus
4. **Settings**:
   - **Name**: `ueberstunden-backend`
   - **Region**: Frankfurt (Europe)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. **Environment Variables** (Add):
   ```
   MONGODB_URI = mongodb+srv://ueberstunden-user:<password>@cluster0.xxxxx.mongodb.net/ueberstunden
   PORT = 4000
   NODE_ENV = production
   ```
6. **Create Web Service**
7. Warte auf Deployment (5-10 Min)
8. Kopiere URL: `https://ueberstunden-backend.onrender.com`

## 3. Frontend auf Netlify deployen

1. Gehe zu https://app.netlify.com und melde dich an
2. **Add new site** → **Import an existing project**
3. Verbinde GitHub, wähle dein Repo
4. **Settings**:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/dist`
5. **Environment variables**:
   ```
   VITE_API_URL = https://ueberstunden-backend.onrender.com/api
   ```
6. **Deploy site**
7. Nach Deployment: **Domain settings** → Notiere URL: `https://deine-app.netlify.app`

## 4. GitHub Repository erstellen (falls noch nicht vorhanden)

```powershell
cd "c:\Users\user\Arbeitsplatz\Zeiterfassung"

# Git initialisieren
git init
git add .
git commit -m "Initial commit: Überstunden-Tracker"

# Auf GitHub: Erstelle neues Repo (ueberstunden-tracker)
# Dann:
git remote add origin https://github.com/DEIN-USERNAME/ueberstunden-tracker.git
git branch -M main
git push -u origin main
```

## 5. Fertig!

- **Frontend**: https://deine-app.netlify.app (von überall erreichbar)
- **Backend**: Läuft automatisch auf Render
- **Datenbank**: MongoDB Atlas (immer verfügbar)

**Wichtig**: 
- Render Free schläft nach 15 Min Inaktivität → erste Anfrage kann 30s dauern
- Für 24/7 ohne Sleep: Upgrade auf Render Starter ($7/Monat)

## Alternative: Vercel statt Netlify

```powershell
cd frontend
npm install -g vercel
vercel --prod
# Folge Anweisungen, setze VITE_API_URL als Env-Variable
```

## Kosten

- **MongoDB Atlas M0**: Kostenlos (512 MB)
- **Render Free**: Kostenlos (schläft nach Inaktivität)
- **Netlify Free**: Kostenlos (100 GB Bandwidth)

**Gesamt: 0 € / Monat** 🎉
