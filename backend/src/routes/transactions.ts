import { Router } from 'express';
import { TransactionModel } from '../models/Transaction.js';

const router = Router();

// Create a transaction
router.post('/', async (req, res) => {
  try {
    const { date, type, minutes, hours, description } = req.body;
    if (!date || !type || (minutes == null && hours == null) || !description) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Basic validation/sanitization
    let parsedMinutes: number | null = null;
    if (minutes != null) {
      const m = typeof minutes === 'string' ? Number(minutes) : minutes;
      if (!Number.isFinite(m) || m <= 0 || !Number.isInteger(m)) {
        return res.status(400).json({ message: 'Minutes must be a positive integer' });
      }
      parsedMinutes = m;
    } else if (hours != null) {
      const h = typeof hours === 'string' ? Number(hours) : hours;
      if (!Number.isFinite(h) || h <= 0) {
        return res.status(400).json({ message: 'Hours must be a positive number' });
      }
      parsedMinutes = Math.round(h * 60);
    }

    const normalizedDate = String(date).slice(0, 10); // YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
      return res.status(400).json({ message: 'Date must be YYYY-MM-DD' });
    }

    const tx = await TransactionModel.create({ date: normalizedDate, type, minutes: parsedMinutes!, description });
    res.status(201).json(tx);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create transaction', error: String(err) });
  }
});

// List all transactions (sorted by date asc)
router.get('/', async (_req, res) => {
  try {
    const list = await TransactionModel.find().sort({ date: 1, createdAt: 1 }).exec();
    const withDisplay = list.map((t: any) => {
      const m = typeof t.minutes === 'number' ? t.minutes : (typeof t.hours === 'number' ? Math.round(t.hours * 60) : 0);
      const hours = Math.floor(m / 60);
      const minutes = m % 60;
      const display = `${hours}:${String(minutes).padStart(2, '0')}`;
      const json = t.toJSON();
      return { ...json, minutes: m, display };
    });
    res.json(withDisplay);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch transactions', error: String(err) });
  }
});

// Get current balance
router.get('/balance', async (_req, res) => {
  try {
    const all = await TransactionModel.find().exec();
    const balanceMinutes = all.reduce((acc, t: any) => {
      const m = typeof t.minutes === 'number' ? t.minutes : (typeof t.hours === 'number' ? Math.round(t.hours * 60) : 0);
      return acc + (t.type === 'EARNED' ? m : -m);
    }, 0);
    // Provide both minutes and decimal hours for compatibility
    res.json({ balanceMinutes, balance: balanceMinutes / 60 });
  } catch (err) {
    res.status(500).json({ message: 'Failed to compute balance', error: String(err) });
  }
});

// Update a transaction
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, type, minutes, description } = req.body;
    const update: Record<string, unknown> = {};
    if (date) update.date = date;
    if (type) update.type = type;
    if (minutes != null) {
      const parsedMinutes = typeof minutes === 'string' ? Number(minutes) : minutes;
      if (!Number.isFinite(parsedMinutes) || parsedMinutes <= 0 || !Number.isInteger(parsedMinutes)) {
        return res.status(400).json({ message: 'Minutes must be a positive integer' });
      }
      update.minutes = parsedMinutes;
    }
    if (description) update.description = description;

    const updated = await TransactionModel.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    }).exec();
    if (!updated) return res.status(404).json({ message: 'Transaction not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update transaction', error: String(err) });
  }
});

// Delete a transaction by id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await TransactionModel.findByIdAndDelete(id).exec();
    if (!deleted) return res.status(404).json({ message: 'Transaction not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete transaction', error: String(err) });
  }
});

export default router;
