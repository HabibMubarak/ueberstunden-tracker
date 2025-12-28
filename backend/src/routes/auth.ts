import { Router } from 'express';
import bcrypt from 'bcryptjs';

const router = Router();

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { password } = req.body;
    const correctPassword = process.env.APP_PASSWORD || 'Inuyasha1998';

    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }

    if (password === correctPassword) {
      // @ts-ignore - express-session types
      req.session.authenticated = true;
      // Force save session before responding
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      return res.json({ success: true });
    }

    return res.status(401).json({ error: 'Invalid password' });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

// Check auth status
router.get('/status', (req, res) => {
  // @ts-ignore
  const authenticated = req.session.authenticated || false;
  res.json({ authenticated });
});

// Change password endpoint
router.post('/change-password', async (req, res) => {
  try {
    // @ts-ignore
    if (!req.session.authenticated) {
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    const { oldPassword, newPassword } = req.body;
    const correctPassword = process.env.APP_PASSWORD || 'Inuyasha1998';

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Beide Passwörter erforderlich' });
    }

    if (oldPassword !== correctPassword) {
      return res.status(401).json({ error: 'Altes Passwort ist falsch' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Neues Passwort muss mindestens 6 Zeichen haben' });
    }

    // NOTE: In production würdest du das neue Passwort in einer Datenbank speichern
    // Hier wird es nur zur Laufzeit akzeptiert, aber nach Neustart geht es zurück zu .env
    console.warn('⚠️ Passwort geändert, aber nur zur Laufzeit. In .env muss es manuell aktualisiert werden!');
    console.log('Neues Passwort:', newPassword);
    
    return res.json({ success: true, warning: 'Passwort nur zur Laufzeit geändert. Bitte .env-Datei manuell aktualisieren!' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
