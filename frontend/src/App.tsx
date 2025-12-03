import React, { useEffect, useMemo, useState } from 'react';
import { createTransaction, getBalance, listTransactions, deleteTransaction, updateTransaction, Transaction } from './api';

function BalanceBadge({ balance }: { balance: number }) {
  const color = balance >= 0 ? 'text-green-600' : 'text-red-600';
  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 shadow p-5">
      <div className="text-sm text-gray-500 dark:text-gray-400">Aktueller Saldo</div>
      <div className={`mt-1 text-4xl font-extrabold ${color}`}>{balance.toFixed(2)} Std</div>
    </div>
  );
}

function ActionButtons({ onAdd, onSpend }: { onAdd: () => void; onSpend: () => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button className="px-4 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium shadow" onClick={onAdd}>
        ➕ Stunden Hinzufügen
      </button>
      <button className="px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium shadow" onClick={onSpend}>
        ➖ Stunden Abziehen
      </button>
    </div>
  );
}

function TransactionModal({
  type,
  onClose,
  onSubmit,
  initialDate,
  initialHours,
  initialDescription,
}: {
  type: 'EARNED' | 'SPENT';
  onClose: () => void;
  onSubmit: (tx: Omit<Transaction, '_id'>) => void;
  initialDate?: string;
  initialHours?: number;
  initialDescription?: string;
}) {
  const [date, setDate] = useState<string>(() => initialDate ?? new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState<number>(initialHours ?? 0);
  const [description, setDescription] = useState(initialDescription ?? '');

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-50 rounded-xl shadow-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          {type === 'EARNED' ? 'Stunden Hinzufügen' : 'Stunden Abziehen'}
        </h2>
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-900">Datum</span>
            <input
              type="date"
              className="w-full mt-1 p-2 border border-gray-300 rounded bg-white text-gray-900"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-900">Stunden (Dezimal)</span>
            <input
              type="number"
              step="0.25"
              className="w-full mt-1 p-2 border border-gray-300 rounded bg-white text-gray-900"
              value={hours}
              onChange={(e) => setHours(parseFloat(e.target.value))}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-900">Beschreibung</span>
            <input
              type="text"
              className="w-full mt-1 p-2 border border-gray-300 rounded bg-white text-gray-900"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <div className="flex gap-3 justify-end pt-2">
            <button 
              className="px-4 py-2 rounded border border-gray-300 bg-white hover:bg-gray-100 text-gray-700" 
              onClick={onClose}
            >
              Abbrechen
            </button>
            <button
              className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium"
              onClick={() => onSubmit({ date, type, hours, description })}
            >
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type SortKey = 'date' | 'description' | 'hours';

function History({
  transactions,
  sortKey,
  sortDir,
  onChangeSortKey,
  onToggleSortDir,
  onDelete,
  onEdit,
}: {
  transactions: Transaction[];
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onChangeSortKey: (k: SortKey) => void;
  onToggleSortDir: () => void;
  onDelete: (id: string) => void;
  onEdit: (tx: Transaction) => void;
}) {
  const sorted = useMemo(() => {
    const list = [...transactions];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') {
        cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortKey === 'description') {
        cmp = a.description.localeCompare(b.description);
      } else {
        cmp = a.hours - b.hours;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [transactions, sortKey, sortDir]);

  const rows = useMemo(() => {
    // Berechne laufenden Saldo chronologisch (immer nach Datum sortiert)
    const chronological = [...transactions].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const runningMap = new Map<string, number>();
    let running = 0;
    chronological.forEach((t) => {
      running += t.type === 'EARNED' ? t.hours : -t.hours;
      runningMap.set(t._id || `${t.date}-${t.description}`, running);
    });

    // Verwende die sortierte Liste, aber mit chronologisch berechnetem Saldo
    return sorted.map((t) => ({
      ...t,
      running: runningMap.get(t._id || `${t.date}-${t.description}`) || 0,
    }));
  }, [sorted, transactions]);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">Historie</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Sortiert nach: {sortKey === 'date' ? 'Datum' : sortKey === 'description' ? 'Beschreibung' : 'Stunden'}</span>
          <button
            className="px-3 py-1 border rounded bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={onToggleSortDir}
            title="Sortierreihenfolge umschalten"
          >
            {sortDir === 'asc' ? '▲ Aufsteigend' : '▼ Absteigend'}
          </button>
        </div>
      </div>
      <div className="overflow-auto rounded-xl bg-white dark:bg-gray-800 shadow">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-white dark:bg-gray-800">
            <tr className="border-b">
              <th className="p-2">
                <button 
                  className="hover:underline flex items-center gap-1" 
                  onClick={() => {
                    if (sortKey === 'date') {
                      onToggleSortDir();
                    } else {
                      onChangeSortKey('date');
                    }
                  }}
                >
                  Datum {sortKey === 'date' && (sortDir === 'asc' ? '▲' : '▼')}
                </button>
              </th>
              <th className="p-2">
                <button 
                  className="hover:underline flex items-center gap-1" 
                  onClick={() => {
                    if (sortKey === 'description') {
                      onToggleSortDir();
                    } else {
                      onChangeSortKey('description');
                    }
                  }}
                >
                  Beschreibung {sortKey === 'description' && (sortDir === 'asc' ? '▲' : '▼')}
                </button>
              </th>
              <th className="p-2 text-right">
                <button 
                  className="hover:underline flex items-center gap-1 ml-auto" 
                  onClick={() => {
                    if (sortKey === 'hours') {
                      onToggleSortDir();
                    } else {
                      onChangeSortKey('hours');
                    }
                  }}
                >
                  Stunden {sortKey === 'hours' && (sortDir === 'asc' ? '▲' : '▼')}
                </button>
              </th>
              <th className="p-2 text-right">Laufender Saldo</th>
              <th className="p-2 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t._id || `${t.date}-${t.description}-${t.hours}`} className="border-b odd:bg-gray-50 dark:odd:bg-gray-900">
                <td className="p-2">{t.date}</td>
                <td className="p-2">{t.description}</td>
                <td className="p-2 text-right font-mono">{t.type === 'EARNED' ? '+' : '-'}{t.hours.toFixed(2)}</td>
                <td className="p-2 text-right font-mono">{t.running.toFixed(2)}</td>
                <td className="p-2 text-right space-x-2">
                  {t._id ? (
                    <>
                      <button
                        className="px-2 py-1 text-xs rounded bg-gray-600 hover:bg-gray-700 text-white"
                        onClick={() => onEdit(t)}
                      >
                        Bearbeiten
                      </button>
                      <button
                        className="px-2 py-1 text-xs rounded bg-red-600 hover:bg-red-700 text-white"
                        onClick={() => {
                          if (confirm('Diesen Eintrag wirklich löschen?')) onDelete(t._id!);
                        }}
                      >
                        Löschen
                      </button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CalendarView({ transactions, onQuickAdd }: { transactions: Transaction[]; onQuickAdd: (isoDate: string) => void }) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const { days, monthLabel, totalsByDay } = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);

    const totals = new Map<number, number>();
    transactions.forEach((t) => {
      const d = new Date(t.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const delta = t.type === 'EARNED' ? t.hours : -t.hours;
        totals.set(d.getDate(), (totals.get(d.getDate()) || 0) + delta);
      }
    });

    // Build calendar with Monday as first day
    const startWeekday = (first.getDay() + 6) % 7; // 0=Mon .. 6=Sun
    const leading = Array.from({ length: startWeekday }, () => null);
    const daysInMonth = Array.from({ length: last.getDate() }, (_, i) => i + 1);
    const gridDays: (number | null)[] = [...leading, ...daysInMonth];
    const monthLabelStr = first.toLocaleString('de-DE', { month: 'long', year: 'numeric' });
    return { days: gridDays, monthLabel: monthLabelStr, totalsByDay: totals };
  }, [transactions, currentMonth]);

  function prevMonth() {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">Kalender</h3>
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 border rounded" onClick={prevMonth}>◀</button>
          <div className="font-medium">{monthLabel}</div>
          <button className="px-3 py-2 border rounded" onClick={nextMonth}>▶</button>
        </div>
      </div>
      <div className="rounded-xl bg-white dark:bg-gray-800 shadow p-3">
        <div className="grid grid-cols-7 text-center text-xs font-semibold text-gray-500 mb-2">
          {weekDays.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days.map((d, idx) => {
            const isToday = (() => {
              if (!d) return false;
              const base = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
              return base.toDateString() === today.toDateString();
            })();
            return (
              <div
                key={idx}
                className={`min-h-[72px] border rounded-lg p-2 flex flex-col ${isToday ? 'border-blue-500' : ''}`}
              >
                {d ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">{d}</div>
                      <button
                        className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => {
                          const iso = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d)
                            .toISOString()
                            .slice(0, 10);
                          onQuickAdd(iso);
                        }}
                      >
                        +
                      </button>
                    </div>
                    {typeof totalsByDay.get(d) === 'number' && totalsByDay.get(d)! !== 0 ? (
                      <div className={`mt-1 text-sm font-medium ${totalsByDay.get(d)! >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {totalsByDay.get(d)!.toFixed(2)} Std
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-gray-400">—</div>
                    )}
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [modalType, setModalType] = useState<null | 'EARNED' | 'SPENT'>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  async function refresh() {
    const [b, list] = await Promise.all([getBalance(), listTransactions()]);
    setBalance(b);
    setTransactions(list);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSubmit(tx: Omit<Transaction, '_id'>) {
    if (editingTx && editingTx._id) {
      await updateTransaction(editingTx._id, tx);
      setEditingTx(null);
    } else {
      await createTransaction(tx);
    }
    setModalType(null);
    setSelectedDate(null);
    await refresh();
  }

  async function handleDelete(id: string) {
    await deleteTransaction(id);
    await refresh();
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <BalanceBadge balance={balance} />
      <ActionButtons onAdd={() => setModalType('EARNED')} onSpend={() => setModalType('SPENT')} />
      {modalType && (
        <TransactionModal
          type={modalType}
          initialDate={selectedDate ?? (editingTx?.date ?? undefined)}
          initialHours={editingTx?.hours}
          initialDescription={editingTx?.description}
          onClose={() => {
            setModalType(null);
            setSelectedDate(null);
            setEditingTx(null);
          }}
          onSubmit={handleSubmit}
        />
      )}
      <History
        transactions={transactions}
        sortKey={sortKey}
        sortDir={sortDir}
        onChangeSortKey={setSortKey}
        onToggleSortDir={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
        onDelete={handleDelete}
        onEdit={(tx) => {
          setEditingTx(tx);
          setSelectedDate(tx.date);
          setModalType(tx.type);
        }}
      />

      <CalendarView
        transactions={transactions}
        onQuickAdd={(iso) => {
          setSelectedDate(iso);
          setModalType('EARNED');
        }}
      />
    </div>
  );
}
