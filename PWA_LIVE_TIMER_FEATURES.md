# 📱 PWA & Live Timer Features

## ✨ Neue Features implementiert:

### 1. **Favicon & Icon** ⏱️
- Automatisches SVG-Favicon mit Timer-Symbol
- iOS Apple Touch Icon
- PWA-Icons für verschiedene Bildschirmgrößen

### 2. **Live Timer** ⏱️
- Start/Stop Button für aktuelle Zeitmessung
- Wählbar zwischen "Hinzufügen" (EARNED) und "Abziehen" (SPENT)
- Reset-Button zum Zurücksetzen
- Speichern-Button zum Eintrag erstellen
- Automatisch als "Timer: [Typ] Xh Ym" gespeichert

### 3. **PWA Installation** 📲
- Web App Manifest mit Shortcuts
- Service Worker für Offline-Unterstützung
- Installation auf Homescreen möglich
- Push Notification Support (optional)

## 🚀 PWA Verwenden:

### **Auf dem Smartphone (iOS/Android)**
1. **Chrome/Edge**: Menu → "App installieren" oder "Zum Startbildschirm"
2. **Safari (iOS)**: Share → "Zum Home-Bildschirm"
3. **Samsung Internet**: Menü → "App hinzufügen"

### **Nach Installation:**
- App lädt offline (mit Offline-Seite)
- Push Benachrichtigungen (wenn aktiviert)
- Standalone Window (keine Browser-UI)
- App Icon auf Homescreen

## 📋 Shortcuts (Android/Chrome)
Nach Installation können direkt von Home:
- "➕ Stunden hinzufügen"
- "➖ Stunden abziehen"

## ⚙️ Anpassungen:
Alle Einstellungen können im `manifest.json` angepasst werden:
- App-Namen
- Theme-Farbe
- Icons
- Shortcuts
- Kategorien

## 🔔 Benachrichtigungen (optional)
Der Service Worker kann Push-Nachrichten zeigen:
```javascript
if ('Notification' in window && 'serviceWorker' in navigator) {
  Notification.requestPermission();
}
```

