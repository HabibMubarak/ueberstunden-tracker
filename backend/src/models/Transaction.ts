import { Schema, model } from 'mongoose';

export type TransactionType = 'EARNED' | 'SPENT';

export interface Transaction {
  date: string; // ISO date string
  type: TransactionType;
  hours: number; // decimal hours
  description: string;
}

const transactionSchema = new Schema<Transaction>(
  {
    date: { type: String, required: true },
    type: { type: String, enum: ['EARNED', 'SPENT'], required: true },
    hours: { type: Number, required: true, min: 0 },
    description: { type: String, required: true },
  },
  { timestamps: true }
);

export const TransactionModel = model<Transaction>('Transaction', transactionSchema);
