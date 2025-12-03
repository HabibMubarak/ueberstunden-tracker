import { Router } from 'express';
import { TransactionModel } from '../models/Transaction.js';

const router = Router();

// Create a transaction
router.post('/', async (req, res) => {
  try {
    const { date, type, hours, description } = req.body;
    if (!date || !type || hours == null || !description) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Basic validation/sanitization
    const parsedHours = typeof hours === 'string' ? Number(hours) : hours;
    if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
      return res.status(400).json({ message: 'Hours must be a positive number' });
    }

    const normalizedDate = String(date).slice(0, 10); // YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
      return res.status(400).json({ message: 'Date must be YYYY-MM-DD' });
    }

    const tx = await TransactionModel.create({ date: normalizedDate, type, hours: parsedHours, description });
    res.status(201).json(tx);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create transaction', error: String(err) });
  }
});

// List all transactions (sorted by date asc)
router.get('/', async (_req, res) => {
  try {
    const list = await TransactionModel.find().sort({ date: 1, createdAt: 1 }).exec();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch transactions', error: String(err) });
  }
});

// Get current balance
router.get('/balance', async (_req, res) => {
  try {
    const all = await TransactionModel.find().exec();
    const balance = all.reduce((acc, t) => acc + (t.type === 'EARNED' ? t.hours : -t.hours), 0);
    res.json({ balance });
  } catch (err) {
    res.status(500).json({ message: 'Failed to compute balance', error: String(err) });
  }
});

// Update a transaction
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, type, hours, description } = req.body;
    const update: Record<string, unknown> = {};
    if (date) update.date = date;
    if (type) update.type = type;
    if (hours != null) update.hours = hours;
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
