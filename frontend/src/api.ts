import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Enable credentials for session cookies
axios.defaults.withCredentials = true;

export interface Transaction {
  _id?: string;
  date: string;
  type: 'EARNED' | 'SPENT';
  minutes: number;
  description: string;
}

export async function getBalance() {
  const res = await axios.get(`${baseURL}/transactions/balance`);
  return res.data.balanceMinutes as number;
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

  // Auth functions
  export async function login(password: string) {
    const res = await axios.post(`${baseURL}/auth/login`, { password });
    return res.data;
  }

  export async function logout() {
    await axios.post(`${baseURL}/auth/logout`);
  }

  export async function checkAuthStatus() {
    try {
      const res = await axios.get(`${baseURL}/auth/status`);
      return res.data.authenticated as boolean;
    } catch {
      return false;
    }
  }
