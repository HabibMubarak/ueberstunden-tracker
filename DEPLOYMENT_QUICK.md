# Überstunden-Tracker - Deployment bereit! 🚀

Ich habe alles vorbereitet. Folge jetzt diese Schritte:

## Schritt 1: MongoDB Atlas (5 Min)
1. https://www.mongodb.com/cloud/atlas/register
2. Kostenloses Konto erstellen
3. M0 FREE Cluster erstellen (Region: Frankfurt)
4. Database User anlegen + Passwort speichern
5. Network Access: 0.0.0.0/0 erlauben
6. Connection String kopieren

## Schritt 2: Code zu GitHub pushen (2 Min)
```powershell
cd "c:\Users\user\Arbeitsplatz\Zeiterfassung"
git init
git add .
git commit -m "Initial commit"
```
Erstelle auf GitHub ein neues Repo: `ueberstunden-tracker`
```powershell
git remote add origin https://github.com/DEIN-USERNAME/ueberstunden-tracker.git
git branch -M main
git push -u origin main
```

## Schritt 3: Backend auf Render (5 Min)
1. https://render.com → Mit GitHub anmelden
2. New → Web Service → Dein Repo auswählen
3. Settings:
   - Root Directory: `backend`
   - Build: `npm install && npm run build`
   - Start: `npm start`
4. Environment Variables:
   - `MONGODB_URI`: (dein Atlas Connection String)
   - `PORT`: 4000
5. Create → Warte auf Deploy
6. Kopiere URL: `https://ueberstunden-backend-xxx.onrender.com`

## Schritt 4: Frontend auf Netlify (3 Min)
1. https://app.netlify.com → Mit GitHub anmelden
2. Add site → Import → Dein Repo
3. Settings:
   - Base: `frontend`
   - Build: `npm run build`
   - Publish: `frontend/dist`
4. Environment:
   - `VITE_API_URL`: `https://deine-render-url.onrender.com/api`
5. Deploy → Fertig!

## Ergebnis
✅ Von überall erreichbar (Handy, Tablet, PC)
✅ Gleiche Historie auf allen Geräten
✅ Komplett kostenlos

Die komplette Anleitung findest du in `DEPLOYMENT.md`.

Soll ich dich durch einen der Schritte begleiten?
