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

export default router;
