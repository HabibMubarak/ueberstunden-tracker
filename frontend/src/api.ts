import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export interface Transaction {
  _id?: string;
  date: string;
  type: 'EARNED' | 'SPENT';
  hours: number;
  description: string;
}

export async function getBalance() {
  const res = await axios.get(`${baseURL}/transactions/balance`);
  return res.data.balance as number;
}

export async function listTransactions() {
  const res = await axios.get(`${baseURL}/transactions`);
  return res.data as Transaction[];
}

export async function createTransaction(tx: Transaction) {
  const res = await axios.post(`${baseURL}/transactions`, tx);
  return res.data as Transaction;
}

export async function deleteTransaction(id: string) {
  await axios.delete(`${baseURL}/transactions/${id}`);
}

export async function updateTransaction(id: string, tx: Partial<Transaction>) {
  const res = await axios.put(`${baseURL}/transactions/${id}`, tx);
  return res.data as Transaction;
}
