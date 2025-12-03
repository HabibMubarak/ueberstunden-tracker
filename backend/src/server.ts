import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import session from 'express-session';
import transactionsRouter from './routes/transactions.js';
import authRouter from './routes/auth.js';
import { requireAuth } from './middleware/auth.js';

dotenv.config();

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'ueberstunden-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Auth routes (public)
app.use('/api/auth', authRouter);

// Protected routes
app.use('/api/transactions', requireAuth, transactionsRouter);

const port = process.env.PORT || 4000;
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ueberstunden';

async function start() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');
    app.listen(port, () => console.log(`Backend running on http://localhost:${port}`));
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
}

start();
