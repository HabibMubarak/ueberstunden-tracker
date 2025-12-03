import { Schema, model } from 'mongoose';

export type TransactionType = 'EARNED' | 'SPENT';

export interface Transaction {
  date: string; // ISO date string
  type: TransactionType;
  minutes: number; // integer minutes
  description: string;
}

const transactionSchema = new Schema<Transaction>(
  {
    date: { type: String, required: true },
    type: { type: String, enum: ['EARNED', 'SPENT'], required: true },
    minutes: { type: Number, required: true, min: 0 },
    description: { type: String, required: true },
  },
  { timestamps: true }
);

// Legacy compatibility: expose both `minutes` and computed `hours` in outputs
transactionSchema.set('toJSON', {
  transform: (doc: any, ret: any) => {
    // If legacy document stored `hours`, compute minutes
    if (ret.minutes == null && typeof ret.hours === 'number') {
      ret.minutes = Math.round(ret.hours * 60);
    }
    // Always provide computed hours for frontend compatibility
    if (ret.hours == null && typeof ret.minutes === 'number') {
      ret.hours = ret.minutes / 60;
    }
    return ret;
  },
});

export const TransactionModel = model<Transaction>('Transaction', transactionSchema);
